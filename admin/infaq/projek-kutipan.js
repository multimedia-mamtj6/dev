// ─── State ────────────────────────────────────────────────────────────────────
const projectId = new URLSearchParams(window.location.search).get('project');

let donationLimit = 50;
const DONATION_PAGE_SIZE = 50;

let project     = null;
let currentRows = [];   // last-loaded page, kept for edit/delete lookups
let deletingId  = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
    const session = await requireAuth();
    if (!session) return;
    if (!(await requireInfaqAccess())) return;
    if (!projectId) {
        document.getElementById('project-header').innerHTML =
            '<p style="color:var(--text-muted)">Tiada projek dipilih. <a href="projek.html">Kembali ke senarai projek</a>.</p>';
        return;
    }
    await loadProject();
    await loadDonations();
})();

async function loadProject() {
    const { data, error } = await db.from('infaq_projects').select('*').eq('id', projectId).single();
    if (error || !data) {
        document.getElementById('project-header').innerHTML =
            '<p style="color:var(--text-muted)">Projek tidak dijumpai. <a href="projek.html">Kembali ke senarai projek</a>.</p>';
        return;
    }
    project = data;
    document.title = `Kutipan ${project.name} — Admin MAMTJ6`;
    document.getElementById('project-name').textContent = project.name;
    document.getElementById('project-status').textContent = project.is_active ? 'Aktif' : 'Selesai';
    document.getElementById('project-status').style.color = project.is_active ? 'var(--primary)' : 'var(--text-muted)';
}

// ─── Load and render ──────────────────────────────────────────────────────────
async function loadDonations() {
    const tbody = document.getElementById('donation-tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="state-cell">Memuatkan...</td></tr>';

    const { data, error } = await db
        .from('infaq_projek_kutipan')
        .select('*')
        .eq('project_id', projectId)
        .order('tarikh', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(donationLimit);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="state-cell">Ralat: ${escapeHtml(error.message)}</td></tr>`;
        return;
    }

    currentRows = data || [];
    renderTable();
    document.getElementById('load-more-btn').style.display = currentRows.length >= donationLimit ? '' : 'none';
    await updateProgress();
}

async function updateProgress() {
    if (!project) return;
    const { data } = await db.from('infaq_projek_kutipan').select('jumlah').eq('project_id', projectId);
    const terkumpul = (data || []).reduce((s, r) => s + Number(r.jumlah), 0);
    const peratusan = project.target_amount > 0 ? Math.round((terkumpul / project.target_amount) * 100) : 0;
    document.getElementById('progress-fill').style.width = `${Math.min(100, peratusan)}%`;
    document.getElementById('progress-text').textContent =
        `${formatRM(terkumpul)} daripada ${formatRM(project.target_amount)} (${peratusan}%)`;
}

function renderTable() {
    const tbody = document.getElementById('donation-tbody');
    if (!currentRows.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="state-cell">Tiada rekod kutipan lagi. Klik "+ Catat Kutipan" untuk mula.</td></tr>';
        return;
    }
    tbody.innerHTML = currentRows.map(r => `
        <tr>
            <td data-label="Tarikh">${escapeHtml(formatDateMY(r.tarikh))}</td>
            <td data-label="Jumlah"><strong>${escapeHtml(formatRM(r.jumlah))}</strong></td>
            <td data-label="Keterangan" style="color:var(--text-muted);font-size:0.8125rem">${escapeHtml(r.keterangan || '—')}</td>
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
    document.getElementById('edit-id').value         = '';
    document.getElementById('edit-date').value        = todayString();
    document.getElementById('edit-amount').value      = '';
    document.getElementById('edit-keterangan').value  = '';
    document.getElementById('donation-modal').classList.add('open');
}

// ─── Edit modal ───────────────────────────────────────────────────────────────
function openEditModal(id) {
    const r = currentRows.find(x => x.id === id);
    if (!r) return;
    document.getElementById('donation-modal-title').textContent = 'Edit Kutipan';
    document.getElementById('edit-id').value         = r.id;
    document.getElementById('edit-date').value        = r.tarikh;
    document.getElementById('edit-amount').value      = r.jumlah;
    document.getElementById('edit-keterangan').value  = r.keterangan || '';
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
    if (before.tarikh !== after.tarikh) parts.push(`Tarikh: ${before.tarikh} → ${after.tarikh}`);
    if (Number(before.jumlah) !== Number(after.jumlah)) parts.push(`Jumlah: ${formatRM(before.jumlah)} → ${formatRM(after.jumlah)}`);
    if ((before.keterangan || '') !== (after.keterangan || '')) parts.push('Keterangan dikemaskini');
    return parts.length ? parts.join('; ') : null;
}

async function saveDonation() {
    const id         = document.getElementById('edit-id').value.trim();
    const date       = document.getElementById('edit-date').value;
    const amount     = parseFloat(document.getElementById('edit-amount').value);
    const keterangan = document.getElementById('edit-keterangan').value.trim();

    if (!date) { showToast('Tarikh diperlukan', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Jumlah mesti lebih daripada 0', 'error'); document.getElementById('edit-amount').focus(); return; }

    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled  = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Menyimpan...';

    const before = id ? currentRows.find(r => r.id === id) : null;
    const payload = {
        project_id: projectId, tarikh: date, jumlah: amount,
        keterangan: keterangan || null, updated_at: new Date().toISOString(),
    };

    let error;
    if (id) ({ error } = await db.from('infaq_projek_kutipan').update(payload).eq('id', id));
    else    ({ error } = await db.from('infaq_projek_kutipan').insert(payload));

    saveBtn.disabled  = false;
    saveBtn.textContent = 'Simpan';

    if (error) { showToast('Gagal menyimpan: ' + error.message, 'error'); return; }

    showToast(id ? 'Kutipan dikemaskini' : 'Kutipan berjaya dicatat', 'success');
    const label = `${formatRM(amount)} (${date})`;
    if (id) {
        const diff = buildDonationDiffText(before, payload);
        if (diff) await logActivity('infaq_projek_kutipan_update', label, diff, 'infaq_activity_log');
    } else {
        await logActivity('infaq_projek_kutipan_create', label, keterangan || null, 'infaq_activity_log');
    }
    closeModal();
    await loadDonations();
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function openDeleteModal(id) {
    deletingId = id;
    const r = currentRows.find(x => x.id === id);
    document.getElementById('delete-label').textContent = r ? `${formatRM(r.jumlah)} (${formatDateMY(r.tarikh)})` : '';
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
    const { error } = await db.from('infaq_projek_kutipan').delete().eq('id', deletingId);

    btn.disabled = false;
    btn.textContent = 'Padam';

    if (error) { showToast('Gagal memadam: ' + error.message, 'error'); return; }

    showToast('Rekod kutipan dipadam', 'success');
    if (target) await logActivity('infaq_projek_kutipan_delete', `${formatRM(target.jumlah)} (${formatDateMY(target.tarikh)})`, null, 'infaq_activity_log');
    closeDeleteModal();
    await loadDonations();
}
