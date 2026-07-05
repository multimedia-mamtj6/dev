// ─── State ────────────────────────────────────────────────────────────────────
let allUstaz   = [];
let deletingId = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
    const session = await requireAuth();
    if (!session) return;
    await loadUstaz();
    setupPosterPreview();
}

// ─── Load and render ──────────────────────────────────────────────────────────
async function loadUstaz() {
    const { data, error } = await db
        .from('ustaz')
        .select('*')
        .order('full_name');

    if (error) {
        showToast('Gagal memuatkan senarai penceramah: ' + error.message, 'error');
        return;
    }
    allUstaz = data || [];
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('ustaz-tbody');

    if (allUstaz.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="state-cell">Tiada penceramah lagi. Klik "+ Tambah Penceramah" untuk mula.</td></tr>';
        return;
    }

    tbody.innerHTML = allUstaz.map(u => `
        <tr>
            <td data-label="Poster">
                ${u.poster_url
                    ? `<img src="${escapeHtml(u.poster_url)}" class="poster-thumb" alt="Poster ${escapeHtml(u.short_name)}" loading="lazy">`
                    : `<div class="no-poster">Tiada poster</div>`
                }
            </td>
            <td data-label="Nama Penuh"><strong>${escapeHtml(u.full_name)}</strong></td>
            <td data-label="Nama Ringkas" style="color:var(--text-muted)">${escapeHtml(u.short_name)}</td>
            <td data-label="Tajuk Kuliah" style="color:var(--text-muted);font-size:0.8125rem">${escapeHtml(u.tajuk_kuliah || '—')}</td>
            <td data-label="">
                <div class="actions">
                    <button class="btn btn-ghost btn-sm" onclick="openEditModal('${escapeHtml(u.id)}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${escapeHtml(u.id)}', '${escapeHtml(u.full_name)}')">Padam</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ─── Add modal ────────────────────────────────────────────────────────────────
function openAddModal() {
    document.getElementById('ustaz-modal-title').textContent = 'Tambah Penceramah';
    document.getElementById('edit-id').value        = '';
    document.getElementById('edit-fullname').value  = '';
    document.getElementById('edit-shortname').value = '';
    document.getElementById('edit-topic').value     = '';
    document.getElementById('edit-poster').value    = '';
    document.getElementById('poster-preview').innerHTML = '';
    document.getElementById('poster-current').textContent = '';
    document.getElementById('ustaz-modal').classList.add('open');
}

// ─── Edit modal ───────────────────────────────────────────────────────────────
function openEditModal(id) {
    const u = allUstaz.find(x => x.id === id);
    if (!u) return;

    document.getElementById('ustaz-modal-title').textContent = 'Edit Penceramah';
    document.getElementById('edit-id').value        = u.id;
    document.getElementById('edit-fullname').value  = u.full_name;
    document.getElementById('edit-shortname').value = u.short_name;
    document.getElementById('edit-topic').value     = u.tajuk_kuliah || '';
    document.getElementById('edit-poster').value    = '';
    document.getElementById('poster-preview').innerHTML = '';
    document.getElementById('poster-current').textContent =
        u.poster_url ? 'Poster semasa ada. Muat naik baru untuk menggantikan.' : 'Tiada poster semasa.';

    document.getElementById('ustaz-modal').classList.add('open');
}

function closeUstazModal() {
    document.getElementById('ustaz-modal').classList.remove('open');
}

function handleUstazOverlay(e) {
    if (e.target === document.getElementById('ustaz-modal')) closeUstazModal();
}

// ─── Save ustaz ───────────────────────────────────────────────────────────────
async function saveUstaz() {
    const id        = document.getElementById('edit-id').value.trim();
    const fullName  = document.getElementById('edit-fullname').value.trim();
    const shortName = document.getElementById('edit-shortname').value.trim();
    const topic     = document.getElementById('edit-topic').value.trim();
    const posterFile = document.getElementById('edit-poster').files[0];

    if (!fullName) {
        showToast('Nama penuh diperlukan', 'error');
        document.getElementById('edit-fullname').focus();
        return;
    }
    if (!shortName) {
        showToast('Nama ringkas diperlukan', 'error');
        document.getElementById('edit-shortname').focus();
        return;
    }

    const saveBtn = document.getElementById('ustaz-save-btn');
    saveBtn.disabled  = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Menyimpan...';

    let posterUrl = null;

    // Upload poster to Supabase Storage if a file was selected
    if (posterFile) {
        const ext      = posterFile.name.split('.').pop().toLowerCase();
        const safeName = shortName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const filename = `posters/${safeName}-${Date.now()}.${ext}`;

        const { error: uploadErr } = await db.storage
            .from('kuliah-assets')
            .upload(filename, posterFile, { upsert: true, contentType: posterFile.type });

        if (uploadErr) {
            showToast('Gagal muat naik poster: ' + uploadErr.message, 'error');
            saveBtn.disabled  = false;
            saveBtn.textContent = 'Simpan';
            return;
        }

        const { data: { publicUrl } } = db.storage
            .from('kuliah-assets')
            .getPublicUrl(filename);
        posterUrl = publicUrl;
    }

    const payload = {
        full_name:    fullName,
        short_name:   shortName,
        tajuk_kuliah: topic || null,
        updated_at:   new Date().toISOString(),
    };
    if (posterUrl) payload.poster_url = posterUrl;

    let error;
    if (id) {
        ({ error } = await db.from('ustaz').update(payload).eq('id', id));
    } else {
        ({ error } = await db.from('ustaz').insert(payload));
    }

    saveBtn.disabled  = false;
    saveBtn.textContent = 'Simpan';

    if (error) {
        showToast('Gagal menyimpan: ' + error.message, 'error');
        return;
    }

    showToast(id ? 'Penceramah dikemaskini' : 'Penceramah berjaya ditambah', 'success');
    closeUstazModal();
    await loadUstaz();
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function openDeleteModal(id, name) {
    deletingId = id;
    document.getElementById('delete-name').textContent = name;
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
    btn.disabled  = true;
    btn.textContent = 'Menyemak...';

    // Guard: check if this ustaz is still referenced in the schedule
    const { count, error: countErr } = await db
        .from('schedule')
        .select('id', { count: 'exact', head: true })
        .or(`subuh_ustaz_id.eq.${deletingId},maghrib_ustaz_id.eq.${deletingId}`);

    if (countErr) {
        showToast('Gagal menyemak jadual: ' + countErr.message, 'error');
        btn.disabled  = false;
        btn.textContent = 'Padam';
        return;
    }

    if (count > 0) {
        showToast(
            `Tidak boleh dipadam — penceramah ini masih ada dalam ${count} sesi jadual. Alih keluar dari jadual dahulu.`,
            'error', 7000
        );
        btn.disabled  = false;
        btn.textContent = 'Padam';
        closeDeleteModal();
        return;
    }

    btn.textContent = 'Memadam...';
    const { error } = await db.from('ustaz').delete().eq('id', deletingId);

    btn.disabled  = false;
    btn.textContent = 'Padam';

    if (error) {
        showToast('Gagal memadam: ' + error.message, 'error');
        return;
    }

    showToast('Penceramah berjaya dipadam', 'success');
    closeDeleteModal();
    await loadUstaz();
}

// ─── Poster preview before upload ─────────────────────────────────────────────
function setupPosterPreview() {
    document.getElementById('edit-poster').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) {
            document.getElementById('poster-preview').innerHTML = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = ev => {
            document.getElementById('poster-preview').innerHTML =
                `<img src="${ev.target.result}" class="preview-img" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
init();
