/**
 * app/api/admin/config/disk/route.ts
 * PATCH /api/admin/config/disk
 * Directly overwrites the physical project.config.ts file on disk. This triggers
 * Next.js hot module replacement and physically modifies the app's foundational config.
 */

import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, fail, validationError, secureHeaders } from '@/lib/api/response';
import { projectConfig } from '@/config/project.config';

async function patchHandler(req: AuthedRequest) {
    const body = await (req as NextRequest).json().catch(() => null);
    if (!body || typeof body !== 'object') {
        return fail('Invalid request body, expected JSON object', 'INVALID_JSON', 400);
    }

    // Merge incoming changes into the existing configuration
    // This allows partial updates
    const newConfig = { ...projectConfig, ...body };

    const content = `/**
 * project.config.ts
 *
 * ⚠️  This file is modified dynamically via the Enterprise Admin Panel.
 * ⚠️  This file is excluded from git (.gitignore).
 */

export const projectConfig = ${JSON.stringify(newConfig, null, 4)};

export type ProjectConfig = typeof projectConfig;
`;

    try {
        const configPath = path.join(process.cwd(), 'config', 'project.config.ts');
        fs.writeFileSync(configPath, content, 'utf8');
        return secureHeaders(ok(newConfig, 'Physical configuration overwritten successfully. Server is reloading...'));
    } catch (e) {
        return fail(`Failed to write to disk. Error: ${String(e)}`, 'FS_ERROR', 500);
    }
}

export const GET = withPermission('view_config', async () => secureHeaders(ok(projectConfig)));
export const PATCH = withPermission('edit_config', patchHandler as Parameters<typeof withPermission>[1]);
