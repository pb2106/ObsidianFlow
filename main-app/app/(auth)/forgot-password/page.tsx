'use client';
/**
 * app/(auth)/forgot-password/page.tsx
 */

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { projectConfig } from '@/config/project.config';

export default function ForgotPasswordPage() {
    const theme = projectConfig.theme;
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'sent'>('idle');
    const [error, setError] = useState('');
    const [devToken, setDevToken] = useState('');

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        setStatus('loading');

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const json = await res.json();

            // Dev mode returns the raw token
            if (json.data?.resetToken) {
                setDevToken(json.data.resetToken);
            }

            setStatus('sent');
        } catch {
            setError('Network error. Please try again.');
            setStatus('idle');
        }
    }

    if (status === 'sent') {
        return (
            <div className="auth-card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📬</div>
                <h1 className="auth-title">Check your email</h1>
                <p className="auth-subtitle" style={{ marginBottom: '1.5rem' }}>
                    If <strong>{email}</strong> is registered, you&apos;ll receive a link to reset your password within a few minutes.
                </p>

                {devToken && (
                    <div style={{
                        background: 'var(--surface2)', borderRadius: 8, padding: '1rem',
                        marginBottom: '1rem', fontSize: '.78rem', textAlign: 'left',
                        border: '1px solid var(--border)',
                    }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '.4rem', fontWeight: 600 }}>
                            🛠 DEV MODE — Reset token:
                        </div>
                        <code style={{ wordBreak: 'break-all', color: 'var(--primary)' }}>{devToken}</code>
                        <div style={{ color: 'var(--text-muted)', marginTop: '.4rem', fontSize: '.72rem' }}>
                            POST /api/auth/reset-password with this token
                        </div>
                    </div>
                )}

                <Link href="/login" className="auth-link">← Back to login</Link>
            </div>
        );
    }

    return (
        <div className="auth-card">
            <h1 className="auth-title">Reset your password</h1>
            <p className="auth-subtitle">Enter your email and we&apos;ll send you a reset link</p>

            {error && <div className="auth-alert">{error}</div>}

            <form onSubmit={handleSubmit} noValidate>
                <div className="auth-field">
                    <label htmlFor="email">Email</label>
                    <input
                        id="email" type="email" value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com" required autoFocus
                    />
                </div>

                <button
                    type="submit" disabled={status === 'loading'} className="auth-btn"
                    style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})` }}
                >
                    {status === 'loading' ? <span className="auth-spinner" /> : 'Send reset link'}
                </button>
            </form>

            <p className="auth-footer">
                Remember your password?{' '}
                <Link href="/login" className="auth-link">Sign in</Link>
            </p>
        </div>
    );
}
