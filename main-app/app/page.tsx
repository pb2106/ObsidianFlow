'use client';
/**
 * app/page.tsx
 * Root home page — the post-login landing.
 * Redirects unauthenticated users to /login via the AuthContext.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { AppNavbar } from '@/components/ui/AppNavbar';
import { projectConfig } from '@/config/project.config';

export default function HomePage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const theme = projectConfig.theme;
  const meta = projectConfig.meta;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="auth-spinner" style={{ width: 36, height: 36, borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const initials = [(user?.firstName ?? '').charAt(0), (user?.lastName ?? '').charAt(0)]
    .filter(Boolean).join('').toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?';

  const quickLinks = [
    { href: '/profile', label: 'My Profile', desc: 'View and edit your account', icon: '👤', always: true },
    { href: '/admin/dashboard', label: 'Admin Panel', desc: 'Manage users, roles & settings', icon: '⚙️', always: false, adminOnly: true },
  ].filter(l => l.always || (l.adminOnly && user?.role === 'admin'));

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <AppNavbar />

      <main style={{ flex: 1, maxWidth: 1100, margin: '0 auto', width: '100%', padding: '3rem 1.5rem' }}>

        {/* Hero greeting */}
        <div style={{
          background: `linear-gradient(135deg, ${theme.primaryColor}14, ${theme.accentColor}0a)`,
          border: `1px solid ${theme.primaryColor}24`,
          borderRadius: 24,
          padding: '2.5rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Background decoration */}
          <div aria-hidden style={{
            position: 'absolute', top: -60, right: -60,
            width: 220, height: 220, borderRadius: '50%',
            background: `radial-gradient(circle, ${theme.primaryColor}18, transparent 70%)`,
            pointerEvents: 'none',
          }} />

          {/* Avatar */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '1.9rem', color: '#fff',
            boxShadow: `0 8px 28px ${theme.primaryColor}50`,
          }}>
            {initials}
          </div>

          {/* Text */}
          <div>
            <div style={{ fontSize: '.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: '.25rem' }}>
              Welcome back
            </div>
            <h1 style={{ fontWeight: 800, fontSize: '2rem', letterSpacing: '-.03em', marginBottom: '.3rem' }}>
              {user?.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : user?.email}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>{user?.email}</span>
              <span style={{
                background: `${theme.primaryColor}22`, color: theme.primaryColor,
                padding: '.15rem .6rem', borderRadius: 99,
                fontSize: '.73rem', fontWeight: 700, textTransform: 'capitalize',
              }}>
                {user?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {quickLinks.map(link => (
            <a key={link.href} href={link.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '1.25rem 1.5rem',
                cursor: 'pointer',
                transition: 'box-shadow .18s, border-color .18s, transform .12s',
                display: 'flex', gap: '1rem', alignItems: 'center',
              }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.boxShadow = 'var(--shadow-md)'; el.style.borderColor = `${theme.primaryColor}55`; el.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.boxShadow = ''; el.style.borderColor = 'var(--border)'; el.style.transform = ''; }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: `linear-gradient(135deg, ${theme.primaryColor}1a, ${theme.accentColor}14)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.4rem', flexShrink: 0,
                }}>
                  {link.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '.95rem', marginBottom: '.15rem' }}>{link.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>{link.desc}</div>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Platform info */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '1.5rem',
        }}>
          <h2 style={{ fontWeight: 600, margin: 0, marginBottom: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontSize: '.78rem' }}>
            About this platform
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
            <Stat label="Platform" value={meta.name} />
            <Stat label="Your Role" value={user?.role ?? '—'} capitalize />
            <Stat label="Support" value={meta.supportEmail || '—'} />
            <Stat label="Timezone" value={meta.timezone} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.5rem', textAlign: 'center', fontSize: '.78rem', color: 'var(--text-muted)' }}>
        © {new Date().getFullYear()} {meta.name}. Built with ObsidianFlow.
      </footer>
    </div>
  );
}

function Stat({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-muted)', marginBottom: '.3rem' }}>{label}</div>
      <div style={{ fontWeight: 500, fontSize: '.9rem', textTransform: capitalize ? 'capitalize' : undefined }}>{value}</div>
    </div>
  );
}
