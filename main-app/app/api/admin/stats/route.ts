/**
 * app/api/admin/stats/route.ts
 * GET /api/admin/stats
 */

import { connectDB } from '@/lib/db/connect';
import UserModel from '@/models/user.model';
import SessionModel from '@/models/session.model';
import { withAdmin } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, secureHeaders } from '@/lib/api/response';

async function handler(_req: AuthedRequest) {
    await connectDB();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [totalUsers, activeUsers, totalSessions, newToday] = await Promise.all([
        UserModel.countDocuments({ isDeleted: false }),
        UserModel.countDocuments({ isDeleted: false, isActive: true }),
        SessionModel.countDocuments({ isDeleted: false, expiresAt: { $gt: new Date() } }),
        UserModel.countDocuments({ isDeleted: false, createdAt: { $gte: startOfDay } }),
    ]);

    return secureHeaders(ok({ totalUsers, activeUsers, totalSessions, newToday }));
}

export const GET = withAdmin(handler as Parameters<typeof withAdmin>[0]);
