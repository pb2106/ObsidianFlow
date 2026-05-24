/**
 * app/api/admin/users/route.ts
 * GET /api/admin/users — paginated, searchable user list
 */

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import UserModel from '@/models/user.model';
import { withAdmin } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, secureHeaders } from '@/lib/api/response';

async function handler(req: AuthedRequest) {
    await connectDB();

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') ?? '20'));
    const search = url.searchParams.get('search')?.trim() ?? '';

    const filter: Record<string, unknown> = { isDeleted: false };
    if (search) {
        const regex = { $regex: search, $options: 'i' };
        filter.$or = [{ email: regex }, { firstName: regex }, { lastName: regex }, { username: regex }];
    }

    const [users, total] = await Promise.all([
        UserModel.find(filter)
            .select('-passwordHash -passwordResetTokenHash -totpSecret -backupCodes -loginHistory -sessions -emailVerificationToken')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        UserModel.countDocuments(filter),
    ]);

    return secureHeaders(ok({ users, total, page, limit }));
}

export const GET = withAdmin(handler as Parameters<typeof withAdmin>[0]);
