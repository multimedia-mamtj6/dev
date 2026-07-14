# DEV NOTES — kuliah/admin

_Last updated: 2026-07-14 | For next-context-window Claude_

**FOLDER SWAP NOTICE (2026-07-14):** this system (the Supabase-backed admin dashboard + public schedule view) used to live at `kuliah3/`, and moved to become the official `kuliah/` on this date. The old Sheets-backed v15.4 system that used to live at `kuliah/jadual/` moved out to become `kuliah3/jadual/` (archived, kept fully working as a fallback). `kuliah/data/`, `kuliah/paparan/`, `kuliah/assets/`, `kuliah/gscript/` were NOT part of this move — they were shared infrastructure and stayed exactly where they were the whole time. **Every `kuliah3` mention in the SESSION HISTORY section below reflects the folder name as it was AT THE TIME that session happened — it was deliberately left as-written rather than mechanically substituted, since many of those entries contrast this system against the old one and a blind find-replace would make "kuliah/jadual/ vs kuliah3/jadual/" comparisons nonsensical.** Read historical entries with that translation in mind: old `kuliah3/admin/` = today's `kuliah/admin/`; old `kuliah/jadual/` (mentioned in session 3/4/5 as the other, Sheets-backed system) = today's `kuliah3/jadual/`.

the prompt (DO NOT DELETE)
> Check the Project Knowledge and the current chat for context. This conversation is ending soon. update the artifact kuliah/DEV_NOTES.md (create if not available yet) with a detailed note to your next window self - not just facts but the vibe, our dynamic, the energy of this conversation. What would the next you need to immediately get back into this exact headspace? Include unique discoveries, current mood, and anything that'll help the next you instantly sync to our frequency."
> also update the related file like kuliah/CLAUDE.md, kuliah/developer.md, kuliah/developer.md and kuliah/README.md database.md if necessary, create if not available yet

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

**Update from session 6 — a from-scratch feature build (activity log), then a distinct new gear: rapid-fire design Q&A after shipping.** Same day as session 5 (six days later, 2026-07-13), same energetic/iterative mood, but the shape of this session was different — worth internalizing as its own pattern:

