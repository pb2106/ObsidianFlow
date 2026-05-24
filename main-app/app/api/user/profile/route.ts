/**
 * app/api/user/profile/route.ts
 * PATCH /api/user/profile — authenticated users update their own profile.
 * Only editable standard fields are accepted; email/role/passwordHash are blocked.
 */

import { z } from 'zod';
import { connectDB } from '@/lib/db/connect';
import UserModel from '@/models/user.model';
import { withAuth, AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, fail, validationError, secureHeaders } from '@/lib/api/response';
import { projectConfig } from '@/config/project.config';

// Build allowed fields from projectConfig (only enabled standard fields, minus firstName/lastName always allowed)
function buildProfileSchema() {
    const std = projectConfig.registration.standardFields as Record<string, { enabled: boolean }>;
    const fields: Record<string, z.ZodTypeAny> = {};

    if (std.firstName?.enabled) fields.firstName = z.string().min(1).max(64).optional();
    if (std.lastName?.enabled) fields.lastName = z.string().max(64).optional();
    if (std.username?.enabled) fields.username = z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional();
    if (std.phone?.enabled) fields.phone = z.string().min(7).max(20).optional();
    if (std.company?.enabled) fields.company = z.string().max(100).optional();
    if (std.avatar?.enabled) fields.avatar = z.string().url().optional();

    return z.object(fields);
}

const profileSchema = buildProfileSchema();

async function handler(req: AuthedRequest) {
    await connectDB();

    const body = await req.json().catch(() => null);
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    // Username uniqueness check
    if ((parsed.data as Record<string, unknown>).username) {
        const existing = await UserModel.findOne({
            username: (parsed.data as Record<string, unknown>).username,
            _id: { $ne: req.user.sub },
        });
        if (existing) return fail('Username is already taken', 'USERNAME_EXISTS', 409);
    }

    const user = await UserModel.findByIdAndUpdate(
        req.user.sub,
        { $set: parsed.data },
        { new: true }
    ).select('-passwordHash -passwordResetTokenHash -totpSecret -backupCodes -loginHistory -sessions -emailVerificationToken');

    if (!user) return fail('User not found', 'NOT_FOUND', 404);

    return secureHeaders(ok(user, 'Profile updated'));
}

export const PATCH = withAuth(handler as Parameters<typeof withAuth>[0]);
