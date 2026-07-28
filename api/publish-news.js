// Vercel serverless function: publishes news/data/announcements.json and
// news/data/moving-text.json from Supabase (news_announcements/news_ticker),
// retiring the old Google Sheet → Apps Script → GitHub pipeline
// (news/moving-text/code.gs). That pipeline did NO validation of any kind —
// it forwarded whatever was in a Sheet cell straight to the live ticker,
// which is how "ERROR: Failed to fetch the webpage. Status: 503" ended up
// scrolling across the prayer hall for 3 weeks (see news/newplan.md). The
// khutbah-resolution fail-safe below is the point of this rewrite, not a
// detail of it — never interpolate an error/status string into a published
// line.
//
// Two publish targets, independently triggerable:
//   ?target=announcements → news/data/announcements.json  (our news/script.js
//                            resolves scheduling client-side, on the display's
//                            own clock — rows are published as-is, filtered
//                            only by `enabled`)
//   ?target=moving-text    → news/data/moving-text.json    (read DIRECTLY by
//                            Xibo's DataSet widget, no JS of ours runs there —
//                            scheduling MUST be resolved here, server-side,
//                            at publish time; see buildMovingTextJson())
//
// Dual auth, unlike api/publish-infaq.js:
//   POST ?target=... , Authorization: Bearer <supabase user JWT> — the normal
//     admin-dashboard "Terbitkan" click, validated against /auth/v1/user
//     exactly like api/publish.js / api/publish-infaq.js. Publishes ONE target.
//   GET, Authorization: Bearer <CRON_SECRET> — the Vercel cron path (see
//     vercel.json). Publishes BOTH targets, actor_email = 'vercel-cron'.
//     Fails closed: if CRON_SECRET isn't set in the environment, every GET
//     is rejected rather than defaulting open.
//
// Required Vercel environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GITHUB_TOKEN, GITHUB_REPO
//     (same ones api/publish.js / api/publish-infaq.js already use)
//   CRON_SECRET (new — shared secret for the GET/cron path only)

// Pure scheduling/CSV builders live in admin/news/publish-news-pure.js, NOT
// in this file — that module has zero Node/Vercel dependency, so it doubles
// as the ticker preview panel's logic via a plain <script src> in
// admin/news/teks-berjalan.html. A file under api/ can't fill that second
// role: any GET to it is routed to this live serverless function, not
// served as source. See that file's own header for the full reasoning.
const {
    parseCSVRow,
    looksLikeErrorText,
    mytDateString,
    isActiveNow,
    buildAnnouncementsJson,
    buildMovingTextJson,
} = require('../admin/news/publish-news-pure.js');

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // Malaysia is UTC+8, no DST

const TARGETS = {
    announcements: { file: 'news/data/announcements.json', commitMessage: '[Admin] Terbitkan pengumuman',   action: 'publish_announcements' },
    'moving-text': { file: 'news/data/moving-text.json',   commitMessage: '[Admin] Terbitkan teks berjalan', action: 'publish_moving_text' },
};

const TARGET_LABELS = { announcements: 'Pengumuman', 'moving-text': 'Teks Berjalan' };

// ── Non-pure helpers (network I/O — not exported, same split as
// api/publish-infaq.js's pushJsonToGitHub) ──────────────────────────────────

async function fetchKhutbahTitle(csvUrl) {
    if (!csvUrl) return null;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        let res;
        try {
            res = await fetch(csvUrl, { signal: controller.signal });
        } finally {
            clearTimeout(timeout);
        }
        if (!res.ok) return null;

        const text = await res.text();
        const rows = text.split('\n').filter(line => line.length > 0).map(parseCSVRow);
        if (rows.length <= 1) return null; // header only, or genuinely empty

        const title = (rows[1][1] || '').trim();
        if (!title || looksLikeErrorText(title)) return null;
        return title;
    } catch (e) {
        return null; // network error, timeout/abort, malformed response — all fail the same way: fall back
    }
}

