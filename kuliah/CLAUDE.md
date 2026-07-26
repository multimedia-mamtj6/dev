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
  DEV_NOTES.MD       ← Session memo for kuliah/jadual/ and kuliah/paparan/ specifically (added 2026-07-26;
                        admin/DEV_NOTES.MD remains the memo for the admin CMS side, sessions 8-10 there
                        also touched this folder before this file existed — see this file's own notes for the pointer)
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

**Poster tap-to-enlarge lightbox (added 2026-07-26, extended same day to desktop):** tapping any `.poster-img` in the mobile today-card, or any `.lecture-block` desktop calendar cell that has a poster, opens a full-screen dark-backdrop lightbox (`#poster-lightbox`, static hidden markup in `index.html`, same `[hidden]`-toggled convention as `#khas-legend`). `initPosterLightbox()` (`script.js`) wires this with a single **delegated** `click` listener on `document` — attached once at boot, not per-element — specifically because both `renderTodayCard()` and `renderCalendarDesktop()` replace their container's inner HTML on every day-select/month change; a per-element listener would need re-attaching on every render (same reasoning as the Hijri writer's re-query pattern above). The desktop side has no `<img>` at all — `createLectureBlock()` puts the poster URL on a `data-poster-url` attribute + `has-poster` class on the `.lecture-block` div itself (all 3 render branches: plain, Yasin, pending), and the delegated listener checks `.poster-img` first, then falls back to `.lecture-block[data-poster-url]`. Desktop cells with a poster also get a subtle `:hover` background tint + 1px outline ring (`.lecture-block.has-poster:hover`, `box-shadow` not `border` so it doesn't shift layout) as a hover affordance, on top of `cursor: pointer` — mobile has no hover equivalent since there's no mouse to hover with. Tapping the backdrop or the enlarged image itself closes it (both are clicks inside `#poster-lightbox`), plus a visible × button; `body.no-scroll` locks background scroll while open. **Two things to know if you touch this again:** (1) `.poster-lightbox[hidden] { display: none; }` is a real, non-obvious required rule — without it, the author-stylesheet `display: flex` on `.poster-lightbox` beats the browser's own `[hidden]` UA rule even though they're equal specificity (author origin always wins ties over user-agent origin), so the overlay would render open-by-default. (2) Not implemented for `kuliah/paparan/` (kiosk display, no mouse/touch interaction) or the mobile monthly card list (no poster renders there at all, only the today-card does).

**Subuh/Maghrib order-swap toggle (`.swap-session-toggle`, added 2026-07-20):** on a day with *both* sessions, `renderTodayCard()` shows a small green-dashed "⇅ Tukar Susunan Subuh/Maghrib" button below the poster content that flips which session renders first. State is a plain module-level `let swapSessionOrder` (script.js, next to `cachedSenaraiHari`) — never persisted to storage, so it always resets to Subuh-first on a hard reload, but it stays sticky across day-select changes within the same page load since `renderTodayCard()` reads it on every call, including ones triggered by the dropdown. The button is only emitted into the HTML at all (not just visually hidden) when the selected day has both `targetData.subuh` and `targetData.maghrib` — single-session and empty/pending days never show it. No wrapper div groups a session's info-block + poster into a single movable unit; the swap is done by building `subuhHtml`/`maghribHtml` as separate strings and choosing concatenation order, keeping the existing flat sibling-div structure intact.

## "Kuliah Khas" special-lecture labeling (added 2026-07-25)

A session can be flagged `subuh_khas`/`maghrib_khas` (`schedule` table, set via a checkbox in `admin/kuliah/jadual.js`'s day-editor, **independent of** — not mutually exclusive with — the `*_pending` flag: a Khas day can have a confirmed ustaz assigned, or be pending with no speaker decided yet). `api/publish.js` merges `khas: true` onto whichever of the 3 existing session shapes already applies (`{pending:true}`, an ustaz object, or `null`), so `sessionData.khas` is a simple truthy check on the public page regardless of assignment state.

`createLectureBlock()`/`createMobileLectureBlock()` (`kuliah/jadual/script.js`) relabel the session from `Subuh`/`Maghrib` to `Kuliah Subuh Khas`/`Kuliah Maghrib Khas` whenever `khas` is true, add an `is-khas` class (desktop: on `.lecture-block`, colors the whole day cell purple via `.lecture-content:has(.lecture-block.is-khas)`; mobile: on `.lecture-block-v2` directly, since there's no shared cell wrapper there), and — for a Khas day that's also pending — simplify the sub-label to just "Akan Diumumkan" (the "Khas" meaning now lives in the main label). **This also fixed a pre-existing mislabeling:** the pending sub-label used to unconditionally say "Ceramah Khas — Akan Diumumkan" for *any* pending session regardless of whether it was actually a Khas one — now a plain (non-Khas) pending session just shows generic "Akan Diumumkan." (`kuliah/paparan/`'s own separate pending message was deliberately left untouched — see below, out of scope.)

The bottom legend (`index.html`'s static `.legend` block) gained a 4th box, `#khas-legend`, hidden by default and toggled visible in `script.js`'s boot sequence via `senaraiHari.some(d => d.subuh?.khas || d.maghrib?.khas)` — the first conditional legend item on this page; the other 3 are always rendered unconditionally.

**Mobile badge relabeling — fixed 2026-07-26, a day after the initial ship:** the original build (see plan history) deliberately kept the mobile `.session-badge` text as the short `SUBUH`/`MAGHRIB` even on a Khas day, reasoning the pill was too space-constrained for a longer label. Real device testing showed this read as incomplete/wrong — the user expected the same `Kuliah Subuh Khas`/`Kuliah Maghrib Khas` relabeling mobile already got everywhere else. Fixed in `createMobileLectureBlock()`: the badge text itself now swaps to the full Khas label, same as desktop's `.lecture-time`. **This shipped with a real bug the first time**, caught immediately from a screenshot: the new `.session-badge.is-khas` background color was set to the *exact same* `#f3e8ff` as the surrounding `.lecture-block-v2.is-khas` box background — a pill with zero contrast against its own container is invisible, so the badge silently lost its "pill" shape entirely even though the CSS was technically correct and applied. Fixed by making the badge a solid `#9333ea` background with white text instead of a light tint. **General lesson: a badge/pill's background must be checked against whatever it's sitting on, not just picked to match the feature's color family** — reusing the same light tint for both an outer container and an inner badge is an easy way to make the inner element disappear.

**Deliberately out of scope:** the admin's own calendar (`admin/kuliah/jadual.js`'s `renderCalendar()`/`renderMobileDayList()`) does not color-code Khas days — it keeps its existing pending>yasin>plain>empty session-tag coloring, unchanged. `kuliah/paparan/` (digital signage) also doesn't read the `khas` flag at all yet — its pending message is still the original "Ceramah Khas — Akan Diumumkan" wording, untouched.

## Sensitive Files

No secrets live under `kuliah/jadual/` or `kuliah/paparan/` — see `admin/CLAUDE.md`'s Sensitive Files section for the admin/API credentials model.
