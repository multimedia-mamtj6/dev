# kuliah3/admin — Developer Guide

## Quick start

```bash
# From repo root
python -m http.server
# Open http://localhost:8000/kuliah3/admin/index.html
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
| `admin/setup.sql` | Supabase schema reference |
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
- `_injectSuperAdminNav()` — appends Pengguna link to `.nav-links` before `.spacer` if role is super_admin
- `isYasinEntry(ustaz)` — matches `/yasi+n/i` against `short_name + full_name` combined; detects the "Bacaan Yasiin & Tahlil" special ustaz entry regardless of spelling, used by `dashboard.js` to color its calendar pills green

### dashboard.js
- `currentYear`, `currentMonth` — module-level state for month navigation (unrestricted — admin can browse any past/future month)
- `scheduleMap` — `{ 'YYYY-MM-DD': { subuh, maghrib, cuti_umum } }` built from Supabase fetch
- `renderCalendar()` — builds `#calendar-table` grid + calls `renderMobileDayList()`
- `renderMobileDayList()` — builds `#mobile-day-list` vertical day cards (≤640px view)
- `openModal(dateStr)` — populates editor modal from `scheduleMap`; Subuh/Maghrib `<select>` options are `ustazList` sorted client-side by `short_name` (`localeCompare({numeric:true})`, same as `ustaz.js`) and rendered as `"{short_name} (N)"` — 0-indexed suffix, not prefix, so native type-to-jump-by-letter still works — with `"— Tiada Kuliah —"` pinned first and unnumbered
- `saveDay()` — upserts to `schedule` table with `onConflict: 'date'`
- `publishMonth()` — POSTs to `/api/publish?month=YYYY-MM` with Bearer token. **Only works where a Vercel serverless runtime is available** — 404s under plain `python -m http.server`
- `updateScheduleActions()` — computes `isRealCurrent`/`isRealNext` from an actual `new Date()` (never from `currentYear`/`currentMonth` alone, since those can be any month). Drives: the `#schedule-actions` dropdown visibility/hrefs, the `#month-tag` "Bulan Ini"/"Bulan Depan" badge, whether `#future-month-note` or the Terbitkan button + `#publish-hint` show. Called every `loadMonth()`
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

---

## Publish endpoint (`api/publish.js`)

Vercel serverless function. Requires:
- `Authorization: Bearer <supabase_session_token>` — validated server-side
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Vercel env vars
- `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` — Vercel env vars

Reads schedule + ustaz from Supabase using service role. Fetches the existing `jadual_lengkap_beta.json` (content + SHA in one GitHub Contents API call), merges just the requested month into a `months: { "YYYY-MM": { infoJadual, senaraiHari } }` map, prunes any key that isn't the real-current/real-next month (computed server-side in Malaysia time, UTC+8), then pushes the merged file back to GitHub. Returns `{ published: { rows }, commitUrl, months }`.

Note: `commitUrl` is returned but **not shown to the user** (removed from dashboard.js — non-tech users don't need it).

**Merges by absolute month key, not an overwrite:** publishing Ogos no longer wipes out Julai — each key in `months` is independent, and the endpoint rejects any `month` param that isn't the real-current/real-next `YYYY-MM`. `kuliah3/jadual/script.js` looks up `jsonData.months[monthKey]` where `monthKey` comes from the URL (`baseDate`), never from the JSON content, so the title and the rendered data can no longer disagree with the URL. If a month key is entirely absent (never published yet), the public page shows an explicit "belum diterbitkan" message instead of rendering blank. The migration path for the old flat single-month schema, and the merge/prune logic itself, are exposed as pure functions on `module.exports` (`computeRealMonthKeys`, `inferMonthKeyFromTajuk`, `buildMonthsStoreFromExisting`, `mergeAndPruneMonthsStore`) specifically so they can be unit-tested with a plain Node script without needing a live Vercel deploy.

**Local testing:** this endpoint only exists where a Vercel serverless runtime runs it — plain `python -m http.server` (this repo's documented local-dev method) has no `/api` route at all, so `Terbitkan` will fail locally with a connection-error toast. Everything else in `dashboard.js`/`ustaz.js`/`users.js` talks directly to Supabase and works identically local or deployed (same production project both ways).

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
      "source": "/kuliah3/admin/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    }
  ]
}
```

`no-store` (not `max-age=0, must-revalidate`) is required here — `must-revalidate` still lets mobile Chrome serve the page from back-forward cache (bfcache) with no network request at all, so a stale copy with old JS can resurface after backgrounding the app or navigating back. `no-store` disables bfcache for these routes and forces a full re-fetch every visit.