// Fail-safe khutbah resolution: on ANY failure (non-200, timeout, empty
// sheet, unparseable, or an error-smelling value), falls back to the last
// known-good title cached in news_settings.khutbah_last_title instead of
// ever publishing the failure itself — exactly the gate the old pipeline
// never had (see file header). On success, also writes the new title back
// to that cache so the NEXT failure has something to fall back to. Returns
// null only when there is truly nothing usable, current or cached —
// buildMovingTextJson then omits the khutbah row entirely.
async function resolveKhutbahTitle(csvUrl, lastGoodTitle, sbHeaders, supabaseUrl) {
    const fresh = await fetchKhutbahTitle(csvUrl);
    if (!fresh) return lastGoodTitle || null;

    try {
        const nowIso = new Date().toISOString();
        await fetch(`${supabaseUrl}/rest/v1/news_settings?key=eq.khutbah_last_title`, {
            method: 'PATCH',
            headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ value: fresh, updated_at: nowIso }),
        });
        await fetch(`${supabaseUrl}/rest/v1/news_settings?key=eq.khutbah_last_fetched_at`, {
            method: 'PATCH',
            headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ value: nowIso, updated_at: nowIso }),
        });
    } catch (e) {
        console.error('news_settings khutbah cache write failed:', e); // never blocks the publish
    }
    return fresh;
}

// GET-sha-then-PUT against the GitHub Contents API, same pattern as
// api/publish.js / api/publish-infaq.js — but skips the PUT entirely (and
// returns { unchanged: true }) when the new content is byte-identical to
// what's already committed. Without this, the daily cron manufactures a
// commit every single day regardless of whether anything actually changed —
// exactly the noise the old pipeline's weekly "Update ticker: ..." commits
// created.
async function pushJsonToGitHubIfChanged(ghHeaders, githubRepo, filePath, jsonObj, commitMessage) {
    const contentsRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, { headers: ghHeaders });
    if (!contentsRes.ok && contentsRes.status !== 404) {
        throw new Error(`Failed to read ${filePath} from GitHub (status ${contentsRes.status})`);
    }

    const newContent = JSON.stringify(jsonObj, null, 2);
    let currentSha;
    if (contentsRes.ok) {
        const contentsJson = await contentsRes.json();
        currentSha = contentsJson.sha;
        const existingContent = Buffer.from(contentsJson.content, 'base64').toString('utf8');
        if (existingContent.trim() === newContent.trim()) {
            return { unchanged: true };
        }
    }

    const commitBody = {
        message: commitMessage,
        content: Buffer.from(newContent, 'utf8').toString('base64'),
        branch: 'main',
    };
    if (currentSha) commitBody.sha = currentSha;

    const putRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, {
        method: 'PUT', headers: ghHeaders, body: JSON.stringify(commitBody),
    });
    if (!putRes.ok) {
        const errData = await putRes.json().catch(() => ({}));
        throw new Error(`Failed to push ${filePath}: ${errData.message || putRes.statusText}`);
    }
    return await putRes.json();
}

async function publishOneTarget(target, ctx) {
    const { supabaseUrl, sbHeaders, ghHeaders, githubRepo, settings, mytNow, actorEmail, actorName } = ctx;
    const { file, commitMessage, action } = TARGETS[target];

    let jsonOut, activityDetail;

    if (target === 'announcements') {
        const rowsRes = await fetch(`${supabaseUrl}/rest/v1/news_announcements?select=*`, { headers: sbHeaders });
        if (!rowsRes.ok) throw new Error(`Failed to fetch news_announcements (status ${rowsRes.status})`);
        const rows = await rowsRes.json();

        jsonOut = buildAnnouncementsJson(rows, settings);
        activityDetail = `${jsonOut.announcements.length} pengumuman diterbitkan`;
    } else {
        const rowsRes = await fetch(`${supabaseUrl}/rest/v1/news_ticker?select=*`, { headers: sbHeaders });
        if (!rowsRes.ok) throw new Error(`Failed to fetch news_ticker (status ${rowsRes.status})`);
        const rows = await rowsRes.json();

        // Only bother fetching the khutbah CSV if a khutbah row could
        // actually be active — the common case (no khutbah row, or it's
        // disabled) shouldn't pay for a network round-trip it won't use.
        let khutbahTitle = null;
        if (rows.some(r => r.kind === 'khutbah' && isActiveNow(r, mytNow))) {
            khutbahTitle = await resolveKhutbahTitle(settings.khutbah_csv_url, settings.khutbah_last_title, sbHeaders, supabaseUrl);
        }

        jsonOut = buildMovingTextJson(rows, settings, khutbahTitle, mytNow);
        activityDetail = `${jsonOut['moving-text'].length} baris teks berjalan diterbitkan`;
    }

    const commit = await pushJsonToGitHubIfChanged(ghHeaders, githubRepo, file, jsonOut, commitMessage);

    // Activity log write never blocks the publish response.
    try {
        await fetch(`${supabaseUrl}/rest/v1/news_activity_log`, {
            method: 'POST',
            headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({
                actor_email:  actorEmail || 'unknown',
                actor_name:   actorName,
                action,
                target_label: TARGET_LABELS[target],
                detail:       commit.unchanged ? `${activityDetail} (tiada perubahan)` : activityDetail,
            }),
        });
    } catch (e) {
        console.error('news_activity_log insert failed:', e);
    }

    return { success: true, target, unchanged: !!commit.unchanged, commitUrl: commit.commit?.html_url ?? null };
}

