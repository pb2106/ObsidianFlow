/**
 * app/api/admin/endpoints/route.ts
 * GET /api/admin/endpoints
 */

import { withPermission } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, secureHeaders } from '@/lib/api/response';
import { getEndpointStates, EndpointEntry } from '@/lib/endpoints/registry';

async function handler(req: AuthedRequest) {
    const registry = await getEndpointStates();

    // Group by area
    // Return array: { area: string, endpoints: EndpointEntry[] }[]
    const grouped: Record<string, EndpointEntry[]> = {};
    for (const entry of registry) {
        if (!grouped[entry.area]) grouped[entry.area] = [];
        grouped[entry.area].push(entry);
    }

    const report = Object.keys(grouped).map(area => ({
        area,
        endpoints: grouped[area]
    }));

    // Sort areas alphabetically
    report.sort((a, b) => a.area.localeCompare(b.area));

    return secureHeaders(ok(report, 'Endpoint registry retrieved successfully'));
}

export const GET = withPermission('manage_system', handler as Parameters<typeof withPermission>[1]);
