/**
 * app/api/admin/audit/route.ts
 * GET /api/admin/audit — paginated audit log with actor/type filtering
 */

import { connectDB } from '@/lib/db/connect';
import AuditLogModel from '@/models/audit_log.model';
import { withAdmin } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, secureHeaders } from '@/lib/api/response';

async function handler(req: AuthedRequest) {
    await connectDB();

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') ?? '50'));
    const actor = url.searchParams.get('actor') ?? '';
    const actionType = url.searchParams.get('actionType') ?? '';

    const filter: Record<string, unknown> = {};
    if (actor) filter.actor = { $regex: actor, $options: 'i' };
    if (actionType) filter.actionType = { $regex: actionType, $options: 'i' };

    const [logs, total] = await Promise.all([
        AuditLogModel.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        AuditLogModel.countDocuments(filter),
    ]);

    return secureHeaders(ok({ logs, total, page, limit }));
}

export const GET = withAdmin(handler as Parameters<typeof withAdmin>[0]);
