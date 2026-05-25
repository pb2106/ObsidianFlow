/**
 * models/login_history.model.ts
 * Stores one document per login event.
 * Kept separate from users collection to prevent document bloat.
 * TTL index automatically purges records older than 90 days.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// ─── Interface ─────────────────────────────────────────────────────────────────
export interface ILoginHistory extends Document {
    userId: mongoose.Types.ObjectId;
    ip: string;
    userAgent: string;
    success: boolean;
    failureReason?: string;
    createdAt: Date;
}

// ─── Schema ────────────────────────────────────────────────────────────────────
const LoginHistorySchema = new Schema<ILoginHistory>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        ip: { type: String, default: '' },
        userAgent: { type: String, default: '' },
        success: { type: Boolean, required: true },
        failureReason: { type: String, default: null },
    },
    {
        collection: 'login_history',
        timestamps: { createdAt: true, updatedAt: false }, // append-only — no updates
    }
);

// TTL: auto-purge entries after 90 days
LoginHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Compound index for quick per-user history lookups
LoginHistorySchema.index({ userId: 1, createdAt: -1 });

// ─── Singleton model (HMR safe) ───────────────────────────────────────────────
const LoginHistoryModel: Model<ILoginHistory> =
    (mongoose.models['LoginHistory'] as Model<ILoginHistory>) ??
    mongoose.model<ILoginHistory>('LoginHistory', LoginHistorySchema);

export default LoginHistoryModel;
