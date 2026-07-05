// Vercel serverless function: POST /api/publish?month=YYYY-MM
// Reads schedule from Supabase, generates jadual_lengkap.json, commits to GitHub.
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
        return res.status(500).json({ error: 'Failed to fetch ustaz from Supabase', details: err });
    }
    const ustazList = await ustazRes.json();
    const ustazMap  = Object.fromEntries(ustazList.map(u => [u.id, u]));

    // ── 4. Fetch schedule rows ──────────────────────────────────────────────
    const schedRes = await fetch(
        `${supabaseUrl}/rest/v1/schedule` +
        `?select=date,cuti_umum,subuh_ustaz_id,maghrib_ustaz_id` +
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

    // ── 5. Build jadual_lengkap.json payload ────────────────────────────────
    const tajukBulan = `BULAN ${BULAN[monthNum - 1].toUpperCase()} ${year}`;
    const now        = new Date();
    const tarikhKemasKini =
        `*Dikemaskini melalui Admin Dashboard pada ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

    const senaraiHari = scheduleRows.map(row => {
        const subuhUstaz   = row.subuh_ustaz_id   ? ustazMap[row.subuh_ustaz_id]   : null;
        const maghribUstaz = row.maghrib_ustaz_id ? ustazMap[row.maghrib_ustaz_id] : null;
        return {
            date:      row.date,
            subuh:     subuhUstaz ? {
                nama_penceramah: subuhUstaz.full_name,
                tajuk_kuliah:    subuhUstaz.tajuk_kuliah || null,
                poster_url:      subuhUstaz.poster_url  || null,
            } : null,
            maghrib:   maghribUstaz ? {
                nama_penceramah: maghribUstaz.full_name,
                tajuk_kuliah:    maghribUstaz.tajuk_kuliah || null,
                poster_url:      maghribUstaz.poster_url  || null,
            } : null,
            cuti_umum: row.cuti_umum || null,
        };
    });

    const jsonContent = JSON.stringify(
        { infoJadual: { tajukBulan, tarikhKemasKini }, senaraiHari },
        null, 2
    );

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

    // Get current file SHA (required for update)
    const shaRes = await fetch(
        `https://api.github.com/repos/${githubRepo}/contents/${filePath}`,
        { headers: ghHeaders }
    );
    if (!shaRes.ok) {
        return res.status(500).json({
            error: 'Failed to read current file SHA from GitHub',
            status: shaRes.status,
        });
    }
    const { sha: currentSha } = await shaRes.json();

    // Commit the new content
    const updateRes = await fetch(
        `https://api.github.com/repos/${githubRepo}/contents/${filePath}`,
        {
            method: 'PUT',
            headers: ghHeaders,
            body: JSON.stringify({
                message: `[Admin] Terbitkan jadual ${tajukBulan}`,
                content: Buffer.from(jsonContent, 'utf8').toString('base64'),
                sha:     currentSha,
                branch:  'main',
            }),
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

    return res.status(200).json({
        success:   true,
        commitUrl: updateData.commit?.html_url ?? null,
        published: { month, rows: senaraiHari.length, tajukBulan },
    });
};
