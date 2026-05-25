/**
 * lib/auth/providers/email.ts
 * Email/password authentication provider.
 * Handles lookup, lockout, failed attempt tracking, and session creation.
 */

import { connectDB } from '@/lib/db/connect';
import UserModel from '@/models/user.model';
import SessionModel from '@/models/session.model';
import LoginHistoryModel from '@/models/login_history.model';
import { verifyPassword, hashPassword } from '@/lib/auth/password';

const DUMMY_HASH_PROMISE = hashPassword('dummy-password-for-timing');
import { signAccessToken, signRefreshToken, generateRefreshToken } from '@/lib/auth/jwt';
import { projectConfig } from '@/config/project.config';

// ─── Typed errors ─────────────────────────────────────────────────────────────
export class AuthError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number = 401
    ) {
        super(message);
        this.name = 'AuthError';
    }
}

export interface LoginResult {
    accessToken?: string;
    refreshToken?: string;
    sessionId?: string;
    user: {
        id: string;
        email: string;
        role: string;
        firstName?: string;
        lastName?: string;
        username?: string;
    };
}

// ─── loginWithEmail ───────────────────────────────────────────────────────────
export async function loginWithEmail(params: {
    identifier: string;   // email or username, depending on config
    password: string;
    ip: string;
    userAgent: string;
}): Promise<LoginResult> {
    await connectDB();

    const { identifier, password, ip, userAgent } = params;
    const loginBy = projectConfig.auth.loginIdentifier;

    // ── Find user ──
    const query =
        loginBy === 'email' ? { email: identifier.toLowerCase().trim() } :
            loginBy === 'username' ? { username: identifier.trim() } :
                // 'either': try both
                { $or: [{ email: identifier.toLowerCase().trim() }, { username: identifier.trim() }] };

    const user = await UserModel.findOne(query).select('+passwordHash');

    if (!user) {
        await verifyPassword(password, await DUMMY_HASH_PROMISE);
        throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // ── Check soft-delete / active ──
    if (user.isDeleted) {
        throw new AuthError('Account not found', 'ACCOUNT_DELETED', 404);
    }
    if (!user.isActive) {
        throw new AuthError('Account is disabled. Contact support.', 'ACCOUNT_INACTIVE', 403);
    }

    // ── Check lockout ──
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
        const secondsLeft = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 1000);
        throw new AuthError(
            `Account locked. Try again in ${secondsLeft} seconds.`,
            'ACCOUNT_LOCKED',
            429
        );
    }

    // ── Verify password ──
    const valid = await verifyPassword(password, user.passwordHash);

    if (!valid) {
        // Increment failed attempts atomically to prevent race conditions
        const updated = await UserModel.findOneAndUpdate(
            { _id: user._id },
            {
                $inc: { failedLoginAttempts: 1 },
                $set: { lastFailedLogin: new Date() }
            },
            { new: true }
        );

        if (updated && updated.failedLoginAttempts >= projectConfig.security.lockout.attempts) {
            await UserModel.updateOne(
                { _id: user._id },
                {
                    $set: {
                        lockoutUntil: new Date(Date.now() + projectConfig.security.lockout.durationMs),
                        failedLoginAttempts: 0
                    }
                }
            );
            throw new AuthError(
                `Too many failed attempts. Account locked for ${projectConfig.security.lockout.durationMs / 60000} minutes.`,
                'ACCOUNT_LOCKED',
                429
            );
        }

        // Record failed login attempt
        void LoginHistoryModel.create({
            userId: user._id,
            ip,
            userAgent,
            success: false,
            failureReason: 'INVALID_CREDENTIALS',
        }).catch(() => { /* non-critical */ });
        throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS');
    }




    // ── Create session ──
    const { raw: rawRefresh, hash: refreshHash } = generateRefreshToken();
    const rememberMe = projectConfig.auth.rememberMe;
    const daysToAdd = rememberMe.enabled ? rememberMe.days : 1;
    const expiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);

    const session = await SessionModel.create({
        userId: user._id,
        refreshTokenHash: refreshHash,
        userAgent,
        ip,
        expiresAt,
    });

    // ── Update login stats ──
    user.lastLogin = new Date();
    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;
    user.sessions.push(session._id as unknown as typeof user.sessions[number]);
    await user.save();

    // Record successful login to dedicated collection
    void LoginHistoryModel.create({
        userId: user._id,
        ip,
        userAgent,
        success: true,
    }).catch(() => { /* non-critical */ });

    // ── Sign tokens ──
    const tokenPayload = {
        sub: String(user._id),
        email: user.email,
        role: user.role,
        sessionId: String(session._id),
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    return {
        accessToken,
        refreshToken,
        sessionId: String(session._id),
        user: {
            id: String(user._id),
            email: user.email,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
        },
    };
}
