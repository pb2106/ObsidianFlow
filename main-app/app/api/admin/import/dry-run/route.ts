/**
 * app/api/admin/import/dry-run/route.ts
 * POST /api/admin/import/dry-run
 * Parses a CSV payload, validates schema, and flags DB conflicts (existing emails).
 */

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import UserModel from '@/models/user.model';
import { withPermission } from '@/lib/middleware/withRole';
import { AuthedRequest } from '@/lib/middleware/withAuth';
import { ok, fail, validationError, secureHeaders } from '@/lib/api/response';
// @ts-ignore
import Papa from 'papaparse';
import { z, ZodError } from 'zod';

const requestSchema = z.object({
    csvData: z.string().min(1, 'CSV data is empty'),
});

const rowSchema = z.object({
    email: z.string().email('Invalid email address').toLowerCase().trim(),
    role: z.string().optional().default('user'),
    firstName: z.string().optional().default(''),
    lastName: z.string().optional().default(''),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

async function handler(req: AuthedRequest) {
    await connectDB();
    const body = await (req as NextRequest).json().catch(() => null);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    // 1. Parse CSV (assuming header row exists)
    const parseResult = Papa.parse(parsed.data.csvData, {
        header: true,
        skipEmptyLines: true,
    });

    if (parseResult.errors.length > 0) {
        return fail('CSV parsing errors detected', 'CSV_ERROR', 400);
    }

    const rows = parseResult.data as Record<string, string>[];
    if (rows.length > 500) {
        return fail('Maximum 500 rows allowed per import batch', 'BATCH_TOO_LARGE', 400);
    }

    // 2. Extract emails for mass conflict check
    const validRows: any[] = [];
    const allEmails = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
        const rawRow = rows[i];
        const rowResult = rowSchema.safeParse(rawRow);

        if (!rowResult.success) {
            validRows.push({
                line: i + 2, // +1 for 0-index, +1 for header
                data: rawRow,
                status: 'invalid_schema',
                errors: (rowResult.error as any).errors.map((e: any) => `${e.path.join('.')}: ${e.message}`)
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

    // 3. Check DB conflicts
    const emailsArray = Array.from(allEmails);
    const existingUsers = await UserModel.find({ email: { $in: emailsArray } }).select('email').lean();
    const existingEmails = new Set(existingUsers.map(u => u.email));

    // 4. Finalize Status
    const report = validRows.map(row => {
        if (row.status === 'pending') {
            if (existingEmails.has(row.data.email)) {
                row.status = 'conflict_db';
                row.errors = ['Email already exists in database'];
            } else {
                row.status = 'valid';
            }
        }
        return row;
    });

    const summary = {
        total: report.length,
        valid: report.filter(r => r.status === 'valid').length,
        conflicts: report.filter(r => r.status.startsWith('conflict')).length,
        invalid: report.filter(r => r.status === 'invalid_schema').length,
    };

    return secureHeaders(ok({ report, summary }));
}

export const POST = withPermission('add_users', handler as Parameters<typeof withPermission>[1]);
