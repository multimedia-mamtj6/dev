# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kalkulator Petrol Madani (MAMTJ6 Petrol Calculator) — a Malaysian petrol subsidy calculator that helps users estimate fuel costs and savings under the Budi Madani RON95 subsidy scheme. Version 4.0. All UI content is in Malay (Bahasa Melayu).

## Tech Stack

- Vanilla HTML5, CSS3, JavaScript (ES6+) — no frameworks, no build tools, no npm
- Google Fonts: Inter
- Pure static site, no external APIs or data files

## Development

No build, lint, or test commands. Open `kalkulator-budi95.html` directly in a browser or serve with any static server. The `beta/` directory is a testing mirror with the same file structure.

## Architecture

The app is a single-page calculator with **3 tabs** sharing one `script.js` and one `styles.css`:

```
kalkulator-budi95.html  ← Main calculator page (3 tabs)
script.js               ← All calculation logic for all 3 tabs
styles.css              ← All styles (CSS custom properties, responsive)
source.html             ← Credits/references page (static, no JS logic)
beta/                   ← Testing mirror (same files, independent copy)
```

### Tab Architecture (in script.js)

All logic runs inside a single `DOMContentLoaded` listener with three independent calculator sections:

1. **Tab 1 — Kalkulator Petrol**: Has two sub-versions (Complete and Simple) toggled via `version-toggle-btn`. Complete version offers radio-button price selection (subsidy vs pump price); Simple version always calculates against subsidy price.
2. **Tab 2 — Isi 'Full Tank'**: Tank capacity calculator with a visual fuel gauge. Dynamically generates bar elements in `#fuel-gauge-visual` with staggered animation delays.
3. **Tab 3 — Dulu vs. Sekarang**: Before/after comparison calculator using hardcoded reference prices.

Each tab has its own: form, mode toggle (RM/Liter), reset function, calculate function, and results section. They share no state.

### Input Mode Pattern

All calculators use a RM/Liter toggle that changes the input label, step precision (`0.01` for RM, `0.001` for Liter), and calculation direction. The mode state is tracked per-calculator (`currentMode`, `currentModeSimple`, `currentModeDvs`).

## Key Patterns

- **Tab switching**: CSS class `.active` on both `.tab-btn` and `.tab-content` elements, matched via `data-tab` attribute
- **Visibility**: `.hidden` class with `display: none !important` — used extensively for showing/hiding results, version containers, and conditional result items
- **Results animation**: `.fade-in` class triggers `fadeInAnimation` (0.6s ease-out translateY), plus `scrollIntoView({ behavior: 'smooth' })` after calculation
- **Result highlighting**: `.result-item-primary` for the main result (large green text), `.savings` (green) and `.cost-increase` (red) for comparison values
- **CSS custom properties**: All colors defined in `:root` — `--primary-blue`, `--success-green`, `--warning-red`, etc.
- **Responsive breakpoints**: 768px (DVS grid to single column), 640px (all result grids to single column, reduced padding)

## Hardcoded Price Constants

Prices appear in multiple places and must be updated together:
- `script.js` — `OLD_PRICE_REF` (2.05), `SUBSIDY_PRICE` (1.99), `PUMP_PRICE` (2.60) for Tab 2; `OLD_PRICE_DVS`, `NEW_SUBSIDY_PRICE_DVS`, `NEW_PUMP_PRICE_DVS` for Tab 3
- `script.js` — Default `input.value` assignments in reset functions for Tab 1 (`'2.05'`, `'1.99'`, `'2.60'`)
- `kalkulator-budi95.html` — `value` attributes on price input fields, toggle button labels in Tab 2 (`RM 1.99`, `RM 2.60`), and the price info banner in Tab 3
