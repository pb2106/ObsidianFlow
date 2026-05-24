/**
 * lib/middleware/withRole.ts
 * Wraps withAuth — additionally checks req.user.role against allowed roles.
 * Returns 403 if role not permitted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthedRequest } from '@/lib/middleware/withAuth';
import RoleModel from '@/models/role.model';

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
 * Admin-only routes — additionally enforces localhost origin.
 * Admin API endpoints must only be called from the local admin-app,
 * never from the deployed public domain.
 */
export function withAdmin(handler: RoleHandler) {
    return withRole(['admin'], async (req: AuthedRequest, ctx: { params: Record<string, string> }) => {
        const origin = req.headers.get('origin') ?? '';
        const referer = req.headers.get('referer') ?? '';
        // Allow: no origin (same-origin server calls), localhost, 127.0.0.1
        const isLocal =
            !origin ||
            /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
            /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(referer);

        if (!isLocal) {
            return NextResponse.json(
                { success: false, data: null, message: 'Forbidden', error: 'NOT_LOCAL' },
                { status: 403 }
            );
        }
        return handler(req, ctx);
    });
}

/**
 * Validates that the user's role contains a specific granular permission flag.
 * The core 'admin' role natively bypasses granular permission checks.
 */
export function withPermission(action: string, handler: RoleHandler) {
    return withAuth(async (req: AuthedRequest, ctx: { params: Record<string, string> }) => {
        // God-mode admin bypass
        if (req.user.role === 'admin') {
            const origin = req.headers.get('origin') ?? '';
            const referer = req.headers.get('referer') ?? '';
            const isLocal = !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(referer);
            if (!isLocal) {
                return NextResponse.json({ success: false, data: null, message: 'Forbidden API Origin', error: 'NOT_LOCAL' }, { status: 403 });
            }
            return handler(req, ctx);
        }

        // Fetch DB role for granular permission permutation
        const role = await RoleModel.findOne({ name: req.user.role });
        if (!role || !role.permissions?.[action]) {
            return NextResponse.json(
                { success: false, data: null, message: `Forbidden — missing permission: ${action}`, error: 'FORBIDDEN' },
                { status: 403 }
            );
        }

        // Sub-admins are still admins conceptually, so enforce localhost origin constraint
        const origin = req.headers.get('origin') ?? '';
        const referer = req.headers.get('referer') ?? '';
        const isLocal = !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(referer);
        if (!isLocal) {
            return NextResponse.json({ success: false, data: null, message: 'Forbidden API Origin', error: 'NOT_LOCAL' }, { status: 403 });
        }

        return handler(req, ctx);
    });
}

