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
// date with no further timezone math. Kept (not just folded into
// mytDateTimeString below) since it's still useful wherever only the day
// matters, and existing tests exercise it directly.
function mytDateString(now) {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Same idea as mytDateString, extended to minute precision (no seconds —
// scheduling only ever needs day/hour/minute, matching the admin UI's
// datetime-local inputs, which have no seconds field either).
function mytDateTimeString(now) {
    const y  = now.getUTCFullYear();
    const mo = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d  = String(now.getUTCDate()).padStart(2, '0');
    const h  = String(now.getUTCHours()).padStart(2, '0');
    const mi = String(now.getUTCMinutes()).padStart(2, '0');
    return `${y}-${mo}-${d}T${h}:${mi}`;
}

// Normalizes a start_at/end_at value (from the `TIMESTAMP` columns) into a
// `YYYY-MM-DDTHH:MM` string comparable against mytDateTimeString()'s output.
// A bare `YYYY-MM-DD` value (legacy rows from before minute-precision
// scheduling existed, or any future row someone inserts without a time)
// still expands to the full day — start of day for a start boundary, end of
// day for an end boundary — same "date-only is editor-friendly" idea
// news/script.js's parseLocalDate() already uses. Anything else is assumed
// to already be a `YYYY-MM-DDTHH:MM[:SS]`-shaped string and is simply
// truncated to 16 characters (drops seconds, if present) — Postgres
// timestamps come back from PostgREST in that shape, so there's no need to
// parse or otherwise touch it.
function normalizeBoundary(value, isEnd) {
    if (!value) return null;
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str + (isEnd ? 'T23:59' : 'T00:00');
    }
    return str.slice(0, 16);
}

// start_at/end_at now carry day+hour+minute (see the news_announcements/
// news_ticker `TIMESTAMP` migration in setup.sql §10), boundary-inclusive
// both ends — mirrors news/script.js's isActive()/parseLocalDate()
// semantics exactly (that page does the equivalent comparison with real
// Date objects on the display's own clock; this does it with plain string
// comparison via mytDateTimeString()/normalizeBoundary(), which sidesteps
// timezone construction entirely and is what makes this trivially
// pure/testable). Must agree with news/script.js on every input — see
// api/publish-news.test.js.
function isActiveNow(row, now) {
    if (!row || row.enabled === false) return false;
    const nowStr = mytDateTimeString(now);
    const start = normalizeBoundary(row.start_at, false);
    const end   = normalizeBoundary(row.end_at, true);
    if (start && nowStr < start) return false;
    if (end && nowStr > end) return false;
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
        mytDateTimeString,
        normalizeBoundary,
        isActiveNow,
        buildAnnouncementsJson,
        buildMovingTextJson,
    };
}
