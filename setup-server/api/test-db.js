'use strict';

const mongoose = require('mongoose');

/**
 * POST /api/test-db
 * Body: { uri: string }
 * Tests a MongoDB connection and returns latency + DB name.
 */
module.exports = async function testDb(req, res) {
    const { uri } = req.body;

    if (!uri || typeof uri !== 'string' || !uri.trim()) {
        return res.status(400).json({
            success: false,
            error: 'MongoDB URI is required.',
        });
    }

    let conn;
    try {
        const start = Date.now();
        conn = await mongoose
            .createConnection(uri.trim(), {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000,
            })
            .asPromise();

        const latency = Date.now() - start;
        const dbName = conn.db.databaseName;
        await conn.close();

        return res.json({ success: true, latency, dbName });
    } catch (err) {
        if (conn) {
            try { await conn.close(); } catch (_) { /* ignore */ }
        }
        // Return a clean error message, not the raw stack
        const message = err.message || 'Connection failed';
        const reason = message.includes('ENOTFOUND')
            ? 'Host not found — check your URI hostname.'
            : message.includes('Authentication failed')
                ? 'Authentication failed — check your username/password.'
                : message.includes('timed out')
                    ? 'Connection timed out — server unreachable or URI wrong.'
                    : message;

        return res.json({ success: false, error: reason });
    }
};
