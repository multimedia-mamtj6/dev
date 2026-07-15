# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static website for Masjid Al-Mukhlisin Tamanジュta 6 (MAMTJ6) — a Malaysian mosque's digital presence. Contains multiple sub-projects: lecture schedule system, Islamic calendar, digital signage, and utility tools. All content is primarily in Malay (Bahasa Melayu). Hosted via Vercel at `dev.mamtj6.com` (and other custom domains per sub-project, e.g. `multimedia.mamtj6.com` for `calendar/hijri/`).

**`kuliah/` folder history:** as of 2026-07-14, `kuliah/admin/` and `kuliah/jadual/` are the Supabase-backed system (formerly at `kuliah3/`) — this is now the official lecture-schedule system. The older Google-Sheets-backed v15.4 system that used to live at `kuliah/jadual/` moved to `kuliah3/jadual/` (plus `kuliah3/kuliah(beta)/`), kept archived and fully working as a live fallback/reference. `kuliah/data/`, `kuliah/paparan/`, `kuliah/assets/`, `kuliah/gscript/` were untouched by that move — shared infrastructure, unmoved throughout.

## Tech Stack

- Pure static HTML5, CSS3, Vanilla JavaScript (ES6+) — **no npm, no build tools, no frameworks**
- Tailwind CSS via Play CDN (`darkMode: 'class'`)
- Google Fonts: Inter
- External APIs: e-Solat JAKIM (Hijri dates, zone `WLY01`), SIRIM MST (Malaysia Standard Time)
- `kuliah/admin/`: Supabase (PostgreSQL, Auth, Storage) — see `kuliah/CLAUDE.md`
- `kuliah/gscript/` (unmoved): Google Sheets as CMS → Google Apps Script syncs JSON to GitHub via API — independent pipeline, see Data Flow below
- Deployment: Vercel only (auto on push, `cleanUrls: true`, `trailingSlash: false` — see `vercel.json`). GitHub Pages was retired 2026-07-14 — no `CNAME` file, don't reintroduce Pages-specific assumptions (e.g. relying on the repo's default `github.io` URL, or a `gh-pages` branch).

## Development

No build, lint, or test commands. Serve locally with any static server:

```bash
python -m http.server
# Open http://localhost:8000
```

Files fetching JSON (`kuliah/jadual/`, `kuliah3/jadual/`, `calendar/`) require an HTTP server — `file://` won't work due to CORS. `kuliah/admin/`'s Supabase auth and `/api/publish` cannot be exercised under this local method at all (documented limitation, see `kuliah/developer.md`).

## Architecture

```
index.html                          ← Hub/landing page (ticker, links to sub-projects)

kuliah/                              ← Official lecture-schedule system (Supabase-backed)
  admin/                             ← CMS: Google-OAuth admin dashboard, see kuliah/CLAUDE.md
  jadual/                            ← Public schedule view (dual-view: desktop table + mobile cards)
  data/jadual_lengkap.json          ← OLD pipeline's data (Sheets-synced, unmoved — see Data Flow)
  data/jadual_lengkap_v2.json       ← THIS system's published data (Supabase → api/publish.js)
  paparan/                          ← Digital signage (4 pages: today/tomorrow × subuh/maghrib) — drives a
                                        physical screen at the mosque, reads jadual_lengkap.json (OLD pipeline)
  gscript/                          ← Local mirror of the deployed Google Apps Script (Sheets→JSON, Drive→posters)

kuliah3/                             ← Archived v15.4 system (Sheets-backed), kept live as fallback
  jadual/                           ← Same schedule system that used to be at kuliah/jadual/
  kuliah(beta)/                     ← Beta mirror, own Apps Script config (see Sensitive Files)

calendar/hijri/
  data/events.json                  ← Islamic dates (single source of truth, manually updated yearly)
  tarikh-penting/                   ← Main calendar (3-file: index.html + app.js + style.css)
  widgets/                          ← Embeddable countdown widgets for iframe
  hari-ini/                         ← Current Hijri date & MST time widget

khutbah/                             ← Friday sermon (khutbah) title display, polls Google Sheet CSV
csr/calc/                           ← Calculator tool
web/asset/moving-text/              ← Scrolling text ticker
media/                              ← Images, logos (SVG variants: black/white for dark mode)
```

### Data Flow

**Two independent pipelines feed the lecture-schedule system — they are intentionally separate, do not merge them:**

```
Pipeline 1 (unmoved, pre-existing): Google Sheet → Google Apps Script → GitHub API push
                                       → kuliah/data/jadual_lengkap.json
                                       → read by kuliah3/jadual/ (archived system) and kuliah/paparan/ (signage)

Pipeline 2 (Supabase-backed, official system): Admin edits in kuliah/admin/dashboard.html
                                       → Supabase `schedule`/`ustaz` tables
                                       → click Terbitkan → POST /api/publish
                                       → api/publish.js reads Supabase, pushes to GitHub
                                       → kuliah/data/jadual_lengkap_v2.json
                                       → read by kuliah/jadual/ (official public view)
```

```
Manual edit → calendar/hijri/data/events.json (updated annually with new Islamic dates)
```

**Never manually edit `jadual_lengkap.json` or `jadual_lengkap_v2.json`** — both are overwritten by their respective automated sync (Apps Script / `api/publish.js`). Use the Google Sheet or the `kuliah/admin/` dashboard instead, matching whichever pipeline you're actually trying to change.

### Sub-Project Documentation

Each major sub-project has its own CLAUDE.md with detailed architecture:
- `kuliah/CLAUDE.md` — Official Supabase-backed admin+schedule system internals
- `kuliah3/jadual/CLAUDE.md` — Archived v15.4 Sheets-backed system internals (dual-view, print, Apps Script)
- `calendar/hijri/CLAUDE.md` — Calendar system specifics
- `khutbah/CLAUDE.md` — Mimbar Jumaat sermon display specifics

## Key Patterns

- **Cache-busting** on JSON fetches: `?v=${new Date().getTime()}`
- **Dark mode**: Tailwind `class` strategy, anti-flash `<script>` in `<head>`, localStorage with OS fallback
- **Responsive**: 768px breakpoint for desktop/mobile view switching
- **Date handling**: ISO 8601 (`YYYY-MM-DD`), locale `ms-MY`, timezone-safe parsing with `new Date(date + 'T00:00:00')`
- **Logos**: Separate SVGs toggled via `block dark:hidden` / `hidden dark:block`
- **Print**: A4 landscape, units converted to `pt`, `print-color-adjust: exact` for colors

## Sensitive Files

- `kuliah3/jadual/google-app-script/config.json` — Contains GitHub tokens and credentials (template/placeholder values as of last check, not confirmed live). **Never commit real values.**
- `kuliah3/kuliah(beta)/jadual/google-app-script/config.json` — **Contains what appears to be a live, real-format GitHub PAT, flagged unresolved across multiple sessions (see `kuliah/DEV_NOTES.MD`).** Moving this file's folder location does not remediate the exposure — the secret is already in git history regardless of current path. Recommend rotating/revoking it in GitHub settings and replacing the committed value with a placeholder.
- `kuliah/admin/` has no committed config files with secrets — Supabase service-role key and GitHub token are Vercel environment variables, never in browser code or repo files. See `kuliah/admin/database.md` for the full credentials/setup reference.
