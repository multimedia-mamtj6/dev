# Session Handoff — waktu-solat/widget.html

the prompt:
"Check the Project Knowledge and the current chat for context. This conversation is ending soon. update the artifact DEV_NOTES.md (create if not available yet) with a detailed note to your next window self - not just facts but the vibe, our dynamic, the energy of this conversation. What would the next you need to immediately get back into this exact headspace? Include unique discoveries, current mood, and anything that'll help the next you instantly sync to our frequency."

also update the related file like waktu-solat/CLAUDE.md, waktu-solat/developer.md, waktu-solat/developer.md and waktu-solat/README.md if necessary

**Last updated:** 2026-06-15 (Session 10)
**Files touched this session:** `waktu-solat/index.html`, `waktu-solat/sw.js`
(CACHE_NAME bumped v1.6.4 → v1.6.7 across 4 separate edits), plus end-of-session
touch-ups to `CLAUDE.md`/`developer.md`/`README.md`.

---

## Vibe / dynamic check for Session 10 (most recent — read this first)

Back to **iterative, terse, "just fix it" energy** — six small, mostly
unrelated asks, all on `index.html`/`sw.js`, NOT `widget.html` (first session
in a while focused on the main page rather than the widget). Zero plan mode —
every ask was a direct "do X" or a quick diagnostic round-trip.

### Ask 1-2 — mobile container padding
"on mobile view, the today container and infaq container dont have left and
right padding, add some" → added
```css
@media (max-width: 600px) {
  .today-container,
  .infaq-section {
    margin: 20px 20px;
  }
  ...
}
```
User said "add more" once (15px → 20px). Then **"why it still touch the edge
of the screen?"** — the CSS fix was correct; the problem was **stale SW
cache** (`index.html` is in `sw.js`'s precached app shell, so a CSS-only edit
doesn't surface until `CACHE_NAME` bumps + hard refresh/unregister). Bumped
v1.6.4 → v1.6.5.

### Ask 3 — CSP/iframe "dev.mamtj6.com refused to connect" on local dev
Diagnosed using `REVERSE_PROXY_FIX.md` context from a prior session — the
production `frame-ancestors` allow-list (`mamtj6.com` / `www.mamtj6.com` /
`dev.mamtj6.com`) blocks the hardcoded production widget iframe `src` from
localhost/Live-Server origins. Fixed by making `updatePrayerWidgetFrame()`
environment-aware:
```js
const isProd = /(^|\.)mamtj6\.com$/.test(window.location.hostname);
const base = isProd ? 'https://dev.mamtj6.com/waktu-solat/widget' : 'widget.html';
```

Then **two rounds** of "still refuse to connect" — both turned out to be
**stale SW cache again**, not code bugs. One `CACHE_NAME` edit apparently
didn't persist (an `Edit` later failed with "string not found" because the
file was still at the OLD version) — fixed by re-`Read`ing `sw.js` to confirm
the *actual* current version before bumping again. **Don't trust your own
memory of what you last wrote — re-read the file if an Edit doesn't match.**

User then asked **"wht if we remove entire service worker"** as an
exploratory question, not an instruction — answered in 2-3 sentences per the
style guide (keep SW, network-first as an alternative if ever needed),
did NOT implement. User: "nevermind, the fix for stale Service Worker cache
had do it job" — manual DevTools unregister/clear-data resolved it, SW stays
as-is.

**Lesson for next-you**: on this project, "user says nothing changed" is
*almost always stale SW cache*, not a code bug. Pattern: (1) bump
`CACHE_NAME`, (2) if still stale, tell the user to DevTools → Application →
Service Workers → Unregister, or "Clear site data". Don't second-guess a
correct code fix just because it isn't showing yet.

### Ask 4-5 — schedule table redesign (`index.html`)
Two quick "just do it" edits to the monthly schedule table (desktop
`<table>` + mobile cards), both landed with zero AskUserQuestion:

1. **"swap the date so it show (day) miladi / hijri"** — date cell went from
   `hijri / gregorian (day)` → `(${dayOfWeek}) ${gregorianDate} / ${hijriFormatted}`,
   applied identically to the desktop `<td>` and the mobile `.mobile-day-date`.
2. **"remove the imsak time and show the syuruk time"** — header `Imsak`
   column → `Syuruk` (repositioned right after Subuh); desktop row + mobile
   card now use `prayer.syuruk` / `formatTime(syurukTimestamp)`; deleted the
   now-dead `calculateImsak()` helper entirely. Grepped first to confirm the
   only remaining "Imsak" references in the file are unrelated share-text
   strings (`"Jadual Waktu Imsak, Subuh dan Berbuka..."`) — deliberately left
   untouched.

`CACHE_NAME` bumped twice more for these (final: **v1.6.7**).

### State of the world going into next session
- `index.html` schedule table columns are now: **Tarikh & Hari** (showing
  `(day) gregorian / hijri`), **Subuh**, **Syuruk**, Zohor, Asar, Maghrib,
  Isyak — Imsak is GONE from the table (only survives in the unrelated
  share-text strings, deliberately untouched).
- `sw.js` `CACHE_NAME` is at **`v1.6.7`** — bump again for ANY further edit to
  `index.html`/`info.html`/`widget.html`/favicons/manifest.
- `updatePrayerWidgetFrame()`'s iframe `src` is now environment-aware
  (prod hostname `/(^|\.)mamtj6\.com$/` → production widget URL; everything
  else → relative `widget.html`). If "dev.mamtj6.com refused to connect"
  resurfaces, check in this order: (a) is this a NEW origin missing from
  `vercel.json`'s `frame-ancestors`, or (b) stale SW cache.
- **OPEN/UNFINISHED**: there's an approved plan
  (`C:\Users\EYM LAPPY\.claude\plans\tingly-swimming-hellman.md`) for a
  `widget.html` fix — `.info-side .prayer-label` needs `white-space: nowrap`
  (~line 173-177) so the icon doesn't float with a gap when "Subuh esok"
  wraps to 2 lines on narrow viewports. **NOT applied this session** — queued
  for next, single CSS-property edit, low risk, remember to bump
  `CACHE_NAME` again if/when it lands.
