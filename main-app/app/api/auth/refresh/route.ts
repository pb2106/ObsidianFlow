/**
 * app/api/auth/refresh/route.ts
 * POST /api/auth/refresh
 * Reads __refresh httpOnly cookie, rotates tokens, sets new cookie.
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { rotateRefreshToken } from '@/lib/auth/jwt';
import { ok, fail, secureHeaders } from '@/lib/api/response';
import { endpointGuard } from '@/lib/middleware/endpointGuard';

export const endpointMeta = {
    id: 'auth.refresh',
    area: 'Authentication',
    description: 'Rotate refresh token and issue new access token',
    method: 'POST',
    path: '/api/auth/refresh',
    defaultEnabled: true,
    canBeDisabled: false,
};

async function handler(req: NextRequest) {
    const cookieStore = await cookies();
    const refreshCookie = cookieStore.get('__refresh');

    if (!refreshCookie?.value) {
        return fail('No refresh token', 'NO_REFRESH_TOKEN', 401);
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    const userAgent = req.headers.get('user-agent') ?? '';

    try {
        const { accessToken, refreshToken } = await rotateRefreshToken(
            refreshCookie.value,
            { ip, userAgent }
        );

        const res = ok({ accessToken }, 'Token refreshed');

        res.cookies.set('__refresh', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 30 * 24 * 60 * 60,
        });

        return secureHeaders(res);
    } catch {
        // Clear bad cookie
        const res = fail('Refresh token invalid or expired', 'REFRESH_FAILED', 401);
        res.cookies.set('__refresh', '', { httpOnly: true, path: '/', maxAge: 0 });
        return secureHeaders(res);
    }
}

export const POST = endpointGuard(endpointMeta.id, handler);
