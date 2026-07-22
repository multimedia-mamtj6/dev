// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
    const session = await requireAuth();
    if (!session) return;

    const hasKuliah = currentAdmin.role === 'super_admin' || !!currentAdmin.permissions?.kuliah;
    const hasInfaq  = currentAdmin.role === 'super_admin' || !!currentAdmin.permissions?.infaq;

    if (!hasKuliah && !hasInfaq) {
        document.getElementById('no-access-message').style.display = '';
        return;
    }

    const tasks = [];
    if (hasKuliah) {
        document.getElementById('kuliah-overview').style.display = '';
        tasks.push(loadKuliahOverview());
    }
    if (hasInfaq) {
        document.getElementById('infaq-overview').style.display = '';
        tasks.push(loadInfaqOverview());
    }
    await Promise.all(tasks);
})();

// ─── Kuliah glimpse ─────────────────────────────────────────────────────────
// Reuses the exact query shapes jadual.js already established (month-bounded
// schedule fetch + ustaz lookup, countFilledDays' truthy-field check, the
// activity_log 'publish' lookup keyed by month label) — new instances here
// since this page has no shared module system with kuliah/jadual.js, not a
// reimplementation of different logic.
async function loadKuliahOverview() {
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;
    const today = todayString();
    const padMonth = String(month).padStart(2, '0');
    const startDate = `${year}-${padMonth}-01`;
    const endDate   = `${year}-${padMonth}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}`;

    const [{ data: ustaz, error: ustazErr }, { data: rows, error: schedErr }] = await Promise.all([
        db.from('ustaz').select('id, short_name'),
        db.from('schedule')
            .select('date, cuti_umum, subuh_ustaz_id, maghrib_ustaz_id, subuh_pending, maghrib_pending')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date'),
    ]);

    if (ustazErr || schedErr) {
        document.getElementById('kuliah-today-subuh').textContent = 'Gagal memuatkan data kuliah.';
        document.getElementById('kuliah-today-maghrib').textContent = '';
        document.getElementById('kuliah-upcoming-list').textContent = 'Gagal memuatkan data kuliah.';
        return;
    }

    const ustazMap = Object.fromEntries((ustaz || []).map(u => [u.id, u]));
    const scheduleRows = rows || [];

    renderTodaySession(scheduleRows.find(r => r.date === today), ustazMap);

    // Upcoming: rest of the current month only, after today, with something
    // recorded — keeps this a single-query glimpse rather than also reaching
    // into next month's table.
    const upcoming = scheduleRows
        .filter(r => r.date > today && (r.subuh_ustaz_id || r.maghrib_ustaz_id || r.subuh_pending || r.maghrib_pending || r.cuti_umum))
        .slice(0, 5);
    renderUpcoming(upcoming, ustazMap);

    const filledCount = scheduleRows.filter(r =>
        r.subuh_ustaz_id || r.maghrib_ustaz_id || r.subuh_pending || r.maghrib_pending || r.cuti_umum
    ).length;
    document.getElementById('kuliah-month-completion').textContent =
        `${filledCount} / ${lastDayOfMonth(year, month)} hari lengkap`;

    await loadKuliahLastPublished(monthLabel(year, month));
}

function sessionText(ustazId, pending, ustazMap) {
    if (pending) return 'Belum Ditetapkan';
    if (ustazId) return ustazMap[ustazId]?.short_name || '—';
    return 'Tiada Kuliah';
}

function renderTodaySession(row, ustazMap) {
    document.getElementById('kuliah-today-label').textContent = formatDateMY(todayString());
    if (row?.cuti_umum) {
        document.getElementById('kuliah-today-subuh').textContent   = `Cuti Umum — ${row.cuti_umum}`;
        document.getElementById('kuliah-today-maghrib').textContent = '';
        return;
    }
    document.getElementById('kuliah-today-subuh').textContent   = `Subuh: ${sessionText(row?.subuh_ustaz_id, row?.subuh_pending, ustazMap)}`;
    document.getElementById('kuliah-today-maghrib').textContent = `Maghrib: ${sessionText(row?.maghrib_ustaz_id, row?.maghrib_pending, ustazMap)}`;
}

