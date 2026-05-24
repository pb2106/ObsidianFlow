/**
 * lib/middleware/rateLimit.ts
 * In-memory sliding window rate limiter.
 * Interface mirrors what a Redis store would expose — swap the store later
 * without changing any call sites.
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── In-memory store ──────────────────────────────────────────────────────────
interface WindowEntry {
    count: number;
    resetAt: number; // epoch ms
}

const store = new Map<string, WindowEntry>();

// Clean up stale entries every 5 minutes to prevent memory leak
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (entry.resetAt < now) store.delete(key);
    }
}, 5 * 60 * 1000);

// ─── Core check ───────────────────────────────────────────────────────────────
interface RateLimitConfig {
    windowMs: number;
    max: number;
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
        // Fresh window
        store.set(key, { count: 1, resetAt: now + config.windowMs });
        return { allowed: true, remaining: config.max - 1, resetAt: now + config.windowMs };
    }

    if (entry.count >= config.max) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: config.max - entry.count, resetAt: entry.resetAt };
}

// ─── Middleware factory ────────────────────────────────────────────────────────
type Handler = (req: NextRequest, ctx: { params: Record<string, string> }) => Promise<NextResponse>;

export function rateLimit(config: RateLimitConfig, keyPrefix = 'rl') {
    return function (handler: Handler): Handler {
        return async function (req: NextRequest, ctx: { params: Record<string, string> }) {
            // Key = prefix + IP address (or forwarded-for header)
            const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                ?? req.headers.get('x-real-ip')
                ?? 'unknown';
            const key = `${keyPrefix}:${ip}`;

            const result = checkRateLimit(key, config);

            if (!result.allowed) {
                const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
                return NextResponse.json(
                    {
                        success: false,
                        data: null,
                        message: `Too many requests. Try again in ${retryAfter} seconds.`,
                        error: 'RATE_LIMITED',
                    },
                    {
                        status: 429,
                        headers: {
                            'Retry-After': String(retryAfter),
                            'X-RateLimit-Limit': String(config.max),
                            'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
                        },
                    }
                );
            }

            const response = await handler(req, ctx);

            // Attach rate limit headers to successful responses
            response.headers.set('X-RateLimit-Limit', String(config.max));
            response.headers.set('X-RateLimit-Remaining', String(result.remaining));
            response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

            return response;
        };
    };
}

// ─── Pre-configured limiters from project config ───────────────────────────────
import { projectConfig } from '@/config/project.config';

export const authRateLimit = rateLimit(projectConfig.security.rateLimiting.auth, 'auth');
export const adminRateLimit = rateLimit(projectConfig.security.rateLimiting.admin, 'admin');
