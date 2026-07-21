// ─────────────────────────────────────────────────────────────────────────────
// Shared across every admin/infaq/*.js page — permission gate + small
// formatters/helpers, loaded after app.js and before each page's own script.
// ─────────────────────────────────────────────────────────────────────────────

const INFAQ_METHOD_LABELS = {
    tunai:  'Tunai / Tabung',
    online: 'Pindahan Bank',
    qr:     'QR / DuitNow',
    lain:   'Lain-lain',
};

function formatRM(amount) {
    return 'RM ' + Number(amount || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Every infaq page calls this right after requireAuth(), e.g.:
//   const session = await requireAuth();
//   if (!session) return;
//   if (!(await requireInfaqAccess())) return;
// Toasts + redirects on denial and returns false; returns true if allowed.
async function requireInfaqAccess() {
    if (currentAdmin.role === 'super_admin' || currentAdmin.permissions?.infaq) return true;
    showToast('Akses ditolak. Anda tiada kebenaran modul Infaq.', 'error');
    setTimeout(() => window.location.replace(defaultLandingPageFor(currentAdmin) || '/admin/index.html'), 2000);
    return false;
}

// Populates a <select> with every infaq_projects row (active first, newest
// first within each group) — used by kutipan.js's entry form. Inactive
// (completed) projects stay selectable so an old donation's earmark can
// still be viewed/edited correctly after the project itself is done.
async function populateProjectSelect(selectEl, { includeEmpty = true, emptyLabel = '— Kutipan Am (bukan projek) —' } = {}) {
    const { data, error } = await db
        .from('infaq_projects')
        .select('id, name, is_active')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });
    if (error) { selectEl.innerHTML = includeEmpty ? `<option value="">${escapeHtml(emptyLabel)}</option>` : ''; return []; }
    const projects = data || [];
    selectEl.innerHTML =
        (includeEmpty ? `<option value="">${escapeHtml(emptyLabel)}</option>` : '') +
        projects.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}${p.is_active ? '' : ' (Selesai)'}</option>`).join('');
    return projects;
}
