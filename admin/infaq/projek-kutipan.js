// ─── State ────────────────────────────────────────────────────────────────────
const projectId = new URLSearchParams(window.location.search).get('project');

let donationLimit = 50;
const DONATION_PAGE_SIZE = 50;

let project     = null;
let currentRows = [];   // last-loaded page, kept for edit/delete lookups
let totalCount  = 0;    // all rows for this project, regardless of donationLimit — used to number rows stably (oldest = Bil. 1), refreshed every loadDonations() call so it never goes stale after an add/edit/delete
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
    document.getElementById('add-donation-btn').style.display = canWriteModule('infaq') ? '' : 'none';
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

    const launchInfo = document.getElementById('project-launch-info');
    if (project.launch_date) {
        const days = daysSince(project.launch_date);
        launchInfo.textContent = `Dilancarkan: ${formatDateMY(project.launch_date)} — ${days} hari sejak dilancarkan`;
        launchInfo.style.display = '';
    } else {
        launchInfo.style.display = 'none';
    }

    // daily.json always reflects whichever ONE project is currently active —
    // only show the publish control here when that's this project, so
    // Terbitkan is never offered from a completed project's page (it would
    // silently publish a different project's data, not this one).
    if (project.is_active) {
        document.getElementById('publish-daily-btn').style.display = canWriteModule('infaq') ? '' : 'none';
        await loadLastPublishedInfaqNote('publish_daily', 'last-published-daily');
    }
}

// ─── Load and render ──────────────────────────────────────────────────────────
async function loadDonations() {
    const tbody = document.getElementById('donation-tbody');
    const loadMoreBtn = document.getElementById('load-more-btn');

    // Only blank the table on the true first load (nothing on screen yet).
    // Re-fetches triggered by loadMore()/save/delete keep the existing rows
    // visible instead — collapsing to a 1-row placeholder mid-fetch shrinks
    // the page out from under the scroll position (the browser clamps
    // scroll to the new, much shorter height), which yanks a scrolled-down
    // admin back to the top; it never restores after the table re-expands.
    // Loading feedback for those re-fetches comes from the button itself.
    const isInitialLoad = currentRows.length === 0;
    if (isInitialLoad) {
        tbody.innerHTML = '<tr><td colspan="5" class="state-cell">Memuatkan...</td></tr>';
    } else if (loadMoreBtn.style.display !== 'none') {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Memuatkan...';
    }

    const [pageRes, countRes] = await Promise.all([
        db.from('infaq_projek_kutipan')
            .select('*')
            .eq('project_id', projectId)
            .order('tarikh', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(donationLimit),
        db.from('infaq_projek_kutipan')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId),
    ]);

    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Tunjuk 50 lagi';

    if (pageRes.error) {
        tbody.innerHTML = `<tr><td colspan="5" class="state-cell">Ralat: ${escapeHtml(pageRes.error.message)}</td></tr>`;
        return;
    }

    currentRows = pageRes.data || [];
    totalCount  = countRes.count ?? currentRows.length;
    renderTable();
    loadMoreBtn.style.display = currentRows.length >= donationLimit ? '' : 'none';
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
        tbody.innerHTML = '<tr><td colspan="5" class="state-cell">Tiada rekod kutipan lagi. Klik "+ Catat Kutipan" untuk mula.</td></tr>';
        return;
    }
    // currentRows is newest-first, so the top row (index 0) is the most
    // recently recorded donation — it gets the highest Bil., and the last
    // row gets the lowest. This makes each row's number a permanent,
    // stable reference to that one record (oldest ever recorded = Bil. 1),
    // rather than a display position that shifts as newer rows are added.
    tbody.innerHTML = currentRows.map((r, idx) => `
        <tr>
            <td data-label="Bil.">${totalCount - idx}</td>
            <td data-label="Tarikh">${escapeHtml(formatDateMY(r.tarikh))}</td>
            <td data-label="Jumlah"><strong>${escapeHtml(formatRM(r.jumlah))}</strong></td>
            <td data-label="Keterangan" style="color:var(--text-muted);font-size:0.8125rem">${escapeHtml(r.keterangan || '—')}</td>
            <td data-label="">
                ${canWriteModule('infaq') ? `
                <div class="actions">
                    <button class="btn btn-ghost btn-sm" onclick="openEditModal('${escapeHtml(r.id)}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${escapeHtml(r.id)}')">Padam</button>
                </div>
                ` : ''}
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
