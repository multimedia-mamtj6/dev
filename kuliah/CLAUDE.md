# CLAUDE.md — kuliah/admin

Architecture reference for Claude Code when working in `kuliah/`.

## What this is

`kuliah/admin/` is a full CMS admin dashboard for MAMTJ6 mosque lecture schedule management. Committee members log in with Google OAuth and manage:
- Monthly lecture schedules (subuh + maghrib sessions per day)
- Ustaz (penceramah) list with poster images
- Admin user accounts (super_admin only)
- Quick access to the live published schedule ("Lihat Terbitan" dropdown: view/export PDF, current + next month only)
- Bulk month actions ("Tindakan Bulan" dropdown: duplicate the previous month's ustaz assignments forward, or clear a month's data entirely)

`kuliah/jadual/` is the public-facing read-only schedule view that reads from the same published JSON.

## Tech Stack

- Pure HTML5, CSS3, Vanilla JS (ES6+) — no npm, no build tools
- Supabase — PostgreSQL, Auth (Google OAuth), Storage (kuliah-assets bucket)
- Vercel — static hosting + `api/publish.js` serverless function
- GitHub — published data store (JSON pushed via API from publish endpoint)

## File Structure

```
kuliah/
  admin/
    index.html       ← Login page (Google OAuth)
    app.js           ← Shared: Supabase client, auth, toast, nav injection
    style.css        ← All admin styles (desktop + mobile ≤640px)
    dashboard.html   ← Monthly calendar + day editor modal
    dashboard.js     ← Calendar render, day save, publish
    ustaz.html       ← Penceramah CRUD
    ustaz.js         ← Ustaz load/sort/save/delete, poster upload/URL/remove
    users.html       ← Admin user management (super_admin only)
    users.js         ← User CRUD
    userlog.html     ← Activity log / changelog (super_admin only)
    userlog.js       ← Log load/render/paginate
    setup.sql        ← Supabase schema reference (do not run blindly)
    database.md      ← Full database docs: setup from scratch, schema, RLS/GRANT model, troubleshooting
  jadual/
    index.html       ← Public schedule view
    script.js        ← Schedule rendering
    style.css        ← Public view styles
  paparan/
    index.html       ← Digital signage entry point, routed by ?subuh/?maghrib/?subuh-esok/?maghrib-esok
    script.js        ← Shared display logic + bootstrapPaparan() query router
    style.css        ← Signage + landing-menu styles
    today_subuh.html, today_maghrib.html,
    tomorrow_subuh.html, tomorrow_maghrib.html
                     ← Zero-JS meta-refresh redirect stubs → index.html?<query> (old URLs, kept for already-configured screens)
  DEV_NOTES.MD       ← Session-to-session context memo (read before touching anything)
  developer.md       ← Developer setup and architecture guide
  README.md          ← Project overview
```

## Supabase Schema

```sql
-- admins: who can log in
id uuid PK, email text UNIQUE, name text,
role text CHECK ('editor'|'super_admin'),
permissions jsonb,  -- { kuliah: bool }
created_at timestamptz

-- ustaz: penceramah registry
id uuid PK, full_name text NOT NULL, short_name text NOT NULL,
tajuk_kuliah text, poster_url text,
created_at timestamptz, updated_at timestamptz

-- schedule: one row per date
id uuid PK, date date UNIQUE NOT NULL,
subuh_ustaz_id uuid FK→ustaz(id),
maghrib_ustaz_id uuid FK→ustaz(id),
subuh_pending boolean DEFAULT false,   -- "Belum Ditetapkan", mutually exclusive w/ subuh_ustaz_id
maghrib_pending boolean DEFAULT false,
cuti_umum text, updated_at timestamptz

-- activity_log: accountability changelog (see Key Patterns below)
id uuid PK, created_at timestamptz,
actor_email text NOT NULL, actor_name text,
action text NOT NULL,       -- schedule_day_edit | schedule_duplicate | schedule_clear |
                             -- ustaz_create | ustaz_update | ustaz_delete |
                             -- admin_create | admin_update | admin_delete | publish
target_label text, detail text  -- both plain-text snapshots, never FKs
```

