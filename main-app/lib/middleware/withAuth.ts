/**
 * lib/middleware/withAuth.ts
 * API route wrapper — extracts Bearer token, verifies RS256, attaches decoded user.
 * Returns 401 with standard envelope if missing or invalid.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, TokenPayload } from '@/lib/auth/jwt';

export type AuthedRequest = NextRequest & { user: TokenPayload };

type Handler = (req: AuthedRequest, ctx: { params: Record<string, string> }) => Promise<NextResponse>;

export function withAuth(handler: Handler) {
    return async function (req: NextRequest, ctx: { params: Record<string, string> }) {
        const authHeader = req.headers.get('authorization') ?? '';

        if (!authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, data: null, message: 'Unauthorized', error: 'MISSING_TOKEN' },
                { status: 401 }
            );
        }

        const token = authHeader.slice(7);

        try {
            const payload = verifyToken(token);
            if (payload.type !== 'access') {
                return NextResponse.json(
                    { success: false, data: null, message: 'Unauthorized', error: 'INVALID_TOKEN_TYPE' },
                    { status: 401 }
                );
            }
            // Attach user to request
            (req as AuthedRequest).user = payload;
            return handler(req as AuthedRequest, ctx);
        } catch {
            return NextResponse.json(
                { success: false, data: null, message: 'Unauthorized', error: 'INVALID_TOKEN' },
                { status: 401 }
            );
        }
    };
}
