/**
 * lib/env.ts
 * Startup environment validator.
 * Called once at module load — throws on any missing/invalid required variable.
 * Import this at the top of connect.ts so it runs before any DB calls.
 */

type EnvSpec = {
    key: string;
    required: boolean;
    secret?: boolean;   // masks value in logs
    validate?: (val: string) => string | null; // return error string or null
};

const SPECS: EnvSpec[] = [
    // Database
    {
        key: 'MONGODB_URI',
        required: true,
        secret: true,
        validate: v => v.startsWith('mongodb') ? null : 'Must start with mongodb:// or mongodb+srv://',
    },
    // JWT
    {
        key: 'JWT_PRIVATE_KEY',
        required: true,
        secret: true,
        validate: v => v.includes('PRIVATE KEY') ? null : 'Does not look like a PEM private key',
    },
    {
        key: 'JWT_PUBLIC_KEY',
        required: true,
        secret: true,
        validate: v => v.includes('PUBLIC KEY') ? null : 'Does not look like a PEM public key',
    },
    // AES encryption
    {
        key: 'AES_ENCRYPTION_KEY',
        required: true,
        secret: true,
        validate: v => {
            const key = v.replace(/\\n/g, '').trim();
            // Must be 32 bytes (64 hex chars) or 44-char base64
            if (key.length === 64 && /^[0-9a-f]+$/i.test(key)) return null;
            if (key.length === 44) return null; // base64-32
            return 'Must be 64-char hex or 44-char base64 (32-byte key)';
        },
    },
    {
        key: 'REVALIDATE_SECRET',
        required: true,
        secret: true,
        validate: v => v.length >= 32 ? null : 'Revalidate secret must be sufficiently strong.',
    },
    // App URL
    {
        key: 'NEXTAUTH_URL',
        required: false,
    },
    // Upstash Redis
    {
        key: 'UPSTASH_REDIS_REST_URL',
        required: false,
    },
    {
        key: 'UPSTASH_REDIS_REST_TOKEN',
        required: false,
        secret: true,
    },
    // Node env
    {
        key: 'NODE_ENV',
        required: false,
        validate: v => ['development', 'production', 'test'].includes(v) ? null : 'Must be development, production, or test',
    },
];

let validated = false;

export function validateEnv(): void {
    if (validated) return;
    validated = true;

    const errors: string[] = [];

    for (const spec of SPECS) {
        const raw = process.env[spec.key];

        if (!raw) {
            if (spec.required) {
                errors.push(`❌ Missing required env var: ${spec.key}`);
            }
            continue;
        }

        if (spec.validate) {
            const err = spec.validate(raw.replace(/\\n/g, '\n'));
            if (err) {
                errors.push(`❌ Invalid ${spec.key}: ${err}`);
            }
        }
    }

    // Upstash check: warn if missing in production but do not crash
    if (process.env.NODE_ENV === 'production') {
        if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
            console.warn('⚠️  [env] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing. Rate limiting will fall back to memory-only, which does NOT work correctly across multiple instances in production.');
        }
    }

    if (errors.length) {
        console.error('\n[env] Environment validation failed:\n' + errors.join('\n'));
        console.error('[env] Check your .env.local file and re-run the setup wizard if needed.\n');
        throw new Error('[env] Startup validation failed — see errors above');
    }

    if (process.env.NODE_ENV !== 'production') {
        console.info('[env] ✅ All required environment variables validated.');
    }
}
