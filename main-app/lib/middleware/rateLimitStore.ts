/**
 * lib/middleware/rateLimitStore.ts
 * Abstraction for rate limiting store.
 */

export interface RateLimitStore {
    increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
    reset(key: string): Promise<void>;
}

// ─── Memory Config ────────────────────────────────────────────────────────────

interface WindowEntry {
    count: number;
    resetAt: number; // epoch ms
}

class MemoryRateLimitStore implements RateLimitStore {
    private store = new Map<string, WindowEntry>();

    constructor() {
        // Clean up stale entries every 5 minutes
        setInterval(() => {
            const now = Date.now();
            this.store.forEach((entry, key) => {
                if (entry.resetAt < now) this.store.delete(key);
            });
        }, 5 * 60 * 1000).unref?.(); // unref so it doesn't block process exit if possible
    }

    async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
        const now = Date.now();
        const entry = this.store.get(key);

        if (!entry || entry.resetAt < now) {
            const resetAt = now + windowMs;
            this.store.set(key, { count: 1, resetAt });
            return { count: 1, resetAt };
        }

        entry.count++;
        return { count: entry.count, resetAt: entry.resetAt };
    }

    async reset(key: string): Promise<void> {
        this.store.delete(key);
    }
}

// ─── Redis Config ─────────────────────────────────────────────────────────────

class RedisRateLimitStore implements RateLimitStore {
    private redis: any;

    constructor(url: string, token: string) {
        // We require it dynamically here to avoid needing it in dev without vars
        const { Redis } = require('@upstash/redis');
        this.redis = new Redis({ url, token });
        console.info('[RateLimit] Initialized Upstash Redis store.');
    }

    async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
        const windowSeconds = Math.ceil(windowMs / 1000);
        const pipeline = this.redis.pipeline();
        pipeline.incr(key);
        // Expiration is set in seconds! Only set EX on first increment or just touch it
        pipeline.pttl(key);

        const [count, pttl] = await pipeline.exec();

        let msRemaining = pttl as number;
        if (msRemaining < 0) {
            // First time or key expired, set standard TTL
            await this.redis.pexpire(key, windowMs);
            msRemaining = windowMs;
        }

        return { count: count as number, resetAt: Date.now() + msRemaining };
    }

    async reset(key: string): Promise<void> {
        await this.redis.del(key);
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createRateLimitStore(): RateLimitStore {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token) {
        return new RedisRateLimitStore(url, token);
    }

    return new MemoryRateLimitStore();
}
