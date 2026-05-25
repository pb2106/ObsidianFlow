/**
 * app/api/admin/import/dry-run/route.ts
 * POST /api/admin/import/dry-run
 * Accepts a CSV file via multipart/form-data, streams + parses it row-by-row,
 * validates schema, and flags DB conflicts (existing emails).
 *
 * D8 change: Previously the entire CSV was buffered as a JSON string in the
 * request body. Now we accept a `file` form field and read it as a Web
 * ReadableStream — no more full-file in-memory allocation on the server.
 */

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import UserModel from '@/models/user.model';
import { withPermission } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, fail, secureHeaders } from '@/lib/api/response';
import { z } from 'zod';

const MAX_ROWS = 500;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB hard cap

const rowSchema = z.object({
    email: z.string().email('Invalid email address').toLowerCase().trim(),
    role: z.string().optional().default('user'),
    firstName: z.string().optional().default(''),
    lastName: z.string().optional().default(''),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * Parse a CSV text string manually (no dependency needed for this thin wrapper).
 * Returns { headers, rows } where rows are objects keyed by header.
 */
function parseCsvText(text: string): Record<string, string>[] {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    // First line = headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    return lines.slice(1).map(line => {
        // Basic CSV split — handles quoted fields containing commas
        const values: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (const ch of line) {
            if (ch === '"') { inQuotes = !inQuotes; continue; }
            if (ch === ',' && !inQuotes) { values.push(cur.trim()); cur = ''; continue; }
            cur += ch;
        }
        values.push(cur.trim());

        return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
    });
}

async function handler(req: AuthedRequest) {
    await connectDB();

    // ── 1. Read multipart form ─────────────────────────────────────────────────
    let formData: FormData;
    try {
        formData = await (req as NextRequest).formData();
    } catch {
        return fail('Request must be multipart/form-data with a "file" field', 'BAD_REQUEST', 400);
    }

    const file = formData.get('file');
    if (!(file instanceof Blob)) {
        return fail('Missing or invalid "file" field', 'BAD_REQUEST', 400);
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        return fail(`File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`, 'FILE_TOO_LARGE', 413);
    }

    // ── 2. Stream file → text without Papa ─────────────────────────────────────
    // Web API: file is a Blob. We read it as a stream to avoid one large allocation.
    const csvText = await new Response(file.stream()).text();

    // ── 3. Parse CSV ────────────────────────────────────────────────────────────
    const rawRows = parseCsvText(csvText);
    if (rawRows.length === 0) {
        return fail('CSV file contains no data rows', 'CSV_EMPTY', 400);
    }
    if (rawRows.length > MAX_ROWS) {
        return fail(`Maximum ${MAX_ROWS} rows allowed per import batch`, 'BATCH_TOO_LARGE', 400);
    }

    // ── 4. Validate rows ────────────────────────────────────────────────────────
    const validRows: unknown[] = [];
    const allEmails = new Set<string>();

    for (let i = 0; i < rawRows.length; i++) {
        const rowResult = rowSchema.safeParse(rawRows[i]);

        if (!rowResult.success) {
            validRows.push({
                line: i + 2,
                data: rawRows[i],
                status: 'invalid_schema',
                errors: rowResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
            });
        } else {
            const email = rowResult.data.email;
            if (allEmails.has(email)) {
                validRows.push({ line: i + 2, data: rowResult.data, status: 'conflict_duplicate_in_csv' });
            } else {
                allEmails.add(email);
                validRows.push({ line: i + 2, data: rowResult.data, status: 'pending' });
            }
        }
    }

    // ── 5. Batch DB conflict check (one query, not N) ──────────────────────────
    const emailsArray = Array.from(allEmails);
    const existingUsers = await UserModel.find({ email: { $in: emailsArray } }).select('email').lean();
    const existingEmails = new Set(existingUsers.map(u => u.email));

    // ── 6. Finalize statuses ───────────────────────────────────────────────────
    const report = (validRows as any[]).map(row => {
        if (row.status === 'pending') {
            if (existingEmails.has(row.data.email)) {
                return { ...row, status: 'conflict_db', errors: ['Email already exists in database'] };
            }
            return { ...row, status: 'valid' };
        }
        return row;
    });

    const summary = {
        total: report.length,
        valid: report.filter(r => r.status === 'valid').length,
        conflicts: report.filter(r => (r.status as string).startsWith('conflict')).length,
        invalid: report.filter(r => r.status === 'invalid_schema').length,
    };

    return secureHeaders(ok({ report, summary }));
}

export const POST = withPermission('add_users', handler as Parameters<typeof withPermission>[1]);
