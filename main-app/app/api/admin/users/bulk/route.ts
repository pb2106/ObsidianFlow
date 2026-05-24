/**
 * app/api/admin/users/bulk/route.ts
 * POST /api/admin/users/bulk
 * Supports bulk suspend, activate, or role reassignment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { connectDB } from '@/lib/db/connect';
import UserModel from '@/models/user.model';
import RoleModel from '@/models/role.model';
import { withPermission } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, fail, validationError, secureHeaders } from '@/lib/api/response';
import { sanitiseBody } from '@/lib/security/sanitise';
import { z } from 'zod';

const bulkSchema = z.object({
    userIds: z.array(z.string().trim().max(256)).min(1),
    action: z.enum(['suspend', 'activate', 'set_role']),
    role: z.string().trim().max(50).optional()
}).refine(data => {
    if (data.action === 'set_role' && !data.role) return false;
    return true;
}, { message: "Role is required when action is 'set_role'" });

async function handler(req: AuthedRequest) {
    await connectDB();

    let body = await (req as NextRequest).json().catch(() => null);

    try {
        body = sanitiseBody(body);
    } catch (err: any) {
        return fail(err.message, 'SECURITY_VIOLATION', 400);
    }

    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { userIds, action, role } = parsed.data;

    // Prevent modifying self
    if (userIds.includes(req.user.sub)) {
        return fail('You cannot perform bulk operations on yourself.', 'FORBIDDEN', 403);
    }

    // Additional granular check if changing roles
    if (action === 'set_role') {
        let hasEditRoles = false;
        if (req.user.role === 'admin') {
            hasEditRoles = true;
        } else {
            const myRole = await RoleModel.findOne({ name: req.user.role });
            if (myRole?.permissions?.['edit_roles']) hasEditRoles = true;
        }

        if (!hasEditRoles) {
            return fail('You lack the granular "edit_roles" permission.', 'FORBIDDEN', 403);
        }

        // Validate target role exists
        if (role !== 'admin' && role !== 'user') {
            const exists = await RoleModel.exists({ name: role, isDeleted: false, isActive: true });
            if (!exists) return fail(`Role '${role}' does not exist`, 'INVALID_ROLE', 400);
        }
    }

    let updateQuery: Record<string, unknown> = {};
    if (action === 'suspend') updateQuery = { isActive: false };
    if (action === 'activate') updateQuery = { isActive: true };
    if (action === 'set_role') updateQuery = { role: role };

    const result = await UserModel.updateMany(
        { _id: { $in: userIds }, isDeleted: false },
        { $set: updateQuery }
    );

    revalidateTag('users');
    if (action === 'set_role') revalidateTag('roles');

    return secureHeaders(ok({ modifiedCount: result.modifiedCount }, `Bulk ${action} applied successfully`));
}

// Ensure the caller at least has generic user editing rights
export const POST = withPermission('edit_users', handler as Parameters<typeof withPermission>[1]);