- Doc touch-ups (`CLAUDE.md`/`developer.md`/`README.md` CACHE_NAME version
  refs, removed `calculateImsak()` row from `developer.md`, removed "Imsak"
  from `README.md`'s displayed-times list) were done as part of THIS
  handoff, not a separate user ask.

### Mood
Fast, low-friction, "fix the thing, move on" — six small asks, zero plan
mode, two cache-debugging detours that resolved via DevTools, not code. If
the next session opens with "still not showing" on anything in
`waktu-solat/`, lead with the SW-cache question before re-reading code.

---

## Vibe / dynamic check for Session 9 (read next)

A **short, reflective, meta session** — zero feature work, zero code edits.
Two asks, both about documentation hygiene, both low-ceremony. Energy: calm,
"housekeeping day" — a nice contrast to Session 8's three-act marathon.

### Ask 1 — doc comparison question (no edits)
"compare `waktu-solat/developer.md`, `jadual-waktu/README.md`, which is
better for updating documentation... also for your 'brain' which is better,
`jadual-waktu/CLAUDE.md` or `waktu-solat/DEV_NOTES.md`?"

Answered directly (no plan mode needed — pure discussion):
- `developer.md` > `README.md` for dev reference (API shapes, function sigs,
  changelog vs. Malay end-user marketing copy)
- `CLAUDE.md` (stable architecture map) and `DEV_NOTES.md` (session-to-session
  continuity/vibe log) are COMPLEMENTARY, not competing — but for "my brain"
  specifically, `DEV_NOTES.md` wins because it captures *why* and *what we
  were mid-thought about*, not just *what the code does*.
- Flagged a gap: `waktu-solat/` has no folder-specific `CLAUDE.md` of its
  own — it was inheriting the root one (which is for the WHOLE multimedia
  repo... wait, no — re-check this, see "discovery" below).

### Ask 2 — "run /init for waktu-solat folder" → led to a real discovery
This is the interesting part. Going in, I expected `/init` to be a "create if
missing" task. Instead: **`waktu-solat/CLAUDE.md` already existed (4549
bytes), but it was describing a COMPLETELY DIFFERENT, OLDER PROJECT** — it
read like `jadual-waktu/CLAUDE.md` (table-based schedule, countdown timer,
zone dropdown — the "v1.5.4 jadual-waktu" app), not the current
`index.html`/`info.html`/`widget.html` trio that Sessions 1-8 have been
building.

Same staleness pattern showed up in `waktu-solat/developer.md` and
`jadual-waktu/README.md` too — all three read like leftover copies from an
earlier project iteration that never got updated when `waktu-solat/` evolved
into its current three-entry-point shape. **Lesson for next-you**: if a
`CLAUDE.md`/`developer.md`/`README.md` in this repo describes a table-based
schedule with a 5-minute orange warning pulse and `PRAYER_ICONS`/"INFO HARI
INI" cards — that's the OLD jadual-waktu shape, not what's currently in
`waktu-solat/`. Don't trust file content just because the path looks
project-specific; verify against the actual `.html` files or `DEV_NOTES.md`.

**Process**: treated `/init` as a real (if small) planning task — entered
plan mode, ran ONE Explore agent to survey all of `waktu-solat/`'s current
files (`index.html`, `info.html`, `widget.html`, `sw.js`, `vercel.json`,
`archive/`, `test/`) since I didn't have full code for `index.html`/`info.html`
in context, only summaries. The Explore agent's report was thorough and
accurate — confirmed `index.html` iframes `widget.html` via
`updatePrayerWidgetFrame()`, confirmed `info.html`'s de-branding stuck,
confirmed `sw.js` CACHE_NAME is still `mamtj6-jadual-waktu-ramadan-v1.6.4`
(cosmetic leftover, not a bug). Wrote a plan outline (reused/overwrote the
`ethereal-knitting-sparkle.md` plan file again — same file has now hosted 2
unrelated plans across sessions, that's fine, it's scratch space), system
auto-exited plan mode (no explicit ExitPlanMode call — Write to the plan file
triggered it), then wrote the new `CLAUDE.md` directly.

**New `waktu-solat/CLAUDE.md` shape** (for reference, don't re-derive):
- Project Overview: year-round (not Ramadan-specific despite `sw.js` naming),
  three entry points
- Per-file sections for `index.html`, `info.html`, `widget.html`, `sw.js`,
  `vercel.json`, `archive/`, `test/`
- `widget.html` section deliberately kept HIGH-LEVEL and points to
  `DEV_NOTES.md` for depth — avoid duplicating the deep pulse-animation/arc-
  geometry details here, that's `DEV_NOTES.md`'s job
- Flagged `test/test_file.html` as an unrelated leftover (Mimbar Jumaat sermon
  page) — noted, not removed, don't touch without asking
- "Known issues" section now also notes `developer.md`/`README.md`/`vercel.json`
  /`sw.js` naming as stale-but-cosmetic cleanup candidates

**State of the world going into next session**:
- `waktu-solat/CLAUDE.md` is now ACCURATE and current as of 2026-06-14.
- `waktu-solat/developer.md` and `jadual-waktu/README.md` are STILL STALE
  (describe the old jadual-waktu app) — explicitly out of scope for this
  session, flagged for a future "/init" or doc-refresh pass if the user asks.
- No code changed. If the next session opens expecting Session 8's pulsing-
  warning feature to need more tweaks, that thread is still exactly where
  Session 8 left it (DONE, no open items) — this session was a pure detour
  into doc hygiene, not a continuation of that work.
- **Mood**: relaxed, curatorial. If the next ask is another "compare/explain/
  tidy up docs" question, that fits this session's groove — don't over-plan
  small doc questions, answer directly like Ask 1. If it's back to
  `widget.html`/`index.html` feature work, that's a context switch back to
  Session 8's energy (iterative, tweak-by-tweak, expect AskUserQuestion for
  ambiguous bits only).

---

## Vibe / dynamic check for Session 8 (read next)

A **three-act session**, each act a different working mode — good example of
"match ceremony to the ask, not to the file."

### Act 1 — quick explainer, zero edits (`index.html`)
User asked why changing `.prayer-widget-embed`'s `aspect-ratio` from `480/300`
to `500/300` made the embed shorter. Explained the math (height = width ÷
first-ratio-number for a fixed width; raising the first number shrinks height)
— confirmed the live value (`550/300`) was already what the user wanted, no
code change needed. **Lesson carried forward**: not every "why did X happen"
needs a diff — sometimes the answer is "the value's already correct, here's
why it behaves that way."

