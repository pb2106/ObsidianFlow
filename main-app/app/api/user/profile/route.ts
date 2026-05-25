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
import { sanitiseBody } from '@/lib/security/sanitise';

// Build allowed fields from projectConfig (only enabled standard fields, minus firstName/lastName always allowed)
function buildProfileSchema() {
    const std = projectConfig.registration.standardFields as Record<string, { enabled: boolean }>;
    const fields: Record<string, z.ZodTypeAny> = {};

    if (std.firstName?.enabled) fields.firstName = z.string().trim().min(1).max(500).optional();
    if (std.lastName?.enabled) fields.lastName = z.string().trim().max(500).optional();
    if (std.username?.enabled) fields.username = z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_\-]+$/).optional();
    if (std.phone?.enabled) fields.phone = z.string().trim().min(7).max(50).optional();
    if (std.company?.enabled) fields.company = z.string().trim().max(500).optional();
    if (std.avatar?.enabled) fields.avatar = z.string().trim().max(500).url().optional();

    return z.object(fields);
}

const profileSchema = buildProfileSchema();

async function handler(req: AuthedRequest) {
    await connectDB();

    let body = await req.json().catch(() => null);

    try {
        body = sanitiseBody(body);
        if (body && typeof body === 'object') {
            delete (body as Record<string, any>).role;
            delete (body as Record<string, any>).isAdmin;
            delete (body as Record<string, any>).status;
            delete (body as Record<string, any>).isActive;
            delete (body as Record<string, any>).isDeleted;
        }
    } catch (err: any) {
        return fail(err.message, 'SECURITY_VIOLATION', 400);
    }

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
    ).select('-passwordHash -passwordResetTokenHash -totpSecret -backupCodes -sessions -emailVerificationToken');

    if (!user) return fail('User not found', 'NOT_FOUND', 404);

    return secureHeaders(ok(user, 'Profile updated'));
}

export const PATCH = withAuth(handler as Parameters<typeof withAuth>[0]);
