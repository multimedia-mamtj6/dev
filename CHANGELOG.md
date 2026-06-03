# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

Sub-project changelogs:
- [kuliah/jadual/CHANGELOG.md](kuliah/jadual/CHANGELOG.md) — Lecture schedule system

---

## [15.2.2] - 2026-05-23

### Fixed — `kuliah/jadual`
- **Hijri date not loading in mobile view** — The "Kuliah Hari Ini/Esok" card was failing silently with `Data for target date not found` when the JAKIM e-Solat API did not return an entry for the target date
  - Fixed broken next-month fallback URL: `adjustedMonth` was calculated but never included in the JAKIM API request (`&month=` param was missing)
  - Added `gregorianToHijri()` — pure-JS tabular Islamic calendar converter as fallback when API data is unavailable
  - Hijri date now always renders: API result when available, calculated fallback otherwise
  - Outer catch block also uses the calculator — network/CORS failures no longer show an error string

---

## [15.2.1] - 2026-04-02

### Fixed — `kuliah/jadual`
- Vercel asset loading broken — switched all asset refs and nav links to absolute root-relative paths
- Set `trailingSlash: false` in `vercel.json`

---

## [15.2] - 2026-01-24

### Added — `kuliah/jadual`
- Today/Tomorrow dropdown selector in mobile view
- Dynamic Hijri date when switching to "Kuliah Hari Esok"
- Digital Signage iframe switching for tomorrow_subuh/maghrib pages

---

## [15.1] - 2026-01-24

### Fixed — `kuliah/jadual`
- Digital Signage poster iframe URLs corrected

---

## [15.0.2] - 2026-01-02

### Changed — `kuliah/jadual`
- All navigation buttons now open in new tabs

---

## [15.0.1] - 2026-01-01

### Fixed / Changed — `kuliah/jadual`
- PDF buttons hidden on mobile to prevent Chrome crash
- Landing page scrollability improved
- Informational note added below footer

---

## [15.0] - 2025-12-30

### Added — `kuliah/jadual`
- URL-based PDF export (`?file=pdf`, `?file=pdf&bulan=depan`)
- Mobile PDF printing support
- PDF export buttons on landing page
- MAMTJ6 logo on landing page
- Section labels for visual organization

---

## [14.1] - 2025-12-01

### Fixed / Added — `kuliah/jadual`
- Holiday labels now print with correct background colour
- Vertical week text rotation fixed for Edge browser
- Complete `@media print` stylesheet added
- Dynamic month names on navigation buttons

---

## [14.0] - 2025-11-01

### Added — `kuliah/jadual`
- Next month navigation (`?bulan=depan`)
- Dual-view architecture: desktop calendar table + mobile card list
- JAKIM e-Solat API integration for Hijri dates
- Digital Signage poster integration via iframe
