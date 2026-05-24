/**
 * admin-app/lib/revalidate.js
 * Utility to forcefully purge Next.js server caches after mutating database state.
 */
const http = require('http');
const https = require('https');

async function revalidateTokens(tags = [], paths = []) {
    const mainAppUrl = process.env.MAIN_APP_URL;
    const secret = process.env.REVALIDATE_SECRET;

    if (!mainAppUrl || !secret) {
        console.warn('[admin-app] Skipping revalidation: MAIN_APP_URL or REVALIDATE_SECRET missing.');
        return;
    }

    try {
        const payload = JSON.stringify({ tags, paths });
        const isHttps = mainAppUrl.startsWith('https');
        const parsedUrl = new URL(mainAppUrl + '/api/admin/revalidate');

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'x-revalidate-secret': secret
            }
        };

        const reqObj = isHttps ? https.request : http.request;
        const req = reqObj(options, (res) => {
            if (res.statusCode !== 200) {
                console.warn(`[admin-app] Revalidation failed with status ${res.statusCode}`);
            } else {
                console.log(`[admin-app] Next.js cache revalidated successfully for tags: ${tags}`);
            }
        });

        req.on('error', (e) => {
            console.error('[admin-app] Revalidation error:', e.message);
        });

        req.write(payload);
        req.end();

    } catch (err) {
        console.error('[admin-app] Revalidation request exception:', err);
    }
}

module.exports = { revalidateTokens };