RLS is ON on all tables. Anon key used in browser (read/write with RLS). Service role key server-side only (Vercel env var).

## Data Flow

```
Admin edits day in dashboard.html
  → upsert to Supabase `schedule` (date is the conflict key)
  → click Terbitkan (publish)
  → POST /api/publish?month=YYYY-MM  (Bearer: session token)
  → api/publish.js validates token, reads schedule+ustaz from Supabase (service role)
  → builds jadual_lengkap_v2.json
  → pushes to GitHub via API (GITHUB_TOKEN env var)
  → Vercel serves updated JSON
```

## Key Patterns

**Nav HTML — always use this structure on all pages:**
```html
<nav id="main-nav">
  <span class="brand">Admin Kuliah</span>
  <button class="nav-toggle" onclick="toggleNav()" aria-label="Menu">&#9776;</button>
  <div class="nav-links">
    <a href="dashboard.html">Jadual</a>
    <a href="ustaz.html">Penceramah</a>
    <span class="spacer"></span>
    <button class="logout-btn" onclick="signOut()">Log Keluar</button>
  </div>
</nav>
```
`_injectSuperAdminNav()` in app.js inserts both "Pengguna" and "Log Aktiviti" links before `.spacer` inside `.nav-links`, each independently guarded against double-injection — so `users.html`/`userlog.html` can hardcode their own link (matching every other page's convention of hardcoding its own active link) while `dashboard.html`/`ustaz.html` gain both purely via injection. If you restructure nav or add a third super_admin-only page, update that function's array.

**Any HTML `href`/`src`, and any JS-driven navigation (`window.location.replace`/`.href`), under `kuliah/` must use absolute root-relative paths (`/kuliah/admin/...`, `/kuliah/paparan/...`), never a bare/relative filename — hit twice now, in two different subfolders:** Vercel's `cleanUrls: true` serves a directory's `index.html` at the bare directory path with **no trailing slash** (`/kuliah/admin`, not `/kuliah/admin/` — same for `/kuliah/paparan`). Per standard URL relative-resolution rules, any relative reference from a slash-less path treats the last path segment (`admin`, `paparan`) as a filename to be *replaced*, not a directory to append to. Session 7: `kuliah/admin/index.html`'s relative `window.location.replace('dashboard.html')` resolved to `/kuliah/dashboard.html` (404) instead of `/kuliah/admin/dashboard.html` — fixed by switching to absolute paths everywhere in `app.js`/`index.html`/`users.js`/`userlog.js`. Session 8: `kuliah/paparan/index.html`'s relative `<link href="style.css">`/`<script src="script.js">` silently failed to load at `https://dev.mamtj6.com/kuliah/paparan` (both resolved against `/kuliah/`, 404ing) — page rendered fully blank since `bootstrapPaparan()` never ran to flip either the display or the landing menu visible. Fixed the same way, to `/kuliah/paparan/style.css` / `/kuliah/paparan/script.js`. **Treat this as a mandatory check for any brand-new HTML entry point added under `kuliah/` — a relative asset path will work perfectly under local `python -m http.server` and under Live Server, and only break once deployed to Vercel, so local testing alone will not catch it.**

**Mobile breakpoints:**
- `≤768px` — tablet compact
- `≤640px` — phone: hamburger nav, card-per-row tables, day list calendar

**Data table mobile pattern:** Every JS-rendered `<td>` needs `data-label="..."` for the card-per-row mobile layout. CSS reads `content: attr(data-label)` via `::before`.

**Ustaz sort:** Always client-side with `localeCompare({ numeric: true })`. Never `.order('short_name')` on Supabase — it sorts lexicographically. Both `ustaz.js` (Penceramah page `#` column) and `dashboard.js` (day-editor Subuh/Maghrib dropdowns) sort this exact way so their numbering lines up — `dashboard.js`'s `openModal()` renders each option as `"{short_name} (N)"` (suffix, not prefix, so the browser's native type-to-jump-by-letter still works), 0-indexed, with `"— Tiada Kuliah —"` pinned first and unnumbered. These numbers are a recalculated position, not a stored field — they shift if the ustaz roster changes.

