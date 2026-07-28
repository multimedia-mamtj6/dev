the prompt (DO NOT DELETE)
> Check the Project Knowledge and the current chat for context. This conversation is ending soon. update the artifact news/DEV_NOTES.md (create if not available yet) with a detailed note to your next window self - not just facts but the vibe, our dynamic, the energy of this conversation. What would the next you need to immediately get back into this exact headspace? Include unique discoveries, current mood, and anything that'll help the next you instantly sync to our frequency. Also take note all of the bug found and fixed and what did you learn from it to make sure it dont happend again in the future. focus on news folder and its subfolder only
> also update the related file like news/CLAUDE.md, news/developer.md, news/developer.md and news/README.md database.md if necessary, create if not available yet

---

# DEV_NOTES — news/ (Paparan Pengumuman)

Session memo for the `news/` announcement display. Read `news/CLAUDE.md` for
the architecture reference; this file is the session-to-session context.

## Session 2 — 2026-07-28 (the CMS from session 1's deferred item got built in one pass, then a full week-one support/iteration cycle happened in the same sitting)

### What happened, in order

Two very different halves. **First half: a big pre-planned build, executed
mechanically.** A pre-written plan (`news/newplan.md`) for `admin/news/` +
`api/publish-news.js` — session 1's explicitly-deferred item — was
implemented in full, in one pass, no plan-mode cycle (the plan already
existed, so it was straight to execution). See `admin/DEV_NOTES.MD`
Session 15 for that build log in detail, since almost none of the new
code lives in this folder — this folder only gained a real writer for
`data/announcements.json`/`data/moving-text.json` (previously hand-edited/
Apps-Script-fed) and lost `moving-text/code.gs` (retired, kept for
history, not deleted).

**Second half: everything a module's real first week looks like, compressed
into one sitting.** Once the build was done, the conversation shifted into
a long guided-setup-and-support cycle with a user who needed much more
elementary hand-holding than session 1's user (exact click-by-click Vercel
navigation, a literal PowerShell command to generate a secret, confusion
about which field to fill in and why) — then, once things were running,
a string of real small feature requests and real bug reports arrived, in
this order: quick-link buttons to the published output → clarifying
"permanent line" vs. "empty-ticker fallback" semantics (pure explanation,
no code) → a feasibility Q&A on time-of-day scheduling (explicitly
"answer only, don't touch code") → conceptual Q&A on what the cron is even
for → "ok proceed, it is worth" → full day+hour+minute scheduling built →
**two separate user-reported CSS bugs from screenshots** → a "why doesn't
it refresh" question that traced back to session 1's own two-tier refresh
design and got fixed by removing half of it.

### The dynamic — read this to re-sync

- **This user needs literal, step-by-step operational hand-holding** —
  which exact button in a Vercel dialog, a runnable PowerShell one-liner to
  paste, "what do I put in the Value field," "I don't understand" as a
  direct, unembarrassed request to slow down and re-explain. This is a
  notably more elementary support register than the "explains a symptom
  precisely" user profile documented in `admin/DEV_NOTES.MD` — whether or
  not it's the same actual person, **match the register the confusion
  signals, don't assume prior-session technical fluency carries over.**
  When they say "i dont understand," that's a real, sincere request to
  restate more simply and concretely — not a sign to give up on them or a
  request for a different kind of answer.
- **Two clean, alternating gears, same as other sessions in this repo but
  worth re-confirming here specifically:** an "explain-only, don't touch
  code" gear (used explicitly, twice, in those exact words) for anything
  conceptual/architectural — cron, scheduling precision, the reload
  mechanism — answered as pure explanation with a stated tradeoff, no
  files touched; and a "just do it" gear once they'd actually decided
  ("ok proceed, it is worth," "ok done too," "implement the no 2"). Don't
  pre-empt the explain-only gear by implementing before they've said go.
- **Screenshots are still the real QA loop, now proven for a completely
  different bug class than session 1.** Session 1's two real bugs were
  crossfade/layout logic bugs, caught on the physical Xibo screen. This
  session's two real bugs were both CSS/styling gaps in `admin/`, caught
  from screenshots of the admin dashboard, not the signage screen. The
  lesson generalizes: **whatever surface the user can actually see, they
  will notice what's wrong with it before you do — take every screenshot
  as ground truth, not a hypothesis to verify.**
