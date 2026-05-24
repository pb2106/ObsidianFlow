/**
 * lib/auth/password.ts
 * Password hashing (bcrypt), verification, and reset token generation.
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const BCRYPT_ROUNDS = 12;

// ─── Hash a plain password ────────────────────────────────────────────────────
export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

// ─── Constant-time password verification ─────────────────────────────────────
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
}

// ─── Generate a cryptographically random reset token ──────────────────────────
/**
 * Returns:
 *  - token:     raw 64-char hex — sent to the user (in a link or response)
 *  - hash:      SHA-256 hash of the token — stored in the DB (never the raw)
 *  - expiresAt: 30 minutes from now
 */
export function generateResetToken(): { token: string; hash: string; expiresAt: Date } {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    return { token, hash, expiresAt };
}

// ─── Hash a reset token for DB lookup ────────────────────────────────────────
export function hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// ─── Validate password against project rules ──────────────────────────────────
export function validatePasswordRules(
    password: string,
    rules: { minLength: number; requireNumber: boolean; requireSpecialChar: boolean }
): string | null {
    if (password.length < rules.minLength) {
        return `Password must be at least ${rules.minLength} characters`;
    }
    if (rules.requireNumber && !/\d/.test(password)) {
        return 'Password must contain at least one number';
    }
    if (rules.requireSpecialChar && !/[^a-zA-Z0-9]/.test(password)) {
        return 'Password must contain at least one special character';
    }
    return null; // valid
}