**`isYasinEntry(ustaz)` (app.js):** matches `/yasi+n/i` against `short_name + full_name` combined, to detect the "Bacaan Yasiin & Tahlil" special ustaz entry regardless of which field has which spelling ("Yasin" vs "Yasiin"). `dashboard.js` uses it to swap the calendar's session-tag pill / mobile day-list text to a `.yasin`/`.mdc-yasin` light-green style instead of the normal subuh/maghrib colors. Use this helper (not a hardcoded dropdown position — those aren't stable) if this needs extending anywhere else.

**Poster save (3-way logic in saveUstaz):**
- `pendingRemovePoster` → `poster_url: null`
- New file or URL entered → `poster_url: newValue`
- Neither → omit `poster_url` from payload (preserves existing)

**Cache-busting:** `vercel.json` serves `Cache-Control: no-store` for `/kuliah/admin/(.*)` and `/kuliah/jadual/(.*)`. `no-store` (not `max-age=0, must-revalidate`) is required — `must-revalidate` still lets mobile Chrome serve the page from bfcache with zero network request, so a stale copy with old JS can resurface after backgrounding the app. `no-store` disables bfcache for these routes.

**Dropdown menu pattern:** `.month-actions` (wrapper, `position: relative`) + `.month-actions-menu` (absolute-positioned panel, `.open` class toggles `display`) + `.month-actions-item` (row). Closed via a single shared `document.addEventListener('click', ...)` in `dashboard.js`; each trigger button calls `e.stopPropagation()` so its own click doesn't immediately close it again. Both the "Tindakan Bulan" (Salin Data / Kosongkan) and "Lihat Terbitan" (Tunjukkan Jadual / Export PDF) dropdowns in `dashboard.html` reuse this exact CSS — reuse it for any future dropdown rather than inventing a new one.

**Publish merges by absolute month key, prunes stale months:** `jadual_lengkap_v2.json` is `{ "months": { "YYYY-MM": { infoJadual, senaraiHari }, ... } }`. Each `Terbitkan` click (`api/publish.js`) reads the existing file, writes only `months[thatMonth]`, and leaves every other key untouched — so publishing "next month" (even to clear it) no longer wipes out "this month"'s data. The endpoint rejects any `month` that isn't the real-current or real-next `YYYY-MM` (computed server-side in Malaysia time, UTC+8) and prunes any other key out of `months` on every publish, so the file never holds more than these two months at once. `kuliah/jadual/script.js` looks up `jsonData.months[monthKey]` where `monthKey` is derived from `baseDate` (today, or +1 month for `?bulan=depan`) — so month rollover (July → August) is automatically correct with no republish needed, since the key was already written when that month was "next month". If a month key is entirely absent (never published), the public page shows "Jadual belum diterbitkan buat masa ini." instead of a blank-looking page.

**Local testing:** `Terbitkan` calls `POST /api/publish`, a Vercel serverless function that does not exist under plain `python -m http.server` (the documented local-dev method for this repo) — it will 404 and surface as a "Ralat sambungan" toast. Day-edit/save, and the Duplicate/Clear month actions (below), all write directly to Supabase instead — same production project everywhere, no local/prod split — so they work locally but have real, immediate, non-sandboxed effects on production data.

**Month action buttons only show for the real current/next month:** `dashboard.js`'s `updateScheduleActions()` computes `isRealCurrent`/`isRealNext` from an actual `new Date()` (never from the dashboard's own navigable `currentYear`/`currentMonth`), since `kuliah/jadual/script.js` can only render the real current month or real next month (`?bulan=depan`) — no arbitrary-month param exists. This one computation also drives the "Bulan Ini"/"Bulan Depan" `#month-tag` badge and whether `#future-month-note` (vs the Terbitkan button) is shown.