### Act 2 — infaq section consultation → full redesign (`index.html`)
User opened with the now-familiar consultation pattern: "the infaq section
seems so empty... check if my approach is good... ask me questions... do not
generate answer unless I allow it." This took several rounds:

1. AskUserQuestion clarified: donation QR (DuitNow/TnG), user has the QR
   asset, wants "same content, just better spaced."
2. User supplied a **QuickChart.io QR URL** (DuitNow EMV payload + embedded
   MAMTJ6 logo via `centerImageUrl`/`centerImageSizeRatio`) — added as
   `.infaq-qr` image.
3. Quick follow-up: added a subtitle line ("Imbas DuitNow Qr atau lihat...")
   and renamed the button to "MAMTJ6 Infaq Center" with a "Klik Di Sini"
   sub-line.
4. **Then the big one** — a long, structured UX/copywriting brief asking to
   shift the whole section from "high-pressure transactional" to "low-pressure
   invitation-based": softer shadows/gradients, muted palette, Malay copy with
   "Jazakumullah Khairan", device-aware QR (desktop shows QR, mobile shows
   button only via `@media (min-width: 601px)`), trust line instead of a
   logo badge (no DuitNow asset exists in repo, so went with plain text:
   "Disahkan oleh Masjid Al-Mukhlisin Taman Jaya 6 (MAMTJ6) · DuitNow QR").
   User picked **"Variation C" copy (smallest diff)** + the desktop-QR/mobile-
   button split + softened button shadow/gradient + the trust line, all in one
   "ok proceed" combo-approval. Final `.infaq-section` bg went `#fff` →
   `#f9faf9`, shadow `0 2px 6px rgba(0,0,0,0.1)` → `0 1px 4px rgba(0,0,0,0.05)`.
   **Pattern to remember**: when a user gives a long structured brief with
   explicit "Variation A/B/C" style options, they're inviting you to propose
   a combination — "ok proceed [combo]" means implement exactly that
   combination, don't re-litigate the brief.

### Act 3 — `info.html` de-branding (plan mode)
"tell your plan to improve the info page for waktu solat. remove anything
related to ramadan" → AskUserQuestion clarified scope = "Full de-branding"
with replacement term **"Jadual Waktu Solat"**. Plan mode produced an 11-point
plan (title, apple-mobile-web-app-title, OG meta, `<h1>`, "Tentang Projek"
paragraphs, infaq paragraphs, "Pautan Berkaitan" link text — 7 Edit calls
total). Deliberately left untouched: Imsak/Subuh/Berbuka terminology (core
feature labels, not branding) and `og:image`/`og:url` (live hosting paths,
infra not display). User said "ok proceed" to the full plan, no further
iteration needed — all 7 edits landed clean.

### Act 4 — the main event: pulsing "last 10 minutes" warning (`widget.html`)
This was the **iterative refinement** act — each round was a one-line ask,
landed fast, then refined further. Re-entered plan mode (overwrote the old
stale `?date=hide` plan from a prior session — that feature was already
shipped, confirmed via grep before discarding the plan).

**Final shipped behavior** (all in `widget.html`):
- When `diff <= 10*60*1000` (10 min to next prayer), `tick()` sets
  `isWarning = true` each second.
- **Countdown** (`#countdown`): gets `.warning` class → `color: var(--error)`
  + `@keyframes pulse-warning` (opacity 1 ↔ 0.4, 1s loop). **NOTE**: went
  through 3 iterations here — (1) first shipped as color+scale+opacity pulse,
  (2) user said "remove the pulse big small, color only" → stripped to flat
  color change, (3) user then said "make it pulse alternate opacity" → added
  back JUST the opacity keyframe (no `transform: scale`). **Net effect: color
  change + opacity pulse, NO size/scale change** — if you see `transform:
  scale` reappear in `.countdown-display.warning`, that's a regression to (1),
  remove it.
- **Next-prayer dot**: new `#pulseRingNext` circle (added in `buildArcSvg()`,
  only for the `isNext` dot), stroked in the new `THEME.errorRgb`
  (`220,38,38` light / `255,80,80` dark — matches `--error` CSS var). Hidden
  by default (`display:none`), shown by `tick()` when `isWarning`.
- **Current-prayer dot**: its existing gold `#pulseRing` is now HIDDEN
  (`display:none`) during the warning window — `tick()` toggles both rings
  opposite to each other. The dot itself KEEPS its static gold-stroke/white-
  fill "current" styling — only the animated ring disappears. Rationale (user
  confirmed via AskUserQuestion): during the last 10 min, focus should shift
  entirely to the upcoming prayer; two simultaneous pulsing rings was clutter.
- `startPulseAnimation()`'s rAF loop now drives BOTH rings' `r`/`opacity`, but
  skips updating either one while `style.display === 'none'` (small perf/
  correctness guard, mirrors how visibility is controlled).

**Energy for Act 4**: very "vibe-coding" — tiny asks, immediate small edits,
no AskUserQuestion needed for the first two iterations (color-only, then
opacity-pulse) because they were unambiguous one-liners. AskUserQuestion came
back only for the LAST ask (current-dot pulse removal) because it had two real
design branches (keep static styling vs. revert to neutral, instant vs. fade)
— both answered "Recommended" option, both implemented as the safe/simple
choice. **Lesson**: for a feature built through many small follow-up tweaks,
expect 2-3 more rounds of "actually, change X slightly" — don't over-engineer
the first pass, keep it easy to tweak (e.g. plain CSS color, not baked into JS).

**State of the world going into next session**:
- The 10-minute warning system is considered DONE for the "next prayer has a
  dot on today's arc" case. The "Subuh esok" edge case (post-Isyak, next
  prayer is tomorrow's Subuh — no dot exists on today's arc) is EXPLICITLY
  OUT OF SCOPE per user — in that case only the countdown pulses, no dot
  effect, and that's accepted as-is, not a bug.
- `index.html`'s infaq section redesign (Variation C + QR/button split +
  trust line) is considered DONE — no open threads.
- `info.html` de-branding (Ramadan 2026 → Jadual Waktu Solat) is DONE, all 7
  edits landed.
- Known issues list (color theming, GPS auto-detection) from earlier sessions
  — UNCHANGED, still untouched.

---

## Vibe / dynamic check for Session 7 (most recent — read this first)

This was a **"zoom out to the bigger page" session** — after Sessions 1-6 polished
`widget.html` itself (arc, icons, embed mode, theming) to the point the user
declared it basically done, this session's energy was "ok, now go use it." Three
asks, each one a step further from `widget.html` in isolation:

