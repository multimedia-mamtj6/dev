# CLAUDE.md — admin

Architecture reference for Claude Code when working in `admin/`.

**Moved here from `kuliah/admin/` on 2026-07-19** — see `admin/plan.md` for the
move itself (context, execution, verification). This file is the ongoing
architecture reference; the plan file is a one-time historical record.

## What this is

`admin/` is a full CMS admin dashboard for MAMTJ6 mosque lecture schedule
management. Committee members log in with Google OAuth and manage:
- Monthly lecture schedules (subuh + maghrib sessions per day)
- Ustaz (penceramah) list with poster images
- Admin user accounts (super_admin only)
- Quick access to the live published schedule ("Lihat Terbitan" dropdown: view/export PDF, current + next month only)
- Bulk month actions ("Tindakan Bulan" dropdown: duplicate the previous month's ustaz assignments forward, or clear a month's data entirely)

It sits at the repo root because it's becoming a multi-module hub (kuliah now,
other modules planned later) — `kuliah/admin/` would have been misleading
once it hosted non-kuliah modules. `kuliah/jadual/` is the public-facing
read-only schedule view that reads from the same published JSON — see
`kuliah/CLAUDE.md` for that side.

## Tech Stack

- Pure HTML5, CSS3, Vanilla JS (ES6+) — no npm, no build tools
- Supabase — PostgreSQL, Auth (Google OAuth), Storage (kuliah-assets bucket)
- Vercel — static hosting + `api/publish.js` serverless function
- GitHub — published data store (JSON pushed via API from publish endpoint)

## File Structure

```
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
  DEV_NOTES.MD     ← Session-to-session context memo (read before touching anything)
  developer.md     ← Developer setup and architecture guide
  plan.md          ← One-time record of the kuliah/admin/ → admin/ move (2026-07-19)

kuliah/
  admin/           ← 5 zero-JS meta-refresh redirect stubs → /admin/... (old URLs kept working)
  jadual/          ← Public schedule view (see kuliah/CLAUDE.md)
  paparan/         ← Digital signage (see kuliah/CLAUDE.md)
  data/jadual_lengkap_v2.json ← Published data this dashboard writes, that jadual/paparan read
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

**Any HTML `href`/`src`, and any JS-driven navigation (`window.location.replace`/`.href`), under `admin/` must use absolute root-relative paths (`/admin/...`), never a bare/relative filename — this is a repo-wide landmine, hit multiple times in different folders (see `kuliah/CLAUDE.md` for the `kuliah/paparan/` recurrence):** Vercel's `cleanUrls: true` serves a directory's `index.html` at the bare directory path with **no trailing slash** (`/admin`, not `/admin/`). Per standard URL relative-resolution rules, any relative reference from a slash-less path treats the last path segment (`admin`) as a filename to be *replaced*, not a directory to append to. Session 7 (back when this lived at `kuliah/admin/`): `index.html`'s relative `window.location.replace('dashboard.html')` resolved to `/kuliah/dashboard.html` (404) instead of `/kuliah/admin/dashboard.html` — fixed by switching to absolute paths everywhere in `app.js`/`index.html`/`users.js`/`userlog.js`. Those absolute paths were re-swept to `/admin/...` when the folder moved to root on 2026-07-19 (see `admin/plan.md`). **Treat this as a mandatory check for any brand-new HTML entry point added under `admin/` — a relative asset path will work perfectly under local `python -m http.server` and under Live Server, and only break once deployed to Vercel, so local testing alone will not catch it.**

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

**Cache-busting:** `vercel.json` serves `Cache-Control: no-store` for `/admin/(.*)` and `/kuliah/jadual/(.*)`. `no-store` (not `max-age=0, must-revalidate`) is required — `must-revalidate` still lets mobile Chrome serve the page from bfcache with zero network request, so a stale copy with old JS can resurface after backgrounding the app. `no-store` disables bfcache for these routes.

**Dropdown menu pattern:** `.month-actions` (wrapper, `position: relative`) + `.month-actions-menu` (absolute-positioned panel, `.open` class toggles `display`) + `.month-actions-item` (row). Closed via a single shared `document.addEventListener('click', ...)` in `dashboard.js`; each trigger button calls `e.stopPropagation()` so its own click doesn't immediately close it again. Both the "Tindakan Bulan" (Salin Data / Kosongkan) and "Lihat Terbitan" (Tunjukkan Jadual / Export PDF) dropdowns in `dashboard.html` reuse this exact CSS — reuse it for any future dropdown rather than inventing a new one.

**Publish merges by absolute month key, prunes stale months:** `jadual_lengkap_v2.json` is `{ "months": { "YYYY-MM": { infoJadual, senaraiHari }, ... } }`. Each `Terbitkan` click (`api/publish.js`) reads the existing file, writes only `months[thatMonth]`, and leaves every other key untouched — so publishing "next month" (even to clear it) no longer wipes out "this month"'s data. The endpoint rejects any `month` that isn't the real-current or real-next `YYYY-MM` (computed server-side in Malaysia time, UTC+8) and prunes any other key out of `months` on every publish, so the file never holds more than these two months at once. `kuliah/jadual/script.js` looks up `jsonData.months[monthKey]` where `monthKey` is derived from `baseDate` (today, or +1 month for `?bulan=depan`) — so month rollover (July → August) is automatically correct with no republish needed, since the key was already written when that month was "next month". If a month key is entirely absent (never published), the public page shows "Jadual belum diterbitkan buat masa ini." instead of a blank-looking page.

**Local testing:** `Terbitkan` calls `POST /api/publish`, a Vercel serverless function that does not exist under plain `python -m http.server` (the documented local-dev method for this repo) — it will 404 and surface as a "Ralat sambungan" toast. Day-edit/save, and the Duplicate/Clear month actions (below), all write directly to Supabase instead — same production project everywhere, no local/prod split — so they work locally but have real, immediate, non-sandboxed effects on production data.

**Month action buttons only show for the real current/next month:** `dashboard.js`'s `updateScheduleActions()` computes `isRealCurrent`/`isRealNext` from an actual `new Date()` (never from the dashboard's own navigable `currentYear`/`currentMonth`), since `kuliah/jadual/script.js` can only render the real current month or real next month (`?bulan=depan`) — no arbitrary-month param exists. This one computation also drives the "Bulan Ini"/"Bulan Depan" `#month-tag` badge and whether `#future-month-note` (vs the Terbitkan button) is shown.

