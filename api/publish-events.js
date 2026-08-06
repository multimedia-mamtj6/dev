// Vercel serverless function: POST /api/publish-events
// Publishes calendar/hijri/data/events.json to GitHub. Replaces the old
// Google Apps Script backend (calendar/hijri/data/code.gs) — the admin
// panel (calendar/hijri/data/index.html) now calls this directly via
// fetch() instead of google.script.run, so it's a normal static page
// again instead of requiring a separate Apps Script deployment.
//
// Auth: a single shared PIN (EVENTS_ADMIN_PIN), same trust model as the
// old Code.gs's Script Properties PIN — this is a single-admin page, not
// per-user like admin/'s Supabase-authenticated modules, so there's no
// user identity to check beyond the PIN.
//
// Required Vercel environment variables:
//   GITHUB_TOKEN, GITHUB_REPO (same ones every other api/ endpoint in
//     this repo already uses)
//   EVENTS_ADMIN_PIN (new — replaces Code.gs's Script Properties PIN)

const crypto = require('crypto');

const FILE_PATH = 'calendar/hijri/data/events.json';

// Constant-time compare so response timing can't leak how much of the PIN
// was guessed correctly — the old Code.gs used a plain !==.
function pinMatches(submitted, expected) {
    const a = Buffer.from(String(submitted));
    const b = Buffer.from(String(expected));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

async function pushJsonToGitHub(ghHeaders, githubRepo, filePath, jsonObj, commitMessage) {
    const contentsRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, { headers: ghHeaders });
    if (!contentsRes.ok && contentsRes.status !== 404) {
        throw new Error(`Failed to read ${filePath} from GitHub (status ${contentsRes.status})`);
    }
    let currentSha;
    if (contentsRes.ok) {
        currentSha = (await contentsRes.json()).sha;
    }

    const commitBody = {
        message: commitMessage,
        content: Buffer.from(JSON.stringify(jsonObj, null, 2), 'utf8').toString('base64'),
        branch: 'main',
    };
    if (currentSha) commitBody.sha = currentSha;

    const putRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, {
        method: 'PUT', headers: ghHeaders, body: JSON.stringify(commitBody),
    });
    if (!putRes.ok) {
        const errData = await putRes.json().catch(() => ({}));
        throw new Error(errData.message || putRes.statusText);
    }
    return putRes.json();
}

module.exports = async function handler(req, res) {
    // ── CORS ────────────────────────────────────────────────────────────────
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const expectedPin = process.env.EVENTS_ADMIN_PIN;
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo  = process.env.GITHUB_REPO;
    if (!expectedPin || !githubToken || !githubRepo) {
        return res.status(500).json({ error: 'Server misconfiguration: missing environment variables' });
    }

    const { events, pin } = req.body || {};
    if (!pin || !pinMatches(pin, expectedPin)) {
        return res.status(401).json({ success: false, message: 'PIN tidak sah. Data tidak disimpan.' });
    }
    if (!Array.isArray(events)) {
        return res.status(400).json({ success: false, message: 'Data acara tidak sah.' });
    }
    for (const e of events) {
        if (typeof e.eventName !== 'string' || typeof e.eventDate !== 'string' || typeof e.hijriDate !== 'string') {
            return res.status(400).json({ success: false, message: 'Setiap acara mesti mempunyai eventName, eventDate dan hijriDate.' });
        }
    }

    const sorted = events.slice().sort((a, b) => {
        if (!a.eventDate || !b.eventDate) return 0;
        return new Date(a.eventDate) - new Date(b.eventDate);
    });

    const now = new Date();
    const lastUpdated = `${now.toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' })}, ` +
        `${now.toLocaleTimeString('ms-MY', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kuala_Lumpur' })}`;

    const jsonOut = { lastUpdated, events: sorted };

    const ghHeaders = {
        'Authorization':        `Bearer ${githubToken}`,
        'Accept':               'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type':         'application/json',
    };

    try {
        const commit = await pushJsonToGitHub(ghHeaders, githubRepo, FILE_PATH, jsonOut, `[Admin] Kemas kini tarikh penting - ${now.toISOString()}`);
        return res.status(200).json({
            success: true,
            message: 'Data berjaya disimpan ke GitHub!',
            commitUrl: commit.commit?.html_url ?? null,
            lastUpdated,
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: `Ralat semasa proses menyimpan: ${e.message}` });
    }
};
