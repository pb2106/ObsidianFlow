/**
 * app/api/auth/setup-totp/route.ts
 * POST /api/auth/setup-totp
 * Authorized admins ONLY. Generates a new TOTP secret, QR code, and 8 backup codes.
 */

import { NextRequest } from 'next/server';
import { ok, fail, validationError, secureHeaders } from '@/lib/api/response';
import { adminRateLimit } from '@/lib/middleware/rateLimit';
import { endpointGuard } from '@/lib/middleware/endpointGuard';
import UserModel from '@/models/user.model';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { verifyToken } from '@/lib/auth/jwt';
import { z } from 'zod';

export const endpointMeta = {
    id: 'auth.totp.setup',
    area: 'Authentication',
    description: 'Generates TOTP secret and backup codes for admin users',
    method: 'POST',
    path: '/api/auth/setup-totp',
    defaultEnabled: true,
    canBeDisabled: false,
};

const setupSchema = z.object({
    tempToken: z.string().min(1, 'Missing temp token'),
});

async function handler(req: NextRequest) {
    const body = await req.json().catch(() => null);
    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    let decoded;
    try {
        decoded = verifyToken(parsed.data.tempToken);
        if (decoded.type !== 'temp') throw new Error('Invalid token type');
    } catch {
        return fail('Invalid or expired temporary session. Please log in again.', 'UNAUTHORIZED', 401);
    }

    const userId = decoded.sub;
    const user = await UserModel.findById(userId);

    if (!user) return fail('User not found', 'NOT_FOUND', 404);
    if (user.role !== 'admin') return fail('Only admins can setup mandatory TOTP 2FA.', 'FORBIDDEN', 403);
    if (user.totpEnabled) return fail('TOTP is already enabled for this account.', 'TOTP_ALREADY_ENABLED', 400);

    // 1. Generate Secret
    const secret = authenticator.generateSecret();

    // 2. Generate URI
    const serviceName = 'ObsidianFlow Admin';
    const otpauth = authenticator.keyuri(user.email, serviceName, secret);

    // 3. Generate QR DataURL
    let qrCodeUrl = '';
    try {
        qrCodeUrl = await QRCode.toDataURL(otpauth);
    } catch {
        qrCodeUrl = ''; // Fallback if qr fails
    }

    // 4. Generate 8 secure backup codes
    const backupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString('hex'));

    // Temporary save the secret, but DO NOT set totpEnabled = true yet
    user.totpSecret = secret;
    const hashedBackups = await Promise.all(backupCodes.map(c => bcrypt.hash(c, 10)));
    user.backupCodes = hashedBackups;

    await user.save();

    const res = ok({
        qrCodeUrl,
        secret,
        backupCodes // Return plaintext once to the UI
    }, 'TOTP setup generated ok');

    return secureHeaders(res);
}

export const POST = endpointGuard(
    endpointMeta.id,
    adminRateLimit(handler as any)
);
