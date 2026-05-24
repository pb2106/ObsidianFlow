#!/usr/bin/env node
/**
 * scripts/test-jwt.js
 * Phase 4 verification — JWT sign, verify, and tamper test.
 * Run from: /home/naegleria/Desktop/ObsidianFlow
 * Usage: node scripts/test-jwt.js
 */

'use strict';

// Load .env.local from main-app
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', 'main-app', '.env.local');
if (!fs.existsSync(envPath)) {
    console.error('❌ main-app/.env.local not found. Run the setup wizard first.');
    process.exit(1);
}

// Parse .env.local manually
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim().replace(/^"|"$/g, '');
}

const jwt = require('jsonwebtoken');

// Rebuild PEM keys (escaped \n → real newlines)
const privateKey = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n');
const publicKey = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n');

if (!privateKey || !publicKey) {
    console.error('❌ JWT keys not found in .env.local');
    process.exit(1);
}

console.log('\n─── JWT Test ──────────────────────────────────────────────\n');

// ── 1. Sign an access token ──
const payload = { sub: 'test-user-id', email: 'test@example.com', role: 'user', sessionId: 'sess-1', type: 'access' };
const token = jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '1h' });
console.log('✅ Signed token:', token.slice(0, 40) + '…');

// ── 2. Verify it ──
try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    console.log('✅ Verified payload:', { sub: decoded.sub, email: decoded.email, role: decoded.role });
} catch (e) {
    console.error('❌ Verification failed (should not happen):', e.message);
    process.exit(1);
}

// ── 3. Tamper with the token ──
const parts = token.split('.');
const tampered = parts[0] + '.' + parts[1] + '.' + 'TAMPERED_SIGNATURE';

try {
    jwt.verify(tampered, publicKey, { algorithms: ['RS256'] });
    console.error('❌ Tampered token passed — THIS IS A BUG');
    process.exit(1);
} catch (e) {
    console.log('✅ Tampered token correctly rejected:', e.message);
}

console.log('\n─── All JWT tests passed ✓ ────────────────────────────────\n');
