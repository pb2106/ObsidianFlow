/**
 * lib/middleware/withRole.ts
 * Wraps withAuth — additionally checks req.user.role against allowed roles.
 * Returns 403 if role not permitted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthedRequest } from '@/lib/middleware/withAuth';

type RoleHandler = (req: AuthedRequest, ctx: { params: Record<string, string> }) => Promise<NextResponse>;

export function withRole(allowedRoles: string[], handler: RoleHandler) {
    return withAuth(async (req: AuthedRequest, ctx: { params: Record<string, string> }) => {
        if (!allowedRoles.includes(req.user.role)) {
            return NextResponse.json(
                {
                    success: false,
                    data: null,
                    message: 'Forbidden — insufficient permissions',
                    error: 'FORBIDDEN',
                },
                { status: 403 }
            );
        }
        return handler(req, ctx);
    });
}

/**
 * Convenience wrapper for admin-only routes.
 */
export function withAdmin(handler: RoleHandler) {
    return withRole(['admin'], handler);
}
