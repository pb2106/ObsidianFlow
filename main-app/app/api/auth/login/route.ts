/**
 * app/api/auth/login/route.ts
 * POST /api/auth/login
 */

import { NextRequest } from 'next/server';
import { loginWithEmail } from '@/lib/auth/providers/email';
import { loginSchema } from '@/lib/api/schemas';
import { ok, fail, validationError, secureHeaders } from '@/lib/api/response';
import { authRateLimit } from '@/lib/middleware/rateLimit';
import { endpointGuard } from '@/lib/middleware/endpointGuard';
import { projectConfig } from '@/config/project.config';
import { AuthError } from '@/lib/auth/providers/email';

export const endpointMeta = {
    id: 'auth.login',
    area: 'Authentication',
    description: 'Authenticate with email/password and receive tokens',
    method: 'POST',
    path: '/api/auth/login',
    defaultEnabled: true,
    canBeDisabled: true,
};

async function handler(req: NextRequest) {
    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { identifier, password } = parsed.data;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    const userAgent = req.headers.get('user-agent') ?? '';

    try {
        const result = await loginWithEmail({ identifier, password, ip, userAgent });

        if (result.requires2FA) {
            return ok({
                requires2FA: true,
                tempToken: result.tempToken,
                user: result.user
            }, '2FA Required');
        }

        const maxAge = projectConfig.auth.rememberMe.enabled
            ? projectConfig.auth.rememberMe.days * 24 * 60 * 60
            : 24 * 60 * 60;

        const res = ok({
            accessToken: result.accessToken,
            user: result.user,
        }, 'Login successful');

        if (result.refreshToken) {
            res.cookies.set('__refresh', result.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge,
            });
        }

        return secureHeaders(res);
    } catch (err) {
        if (err instanceof AuthError) {
            return fail(err.message, err.code, err.statusCode);
        }
        return fail('Login failed', 'LOGIN_ERROR', 500);
    }
}

export const POST = endpointGuard(endpointMeta.id, authRateLimit(handler as any));
