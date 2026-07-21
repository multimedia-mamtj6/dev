// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
    const session = await requireAuth();
    if (!session) return;
    if (!(await requireInfaqAccess())) return;
    await Promise.all([loadStats(), loadActiveProject(), loadLastPublishedInfaqNote()]);
})();

// ─── Stat cards ───────────────────────────────────────────────────────────────
// Deliberately simple client-side sums over fetched rows — NOT a reimplementation
// of api/publish-infaq.js's week-bucket/graf logic (same separation of concerns
// dashboard.js already has from api/publish.js: this page previews, the
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

// ─── Publish ──────────────────────────────────────────────────────────────────
// Reads the most recent 'publish' row in infaq_activity_log — same pattern as
// admin/kuliah/dashboard.js's loadLastPublishedNote(), but not month-scoped
// (infaq publish is always a full as-of-now snapshot, one row per publish).
async function loadLastPublishedInfaqNote() {
    const el = document.getElementById('last-published-note');
    const { data, error } = await db
        .from('infaq_activity_log')
        .select('created_at, actor_name, actor_email')
        .eq('action', 'publish')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) { el.style.display = 'none'; return; }

    if (!data || !data.length) {
        el.textContent = 'Belum pernah diterbitkan.';
    } else {
        const row = data[0];
        let who = row.actor_name;
        if (!who) {
            const { data: adminRow } = await db.from('admins').select('name').ilike('email', row.actor_email).single();
            who = adminRow?.name || row.actor_email;
        }
        el.textContent = `Terakhir diterbitkan pada ${formatDateTimeMY(row.created_at)} (${formatRelativeMY(row.created_at)}) oleh ${who}`;
    }
    el.style.display = 'block';
}

async function publishInfaq() {
    const btn = document.getElementById('publish-btn');
    btn.disabled  = true;
    btn.innerHTML = '<span class="spinner"></span> Menerbitkan...';

    const { data: { session } } = await db.auth.getSession();
    if (!session) {
        showToast('Sesi tamat. Sila log masuk semula.', 'error');
        btn.disabled = false;
        btn.textContent = 'Terbitkan';
        return;
    }

    try {
        const res = await fetch('/api/publish-infaq', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        const data = await res.json();

        if (!res.ok) {
            const detail = data.details ? ` (${data.status}: ${data.details})` : '';
            showToast('Gagal menerbitkan: ' + (data.error || res.statusText) + detail, 'error', 8000);
        } else {
            showToast('Berjaya diterbitkan!', 'success', 6000);
            await loadLastPublishedInfaqNote();
        }
    } catch (err) {
        showToast('Ralat sambungan: ' + err.message, 'error');
    }

    btn.disabled = false;
    btn.textContent = 'Terbitkan';
}
