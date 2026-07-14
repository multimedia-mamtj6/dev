# kuliah/admin — Developer Guide

## Quick start

```bash
# From repo root
python -m http.server
# Open http://localhost:8000/kuliah/admin/index.html
```

Admin pages fetch from Supabase — they work on `file://` for layout but auth and data require HTTP.

---

## File map

| File | Purpose |
|------|---------|
| `admin/index.html` | Login page — Google OAuth via Supabase |
| `admin/app.js` | Shared: Supabase client (`db`), `requireAuth()`, `signOut()`, `showToast()`, `escapeHtml()`, `_injectSuperAdminNav()`, `toggleNav()` |
| `admin/style.css` | All admin styles: desktop, ≤768px tablet, ≤640px mobile |
| `admin/dashboard.html` | Monthly calendar grid + day editor modal + "Lihat Terbitan" and "Tindakan Bulan" dropdowns |
| `admin/dashboard.js` | `renderCalendar()`, `renderMobileDayList()`, `openModal()`, `saveDay()`, `publishMonth()`, `updateScheduleActions()` (real current/next month gating), `toggleMonthActionsMenu()`/`toggleScheduleActionsMenu()`, `openDuplicateModal()`/`confirmDuplicate()`, `openClearModal()`/`confirmClear()` |
| `admin/ustaz.html` | Penceramah list table + add/edit/delete modals |
| `admin/ustaz.js` | `loadUstaz()`, `renderTable()`, `openEditModal()`, `saveUstaz()`, `removePoster()`, `confirmDelete()` |
| `admin/users.html` | Admin user table + add/edit/delete modals (super_admin only) |
| `admin/users.js` | `loadUsers()`, `renderUsers()`, `saveUser()`, `confirmDeleteUser()` |
| `admin/userlog.html` | Activity log / changelog table + Admin/Tindakan/Dari/Hingga filter bar (super_admin only) |
| `admin/userlog.js` | `loadLog()`, `renderLog()`, `populateFilterOptions()`, `applyFilters()`, `resetFilters()`, `loadMoreLog()` |
| `admin/setup.sql` | Supabase schema reference |
| `admin/database.md` | Full database docs — setup from scratch, schema, RLS/GRANT model, troubleshooting |
| `DEV_NOTES.MD` | Session context memo — **read before touching anything** |

---

## Auth flow

1. `app.js` is loaded on every admin page. It initialises the Supabase client.
2. Each page calls `requireAuth()` (async) immediately. This checks for a Supabase session.
3. If no session → redirect to `index.html`.
4. If session found → resolves with session object; sets `currentAdmin` global.
5. `index.html` uses Supabase's `signInWithOAuth({ provider: 'google' })`. Only emails in the `admins` table are allowed post-login (checked by `requireAuth()`).
6. `signOut()` calls `supabase.auth.signOut()` then redirects to `index.html`.

---

## CSS architecture

Three breakpoint zones in `style.css`:

```
Base (desktop)           — everything above @media blocks
@media (max-width: 768px) — tablet: compact padding, smaller text
@media (max-width: 640px) — phone: hamburger nav, card tables, day list
@media print             — (none currently)
```

### Design tokens (`:root`)
```css
--primary: #16a34a        /* green — brand, buttons */
--primary-hover: #15803d
--bg: #f8fafc
--card: #ffffff
--border: #e2e8f0
--text: #1e293b
--text-muted: #64748b
--danger: #dc2626
--today-bg: #dcfce7
--today-border: #16a34a
```

### Mobile nav pattern (≤640px)
`.nav-links` is hidden by default; `.nav-links.open` shows it as a vertical dropdown. `toggleNav()` in `app.js` toggles the class. Nav links auto-close on click via `DOMContentLoaded` listener.

### Card-per-row table pattern (≤640px)
```css
.data-table thead { display: none; }
.data-table tbody tr { display: block; border: 1px solid var(--border); border-radius: 8px; }
.data-table td { display: flex; justify-content: space-between; border-bottom: 1px solid var(--border); }
.data-table td::before { content: attr(data-label); font-weight: 600; }
```
Every JS-rendered `<td>` must have `data-label="..."`. Empty string is fine for action columns.

**Trap:** The global desktop rule `.data-table tr:last-child td { border-bottom: none }` applies outside the media query and overrides mobile borders on the last row. The mobile block re-asserts borders to fix this.

