let logLimit = 50;
const LOG_PAGE_SIZE = 50;

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
        setTimeout(() => window.location.replace('dashboard.html'), 2000);
        return;
    }
    await loadLog();
})();

function formatDateTimeMY(iso) {
    const d = new Date(iso);
    return d.toLocaleString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadLog() {
    const tbody = document.getElementById('log-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="state-cell">Memuatkan...</td></tr>';

    const { data, error } = await db.from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(logLimit);

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
