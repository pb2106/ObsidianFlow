'use client';
/**
 * app/(auth)/register/page.tsx
 */

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { projectConfig } from '@/config/project.config';

export default function RegisterPage() {
    const router = useRouter();
    const { setSession } = useAuth();
    const theme = projectConfig.theme;
    const reg = projectConfig.registration;
    const std = reg.standardFields as Record<string, { enabled: boolean; required: boolean }>;

    const [form, setForm] = useState<Record<string, string>>({ email: '', password: '', confirmPassword: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    function field(key: string, value: string) {
        setForm(f => ({ ...f, [key]: value }));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');

        if (form.password !== form.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const { confirmPassword: _, ...body } = form;
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!json.success) {
                if (Array.isArray(json.error)) {
                    setError(json.error.map((e: { field: string; message: string }) => `${e.field}: ${e.message}`).join(' · '));
                } else {
                    setError(json.message || 'Registration failed');
                }
                return;
            }
            setSession(json.data.user, json.data.accessToken);
            router.push('/');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    const pwdRules = projectConfig.auth.passwordRules;

    return (
        <div className="auth-card">
            <h1 className="auth-title">Create your account</h1>
            <p className="auth-subtitle">Get started — it only takes a minute</p>

            {error && <div className="auth-alert">{error}</div>}

            <form onSubmit={handleSubmit} noValidate>
                {/* Name row */}
                {(std.firstName?.enabled || std.lastName?.enabled) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                        {std.firstName?.enabled && (
                            <div className="auth-field">
                                <label htmlFor="firstName">First Name{std.firstName.required && <span style={{ color: 'var(--error)' }}>*</span>}</label>
                                <input id="firstName" type="text" value={form.firstName ?? ''} onChange={e => field('firstName', e.target.value)} placeholder="Jane" required={std.firstName.required} />
                            </div>
                        )}
                        {std.lastName?.enabled && (
                            <div className="auth-field">
                                <label htmlFor="lastName">Last Name{std.lastName.required && <span style={{ color: 'var(--error)' }}>*</span>}</label>
                                <input id="lastName" type="text" value={form.lastName ?? ''} onChange={e => field('lastName', e.target.value)} placeholder="Smith" required={std.lastName.required} />
                            </div>
                        )}
                    </div>
                )}

                {/* Username */}
                {std.username?.enabled && (
                    <div className="auth-field">
                        <label htmlFor="username">Username{std.username.required && <span style={{ color: 'var(--error)' }}>*</span>}</label>
                        <input id="username" type="text" value={form.username ?? ''} onChange={e => field('username', e.target.value)} placeholder="jane_smith" required={std.username.required} />
                    </div>
                )}

                {/* Email */}
                <div className="auth-field">
                    <label htmlFor="email">Email<span style={{ color: 'var(--error)' }}>*</span></label>
                    <input id="email" type="email" value={form.email} onChange={e => field('email', e.target.value)} placeholder="you@example.com" required autoComplete="email" />
                </div>

                {/* Password */}
                <div className="auth-field">
                    <label htmlFor="password">Password<span style={{ color: 'var(--error)' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                        <input
                            id="password" type={showPass ? 'text' : 'password'}
                            value={form.password} onChange={e => field('password', e.target.value)}
                            placeholder="••••••••" required style={{ paddingRight: '2.8rem' }}
                        />
                        <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: '.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                            {showPass ? '🙈' : '👁'}
                        </button>
                    </div>
                    <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '.3rem' }}>
                        Min {pwdRules.minLength} chars{pwdRules.requireNumber ? ' · includes number' : ''}{pwdRules.requireSpecialChar ? ' · includes special char' : ''}
                    </div>
                </div>

                {/* Confirm password */}
                <div className="auth-field">
                    <label htmlFor="confirmPassword">Confirm Password<span style={{ color: 'var(--error)' }}>*</span></label>
                    <input id="confirmPassword" type={showPass ? 'text' : 'password'} value={form.confirmPassword ?? ''} onChange={e => field('confirmPassword', e.target.value)} placeholder="••••••••" required />
                </div>

                {/* Phone */}
                {std.phone?.enabled && (
                    <div className="auth-field">
                        <label htmlFor="phone">Phone{std.phone.required && <span style={{ color: 'var(--error)' }}>*</span>}</label>
                        <input id="phone" type="tel" value={form.phone ?? ''} onChange={e => field('phone', e.target.value)} placeholder="+1 555 0100" required={std.phone.required} />
                    </div>
                )}

                {/* Company */}
                {std.company?.enabled && (
                    <div className="auth-field">
                        <label htmlFor="company">Company{std.company.required && <span style={{ color: 'var(--error)' }}>*</span>}</label>
                        <input id="company" type="text" value={form.company ?? ''} onChange={e => field('company', e.target.value)} placeholder="Acme Inc." required={std.company.required} />
                    </div>
                )}

                <button
                    type="submit" disabled={loading} className="auth-btn"
                    style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})`, marginTop: '.5rem' }}
                >
                    {loading ? <span className="auth-spinner" /> : 'Create account'}
                </button>
            </form>

            <p className="auth-footer">
                Already have an account?{' '}
                <Link href="/login" className="auth-link">Sign in</Link>
            </p>
        </div>
    );
}
