/**
 * app/api/admin/import/commit/route.ts
 * POST /api/admin/import/commit
 * Executes the mass user creation. Bypasses normal hashing overhead by bulk inserting.
 */

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import UserModel from '@/models/user.model';
import { withPermission } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, fail, validationError, secureHeaders } from '@/lib/api/response';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { sanitiseBody, validatePassword, validateEmail } from '@/lib/security/sanitise';
import { revalidateTag } from 'next/cache';

const userSchema = z.object({
    email: z.string().trim().max(254).email().refine(validateEmail, 'RFC5322 validation failed'),
    role: z.string().trim().max(50),
    firstName: z.string().trim().max(500).optional().default(''),
    lastName: z.string().trim().max(500).optional().default(''),
    password: z.string().trim().max(128).superRefine((val, ctx) => {
        const error = validatePassword(val);
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }),
});

const commitSchema = z.object({
    users: z.array(userSchema).min(1).max(500),
});

async function handler(req: AuthedRequest) {
    await connectDB();
    const body = await (req as NextRequest).json().catch(() => null);

    if (!body || !Array.isArray(body?.users)) return fail('Invalid payload', 'BAD_REQUEST', 400);

    const cleanUsers = [];
    const errorReport = [];

    for (let i = 0; i < body.users.length; i++) {
        try {
            cleanUsers.push(sanitiseBody(body.users[i]));
        } catch (err: any) {
            errorReport.push({ row: i + 1, error: err.message });
        }
    }

    body.users = cleanUsers;
    const parsed = commitSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const usersToInsert = [];
    const emails = parsed.data.users.map(u => u.email);

    // Final security check for overlaps just in case DB changed between dry-run and commit
    const existing = await UserModel.find({ email: { $in: emails } }).select('email').lean();
    if (existing.length > 0) {
        return fail('Transaction aborted: One or more emails now exist in the database.', 'CONCURRENT_CONFLICT', 409);
    }

    // Parallel hash generation for performance
    const hashedUsers = await Promise.all(parsed.data.users.map(async u => {
        const passwordHash = await bcrypt.hash(u.password, 10);
        return {
            email: u.email,
            passwordHash,
            role: u.role,
            firstName: u.firstName,
            lastName: u.lastName,
            isActive: true,
            isVerified: false,
            failedLoginAttempts: 0,
        };
    }));

    // Bulk execute
    let result = [];
    if (hashedUsers.length > 0) {
        result = await UserModel.insertMany(hashedUsers, { ordered: false });
    }

    revalidateTag('users');

    return secureHeaders(ok({ insertedCount: result.length, errors: errorReport }, `Successfully imported ${result.length} users. ${errorReport.length} failed security checks.`));
}

export const POST = withPermission('add_users', handler as Parameters<typeof withPermission>[1]);
