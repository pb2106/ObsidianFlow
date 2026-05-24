'use client';
/**
 * components/ui/ThemeProvider.tsx
 * Injects CSS custom properties from projectConfig.theme at runtime.
 * Also manages data-theme attribute for dark mode switching.
 */

import { useEffect, createContext, useContext, useState, ReactNode } from 'react';
import { projectConfig } from '@/config/project.config';
import { initAntiDebug } from '@/lib/client/anti-debug';

type ThemeMode = 'light' | 'dark' | 'system';

const ThemeContext = createContext<{
    mode: ThemeMode;
    toggle: () => void;
}>({ mode: 'system', toggle: () => { } });

export function useTheme() { return useContext(ThemeContext); }

export function ThemeProvider({ children }: { children: ReactNode }) {
    const cfg = projectConfig.theme;
    // Respect projectConfig.theme.darkMode setting ('light' | 'dark' | 'toggle')
    const init: ThemeMode = cfg.darkMode === 'light' ? 'light' : cfg.darkMode === 'dark' ? 'dark' : 'system';
    const [mode, setMode] = useState<ThemeMode>(init);

    // ── Inject brand CSS variables ──
    useEffect(() => {
        const root = document.documentElement;

        function hexToRgb(hex: string) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `${r},${g},${b}`;
        }

        root.style.setProperty('--primary', cfg.primaryColor);
        root.style.setProperty('--accent', cfg.accentColor);
        root.style.setProperty('--primary-dim', `rgba(${hexToRgb(cfg.primaryColor)},.12)`);
        root.style.setProperty('--primary-hover', lighten(cfg.primaryColor));

        // Load Google Font if non-default
        if (cfg.font && cfg.font !== 'Inter') {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(cfg.font)}:wght@300;400;500;600;700;800&display=swap`;
            document.head.appendChild(link);
        }

        // Anti-debug (only when enabled in projectConfig)
        if (projectConfig.security.antiDebug) {
            initAntiDebug();
        }
    }, [cfg.primaryColor, cfg.accentColor, cfg.font]);

    // ── Apply dark/light class ──
    useEffect(() => {
        const root = document.documentElement;
        if (mode === 'dark') { root.setAttribute('data-theme', 'dark'); }
        else if (mode === 'light') { root.setAttribute('data-theme', 'light'); }
        else { root.removeAttribute('data-theme'); }
    }, [mode]);

    // ── Load from localStorage ──
    useEffect(() => {
        if (cfg.darkMode !== 'toggle') return;
        const saved = localStorage.getItem('theme') as ThemeMode | null;
        if (saved) setMode(saved);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    function toggle() {
        if (cfg.darkMode !== 'toggle') return;
        setMode(m => {
            const next = m === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', next);
            return next;
        });
    }

    return (
        <ThemeContext.Provider value={{ mode, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
}

// ── Naive color lightener (shifts hex toward white) ──────────────────────────
function lighten(hex: string): string {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + 30);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + 30);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + 30);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
