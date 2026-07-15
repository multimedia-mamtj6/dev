// Vercel serverless function: POST /api/publish?month=YYYY-MM
// Reads schedule from Supabase, merges it into jadual_lengkap_beta.json's
// months map (keyed by real current/next YYYY-MM), commits to GitHub.
//
// Required Vercel environment variables (set in Vercel Dashboard → Project → Settings → Environment Variables):
//   SUPABASE_URL             — your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — service role key (never expose to browser)
//   GITHUB_TOKEN             — fine-grained PAT with contents:write on multimedia-mamtj6/dev
//   GITHUB_REPO              — "multimedia-mamtj6/dev"

const BULAN = [
    'Januari','Februari','Mac','April','Mei','Jun',
    'Julai','Ogos','September','Oktober','November','Disember'
];

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // Malaysia is UTC+8, no DST

// ── Pure helpers (kept dependency-free for ad-hoc local testing) ────────────

function computeRealMonthKeys(mytNow) {
    const y = mytNow.getUTCFullYear();
    const m = mytNow.getUTCMonth() + 1; // 1-12
    const realCurrentKey = `${y}-${String(m).padStart(2, '0')}`;
    let ny = y, nm = m + 1;
    if (nm > 12) { nm = 1; ny++; }
    const realNextKey = `${ny}-${String(nm).padStart(2, '0')}`;
    return { realCurrentKey, realNextKey };
}

function monthLabelFromKey(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return `${BULAN[m - 1]} ${y}`;
}

function inferMonthKeyFromTajuk(tajukBulan) {
    if (typeof tajukBulan !== 'string') return null;
    const m = tajukBulan.match(/BULAN\s+([A-Za-z]+)\s+(\d{4})/i);
    if (!m) return null;
    const idx = BULAN.findIndex(name => name.toUpperCase() === m[1].toUpperCase());
    if (idx === -1) return null;
    return `${m[2]}-${String(idx + 1).padStart(2, '0')}`;
}

// Parses the existing file's base64 content into a `months` map, migrating
// the old single-month flat schema if that's what's currently published.
// Never throws — any unrecognized/corrupt content just yields an empty map.
function buildMonthsStoreFromExisting(base64Content) {
    if (!base64Content) return {};

    let parsed;
    try {
        const decoded = Buffer.from(base64Content, 'base64').toString('utf8');
        parsed = JSON.parse(decoded);
    } catch (e) {
        return {};
    }

    if (parsed && typeof parsed.months === 'object' && parsed.months !== null && !Array.isArray(parsed.months)) {
        return { ...parsed.months };
    }

    if (parsed && parsed.infoJadual && Array.isArray(parsed.senaraiHari)) {
        const inferredKey = inferMonthKeyFromTajuk(parsed.infoJadual.tajukBulan);
        if (inferredKey) {
            return { [inferredKey]: { infoJadual: parsed.infoJadual, senaraiHari: parsed.senaraiHari } };
        }
    }

    return {};
}

// Merges `newMonthEntry` into `monthsStore[month]`, then drops every key that
// isn't the real-current or real-next month so the file never accumulates
// stale/unbounded history.
function mergeAndPruneMonthsStore(monthsStore, month, newMonthEntry, realCurrentKey, realNextKey) {
    const merged = { ...monthsStore, [month]: newMonthEntry };
    for (const key of Object.keys(merged)) {
        if (key !== realCurrentKey && key !== realNextKey) delete merged[key];
    }
    return merged;
}

