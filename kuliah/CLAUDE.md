# CLAUDE.md — kuliah

Architecture reference for Claude Code when working in `kuliah/`.

**The admin CMS moved to root `admin/` on 2026-07-19** (see `admin/CLAUDE.md` and
`admin/plan.md`) — this file now covers only the public-facing surface:
`kuliah/jadual/` (schedule view) and `kuliah/paparan/` (digital signage).

## What this is

`kuliah/jadual/` is the public-facing read-only schedule view, and
`kuliah/paparan/` is the digital-signage display driving a physical screen at
the mosque — both read `kuliah/data/jadual_lengkap_v2.json`, published by the
`admin/` dashboard (see `admin/CLAUDE.md`'s Data Flow section for how that
file gets written).

## File Structure

```
kuliah/
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
  admin/             ← 5 zero-JS meta-refresh redirect stubs → /admin/... (old URLs, see admin/CLAUDE.md)
  data/jadual_lengkap_v2.json ← Published schedule data (read-only from here — see admin/CLAUDE.md's Data Flow)
  DEV_NOTES.MD       ← Pointer stub → admin/DEV_NOTES.MD (the admin memo moved with the folder)
  README.md          ← Project overview
```

## Key Patterns

**Any HTML `href`/`src`, and any JS-driven navigation, under `kuliah/` must use absolute root-relative paths (`/kuliah/paparan/...`), never a bare/relative filename — hit twice now, in two different subfolders (see `admin/CLAUDE.md` for the `kuliah/admin/`-era recurrence, back when admin lived under `kuliah/`):** Vercel's `cleanUrls: true` serves a directory's `index.html` at the bare directory path with **no trailing slash** (`/kuliah/paparan`, not `/kuliah/paparan/`). Per standard URL relative-resolution rules, any relative reference from a slash-less path treats the last path segment (`paparan`) as a filename to be *replaced*, not a directory to append to. Session 8: `kuliah/paparan/index.html`'s relative `<link href="style.css">`/`<script src="script.js">` silently failed to load at `https://dev.mamtj6.com/kuliah/paparan` (both resolved against `/kuliah/`, 404ing) — page rendered fully blank since `bootstrapPaparan()` never ran to flip either the display or the landing menu visible. Fixed by switching to absolute paths: `/kuliah/paparan/style.css` / `/kuliah/paparan/script.js`. **Treat this as a mandatory check for any brand-new HTML entry point added under `kuliah/` — a relative asset path will work perfectly under local `python -m http.server` and under Live Server, and only break once deployed to Vercel, so local testing alone will not catch it.**

**Mobile breakpoints:**
- `≤768px` — tablet compact
- `≤640px` — phone: hamburger nav, card-per-row tables, day list calendar

**Cache-busting:** `vercel.json` serves `Cache-Control: no-store` for `/kuliah/jadual/(.*)` (and `/admin/(.*)`, see `admin/CLAUDE.md`). `no-store` (not `max-age=0, must-revalidate`) is required — `must-revalidate` still lets mobile Chrome serve the page from bfcache with zero network request, so a stale copy with old JS can resurface after backgrounding the app. `no-store` disables bfcache for these routes.

## Print/PDF Export (kuliah/jadual/)

