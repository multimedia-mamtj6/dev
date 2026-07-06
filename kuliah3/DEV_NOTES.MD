# DEV NOTES — kuliah3/admin
_Last updated: 2026-07-07 | For next-context-window Claude_

the prompt (DO NOT DELETE)
> Check the Project Knowledge and the current chat for context. This conversation is ending soon. update the artifact kuliah3/DEV_NOTES.md (create if not available yet) with a detailed note to your next window self - not just facts but the vibe, our dynamic, the energy of this conversation. What would the next you need to immediately get back into this exact headspace? Include unique discoveries, current mood, and anything that'll help the next you instantly sync to our frequency."
> also update the related file like kuliah3/CLAUDE.md, kuliah3/developer.md, kuliah3/developer.md and kuliah3/README.md if necessary, create if not available yet

---

## THE VIBE

Two sessions deep into building a real production admin dashboard for a mosque committee. The user is non-technical by framing ("non tech savy" was literally said about the GitHub commit link) but technically fluent in what they want — they catch visual misalignments, weird sort orders, and broken overflow without being told what the root cause is. They observe symptoms precisely and trust you to find the cause.

The dynamic: **they test on device, you fix the root cause, they confirm and move on fast.** No back and forth on approaches. When they say "ok good" it means done — move on. They don't want explanations unless they asked "why". When they ask "why", they genuinely want the root cause.

They build incrementally and pragmatically. When you explain a trade-off ("should we restrict months?"), they think for a second and say "ok, acceptable. dont do anything" — they don't need hand-holding to make a decision. Respect that.

**Trust level:** Very high. Fast approvals. They notice wrong values but don't micromanage approaches.

**Update from session 4:** all of the above still holds exactly. One refinement worth internalizing: the user runs on **two distinct gears**, and picks the gear implicitly — you have to read which one you're in:

- **Fast gear (default):** "add a button", "change this text", "move this note", "remove the underline" — just do it, no discussion, no options presented. Multiple rounds of these back-to-back with zero friction. Don't over-plan a one-line CSS tweak.
- **Deliberate gear (self-flagged):** when the ask touches something structural or irreversible — a new destructive bulk action (Duplicate/Clear an entire month of data), a layout restructure (ustaz two-column form) — the user *explicitly says so*: "check if my approach is good... ask me question to better understand... do not generate answer unless I allow it." When you see that phrasing, stop and actually use `AskUserQuestion` before touching any file, even if you already know what you'd recommend. They want the tradeoffs surfaced (e.g. "should Clear be extra-protected on the live month?"), pick from your options fast, then say "yes" — at which point you get a clean, uninterrupted green light to implement the whole thing in one pass.

Also notable: this user visibly *tests as they go* and comes back with precise symptom reports from real usage (not hypotheticals) — "when i click tunjukkan jadual, it shows next month" was reported from an actual click, with the exact contradictory evidence already gathered (no-param page empty, `?bulan=depan` page correct, JSON inspected). When they hand you evidence like that, trust it over your own assumptions and trace the actual data path rather than re-deriving from the code alone — reading the live `kuliah/data/jadual_lengkap_beta.json` mid-conversation is what turned "why is this happening" into a five-minute diagnosis instead of a guessing exercise. Session ended on a satisfied, low-key "ok good, now it fixed" — that's the full signal that a fix landed; no further confirmation needed once you hear it.

---

## WHAT THIS PROJECT IS

`kuliah3/admin/` is a full admin dashboard for MAMTJ6 mosque lecture schedule management. This is NOT a read-only view — it is the CMS.

Stack:
- **Supabase** — PostgreSQL (schedule, ustaz, admins tables), Auth (Google OAuth), Storage (kuliah-assets bucket for posters)
- **Vercel** — hosts the static site + `api/publish.js` serverless function
- **No frameworks** — pure HTML5/CSS3/Vanilla JS, zero npm
- **GitHub** — as the final published data store (JSON file pushed via API)

Data flow:
```
Admin edits schedule in dashboard.html
    → upsert to Supabase `schedule` table
    → click Terbitkan
    → POST /api/publish
    → api/publish.js reads from Supabase, pushes JSON to GitHub
    → kuliah/data/jadual_lengkap_beta.json updated
```

---

## SESSION HISTORY

