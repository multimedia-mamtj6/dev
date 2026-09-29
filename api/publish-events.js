// Vercel serverless function: POST /api/publish-events
// Publishes calendar/hijri/data/events.json to GitHub.
// Migrated from shared PIN (EVENTS_ADMIN_PIN) to Supabase Auth (Bearer JWT),
// same shape as api/publish.js — admin/calendar/senarai.html calls this with
// the admin's session token. Permission enforced server-side on
// admins.role/permissions.kalendar (viewer always denied).
//
// Required Vercel environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GITHUB_TOKEN, GITHUB_REPO

const FILE_PATH = 'calendar/hijri/data/events.json';

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
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO;
    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'Server misconfiguration: missing Supabase env vars' });
    }
    if (!githubToken || !githubRepo) {
        return res.status(500).json({ error: 'Server misconfiguration: missing GitHub env vars' });
    }

    // ── 1. Verify Supabase session ──────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Missing Authorization header' });
    }
    const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${authHeader.slice(7)}` },
    });
    if (!authCheck.ok) {
        return res.status(401).json({ success: false, message: 'Invalid or expired session' });
    }
    const actorEmail = (await authCheck.json())?.email || null;

    const sbHeaders = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Accept': 'application/json' };

    // ── 2. Permission check: super_admin or editor with permissions.kalendar ─
    let actorName = null;
    try {
        const adminRes = await fetch(
            `${supabaseUrl}/rest/v1/admins?select=name,role,permissions&email=ilike.${encodeURIComponent(actorEmail)}`,
            { headers: sbHeaders }
        );
        if (!adminRes.ok) return res.status(403).json({ success: false, message: 'Akses ditolak.' });
        const admin = (await adminRes.json())[0];
        actorName = admin?.name || null;
        const allowed = admin?.role === 'super_admin'
            || (admin?.role === 'editor' && admin?.permissions?.kalendar === true);
        if (!allowed) return res.status(403).json({ success: false, message: 'Akses ditolak. Anda tiada kebenaran modul kalendar.' });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Semakan kebenaran gagal.' });
    }

    // ── 3. Validate payload ─────────────────────────────────────────────────
    const { events } = req.body || {};
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
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
    };

    try {
        const commit = await pushJsonToGitHub(ghHeaders, githubRepo, FILE_PATH, jsonOut, `[Admin] Kemas kini tarikh penting - ${now.toISOString()}`);
        try {
            await fetch(`${supabaseUrl}/rest/v1/calendar_activity_log`, {
                method: 'POST',
                headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify({
                    actor_email: actorEmail || 'unknown',
                    actor_name: actorName,
                    action: 'publish_calendar',
                    target_label: `${sorted.length} acara`,
                    detail: `Diterbitkan ${sorted.length} acara. lastUpdated: ${lastUpdated}`,
                }),
            });
        } catch (e) { console.error('calendar_activity_log insert failed:', e); }
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