### Dropdown menu pattern
```css
.month-actions { position: relative; }        /* or any wrapper needing this */
.month-actions-menu { display: none; position: absolute; ... }
.month-actions-menu.open { display: block; }
.month-actions-item { display: block; width: 100%; text-align: left; ... }
```
Toggle function calls `e.stopPropagation()`; a single shared `document.addEventListener('click', ...)` in `dashboard.js` closes all open menus. Both dropdowns in `dashboard.html` ("Tindakan Bulan" and "Lihat Terbitan") reuse this exact CSS — don't build a new dropdown pattern, extend this one.

### Ustaz modal two-column layout (`ustaz.html`)
`.ustaz-form-columns` wraps two `.ustaz-form-col` divs (identity fields left, poster fields right), stacked by default (mobile, unchanged) and side-by-side at `@media screen and (min-width: 768px)` with a `1px solid var(--border)` divider on the poster column. The modal itself uses a `.modal-poster` class (480px → 700px at that same breakpoint) instead of an inline `max-width` style.

---

## JS architecture

### app.js (shared across all pages)
- `const db` — Supabase client (anon key, safe in browser)
- `let currentAdmin` — set by `requireAuth()`, contains `{ email, name, role, permissions }`
- `requireAuth()` — async; redirects on fail; sets `currentAdmin`
- `showToast(msg, type, duration)` — type: `'success'` | `'error'`
- `escapeHtml(str)` — XSS sanitiser, used everywhere user content is interpolated
- `toggleNav()` — toggles `.nav-links.open`
- `_injectSuperAdminNav()` — appends "Pengguna" and "Log Aktiviti" links to `.nav-links` before `.spacer` if role is super_admin, each independently guarded against double-injection
- `isYasinEntry(ustaz)` — matches `/yasi+n/i` against `short_name + full_name` combined; detects the "Bacaan Yasiin & Tahlil" special ustaz entry regardless of spelling, used by `dashboard.js` to color its calendar pills green
- `logActivity(action, targetLabel, detail)` — fire-and-forget insert into `activity_log`, called right after a mutating Supabase write already succeeded. Never throws or toasts — a logging failure must not make the admin think their actual save/delete failed. Called from `dashboard.js`, `ustaz.js`, `users.js` (and separately, server-side, from `api/publish.js`)
- `formatDateTimeMY(iso)` — `toLocaleString('ms-MY', {...})` date+time formatter; shared by `dashboard.js` (last-published note) and `userlog.js` (log table)
- `formatRelativeMY(iso)` — Malay relative-time string (baru sahaja → minit → jam → hari → minggu → bulan lalu); used by `dashboard.js`'s last-published note