**Duplicate/Clear month actions:** "Salin Data {previous month}" copies `subuh_ustaz_id`/`maghrib_ustaz_id` only (never `cuti_umum` — holidays are date-specific and copying them forward would mislabel the wrong day) from the month immediately before whatever's currently displayed, matched by day-of-month number, full overwrite (confirmation modal shows how many already-filled target days will be replaced). "Kosongkan Bulan Ini" hard-deletes all `schedule` rows in the viewed month's date range. Both require the confirmation modal — same safeguard regardless of which month is targeted, including the real current/live month.

**"Last published" note on the dashboard (`#last-published-note` in `dashboard.html`, `loadLastPublishedNote()` in `dashboard.js`):** shown under the toolbar hint, only for the real current/next month (rides the same `isRealCurrent`/`isRealNext` gate `updateScheduleActions()` already computes). Reads the most recent `activity_log` row where `action = 'publish'` and `target_label` exactly matches the viewed month's label (e.g. `"Julai 2026"`) — no new logging needed, `api/publish.js` already writes this row on every successful Terbitkan. Shows `"Bulan ini belum pernah diterbitkan."` if no row exists yet. Refreshed on month navigation and immediately after a successful publish (no reload needed). Formatting helpers `formatDateTimeMY()`/`formatRelativeMY()` (Malay relative-time ladder: baru sahaja → minit → jam → hari → minggu → bulan lalu) live in shared `app.js`.

