# CLAUDE.md — admin

Architecture reference for Claude Code when working in `admin/`.

**Moved here from `kuliah/admin/` on 2026-07-19** — see `admin/plan.md` for the
move itself (context, execution, verification). This file is the ongoing
architecture reference; the plan file is a one-time historical record.

## What this is

`admin/` is a full CMS admin dashboard for MAMTJ6 mosque management, hosting
two independent modules as of 2026-07-19:

- **`admin/kuliah/`** — lecture schedule management. Committee members log in
  with Google OAuth and manage: monthly lecture schedules (subuh + maghrib
  sessions per day), the ustaz (penceramah) list with poster images, quick
  access to the live published schedule ("Lihat Terbitan" dropdown), and bulk
  month actions ("Tindakan Bulan": duplicate the previous month forward, or
  clear a month entirely).
- **`admin/infaq/`** — donation/expense tracking. Individual donation and
  expense entries are logged as raw rows; weekly/monthly/yearly rollups and
  active-project progress are always **computed**, never typed in directly
  (see `api/publish-infaq.js`).

Shared/cross-module concerns (login, nav shell, admin-user management,
activity-log viewer) stay flat at `admin/` root — see File Structure below.
It sits at the repo root, rather than under `kuliah/`, specifically *because*
it's a multi-module hub — `kuliah/admin/` would have been misleading once it
hosted non-kuliah modules. `kuliah/jadual/` is the public-facing read-only
schedule view that reads kuliah's published JSON — see `kuliah/CLAUDE.md` for
that side. **infaq has no public-facing page yet** — its published JSON lands
in this repo (`infaq/data/`) but nothing reads it publicly yet, by deliberate
choice (see `admin/infaq/`'s own history in `admin/DEV_NOTES.MD`).

## Tech Stack

- Pure HTML5, CSS3, Vanilla JS (ES6+) — no npm, no build tools
- Supabase — PostgreSQL, Auth (Google OAuth), Storage (kuliah-assets bucket)
- Vercel — static hosting + `api/publish.js` serverless function
- GitHub — published data store (JSON pushed via API from publish endpoint)

## File Structure

```
admin/
  index.html       ← Login page (Google OAuth) — shared, module-agnostic
  app.js           ← Shared: Supabase client, auth, toast, nav injection/hiding,
                      defaultLandingPageFor(), logActivity(action, label, detail, table)
  style.css        ← All admin styles (desktop + mobile ≤640px), incl. infaq stat cards/progress bar
  users.html/.js   ← Admin user management (super_admin only) — perm-kuliah + perm-infaq checkboxes
  userlog.html/.js ← Activity log viewer for `activity_log` (super_admin only) — kuliah only, does
                      NOT yet show infaq_activity_log rows (flagged, not built — see DEV_NOTES)
  setup.sql        ← Supabase schema reference for ALL tables, both modules (do not run blindly)
  database.md      ← Full database docs: setup from scratch, schema, RLS/GRANT model, troubleshooting
  DEV_NOTES.MD     ← Session-to-session context memo (read before touching anything)
  developer.md     ← Developer setup and architecture guide
  plan.md          ← Historical record of the kuliah/admin/ → admin/ move (2026-07-19)

  kuliah/          ← Module: lecture schedule (moved here from admin/ root 2026-07-19)
    dashboard.html/.js ← Monthly calendar + day editor modal, Terbitkan
    ustaz.html/.js     ← Penceramah CRUD

  infaq/           ← Module: donation/expense tracking (new 2026-07-19)
    infaq-common.js    ← Shared across this module: requireInfaqAccess(), formatRM(),
                          INFAQ_METHOD_LABELS, populateProjectSelect()
    ringkasan.html/.js ← Module landing page: stat cards, active-project progress, Terbitkan
    kutipan.html/.js   ← Donation entries CRUD (paginated/filtered, like userlog.js)
    perbelanjaan.html/.js ← Expense entries CRUD (paginated/filtered, same shape as kutipan)
    projek.html/.js    ← Fundraising project settings CRUD (small list, like ustaz.js)

admin/dashboard.html, admin/ustaz.html  ← 2 zero-JS redirect stubs → admin/kuliah/... (old bare
                                            /admin/ URLs, pre-module-restructure, kept working)
kuliah/
  admin/           ← 5 zero-JS meta-refresh redirect stubs → /admin/... (URLs from BEFORE the
                      kuliah/admin/ → admin/ move, kept working)
  jadual/          ← Public schedule view (see kuliah/CLAUDE.md)
  paparan/         ← Digital signage (see kuliah/CLAUDE.md)
  data/jadual_lengkap_v2.json ← Published data admin/kuliah/ writes, that jadual/paparan read

infaq/data/data.json, infaq/data/perbelanjaan.json ← Published data admin/infaq/ writes
                                                        (api/publish-infaq.js) — no reader yet
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

-- activity_log: accountability changelog for the kuliah module (see Key Patterns below)
id uuid PK, created_at timestamptz,
actor_email text NOT NULL, actor_name text,
action text NOT NULL,       -- schedule_day_edit | schedule_duplicate | schedule_clear |
                             -- ustaz_create | ustaz_update | ustaz_delete |
                             -- admin_create | admin_update | admin_delete | publish
target_label text, detail text  -- both plain-text snapshots, never FKs

-- infaq_projects: named fundraising campaigns, history kept (rows never
-- overwritten, only is_active flips). At most one active at a time
-- (partial unique index on is_active WHERE true).
id uuid PK, name text NOT NULL, target_amount numeric(12,2),
is_active boolean DEFAULT false, completed_at timestamptz,
created_at timestamptz, updated_at timestamptz

-- infaq_donations: ONE ROW PER RAW DEPOSIT — every rollup (weekly/monthly/
-- yearly/graf) is computed from these by api/publish-infaq.js, never typed
-- in directly. project_id nullable: most donations are ordinary weekly
-- infaq (not earmarked); only donations explicitly tied to a project count
-- toward that project's JumlahTerkumpul.
id uuid PK, project_id uuid FK→infaq_projects(id) ON DELETE SET NULL,
amount numeric(12,2), donation_date date NOT NULL,
method text CHECK ('tunai'|'online'|'qr'|'lain'), note text,
created_at timestamptz, updated_at timestamptz

-- infaq_expenses: one row per raw mosque expense, same auto-aggregation principle
id uuid PK, amount numeric(12,2), expense_date date NOT NULL,
category text, description text NOT NULL,
created_at timestamptz, updated_at timestamptz

-- infaq_activity_log: SEPARATE from activity_log by deliberate choice
-- (independent auditability for money data) — otherwise identical shape
id uuid PK, created_at timestamptz,
actor_email text NOT NULL, actor_name text,
action text NOT NULL,       -- infaq_donation_create/update/delete |
                             -- infaq_expense_create/update/delete |
                             -- infaq_project_create/update/delete/activate | publish
target_label text, detail text
```

RLS is ON on all tables. Anon key used in browser (read/write with RLS). Service role key server-side only (Vercel env var). **New tables never inherit grants automatically** (see Key Patterns) — `infaq_projects`/`infaq_donations`/`infaq_expenses` grant `service_role` SELECT-only (publish reads, never writes them); `infaq_activity_log` grants `service_role` full CRUD (publish also writes to it), same as `activity_log`.

## Data Flow

```
kuliah: Admin edits day in admin/kuliah/dashboard.html
  → upsert to Supabase `schedule` (date is the conflict key)
  → click Terbitkan (publish)
  → POST /api/publish?month=YYYY-MM  (Bearer: session token)
  → api/publish.js validates token, reads schedule+ustaz from Supabase (service role)
  → builds jadual_lengkap_v2.json
  → pushes to GitHub via API (GITHUB_TOKEN env var)
  → Vercel serves updated JSON

infaq: Admin logs raw entries in admin/infaq/kutipan.html and perbelanjaan.html
  → insert to Supabase `infaq_donations` / `infaq_expenses` (raw rows, never
    pre-summed totals)
  → click Terbitkan on admin/infaq/ringkasan.html
  → POST /api/publish-infaq  (Bearer: session token, no month param — always
    a full as-of-now snapshot)
  → api/publish-infaq.js reads infaq_projects/donations/expenses (service role),
    COMPUTES weekly/monthly/yearly rollups + active-project progress
  → pushes infaq/data/data.json + infaq/data/perbelanjaan.json to GitHub
  → no public reader yet — see What This Is
```

## Key Patterns

**Nav HTML — always use this structure on all pages, with `data-module` on every module-specific link:**
```html
<nav id="main-nav">
  <span class="brand">Admin Kuliah</span>
  <button class="nav-toggle" onclick="toggleNav()" aria-label="Menu">&#9776;</button>
  <div class="nav-links">
    <a href="dashboard.html" data-module="kuliah">Jadual</a>          <!-- absolute /admin/kuliah/... from OUTSIDE admin/kuliah/ -->
    <a href="ustaz.html" data-module="kuliah">Penceramah</a>
    <a href="/admin/infaq/ringkasan.html" data-module="infaq">Infaq</a>
    <span class="spacer"></span>
    <button class="logout-btn" onclick="signOut()">Log Keluar</button>
  </div>
</nav>
```
`_injectSuperAdminNav()` in app.js inserts both "Pengguna" and "Log Aktiviti" links (absolute `/admin/users.html`/`/admin/userlog.html` — see the cleanUrls note below for why) before `.spacer` inside `.nav-links`, each independently guarded against double-injection — so `users.html`/`userlog.html` can hardcode their own link while every module page gains both purely via injection. `_hideUnauthorizedModuleLinks()` (also in app.js, runs right after) hides any `[data-module]` link the current admin can't use — `super_admin` always sees everything; everyone else needs `permissions.<module>` truthy. If you restructure nav or add a third module, update both functions.

**Any HTML `href`/`src`, and any JS-driven navigation (`window.location.replace`/`.href`), under `admin/` must use absolute root-relative paths (`/admin/...` or `/admin/kuliah/...`/`/admin/infaq/...`), never a bare/relative filename — this is a repo-wide landmine, hit multiple times in different folders (see `kuliah/CLAUDE.md` for the `kuliah/paparan/` recurrence):** Vercel's `cleanUrls: true` serves a directory's `index.html` at the bare directory path with **no trailing slash** (`/admin`, `/admin/kuliah`). Per standard URL relative-resolution rules, any relative reference from a slash-less path treats the last path segment as a filename to be *replaced*, not a directory to append to. Session 7 (back when this lived at `kuliah/admin/`): `index.html`'s relative `window.location.replace('dashboard.html')` resolved one level too high — fixed with absolute paths. Those absolute paths were re-swept to `/admin/...` on the 2026-07-19 root move (`admin/plan.md`), then re-swept AGAIN the same day to `/admin/kuliah/...` for the module restructure (dashboard.html/ustaz.js moved a level deeper) — **this is now a recurring cost of any future path change, not a one-time fix; grep for the old path every time you move something.** `admin/infaq/`'s landing page is deliberately named `ringkasan.html`, not `index.html`, specifically to avoid a THIRD instance of this bug (an `index.html` under `admin/infaq/` would itself be served at the bare slash-less `/admin/infaq` path). **Treat this as a mandatory check for any brand-new HTML entry point added under `admin/` — a relative asset path will work perfectly under local `python -m http.server` and under Live Server, and only break once deployed to Vercel, so local testing alone will not catch it.**

**Module permission gate (`permissions.kuliah`/`permissions.infaq` on `admins`, added 2026-07-19):** `admin/infaq/*.js` pages call `requireInfaqAccess()` (in `admin/infaq/infaq-common.js`) right after `requireAuth()` — denies and redirects unless `role === 'super_admin'` or `permissions.infaq` is truthy. **`admin/kuliah/` pages have NO equivalent gate yet** — `permissions.kuliah` exists in the schema and is editable in `users.html`, but nothing checks it, a deliberately deferred half-measure (see `admin/DEV_NOTES.MD`) — don't assume kuliah is actually access-controlled just because infaq is. `defaultLandingPageFor(admin)` (app.js) is the shared "where does this admin land" helper — `/admin/kuliah/dashboard.html` if they have kuliah access or are super_admin, else `/admin/infaq/ringkasan.html` if they have infaq access, else `null` (caller must show a message, **never** redirect on `null` — redirecting to another gated page is exactly how you get a bounce loop between two denied pages).

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

**Infaq: donations/expenses are always raw rows, rollups are always computed, never typed in (2026-07-19 design decision):** `admin/infaq/kutipan.js`/`perbelanjaan.js` only ever insert one row per deposit/expense as it happens — there is no UI anywhere to directly type in a weekly/monthly/yearly total. Every rollup (`paparanBulanIni`'s Minggu1-5 buckets, `ringkasan.kutipan`/`.perbelanjaan`'s month/year totals, `graf`'s 12-month series, `dataKumulatif`'s running sum) is computed by `api/publish-infaq.js`'s pure, exported helper functions (`computeMonthTotal`, `computeYearTotal`, `computeWeekBuckets`, `computeYearlyGraf`, `computeCumulative`, `computeProjectProgress` — same "exported for unit-testing without a live deploy" convention as `api/publish.js`) at Terbitkan time. `admin/infaq/ringkasan.html`'s stat cards preview simple independent sums client-side — deliberately NOT a client-side reimplementation of the full week-bucket/graf logic, same separation of concerns `dashboard.js` already has from `api/publish.js`.

**Infaq project activation must deactivate-then-activate, in that order (partial unique index enforces at most one active project):** `admin/infaq/projek.js`'s `confirmActivate()` runs two sequential `UPDATE`s — the currently-active project first (`is_active: false, completed_at: now()`), then the target (`is_active: true`) — never the reverse, or briefly (between the two statements, if reordered) two rows would both need `is_active = true`, violating `idx_infaq_projects_one_active`. New projects are created with `is_active: false` always — activating is a separate, explicit step, so creating a draft project can never silently deactivate whatever's currently live.

**Infaq's January cumulative edge case (see `api/publish-infaq.js`'s pure functions, unit-tested):** `perbelanjaan.json`'s `paparanBulanLepas.JumlahKumulatif` is a running sum *within one calendar year* (resets at the year boundary). When "now" is January, "bulan lepas" is December of the **previous** year — its cumulative must be computed from that previous year's own 12-month series (`computeYearlyGraf(...,  lastMonthYear)` → `computeCumulative(...)[11]`), never read from the current (new) year's array, which would just show January's own total or zero. Get this wrong and the December-cumulative figure silently resets to near-zero every January 1st.

**`logActivity()` now takes an optional 4th param for the target table (app.js):** `logActivity(action, targetLabel, detail, table = 'activity_log')` — every pre-existing call site is unaffected (table defaults to kuliah's `activity_log`); `admin/infaq/*.js` pass `'infaq_activity_log'` explicitly. **`userlog.html` does NOT show `infaq_activity_log` rows** — every infaq accountability entry is currently write-only (nothing displays it), a known gap flagged in `admin/DEV_NOTES.MD`, not yet built.

## Sensitive Files

- `admin/` has no config files with secrets — credentials are Vercel env vars
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only, never in browser code
- `GITHUB_TOKEN` — Vercel env var only, used in `api/publish.js`
- Supabase anon key in `app.js` is public (safe — RLS enforces access control)
