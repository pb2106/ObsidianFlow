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

// ─── IP Resolution ────────────────────────────────────────────────────────────
function isPrivateIP(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    if (parts[0] === '10') return true;
    if (parts[0] === '127') return true;
    if (parts[0] === '192' && parts[1] === '168') return true;
    if (parts[0] === '172') {
        const second = parseInt(parts[1], 10);
        if (second >= 16 && second <= 31) return true;
    }
    return false;
}

// Secure proxy IP resolution. We evaluate x-forwarded-for from right (trusted)
// to left (client controlled). The left-most IP can be easily spoofed!
function resolveTrustedIP(req: NextRequest): string {
    if (process.env.NODE_ENV !== 'production') {
        return req.ip ?? '127.0.0.1';
    }

    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
        const ips = forwarded.split(',').map(s => s.trim());
        for (let i = ips.length - 1; i >= 0; i--) {
            if (!isPrivateIP(ips[i])) {
                return ips[i];
            }
        }
    }

    return req.headers.get('x-real-ip') ?? req.ip ?? 'unknown';
}

// ─── Middleware factory ────────────────────────────────────────────────────────
type Handler = (req: NextRequest, ctx: { params: Record<string, string> }) => Promise<NextResponse>;

export function rateLimit(config: RateLimitConfig, keyPrefix = 'rl') {
    return function (handler: Handler): Handler {
        return async function (req: NextRequest, ctx: { params: Record<string, string> }) {
            // Key = prefix + secure resolved client IP address
            const ip = resolveTrustedIP(req);
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