module.exports = async function handler(req, res) {
    // ── CORS ────────────────────────────────────────────────────────────────
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

    // ── 1. Verify Supabase session ──────────────────────────────────────────
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

    // Verify by calling Supabase /auth/v1/user — if it returns a user the JWT is valid
    const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
            'apikey':        serviceKey,
            'Authorization': `Bearer ${userJwt}`,
        },
    });
    if (!authCheck.ok) {
        return res.status(401).json({ error: 'Invalid or expired session' });
    }
    const authUser   = await authCheck.json();
    const actorEmail = authUser?.email || null;

    // ── 2. Parse month param ────────────────────────────────────────────────
    const month = typeof req.query.month === 'string' ? req.query.month.trim() : '';
    if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: 'Invalid month parameter — expected YYYY-MM' });
    }

    const [yearStr, monthStr] = month.split('-');
    const year     = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    if (monthNum < 1 || monthNum > 12) {
        return res.status(400).json({ error: 'Month out of range' });
    }

    // Only the real current/next month may ever be published — this keeps the
    // file's `months` map bounded to exactly these two keys (see prune step below).
    const { realCurrentKey, realNextKey } = computeRealMonthKeys(new Date(Date.now() + MYT_OFFSET_MS));
    if (month !== realCurrentKey && month !== realNextKey) {
        return res.status(400).json({
            error: `Month must be the real current (${realCurrentKey}) or next (${realNextKey}) month`,
        });
    }

    const startDate = `${month}-01`;
    const lastDay   = new Date(year, monthNum, 0).getDate();
    const endDate   = `${month}-${String(lastDay).padStart(2, '0')}`;

    // ── 3. Fetch ustaz lookup from Supabase ─────────────────────────────────
    const ustazRes = await fetch(
        `${supabaseUrl}/rest/v1/ustaz?select=id,full_name,tajuk_kuliah,poster_url`,
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
    const ustazMap  = Object.fromEntries(ustazList.map(u => [u.id, u]));

    // ── 4. Fetch schedule rows ──────────────────────────────────────────────
    const schedRes = await fetch(
        `${supabaseUrl}/rest/v1/schedule` +
        `?select=date,cuti_umum,subuh_ustaz_id,maghrib_ustaz_id,subuh_pending,maghrib_pending` +
        `&date=gte.${startDate}` +
        `&date=lte.${endDate}` +
        `&order=date`,
        {
            headers: {
                'apikey':        serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Accept':        'application/json',
            },
        }
    );
    if (!schedRes.ok) {
        const err = await schedRes.text();
        return res.status(500).json({ error: 'Failed to fetch schedule from Supabase', details: err });
    }
    const scheduleRows = await schedRes.json();

    // ── 5. Build this month's entry ─────────────────────────────────────────
    const tajukBulan = `BULAN ${BULAN[monthNum - 1].toUpperCase()} ${year}`;
    const now        = new Date();
    const tarikhKemasKini =
        `*Dikemaskini oleh Biro Dakwah pada ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

    const senaraiHari = scheduleRows.map(row => {
        const subuhUstaz   = row.subuh_ustaz_id   ? ustazMap[row.subuh_ustaz_id]   : null;
        const maghribUstaz = row.maghrib_ustaz_id ? ustazMap[row.maghrib_ustaz_id] : null;
        return {
            date:      row.date,
            subuh:     row.subuh_pending ? { pending: true } : (subuhUstaz ? {
                nama_penceramah: subuhUstaz.full_name,
                tajuk_kuliah:    subuhUstaz.tajuk_kuliah || null,
                poster_url:      subuhUstaz.poster_url  || null,
            } : null),
            maghrib:   row.maghrib_pending ? { pending: true } : (maghribUstaz ? {
                nama_penceramah: maghribUstaz.full_name,
                tajuk_kuliah:    maghribUstaz.tajuk_kuliah || null,
                poster_url:      maghribUstaz.poster_url  || null,
            } : null),
            cuti_umum: row.cuti_umum || null,
        };
    });

    // ── 6. Push to GitHub ────────────────────────────────────────────────────
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo  = process.env.GITHUB_REPO;  // e.g. "multimedia-mamtj6/dev"
    if (!githubToken || !githubRepo) {
        return res.status(500).json({ error: 'Server misconfiguration: missing GitHub env vars' });
    }

    const filePath  = 'kuliah/data/jadual_lengkap_beta.json';
    const ghHeaders = {
        'Authorization':        `Bearer ${githubToken}`,
        'Accept':               'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type':         'application/json',
    };

    // Get current file content + SHA in one call (404 = new file, no SHA needed)
    const contentsRes = await fetch(
        `https://api.github.com/repos/${githubRepo}/contents/${filePath}`,
        { headers: ghHeaders }
    );
    if (!contentsRes.ok && contentsRes.status !== 404) {
        return res.status(500).json({
            error: 'Failed to read current file from GitHub',
            status: contentsRes.status,
        });
    }

    let currentSha;
    let monthsStore = {};
    if (contentsRes.ok) {
        const fileData = await contentsRes.json();
        currentSha  = fileData.sha;
        monthsStore = buildMonthsStoreFromExisting(fileData.content);
    }

    monthsStore = mergeAndPruneMonthsStore(
        monthsStore, month,
        { infoJadual: { tajukBulan, tarikhKemasKini }, senaraiHari },
        realCurrentKey, realNextKey
    );

    const jsonContent = JSON.stringify({ months: monthsStore }, null, 2);

    // Commit the new content (create if no SHA, update if SHA exists)
    const commitBody = {
        message: `[Admin] Terbitkan jadual ${tajukBulan}`,
        content: Buffer.from(jsonContent, 'utf8').toString('base64'),
        branch:  'main',
    };
    if (currentSha) commitBody.sha = currentSha;

    const updateRes = await fetch(
        `https://api.github.com/repos/${githubRepo}/contents/${filePath}`,
        {
            method:  'PUT',
            headers: ghHeaders,
            body:    JSON.stringify(commitBody),
        }
    );
    if (!updateRes.ok) {
        const errData = await updateRes.json().catch(() => ({}));
        return res.status(500).json({
            error:   'Failed to push to GitHub',
            details: errData.message || updateRes.statusText,
        });
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
                action:       'publish',
                target_label: monthLabelFromKey(month),
                detail:       `${senaraiHari.length} hari diterbitkan.`,
            }),
        });
    } catch (e) {
        console.error('activity_log insert failed:', e); // never blocks the publish response
    }

    return res.status(200).json({
        success:   true,
        commitUrl: updateData.commit?.html_url ?? null,
        published: { month, rows: senaraiHari.length, tajukBulan },
        months:    Object.keys(monthsStore),
    });
};

module.exports.computeRealMonthKeys        = computeRealMonthKeys;
module.exports.inferMonthKeyFromTajuk       = inferMonthKeyFromTajuk;
module.exports.buildMonthsStoreFromExisting = buildMonthsStoreFromExisting;
module.exports.mergeAndPruneMonthsStore     = mergeAndPruneMonthsStore;
module.exports.monthLabelFromKey            = monthLabelFromKey;
