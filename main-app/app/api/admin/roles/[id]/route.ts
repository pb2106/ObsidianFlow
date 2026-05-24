/**
 * app/api/admin/roles/[id]/route.ts
 * PATCH  /api/admin/roles/:id
 * DELETE /api/admin/roles/:id
 */

import { z } from 'zod';
import { connectDB } from '@/lib/db/connect';
import RoleModel from '@/models/role.model';
import { withAdmin } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, fail, validationError, secureHeaders } from '@/lib/api/response';

const patchSchema = z.object({
    color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    isDefault: z.boolean().optional(),
    permissions: z.record(z.boolean()).optional(),
});

async function patchHandler(req: AuthedRequest, ctx: { params: Record<string, string> }) {
    await connectDB();
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const role = await RoleModel.findById(ctx.params.id);
    if (!role || role.isDeleted) return fail('Role not found', 'NOT_FOUND', 404);

    if (parsed.data.isDefault) {
        await RoleModel.updateMany({ isDefault: true }, { isDefault: false });
    }

    Object.assign(role, parsed.data);
    await role.save();

    return secureHeaders(ok(role, 'Role updated'));
}

async function deleteHandler(_req: AuthedRequest, ctx: { params: Record<string, string> }) {
    await connectDB();
    const role = await RoleModel.findById(ctx.params.id);
    if (!role || role.isDeleted) return fail('Role not found', 'NOT_FOUND', 404);
    if (role.isDefault) return fail('Cannot delete the default role. Set another role as default first.', 'DEFAULT_ROLE', 409);

    await role.softDelete();
    return secureHeaders(ok(null, 'Role deleted'));
}

export const PATCH = withAdmin(patchHandler as Parameters<typeof withAdmin>[0]);
export const DELETE = withAdmin(deleteHandler as Parameters<typeof withAdmin>[0]);
