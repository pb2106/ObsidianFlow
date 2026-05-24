/**
 * app/api/auth/me/route.ts
 * GET /api/auth/me — returns the authenticated user's profile.
 * Never returns passwordHash.
 */

import { connectDB } from '@/lib/db/connect';
import UserModel from '@/models/user.model';
import { withAuth, AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, fail, secureHeaders } from '@/lib/api/response';
import { endpointGuard } from '@/lib/middleware/endpointGuard';

export const endpointMeta = {
    id: 'auth.me',
    area: 'Authentication',
    description: 'Get the authenticated user profile',
    method: 'GET',
    path: '/api/auth/me',
    defaultEnabled: true,
    canBeDisabled: false,
};

async function handler(req: AuthedRequest) {
    await connectDB();

    const user = await UserModel
        .findById(req.user.sub)
        .select('-passwordHash -passwordResetTokenHash -totpSecret -backupCodes')
        .lean();

    if (!user) {
        return fail('User not found', 'USER_NOT_FOUND', 404);
    }

    return secureHeaders(ok(user, 'User profile retrieved'));
}

export const GET = endpointGuard(
    endpointMeta.id,
    withAuth(handler as (req: AuthedRequest, ctx: { params: Record<string, string> }) => Promise<Response>)
);
