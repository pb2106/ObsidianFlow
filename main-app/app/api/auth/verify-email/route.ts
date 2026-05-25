/**
 * app/api/auth/verify-email/route.ts
 * POST /api/auth/verify-email
 * Only active when projectConfig.auth.requireEmailVerification === true.
 */

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import UserModel from '@/models/user.model';
import { verifyEmailSchema } from '@/lib/api/schemas';
import { ok, fail, validationError, secureHeaders } from '@/lib/api/response';
import { endpointGuard } from '@/lib/middleware/endpointGuard';
import { projectConfig } from '@/config/project.config';

export const endpointMeta = {
    id: 'auth.verify-email',
    area: 'Authentication',
    description: 'Verify email address using a verification token',
    method: 'POST',
    path: '/api/auth/verify-email',
    defaultEnabled: projectConfig.auth.requireEmailVerification,
    canBeDisabled: true,
};

async function handler(req: NextRequest) {
    if (!projectConfig.auth.requireEmailVerification) {
        return fail('Email verification is not enabled', 'NOT_ENABLED', 400);
    }

    await connectDB();

    const body = await req.json().catch(() => null);
    const parsed = verifyEmailSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { token } = parsed.data;

    const user = await UserModel.findOne({ emailVerificationToken: token });

    if (!user) {
        return fail('Verification token is invalid', 'INVALID_TOKEN', 400);
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();

    return secureHeaders(ok(null, 'Email verified successfully. You can now log in.'));
}

export const POST = endpointGuard(endpointMeta.id, handler);
