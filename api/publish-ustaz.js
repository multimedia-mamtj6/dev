// Vercel serverless function: POST /api/publish-ustaz
// Reads the ustaz registry from Supabase and publishes the public
// penceramah directory to kuliah/data/penceramah.json (separate file —
// never merged into jadual_lengkap_v2.json).
//
// Required Vercel environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GITHUB_TOKEN, GITHUB_REPO

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

    // ── 1. Verify Supabase session ──────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing Authorization header' });
    }
    const userJwt = authHeader.slice(7);

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'Server misconfiguration: missing Supabase env vars' });
    }

    const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${userJwt}` },
    });
    if (!authCheck.ok) {
        return res.status(401).json({ error: 'Invalid or expired session' });
    }
    const authUser   = await authCheck.json();
    const actorEmail = authUser?.email || null;

    // ── 2. Fetch ustaz registry ─────────────────────────────────────────
    const ustazRes = await fetch(
        `${supabaseUrl}/rest/v1/ustaz?select=id,full_name,short_name,jawatan,tajuk_kuliah,profile_url,is_public&order=short_name`,
        {
            headers: {
                'apikey':        serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Accept':        'application/json',
            },
        }
    );
    if (!ustazRes.ok) {
        const err = await ustazRes.text();
        return res.status(500).json({ error: 'Failed to fetch ustaz from Supabase', status: ustazRes.status, details: err });
    }
    const ustazList = await ustazRes.json();

    // Numeric-aware sort in JS (Postgres orders lexicographically — "10" < "2").
    // Rows with is_public === false are excluded here, so they never reach
    // the public JSON at all (NULL counts as public — pre-flag rows stay visible).
    const sorted = (Array.isArray(ustazList) ? ustazList : [])
        .filter(u => u.is_public !== false)
        .sort((a, b) =>
            String(a.short_name || '').localeCompare(String(b.short_name || ''), undefined, { numeric: true, sensitivity: 'base' })
        );

    const penceramah = sorted.map(u => ({
        id:           u.id,
        full_name:    u.full_name,
        jawatan:      u.jawatan || null,
        tajuk_kuliah: u.tajuk_kuliah || null,
        profile_url:  u.profile_url || null,
    }));

    const now = new Date(Date.now() + 8 * 60 * 60 * 1000); // MYT
    const jsonContent = JSON.stringify({
        tarikhKemasKini: `${now.getUTCDate()}/${now.getUTCMonth() + 1}/${now.getUTCFullYear()}`,
        count: penceramah.length,
        penceramah,
    }, null, 2);

    // ── 3. Push to GitHub ───────────────────────────────────────────────
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo  = process.env.GITHUB_REPO;
    if (!githubToken || !githubRepo) {
        return res.status(500).json({ error: 'Server misconfiguration: missing GitHub env vars' });
    }

    const filePath  = 'kuliah/data/penceramah.json';
    const ghHeaders = {
        'Authorization':        `Bearer ${githubToken}`,
        'Accept':               'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type':         'application/json',
    };

    const contentsRes = await fetch(
        `https://api.github.com/repos/${githubRepo}/contents/${filePath}`,
        { headers: ghHeaders }
    );
    if (!contentsRes.ok && contentsRes.status !== 404) {
        return res.status(500).json({ error: 'Failed to read current file from GitHub', status: contentsRes.status });
    }

    let currentSha;
    if (contentsRes.ok) {
        const fileData = await contentsRes.json();
        currentSha = fileData.sha;
        // Skip empty commits when nothing changed.
        if (fileData.content) {
            const existing = Buffer.from(fileData.content, 'base64').toString('utf8');
            if (existing === jsonContent) {
                return res.status(200).json({ success: true, skipped: true, published: { count: penceramah.length } });
            }
        }
    }

    const commitBody = {
        message: '[Admin] Terbitkan penceramah',
        content: Buffer.from(jsonContent, 'utf8').toString('base64'),
        branch:  'main',
    };
    if (currentSha) commitBody.sha = currentSha;

    const updateRes = await fetch(
        `https://api.github.com/repos/${githubRepo}/contents/${filePath}`,
        { method: 'PUT', headers: ghHeaders, body: JSON.stringify(commitBody) }
    );
    if (!updateRes.ok) {
        const errData = await updateRes.json().catch(() => ({}));
        return res.status(500).json({ error: 'Failed to push to GitHub', details: errData.message || updateRes.statusText });
    }
    const updateData = await updateRes.json();

    try {
        let actorName = null;
        if (actorEmail) {
            const adminRes = await fetch(
                `${supabaseUrl}/rest/v1/admins?select=name&email=ilike.${encodeURIComponent(actorEmail)}`,
                { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Accept': 'application/json' } }
            );
            if (adminRes.ok) {
                const rows = await adminRes.json();
                actorName = rows[0]?.name || null;
            }
        }
        await fetch(`${supabaseUrl}/rest/v1/activity_log`, {
            method:  'POST',
            headers: {
                'apikey':        serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type':  'application/json',
                'Prefer':        'return=minimal',
            },
            body: JSON.stringify({
                actor_email:  actorEmail || 'unknown',
                actor_name:   actorName,
                action:       'publish_ustaz',
                target_label: 'penceramah',
                detail:       `${penceramah.length} penceramah diterbitkan.`,
            }),
        });
    } catch (e) {
        console.error('activity_log insert failed:', e);
    }

    return res.status(200).json({
        success:   true,
        commitUrl: updateData.commit?.html_url ?? null,
        published: { count: penceramah.length },
    });
};
