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
// serverless function computes the real published output).
function monthRange(year, month) {
    const mm = String(month).padStart(2, '0');
    return [`${year}-${mm}-01`, `${year}-${mm}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}`];
}

async function loadStats() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    let lastMonthYear = year, lastMonth = month - 1;
    if (lastMonth < 1) { lastMonth = 12; lastMonthYear = year - 1; }

    const [thisStart, thisEnd] = monthRange(year, month);
    const [lastStart, lastEnd] = monthRange(lastMonthYear, lastMonth);
    // Fetch range spans into the previous year so "bulan lepas" resolves
    // correctly even in January, when last month is December of last year.
    const fetchFrom = `${lastMonthYear}-01-01`;
    const fetchTo = `${year}-12-31`;

    const [donRes, expRes] = await Promise.all([
        db.from('infaq_donations').select('amount, donation_date').gte('donation_date', fetchFrom).lte('donation_date', fetchTo),
        db.from('infaq_expenses').select('amount, expense_date').gte('expense_date', fetchFrom).lte('expense_date', fetchTo),
    ]);

    if (donRes.error) console.error('Gagal memuatkan kutipan:', donRes.error.message);
    if (expRes.error) console.error('Gagal memuatkan perbelanjaan:', expRes.error.message);

    const donRows = donRes.data || [];
    const expRows = expRes.data || [];
    const sumInRange = (rows, field, from, to) =>
        rows.filter(r => r[field] >= from && r[field] <= to).reduce((s, r) => s + Number(r.amount), 0);
    const sumInYear = (rows, field) => rows.filter(r => r[field].slice(0, 4) === String(year)).reduce((s, r) => s + Number(r.amount), 0);

    document.getElementById('stat-kutipan-ini').textContent   = formatRM(sumInRange(donRows, 'donation_date', thisStart, thisEnd));
    document.getElementById('stat-kutipan-lepas').textContent = formatRM(sumInRange(donRows, 'donation_date', lastStart, lastEnd));
    document.getElementById('stat-kutipan-tahun').textContent = formatRM(sumInYear(donRows, 'donation_date'));

    document.getElementById('stat-belanja-ini').textContent   = formatRM(sumInRange(expRows, 'expense_date', thisStart, thisEnd));
    document.getElementById('stat-belanja-lepas').textContent = formatRM(sumInRange(expRows, 'expense_date', lastStart, lastEnd));
    document.getElementById('stat-belanja-tahun').textContent = formatRM(sumInYear(expRows, 'expense_date'));
}

// ─── Active project progress ────────────────────────────────────────────────
async function loadActiveProject() {
    const { data: project, error } = await db.from('infaq_projects').select('*').eq('is_active', true).single();

    if (error || !project) {
        document.getElementById('project-card').style.display = 'none';
        document.getElementById('no-project-card').style.display = '';
        return;
    }

    const { data: donations } = await db.from('infaq_donations').select('amount').eq('project_id', project.id);
    const terkumpul = (donations || []).reduce((s, r) => s + Number(r.amount), 0);
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
