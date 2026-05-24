'use client';
/**
 * components/ui/AppNavbar.tsx
 * Shared top navigation bar — adapts to normal and admin mode.
 */

import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import { projectConfig } from '@/config/project.config';

interface AppNavbarProps {
    isAdmin?: boolean;
}

export function AppNavbar({ isAdmin = false }: AppNavbarProps) {
    const { user, logout } = useAuth();
    const router = useRouter();
    const theme = projectConfig.theme;

    async function handleLogout() {
        await logout();
        router.push('/login');
    }

    const initials = [user?.firstName?.charAt(0), user?.lastName?.charAt(0)]
        .filter(Boolean).join('').toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?';

    return (
        <header style={{
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            padding: '0 1.5rem',
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 50,
            backdropFilter: 'blur(8px)',
        }}>
            {/* Left: Logo */}
            <Link href={isAdmin ? '/admin/dashboard' : '/'} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', textDecoration: 'none', color: 'var(--text)' }}>
                <div style={{
                    width: 32, height: 32,
                    borderRadius: 8,
                    background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14, color: '#fff',
                }}>
                    {projectConfig.meta.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontWeight: 600, fontSize: '.95rem' }}>
                    {projectConfig.meta.name}
                    {isAdmin && <span style={{ fontSize: '.7rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '.4rem' }}>Admin</span>}
                </span>
            </Link>

            {/* Right: User menu */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {!isAdmin && (
                    <Link href="/profile" style={{ fontSize: '.85rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
                        Profile
                    </Link>
                )}
                {user?.role === 'admin' && !isAdmin && (
                    <Link href="/admin/dashboard" style={{ fontSize: '.85rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                        Admin ↗
                    </Link>
                )}

                {/* Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                    <div style={{
                        width: 34, height: 34,
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${theme.primaryColor}44, ${theme.accentColor}44)`,
                        border: `2px solid ${theme.primaryColor}66`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '.8rem', color: theme.primaryColor,
                    }}>
                        {initials}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                        <span style={{ fontSize: '.82rem', fontWeight: 600 }}>
                            {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user?.email}
                        </span>
                        <span style={{ fontSize: '.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                            {user?.role}
                        </span>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    style={{
                        padding: '.4rem .9rem',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        fontSize: '.82rem',
                        cursor: 'pointer',
                        transition: 'border-color .15s, color .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    Sign out
                </button>
            </div>
        </header>
    );
}