1. **Opened with a verbal status check, not a question**: "i think major
   development already complete for the widget.html ... my next plan is to
   include the widget.html as embeded on the index.html .. the zone selector
   that used on the page will still works, but it will change the link path
   ?zone= according what user want. i think the existing INFO HARI INI card will
   be removed" — this read as half-decision, half-thinking-out-loud. Treated it
   as a plan-mode trigger (structural, multi-file, touches both HTML structure
   and a lot of dead-code removal). Good call — there WERE real open questions
   buried in "i think", surfaced via AskUserQuestion:
   - Whether the Countdown Section (timer + progress bar) should ALSO go, not
     just "INFO HARI INI" → user said **"Remove both (Recommended)"**.
   - How the embedded `widget.html`'s OWN internal zone selector should behave
     when nested inside `index.html` (which has its own selector) → user gave a
     **free-text answer with reasoning**, not just a preset pick: "hide it on
     embeded mode if had ?selector=hide to hide the zone selector. because the
     widget.html will be used on elsewhere" — i.e. don't piggyback on `?embed=1`,
     make a NEW independent opt-in param, because `widget.html` standalone
     embeds (Google Sites etc.) still want their own selector visible.
   This second answer is the kind of thing to re-read carefully — it's a small
   sentence carrying a real architectural constraint (separation of `?embed=1`
   vs `?selector=hide`), and it came with the "why" already attached.

2. **Plan executed cleanly, no surprises**: added `?selector=hide` +
   `.hide-selector` CSS to `widget.html`; gutted `index.html`'s INFO HARI INI +
   Countdown Section (HTML/CSS/JS — a LOT of dead code: `globalPrayerTimes`,
   `lastMaghrib`, `startCountdown`, `highlightNextPrayer`, `setupCountdown`, the
   60s transition-checker `setInterval`, the whole next-month fetch that only
   existed to feed tomorrow's countdown); replaced with a `.prayer-widget-embed`
   iframe wrapper pointing at `widget.html?embed=1&selector=hide&zone=...`, wired
   to `#zone-select`'s existing change handler + GPS detection + initial load via
   one new `updatePrayerWidgetFrame(zoneCode)` helper. Kept `isToday()` and
   `calculateImsak()` — still drive the schedule table's "today" row and Imsak
   column. Verified via Node `new Function()` syntax-check on extracted
   `<script>` blocks (no Playwright/browser tool available in this env — checked
   via ToolSearch, confirmed absent, didn't fight it, just used what's available).

3. **Then two quick, low-ceremony polish asks** — back to the Session 5-style
   "just do it" energy after the plan-mode chunk landed:
   - "if the zone selector is hidden, make the date text centered" → one CSS
     rule: `body.hide-selector .top-bar { justify-content: center; }`. Because
     `.top-bar` is `justify-content: space-between` with two children
     (`.location-bar` + `.footer-bar`), hiding the first child via
     `display:none` leaves the date pinned to one side under `space-between` —
     centering the row is the fix, not touching `.footer-bar` itself.
   - **"this index.html not tied with ramadan, chang all text that related with
     ramadan (title etc)"** — a de-branding pass. Grepped for `Ramadan`, found it
     in `<title>`, `apple-mobile-web-app-title`, OG/Twitter meta, `<h1>`, and the
     infaq description ("Program Ihya' Ramadan..."), PLUS a Hijri-month-names
     array (`"Ramadan", "Syawal", ...`) — **that last one is a real calendar month
     name, NOT branding, left untouched**. Asked ONE clarifying question (via
     AskUserQuestion) specifically about the infaq text, because it names an
     actual program — user said **"Generalize it"**, so it became a plain
     "support the masjid" message instead of "Program Ihya' Ramadan". Deliberately
     did NOT touch `og:url`/`og:image` (`ramadan.mamtj6.com/...` paths) — those
     are real hosting URLs from the root CLAUDE.md, not display branding; changing
     them is an infra decision, out of scope for a "fix the text" ask.

**Energy**: this session felt like the project graduating from "polish one
widget" to "assemble the page out of widgets" — bigger diffs (lots of dead-code
deletion) but LOW anxiety, because the plan was approved upfront and each removal
was clearly justified by the embed replacing it. The two tail asks were classic
Session-5-style one-liners — don't over-think small CSS/text asks just because
they come right after a big structural plan; match ceremony to ambiguity, not to
recency of a big task.

**State of the world going into next session**:
- `index.html` no longer has its own countdown/progress-bar/info-card — that's
  ALL delegated to the embedded `widget.html` iframe now. If asked to change
  countdown/progress-bar behavior, the edit almost certainly belongs in
  `widget.html`, not `index.html`.
- `index.html` is de-branded from "Ramadan 2026" → generic "Jadual Waktu Solat".
  If you see "Ramadan" reappear in a future ask for `index.html`, that's likely
  intentional/new context, not a regression to "fix back".
- `widget.html` now has THREE url params controlling its chrome:
  `?embed=1` (transparent page bg + scale-to-fit, for Google Sites),
  `?selector=hide` (hide its own zone dropdown, independent of embed),
  `?zone=`/`?testTime=`/`?testDate=` (existing). `index.html`'s iframe passes
  `embed=1&selector=hide&zone=<code>` + `testTime` passthrough.
- `.prayer-widget-embed` container uses `aspect-ratio: 480/300` — flagged as
  "refine during verification" in the plan, never actually visually verified
  (no browser tool). If the embedded widget looks clipped/has dead space in
  `index.html`, start here.
- Known issues list for `widget.html` itself (color theming, GPS auto-detection)
  is UNCHANGED — still sitting there, still valid candidates for "next big ask",
  but as ever, just read what's thrown at you.

---

## Vibe / dynamic check for Session 6 (read this next)

This was the **embed-mode polish session** — a direct continuation of Session 4's
`?embed=1` feature, but it turned out Session 4's embed CSS was only "good enough
on desktop." The whole session was a chain of "looks fine here, but..." discoveries,
each one peeling back a layer:

