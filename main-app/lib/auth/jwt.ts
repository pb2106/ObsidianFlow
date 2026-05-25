/**
 * lib/auth/jwt.ts
 * RS256 JWT operations: sign, verify, rotate.
 * Keys are loaded from env vars (PEM format with \n escaped as \\n).
 */

import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { projectConfig } from '@/config/project.config';
import SessionModel from '@/models/session.model';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// ─── Key loading ──────────────────────────────────────────────────────────────
function getPrivateKey(): string {
    const raw = process.env.JWT_PRIVATE_KEY;
    if (!raw) throw new Error('[jwt] JWT_PRIVATE_KEY is not set');
    return raw.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
}

function getPublicKey(): string {
    const raw = process.env.JWT_PUBLIC_KEY;
    if (!raw) throw new Error('[jwt] JWT_PUBLIC_KEY is not set');
    return raw.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
}

// Startup check to prevent silent auth failures
const _startupPriv = process.env.JWT_PRIVATE_KEY;
if (_startupPriv) {
    const formatted = _startupPriv.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
    if (!formatted.startsWith('-----BEGIN')) {
        throw new Error('[jwt] JWT_PRIVATE_KEY is malformed: does not start with -----BEGIN. The likely cause is escaped newlines in the environment variable.');
    }
}

const _startupPub = process.env.JWT_PUBLIC_KEY;
if (_startupPub) {
    const formatted = _startupPub.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
    if (!formatted.startsWith('-----BEGIN')) {
        throw new Error('[jwt] JWT_PUBLIC_KEY is malformed: does not start with -----BEGIN. The likely cause is escaped newlines in the environment variable.');
    }
}

// ─── Payload shape ────────────────────────────────────────────────────────────
export interface TokenPayload {
    sub: string;   // user ID
    email: string;
    role: string;
    sessionId: string;
    type: 'access' | 'refresh';
}

// ─── Sign access token ────────────────────────────────────────────────────────
export function signAccessToken(payload: Omit<TokenPayload, 'type'>): string {
    // Access tokens are intentionally short-lived (1d default).
    // This limits the window of exposure if a token is intercepted or if a user
    // is suspended — the impact is capped to 1 day maximum.
    // Refresh token rotation silently renews tokens for active users.
    const expiry = projectConfig.auth.jwt.expiryDefault || '1d';
    const opts: SignOptions = { algorithm: 'RS256', expiresIn: expiry as SignOptions['expiresIn'] };
    return jwt.sign({ ...payload, type: 'access' }, getPrivateKey(), opts);
}

// ─── Sign refresh token ───────────────────────────────────────────────────────
export function signRefreshToken(payload: Omit<TokenPayload, 'type'>): string {
    const expiry = projectConfig.auth.jwt.refreshExpiry || '30d';
    const opts: SignOptions = { algorithm: 'RS256', expiresIn: expiry as SignOptions['expiresIn'] };
    return jwt.sign({ ...payload, type: 'refresh' }, getPrivateKey(), opts);
}


// ─── Verify token ─────────────────────────────────────────────────────────────
export function verifyToken(token: string): TokenPayload & JwtPayload {
    try {
        return jwt.verify(token, getPublicKey(), { algorithms: ['RS256'] }) as TokenPayload & JwtPayload;
    } catch (err) {
        // Never leak internal details — rethrow with clean message
        const msg = err instanceof Error ? err.message : 'Invalid token';
        throw new Error(`[jwt] Token verification failed: ${msg}`);
    }
}

// ─── Generate raw refresh token + hash ───────────────────────────────────────
export function generateRefreshToken(): { raw: string; hash: string } {
    const raw = crypto.randomBytes(40).toString('hex');
    const hash = bcrypt.hashSync(raw, 10);
    return { raw, hash };
}

// ─── Rotate refresh token ─────────────────────────────────────────────────────
/**
 * Verifies oldToken, invalidates its session document,
 * issues a new refresh token, creates a new session.
 * Returns { accessToken, refreshToken } or throws.
 */
export async function rotateRefreshToken(
    rawOldToken: string,
    meta: { ip: string; userAgent: string }
): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
    // Find session — we brute-force compare against all active sessions for the user
    // (We don't store the raw token, only the hash)
    const session = await findSessionByRawToken(rawOldToken);

    if (!session) {
        throw new Error('[jwt] Refresh token not found or already invalidated');
    }

    if (session.expiresAt < new Date()) {
        await session.deleteOne();
        throw new Error('[jwt] Refresh token has expired');
    }

    // Build payload from old session's JWT (decode without verify — we already trust it via DB lookup)
    const decoded = jwt.decode(rawOldToken) as TokenPayload & JwtPayload;
    if (!decoded?.sub) throw new Error('[jwt] Cannot decode token payload');

    const payload: Omit<TokenPayload, 'type'> = {
        sub: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        sessionId: '', // will be replaced below
    };

    // Delete old session
    await session.deleteOne();

    // Create new session
    const { raw: newRaw, hash: newHash } = generateRefreshToken();
    const rememberMe = projectConfig.auth.rememberMe;
    const daysToAdd = rememberMe.enabled ? rememberMe.days : 7;
    const expiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);

    const newSession = await SessionModel.create({
        userId: decoded.sub,
        refreshTokenHash: newHash,
        userAgent: meta.userAgent,
        ip: meta.ip,
        expiresAt,
    });

    payload.sessionId = String(newSession._id);

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken({ ...payload, sessionId: String(newSession._id) });

    return { accessToken, refreshToken, sessionId: String(newSession._id) };
}

// ─── Helper: find session by raw token (hash comparison) ─────────────────────
async function findSessionByRawToken(rawToken: string) {
    // Decode to get sub (userId) so we narrow the search
    const decoded = jwt.decode(rawToken) as TokenPayload & JwtPayload | null;
    if (!decoded?.sub) return null;

    const sessions = await SessionModel.find({ userId: decoded.sub }).lean();
    for (const s of sessions) {
        const match = await bcrypt.compare(rawToken, s.refreshTokenHash);
        if (match) return await SessionModel.findById(s._id);
    }
    return null;
}
