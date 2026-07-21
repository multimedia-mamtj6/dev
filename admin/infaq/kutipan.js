// ─── State ────────────────────────────────────────────────────────────────────
let donationLimit = 50;
const DONATION_PAGE_SIZE = 50;

let filterFrom    = '';
let filterTo      = '';
let filterProject = '';

let currentRows = [];   // last-loaded page, kept for edit/delete lookups
let deletingId  = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
    const session = await requireAuth();
    if (!session) return;
    if (!(await requireInfaqAccess())) return;
    await Promise.all([populateProjectFilter(), loadDonations()]);
})();

async function populateProjectFilter() {
    const projects = await populateProjectSelect(document.getElementById('filter-project'), { includeEmpty: true, emptyLabel: 'Semua' });
    await populateProjectSelect(document.getElementById('edit-project'));
    return projects;
}

// ─── Load and render ──────────────────────────────────────────────────────────
function applyFilters() {
    filterFrom    = document.getElementById('filter-from').value;
    filterTo      = document.getElementById('filter-to').value;
    filterProject = document.getElementById('filter-project').value;
    donationLimit = DONATION_PAGE_SIZE;
    loadDonations();
}

function resetFilters() {
    document.getElementById('filter-from').value    = '';
    document.getElementById('filter-to').value      = '';
    document.getElementById('filter-project').value = '';
    applyFilters();
}

