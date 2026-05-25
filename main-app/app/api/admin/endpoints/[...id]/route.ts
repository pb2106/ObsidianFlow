/**
 * app/api/admin/endpoints/[...id]/route.ts
 * PATCH /api/admin/endpoints/:id
 * Note we use [...id] because the endpoint ID contains forward slashes, e.g. api/auth/login::POST
 */

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, fail, validationError, secureHeaders } from '@/lib/api/response';
import { setEndpointState } from '@/lib/endpoints/registry';
import AuditLogModel from '@/models/audit_log.model';
import { z } from 'zod';
import { revalidateTag } from 'next/cache';

const patchSchema = z.object({
    enabled: z.boolean()
});

async function handler(req: AuthedRequest, { params }: { params: { id: string[] } }) {
    // Reconstruct the ID from the catch-all array
    const idParam = await params.id;
    const endpointId = idParam.join('/');

    const body = await (req as NextRequest).json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    try {
        const updatedEntry = await setEndpointState(endpointId, parsed.data.enabled);

        // Write to audit log
        await AuditLogModel.create({
            actorId: req.user.sub,
            actor: req.user.email,
            actionType: 'UPDATE_ENDPOINT_STATE',
            targetCollection: 'system_config',
            targetId: endpointId,
            details: {
                previousState: !parsed.data.enabled,
                newState: parsed.data.enabled,
                endpointId
            },
            ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
            userAgent: req.headers.get('user-agent') || ''
        });

        revalidateTag('endpoints');
        revalidateTag('config');

        const message = parsed.data.enabled ? `Endpoint ${endpointId} enabled` : `Endpoint ${endpointId} disabled`;
        return secureHeaders(ok(updatedEntry, message));
    } catch (err: any) {
        return fail(err.message, 'UPDATE_FAILED', 400);
    }
}

export const PATCH = withPermission('manage_system', handler as any);
