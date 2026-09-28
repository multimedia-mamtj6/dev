// Vercel serverless function: preview-only URL tester for the khutbah module.
// Paste a corrected mufti.pahang.gov.my URL in admin/khutbah/senarai.html,
// fetch it server-side (mufti CORS blocks direct browser fetch), extract
// date + title with the same regexes as the cron pipeline, and return them
// WITHOUT writing anything — no DB upsert, no JSON publish, no mail.
// The admin reviews the filled modal fields and clicks Simpan
// (manual_override=true), then Jana & Terbitkan.
//
// POST-only, Supabase JWT auth (same shape as api/publish-khutbah.js POST
// path). No CRON_SECRET GET path — cron never calls this.
//
// Body: { url } (JSON) — req.query.url accepted as fallback.
// Success: 200 { success:true, title, date_text, dateMatched, titleMatched, source_url }
// Failure: 4xx/5xx { success:false, code, error } where code is one of
//   INVALID_URL | FETCH_FAIL | HTTP_404 | PARSE_FAIL
const { extractDateTitle } = require('../admin/khutbah/publish-khutbah-pure.js');

async function fetchWithTimeout(url, ms) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'MAMTJ6-khutbah-test/1.0' },
        });
    } finally {
        clearTimeout(timeout);
    }
}

async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED', error: 'Method not allowed — POST only' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ success: false, code: 'MISCONFIG', error: 'Server misconfiguration: missing Supabase env vars' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, code: 'NO_AUTH', error: 'Missing Authorization header' });
    }
    const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${authHeader.slice(7)}` },
    });
    if (!authCheck.ok) {
        return res.status(401).json({ success: false, code: 'NO_AUTH', error: 'Invalid or expired session' });
    }

    let rawUrl = (req.body && req.body.url) || req.query.url || '';
    if (typeof rawUrl !== 'string') rawUrl = '';
    const url = rawUrl.trim();
    if (!url || !/^https:\/\/mufti\.pahang\.gov\.my\/khutbah\//i.test(url)) {
        return res.status(400).json({
            success: false, code: 'INVALID_URL',
            error: 'URL tidak sah — mesti https://mufti.pahang.gov.my/khutbah/...',
        });
    }

    let html;
    try {
        const muftiRes = await fetchWithTimeout(url, 12000);
        if (!muftiRes.ok) {
            const code = muftiRes.status === 404 ? 'HTTP_404' : `HTTP_${muftiRes.status}`;
            return res.status(500).json({ success: false, code, error: `Gagal memuatkan halaman (${muftiRes.status}) — ${url}` });
        }
        html = await muftiRes.text();
    } catch (e) {
        return res.status(500).json({ success: false, code: 'FETCH_FAIL', error: `Gagal mencapai URL: ${e.message} — ${url}` });
    }

    const { dateText, titleText, dateMatched, titleMatched } = extractDateTitle(html);
    if (!dateText || !titleText) {
        return res.status(500).json({
            success: false, code: 'PARSE_FAIL',
            error: `Parse gagal (tarikh:${dateMatched} tajuk:${titleMatched}) — struktur halaman mufti mungkin berubah.`,
            dateMatched, titleMatched,
        });
    }

    return res.status(200).json({
        success: true, title: titleText, date_text: dateText,
        dateMatched, titleMatched, source_url: url,
    });
}

module.exports = handler;
