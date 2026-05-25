/**
 * lib/security/sanitise.ts
 * Global input sanitization engine. Runs natively ahead of Zod layers.
 */

import { projectConfig } from '@/config/project.config';

/**
 * Validates against strict RFC5322 regex guidelines.
 */
export function validateEmail(email: string): boolean {
    const rx = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return rx.test(email);
}

/**
 * Cross-references projectConfig to ensure symmetric alignment with UI hints.
 */
export function validatePassword(password: string): string | null {
    const rules = projectConfig.auth.passwordRules;
    if (password.length < rules.minLength) return `Password must be at least ${rules.minLength} characters.`;
    if (rules.requireNumber && !/\d/.test(password)) return 'Password must contain a number.';
    if (rules.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password)) {
        return 'Password must contain a special character.';
    }
    return null;
}

/**
 * Recursively cleans complex JSON bodies.
 * Trims, strips HTML tags, enforces physical limits, and blocks Mongo operators natively.
 */
export function sanitiseBody(input: unknown): any {
    return _walk(input, 'root');
}

function _walk(input: unknown, key: string): any {
    if (input === null || input === undefined) return input;

    if (Array.isArray(input)) {
        return input.map((v, i) => _walk(v, `${key}[${i}]`));
    }

    if (typeof input === 'object') {
        const obj = input as Record<string, any>;
        const result: Record<string, any> = {};
        for (const [k, v] of Object.entries(obj)) {
            // Anti Prototype Pollution
            if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
                throw new Error(`[Security] Critical Prototype Pollution vector detected.`);
            }
            // Anti MongoDB NoSQL Injection
            if (k.startsWith('$') || k.includes('.')) {
                throw new Error(`[Security] MongoDB operators are strictly forbidden inside payload key declarations.`);
            }
            result[k] = _walk(v, k);
        }
        return result;
    }

    if (typeof input === 'string') {
        // 1. Trim Edge Spaces
        let clean = input.trim();
        const kLow = key.toLowerCase();

        // 2. Strip standard HTML markup unless it's a password
        const skipHtmlStrip = ['password', 'newpassword', 'confirmpassword', 'currentpassword'].includes(kLow);
        if (!skipHtmlStrip) {
            clean = clean.replace(/<[^>]*>/g, '');
        }

        // 3. Enforce precise sizing overrides
        if (kLow.includes('email')) {
            if (clean.length > 254) throw new Error('[Security] Email entity exceeds maximum allowable length of 254 bytes.');
        } else if (kLow.includes('password')) {
            if (clean.length > 128) throw new Error('[Security] Password exceeds threshold array size of 128 bytes.');
        } else if (kLow.includes('username')) {
            if (clean.length > 50) throw new Error('[Security] Username entity parameter too large (MAX: 50).');
        } else {
            if (clean.length > 500) throw new Error(`[Security] Field [${key}] exceeds generic 500 limits.`);
        }
        return clean;
    }

    return input;
}
