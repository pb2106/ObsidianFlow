/**
 * app/api/admin/activity/stream/route.ts
 * GET /api/admin/activity/stream
 * Returns a Server-Sent Events (SSE) ReadableStream pushing real-time audit logs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import AuditLogModel from '@/models/audit_log.model';
import UserModel from '@/models/user.model';
import { withPermission } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';

export const dynamic = 'force-dynamic';

async function handler(req: AuthedRequest) {
    await connectDB();

    const stream = new ReadableStream({
        async start(controller) {
            let lastLogId: any = null;
            let lastUserCount = await UserModel.estimatedDocumentCount();

            // Setup the tailing cursor position
            const latest = await AuditLogModel.findOne().sort({ createdAt: -1 }).select('_id').lean();
            if (latest) lastLogId = latest._id;

            controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

            const interval = setInterval(async () => {
                try {
                    // 1. Check for new logs
                    const query = lastLogId ? { _id: { $gt: lastLogId } } : {};
                    const newLogs = await AuditLogModel.find(query).sort({ createdAt: 1 }).lean();

                    if (newLogs.length > 0) {
                        lastLogId = newLogs[newLogs.length - 1]._id;
                        for (const log of newLogs) {
                            controller.enqueue(`data: ${JSON.stringify({ type: 'audit', log })}\n\n`);
                        }
                    }

                    // 2. Diff overall user stats for dashboard
                    const currentUserCount = await UserModel.estimatedDocumentCount();
                    if (currentUserCount !== lastUserCount) {
                        lastUserCount = currentUserCount;
                        controller.enqueue(`data: ${JSON.stringify({ type: 'stat_update', totalUsers: currentUserCount })}\n\n`);
                    }

                    // 3. Keep-alive ping (required for Vercel/proxies to not drop connection)
                    controller.enqueue(`:\n\n`);

                } catch (e) {
                    controller.error(e);
                    clearInterval(interval);
                }
            }, 3000);

            // Cleanup when the client drops the connection
            req.signal.addEventListener('abort', () => {
                clearInterval(interval);
                try { controller.close(); } catch { }
            });
        }
    });

    return new NextResponse(stream as any, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}

// Since dashboard is the root landing page, view_users is practically required for the panel anyway
export const GET = withPermission('view_users', handler as Parameters<typeof withPermission>[1]);