async function loadDonations() {
    const tbody = document.getElementById('donation-tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="state-cell">Memuatkan...</td></tr>';

    let query = db
        .from('infaq_donations')
        .select('*, infaq_projects(name)')
        .order('donation_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(donationLimit);
    if (filterFrom)    query = query.gte('donation_date', filterFrom);
    if (filterTo)      query = query.lte('donation_date', filterTo);
    if (filterProject) query = query.eq('project_id', filterProject);

    const { data, error } = await query;

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="state-cell">Ralat: ${escapeHtml(error.message)}</td></tr>`;
        return;
    }

    currentRows = data || [];
    renderTable();
    document.getElementById('load-more-btn').style.display = currentRows.length >= donationLimit ? '' : 'none';
}

function renderTable() {
    const tbody = document.getElementById('donation-tbody');
    if (!currentRows.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="state-cell">Tiada rekod kutipan lagi. Klik "+ Catat Kutipan" untuk mula.</td></tr>';
        return;
    }
    tbody.innerHTML = currentRows.map(r => `
        <tr>
            <td data-label="Tarikh">${escapeHtml(formatDateMY(r.donation_date))}</td>
            <td data-label="Jumlah"><strong>${escapeHtml(formatRM(r.amount))}</strong></td>
            <td data-label="Kaedah" style="color:var(--text-muted)">${escapeHtml(INFAQ_METHOD_LABELS[r.method] || r.method)}</td>
            <td data-label="Projek" style="color:var(--text-muted)">${escapeHtml(r.infaq_projects?.name || '—')}</td>
            <td data-label="Nota" style="color:var(--text-muted);font-size:0.8125rem">${escapeHtml(r.note || '—')}</td>
            <td data-label="">
                <div class="actions">
                    <button class="btn btn-ghost btn-sm" onclick="openEditModal('${escapeHtml(r.id)}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${escapeHtml(r.id)}')">Padam</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function loadMore() {
    donationLimit += DONATION_PAGE_SIZE;
    loadDonations();
}

// ─── Add modal ────────────────────────────────────────────────────────────────
function openAddModal() {
    document.getElementById('donation-modal-title').textContent = 'Catat Kutipan';
    document.getElementById('edit-id').value       = '';
    document.getElementById('edit-date').value     = todayString();
    document.getElementById('edit-amount').value   = '';
    document.getElementById('edit-method').value   = 'tunai';
    document.getElementById('edit-project').value  = '';
    document.getElementById('edit-note').value     = '';
    document.getElementById('donation-modal').classList.add('open');
}

// ─── Edit modal ───────────────────────────────────────────────────────────────
function openEditModal(id) {
    const r = currentRows.find(x => x.id === id);
    if (!r) return;
    document.getElementById('donation-modal-title').textContent = 'Edit Kutipan';
    document.getElementById('edit-id').value       = r.id;
    document.getElementById('edit-date').value     = r.donation_date;
    document.getElementById('edit-amount').value   = r.amount;
    document.getElementById('edit-method').value   = r.method;
    document.getElementById('edit-project').value  = r.project_id || '';
    document.getElementById('edit-note').value     = r.note || '';
    document.getElementById('donation-modal').classList.add('open');
}

function closeModal() {
    document.getElementById('donation-modal').classList.remove('open');
}

function handleOverlay(e) {
    if (e.target === document.getElementById('donation-modal')) closeModal();
}

// ─── Save ─────────────────────────────────────────────────────────────────────
function buildDonationDiffText(before, after) {
    const parts = [];
    if (before.donation_date !== after.donation_date) parts.push(`Tarikh: ${before.donation_date} → ${after.donation_date}`);
    if (Number(before.amount) !== Number(after.amount)) parts.push(`Jumlah: ${formatRM(before.amount)} → ${formatRM(after.amount)}`);
    if (before.method !== after.method) parts.push(`Kaedah: ${INFAQ_METHOD_LABELS[before.method]} → ${INFAQ_METHOD_LABELS[after.method]}`);
    if ((before.project_id || null) !== (after.project_id || null)) parts.push('Projek dikemaskini');
    if ((before.note || '') !== (after.note || '')) parts.push('Nota dikemaskini');
    return parts.length ? parts.join('; ') : null;
}

async function saveDonation() {
    const id     = document.getElementById('edit-id').value.trim();
    const date   = document.getElementById('edit-date').value;
    const amount = parseFloat(document.getElementById('edit-amount').value);
    const method = document.getElementById('edit-method').value;
    const projectId = document.getElementById('edit-project').value || null;
    const note   = document.getElementById('edit-note').value.trim();

    if (!date) { showToast('Tarikh diperlukan', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Jumlah mesti lebih daripada 0', 'error'); document.getElementById('edit-amount').focus(); return; }

    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled  = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Menyimpan...';

    const before = id ? currentRows.find(r => r.id === id) : null;
    const payload = {
        donation_date: date, amount, method, project_id: projectId,
        note: note || null, updated_at: new Date().toISOString(),
    };

    let error;
    if (id) ({ error } = await db.from('infaq_donations').update(payload).eq('id', id));
    else    ({ error } = await db.from('infaq_donations').insert(payload));

    saveBtn.disabled  = false;
    saveBtn.textContent = 'Simpan';

    if (error) { showToast('Gagal menyimpan: ' + error.message, 'error'); return; }

    showToast(id ? 'Kutipan dikemaskini' : 'Kutipan berjaya dicatat', 'success');
    const label = `${formatRM(amount)} (${date})`;
    if (id) {
        const diff = buildDonationDiffText(before, payload);
        if (diff) await logActivity('infaq_donation_update', label, diff, 'infaq_activity_log');
    } else {
        await logActivity('infaq_donation_create', label, note || null, 'infaq_activity_log');
    }
    closeModal();
    await loadDonations();
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function openDeleteModal(id) {
    deletingId = id;
    const r = currentRows.find(x => x.id === id);
    document.getElementById('delete-label').textContent = r ? `${formatRM(r.amount)} (${formatDateMY(r.donation_date)})` : '';
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

    const target = currentRows.find(r => r.id === deletingId);
    const { error } = await db.from('infaq_donations').delete().eq('id', deletingId);

    btn.disabled = false;
    btn.textContent = 'Padam';

    if (error) { showToast('Gagal memadam: ' + error.message, 'error'); return; }

    showToast('Rekod kutipan dipadam', 'success');
    if (target) await logActivity('infaq_donation_delete', `${formatRM(target.amount)} (${formatDateMY(target.donation_date)})`, null, 'infaq_activity_log');
    closeDeleteModal();
    await loadDonations();
}
