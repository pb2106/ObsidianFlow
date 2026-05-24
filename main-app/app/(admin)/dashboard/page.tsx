'use client';
/**
 * app/(admin)/dashboard/page.tsx
 * Admin dashboard — stats cards + recent activity.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { projectConfig } from '@/config/project.config';

interface Stats {
    totalUsers: number;
    activeUsers: number;
    totalSessions: number;
    newToday: number;
}

export default function AdminDashboardPage() {
    const { accessToken } = useAuth();
    const theme = projectConfig.theme;
    const [stats, setStats] = useState<Stats | null>(null);

    useEffect(() => {
        if (!accessToken) return;
        fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${accessToken}` } })
            .then(r => r.json())
            .then(j => { if (j.success) setStats(j.data); })
            .catch(() => null);
    }, [accessToken]);

    const cards = [
        { label: 'Total Users', value: stats?.totalUsers ?? '—', icon: '👥', color: theme.primaryColor },
        { label: 'Active Today', value: stats?.activeUsers ?? '—', icon: '✅', color: '#10b981' },
        { label: 'New Today', value: stats?.newToday ?? '—', icon: '🆕', color: theme.accentColor },
        { label: 'Active Sessions', value: stats?.totalSessions ?? '—', icon: '🔐', color: '#8b5cf6' },
    ];

    return (
        <div>
            <h1 style={{ fontWeight: 700, fontSize: '1.55rem', marginBottom: '.25rem' }}>Dashboard</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '.88rem' }}>
                {projectConfig.meta.name} — platform overview
            </p>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {cards.map(card => (
                    <div key={card.label} style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 16,
                        padding: '1.25rem 1.5rem',
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        <div style={{ position: 'absolute', top: '1rem', right: '1rem', fontSize: '1.4rem', opacity: .7 }}>
                            {card.icon}
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: card.color, lineHeight: 1.1 }}>
                            {card.value}
                        </div>
                        <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.4rem', fontWeight: 500 }}>
                            {card.label}
                        </div>
                        {/* Bottom accent bar */}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: card.color, opacity: .4 }} />
                    </div>
                ))}
            </div>

            {/* Quick links */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem' }}>
                <h2 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '1rem' }}>Quick Actions</h2>
                <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
                    {[
                        { href: '/admin/users', label: 'Manage Users' },
                        { href: '/admin/roles', label: 'Manage Roles' },
                        { href: '/admin/config', label: 'Site Settings' },
                        { href: '/admin/audit', label: 'View Audit Log' },
                    ].map(item => (
                        <a key={item.href} href={item.href} style={{
                            padding: '.55rem 1.1rem',
                            background: `${theme.primaryColor}18`,
                            border: `1px solid ${theme.primaryColor}44`,
                            borderRadius: 8,
                            color: theme.primaryColor,
                            fontSize: '.85rem',
                            fontWeight: 500,
                            textDecoration: 'none',
                            transition: 'background .15s',
                        }}>
                            {item.label}
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}
