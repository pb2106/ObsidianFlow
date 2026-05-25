/**
 * lib/middleware/endpointGuard.ts
 * Checks incoming request path+method against the disabled_endpoints set.
 * Cache refreshed every 30 seconds from system_config.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import SystemConfigModel from '@/models/system_config.model';

let cachedDisabled: Set<string> = new Set();
let lastRefresh = 0;
const REFRESH_INTERVAL = 30_000; // 30 seconds

async function getDisabledEndpoints(): Promise<Set<string>> {
    const now = Date.now();
    if (now - lastRefresh > REFRESH_INTERVAL) {
        try {
            await connectDB();
            const cfg = await SystemConfigModel.findOne({ setup_complete: true }).lean();
            cachedDisabled = new Set<string>((cfg?.disabled_endpoints as string[] | undefined) ?? []);
            lastRefresh = now;
        } catch {
            // On error, keep the stale cache — don't accidentally block everything
        }
    }
    return cachedDisabled;
}

type Handler = (req: NextRequest, ctx: { params: Record<string, string> }) => Promise<NextResponse>;

export function endpointGuard(legacyEndpointId: string, handler: Handler): Handler {
    return async function (req: NextRequest, ctx: { params: Record<string, string> }) {
        const disabled = await getDisabledEndpoints();
        const { buildEndpointRegistry } = await import('@/lib/endpoints/registry');

        const path = req.nextUrl.pathname;
        const method = req.method;

        // Lazily build registry — hits cache in production
        const registry = buildEndpointRegistry();

        let matchedId: string | null = null;
        for (const entry of registry) {
            if (entry.method === method) {
                let pattern = entry.path.replace(/\//g, '\\/');
                pattern = pattern.replace(/:(\.\.\.\w+)/g, '.*'); // catch-all
                pattern = pattern.replace(/:\w+/g, '[^\\/]+');    // singular params

                const regex = new RegExp(`^${pattern}$`);
                if (regex.test(path)) {
                    matchedId = entry.id;
                    break;
                }
            }
        }

        if (matchedId && disabled.has(matchedId)) {
            return NextResponse.json(
                {
                    success: false,
                    data: null,
                    message: 'This feature is currently unavailable',
                    error: 'ENDPOINT_DISABLED',
                },
                { status: 503 }
            );
        }

        return handler(req, ctx);
    };
}
