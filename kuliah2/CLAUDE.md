# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`kuliah2/jadual/` is a redesigned desktop-only variant of the lecture schedule table (`kuliah/jadual/`). It was generated as a benchmark/visual improvement test. It shares the same live data source (`/kuliah/data/jadual_lengkap.json`) but differs in architecture and visual design.

Serve locally to develop:
```bash
python -m http.server
# Open http://localhost:8000/kuliah2/jadual/jadual.html
```

URL parameters: `?bulan=depan` (next month), `?file=pdf` (auto-print).

## Key differences from production (`kuliah/jadual/`)

- **Desktop-only** — `#mobile-view-container` exists in HTML but JS never populates it. No mobile card view, no Hijri API fetch, no iframe poster embeds.
- **Embedded fallback data** — `EMBEDDED_DATA` const in `script.js` (July 2026 sample). Used automatically when the live JSON fetch fails (offline Xibo boot, local `file://` preview).
- **Xibo-safe MINGGU from the start** — `buildWeekLabelCell()` renders stacked `<span>` characters via string template, no `writing-mode` or `transform` anywhere (not even in `@media print`).
- **Visual refinements** — softer internal borders (`--cell-border`, `--cell-border-inner`), refined typography hierarchy, `Scheherazade New` Google Font for Arabic text, today highlight uses `::after` glow overlay (`box-shadow: inset`), Yasiin cells get green background via CSS `:has(.yasin-block)`.
- **XSS safety** — `escapeHtml()` helper wraps all JSON-sourced text before inserting into innerHTML.
- **No `index.html`** — navigation landing page not included; access `jadual.html` directly.

## Architecture

All rendering is in `script.js`. Entry point is the `DOMContentLoaded` handler:

1. Parse URL params → determine target month
2. `fetchScheduleData()` — fetches live JSON with cache-bust; falls back to `EMBEDDED_DATA` on any error
3. Populate footer update-info and `#schedule-title`
4. `renderCalendarDesktop(senaraiHari, baseDate)` — builds a 5-row × 7-col `<tbody>` via innerHTML string assembly
5. If `?file=pdf` → double `requestAnimationFrame` + 250ms `setTimeout` → `window.print()`

### Cell rendering logic (`buildDayCell`)

Each `<td class="day-cell">` uses 3-layer absolute positioning:
- Layer 1 — `.date-number` (top-left, `position: absolute`)
- Layer 2 — `.date-header` with `.holiday-label` (only when `cuti_umum` is set)
- Layer 3 — `.lecture-content` (fills cell below date row)

Five cell states:
| State | Condition |
|-------|-----------|
| Padding | `dayNumber` is null (grid overflow) |
| No JSON entry | date not in `dataByDate` map |
| Full-day empty | both `subuh` and `maghrib` are null → `.is-empty-slot` |
| Normal day | at least one session → render `createLectureBlock()` per session |
| Weekend null session | `isWeekend && session === null` → `createEmptyLectureBlock()` placeholder |

Yasiin special case: if `nama_penceramah` contains `'Yasiin'`, render Arabic RTL block instead of standard lecture block.

### Grid slot algorithm

`slots[35]` array; day 1 placed at index `firstDayOfMonth`; subsequent days fill sequentially with `% 35` wrap to handle months that overflow the 5-row grid cleanly.

### Print stylesheet

`@media print`: A4 landscape, `box-shadow: inset 0 0 0 1000px <color>` trick to force background colours, all sizes in `pt`, `.week-label` keeps flex column (no `writing-mode` needed since stacking is already correct).

## Data

Reads from `/kuliah/data/jadual_lengkap.json` — the same file as production. **Never manually edit that file**; it is overwritten by Google Apps Script sync from the Google Sheet.
