import fs from 'fs';
import path from 'path';
import SystemConfigModel from '@/models/system_config.model';

export interface EndpointEntry {
    id: string;
    method: string;
    path: string;
    area: string;
    description: string;
    defaultEnabled: boolean;
    canBeDisabled: boolean;
    enabled?: boolean;
}

let cachedRegistry: EndpointEntry[] | null = null;

export function buildEndpointRegistry(): EndpointEntry[] {
    if (cachedRegistry) return cachedRegistry;

    const apiDir = path.join(process.cwd(), 'app', 'api');
    const entries: EndpointEntry[] = [];

    function scanDir(dir: string) {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                scanDir(fullPath);
            } else if (file === 'route.ts' || file === 'route.js') {
                parseRouteFile(fullPath, entries);
            }
        }
    }

    scanDir(apiDir);

    entries.sort((a, b) => {
        if (a.area !== b.area) return a.area.localeCompare(b.area);
        return a.path.localeCompare(b.path);
    });

    cachedRegistry = entries;
    return entries;
}

export function refreshEndpointRegistry(): EndpointEntry[] {
    cachedRegistry = null;
    return buildEndpointRegistry();
}

function parseRouteFile(filePath: string, entries: EndpointEntry[]) {
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract methods (support both function and const exports)
    const methodsFound = new Set<string>();
    const funcRegex = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g;
    const constRegex = /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=/g;

    let match;
    while ((match = funcRegex.exec(content)) !== null) methodsFound.add(match[1]);
    while ((match = constRegex.exec(content)) !== null) methodsFound.add(match[1]);

    if (methodsFound.size === 0) return;

    // Extract endpoint metadata
    let description = '';
    let defaultEnabled = true;
    let canBeDisabled = true;

    // Fast regex extraction for the endpointMeta object
    const metaMatch = content.match(/export\s+const\s+endpointMeta\s*=\s*\{([\s\S]*?)\};/);
    if (metaMatch) {
        const metaStr = metaMatch[1];

        // Match string values for description
        const descMatch = metaStr.match(/description:\s*(['"`])([\s\S]*?)\1/);
        if (descMatch) description = descMatch[2];

        const defEnabledMatch = metaStr.match(/defaultEnabled:\s*(true|false)/);
        if (defEnabledMatch) defaultEnabled = defEnabledMatch[1] === 'true';

        const canDisableMatch = metaStr.match(/canBeDisabled:\s*(true|false)/);
        if (canDisableMatch) canBeDisabled = canDisableMatch[1] === 'true';
    }

    // Derive path components
    const apiPart = filePath.split(path.sep + 'app' + path.sep + 'api')[1];
    if (!apiPart) return;

    // Strip route.ts and replace Windows backslashes
    let urlPath = apiPart.replace(/[\\/]route\.(ts|js)$/, '').replace(/\\/g, '/');
    if (!urlPath.startsWith('/')) urlPath = '/' + urlPath;

    // Replace [param] with :param
    urlPath = urlPath.replace(/\[([^\]]+)\]/g, ':$1');
    urlPath = '/api' + urlPath; // Ensure prefix

    // Extract Area (e.g. /api/auth/... -> Auth)
    const segments = urlPath.split('/').filter(Boolean);
    const areaRaw = segments[1] || 'General';
    const area = areaRaw.charAt(0).toUpperCase() + areaRaw.slice(1);

    for (const method of methodsFound) {
        entries.push({
            id: `${urlPath.substring(1)}::${method}`, // removes leading slash for ID
            method,
            path: urlPath,
            area,
            description,
            defaultEnabled,
            canBeDisabled
        });
    }
}

export async function getEndpointStates(): Promise<EndpointEntry[]> {
    const registry = buildEndpointRegistry();
    const config = await SystemConfigModel.findOne({ setup_complete: true }).lean();

    const disabledSet = new Set<string>(config?.disabled_endpoints || []);

    return registry.map(entry => ({
        ...entry,
        enabled: !disabledSet.has(entry.id)
    }));
}

export async function setEndpointState(id: string, enabled: boolean): Promise<EndpointEntry> {
    const registry = buildEndpointRegistry();
    const entry = registry.find(e => e.id === id);

    if (!entry) {
        throw new Error(`Endpoint ID '${id}' not found in registry`);
    }

    if (!enabled && !entry.canBeDisabled) {
        throw new Error(`Endpoint '${id}' is a core system endpoint and cannot be disabled`);
    }

    const config = await SystemConfigModel.findOne({ setup_complete: true });
    if (!config) throw new Error('System config not found');

    const disabledSet = new Set<string>(config.disabled_endpoints);

    if (enabled) {
        disabledSet.delete(id);
    } else {
        disabledSet.add(id);
    }

    const newDisabled: string[] = [];
    disabledSet.forEach(val => newDisabled.push(val));
    config.disabled_endpoints = newDisabled;
    await config.save();

    return {
        ...entry,
        enabled
    };
}
