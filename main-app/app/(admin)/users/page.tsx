'use client';
/**
 * app/(admin)/users/page.tsx
 * Admin user management — searchable, paginated user table.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import { projectConfig } from '@/config/project.config';

interface User {
    _id: string;
    email: string;
    role: string;
    isActive: boolean;
    isVerified: boolean;
    firstName?: string;
    lastName?: string;
    createdAt: string;
}

export default function AdminUsersPage() {
    const { accessToken } = useAuth();
    const theme = projectConfig.theme;

    const [users, setUsers] = useState<User[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const LIMIT = 20;

    const fetchUsers = useCallback(async () => {
        if (!accessToken) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), search });
            const res = await fetch(`/api/admin/users?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
            const json = await res.json();
            if (json.success) { setUsers(json.data.users); setTotal(json.data.total); }
        } finally { setLoading(false); }
    }, [accessToken, page, search]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    async function toggleActive(id: string, current: boolean) {
        await fetch(`/api/admin/users/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ isActive: !current }),
        });
        fetchUsers();
    }

    const totalPages = Math.ceil(total / LIMIT);
    const roles = projectConfig.roles;

    function roleColor(role: string) {
        return roles.find(r => r.name === role)?.color ?? '#94a3b8';
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontWeight: 700, fontSize: '1.45rem', margin: 0 }}>Users</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '.85rem', margin: '.2rem 0 0' }}>{total} total accounts</p>
                </div>
                <input
                    type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search email or name…"
                    style={{
                        padding: '.5rem .9rem', border: '1px solid var(--border)', borderRadius: 8,
                        background: 'var(--surface2)', color: 'var(--text)', fontSize: '.85rem', width: 240,
                    }}
                />
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                            {['User', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                                <th key={h} style={{ padding: '.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading…</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No users found</td></tr>
                        ) : users.map((u, i) => (
                            <tr key={u._id} style={{ borderBottom: i < users.length - 1 ? '1px solid var(--border)' : undefined }}>
                                <td style={{ padding: '.75rem 1rem' }}>
                                    <div style={{ fontWeight: 500 }}>{u.firstName ? `${u.firstName} ${u.lastName ?? ''}`.trim() : '—'}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>{u.email}</div>
                                </td>
                                <td style={{ padding: '.75rem 1rem' }}>
                                    <span style={{
                                        background: `${roleColor(u.role)}22`, color: roleColor(u.role),
                                        padding: '.2rem .6rem', borderRadius: 99, fontSize: '.75rem', fontWeight: 600,
                                    }}>
                                        {u.role}
                                    </span>
                                </td>
                                <td style={{ padding: '.75rem 1rem' }}>
                                    <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
                                        <span style={{ background: u.isActive ? 'rgba(52,211,153,.15)' : 'rgba(239,68,68,.1)', color: u.isActive ? '#34d399' : '#ef4444', padding: '.15rem .5rem', borderRadius: 99, fontSize: '.72rem', fontWeight: 600 }}>
                                            {u.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                        {!u.isVerified && (
                                            <span style={{ background: 'rgba(245,158,11,.15)', color: '#f59e0b', padding: '.15rem .5rem', borderRadius: 99, fontSize: '.72rem', fontWeight: 600 }}>
                                                Unverified
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td style={{ padding: '.75rem 1rem', color: 'var(--text-muted)', fontSize: '.8rem' }}>
                                    {new Date(u.createdAt).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '.75rem 1rem' }}>
                                    <button
                                        onClick={() => toggleActive(u._id, u.isActive)}
                                        style={{
                                            padding: '.3rem .75rem', borderRadius: 6,
                                            border: `1px solid ${u.isActive ? '#ef444466' : '#34d39966'}`,
                                            background: 'transparent',
                                            color: u.isActive ? '#ef4444' : '#34d399',
                                            fontSize: '.78rem', fontWeight: 600, cursor: 'pointer',
                                        }}
                                    >
                                        {u.isActive ? 'Disable' : 'Enable'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '.5rem', marginTop: '1.25rem' }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '.4rem .9rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>←</button>
                    <span style={{ padding: '.4rem .9rem', fontSize: '.85rem', color: 'var(--text-muted)' }}>
                        Page {page} of {totalPages}
                    </span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '.4rem .9rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>→</button>
                </div>
            )}
        </div>
    );
}
