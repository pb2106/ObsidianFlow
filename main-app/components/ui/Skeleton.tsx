/**
 * components/ui/Skeleton.tsx
 * Skeleton loading placeholders — used while data is being fetched.
 *
 * Usage:
 *   <Skeleton />                          // single line
 *   <Skeleton width="60%" height={20} />  // fixed size
 *   <SkeletonCard />                      // full card placeholder
 *   <SkeletonTable rows={5} cols={4} />   // table placeholder
 */

import { CSSProperties } from 'react';

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    radius?: string | number;
    style?: CSSProperties;
}

export function Skeleton({ width = '100%', height = 16, radius = 6, style }: SkeletonProps) {
    return (
        <div
            className="skeleton"
            style={{
                width: typeof width === 'number' ? `${width}px` : width,
                height: typeof height === 'number' ? `${height}px` : height,
                borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
                ...style,
            }}
        />
    );
}

export function SkeletonText({ lines = 3, gap = 10 }: { lines?: number; gap?: number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap }} aria-label="Loading…" aria-busy="true">
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton key={i} width={i === lines - 1 ? '65%' : '100%'} />
            ))}
        </div>
    );
}

export function SkeletonCard({ height = 120 }: { height?: number }) {
    return (
        <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '1.25rem 1.5rem',
        }}>
            <Skeleton width={40} height={40} radius={10} style={{ marginBottom: 12 }} />
            <Skeleton width="40%" height={22} style={{ marginBottom: 8 }} />
            <Skeleton width="70%" height={14} />
        </div>
    );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '1rem', padding: '.75rem 1rem', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} width="70%" height={12} />)}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '1rem', padding: '.75rem 1rem', borderBottom: r < rows - 1 ? '1px solid var(--border)' : undefined }}>
                    {Array.from({ length: cols }).map((_, c) => <Skeleton key={c} width={c === 0 ? '85%' : '60%'} height={14} />)}
                </div>
            ))}
        </div>
    );
}
