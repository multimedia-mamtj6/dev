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
| `admin/dashboard.html` | Monthly calendar grid + day editor modal |
| `admin/dashboard.js` | `renderCalendar()`, `renderMobileDayList()`, `openModal()`, `saveDay()`, `publishSchedule()` |
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

### dashboard.js
- `currentYear`, `currentMonth` — module-level state for month navigation
- `scheduleMap` — `{ 'YYYY-MM-DD': { subuh, maghrib, cuti_umum } }` built from Supabase fetch
- `renderCalendar()` — builds `#calendar-table` grid + calls `renderMobileDayList()`
- `renderMobileDayList()` — builds `#mobile-day-list` vertical day cards (≤640px view)
- `openModal(dateStr)` — populates editor modal from `scheduleMap`
- `saveDay()` — upserts to `schedule` table with `onConflict: 'date'`
- `publishSchedule()` — POSTs to `/api/publish?month=YYYY-MM` with Bearer token

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

Reads schedule + ustaz from Supabase using service role. Builds `jadual_lengkap_beta.json` and pushes to GitHub via API. Returns `{ published: { rows }, commitUrl }`.

Note: `commitUrl` is returned but **not shown to the user** (removed from dashboard.js — non-tech users don't need it).

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
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }]
    }
  ]
}
```

Forces revalidation on every visit — mobile browsers won't serve stale CSS/JS after deploys.
