/**
 * app/api/admin/roles/route.ts
 * GET  /api/admin/roles — list all roles
 * POST /api/admin/roles — create a new role
 */

import { z } from 'zod';
import { connectDB } from '@/lib/db/connect';
import RoleModel from '@/models/role.model';
import { withPermission } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, fail, validationError, secureHeaders } from '@/lib/api/response';

const createSchema = z.object({
    name: z.string().min(1).max(32).regex(/^[a-z0-9_]+$/, 'Lowercase alphanumeric and underscores only'),
    color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Must be a hex color').optional(),
    isDefault: z.boolean().optional(),
    permissions: z.record(z.string(), z.boolean()).optional(),
});

async function getHandler(_req: AuthedRequest) {
    await connectDB();
    const roles = await RoleModel.find().sort({ name: 1 }).lean();
    return secureHeaders(ok(roles));
}

async function postHandler(req: AuthedRequest) {
    await connectDB();

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await RoleModel.findOne({ name: parsed.data.name });
    if (existing) return fail('A role with this name already exists', 'ROLE_EXISTS', 409);

    // If new role is set as default, unset others
    if (parsed.data.isDefault) {
        await RoleModel.updateMany({ isDefault: true }, { isDefault: false });
    }

    // @ts-ignore
    const role = await RoleModel.create(parsed.data);
    return secureHeaders(ok(role, 'Role created', 201));
}

export const GET = withPermission('view_roles', getHandler as Parameters<typeof withPermission>[1]);
export const POST = withPermission('edit_roles', postHandler as Parameters<typeof withPermission>[1]);
