'use client';
/**
 * app/(admin)/layout.tsx
 * Admin auth guard — requires role === 'admin'. Redirects others to /.
 */

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { AppNavbar } from '@/components/ui/AppNavbar';

export default function AdminLayout({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading, user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;
        if (!isAuthenticated) { router.replace('/login'); return; }
        if (user?.role !== 'admin') { router.replace('/'); }
    }, [isAuthenticated, isLoading, user, router]);

    if (isLoading) {
        return (
            <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="auth-spinner" style={{ width: 32, height: 32, borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
            </div>
        );
    }

    if (!isAuthenticated || user?.role !== 'admin') return null;

    return (
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <AppNavbar isAdmin />
            <div style={{ display: 'flex', flex: 1 }}>
                <AdminSidebar />
                <main style={{ flex: 1, padding: '2rem', maxWidth: 'calc(100% - 220px)', overflow: 'auto' }}>
                    {children}
                </main>
            </div>
        </div>
    );
}

// ─── Side navigation ──────────────────────────────────────────────────────────
const NAV_ITEMS = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/admin/users', label: 'Users', icon: '👥' },
    { href: '/admin/roles', label: 'Roles', icon: '🎭' },
    { href: '/admin/config', label: 'Config', icon: '⚙️' },
    { href: '/admin/audit', label: 'Audit Log', icon: '📋' },
];

function AdminSidebar() {
    return (
        <aside style={{
            width: 220, minHeight: '100%',
            background: 'var(--surface)',
            borderRight: '1px solid var(--border)',
            padding: '1.5rem 0',
            flexShrink: 0,
        }}>
            <div style={{ padding: '0 1rem .75rem', fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>
                Admin Panel
            </div>
            {NAV_ITEMS.map(item => (
                <a
                    key={item.href}
                    href={item.href}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '.6rem',
                        padding: '.65rem 1rem',
                        color: 'var(--text)',
                        textDecoration: 'none',
                        fontSize: '.88rem',
                        transition: 'background .15s',
                        borderRadius: '0 8px 8px 0',
                        marginRight: '.5rem',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    <span style={{ width: 20, textAlign: 'center' }}>{item.icon}</span>
                    {item.label}
                </a>
            ))}
        </aside>
    );
}