function renderUpcoming(rows, ustazMap) {
    const el = document.getElementById('kuliah-upcoming-list');
    if (!rows.length) {
        el.innerHTML = '<p style="margin:0;color:var(--text-muted);font-size:0.8125rem">Tiada kuliah akan datang direkodkan bulan ini.</p>';
        return;
    }
    el.innerHTML = rows.map(row => {
        if (row.cuti_umum) {
            return `<p style="margin:0 0 0.375rem;font-size:0.8125rem"><strong>${formatDateMY(row.date)}</strong> — Cuti Umum: ${escapeHtml(row.cuti_umum)}</p>`;
        }
        const subuh   = sessionText(row.subuh_ustaz_id, row.subuh_pending, ustazMap);
        const maghrib = sessionText(row.maghrib_ustaz_id, row.maghrib_pending, ustazMap);
        return `<p style="margin:0 0 0.375rem;font-size:0.8125rem"><strong>${formatDateMY(row.date)}</strong> — Subuh: ${escapeHtml(subuh)}, Maghrib: ${escapeHtml(maghrib)}</p>`;
    }).join('');
}

async function loadKuliahLastPublished(label) {
    const el = document.getElementById('kuliah-last-published');
    const { data, error } = await db
        .from('activity_log')
        .select('created_at, actor_name, actor_email')
        .eq('action', 'publish')
        .eq('target_label', label)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error || !data || !data.length) {
        el.textContent = 'Belum diterbitkan bulan ini.';
        return;
    }
    const row = data[0];
    let who = row.actor_name;
    if (!who) {
        const { data: adminRow } = await db.from('admins').select('name').ilike('email', row.actor_email).single();
        who = adminRow?.name || row.actor_email;
    }
    el.textContent = `${formatRelativeMY(row.created_at)} oleh ${who}`;
}

// ─── Infaq glimpse ──────────────────────────────────────────────────────────
// Deliberately narrower than ringkasan.js's loadStats() (bulan ini only, no
// bulan lepas/tahun) — this is a glance, ringkasan.html stays the full view.
async function loadInfaqOverview() {
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;

    const [kutipanRes, belanjaRes, projectRes] = await Promise.all([
        db.from('infaq_kutipan_mingguan').select('jumlah').eq('tahun', year).eq('bulan', month),
        db.from('infaq_perbelanjaan_bulanan').select('jumlah').eq('tahun', year).eq('bulan', month),
        db.from('infaq_projects').select('*').eq('is_active', true).single(),
    ]);

    const sum = (rows) => (rows || []).reduce((s, r) => s + Number(r.jumlah), 0);
    document.getElementById('infaq-kutipan-ini').textContent = formatRM(sum(kutipanRes.data));
    document.getElementById('infaq-belanja-ini').textContent = formatRM(sum(belanjaRes.data));

    const project = projectRes.data;
    if (projectRes.error || !project) {
        document.getElementById('infaq-project-card').style.display = 'none';
        document.getElementById('infaq-no-project-card').style.display = '';
        return;
    }

    const { data: donations } = await db.from('infaq_projek_kutipan').select('jumlah').eq('project_id', project.id);
    const terkumpul  = (donations || []).reduce((s, r) => s + Number(r.jumlah), 0);
    const peratusan  = project.target_amount > 0 ? Math.round((terkumpul / project.target_amount) * 100) : 0;

    document.getElementById('infaq-project-card').style.display = '';
    document.getElementById('infaq-no-project-card').style.display = 'none';
    document.getElementById('infaq-project-name').textContent = project.name;
    document.getElementById('infaq-project-progress-fill').style.width = `${Math.min(100, peratusan)}%`;
    document.getElementById('infaq-project-progress-text').textContent =
        `${formatRM(terkumpul)} daripada ${formatRM(project.target_amount)} (${peratusan}%)`;
}
