/**
 * lib/api/schemas.ts
 * Zod schemas for all auth routes.
 * Registration schema is built dynamically from projectConfig.registration.
 */

import { z } from 'zod';
import { projectConfig } from '@/config/project.config';

const pwdRules = projectConfig.auth.passwordRules;

// ─── Password schema (reused) ─────────────────────────────────────────────────
export const passwordSchema = z
    .string()
    .min(pwdRules.minLength, `Password must be at least ${pwdRules.minLength} characters`)
    .refine(
        val => !pwdRules.requireNumber || /\d/.test(val),
        'Password must contain at least one number'
    )
    .refine(
        val => !pwdRules.requireSpecialChar || /[^a-zA-Z0-9]/.test(val),
        'Password must contain at least one special character'
    );

// ─── Register schema (dynamic) ────────────────────────────────────────────────
function buildRegisterSchema() {
    const reg = projectConfig.registration;
    const std = reg.standardFields as Record<string, { enabled: boolean; required: boolean }>;

    // Core fields always required
    const base: Record<string, z.ZodTypeAny> = {
        email: z.string().email('Invalid email address'),
        password: passwordSchema,
    };

    // Standard fields
    const fieldSchemas: Record<string, z.ZodTypeAny> = {
        firstName: z.string().min(1, 'First name required'),
        lastName: z.string().min(1).optional(),
        username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, underscores').optional(),
        phone: z.string().min(7, 'Invalid phone number').optional(),
        dateOfBirth: z.string().optional(),
        avatar: z.string().url().optional(),
        company: z.string().optional(),
    };

    for (const [key, cfg] of Object.entries(std)) {
        if (!cfg.enabled) continue;
        let schema = fieldSchemas[key] ?? z.string();
        if (!cfg.required) schema = schema.optional() as z.ZodTypeAny;
        base[key] = schema;
    }

    // Custom fields
    const customTypeMap: Record<string, z.ZodTypeAny> = {
        text: z.string(),
        number: z.number(),
        date: z.string(),
        select: z.string(),
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
    identifier: z.string().min(1, 'Email or username required'),
    password: z.string().min(1, 'Password required'),
    rememberMe: z.boolean().optional(),
});

// ─── Forgot password ──────────────────────────────────────────────────────────
export const forgotPasswordSchema = z.object({
    email: z.string().email(),
});

// ─── Reset password ───────────────────────────────────────────────────────────
export const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: passwordSchema,
});

// ─── Verify email ─────────────────────────────────────────────────────────────
export const verifyEmailSchema = z.object({
    token: z.string().min(1),
});
