// ─── State ────────────────────────────────────────────────────────────────────
let allProjects  = [];
let activatingId = null;
let deletingId   = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
    const session = await requireAuth();
    if (!session) return;
    if (!(await requireInfaqAccess())) return;
    document.getElementById('add-projek-btn').style.display = canWriteModule('infaq') ? '' : 'none';
    await loadProjects();
})();

// ─── Load and render ──────────────────────────────────────────────────────────
// Projects are a small, bounded list (like ustaz) — but "Terkumpul" needs a
// sum over infaq_projek_kutipan, so one extra query fetches every
// project-linked donation's jumlah in a single round-trip and reduces it
// client-side into a per-project total, rather than one query per project.
async function loadProjects() {
    const tbody = document.getElementById('project-tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="state-cell">Memuatkan...</td></tr>';

    const [{ data: projects, error: projError }, { data: donations, error: donError }] = await Promise.all([
        db.from('infaq_projects').select('*').order('is_active', { ascending: false }).order('created_at', { ascending: false }),
        db.from('infaq_projek_kutipan').select('project_id, jumlah'),
    ]);

    if (projError) {
        tbody.innerHTML = `<tr><td colspan="6" class="state-cell">Ralat: ${escapeHtml(projError.message)}</td></tr>`;
        return;
    }
    if (donError) console.error('Gagal memuatkan jumlah kutipan projek:', donError.message);

    const totals = {};
    (donations || []).forEach(d => { totals[d.project_id] = (totals[d.project_id] || 0) + Number(d.jumlah); });

    allProjects = (projects || []).map(p => ({ ...p, terkumpul: totals[p.id] || 0 }));
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('project-tbody');
    if (!allProjects.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="state-cell">Tiada projek lagi. Klik "+ Tambah Projek" untuk mula.</td></tr>';
        return;
    }
    tbody.innerHTML = allProjects.map(p => {
        const peratusan = p.target_amount > 0 ? Math.round((p.terkumpul / p.target_amount) * 100) : 0;
        return `
        <tr>
            <td data-label="Nama Projek"><strong>${escapeHtml(p.name)}</strong></td>
            <td data-label="Sasaran">${escapeHtml(formatRM(p.target_amount))}</td>
            <td data-label="Terkumpul">${escapeHtml(formatRM(p.terkumpul))}</td>
            <td data-label="Peratusan">${peratusan}%</td>
            <td data-label="Status">${p.is_active
                ? '<span style="color:var(--primary);font-weight:600">Aktif</span>'
                : '<span style="color:var(--text-muted)">Selesai</span>'}</td>
            <td data-label="">
                <div class="actions">
                    <a class="btn btn-ghost btn-sm" href="projek-kutipan.html?project=${encodeURIComponent(p.id)}">Lihat Kutipan</a>
                    ${canWriteModule('infaq') ? `
                        ${p.is_active ? '' : `<button class="btn btn-ghost btn-sm" onclick="openActivateModal('${escapeHtml(p.id)}')">Jadikan Aktif</button>`}
                        <button class="btn btn-ghost btn-sm" onclick="openEditModal('${escapeHtml(p.id)}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${escapeHtml(p.id)}')">Padam</button>
                    ` : ''}
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ─── Add modal ────────────────────────────────────────────────────────────────
function openAddModal() {
    document.getElementById('project-modal-title').textContent = 'Tambah Projek';
    document.getElementById('edit-id').value     = '';
    document.getElementById('edit-name').value   = '';
    document.getElementById('edit-target').value = '';
    document.getElementById('project-modal').classList.add('open');
}

// ─── Edit modal ───────────────────────────────────────────────────────────────
function openEditModal(id) {
    const p = allProjects.find(x => x.id === id);
    if (!p) return;
    document.getElementById('project-modal-title').textContent = 'Edit Projek';
    document.getElementById('edit-id').value     = p.id;
    document.getElementById('edit-name').value   = p.name;
    document.getElementById('edit-target').value = p.target_amount;
    document.getElementById('project-modal').classList.add('open');
}

function closeModal() {
    document.getElementById('project-modal').classList.remove('open');
}

function handleOverlay(e) {
    if (e.target === document.getElementById('project-modal')) closeModal();
}

// ─── Save ─────────────────────────────────────────────────────────────────────
function buildProjectDiffText(before, after) {
    const parts = [];
    if (before.name !== after.name) parts.push(`Nama: "${before.name}" → "${after.name}"`);
    if (Number(before.target_amount) !== Number(after.target_amount)) {
        parts.push(`Sasaran: ${formatRM(before.target_amount)} → ${formatRM(after.target_amount)}`);
    }
    return parts.length ? parts.join('; ') : null;
}

async function saveProject() {
    const id     = document.getElementById('edit-id').value.trim();
    const name   = document.getElementById('edit-name').value.trim();
    const target = parseFloat(document.getElementById('edit-target').value);

    if (!name) { showToast('Nama projek diperlukan', 'error'); document.getElementById('edit-name').focus(); return; }
    if (!target || target <= 0) { showToast('Sasaran mesti lebih daripada 0', 'error'); document.getElementById('edit-target').focus(); return; }

    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled  = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Menyimpan...';

    const before = id ? allProjects.find(p => p.id === id) : null;
    const payload = { name, target_amount: target, updated_at: new Date().toISOString() };

    let error;
    if (id) {
        ({ error } = await db.from('infaq_projects').update(payload).eq('id', id));
    } else {
        // New projects start inactive by design — activating is a separate,
        // explicit step (openActivateModal) so creating a draft project never
        // silently deactivates whatever is currently active.
        ({ error } = await db.from('infaq_projects').insert({ ...payload, is_active: false }));
    }

    saveBtn.disabled  = false;
    saveBtn.textContent = 'Simpan';

    if (error) { showToast('Gagal menyimpan: ' + error.message, 'error'); return; }

    showToast(id ? 'Projek dikemaskini' : 'Projek berjaya ditambah', 'success');
    if (id) {
        const diff = buildProjectDiffText(before, payload);
        if (diff) await logActivity('infaq_project_update', name, diff, 'infaq_activity_log');
    } else {
        await logActivity('infaq_project_create', name, `Sasaran: ${formatRM(target)}`, 'infaq_activity_log');
    }
    closeModal();
    await loadProjects();
}

// ─── Activate ─────────────────────────────────────────────────────────────────
function openActivateModal(id) {
    activatingId = id;
    const target = allProjects.find(p => p.id === id);
    const current = allProjects.find(p => p.is_active);
    document.getElementById('activate-modal-text').textContent = current
        ? `Projek "${current.name}" akan ditandakan selesai, dan "${target?.name}" akan menjadi projek aktif.`
        : `"${target?.name}" akan menjadi projek aktif.`;
    document.getElementById('activate-modal').classList.add('open');
}

function closeActivateModal() {
    document.getElementById('activate-modal').classList.remove('open');
    activatingId = null;
}

function handleActivateOverlay(e) {
    if (e.target === document.getElementById('activate-modal')) closeActivateModal();
}

async function confirmActivate() {
    if (!activatingId) return;
    const btn = document.getElementById('confirm-activate-btn');
    btn.disabled = true;
    btn.textContent = 'Memproses...';

    const target = allProjects.find(p => p.id === activatingId);
    const current = allProjects.find(p => p.is_active);

    // Deactivate the current active project FIRST, then activate the
    // target — in that order, so the partial unique index on is_active
    // (at most one true) is never transiently violated by two concurrent
    // "true" rows.
    if (current) {
        const { error } = await db.from('infaq_projects')
            .update({ is_active: false, completed_at: new Date().toISOString() })
            .eq('id', current.id);
        if (error) {
            showToast('Gagal menyahaktifkan projek semasa: ' + error.message, 'error');
            btn.disabled = false; btn.textContent = 'Jadikan Aktif';
            return;
        }
    }

    const { error } = await db.from('infaq_projects').update({ is_active: true }).eq('id', activatingId);

    btn.disabled = false;
    btn.textContent = 'Jadikan Aktif';

    if (error) { showToast('Gagal mengaktifkan projek: ' + error.message, 'error'); return; }

    showToast(`Projek "${target?.name}" kini aktif`, 'success');
    await logActivity('infaq_project_activate', target?.name || '(tidak diketahui)',
        current ? `Menggantikan "${current.name}"` : null, 'infaq_activity_log');
    closeActivateModal();
    await loadProjects();
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function openDeleteModal(id) {
    deletingId = id;
    const p = allProjects.find(x => x.id === id);
    document.getElementById('delete-name').textContent = p?.name || '';
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
    btn.textContent = 'Menyemak...';

    // Guard: block deletion while any donation is still earmarked to this
    // project. The FK is ON DELETE SET NULL (wouldn't hard-fail), but
    // silently orphaning a donation's project attribution is a real
    // data-integrity loss worth blocking client-side — same reasoning
    // admin/kuliah/ustaz.js's schedule-reference guard uses.
    const { count, error: countErr } = await db
        .from('infaq_projek_kutipan')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', deletingId);

    if (countErr) {
        showToast('Gagal menyemak rekod kutipan: ' + countErr.message, 'error');
        btn.disabled = false; btn.textContent = 'Padam';
        return;
    }
    if (count > 0) {
        showToast(`Tidak boleh dipadam — ${count} rekod kutipan masih dikaitkan dengan projek ini.`, 'error', 7000);
        btn.disabled = false; btn.textContent = 'Padam';
        closeDeleteModal();
        return;
    }

    btn.textContent = 'Memadam...';
    const target = allProjects.find(p => p.id === deletingId);
    const { error } = await db.from('infaq_projects').delete().eq('id', deletingId);

    btn.disabled = false;
    btn.textContent = 'Padam';

    if (error) { showToast('Gagal memadam: ' + error.message, 'error'); return; }

    showToast('Projek berjaya dipadam', 'success');
    await logActivity('infaq_project_delete', target?.name || '(tidak diketahui)', null, 'infaq_activity_log');
    closeDeleteModal();
    await loadProjects();
}
