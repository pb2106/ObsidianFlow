/**
 * app/api/admin/users/[id]/login-history/route.ts
 * GET /api/admin/users/:id/login-history
 * Returns paginated login history for a specific user.
 */

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import LoginHistoryModel from '@/models/login_history.model';
import { withPermission } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, fail, secureHeaders } from '@/lib/api/response';
import mongoose from 'mongoose';

async function handler(req: AuthedRequest, { params }: { params: { id: string } }) {
    await connectDB();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return fail('Invalid user ID', 'INVALID_ID', 400);
    }

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') ?? '20'));

    const [entries, total] = await Promise.all([
        LoginHistoryModel.find({ userId: id })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        LoginHistoryModel.countDocuments({ userId: id }),
    ]);

    return secureHeaders(ok({ entries, total, page, limit }));
}

export const GET = withPermission('view_users', handler as Parameters<typeof withPermission>[1]);
