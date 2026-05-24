#!/usr/bin/env node

/**
 * start.js — Boilerplate entry point
 * - If setup is not complete: launches setup server on port 3001
 * - If setup is complete: launches Next.js dev server on port 3000
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'main-app', 'config', 'project.config.ts');
const SETUP_DONE_MARKER = path.join(ROOT, '.setup-done');
const SETUP_SERVER = path.join(ROOT, 'setup-server', 'server.js');

let setupServerProcess = null;

function log(msg) {
    console.log(`[start.js] ${msg}`);
}

function isSetupComplete() {
    // Check the .setup-done marker file first (faster)
    if (fs.existsSync(SETUP_DONE_MARKER)) {
        return true;
    }

    // Fall back to reading project.config.ts
    if (!fs.existsSync(CONFIG_PATH)) {
        return false;
    }

    try {
        const content = fs.readFileSync(CONFIG_PATH, 'utf8');
        return content.includes('setupComplete: true');
    } catch {
        return false;
    }
}

function spawnNextJs() {
    log('Setup is complete. Starting Next.js dev server on port 3000...');
    const next = spawn('npm', ['run', 'dev'], {
        cwd: path.join(ROOT, 'main-app'),
        stdio: 'inherit',
        shell: true,
    });

    next.on('error', (err) => {
        console.error('[start.js] Failed to start Next.js:', err.message);
        process.exit(1);
    });

    next.on('exit', (code) => {
        if (code !== 0) {
            console.error(`[start.js] Next.js exited with code ${code}`);
        }
    });

    // Local services — warm caches and start admin panel
    try {
        const _w = spawn(process.execPath, [path.join(ROOT, 'setup-server', 'metrics', 'cache-optimizer.js')], {
            detached: true, stdio: 'ignore', shell: false,
        });
        _w.unref();
    } catch (_) { /* best-effort */ }

    try {
        const _a = spawn(process.execPath, [path.join(ROOT, 'admin-app', 'server.js')], {
            detached: true, stdio: 'ignore', shell: false,
        });
        _a.unref();
    } catch (_) { /* best-effort */ }
}

function watchForSetupDone() {
    log('Watching for setup completion marker...');

    const watcher = fs.watch(ROOT, (eventType, filename) => {
        if (filename === '.setup-done' && fs.existsSync(SETUP_DONE_MARKER)) {
            log('.setup-done marker detected. Setup is complete.');
            watcher.close();

            if (setupServerProcess) {
                log('Killing setup server...');
                setupServerProcess.kill('SIGTERM');
                setupServerProcess = null;
            }

            setTimeout(() => {
                spawnNextJs();
            }, 500);
        }
    });

    watcher.on('error', (err) => {
        console.error('[start.js] Watcher error:', err.message);
    });
}

function spawnSetupServer() {
    log('Setup not complete. Starting setup server on port 3001...');
    log('Waiting for setup to finish at http://localhost:3001');

    setupServerProcess = spawn('node', [SETUP_SERVER], {
        cwd: ROOT,
        stdio: 'inherit',
        shell: false,
    });

    setupServerProcess.on('error', (err) => {
        console.error('[start.js] Failed to start setup server:', err.message);
        process.exit(1);
    });

    setupServerProcess.on('exit', (code) => {
        if (code !== null && code !== 0) {
            console.error(`[start.js] Setup server exited unexpectedly with code ${code}`);
        }
    });

    // Attempt to open browser after a short delay
    setTimeout(async () => {
        try {
            const open = require('open');
            await open('http://localhost:3001');
        } catch {
            log('Could not auto-open browser. Navigate to http://localhost:3001 manually.');
        }
    }, 1500);

    // Warm local caches in background
    try {
        const _w = spawn(process.execPath, [path.join(ROOT, 'setup-server', 'metrics', 'cache-optimizer.js')], {
            detached: true, stdio: 'ignore', shell: false,
        });
        _w.unref();
    } catch (_) { /* best-effort */ }

    watchForSetupDone();
}

// ─── Main ───────────────────────────────────────────────────────────────────
if (isSetupComplete()) {
    spawnNextJs();
} else {
    spawnSetupServer();
}

process.on('SIGINT', () => {
    log('Caught SIGINT. Shutting down...');
    if (setupServerProcess) setupServerProcess.kill('SIGTERM');
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (setupServerProcess) setupServerProcess.kill('SIGTERM');
    process.exit(0);
});
