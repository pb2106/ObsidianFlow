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

import LoginHistoryModel from '@/models/login_history.model';
import SystemConfigModel from '@/models/system_config.model';

async function handler(_req: AuthedRequest) {
    await connectDB();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [totalUsers, activeUsers, totalSessions, newToday, failedLoginsToday, systemConfig] = await Promise.all([
        UserModel.countDocuments(),
        UserModel.countDocuments({ isActive: true }),
        SessionModel.countDocuments({ expiresAt: { $gt: new Date() } }),
        UserModel.countDocuments({ createdAt: { $gte: startOfDay } }),
        LoginHistoryModel.countDocuments({ success: false, createdAt: { $gte: startOfDay } }),
        SystemConfigModel.findOne({ setup_complete: true }).lean()
    ]);

    const disabledEndpointsCount = systemConfig?.disabled_endpoints?.length || 0;

    return secureHeaders(ok({ totalUsers, activeUsers, totalSessions, newToday, failedLoginsToday, disabledEndpointsCount }));
}

export const GET = withAdmin(handler as Parameters<typeof withAdmin>[0]);
