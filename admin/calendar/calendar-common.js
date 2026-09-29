// ─────────────────────────────────────────────────────────────────────────────
// Shared across admin/calendar/*.js — permission gate + Terbitkan plumbing.
// Same shape as admin/khutbah/khutbah-common.js.
// ─────────────────────────────────────────────────────────────────────────────

async function requireCalendarAccess() {
    return requireModuleAccess('kalendar');
}

// POST /api/publish-events with the admin's session token + full events array.
// The endpoint validates, sorts, writes lastUpdated, pushes to GitHub, and
// logs to calendar_activity_log server-side.
async function publishCalendarEvents(events, btnId) {
    const btn = btnId ? document.getElementById(btnId) : null;
    const session = (await db.auth.getSession()).data.session;
    if (!session) { showToast('Sesi tamat. Sila log masuk semula.', 'error'); return null; }
    if (btn) { btn.disabled = true; btn.textContent = 'Menerbitkan...'; }
    try {
        const res = await fetch('/api/publish-events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ events }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) throw new Error(json.message || json.error || `HTTP ${res.status}`);
        showToast('Berjaya diterbitkan.', 'success');
        logActivity('publish_calendar', `${events.length} acara`, json.lastUpdated || '', 'calendar_activity_log');
        return json;
    } catch (e) {
        console.error('publishCalendarEvents failed:', e);
        showToast(`Terbitan gagal: ${e.message}`, 'error');
        return null;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Simpan & Terbitkan'; }
    }
}

async function loadLastPublishedCalendarNote(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const { data, error } = await db.from('calendar_activity_log')
        .select('created_at, target_label, detail')
        .eq('action', 'publish_calendar')
        .order('created_at', { ascending: false })
        .limit(1);
    if (error || !data || !data.length) { el.textContent = 'Belum pernah diterbitkan.'; return; }
    el.textContent = `Terakhir diterbitkan: ${formatDateTimeMY(data[0].created_at)} — ${data[0].target_label || ''}`;
}
