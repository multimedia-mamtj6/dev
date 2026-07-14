# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a responsive web application for displaying the monthly lecture (kuliah) schedule for Masjid Al-Mukhlisin. The system features a dual-view architecture: a traditional calendar table for desktop and a card-based layout for mobile devices. All schedule data is managed through a Google Sheet and automatically synchronized to a JSON file via Google Apps Script.

## Running the Application

The application must be served through a local web server (not `file://`) because it fetches JSON data via JavaScript.

```bash
# From the repo root
python -m http.server
```

Then open `http://localhost:8000/kuliah/jadual/` in your browser.

## Project Structure

```
kuliah/jadual/
├── index.html              # Landing page with navigation buttons
├── jadual.html             # Main schedule page (dual-view)
├── script.js               # Rendering logic (v15.2.2)
├── style.css               # Responsive styles with print media queries
└── google-app-script/
    ├── code.gs             # Google Apps Script sync logic (v6.0)
    ├── config.json         # Configuration template (SENSITIVE - do not commit)
    └── index.html          # Web app control panel

kuliah/data/
└── jadual_lengkap.json     # Single source of truth (auto-synced — never edit manually)
```

## Architecture & Key Concepts

### Dual-View Rendering System

The application renders **two complete layouts simultaneously** in `jadual.html`:

1. **Desktop View** (`<table id="calendar-body">`):
   - 5-week grid calendar with absolute-positioned content
   - Vertical week labels (MINGGU 1-5)
   - Date numbers in top-right corner
   - Lecture content positioned in bottom portion of cells
   - Uses `vmin` units for responsive sizing

