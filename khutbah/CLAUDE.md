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

- `paparan-tajuk.html` — Standalone full-screen display (centered card layout, spinner shown while loading, "Loading..."/"TIADA DATA"/"ERROR" states).
- `beta-paparan-tajuk.html` — Variant tuned for embedding inside a Google Sites iframe (`height: 100vh`/`100vw`, `overflow: hidden`, no scrollbars, no loading/error text states).
- `google_app_script/` — Placeholder `.gs` files (`gettajukkhutbah.gs`, `KhutbahLinkGenerator.gs`, `refresh.gs`) for future Apps Script automation; currently empty.

## Data Format

Both pages fetch the same published CSV and read row index `1` (second row, i.e. the first data row after the header):

- `rows[1][1]` → sermon title (`.title`)
- `rows[1][2]` → date (`.date`)
- `rows[1][3]` → sermon theme/text (`.main-text`)

The CSV URL is hardcoded as `sheetURL` in each file's `<script>`. To change the data source, update `sheetURL` in **both** HTML files.

## Key Patterns

- **Auto font-sizing**: `.main-text` font size is adjusted based on text length (and, in the beta version, by shrinking the font in a loop until it fits its container) so long sermon titles don't overflow.
- **Polling**: data is re-fetched every 60s; if the fetched row is identical to the last one (`lastFetchedData`), the DOM is left unchanged to avoid unnecessary re-renders/flicker.
- **Responsive**: `paparan-tajuk.html` has a `@media (max-width: 768px)` block for mobile sizing; `beta-paparan-tajuk.html` instead uses viewport-relative units (`vh`/`vw`/`clamp()`) throughout, so no separate mobile breakpoint is needed.
