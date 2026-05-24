/**
 * lib/api/schemas.ts
 * Zod schemas for all auth routes.
 * Registration schema is built dynamically from projectConfig.registration.
 */

import { z } from 'zod';
import { projectConfig } from '@/config/project.config';
import { validateEmail, validatePassword } from '@/lib/security/sanitise';

const pwdRules = projectConfig.auth.passwordRules;

// ─── Password schema (reused) ─────────────────────────────────────────────────
export const passwordSchema = z
    .string()
    .trim()
    .max(128, 'Password cannot exceed 128 characters')
    .superRefine((val, ctx) => {
        const error = validatePassword(val);
        if (error) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
        }
    });

// ─── Register schema (dynamic) ────────────────────────────────────────────────
function buildRegisterSchema() {
    const reg = projectConfig.registration;
    const std = reg.standardFields as Record<string, { enabled: boolean; required: boolean }>;

    // Core fields always required
    const base: Record<string, z.ZodTypeAny> = {
        email: z.string().trim().max(254, 'Email too long').email('Invalid email address').refine(validateEmail, 'RFC5322 Email Validation Failed'),
        password: passwordSchema,
    };

    // Standard fields
    const fieldSchemas: Record<string, z.ZodTypeAny> = {
        firstName: z.string().trim().max(500).min(1, 'First name required'),
        lastName: z.string().trim().max(500).min(1).optional(),
        username: z.string().trim().max(50).min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_\-]+$/, 'Only alphanumeric, underscores, and hyphens').optional(),
        phone: z.string().trim().max(50).min(7, 'Invalid phone number').optional(),
        dateOfBirth: z.string().trim().max(50).optional(),
        avatar: z.string().trim().max(500).url().optional(),
        company: z.string().trim().max(500).optional(),
    };

    for (const [key, cfg] of Object.entries(std)) {
        if (!cfg.enabled) continue;
        let schema = fieldSchemas[key] ?? z.string();
        if (!cfg.required) schema = schema.optional() as z.ZodTypeAny;
        base[key] = schema;
    }

    // Custom fields
    const customTypeMap: Record<string, z.ZodTypeAny> = {
        text: z.string().trim().max(500),
        number: z.number(),
        date: z.string().trim().max(50),
        select: z.string().trim().max(500),
        checkbox: z.boolean(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const field of (reg.customFields as any[] ?? [])) {
        let s = customTypeMap[field.type] ?? z.string();
        if (!field.required) s = s.optional() as z.ZodTypeAny;
        base[field.name] = s;
    }

    return z.object(base);
}

export const registerSchema = buildRegisterSchema();
export type RegisterInput = z.infer<typeof registerSchema>;

// ─── Login schema ─────────────────────────────────────────────────────────────
export const loginSchema = z.object({
    identifier: z.string().trim().max(254).min(1, 'Email or username required'),
    password: z.string().trim().max(128).min(1, 'Password required'),
    rememberMe: z.boolean().optional(),
});

// ─── Forgot password ──────────────────────────────────────────────────────────
export const forgotPasswordSchema = z.object({
    email: z.string().trim().max(254).email().refine(validateEmail, 'RFC5322 validation failed'),
});

// ─── Reset password ───────────────────────────────────────────────────────────
export const resetPasswordSchema = z.object({
    token: z.string().trim().length(64, 'Token must be exactly 64 characters').regex(/^[0-9a-f]+$/i, 'Token format invalid'),
    password: passwordSchema,
});

// ─── Verify email ─────────────────────────────────────────────────────────────
export const verifyEmailSchema = z.object({
    token: z.string().trim().max(500).min(1),
});