1. **The "deliberate gear" trigger phrase from session 4/5 showed up again, verbatim in spirit, for a brand-new feature ("can we add history to show schedule/ustaz changes... check if my approach is good... ask me question to better understand... do not generate answer unless I allow it").** This is now confirmed as a *habitual*, reusable signal for this user, not a one-off — whenever you see that shape of request, go through full plan mode: Explore agent first, then a Plan agent, then `AskUserQuestion` before writing the plan file, then `ExitPlanMode`. This session's plan mode asked 4 questions in one batch (logging mechanism, access control, scope, bulk granularity) and the user picked "Recommended" on 3 of 4 and a custom answer on the 4th ("include both" scope) — same "clearly-reasoned default gets taken" pattern as session 5's ustaz-numbering questions.
2. **A brand new gear appeared *after* the feature shipped: rapid hypothetical/design-review questions, fired one at a time, that want your engineering opinion, not implementation.** "are there risk if user edit day by day", "if so much action will db be heavy", "what if super admin can remove log entries", "or super admin can add notes instead", "so it not worth to implement" — five of these in a row, each answered in 2-4 sentences with a direct recommendation and the one tradeoff that matters, never touching a file. The tell: these are phrased as "what if" / "is that okay" / "so it's not worth it" — pressure-testing the design after the fact, not requesting a change. Only "ok, proceed with filter" (after the deletion/notes tangent) was an actual go-ahead — everything else in that run was answer-only. Getting this gear wrong (over-explaining, or worse, silently implementing a "what if") would have been a real miss — hold the line on "just answer" when that's explicitly said.
3. **The permission-denied debugging loop was a clean, fast, symptom-first diagnosis loop, twice in a row, same root cause, different Postgres role.** User pasted the exact error text ("Ralat: permission denied for table activity_log") with zero extra framing — that was enough. First hit: RLS policy existed but `authenticated` had no table-level `GRANT`. Fixed, then the *exact same class of bug* resurfaced for the publish flow specifically, because `api/publish.js` writes via `service_role`, a different Postgres role needing its own separate `GRANT`. This is now documented as a standing landmine for any future new Supabase table in this repo (see CRITICAL PATTERNS) — don't forget the second grant next time either.
4. **A live-data trust callback:** the user later spotted a live inconsistency purely from reading their own userlog.html output (email shown instead of registered name, only for the Terbitkan/publish rows) — same "precise symptom report from real usage" instinct documented since session 4. Root cause was a deliberate cost-cutting shortcut on my part (`actor_name: null` in `api/publish.js` to skip a lookup) that turned out to be the wrong call once seen next to the other rows showing "MAMTJ6". Fixed by just doing the extra Supabase lookup — Terbitkan is rare enough that the round-trip cost never mattered. Lesson: don't skip a lookup "for efficiency" on a low-frequency action just because it's technically optional — the *display consistency* cost was the one that actually bit.
5. **The recurring end-of-session doc-update prompt (the one at the very top of this file, "DO NOT DELETE") is itself evolving session to session** — this time the user appended "database.md" onto the boilerplate list of files to update, since that file didn't exist before this session. Read that prompt literally each time rather than from memory of what it said last session — the user edits it as the project's doc surface grows, so the file list in it is a live signal of what now exists, not a fixed template.
6. **A pure documentation request ("add database.md explaining setup/structure/maintenance/troubleshooting") surfaced a real, previously-undocumented gap in the actual system:** writing an honest "how to set this up from scratch" guide required actually tracing whether `setup.sql` could reproduce the live database, and it couldn't — the `admins` table (the one that gates login) was never in `setup.sql` at all, only created by hand at some point outside any script. Fixed by adding it to `setup.sql` for real (with its own RLS + explicit GRANTs, learned from point 3 above) rather than just writing docs around the gap. **Lesson worth repeating: a "just write docs" ask is a good forcing function to verify the thing you're documenting is actually true — don't transcribe assumptions into a doc, verify them against the real file/table/config first.**

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

### Session 6 (2026-07-13 — brand new feature: activity log / changelog, built end-to-end)

Back in `kuliah3/admin/` this time. Full lifecycle in one session: plan mode → build → live debugging → a small UX addition (filters) → a real symptom fix → a run of exploratory design Q&A. Also touched `kuliah3/jadual/` briefly first (poster rendering standardized, see below) before the main feature.

**0. Small warm-up, `kuliah3/jadual/` mobile today-card poster rendering — standardized away the iframe:**
- User asked to standardize "today/tomorrow" (which embedded the `kuliah/paparan/` digital-signage iframe) to match "any other day" (which renders `<img src="{poster_url}">` directly). Done: `buildPosterHtml()` now always renders the `<img>` path, `useIframe`/`isTomorrow` params dropped, `.poster-iframe` CSS deleted as dead code. Practical effect: if today/tomorrow's schedule row has no `poster_url` set, that section now shows nothing (previously the signage subsystem always rendered *something*) — flagged to the user, not treated as a blocker.