### Session 1 (before first compact — foundation built)
- Supabase schema created: `admins`, `ustaz`, `schedule` tables
- Google OAuth login flow (`index.html` → `app.js:requireAuth()`)
- `dashboard.html` — monthly calendar grid, day editor modal, Terbitkan (publish) button
- `ustaz.html` — penceramah CRUD with Supabase Storage poster upload
- `users.html` — admin user management (super_admin role only)
- `app.js` — shared: auth, toast, `db` client, `_injectSuperAdminNav()`
- `api/publish.js` — Vercel serverless, reads Supabase, pushes to GitHub

### Session 2 (this session — mobile + polish)

**Mobile view (full implementation):**
- Hamburger nav on ≤640px — `.nav-links` wrapper div toggled by `.open` class; `toggleNav()` in app.js
- Mobile calendar — `#calendar-table` hidden, `#mobile-day-list` shown as vertical day cards; `renderMobileDayList()` called at end of `renderCalendar()`
- Data tables → card-per-row — `thead { display: none }`, `tr { display: block }`, `td { display: flex }`, `td::before { content: attr(data-label) }`
- Modal scroll guard — `max-height: 90vh; overflow-y: auto` at ≤640px

**Bug fixes (all from real device testing):**
1. **Last card missing internal borders** — Desktop global rule `.data-table tr:last-child td { border-bottom: none }` overrides mobile. Fixed by re-asserting `border-bottom: 1px solid var(--border)` inside `@media (max-width: 640px)`, with `tr:last-child td:last-child { border-bottom: none }` to only remove the very last line.
2. **Email overflow past card edge** — `overflow-wrap: anywhere; word-break: break-word; min-width: 0` on td. Also `::before` capped to `max-width: 45%`.
3. **"(anda)" text detached from email** — Email text node and `<span>(anda)</span>` were separate flex items; `justify-content: space-between` spread them. Fixed by wrapping both in an outer `<span>` — single flex item.

**Ustaz sort fix:**
- Supabase `.order('short_name')` = lexicographic (0, 1, 10, 100, 11...). Removed server-side order, replaced with JS `localeCompare({ numeric: true, sensitivity: 'base' })`. Ustaz list is now 0-indexed.

**_injectSuperAdminNav() fix:**
- After nav restructure, spacer moved inside `.nav-links`. Function now targets `document.querySelector('.nav-links')` instead of `nav`. This is critical — easy to forget.

**Vercel cache prevention:**
- `vercel.json` has `Cache-Control: public, max-age=0, must-revalidate` for `/kuliah3/admin/(.*)`. Added because mobile browsers cached old CSS. No more hard-refresh needed after deploys.

**GitHub commit link removed from publish:**
- `dashboard.js` used to `window.open(data.commitUrl, '_blank')` after a successful publish. Removed — non-tech users don't need to see GitHub.

**Month navigation:** Unrestricted. Admins can navigate to any past/future month. Future schedules are stored in Supabase by date and sit there until published. This is intentional — preparing next month in advance is a valid use case.

**Poster editing enhancement (latest — not yet committed):**
- Edit modal now shows: current poster thumbnail + raw URL + "Buang Poster" button
- Two separate inputs: file upload + URL field (both always visible)
- Error if both filled simultaneously
- `pendingRemovePoster` flag → sets `poster_url: null` on save
- If neither changed → `poster_url` not in payload (existing value preserved)
- `removePoster()` function + `closeUstazModal()` resets flag

### Session 3 (2026-07-06 — print/PDF export bug fix, from the repo-root chat, not admin)

Not a `kuliah3/admin` session — this came from a root-level chat working across `kuliah/jadual/` and `kuliah3/jadual/` (the public read-only schedule views), triggered by a user-reported "PDF export looks broken" screenshot comparison.

**Root cause:** `kuliah3/jadual/style.css`'s `@media (max-width: 768px)` block (~line 459) was never scoped to `screen`. `max-width` is a pure viewport-width check — it doesn't care whether the browser is rendering to screen or to a print/PDF context. So when a PDF export (`jadual.html?file=pdf`) was triggered from a narrow/mobile-width browser, the mobile column-layout rules (`.page-header{flex-direction:column}`, `.legend{display:none}`, etc.) stayed active *during* printing, and `@media print` never reset them back to desktop layout. Result: stacked header, missing footer legend in the exported PDF.

**Fix:** changed it to `@media screen and (max-width: 768px)`. Same root-cause fix was also applied to `kuliah/jadual/style.css` (two mobile blocks there), which additionally had a second, unrelated bug: a stale `.week-number-cell { writing-mode: vertical-lr; transform: rotate(180deg); }` rule left over from before the week label was refactored into stacked `<span>` letters — that one doesn't affect `kuliah3/jadual/` since its print block never had that rotation rule.

