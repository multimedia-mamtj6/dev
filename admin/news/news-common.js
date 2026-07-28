// ─────────────────────────────────────────────────────────────────────────────
// Shared across every admin/news/*.js page — permission gate, Terbitkan
// plumbing, settings helpers, and the status computation both pages' tables
// use. Loaded after app.js and before each page's own script, same shape as
// admin/infaq/infaq-common.js.
// ─────────────────────────────────────────────────────────────────────────────

// Every news page calls this right after requireAuth(), e.g.:
//   const session = await requireAuth();
//   if (!session) return;
//   if (!(await requireNewsAccess())) return;
// Thin wrapper around app.js's generic requireModuleAccess() — same pattern
// as infaq-common.js's requireInfaqAccess().
async function requireNewsAccess() {
    return requireModuleAccess('news');
}

// ─── Status computation (pengumuman.js + teks-berjalan.js tables) ──────────────
// Four states, purely date/enabled-derived — never stored, always computed
// fresh from the row so the admin table and the published JSON's own
// filtering (news/script.js's isActive() for announcements, api/publish-news.js's
// isActiveNow() for the ticker) can never silently disagree about what
// "active" means. `now` defaults to the browser's own clock; callers can
// pass a fixed Date for the ticker preview panel so every row in one preview
// render is judged against the exact same instant.
const NEWS_STATUS_CLASS = {
    'Aktif':       'news-status-active',
    'Akan Datang': 'news-status-upcoming',
    'Tamat':       'news-status-expired',
    'Dimatikan':   'news-status-off',
};

function localDateString(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Minute-precision counterpart of localDateString, for start_at/end_at now
// that they carry day+hour+minute (see setup.sql §10's TIMESTAMP migration).
// Reads the browser's own local clock — fine for a glance-status label,
// deliberately separate from publish-news-pure.js's MYT-shifted
// mytDateTimeString() (which pengumuman.html doesn't even load), so this
// file works standalone on either admin page.
function localDateTimeString(d) {
    return `${localDateString(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Same "bare date expands to the full day" idea as
// publish-news-pure.js's normalizeBoundary() — kept as its own small copy
// here rather than a shared import, since news-common.js has to work on
// pengumuman.html too, which never loads publish-news-pure.js.
function normalizeBoundaryLocal(value, isEnd) {
    if (!value) return null;
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str + (isEnd ? 'T23:59' : 'T00:00');
    return str.slice(0, 16);
}

function computeStatus(row, now = new Date()) {
    if (row.enabled === false) return 'Dimatikan';
    const nowStr = localDateTimeString(now);
    const start = normalizeBoundaryLocal(row.start_at, false);
    const end   = normalizeBoundaryLocal(row.end_at, true);
    if (start && nowStr < start) return 'Akan Datang';
    if (end && nowStr > end) return 'Tamat';
    return 'Aktif';
}

function statusBadgeHtml(status) {
    return `<span class="news-status-badge ${NEWS_STATUS_CLASS[status] || ''}">${escapeHtml(status)}</span>`;
}

// ─── Settings (news_settings key/value table) ──────────────────────────────────
// SELECT is open to any authenticated admin (RLS, see setup.sql §10); writes
// are gated on canWriteModule('news') in the UI and admin_can_write('news')
// in Postgres, same as every other write in this module.

async function getSetting(key, fallback = '') {
    const { data, error } = await db.from('news_settings').select('value').eq('key', key).single();
    if (error || !data) return fallback;
    return data.value ?? fallback;
}

async function getSettings(keys) {
    const { data, error } = await db.from('news_settings').select('key, value').in('key', keys);
    if (error) return {};
    const out = {};
    (data || []).forEach(r => { out[r.key] = r.value; });
    return out;
}

async function saveSetting(key, value) {
    return db.from('news_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
}

// ─── Character counter (shows remaining chars once near the limit) ────────────
// Wired to a text input/textarea + a small note element; the note only
// becomes visible once length reaches ~80% of the limit, so a normal-length
// entry never shows a permanent counter. Returns the update function so the
// caller can also re-run it right after setting .value programmatically
// (openAddModal/openEditModal) — a JS-set value doesn't fire 'input'.
function attachCharCounter(inputId, counterId, limit, thresholdRatio = 0.8) {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(counterId);
    if (!input || !counter) return () => {};

    const update = () => {
        const remaining = limit - input.value.length;
        if (input.value.length >= limit * thresholdRatio) {
            counter.textContent = remaining >= 0
                ? `${remaining} aksara lagi`
                : `${-remaining} aksara melebihi had`;
            counter.style.display = '';
        } else {
            counter.style.display = 'none';
        }
    };

    input.addEventListener('input', update);
    update();
    return update;
}

// ─── Publish (shared by pengumuman.js / teks-berjalan.js) ──────────────────────
// Each of the 2 news data pages owns its own Terbitkan button, right next to
// the data it publishes — same reasoning/shape as infaq's 3-target split
// (admin/CLAUDE.md's Key Patterns). api/publish-news.js's TARGETS keys are
// 'announcements' and 'moving-text'.
const PUBLISH_BUTTON_LABELS = {
    'publish-announcements-btn': 'Terbitkan',
    'publish-ticker-btn':        'Terbitkan',
};

const PUBLISH_NOTE_TARGETS = {
    'announcements': ['publish_announcements', 'last-published-announcements'],
    'moving-text':   ['publish_moving_text',   'last-published-ticker'],
};

async function loadLastPublishedNewsNote(action, elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const { data, error } = await db
        .from('news_activity_log')
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
            // .ilike(), never .eq() — admins.email may not casing-match what
            // Google OAuth returns, see admin/database.md §3.
            const { data: adminRow } = await db.from('admins').select('name').ilike('email', row.actor_email).single();
            who = adminRow?.name || row.actor_email;
        }
        el.textContent = `Terakhir diterbitkan pada ${formatDateTimeMY(row.created_at)} (${formatRelativeMY(row.created_at)}) oleh ${who}`;
    }
    el.style.display = 'block';
}

async function publishNews(target, btnId) {
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
        const res = await fetch(`/api/publish-news?target=${target}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        const data = await res.json();

        if (!res.ok) {
            const detail = data.details ? ` (${data.details})` : '';
            showToast('Gagal menerbitkan: ' + (data.error || res.statusText) + detail, 'error', 8000);
        } else if (data.unchanged) {
            showToast('Tiada perubahan — tidak perlu diterbitkan semula.', 'info', 5000);
            const [action, elId] = PUBLISH_NOTE_TARGETS[target];
            await loadLastPublishedNewsNote(action, elId);
        } else {
            showToast('Berjaya diterbitkan!', 'success', 6000);
            const [action, elId] = PUBLISH_NOTE_TARGETS[target];
            await loadLastPublishedNewsNote(action, elId);
        }
    } catch (err) {
        showToast('Ralat sambungan: ' + err.message, 'error');
    }

    btn.disabled = false;
    btn.textContent = originalLabel;
}
