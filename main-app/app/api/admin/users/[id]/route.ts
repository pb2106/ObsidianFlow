/**
 * app/api/admin/users/[id]/route.ts
 * PATCH /api/admin/users/:id — update role, isActive
 * DELETE /api/admin/users/:id — soft-delete
 */

import { z } from 'zod';
import { connectDB } from '@/lib/db/connect';
import UserModel from '@/models/user.model';
import SessionModel from '@/models/session.model';
import { withAdmin } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { writeAuditLog } from '@/models/audit_log.model';
import { ok, fail, validationError, secureHeaders } from '@/lib/api/response';

const patchSchema = z.object({
    isActive: z.boolean().optional(),
    role: z.string().min(1).optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'No fields to update' });

async function patchHandler(req: AuthedRequest, ctx: { params: Record<string, string> }) {
    await connectDB();
    const { id } = ctx.params;

    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const user = await UserModel.findById(id);
    if (!user || user.isDeleted) return fail('User not found', 'NOT_FOUND', 404);

    // Prevent admin from deactivating themselves
    if (id === req.user.sub && parsed.data.isActive === false) {
        return fail('Cannot deactivate your own account', 'SELF_DEACTIVATE', 403);
    }

    const before: Record<string, unknown> = {};
    if (parsed.data.isActive !== undefined) { before.isActive = user.isActive; user.isActive = parsed.data.isActive; }
    if (parsed.data.role) { before.role = user.role; user.role = parsed.data.role; }

    await user.save();

    // If deactivating — kill all sessions
    if (parsed.data.isActive === false) {
        await SessionModel.deleteMany({ userId: id });
    }

    await writeAuditLog({
        actor: req.user.email,
        actorId: req.user.sub,
        actionType: 'ADMIN_USER_UPDATED',
        target: 'User',
        targetId: id,
        detail: { before, after: parsed.data },
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '',
    });

    return secureHeaders(ok({ id, ...parsed.data }, 'User updated'));
}

async function deleteHandler(req: AuthedRequest, ctx: { params: Record<string, string> }) {
    await connectDB();
    const { id } = ctx.params;

    if (id === req.user.sub) return fail('Cannot delete your own account', 'SELF_DELETE', 403);

    const user = await UserModel.findById(id);
    if (!user || user.isDeleted) return fail('User not found', 'NOT_FOUND', 404);

    await user.softDelete();
    await SessionModel.deleteMany({ userId: id });

    await writeAuditLog({
        actor: req.user.email,
        actorId: req.user.sub,
        actionType: 'ADMIN_USER_DELETED',
        target: 'User',
        targetId: id,
        detail: { email: user.email },
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '',
    });

    return secureHeaders(ok(null, 'User deleted'));
}

export const PATCH = withAdmin(patchHandler as Parameters<typeof withAdmin>[0]);
export const DELETE = withAdmin(deleteHandler as Parameters<typeof withAdmin>[0]);