### dashboard.js
- `currentYear`, `currentMonth` — module-level state for month navigation (unrestricted — admin can browse any past/future month)
- `scheduleMap` — `{ 'YYYY-MM-DD': { subuh, maghrib, cuti_umum } }` built from Supabase fetch
- `renderCalendar()` — builds `#calendar-table` grid + calls `renderMobileDayList()`
- `renderMobileDayList()` — builds `#mobile-day-list` vertical day cards (≤640px view)
- `openModal(dateStr)` — populates editor modal from `scheduleMap`; Subuh/Maghrib `<select>` options are `ustazList` sorted client-side by `short_name` (`localeCompare({numeric:true})`, same as `ustaz.js`) and rendered as `"{short_name} (N)"` — 0-indexed suffix, not prefix, so native type-to-jump-by-letter still works — with `"— Tiada Kuliah —"` pinned first and unnumbered
- `saveDay()` — upserts to `schedule` table with `onConflict: 'date'`
- `publishMonth()` — POSTs to `/api/publish?month=YYYY-MM` with Bearer token. **Only works where a Vercel serverless runtime is available** — 404s under plain `python -m http.server`
- `updateScheduleActions()` — `async`. Computes `isRealCurrent`/`isRealNext` from an actual `new Date()` (never from `currentYear`/`currentMonth` alone, since those can be any month). Drives: the `#schedule-actions` dropdown visibility/hrefs, the `#month-tag` "Bulan Ini"/"Bulan Depan" badge, whether `#future-month-note` or the Terbitkan button + `#publish-hint` + `#last-published-note` show. Calls `loadLastPublishedNote(label)` at the end when visible. Called (awaited) from `loadMonth()` and again after a successful `publishMonth()`
- `loadLastPublishedNote(label)` — queries `activity_log` for the latest `action:'publish'` row matching `target_label === label` exactly; renders `"Terakhir diterbitkan pada ... oleh ..."` (falling back to a live `admins` name lookup via `.ilike()` if the row's `actor_name` is null) or `"Bulan ini belum pernah diterbitkan."` if no row exists
- `toggleMonthActionsMenu()` / `toggleScheduleActionsMenu()` — open/close the two dropdown menus (`.month-actions-menu` / `.month-actions-item` pattern, see CSS architecture below); one shared `document` click listener closes both on outside-click
- `openDuplicateModal()` / `confirmDuplicate()` — copies `subuh_ustaz_id`/`maghrib_ustaz_id` (never `cuti_umum`) from the month immediately before `currentMonth`, matched by day-of-month number, full overwrite after confirmation
- `openClearModal()` / `confirmClear()` — hard-deletes all `schedule` rows in the viewed month's date range, after confirmation

### ustaz.js
- `allUstaz` — sorted client-side with `localeCompare({ numeric: true })`; never use Supabase `.order()`
- `pendingRemovePoster` — boolean flag; if true, `saveUstaz()` sets `poster_url: null`
- `removePoster()` — sets flag, hides current poster block, clears inputs
- Poster save priority: remove flag > file upload > URL input > no change

### users.js
- Only accessible if `currentAdmin.role === 'super_admin'` — redirects otherwise
- `saveUser()` — insert or update in `admins` table; email is the conflict key for edits

### userlog.js
- Only accessible if `currentAdmin.role === 'super_admin'` — redirects otherwise, same pattern as `users.js`
- `ACTION_LABELS` — maps each `activity_log.action` value to its Malay display label
- `loadLog()` — builds a Supabase query from the four filter state vars (`filterAdmin`/`filterAction`/`filterFrom`/`filterTo`), `order('created_at', {ascending:false}).limit(logLimit)`
- `populateFilterOptions()` — fills the Tindakan filter from `ACTION_LABELS`, and the Admin filter from a live `db.from('admins').select('email,name')` query (so it only lists admins that still exist — deleted admins' past log rows remain visible under "Semua Admin", just not individually filterable by name anymore)
- `applyFilters()` / `resetFilters()` — read the 4 filter controls into module state, reset `logLimit` to the page size, reload
- `loadMoreLog()` — increments `logLimit` and refetches (simple limit-refetch pagination, not offset/cursor-based — avoids edge cases if new rows arrive between clicks)

---

## Publish endpoint (`api/publish.js`)

Vercel serverless function. Requires:
- `Authorization: Bearer <supabase_session_token>` — validated server-side
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Vercel env vars
- `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` — Vercel env vars

Reads schedule + ustaz from Supabase using service role. Fetches the existing `jadual_lengkap_beta.json` (content + SHA in one GitHub Contents API call), merges just the requested month into a `months: { "YYYY-MM": { infoJadual, senaraiHari } }` map, prunes any key that isn't the real-current/real-next month (computed server-side in Malaysia time, UTC+8), then pushes the merged file back to GitHub. Returns `{ published: { rows }, commitUrl, months }`.

Note: `commitUrl` is returned but **not shown to the user** (removed from dashboard.js — non-tech users don't need it).

**Merges by absolute month key, not an overwrite:** publishing Ogos no longer wipes out Julai — each key in `months` is independent, and the endpoint rejects any `month` param that isn't the real-current/real-next `YYYY-MM`. `kuliah/jadual/script.js` looks up `jsonData.months[monthKey]` where `monthKey` comes from the URL (`baseDate`), never from the JSON content, so the title and the rendered data can no longer disagree with the URL. If a month key is entirely absent (never published yet), the public page shows an explicit "belum diterbitkan" message instead of rendering blank. The migration path for the old flat single-month schema, and the merge/prune logic itself, are exposed as pure functions on `module.exports` (`computeRealMonthKeys`, `inferMonthKeyFromTajuk`, `buildMonthsStoreFromExisting`, `mergeAndPruneMonthsStore`) specifically so they can be unit-tested with a plain Node script without needing a live Vercel deploy.

**Local testing:** this endpoint only exists where a Vercel serverless runtime runs it — plain `python -m http.server` (this repo's documented local-dev method) has no `/api` route at all, so `Terbitkan` will fail locally with a connection-error toast. Everything else in `dashboard.js`/`ustaz.js`/`users.js` talks directly to Supabase and works identically local or deployed (same production project both ways).

**Also writes an `activity_log` row on success:** after the GitHub push succeeds, `publish.js` looks up the acting admin's `name` from the `admins` table (via the `actorEmail` already extracted from the `/auth/v1/user` check, matched with `email=ilike.` rather than `eq.` — see the email-casing note below) and POSTs an `activity_log` row directly via the Supabase REST API using the service-role key — a second, small Supabase round-trip, deliberately kept cheap since Terbitkan is a rare action. Wrapped in try/catch so a logging failure can never turn a successful publish into an error response to the admin.

**Email matching uses `ilike`, not `eq`:** `admins.email` may not casing-match exactly what Google OAuth/Supabase Auth returns (e.g. if it was typed by hand into `setup.sql`'s bootstrap insert), and Postgres `text` equality is case-sensitive by default — an `eq` mismatch fails silently (zero rows, no error) rather than erroring. Both this lookup and `dashboard.js`'s last-published-note fallback use case-insensitive matching for this reason.

---

## Activity log (`activity_log` table, `userlog.html`, super_admin only)

See [`database.md`](database.md) for the full schema reference, RLS/GRANT model, and troubleshooting table — this section covers the app-level design only.

Records who changed what: schedule day edits, bulk duplicate/clear (one summary row each, not per-date), ustaz create/update/delete, admin-account create/update/delete, and Terbitkan/publish. Written by `logActivity()` in `app.js` (browser writes) and separately by `api/publish.js` (server-side, for publish).

**Design rule — snapshot, never a live FK:** `target_label`/`detail` always store plain text (an ustaz's `short_name`, an admin's email, a month label) captured at the moment of the action, never a foreign key to `ustaz`/`admins`/`schedule`. This is deliberate — those rows can be renamed or hard-deleted later, and the log must stay readable regardless. Each call-site captures its "before" value from an already-loaded in-memory cache (`scheduleMap`, `allUstaz`, `allUsers`) rather than an extra query, and skips the insert entirely if a save didn't actually change anything (no no-op rows).

**Supabase table-level GRANTs are required in addition to the RLS policy — learned the hard way live in this repo:** `CREATE POLICY ... TO authenticated` alone was not enough; the browser got `permission denied for table activity_log` until `GRANT SELECT, INSERT, UPDATE, DELETE ON activity_log TO authenticated` was run separately. `ustaz`/`schedule` happened to inherit grants from this project's default privileges when they were created; `activity_log` didn't. Then the *same* class of error hit again for `api/publish.js`'s server-side insert — a **different** Postgres role (`service_role`), needing its **own** separate `GRANT ... TO service_role`. Both grants are now in `setup.sql`'s activity_log section. **Takeaway for any future new table:** RLS policies control row access but assume the role already has base table privileges — always add explicit `GRANT`s for every role that will touch the table (`authenticated` for browser writes, `service_role` for anything server-side), don't assume they're inherited.

`userlog.js`'s filter bar (Admin / Tindakan / Dari / Hingga) applies as Supabase query conditions (`eq`/`gte`/`lte`), not client-side filtering — so it scales with the table rather than fetching everything and filtering in the browser.

---

## Supabase Storage

Bucket: `kuliah-assets` (public)

Poster upload path: `posters/{safe-short-name}-{timestamp}.{ext}`

`upsert: true` is used so re-uploads don't fail on duplicate paths. Public URL retrieved with `getPublicUrl()`.

---

## Vercel config (`vercel.json`)

```json
{
  "headers": [
    {
      "source": "/kuliah/admin/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    }
  ]
}
```

`no-store` (not `max-age=0, must-revalidate`) is required here — `must-revalidate` still lets mobile Chrome serve the page from back-forward cache (bfcache) with no network request at all, so a stale copy with old JS can resurface after backgrounding the app or navigating back. `no-store` disables bfcache for these routes and forces a full re-fetch every visit.
