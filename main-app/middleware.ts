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

    // ── Static files & Favicon ────────────────────────────────────────────────
    if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon') || pathname.includes('.')) {
        return NextResponse.next();
    }

    // ── Local Admin App CORS Handling ──────────────────────────────────────────
    if (pathname.startsWith('/api/')) {
        const origin = req.headers.get('origin') ?? '';
        // Only allow CORS for the local admin app (port 3002)
        const isLocalAdmin = /^https?:\/\/(localhost|127\.0\.0\.1):3002$/.test(origin);

        if (req.method === 'OPTIONS') {
            const preflightHeaders = new Headers();
            if (isLocalAdmin) {
                preflightHeaders.set('Access-Control-Allow-Origin', origin);
                preflightHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
                preflightHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
                preflightHeaders.set('Access-Control-Allow-Credentials', 'true');
            }
            return new NextResponse(null, { status: 200, headers: preflightHeaders });
        }

        const res = NextResponse.next();
        if (isLocalAdmin) {
            res.headers.set('Access-Control-Allow-Origin', origin);
            res.headers.set('Access-Control-Allow-Credentials', 'true');
        }
        return res;
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
