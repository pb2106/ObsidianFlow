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

const userSchema = z.object({
    email: z.string().email().toLowerCase().trim(),
    role: z.string(),
    firstName: z.string().optional().default(''),
    lastName: z.string().optional().default(''),
    password: z.string(),
});

const commitSchema = z.object({
    users: z.array(userSchema).min(1).max(500),
});

async function handler(req: AuthedRequest) {
    await connectDB();
    const body = await (req as NextRequest).json().catch(() => null);
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
    const result = await UserModel.insertMany(hashedUsers, { ordered: false });

    return secureHeaders(ok({ insertedCount: result.length }, `Successfully imported ${result.length} users`));
}

export const POST = withPermission('add_users', handler as Parameters<typeof withPermission>[1]);