**Duplicate/Clear month actions:** "Salin Data {previous month}" copies `subuh_ustaz_id`/`maghrib_ustaz_id` only (never `cuti_umum` — holidays are date-specific and copying them forward would mislabel the wrong day) from the month immediately before whatever's currently displayed, matched by day-of-month number, full overwrite (confirmation modal shows how many already-filled target days will be replaced). "Kosongkan Bulan Ini" hard-deletes all `schedule` rows in the viewed month's date range. Both require the confirmation modal — same safeguard regardless of which month is targeted, including the real current/live month.

**"Last published" note on the dashboard (`#last-published-note` in `dashboard.html`, `loadLastPublishedNote()` in `dashboard.js`):** shown under the toolbar hint, only for the real current/next month (rides the same `isRealCurrent`/`isRealNext` gate `updateScheduleActions()` already computes). Reads the most recent `activity_log` row where `action = 'publish'` and `target_label` exactly matches the viewed month's label (e.g. `"Julai 2026"`) — no new logging needed, `api/publish.js` already writes this row on every successful Terbitkan. Shows `"Bulan ini belum pernah diterbitkan."` if no row exists yet. Refreshed on month navigation and immediately after a successful publish (no reload needed). Formatting helpers `formatDateTimeMY()`/`formatRelativeMY()` (Malay relative-time ladder: baru sahaja → minit → jam → hari → minggu → bulan lalu) live in shared `app.js`.

**Email matching against `admins.email` must use `ilike`, not `eq`:** Postgres `text` equality is case-sensitive by default, and `admins.email` (often typed by hand, e.g. via `setup.sql`'s bootstrap insert) isn't guaranteed to match the exact casing Google OAuth/Supabase Auth actually returns for that account. A mismatch doesn't error — `.eq('email', ...)` just silently matches zero rows, and whatever fallback exists kicks in quietly. Both `dashboard.js`'s last-published-note admin-name fallback lookup and `api/publish.js`'s own actor-name lookup use `.ilike()` (`email=ilike.` in the REST form) for this reason — use the same for any future email-matching query against `admins`.

**"Belum Ditetapkan" pending slots (session 8):** a Subuh/Maghrib slot can be marked pending instead of assigned an ustaz — for a day known to have Kuliah/Ceramah Khas where the speaker/topic isn't decided yet. Day-editor modal (`dashboard.html`) has a checkbox per session (`subuh-pending-check`/`maghrib-pending-check`) under each ustaz `<select>`; checking it disables+clears that select (`toggleSubuhPending()`/`toggleMaghribPending()` in `dashboard.js`). `saveDay()` writes `schedule.subuh_pending`/`maghrib_pending` (booleans, mutually exclusive with the matching `*_ustaz_id` — checking pending forces the id to `null`). `api/publish.js` maps a pending slot to a `{ pending: true }` marker object in the published JSON instead of an ustaz object or `null` — this is truthy, so it automatically routes correctly through every existing "is this day/session empty" check with zero changes to that logic. `kuliah/jadual/script.js` renders it as a dashed-border "Ceramah Khas — Akan Diumumkan" block; `kuliah/paparan/script.js` shows the same message on the signage screen (see `kuliah/CLAUDE.md` for the rendering side). The point of the whole feature: the public schedule must show *that* a slot exists without ever showing placeholder/undetermined ustaz info as if it were real.

**Activity log (`activity_log` table + `logActivity()` in app.js, viewed at `userlog.html`, super_admin only):** every mutating admin action inserts one row right after its write succeeds — schedule day edits, bulk duplicate/clear (one summary row each, not per-date), ustaz create/update/delete, admin-account create/update/delete, and Terbitkan/publish (logged server-side from `api/publish.js` using its existing service-role client, since that write happens outside the browser). `target_label`/`detail` are always plain-text snapshots (an ustaz's `short_name`, an admin's email, a month label) — **never** a live foreign key — so history stays readable even after the referenced ustaz/admin is later renamed or deleted. Each call-site captures its "before" value from an already-loaded in-memory cache (`scheduleMap`, `allUstaz`, `allUsers`) rather than an extra query, builds a diff string via a small pure `build*DiffText()` helper local to that page's JS file, and skips the insert entirely if nothing actually changed (no no-op log rows). `logActivity()` never throws or toasts — a logging failure must never make an admin think their actual save/delete/publish failed.

## Sensitive Files

- `admin/` has no config files with secrets — credentials are Vercel env vars
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only, never in browser code
- `GITHUB_TOKEN` — Vercel env var only, used in `api/publish.js`
- Supabase anon key in `app.js` is public (safe — RLS enforces access control)