`kuliah/jadual/index.html` supports the same `?file=pdf` auto-print export as `kuliah3/jadual/` (see `kuliah3/jadual/CLAUDE.md` for the full write-up and the annotated `@media print` block — read it before touching `kuliah/jadual/style.css`'s print rules).

**Bug fixed 2026-07-06:** exporting PDF from a narrow/mobile-width browser broke the layout (stacked header, missing footer legend) because `kuliah/jadual/style.css`'s `@media (max-width: 768px)` block (line ~459) wasn't scoped to `screen` — the mobile column layout stayed active during printing since `max-width` still matched the exporting device's width, and `@media print` never reset it. **Fixed by changing it to `@media screen and (max-width: 768px)`.** Any new mobile breakpoint block added to this file must use the same `screen`-scoped form, or print output can silently break again.

## Digital Signage (kuliah/paparan/)

Drives a physical screen at the mosque. As of session 8, a single `index.html` reads `?subuh`/`?maghrib`/`?subuh-esok`/`?maghrib-esok` from the URL (`bootstrapPaparan()` in `script.js`) and shows the matching poster/message; no query (or an unrecognized one) falls back to a 4-button landing menu instead of a blank/error page. The old 4 separate files (`today_subuh.html` etc.) are now zero-JS `<meta http-equiv="refresh" content="0; url=index.html?...">` redirect stubs, kept in place specifically because the old URLs are almost certainly hardcoded into the physical screen's kiosk browser or signage-player config — deleting them outright would require someone to walk over and manually reconfigure hardware. `index.html` keeps the `<meta http-equiv="refresh" content="600">` (10-minute) auto-reload unconditionally, same as the old files.

Reads `kuliah/data/jadual_lengkap_v2.json` (Pipeline 2 — migrated in session 8 from the old Sheets-backed `jadual_lengkap.json`/Pipeline 1). `getTargetDate()` returns both a date string and a `monthKey` to look up `jsonData.months[monthKey].senaraiHari` (the nested schema — see `admin/CLAUDE.md`'s "Publish merges by absolute month key" Key Pattern); a session with `{ pending: true }` renders the same "Ceramah Khas — Akan Diumumkan" message as the public `jadual/` view.

**See the cleanUrls absolute-path Key Pattern above** — `index.html`'s `style.css`/`script.js` references must stay absolute (`/kuliah/paparan/...`), this exact folder is where that bug most recently bit.

## Mobile "today card" — any day in the month, not just today/tomorrow (kuliah/jadual/)

The mobile view's day-select dropdown (`script.js`'s `renderTodayCard()`) lets the visitor pick any day within the currently-viewed month, not just today/tomorrow. `buildDaySelectOptions()` lists every day of the month with "Hari Ini"/"Hari Esok" always pinned first using their *real* dates (handles today being the last day of the month, where "tomorrow" spills into next month).

**Poster rendering is uniform across all days:** `buildPosterHtml()` always renders `<img src="{session.poster_url}">` directly from `kuliah`'s own `senaraiHari` data, for today/tomorrow and every other day alike. (Earlier this embedded a digital-signage `<iframe>` for today/tomorrow only — `kuliah/paparan/{today|tomorrow}_{subuh|maghrib}.html`, a separate subsystem on the old non-beta Google-Sheets pipeline — but that was standardized away in favor of the same direct-image approach used for every other day. `.poster-iframe` CSS was removed as dead code along with it.)

**Hijri date (`loadHijriDate()`) is cosmetic and must NEVER block rendering:** it's fired **without await** from `renderTodayCard()` — a hung upstream API once serialized the entire month card list behind it (the await chain `initializeMobileView → renderTodayCard → loadHijriDate → fetch` with no timeout, against an API that hung 30+ seconds). Source is `api.waktusolat.app/v2/solat/WLY01?year=&month=` (community JAKIM mirror; the direct `www.e-solat.gov.my` endpoint is hang-prone and was removed from this file) — the monthly response bundles a `hijri` field per day, cached per month in `hijriMonthCache` so dropdown day-changes cost zero network calls. Failure ladder: 5s `fetchWithTimeout()` (AbortController) → `gregorianToHijri()` JS calculator (approximate — can be ±1 day vs JAKIM's official rukyah date, which is why the API is primary). `hijriRequestId` guards against a slow stale response overwriting a newer dropdown selection, and the writer re-queries `#today-date-hijri` at write time because the dropdown re-render replaces the card's DOM. The `.hijri-loading` skeleton + `min-height` on `#today-date-hijri` (style.css) reserve the line's space so the header never shifts — keep both if touching this area.

**Subuh/Maghrib order-swap toggle (`.swap-session-toggle`, added 2026-07-20):** on a day with *both* sessions, `renderTodayCard()` shows a small green-dashed "⇅ Tukar Susunan Subuh/Maghrib" button below the poster content that flips which session renders first. State is a plain module-level `let swapSessionOrder` (script.js, next to `cachedSenaraiHari`) — never persisted to storage, so it always resets to Subuh-first on a hard reload, but it stays sticky across day-select changes within the same page load since `renderTodayCard()` reads it on every call, including ones triggered by the dropdown. The button is only emitted into the HTML at all (not just visually hidden) when the selected day has both `targetData.subuh` and `targetData.maghrib` — single-session and empty/pending days never show it. No wrapper div groups a session's info-block + poster into a single movable unit; the swap is done by building `subuhHtml`/`maghribHtml` as separate strings and choosing concatenation order, keeping the existing flat sibling-div structure intact.

## Sensitive Files

No secrets live under `kuliah/jadual/` or `kuliah/paparan/` — see `admin/CLAUDE.md`'s Sensitive Files section for the admin/API credentials model.
