/**
 * models/user.model.ts
 * Dynamically shaped based on projectConfig.registration.
 * Core fields always present. Standard/custom fields added at runtime.
 * AES-256-GCM encryption applied to PII fields transparently via hooks.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { projectConfig } from '@/config/project.config';
import { basePlugin } from '@/lib/db/plugins/basePlugin';
import { encrypt, decrypt, isEncrypted } from '@/lib/db/encryption';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ILoginHistory {
    ip: string;
    timestamp: Date;
    userAgent: string;
}

export interface IUserBase extends Document {
    email: string;
    passwordHash: string;
    role: string;
    isActive: boolean;
    isDeleted: boolean;
    isVerified: boolean;
    lastLogin: Date | null;
    loginHistory: ILoginHistory[];
    failedLoginAttempts: number;
    lockoutUntil: Date | null;
    sessions: mongoose.Types.ObjectId[];
    // Standard optional fields
    firstName?: string;
    lastName?: string;
    username?: string;
    phone?: string;
    dateOfBirth?: string; // stored encrypted
    avatar?: string;
    company?: string;
    // Password reset
    passwordResetTokenHash?: string;
    passwordResetExpiry?: Date;
    // Email verification
    emailVerificationToken?: string;
    // TOTP
    totpEnabled: boolean;
    totpSecret?: string;
    backupCodes: string[];
    [key: string]: unknown; // custom fields
}

// ─── PII fields that get AES-256 encryption ───────────────────────────────────
const ALWAYS_PII_FIELDS = ['phone', 'dateOfBirth'];

function getPiiFields(): string[] {
    const custom = (projectConfig.registration.customFields ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((f: any) => f.pii)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((f: any) => f.name);
    return [...ALWAYS_PII_FIELDS, ...custom];
}

// ─── Schema builder ───────────────────────────────────────────────────────────
function buildUserSchema(): Schema {
    const reg = projectConfig.registration;

    // ── Core fields (always present) ──
    const coreFields: Record<string, unknown> = {
        email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
        passwordHash: { type: String, required: true },
        role: { type: String, required: true, default: reg.standardFields.firstName ? 'user' : 'user', index: true },
        isVerified: { type: Boolean, default: false },
        lastLogin: { type: Date, default: null },
        loginHistory: [{
            ip: String,
            timestamp: { type: Date, default: Date.now },
            userAgent: String,
        }],
        failedLoginAttempts: { type: Number, default: 0 },
        lockoutUntil: { type: Date, default: null },
        sessions: [{ type: Schema.Types.ObjectId, ref: 'Session' }],
        passwordResetTokenHash: { type: String, default: null },
        passwordResetExpiry: { type: Date, default: null },
        emailVerificationToken: { type: String, default: null },
        totpEnabled: { type: Boolean, default: false },
        totpSecret: { type: String, default: null },
        backupCodes: { type: [String], default: [] },
    };

    // ── Standard fields (conditionally added) ──
    const stdMap: Record<string, Record<string, unknown>> = {
        firstName: { type: String, trim: true },
        lastName: { type: String, trim: true },
        username: { type: String, trim: true, sparse: true, index: true },
        phone: { type: String }, // encrypted at rest
        dateOfBirth: { type: String }, // encrypted at rest
        avatar: { type: String },
        company: { type: String, trim: true },
    };

    const stdFields = reg.standardFields as Record<string, { enabled: boolean; required: boolean }>;
    for (const [key, cfg] of Object.entries(stdFields)) {
        if (cfg.enabled && stdMap[key]) {
            const fieldDef = { ...stdMap[key] } as Record<string, unknown>;
            if (cfg.required) fieldDef.required = true;
            coreFields[key] = fieldDef;
        }
    }

    // ── Custom fields ──
    const typeMap: Record<string, unknown> = {
        text: String, number: Number, date: Date, select: String, checkbox: Boolean,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const field of (reg.customFields as any[] ?? [])) {
        const fieldDef: Record<string, unknown> = {
            type: typeMap[field.type] ?? String,
            default: null,
        };
        if (field.required) fieldDef.required = true;
        coreFields[field.name] = fieldDef;
    }

    const schema = new Schema(coreFields as Parameters<typeof Schema>[0], {
        collection: 'users',
        strict: true,
    });

    // ── Apply base plugin ──
    schema.plugin(basePlugin);

    // ── Encryption hooks ──
    const piiFields = getPiiFields();

    schema.pre('save', function (this: IUserBase) {
        for (const field of piiFields) {
            const val = this[field];
            if (typeof val === 'string' && val && !isEncrypted(val)) {
                (this as Record<string, unknown>)[field] = encrypt(val);
            }
        }
    });

    // Decrypt after find/findOne
    function decryptDoc(doc: Record<string, unknown>) {
        if (!doc) return;
        for (const field of piiFields) {
            const val = doc[field];
            if (typeof val === 'string' && isEncrypted(val)) {
                try { doc[field] = decrypt(val); } catch { /* leave encrypted if key wrong */ }
            }
        }
    }

    schema.post('find', function (docs: Record<string, unknown>[]) {
        docs.forEach(decryptDoc);
    });

    schema.post('findOne', function (doc: Record<string, unknown> | null) {
        if (doc) decryptDoc(doc);
    });

    schema.post('findOneAndUpdate', function (doc: Record<string, unknown> | null) {
        if (doc) decryptDoc(doc);
    });

    // Ensure loginHistory stays capped at 100 entries
    schema.pre('save', function (this: IUserBase) {
        if (this.loginHistory.length > 100) {
            this.loginHistory = this.loginHistory.slice(-100);
        }
    });

    return schema;
}

// ─── Singleton model (HMR safe) ───────────────────────────────────────────────
const UserModel: Model<IUserBase> =
    (mongoose.models['User'] as Model<IUserBase>) ??
    mongoose.model<IUserBase>('User', buildUserSchema());

export default UserModel;
