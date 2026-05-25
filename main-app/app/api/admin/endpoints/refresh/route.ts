/**
 * app/api/admin/endpoints/refresh/route.ts
 * GET /api/admin/endpoints/refresh
 */

import { withPermission } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, secureHeaders } from '@/lib/api/response';
import { refreshEndpointRegistry } from '@/lib/endpoints/registry';

async function handler(req: AuthedRequest) {
    const freshRegistry = refreshEndpointRegistry();
    return secureHeaders(ok({ count: freshRegistry.length }, 'Registry cache cleared and re-scanned'));
}

export const GET = withPermission('manage_system', handler as Parameters<typeof withPermission>[1]);
