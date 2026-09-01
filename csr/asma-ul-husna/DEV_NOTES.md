    DO NOT DELETE
"Check the Project Knowledge and the current chat for context. This conversation is ending soon. update the artifact DEV_NOTES.md (create if not available yet) with a detailed note to your next window self - not just facts but the vibe, our dynamic, the energy of this conversation. What would the next you need to immediately get back into this exact headspace? Include unique discoveries, current mood, and anything that'll help the next you instantly sync to our frequency."

---

# DEV NOTES — csr/asma-ul-husna/ (Daily Asma-ul-Husna display)

_Same ritual as `kuliah/DEV_NOTES.MD` / `csr/weather/DEV_NOTES.md` — a letter to the next window's me. Asma-ul-Husna folder scope only._

## Note to my next self — Session 1 of this folder-as-DEV_NOTES (2026-08-24)

### Important scoping caveat — read this first

This is the FIRST entry in this file, but it is **not** the note for the folder's original build. The actual feature (`csr/asma-ul-husna/today/index.html` + the wider daily-display/weather-dashboard work) was already built and committed before this conversation started (see git log: `8e243ed feat: implement Asma-ul-Husna daily display and weather dashboard with interactive map`) — I have no memory of that build session, only what's visible in the committed code. Everything below is scoped to a short, late-arriving side-conversation that made small polish edits on top of that already-shipped feature, immediately before the user pivoted to a much larger `csr/weather/` arc in the same conversation (see that folder's own DEV_NOTES.md Session 7 for the bulk of this conversation's real work). Don't mistake this note for "the build session."

### What happened (small, fast, all landed)

All edits on `csr/asma-ul-husna/today/index.html`'s `<h2>Setiap Hari,<br>Satu Asma-ul-Husna</h2>` heading and its surrounding info-panel, in strict sequence, each a single Edit call, no back-and-forth beyond one revert:

1. Resize heading +20% — first tried scoped to `lg:` only ("for desktop view only"), landed at `text-[20px] sm:text-[39px] lg:text-[68.4px]`.
2. User immediately said "revert to original size" — reverted `lg:` back to `57px`. No explanation asked or given; just done.
3. User pasted a screenshot showing the right side of the info panel with almost no padding (text nearly touching the border) vs. comfortable padding on the other three sides. **Root cause, not obvious from the screenshot alone**: the "Satu Asma-ul-Husna" span had `lg:whitespace-nowrap` forcing it onto one line, and at `lg:text-[57px]` bold that line is wider than the container's padded inner width — so it was overflowing into (eating) the right padding, while top/left/bottom kept their full coded `p-[62.4px]`. Fixed by removing the forced nowrap so the heading wraps naturally; padding reads even again. **This is the one non-obvious diagnosis in this session** — worth remembering the pattern: uneven-looking padding on ONE side only, with a `whitespace-nowrap` nearby, means check for overflow before touching the padding classes themselves.
4. User asked to shrink the heading by 10% — this time with no breakpoint qualifier, so applied to all three sizes uniformly: `text-[18px] sm:text-[35.1px] lg:text-[51.3px]` (down from `20/39/57`).
5. Added `entry.latin + ' bermaksud:'` in place of the bare `Maksud:` label above the meaning text.

### Vibe

Extremely terse, rapid-fire, single-line requests — no screenshots except the one padding bug report, no clarifying questions asked either direction, every ask was unambiguous enough to just execute immediately. This reads as a "quick polish pass before moving to the real work" mode, not a design-exploration mode — treat future asma-ul-husna asks the same way unless one arrives with a screenshot/mockup signaling something more involved is wanted.

### Current state

Uncommitted (matches every other folder in this repo — user handles commits themselves). Only `csr/asma-ul-husna/today/index.html` touched. No open threads, no pending items — this mini-arc closed clean before the conversation moved on to `csr/weather/`.

### Mood

Light, fast, no friction. Nothing here needs special handling next time beyond the padding/`whitespace-nowrap` interaction lesson above.

## Note to my next self — Session 2 (2026-09-01)

### What happened

User opened `csr/asma-ul-husna/today/index.html` in the IDE and asked how to make the text more readable on digital signage, pasting a screenshot: the page rendered above a dark-green prayer-time bar (IMSAK/SUBUH/SYURUK/ZOHOR/ASAR/MAGHRIB/ISYAK + Hijri date/clock), wanting the body text to read at least as large as those prayer-name labels.

