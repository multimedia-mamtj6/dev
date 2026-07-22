// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
    const session = await requireAuth();
    if (!session) return;
    if (!(await requireInfaqAccess())) return;
    await Promise.all([
        loadStats(),
        loadActiveProject(),
    ]);
})();

// ─── Stat cards ───────────────────────────────────────────────────────────────
// Deliberately simple client-side sums over fetched rows — NOT a reimplementation
// of api/publish-infaq.js's week-bucket/graf logic (same separation of concerns
// jadual.js already has from api/publish.js: this page previews, the
// serverless function computes the real published output). Both source
// tables are already pre-aggregated by (tahun,bulan[,minggu]), so this is
// just grouping/summing integers — no date-string range math needed.
async function loadStats() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    let lastMonthYear = year, lastMonth = month - 1;
    if (lastMonth < 1) { lastMonth = 12; lastMonthYear = year - 1; }

    const [kutipanRes, belanjaRes] = await Promise.all([
        db.from('infaq_kutipan_mingguan').select('tahun, bulan, jumlah').in('tahun', [year, lastMonthYear]),
        db.from('infaq_perbelanjaan_bulanan').select('tahun, bulan, jumlah').in('tahun', [year, lastMonthYear]),
    ]);

    if (kutipanRes.error) console.error('Gagal memuatkan kutipan:', kutipanRes.error.message);
    if (belanjaRes.error) console.error('Gagal memuatkan perbelanjaan:', belanjaRes.error.message);

    const kutipanRows = kutipanRes.data || [];
    const belanjaRows = belanjaRes.data || [];
    const sumMonth = (rows, y, m) => rows.filter(r => r.tahun === y && r.bulan === m).reduce((s, r) => s + Number(r.jumlah), 0);
    const sumYear  = (rows, y) => rows.filter(r => r.tahun === y).reduce((s, r) => s + Number(r.jumlah), 0);

    document.getElementById('stat-kutipan-ini').textContent   = formatRM(sumMonth(kutipanRows, year, month));
    document.getElementById('stat-kutipan-lepas').textContent = formatRM(sumMonth(kutipanRows, lastMonthYear, lastMonth));
    document.getElementById('stat-kutipan-tahun').textContent = formatRM(sumYear(kutipanRows, year));

    document.getElementById('stat-belanja-ini').textContent   = formatRM(sumMonth(belanjaRows, year, month));
    document.getElementById('stat-belanja-lepas').textContent = formatRM(sumMonth(belanjaRows, lastMonthYear, lastMonth));
    document.getElementById('stat-belanja-tahun').textContent = formatRM(sumYear(belanjaRows, year));
}

// ─── Active project progress ────────────────────────────────────────────────
async function loadActiveProject() {
    const { data: project, error } = await db.from('infaq_projects').select('*').eq('is_active', true).single();

    if (error || !project) {
        document.getElementById('project-card').style.display = 'none';
        document.getElementById('no-project-card').style.display = '';
        return;
    }

    const { data: donations } = await db.from('infaq_projek_kutipan').select('jumlah').eq('project_id', project.id);
    const terkumpul = (donations || []).reduce((s, r) => s + Number(r.jumlah), 0);
    const peratusan = project.target_amount > 0 ? Math.round((terkumpul / project.target_amount) * 100) : 0;

    document.getElementById('project-card').style.display = '';
    document.getElementById('no-project-card').style.display = 'none';
    document.getElementById('project-name').textContent = project.name;
    document.getElementById('project-progress-fill').style.width = `${Math.min(100, peratusan)}%`;
    document.getElementById('project-progress-text').textContent =
        `${formatRM(terkumpul)} daripada ${formatRM(project.target_amount)} (${peratusan}%)`;
}
