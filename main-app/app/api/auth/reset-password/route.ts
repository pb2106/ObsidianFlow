/**
 * app/api/auth/reset-password/route.ts
 * POST /api/auth/reset-password
 */

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import UserModel from '@/models/user.model';
import SessionModel from '@/models/session.model';
import { hashPassword, hashResetToken } from '@/lib/auth/password';
import { resetPasswordSchema } from '@/lib/api/schemas';
import { ok, fail, validationError, secureHeaders } from '@/lib/api/response';
import { authRateLimit } from '@/lib/middleware/rateLimit';
import { endpointGuard } from '@/lib/middleware/endpointGuard';

export const endpointMeta = {
    id: 'auth.reset-password',
    area: 'Authentication',
    description: 'Reset password using a valid reset token',
    method: 'POST',
    path: '/api/auth/reset-password',
    defaultEnabled: true,
    canBeDisabled: true,
};

async function handler(req: NextRequest) {
    await connectDB();

    const body = await req.json().catch(() => null);
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { token, password } = parsed.data;
    const tokenHash = hashResetToken(token);

    const user = await UserModel.findOne({
        passwordResetTokenHash: tokenHash,
        passwordResetExpiry: { $gt: new Date() },
        isDeleted: false,
    });

    if (!user) {
        return fail('Reset token is invalid or has expired', 'INVALID_RESET_TOKEN', 400);
    }

    // Hash new password
    user.passwordHash = await hashPassword(password);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiry = undefined;
    await user.save();

    // Invalidate all sessions (force re-login with new password)
    await SessionModel.deleteMany({ userId: user._id });

    return secureHeaders(ok(null, 'Password reset successful. Please log in with your new password.'));
}

export const POST = endpointGuard(endpointMeta.id, authRateLimit()(handler));
