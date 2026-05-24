/**
 * setup-server/server.js
 * Express server on port 3001 — serves the setup wizard UI.
 */

'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const ROOT = path.join(__dirname, '..');
const SETUP_DONE = path.join(ROOT, '.setup-done');

app.use(express.json({ limit: '20mb' })); // logo might be base64
app.use(express.static(path.join(__dirname, 'ui')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.post('/api/test-db', require('./api/test-db'));
app.post('/api/initialise', require('./api/initialise'));

// SSE: poll for .setup-done marker, redirect client when found
app.get('/api/status', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    if (fs.existsSync(SETUP_DONE)) {
        send({ type: 'redirect', url: 'http://localhost:3000/login' });
        return res.end();
    }

    const interval = setInterval(() => {
        if (fs.existsSync(SETUP_DONE)) {
            send({ type: 'redirect', url: 'http://localhost:3000/login' });
            clearInterval(interval);
            res.end();
        } else {
            send({ type: 'waiting' });
        }
    }, 1000);

    req.on('close', () => clearInterval(interval));
});

// Catch-all → wizard UI (Express 5 requires /{*splat} not *)
app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(__dirname, 'ui', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`[setup-server] Wizard running at http://localhost:${PORT}`);
    console.log('[setup-server] Waiting for setup to be completed...');
});
