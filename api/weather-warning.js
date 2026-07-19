// Vercel serverless function: GET /api/weather-warning
// Read-only proxy for MET Malaysia's continuous-rain (Hujan Berterusan)
// warning dataset. Exists because metapi2 requires a METToken header —
// a personal registered credential that must NEVER ship in browser code
// (same secret class as SUPABASE_SERVICE_ROLE_KEY). CORS is not the
// blocker (metapi2 sends Access-Control-Allow-Origin: *); the token is.
//
// Required Vercel environment variable (Dashboard → Project → Settings →
// Environment Variables):
//   MET_TOKEN — MET API v2.1 access token (the part after "METToken " in
//               the Authorization header). Also lives in the Telegram
//               bot's Apps Script Script Properties once that exists —
//               rotating the token means updating BOTH places.
//
// data.gov.my (token-free) remains the page's thunderstorm source; this
// proxy covers ONLY datacategoryid=RAIN, which data.gov.my has been
// observed not to mirror (live gap verified 2026-07-18). Keeping the two
// sources disjoint by warning type avoids any cross-source dedup problem.

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // Malaysia is UTC+8, no DST

// MET requires BOTH start_date and end_date (400 without them). The RAIN
// dataset returns the current bulletin when queried for "today" — compute
// today in Malaysia time explicitly, since Vercel runs in UTC and a naive
// server-local date is yesterday's date for 8 hours every night.
function todayInMalaysia() {
    return new Date(Date.now() + MYT_OFFSET_MS).toISOString().slice(0, 10);
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = process.env.MET_TOKEN;
    if (!token) {
        return res.status(500).json({ error: 'Server misconfiguration: missing MET_TOKEN env var' });
    }

    const d = todayInMalaysia();
    const url = `https://metapi2.met.gov.my/api/v2.1/data?datasetid=WARNING&datacategoryid=RAIN&start_date=${d}&end_date=${d}`;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const metRes = await fetch(url, {
            headers: { Authorization: `METToken ${token}` },
            signal: controller.signal,
        }).finally(() => clearTimeout(timer));

        if (!metRes.ok) {
            return res.status(502).json({ error: `MET API returned HTTP ${metRes.status}` });
        }

        const data = await metRes.json();

        // Vercel edge cache: repeat visitor polls are served from cache
        // without invoking this function or spending MET quota — also the
        // mitigation for strangers calling this public endpoint directly.
        res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=60');
        return res.status(200).json(data);
    } catch (e) {
        // Timeout/network failure — the page treats this the same as any
        // warning-fetch failure (keeps last known state, no error banner).
        return res.status(502).json({ error: 'MET API unreachable or timed out' });
    }
};
