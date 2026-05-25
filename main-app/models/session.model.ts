/**
 * models/session.model.ts
 * Stores refresh token sessions. One document per active session.
 * Indexed on userId and refreshTokenHash for fast lookup and revocation.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { basePlugin } from '@/lib/db/plugins/basePlugin';

export interface ISession extends Document {
    userId: mongoose.Types.ObjectId;
    refreshTokenHash: string;   // bcrypt hash of the refresh token
    userAgent: string;
    ip: string;
    expiresAt: Date;
    lastActive: Date;
    createdAt: Date;
    updatedAt: Date;
    isDeleted: boolean;
    isActive: boolean;
}

const SessionSchema = new Schema<ISession>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        refreshTokenHash: { type: String, required: true, unique: true },
        userAgent: { type: String, default: '' },
        ip: { type: String, default: '' },
        expiresAt: { type: Date, required: true, index: true },
        lastActive: { type: Date, default: Date.now },
    },
    { collection: 'sessions' }
);

SessionSchema.plugin(basePlugin);

// Compound index for token lookup
SessionSchema.index({ userId: 1, refreshTokenHash: 1 });

// TTL index — MongoDB auto-deletes expired sessions
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const SessionModel: Model<ISession> =
    (mongoose.models['Session'] as Model<ISession>) ??
    mongoose.model<ISession>('Session', SessionSchema);

export default SessionModel;