async function handler(req, res) {
    // ── CORS ────────────────────────────────────────────────────────────────
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const supabaseUrl  = process.env.SUPABASE_URL;
    const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const githubToken  = process.env.GITHUB_TOKEN;
    const githubRepo   = process.env.GITHUB_REPO;
    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'Server misconfiguration: missing Supabase env vars' });
    }
    if (!githubToken || !githubRepo) {
        return res.status(500).json({ error: 'Server misconfiguration: missing GitHub env vars' });
    }

    let targets, actorEmail, actorName = null;

    if (req.method === 'GET') {
        // Vercel cron path (see vercel.json) — publishes BOTH targets in one
        // request. Fail closed: a missing CRON_SECRET must never be silently
        // equivalent to "no auth required".
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            return res.status(500).json({ error: 'Server misconfiguration: CRON_SECRET not set' });
        }
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ error: 'Invalid cron credentials' });
        }
        targets = Object.keys(TARGETS);
        actorEmail = 'vercel-cron';
    } else {
        const target = req.query.target;
        if (!TARGETS[target]) {
            return res.status(400).json({ error: 'Missing or invalid target — expected ?target=announcements|moving-text' });
        }
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing Authorization header' });
        }
        const userJwt = authHeader.slice(7);
        const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${userJwt}` },
        });
        if (!authCheck.ok) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
        const authUser = await authCheck.json();
        actorEmail = authUser?.email || null;
        targets = [target];
    }

    const sbHeaders = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Accept': 'application/json' };
    const ghHeaders = {
        'Authorization':        `Bearer ${githubToken}`,
        'Accept':               'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type':         'application/json',
    };

    if (actorEmail && actorEmail !== 'vercel-cron') {
        const adminRes = await fetch(
            `${supabaseUrl}/rest/v1/admins?select=name&email=ilike.${encodeURIComponent(actorEmail)}`,
            { headers: sbHeaders }
        );
        if (adminRes.ok) {
            actorName = (await adminRes.json())[0]?.name || null;
        } else {
            console.error('admins name lookup failed:', adminRes.status, await adminRes.text().catch(() => ''));
        }
    }

    const settingsRes = await fetch(`${supabaseUrl}/rest/v1/news_settings?select=key,value`, { headers: sbHeaders });
    if (!settingsRes.ok) {
        return res.status(500).json({ error: 'Failed to fetch news_settings', details: await settingsRes.text() });
    }
    const settings = {};
    (await settingsRes.json()).forEach(r => { settings[r.key] = r.value; });

    const mytNow = new Date(Date.now() + MYT_OFFSET_MS);
    const ctx = { supabaseUrl, sbHeaders, ghHeaders, githubRepo, settings, mytNow, actorEmail, actorName };

    const results = {};
    for (const target of targets) {
        try {
            results[target] = await publishOneTarget(target, ctx);
        } catch (e) {
            results[target] = { success: false, target, error: e.message };
        }
    }

    if (targets.length === 1) {
        const only = results[targets[0]];
        return res.status(only.success ? 200 : 500).json(only);
    }

    const anyFailed = Object.values(results).some(r => !r.success);
    return res.status(anyFailed ? 500 : 200).json({ success: !anyFailed, results });
}

// module.exports itself is the request handler, with the pure builders
// re-exported as properties (same convention as api/publish.js /
// api/publish-infaq.js) — api/publish-news.test.js imports them from here.
module.exports = handler;
module.exports.parseCSVRow            = parseCSVRow;
module.exports.looksLikeErrorText     = looksLikeErrorText;
module.exports.mytDateString          = mytDateString;
module.exports.isActiveNow            = isActiveNow;
module.exports.buildAnnouncementsJson = buildAnnouncementsJson;
module.exports.buildMovingTextJson    = buildMovingTextJson;
