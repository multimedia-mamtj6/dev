// Vercel serverless function: POST /api/publish-infaq?target=monthly|daily|perbelanjaan
// Reads infaq_projects/infaq_kutipan_mingguan/infaq_projek_kutipan/
// infaq_perbelanjaan_bulanan from Supabase, computes the published JSON
// (weekly/monthly/yearly rollups + active project progress — never stored
// pre-summed, always derived from raw rows), and commits ONE file to GitHub
// per `target`, published independently of the other two:
//   target=monthly      → admin/infaq/data/monthly.json      (general infaq)
//   target=daily         → admin/infaq/data/daily.json         (active project's donations)
//   target=perbelanjaan → admin/infaq/data/perbelanjaan.json (expenses)
// Split into 3 independently-triggerable publishes (2026-07-22) so, e.g.,
// recording an expense doesn't require also recomputing/republishing
// kutipan data, and vice versa — each has its own button + "last published"
// note on admin/infaq/ringkasan.html. Under admin/ (not top-level infaq/,
// unlike kuliah's convention) since there's no public consumer yet; this
// keeps the published data colocated with the module that produces it.
// Field/key shapes still mirror the real infaq.mamtj6.com reference site
// exactly, so a future public page (or migrating the path) stays cheap.
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

const TARGETS = {
    monthly:      { file: 'admin/infaq/data/monthly.json',      commitMessage: '[Admin] Terbitkan kutipan mingguan infaq', action: 'publish_monthly' },
    daily:        { file: 'admin/infaq/data/daily.json',        commitMessage: '[Admin] Terbitkan kutipan projek infaq',   action: 'publish_daily' },
    perbelanjaan: { file: 'admin/infaq/data/perbelanjaan.json', commitMessage: '[Admin] Terbitkan perbelanjaan infaq',     action: 'publish_perbelanjaan' },
};

// ── Pure helpers (kept dependency-free for ad-hoc local testing, same
// philosophy as api/publish.js's exported functions) ────────────────────────

function sumJumlah(rows) {
    return rows.reduce((s, r) => s + Number(r.jumlah), 0);
}

function filterTahunBulan(rows, tahun, bulan) {
    return rows.filter(r => r.tahun === tahun && r.bulan === bulan);
}

function filterTahun(rows, tahun) {
    return rows.filter(r => r.tahun === tahun);
}

// Each row already IS one week's total (infaq_kutipan_mingguan) — no
// day-of-month math needed, just place each row's jumlah into its bucket.
// Missing weeks (no row) stay 0, matching the source Sheet's "-" cells.
function buildMingguBuckets(weekRowsForOneMonth) {
    const buckets = { Minggu1: 0, Minggu2: 0, Minggu3: 0, Minggu4: 0, Minggu5: 0 };
    weekRowsForOneMonth.forEach(r => { buckets[`Minggu${r.minggu}`] = Number(r.jumlah); });
    return buckets;
}

