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
├── script.js               # Rendering logic (v15.2)
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

**Display control:** CSS `@media (max-width: 768px)` query toggles visibility between views.

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
- Vertical text using `writing-mode: vertical-lr`
- 180° rotation with vendor prefixes for Edge compatibility (style.css:45)

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
- Poster wrapper uses `aspect-ratio: 16 / 9` for responsive sizing

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
Change the `768px` value in `@media (max-width: 768px)` queries throughout `style.css`.

## Important Constants & Configuration

- **Responsive breakpoint:** 768px
- **e-Solat API zone:** WLY01
- **Date format:** ISO 8601 (`YYYY-MM-DD`)
- **GitHub file path:** `kuliah/data/jadual_lengkap.json`
- **Google Sheets:** `Schedule` and `Posters` tabs
- **No lecture marker:** `-- TIADA KULIAH --`
- **Script version:** 15.2 (script.js)
- **Apps Script version:** 6.0 (code.gs)

## Version History

- **15.2.1** (2026-04-02): Fixed Vercel asset loading — switched all asset refs and nav links to absolute root-relative paths; set `trailingSlash: false` in `vercel.json`
- **15.2** (2026-01-24): Added Today/Tomorrow dropdown selector in mobile view with dynamic Hijri date, Digital Signage iframe switching for tomorrow_subuh.html and tomorrow_maghrib.html
- **15.1** (2026-01-24): Fixed Digital Signage poster iframe URLs
- **15.0.2** (2026-01-02): All buttons open in new tabs
- **15.0.1** (2026-01-01): PDF buttons hidden on mobile, scrollability improvements
- **15.0** (2025-12-30): URL-based PDF export, mobile PDF support, landing page redesign
- **14.1** (2025-12-01): Holiday labels in print, Edge rotation fix, print styles
- **14.0** (2025-11-01): Next month navigation, dual-view architecture, API integrations
