/**
 * app/api/auth/register/route.ts
 * POST /api/auth/register
 */

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import UserModel from '@/models/user.model';
import SessionModel from '@/models/session.model';
import { hashPassword } from '@/lib/auth/password';
import { signAccessToken, signRefreshToken, generateRefreshToken } from '@/lib/auth/jwt';
import { registerSchema } from '@/lib/api/schemas';
import { ok, fail, validationError, secureHeaders } from '@/lib/api/response';
import { authRateLimit } from '@/lib/middleware/rateLimit';
import { endpointGuard } from '@/lib/middleware/endpointGuard';
import { projectConfig } from '@/config/project.config';
import { sanitiseBody } from '@/lib/security/sanitise';

export const endpointMeta = {
    id: 'auth.register',
    area: 'Authentication',
    description: 'Register a new user account',
    method: 'POST',
    path: '/api/auth/register',
    defaultEnabled: true,
    canBeDisabled: true,
};

async function handler(req: NextRequest) {
    await connectDB();

    let body = await req.json().catch(() => null);

    try {
        body = sanitiseBody(body);
    } catch (err: any) {
        return fail(err.message, 'SECURITY_VIOLATION', 400);
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const data = parsed.data as Record<string, any>;

    // Check duplicate email
    const existing = await UserModel.findOne({ email: data.email.toLowerCase() });
    if (existing) {
        return fail('An account with this email already exists', 'EMAIL_EXISTS', 409);
    }

    // Check duplicate username (if enabled)
    if ((data as Record<string, unknown>).username) {
        const existingUsername = await UserModel.findOne({ username: (data as Record<string, unknown>).username });
        if (existingUsername) {
            return fail('Username is already taken', 'USERNAME_EXISTS', 409);
        }
    }

    // Default role
    const defaultRole = projectConfig.roles.find(r => r.isDefault)?.name ?? 'user';

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Build user object
    const { password: _pw, ...rest } = data as Record<string, unknown>;
    const newUser = await UserModel.create({
        ...rest,
        email: data.email.toLowerCase(),
        passwordHash,
        role: defaultRole,
        isVerified: !projectConfig.auth.requireEmailVerification,
    });

    // Create session
    const { raw: rawRefresh, hash: refreshHash } = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = await SessionModel.create({
        userId: newUser._id,
        refreshTokenHash: refreshHash,
        userAgent: req.headers.get('user-agent') ?? '',
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '',
        expiresAt,
    });

    const tokenPayload = {
        sub: String(newUser._id),
        email: newUser.email,
        role: newUser.role,
        sessionId: String(session._id),
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    const res = ok({
        accessToken,
        user: {
            id: String(newUser._id),
            email: newUser.email,
            role: newUser.role,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
        },
    }, 'Account created successfully', 201);

    // Set httpOnly refresh cookie
    res.cookies.set('__refresh', rawRefresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
    });

    return secureHeaders(res);
}

export const POST = endpointGuard(endpointMeta.id, authRateLimit(handler as any));
