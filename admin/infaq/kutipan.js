// ─── State ────────────────────────────────────────────────────────────────────
// infaq_kutipan_mingguan is small (~1 row/week, well under 1000 rows even
// after a decade) — fetch everything once and filter/group client-side,
// rather than the server-side pagination userlog.js/the old kutipan.js used
// for the unbounded per-donation model this replaces.
let allRows    = [];
let filterYear = '';
let editingRow = null;
let deletingId = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
    const session = await requireAuth();
    if (!session) return;
    if (!(await requireInfaqAccess())) return;
    await loadRows();
})();

async function loadRows() {
    const tbody = document.getElementById('kutipan-tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="state-cell">Memuatkan...</td></tr>';

    const { data, error } = await db
        .from('infaq_kutipan_mingguan')
        .select('*')
        .order('tahun', { ascending: false })
        .order('bulan', { ascending: false })
        .order('minggu', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="state-cell">Ralat: ${escapeHtml(error.message)}</td></tr>`;
        return;
    }

    allRows = data || [];
    populateYearFilter();
    renderTable();
}

function populateYearFilter() {
    const sel = document.getElementById('filter-year');
    const years = Array.from(new Set(allRows.map(r => r.tahun)));
    const currentYear = new Date().getFullYear();
    if (!years.includes(currentYear)) years.push(currentYear);
    years.sort((a, b) => b - a);

    const previousValue = filterYear || String(currentYear);
    sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    sel.value = years.includes(Number(previousValue)) ? previousValue : String(years[0]);
    filterYear = sel.value;
}

function applyYearFilter() {
    filterYear = document.getElementById('filter-year').value;
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('kutipan-tbody');
    const rows = allRows.filter(r => String(r.tahun) === String(filterYear));

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="state-cell">Tiada rekod kutipan untuk tahun ini. Klik "+ Catat Kutipan" untuk mula.</td></tr>';
        return;
    }

    document.getElementById('year-total').textContent = formatRM(rows.reduce((s, r) => s + Number(r.jumlah), 0));

    // rows are already ordered tahun desc, bulan desc, minggu desc, so
    // same-month rows are always adjacent within one year's filtered list —
    // a single forward scan is enough to group them and inject one
    // month-subtotal row per group. `.group-row` has its own mobile CSS
    // override (style.css) so it renders as a single full-width band
    // instead of the normal per-cell card layout.
    let html = '';
    let lastBulan = null;
    rows.forEach(r => {
        if (r.bulan !== lastBulan) {
            const monthTotal = rows.filter(x => x.bulan === r.bulan).reduce((s, x) => s + Number(x.jumlah), 0);
            html += `<tr class="group-row">
                <td colspan="5">${escapeHtml(BULAN_MY[r.bulan - 1])} ${r.tahun} — Jumlah Bulanan: ${escapeHtml(formatRM(monthTotal))}</td>
            </tr>`;
            lastBulan = r.bulan;
        }
        html += `<tr>
            <td data-label="Tahun">${r.tahun}</td>
            <td data-label="Bulan">${escapeHtml(BULAN_MY[r.bulan - 1])}</td>
            <td data-label="Minggu">Minggu ${r.minggu}</td>
            <td data-label="Jumlah"><strong>${escapeHtml(formatRM(r.jumlah))}</strong></td>
            <td data-label="">
                <div class="actions">
                    <button class="btn btn-ghost btn-sm" onclick="openEditModal('${escapeHtml(r.id)}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${escapeHtml(r.id)}')">Padam</button>
                </div>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

// ─── Add modal ────────────────────────────────────────────────────────────────
function openAddModal() {
    editingRow = null;
    document.getElementById('kutipan-modal-title').textContent = 'Catat Kutipan Mingguan';
    document.getElementById('edit-id').value     = '';
    document.getElementById('edit-tahun').value  = filterYear || new Date().getFullYear();
    document.getElementById('edit-bulan').value  = new Date().getMonth() + 1;
    document.getElementById('edit-minggu').value = '1';
    document.getElementById('edit-jumlah').value = '';
    document.getElementById('kutipan-modal').classList.add('open');
}

// ─── Edit modal ───────────────────────────────────────────────────────────────
function openEditModal(id) {
    const r = allRows.find(x => x.id === id);
    if (!r) return;
    editingRow = r;
    document.getElementById('kutipan-modal-title').textContent = 'Edit Kutipan Mingguan';
    document.getElementById('edit-id').value     = r.id;
    document.getElementById('edit-tahun').value  = r.tahun;
    document.getElementById('edit-bulan').value  = r.bulan;
    document.getElementById('edit-minggu').value = r.minggu;
    document.getElementById('edit-jumlah').value = r.jumlah;
    document.getElementById('kutipan-modal').classList.add('open');
}

function closeModal() {
    document.getElementById('kutipan-modal').classList.remove('open');
}

function handleOverlay(e) {
    if (e.target === document.getElementById('kutipan-modal')) closeModal();
}

// ─── Save ─────────────────────────────────────────────────────────────────────
function labelFor(r) {
    return `${BULAN_MY[r.bulan - 1]} ${r.tahun}, Minggu ${r.minggu}`;
}

async function saveRow() {
    const id     = document.getElementById('edit-id').value.trim();
    const tahun  = parseInt(document.getElementById('edit-tahun').value, 10);
    const bulan  = parseInt(document.getElementById('edit-bulan').value, 10);
    const minggu = parseInt(document.getElementById('edit-minggu').value, 10);
    const jumlah = parseFloat(document.getElementById('edit-jumlah').value);

    if (!tahun || tahun < 2000) { showToast('Tahun tidak sah', 'error'); return; }
    if (!jumlah || jumlah <= 0) { showToast('Jumlah mesti lebih daripada 0', 'error'); document.getElementById('edit-jumlah').focus(); return; }

    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled  = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Menyimpan...';

    // Upsert on (tahun, bulan, minggu) — matches the real workflow: the
    // committee just records "this week's total," they shouldn't need to
    // remember whether a row for that week already exists. Editing an
    // existing row (via the Edit button) still goes through the same path
    // since tahun/bulan/minggu are the natural key either way.
    const payload = { tahun, bulan, minggu, jumlah, updated_at: new Date().toISOString() };
    const { error } = await db
        .from('infaq_kutipan_mingguan')
        .upsert(payload, { onConflict: 'tahun,bulan,minggu' });

    saveBtn.disabled  = false;
    saveBtn.textContent = 'Simpan';

    if (error) { showToast('Gagal menyimpan: ' + error.message, 'error'); return; }

    showToast('Kutipan mingguan disimpan', 'success');
    const label = labelFor({ tahun, bulan, minggu });
    if (editingRow && Number(editingRow.jumlah) !== jumlah) {
        await logActivity('infaq_kutipan_mingguan_update', label, `Jumlah: ${formatRM(editingRow.jumlah)} → ${formatRM(jumlah)}`, 'infaq_activity_log');
    } else if (!editingRow) {
        await logActivity('infaq_kutipan_mingguan_create', label, formatRM(jumlah), 'infaq_activity_log');
    }
    closeModal();
    await loadRows();
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function openDeleteModal(id) {
    deletingId = id;
    const r = allRows.find(x => x.id === id);
    document.getElementById('delete-label').textContent = r ? labelFor(r) : '';
    document.getElementById('delete-modal').classList.add('open');
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('open');
    deletingId = null;
}

function handleDeleteOverlay(e) {
    if (e.target === document.getElementById('delete-modal')) closeDeleteModal();
}

async function confirmDelete() {
    if (!deletingId) return;
    const btn = document.getElementById('confirm-delete-btn');
    btn.disabled = true;
    btn.textContent = 'Memadam...';

    const target = allRows.find(r => r.id === deletingId);
    const { error } = await db.from('infaq_kutipan_mingguan').delete().eq('id', deletingId);

    btn.disabled = false;
    btn.textContent = 'Padam';

    if (error) { showToast('Gagal memadam: ' + error.message, 'error'); return; }

    showToast('Rekod kutipan dipadam', 'success');
    if (target) await logActivity('infaq_kutipan_mingguan_delete', labelFor(target), null, 'infaq_activity_log');
    closeDeleteModal();
    await loadRows();
}
