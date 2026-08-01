// Vercel serverless function: POST /api/staff-login
// The entire authentication boundary for the staff/ identity/login layer
// (see admin/setup.sql §11's header comment for the full design writeup).
//
// CRITICAL: staff members NEVER become a Supabase Auth principal. Every
// SELECT policy in this repo is `TO authenticated USING (true)`, meaning
// "holds ANY valid Supabase Auth JWT for this project" — not "is an
// admin." If staff logged in via db.auth.signInWithOAuth() like admins
// do, they'd get a real authenticated-role JWT capable of reading every
// table in this database. This endpoint uses the SERVICE ROLE key and
// bypasses RLS entirely (same pattern as api/publish.js) — RLS is never
// evaluated on this path. Google identity is verified independently via
// Google's own tokeninfo endpoint, never via Supabase Auth.
//
// Two completely separate concerns, gated by req.body.method:
//   'pin'    — { staff_id, pin } — rate-limited (5 failures = 15 min lock,
//              see admin/staff/staff-pin-pure.js), PBKDF2 verified via
//              the SAME pure module the admin's browser uses to generate
//              a PIN in the first place — zero drift risk between the two.
//   'google' — { id_token } — a Google Identity Services ID token,
//              verified against Google's tokeninfo endpoint, matched
//              against staff.email.
// GET (or POST {method:'roster'}) — public name-only listing for the PIN
//   picker on staff/login.html. Never returns pin_hash/device_session_token.
//
// Either successful path issues a fresh device_session_token, overwriting
// whatever was stored before — this IS the "single active session"
// mechanism: logging in on a new device silently invalidates the old one.
//
// Required Vercel environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (same ones every other api/
//     endpoint in this repo already uses)
//   GOOGLE_CLIENT_ID — the Google OAuth Client ID already used by
//     Supabase Auth for admin login; centralized here (not secret) so
//     staff/login.html's GIS initialize() and this endpoint's aud check
//     can't drift apart

const crypto = require('crypto');
const {
    isValidPinFormat, verifyPin, computeLockoutUpdate, isLocked,
} = require('../admin/staff/staff-pin-pure.js');

module.exports = async function handler(req, res) {
    // ── CORS ────────────────────────────────────────────────────────────────
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'Server misconfiguration: missing Supabase env vars' });
    }
    const sbHeaders = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Accept': 'application/json' };

    // ── Public roster listing (name only — this is how a staff member
    //    picks "who am I" before entering a PIN) ─────────────────────────────
    const method = req.method === 'GET' ? 'roster' : (req.body && req.body.method);

    if (method === 'roster') {
        const rosterRes = await fetch(
            `${supabaseUrl}/rest/v1/staff?select=id,full_name&enabled=eq.true&order=full_name.asc`,
            { headers: sbHeaders }
        );
        if (!rosterRes.ok) return res.status(500).json({ error: 'Gagal memuatkan senarai staf' });
        const roster = await rosterRes.json();
        return res.status(200).json({ staff: roster });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (method === 'pin') {
        return handlePinLogin(req, res, supabaseUrl, sbHeaders);
    }
    if (method === 'google') {
        return handleGoogleLogin(req, res, supabaseUrl, sbHeaders);
    }
    return res.status(400).json({ error: 'Unknown method' });
};

async function handlePinLogin(req, res, supabaseUrl, sbHeaders) {
    const { staff_id, pin } = req.body || {};
    if (!staff_id || !isValidPinFormat(pin)) {
        return res.status(400).json({ error: 'PIN salah' });
    }

    const lookupRes = await fetch(
        `${supabaseUrl}/rest/v1/staff?id=eq.${encodeURIComponent(staff_id)}` +
        `&select=id,full_name,pin_hash,failed_pin_attempts,locked_until,enabled`,
        { headers: sbHeaders }
    );
    if (!lookupRes.ok) return res.status(500).json({ error: 'Ralat pelayan' });
    const rows = await lookupRes.json();
    const staffRow = rows[0];

    // Never reveal missing vs. disabled vs. wrong-PIN — same generic error.
    if (!staffRow || !staffRow.enabled) {
        return res.status(401).json({ error: 'PIN salah' });
    }

    const now = new Date();
    if (isLocked(staffRow, now)) {
        return res.status(423).json({
            error: 'Akaun dikunci buat sementara waktu selepas terlalu banyak percubaan. Cuba lagi kemudian.',
            locked_until: staffRow.locked_until,
        });
    }

    const valid = await verifyPin(pin, staffRow.pin_hash);
    if (!valid) {
        const update = computeLockoutUpdate(staffRow.failed_pin_attempts, now);
        await fetch(`${supabaseUrl}/rest/v1/staff?id=eq.${encodeURIComponent(staff_id)}`, {
            method: 'PATCH',
            headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(update),
        });
        return res.status(401).json({ error: 'PIN salah' });
    }

    return finalizeLogin(res, supabaseUrl, sbHeaders, staffRow);
}

async function handleGoogleLogin(req, res, supabaseUrl, sbHeaders) {
    const { id_token } = req.body || {};
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!id_token) return res.status(400).json({ error: 'Token tiada' });
    if (!googleClientId) return res.status(500).json({ error: 'Server misconfiguration: missing GOOGLE_CLIENT_ID' });

    // Verified independently against Google's own endpoint — NEVER via
    // Supabase Auth (see the header comment — this is the load-bearing
    // security property of this whole file).
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`);
    if (!verifyRes.ok) return res.status(401).json({ error: 'Log masuk Google tidak sah' });
    const payload = await verifyRes.json();

    if (payload.aud !== googleClientId || payload.email_verified !== 'true' || !payload.email) {
        return res.status(401).json({ error: 'Log masuk Google tidak sah' });
    }

    const lookupRes = await fetch(
        `${supabaseUrl}/rest/v1/staff?email=ilike.${encodeURIComponent(payload.email)}` +
        `&select=id,full_name,enabled&limit=1`,
        { headers: sbHeaders }
    );
    if (!lookupRes.ok) return res.status(500).json({ error: 'Ralat pelayan' });
    const rows = await lookupRes.json();
    const staffRow = rows[0];

    if (!staffRow || !staffRow.enabled) {
        return res.status(401).json({ error: 'Akaun tidak didaftarkan' });
    }

    return finalizeLogin(res, supabaseUrl, sbHeaders, staffRow);
}

// Shared by both login paths. Identity proven via EITHER method resets
// failed_pin_attempts/locked_until too — proof of identity by any
// registered method clears unrelated-method failure counters, a
// deliberate decision, not an oversight.
async function finalizeLogin(res, supabaseUrl, sbHeaders, staffRow) {
    const token = crypto.randomUUID();
    const patchRes = await fetch(`${supabaseUrl}/rest/v1/staff?id=eq.${encodeURIComponent(staffRow.id)}`, {
        method: 'PATCH',
        headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({
            failed_pin_attempts: 0,
            locked_until: null,
            device_session_token: token,
            device_session_started_at: new Date().toISOString(),
        }),
    });
    if (!patchRes.ok) return res.status(500).json({ error: 'Ralat pelayan' });

    return res.status(200).json({
        token,
        staff: { id: staffRow.id, full_name: staffRow.full_name },
    });
}