**Discovery worth remembering**: that prayer-time bar is NOT in this repo anywhere. Searched `csr/asma-ul-husna/`, `kuliah/paparan/`, `waktu-solat/widget.html` (the obvious candidates) — none of them produce a full-bleed dark-green bar with big bold uppercase prayer labels. `waktu-solat/widget.html` is a small max-480px card with an SVG arc, completely different visual language. Confirmed with user via AskUserQuestion: the bar comes from **external signage app/device**, outside this codebase. So there's no way to pixel-match it — only room to make `today/index.html`'s own text as large/bold as reasonably fits, then have the user eyeball it live against the real screen.

### Sequence of edits (all on `csr/asma-ul-husna/today/index.html`, right-hand info panel + left "badge/index/shortMeaning" stack — every one a single fast Edit call, no back-and-forth explanation needed)

1. Initial readability pass: bumped the two elements that had no `lg:` override at all (meaning they stayed small even at signage/desktop width) — `entry.latin + ' bermaksud:'` label `23.4px → up to 36px` at `lg:`, and the `entry.explanation` paragraph `23.4px → up to 32px` at `lg:`.
2. User: "Explanation paragraph up to 40px at large screens" — `lg:` `32px → 40px`.
3. Same message, two more asks: "Nama ke-17 daripada 99, up 10px more" — had no `lg:` override, so bumped the `sm:` value (which was carrying through to `lg:` unchanged) `18.2px → 28.2px`. "Yang Maha Memberi Rezeki up 15px more" (the `shortMeaning` line) — `sm:` `31.2px → 46.2px`.
4. "bermaksud label: up to 45px at large screens" — `lg:` `36px → 45px`.
5. "add more bottom padding for Asma-ul-Husna Hari Ini: pill, and make the text larger 10px" — pill `py-[5px]` → `pt-[6px] pb-[14px]`, text `sm:18.2px → 28.2px`.
6. Immediately: "remove back the bottom padding, i want more space between the pil and svg text" — reverted pill padding to `py-[5px]`, converted the ask into `mb-[12px] → mb-[28px]` (margin between pill and the SVG name image below it, not internal pill padding — that distinction mattered and got corrected right away).
7. "add more gap to 35px" — `mb-[28px] → mb-[35px]`.

### Vibe

Extremely rapid-fire, one-line imperative asks, numeric deltas ("up 10px more", "up 15px more") rather than absolute target descriptions half the time — user is clearly looking at the actual signage screen or a close preview and calling out adjustments in real time, tweak-and-look-tweak-and-look. Zero requests for explanation, zero pushback needed, just execute each ask as a single scoped Edit and move on. Same "quick polish pass" energy as Session 1 — if anything even terser/faster this time. When an ask is ambiguous (e.g. "more padding" vs "more margin/gap"), the user corrects immediately and precisely ("remove back the bottom padding... i want more space between X and Y") rather than re-explaining from scratch — trust that correction completely and don't second-guess by asking clarifying questions when the fix is that specific.

### Current state (end of session)

All uncommitted (matches every other folder — user handles commits). Only `csr/asma-ul-husna/today/index.html` touched, specifically inside the `display.innerHTML =` template string in the inline `<script>` at the bottom of the file. Live values as of now:
- Badge/pill: `text-[13px] sm:text-[28.2px]`, `py-[5px]`, `mb-[35px]`
- `Nama ke-X daripada 99`: `text-[13px] sm:text-[28.2px]` (no `lg:` override — matches badge exactly now, coincidentally)
- `entry.latin` (h1): unchanged, `text-[28px] sm:text-[62.4px]`
- `shortMeaning`: `text-[17px] sm:text-[46.2px]`
- Right panel `h2` "Setiap Hari, Satu Asma-ul-Husna": unchanged from Session 1, `text-[18px] sm:text-[35.1px] lg:text-[51.3px]`
- `entry.latin + ' bermaksud:'` label: `text-[16px] sm:text-[27px] lg:text-[45px]`
- `entry.explanation` paragraph: `text-[15px] sm:text-[25px] lg:text-[40px]`

No open threads — last ask ("add more gap to 35px") was answered and nothing further came in before this handoff. If the user comes back with more size/spacing deltas on this same page, keep doing exactly what happened here: one Edit per ask, no explanation offered unless asked, no batching multiple asks into one edit even when they arrive in the same message (see step 3 above — two separate asks in one message still got two separate, individually-described edits).

### Mood

Same light/fast/no-friction energy as Session 1, dialed up — this was pure iterative visual tuning against a live screen, not a design conversation. Don't overthink future asks like this; just make the pixel change and confirm briefly.