1. User: "the prevent-scroll works perfectly, but the embedded width is not wide
   enough" — opened with a working baseline + one specific complaint. Recreated
   `embed_test.html` as a 360x400 red-bordered iframe test harness (this file is
   throwaway/scratch — expect it to keep getting hand-edited by the user between
   sessions, don't be surprised by odd dimensions or stale `<p>` text in it).
2. Fixed width-fill with an **iterative widen-then-scale algorithm** in
   `scaleEmbedToFit()` + `transform-origin: top left` (was `top center`). This is
   the kind of fix that *sounds* overengineered for a one-file widget but isn't —
   the math (geometric convergence, `Hc > Wc/3` condition) is real and documented
   in the new guide file (see below). Don't simplify it back to a single-pass
   `Math.min()` scale — that's literally the bug that was just fixed.
3. User then hit confusing intermediate states: "why is the red box tall, and
   editing the iframe height does nothing?" — turned out to be (a) a CSS typo
   (`height: 400x` — invalid unit, Edit D) and (b) plain browser caching (told
   user to hard-refresh). **Lesson**: when the user says "I edited X and nothing
   happened" on a local static file, caching is the first suspect, not logic.
4. The big one: user sent **two screenshots** (desktop vs. mobile, live on
   `ramadan.mamtj6.com` via Google Sites) — desktop embed "works great", mobile
   embed was narrow and left-aligned. Root cause: `max-width: 100%` on
   `body.embed-mode .widget` was silently clamping the JS's intentional
   over-widening (`widget.style.width = containerWidth/scale` when `scale < 1`).
   Desktop never triggers `scale < 1` (so the cap never binds, bug invisible
   there) — **mobile-aspect iframes (short relative to width) are what expose
   this class of bug.** Fixed with `max-width: none`. THIS WAS THE LAST EDIT —
   applied but not yet re-verified by the user when the summary was written.
5. Session continued past that point (per the user's final message: "the
   embedded functionality is working now") — so **the `max-width: none` fix is
   CONFIRMED WORKING**. Embed mode for `widget.html` is now considered done.
6. Final ask of the session: write up everything learned as a standalone guide —
   `waktu-solat/gsites_embeded_guide.md` was created, covering the embed pattern,
   the scale-to-fit algorithm + convergence math, the max-width trap, and a
   comparison with `test_file.html`'s simpler centered `scaleToFit()`. **If you're
   ever asked to embed ANOTHER widget into Google Sites, read that guide FIRST**
   — it's written specifically to prevent re-deriving this session's discoveries.

**Energy**: investigative, screenshot-driven debugging — the user is good at
spotting "this looks subtly wrong" from screenshots and handing you the visual
evidence; trust those screenshots over "the code looks right to me." Low-ceremony
otherwise — direct fixes, no big plan-mode ceremony needed except for the final
"write a guide" ask (which only needed plan mode because of the
write-outside-plan-file restriction, not because the task itself was ambiguous).

**State of the world going into next session**: embed mode is DONE and CONFIRMED.
Known issues list (color theming, GPS auto-detection) is unchanged — still the
two most likely "next big ask" candidates, but as always, just read what's thrown
at you.

---

## Vibe / dynamic check for Session 5 (previous)

Short, punchy session — three asks, each smaller/different in shape than the last,
all landed clean. Same low-ceremony energy as Session 3, plus one good "look at the
screenshot, find the REAL bug" moment.

**Opened with closure**: user said "both are working now" (re: Session 3's two open
items — top-bar layout and the Syuruk-highlight edge case). Both verified live by
user, no further action — just removed from the known-issues list. Good reminder:
when the user confirms something works, trust it and move the known-issue off the
list immediately, don't ask "are you sure" or re-verify yourself.

**Then escalating asks**:
1. "explain" (selected the "progress arc tip indicator" known-issue line) → gave a
   plain-language explanation of what a "playhead" dot is (a glowing dot tracking
   "now" along the arc, distinct from the fixed prayer-time dots). User: "ok add it" —
   implemented immediately, zero further discussion.
2. "make the halo smaller" → one-line tweak (`r="7"` → `r="5"`), done in seconds.
3. "Responsive / embed mode" (the last known-issue item) — user explicitly invoked
   **plan mode** for this one (first time on this project). Went through full
   Explore → AskUserQuestion (clarified scope: BOTH `?embed=1` chrome-strip AND
   320px-width responsiveness; target 320px not 280px) → Plan agent → approved
   plan → implementation. Plan mode earned its keep here because the ask had real
   unresolved design questions ("what does 'embed' even mean for THIS widget?").
   Contrast with asks #1-2 above, which needed zero ceremony — match the ceremony
   to the ambiguity, not to the size of the diff.

**Then a live bug, handled well**: user pasted a real `ramadan.mamtj6.com` URL with
`?zone=PHG03&?embed=1` (note the double `?`) and said "the embeded still not work".
First instinct was the malformed URL — and that WAS technically broken (`?embed`
becomes a literal param key, not `embed`, so `params.get('embed')` returned null).
But the user then sent a **screenshot** showing the real problem: with the correct
param, embed mode kicked in but the ENTIRE widget went invisible except a pink pin
emoji and one black-filled dot, floating on white. Root cause: embed mode had set
`.widget`'s background to `transparent`, but every label/stroke/icon in this widget
is white-on-`#161b22` — on a white host page that's white-on-white. Fixed by keeping
`.widget`'s own dark card background in embed mode; only the page-level chrome
(shadow/radius/max-width/centering) gets stripped, not the card's own background.

**Key lesson for next-you**: this widget's entire visual language assumes a dark
card. "Transparent embed" for a white-on-dark widget means "transparent PAGE,
opaque CARD" — not "transparent everything". If known-issue #1 (color theming /
light variant) ever gets picked up, that's the moment to revisit whether embed mode
should offer a true transparent/light option too — right now it can't, by design.

**Process note**: for the screenshot bug, the fix was verified by actually
re-screenshotting via a throwaway Playwright script (launched a local http.server,
loaded `?embed=1&testTime=18:30` at 400x400, screenshotted on a white page) before
declaring it fixed — don't skip the "look at a fresh screenshot" step for visual bugs,
a code-level "this should work now" isn't enough when the bug WAS visual.

**Energy**: terse, confirmatory, low-ceremony — same as Session 3. State what changed,
invite testing, don't over-explain. Known issues list is down to just 2 items now
(color theming, GPS auto-detection) — this widget is close to "done" for now; next
session is more likely to be a fresh visual nitpick or the color-theming item than
a big structural ask, but don't assume — just read what they throw at you.

---

## What this file is

A standalone widget that:
- Fetches today's prayer times for a user-selected zone (default `PHG03`)
- Draws a quadratic bezier arc in SVG with 6 prayer dots (Subuh → Syuruk → Zohor → Asar → Maghrib → Isyak)
- Shows time labels and prayer name labels under each dot
- Displays a live countdown timer and info bar (current prayer / next prayer), each with a Material Symbols icon
- Recognizes a 7th "virtual" period — **Waktu Duha** — as a label-only state (no arc dot)
- Progress bar arc grows from Subuh to current time as the day advances
- Current prayer dot pulses with a ripple ring animation (rAF-based) — **except Syuruk**, which never gets "current" highlight styling
- Zone selector dropdown (grouped by state, compact when closed, full detail when open)
- Top bar: zone selector (left) + Gregorian/Hijri date (right), single row

---

## Current arc geometry constants (VERIFY IN FILE — past sessions had edit discrepancies)

```js
const ARC_W      = 360;      // SVG coordinate width
const ARC_PAD_X  = 20;
const DOT_PAD_X  = ARC_PAD_X; // = 20
const ARC_TOP_Y  = 14;
const ARC_BOT_Y  = 70;
const CTRL_Y     = 2 * ARC_TOP_Y - ARC_BOT_Y; // = -42
const VIEW_H     = 120;
```

Arc path: `M 20,70 Q 180,-42 340,70`

**Critical invariant:** `CTRL_Y = 2*ARC_TOP_Y - ARC_BOT_Y` MUST hold so that `arcY(x)` matches the actual bezier path exactly.

---

## Key functions

```js
timeToX(tsMs)         // maps prayer Unix-ms timestamp → SVG x (DOT_PAD_X to ARC_W-DOT_PAD_X)
arcY(x)               // maps SVG x → y position on the bezier arc
progressArcPath(t)    // de Casteljau bezier split at t∈[0,1]; returns SVG path string for elapsed portion
startPulseAnimation() // rAF loop: animates #pulseRing r (6→17) and opacity (0.7→0) over 1800ms
buildArcSvg()         // builds entire SVG; returns { svg, currentIdx, displayCurrentIdx, nextIdx }
renderArc()           // inserts SVG into DOM, starts pulse, starts countdown tick(), sets icons + currentName/Duha logic
tick()                // runs every second: updates countdown display + advances #progressArc path
getNow()              // returns Date.now() + timeOffset (supports ?testTime=/?testDate= URL params)
sizeSelect()          // resizes #zoneSelect to fit compact text exactly (canvas measurement + 32px padding)
loadZones()           // fetches zones API, builds grouped dropdown, wires focus/blur/change handlers
getSavedZone()        // reads ?zone= URL param → localStorage('selectedZone') → 'PHG03'
saveZone(code)        // writes to localStorage + updates ?zone= in URL (no reload)
fetchPrayerTimes()    // fetches API data, computes duhaStart/duhaEnd, builds dateText (Gregorian + Hijri)
```

---

## Session 3 changes (this session)

### 1. Material Symbols icons (replaced Unicode glyphs ☽☼☀☾)
Loaded via:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0&display=block" rel="stylesheet" />
```
`.info-side .icon` CSS:
```css
.info-side .icon {
  font-family: 'Material Symbols Rounded';
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  font-size: 1.2rem;
  line-height: 1;
}
```
Icon spans now hold ligature text (`bedtime`, `sunny`, etc.) instead of Unicode chars.

`PRAYER_ICONS` map (around line 358):
```js
const PRAYER_ICONS = {
  Subuh:   'wb_twilight_2',
  Syuruk:  'wb_twilight',
  Duha:    'wb_twilight',
  Zohor:   'sunny',
  Asar:    'partly_cloudy_day',
  Maghrib: 'wb_twilight',
  Isyak:   'bedtime',
};
```

### 2. Syuruk never gets "current" highlight on arc
Single-line change in `buildArcSvg()` (~line 488):
```js
const isCurrent = i === displayCurrentIdx && prayer.name !== 'Syuruk';
```
This one boolean drives pulse ring, dot radius (6 vs 4), fill/stroke color, and label
weight/opacity for ALL nodes — so excluding Syuruk here is sufficient, no other
branches needed touching.

### 3. Hijri date display (ported from widget.html)
- Added `HIJRI_MONTH_NAMES` lookup (Muharram...Zulhijjah, keyed by `'01'`-`'12'`) right
  after `PRAYER_ICONS` (~line 368).
- `todayPrayer.hijri` from the waktusolat API is already `"YYYY-MM-DD"` — no extra
  fetch needed, and it automatically respects `?testDate=`/`?testTime=` since
  `todayPrayer` lookup is offset-aware via `getNow()`.
- In `fetchPrayerTimes()` (~line 694-697):
```js
const [hijriYear, hijriMonth, hijriDay] = todayPrayer.hijri.split('-');
const hijriMonthName = HIJRI_MONTH_NAMES[hijriMonth];

document.getElementById('dateText').textContent =
  `${days[now.getDay()]}, ${day} ${months[month - 1]} ${year} / ${parseInt(hijriDay, 10)} ${hijriMonthName} ${hijriYear}H`;
```
Result example: `"Khamis, 11 Jun 2026 / 15 Zulhijjah 1447H"`. Year format confirmed
by user as `1447H` (with "H" suffix, no space).

### 4. Top-bar layout restructure (zone selector + date, same row)
Combined what used to be a centered `.location-bar` and a separate bottom
`.footer-bar` into one `.top-bar` flex row at the very top of `.widget`:

```css
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 14px;
}
.location-bar {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.4px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.footer-bar {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
}
```

```html
<div class="top-bar">
  <div class="location-bar">
    <span>📍</span>
    <select id="zoneSelect"><option value="">Memuat zon...</option></select>
  </div>
  <div class="footer-bar" id="footerBar" style="display:none">
    <span id="dateText">—</span>
  </div>
</div>

<div id="arcContainer">
```

The old standalone bottom `.footer-bar` block (after `.info-bar`) was REMOVED —
`#footerBar`/`#dateText` now live only in the top row.
`document.getElementById('footerBar').style.display = 'flex'` in JS still works fine
(it's now just a single-span wrapper inside the flex `.top-bar`, the `flex` display
on a non-flex-parent context is harmless).

Decision: zone selector LEFT, date info RIGHT — confirmed by user (closed zone
selector shows only "State - ZONE", so it's short; no overflow concern).

**STATUS: confirmed working by user in Session 4** — no further action needed.

---

## Session 4 changes (this session)

### 1. Progress arc "tip" indicator (playhead dot)
New helper near `progressArcPath`:
```js
// Point on the arc at progress t (clamped [0,1]) — used to place the progress tip indicator.
function arcPointAtT(rawT) {
  const t = Math.max(0, Math.min(1, rawT));
  const x = ARC_PAD_X + (ARC_W - 2 * ARC_PAD_X) * t;
  return { x, y: arcY(x) };
}
```
In `buildArcSvg()`, two circles added right after `#progressArc`:
- `#progressTipGlow` — halo, `r="5"` (started at `7`, user asked to shrink), `fill="rgba(255,255,255,0.25)"`
- `#progressTip` — dot, `r="3"`, `fill="#ffffff"`

Both positioned via `arcPointAtT(initT)` on initial build. In `tick()`, both are
re-positioned every second alongside `#progressArc`, using
`arcPointAtT(rawT < 0 ? 1 : rawT)` (same clamping as `progressArcPath`).

### 2. Embed mode (`?embed=1`) + 320px responsive breakpoint
New IIFE after `initTestTime`:
```js
(function initEmbedMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('embed') === '1') {
    document.body.classList.add('embed-mode');
  }
})();
```

CSS:
```css
body.embed-mode {
  background: transparent;
  display: block;
  justify-content: initial;
  align-items: initial;
  min-height: 0;
  padding: 0;
}

body.embed-mode .widget {
  /* deliberately NO background override — widget keeps its #161b22 card bg.
     Every label/icon/stroke is white-on-dark; a transparent card on a white
     host page becomes invisible. "Embed" = transparent PAGE, opaque CARD. */
  border-radius: 0;
  box-shadow: none;
  max-width: 100%;
  width: 100%;
  min-height: 100%;
}
```

Plus a `@media (max-width: 360px)` block: shrinks `.widget` padding (22/20/16 →
16/12/12), reduces `.top-bar`/`.info-bar` gaps and font-sizes, and removes
`.info-side { min-width: 60px }` so `.countdown-block` (flex:1) keeps display
priority. The SVG arc itself needed NO changes — `viewBox="0 0 360 120"` scaling
means geometry, label offsets, and the `< 50`-unit collision thresholds are all
scale-invariant.

**Usage**: `widget.html?embed=1`, or combined e.g.
`widget.html?zone=JHR01&embed=1&testTime=18:30`.
**Gotcha**: correct syntax is `&embed=1` — NOT `&?embed=1` (a stray second `?`
makes `?embed` part of the param NAME, so `params.get('embed')` returns `null`).

---

## Session 6 changes (this session) — embed mode polish, now DONE

Builds on Session 4's `?embed=1`. Full writeup with diagrams/math in the new
**`waktu-solat/gsites_embeded_guide.md`** — read that first if revisiting embed
behavior. Summary of code changes:

### 1. `body.embed-mode .widget` CSS — two changes from Session 4
```css
body.embed-mode .widget {
  border-radius: 0;
  box-shadow: none;
  max-width: none;          /* was: max-width: 100% — this clamped the JS's
                                intentional over-widening, see #2 below */
  width: 100%;
  min-height: 100%;
  transform-origin: top left; /* was: top center (default) */
}
```

### 2. `scaleEmbedToFit()` — new function, called on render + resize
Shrinks `.widget` via `transform: scale()` so it fits the iframe height with no
scroll, AND fills the iframe width with no side margins (previously it would
shrink-and-center, leaving gaps). Iteratively widens the widget before scaling
down so the post-scale result lands exactly at `containerWidth`:
```js
function scaleEmbedToFit() {
  if (!document.body.classList.contains('embed-mode')) return;
  const widget = document.querySelector('.widget');
  const containerWidth = window.innerWidth;
  const containerHeight = window.innerHeight;

  let scale = 1;
  for (let i = 0; i < 5; i++) {
    widget.style.transform = 'none';
    widget.style.width = (containerWidth / scale) + 'px';
    const naturalHeight = widget.offsetHeight;
    const next = Math.min(1, containerHeight / naturalHeight);
    if (Math.abs(next - scale) < 0.005) { scale = next; break; }
    scale = next;
  }

  widget.style.transform = `scale(${scale})`;
}
```
Called at the end of `renderArc()` and on `window.resize` (registered inside
`initEmbedMode()`'s IIFE, only when `embed=1`).

### 3. New test harness: `waktu-solat/embed_test.html`
Throwaway scratch file — a single `<iframe src="widget.html?embed=1&testTime=18:30">`
in a red-bordered box. Dimensions get hand-edited by the user for different test
cases (desktop-aspect vs. mobile-aspect). Expect it to be in an inconsistent state
between sessions (e.g. stale `<p>` text describing old dimensions) — that's normal,
not a bug to fix unless asked.

### 4. New reference doc: `waktu-solat/gsites_embeded_guide.md`
Standalone guide for embedding ANY widget into Google Sites — the `?embed=1`
pattern, the scale-to-fit algorithm + why it converges, the `max-width` trap, and
the testing checklist (always test a mobile-aspect iframe, not just desktop).

**STATUS: confirmed working by user — "the embedded functionality is working
now". Embed mode for `widget.html` is done.**

---

## Carried over from Session 2 (still current)

### Waktu Duha (label-only, no arc dot)
```js
let duhaStart = null, duhaEnd = null;
// in fetchPrayerTimes():
duhaStart = todayPrayer.syuruk ? (todayPrayer.syuruk + 28 * 60) * 1000 : null;
duhaEnd   = todayPrayer.dhuhr  ? (todayPrayer.dhuhr  - 10 * 60) * 1000 : null;

// in renderArc():
const inDuha = duhaStart && duhaEnd && now >= duhaStart && now < duhaEnd;
const currentName = inDuha ? 'Duha' : (currentIdx >= 0 ? prayerList[currentIdx].name : 'Isyak');
if (inDuha) {
  currentTimeText = `${fmt24(duhaStart)}-${fmt24(duhaEnd)}`;
}
```
Duha = 28 min after Syuruk until 10 min before Zohor. Never enters `prayerList`, so
arc dots/positions are completely unaffected — purely an info-bar label override.

### Zone selector — API field names (IMPORTANT — wrong names caused "undefined" bug)
```
z.jakimCode  → zone code (e.g. "PHG03")
z.negeri     → state name (e.g. "Pahang")
z.daerah     → district (e.g. "Temerloh, Jerantut, Lipis, Raub, Cameron Highlands, Gua Musang")
```
NOT `z.state`, NOT `z.zone` — those return undefined.

### Compact/full display pattern
- **Closed:** `opt.dataset.compact = "${z.negeri} - ${z.jakimCode}"` e.g. `Pahang - PHG03`
- **Open:** `opt.dataset.full = "${z.jakimCode} — ${z.daerah}"` e.g. `PHG03 — Temerloh, Jerantut, Lipis`
- `focus` listener → restore all to `.dataset.full`
- `blur` listener → compact selected, full for rest; then call `sizeSelect()`
- `change` listener → compact selected immediately; then call `sizeSelect()`

### sizeSelect() — canvas-based width sizing
```js
const _sizeCanvas = document.createElement('canvas');
const _sizeCtx    = _sizeCanvas.getContext('2d');
function sizeSelect() {
  const sel = document.getElementById('zoneSelect');
  if (!sel) return;
  const text = sel.options[sel.selectedIndex]?.textContent || '';
  _sizeCtx.font = '11px Inter, system-ui, sans-serif';
  sel.style.width = (Math.ceil(_sizeCtx.measureText(text).width) + 32) + 'px';
}
```
The `+32` is intentional padding.

### #zoneSelect CSS
```css
appearance: none;
-webkit-appearance: none;  /* removes native browser arrow — eliminates trailing space */
background: transparent;
border: none;
color: rgba(255, 255, 255, 0.55);
font-size: 11px;
padding: 0;
/* NO max-width — width is set dynamically by sizeSelect() */
```

### Zone selector initialization
```js
currentZone = getSavedZone();
Promise.all([loadZones(), fetchPrayerTimes()]);
```
Both run in parallel — prayer data doesn't wait for the zone list to populate.

---

## ?testTime= / ?testDate= URL parameters (Session 1/2)

```js
let timeOffset = 0;

(function initTestTime() {
  const params = new URLSearchParams(window.location.search);
  const testTime = params.get('testTime');
  if (!testTime) return;
  const today = new Date();
  const [h, m] = testTime.split(':').map(Number);
  today.setHours(h, m, 0, 0);
  timeOffset = today.getTime() - Date.now();
})();

function getNow() { return Date.now() + timeOffset; }
```

All `Date.now()` calls in `buildArcSvg()`, `tick()`, and `fetchPrayerTimes()` use
`getNow()` instead. `fetchPrayerTimes()` uses `new Date(getNow())` to determine which
month's data to fetch and to find `todayPrayer`.

**Usage:**
```
widget.html?testTime=05:00          → before Subuh (progress arc full, Isyak pulsing)
widget.html?testTime=09:30          → in Duha window (after Syuruk+28min, before Zohor-10min)
widget.html?testTime=13:00          → Zohor time
widget.html?testTime=18:30          → near Maghrib
widget.html?zone=JHR01&testTime=18:30
widget.html?embed=1                 → strips page chrome (transparent bg, no card/shadow) for iframe embedding
```

---

## Architecture decisions from Session 1 (still current)

### Label collision fix
Syuruk/Subuh cluster left, Maghrib/Isyak cluster right (~27 SVG units apart). Arc
natural geometry (endpoints at y=70, inner dots at y≈53) gives ~17px vertical
separation. Only horizontal text-anchor divergence needed:
- `isCloseToPrev` → anchor `'start'`
- `isCloseToNext` → anchor `'end'`
- Subuh: anchor `'start'`, labelX `x - 10`
- Isyak: anchor `'end'`, labelX `x + 10`

**AVOID yBump** — it was tried and caused Syuruk labels to land at the same y as Subuh
(yBump=18 exactly cancelled the 17px natural gap).

### Progress arc (de Casteljau)
```js
const rawT = (now - fajr) / (isha - fajr);
// Post-midnight fix: rawT < 0 before today's Subuh → show full arc (all done)
progressArcPath(rawT < 0 ? 1 : rawT)
```

### currentIdx vs displayCurrentIdx
```js
// currentIdx = -1 before Subuh
const displayCurrentIdx = currentIdx >= 0 ? currentIdx : prayerList.length - 1;
// Before Subuh: Isyak dot pulses (not Subuh), isNext suppressed
const isNext = i === nextIdx && currentIdx >= 0;
```
NOTE: with the Session 3 Syuruk-exclusion change, if `displayCurrentIdx` ever points
at Syuruk's index, `isCurrent` will now be `false` for that node — verify this doesn't
leave NO node highlighted in edge cases (e.g. right at Syuruk time). Not yet tested
live; flag if user reports "no dot is highlighted" during Syuruk's time window.

### Pulse animation
CSS transform and SMIL both failed. Uses `requestAnimationFrame` directly setting `r`
and `opacity` on `#pulseRing`. Stops when element is removed (on re-render).

---

## Current visual spec

| Layer | stroke | stroke-width | opacity |
|---|---|---|---|
| Background arc (full) | white | 2 | 0.15 |
| Progress arc (elapsed) | white | 4 | 0.85 |
| Current dot | white | 2.5 | fill = #161b22 |
| Pulse ring | white | 1.5 | 0.7→0 animated |
| Past dot | white | 1.5 | fill 0.15, stroke 0.4 |
| Next dot | white | 1.5 | fill 0.95 |
| Future dot | white | 1.5 | fill 0.5 |

Label: `timeOffset = r + 13`, `nameOffset = timeOffset + 11`

---

## Known issues / things NOT yet done

1. **Color theming** — arc is all white on dark; warm gold/amber for progress arc
   might look better.
2. **GPS auto-detection** — not implemented in this widget (the main `jadual-waktu/`
   app has it). Could be added.

---

## User style notes

- Works iteratively, tests live with `?testTime=`/`?testDate=` in browser
- Prefers direct changes without lengthy explanation; terse, lowercase messages
- For structural/ambiguous changes: asks for clarifying Qs + plan confirmation first
- For cosmetic/small changes: just do it, report briefly, invite testing feedback
- Malay prayer time names: Subuh, Syuruk, Duha, Zohor, Asar, Maghrib, Isyak
- Dark theme: `#161b22` background, white text/strokes
- No frameworks, no build step — pure vanilla JS/HTML/CSS
- Language preference in UI: Malay (`lang="ms"`)
