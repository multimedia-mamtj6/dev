// ─────────────────────────────────────────────────────────────────────────────
// Pure scheduling/CSV logic shared by api/publish-news.js (the real publish
// endpoint) and admin/news/teks-berjalan.js (the "what will actually be
// published" ticker preview panel — see news/newplan.md §4). Deliberately
// kept in admin/news/, NOT under api/, so a plain <script src> can load it
// in the browser: any file under api/ is a live Vercel serverless route,
// and a GET to /api/publish-news.js would hit the real cron-auth handler
// instead of serving source — this file has zero dependency on `req`/`res`
// or any Vercel/Node-only API, so it's safe to run in either place.
//
// No framework, no module wrapper needed for the browser side — loaded via
// a plain <script> tag, these become ordinary globals exactly like every
// other admin/*.js file. api/publish-news.js pulls them in via require()
// and the CommonJS guard at the bottom; that's the ONLY environment where
// `module` exists, so the guard never fires in the browser.
// ─────────────────────────────────────────────────────────────────────────────

// Quote-aware CSV row parser, copied verbatim from khutbah/index.html — a
// naive line.split(",") truncates a title that contains a comma (Google
// Sheets' CSV export wraps such fields in double quotes). See
// khutbah/CLAUDE.md's Key Patterns for the documented naive-split bug this
// avoids.
function parseCSVRow(line) {
    const cells = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (inQuotes) {
            if (char === '"' && line[i + 1] === '"') {
                cell += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                cell += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            cells.push(cell);
            cell = '';
        } else {
            cell += char;
        }
    }
    cells.push(cell);
    return cells;
}

// A value that smells like an error/status code, never fit to publish —
// this check is the one thing the old Apps Script pipeline never had.
function looksLikeErrorText(str) {
    return /^ERROR/i.test(str) || /status:\s*\d{3}/i.test(str);
}

// `now` is expected to already be Malaysia-shifted (Date.now() + an 8-hour
// offset) — reading its UTC getters then yields the correct MYT calendar
// date with no further timezone math.
function mytDateString(now) {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Date-only start_at/end_at expand to the full day (start of start_at day,
// end of end_at day), boundary-inclusive both ends — mirrors news/script.js's
// isActive()/parseLocalDate() semantics exactly (that page does the
// equivalent expansion with Date objects on the display's own clock; this
// does it with plain ISO string comparison, which sidesteps timezone
// construction entirely and is what makes this trivially pure/testable).
// Must agree with news/script.js on every input — see api/publish-news.test.js.
function isActiveNow(row, now) {
    if (!row || row.enabled === false) return false;
    const today = mytDateString(now);
    if (row.start_at && today < row.start_at) return false;
    if (row.end_at && today > row.end_at) return false;
    return true;
}

// news_announcements → announcements.json. Drops enabled=false rows only —
// future/expired rows are KEPT, because news/script.js filters the active
// window live on the display's own clock. This is what makes "schedule an
// announcement today, it appears next week with no republish" work.
function buildAnnouncementsJson(rows, settings) {
    const sorted = (rows || [])
        .filter(r => r.enabled !== false)
        .slice()
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    return {
        default_image: settings.default_image || '/news/default.svg',
        announcements: sorted.map(r => {
            const item = { title: r.title };
            if (r.heading)   item.heading = r.heading;
            if (r.body_text) item.text = r.body_text;
            if (r.image_url) item.image_url = r.image_url;
            if (r.start_at)  item.start_at = r.start_at;
            if (r.end_at)    item.end_at = r.end_at;
            item.enabled = true;
            return item;
        }),
    };
}

// news_ticker → moving-text.json. Unlike buildAnnouncementsJson, scheduling
// IS resolved here (isActiveNow), because Xibo's DataSet widget reads this
// file directly with no JS of ours in between. `khutbahTitle` is whatever
// the caller already resolved (current fetch, cached fallback, or null) —
// this function stays pure and never fetches anything itself. A khutbah row
// with no resolvable title is omitted entirely, never replaced with a
// placeholder. If the result would be empty, emits exactly one row from
// `default_ticker_line` — the ticker can never publish as a blank file.
function buildMovingTextJson(rows, settings, khutbahTitle, now) {
    const active = (rows || [])
        .filter(r => isActiveNow(r, now))
        .slice()
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const lines = [];
    for (const r of active) {
        if (r.kind === 'khutbah') {
            if (khutbahTitle) lines.push(`${r.prefix || ''}${khutbahTitle}`);
        } else {
            lines.push(r.message);
        }
    }

    if (lines.length === 0) {
        lines.push(settings.default_ticker_line || 'Selamat datang ke Masjid Al-Mukhlisin Taman Jaya 6');
    }

    return { 'moving-text': lines.map(text => ({ Col1: text })) };
}

// Node/CommonJS only — `module` never exists in a plain <script> load, so
// this is a no-op in the browser and the six functions above stay ordinary
// globals there.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseCSVRow,
        looksLikeErrorText,
        mytDateString,
        isActiveNow,
        buildAnnouncementsJson,
        buildMovingTextJson,
    };
}
