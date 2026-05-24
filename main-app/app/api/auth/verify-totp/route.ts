/**
 * app/api/auth/verify-totp/route.ts
 * POST /api/auth/verify-totp
 * Completes the 2FA bridge and issues the actual session.
 */

import { NextRequest } from 'next/server';
import { ok, fail, validationError, secureHeaders } from '@/lib/api/response';
import { adminRateLimit } from '@/lib/middleware/rateLimit';
import { endpointGuard } from '@/lib/middleware/endpointGuard';
import UserModel from '@/models/user.model';
import SessionModel from '@/models/session.model';
import { authenticator } from 'otplib';
import bcrypt from 'bcryptjs';
import { verifyToken, signAccessToken, signRefreshToken, generateRefreshToken } from '@/lib/auth/jwt';
import { projectConfig } from '@/config/project.config';
import { z } from 'zod';

export const endpointMeta = {
    id: 'auth.totp.verify',
    area: 'Authentication',
    description: 'Verifies TOTP code or backup code and returns active session',
    method: 'POST',
    path: '/api/auth/verify-totp',
    defaultEnabled: true,
    canBeDisabled: false,
};

const verifySchema = z.object({
    tempToken: z.string().min(1, 'Missing temp token'),
    code: z.string().min(6, 'Invalid code length'),
});

async function handler(req: NextRequest) {
    const body = await req.json().catch(() => null);
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { tempToken, code } = parsed.data;

    let decoded;
    try {
        decoded = verifyToken(tempToken);
        if (decoded.type !== 'temp') throw new Error('Invalid token type');
    } catch {
        return fail('Invalid or expired temporary session. Please log in again.', 'UNAUTHORIZED', 401);
    }

    const user = await UserModel.findById(decoded.sub);
    if (!user) return fail('User not found', 'NOT_FOUND', 404);
    if (!user.totpSecret) return fail('TOTP not setup', 'TOTP_NOT_SETUP', 400);

    let isValid = false;

    // Is it a normal 6-digit TOTP?
    if (code.length === 6) {
        isValid = authenticator.verify({ token: code, secret: user.totpSecret });
    }
    // Or is it a backup code?
    else if (code.length === 8) {
        // Backup codes are hashed
        for (let i = 0; i < user.backupCodes.length; i++) {
            const match = await bcrypt.compare(code, user.backupCodes[i]);
            if (match) {
                isValid = true;
                // Backup codes are one-time use! Remove it.
                user.backupCodes.splice(i, 1);
                break;
            }
        }
    }

    if (!isValid) {
        return fail('Invalid TOTP code or backup code', 'INVALID_TOTP', 401);
    }

    // Mark as permanently enabled if it wasn't yet
    if (!user.totpEnabled) {
        user.totpEnabled = true;
    }

    // ── Enforce admin strictly 1 active session! ──
    if (user.role === 'admin') {
        // Destroy all previous active sessions immediately
        await SessionModel.deleteMany({ userId: user._id });
        // NOTE: A more complex system might keep previous sessions and evict oldest, 
        // but the spec explicitly stated "Only one active admin session per account — new login kills old one".
    } else {
        // Standard eviction for normal users
        const activeSessions = await SessionModel.countDocuments({ userId: user._id, isDeleted: false });
        const maxSessions = projectConfig.security.maxConcurrentSessions;
        if (activeSessions >= maxSessions) {
            const oldest = await SessionModel.findOne({ userId: user._id }).sort({ createdAt: 1 });
            if (oldest) await oldest.deleteOne();
        }
    }

    // Issue session
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    const userAgent = req.headers.get('user-agent') ?? '';

    const { raw: rawRefresh, hash: refreshHash } = generateRefreshToken();
    const maxAgeDays = projectConfig.auth.rememberMe.enabled ? projectConfig.auth.rememberMe.days : 1;
    const expiresAt = new Date(Date.now() + maxAgeDays * 24 * 60 * 60 * 1000);

    const session = await SessionModel.create({
        userId: user._id,
        refreshTokenHash: refreshHash,
        userAgent,
        ip,
        expiresAt,
    });

    user.lastLogin = new Date();
    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;
    user.loginHistory.push({ ip, timestamp: new Date(), userAgent });
    user.sessions.push(session._id as unknown as typeof user.sessions[number]);
    await user.save();

    const tokenPayload = {
        sub: String(user._id),
        email: user.email,
        role: user.role,
        sessionId: String(session._id),
    };

    const accessToken = signAccessToken(tokenPayload);

    const maxAge = maxAgeDays * 24 * 60 * 60;
    const res = ok({
        accessToken,
        user: {
            id: String(user._id),
            email: user.email,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
        },
    }, 'TOTP verified successfully');

    res.cookies.set('__refresh', rawRefresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge,
    });

    return secureHeaders(res);
}

export const POST = endpointGuard(
    endpointMeta.id,
    adminRateLimit(handler as any)
);
