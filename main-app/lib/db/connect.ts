/**
 * lib/db/connect.ts
 * Singleton Mongoose connection with pooling, lazy init, and reconnect.
 * Every API route calls: await connectDB()
 * Calling multiple times is idempotent — reuses the existing connection.
 */

import mongoose from 'mongoose';
import { validateEnv } from '@/lib/env';

// Validate all required env vars at module load time
validateEnv();

const MONGODB_URI = process.env.MONGODB_URI;


interface MongooseCache {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
}

// Preserve connection across Next.js HMR in development
declare global {
    // eslint-disable-next-line no-var
    var __mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.__mongoose ?? { conn: null, promise: null };
global.__mongoose = cached;

export async function connectDB(): Promise<typeof mongoose> {
    // ── Validate env var on every call — fail loudly ─────────────────────────
    if (!MONGODB_URI) {
        throw new Error(
            '[connectDB] MONGODB_URI is not set. Run the setup wizard or add it to .env.local.'
        );
    }

    // ── Return cached connection if healthy ───────────────────────────────────
    if (cached.conn && mongoose.connection.readyState === 1) {
        return cached.conn;
    }

    // ── Create new connection promise if none exists ──────────────────────────
    if (!cached.promise) {
        cached.promise = mongoose
            .connect(MONGODB_URI, {
                bufferCommands: false,
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                family: 4,    // prefer IPv4
            })
            .then((m) => {
                console.log('[connectDB] MongoDB connected successfully');
                return m;
            });
    }

    // ── Await and cache ───────────────────────────────────────────────────────
    try {
        cached.conn = await cached.promise;
    } catch (err) {
        // Clear so the next call retries
        cached.promise = null;
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`[connectDB] Connection failed: ${message}`);
    }

    return cached.conn;
}
