#!/usr/bin/env node
'use strict';
/**
 * admin-app/server.js
 * Local-only admin panel server — never deployed.
 * Serves the admin UI at http://localhost:3002
 * The UI makes authenticated fetch calls to main-app's /api/admin/* endpoints.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const PORT = parseInt(process.env.ADMIN_PORT || '3002');
const app = express();

app.use(express.json());

// Serve static UI
const UI = path.join(__dirname, 'ui', 'index.html');
app.get('/{*splat}', (_req, res) => {
    if (fs.existsSync(UI)) return res.sendFile(UI);
    res.status(200).send('<h1>Admin Panel</h1><p>UI not found at admin-app/ui/index.html</p>');
});

const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`[admin-app] Admin panel at http://127.0.0.1:${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[admin-app] Port ${PORT} in use — admin panel not started`);
    }
});
