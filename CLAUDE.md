# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static website for Masjid Al-Mukhlisin Tamanジュta 6 (MAMTJ6) — a Malaysian mosque's digital presence. Contains multiple sub-projects: lecture schedule system, Islamic calendar, digital signage, and utility tools. All content is primarily in Malay (Bahasa Melayu). Hosted at `dev-data.mamtj6.com` via GitHub Pages with Vercel as alternate deployment.

## Tech Stack

- Pure static HTML5, CSS3, Vanilla JavaScript (ES6+) — **no npm, no build tools, no frameworks**
- Tailwind CSS via Play CDN (`darkMode: 'class'`)
- Google Fonts: Inter
- External APIs: e-Solat JAKIM (Hijri dates, zone `WLY01`), SIRIM MST (Malaysia Standard Time)
- Google Sheets as CMS → Google Apps Script syncs JSON to GitHub via API
- Deployment: GitHub Pages (auto on push), Vercel (trailing slash enabled)

## Development

No build, lint, or test commands. Serve locally with any static server:

```bash
python -m http.server
# Open http://localhost:8000
```

Files fetching JSON (kuliah/jadual, calendar) require HTTP server — `file://` won't work due to CORS.

## Architecture

```
index.html                          ← Hub/landing page (ticker, links to sub-projects)

kuliah/
  data/jadual_lengkap.json          ← Monthly schedule (single source of truth, auto-synced)
  jadual/                           ← Schedule system v15.2 (dual-view: desktop table + mobile cards)
  kuliah(beta)/                     ← Beta mirror of jadual/ for testing
  paparan/                          ← Digital signage (4 pages: today/tomorrow × subuh/maghrib)

calendar/hijri/
  data/events.json                  ← Islamic dates (single source of truth, manually updated yearly)
  tarikh-penting/                   ← Main calendar (3-file: index.html + app.js + style.css)
  widgets/                          ← Embeddable countdown widgets for iframe
  hari-ini/                         ← Current Hijri date & MST time widget

csr/calc/                           ← Calculator tool
web/asset/moving-text/              ← Scrolling text ticker
media/                              ← Images, logos (SVG variants: black/white for dark mode)
```

### Data Flow

```
Google Sheet → Google Apps Script → GitHub API push → kuliah/data/jadual_lengkap.json
                                                    → kuliah/paparan/schedule.json

Manual edit → calendar/hijri/data/events.json (updated annually with new Islamic dates)
```

**Never manually edit `jadual_lengkap.json`** — it is overwritten by the Apps Script sync. Use the Google Sheet instead.

### Sub-Project Documentation

Each major sub-project has its own CLAUDE.md with detailed architecture:
- `calendar/hijri/CLAUDE.md` — Calendar system specifics
- `kuliah/jadual/CLAUDE.md` — Schedule system v15.2 internals (dual-view, print, Apps Script)

## Key Patterns

- **Cache-busting** on JSON fetches: `?v=${new Date().getTime()}`
- **Dark mode**: Tailwind `class` strategy, anti-flash `<script>` in `<head>`, localStorage with OS fallback
- **Responsive**: 768px breakpoint for desktop/mobile view switching
- **Date handling**: ISO 8601 (`YYYY-MM-DD`), locale `ms-MY`, timezone-safe parsing with `new Date(date + 'T00:00:00')`
- **Logos**: Separate SVGs toggled via `block dark:hidden` / `hidden dark:block`
- **Print**: A4 landscape, units converted to `pt`, `print-color-adjust: exact` for colors

## Sensitive Files

- `kuliah/jadual/google-app-script/config.json` — Contains GitHub tokens and credentials. **Never commit.**
