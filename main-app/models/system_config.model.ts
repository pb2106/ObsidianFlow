/**
 * models/system_config.model.ts
 * Single document — setup_complete flag, disabled endpoints list,
 * maintenance mode, and runtime config overrides.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { basePlugin } from '@/lib/db/plugins/basePlugin';

export interface ISystemConfig extends Document {
    setup_complete: boolean;
    disabled_endpoints: string[];  // array of endpointMeta.id strings
    maintenance_mode: boolean;
    maintenance_message: string;
    maintenance_back_at: Date | null;
    runtime_config: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
    isDeleted: boolean;
    isActive: boolean;
}

const SystemConfigSchema = new Schema<ISystemConfig>(
    {
        setup_complete: { type: Boolean, default: false },
        disabled_endpoints: { type: [String], default: [] },
        maintenance_mode: { type: Boolean, default: false },
        maintenance_message: { type: String, default: '' },
        maintenance_back_at: { type: Date, default: null },
        runtime_config: { type: Schema.Types.Mixed, default: {} },
    },
    { collection: 'system_config' }
);

SystemConfigSchema.plugin(basePlugin);

// Singleton lookup — always queried by setup_complete: true
SystemConfigSchema.index({ setup_complete: 1 });

const SystemConfigModel: Model<ISystemConfig> =
    (mongoose.models['SystemConfig'] as Model<ISystemConfig>) ??
    mongoose.model<ISystemConfig>('SystemConfig', SystemConfigSchema);

export default SystemConfigModel;
