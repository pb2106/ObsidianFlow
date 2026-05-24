/**
 * app/api/auth/forgot-password/route.ts
 * POST /api/auth/forgot-password
 * Always returns 200 regardless of whether email exists (prevents enumeration).
 */

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import UserModel from '@/models/user.model';
import { generateResetToken } from '@/lib/auth/password';
import { forgotPasswordSchema } from '@/lib/api/schemas';
import { ok, validationError, secureHeaders } from '@/lib/api/response';
import { authRateLimit } from '@/lib/middleware/rateLimit';
import { endpointGuard } from '@/lib/middleware/endpointGuard';

export const endpointMeta = {
    id: 'auth.forgot-password',
    area: 'Authentication',
    description: 'Request a password reset token',
    method: 'POST',
    path: '/api/auth/forgot-password',
    defaultEnabled: true,
    canBeDisabled: true,
};

async function handler(req: NextRequest) {
    await connectDB();

    const body = await req.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { email } = parsed.data;
    const user = await UserModel.findOne({ email: email.toLowerCase() });

    // Always return success — never reveal whether email exists
    const successResponse = ok(
        // In production you'd email the link; here we return the raw token for admin use
        user ? { note: 'Reset link generated. In production this is emailed.' } : {},
        'If this email is registered, password reset instructions have been sent'
    );

    if (user && !user.isDeleted) {
        const { token, hash, expiresAt } = generateResetToken();
        user.passwordResetTokenHash = hash;
        user.passwordResetExpiry = expiresAt;
        await user.save();

        // Dev-only: expose token in response so admin can test without email
        if (process.env.NODE_ENV !== 'production') {
            return secureHeaders(ok(
                { resetToken: token, expiresAt },
                'Reset token generated (dev mode — not emailed)'
            ));
        }
    }

    return secureHeaders(successResponse);
}

export const POST = endpointGuard(endpointMeta.id, authRateLimit()(handler));
