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

**Update from session 5 — the one where the session-4 cliffhanger actually got resolved:** Session 4 ended with the Julai/Ogos publish-overwrite bug flagged as "unresolved, user is fine remembering to republish for now." This session, the user came back, hit the title-display symptom of that exact same bug again (this-month/next-month titles swapping depending on which was last published), and this time asked to actually fix it properly instead of working around it. That's the headline win of this session — go read "Session 5" below, but the short version: **it's actually fixed now**, verified live (see CURRENT STATE — the production JSON currently holds both July AND August simultaneously, first time that's ever been true).

New things about the dynamic worth internalizing:

1. **The user co-edits files in the IDE in real time, mid-conversation, and won't tell you.** This happened repeatedly this session — you'll propose a value (poster width 65%, a color), and a few messages later a system-reminder will show you the file already changed to something else (95%, a different hex) with an instruction not to mention you were told. **Always re-Read the actual current file state before editing anything they have open** — do not trust your own last-written values, they may already be stale. This isn't a one-off; expect it every session now. When they explicitly tell you their new value ("i use 95%, remember that") — that's a strong signal, save it as a proper feedback memory (see `feedback_mobile_poster_width.md` in the memory dir) so you don't re-suggest shrinking it back down next time.
2. **A third gear exists beyond fast/deliberate: "explain-then-maybe-fix," often in one message.** Things like "why does X happen, explain and give your plan" or "is this high risk or not" or "how to fix (maybe reduce element size?)" — these want a real root-cause explanation or risk assessment *first*, sometimes with the fix proposal woven into the same turn, sometimes explicitly held back ("dont edit anything, just explain"). Read the verb: "explain" / "is this possible" / "what is the risk" → diagnose out loud, don't touch files yet, wait for "ok proceed." Read "how to fix" / "make it X" → you can just do it.
3. **This session lived almost entirely in `kuliah3/jadual/` (the public page), not `kuliah3/admin/`** — a change from sessions 1-4. Because it's a static, unauthenticated page, you can actually verify JS logic changes yourself without a browser: write a throwaway Node script, `vm.runInContext()` the real `script.js`/`api/publish.js` source against a stubbed `document`/`fetch`, and assert on the output. Did this repeatedly (title logic, the months-merge logic, the day-select dropdown, the poster fallback) and it caught real things before the user ever had to test on device. This does **not** work for `kuliah3/admin/` (needs live Supabase + Google OAuth) — know which side of that line you're on before deciding whether "I verified it" is actually true.
4. Mood: energetic, iterative, visual. A lot of "screenshot → tiny CSS/JS tweak → screenshot again" loops on the mobile view specifically (footer alignment, Arabic font, today-card poster sizing, dropdown width, highlight colors). None of it precious — the user tries your first pass, then just directly overrides the exact number themselves if it's not quite right (see point 1). That's not a signal you did it wrong, it's just how they dial in visual values — expect it, don't be precious about your first guess either.

---

## WHAT THIS PROJECT IS

`kuliah3/admin/` is a full admin dashboard for MAMTJ6 mosque lecture schedule management. This is NOT a read-only view — it is the CMS.

`kuliah3/jadual/` is the public-facing read-only schedule view (desktop grid + mobile card list) that renders whatever `kuliah3/admin/` has published. As of session 5 this is where most of the actual work happens — see below.

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
    → POST /api/publish?month=YYYY-MM
    → api/publish.js reads Supabase, MERGES into months{YYYY-MM: {...}} keyed JSON, prunes to real-current+real-next, pushes to GitHub
    → kuliah/data/jadual_lengkap_beta.json updated (now holds BOTH months, not just the last-published one)
    → kuliah3/jadual/script.js looks up jsonData.months[monthKey] where monthKey comes from the URL (?bulan=depan or not), not from the JSON content
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

### Session 2 (mobile + polish)

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
- `vercel.json` has `Cache-Control: public, max-age=0, must-revalidate` for `/kuliah3/admin/(.*)`. Added because mobile browsers cached old CSS. No more hard-refresh needed after deploys. (Superseded in session 4 — see below, it's `no-store` now.)

**GitHub commit link removed from publish:**
- `dashboard.js` used to `window.open(data.commitUrl, '_blank')` after a successful publish. Removed — non-tech users don't need to see GitHub.

**Month navigation:** Unrestricted. Admins can navigate to any past/future month. Future schedules are stored in Supabase by date and sit there until published. This is intentional — preparing next month in advance is a valid use case.

**Poster editing enhancement:**
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

Long, high-throughput session entirely in `kuliah3/admin`, done incrementally in tiny steps with the user testing/committing after most of them.

**Dashboard toolbar — schedule view/export/publish gating (`dashboard.html`, `dashboard.js`, `style.css`):**
- Added a "Lihat Terbitan {month}" dropdown (final form) replacing what started as two separate buttons ("Tunjukkan Jadual" / "Export PDF") — collapsed into one trigger + menu after the fact for a cleaner toolbar. Menu items: `#view-schedule-btn` → `/kuliah3/jadual/jadual.html[?bulan=depan]`, `#export-pdf-btn` → same + `?file=pdf` (hidden on mobile via `@media screen and (max-width: 768px) { #export-pdf-btn { display:none } }` — screen-scoped per the session-3 lesson above).
- **Critical constraint discovered:** `kuliah3/jadual/script.js` can only render the *real* current month or *real* next month (`?bulan=depan`) — no arbitrary-month param exists. But dashboard month nav (`prevMonth`/`nextMonth`) is unrestricted. So `updateScheduleActions()` in `dashboard.js` computes `isRealCurrent`/`isRealNext` from an actual `new Date()` (never from the dashboard's `currentYear`/`currentMonth` alone) and hides the whole view/export/Terbitkan cluster — plus the "Tekan Terbitkan..." hint text (`#publish-hint`) — whenever the admin has navigated to any other month. A `#future-month-note` explains why (system only supports current+next; editing elsewhere is fine, it's just for early planning — doesn't publish/preview from there).
- `#month-tag` badge next to the month selector shows "Bulan Ini" / "Bulan Depan" / nothing, driven by the same `isRealCurrent`/`isRealNext` flags — one computation, three UI consequences. If you touch this logic, `updateScheduleActions()` is the single source of truth for all of it.

**Month actions dropdown — Duplicate + Clear (the "deliberate gear" example):**
- `#month-actions` dropdown ("Tindakan Bulan ▾") with two items: **Salin Data {previous month}** and **Kosongkan Bulan Ini**. First dropdown-menu UI pattern in this codebase (`.month-actions-menu` / `.month-actions-item` in `style.css`) — reused verbatim for "Lihat Terbitan" once that came along.
- Both dropdowns close on outside-click via one shared `document.addEventListener('click', ...)` in `dashboard.js`; each trigger button does `e.stopPropagation()`.
- **Duplicate** (`confirmDuplicate()`): copies `subuh_ustaz_id`/`maghrib_ustaz_id` only — **deliberately excludes `cuti_umum`**. Maps by day-of-month number, source days beyond target month length silently skipped. Confirmation modal shows overwrite count.
- **Clear** (`confirmClear()`): hard-deletes all `schedule` rows in viewed month's range, after confirmation.

**Ustaz edit modal — two-column desktop layout (`ustaz.html`, `style.css`):**
- `.ustaz-form-columns` > `.ustaz-form-col` (identity) + `.ustaz-form-col.ustaz-form-col-poster`, stacked on mobile (unchanged), side-by-side at `min-width: 768px` with a divider. Modal widens 480px → 700px via `.modal-poster` class.
- Also fixed: `input[type="url"]` was missing entirely from the shared text-input selector — added `url`/`file`.

**The big diagnostic detour — single-blob publish, flagged but NOT fixed this session:**
- User reported viewing Julai in the dashboard, clicking view-schedule showed Ogos. Root cause (confirmed by reading live JSON mid-conversation): `api/publish.js` doesn't merge — every `Terbitkan` completely replaces the single JSON blob with only the currently-viewed month. `kuliah3/jadual/script.js` set its `<h1>` title straight from `jsonData.infoJadual.tajukBulan` unconditionally, ignoring the URL — **this exact bug is what session 5 fixed properly, see below.**
- Distinction that still matters: `Terbitkan` hits `/api/publish` (Vercel serverless — 404s under plain `python -m http.server`). Duplicate/Clear/day-edit/save hit Supabase directly (same production project everywhere, no local sandbox) — work locally, never a drill.
- Found (but explicitly told to ignore, out of scope): `kuliah/kuliah(beta)/jadual/` has a live-looking GitHub PAT committed in `google-app-script/config.json`. **Still unresolved as of session 5** — nobody has gone back to that folder. Flag again if it ever comes up.

### Session 5 (2026-07-07, same day as session 4 — jadual/ public page: the publish bug got actually fixed, plus a big mobile UX pass)

This is the session where the Session-4 cliffhanger got resolved, plus a long tail of `kuliah3/jadual/` mobile polish. Entirely in the public page this time, not the admin dashboard (except one small admin dropdown/color tweak).

**1. Title bug fix (the symptom that kicked everything off):**
- User reported the exact Session-4 symptom again, from the *reader* side this time: default URL showing "bulan depan" title, or `?bulan=depan` showing "bulan ini" title, depending on which was last published.
- Root cause confirmed identical to session 4's diagnosis: `script.js`'s title was `jsonData.infoJadual.tajukBulan` (whatever the JSON says), completely decoupled from `baseDate` (which the calendar/mobile rendering *does* correctly derive from `?bulan=depan`).
- **Fix:** title is now computed client-side, `` `BULAN ${MONTH_NAMES[baseDate.getMonth()].toUpperCase()} ${baseDate.getFullYear()}` `` — a pure function of the URL, never of the fetched JSON. Verified locally by running the real `script.js` against the actual live (buggy) JSON via a Node `vm` harness and confirming both URLs now show correct titles regardless of which month's data happened to be published.

**2. The real fix — publish merges instead of overwriting (this is the headline change):**
- Went into plan mode properly for this one (it's structural/irreversible — new file schema, new server logic). Explored `api/publish.js`, `dashboard.js`'s `publishMonth()`/`updateScheduleActions()` gating, grepped repo-wide for every consumer of `jadual_lengkap_beta.json` (only two: `api/publish.js` writes it, `kuliah3/jadual/script.js` reads it — everything else matching "jadual_lengkap" is the OLD unrelated Google-Sheets-synced file, different pipeline entirely, not touched).
- **Design decision worth remembering if this ever needs revisiting:** the user's own instinct was to key the JSON by relative role (`bulanIni`/`bulanDepan`). Talked through why that's wrong — it needs an explicit relabel step at every month rollover that nothing would ever trigger, silently going stale. Went with **absolute `YYYY-MM` keys** instead (`{ "months": { "2026-07": {...}, "2026-08": {...} } }`) so the reader (`script.js`) just computes what "this month"/"next month" mean itself from `baseDate`, at request time — rollover-safe by construction, no relabeling ever needed.
- `api/publish.js` now: fetches the existing file's *content* (not just its SHA — GitHub's contents API already returns both in one call, this was previously being thrown away), migrates the old flat schema if that's still what's live (parses `tajukBulan` text back into a `YYYY-MM` key via the existing `BULAN` array, drops it cleanly if unparseable rather than guessing wrong), merges only `months[requestedMonth]` leaving every other key untouched, and **prunes** any key that isn't the real-current or real-next month (computed **in Malaysia time, UTC+8, explicitly** — Vercel runs in UTC and naive server-local time math could disagree with Malaysia near a month-boundary midnight and prune away the month that was just written; this was a real new bug surface introduced by adding server-side month math, caught and fixed before it shipped, not before). Added a safety-net 400 rejection for any `month` param that isn't real-current/real-next, since the prune logic's correctness now *depends* on that invariant actually holding, not just usually holding.
- **Verified for real, not just in theory:** wrote a Node script that `require()`s the actual exported pure functions from `api/publish.js` (`computeRealMonthKeys`, `inferMonthKeyFromTajuk`, `buildMonthsStoreFromExisting`, `mergeAndPruneMonthsStore` — these are attached to `module.exports` as properties specifically so they're unit-testable without a Vercel runtime) and reproduced the exact bug scenario with `assert`: publishing August with cleared data no longer erases July's `senaraiHari`. Then — best part — **confirmed it live**: after the user clicked Terbitkan for both months post-deploy, `kuliah/data/jadual_lengkap_beta.json` on GitHub genuinely contains both `"2026-07"` and `"2026-08"` keys simultaneously right now. First time that's ever been true. This is a fixed bug, not a documented limitation anymore.
- `kuliah3/jadual/script.js` now computes `monthKey` from `baseDate` and looks up `jsonData.months[monthKey]`; added a "Jadual belum diterbitkan buat masa ini." fallback for the mobile view when a month key is entirely absent (previously rendered nothing at all, looked broken).
- `kuliah3/CLAUDE.md` and `README.md`'s stale "overwrites, never merges" language updated to match (do this same update to any other doc echoing the old behavior if you find one).

**3. Ustaz dropdown in the day-editor modal — numbered Nama Ringkas:**
- Fast-then-deliberate: user asked for short_name + numbering + "-TIADA KULIAH-" first, but this was ambiguous enough (numbering scheme, sort order, number placement, stability) that four `AskUserQuestion` rounds happened before touching code. User picked the "Recommended" option on all four every time — worth noting, when you present a clearly-reasoned default they tend to just take it.
- Result: `dashboard.js`'s `loadMonth()` now sorts `ustazList` client-side by `short_name` (`localeCompare({numeric:true})`, matching `ustaz.js`'s existing convention exactly so the numbers line up across both pages), and `openModal()` renders `"ShortName (N)"` — **suffix**, not prefix, specifically so the browser's native type-to-jump-by-letter still works on the `<select>`. `"— Tiada Kuliah —"` stays unnumbered and first.

**4. Yasin/Yasiin special coloring, extended to the admin dashboard:**
- Public page (`kuliah3/jadual/`) already had a "Bacaan Yasiin & Tahlil" special case (Arabic text block, green cell) from before this session. User asked for the admin dashboard's calendar pills to match when that same ustaz is assigned.
- Added `isYasinEntry(ustaz)` to `app.js` (shared helper, matches `/yasi+n/i` against `short_name`+`full_name` combined — handles both "Yasin" and "Yasiin" spelling, since which field has which spelling wasn't guaranteed) rather than hardcoding whichever dropdown position it happened to land on (position isn't stable — see ustaz numbering above, it recalculates every load).
- `dashboard.js`'s `renderCalendar()`/`renderMobileDayList()` now check `isYasinEntry()` and swap in a `.yasin`/`.mdc-yasin` class (light green) instead of the normal subuh-blue/maghrib-amber styling, for either session, on both desktop pills and the mobile day-list text.

**5. Mobile "today card" — extended from today/tomorrow-only to any day in the month:**
- This one got an explicit risk conversation before implementing (user asked "is this high risk?"). The honest answer mattered: the *dropdown/date-math* part is low-risk (client-side only, no auth, fully testable locally via `python -m http.server` since it's a static JSON-fetching page) — but the poster **iframe** embed for today/tomorrow points at `kuliah/paparan/{today|tomorrow}_{subuh|maghrib}.html`, a *separate* subsystem driving an actual physical signage screen at the mosque, on the OLD non-beta JSON pipeline (Google Sheets, not this Supabase one). That subsystem's `getTargetDate()` is hardcoded to only know "today" or "today+1" — no arbitrary date support at all.
- **Resolution:** kept the iframe exactly as-is for today/tomorrow (zero risk to the physical screen), and for every other day in the month, render the poster directly as `<img src="{session.poster_url}">` instead — kuliah3's own `senaraiHari` already carries `poster_url` per session, so this needed zero changes outside `kuliah3/jadual/`. Confirmed `kuliah/paparan/style.css` is fully responsive (`object-fit: contain`, percentage-based) before relying on this, so nothing about the shared `.poster-wrapper` sizing risks cropping either path.
- Dropdown (`buildDaySelectOptions()`) lists every day of the current month, "Hari Ini"/"Hari Esok" always pinned first using their *real* dates (handles the edge case where today is the last day of the month and "tomorrow" spills into the next month — verified with a July-31 test case specifically).
- Verified end-to-end with a Node `vm` harness: booted the real `script.js`, rendered "today," then called `renderTodayCard()` again simulating a mid-month selection, and asserted the iframe→`<img>` swap actually happens and pulls the right ustaz.
- Later trimmed the option labels to drop the day-of-week suffix ("15 Julai" not "15 Julai (Rabu)") after the user clarified — note for next time: since this is a native `<select>`, there's no way to show a shorter label in the closed state and a longer one in the open list; whatever text is on the option is what shows in both, always.

**6. Mobile visual polish pass on `kuliah3/jadual/` (rapid-fire, screenshot-driven):**
- Footer text was right-aligned on mobile only because `.footer-link` has its own explicit `text-align: right` for the desktop flex-row layout, which beats the parent `.page-footer`'s inherited `text-align: center` on mobile since it's a direct rule, not inheritance. Fixed with a mobile-scoped `.footer-link { text-align: center; }` override, screen-scoped media query, no desktop impact.
- Arabic/Jawi text ("Bacaan Yasiin & Tahlil") used a proper font on desktop (`.arabic-text { font-family: 'Scheherazade New', ... }`) but mobile reused the generic `.lecture-ustaz` class with no font-family override, so it rendered in the site's default Poppins sans-serif — wrong font for Jawi script entirely. Fixed narrowly via `.lecture-ustaz[lang="ar"]` attribute selector so only this specific instance is affected, not regular ustaz names. Also centered it (was right-aligned) per follow-up.
- Today-card was overflowing/needed scrolling on a 2-session day. Did the "must fit one screen" version (user's explicit choice over "just tighten spacing, scrolling OK"): shrunk `.poster-wrapper` width as the single biggest lever (16:9 aspect-ratio means less width = proportionally less height too), plus header/padding trims. **User immediately overrode the poster width value themselves** (65% → 95%, told me explicitly to remember it — saved as `feedback_mobile_poster_width.md` in the memory dir). Confirmed via `kuliah/paparan/style.css` inspection that shrinking the iframe wrapper doesn't crop anything (it's a responsive page, scales cleanly) before touching it.
- Split the today-highlight color into two independent CSS variables (`--today-highlight-bg` for the date-bar/cell background+glow, `--today-lecture-bg` for the ceramah/lecture-content area specifically) after the user noticed one variable was driving both and asked to separate them. **User then directly set both values themselves** (`#ebdb07` / `#f7ec56`) without further discussion — noticed via a system-reminder file diff, not something they announced. Same pattern as the poster width: propose the *structure* (the separable variable), they'll dial in the actual *values* themselves in the IDE.

---

## CURRENT STATE

`git status` is clean — the user has committed everything (script.js, style.css, app.js, dashboard.js, api/publish.js, and doc updates) via their IDE alongside this chat, same pattern as every prior session. Most recent commits on `main` are the session-5 CSS/layout work plus repeated `[Admin] Terbitkan jadual BULAN JULAI/OGOS 2026` auto-commits from the user actually clicking Terbitkan (twice, deliberately, right after the merge fix deployed — this *is* the regression test for the fix, and it's confirmed to have passed).

**Confirmed live right now (checked directly, not assumed):** `kuliah/data/jadual_lengkap_beta.json` on GitHub currently has `months: { "2026-07": {...31 real days...}, "2026-08": {...} }` — both months coexisting in the published file simultaneously for the first time ever. If you start a new session and this has regressed to a single key again, something broke — that would be a real regression this time, not the old known limitation.

Today's real date during this whole session was **2026-07-07** (July 7, 2026) — "this month" = Julai/July, "next month" = Ogos/August. Keep that in mind if you're sanity-checking any month-key math left over in your context.

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
- `≤768px` — tablet: compact padding, smaller elements
- `≤640px` — phone: hamburger, card tables, day list (admin); `kuliah3/jadual/` uses `≤768px` as its own mobile/desktop split (different file, different breakpoint — don't confuse the two)

**Any `@media (max-width: ...)` block must be `@media screen and (max-width: ...)`:**
Without `screen`, mobile layout rules stay active during print/PDF export on narrow devices and `@media print` can't reliably reset them. Broke `kuliah3/jadual/` PDF export this way (session 3) — applies to any new print/export feature anywhere in `kuliah3/`.

**Card-per-row table pattern:**
Every `<td>` in JS-rendered tables must have `data-label="..."`. Empty label `data-label=""` is fine for action columns (no prefix shown).

**Ustaz sort is client-side, everywhere it's used:**
Never add `.order()` back to the Supabase ustaz query — it breaks numeric sort. Sort with `localeCompare({numeric:true, sensitivity:'base'})` in JS after fetch. As of session 5, both `ustaz.js` (Penceramah page `#` column) and `dashboard.js` (day-editor dropdown numbering) do this identically and are meant to produce matching numbers — if you change one, change both.

**Poster save logic (3-way):**
```
pendingRemovePoster → payload.poster_url = null
newPosterUrl (file or URL input) → payload.poster_url = newPosterUrl
neither → don't include poster_url in payload
```
This is intentional — omitting `poster_url` from payload preserves existing value on update.

**Dropdown menu pattern:** `.month-actions` (or any wrapper with `position: relative`) + `.month-actions-menu` (absolute, `.open` toggles `display`) + `.month-actions-item` rows, closed via one shared document-level click listener in `dashboard.js`. Reuse these classes for any new dropdown rather than building a fresh one.

**Publish MERGES now, keyed by absolute month — this replaces the old "full overwrite" note from session 4, which is no longer true:**
`jadual_lengkap_beta.json` is `{ "months": { "YYYY-MM": { infoJadual, senaraiHari }, ... } }`. Each `Terbitkan` click writes only `months[thatMonth]`, leaves every other key untouched, and prunes anything that isn't the real-current/real-next month (computed server-side in Malaysia time, UTC+8). `kuliah3/jadual/script.js` reads `jsonData.months[monthKey]` where `monthKey` comes from the URL/`baseDate`, never from the JSON content — so the title and the data can never disagree with the URL again. See Session 5 above for the full story, and `api/publish.js`'s exported helper functions (`computeRealMonthKeys`, `buildMonthsStoreFromExisting`, `mergeAndPruneMonthsStore`) if you need to touch this logic again — they're structured as pure functions specifically so you can unit-test them with a throwaway Node script instead of needing a live deploy.

**`isYasinEntry()` in app.js (session 5):** shared helper, `/yasi+n/i` against `short_name + full_name` combined. Use this instead of hardcoding a dropdown position or a single spelling — the ustaz's numbered position in dropdowns is NOT stable (recalculated every load), and "Yasin" vs "Yasiin" spelling isn't guaranteed consistent between short_name and full_name.

**Local testing split — know which one you're touching:**
- `kuliah3/admin/`: `Terbitkan` hits `/api/publish` (Vercel serverless — does not exist under plain `python -m http.server`, will error). Duplicate/Clear/day-edit/save all hit Supabase directly (same production project everywhere, no local sandbox) — work locally but are never a drill.
- `kuliah3/jadual/` (session 5 discovery): this is a static, unauthenticated page — you CAN verify JS logic changes yourself with a Node `vm.runInContext()` harness against a stubbed DOM/fetch, no browser or server needed. Did this for the title fix, the months-merge logic, and the any-day dropdown/poster logic. Good technique to reach for again before asking the user to test on device.

**The user co-edits files in the IDE mid-conversation (session 5 discovery, expect it going forward):**
Values you propose (a CSS width, a hex color) may already be different by the time you look again — a system-reminder will show you the diff without the user saying anything. Always re-Read a file's current state before editing it if the user has it open and you're not 100% sure your last edit is still what's on disk. If they explicitly tell you a new value and ask you to remember it, save it as a feedback memory immediately.

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

- ~~Decide whether "published month ≠ real current/next month" needs a safeguard~~ — **done, this was session 5.** Publish now merges + prunes, keyed by absolute month; this class of bug shouldn't recur.
- The mobile today-card's poster width (95%) and today-highlight colors (`#ebdb07`/`#f7ec56`) are exactly where the user last set them — don't "clean up" or revert these without being asked, they were deliberate manual overrides.
- Consider: search/filter on ustaz list (it'll grow)
- Consider: schedule view for a specific ustaz (how many sessions they have)
- Promote beta JSON to production (`jadual_lengkap.json`) once tested — currently still publishes to `jadual_lengkap_beta.json` only
- The leaked GitHub token in `kuliah/kuliah(beta)/jadual/google-app-script/config.json` is STILL unresolved (two sessions running now, both times explicitly out of scope) — flag it again if that folder ever comes up, it's a real credential exposure sitting untouched
- Possible future ask: apply the same "any day" mobile dropdown pattern (session 5, point 5) to `kuliah/jadual/` or `kuliah2/` if those get revisited — the poster-fallback approach (iframe for today/tomorrow, direct `<img>` otherwise) should transfer directly if they share the same `kuliah/paparan/` signage subsystem
