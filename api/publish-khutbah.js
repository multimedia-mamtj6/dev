// Vercel serverless function: automated khutbah pipeline, retiring the
// Google Sheet → Apps Script → CSV pipeline (khutbah/google_app_script/*.gs).
// That pipeline's bridge was a live Sheet formula (tajuk khutbah!A2 =
// 'link extractor'!A2) — any hand-correction replaced the formula with a
// plain value and silently broke automation; formula recalc never fires
// onEdit, so the cascade had to be a direct call. The manual_override flag
// below replaces that implicit formula/value distinction with an explicit
// lock. See khutbah/upgrade-plan.md + khutbah/DEV_NOTES.md.
//
// Automation-first: the Mon-9am cron computes next Friday, builds the mufti
// URL (Gregorian slug + Hijri via api.waktusolat.app/PHG03), scrapes date +
// title, upserts khutbah_weeks, and publishes khutbah/data/khutbah.json.
// Manual key-in is secondary: an admin edit sets manual_override=true and
// the cron skips that week (skipped_locked) until unlocked.
//
// Fail-safe (same rule as api/publish-news.js): NEVER publish an error
// string. On ANY failure the published JSON keeps last-good values; the
// error is recorded in scrape_error only, and an email alert goes out via
// the shared sender (admin/alert-send-pure.js, Resend).
//
// Dual auth, same shape as api/publish-news.js:
//   POST, Authorization: Bearer <supabase user JWT> — admin "Jana & Terbitkan"
//     click, validated against /auth/v1/user.
//   GET, Authorization: Bearer <CRON_SECRET> — Vercel cron (vercel.json),
//     actor_email = 'vercel-cron'. Fails closed if CRON_SECRET unset.
//
// Required Vercel env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GITHUB_TOKEN, GITHUB_REPO
// Optional (alerts degrade gracefully without them):
//   RESEND_API_KEY (shared sender), CRON_SECRET (GET path only)

const {
    getNextFriday,
    toISODate,
    formatGregorianDate,
    parseHijriSlug,
    buildMuftiLink,
    buildSiriText,
    extractDateTitle,
    buildKhutbahJson,
} = require('../admin/khutbah/publish-khutbah-pure.js');

const { parseRecipients, shouldAlert, sendAlert } = require('../admin/alert-send-pure.js');

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const KHUTBAH_JSON_FILE = 'khutbah/data/khutbah.json';
const WAKTUSOLAT_URL = 'https://api.waktusolat.app/v2/solat/PHG03';

async function fetchWithTimeout(url, ms, opts) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...(opts || {}), signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

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
        if (existingContent.trim() === newContent.trim()) return { unchanged: true };
    }
    const commitBody = { message: commitMessage, content: Buffer.from(newContent, 'utf8').toString('base64'), branch: 'main' };
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

async function logActivity(sbHeaders, supabaseUrl, entry) {
    try {
        await fetch(`${supabaseUrl}/rest/v1/khutbah_activity_log`, {
            method: 'POST',
            headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(entry),
        });
    } catch (e) {
        console.error('khutbah_activity_log insert failed:', e); // never blocks the response
    }
}

