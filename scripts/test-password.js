#!/usr/bin/env node
/**
 * scripts/test-password.js
 * Phase 4 verification — bcrypt hash and verify test.
 * Run from: /home/naegleria/Desktop/ObsidianFlow
 * Usage: node scripts/test-password.js
 */

'use strict';

const bcrypt = require('bcryptjs');

async function main() {
    console.log('\n─── Password Test ─────────────────────────────────────────\n');

    const plain = 'MyStr0ng!Pass';
    const wrong = 'WrongPassword1';
    const ROUNDS = 12;

    // ── 1. Hash ──
    console.log(`Hashing "${plain}" with ${ROUNDS} rounds…`);
    const hash = await bcrypt.hash(plain, ROUNDS);
    console.log('✅ Hash produced:', hash.slice(0, 20) + '…');
    console.log('   Starts with $2b$ (bcrypt)?', hash.startsWith('$2b$') ? '✅ YES' : '❌ NO');

    // ── 2. Correct password verifies ──
    const correctMatch = await bcrypt.compare(plain, hash);
    console.log(`✅ Correct password match: ${correctMatch ? 'PASS' : '❌ FAIL'}`);

    // ── 3. Wrong password fails ──
    const wrongMatch = await bcrypt.compare(wrong, hash);
    console.log(`✅ Wrong password rejected: ${!wrongMatch ? 'PASS' : '❌ FAIL (should be false!)'}`);

    if (correctMatch && !wrongMatch) {
        console.log('\n─── All password tests passed ✓ ───────────────────────────\n');
    } else {
        console.error('\n❌ Password tests FAILED\n');
        process.exit(1);
    }
}

main().catch(err => { console.error(err); process.exit(1); });
