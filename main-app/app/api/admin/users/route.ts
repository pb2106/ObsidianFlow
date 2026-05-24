/**
 * app/api/admin/users/route.ts
 * GET /api/admin/users — paginated, searchable user list
 */

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import UserModel from '@/models/user.model';
import { withPermission } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, secureHeaders } from '@/lib/api/response';

async function handler(req: AuthedRequest) {
    await connectDB();

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') ?? '20'));
    const search = url.searchParams.get('search')?.trim() ?? '';
    const roleFilter = url.searchParams.get('role');
    const statusFilter = url.searchParams.get('status'); // 'active', 'inactive'
    const sortBy = url.searchParams.get('sortBy') ?? 'createdAt';
    const sortDir = url.searchParams.get('sortDir') === 'asc' ? 1 : -1;

    const filter: Record<string, unknown> = { isDeleted: false };
    if (search) {
        const regex = { $regex: search, $options: 'i' };
        filter.$or = [{ email: regex }, { firstName: regex }, { lastName: regex }, { username: regex }];
    }
    if (roleFilter) filter.role = roleFilter;
    if (statusFilter === 'active') filter.isActive = true;
    if (statusFilter === 'inactive') filter.isActive = false;

    const [users, total] = await Promise.all([
        UserModel.find(filter)
            .select('-passwordHash -passwordResetTokenHash -totpSecret -backupCodes -loginHistory -sessions -emailVerificationToken')
            .sort({ [sortBy]: sortDir })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        UserModel.countDocuments(filter),
    ]);

    return secureHeaders(ok({ users, total, page, limit }));
}

export const GET = withPermission('view_users', handler as Parameters<typeof withPermission>[1]);