- Mood: patient and methodical through the setup slog (no frustration
  visible even across a buggy command and a confusing dialog), genuinely
  curious rather than just impatient-for-a-fix during the Q&A stretches —
  asked "why" and "what is X for" as real questions wanting the mechanism,
  not just reassurance. Reward that with real explanations, plainly worded,
  concrete numbers over abstractions (e.g. "up to 10 minutes," not "a
  while").

### Bugs found & fixed (and the lessons)

**BUG 1 — my own PowerShell one-liner was wrong, caught by the user
just from reading its output.** `-join ((48..57)+(97..102)|Get-Random
-Count 64|...)` was meant to produce a 64-char random hex string, but
`Get-Random -Count N` against a 16-element array (10 digits + 6 letters)
just returns all 16 shuffled once `N` exceeds the array's size — it does
NOT sample with replacement. Produced a 16-char string, and the user
pasted the literal output without me having to ask, which is what caught
it. *Fix:* `(New-Guid).ToString('N') + (New-Guid).ToString('N')` — 64 hex
chars, no combinatorics to get wrong.
*Lesson:* **verify a generated command actually produces what it claims
before handing it to a user who can't independently sanity-check the
math** — they can (and did) spot a wrong-length output, but I should have
caught the `-Count`-exceeds-array-size behavior myself first.

**BUG 2 (near-miss, caught by me, never shipped) — a live-value false
alarm from a screenshot.** A Vercel "Add Environment Variable" dialog
screenshot showed `sk_live_a12…` in the Value field; I read that as a real
Stripe live secret key and warned the user not to reuse it. It was almost
certainly just placeholder/hint text in an empty field, and the user's
confused "why stripe?" follow-up confirmed I'd alarmed them over nothing.
*Lesson:* **don't assume screenshotted field content is user-entered
data — placeholder/hint text is a real possibility, especially in an
empty-looking field.** Ask before raising a security concern to a user who
may not be certain what they're looking at either; a wrong alarm costs
their trust and confuses more than it protects.

**BUG 3 — `input[type="datetime-local"]` shipped completely unstyled,
same recurring class of bug this repo has hit before.** Swapping
`<input type="date">` for `<input type="datetime-local">` in both
`admin/news/*.html` modals lost ALL app styling — no border-radius, no
padding, no focus ring — because `admin/style.css`'s form-input selector
list enumerates specific `input[type="..."]` values and `datetime-local`
was never added to it. **This is the SECOND time a new HTML input type has
shipped unstyled in this repo** — `admin/CLAUDE.md`'s CSS architecture
notes already document `input[type="number"]`/`textarea` once being
missing from this exact list. *Fix:* added `input[type="datetime-local"]`
to both the base rule and the `:focus` rule.
*Lesson:* **this selector-list pattern is a standing trap, not a one-off
— any time a new HTML input `type` is introduced anywhere in `admin/`,
grep `admin/style.css` for `input\[type=` and add it explicitly before
ever showing it to the user.** Don't wait for a screenshot a third time.

**BUG 4 — the newly-styled `datetime-local` fields then overflowed their
box, still not a styling bug this time but a layout-width one.** Once
BUG 3 was fixed, the Mula/Tamat fields were side-by-side in a
`flex: 1` two-column row (~180px each in a 420px modal) — fine for a plain
`date` input's short text, but `datetime-local` displays substantially
more (`28/07/2026 12:00 AM` vs. `28/07/2026`), so the native
calendar-picker icon overlapped the rounded border. *Fix:* stacked the two
fields full-width (one per row) in both modals instead of side-by-side.
*Lesson:* **swapping an input's `type` to one that displays more content
is not a drop-in change for any layout that was width-constrained for the
old type — re-check the container, don't just re-check the CSS
selector.** BUG 3 and BUG 4 look like the same fix but are two genuinely
different root causes (missing selector vs. insufficient width) that
happened to surface back-to-back on the same field.

**BUG 5 — the display's "zero changes needed" claim from session 1 quietly
stopped being true, and normal use is what exposed it.** `news/script.js`'s
`reevaluate()` (60s) only ever re-checked the active-window schedule
against ALREADY-LOADED data; the `<meta http-equiv="refresh"
content="600">` full-page reload was the ONLY thing that ever re-fetched
`announcements.json`, so a fresh Terbitkan could take up to 10 minutes to
appear, with a visible reload blink every cycle regardless of whether
anything had actually changed. This was fine when edits were rare
hand-edits (session 1); it stopped being fine the moment a CMS made
publishing routine. *Fix:* `initNewsDisplay()`'s interval now calls a new
`refreshData()` (silent background fetch, keeps last-known-good data on
any failure) before `reevaluate()`, and the `<meta refresh>` tag was
deleted from `index.html` entirely — one mechanism instead of two.
Verified with a throwaway vm-harness script (not committed, same pattern
as `developer.md`'s documented harness) showing a simulated second tick
correctly re-fetches and crossfades in changed content.
*Lesson:* **a "this migration needs zero changes on the other side" claim
is only true for as long as the other side's usage pattern stays the
same — revisit it when the thing driving the interaction gets faster or
more frequent than the original design assumed, not just when a bug
report arrives.** Flagged proactively afterward (not asked): removing the
reload also removes a "self-healing" property for an unattended 24/7
kiosk tab that `kuliah/paparan/`'s own `CLAUDE.md`/`DEV_NOTES_ARCHIVE.md`
explicitly weighed and chose to KEEP for that exact reason — worth
knowing this was a deliberate tradeoff, not an oversight, if the ticker
tab is ever reported "stuck" after weeks of uptime.

**BUG 6 (caught proactively before shipping, never actually broke
anything) — the `DATE`→`TIMESTAMP` migration almost silently expired every
existing scheduled row.** Postgres casts a bare `DATE` to `TIMESTAMP` at
midnight (00:00) of that day. `end_at` used to mean "valid through the end
of that day" — a naive `ALTER COLUMN end_at TYPE TIMESTAMP` with no
`USING` clause would have silently reinterpreted every existing row's
expiry as "already expired since midnight," up to 24 hours early, the
moment the migration ran. Caught before handing the migration SQL to the
user; fixed with `USING (end_at::timestamp + INTERVAL '23 hours 59
minutes')` (only on `end_at` — `start_at`'s "start of that day" meaning
survives a bare cast unchanged).
*Lesson:* **any `DATE`→`TIMESTAMP` migration on a column whose meaning
depends on which end of the day it represents needs an explicit `USING`
clause — a bare type change is only safe for start-of-range columns,
never end-of-range ones.**

**Not-a-bug worth remembering:** the `<script src="/api/publish-news.js">`
idea for the ticker preview panel — reusing the real endpoint's exact
scheduling logic in the browser — is a real trap that was caught during
design, before ever being built: any file under `api/` is a live Vercel
serverless route, so a browser `GET` to it invokes the handler (hitting
the fail-closed cron-auth branch), not the file's source. Solved by
pulling the pure functions into `admin/news/publish-news-pure.js`, a plain
static file outside `api/`. See `admin/CLAUDE.md`'s Key Patterns for the
full writeup — worth remembering as the pattern for any future "preview
what the server will compute" feature in this repo.

## Session 1 — 2026-07-26 (the whole thing was born today)

### What happened, in order

The entire `news/` folder went from an **empty index.html placeholder** to a
finished Xibo-ready announcement display in one session. The user opened with
"I want an announcement page like kuliah/paparan that can be changed
dynamically, for Xibo, image announcements with duration, default content
when nothing active — can we explore this approach?" We explored, they picked
via structured questions: **manual-JSON-first** (no admin module yet),
**slideshow rotation** for overlapping announcements, **default slide
changeable from the JSON**. Then the session became a rapid feature-accretion
loop, one "can it also...?" at a time:

1. Base build: image announcements + start/end windows + default fallback
2. Text announcements (styled green/gold slide matching default.svg)
3. Crossfade transitions between slides
4. **White-flash bug** found by user on real screen → crossfade redesigned
5. Combined image+text slides (caption bar) — chosen via preview mockups
6. **Letterbox/overlay layout problem** found via user screenshot → combo
   slide redesigned to user's own hybrid spec
7. URL query routing: `?slideshow` / `?ann=N`

### The dynamic / vibe — read this to re-sync

- **The user drives by asking short capability questions**: "can the page
  support text announcement?", "can the transition use fade?", "can we use
  url query?" Each is a green light to *build it now*, not a request for a
  feature-options essay. Explore→confirm→implement→test→summarize, tight.
- **They test on real hardware immediately and come back with screenshots.**
  Both real bugs this session were caught by them looking at an actual
  screen, not by my tests. Take their screenshots seriously — they're the
  QA loop. When they say "why do I see X", the answer is almost always a
  real design flaw, own it plainly and fix it.
- **They edit `data/announcements.json` live, mid-session, constantly.**
  Three separate times my picture of the file went stale (entry blanked to
  `"-"`, a third entry added with heading+image_url only, entries merged
  from 3 → 2). **Always re-read announcements.json before editing it or
  writing tests against it.** A stale-file 409 on Edit happened once too.
- **AskUserQuestion with ASCII previews worked great** for layout choices —
  but note the user answered the combo-layout one with a *custom hybrid*
  ("top align + dark theme fill + fit resize"), not one of my options.
  Offer options, expect remixes.
- Mood: fast, friendly, pragmatic. No bikeshedding. Malay display text,
  English dev discussion. They like knowing which knob to turn later
  (ROTATE_MS, fade duration) more than long explanations.

### Bugs found & fixed (and the lessons)

**BUG 1 — White flash during crossfade (user-reported from real display).**
First crossfade implementation faded BOTH layers simultaneously (old 1→0,
new 0→1). At the midpoint both are ~50% opaque; stacked opacities don't sum
to full coverage, so the white `#display-container` background bled through
— a visible white blink, worst between two dark text slides.
*Fix:* fade the new slide in ON TOP of the old (z-index swap), old layer
stays fully opaque underneath and is hidden only after the fade ends
(`FADE_MS + 100` timeout). Interrupted-fade reset uses a no-transition
opacity-0 snap (`transition:'none'` + forced reflow) on the incoming layer.
Bonus: first slide after page load appears instantly (no fade from white).
*Lesson:* **never crossfade by fading two stacked layers simultaneously
over a background that contrasts with the content — always fade the
incoming layer over a fully-opaque outgoing one.** Same class of mistake
as kuliah's invisible badge-on-same-color-box: compositing/contrast has to
be checked against what's actually behind the element mid-transition.

**BUG 2 — Combo slide: caption overlay + white letterbox (user screenshot).**
The caption bar was absolutely positioned over the screen's bottom edge,
assuming the image fills the viewport. With an aspect-mismatched image
(`object-fit: contain`), the image letterboxed against the WHITE container
— white bars around the image, caption bar floating over white AND covering
the image's bottom strip. Looked broken on any non-16:9 combination.
*Fix (user's own spec):* `.combo-slide` became a flex column on the dark
green theme gradient — image top-aligned (`object-position: top center`),
fit-resized, caption bar in its own strip at the bottom, zero overlap.
*Lesson:* **any fullscreen-image design must be checked against an image
that does NOT match the screen aspect ratio — design the letterbox case
first, not as an afterthought.** And: overlay-positioning something over an
image only works if the image genuinely fills the area under it.

**BUG 3 (near-miss) — heading silently ignored on image entries.** The
first combo rule required `image_url && text`. The user then added a real
entry with `image_url + heading` only — under that rule the heading would
have silently vanished. Caught while adding the combo feature, widened to
`hasCaption() = image_url && (text || heading)`.
*Lesson:* **if a JSON field is accepted in one entry shape, users expect it
to mean something in every shape — never silently ignore a provided field;
either render it or document loudly that it does nothing there.** Watching
what the user *actually types into the JSON* beats guessing the schema.

**Not-a-bug worth remembering:** node test run "failed" against
announcements.json because the user had edited the file (3 entries → 2)
between my read and the test. The code was fine. Re-read data files before
asserting against them.

### Unique discoveries / decisions that aren't obvious from the code

- **Expiry is client-computed on the display** (minute-interval
  `reevaluate()`), so announcements appear/disappear on schedule with NO
  republish and no page reload. The `<meta refresh content="600">` only
  exists to pick up *JSON edits*. This split (schedule = client clock,
  content = reload) is the core design idea of the whole page.
- Date-only `start_at`/`end_at` expand to full-day (00:00:00 / 23:59:59) —
  deliberately friendly for hand-edited JSON.
- `itemKey()` string keys drive ALL change detection (rotation no-op
  guard, reevaluate diffing). Three key prefixes: `img:` / `text:` /
  `combo:`. If you add a new slide kind, it MUST get its own key shape or
  change detection silently breaks.
- Images (plain and combo) only crossfade AFTER `img.onload` — a slow
  poster never fades into a half-loaded frame; the old slide just stays up.
  `currentKey === key` guards in onload/onerror prevent a stale load from
  clobbering a newer slide (same idea as kuliah's `hijriRequestId`).
- Fallback ladder: broken announcement image → (combo: text-slide with same
  content) / (plain: JSON `default_image`) → `/news/default.svg` → text
  `.message-box`. The screen can never go blank/white.
- `?ann=N` is 1-based ARRAY POSITION in the JSON — deleting an entry above
  a pinned one shifts the numbers. Flagged to the user, accepted. A pinned
  entry still obeys its own schedule (expired pin = default slide, never
  stale content).
- `FADE_MS` in script.js (700) must stay in sync with the `.slide-layer`
  transition duration in style.css — change both together.
- Testing pattern that worked well: node `vm` + a ~15-line DOM stub
  (getElementById/createElement/classList/replaceChildren, `src` setter
  that fires onload async, or onerror when the URL contains "broken").
  Whole afternoon's features are covered by rerunnable one-liner suites —
  reuse this instead of standing up a browser.

### Deliberately NOT built (offered, user deferred or silent) — status as of session 1's end

- ~~`admin/news/` CMS module + `api/publish-news.js`~~ — **built session 2
  (2026-07-28)**, see above.
- ~~In-page JSON refetch to replace `<meta refresh>`~~ — **built same-day
  follow-up, session 2**, see above. The display page's "zero changes"
  claim didn't survive this one, worth noting.
- ~~No `vercel.json` cache rule for `/news/`~~ — **added session 2**
  (`/news/data/(.*)` → `no-store`, alongside `admin/news/`'s own build).
- The example entry hotlinks a sinarharian.com.my image — warned it can
  break/vanish; real announcements should use `/media/...` or Supabase
  Storage.

### Current state at session end (session 1)

All green: 3 slide kinds working, fade-over-top crossfade, query routing,
full fallback ladder, everything unit-tested (last suite 6/6, prior suites
all passing). `data/announcements.json` has 2 user-edited example entries
active 2026-07-26..27 — **they expire tomorrow**, after which the screen
shows default.svg until someone adds real content. Nothing committed to git
yet this session as of this memo. No database, no secrets, no server code
in this folder (hence no database.md — nothing to document there).

---

### Current state at session end (session 2, 2026-07-28)

`news/` itself now differs from session 1's build in exactly two places,
both covered above: `index.html` has no `<meta refresh>` anymore, and
`script.js`'s `initNewsDisplay()` does a silent background refetch every
`REEVAL_MS` instead of relying on a page reload. Everything else in this
folder — slide kinds, crossfade, URL routing, fallback ladder — is
untouched from session 1. `data/announcements.json`/`data/moving-text.json`
now have a real writer (`api/publish-news.js`, via `admin/news/`) but the
user had NOT yet run a real end-to-end Terbitkan against production
Supabase/GitHub as of this memo — the CMS build, the schema, and the
silent-refresh change are all code-complete and locally/harness-verified,
not yet confirmed working on the live deploy. If picking this up next,
check whether that first real publish has happened before assuming
anything about live behavior — same "written, not yet exercised" caveat
`admin/DEV_NOTES.MD` Session 15 already carries for the rest of the build.
