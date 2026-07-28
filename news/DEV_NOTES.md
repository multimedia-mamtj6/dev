the prompt (DO NOT DELETE)
> Check the Project Knowledge and the current chat for context. This conversation is ending soon. update the artifact news/DEV_NOTES.md (create if not available yet) with a detailed note to your next window self - not just facts but the vibe, our dynamic, the energy of this conversation. What would the next you need to immediately get back into this exact headspace? Include unique discoveries, current mood, and anything that'll help the next you instantly sync to our frequency. Also take note all of the bug found and fixed and what did you learn from it to make sure it dont happend again in the future. focus on news folder and its subfolder only
> also update the related file like news/CLAUDE.md, news/developer.md, news/developer.md and news/README.md database.md if necessary, create if not available yet

---

# DEV_NOTES — news/ (Paparan Pengumuman)

Session memo for the `news/` announcement display. Read `news/CLAUDE.md` for
the architecture reference; this file is the session-to-session context.

## Session 2 — 2026-07-28 (the CMS from session 1's deferred item got built — but in `admin/`, not here)

Session 1 ended by flagging `admin/news/` + `api/publish-news.js` as
explicitly deferred future work. Two days later, a pre-written plan
(`news/newplan.md`) for exactly that was implemented in full — see
`admin/DEV_NOTES.MD` Session 15 for the actual build log, since almost
none of the new code lives in this folder. **What changed in `news/`
itself: nothing in `index.html`/`script.js`/`style.css`, exactly as
session 1 designed it to.** The only things that changed here are
`data/announcements.json` and `data/moving-text.json` gaining a real
writer (previously hand-edited/Apps-Script-fed, now written by
`api/publish-news.js`), and `moving-text/code.gs` being retired (superseded,
not deleted — kept for history). If you're back in this folder wondering
why a display bug doesn't reproduce with hand-edited JSON, check whether
it's actually a publish-endpoint problem now (`admin/CLAUDE.md`/
`admin/database.md`/`admin/developer.md`) before assuming it's this
folder's own logic — the failure surface split in two.

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

### Deliberately NOT built (offered, user deferred or silent)

- `admin/news/` CMS module + `api/publish-news.js` (Supabase → GitHub JSON,
  infaq-publish shape). Explicitly chosen as "later" — display page needs
  ZERO changes when it comes.
- In-page JSON refetch to replace `<meta refresh>` (would remove the
  10-minute reload blink on the TV). Offered, no answer yet.
- No `vercel.json` cache rule for `/news/` — announcements.json rides the
  default caching + `?v=` cache-buster. If stale-JSON complaints appear,
  that's the first place to look.
- The example entry hotlinks a sinarharian.com.my image — warned it can
  break/vanish; real announcements should use `/media/...` or Supabase
  Storage.

### Current state at session end

All green: 3 slide kinds working, fade-over-top crossfade, query routing,
full fallback ladder, everything unit-tested (last suite 6/6, prior suites
all passing). `data/announcements.json` has 2 user-edited example entries
active 2026-07-26..27 — **they expire tomorrow**, after which the screen
shows default.svg until someone adds real content. Nothing committed to git
yet this session as of this memo. No database, no secrets, no server code
in this folder (hence no database.md — nothing to document there).
