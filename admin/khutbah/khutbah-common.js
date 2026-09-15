// ─────────────────────────────────────────────────────────────────────────────
// Shared across every admin/khutbah/*.js page — permission gate, Terbitkan
// plumbing, and settings helpers. Loaded after app.js and before each page's
// own script, same shape as admin/news/news-common.js and
// admin/infaq/infaq-common.js.
// ─────────────────────────────────────────────────────────────────────────────

async function requireKhutbahAccess() {
    return requireModuleAccess('khutbah');
}

// ─── Settings (khutbah_settings key/value table) ─────────────────────────────
// SELECT open to any authenticated admin (RLS, see setup.sql §12); writes
// gated on canWriteModule('khutbah') in the UI and admin_can_write('khutbah')
// in Postgres — same as every other module.

async function getKhutbahSetting(key, fallback = '') {
    const { data, error } = await db.from('khutbah_settings').select('value').eq('key', key).single();
    if (error || !data) return fallback;
    return data.value ?? fallback;
}

async function getKhutbahSettings(keys) {
    const { data, error } = await db.from('khutbah_settings').select('key, value').in('key', keys);
    if (error) return {};
    const out = {};
    (data || []).forEach(r => { out[r.key] = r.value; });
    return out;
}

async function saveKhutbahSetting(key, value) {
    return db.from('khutbah_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
}

// ─── Publish ─────────────────────────────────────────────────────────────────
// Single target (unlike news/infaq splits): POST /api/publish-khutbah with
// the admin's session token. The Mon-9am Vercel cron hits the same endpoint
// with GET + CRON_SECRET instead — see api/publish-khutbah.js.
async function publishKhutbah(btnId) {
    const btn = btnId ? document.getElementById(btnId) : null;
    const session = (await db.auth.getSession()).data.session;
    if (!session) { showToast('Sesi tamat. Sila log masuk semula.', 'error'); return null; }
    if (btn) { btn.disabled = true; btn.textContent = 'Menerbitkan...'; }
    try {
        const res = await fetch('/api/publish-khutbah', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) throw new Error(json.error || `HTTP ${res.status}`);
        showToast(json.unchanged ? 'Diterbitkan (tiada perubahan).' : 'Berjaya diterbitkan.', 'success');
        logActivity('publish_khutbah', json.friday_date || '', json.title || '', 'khutbah_activity_log');
        return json;
    } catch (e) {
        console.error('publishKhutbah failed:', e);
        showToast(`Terbitan gagal: ${e.message}`, 'error');
        return null;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Jana & Terbitkan'; }
    }
}

async function loadLastPublishedKhutbahNote(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const { data, error } = await db.from('khutbah_activity_log')
        .select('created_at, target_label, detail')
        .eq('action', 'publish_khutbah')
        .order('created_at', { ascending: false })
        .limit(1);
    if (error || !data || !data.length) { el.textContent = 'Belum pernah diterbitkan.'; return; }
    el.textContent = `Terakhir diterbitkan: ${data[0].target_label || ''} — ${formatDateTimeMY(data[0].created_at)}`;
}
