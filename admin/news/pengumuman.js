// ─── State ────────────────────────────────────────────────────────────────────
let allAnnouncements    = [];
let deletingAnnId       = null;
let pendingRemoveImage  = false;

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
    const session = await requireAuth();
    if (!session) return;
    if (!(await requireNewsAccess())) return;

    const canWrite = canWriteModule('news');
    document.getElementById('add-ann-btn').style.display = canWrite ? '' : 'none';
    document.getElementById('publish-announcements-btn').style.display = canWrite ? '' : 'none';
    document.getElementById('save-settings-btn').style.display = canWrite ? '' : 'none';
    document.getElementById('setting-default-image').disabled = !canWrite;

    setupImagePreview();
    await Promise.all([
        loadAnnouncements(),
        loadLastPublishedNewsNote('publish_announcements', 'last-published-announcements'),
        loadAnnouncementSettings(),
    ]);
})();

// ─── Load and render ──────────────────────────────────────────────────────────
async function loadAnnouncements() {
    const { data, error } = await db.from('news_announcements').select('*').order('sort_order');
    if (error) {
        showToast('Gagal memuatkan pengumuman: ' + error.message, 'error');
        return;
    }
    allAnnouncements = data || [];
    renderTable();
}

function jenisLabel(row) {
    if (row.image_url && row.body_text) return 'Imej+Teks';
    if (row.image_url) return 'Imej';
    return 'Teks';
}

