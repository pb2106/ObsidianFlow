'use client';
/**
 * components/ui/ErrorBoundary.tsx
 * React error boundary — catches render-time exceptions and shows
 * a styled fallback instead of a blank screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 *
 * Or with a custom fallback:
 *   <ErrorBoundary fallback={<p>Something went wrong</p>}>
 *     ...
 *   </ErrorBoundary>
 */

import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // In production: send to your error tracking service here
        if (process.env.NODE_ENV === 'development') {
            console.error('[ErrorBoundary]', error, info.componentStack);
        }
    }

    render() {
        if (this.state.error) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div style={{
                    minHeight: '50dvh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                    padding: '2rem',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '2.5rem' }}>⚠️</div>
                    <h2 style={{ fontWeight: 700, fontSize: '1.15rem', margin: 0 }}>Something went wrong</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '.88rem', maxWidth: 420 }}>
                        An unexpected error occurred. Please refresh the page. If the problem persists, contact support.
                    </p>
                    {process.env.NODE_ENV === 'development' && (
                        <pre style={{
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            padding: '1rem',
                            fontSize: '.75rem',
                            color: 'var(--error)',
                            textAlign: 'left',
                            maxWidth: 600,
                            overflow: 'auto',
                            maxHeight: 200,
                        }}>
                            {this.state.error.message}
                        </pre>
                    )}
                    <button
                        onClick={() => { this.setState({ error: null }); window.location.reload(); }}
                        style={{
                            padding: '.55rem 1.25rem',
                            background: 'var(--primary)',
                            border: 'none',
                            borderRadius: 8,
                            color: '#fff',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '.88rem',
                        }}
                    >
                        Refresh page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