async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO;
    if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Server misconfiguration: missing Supabase env vars' });
    if (!githubToken || !githubRepo) return res.status(500).json({ error: 'Server misconfiguration: missing GitHub env vars' });

    let actorEmail, actorName = null;
    if (req.method === 'GET') {
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) return res.status(500).json({ error: 'Server misconfiguration: CRON_SECRET not set' });
        if (req.headers.authorization !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ error: 'Invalid cron credentials' });
        }
        actorEmail = 'vercel-cron';
    } else {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing Authorization header' });
        const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${authHeader.slice(7)}` },
        });
        if (!authCheck.ok) return res.status(401).json({ error: 'Invalid or expired session' });
        actorEmail = (await authCheck.json())?.email || null;
    }

    const sbHeaders = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Accept': 'application/json' };
    const ghHeaders = {
        'Authorization': `Bearer ${githubToken}`, 'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json',
    };

    if (actorEmail && actorEmail !== 'vercel-cron') {
        try {
            const adminRes = await fetch(
                `${supabaseUrl}/rest/v1/admins?select=name&email=ilike.${encodeURIComponent(actorEmail)}`,
                { headers: sbHeaders }
            );
            if (adminRes.ok) actorName = (await adminRes.json())[0]?.name || null;
        } catch (e) { console.error('admins name lookup failed:', e); }
    }

    // Settings (alert recipients/sender + spam-guard cache).
    const settingsRes = await fetch(`${supabaseUrl}/rest/v1/khutbah_settings?select=key,value`, { headers: sbHeaders });
    if (!settingsRes.ok) return res.status(500).json({ error: 'Failed to fetch khutbah_settings' });
    const settings = {};
    (await settingsRes.json()).forEach(r => { settings[r.key] = r.value; });

    const mytNow = new Date(Date.now() + MYT_OFFSET_MS);
    const friday = getNextFriday(mytNow);
    const fridayISO = toISODate(friday);
    const siriText = buildSiriText(friday);

    // Existing row for this Friday (drives locked-check + alert transition).
    let existing = null;
    try {
        const exRes = await fetch(
            `${supabaseUrl}/rest/v1/khutbah_weeks?friday_date=eq.${fridayISO}&select=*`,
            { headers: sbHeaders }
        );
        if (exRes.ok) existing = (await exRes.json())[0] || null;
    } catch (e) { console.error('khutbah_weeks lookup failed:', e); }

    async function publishCurrentJson(detail) {
        const allRes = await fetch(`${supabaseUrl}/rest/v1/khutbah_weeks?select=*`, { headers: sbHeaders });
        if (!allRes.ok) throw new Error(`Failed to fetch khutbah_weeks (status ${allRes.status})`);
        const jsonOut = buildKhutbahJson(await allRes.json());
        const commit = await pushJsonToGitHubIfChanged(ghHeaders, githubRepo, KHUTBAH_JSON_FILE, jsonOut,
            '[Admin] Terbitkan khutbah');
        await logActivity(sbHeaders, supabaseUrl, {
            actor_email: actorEmail || 'unknown', actor_name: actorName,
            action: 'publish_khutbah', target_label: fridayISO,
            detail: commit.unchanged ? `${detail} (tiada perubahan)` : detail,
        });
        return { commit, jsonOut };
    }

    async function maybeAlert(code, stepDetail) {
        // Spam guard: transition-only for this week + 24h throttle.
        const wasOk = !existing || existing.scrape_status === 'ok' || !existing.scrape_status;
        const throttleOk = shouldAlert(settings.last_alert_at, { throttleHours: 24 });
        const baseDetail = `${code}: ${stepDetail}`;
        if (!wasOk || !throttleOk) {
            await logActivity(sbHeaders, supabaseUrl, {
                actor_email: actorEmail || 'unknown', actor_name: actorName,
                action: 'khutbah_scrape_failed', target_label: fridayISO,
                detail: `${baseDetail} (alert_suppressed)`,
            });
            return { sent: false, reason: 'alert_suppressed' };
        }
        const to = parseRecipients(settings.alert_emails || '');
        const result = await sendAlert({
            to,
            subject: `[Khutbah] Gagal — Jumaat ${fridayISO} (${code})`,
            text: [
                `Jumaat: ${fridayISO} (${siriText})`,
                `Kegagalan: ${baseDetail}`,
                `URL dicuba: ${buildMuftiLinkAttempt || '-'}`,
                `Tajuk terakhir baik: ${existing?.title || '-'}`,
                `Semak: /admin/khutbah/senarai.html`,
            ].join('\n'),
        }, { apiKey: process.env.RESEND_API_KEY, from: settings.alert_from });
        // Write back the spam-guard cache (never blocks).
        try {
            const nowIso = new Date().toISOString();
            for (const [key, value] of [['last_alert_at', nowIso], ['last_alert_reason', code]]) {
                await fetch(`${supabaseUrl}/rest/v1/khutbah_settings?key=eq.${key}`, {
                    method: 'PATCH',
                    headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                    body: JSON.stringify({ value, updated_at: nowIso }),
                });
            }
        } catch (e) { console.error('khutbah_settings alert cache write failed:', e); }
        await logActivity(sbHeaders, supabaseUrl, {
            actor_email: actorEmail || 'unknown', actor_name: actorName,
            action: 'khutbah_scrape_failed', target_label: fridayISO,
            detail: `${baseDetail} (${result.sent ? 'alert_sent' : result.reason})`,
        });
        return result;
    }

    // Locked row: explicit manual override — skip scrape AND alert entirely.
    if (existing?.manual_override) {
        const { commit } = await publishCurrentJson('Langkau (kunci manual)');
        await logActivity(sbHeaders, supabaseUrl, {
            actor_email: actorEmail || 'unknown', actor_name: actorName,
            action: 'khutbah_auto_generate', target_label: fridayISO,
            detail: 'skipped_locked — manual_override=true',
        });
        return res.status(200).json({ success: true, friday_date: fridayISO, skipped: 'locked', unchanged: !!commit.unchanged });
    }

    let buildMuftiLinkAttempt = null;

    // Step 1: Hijri via waktusolat (PHG03, day-match like GAS getHijriDate).
    let hijriSlug = null;
    try {
        const hijriRes = await fetchWithTimeout(WAKTUSOLAT_URL, 8000);
        if (!hijriRes.ok) throw new Error(`waktusolat status ${hijriRes.status}`);
        const data = await hijriRes.json();
        const match = (data.prayers || []).find(p => p.day === friday.getDate());
        if (!match?.hijri) throw new Error(`no prayers entry for day ${friday.getDate()}`);
        hijriSlug = parseHijriSlug(match.hijri);
        if (!hijriSlug) throw new Error(`unparseable hijri "${match.hijri}"`);
    } catch (e) {
        const msg = `Hijri gagal: ${e.message}`;
        await upsertWeek(sbHeaders, supabaseUrl, existing, {
            friday_date: fridayISO, source_url: buildMuftiLinkAttempt || existing?.source_url || '',
            siri_text: siriText, scrape_status: 'fetch_failed', scrape_error: msg, fetched_at: new Date().toISOString(),
        });
        const alert = await maybeAlert('HIJRI_FAIL', msg);
        try { await publishCurrentJson(`Kegagalan hijri (${alert.sent ? 'alert dihantar' : alert.reason})`); } catch (e2) { /* log below */ }
        return res.status(500).json({ success: false, friday_date: fridayISO, error: msg, alert: alert.reason });
    }

    // Step 2: build link, fetch mufti page.
    buildMuftiLinkAttempt = buildMuftiLink(friday, hijriSlug);
    let html = null;
    try {
        const muftiRes = await fetchWithTimeout(buildMuftiLinkAttempt, 12000);
        if (!muftiRes.ok) throw new Error(`HTTP ${muftiRes.status}`);
        html = await muftiRes.text();
    } catch (e) {
        const code = /HTTP (\d+)/.test(e.message) ? `HTTP_${e.message.match(/HTTP (\d+)/)[1]}` : 'FETCH_FAIL';
        const msg = `Mufti gagal: ${e.message} — ${buildMuftiLinkAttempt}`;
        await upsertWeek(sbHeaders, supabaseUrl, existing, {
            friday_date: fridayISO, source_url: buildMuftiLinkAttempt, siri_text: siriText,
            gregorian_part: formatGregorianDate(friday), hijri_part: hijriSlug,
            scrape_status: 'fetch_failed', scrape_error: msg, fetched_at: new Date().toISOString(),
        });
        const alert = await maybeAlert(code, msg);
        try { await publishCurrentJson(`Kegagalan fetch (${alert.sent ? 'alert dihantar' : alert.reason})`); } catch (e2) {
            return res.status(500).json({ success: false, friday_date: fridayISO, error: `${msg}; publish juga gagal: ${e2.message}` });
        }
        return res.status(500).json({ success: false, friday_date: fridayISO, error: msg, alert: alert.reason });
    }

    // Step 3: regex extract (primary + fallback; miss → parse_failed, keep last-good).
    const { dateText, titleText, dateMatched, titleMatched } = extractDateTitle(html);
    if (!dateText || !titleText) {
        const msg = `Parse gagal (date:${dateMatched} title:${titleMatched}) — ${buildMuftiLinkAttempt}`;
        await upsertWeek(sbHeaders, supabaseUrl, existing, {
            friday_date: fridayISO, source_url: buildMuftiLinkAttempt, siri_text: siriText,
            gregorian_part: formatGregorianDate(friday), hijri_part: hijriSlug,
            scrape_status: 'parse_failed', scrape_error: msg, fetched_at: new Date().toISOString(),
        });
        const alert = await maybeAlert('PARSE_FAIL', msg);
        try { await publishCurrentJson(`Kegagalan parse (${alert.sent ? 'alert dihantar' : alert.reason})`); } catch (e2) {
            return res.status(500).json({ success: false, friday_date: fridayISO, error: `${msg}; publish juga gagal: ${e2.message}` });
        }
        return res.status(500).json({ success: false, friday_date: fridayISO, error: msg, alert: alert.reason });
    }

    // Success: upsert scraped values (title/date refreshed, main_text preserved —
    // the mufti page has no theme-text field; main_text is manual-only).
    await upsertWeek(sbHeaders, supabaseUrl, existing, {
        friday_date: fridayISO, source_url: buildMuftiLinkAttempt, siri_text: siriText,
        title: titleText, date_text: dateText,
        gregorian_part: formatGregorianDate(friday), hijri_part: hijriSlug,
        scrape_status: 'ok', scrape_error: null, fetched_at: new Date().toISOString(),
    });
    const { commit } = await publishCurrentJson(`"${titleText}" (date:${dateMatched} title:${titleMatched})`);
    await logActivity(sbHeaders, supabaseUrl, {
        actor_email: actorEmail || 'unknown', actor_name: actorName,
        action: 'khutbah_scrape_ok', target_label: fridayISO,
        detail: `"${titleText}" — ${buildMuftiLinkAttempt}`,
    });
    return res.status(200).json({
        success: true, friday_date: fridayISO, title: titleText, date_text: dateText,
        siri_text: siriText, source_url: buildMuftiLinkAttempt,
        dateMatched, titleMatched, unchanged: !!commit.unchanged,
    });
}

async function upsertWeek(sbHeaders, supabaseUrl, existing, row) {
    const nowIso = new Date().toISOString();
    const payload = { ...row, updated_at: nowIso };
    if (existing) {
        // Preserve title/date_text/main_text on failure paths (caller omits them).
        const res = await fetch(`${supabaseUrl}/rest/v1/khutbah_weeks?friday_date=eq.${row.friday_date}`, {
            method: 'PATCH',
            headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`upsert PATCH failed (status ${res.status})`);
    } else {
        const res = await fetch(`${supabaseUrl}/rest/v1/khutbah_weeks`, {
            method: 'POST',
            headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`upsert POST failed (status ${res.status})`);
    }
}

module.exports = handler;
