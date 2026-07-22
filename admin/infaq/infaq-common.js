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

// ─── Publish (shared by kutipan.js / perbelanjaan.js / projek-kutipan.js) ──────
// Each of the 3 infaq data pages owns its own Terbitkan button, right next to
// the data it publishes (2026-07-22) — ringkasan.html used to host all three
// centrally, moved here so editing and publishing happen on the same screen.
// Every call site passes its own `target`/`btnId`, this stays generic.
const PUBLISH_BUTTON_LABELS = {
    'publish-monthly-btn':      'Terbitkan',
    'publish-perbelanjaan-btn': 'Terbitkan',
    'publish-daily-btn':        'Terbitkan',
};

const PUBLISH_NOTE_TARGETS = {
    monthly:      ['publish_monthly', 'last-published-monthly'],
    perbelanjaan: ['publish_perbelanjaan', 'last-published-perbelanjaan'],
    daily:        ['publish_daily', 'last-published-daily'],
};

async function loadLastPublishedInfaqNote(action, elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const { data, error } = await db
        .from('infaq_activity_log')
        .select('created_at, actor_name, actor_email')
        .eq('action', action)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) { el.style.display = 'none'; return; }

    if (!data || !data.length) {
        el.textContent = 'Belum pernah diterbitkan.';
    } else {
        const row = data[0];
        let who = row.actor_name;
        if (!who) {
            const { data: adminRow } = await db.from('admins').select('name').ilike('email', row.actor_email).single();
            who = adminRow?.name || row.actor_email;
        }
        el.textContent = `Terakhir diterbitkan pada ${formatDateTimeMY(row.created_at)} (${formatRelativeMY(row.created_at)}) oleh ${who}`;
    }
    el.style.display = 'block';
}

async function publishInfaq(target, btnId) {
    const btn = document.getElementById(btnId);
    const originalLabel = PUBLISH_BUTTON_LABELS[btnId];
    btn.disabled  = true;
    btn.innerHTML = '<span class="spinner"></span> Menerbitkan...';

    const { data: { session } } = await db.auth.getSession();
    if (!session) {
        showToast('Sesi tamat. Sila log masuk semula.', 'error');
        btn.disabled = false;
        btn.textContent = originalLabel;
        return;
    }

    try {
        const res = await fetch(`/api/publish-infaq?target=${target}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        const data = await res.json();

        if (!res.ok) {
            const detail = data.details ? ` (${data.status}: ${data.details})` : '';
            showToast('Gagal menerbitkan: ' + (data.error || res.statusText) + detail, 'error', 8000);
        } else {
            showToast('Berjaya diterbitkan!', 'success', 6000);
            const [action, elId] = PUBLISH_NOTE_TARGETS[target];
            await loadLastPublishedInfaqNote(action, elId);
        }
    } catch (err) {
        showToast('Ralat sambungan: ' + err.message, 'error');
    }

    btn.disabled = false;
    btn.textContent = originalLabel;
}
