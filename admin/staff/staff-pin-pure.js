/* =========================================================
   Shared PIN hashing — PBKDF2 via the standard Web Crypto API.
   Loaded as a plain <script> in admin/staff/roster.js (browser, PIN
   generation) AND require()'d from api/staff-login.js (Node serverless,
   PIN verification) — the exact same source file on both sides, so the
   two can never drift out of sync (same convention as
   admin/news/publish-news-pure.js). No npm dependency either way — Web
   Crypto is a browser/Node built-in, and this repo has zero npm
   dependencies anywhere by design.
   ========================================================= */

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_HASH = 'SHA-256';
const PBKDF2_KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

function isNodeEnv() {
    return typeof module !== 'undefined' && !!module.exports;
}

function getWebCrypto() {
    return isNodeEnv() ? require('crypto').webcrypto : crypto;
}

function bufferToHex(buf) {
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuffer(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

function isValidPinFormat(pin) {
    return typeof pin === 'string' && /^\d{6}$/.test(pin);
}

async function derivePinHashHex(pin, saltHex) {
    const webcrypto = getWebCrypto();
    const enc = new TextEncoder();
    const keyMaterial = await webcrypto.subtle.importKey(
        'raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const derivedBits = await webcrypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: hexToBuffer(saltHex), iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
        keyMaterial,
        PBKDF2_KEY_LENGTH_BITS
    );
    return bufferToHex(derivedBits);
}

// Generates a fresh 6-digit PIN + its stored hash — used by
// admin/staff/roster.js's "Jana PIN Baharu" button. Uses a CSPRNG
// (crypto.getRandomValues), never Math.random() — an easy, invisible
// mistake for anything PIN/token-shaped.
async function generatePinAndHash() {
    const webcrypto = getWebCrypto();
    const randomBuf = new Uint32Array(1);
    webcrypto.getRandomValues(randomBuf);
    const pin = String(randomBuf[0] % 1000000).padStart(6, '0');
    const saltBuf = new Uint8Array(SALT_BYTES);
    webcrypto.getRandomValues(saltBuf);
    const saltHex = bufferToHex(saltBuf);
    const hashHex = await derivePinHashHex(pin, saltHex);
    return { pin, pin_hash: `${saltHex}:${hashHex}` };
}

// Verifies a submitted PIN against a stored 'salt_hex:hash_hex' value.
// Only ever called server-side (api/staff-login.js) — constant-time via
// Node's crypto.timingSafeEqual there. The browser never verifies a PIN
// (only generates one), so the fallback path below is defensive, not
// load-bearing.
async function verifyPin(pin, storedPinHash) {
    if (!storedPinHash || typeof storedPinHash !== 'string' || !storedPinHash.includes(':')) return false;
    if (!isValidPinFormat(pin)) return false;
    const [saltHex, expectedHashHex] = storedPinHash.split(':');
    const actualHashHex = await derivePinHashHex(pin, saltHex);
    if (actualHashHex.length !== expectedHashHex.length) return false;
    if (isNodeEnv()) {
        const nodeCrypto = require('crypto');
        return nodeCrypto.timingSafeEqual(Buffer.from(actualHashHex, 'hex'), Buffer.from(expectedHashHex, 'hex'));
    }
    let diff = 0;
    for (let i = 0; i < actualHashHex.length; i++) {
        diff |= actualHashHex.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
    }
    return diff === 0;
}

// Pure — no I/O. Given the failed-attempt count BEFORE this failure and
// "now", decides the next failed_pin_attempts value and whether a
// lockout should be applied. Called only on a PIN mismatch — a caller
// must check isLocked() BEFORE calling verifyPin() at all, not after.
function computeLockoutUpdate(currentFailedAttempts, now) {
    const failed_pin_attempts = (currentFailedAttempts || 0) + 1;
    const locked_until = failed_pin_attempts >= LOCKOUT_THRESHOLD
        ? new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
        : null;
    return { failed_pin_attempts, locked_until };
}

// Pure — no I/O. True if the staff row's locked_until is still in the future.
function isLocked(staffRow, now) {
    if (!staffRow || !staffRow.locked_until) return false;
    return new Date(staffRow.locked_until).getTime() > now.getTime();
}

if (isNodeEnv()) {
    module.exports = {
        PBKDF2_ITERATIONS, LOCKOUT_THRESHOLD, LOCKOUT_MINUTES,
        isValidPinFormat, derivePinHashHex, generatePinAndHash, verifyPin,
        computeLockoutUpdate, isLocked,
    };
}
