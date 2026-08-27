# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Mimbar Jumaat" — a Friday sermon (khutbah) title display screen for MAMTJ6. Shows the current sermon title, date, and theme/text, pulled live from a publicly-published Google Sheet (CSV export). Designed to be displayed on a screen/projector or embedded via Google Sites.

## Tech Stack

Same as the parent project: pure static HTML, no build tools. Each page is fully self-contained (inline `<style>` and `<script>`).

- Data source: a Google Sheet published as CSV (`output=csv`), polled every 60 seconds via `fetch`
- Font: Google Fonts "Poppins"
- Background/logo images served from `multimedia.mamtj6.com`

## Files

- `index.html` — **Current/primary display page.** Copy of `paparan-tajuk.html` with a CSV-quoting fix (see Key Patterns below); this is the one actively maintained going forward.
- `paparan-tajuk.html` — Legacy standalone full-screen display (centered card layout, spinner shown while loading, "Loading..."/"TIADA DATA"/"ERROR" states). Kept as-is; superseded by `index.html`. Still has the unfixed CSV-quoting bug.
- `beta-paparan-tajuk.html` — Variant tuned for embedding inside a Google Sites iframe (`height: 100vh`/`100vw`, `overflow: hidden`, no scrollbars, no loading/error text states). Likely has the same unfixed CSV-quoting bug (not yet verified).
- `google_app_script/` — Working Apps Script automation (`gettajukkhutbah.gs`, `KhutbahLinkGenerator.gs`, `refresh.gs`) that populates the Google Sheet this page reads from. **Not auto-synced**: this folder is a local copy only — changes here must be manually pasted into the live project at script.google.com to take effect. See "Apps Script Automation" below and `DEV_NOTES.md` for the full architecture/gotchas.

## Data Format

Both pages fetch the same published CSV and read row index `1` (second row, i.e. the first data row after the header):

- `rows[1][1]` → sermon title (`.title`)
- `rows[1][2]` → date (`.date`)
- `rows[1][3]` → sermon theme/text (`.main-text`)

The CSV URL is hardcoded as `sheetURL` in each file's `<script>`. To change the data source, update `sheetURL` in **both** HTML files.

## Apps Script Automation (`google_app_script/`)

Three scripts, sharing one Apps Script project's global scope (no per-file isolation — duplicate function names across files silently conflict), running against **two Google Sheet tabs**:

- **Tab 0, "tajuk khutbah"** (`LINK | Title | Date | Main Text`) — `extractKhutbahData()` in `gettajukkhutbah.gs` always targets `getSheets()[0]`, i.e. this tab. Reads the URL in A2, fetches that page, scrapes date → C2 and title → D2.
- **Tab 1, "link extractor"** (`KHUTBAH MINGGU INI | TARIKH | TAJUK KHUTBAH` — column B's header is stale, see below) — `generateKhutbahLink()` in `KhutbahLinkGenerator.gs` targets this tab by name. Computes the upcoming Friday, converts it to Hijri via `api.waktusolat.app` (zone `PHG03`), writes the resulting mufti.pahang.gov.my link to A2, and writes `MIMBAR JUMAAT SIRI {month} | {year}` to B2 (month/year taken from that Friday's date, not today's — deliberate, matters at month boundaries). Also appends a row (`Timestamp | Old Link | New Link | Siri`) to a **"Link Log"** sheet (auto-created on first run) every time it runs.

**"tajuk khutbah"!A2 is a live formula**, `='link extractor'!A2` — this is how tab 1's freshly-generated link reaches tab 0. Formula recalculation does *not* fire Sheets' `onEdit` event (only direct edits do), which is why `generateKhutbahLink()` calls `extractKhutbahData()` directly at the end rather than relying on the edit trigger to cascade. The edit trigger (`onEditTrigger`, installed by `createTrigger()`) instead exists for the separate manual workflow: when mufti.pahang.gov.my changes its URL format, the link is hand-corrected directly in "tajuk khutbah"!A2 — which **replaces the formula with a plain value** until it's manually re-entered.

Triggers (installed via the online Triggers panel, not all created by code in this repo): `onEditTrigger` on any edit (checks for A2 on "tajuk khutbah"), `generateKhutbahLink` weekly (Monday 9am, installed by `scheduleScript()`), and a standalone weekly trigger directly on `extractKhutbahData`. `refresh.gs`'s `onOpen()` adds a "Custom Menu" → "Run Script" item for manual runs; `onOpen2()` is dead code (not a recognized Apps Script simple-trigger name) and `runMyFunction()` is scratch/test code — neither is called by anything.

See `DEV_NOTES.md` for the fuller narrative (bugs found/fixed, why the code is split into 3 files, live-test results).

## Key Patterns

- **Auto font-sizing**: `.main-text` font size is adjusted based on text length (and, in the beta version, by shrinking the font in a loop until it fits its container) so long sermon titles don't overflow.
- **CSV parsing**: `index.html` uses a quote-aware `parseCSVRow(line)` helper instead of a plain `row.split(",")`. Google Sheets' CSV export wraps any field containing a comma in double quotes — a naive `split(",")` truncates those fields at the embedded comma (e.g. a title like `Ibadah Zakat, Wakaf dan Sedekah...` would render as just `Ibadah Zakat`). `paparan-tajuk.html`/`beta-paparan-tajuk.html` still use the naive split and have this bug; if porting fixes, copy `parseCSVRow()` verbatim from `index.html`.
- **Polling**: data is re-fetched every 60s; if the fetched row is identical to the last one (`lastFetchedData`), the DOM is left unchanged to avoid unnecessary re-renders/flicker.
- **Responsive**: `paparan-tajuk.html` has a `@media (max-width: 768px)` block for mobile sizing; `beta-paparan-tajuk.html` instead uses viewport-relative units (`vh`/`vw`/`clamp()`) throughout, so no separate mobile breakpoint is needed.
