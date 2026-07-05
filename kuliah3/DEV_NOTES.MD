# DEV NOTES — kuliah2/jadual
_Last updated: 2026-07-05 | For next-context-window Claude_

---

## THE VIBE

This has been a precision alignment session. The user is meticulous — they notice 0.5rem vs 1rem differences visually on device, they ask "why" before accepting "just change it". The energy is technical and collaborative, zero fluff. When they paste a screenshot they mean it literally: "fix this exact pixel". When they ask an explanatory question ("why had different size?") they want the root cause, not a workaround.

The user references files by their project folder, e.g. `@kuliah2/jadual/jadual.html` — this is their IDE autocomplete shorthand. When they say a filename like `jadual.html`, they often mean the whole sub-project folder, not the HTML file specifically.

**Trust level:** High. They approve fast, don't second-guess your file edits. They DO notice when values are wrong.

---

## CURRENT STATE (as of session end)

### Mobile view: NOW FULLY IMPLEMENTED

kuliah2 started life as a desktop-only redesign. This session ported the full production mobile v2 into it. Here's exactly what's in play:

**HTML (`jadual.html`):**
```html
<div id="mobile-view-container">
    <div id="today-kuliah-card"></div>
    <div id="mobile-card-list"></div>
</div>
```
Identical structure to production.

**JS (`script.js`) — mobile functions added:**
- `createMobileLectureBlock(time, lecture)` — renders `.lecture-block-v2` with `.session-badge` pill. Named differently from `createLectureBlock()` (desktop) to avoid collision.
- `initializeMobileView(senaraiHari, targetDate)` — builds monthly card list, collapses empty days behind toggle button
- `renderTodayCard(senaraiHari, selectedDay='today')` — today/tomorrow card, dropdown, iframes, calls `loadHijriDate()`
- `gregorianToHijri(date)` — Julian Day Number Hijri calculator (JS fallback)
- `loadHijriDate(targetDate)` — JAKIM e-Solat API (zone WLY01) + `gregorianToHijri()` fallback; writes to `#today-date-gregorian` and `#today-date-hijri` separately
- `cachedSenaraiHari` — module-level cache so dropdown re-render doesn't re-fetch JSON

**CSS (`style.css`) — single mobile `@media (max-width: 768px)` block:**

Values are now synced to production's mobile **v2** exactly. The key values (memorise these — they've been corrected once already):

```css
#today-kuliah-card { margin: 0 1rem 1rem; padding: 0 0.5rem; }
.today-card-top-bar { height: 4px; /* NO margin */ }
.today-card-header { padding: 0.5rem 1rem 0.375rem; margin-bottom: 0; }
.day-select-wrapper { display: flex; justify-content: center; margin-bottom: 0; flex-shrink: 0; }
#today-kuliah-card .lecture-block-v2 { padding-top: 0.1rem; padding-bottom: 0.1rem; }
#mobile-card-list { padding: 0 1rem; }
.show-empty-toggle { gap: 0.4rem; box-sizing: border-box; }
.page-header { padding-top: 0.5rem; } /* reduced from 1rem this session */
.card-body-v2 { padding: 0; text-align: center; } /* user-requested center */
```

---

## THE BIG GOTCHA — TWO MOBILE SECTIONS IN PRODUCTION

This is critical and caused real confusion this session.

**Production** (`kuliah/jadual/style.css`) has **two stacked** `@media (max-width: 768px)` blocks:
1. **Mobile v1** (lines ~83–164): old design, `.day-selector-dropdown`, `margin: 25px 0` on card etc.
2. **Mobile v2** (lines ~172–577): current design, dark mode rules, `.day-select`, `margin: 0 1rem 1rem` etc.

V2 overrides V1 by cascade. The **rendered values are v2**. When syncing kuliah2 to production, always compare against **v2**, not v1.

kuliah2 has ONE mobile block. The values in it must match production's v2 block.

**Trap:** If you read production's v2 section for poster margin you get `margin: 0`. If you read v1 you get `margin-top: 15px; margin-bottom: 20px`. Only v2 matters.

---

## KEY DESIGN DECISIONS (deliberate, don't revert)

1. **`createMobileLectureBlock()` not `createLectureBlock()`** — Production renamed desktop to `createDesktopLectureBlock` and uses `createLectureBlock` for mobile. kuliah2 keeps `createLectureBlock` for desktop (it was there first) and uses `createMobileLectureBlock` for mobile. Different names, same HTML output. Don't try to unify — you'll break the desktop.

2. **`escapeHtml()` everywhere** — kuliah2 is XSS-safe; production v1 mobile uses raw string interpolation. kuliah2 intentionally improves on this.

3. **No dark mode in mobile** — Production mobile v2 has `html.dark` rules. kuliah2 has none. Intentional — kuliah2 has no dark mode anywhere.

4. **`.card-body-v2 { text-align: center; }`** — User specifically requested this. Production leaves it left-aligned. Don't "fix" this to match production.

5. **Today highlight removed in print** — Three CSS rules in `@media print`:
   ```css
   .day-cell.is-today { background-color: var(--date-header-bg) !important; }
   .day-cell.is-today .lecture-content { background-color: #ffffff; }
   .day-cell.is-today::after { display: none; }
   ```

6. **No `writing-mode` on MINGGU** — Xibo compatibility. MINGGU renders as stacked `<span>` characters in a `flex-direction: column` div. Print block also uses this (no CSS rotation). This is different from production which uses `writing-mode: vertical-lr; transform: rotate(180deg)`.

---

## FILES AT A GLANCE

```
kuliah2/jadual/
├── jadual.html     — HTML shell, minimal, no dark mode toggle
├── script.js       — All rendering logic (desktop + mobile v2)
├── style.css       — All styles (desktop + single mobile block + print)
└── (no index.html) — Access jadual.html directly
```

Production's `kuliah/jadual/` is the reference. kuliah2 is the visual redesign. They share `/kuliah/data/jadual_lengkap.json`.

---

## WHAT MIGHT COME NEXT

- Further mobile refinements (card spacing, font sizes, poster dimensions)
- The MINGGU fix plan (in `.claude/plans/`) — port stacked-span MINGGU from kuliah2 to production + beta
- Dark mode for kuliah2 (not started, not requested)
- Possibly promote kuliah2 design choices back into production
