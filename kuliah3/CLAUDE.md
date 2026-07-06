# CLAUDE.md — kuliah3/admin

Architecture reference for Claude Code when working in `kuliah3/`.

## What this is

`kuliah3/admin/` is a full CMS admin dashboard for MAMTJ6 mosque lecture schedule management. Committee members log in with Google OAuth and manage:
- Monthly lecture schedules (subuh + maghrib sessions per day)
- Ustaz (penceramah) list with poster images
- Admin user accounts (super_admin only)

`kuliah3/jadual/` is the public-facing read-only schedule view that reads from the same published JSON.

## Tech Stack

- Pure HTML5, CSS3, Vanilla JS (ES6+) — no npm, no build tools
- Supabase — PostgreSQL, Auth (Google OAuth), Storage (kuliah-assets bucket)
- Vercel — static hosting + `api/publish.js` serverless function
- GitHub — published data store (JSON pushed via API from publish endpoint)

## File Structure

```
kuliah3/
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
    setup.sql        ← Supabase schema reference (do not run blindly)
  jadual/
    jadual.html      ← Public schedule view
    script.js        ← Schedule rendering
    style.css        ← Public view styles
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
cuti_umum text, updated_at timestamptz
```

RLS is ON on all tables. Anon key used in browser (read/write with RLS). Service role key server-side only (Vercel env var).

## Data Flow

```
Admin edits day in dashboard.html
  → upsert to Supabase `schedule` (date is the conflict key)
  → click Terbitkan (publish)
  → POST /api/publish?month=YYYY-MM  (Bearer: session token)
  → api/publish.js validates token, reads schedule+ustaz from Supabase (service role)
  → builds jadual_lengkap_beta.json
  → pushes to GitHub via API (GITHUB_TOKEN env var)
  → GitHub Pages / Vercel serves updated JSON
```

## Key Patterns

**Nav HTML — always use this structure on all 3 pages:**
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
`_injectSuperAdminNav()` in app.js inserts Pengguna link before `.spacer` inside `.nav-links`. If you restructure nav, update that function.

**Mobile breakpoints:**
- `≤768px` — tablet compact
- `≤640px` — phone: hamburger nav, card-per-row tables, day list calendar

**Data table mobile pattern:** Every JS-rendered `<td>` needs `data-label="..."` for the card-per-row mobile layout. CSS reads `content: attr(data-label)` via `::before`.

**Ustaz sort:** Always client-side with `localeCompare({ numeric: true })`. Never `.order('short_name')` on Supabase — it sorts lexicographically.

**Poster save (3-way logic in saveUstaz):**
- `pendingRemovePoster` → `poster_url: null`
- New file or URL entered → `poster_url: newValue`
- Neither → omit `poster_url` from payload (preserves existing)

**Cache-busting:** `vercel.json` serves `Cache-Control: public, max-age=0, must-revalidate` for all `/kuliah3/admin/(.*)` — browsers always revalidate after deploy.

## Print/PDF Export (kuliah3/jadual/)

`kuliah3/jadual/jadual.html` supports the same `?file=pdf` auto-print export as `kuliah/jadual/` (see `kuliah/jadual/CLAUDE.md` for the full write-up and the annotated `@media print` block — read it before touching `kuliah3/jadual/style.css`'s print rules).

**Bug fixed 2026-07-06:** exporting PDF from a narrow/mobile-width browser broke the layout (stacked header, missing footer legend) because `kuliah3/jadual/style.css`'s `@media (max-width: 768px)` block (line ~459) wasn't scoped to `screen` — the mobile column layout stayed active during printing since `max-width` still matched the exporting device's width, and `@media print` never reset it. **Fixed by changing it to `@media screen and (max-width: 768px)`.** Any new mobile breakpoint block added to this file must use the same `screen`-scoped form, or print output can silently break again.

## Sensitive Files

- `kuliah3/admin/` has no config files with secrets — credentials are Vercel env vars
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only, never in browser code
- `GITHUB_TOKEN` — Vercel env var only, used in `api/publish.js`
- Supabase anon key in `app.js` is public (safe — RLS enforces access control)
