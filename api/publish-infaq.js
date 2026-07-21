// Vercel serverless function: POST /api/publish-infaq
// Reads infaq_projects/infaq_donations/infaq_expenses from Supabase, computes
// the published JSON (weekly/monthly/yearly rollups + active project
// progress — never stored pre-summed, always derived from raw rows), and
// commits infaq/data/data.json + infaq/data/perbelanjaan.json to GitHub.
// Modeled directly on api/publish.js — same auth/env-var/GitHub-push shape,
// but this publish is always a full "as of now" snapshot, no month param.
//
// Required Vercel environment variables (same ones api/publish.js uses —
// no new Vercel config needed, same repo/token):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GITHUB_TOKEN, GITHUB_REPO

const BULAN = [
    'Januari','Februari','Mac','April','Mei','Jun',
    'Julai','Ogos','September','Oktober','November','Disember'
];
const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'];

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // Malaysia is UTC+8, no DST

// ── Pure helpers (kept dependency-free for ad-hoc local testing, same
// philosophy as api/publish.js's exported functions) ────────────────────────

function computeMonthTotal(rows, dateField, year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return rows.filter(r => r[dateField].startsWith(prefix)).reduce((s, r) => s + Number(r.amount), 0);
}

function computeYearTotal(rows, dateField, year) {
    const prefix = String(year);
    return rows.filter(r => r[dateField].startsWith(prefix)).reduce((s, r) => s + Number(r.amount), 0);
}

// Minggu1..Minggu5 — day 1-7 / 8-14 / 15-21 / 22-28 / 29-31, matching the
// reference schema's week definition exactly.
function computeWeekBuckets(donationRows, year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const buckets = { Minggu1: 0, Minggu2: 0, Minggu3: 0, Minggu4: 0, Minggu5: 0 };
    donationRows.filter(r => r.donation_date.startsWith(prefix)).forEach(r => {
        const day = parseInt(r.donation_date.slice(8, 10), 10);
        const weekIdx = Math.min(5, Math.ceil(day / 7));
        buckets[`Minggu${weekIdx}`] += Number(r.amount);
    });
    return buckets;
}

function computeYearlyGraf(rows, dateField, year) {
    const data = new Array(12).fill(0);
    rows.forEach(r => {
        if (!r[dateField].startsWith(String(year))) return;
        const month = parseInt(r[dateField].slice(5, 7), 10);
        data[month - 1] += Number(r.amount);
    });
    return { tahun: String(year), labels: BULAN_SHORT.slice(), data };
}

// Running sum, resets implicitly per call (one call = one year's series) —
// used for perbelanjaan.json's dataKumulatif/JumlahKumulatif.
function computeCumulative(dataArray) {
    let running = 0;
    return dataArray.map(v => { running += v; return running; });
}

// Returns null (never fabricated zeros) when there's no active project —
// callers omit the `projek` key entirely in that case.
function computeProjectProgress(project, donationsForProject) {
    if (!project) return null;
    const terkumpul = donationsForProject.reduce((s, r) => s + Number(r.amount), 0);
    const target = Number(project.target_amount);
    const peratusan = target > 0 ? Math.round((terkumpul / target) * 100) : 0;
    return { NamaProjek: project.name, SasaranKutipan: target, JumlahTerkumpul: terkumpul, Peratusan: peratusan };
}

// GET-sha-then-PUT against the GitHub Contents API — same pattern as
// api/publish.js, factored out here since this endpoint pushes 2 files.
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
        throw new Error(`Failed to push ${filePath}: ${errData.message || putRes.statusText}`);
    }
    return putRes.json();
}

