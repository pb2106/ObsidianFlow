/**
 * app/(auth)/layout.tsx
 * Centered, minimal auth layout — wraps login/register/etc.
 * Reads primary + accent colors + font from projectConfig for consistent branding.
 */

import type { ReactNode } from 'react';
import { projectConfig } from '@/config/project.config';

export const metadata = {
    title: `Sign in — ${projectConfig.meta.name}`,
};

export default function AuthLayout({ children }: { children: ReactNode }) {
    const { theme } = projectConfig;

    return (
        <div
            style={{
                minHeight: '100dvh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'radial-gradient(ellipse at 50% 0%, color-mix(in srgb,var(--primary) 12%,transparent), transparent 60%), var(--bg)',
                padding: '1.5rem',
                fontFamily: `${theme.font}, system-ui, sans-serif`,
            }}
        >
            {/* Decorative blobs */}
            <div aria-hidden className="auth-blob auth-blob-1" />
            <div aria-hidden className="auth-blob auth-blob-2" />

            <main style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
                {/* Logo / Wordmark */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    {projectConfig.meta.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={projectConfig.meta.logo} alt={projectConfig.meta.name} style={{ height: 48, marginBottom: '.75rem' }} />
                    ) : (
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 48, height: 48,
                            borderRadius: 12,
                            background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})`,
                            marginBottom: '.75rem',
                            fontSize: 22, fontWeight: 700, color: '#fff',
                            boxShadow: `0 8px 32px ${theme.primaryColor}44`,
                        }}>
                            {projectConfig.meta.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div style={{ fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-.01em' }}>
                        {projectConfig.meta.name}
                    </div>
                    {projectConfig.meta.tagline && (
                        <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>
                            {projectConfig.meta.tagline}
                        </div>
                    )}
                </div>

                {children}
            </main>
        </div>
    );
}
