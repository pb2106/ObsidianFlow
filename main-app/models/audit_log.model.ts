/**
 * models/audit_log.model.ts
 * Append-only audit trail. No update or delete operations ever.
 * This is enforced by throwing at the model method level.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAuditLog extends Document {
    timestamp: Date;
    actor: string;      // "system" | user email | admin email
    actorId: string | null;
    actionType: string;      // e.g. "USER_ROLE_CHANGED", "USER_BANNED"
    target: string;      // e.g. "User"
    targetId: string | null;
    detail: Record<string, unknown>;  // before/after, reason, etc.
    ipAddress: string;
    sessionId: string | null;
    createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
    {
        timestamp: { type: Date, default: Date.now, index: true },
        actor: { type: String, required: true },
        actorId: { type: String, default: null },
        actionType: { type: String, required: true, index: true },
        target: { type: String, required: true },
        targetId: { type: String, default: null },
        detail: { type: Schema.Types.Mixed, default: {} },
        ipAddress: { type: String, default: '' },
        sessionId: { type: String, default: null },
    },
    {
        collection: 'audit_logs',
        // No timestamps plugin — we manage timestamp ourselves to keep it immutable
    }
);

// Compound indexes for common filter patterns
AuditLogSchema.index({ actor: 1, timestamp: -1 });
AuditLogSchema.index({ actionType: 1, timestamp: -1 });
AuditLogSchema.index({ targetId: 1, timestamp: -1 });

// ── Write-only enforcement ────────────────────────────────────────────────────
// Throw if anyone tries to update or delete an audit log document.
const FORBIDDEN = () => {
    throw new Error(
        '[AuditLog] Audit log entries are append-only. ' +
        'Update and delete operations are forbidden.'
    );
};

AuditLogSchema.pre('updateOne', FORBIDDEN);
AuditLogSchema.pre('updateMany', FORBIDDEN);
AuditLogSchema.pre('findOneAndUpdate', FORBIDDEN);
AuditLogSchema.pre('replaceOne', FORBIDDEN);
AuditLogSchema.pre('deleteOne', FORBIDDEN);
AuditLogSchema.pre('deleteMany', FORBIDDEN);
AuditLogSchema.pre('findOneAndDelete', FORBIDDEN);

// ── Helper: create a log entry ────────────────────────────────────────────────
export async function writeAuditLog(entry: {
    actor: string;
    actorId?: string | null;
    actionType: string;
    target: string;
    targetId?: string | null;
    detail?: Record<string, unknown>;
    ipAddress?: string;
    sessionId?: string | null;
}): Promise<void> {
    await AuditLogModel.create({
        timestamp: new Date(),
        actor: entry.actor,
        actorId: entry.actorId ?? null,
        actionType: entry.actionType,
        target: entry.target,
        targetId: entry.targetId ?? null,
        detail: entry.detail ?? {},
        ipAddress: entry.ipAddress ?? '',
        sessionId: entry.sessionId ?? null,
    });
}

const AuditLogModel: Model<IAuditLog> =
    (mongoose.models['AuditLog'] as Model<IAuditLog>) ??
    mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLogModel;
