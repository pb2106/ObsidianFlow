/**
 * app/api/admin/config/route.ts
 * GET   /api/admin/config — read system_config
 * PATCH /api/admin/config — update disabled_endpoints, maintenance_mode
 */

import { z } from 'zod';
import { revalidateTag } from 'next/cache';
import { connectDB } from '@/lib/db/connect';
import SystemConfigModel from '@/models/system_config.model';
import { withPermission } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, validationError, secureHeaders, fail } from '@/lib/api/response';
import { sanitiseBody } from '@/lib/security/sanitise';

const patchSchema = z.object({
    disabled_endpoints: z.array(z.string().trim().max(500)).optional(),
    maintenance_mode: z.boolean().optional(),
    maintenance_message: z.string().trim().max(500).optional(),
    maintenance_back_at: z.string().trim().max(50).datetime().optional(),
    runtime_config: z.record(z.string(), z.unknown()).optional(),
});

async function getHandler(_req: AuthedRequest) {
    await connectDB();
    const cfg = await SystemConfigModel.findOne({ setup_complete: true }).lean();
    return secureHeaders(ok(cfg));
}

async function patchHandler(req: AuthedRequest) {
    await connectDB();

    let body = await req.json().catch(() => null);

    try {
        body = sanitiseBody(body);
    } catch (err: any) {
        return fail(err.message, 'SECURITY_VIOLATION', 400);
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const cfg = await SystemConfigModel.findOneAndUpdate(
        { setup_complete: true },
        { $set: parsed.data },
        { new: true, upsert: false }
    );

    if (parsed.data.disabled_endpoints) revalidateTag('endpoints');
    if (parsed.data.maintenance_mode !== undefined) revalidateTag('system');

    return secureHeaders(ok(cfg, 'Config updated'));
}

export const GET = withPermission('view_config', getHandler as Parameters<typeof withPermission>[1]);
export const PATCH = withPermission('edit_config', patchHandler as Parameters<typeof withPermission>[1]);
