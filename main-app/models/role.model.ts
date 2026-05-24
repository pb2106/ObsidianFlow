/**
 * models/role.model.ts
 * Seeded from projectConfig.roles on first run.
 * Stores per-role permission flags.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { basePlugin } from '@/lib/db/plugins/basePlugin';

export interface IRole extends Document {
    name: string;
    color: string;
    isDefault: boolean;
    permissions: Record<string, boolean>;
    createdAt: Date;
    updatedAt: Date;
    isDeleted: boolean;
    isActive: boolean;
    softDelete: () => Promise<this>;
}

const RoleSchema = new Schema<IRole>(
    {
        name: { type: String, required: true, unique: true, trim: true, lowercase: true },
        color: { type: String, default: '#6366f1' },
        isDefault: { type: Boolean, default: false },
        permissions: { type: Schema.Types.Mixed, default: {} },
    },
    { collection: 'roles' }
);

RoleSchema.plugin(basePlugin);
RoleSchema.index({ name: 1 }, { unique: true });

const RoleModel: Model<IRole> =
    (mongoose.models['Role'] as Model<IRole>) ??
    mongoose.model<IRole>('Role', RoleSchema);

export default RoleModel;
