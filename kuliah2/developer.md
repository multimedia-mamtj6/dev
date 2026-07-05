# kuliah2/jadual — Developer Guide

## Quick start

```bash
# From repo root
python -m http.server

# Desktop view
http://localhost:8000/kuliah2/jadual/jadual.html

# Mobile view (resize browser to ≤768px or use DevTools device mode)
http://localhost:8000/kuliah2/jadual/jadual.html

# Next month
http://localhost:8000/kuliah2/jadual/jadual.html?bulan=depan

# Print/PDF preview
http://localhost:8000/kuliah2/jadual/jadual.html?file=pdf
```

> Must use HTTP server — JSON fetch fails on `file://` due to CORS. Falls back to embedded July 2026 sample data automatically.

---

## File map

| File | Purpose |
|------|---------|
| `jadual.html` | HTML shell — minimal, no dark mode, no `index.html` navigation |
| `script.js` | All rendering: desktop table + mobile card view |
| `style.css` | All styles: desktop + single mobile block + print |
| `DEV_NOTES.MD` | Context memo for next AI session — read before touching anything |
| `CLAUDE.md` | Architecture reference for Claude Code |

---

## CSS architecture

### Design tokens (`:root`)
Same base variables as production plus kuliah2-specific refinements:
```css
--cell-border: #bcbcbc;       /* softer table borders */
--cell-border-inner: #cfcfcf; /* divider between lecture blocks */
--table-border: #000;
```

### Three blocks in `style.css`
1. **Base / desktop** — everything above `@media (max-width: 768px)`
2. **Mobile** — single `@media (max-width: 768px)` block, values match production mobile v2
3. **Print** — `@media print`, A4 landscape, box-shadow colour trick

> **Important:** Production (`kuliah/jadual/style.css`) has TWO stacked mobile blocks (v1 legacy + v2 override). kuliah2 has one. When syncing values, always compare against production's **second** mobile block (the v2 one, ~lines 172–577 of production's style.css). The v1 block values are superseded.

### Mobile card key values (don't drift from these)
```css
#today-kuliah-card        { margin: 0 1rem 1rem; padding: 0 0.5rem; }
.today-card-top-bar       { height: 4px; /* no margin */ }
.today-card-header        { padding: 0.5rem 1rem 0.375rem; margin-bottom: 0; }
.day-select-wrapper       { display: flex; justify-content: center; margin-bottom: 0; flex-shrink: 0; }
#today-kuliah-card
  .lecture-block-v2       { padding-top: 0.1rem; padding-bottom: 0.1rem; }
#mobile-card-list         { padding: 0 1rem; }
.show-empty-toggle        { gap: 0.4rem; box-sizing: border-box; }
.page-header (mobile)     { padding-top: 0.5rem; }
.card-body-v2             { text-align: center; } /* user preference — differs from production */
```

---

## JS architecture

### Desktop rendering
- `renderCalendarDesktop(senaraiHari, baseDate)` — main entry; builds 5-row × 7-col tbody
- `buildDayCell(dayNumber, dayData, isWeekend, isToday)` — 3-layer absolute stack
- `createLectureBlock(type, sessionData)` — desktop lecture block HTML
- `createEmptyLectureBlock(type)` — weekend/empty slot placeholder
- `buildWeekLabelCell(weekIndex)` — Xibo-safe MINGGU: stacked `<span>` chars, no CSS rotation

### Mobile rendering
- `initializeMobileView(senaraiHari, targetDate)` — entry; builds card list and today card
- `renderTodayCard(senaraiHari, selectedDay)` — today/tomorrow card with iframes
- `createMobileLectureBlock(time, lecture)` — mobile lecture block (different from desktop `createLectureBlock`)
- `loadHijriDate(targetDate)` — JAKIM API → `gregorianToHijri()` fallback
- `gregorianToHijri(date)` — pure JS Hijri calculator

### Module-level state
```js
let cachedSenaraiHari = null; // populated by renderTodayCard; re-used on dropdown change
```

### Function name disambiguation
| Function | Scope | Note |
|----------|-------|------|
| `createLectureBlock(type, sessionData)` | Desktop | kuliah2 kept original name |
| `createMobileLectureBlock(time, lecture)` | Mobile | Different signature; added to avoid collision |

Production uses `createLectureBlock` for mobile and `createDesktopLectureBlock` for desktop — opposite convention. Don't try to unify.

---

## Today highlight — how it works

```css
/* Screen: three-layer effect */
.day-cell.is-today { background-color: var(--today-highlight-bg); }
.day-cell.is-today .lecture-content { background-color: transparent; }
.day-cell.is-today::after { /* glow ring via box-shadow: inset */ }

/* Print: fully removed */
.day-cell.is-today { background-color: var(--date-header-bg) !important; }
.day-cell.is-today .lecture-content { background-color: #ffffff; }
.day-cell.is-today::after { display: none; }
```

---

## Digital signage iframes

Today card embeds live signage posters:
- Subuh: `https://dev.mamtj6.com/kuliah/paparan/today_subuh.html`
- Maghrib: `https://dev.mamtj6.com/kuliah/paparan/today_maghrib.html`
- Tomorrow variants: `tomorrow_subuh.html`, `tomorrow_maghrib.html`

Poster wrapper: `aspect-ratio: 16/9; width: 100%; margin: 0;`

---

## Data

Reads from `/kuliah/data/jadual_lengkap.json` — shared with production. **Never edit manually.** Auto-synced via Google Apps Script from the Google Sheet.

Falls back to `EMBEDDED_DATA` const in `script.js` (July 2026 sample) when fetch fails.

---

## Print

- A4 landscape: `@page { size: A4 landscape; margin: 0; }`
- `box-shadow: inset 0 0 0 1000px <color>` — forces background colours through browser print settings
- All sizes in `pt`
- `.week-label` already stacked — no `writing-mode` needed in print either
