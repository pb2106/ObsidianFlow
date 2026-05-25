/**
 * lib/middleware/rateLimit.ts
 * In-memory sliding window rate limiter.
 * Interface mirrors what a Redis store would expose — swap the store later
 * without changing any call sites.
 */

import { NextRequest, NextResponse } from 'next/server';

import { createRateLimitStore } from './rateLimitStore';

const store = createRateLimitStore();

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

async function checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const { count, resetAt } = await store.increment(key, config.windowMs);

    if (count > config.max) {
        return { allowed: false, remaining: 0, resetAt };
    }

    return { allowed: true, remaining: config.max - count, resetAt };
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

            const result = await checkRateLimit(key, config);

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
