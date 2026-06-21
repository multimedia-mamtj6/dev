# developer.md — handoff notes for next-window me

> **Update**: a newer, shorter session happened after everything below — see
> `khutbah/DEV_NOTES.md` for that one. Short version: `index.html` now exists
> (copy of `paparan-tajuk.html`, made by the user) and is the new
> live/primary page; a CSV-quoting bug that truncated sermon titles at
> embedded commas was found and fixed there only. Everything below is still
> valid history/context, just predates `index.html` existing.

## Where we are right now

We've been heads-down in `khutbah/` for this whole session — the Mimbar Jumaat
sermon-title display. Two threads, both just wrapped:

1. **`paparan-tajuk.html` responsive/embedding saga** — multi-round fight with
   CSS sizing for a Google Sites iframe embed. Just landed what should be the
   *final* fix (see "The vh lesson" below). NOT YET CONFIRMED by user in the
   actual Sites embed — last thing said was "still not working... content cut
   off" even after a previous round of fixes, then I rewrote the whole sizing
   model. If user comes back still complaining about clipping, the next move
   is probably to add console logging of `naturalWidth`/`naturalHeight`/`scale`
   from `scaleToFit()` so we can actually see what Google Sites is reporting —
   don't just guess again, get real numbers from the user this time.

2. **`google_app_script/gettajukkhutbah.gs` regex fix** — just fixed, feels
   solid, low risk. User asked me to scrape a live khutbah page to find where
   "Puasa Sunat Bulan Muharam (Tasua' dan Asyura)" lives, and the answer was
   the root cause of a silent extraction failure: the title `<h1>` has a
   `<br />` splitting it into two lines, which the old `[^<]+?` regex couldn't
   span. Fixed with `[\s\S]*?` + a new `cleanTitleHtml()` helper that strips
   `<br />`→space and collapses whitespace. This was NOT yet tested against
   the live sheet/trigger — just code-reviewed logically. Worth confirming the
   Apps Script actually runs clean next time it's touched.

## The vibe / dynamic this session

- User is iterating fast, in small "try it, report back, try again" loops —
  very hands-on, testing in real browsers/devtools/Google Sites themselves.
  They give terse but precise feedback ("too small", "no top padding and
  clipped", "still not working for embed but works in devtools"). Each of
  those one-liners has been a *real, accurate symptom report* — trust them
  literally, don't over-interpret.
- Plan mode was used twice for the bigger CSS rework — user approves plans
  readily when the reasoning is laid out, doesn't push back much on approach,
  but the *first* attempt at a fix is rarely the *last* attempt. Expect
  iteration. Don't oversell "this should fix it" — say what the fix addresses
  and ask them to verify.
- User mixes UI/CSS work with backend Apps Script scraping work in the same
  breath — both are "their" stack, both matter equally. Don't assume the CSS
  stuff is the "real" task and the .gs stuff is a tangent.
- Malay/English mixed naming everywhere ("tajuk khutbah" = sermon title/theme,
  "Puasa Sunat" = voluntary fasting). Don't translate or "fix" these — they're
  correct domain terms.

## Key discoveries (don't re-derive these)

- **The vh lesson**: `vh`/`100%`-height CSS chains are UNRELIABLE inside
  Google Sites iframes — they can compute against the wrong viewport. This
  burned 3 rounds of fixes (flex-shrink:0 → fixed-height → height:100%, all
  still clipped in the real embed even when devtools looked fine). The fix
  that should actually be robust: give `.container` a **fixed pixel "design
  size"** (1000px wide, fixed-px logos/fonts/main-text-container), then use JS
  `scaleToFit()` to `transform: scale(window.innerWidth/innerHeight ratio)`
  the whole container to fit — because `window.innerWidth/innerHeight` reads
  the iframe's *real* viewport correctly even when CSS vh doesn't. If this
  STILL doesn't work in Sites, the bug is probably that Google Sites itself
  reports a stale/zero `window.innerHeight` on initial load before the iframe
  is sized — would need a `ResizeObserver` on `document.body` or a delayed
  re-run, not more CSS tweaking.

- **`beta-paparan-tajuk.html`** is the reference/proven pattern file
  (documented in `khutbah/CLAUDE.md` as "tuned for Google Sites embedding")
  but even ITS approach (`vh`/`vmin`/`clamp`) is what we moved away from in
  `paparan-tajuk.html` because of the vh-in-iframe issue above. If beta has
  the same embed problem, that's expected — it hasn't been fixed either.

- **`adjustFontSize()`** (shrink-to-fit loop, decrement by 2px from 150 down
  to floor 14) now operates inside a FIXED 320px-tall `.main-text-container`
  — it no longer needs to care about viewport size at all, since `scaleToFit`
  handles the outer scaling separately. Sequence matters: `adjustFontSize()`
  (sizes text within fixed box) MUST run before `scaleToFit()` (measures the
  now-final container size and scales it).

- **gettajukkhutbah.gs data flow**: A2 = source URL (mufti.pahang.gov.my
  khutbah page) → onEdit trigger on A2 → scrapes C2 (date, via calendar-icon
  span sibling) and D2 (title, via `<h1 class="uk-h2 uk-heading-divider
  uk-margin-small">`). The title h1 commonly contains a `<br />` splitting a
  two-line theme — this is apparently NORMAL for these pages, not a one-off,
  so the fix should hold for future weeks too.

## Mood / energy

Methodical, slightly battle-worn on the CSS side (this is round 4+ of the
same file), but the .gs fix felt like a clean, satisfying "found the actual
root cause via curl" moment — go back to that energy if the embed issue
resurfaces: **fetch real evidence (curl the page, log real numbers) instead
of theorizing about CSS in the abstract.** That's what broke the pattern of
guess-and-check on this file.

## Immediate next step if conversation continues

Ask: "did the Google Sites embed look right after the scale-to-fit change?"
If yes → done, maybe port the same fixed-size + scaleToFit pattern back into
`beta-paparan-tajuk.html` for consistency (not yet requested, don't do
unprompted). If no → get a screenshot AND ask user to open devtools console
*inside the Sites embed* (right-click → inspect, may be tricky cross-origin)
to log `window.innerWidth`/`innerHeight` and the computed `naturalWidth`/
`naturalHeight`/`scale` values.