**Email matching against `admins.email` must use `ilike`, not `eq`:** Postgres `text` equality is case-sensitive by default, and `admins.email` (often typed by hand, e.g. via `setup.sql`'s bootstrap insert) isn't guaranteed to match the exact casing Google OAuth/Supabase Auth actually returns for that account. A mismatch doesn't error — `.eq('email', ...)` just silently matches zero rows, and whatever fallback exists kicks in quietly. Both `dashboard.js`'s last-published-note admin-name fallback lookup and `api/publish.js`'s own actor-name lookup use `.ilike()` (`email=ilike.` in the REST form) for this reason — use the same for any future email-matching query against `admins`.

**"Belum Ditetapkan" pending slots (session 8):** a Subuh/Maghrib slot can be marked pending instead of assigned an ustaz — for a day known to have Kuliah/Ceramah Khas where the speaker/topic isn't decided yet. Day-editor modal (`dashboard.html`) has a checkbox per session (`subuh-pending-check`/`maghrib-pending-check`) under each ustaz `<select>`; checking it disables+clears that select (`toggleSubuhPending()`/`toggleMaghribPending()` in `dashboard.js`). `saveDay()` writes `schedule.subuh_pending`/`maghrib_pending` (booleans, mutually exclusive with the matching `*_ustaz_id` — checking pending forces the id to `null`). `api/publish.js` maps a pending slot to a `{ pending: true }` marker object in the published JSON instead of an ustaz object or `null` — this is truthy, so it automatically routes correctly through every existing "is this day/session empty" check with zero changes to that logic. `kuliah/jadual/script.js` renders it as a dashed-border "Ceramah Khas — Akan Diumumkan" block (`.is-pending`/`.pending-label`) instead of an ustaz name or nothing; `kuliah/paparan/script.js` shows the same message (`MESSAGES.pending`) on the signage screen. The point of the whole feature: the public schedule must show *that* a slot exists without ever showing placeholder/undetermined ustaz info as if it were real.

**Activity log (`activity_log` table + `logActivity()` in app.js, viewed at `userlog.html`, super_admin only):** every mutating admin action inserts one row right after its write succeeds — schedule day edits, bulk duplicate/clear (one summary row each, not per-date), ustaz create/update/delete, admin-account create/update/delete, and Terbitkan/publish (logged server-side from `api/publish.js` using its existing service-role client, since that write happens outside the browser). `target_label`/`detail` are always plain-text snapshots (an ustaz's `short_name`, an admin's email, a month label) — **never** a live foreign key — so history stays readable even after the referenced ustaz/admin is later renamed or deleted. Each call-site captures its "before" value from an already-loaded in-memory cache (`scheduleMap`, `allUstaz`, `allUsers`) rather than an extra query, builds a diff string via a small pure `build*DiffText()` helper local to that page's JS file, and skips the insert entirely if nothing actually changed (no no-op log rows). `logActivity()` never throws or toasts — a logging failure must never make an admin think their actual save/delete/publish failed.

## Print/PDF Export (kuliah/jadual/)

`kuliah/jadual/index.html` supports the same `?file=pdf` auto-print export as `kuliah3/jadual/` (see `kuliah3/jadual/CLAUDE.md` for the full write-up and the annotated `@media print` block — read it before touching `kuliah/jadual/style.css`'s print rules).

**Bug fixed 2026-07-06:** exporting PDF from a narrow/mobile-width browser broke the layout (stacked header, missing footer legend) because `kuliah/jadual/style.css`'s `@media (max-width: 768px)` block (line ~459) wasn't scoped to `screen` — the mobile column layout stayed active during printing since `max-width` still matched the exporting device's width, and `@media print` never reset it. **Fixed by changing it to `@media screen and (max-width: 768px)`.** Any new mobile breakpoint block added to this file must use the same `screen`-scoped form, or print output can silently break again.

## Digital Signage (kuliah/paparan/)

Drives a physical screen at the mosque. As of session 8, a single `index.html` reads `?subuh`/`?maghrib`/`?subuh-esok`/`?maghrib-esok` from the URL (`bootstrapPaparan()` in `script.js`) and shows the matching poster/message; no query (or an unrecognized one) falls back to a 4-button landing menu instead of a blank/error page. The old 4 separate files (`today_subuh.html` etc.) are now zero-JS `<meta http-equiv="refresh" content="0; url=index.html?...">` redirect stubs, kept in place specifically because the old URLs are almost certainly hardcoded into the physical screen's kiosk browser or signage-player config — deleting them outright would require someone to walk over and manually reconfigure hardware. `index.html` keeps the `<meta http-equiv="refresh" content="600">` (10-minute) auto-reload unconditionally, same as the old files.

Reads `kuliah/data/jadual_lengkap_v2.json` (Pipeline 2 — migrated in session 8 from the old Sheets-backed `jadual_lengkap.json`/Pipeline 1). `getTargetDate()` returns both a date string and a `monthKey` to look up `jsonData.months[monthKey].senaraiHari` (the nested schema — see "Publish merges by absolute month key" above); a session with `{ pending: true }` renders the same "Ceramah Khas — Akan Diumumkan" message as the public `jadual/` view.

**See the cleanUrls absolute-path Key Pattern above** — `index.html`'s `style.css`/`script.js` references must stay absolute (`/kuliah/paparan/...`), this exact folder is where that bug most recently bit.

## Mobile "today card" — any day in the month, not just today/tomorrow (kuliah/jadual/)

The mobile view's day-select dropdown (`script.js`'s `renderTodayCard()`) lets the visitor pick any day within the currently-viewed month, not just today/tomorrow. `buildDaySelectOptions()` lists every day of the month with "Hari Ini"/"Hari Esok" always pinned first using their *real* dates (handles today being the last day of the month, where "tomorrow" spills into next month).

**Poster rendering is uniform across all days:** `buildPosterHtml()` always renders `<img src="{session.poster_url}">` directly from `kuliah`'s own `senaraiHari` data, for today/tomorrow and every other day alike. (Earlier this embedded a digital-signage `<iframe>` for today/tomorrow only — `kuliah/paparan/{today|tomorrow}_{subuh|maghrib}.html`, a separate subsystem on the old non-beta Google-Sheets pipeline — but that was standardized away in favor of the same direct-image approach used for every other day. `.poster-iframe` CSS was removed as dead code along with it.)

## Sensitive Files

- `kuliah/admin/` has no config files with secrets — credentials are Vercel env vars
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only, never in browser code
- `GITHUB_TOKEN` — Vercel env var only, used in `api/publish.js`
- Supabase anon key in `app.js` is public (safe — RLS enforces access control)
