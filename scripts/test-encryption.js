// scripts/test-encryption.js
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
    return Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
}

function encrypt(plaintext) {
    const key = getKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(ciphertext) {
    const key = getKey();
    const parts = ciphertext.split(':');

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
}

async function testEncryption() {
    const secret = "SuperSecretStringForTesting_123!";
    const encryptedOutputs = new Set();
    let allDecryptedMatch = true;

    for (let i = 0; i < 10; i++) {
        const enc = encrypt(secret);
        encryptedOutputs.add(enc);
        const dec = decrypt(enc);
        if (dec !== secret) {
            allDecryptedMatch = false;
        }
    }

    if (encryptedOutputs.size === 10) {
        console.log("SUCCESS: All 10 encrypted outputs are different strings.");
    } else {
        console.log(`FAILURE: Only got ${encryptedOutputs.size} unique encrypted outputs.`);
    }

    if (allDecryptedMatch) {
        console.log("SUCCESS: All 10 decrypted outputs match the original string.");
    } else {
        console.log("FAILURE: Not all decrypted outputs match the original string.");
    }
}

testEncryption().catch(console.error);
