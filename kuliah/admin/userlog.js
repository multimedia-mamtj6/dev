let logLimit = 50;
const LOG_PAGE_SIZE = 50;

let filterAdmin  = '';
let filterAction = '';
let filterFrom   = '';
let filterTo     = '';

const ACTION_LABELS = {
    schedule_day_edit:  'Edit Jadual Harian',
    schedule_duplicate: 'Salin Data Bulan',
    schedule_clear:     'Kosongkan Bulan',
    ustaz_create:       'Tambah Penceramah',
    ustaz_update:       'Kemaskini Penceramah',
    ustaz_delete:       'Padam Penceramah',
    admin_create:       'Tambah Pengguna',
    admin_update:       'Kemaskini Pengguna',
    admin_delete:       'Buang Pengguna',
    publish:            'Terbitkan Jadual',
};

(async () => {
    const session = await requireAuth();
    if (!session) return;
    if (currentAdmin.role !== 'super_admin') {
        showToast('Akses ditolak. Halaman ini hanya untuk Super Admin.', 'error');
        setTimeout(() => window.location.replace('/kuliah/admin/dashboard.html'), 2000);
        return;
    }
    await Promise.all([populateFilterOptions(), loadLog()]);
})();

async function populateFilterOptions() {
    const actionSelect = document.getElementById('filter-action');
    actionSelect.innerHTML = '<option value="">Semua Tindakan</option>' +
        Object.entries(ACTION_LABELS).map(([value, label]) =>
            `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`
        ).join('');

    const { data, error } = await db.from('admins').select('email, name').order('email');
    if (error) return; // filter dropdown just stays admin-less; not worth blocking the page over
    const adminSelect = document.getElementById('filter-admin');
    adminSelect.innerHTML = '<option value="">Semua Admin</option>' +
        (data || []).map(u =>
            `<option value="${escapeHtml(u.email)}">${escapeHtml(u.name || u.email)}</option>`
        ).join('');
}

function applyFilters() {
    filterAdmin  = document.getElementById('filter-admin').value;
    filterAction = document.getElementById('filter-action').value;
    filterFrom   = document.getElementById('filter-from').value;
    filterTo     = document.getElementById('filter-to').value;
    logLimit = LOG_PAGE_SIZE;
    loadLog();
}

function resetFilters() {
    document.getElementById('filter-admin').value  = '';
    document.getElementById('filter-action').value = '';
    document.getElementById('filter-from').value   = '';
    document.getElementById('filter-to').value     = '';
    applyFilters();
}

function formatDateTimeMY(iso) {
    const d = new Date(iso);
    return d.toLocaleString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadLog() {
    const tbody = document.getElementById('log-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="state-cell">Memuatkan...</td></tr>';

    let query = db.from('activity_log').select('*').order('created_at', { ascending: false }).limit(logLimit);
    if (filterAdmin)  query = query.eq('actor_email', filterAdmin);
    if (filterAction) query = query.eq('action', filterAction);
    if (filterFrom)   query = query.gte('created_at', new Date(filterFrom + 'T00:00:00').toISOString());
    if (filterTo)     query = query.lte('created_at', new Date(filterTo + 'T23:59:59').toISOString());

    const { data, error } = await query;

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="state-cell">Ralat: ${escapeHtml(error.message)}</td></tr>`;
        return;
    }

    renderLog(data || []);
    document.getElementById('load-more-log-btn').style.display = (data || []).length >= logLimit ? '' : 'none';
}

function renderLog(rows) {
    const tbody = document.getElementById('log-tbody');
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="state-cell">Tiada aktiviti direkod.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map(r => `
        <tr>
            <td data-label="Masa">${escapeHtml(formatDateTimeMY(r.created_at))}</td>
            <td data-label="Admin">${escapeHtml(r.actor_name || r.actor_email)}</td>
            <td data-label="Tindakan">${escapeHtml(ACTION_LABELS[r.action] || r.action)}</td>
            <td data-label="Sasaran">${escapeHtml(r.target_label || '—')}</td>
            <td data-label="Butiran" style="color:var(--text-muted);font-size:0.8125rem">${escapeHtml(r.detail || '—')}</td>
        </tr>
    `).join('');
}

function loadMoreLog() {
    logLimit += LOG_PAGE_SIZE;
    loadLog();
}
