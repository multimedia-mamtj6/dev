# Masjid Al-Mukhlisin - Sistem Jadual Kuliah

A responsive web application for displaying the monthly lecture (kuliah) schedule for Masjid Al-Mukhlisin. Features a traditional calendar view for desktops and a card-based list view for mobile devices.

All schedule data is managed via a single Google Sheet, automatically synced to a JSON file through Google Apps Script.

## Key Features

- **Fully Responsive** — Switches between a full calendar view on desktop and mobile-friendly cards automatically
- **Automated Data Management** — Schedule data is managed in Google Sheets; a Google Apps Script pushes updates to the repository
- **Dynamic Content** — Month name, last-updated date, and public holiday labels are all generated from the JSON data source
- **"Kuliah Hari Ini / Hari Esok" Card** — Mobile view highlights today's or tomorrow's schedule with Hijri date from JAKIM e-Solat API and embedded Digital Signage posters
- **Next Month Preview** — Navigate to the upcoming month's schedule via `?bulan=depan`
- **Print / PDF Export** — Dedicated print stylesheet generates clean A4 landscape PDFs via `?file=pdf`

## Project Structure

```
kuliah/jadual/
├── index.html              # Landing page with navigation buttons
├── jadual.html             # Main schedule page (dual-view: table + cards)
├── script.js               # Core rendering logic (v15.2)
├── style.css               # Responsive + print styles
├── google-app-script/
│   ├── code.gs             # Google Apps Script sync logic (v6.0)
│   ├── config.json         # Credentials — NEVER commit
│   └── index.html          # Web app control panel
├── CHANGELOG.md
├── CLAUDE.md
└── README.md

kuliah/data/
└── jadual_lengkap.json     # Single source of truth (auto-synced, never edit manually)
```

## How It Works

1. **Data Management (Google Sheets)**
   - Two tabs: `Schedule` (daily entries) and `Posters` (lecturer details + poster URLs)
   - Google Apps Script reads both tabs, constructs `jadual_lengkap.json`, and pushes it to GitHub

2. **Client-Side Rendering (`script.js`)**
   - Fetches `kuliah/data/jadual_lengkap.json` with cache-busting (`?v=<timestamp>`)
   - Checks `?bulan=depan` to determine current vs. next month
   - Renders two layouts simultaneously: `<table id="calendar-body">` (desktop) and `<div id="mobile-view-container">` (mobile)
   - Fetches Hijri date from JAKIM e-Solat API (zone `WLY01`) for the mobile "Hari Ini/Esok" card

3. **Responsive Display (`style.css`)**
   - `@media (max-width: 768px)` — hides table, shows mobile cards
   - Above 768px — shows table, hides mobile cards
   - `@media print` — forces table view on all devices for PDF export

## Data Management Workflow

To update the schedule, **only edit the Google Sheet** — never edit `jadual_lengkap.json` directly.

1. **`Posters` sheet** — ensure all lecturers have a `Short_Name`, full name, topic, and poster filename
2. **`Schedule` sheet** — fill in the monthly schedule using `Short_Name` values
3. **Run sync** — Google Sheet menu → `Export Files` → `Update Live Schedule (JSON)`

## Running Locally

The page fetches JSON data so it must be served via HTTP, not `file://`.

```bash
# From the repo root
python -m http.server
```

Open `http://localhost:8000/kuliah/jadual/` in your browser.

## URL Reference

| URL | Page |
|---|---|
| `/kuliah/jadual` | Landing page |
| `/kuliah/jadual/jadual` | Current month schedule |
| `/kuliah/jadual/jadual?bulan=depan` | Next month schedule |
| `/kuliah/jadual/jadual?file=pdf` | Current month PDF export |
| `/kuliah/jadual/jadual?file=pdf&bulan=depan` | Next month PDF export |

> **Note:** `.html` extensions are omitted because Vercel's `cleanUrls: true` serves clean URLs. Local development still works with the full `.html` path.

## Deployment Notes

The site is deployed on Vercel with `cleanUrls: true` and `trailingSlash: false` (`vercel.json` at repo root). Because of this, all asset references (`style.css`, `script.js`) and internal links in HTML files use **absolute root-relative paths** (e.g. `/kuliah/jadual/style.css`) to avoid relative-path resolution issues with clean URLs.

## Customization

- **e-Solat zone** — Change `WLY01` in `script.js` (search for `WLY01`) to match your location
- **Digital Signage URLs** — Update iframe `src` values in `script.js` inside `renderTodayCard`
- **Responsive breakpoint** — Change `768px` in `style.css` `@media` queries
