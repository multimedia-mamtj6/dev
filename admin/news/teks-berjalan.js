// ─── State ────────────────────────────────────────────────────────────────────
let allTicker      = [];
let deletingTickerId = null;
let cachedSettings = {};

const TICKER_MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // Malaysia is UTC+8, no DST — same constant as api/publish-news.js

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
    const session = await requireAuth();
    if (!session) return;
    if (!(await requireNewsAccess())) return;

    const canWrite = canWriteModule('news');
    document.getElementById('add-ticker-btn').style.display = canWrite ? '' : 'none';
    document.getElementById('publish-ticker-btn').style.display = canWrite ? '' : 'none';
    document.getElementById('save-settings-btn').style.display = canWrite ? '' : 'none';
    document.getElementById('setting-default-line').disabled = !canWrite;

    await Promise.all([
        loadTicker(),
        loadLastPublishedNewsNote('publish_moving_text', 'last-published-ticker'),
        loadTickerSettings(),
    ]);
    renderPreview();
})();

// ─── Load and render ──────────────────────────────────────────────────────────
async function loadTicker() {
    const { data, error } = await db.from('news_ticker').select('*').order('sort_order');
    if (error) {
        showToast('Gagal memuatkan teks berjalan: ' + error.message, 'error');
        return;
    }
    allTicker = data || [];
    renderTable();
}

function tickerLineLabel(row) {
    if (row.kind === 'khutbah') {
        return `${row.prefix || ''}<span style="color:var(--text-muted)">{tajuk khutbah automatik}</span>`;
    }
    return escapeHtml(row.message || '');
}