// 12-length yearly array. Works whether rows are already one-per-month
// (perbelanjaan) or still one-per-week and need summing up (kutipan) —
// accumulation (+=) handles both uniformly.
function buildYearlyGraf(rows, year) {
    const data = new Array(12).fill(0);
    rows.forEach(r => {
        if (r.tahun !== year) return;
        data[r.bulan - 1] += Number(r.jumlah);
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
    const terkumpul = sumJumlah(donationsForProject);
    const target = Number(project.target_amount);
    const peratusan = target > 0 ? Math.round((terkumpul / target) * 100) : 0;
    return { NamaProjek: project.name, SasaranKutipan: target, JumlahTerkumpul: terkumpul, Peratusan: peratusan };
}

// GET-sha-then-PUT against the GitHub Contents API — same pattern as
// api/publish.js.
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

    // ── 0. Validate target ──────────────────────────────────────────────────
    const target = req.query.target;
    if (!TARGETS[target]) {
        return res.status(400).json({ error: 'Missing or invalid target — expected ?target=monthly|daily|perbelanjaan' });
    }

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

    const bulanIniLabel   = `${BULAN[month - 1]} ${year}`;
    const bulanLepasLabel = `${BULAN[lastMonth - 1]} ${lastMonthYear}`;

    const sbHeaders = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Accept': 'application/json' };

    // ── 3. Fetch only what this target needs, compute its JSON ─────────────
    let jsonOut, activityLabel, activityDetail;

    if (target === 'monthly') {
        const kutipanRes = await fetch(`${supabaseUrl}/rest/v1/infaq_kutipan_mingguan?select=tahun,bulan,minggu,jumlah`, { headers: sbHeaders });
        if (!kutipanRes.ok) return res.status(500).json({ error: 'Failed to fetch infaq_kutipan_mingguan', details: await kutipanRes.text() });
        const kutipanRows = await kutipanRes.json();

        jsonOut = {
            ringkasan: {
                kutipan: {
                    bulanIni:   { bulan: bulanIniLabel,   jumlah: sumJumlah(filterTahunBulan(kutipanRows, year, month)) },
                    bulanLepas: { bulan: bulanLepasLabel, jumlah: sumJumlah(filterTahunBulan(kutipanRows, lastMonthYear, lastMonth)) },
                    tahunIni:   { tahun: String(year),     jumlah: sumJumlah(filterTahun(kutipanRows, year)) },
                    tahunLepas: { tahun: String(year - 1), jumlah: sumJumlah(filterTahun(kutipanRows, year - 1)) },
                },
            },
            paparanBulanIni: {
                Tahun: year, Bulan: BULAN[month - 1].toUpperCase(),
                ...buildMingguBuckets(filterTahunBulan(kutipanRows, year, month)),
                JumlahBulanan: sumJumlah(filterTahunBulan(kutipanRows, year, month)),
            },
            paparanBulanLepas: {
                Tahun: lastMonthYear, Bulan: BULAN[lastMonth - 1].toUpperCase(),
                ...buildMingguBuckets(filterTahunBulan(kutipanRows, lastMonthYear, lastMonth)),
                JumlahBulanan: sumJumlah(filterTahunBulan(kutipanRows, lastMonthYear, lastMonth)),
            },
            graf: {
                [String(year)]:     buildYearlyGraf(kutipanRows, year),
                [String(year - 1)]: buildYearlyGraf(kutipanRows, year - 1),
            },
            tarikhKemaskini: new Date().toISOString(),
        };
        activityLabel  = bulanIniLabel;
        activityDetail = `Kutipan: RM ${jsonOut.ringkasan.kutipan.bulanIni.jumlah.toFixed(2)}`;

    } else if (target === 'daily') {
        const projectRes = await fetch(`${supabaseUrl}/rest/v1/infaq_projects?select=*&is_active=eq.true`, { headers: sbHeaders });
        if (!projectRes.ok) return res.status(500).json({ error: 'Failed to fetch infaq_projects', details: await projectRes.text() });
        const activeProject = (await projectRes.json())[0] || null;

        let projectDonations = [];
        if (activeProject) {
            const projekRes = await fetch(
                `${supabaseUrl}/rest/v1/infaq_projek_kutipan?select=tarikh,jumlah,keterangan&project_id=eq.${activeProject.id}&order=tarikh.asc`,
                { headers: sbHeaders }
            );
            if (!projekRes.ok) return res.status(500).json({ error: 'Failed to fetch infaq_projek_kutipan', details: await projekRes.text() });
            projectDonations = await projekRes.json();
        }

        const projectProgress = computeProjectProgress(activeProject, projectDonations);
        jsonOut = {
            ...(projectProgress ? { projek: projectProgress } : {}),
            paparanHarian: projectDonations.map(r => ({
                tarikh: r.tarikh, jumlah: Number(r.jumlah), keterangan: r.keterangan || '',
            })),
            tarikhKemaskini: new Date().toISOString(),
        };
        activityLabel  = activeProject?.name || 'Tiada projek aktif';
        activityDetail = projectProgress ? `Terkumpul: RM ${projectProgress.JumlahTerkumpul.toFixed(2)}` : null;

    } else { // perbelanjaan
        const perbelanjaanRes = await fetch(`${supabaseUrl}/rest/v1/infaq_perbelanjaan_bulanan?select=tahun,bulan,jumlah`, { headers: sbHeaders });
        if (!perbelanjaanRes.ok) return res.status(500).json({ error: 'Failed to fetch infaq_perbelanjaan_bulanan', details: await perbelanjaanRes.text() });
        const perbelanjaanRows = await perbelanjaanRes.json();

        const expenseGrafThisYear = buildYearlyGraf(perbelanjaanRows, year);
        const cumulativeThisYear  = computeCumulative(expenseGrafThisYear.data);

        // January edge case: "bulan lepas" is December of the PREVIOUS year,
        // so its cumulative must come from that year's own series, not
        // carried over from the current year's array (resets at the boundary).
        let bulanLepasKumulatif;
        if (lastMonthYear === year) {
            bulanLepasKumulatif = cumulativeThisYear[lastMonth - 1];
        } else {
            const prevYearGraf = buildYearlyGraf(perbelanjaanRows, lastMonthYear);
            bulanLepasKumulatif = computeCumulative(prevYearGraf.data)[lastMonth - 1];
        }

        jsonOut = {
            ringkasan: {
                perbelanjaan: {
                    tahunIni:   { tahun: year,     jumlah: sumJumlah(filterTahun(perbelanjaanRows, year)) },
                    tahunLepas: { tahun: year - 1, jumlah: sumJumlah(filterTahun(perbelanjaanRows, year - 1)) },
                    bulanIni:   { bulan: bulanIniLabel,   jumlah: sumJumlah(filterTahunBulan(perbelanjaanRows, year, month)) },
                    bulanLepas: { bulan: bulanLepasLabel, jumlah: sumJumlah(filterTahunBulan(perbelanjaanRows, lastMonthYear, lastMonth)) },
                },
            },
            paparanBulanIni: {
                Tahun: year, Bulan: bulanIniLabel,
                Jumlah: sumJumlah(filterTahunBulan(perbelanjaanRows, year, month)),
                JumlahKumulatif: cumulativeThisYear[month - 1],
            },
            paparanBulanLepas: {
                Tahun: lastMonthYear, Bulan: bulanLepasLabel,
                Jumlah: sumJumlah(filterTahunBulan(perbelanjaanRows, lastMonthYear, lastMonth)),
                JumlahKumulatif: bulanLepasKumulatif,
            },
            graf: { [String(year)]: { ...expenseGrafThisYear, dataKumulatif: cumulativeThisYear } },
            tarikhKemaskini: new Date().toISOString(),
        };
        activityLabel  = bulanIniLabel;
        activityDetail = `Perbelanjaan: RM ${jsonOut.ringkasan.perbelanjaan.bulanIni.jumlah.toFixed(2)}`;
    }

    // ── 4. Push the one file to GitHub ──────────────────────────────────────
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

    const { file, commitMessage, action } = TARGETS[target];
    let commit;
    try {
        commit = await pushJsonToGitHub(ghHeaders, githubRepo, file, jsonOut, commitMessage);
    } catch (e) {
        return res.status(500).json({ error: 'Failed to push to GitHub', details: e.message });
    }

    // ── 5. Activity log (never blocks the response) ────────────────────────
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
                action,
                target_label: activityLabel,
                detail:       activityDetail,
            }),
        });
    } catch (e) {
        console.error('infaq_activity_log insert failed:', e); // never blocks the publish response
    }

    return res.status(200).json({
        success: true,
        target,
        commitUrl: commit.commit?.html_url ?? null,
    });
};

module.exports.sumJumlah              = sumJumlah;
module.exports.filterTahunBulan       = filterTahunBulan;
module.exports.filterTahun            = filterTahun;
module.exports.buildMingguBuckets     = buildMingguBuckets;
module.exports.buildYearlyGraf        = buildYearlyGraf;
module.exports.computeCumulative      = computeCumulative;
module.exports.computeProjectProgress = computeProjectProgress;
