'use client';
/**
 * app/(auth)/reset-password/page.tsx
 * Reads ?token= from URL, submits to /api/auth/reset-password
 */

import { useState, FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { projectConfig } from '@/config/project.config';

function ResetForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const theme = projectConfig.theme;
    const token = searchParams.get('token') ?? '';
    const pwdRules = projectConfig.auth.passwordRules;

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    if (!token) {
        return (
            <div className="auth-card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
                <h1 className="auth-title">Invalid link</h1>
                <p className="auth-subtitle" style={{ marginBottom: '1.5rem' }}>
                    This reset link is missing a token. Use the link from your email.
                </p>
                <Link href="/forgot-password" className="auth-link">Request a new link</Link>
            </div>
        );
    }

    if (done) {
        return (
            <div className="auth-card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔓</div>
                <h1 className="auth-title">Password reset!</h1>
                <p className="auth-subtitle" style={{ marginBottom: '1.5rem' }}>
                    Your password has been updated. You can now sign in with your new password.
                </p>
                <Link href="/login">
                    <button className="auth-btn" style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})` }}>
                        Go to login
                    </button>
                </Link>
            </div>
        );
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        if (password !== confirm) { setError('Passwords do not match'); return; }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });
            const json = await res.json();
            if (!json.success) { setError(json.message || 'Reset failed'); return; }
            setDone(true);
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-card">
            <h1 className="auth-title">Set new password</h1>
            <p className="auth-subtitle">Choose a strong password for your account</p>

            {error && <div className="auth-alert">{error}</div>}

            <form onSubmit={handleSubmit} noValidate>
                <div className="auth-field">
                    <label htmlFor="password">New Password</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            id="password" type={showPass ? 'text' : 'password'}
                            value={password} onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••" required style={{ paddingRight: '2.8rem' }} autoFocus
                        />
                        <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: '.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                            {showPass ? '🙈' : '👁'}
                        </button>
                    </div>
                    <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '.3rem' }}>
                        Min {pwdRules.minLength} chars{pwdRules.requireNumber ? ' · includes number' : ''}{pwdRules.requireSpecialChar ? ' · includes special char' : ''}
                    </div>
                </div>
                <div className="auth-field">
                    <label htmlFor="confirm">Confirm New Password</label>
                    <input id="confirm" type={showPass ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required />
                </div>

                <button
                    type="submit" disabled={loading} className="auth-btn"
                    style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})` }}
                >
                    {loading ? <span className="auth-spinner" /> : 'Reset password'}
                </button>
            </form>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="auth-card" style={{ textAlign: 'center', padding: '3rem' }}>Loading…</div>}>
            <ResetForm />
        </Suspense>
    );
}
