/**
 * middleware.ts  (Next.js root middleware — runs at the edge)
 * setupGuard: redirects every route to /setup if project is not configured.
 * Also handles redirecting /setup → / when setup is already complete.
 *
 * Place this file at: main-app/middleware.ts  (root of the Next.js app)
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectConfig } from '@/config/project.config';

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // ── Skip API routes and static files ──────────────────────────────────────
    if (
        pathname.startsWith('/api/') ||
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    const setupDone = projectConfig.meta.setupComplete;

    // ── Setup not complete → redirect everything to /setup ────────────────────
    if (!setupDone && pathname !== '/setup') {
        return NextResponse.redirect(new URL('/setup', req.url));
    }

    // ── Setup complete → redirect /setup to / ─────────────────────────────────
    if (setupDone && pathname === '/setup') {
        return NextResponse.redirect(new URL('/', req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths EXCEPT:
         * - _next/static, _next/image, favicon.ico
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
