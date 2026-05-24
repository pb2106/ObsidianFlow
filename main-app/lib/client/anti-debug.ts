/**
 * lib/client/anti-debug.ts
 * Client-side anti-debugging layer.
 * Only active when projectConfig.security.antiDebug === true.
 *
 * Techniques used:
 *  1. Debugger statement loop (breaks stepping in DevTools)
 *  2. Console method poisoning (suppresses output)
 *  3. DevTools size heuristic (window height delta)
 *  4. React DevTools global hook poisoning
 *
 * Call initAntiDebug() once from a client component (e.g. ThemeProvider).
 */

export function initAntiDebug(): void {
    if (typeof window === 'undefined') return;

    // ── 1. Console poisoning ─────────────────────────────────────────────────
    const noop = () => { };
    (window.console as unknown as Record<string, unknown>).log = noop;
    (window.console as unknown as Record<string, unknown>).warn = noop;
    (window.console as unknown as Record<string, unknown>).error = noop;
    (window.console as unknown as Record<string, unknown>).info = noop;
    (window.console as unknown as Record<string, unknown>).table = noop;
    (window.console as unknown as Record<string, unknown>).dir = noop;

    // ── 2. Debugger trap ─────────────────────────────────────────────────────
    // Runs on a timer — hitting a breakpoint causes the timer to fire repeatedly
    // which makes manual debugging extremely painful without stopping execution.
    let debuggerTrap: ReturnType<typeof setInterval> | null = null;

    function armDebuggerTrap() {
        if (debuggerTrap) return;
        debuggerTrap = setInterval(() => {
            // eslint-disable-next-line no-debugger
            (function () { debugger; })();
        }, 100);
    }

    // ── 3. DevTools size heuristic ───────────────────────────────────────────
    const THRESHOLD = 160; // px — typical DevTools panel height when docked bottom
    let devToolsOpen = false;

    function checkDevTools() {
        const widthDelta = window.outerWidth - window.innerWidth;
        const heightDelta = window.outerHeight - window.innerHeight;
        const isOpen = widthDelta > THRESHOLD || heightDelta > THRESHOLD;

        if (isOpen !== devToolsOpen) {
            devToolsOpen = isOpen;
            if (isOpen) {
                armDebuggerTrap();
                triggerDefense();
            } else {
                if (debuggerTrap) { clearInterval(debuggerTrap); debuggerTrap = null; }
            }
        }
    }

    setInterval(checkDevTools, 1000);

    // ── 4. React DevTools poisoning ─────────────────────────────────────────
    // If someone installs the React DevTools extension the hook is registered
    // before React loads. We overwrite it with a non-functional proxy.
    Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
        get: () => ({
            inject: noop,
            onCommitFiberRoot: noop,
            onCommitFiberUnmount: noop,
            isDisabled: true,
            supportsFiber: true,
        }),
        set: noop,
        configurable: false,
    });

    // ── 5. Disable right-click context menu ─────────────────────────────────
    window.addEventListener('contextmenu', e => e.preventDefault());

    // ── 6. Block common keyboard shortcuts ──────────────────────────────────
    window.addEventListener('keydown', e => {
        // F12, Ctrl+Shift+I/J/C, Ctrl+U (view source)
        if (
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) ||
            (e.ctrlKey && e.key.toUpperCase() === 'U')
        ) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
}

// ── Defense sequence ──────────────────────────────────────────────────────────
function triggerDefense(): void {
    // Clear any sensitive DOM content
    const body = document.body;
    if (body) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 2147483647;
      background: #0c0e14; display: flex; align-items: center;
      justify-content: center; flex-direction: column; gap: 1rem;
      font-family: system-ui, sans-serif;
    `;
        overlay.innerHTML = `
      <div style="font-size:2rem;">🔒</div>
      <div style="color:#edf0f9;font-size:1.1rem;font-weight:600;">Access Restricted</div>
      <div style="color:#8892a4;font-size:.85rem;">Developer tools are not permitted on this platform.</div>
      <button onclick="location.reload()" style="margin-top:.5rem;padding:.5rem 1.25rem;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;">
        Return
      </button>
    `;
        body.appendChild(overlay);
    }
}
