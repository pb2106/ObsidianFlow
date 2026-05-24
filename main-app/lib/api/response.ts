/**
 * lib/api/response.ts
 * Standard API response envelope helpers.
 * Every route must use these — no raw NextResponse.json() calls in routes.
 */

import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

export interface ApiEnvelope<T = unknown> {
    success: boolean;
    data: T | null;
    message: string;
    error: unknown;
}

export function ok<T>(data: T, message = 'OK', status = 200): NextResponse {
    return NextResponse.json(
        { success: true, data, message, error: null } satisfies ApiEnvelope<T>,
        { status }
    );
}

export function fail(message: string, error: unknown = null, status = 400): NextResponse {
    return NextResponse.json(
        { success: false, data: null, message, error } satisfies ApiEnvelope,
        { status }
    );
}

export function validationError(err: ZodError): NextResponse {
    const issues = err.issues.map(i => ({ field: i.path.join('.'), message: i.message }));
    return NextResponse.json(
        { success: false, data: null, message: 'Validation failed', error: issues } satisfies ApiEnvelope,
        { status: 400 }
    );
}

// ─── Security headers applied to every response ───────────────────────────────
export function secureHeaders(res: NextResponse): NextResponse {
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('Pragma', 'no-cache');
    return res;
}
