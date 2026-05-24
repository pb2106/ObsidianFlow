'use client';
/**
 * app/(protected)/profile/page.tsx
 * User profile — view and edit your own account details.
 */

import { useState, FormEvent } from 'react';
import { useAuth } from '@/lib/auth/context';
import { projectConfig } from '@/config/project.config';

const STD_LABELS: Record<string, string> = {
    firstName: 'First Name', lastName: 'Last Name', username: 'Username',
    phone: 'Phone', dateOfBirth: 'Date of Birth', company: 'Company',
};

export default function ProfilePage() {
    const { user, accessToken, setSession } = useAuth();
    const theme = projectConfig.theme;
    const std = projectConfig.registration.standardFields as Record<string, { enabled: boolean }>;

    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [form, setForm] = useState<Record<string, string>>({
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        username: user?.username ?? '',
    });

    function field(key: string, val: string) { setForm(f => ({ ...f, [key]: val })); }

    async function handleSave(e: FormEvent) {
        e.preventDefault();
        setError(''); setSuccess(''); setSaving(true);
        try {
            const res = await fetch('/api/user/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify(form),
            });
            const json = await res.json();
            if (!json.success) { setError(json.message || 'Save failed'); return; }
            setSession({ ...user!, ...json.data }, accessToken!);
            setSuccess('Profile updated successfully');
            setEditing(false);
        } catch { setError('Network error — please try again'); }
        finally { setSaving(false); }
    }

    const initials = [(user?.firstName ?? '').charAt(0), (user?.lastName ?? '').charAt(0)]
        .filter(Boolean).join('').toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?';

    return (
        <div style={{ maxWidth: 680 }}>
            <h1 style={{ fontWeight: 700, fontSize: '1.6rem', marginBottom: '.25rem' }}>My Profile</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '.88rem' }}>
                Manage your personal information
            </p>

            {/* Avatar + header card */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '1.25rem',
                background: `linear-gradient(135deg, ${theme.primaryColor}18, ${theme.accentColor}12)`,
                border: `1px solid ${theme.primaryColor}33`,
                borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem',
            }}>
                <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1.6rem', color: '#fff',
                    boxShadow: `0 8px 24px ${theme.primaryColor}44`,
                    flexShrink: 0,
                }}>
                    {initials}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '1.15rem' }}>
                        {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user?.email}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '.85rem', marginTop: '.15rem' }}>{user?.email}</div>
                    <span style={{
                        display: 'inline-block', marginTop: '.4rem',
                        padding: '.2rem .65rem', borderRadius: 99,
                        background: `${theme.primaryColor}22`, color: theme.primaryColor,
                        fontSize: '.75rem', fontWeight: 600, textTransform: 'capitalize',
                    }}>
                        {user?.role}
                    </span>
                </div>
                <button
                    onClick={() => { setEditing(v => !v); setError(''); setSuccess(''); }}
                    style={{
                        padding: '.5rem 1.1rem', border: `1px solid ${theme.primaryColor}66`,
                        borderRadius: 8, background: 'transparent', color: theme.primaryColor,
                        cursor: 'pointer', fontWeight: 600, fontSize: '.85rem', transition: 'background .15s',
                    }}
                >
                    {editing ? 'Cancel' : 'Edit Profile'}
                </button>
            </div>

            {/* Status messages */}
            {error && <div className="auth-alert" style={{ marginBottom: '1rem' }}>{error}</div>}
            {success && <div style={{ background: 'rgba(52,211,153,.12)', border: '1px solid rgba(52,211,153,.3)', borderRadius: 8, color: '#34d399', padding: '.65rem 1rem', marginBottom: '1rem', fontSize: '.84rem' }}>{success}</div>}

            {/* Details card */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem' }}>
                {editing ? (
                    <form onSubmit={handleSave}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            {Object.entries(std).filter(([, v]) => v.enabled).map(([key]) => (
                                <div className="auth-field" key={key} style={{ margin: 0 }}>
                                    <label htmlFor={key}>{STD_LABELS[key] ?? key}</label>
                                    <input id={key} type="text" value={form[key] ?? ''} onChange={e => field(key, e.target.value)} />
                                </div>
                            ))}
                        </div>
                        <button type="submit" disabled={saving} className="auth-btn"
                            style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})`, width: 'auto', padding: '.6rem 1.5rem' }}>
                            {saving ? <span className="auth-spinner" /> : 'Save changes'}
                        </button>
                    </form>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <InfoRow label="Email" value={user?.email ?? '—'} />
                        <InfoRow label="Role" value={user?.role ?? '—'} capitalize />
                        {Object.entries(std).filter(([, v]) => v.enabled).map(([key]) => (
                            <InfoRow key={key} label={STD_LABELS[key] ?? key} value={(user as Record<string, unknown>)?.[key] as string ?? '—'} />
                        ))}
                    </div>
                )}
            </div>

            {/* Security section */}
            <div style={{ marginTop: '1.25rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem' }}>
                <h2 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '1rem' }}>Security</h2>
                <a href="/forgot-password" style={{ color: theme.primaryColor, fontSize: '.88rem', textDecoration: 'none', fontWeight: 500 }}>
                    → Change password
                </a>
            </div>
        </div>
    );
}

function InfoRow({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
    return (
        <div>
            <div style={{ fontSize: '.74rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: '.25rem' }}>
                {label}
            </div>
            <div style={{ fontSize: '.9rem', textTransform: capitalize ? 'capitalize' : undefined }}>{value}</div>
        </div>
    );
}