function fmtDateShort(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()} ${BULAN_MALAY[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

function tempohLabel(row) {
    if (!row.start_at && !row.end_at) return 'Sentiasa';
    if (row.start_at && row.end_at) return `${fmtDateShort(row.start_at)} — ${fmtDateShort(row.end_at)}`;
    if (row.start_at) return `Dari ${fmtDateShort(row.start_at)}`;
    return `Sehingga ${fmtDateShort(row.end_at)}`;
}

function renderTable() {
    const tbody = document.getElementById('ann-tbody');
    const canWrite = canWriteModule('news');

    if (!allAnnouncements.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="state-cell">Tiada pengumuman lagi. Klik "+ Tambah Pengumuman" untuk mula.</td></tr>';
        return;
    }

    tbody.innerHTML = allAnnouncements.map(r => `
        <tr>
            <td data-label="Susunan">${r.sort_order}</td>
            <td data-label="Tajuk"><strong>${escapeHtml(r.title)}</strong>${r.heading ? `<div style="color:var(--text-muted);font-size:0.75rem">${escapeHtml(r.heading)}</div>` : ''}</td>
            <td data-label="Jenis">${jenisLabel(r)}</td>
            <td data-label="Tempoh" style="font-size:0.8125rem">${tempohLabel(r)}</td>
            <td data-label="Status">${statusBadgeHtml(computeStatus(r))}</td>
            <td data-label="">
                ${canWrite ? `
                <div class="actions">
                    <button class="btn btn-ghost btn-sm" onclick="openEditModal('${escapeHtml(r.id)}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${escapeHtml(r.id)}', '${escapeHtml(r.title)}')">Padam</button>
                </div>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────
function openAddModal() {
    document.getElementById('ann-modal-title').textContent = 'Tambah Pengumuman';
    document.getElementById('edit-id').value        = '';
    document.getElementById('edit-title').value      = '';
    document.getElementById('edit-heading').value    = '';
    document.getElementById('edit-text').value       = '';
    document.getElementById('edit-start').value      = '';
    document.getElementById('edit-end').value        = '';
    document.getElementById('edit-enabled').checked  = true;
    document.getElementById('edit-sort').value       = allAnnouncements.length
        ? Math.max(...allAnnouncements.map(a => a.sort_order || 0)) + 1 : 0;
    document.getElementById('edit-image').value      = '';
    document.getElementById('edit-image-url').value  = '';
    document.getElementById('ann-image-preview').innerHTML = '';
    document.getElementById('ann-image-current-group').style.display = 'none';
    pendingRemoveImage = false;
    document.getElementById('ann-modal').classList.add('open');
}

function openEditModal(id) {
    const r = allAnnouncements.find(x => x.id === id);
    if (!r) return;

    document.getElementById('ann-modal-title').textContent = 'Edit Pengumuman';
    document.getElementById('edit-id').value        = r.id;
    document.getElementById('edit-title').value      = r.title;
    document.getElementById('edit-heading').value    = r.heading || '';
    document.getElementById('edit-text').value       = r.body_text || '';
    document.getElementById('edit-start').value      = r.start_at || '';
    document.getElementById('edit-end').value        = r.end_at || '';
    document.getElementById('edit-enabled').checked  = r.enabled !== false;
    document.getElementById('edit-sort').value       = r.sort_order || 0;
    document.getElementById('edit-image').value      = '';
    document.getElementById('edit-image-url').value  = '';
    document.getElementById('ann-image-preview').innerHTML = '';
    pendingRemoveImage = false;

    if (r.image_url) {
        document.getElementById('ann-image-current-group').style.display = '';
        document.getElementById('ann-image-current-img').src = r.image_url;
    } else {
        document.getElementById('ann-image-current-group').style.display = 'none';
    }

    document.getElementById('ann-modal').classList.add('open');
}

function closeModal() {
    document.getElementById('ann-modal').classList.remove('open');
    pendingRemoveImage = false;
}

function handleOverlay(e) {
    if (e.target.id === 'ann-modal') closeModal();
}

function removeAnnImage() {
    pendingRemoveImage = true;
    document.getElementById('ann-image-current-group').style.display = 'none';
    document.getElementById('edit-image').value     = '';
    document.getElementById('edit-image-url').value = '';
    document.getElementById('ann-image-preview').innerHTML = '';
}

// ─── Save ─────────────────────────────────────────────────────────────────────
// Compares the pre-write row against the values about to be saved and
// returns a human-readable diff string, or null if nothing actually changed.
function buildAnnouncementDiffText(before, after) {
    const parts = [];
    if (before.title !== after.title) parts.push(`Tajuk: "${before.title}" → "${after.title}"`);
    if ((before.enabled !== false) !== (after.enabled !== false)) {
        parts.push(`Status: ${before.enabled !== false ? 'Aktif' : 'Dimatikan'} → ${after.enabled !== false ? 'Aktif' : 'Dimatikan'}`);
    }
    if ((before.start_at || null) !== (after.start_at || null) || (before.end_at || null) !== (after.end_at || null)) {
        parts.push(`Tempoh dikemaskini`);
    }
    if (after.imageChanged) parts.push(after.imageRemoved ? 'Imej dibuang' : 'Imej dikemaskini');
    if ((before.body_text || null) !== (after.body_text || null)) parts.push('Teks dikemaskini');
    return parts.length ? parts.join('; ') : null;
}

async function saveAnnouncement() {
    const id        = document.getElementById('edit-id').value.trim();
    const title     = document.getElementById('edit-title').value.trim();
    const heading   = document.getElementById('edit-heading').value.trim();
    const text      = document.getElementById('edit-text').value.trim();
    const startAt   = document.getElementById('edit-start').value || null;
    const endAt     = document.getElementById('edit-end').value || null;
    const enabled   = document.getElementById('edit-enabled').checked;
    const sortOrder = parseInt(document.getElementById('edit-sort').value, 10) || 0;
    const imageFile = document.getElementById('edit-image').files[0];
    const imageUrlInput = document.getElementById('edit-image-url').value.trim();

    if (!title) { showToast('Tajuk diperlukan', 'error'); document.getElementById('edit-title').focus(); return; }
    if (imageFile && imageUrlInput) { showToast('Pilih sama ada muat naik fail atau URL imej, bukan kedua-dua.', 'error'); return; }

    const before = id ? allAnnouncements.find(a => a.id === id) : null;
    const existingImage = before?.image_url || null;
    const willHaveImage = pendingRemoveImage ? false : !!(imageFile || imageUrlInput || existingImage);
    if (!willHaveImage && !text) {
        showToast('Perlu sekurang-kurangnya imej ATAU teks.', 'error');
        return;
    }

    const saveBtn = document.getElementById('ann-save-btn');
    saveBtn.disabled  = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Menyimpan...';

    let newImageUrl = null;
    if (imageFile) {
        const ext      = imageFile.name.split('.').pop().toLowerCase();
        const safeSlug = title.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().slice(0, 40) || 'pengumuman';
        const filename = `announcements/${safeSlug}-${Date.now()}.${ext}`;

        const { error: uploadErr } = await db.storage
            .from('news-assets')
            .upload(filename, imageFile, { upsert: true, contentType: imageFile.type });

        if (uploadErr) {
            showToast('Gagal muat naik imej: ' + uploadErr.message, 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Simpan';
            return;
        }

        const { data: { publicUrl } } = db.storage.from('news-assets').getPublicUrl(filename);
        newImageUrl = publicUrl;
    } else if (imageUrlInput) {
        newImageUrl = imageUrlInput;
    }

    const payload = {
        title,
        heading:    heading || null,
        body_text:  text || null,
        start_at:   startAt,
        end_at:     endAt,
        enabled,
        sort_order: sortOrder,
        updated_at: new Date().toISOString(),
    };
    if (pendingRemoveImage) {
        payload.image_url = null;
    } else if (newImageUrl) {
        payload.image_url = newImageUrl;
    }

    let error;
    if (id) {
        ({ error } = await db.from('news_announcements').update(payload).eq('id', id));
    } else {
        ({ error } = await db.from('news_announcements').insert(payload));
    }

    saveBtn.disabled = false;
    saveBtn.textContent = 'Simpan';

    if (error) {
        showToast('Gagal menyimpan: ' + error.message, 'error');
        return;
    }

    showToast(id ? 'Pengumuman dikemaskini' : 'Pengumuman berjaya ditambah', 'success');
    if (id) {
        const after = {
            title, enabled, start_at: startAt, end_at: endAt, body_text: text || null,
            imageChanged: pendingRemoveImage || !!newImageUrl, imageRemoved: pendingRemoveImage,
        };
        const diff = buildAnnouncementDiffText(before, after);
        if (diff) await logActivity('news_announcement_update', title, diff, 'news_activity_log');
    } else {
        await logActivity('news_announcement_create', title, 'Pengumuman baharu ditambah.', 'news_activity_log');
    }
    closeModal();
    await loadAnnouncements();
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function openDeleteModal(id, title) {
    deletingAnnId = id;
    document.getElementById('delete-title').textContent = title;
    document.getElementById('delete-modal').classList.add('open');
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('open');
    deletingAnnId = null;
}

function handleDeleteOverlay(e) {
    if (e.target.id === 'delete-modal') closeDeleteModal();
}

async function confirmDelete() {
    if (!deletingAnnId) return;
    const btn = document.getElementById('confirm-delete-btn');
    btn.disabled = true; btn.textContent = 'Memadam...';

    const target = allAnnouncements.find(a => a.id === deletingAnnId);
    const { error } = await db.from('news_announcements').delete().eq('id', deletingAnnId);

    btn.disabled = false; btn.textContent = 'Padam';
    if (error) { showToast('Gagal memadam: ' + error.message, 'error'); return; }

    showToast('Pengumuman dipadam', 'success');
    await logActivity('news_announcement_delete', target?.title || '(tidak diketahui)', 'Pengumuman dipadam.', 'news_activity_log');
    closeDeleteModal();
    await loadAnnouncements();
}

// ─── Image preview before upload ──────────────────────────────────────────────
function setupImagePreview() {
    document.getElementById('edit-image').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) { document.getElementById('ann-image-preview').innerHTML = ''; return; }
        const reader = new FileReader();
        reader.onload = ev => {
            document.getElementById('ann-image-preview').innerHTML =
                `<img src="${ev.target.result}" class="preview-img" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    });
}

// ─── Tetapan (default_image) ──────────────────────────────────────────────────
async function loadAnnouncementSettings() {
    document.getElementById('setting-default-image').value = await getSetting('default_image', '/news/default.svg');
}

async function saveAnnouncementSettings() {
    const value = document.getElementById('setting-default-image').value.trim() || '/news/default.svg';
    const btn = document.getElementById('save-settings-btn');
    btn.disabled = true; btn.textContent = 'Menyimpan...';

    const { error } = await saveSetting('default_image', value);

    btn.disabled = false; btn.textContent = 'Simpan Tetapan';
    if (error) { showToast('Gagal menyimpan tetapan: ' + error.message, 'error'); return; }

    showToast('Tetapan disimpan', 'success');
    await logActivity('news_settings_update', 'default_image', `Imej lalai: ${value}`, 'news_activity_log');
}
