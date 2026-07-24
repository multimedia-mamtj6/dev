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
- **`admin/infaq/`** — donation/expense tracking, redesigned 2026-07-21 to
  match the mosque's real recording pattern (from the live `infaq.mamtj6.com`
  Sheet, not an assumed shape): general infaq is logged as one lump sum per
  week (`infaq_kutipan_mingguan`), expenses as one lump sum per month
  (`infaq_perbelanjaan_bulanan`) — both sparse, upserted, never
  hand-aggregated into a total. Only project-earmarked donations
  (`infaq_projek_kutipan`) are genuinely individual dated rows. Every
  further rollup (monthly/yearly totals, `graf`, active-project progress)
  is still always **computed**, never typed in directly (see
  `api/publish-infaq.js`).

Shared/cross-module concerns (login, nav shell, admin-user management,
activity-log viewer) stay flat at `admin/` root — see File Structure below.
It sits at the repo root, rather than under `kuliah/`, specifically *because*
it's a multi-module hub — `kuliah/admin/` would have been misleading once it
hosted non-kuliah modules. `kuliah/jadual/` is the public-facing read-only
schedule view that reads kuliah's published JSON — see `kuliah/CLAUDE.md` for
that side. **infaq has no public-facing page yet** — its published JSON lands
in this repo (`admin/infaq/data/`) but nothing reads it publicly yet, by
deliberate choice (see `admin/infaq/`'s own history in `admin/DEV_NOTES.MD`).

## Tech Stack

- Pure HTML5, CSS3, Vanilla JS (ES6+) — no npm, no build tools
- Supabase — PostgreSQL, Auth (Google OAuth), Storage (kuliah-assets bucket)
- Vercel — static hosting + `api/publish.js` serverless function
- GitHub — published data store (JSON pushed via API from publish endpoint)

## File Structure

```
admin/
  index.html       ← Login page (Google OAuth) — shared, module-agnostic
  dashboard.html/.js ← Cross-module overview (added 2026-07-22) — the universal
                      post-login landing page for any admin with kuliah and/or
                      infaq access: today's/upcoming kuliah + month completion +
                      last-published status, and infaq's bulan-ini kutipan/
                      perbelanjaan + active project progress. Each section
                      links onward to jadual.html/ringkasan.html for full
                      detail. Replaces the old dashboard.html redirect stub
                      that used to live at this path.
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
    jadual.html/.js ← Monthly calendar + day editor modal, Terbitkan (renamed from dashboard.html/.js 2026-07-22)
    dashboard.html     ← zero-JS redirect stub → jadual.html (old path, kept working)
    ustaz.html/.js     ← Penceramah CRUD

  infaq/           ← Module: donation/expense tracking (new 2026-07-19, schema redesigned 2026-07-21)
    infaq-common.js    ← Shared across this module: requireInfaqAccess(), formatRM(), BULAN_MY,
                          publishInfaq()/loadLastPublishedInfaqNote() (Terbitkan, shared by the 3 pages below)
    ringkasan.html/.js ← Module landing page: read-only stat cards + active-project progress only —
                          no Terbitkan here, each data page publishes itself (see below)
    kutipan.html/.js   ← General infaq: one row per week (tahun/bulan/minggu), upsert on save,
                          fetch-all-once + client-side year filter (small table, not paginated) —
                          owns the `monthly` Terbitkan button
    perbelanjaan.html/.js ← Expenses: one row per month (tahun/bulan), same upsert/fetch-all shape —
                          owns the `perbelanjaan` Terbitkan button
    projek.html/.js    ← Fundraising project settings CRUD (small list, like ustaz.js) — each row
                          links to projek-kutipan.html for that project's individual donations
    projek-kutipan.html/.js ← ONE project's individual dated donations (?project=<id> in the URL) —
                          paginated/filtered like the old kutipan.js, since this is the only infaq
                          table that's genuinely per-deposit — owns the `daily` Terbitkan button,
                          shown only when viewing the currently-active project (daily.json always
                          reflects whichever one project is active, never a completed one)
    data/monthly.json, data/daily.json, data/perbelanjaan.json, data/data.json ← Published data
                          admin/infaq/ writes (api/publish-infaq.js) — no reader yet. Under admin/
                          (not top-level infaq/, unlike kuliah's own data/ convention) since there's
                          no public consumer — colocated with the module that produces it. Field/key
                          shapes still deliberately mirror the real infaq.mamtj6.com reference
                          site's own structure, so a future public page or path migration stays cheap.
                          data.json is written by the `daily` Terbitkan action alongside daily.json
                          (2 files, 1 commit each, same request) rather than getting its own button —
                          see admin/developer.md's Publish endpoint section for why.

admin/ustaz.html  ← zero-JS redirect stub → admin/kuliah/ustaz.html (old bare /admin/ URL,
                     pre-module-restructure, kept working). admin/dashboard.html used to be a
                     matching stub too, but that path now hosts the real cross-module overview
                     (2026-07-22) — see above.
kuliah/
  admin/           ← 5 zero-JS meta-refresh redirect stubs → /admin/... (URLs from BEFORE the
                      kuliah/admin/ → admin/ move, kept working)
  jadual/          ← Public schedule view (see kuliah/CLAUDE.md)
  paparan/         ← Digital signage (see kuliah/CLAUDE.md)
  data/jadual_lengkap_v2.json ← Published data admin/kuliah/ writes, that jadual/paparan read
```

## Supabase Schema

```sql
-- admins: who can log in
id uuid PK, email text UNIQUE, name text,
role text CHECK ('editor'|'super_admin'|'viewer'),  -- viewer added 2026-07-23, write access RLS-enforced (see database.md §3)
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
launch_date date,  -- optional, added 2026-07-23 — see database.md
created_at timestamptz, updated_at timestamptz

-- infaq_kutipan_mingguan: general infaq, ONE ROW PER WEEK ACTUALLY COLLECTED
-- (matches the real Sheet — a lump sum per week, never per-donor). Sparse
-- by design: a week with nothing collected has no row. Upserted on
-- (tahun, bulan, minggu) — recording an existing week replaces its total.
id uuid PK, tahun integer NOT NULL, bulan integer CHECK (1-12) NOT NULL,
minggu integer CHECK (1-5) NOT NULL, jumlah numeric(12,2) CHECK (> 0) NOT NULL,
created_at timestamptz, updated_at timestamptz, UNIQUE(tahun, bulan, minggu)

-- infaq_projek_kutipan: individual dated donations earmarked to ONE
-- project — the only infaq table that's genuinely per-deposit. project_id
-- is required (general infaq never touches this table at all).
id uuid PK, project_id uuid FK→infaq_projects(id) NOT NULL,
tarikh date NOT NULL, jumlah numeric(12,2) CHECK (> 0) NOT NULL,
keterangan text, created_at timestamptz, updated_at timestamptz

-- infaq_perbelanjaan_bulanan: expenses, ONE ROW PER MONTH TOTAL — the real
-- Sheet never tracked category/description per expense, only a monthly
-- lump sum, so this matches exactly. Same sparse/upsert principle as
-- infaq_kutipan_mingguan.
id uuid PK, tahun integer NOT NULL, bulan integer CHECK (1-12) NOT NULL,
jumlah numeric(12,2) CHECK (> 0) NOT NULL,
created_at timestamptz, updated_at timestamptz, UNIQUE(tahun, bulan)

-- infaq_activity_log: SEPARATE from activity_log by deliberate choice
-- (independent auditability for money data) — otherwise identical shape
id uuid PK, created_at timestamptz,
actor_email text NOT NULL, actor_name text,
action text NOT NULL,       -- infaq_kutipan_mingguan_create/update/delete |
                             -- infaq_projek_kutipan_create/update/delete |
                             -- infaq_perbelanjaan_create/update/delete |
                             -- infaq_project_create/update/delete/activate |
                             -- publish_monthly | publish_daily | publish_perbelanjaan
target_label text, detail text
```

RLS is ON on all tables. Anon key used in browser (read/write with RLS). Service role key server-side only (Vercel env var). **New tables never inherit grants automatically** (see Key Patterns) — `infaq_projects`/`infaq_kutipan_mingguan`/`infaq_projek_kutipan`/`infaq_perbelanjaan_bulanan` grant `service_role` SELECT-only (publish reads, never writes them); `infaq_activity_log` grants `service_role` full CRUD (publish also writes to it), same as `activity_log`. `admins` also grants `service_role` SELECT-only (added 2026-07-22 — `api/publish.js`/`api/publish-infaq.js` both look up the publishing admin's name from it; this table predates that lookup, so the grant was missing for a long time and failed silently rather than erroring, see Key Patterns).

## Data Flow

```
kuliah: Admin edits day in admin/kuliah/jadual.html
  → upsert to Supabase `schedule` (date is the conflict key)
  → click Terbitkan (publish)
  → POST /api/publish?month=YYYY-MM  (Bearer: session token)
  → api/publish.js validates token, reads schedule+ustaz from Supabase (service role)
  → builds jadual_lengkap_v2.json
  → pushes to GitHub via API (GITHUB_TOKEN env var)
  → Vercel serves updated JSON

infaq: Admin logs a week's total in admin/infaq/kutipan.html, a month's
  total in perbelanjaan.html, or an individual project donation in
  projek-kutipan.html
  → upsert to Supabase `infaq_kutipan_mingguan` (tahun,bulan,minggu) /
    `infaq_perbelanjaan_bulanan` (tahun,bulan), or insert to
    `infaq_projek_kutipan` (genuinely one row per deposit) — none of these
    are ever hand-aggregated into a further total
  → click Terbitkan on that same page (kutipan.html / perbelanjaan.html /
    projek-kutipan.html each own their own button, right next to the data
    they publish — no Terbitkan on ringkasan.html, which is read-only)
  → POST /api/publish-infaq?target=monthly|daily|perbelanjaan (Bearer: session
    token, no month param — always a full as-of-now snapshot of that ONE file)
  → api/publish-infaq.js reads only the Supabase table(s) that target needs
    (service role), COMPUTES weekly/monthly/yearly rollups + active-project
    progress for that file only
  → pushes exactly ONE of admin/infaq/data/{monthly,daily,perbelanjaan}.json to GitHub
  → no public reader yet — see What This Is
```

## Key Patterns

**Sidebar nav — static HTML/CSS shell + one `MODULES` config in `app.js` for the links (redesigned 2026-07-22, then again same day to drop Tailwind CDN):** the old flat top nav was hand-copy-pasted into all 9 admin pages and had already drifted (kuliah pages collapsed infaq into one link, infaq pages listed kuliah's links individually alongside all 4 of infaq's own — the exact clutter that prompted this redesign). A first pass built the whole sidebar via JS + Tailwind Play CDN, but on this multi-page app (every click is a full page reload, not client-side routing) the CDN's runtime JIT scan/style-generation on every single navigation was visibly slow and caused a flicker even after the JS-timing issue below was fixed — so the sidebar shell went back to plain static HTML/CSS (same mechanism as everything else on this site), and Tailwind CDN was dropped from `admin/` entirely. Every page now has the *same, identical, permission-agnostic* sidebar shell markup (topbar/backdrop/`<aside id="sidebar">` frame with an empty `<nav id="sidebar-nav">` placeholder) directly in its HTML — copied, but with zero drift risk since it never varies per page — plus its existing `<div class="page">` wrapped in `<div class="admin-content">` so content clears the fixed sidebar on desktop:
```html
<head>
  ...
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
</head>
<body>
  <div class="sidebar-mobile-topbar">
    <button class="sidebar-toggle-btn" onclick="toggleNav()" aria-label="Menu">&#9776;</button>
    <span>Admin MAMTJ6</span>
  </div>
  <div class="sidebar-backdrop" id="sidebar-backdrop" onclick="closeNav()"></div>
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">Admin MAMTJ6</div>
    <nav class="sidebar-nav" id="sidebar-nav"></nav>
    <div class="sidebar-footer">
      <button class="sidebar-logout-btn" onclick="signOut()">Log Keluar</button>
    </div>
  </aside>
  <div class="admin-content">
    <div class="page"> ... </div>
  </div>
  <!-- modals stay outside the wrapper, unaffected -->
  <script src="/admin/app.js"></script>
  ...
</body>
```
All sidebar styling (colors, fixed positioning, the off-canvas mobile transform) lives in `admin/style.css`'s "Sidebar" section as plain hand-written CSS — it paints in the browser's normal blocking `<link>` pass, with zero JS/CDN dependency, exactly like every other page element. Only `#sidebar-nav`'s *contents* — the actual module links, which genuinely depend on the logged-in admin's permissions — are JS-rendered: `renderSidebar()` (called once from `requireAuth()`) builds them from a single `MODULES` array in `app.js`. Every href lives once in `MODULES`, always absolute (`/admin/...`), which structurally rules out the relative-path-under-cleanUrls landmine (below) for every nav link permanently. Each `MODULES` item carries a `match` array of every pathname that should highlight it active — this is how `projek-kutipan.html` (an infaq sub-page, not one of the 4 visible labels) highlights "Projek" as its active parent without any filename-guessing. **If you add a module or a page, add one entry to `MODULES` — that's the whole change now, not "update both `_injectSuperAdminNav()` and `_hideUnauthorizedModuleLinks()` and every page's hardcoded `class="active"`" like before.**

**A different `cleanUrls` surprise: Vercel REDIRECTS a `.html`-suffixed URL to its extensionless form, which broke sidebar active-highlighting until fixed 2026-07-22 (found from a live screenshot — the sidebar showed no active item on any page):** every `MODULES` `href`/`match` entry is written with a literal `.html` suffix (matching this repo's own convention everywhere else — `defaultLandingPageFor()`, redirect stubs, `signInWithGoogle()`'s `redirectTo`, all `.html`-suffixed). But `vercel.json` has `cleanUrls: true`, which doesn't just serve a directory's `index.html` at the bare path (the landmine below) — it also issues a real 308 redirect from `/admin/kuliah/jadual.html` to the extensionless `/admin/kuliah/jadual` for **any** `.html` file, not just `index.html`. So on the live deploy, `window.location.pathname` never actually has a `.html` suffix by the time `renderSidebar()` runs — it silently never matched any `MODULES` `match` entry, on every page, not just one. **Invisible locally by construction**, same as the landmine below — `python -m http.server` doesn't perform Vercel's redirect at all, so a local test sees the literal `.html`-suffixed path and the bug never reproduces there. Fixed by normalizing both `window.location.pathname` and every `match` entry (strip a trailing `.html` from each) before comparing in `renderSidebar()`, rather than changing every href to the extensionless form (which would also need re-registering the OAuth redirect URL in Supabase's allowlist for `signInWithGoogle()`'s `redirectTo` — a much bigger, riskier change than a highlighting bug warrants). **If sidebar highlighting ever breaks again, check this normalization is still in `renderSidebar()` before assuming the `MODULES` data itself is wrong.**

**Any HTML `href`/`src`, and any JS-driven navigation (`window.location.replace`/`.href`), under `admin/` must use absolute root-relative paths (`/admin/...` or `/admin/kuliah/...`/`/admin/infaq/...`), never a bare/relative filename — this is a repo-wide landmine, hit multiple times in different folders (see `kuliah/CLAUDE.md` for the `kuliah/paparan/` recurrence):** Vercel's `cleanUrls: true` serves a directory's `index.html` at the bare directory path with **no trailing slash** (`/admin`, `/admin/kuliah`). Per standard URL relative-resolution rules, any relative reference from a slash-less path treats the last path segment as a filename to be *replaced*, not a directory to append to. Session 7 (back when this lived at `kuliah/admin/`): `index.html`'s relative `window.location.replace('dashboard.html')` resolved one level too high — fixed with absolute paths. Those absolute paths were re-swept to `/admin/...` on the 2026-07-19 root move (`admin/plan.md`), then re-swept AGAIN the same day to `/admin/kuliah/...` for the module restructure (dashboard.html/ustaz.js moved a level deeper) — **this is now a recurring cost of any future path change, not a one-time fix; grep for the old path every time you move something.** `admin/infaq/`'s landing page is deliberately named `ringkasan.html`, not `index.html`, specifically to avoid a THIRD instance of this bug (an `index.html` under `admin/infaq/` would itself be served at the bare slash-less `/admin/infaq` path). **Treat this as a mandatory check for any brand-new HTML entry point added under `admin/` — a relative asset path will work perfectly under local `python -m http.server` and under Live Server, and only break once deployed to Vercel, so local testing alone will not catch it.** (Nav links specifically are no longer at risk from this — the 2026-07-22 sidebar redesign centralized every nav href into `app.js`'s `MODULES` array, always written absolute, so there's no more per-page copy to regress. This still applies to everything else: redirects, form actions, fetch URLs, new pages. Proven out the same day: the `dashboard.html` → `jadual.html` rename only needed 3 one-line edits in `app.js` — `MODULES`, `defaultLandingPageFor()`, and the OAuth `redirectTo` — instead of a repo-wide grep-and-fix.)

**Module permission gate (`permissions.kuliah`/`permissions.infaq` on `admins`, added 2026-07-19):** every module page calls a gate right after `requireAuth()` — `admin/infaq/*.js` pages call `requireInfaqAccess()` (`admin/infaq/infaq-common.js`), `admin/kuliah/jadual.js`/`ustaz.js` call `requireModuleAccess('kuliah')` directly. Both are backed by the same generic `requireModuleAccess(moduleKey)` in `app.js` (`requireInfaqAccess()` is now a 1-line wrapper around it) — denies and redirects unless `role === 'super_admin'` or `permissions.<moduleKey>` is truthy. **`admin/kuliah/` had no equivalent gate until 2026-07-23** (`permissions.kuliah` existed in the schema and was editable in `users.html`, but nothing checked it — see `admin/DEV_NOTES.MD` for that history); closed alongside adding the `viewer` role, since "which modules can an admin access" was meaningless for kuliah without it. `defaultLandingPageFor(admin)` (app.js) is the shared "where does this admin land" helper — any admin with `role === 'super_admin'` or either `permissions.kuliah`/`permissions.infaq` lands on the shared `/admin/dashboard.html` overview (which itself shows/hides each module's section based on that same permission check, and links onward to `jadual.html`/`ringkasan.html`), else `null` (caller must show a message, **never** redirect on `null` — redirecting to another gated page is exactly how you get a bounce loop between two denied pages). This also closes a gap the old per-module landing had: `signInWithGoogle()`'s OAuth `redirectTo` is a single fixed URL (Supabase/Google only allow redirecting to an allowlisted URL, not a dynamically-computed one) — it used to always be `jadual.html` regardless of the admin's actual permissions, so an infaq-only admin's first-ever login landed them on a kuliah page. Now it's `dashboard.html`, which is meaningful for any permitted admin.

**Read vs. write are two separate checks (`viewer` role, added 2026-07-23):** `requireModuleAccess(moduleKey)` (above) only decides whether an admin can *see* a module page at all — it treats `'editor'` and `'viewer'` identically, both gated purely on `permissions.<moduleKey>`. A second function, `canWriteModule(moduleKey)` in `app.js`, decides whether they can actually write there: `role === 'super_admin'`, or `role === 'editor'` AND `permissions.<moduleKey>` truthy — `'viewer'` always returns `false`, unconditionally. Every Add/Edit/Delete/Terbitkan control across `admin/kuliah/` and `admin/infaq/` is wrapped in a `canWriteModule()` check (hidden button, or in `jadual.js`'s day-editor modal — the one write control that isn't a simple button — disabled fields with Save hidden, since the modal itself stays open so a viewer can still inspect a day's detail). **This UI-level check is a courtesy, not the real security boundary** — the actual enforcement is in Postgres: `admin/setup.sql` §9's `admin_can_write(module_key)`/`admin_is_super_admin()` `SECURITY DEFINER` SQL functions back real per-table RLS policies (SELECT open, INSERT/UPDATE/DELETE gated) on `admins`, `ustaz`, `schedule`, and all 4 infaq data tables — mirrors `canWriteModule()`'s logic exactly, so a viewer (or a direct API call bypassing the UI entirely) genuinely cannot write, not just can't see the button. `activity_log`/`infaq_activity_log` were deliberately left ungated — see `database.md` §3 for the reasoning. Full design/reasoning: `database.md` §3.

**Mobile breakpoints:**
- `≤768px` — tablet compact; also where the sidebar goes off-canvas (`admin/style.css`'s `@media (max-width: 768px)` sidebar rules — `.sidebar` gets `transform: translateX(-100%)` by default, `.sidebar.open` reverses it, toggled by `toggleNav()`/`closeNav()` in `app.js`; a `.sidebar-mobile-topbar` provides the hamburger below this width, hidden above it. Deliberately the same breakpoint as the pre-existing tablet-compact zone rather than a second one.)
- `≤640px` — phone: card-per-row tables, day list calendar

**Data table mobile pattern:** Every JS-rendered `<td>` needs `data-label="..."` for the card-per-row mobile layout. CSS reads `content: attr(data-label)` via `::before`.

**Ustaz sort:** Always client-side with `localeCompare({ numeric: true })`. Never `.order('short_name')` on Supabase — it sorts lexicographically. Both `ustaz.js` (Penceramah page `#` column) and `jadual.js` (day-editor Subuh/Maghrib dropdowns) sort this exact way so their numbering lines up — `jadual.js`'s `openModal()` renders each option as `"{short_name} (N)"` (suffix, not prefix, so the browser's native type-to-jump-by-letter still works), 0-indexed, with `"— Tiada Kuliah —"` pinned first and unnumbered. These numbers are a recalculated position, not a stored field — they shift if the ustaz roster changes.

**`isYasinEntry(ustaz)` (app.js):** matches `/yasi+n/i` against `short_name + full_name` combined, to detect the "Bacaan Yasiin & Tahlil" special ustaz entry regardless of which field has which spelling ("Yasin" vs "Yasiin"). `jadual.js` uses it to swap the calendar's session-tag pill / mobile day-list text to a `.yasin`/`.mdc-yasin` light-green style instead of the normal subuh/maghrib colors. Use this helper (not a hardcoded dropdown position — those aren't stable) if this needs extending anywhere else.

**Poster save (3-way logic in saveUstaz):**
- `pendingRemovePoster` → `poster_url: null`
- New file or URL entered → `poster_url: newValue`
- Neither → omit `poster_url` from payload (preserves existing)

**Cache-busting:** `vercel.json` serves `Cache-Control: no-store` for `/admin/(.*)` and `/kuliah/jadual/(.*)`. `no-store` (not `max-age=0, must-revalidate`) is required — `must-revalidate` still lets mobile Chrome serve the page from bfcache with zero network request, so a stale copy with old JS can resurface after backgrounding the app. `no-store` disables bfcache for these routes.

**Dropdown menu pattern:** `.month-actions` (wrapper, `position: relative`) + `.month-actions-menu` (absolute-positioned panel, `.open` class toggles `display`) + `.month-actions-item` (row). Closed via a single shared `document.addEventListener('click', ...)` in `jadual.js`; each trigger button calls `e.stopPropagation()` so its own click doesn't immediately close it again. Both the "Tindakan Bulan" (Salin Data / Kosongkan) and "Lihat Terbitan" (Tunjukkan Jadual / Export PDF) dropdowns in `jadual.html` reuse this exact CSS — reuse it for any future dropdown rather than inventing a new one.

**Publish merges by absolute month key, prunes stale months:** `jadual_lengkap_v2.json` is `{ "months": { "YYYY-MM": { infoJadual, senaraiHari }, ... } }`. Each `Terbitkan` click (`api/publish.js`) reads the existing file, writes only `months[thatMonth]`, and leaves every other key untouched — so publishing "next month" (even to clear it) no longer wipes out "this month"'s data. The endpoint rejects any `month` that isn't the real-current or real-next `YYYY-MM` (computed server-side in Malaysia time, UTC+8) and prunes any other key out of `months` on every publish, so the file never holds more than these two months at once. `kuliah/jadual/script.js` looks up `jsonData.months[monthKey]` where `monthKey` is derived from `baseDate` (today, or +1 month for `?bulan=depan`) — so month rollover (July → August) is automatically correct with no republish needed, since the key was already written when that month was "next month". If a month key is entirely absent (never published), the public page shows "Jadual belum diterbitkan buat masa ini." instead of a blank-looking page.

**Local testing:** `Terbitkan` calls `POST /api/publish`, a Vercel serverless function that does not exist under plain `python -m http.server` (the documented local-dev method for this repo) — it will 404 and surface as a "Ralat sambungan" toast. Day-edit/save, and the Duplicate/Clear month actions (below), all write directly to Supabase instead — same production project everywhere, no local/prod split — so they work locally but have real, immediate, non-sandboxed effects on production data.

**Month action buttons only show for the real current/next month:** `jadual.js`'s `updateScheduleActions()` computes `isRealCurrent`/`isRealNext` from an actual `new Date()` (never from the dashboard's own navigable `currentYear`/`currentMonth`), since `kuliah/jadual/script.js` can only render the real current month or real next month (`?bulan=depan`) — no arbitrary-month param exists. This one computation also drives the "Bulan Ini"/"Bulan Depan" `#month-tag` badge and whether `#future-month-note` (vs the Terbitkan button) is shown.

**Duplicate/Clear month actions:** "Salin Data {previous month}" copies `subuh_ustaz_id`/`maghrib_ustaz_id` only (never `cuti_umum` — holidays are date-specific and copying them forward would mislabel the wrong day) from the month immediately before whatever's currently displayed, matched by day-of-month number, full overwrite (confirmation modal shows how many already-filled target days will be replaced). "Kosongkan Bulan Ini" hard-deletes all `schedule` rows in the viewed month's date range. Both require the confirmation modal — same safeguard regardless of which month is targeted, including the real current/live month.

**"Last published" note on the dashboard (`#last-published-note` in `jadual.html`, `loadLastPublishedNote()` in `jadual.js`):** shown under the toolbar hint, only for the real current/next month (rides the same `isRealCurrent`/`isRealNext` gate `updateScheduleActions()` already computes). Reads the most recent `activity_log` row where `action = 'publish'` and `target_label` exactly matches the viewed month's label (e.g. `"Julai 2026"`) — no new logging needed, `api/publish.js` already writes this row on every successful Terbitkan. Shows `"Bulan ini belum pernah diterbitkan."` if no row exists yet. Refreshed on month navigation and immediately after a successful publish (no reload needed). Formatting helpers `formatDateTimeMY()`/`formatRelativeMY()` (Malay relative-time ladder: baru sahaja → minit → jam → hari → minggu → bulan lalu) live in shared `app.js`.

**Email matching against `admins.email` must use `ilike`, not `eq`:** Postgres `text` equality is case-sensitive by default, and `admins.email` (often typed by hand, e.g. via `setup.sql`'s bootstrap insert) isn't guaranteed to match the exact casing Google OAuth/Supabase Auth actually returns for that account. A mismatch doesn't error — `.eq('email', ...)` just silently matches zero rows, and whatever fallback exists kicks in quietly. Both `jadual.js`'s last-published-note admin-name fallback lookup and `api/publish.js`'s own actor-name lookup use `.ilike()` (`email=ilike.` in the REST form) for this reason — use the same for any future email-matching query against `admins`.

**"Belum Ditetapkan" pending slots (session 8):** a Subuh/Maghrib slot can be marked pending instead of assigned an ustaz — for a day known to have Kuliah/Ceramah Khas where the speaker/topic isn't decided yet. Day-editor modal (`jadual.html`) has a checkbox per session (`subuh-pending-check`/`maghrib-pending-check`) under each ustaz `<select>`; checking it disables+clears that select (`toggleSubuhPending()`/`toggleMaghribPending()` in `jadual.js`). `saveDay()` writes `schedule.subuh_pending`/`maghrib_pending` (booleans, mutually exclusive with the matching `*_ustaz_id` — checking pending forces the id to `null`). `api/publish.js` maps a pending slot to a `{ pending: true }` marker object in the published JSON instead of an ustaz object or `null` — this is truthy, so it automatically routes correctly through every existing "is this day/session empty" check with zero changes to that logic. `kuliah/jadual/script.js` renders it as a dashed-border "Ceramah Khas — Akan Diumumkan" block; `kuliah/paparan/script.js` shows the same message on the signage screen (see `kuliah/CLAUDE.md` for the rendering side). The point of the whole feature: the public schedule must show *that* a slot exists without ever showing placeholder/undetermined ustaz info as if it were real.

**Activity log (`activity_log` table + `logActivity()` in app.js, viewed at `userlog.html`, super_admin only):** every mutating admin action inserts one row right after its write succeeds — schedule day edits, bulk duplicate/clear (one summary row each, not per-date), ustaz create/update/delete, admin-account create/update/delete, and Terbitkan/publish (logged server-side from `api/publish.js` using its existing service-role client, since that write happens outside the browser). `target_label`/`detail` are always plain-text snapshots (an ustaz's `short_name`, an admin's email, a month label) — **never** a live foreign key — so history stays readable even after the referenced ustaz/admin is later renamed or deleted. Each call-site captures its "before" value from an already-loaded in-memory cache (`scheduleMap`, `allUstaz`, `allUsers`) rather than an extra query, builds a diff string via a small pure `build*DiffText()` helper local to that page's JS file, and skips the insert entirely if nothing actually changed (no no-op log rows). `logActivity()` never throws or toasts — a logging failure must never make an admin think their actual save/delete/publish failed.

**Infaq schema matches the real Sheet, not an assumed shape (redesigned 2026-07-21):** the original 2026-07-19 build assumed every donation/expense is entered as an individual raw row. The user then shared the actual live data behind `infaq.mamtj6.com` — general infaq is recorded as **one lump sum per week** (`Tahun/Bulan/Minggu1-5`), expenses as **one lump sum per month**, and only project-earmarked "tabung" donations are genuinely individual dated entries. The schema was rebuilt to match: `infaq_kutipan_mingguan` (tahun/bulan/minggu/jumlah), `infaq_perbelanjaan_bulanan` (tahun/bulan/jumlah), `infaq_projek_kutipan` (tarikh/jumlah/keterangan, project_id required). This was a clean rebuild, not a migration — the original schema was never run against live Supabase. Higher-level rollups (`paparanBulanIni`'s Minggu1-5 buckets, `ringkasan.kutipan`/`.perbelanjaan`'s month/year totals, `graf`'s 12-month series, `dataKumulatif`'s running sum) are still always computed by `api/publish-infaq.js`'s pure, exported helper functions (`sumJumlah`, `filterTahunBulan`, `filterTahun`, `buildMingguBuckets`, `buildYearlyGraf`, `computeCumulative`, `computeProjectProgress` — same "exported for unit-testing without a live deploy" convention as `api/publish.js`) at Terbitkan time, never typed in directly. `admin/infaq/ringkasan.html`'s stat cards preview simple independent sums client-side — deliberately NOT a client-side reimplementation of the full week-bucket/graf logic, same separation of concerns `jadual.js` already has from `api/publish.js`.

**Infaq's weekly/monthly entry pages upsert, they don't insert-only:** `kutipan.js`'s save (on `tahun,bulan,minggu`) and `perbelanjaan.js`'s save (on `tahun,bulan`) both use Supabase `.upsert(payload, { onConflict: '...' })`, not `.insert()`. This matches the real workflow — the committee just records "this week's/month's total," they shouldn't need to remember whether a row already exists for that period. Both pages fetch their entire table once and filter/sum client-side (year filter) rather than server-side pagination — the old per-donation `kutipan.js` needed pagination because it was unbounded; these tables grow by ~1 row/week or ~1 row/month, small enough to hold entirely in memory.

**Infaq project activation must deactivate-then-activate, in that order (partial unique index enforces at most one active project):** `admin/infaq/projek.js`'s `confirmActivate()` runs two sequential `UPDATE`s — the currently-active project first (`is_active: false, completed_at: now()`), then the target (`is_active: true`) — never the reverse, or briefly (between the two statements, if reordered) two rows would both need `is_active = true`, violating `idx_infaq_projects_one_active`. New projects are created with `is_active: false` always — activating is a separate, explicit step, so creating a draft project can never silently deactivate whatever's currently live.

**Infaq's January cumulative edge case (see `api/publish-infaq.js`'s pure functions, unit-tested):** `perbelanjaan.json`'s `paparanBulanLepas.JumlahKumulatif` is a running sum *within one calendar year* (resets at the year boundary). When "now" is January, "bulan lepas" is December of the **previous** year — its cumulative must be computed from that previous year's own 12-month series (`buildYearlyGraf(rows, lastMonthYear)` → `computeCumulative(...)[11]`), never read from the current (new) year's array, which would just show January's own total or zero. Get this wrong and the December-cumulative figure silently resets to near-zero every January 1st.

**`logActivity()` now takes an optional 4th param for the target table (app.js):** `logActivity(action, targetLabel, detail, table = 'activity_log')` — every pre-existing call site is unaffected (table defaults to kuliah's `activity_log`); `admin/infaq/*.js` pass `'infaq_activity_log'` explicitly.

**`userlog.html` merges BOTH `activity_log` and `infaq_activity_log` into one timeline (fixed 2026-07-22 — previously infaq's log was write-only, nothing displayed it):** `userlog.js`'s `LOG_SOURCES` array (`[{ module, table, actionLabels }, ...]`) is the single source of truth for which tables feed the page — mirrors `app.js`'s `MODULES` array pattern, so a future third module's own `<module>_activity_log` table is one array entry, not a rewrite. `loadLog()` queries every source in `LOG_SOURCES` in parallel (each capped at `logLimit` — sufficient to guarantee the true merged top-N, since a global top-N can never need more than N rows from any single source), tags each row with its module, then merges and re-sorts by `created_at` so kuliah and infaq events interleave into one real chronological timeline rather than two separate lists a toggle would force apart. A source that errors degrades to an empty list for that source rather than blanking the whole page. The Tindakan filter dropdown groups both modules' actions under `<optgroup>`s built from the same `LOG_SOURCES` array. **Adding a future module's activity log to this page needs zero new grants** — `authenticated` already has `SELECT` on `infaq_activity_log` (proven by `loadLastPublishedInfaqNote()` already reading it from the browser), so this was purely additive to a read-only page; only a genuinely new table (for a genuinely new module) would need the standard new-table `GRANT` treatment below.

**Infaq's 3 publish targets are fully independent, not one combined publish, and each lives on its own data page (2026-07-22):** `api/publish-infaq.js` requires `?target=monthly|daily|perbelanjaan`, fetches only the Supabase table(s) that one target needs, and pushes only that one file — so recording an expense never requires also recomputing/republishing kutipan data or vice versa. The Terbitkan button for each target sits on the page where that data is edited — `kutipan.html` (monthly), `perbelanjaan.html` (perbelanjaan), `projek-kutipan.html` (daily, shown only when viewing the currently-active project, since `daily.json` always reflects that one project) — **not** on `ringkasan.html`, which moved back to a read-only stats overview (2026-07-22, superseding the brief ringkasan-centric design from earlier the same day). The shared plumbing (`publishInfaq(target, btnId)`, `loadLastPublishedInfaqNote(action, elId)`, the `PUBLISH_BUTTON_LABELS`/`PUBLISH_NOTE_TARGETS` lookups) lives in `infaq-common.js` so all 3 pages call the same code. Each target logs its own `infaq_activity_log` action (`publish_monthly`/`publish_daily`/`publish_perbelanjaan`). If you add a 4th infaq output file in the future, follow this same shape — a new `TARGETS` entry in `api/publish-infaq.js`, a new button + note pair on whichever page owns that data, not a return to one combined endpoint or a centralized publish page.

**Cross-module overview (`admin/dashboard.html`/`.js`, added 2026-07-22):** the universal post-login landing page (see `defaultLandingPageFor` above) — gates each section by the same `role === 'super_admin' || permissions?.X` check `renderSidebar()`/`requireInfaqAccess()` already use, so a kuliah-only admin never sees infaq numbers and vice versa. Every figure is a fresh, independent query against the same tables the full pages already read (`schedule`+`ustaz`, `activity_log`, `infaq_kutipan_mingguan`/`infaq_perbelanjaan_bulanan`/`infaq_projects`/`infaq_projek_kutipan`) — nothing is cached or shared across pages, since this is a plain MPA with no client-side state persistence between page loads. `dashboard.js`'s queries deliberately mirror existing patterns rather than reusing their code directly (different page, no shared module system): the kuliah section mirrors `jadual.js`'s month-bounded `schedule` fetch, its `countFilledDays`-style truthy-field check, and its `activity_log` "last publish for this month's label" lookup; the infaq section is a narrower version of `ringkasan.js`'s `loadStats()`/`loadActiveProject()` — bulan-ini only (no bulan-lepas/tahun breakdown), since this is meant as a glance, not a replacement for `ringkasan.html`'s fuller view. The generic stat-card/progress-bar CSS these both use (`.stat-grid`/`.stat-card`/`.stat-label`/`.stat-value`/`.progress-track`/`.progress-fill`/`.section-header-row`/`.subsection-title`/`.goto-link` in `style.css`) was renamed from an `infaq-`-prefixed set (`ringkasan.html` was its only prior consumer) specifically so `dashboard.html` and `ringkasan.html` share one definition instead of two near-duplicate CSS blocks — if you add a 4th module's own glimpse section later, reuse these same classes rather than inventing new ones.

## Sensitive Files

- `admin/` has no config files with secrets — credentials are Vercel env vars
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only, never in browser code
- `GITHUB_TOKEN` — Vercel env var only, used in `api/publish.js`
- Supabase anon key in `app.js` is public (safe — RLS enforces access control)