function renderTable() {
    const tbody = document.getElementById('ticker-tbody');
    const canWrite = canWriteModule('news');

    if (!allTicker.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="state-cell">Tiada baris lagi. Klik "+ Tambah Baris" untuk mula.</td></tr>';
        return;
    }

    tbody.innerHTML = allTicker.map((r, i) => `
        <tr>
            <td data-label="Susun">
                ${canWrite ? `
                <div style="display:flex;gap:0.25rem">
                    <button class="btn btn-ghost btn-sm" title="Naik" onclick="moveTicker('${escapeHtml(r.id)}', -1)" ${i === 0 ? 'disabled' : ''}>&uarr;</button>
                    <button class="btn btn-ghost btn-sm" title="Turun" onclick="moveTicker('${escapeHtml(r.id)}', 1)" ${i === allTicker.length - 1 ? 'disabled' : ''}>&darr;</button>
                </div>
                ` : (i + 1)}
            </td>
            <td data-label="Baris">${tickerLineLabel(r)}</td>
            <td data-label="Jenis">${r.kind === 'khutbah' ? '<span class="news-status-badge news-status-khutbah">Khutbah</span>' : 'Statik'}</td>
            <td data-label="Tempoh" style="font-size:0.8125rem">${tempohLabelTicker(r)}</td>
            <td data-label="Status">${statusBadgeHtml(computeStatus(r))}</td>
            <td data-label="">
                ${canWrite ? `
                <div class="actions">
                    <button class="btn btn-ghost btn-sm" onclick="openEditModal('${escapeHtml(r.id)}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${escapeHtml(r.id)}', '${escapeHtml(r.kind === 'khutbah' ? (r.prefix || 'Khutbah') : (r.message || ''))}')">Padam</button>
                </div>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

function fmtDateShortTicker(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()} ${BULAN_MALAY[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

function tempohLabelTicker(row) {
    if (!row.start_at && !row.end_at) return 'Sentiasa';
    if (row.start_at && row.end_at) return `${fmtDateShortTicker(row.start_at)} — ${fmtDateShortTicker(row.end_at)}`;
    if (row.start_at) return `Dari ${fmtDateShortTicker(row.start_at)}`;
    return `Sehingga ${fmtDateShortTicker(row.end_at)}`;
}

// ─── Reorder (↑/↓ swap sort_order with the adjacent row) ───────────────────────
async function moveTicker(id, direction) {
    const index = allTicker.findIndex(r => r.id === id);
    const swapIndex = index + direction;
    if (index === -1 || swapIndex < 0 || swapIndex >= allTicker.length) return;

    const a = allTicker[index], b = allTicker[swapIndex];
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
        db.from('news_ticker').update({ sort_order: b.sort_order }).eq('id', a.id),
        db.from('news_ticker').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);

    if (e1 || e2) {
        showToast('Gagal menyusun semula: ' + (e1 || e2).message, 'error');
        return;
    }
    await logActivity('news_ticker_reorder', tickerLabelPlain(a), 'Susunan baris diubah.', 'news_activity_log');
    await loadTicker();
    renderPreview();
}

function tickerLabelPlain(row) {
    return row.kind === 'khutbah' ? (row.prefix || 'Khutbah') : (row.message || '');
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────
function toggleKindFields() {
    const kind = document.getElementById('edit-kind').value;
    document.getElementById('static-field-group').style.display  = kind === 'static'  ? '' : 'none';
    document.getElementById('khutbah-field-group').style.display = kind === 'khutbah' ? '' : 'none';
    if (kind === 'khutbah') {
        const title = cachedSettings.khutbah_last_title;
        const fetchedAt = cachedSettings.khutbah_last_fetched_at;
        document.getElementById('khutbah-last-title-note').textContent = title
            ? `Tajuk tersimpan terakhir: "${title}"${fetchedAt ? ` (${formatRelativeMY(fetchedAt)})` : ''}`
            : 'Belum ada tajuk khutbah tersimpan lagi — akan diambil semasa Terbitkan pertama.';
    }
}

function openAddModal() {
    document.getElementById('ticker-modal-title').textContent = 'Tambah Baris';
    document.getElementById('edit-id').value       = '';
    document.getElementById('edit-kind').value      = 'static';
    document.getElementById('edit-message').value   = '';
    document.getElementById('edit-prefix').value    = 'Khutbah Jumaat Minggu Ini: ';
    document.getElementById('edit-start').value     = '';
    document.getElementById('edit-end').value       = '';
    document.getElementById('edit-enabled').checked = true;
    toggleKindFields();
    document.getElementById('ticker-modal').classList.add('open');
}

function openEditModal(id) {
    const r = allTicker.find(x => x.id === id);
    if (!r) return;

    document.getElementById('ticker-modal-title').textContent = 'Edit Baris';
    document.getElementById('edit-id').value       = r.id;
    document.getElementById('edit-kind').value      = r.kind;
    document.getElementById('edit-message').value   = r.message || '';
    document.getElementById('edit-prefix').value    = r.prefix || '';
    document.getElementById('edit-start').value     = r.start_at || '';
    document.getElementById('edit-end').value       = r.end_at || '';
    document.getElementById('edit-enabled').checked = r.enabled !== false;
    toggleKindFields();
    document.getElementById('ticker-modal').classList.add('open');
}

function closeModal() {
    document.getElementById('ticker-modal').classList.remove('open');
}

function handleOverlay(e) {
    if (e.target.id === 'ticker-modal') closeModal();
}

// ─── Save ─────────────────────────────────────────────────────────────────────
function buildTickerDiffText(before, after) {
    const parts = [];
    if (tickerLabelPlain(before) !== tickerLabelPlain(after)) {
        parts.push(`Baris: "${tickerLabelPlain(before)}" → "${tickerLabelPlain(after)}"`);
    }
    if ((before.enabled !== false) !== (after.enabled !== false)) {
        parts.push(`Status: ${before.enabled !== false ? 'Aktif' : 'Dimatikan'} → ${after.enabled !== false ? 'Aktif' : 'Dimatikan'}`);
    }
    if ((before.start_at || null) !== (after.start_at || null) || (before.end_at || null) !== (after.end_at || null)) {
        parts.push('Tempoh dikemaskini');
    }
    return parts.length ? parts.join('; ') : null;
}

async function saveTickerRow() {
    const id      = document.getElementById('edit-id').value.trim();
    const kind    = document.getElementById('edit-kind').value;
    const message = document.getElementById('edit-message').value.trim();
    const prefix  = document.getElementById('edit-prefix').value.trim();
    const startAt = document.getElementById('edit-start').value || null;
    const endAt   = document.getElementById('edit-end').value || null;
    const enabled = document.getElementById('edit-enabled').checked;

    if (kind === 'static' && !message) {
        showToast('Teks baris diperlukan', 'error');
        document.getElementById('edit-message').focus();
        return;
    }

    const before = id ? allTicker.find(r => r.id === id) : null;

    const payload = {
        kind,
        message: kind === 'static' ? message : null,
        prefix:  kind === 'khutbah' ? (prefix || null) : null,
        start_at: startAt,
        end_at:   endAt,
        enabled,
        updated_at: new Date().toISOString(),
    };
    if (!id) {
        payload.sort_order = allTicker.length ? Math.max(...allTicker.map(r => r.sort_order || 0)) + 1 : 0;
    }

    const btn = document.getElementById('ticker-save-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

    let error;
    if (id) {
        ({ error } = await db.from('news_ticker').update(payload).eq('id', id));
    } else {
        ({ error } = await db.from('news_ticker').insert(payload));
    }

    btn.disabled = false; btn.textContent = 'Simpan';

    if (error) {
        showToast('Gagal menyimpan: ' + error.message, 'error');
        return;
    }

    showToast(id ? 'Baris dikemaskini' : 'Baris berjaya ditambah', 'success');
    if (id) {
        const diff = buildTickerDiffText(before, payload);
        if (diff) await logActivity('news_ticker_update', tickerLabelPlain(payload), diff, 'news_activity_log');
    } else {
        await logActivity('news_ticker_create', tickerLabelPlain(payload), 'Baris baharu ditambah.', 'news_activity_log');
    }
    closeModal();
    await loadTicker();
    renderPreview();
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function openDeleteModal(id, label) {
    deletingTickerId = id;
    document.getElementById('delete-label').textContent = label;
    document.getElementById('delete-modal').classList.add('open');
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('open');
    deletingTickerId = null;
}

function handleDeleteOverlay(e) {
    if (e.target.id === 'delete-modal') closeDeleteModal();
}

async function confirmDelete() {
    if (!deletingTickerId) return;
    const btn = document.getElementById('confirm-delete-btn');
    btn.disabled = true; btn.textContent = 'Memadam...';

    const target = allTicker.find(r => r.id === deletingTickerId);
    const { error } = await db.from('news_ticker').delete().eq('id', deletingTickerId);

    btn.disabled = false; btn.textContent = 'Padam';
    if (error) { showToast('Gagal memadam: ' + error.message, 'error'); return; }

    showToast('Baris dipadam', 'success');
    await logActivity('news_ticker_delete', target ? tickerLabelPlain(target) : '(tidak diketahui)', 'Baris dipadam.', 'news_activity_log');
    closeDeleteModal();
    await loadTicker();
    renderPreview();
}

// ─── Tetapan (default_ticker_line) ─────────────────────────────────────────────
async function loadTickerSettings() {
    cachedSettings = await getSettings(['default_ticker_line', 'khutbah_last_title', 'khutbah_last_fetched_at']);
    document.getElementById('setting-default-line').value =
        cachedSettings.default_ticker_line || 'Selamat datang ke Masjid Al-Mukhlisin Taman Jaya 6';
}

async function saveTickerSettings() {
    const value = document.getElementById('setting-default-line').value.trim()
        || 'Selamat datang ke Masjid Al-Mukhlisin Taman Jaya 6';
    const btn = document.getElementById('save-settings-btn');
    btn.disabled = true; btn.textContent = 'Menyimpan...';

    const { error } = await saveSetting('default_ticker_line', value);

    btn.disabled = false; btn.textContent = 'Simpan Tetapan';
    if (error) { showToast('Gagal menyimpan tetapan: ' + error.message, 'error'); return; }

    showToast('Tetapan disimpan', 'success');
    cachedSettings.default_ticker_line = value;
    await logActivity('news_settings_update', 'default_ticker_line', `Baris lalai: ${value}`, 'news_activity_log');
    renderPreview();
}

// ─── "What will actually be published" preview ─────────────────────────────────
// Runs the EXACT same buildMovingTextJson()/isActiveNow() the real endpoint
// runs (admin/news/publish-news-pure.js, loaded as a plain global script —
// see teks-berjalan.html) against the currently-loaded rows, so this can
// never silently drift from what Terbitkan actually publishes. The khutbah
// line uses the cached last-known title (news_settings.khutbah_last_title)
// rather than a live CSV fetch — the real fetch/fail-safe/cache-write only
// happens server-side at publish time (see api/publish-news.js).
function renderPreview() {
    const list = document.getElementById('preview-list');
    if (!list) return;

    const settings = { default_ticker_line: cachedSettings.default_ticker_line };
    const khutbahTitle = cachedSettings.khutbah_last_title || null;
    const mytNow = new Date(Date.now() + TICKER_MYT_OFFSET_MS);

    const out = buildMovingTextJson(allTicker, settings, khutbahTitle, mytNow);
    list.innerHTML = out['moving-text'].map(r => `<li>${escapeHtml(r.Col1)}</li>`).join('');
}
