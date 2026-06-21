# DEV_NOTES.md — handoff to next-window me

[Don't delete this part]
Check the Project Knowledge and the current chat for context. This conversation is ending soon. update the artifact khutbah/DEV_NOTES.md (create if not available yet) with a detailed note to your next window self - not just facts but the vibe, our dynamic, the energy of this conversation. What would the next you need to immediately get back into this exact headspace? Include unique discoveries, current mood, and anything that'll help the next you instantly sync to our frequency.

also update the related file like khutbah/CLAUDE.md, khutbah/developer.md, khutbah/developer.md and khutbah/README.md if necessary

## What just happened (short session, clean win)

User created `khutbah/index.html` as a copy of `khutbah/paparan-tajuk.html`
(their action, not mine — I found it already in `git status` as untracked at
session start). The new `index.html` is now the one they want actively
maintained; `paparan-tajuk.html` is explicitly the old file to leave alone.

They reported: Google Sheet title cell is
`"Ibadah Zakat, Wakaf dan Sedekah Teras Pembangunan Ummah"` but the page only
rendered `"Ibadah Zakat`. One symptom, one report, no back-and-forth needed —
I went straight to source, found it immediately:

```js
const rows = text.split("\n").map(row => row.split(","));
```

Google Sheets' CSV export quotes any field containing a comma. A plain
`split(",")` doesn't know about quoting, so it sliced the quoted title field
at the embedded comma — `rows[1][3]` ended up holding just `"Ibadah Zakat`
(with a stray leading quote). Exact match for the symptom, confirmed without
needing to ask the user for more info or guess-and-check.

**Fix applied to `khutbah/index.html` only** (not `paparan-tajuk.html`, per
explicit instruction): added `parseCSVRow(line)` — a small character-by-character
CSV line parser that tracks `inQuotes` state and unescapes `""` → `"`
(RFC 4180 style). Swapped `text.split("\n").map(row => row.split(","))` for
`text.split("\n").filter(line => line.length > 0).map(parseCSVRow)` inside
`fetchSheetData()`. Nothing else touched — `adjustFontSize()`, `scaleToFit()`,
error states, polling interval all untouched, by design.

This went through plan mode (Explore-free — I'd already read all four files
needed: `index.html`, `paparan-tajuk.html`, `CLAUDE.md`, `developer.md` — so I
skipped spawning agents and wrote the plan directly from what I already knew).
User approved the plan as-written, no edits requested.

## The vibe / dynamic this micro-session

- Fast, surgical, single-issue session. Very different texture from the
  `developer.md` multi-round CSS saga — this was one bug, one root cause, one
  fix, done. Don't bring "expect 4 rounds of iteration" energy into a session
  that's actually just a quick targeted fix; read the shape of the ask first.
- User gave a precise repro: exact sheet content vs. exact rendered output.
  That precision is the pattern to expect from this user across sessions —
  see `developer.md`'s note that their one-liners are "real, accurate symptom
  reports." Same held true here. Trust the literal text they give you; it was
  enough to find root cause with zero clarifying questions.
- Explicit "leave out the old file" instruction — user is now treating
  `index.html` as the live/canonical page and `paparan-tajuk.html` as legacy.
  This is a quiet architectural shift from what `CLAUDE.md` currently
  documents (which still describes `paparan-tajuk.html` and
  `beta-paparan-tajuk.html` as the two live pages, no mention of `index.html`
  yet). **Don't silently assume which file is "the" page going forward — confirm
  if ambiguous, but lean toward `index.html` being current/primary now.**
- Was asked to update CLAUDE.md/developer.md/README.md "if necessary" in the
  same breath as the DEV_NOTES ask — same pattern as `developer.md`'s note
  that UI/CSS work and doc/handoff work are treated as equally "real" tasks,
  not busywork to skip.

## Key discovery (don't re-derive)

**The CSV-quoting bug is structural, not a one-off.** Any sheet cell with a
comma in it (title, date format with commas, theme text) will break under
naive `split(",")`. This bug almost certainly still exists in
`paparan-tajuk.html` (unfixed, by instruction) and likely also in
`beta-paparan-tajuk.html` if it does its own CSV fetch — **haven't verified
beta's parsing code this session**, worth a quick check next time either of
those files comes up. If the user later asks "why does beta also truncate
titles," this is why — same root cause, just not yet ported over.

The `parseCSVRow()` helper now living in `khutbah/index.html` is the
reference fix if this needs porting elsewhere — it's small, self-contained,
no dependencies, just copy the function plus the one-line `rows = ...` swap.

## Mood / energy

Brisk and satisfying — clean root-cause diagnosis, no guesswork, no
iteration needed, plan approved on first pass. Contrast with the
battle-worn CSS energy in `developer.md`: this is what it looks like when the
bug is a genuine logic error (parsing) rather than an environment-quirk fight
(iframe viewport sizing). If the next session is back to fighting CSS/Sites
embedding, expect to return to that grindier mode — this session's ease
doesn't generalize to that class of problem.

## Immediate next step if conversation continues

Nothing pending from this fix — it's complete and was a single, contained
change. If the user comes back about `index.html`, first check: did the full
title render correctly in the actual Google Sites embed (not just devtools)?
If they raise truncation again, check whether the new cell content has *other*
CSV-breaking characters (e.g. a literal `"` inside text, or a newline within
a cell) — `parseCSVRow()` handles escaped `""` and quoted commas, but hasn't
been tested against multi-line cell values.

If asked to port the fix: copy `parseCSVRow()` and the `rows = ...` line from
`khutbah/index.html` into `paparan-tajuk.html` and/or `beta-paparan-tajuk.html`
verbatim — don't reinvent it.