2. **Mobile View** (`<div id="mobile-view-container">`):
   - Card-based layout with chronological listing
   - Special "Kuliah Hari Ini" (Today's Lecture) card with:
     - Hijri date from JAKIM e-Solat API
     - Embedded Digital Signage posters via iframe
   - Uses `em`/`rem` units for text sizing

**Display control:** CSS `@media screen and (max-width: 768px)` query toggles visibility between views. **Must include `screen`** — see the PDF Export warning below for why a bare `@media (max-width: 768px)` broke print output.

### Data Structure & Management

`data/jadual_lengkap.json` structure:
```json
{
  "infoJadual": {
    "tajukBulan": "BULAN JANUARI 2026",
    "tarikhKemasKini": "*Dikemaskini oleh..."
  },
  "senaraiHari": [
    {
      "date": "2026-01-01",
      "subuh": {
        "nama_penceramah": "...",
        "tajuk_kuliah": "...",
        "poster_url": "https://..."
      },
      "maghrib": { ... },
      "cuti_umum": "Tahun Baru"
    }
  ]
}
```

**Critical:** Always access data via `jsonData.senaraiHari`, not `jsonData` directly.

**Data workflow:**
1. Admin updates Google Sheet (tabs: `Schedule` and `Posters`)
2. Google Apps Script reads sheets and constructs JSON
3. Script pushes JSON to GitHub repository via API
4. Web app fetches JSON with cache-busting: `?v=${new Date().getTime()}`

### Month Navigation

URL parameter controls which month to display:
- Current month: `jadual.html`
- Next month: `jadual.html?bulan=depan`

Logic in `script.js:9-15` adjusts the base date for rendering.

### PDF Export Functionality

Version 15.0 introduced URL-based PDF export:
- Current month PDF: `jadual.html?file=pdf`
- Next month PDF: `jadual.html?file=pdf&bulan=depan`

**Implementation details:**
- Auto-triggers `window.print()` when `?file=pdf` parameter detected
- Uses double `requestAnimationFrame` + 250ms delay for reliable rendering
- Print media queries force desktop table view on mobile devices
- Converts all units to `pt` for print consistency
- A4 landscape orientation enforced

### ⚠️ CRITICAL: Print/PDF is fragile — read this before touching style.css

**Bug fixed 2026-07-06:** PDF exports triggered from a narrow/mobile-width browser (e.g. opening `jadual.html?file=pdf` on a phone) came out broken — header stacked instead of side-by-side, and the footer legend (Petunjuk boxes) vanished entirely. Root cause: both `@media (max-width: 768px)` blocks in `style.css` were **not scoped to `screen`**. `max-width` is a viewport-width check, and on a phone the print rendering context still reports that narrow width — so the mobile column-layout/`.legend{display:none}` rules stayed active *during* printing, and the `@media print` block never reset `.page-header`/`.page-footer` flex-direction or `.legend` display to compensate.

**Fix:** both mobile blocks must be `@media screen and (max-width: 768px)` — never bare `@media (max-width: 768px)`. This guarantees `@media print` always gets the desktop layout as its starting point, regardless of the exporting device's screen width. **If you ever add a new `@media (max-width: ...)` block to this file, scope it to `screen` too, or it can silently leak into print again.**

**Second bug fixed same day:** the print block still had a leftover `.week-number-cell { writing-mode: vertical-lr; transform: rotate(180deg); }` rule from before the week label was refactored (see "Week labels" below) to build "MINGGU" as individually stacked `<span>` letters via `.week-label { flex-direction: column }` (style.css:45, script.js:84-87). Rotating an already-stacked label produced garbled/reversed text in the printed week column. **The rotation rule has been removed from print** — do not re-add `writing-mode`/`transform: rotate` to `.week-number-cell` unless the underlying `.week-label` markup goes back to a single rotated block of text.

**Every value in the `@media print` block below is a deliberately tuned pt size or position from real print testing (A4 landscape) — do not "clean up" or round these without reprinting and visually comparing.** Full block preserved here for reference so a stale in-code version can always be diffed against a known-good one:

```css
@media print {
    @page {
        size: A4 landscape;
        margin: 0;
    }

    * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }

    body {
        overflow: visible !important;
        background-color: white;
    }

    /* --- Sembunyikan elemen yang tidak perlu dicetak --- */
    .print-button,
    .legend-box.today-legend{
        display: none !important;
    }

    /* --- CRITICAL: Force desktop table view for printing even on mobile --- */
    #mobile-view-container {
        display: none !important;
    }

    .schedule-table {
        display: table !important;
    }

    /* --- Aturan Reka Letak Utama --- */
    .page-container {
        display: flex; flex-direction: column; height: 100vh !important;
        width: 100% !important; max-width: none !important;
        padding: 1cm !important; margin: 0 !important;
    }
    .page-header { flex-shrink: 0; }
    main { flex-grow: 1; min-height: 0; }
    .page-footer { flex-shrink: 0; padding-top: 5px; }

    /* --- Strategi Jadual Muktamad --- */
    .schedule-table {
        width: 100%;
        height: 100%;
        border-collapse: separate;
        border-spacing: 0;
    }

    .schedule-table th,
    .schedule-table td {
        /* PEMBETULAN #1: Garisan lebih halus dan lembut */
        border: 0.5pt solid #555;
        padding: 0 !important;
        background-color: transparent !important;
        position: relative;
        text-align: center;
        vertical-align: middle;
    }

    /* PEMBETULAN #2: Kembalikan warna hijau pada header hari */
    .schedule-table thead th {
        box-shadow: inset 0 0 0 1000px var(--week-bg);
    }

    .week-number-cell {
        box-shadow: inset 0 0 0 1000px var(--week-col-bg);
    }

    .day-cell {
        box-shadow: inset 0 0 0 1000px var(--date-header-bg);
    }

    .day-cell.empty-cell {
        box-shadow: inset 0 0 0 1000px var(--empty-cell-bg);
    }

    /* --- Aturan untuk sel yang mempunyai tarikh --- */
    .day-cell .date-header {
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 14pt;
        background-color: var(--date-header-bg);
    }

    .day-cell .lecture-content {
        position: absolute;
        top: 14pt; bottom: 0; left: 0; right: 0;
        background-color: #fff;
        padding: 0.5vmin;
    }

    /* --- Penyesuaian Saiz Fon & Posisi Teks (Final) --- */
    .title-container .title-main { font-size: 14pt; }
    .title-container .title-month { font-size: 28pt; }
    .schedule-table thead th { font-size: 9pt; font-weight: bold; }

    .date-number { position: absolute; top: 2pt; left: 4pt; font-size: 9pt; z-index: 3; }
    .date-header { align-items: flex-start !important; z-index: 2; }
    .holiday-label {
        font-size: 6.5pt;
        float: right;
        margin-top: 2pt;
        margin-right: 4pt;
        background-color: var(--holiday-label-bg) !important;
        color: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }

    .lecture-content { font-size: 5pt; z-index: 2; }
    .lecture-time { font-size: 7pt; }
    .ustaz-name { font-size: 7pt; }
    .lecture-title { font-size: 6.5pt; }
    .empty-slot-text { font-size: 9pt; }
    .lecture-content.is-empty-slot { background-color: var(--empty-cell-bg); }

    .arabic-text { font-size: 18pt; }
    .yasin-title { font-size: 8pt; }
    .page-footer { font-size: 7pt; }
}
```

## Desktop View Implementation Details

**Positioning strategy:**
- `.day-cell` has `position: relative` (positioning context)
- `.date-number` uses `position: absolute; top: 2pt; right: 4pt`
- `.lecture-content` uses `position: absolute; top: 16pt; bottom: 0`

**Today highlighting:**
- Script adds `.is-today` class to current day's `.day-cell` (script.js:106-109)
- CSS applies yellow background to `.day-cell.is-today`

**Public holidays:**
- Uses special `.date-header` with `.holiday-label` child (script.js:96-104)
- Dark blue background (#2c3e50) with white text
- Print styles include `print-color-adjust: exact` to preserve colors

**Week labels:**
- "MINGGU" is rendered as individually stacked `<span>` letters inside `.week-label { display: flex; flex-direction: column }` (style.css:45, script.js:84-87) — **not** CSS `writing-mode`/`transform: rotate`. The old rotation approach was removed; do not reintroduce it (see the print-block warning above — combining rotation with the stacked-letter markup produces garbled text).

**Empty slots:**
- Gray background with "Slot Kosong" text
- Detected when both `subuh` and `maghrib` are `null` (script.js:114-118)
- Weekend-specific empty slots handled separately (script.js:126-127)

## Mobile View Implementation Details

**"Kuliah Hari Ini" card:**
- Only displays when viewing current month (script.js:158-164)
- Fetches Hijri date from JAKIM API (zone: WLY01) (script.js:252)
- Embeds Digital Signage posters from `dev.mamtj6.com`:
  - Subuh: `today_subuh.html` (script.js:227)
  - Maghrib: `today_maghrib.html` (script.js:231)
- Poster wrapper uses `aspect-ratio: 16 / 9` with `margin: 0` for responsive sizing

**Today card header layout (v15.4):**
- Side-by-side flex row: dropdown (`day-select`) on the left, date block on the right
- Date block (`.today-date-right`) stacks two elements:
  - `#today-date-gregorian` — bold dark text, e.g. "Rabu, 4 Jun 2026"
  - `#today-date-hijri` — green smaller text, e.g. "7 Zulhijah 1447H"
- `loadHijriDate()` writes each part separately (previously wrote combined string to `#today-date-combined`)

**Date parsing:**
- Append timezone offset to avoid timezone issues: `new Date(dayData.date + 'T00:00:00')` (script.js:174, 178)

**Yasiin & Tahlil detection:**
- Special case when lecturer name includes "Yasiin" (script.js:119-120)
- Renders Arabic text (باچاءن يسٓ دان تهليل) with RTL direction

## Google Apps Script Integration

**Configuration (google-app-script/config.json):**
- Contains GitHub credentials, repository info, image base URL, secret key
- **CRITICAL: Never commit this file to version control**
- Multi-environment support (production, development, staging)

**Script Properties required:**
- `GITHUB_USERNAME`: GitHub username/organization
- `GITHUB_REPO`: Repository name
- `GITHUB_TOKEN`: Personal Access Token with `repo` scope
- `IMAGE_BASE_URL`: Base URL for poster images
- `SECRET_KEY`: Authentication for web app endpoint

**Sync workflow:**
1. Run from menu: `📤 Export Files` → `Update Live Schedule (JSON)`
2. Script reads `Schedule` and `Posters` sheets
3. Constructs structured JSON with metadata
4. Pushes to GitHub via API to path: `kuliah/data/jadual_lengkap.json`
5. Web app fetches updated JSON with cache-busting

## Print Stylesheet

**Key techniques (style.css @media print):**
- `@page { size: A4 landscape; margin: 0; }`
- Flexbox layout on `.page-container` prevents footer overflow
- All font sizes and positions converted to `pt` units
- `box-shadow` technique preserves background colors
- `print-color-adjust: exact` forces color printing
- Hides interactive elements (links, "today" legend)
- Maintains `position: absolute` layout for visual fidelity

## Vercel Deployment Notes

The site is deployed with `cleanUrls: true` and `trailingSlash: false` in `vercel.json` (repo root). This combination means:

- URLs are served without `.html` extensions (e.g. `/kuliah/jadual/jadual` not `/kuliah/jadual/jadual.html`)
- Without a trailing slash, relative paths like `href="style.css"` resolve from the wrong base directory

**Rule:** All asset references (`<link href>`, `<script src>`) and all internal `<a href>` links in files under `kuliah/jadual/` must use **absolute root-relative paths**:

```html
<!-- Correct — works on Vercel and locally -->
<link rel="stylesheet" href="/kuliah/jadual/style.css">
<script src="/kuliah/jadual/script.js"></script>
<a href="/kuliah/jadual/jadual">...</a>
<a href="/kuliah/jadual/jadual?bulan=depan">...</a>

<!-- Wrong — breaks on Vercel with cleanUrls -->
<link rel="stylesheet" href="style.css">
<a href="jadual.html">...</a>
```

Note: Omit `.html` in `<a href>` values since Vercel serves clean URLs — the browser will request `/kuliah/jadual/jadual` and Vercel maps it to `jadual.html`.

## Common Development Tasks

### Updating Schedule Data
Edit the Google Sheet, then run the Apps Script sync from the custom menu. Do NOT manually edit `jadual_lengkap.json`.

### Changing e-Solat Zone
Modify zone code in `script.js:252` (currently `WLY01` for Kuala Lumpur).

### Changing Digital Signage URLs
Update iframe sources in `script.js:227` (Subuh) and `script.js:231` (Maghrib).

### Adding New Month Navigation
The script automatically handles next month via `?bulan=depan`. For additional months, extend the logic in `script.js:9-15`.

### Modifying Responsive Breakpoint
Change the `768px` value in the `@media screen and (max-width: 768px)` queries throughout `style.css`. Keep the `screen` qualifier — see the PDF Export warning above.

## Important Constants & Configuration

- **Responsive breakpoint:** 768px
- **e-Solat API zone:** WLY01
- **Date format:** ISO 8601 (`YYYY-MM-DD`)
- **GitHub file path:** `kuliah/data/jadual_lengkap.json`
- **Google Sheets:** `Schedule` and `Posters` tabs
- **No lecture marker:** `-- TIADA KULIAH --`
- **Script version:** 15.4 (script.js)
- **Apps Script version:** 6.1 (code.gs)

## Version History

- **15.4.1** (2026-07-06): Fixed PDF export breaking when triggered from a narrow/mobile-width browser — scoped both `@media (max-width: 768px)` blocks to `@media screen and (max-width: 768px)` so mobile header/footer/legend layout can no longer bleed into `@media print`; removed stale `.week-number-cell { writing-mode: vertical-lr; transform: rotate(180deg); }` print rule left over from before the week label became stacked `<span>` letters (was garbling "MINGGU" in printed output)
- **15.4** (2026-06-03): Merged mobile v2 into production (script.js + style.css); redesigned today card header — side-by-side flex layout with dropdown left and two-line date right (`#today-date-gregorian` + `#today-date-hijri`); fixed poster wrapper to true 16:9 with `margin: 0`; added `0.5rem` left/right padding to `#today-kuliah-card`
- **15.3** (2026-05-24): Expanded page container to 98vw; fixed Apps Script skipping empty rows in Schedule sheet (code.gs v6.1); beta mobile v2 — replaced pill tab switcher with `<select>` dropdown, reduced today-card padding
- **15.2.2** (2026-05-23): Fixed Hijri date not loading in mobile view — added `gregorianToHijri()` JS fallback calculator, fixed next-month API URL missing `&month=` param, replaced error throw with silent fallback
- **15.2.1** (2026-04-02): Fixed Vercel asset loading — switched all asset refs and nav links to absolute root-relative paths; set `trailingSlash: false` in `vercel.json`
- **15.2** (2026-01-24): Added Today/Tomorrow dropdown selector in mobile view with dynamic Hijri date, Digital Signage iframe switching for tomorrow_subuh.html and tomorrow_maghrib.html
- **15.1** (2026-01-24): Fixed Digital Signage poster iframe URLs
- **15.0.2** (2026-01-02): All buttons open in new tabs
- **15.0.1** (2026-01-01): PDF buttons hidden on mobile, scrollability improvements
- **15.0** (2025-12-30): URL-based PDF export, mobile PDF support, landing page redesign
- **14.1** (2025-12-01): Holiday labels in print, Edge rotation fix, print styles
- **14.0** (2025-11-01): Next month navigation, dual-view architecture, API integrations
