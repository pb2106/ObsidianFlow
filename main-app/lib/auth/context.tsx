'use client';
/**
 * lib/auth/context.tsx
 * AuthContext — wraps the app, stores user + accessToken in memory.
 * On mount silently calls /api/auth/refresh to restore session from httpOnly cookie.
 */

import {
    createContext, useContext, useState, useEffect,
    useCallback, useRef, ReactNode,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AuthUser {
    id: string;
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
    username?: string;
}

interface AuthState {
    user: AuthUser | null;
    accessToken: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
    login: (identifier: string, password: string) => Promise<any>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<string | null>;
    setSession: (user: AuthUser, token: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({
        user: null,
        accessToken: null,
        isLoading: true,
        isAuthenticated: false,
    });

    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Silent session restore on mount ──────────────────────────────────────
    const refreshSession = useCallback(async (): Promise<string | null> => {
        try {
            const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
            const json = await res.json();
            if (json.success && json.data?.accessToken) {
                // Fetch user profile with the new token
                const meRes = await fetch('/api/auth/me', {
                    headers: { Authorization: `Bearer ${json.data.accessToken}` },
                });
                const meJson = await meRes.json();
                if (meJson.success) {
                    setState({ user: meJson.data, accessToken: json.data.accessToken, isLoading: false, isAuthenticated: true });
                    scheduleRefresh(json.data.accessToken);
                    return json.data.accessToken;
                }
            }
        } catch { /* network error — stay logged out */ }
        setState(s => ({ ...s, isLoading: false }));
        return null;
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        refreshSession();
        return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Schedule a refresh 1 min before token expires (assuming 1h tokens) ──
    function scheduleRefresh(token: string) {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiresIn = (payload.exp * 1000) - Date.now() - 60_000; // 1 min early
            if (expiresIn > 0) {
                refreshTimerRef.current = setTimeout(() => refreshSession(), expiresIn);
            }
        } catch { /* ignore */ }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    function setSession(user: AuthUser, token: string) {
        setState({ user, accessToken: token, isLoading: false, isAuthenticated: true });
        scheduleRefresh(token);
    }

    async function login(identifier: string, password: string) {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ identifier, password }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Login failed');
        if (json.data?.requires2FA) {
            return json.data; // Return { requires2FA, tempToken, user } to the UI
        }
        setSession(json.data.user, json.data.accessToken);
    }

    async function logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { Authorization: `Bearer ${state.accessToken}` },
                credentials: 'include',
            });
        } finally {
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
            setState({ user: null, accessToken: null, isLoading: false, isAuthenticated: false });
        }
    }

    return (
        <AuthContext.Provider value={{ ...state, login, logout, refreshSession, setSession }}>
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