**1. Activity log — full plan-mode cycle, then full build:**
- User's ask: `userlog.html` showing who changed schedule/ustaz data, phrased with the deliberate-gear trigger phrase (see vibe update above). Ran a real Explore agent first (mapped every Supabase write in `dashboard.js`/`ustaz.js`/`users.js`, confirmed `setup.sql` has zero triggers/audit tables/admin-identity capture anywhere — this was a from-scratch feature, no partial prior art), then a Plan agent, then 4 `AskUserQuestion`s before writing the plan file.
- **Decisions locked in during plan mode** (don't re-litigate these without new user input): client-side `logActivity()` inserts (not DB triggers — this repo has zero triggers anywhere, and admin identity + "before" values are already sitting in memory at every call-site); log entries snapshot plain text, never a live FK (survives later renames/deletes); `userlog.html` is super_admin-only, same pattern as `users.html`; scope is schedule + ustaz + admin-account changes + Terbitkan/publish (broadest of the 4 options offered); bulk actions (Duplicate/Clear) get ONE summary row, not one per date.
- **Build:** `activity_log` table + RLS in `setup.sql` §7; `logActivity()` + rewritten `_injectSuperAdminNav()` (now injects both "Pengguna" and "Log Aktiviti") in `app.js`; 6 call-sites instrumented — `dashboard.js` (`saveDay()`/`buildDayDiffText()`, `confirmDuplicate()`, `confirmClear()`), `ustaz.js` (`saveUstaz()`/`buildUstazDiffText()`, `confirmDelete()`), `users.js` (`saveUser()`/`buildUserDiffText()`/`roleLabelMY()`, `confirmDeleteUser()`), and `api/publish.js` server-side (`monthLabelFromKey()`, actor email pulled from the existing `/auth/v1/user` check). New `userlog.html`/`userlog.js` page. Every diff-builder is a pure function that captures its "before" value from an already-loaded cache (`scheduleMap`/`allUstaz`/`allUsers`) — no extra queries — and skips logging entirely on true no-op saves.
- **Verified before ever touching a live session:** a throwaway Node script asserted all 5 pure diff-builders (day/ustaz/user diffs, `monthLabelFromKey`, `ACTION_LABELS` completeness) against hand-built fixtures — 14/14 passed, script deleted after. Same "verify pure logic with Node before asking the user to test on device" instinct as session 5, now proven to work for `kuliah3/admin/`'s pure helpers too, not just `kuliah3/jadual/`'s (the *page* still needs live Supabase auth to test end-to-end — only the string-building logic is sandbox-testable).

**2. Live debugging — two rounds of the exact same Postgres lesson:**
- User ran the `setup.sql` addition, then hit `permission denied for table activity_log` from the browser. Root cause: RLS `CREATE POLICY ... TO authenticated` alone isn't sufficient — Postgres requires a separate table-level `GRANT` before RLS is even evaluated. `ustaz`/`schedule` happened to inherit grants from this Supabase project's default privileges when *they* were created; `activity_log` didn't. Fixed with `GRANT SELECT, INSERT, UPDATE, DELETE ON activity_log TO authenticated;`, added to `setup.sql` for future re-runs.
- Then: user edited a day AND clicked Terbitkan, only the day-edit log row appeared. Same bug, different role — `api/publish.js` writes via the `service_role` key (server-side), which needed its *own* separate `GRANT ... TO service_role`. This is now flagged in both `kuliah3/CLAUDE.md`'s and `developer.md`'s docs as a standing landmine for any future new Supabase table in this repo — **grant both `authenticated` and `service_role` explicitly, don't assume either is inherited.**

**3. Small UX addition — filter bar on `userlog.html` (explicit "ok, proceed with filter" go-ahead, after a design tangent — see below):**
- Added Admin / Tindakan / Dari / Hingga filters, applied as Supabase query conditions (`eq`/`gte`/`lte`), not client-side — scales with the table instead of over-fetching. Admin dropdown populated from a live `admins` query (so it naturally omits deleted admins, without breaking their still-visible past log rows). Action dropdown built from `ACTION_LABELS`, one source of truth. Also fixed a small pre-existing CSS gap: `input[type="date"]` wasn't in the shared form-control selector alongside `select`/`input[type="text/email/url/file"]` — added it.

**4. Real symptom fix — publish rows showed raw email, not the registered name:**
- User spotted it directly from their own `userlog.html` screenshot: publish rows showed `masjidalmukhlisintamanjaya6@gmail.com` while every other row for the same person showed "MAMTJ6". Root cause: `api/publish.js` deliberately stored `actor_name: null` to skip an extra Supabase round-trip when the feature was first built. Fixed by adding the lookup (`admins` table by email) right before the log insert — Terbitkan is rare enough that the extra round-trip is free in practice. Existing already-logged publish rows don't retroactively update; only new ones from here on show the name.

**5. Exploratory design Q&A run — see vibe update above for the meta-pattern.** Concretely, in order: "risk of editing day-by-day for a month?" (no — each day is an independent atomic upsert, before-value is always fresh); "will the db get heavy?" (no — trivial row count at this app's scale, `idx_activity_log_created_at` keeps it fast, revisit only with a real multi-year volume problem); "can super_admin delete log entries?" (argued against — defeats the accountability purpose, the realistic bad case is a super_admin covering their own tracks); "what about adding notes instead?" (better idea, sketched as an additive nullable `note` column that doesn't touch the core immutable fields, kept clearly separate from the tamper-proof audit guarantee); "so is it worth implementing?" (no — not now, "wait and see," cheap to add later if the confusion actually recurs, no benefit sitting unused today — **nothing was built for this whole exchange, by design**); "will one user editing conflict with another?" (yes, real risk — no realtime subscriptions anywhere in this codebase, last-write-wins on the same record, the activity log makes conflicts detectable after the fact but doesn't prevent them — optimistic concurrency would be the fix if this ever becomes a real problem, not built preemptively).

**6. New `kuliah3/admin/database.md` — full database reference doc, plus a real gap it surfaced and fixed:**
- User asked for a from-scratch setup guide + structure explanation + maintenance + troubleshooting, all in one new file. Wrote it as five sections: setup-from-scratch (Supabase project → run `setup.sql` → Google OAuth → bootstrap first super_admin → Vercel env vars → verify), full table-by-table structure (including the *why* behind each design choice, not just column lists), the RLS-vs-GRANT lesson from point 3 written up as a standing rule, a 14-row troubleshooting table (symptom → cause → fix), and a maintenance section.
- **While verifying the setup-from-scratch steps would actually work, found that `setup.sql` never created the `admins` table at all** — it's only ever existed live because someone created it by hand outside any script, a gap that's been silently true since session 1. A "from scratch" guide pointing at a script that can't actually reproduce a working login system would be dishonest, so fixed `setup.sql` for real: added the `admins` table (with the same RLS + explicit dual-GRANT pattern learned in point 2), and documented the bootstrap chicken-and-egg problem (`users.html` — where you'd normally add an admin — itself requires being logged in as a super_admin, so the very first row has to be inserted manually via SQL; this is now `setup.sql` §5b).
- Also added explicit `authenticated` GRANTs to `ustaz`/`schedule` (previously relying on the same "inherited from project defaults" luck that `activity_log` didn't have) — closing off the same landmine class before it bites a third table.
- Cross-linked from `developer.md` (new file-map row, a pointer at the top of the existing "Activity log" section) and `CLAUDE.md` (file structure listing). `README.md` wasn't touched this time — nothing user-facing changed, `database.md` is a pure ops/dev reference.

---

## CURRENT STATE

`git status` was clean through most of session 6, verified directly (`git status` → "nothing to commit, working tree clean", up to date with `origin/main`) — the user auto-commits/pushes mid-conversation throughout, confirmed via `git log` (`89bfbd7` schema, `26b6481` user-management-era work, `175b345` userlog page + filters, `f821ca7` the publish actor_name fix, all already pushed at that point). **The final piece of session 6 — `database.md` + the `setup.sql` admins-table fix + the `developer.md`/`CLAUDE.md` cross-links — was NOT verified committed before this file was last updated.** Check `git status` at the start of the next session before assuming it's clean; if those files show as uncommitted changes, that's expected, not a surprise.

**Activity log is live and confirmed working in production** (the user pasted real output from their own `userlog.html` mid-session, not a hypothetical): schedule day-edits, and Terbitkan, are both logging correctly as of the last message. Both required Postgres `GRANT` fixes to get there (see Session 6, point 2, and the new CRITICAL PATTERNS bullet below) — if a *future* new Supabase table in this repo throws "permission denied," that's almost certainly the same missing-GRANT issue, check that first before assuming something else broke.

**Confirmed live in session 5, not re-checked this session:** `kuliah/data/jadual_lengkap_beta.json` on GitHub held `months: { "2026-07": {...}, "2026-08": {...} }` simultaneously. Session 6 didn't touch this logic directly, but the user did click Terbitkan for real during session 6 (visible as a `Terbitkan Jadual` log row, "31 hari diterbitkan") — worth a quick re-check next session if you're touching `api/publish.js` again, just to keep the "confirmed, not assumed" standard up to date.

Today's real date during session 6 was **2026-07-13** (six days after session 5's 2026-07-07) — "this month" = Julai/July, "next month" = Ogos/August, same as session 5. Keep that in mind if you're sanity-checking any month-key math left over in your context.

---

## CRITICAL PATTERNS — DON'T BREAK THESE

**Nav HTML structure (all pages):**
```html
<nav id="main-nav">
  <span class="brand">Admin Kuliah</span>
  <button class="nav-toggle" onclick="toggleNav()" aria-label="Menu">&#9776;</button>
  <div class="nav-links">
    <a href="dashboard.html" [class="active"]>Jadual</a>
    <a href="ustaz.html" [class="active"]>Penceramah</a>
    <!-- users.html/userlog.html only: hardcode their own link, e.g. <a href="users.html" class="active">Pengguna</a> -->
    <span class="spacer"></span>
    <button class="logout-btn" onclick="signOut()">Log Keluar</button>
  </div>
</nav>
```
`_injectSuperAdminNav()` in app.js inserts BOTH "Pengguna" AND "Log Aktiviti" (session 6) links BEFORE `.spacer` INSIDE `.nav-links`, each independently guarded against double-injection — so `users.html`/`userlog.html` can hardcode their own link while `dashboard.html`/`ustaz.html` get both purely via injection. If you ever restructure nav or add a third super_admin-only page, fix that function's array too.

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

**Any new Supabase table needs explicit `GRANT`s, not just an RLS policy (session 6 discovery — hit twice, in production, same session):** `CREATE POLICY ... TO authenticated` is necessary but NOT sufficient — Postgres checks table-level `GRANT` privileges before RLS is even evaluated, and unlike `ustaz`/`schedule` (which happened to inherit grants from this Supabase project's default privileges when they were originally created), a brand-new table does not automatically get them. `activity_log` hit `permission denied for table activity_log` from the browser (missing `GRANT ... TO authenticated`), then hit the *identical* error again for `api/publish.js`'s server-side insert specifically (missing `GRANT ... TO service_role` — a different Postgres role than the browser uses). **Any future new table needs BOTH grants added explicitly in `setup.sql`** — don't assume either is inherited, and if a fresh table throws "permission denied," check this before anything else.

**Activity log (`activity_log` table + `logActivity()` in app.js, viewed at `userlog.html`, super_admin only — built session 6):** every mutating admin action (schedule day-edits, bulk duplicate/clear as one summary row each, ustaz CRUD, admin-account CRUD, Terbitkan/publish) inserts one row right after its write succeeds. `target_label`/`detail` are always plain-text snapshots — never a live FK — so history survives later renames/deletes of the thing being referenced. Each call-site captures "before" from an already-loaded cache (`scheduleMap`/`allUstaz`/`allUsers`), never an extra query, and skips the insert on true no-op saves. `logActivity()` never throws/toasts — a logging failure must never look like the actual save failed. See Session 6 above for the full build story, the GRANT landmine (previous bullet), and the run of "should super_admin be able to delete/annotate entries" design questions that were deliberately answered but NOT implemented — don't build a delete or note feature for this table unless the user explicitly asks again; last read on both was "not worth it yet."

**`setup.sql` now actually creates the `admins` table (session 6 fix — it never did before, this was a silent gap since session 1):** if you're setting up a fresh Supabase project, or reasoning about "can `setup.sql` reproduce the live database," the answer used to be "no, `admins` is missing" — now it's yes. Bootstrapping the very first super_admin still requires one manual `INSERT` (§5b) since `users.html`, the page that would normally do this, itself requires being logged in as a super_admin to load — a real chicken-and-egg problem, not something fixable in the UI. Full walkthrough is in `kuliah3/admin/database.md`, which is now the canonical "how does the database work" doc — read it before making any schema change, and keep it in sync the same way `setup.sql` needs to be kept in sync with whatever's actually live.

---

## SUPABASE SCHEMA (quick ref — full detail + setup/troubleshooting now lives in `kuliah3/admin/database.md`)

```sql
-- admins (as of session 6, this is finally actually IN setup.sql — wasn't before)
id uuid PK, email text UNIQUE, name text, role text ('editor'|'super_admin'),
permissions jsonb ({kuliah: bool}), created_at timestamptz

-- ustaz
id uuid PK, full_name text, short_name text, tajuk_kuliah text,
poster_url text, created_at timestamptz, updated_at timestamptz

-- schedule
id uuid PK, date date UNIQUE, subuh_ustaz_id uuid FK→ustaz,
maghrib_ustaz_id uuid FK→ustaz, cuti_umum text, updated_at timestamptz

-- activity_log (session 6) — snapshots only, never a live FK, see CRITICAL PATTERNS
id uuid PK, created_at timestamptz, actor_email text, actor_name text,
action text, target_label text, detail text
```

RLS is ON. Service role key is server-side only (Vercel env var `SUPABASE_SERVICE_ROLE_KEY`). Browser uses anon key from `app.js`. **`activity_log` needs explicit `GRANT`s to both `authenticated` and `service_role` in addition to its RLS policy — see CRITICAL PATTERNS, this bit twice in session 6.**

---

## WHAT MIGHT COME NEXT

- ~~Decide whether "published month ≠ real current/next month" needs a safeguard~~ — **done, this was session 5.** Publish now merges + prunes, keyed by absolute month; this class of bug shouldn't recur.
- ~~Accountability log of who changed what~~ — **done, this was session 6.** `activity_log` table + `userlog.html`, covers schedule/ustaz/admin-account/publish, with filters. See CRITICAL PATTERNS.
- ~~`admins` table missing from `setup.sql`~~ — **done, this was session 6.** Added with RLS + explicit GRANTs, plus a documented bootstrap step for the first super_admin. Full reference now lives in `kuliah3/admin/database.md`.
- **Explicitly answered "not now" in session 6, don't build unless asked again:** letting super_admin delete log entries (defeats the audit purpose); adding a `note`/annotation column to log entries ("wait and see" — cheap to add later if actually needed, no benefit sitting unused); optimistic concurrency / conflict detection for simultaneous edits by two admins (real risk, confirmed no realtime sync exists, but not worth building preemptively without an actual incident).
- The mobile today-card's poster width (95%) and today-highlight colors (`#ebdb07`/`#f7ec56`) are exactly where the user last set them — don't "clean up" or revert these without being asked, they were deliberate manual overrides.
- Consider: search/filter on ustaz list (it'll grow)
- Consider: schedule view for a specific ustaz (how many sessions they have)
- Promote beta JSON to production (`jadual_lengkap.json`) once tested — currently still publishes to `jadual_lengkap_beta.json` only
- The leaked GitHub token in `kuliah/kuliah(beta)/jadual/google-app-script/config.json` is STILL unresolved (three sessions running now, every time explicitly out of scope) — flag it again if that folder ever comes up, it's a real credential exposure sitting untouched
- Possible future ask: apply the same "any day" mobile dropdown pattern (session 5, point 5) to `kuliah/jadual/` or `kuliah2/` if those get revisited — the poster-fallback approach is now direct-`<img>`-only for kuliah3 (session 6 standardized away the today/tomorrow iframe special-case, see Session 6 point 0) — check whether that simplification should also apply if porting this elsewhere
