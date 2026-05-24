/**
 * app/api/auth/logout/route.ts
 * POST /api/auth/logout
 */

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import SessionModel from '@/models/session.model';
import { withAuth, AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, secureHeaders } from '@/lib/api/response';
import { endpointGuard } from '@/lib/middleware/endpointGuard';

export const endpointMeta = {
    id: 'auth.logout',
    area: 'Authentication',
    description: 'Invalidate current session and clear refresh cookie',
    method: 'POST',
    path: '/api/auth/logout',
    defaultEnabled: true,
    canBeDisabled: false,
};

async function handler(req: AuthedRequest) {
    await connectDB();

    // Delete the session document
    await SessionModel.deleteOne({ _id: req.user.sessionId });

    const res = ok(null, 'Logged out successfully');

    // Clear the refresh cookie
    res.cookies.set('__refresh', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });

    return secureHeaders(res);
}

export const POST = endpointGuard(
    endpointMeta.id,
    withAuth(handler as (req: AuthedRequest, ctx: { params: Record<string, string> }) => Promise<Response>)
);
