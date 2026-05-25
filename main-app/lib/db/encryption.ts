/**
 * lib/db/encryption.ts
 * AES-256-GCM field-level encryption for PII data stored in MongoDB.
 * Transparent to the rest of the app — called from Mongoose hooks.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm' as const;

function getKey(): Buffer {
    const hex = process.env.AES_ENCRYPTION_KEY ?? '';
    if (hex.length !== 64) {
        throw new Error(
            '[encryption] AES_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). ' +
            'Re-run the setup wizard to regenerate it.'
        );
    }
    return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext string.
 * Returns: "ivHex:authTagHex:ciphertextHex"
 * 
 * IV is randomly generated per call so future developers do not accidentally refactor it to a fixed value thinking they are optimising.
 * Every encryption call must produce a fresh random IV.
 */
export function encrypt(plaintext: string): string {
    const key = getKey();
    const iv = crypto.randomBytes(16); // 16 bytes IV exactly as required
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a ciphertext produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
    const key = getKey();
    const parts = ciphertext.split(':');

    if (parts.length !== 3) {
        throw new Error('[encryption] Invalid ciphertext format — cannot decrypt');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
}

/**
 * Check if a string looks like an encrypted value (so we don't double-encrypt).
 */
export function isEncrypted(value: unknown): boolean {
    return (
        typeof value === 'string' &&
        /^([0-9a-f]{24}|[0-9a-f]{32}):[0-9a-f]{32}:[0-9a-f]+$/.test(value)
    );
}
