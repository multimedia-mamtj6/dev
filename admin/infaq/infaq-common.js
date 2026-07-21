// ─────────────────────────────────────────────────────────────────────────────
// Shared across every admin/infaq/*.js page — permission gate + small
// formatters/helpers, loaded after app.js and before each page's own script.
// ─────────────────────────────────────────────────────────────────────────────

const BULAN_MY = [
    'Januari','Februari','Mac','April','Mei','Jun',
    'Julai','Ogos','September','Oktober','November','Disember'
];

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