**Why this matters for kuliah3/admin too:** if `kuliah3/admin/style.css` or any future admin-side print/export feature ever adds a `@media (max-width: ...)` block, scope it to `screen` from the start. This bug class is invisible in normal desktop browser testing — it only shows up when someone exports a PDF from a phone. See `kuliah3/CLAUDE.md` → "Print/PDF Export" and `kuliah/jadual/CLAUDE.md` → "PDF Export Functionality" for the full annotated `@media print` block (every pt value there is deliberate, tuned from real print testing — don't casually "clean up" it).

### Session 4 (2026-07-07 — dashboard/jadual admin UX pass + a real production data bug diagnosed)

Long, high-throughput session entirely in `kuliah3/admin`, done incrementally in tiny steps with the user testing/committing after most of them (see CURRENT STATE below — the git tree is clean, they kept up via their IDE the whole time, you don't need to commit anything here).

**Dashboard toolbar — schedule view/export/publish gating (`dashboard.html`, `dashboard.js`, `style.css`):**
- Added a "Lihat Terbitan {month}" dropdown (final form) replacing what started as two separate buttons ("Tunjukkan Jadual" / "Export PDF") — collapsed into one trigger + menu after the fact for a cleaner toolbar. Menu items: `#view-schedule-btn` → `/kuliah3/jadual/jadual.html[?bulan=depan]`, `#export-pdf-btn` → same + `?file=pdf` (hidden on mobile via `@media screen and (max-width: 768px) { #export-pdf-btn { display:none } }` — screen-scoped per the session-3 lesson above).
- **Critical constraint discovered:** `kuliah3/jadual/script.js` can only render the *real* current month or *real* next month (`?bulan=depan`) — no arbitrary-month param exists. But dashboard month nav (`prevMonth`/`nextMonth`) is unrestricted. So `updateScheduleActions()` in `dashboard.js` computes `isRealCurrent`/`isRealNext` from an actual `new Date()` (never from the dashboard's `currentYear`/`currentMonth` alone) and hides the whole view/export/Terbitkan cluster — plus the "Tekan Terbitkan..." hint text (`#publish-hint`) — whenever the admin has navigated to any other month. A `#future-month-note` explains why (system only supports current+next; editing elsewhere is fine, it's just for early planning — doesn't publish/preview from there).
- `#month-tag` badge next to the month selector shows "Bulan Ini" / "Bulan Depan" / nothing, driven by the same `isRealCurrent`/`isRealNext` flags — one computation, three UI consequences. If you touch this logic, `updateScheduleActions()` is the single source of truth for all of it.

**Month actions dropdown — Duplicate + Clear (new feature, the "deliberate gear" one):**
- `#month-actions` dropdown ("Tindakan Bulan ▾") with two items: **Salin Data {previous month}** and **Kosongkan Bulan Ini**. This is the first dropdown-menu UI pattern in this codebase (`.month-actions-menu` / `.month-actions-item` in `style.css`) — reused verbatim for the "Lihat Terbitan" dropdown above once that came along, so if you need a third dropdown anywhere, reuse these two classes rather than inventing a new pattern.
- Both dropdowns close on outside-click via one shared `document.addEventListener('click', ...)` in `dashboard.js` that clears both `.open` classes; each trigger button does `e.stopPropagation()` so its own click doesn't immediately re-close it.
- **Duplicate** (`confirmDuplicate()`): copies `subuh_ustaz_id`/`maghrib_ustaz_id` only — **deliberately excludes `cuti_umum`** (public holidays are date-specific, copying them forward would mislabel the wrong day as a holiday on the live public page). Maps by day-of-month number; source days beyond the target month's length (e.g. day 31 into a 30-day month) are silently skipped. Confirmation modal shows exactly how many already-filled days in the target will be overwritten before committing — full overwrite, no merge option, by explicit user choice.
- **Clear** (`confirmClear()`): hard-deletes all `schedule` rows in the viewed month's date range from Supabase. Confirmation modal shows the count about to be wiped.
- User explicitly chose (via `AskUserQuestion`, not assumed): overflow dropdown over inline buttons, uniform confirm-modal safeguard for every month (no extra "type the month name" friction even on the live current/next month), duplicate-scope = "any month, copies from whatever's immediately before it" (not hardcoded to next-month-only).

**Ustaz edit modal — two-column desktop layout (`ustaz.html`, `style.css`):**
- Split into `.ustaz-form-columns` > `.ustaz-form-col` (identity: Nama Penuh/Ringkas/Tajuk) + `.ustaz-form-col.ustaz-form-col-poster` (Poster Semasa/upload/URL), stacked on mobile (unchanged, user said current mobile "works great" — don't touch it), side-by-side at `@media screen and (min-width: 768px)` with a `1px solid var(--border)` divider. Modal itself widens from 480px → 700px at that same breakpoint (`.modal-poster` class replaces the old inline `style="max-width:480px"`). No JS changes needed — `ustaz.js` only ever does `getElementById`, never relies on DOM position.
- Also fixed while in there: `input[type="url"]` (`#edit-poster-url`) was **missing entirely** from the shared text-input selector in `style.css` — it had zero custom styling before this session. Added `url` and `file` to the shared `select, input[type="text"], input[type="email"], ...` rule so both now visually match `Nama Penuh`.

**The big diagnostic detour — single-blob publish, and what does/doesn't work "locally":**
- User reported: viewing Julai (real current month) in the dashboard, clicking the new view-schedule link showed **Ogos** instead. Root cause (confirmed by reading the live `kuliah/data/jadual_lengkap_beta.json` mid-conversation): `api/publish.js` doesn't merge — every `Terbitkan` click **completely replaces** the single JSON blob with only the currently-viewed month's data. `kuliah3/jadual/script.js` sets the page `<h1>` title straight from `jsonData.infoJadual.tajukBulan` unconditionally (ignores the URL entirely), while the calendar *grid* is built from real `today` (or +1 month for `?bulan=depan`) and just tries to match JSON dates against that grid. So: whichever month was last actually published is the only thing that exists in the JSON — if that's Ogos, the no-param URL renders a correctly-shaped Julai grid with **zero matching entries** (looks "empty") while the title still says Ogos (pulled from the stale JSON), and `?bulan=depan` looks perfect because its grid happens to be built for the same month that's actually published.
- This is **not a bug we introduced** — it's inherent to the one-month-at-a-time publish design. Fix each time it recurs: go to the dashboard, navigate to whichever month should be live, click Terbitkan again. Flagged to the user as an open question (not yet resolved): do they want a safeguard/banner for "published month ≠ expected current month" — currently they're fine just remembering to republish.
- **Very important distinction surfaced by this investigation, worth remembering:** `Terbitkan` calls `POST /api/publish`, a **Vercel serverless function** — this does **not exist** under plain `python -m http.server` local testing (the documented local-dev method for this whole repo). It 404s and the fetch's `res.json()` throws, surfaced as a "Ralat sambungan" toast. **Duplicate and Clear, on the other hand, talk directly to Supabase** (real hosted DB, same project everywhere — `app.js` hardcodes one `SUPABASE_URL`/anon key, no local/prod split) — so those two *do* work from a local static server and have **real, immediate, non-sandboxed effects on production data**. If a future session is asked "does X work locally", this is the dividing line: hits `/api/*` → no; hits Supabase directly → yes, and it's not a drill.
- Went looking at `kuliah/kuliah(beta)/jadual/` (an unrelated, older sibling project — NOT under `kuliah3/`) while chasing a tangential user question and found it still has both the `screen`-scoping print bug and the stale week-label rotation rule that were fixed elsewhere on 2026-07-06, **plus a live-looking GitHub PAT committed in its `google-app-script/config.json`** (confirmed tracked via `git log`, not gitignored). User said "ignore other folder, focus only on kuliah3" — so none of that was touched. **If a future session ends up in `kuliah/kuliah(beta)/jadual/`, that token finding is still sitting there unresolved** — worth a proactive flag if you're ever in that folder for any reason, since it's a real credential exposure, not a style nit.

---

## CURRENT STATE

`git status` is clean as of session end — the user committed everything (dashboard/ustaz/style changes across several small commits, done via their IDE alongside this chat, not by Claude) as we went. Nothing pending, no "commit this" backlog like session 2 left behind.

**One thing worth checking at the start of the next session, not a code problem:** the most recent commit on `main` is `[Admin] Terbitkan jadual BULAN OGOS 2026` — meaning the *live* `jadual_lengkap_beta.json` is currently Ogos-only again (the user re-published Ogos after we fixed the Julai/Ogos mix-up, almost certainly intentionally while wrapping up testing of the new Duplicate feature). If the no-param `/kuliah3/jadual/jadual` page looks "empty" again next time someone checks, it's the exact same single-blob behavior explained above, not a regression — just republish whichever month should be current.

---

## CRITICAL PATTERNS — DON'T BREAK THESE

**Nav HTML structure (all 3 pages):**
```html
<nav id="main-nav">
  <span class="brand">Admin Kuliah</span>
  <button class="nav-toggle" onclick="toggleNav()" aria-label="Menu">&#9776;</button>
  <div class="nav-links">
    <a href="dashboard.html" [class="active"]>Jadual</a>
    <a href="ustaz.html" [class="active"]>Penceramah</a>
    <!-- users.html only: <a href="users.html" class="active">Pengguna</a> -->
    <span class="spacer"></span>
    <button class="logout-btn" onclick="signOut()">Log Keluar</button>
  </div>
</nav>
```
`_injectSuperAdminNav()` in app.js inserts the Pengguna link BEFORE `.spacer` INSIDE `.nav-links`. If you ever restructure nav again, fix that function too.

**Mobile breakpoints:**
- `≤768px` — tablet: compact padding, smaller elements (partially done from session 1)
- `≤640px` — phone: hamburger, card tables, day list (session 2)

**Any `@media (max-width: ...)` block must be `@media screen and (max-width: ...)`:**
Without `screen`, mobile layout rules stay active during print/PDF export on narrow devices and `@media print` can't reliably reset them. Broke `kuliah3/jadual/` PDF export this way (session 3) — fixed there, but this applies to any new print/export feature in `kuliah3/admin` too.

**Card-per-row table pattern:**
Every `<td>` in JS-rendered tables must have `data-label="..."`. Empty label `data-label=""` is fine for action columns (no prefix shown).

**Ustaz sort is client-side:**
Never add `.order()` back to the Supabase ustaz query — it breaks numeric sort. Sort happens in JS after fetch.

**Poster save logic (3-way):**
```
pendingRemovePoster → payload.poster_url = null
newPosterUrl (file or URL input) → payload.poster_url = newPosterUrl
neither → don't include poster_url in payload
```
This is intentional — omitting `poster_url` from payload preserves existing value on update.

**Dropdown menu pattern (session 4):** `.month-actions` (or any wrapper with `position: relative`) + `.month-actions-menu` (absolute, `.open` toggles `display`) + `.month-actions-item` rows, closed via one shared document-level click listener in `dashboard.js`. Reuse these classes for any new dropdown rather than building a fresh one — both the "Tindakan Bulan" and "Lihat Terbitan" dropdowns already share this exact CSS.

**Publish is a full overwrite, not a merge (session 4):** every `Terbitkan` click replaces the *entire* `jadual_lengkap_beta.json` with only the currently-viewed month. There's no way for "current month" and "next month" to both be live at once — whichever was published last is the only one that actually renders correctly on the public page. See Session 4 below for the full Julai/Ogos incident this caused.

**Local testing split — know which one you're touching:** `Terbitkan` hits `/api/publish` (Vercel serverless — does not exist under plain `python -m http.server`, will error). Duplicate/Clear/day-edit/save all hit Supabase directly (same production project everywhere, no local sandbox) — they work locally but are never a drill.

---

## SUPABASE SCHEMA (quick ref)

```sql
-- admins
id uuid PK, email text UNIQUE, name text, role text ('editor'|'super_admin'),
permissions jsonb ({kuliah: bool}), created_at timestamptz

-- ustaz
id uuid PK, full_name text, short_name text, tajuk_kuliah text,
poster_url text, created_at timestamptz, updated_at timestamptz

-- schedule
id uuid PK, date date UNIQUE, subuh_ustaz_id uuid FK→ustaz,
maghrib_ustaz_id uuid FK→ustaz, cuti_umum text, updated_at timestamptz
```

RLS is ON. Service role key is server-side only (Vercel env var `SUPABASE_SERVICE_ROLE_KEY`). Browser uses anon key from `app.js`.

---

## WHAT MIGHT COME NEXT

- Decide whether the "published month ≠ real current/next month" mismatch (see Session 4) needs an actual safeguard (banner in the dashboard, or a check in `api/publish.js`) — currently unresolved, user is fine remembering to republish for now
- Consider: search/filter on ustaz list (it'll grow)
- Consider: schedule view for a specific ustaz (how many sessions they have)
- Promote beta JSON to production (`jadual_lengkap.json`) once tested — currently publishes to `jadual_lengkap_beta.json`
- The leaked GitHub token in `kuliah/kuliah(beta)/jadual/google-app-script/config.json` is still unresolved (out of scope this session per explicit user instruction to stay in `kuliah3/`) — flag it again if that folder ever comes up
