'use client';
/**
 * app/(protected)/layout.tsx
 * Client-side auth guard — redirects to /login if not authenticated.
 * Shows a loading spinner while session is being restored.
 */

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { AppNavbar } from '@/components/ui/AppNavbar';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace('/login');
        }
    }, [isAuthenticated, isLoading, router]);

    if (isLoading) {
        return (
            <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="auth-spinner" style={{ width: 32, height: 32, borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
            </div>
        );
    }

    if (!isAuthenticated) return null; // prevents flash before redirect

    return (
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <AppNavbar />
            <main style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
                {children}
            </main>
        </div>
    );
}
