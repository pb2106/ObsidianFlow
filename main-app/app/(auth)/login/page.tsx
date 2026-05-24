'use client';
/**
 * app/(auth)/login/page.tsx
 */

import { useState, FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { projectConfig } from '@/config/project.config';

export default function LoginPage() {
    const router = useRouter();
    const { login, setSession } = useAuth();
    const theme = projectConfig.theme;
    const loginBy = projectConfig.auth.loginIdentifier;

    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    // 2FA Flow
    const [pending2FA, setPending2FA] = useState<{ tempToken: string, user: any } | null>(null);
    const [otp, setOtp] = useState('');
    const [qrData, setQrData] = useState<{ qrCodeUrl: string, secret: string, backupCodes: string[] } | null>(null);

    const placeholder =
        loginBy === 'email' ? 'you@example.com' :
            loginBy === 'username' ? 'username' :
                'Email or username';

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await login(identifier, password);
            if (data?.requires2FA) {
                setPending2FA(data);
            } else {
                router.push('/');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!pending2FA) return;
        if (pending2FA.user.totpEnabled) return; // Already setup, just ask for code

        // Fetch setup data
        fetch('/api/auth/setup-totp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tempToken: pending2FA.tempToken })
        })
            .then(r => r.json())
            .then(json => {
                if (json.success) setQrData(json.data);
                else setError(json.message || 'Failed to initialize TOTP setup');
            });
    }, [pending2FA]);

    async function handleVerify(e: FormEvent) {
        e.preventDefault();
        if (!pending2FA) return;
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/verify-totp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tempToken: pending2FA.tempToken, code: otp }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message || 'Verification failed');

            // Successfully verified! Set session and redirect
            setSession(json.data.user, json.data.accessToken);
            router.push('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Verification failed');
        } finally {
            setLoading(false);
        }
    }

    if (pending2FA) {
        return (
            <div className="auth-card" style={{ maxWidth: '420px' }}>
                <h1 className="auth-title">Two-Factor Authentication</h1>
                <p className="auth-subtitle">
                    {pending2FA.user.totpEnabled
                        ? 'Enter the 6-digit code from your authenticator app.'
                        : 'Action required: Set up mandatory 2FA.'}
                </p>

                {error && <div className="auth-alert">{error}</div>}

                {!pending2FA.user.totpEnabled && qrData && (
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem', background: 'var(--surface-color)', padding: '1rem', borderRadius: '8px' }}>
                        <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Scan this QR code with Google Authenticator, Authy, or Ente Auth.</p>
                        <img src={qrData.qrCodeUrl} alt="TOTP QR Code" style={{ display: 'block', margin: '0 auto', borderRadius: '8px', border: '4px solid white' }} />
                        <div style={{ background: '#1c1f2e', color: '#ffb3b3', padding: '0.8rem', borderRadius: '6px', fontSize: '0.8rem', marginTop: '1rem', textAlign: 'left', wordBreak: 'break-all' }}>
                            <strong style={{ display: 'block', marginBottom: '0.3rem', color: '#ef4444' }}>CRITICAL BACKUP CODES</strong>
                            <p style={{ marginBottom: '0.5rem', opacity: 0.8 }}>Save these somewhere safe. They will never be shown again.</p>
                            {qrData.backupCodes.join(' • ')}
                        </div>
                    </div>
                )}

                <form onSubmit={handleVerify} noValidate>
                    <div className="auth-field">
                        <label htmlFor="otp">Authentication Code</label>
                        <input
                            id="otp"
                            type="text"
                            value={otp}
                            onChange={e => setOtp(e.target.value)}
                            placeholder="000000"
                            required
                            autoComplete="one-time-code"
                            autoFocus
                            style={{ textAlign: 'center', letterSpacing: '0.5rem', fontSize: '1.2rem' }}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="auth-btn"
                        style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})` }}
                    >
                        {loading ? <span className="auth-spinner" /> : 'Verify'}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setPending2FA(null); setQrData(null); }}
                        style={{ marginTop: '1rem', background: 'none', border: 'none', width: '100%', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                        Back to Login
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="auth-card">
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">Sign in to your account</p>

            {error && <div className="auth-alert">{error}</div>}

            <form onSubmit={handleSubmit} noValidate>
                <div className="auth-field">
                    <label htmlFor="identifier">
                        {loginBy === 'email' ? 'Email' : loginBy === 'username' ? 'Username' : 'Email or Username'}
                    </label>
                    <input
                        id="identifier"
                        type={loginBy === 'email' ? 'email' : 'text'}
                        value={identifier}
                        onChange={e => setIdentifier(e.target.value)}
                        placeholder={placeholder}
                        required
                        autoComplete="email"
                    />
                </div>

                <div className="auth-field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <label htmlFor="password">Password</label>
                        <Link href="/forgot-password" className="auth-link-sm">Forgot password?</Link>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <input
                            id="password"
                            type={showPass ? 'text' : 'password'}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                            style={{ paddingRight: '2.8rem' }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPass(v => !v)}
                            style={{
                                position: 'absolute', right: '0.75rem', top: '50%',
                                transform: 'translateY(-50%)', background: 'none', border: 'none',
                                cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: '1rem',
                            }}
                            aria-label={showPass ? 'Hide password' : 'Show password'}
                        >
                            {showPass ? '🙈' : '👁'}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="auth-btn"
                    style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})` }}
                >
                    {loading ? <span className="auth-spinner" /> : 'Sign in'}
                </button>
            </form>

            {projectConfig.auth.providers.filter(p => p !== 'email').length > 0 && (
                <>
                    <div className="auth-divider"><span>or continue with</span></div>
                    <div className="auth-oauth-row">
                        {projectConfig.auth.providers.includes('google') && (
                            <a href="/api/auth/oauth/google" className="auth-oauth-btn">
                                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.96 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg>
                                Google
                            </a>
                        )}
                        {projectConfig.auth.providers.includes('github') && (
                            <a href="/api/auth/oauth/github" className="auth-oauth-btn">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" /></svg>
                                GitHub
                            </a>
                        )}
                        {projectConfig.auth.providers.includes('discord') && (
                            <a href="/api/auth/oauth/discord" className="auth-oauth-btn">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" /></svg>
                                Discord
                            </a>
                        )}
                    </div>
                </>
            )}

            <p className="auth-footer">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="auth-link">Create one</Link>
            </p>
        </div>
    );
}
