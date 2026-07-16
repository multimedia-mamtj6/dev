# Plan — Move admin dashboard from kuliah/admin/ to root admin/

_Status: PLANNED, not yet executed. Written 2026-07-16._

## Context

The admin dashboard is becoming a multi-module hub (kuliah now, infaq module planned next — see the one-stop-center discussion). Keeping it at `kuliah/admin/` becomes misleading once it hosts non-kuliah modules, so it moves to root `admin/` **before** the infaq module is built, while the folder is smallest. New canonical URL: `dev.mamtj6.com/admin/...`.

**No data is affected** — Supabase, `api/publish.js`, `kuliah/data/*.json`, `kuliah/jadual/`, `kuliah/paparan/`, and the physical signage are all outside this move. The risk surface is entirely login/config: OAuth redirect allowlist, absolute paths, and the `vercel.json` cache header.

**User decisions locked in (don't re-litigate):**
1. All 5 old page URLs keep working via zero-JS meta-refresh redirect stubs (the `kuliah/paparan/` pattern).
2. Admin docs move to `admin/` now: `DEV_NOTES.MD` and `developer.md` relocate; `kuliah/CLAUDE.md` splits (admin content → new `admin/CLAUDE.md`; jadual/paparan content stays).

**Exploration findings (already verified, exhaustive):** functional references are only (a) `vercel.json:6` header source, and (b) absolute `/kuliah/admin/...` asset includes + JS navigation inside the 8 admin code files. Inter-page nav links (`href="dashboard.html"`) are bare-relative and survive the move unchanged. `api/publish.js`, root `index.html`, `kuliah/jadual/`, `kuliah/paparan/`, `kuliah3/` contain **zero** functional references to the admin folder. `dashboard.js` has no self-references — only `/kuliah/jadual/...` and `/api/publish` cross-references, which must NOT be changed.

## Step 0 — MANUAL, USER, BEFORE MERGE (Supabase dashboard)

Add to Supabase → Authentication → URL Configuration → Redirect URLs (keep existing entries for now — the allowlist holds old + new simultaneously, so there's no login-outage window):
- `https://dev.mamtj6.com/admin/dashboard.html`
- `http://localhost:8000/admin/dashboard.html`

## Step 1 — Commit A: pure rename (history-preserving)

```
git mv kuliah/admin admin
git mv kuliah/DEV_NOTES.MD admin/DEV_NOTES.MD
git mv kuliah/developer.md admin/developer.md
```
One commit, no content edits — 100% similarity detection keeps `git log --follow`/`blame` intact (the kuliah3↔kuliah swap playbook).

## Step 2 — Commit B: functional path sweep

**The 8 moved code files** — replace every absolute `/kuliah/admin/` → `/admin/`:
- `admin/index.html` — stylesheet + app.js includes, and the inline `window.location.replace('/kuliah/admin/dashboard.html')`
- `admin/app.js` — `requireAuth()`'s two redirects, `signOut()`'s redirect, and **`redirectTo` (line ~69, the OAuth return URL — the one that bricks login if Step 0 wasn't done)**
- `admin/dashboard.html`, `admin/ustaz.html`, `admin/users.html`, `admin/userlog.html` — 3 asset includes each
- `admin/users.js`, `admin/userlog.js` — one role-gate redirect each
- **Leave untouched:** all bare-relative nav links (`href="dashboard.html"` etc., including `_injectSuperAdminNav()`'s injected links), `dashboard.js`'s `/kuliah/jadual/...` view/PDF hrefs and `/api/publish` fetch, `/media/...` logo path in index.html.

**`vercel.json`** — header source `/kuliah/admin/(.*)` → `/admin/(.*)` (keeps `no-store`/bfcache protection on the new path; the `/kuliah/jadual/(.*)` rule stays).

**5 new redirect stubs** at `kuliah/admin/{index,dashboard,ustaz,users,userlog}.html`:
```html
<!DOCTYPE html>
<html lang="ms">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=/admin/dashboard.html">
<title>Admin Kuliah</title>
</head>
<body></body>
</html>
```
**Redirect URLs must be ABSOLUTE** (`/admin/...`), unlike the paparan stubs' relative ones — `kuliah/admin/index.html` is served by cleanUrls at slash-less `/kuliah/admin`, where a relative `url=` would resolve one directory too high (the exact session-7/8 bug class). Each stub keeps a sensible `<title>` per page.

**Pointer file** at `kuliah/DEV_NOTES.MD` (new, replaces the moved memo): a 3-line note — "Moved to `admin/DEV_NOTES.MD` — update THAT file, do not recreate this one." This guards against the recurring end-of-session boilerplate prompt (which says "create if not available yet" and names the old path) silently forking a fresh memo at the old location.

## Step 3 — Commit C: docs

- **Split `kuliah/CLAUDE.md`:** new `admin/CLAUDE.md` takes the admin-hub content (What this is, Tech Stack, admin file structure, Supabase Schema, Data Flow, all admin Key Patterns incl. publish-merge + ilike + cleanUrls landmine, Sensitive Files). `kuliah/CLAUDE.md` keeps the public-surface content (jadual print/PDF, mobile today-card, paparan Digital Signage section, jadual-side notes) plus a pointer to `admin/CLAUDE.md`.
- **`admin/DEV_NOTES.MD`:** update forward-looking sections only (WHAT THIS PROJECT IS, CURRENT STATE, CRITICAL PATTERNS, WHAT MIGHT COME NEXT) to `/admin/` paths + note the move; **SESSION HISTORY narrative stays as-written** (standing convention, the FOLDER SWAP NOTICE precedent — add one line to that notice explaining the admin→root move date).
- **`admin/developer.md`:** update paths (`localhost:8000/admin/index.html`, the vercel.json rule quote).
- **`kuliah/README.md`** (stays in kuliah/): admin URLs → `/admin/...`.
- **Root `CLAUDE.md`:** architecture tree gains root `admin/` entry, kuliah/ subtree loses admin, Sensitive Files path updated.
- **`admin/setup.sql` §5 comments + `admin/database.md`:** redirect-URL instructions → `/admin/dashboard.html` forms; database.md's doc links/paths.

## Step 4 — Verification

1. `grep -r "kuliah/admin"` → remaining hits must ONLY be: the 5 stubs' own paths, the pointer file, DEV_NOTES session-history narrative, and root CLAUDE.md/README history notes. Zero hits in any `.js`, functional `.html`, or `vercel.json`.
2. `node --check` on all 6 moved JS files (string-only edits, but cheap insurance).
3. Post-deploy (user): log in at `dev.mamtj6.com/admin/` — full round-trip: login → dashboard → ustaz page → users/userlog (super_admin gate) → Lihat Terbitan links open `/kuliah/jadual/` correctly → log out.
4. Post-deploy: open one old URL (`/kuliah/admin/dashboard.html`) → confirm it lands on `/admin/dashboard`.
5. `curl -I https://dev.mamtj6.com/admin/dashboard.html` → confirm `Cache-Control: no-store` header still present.
6. After confirmed working: user MAY clean the Supabase allowlist — remove old `/kuliah/admin/` entries and the stale `kuliah3/admin` entries flagged since session 7 (optional, no rush).

## Explicitly out of scope

- No infaq module work (separate future plan).
- No changes to `api/publish.js`, `kuliah/jadual/`, `kuliah/paparan/`, `kuliah3/`, `kuliah/data/`.
- No Supabase schema/data changes of any kind.
