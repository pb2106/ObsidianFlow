/**
 * lib/db/plugins/basePlugin.ts
 * Injected into every model automatically.
 * Adds: createdAt, updatedAt (via timestamps), isDeleted, isActive.
 * Also adds a soft-delete helper and filters out deleted docs by default.
 */

import { Schema, Query } from 'mongoose';

export function basePlugin(schema: Schema): void {
    // ── Fields ─────────────────────────────────────────────────────────────────
    schema.add({
        isDeleted: { type: Boolean, default: false, index: true },
        isActive: { type: Boolean, default: true, index: true },
    });

    // Mongoose built-in timestamps: createdAt + updatedAt
    schema.set('timestamps', true);

    // ── Soft-delete instance method ────────────────────────────────────────────
    schema.methods.softDelete = function (this: Record<string, unknown>) {
        this['isDeleted'] = true;
        this['isActive'] = false;
        return (this as { save: () => Promise<unknown> }).save();
    };

    // ── Auto-filter deleted docs in queries ────────────────────────────────────
    // Only applies when the caller hasn't explicitly set isDeleted in their filter.
    const filterDeleted = function (this: Query<unknown, unknown>) {
        if (this.getFilter().isDeleted === undefined) {
            this.where({ isDeleted: { $ne: true } });
        }
    };

    schema.pre('find', filterDeleted);
    schema.pre('findOne', filterDeleted);
    schema.pre('findOneAndUpdate', filterDeleted);
    schema.pre('countDocuments', filterDeleted);
}