module.exports = async function handler(req, res) {
    // ── CORS ────────────────────────────────────────────────────────────────
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

    // ── 1. Verify Supabase session (identical to api/publish.js) ───────────
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

    // ── 2. Compute "now" in Malaysia time ───────────────────────────────────
    const mytNow = new Date(Date.now() + MYT_OFFSET_MS);
    const year   = mytNow.getUTCFullYear();
    const month  = mytNow.getUTCMonth() + 1;
    let lastMonthYear = year, lastMonth = month - 1;
    if (lastMonth < 1) { lastMonth = 12; lastMonthYear = year - 1; }

    const fetchFrom = `${lastMonthYear}-01-01`;
    const fetchTo   = `${year}-12-31`;
    const sbHeaders = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Accept': 'application/json' };

    // ── 3. Fetch from Supabase (service-role — see setup.sql §8 for the
    // explicit SELECT grant this depends on) ────────────────────────────────
    const [projectRes, donationRes, expenseRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/infaq_projects?select=*&is_active=eq.true`, { headers: sbHeaders }),
        fetch(`${supabaseUrl}/rest/v1/infaq_donations?select=amount,donation_date,project_id&donation_date=gte.${fetchFrom}&donation_date=lte.${fetchTo}`, { headers: sbHeaders }),
        fetch(`${supabaseUrl}/rest/v1/infaq_expenses?select=amount,expense_date&expense_date=gte.${fetchFrom}&expense_date=lte.${fetchTo}`, { headers: sbHeaders }),
    ]);
    if (!projectRes.ok) return res.status(500).json({ error: 'Failed to fetch infaq_projects', details: await projectRes.text() });
    if (!donationRes.ok) return res.status(500).json({ error: 'Failed to fetch infaq_donations', details: await donationRes.text() });
    if (!expenseRes.ok) return res.status(500).json({ error: 'Failed to fetch infaq_expenses', details: await expenseRes.text() });

    const activeProject = (await projectRes.json())[0] || null;
    const donationRows  = await donationRes.json();
    const expenseRows   = await expenseRes.json();
    const projectDonations = activeProject ? donationRows.filter(r => r.project_id === activeProject.id) : [];

    // ── 4. Compute data.json (donations) ────────────────────────────────────
    const bulanIniLabel   = `${BULAN[month - 1]} ${year}`;
    const bulanLepasLabel = `${BULAN[lastMonth - 1]} ${lastMonthYear}`;
    const projectProgress = computeProjectProgress(activeProject, projectDonations);

    const dataJson = {
        ...(projectProgress ? { projek: projectProgress } : {}),
        ringkasan: {
            kutipan: {
                bulanIni:   { bulan: bulanIniLabel, jumlah: computeMonthTotal(donationRows, 'donation_date', year, month) },
                bulanLepas: { bulan: bulanLepasLabel, jumlah: computeMonthTotal(donationRows, 'donation_date', lastMonthYear, lastMonth) },
                tahunIni:   { tahun: String(year), jumlah: computeYearTotal(donationRows, 'donation_date', year) },
            },
        },
        paparanBulanIni: computeWeekBuckets(donationRows, year, month),
        graf: {
            [String(year)]:     computeYearlyGraf(donationRows, 'donation_date', year),
            [String(year - 1)]: computeYearlyGraf(donationRows, 'donation_date', year - 1),
        },
        tarikhKemaskini: new Date().toISOString(),
    };

    // ── 5. Compute perbelanjaan.json (expenses) ─────────────────────────────
    const expenseGrafThisYear = computeYearlyGraf(expenseRows, 'expense_date', year);
    const cumulativeThisYear  = computeCumulative(expenseGrafThisYear.data);

    // January edge case: "bulan lepas" is December of the PREVIOUS year, so
    // its cumulative must come from that year's own series, not carried over
    // from the current year's array (which resets at the year boundary).
    let bulanLepasKumulatif;
    if (lastMonthYear === year) {
        bulanLepasKumulatif = cumulativeThisYear[lastMonth - 1];
    } else {
        const prevYearGraf = computeYearlyGraf(expenseRows, 'expense_date', lastMonthYear);
        bulanLepasKumulatif = computeCumulative(prevYearGraf.data)[lastMonth - 1];
    }

    const perbelanjaanJson = {
        ringkasan: {
            perbelanjaan: {
                tahunIni:   { tahun: year,     jumlah: computeYearTotal(expenseRows, 'expense_date', year) },
                tahunLepas: { tahun: year - 1, jumlah: computeYearTotal(expenseRows, 'expense_date', year - 1) },
                bulanIni:   { bulan: bulanIniLabel,   jumlah: computeMonthTotal(expenseRows, 'expense_date', year, month) },
                bulanLepas: { bulan: bulanLepasLabel, jumlah: computeMonthTotal(expenseRows, 'expense_date', lastMonthYear, lastMonth) },
            },
        },
        paparanBulanIni: {
            Tahun: year, Bulan: bulanIniLabel,
            Jumlah: computeMonthTotal(expenseRows, 'expense_date', year, month),
            JumlahKumulatif: cumulativeThisYear[month - 1],
        },
        paparanBulanLepas: {
            Tahun: lastMonthYear, Bulan: bulanLepasLabel,
            Jumlah: computeMonthTotal(expenseRows, 'expense_date', lastMonthYear, lastMonth),
            JumlahKumulatif: bulanLepasKumulatif,
        },
        graf: { [String(year)]: { ...expenseGrafThisYear, dataKumulatif: cumulativeThisYear } },
        tarikhKemaskini: new Date().toISOString(),
    };

    // ── 6. Push both files to GitHub ────────────────────────────────────────
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo  = process.env.GITHUB_REPO;
    if (!githubToken || !githubRepo) {
        return res.status(500).json({ error: 'Server misconfiguration: missing GitHub env vars' });
    }
    const ghHeaders = {
        'Authorization':        `Bearer ${githubToken}`,
        'Accept':               'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type':         'application/json',
    };

    // Two sequential commits, not one atomic multi-file commit via the Git
    // Trees API — simpler, matches this repo's existing complexity level.
    // A partial failure (data.json commits, perbelanjaan.json fails) is
    // low-stakes and idempotently fixed by re-clicking Terbitkan.
    let dataCommit, perbelanjaanCommit;
    try {
        dataCommit = await pushJsonToGitHub(ghHeaders, githubRepo, 'infaq/data/data.json', dataJson, '[Admin] Terbitkan ringkasan infaq');
        perbelanjaanCommit = await pushJsonToGitHub(ghHeaders, githubRepo, 'infaq/data/perbelanjaan.json', perbelanjaanJson, '[Admin] Terbitkan perbelanjaan infaq');
    } catch (e) {
        return res.status(500).json({ error: 'Failed to push to GitHub', details: e.message });
    }

    // ── 7. Activity log (never blocks the response) ────────────────────────
    try {
        let actorName = null;
        if (actorEmail) {
            const adminRes = await fetch(
                `${supabaseUrl}/rest/v1/admins?select=name&email=ilike.${encodeURIComponent(actorEmail)}`,
                { headers: sbHeaders }
            );
            if (adminRes.ok) actorName = (await adminRes.json())[0]?.name || null;
        }
        await fetch(`${supabaseUrl}/rest/v1/infaq_activity_log`, {
            method: 'POST',
            headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({
                actor_email:  actorEmail || 'unknown',
                actor_name:   actorName,
                action:       'publish',
                target_label: bulanIniLabel,
                detail:       `Kutipan: RM ${dataJson.ringkasan.kutipan.bulanIni.jumlah.toFixed(2)}; Perbelanjaan: RM ${perbelanjaanJson.ringkasan.perbelanjaan.bulanIni.jumlah.toFixed(2)}`,
            }),
        });
    } catch (e) {
        console.error('infaq_activity_log insert failed:', e); // never blocks the publish response
    }

    return res.status(200).json({
        success: true,
        commitUrls: {
            data: dataCommit.commit?.html_url ?? null,
            perbelanjaan: perbelanjaanCommit.commit?.html_url ?? null,
        },
        published: {
            kutipanBulanIni: dataJson.ringkasan.kutipan.bulanIni.jumlah,
            perbelanjaanBulanIni: perbelanjaanJson.ringkasan.perbelanjaan.bulanIni.jumlah,
        },
    });
};

module.exports.computeMonthTotal      = computeMonthTotal;
module.exports.computeYearTotal       = computeYearTotal;
module.exports.computeWeekBuckets     = computeWeekBuckets;
module.exports.computeYearlyGraf      = computeYearlyGraf;
module.exports.computeCumulative      = computeCumulative;
module.exports.computeProjectProgress = computeProjectProgress;
