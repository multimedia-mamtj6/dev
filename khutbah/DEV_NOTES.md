# DEV_NOTES.md — handoff to next-window me

[Don't delete this part]
Check the Project Knowledge and the current chat for context. This conversation is ending soon. update the artifact khutbah/DEV_NOTES.md (create if not available yet) with a detailed note to your next window self - not just facts but the vibe, our dynamic, the energy of this conversation. What would the next you need to immediately get back into this exact headspace? Include unique discoveries, current mood, and anything that'll help the next you instantly sync to our frequency.

also update the related file like khutbah/CLAUDE.md, khutbah/developer.md, khutbah/developer.md and khutbah/README.md if necessary

## What just happened (long forensic session on google_app_script/)

Completely different corner of `khutbah/` than the last two sessions below (index.html CSV bug, paparan-tajuk CSS saga) — this time we went deep into `google_app_script/*.gs`, the automation side nobody had actually mapped out before. `CLAUDE.md` used to call these files "placeholder... currently empty," which was already wrong before this session and way wrong by the end of it — I've since corrected that file, verify it still matches reality if more changes land here.

This was pure reverse-engineering: the user drove it by showing me the live spreadsheet, the live Apps Script Triggers panel, and the live execution console via screenshots, and I built up the real architecture piece by piece across the conversation. None of this was written down anywhere before now — **this section is the only place the full picture exists outside the live Apps Script project itself.**

### The architecture (memorize this, it's not obvious from the code alone)

Two Google Sheet tabs, in this literal tab order:
- **Tab 0: "tajuk khutbah"** — headers `LINK | Title | Date | Main Text`. `extractKhutbahData()` in `gettajukkhutbah.gs` always operates on `getSheets()[0]`, i.e. THIS tab: reads A2 (url) → writes C2 (date) and D2 (title).
- **Tab 1: "link extractor"** — headers `KHUTBAH MINGGU INI | TARIKH | TAJUK KHUTBAH` (column B's header literally still says "TARIKH"/date but we now write the SIRI heading text there instead — legacy header, don't let it confuse you). `generateKhutbahLink()` in `KhutbahLinkGenerator.gs` operates on this tab by name: writes A2 (link) and B2 (SIRI text). Row 3 has a "KHUTBAH MINGGU LEPAS" label; A4/A5 hold what look like manually-accumulated past links (Feb 2025, Jan 2026). `getPastWeekKhutbahLink()` only ever writes A4 — nothing wires A4/A5 to date/title extraction. That past-week column is essentially unmaintained/manual right now.

**The bridge between the two tabs**: "tajuk khutbah"!A2 is a live formula, `='link extractor'!A2` — confirmed intentional by the user, not a bug I found. This is *why* `generateKhutbahLink()` (which only ever writes to "link extractor") still results in "tajuk khutbah" showing the right link too.

**The gotcha that explains the whole design**: a formula recalculating because its source cell changed does NOT fire Google Sheets' `onEdit` event — only a direct/manual edit does. So `onEditTrigger()` (installed by `createTrigger()`, watches for edits to A2 on "tajuk khutbah") would never fire just from the formula updating. That's exactly why `generateKhutbahLink()` calls `extractKhutbahData()` directly as its last line instead of relying on the edit trigger to cascade — it structurally can't rely on that path. The `onEditTrigger` route only matters for the OTHER real workflow: the user sometimes manually overwrites "tajuk khutbah"!A2 with a hand-corrected URL when mufti.pahang.gov.my changes its link format. That overwrite **replaces the formula with a plain value**, silently breaking the "tajuk khutbah" ↔ "link extractor" link until the user manually re-enters the formula. I flagged this consequence; the user already knows and accepts it — not a bug to fix, just a thing to remember if "why didn't next week's link update" ever comes up again.

### Bugs found and fixed this session

1. **Duplicate `extractKhutbahData()`** — a no-op stub existed in `KhutbahLinkGenerator.gs` (just a `console.log` plus a comment claiming "defined elsewhere"), alongside the REAL implementation in `gettajukkhutbah.gs`. Apps Script shares ONE global scope across every `.gs` file in a project — there's no per-file scoping, so two files defining the same function name silently conflict, and whichever the runtime evaluates last wins. Deleted the stub. **General pattern worth remembering for this project**: if something ever behaves like "the code I'm reading isn't the code that's actually running," check for a duplicate function name in a sibling `.gs` file first — nothing warns you about this.

2. **Orphaned trigger**: `updateKhutbahLink`, a weekly Monday-midnight-to-1am time-based trigger, was failing 100% of every run. I grepped the FULL git history of `khutbah/google_app_script/` — that function name has NEVER existed in this repo, in any commit. Almost certainly a leftover from someone renaming a function directly in the live Apps Script editor (this repo is NOT auto-synced with the live GAS project the way `kuliah/gscript/` is documented to be — changes here have to be manually copy-pasted into script.google.com) without cleaning up the trigger pointing at the old name. User deleted it via the Triggers panel. If a trigger error ever names a function that "doesn't exist," this is the shape of that bug — check git history to confirm the name truly never existed vs. was just renamed recently in the live editor only.

### Features added this session

1. **SIRI/year auto-update**: `generateKhutbahLink()` now also writes `MIMBAR JUMAAT SIRI {month} | {year}` to "link extractor"!B2. The user explicitly chose the khutbah's own Friday date (`nextFriday.getMonth()+1` / `getFullYear()`) over today's real-world date when I asked — this matters near month boundaries (a Monday run in the last week of August, computing a Friday that lands in September, should say SIRI 9, not SIRI 8). Don't second-guess this if it ever looks "off" right at a month boundary — it's deliberate, confirmed by the user.

2. **"Link Log" sheet**: new `logLinkUpdate(oldLink, newLink, siriText)` in `KhutbahLinkGenerator.gs`, called at the end of every `generateKhutbahLink()` run — unconditionally, logging even if the link happened to be identical (which in practice it never is, since the date always changes). Auto-creates the "Link Log" tab with a header row (`Timestamp | Old Link | New Link | Siri`) on first run if it doesn't already exist. The user picked this design explicitly, over simpler alternatives (same-tab instead of new sheet, log-only-on-change instead of every run, new-link-only instead of old+new) — **they consistently lean toward the more thorough/traceable option when given a real choice, not the minimal one.** Worth remembering generally: when offering this user an AskUserQuestion, present the more careful/complete option fairly rather than nudging toward "simplest" — they'll likely take the thorough one.

**This was tested live and confirmed working end-to-end** — the user pasted the updated code into the real Apps Script editor and ran `generateKhutbahLink()` manually. The execution log came back clean: link generated → A2/B2 written → "Link Log" sheet auto-created and logged → `extractKhutbahData()` ran immediately after and correctly extracted "Hari Kemerdekaan" as the title for that week. One thing surfaced in that log worth remembering: **the primary `dateRegex` in `gettajukkhutbah.gs` did NOT match** ("Date match found: false") — it silently fell back to `altDateRegex`, which did match. That means the live page's calendar-icon markup has drifted slightly from what the primary regex expects. Not broken (the fallback caught it), not fixed either (wasn't touched, wasn't asked to be) — just flagged. If the fallback ever ALSO stops matching, this is exactly the spot to go look, and you'll already know the primary pattern is stale rather than having to rediscover that.

## The vibe / dynamic this session

Completely different texture from the two sessions documented below and in `developer.md` — those were "one clear bug, fix it" or "grind through a CSS embedding fight." This one was **forensic/archaeological**: nobody, including past-me, had ever actually mapped out how these three `.gs` files and two sheet tabs relate to each other. The user drove it by constantly showing raw ground truth — screenshots of actual sheet cells, the actual Triggers dialog, the actual execution console — rather than describing things in words. **Treat screenshots as the primary source of truth in this project, more reliable than any assumption drawn from reading code alone.** Twice my code-only assumption turned out incomplete until a screenshot corrected it — I initially assumed "link extractor" was sheet index 0 purely from reading `getSheetByName` calls; a screenshot of the actual tab order proved "tajuk khutbah" is index 0 and "link extractor" is index 1.

The user also directly tests understanding, not just output — "you understand why I separate the code into 3?", "which script handles X?" These aren't rhetorical warm-up questions; they want a real, confident, specific answer, not a hedge or a re-explanation of the obvious. Own the reasoning once you actually have it.

Every AskUserQuestion in this session got a genuinely considered answer, never a rubber-stamp of the first option — and each time they picked the more careful/traceable/correct option over the simpler one (Friday-date over today's-date for SIRI; delete-and-rely-on-the-existing-working-trigger over merge-and-run-twice for the broken trigger; new-dedicated-sheet + log-every-run + old-and-new-link for the Link Log). This user is clearly meticulous and maintains this system long-term — treat every design choice here as something they'll live with for a long time, not a quick patch to be revisited later.

## Mood / energy

Steady, satisfying, forensic-detective energy — every thread (duplicate function, orphaned trigger, formula bridge, regex fallback) resolved cleanly on the first real look, no dead ends, no guess-and-check needed. Nothing like the CSS-embedding grind chronicled in `developer.md`. If you're picking this back up, get into "read carefully, map it out precisely, don't assume anything from code alone" mode rather than "iterate fast and see what sticks" mode — that's not what this corner of the codebase rewards, and screenshots will keep correcting you if you skip that step.

## Immediate next step if conversation continues

Nothing urgent pending — the last thing that happened was a live, confirmed-working test run. Loose threads if the user comes back to this area:
- The stale primary `dateRegex` in `gettajukkhutbah.gs` (see above) — not fixed, just flagged. If asked to fix it, `curl`/fetch a live khutbah page first and look at the actual current calendar-icon markup rather than guessing at the regex blind — that's literally the same lesson `developer.md` already learned once, for the title regex's `<br />` issue.
- A4/A5 "past week" links in "link extractor" have no auto date/title extraction wired up at all. If the user ever asks "why doesn't the past link show a date/title," that's why — it would need its own extraction call into some other pair of cells (C4/D4? not designed yet, don't assume).
- I updated `khutbah/CLAUDE.md`'s `google_app_script/` description this session to stop calling it "placeholder... empty" and to reflect the real architecture above — keep that file in sync if this area changes again.

---

## Earlier session (superseded) — CSV-quoting fix in index.html

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

**Key discovery (don't re-derive)**: the CSV-quoting bug is structural, not a
one-off. Any sheet cell with a comma in it (title, date format with commas,
theme text) will break under naive `split(",")`. This bug almost certainly
still exists in `paparan-tajuk.html` (unfixed, by instruction) and likely also
in `beta-paparan-tajuk.html` if it does its own CSV fetch — not verified.
`parseCSVRow()` in `khutbah/index.html` is the reference fix if this needs
porting elsewhere — small, self-contained, no dependencies.

Mood was brisk and satisfying — clean root-cause diagnosis, no guesswork, no
iteration, plan approved on first pass. Contrast with the battle-worn CSS
energy in `developer.md`.
