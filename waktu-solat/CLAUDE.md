# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static, year-round prayer times (waktu solat) suite for Malaysian
zones, sourced from JAKIM via the Waktu Solat API. The `sw.js` `CACHE_NAME`
prefix (`mamtj6-jadual-waktu-ramadan-`) is a historical artifact from when
this was Ramadan-specific, but the app is no longer tied to Ramadan —
`info.html` was de-branded to "Jadual Waktu Solat" in Session 8.

No build step — pure HTML5/CSS3/vanilla JS, Malay (`lang="ms"`).

## Architecture

Three entry points:

```
index.html    ← main schedule + infaq page (entry point)
info.html     ← documentation / info page
widget.html   ← embeddable SVG-arc countdown widget
```

### `index.html` — main schedule + infaq page

- **Zone selector**: 61 zones grouped by state, compact text when closed,
  full detail (zone code + daerah) on focus
- **GPS detection**: auto-runs on first visit (no saved zone), plus a manual
  📍 GPS button
- **Share button**: copies/shares `?location={zone}` URL with zone info
- **"Info Hari Ini"**: iframes `widget.html` via `updatePrayerWidgetFrame()`
  with `?embed=1&selector=hide&date=hide&zone={zone}` (+ `testTime` passthrough)
  — the countdown/progress-bar UI itself lives entirely in `widget.html`, not here
- **Infaq & Wakaf**: DuitNow QR (QuickChart.io, desktop) / button (mobile) —
  "Variation C" low-pressure redesign from Session 8, `@media (min-width: 601px)` split
- **Schedule tables**: desktop table + mobile cards, today-row highlight,
  midnight auto-refresh

Key functions: `getSavedZone()` / `saveZone()`, `loadZones()`, `fetchData()`,
`shareLink()`, `detectZoneByGPS()` / `triggerGPSDetection()`,
`updatePrayerWidgetFrame(zoneCode)`, `showSimpleToast(message, type)`

URL params: `?location={zoneCode}`, `?testDate=YYYY-MM-DD`, `?testTime=HH:MM`
(combine: `?location=JHR01&testDate=2026-02-20&testTime=12:00`)

### `info.html` — documentation page

De-branded (Session 8) from "Ramadan 2026" to generic "Jadual Waktu Solat".
Sections with shareable anchors (`info.html#section`):

- **Tentang Projek** — overview, CSR designation, feature list
- **Sumber Data** — JAKIM / Waktu Solat API credits
- **Ketepatan Data** — accuracy disclaimers
- **Peringatan Ketepatan Waktu** — MST SIRIM widget (`mst.sirim.my/widget`, iframe)
- **Pasang Sebagai Aplikasi (PWA)** — install guides (Android/iOS/Desktop)
- **Infaq & Wakaf** — link to `https://infaq.mamtj6.com/`
- **Pautan Berkaitan** — external links + contact

Deliberately untouched during de-branding: Imsak/Subuh/Berbuka terminology
(core feature labels, not branding) and `og:image`/`og:url` (live hosting paths).

### `widget.html` — embeddable SVG-arc widget

The most actively developed file. For implementation detail, animation
internals, and session-by-session decision history, **read `DEV_NOTES.md`
first** — this section only covers the high-level shape.

- SVG quadratic-bezier arc spanning Subuh → Isyak, 6 prayer dots (Subuh,
  Syuruk, Zohor, Asar, Maghrib, Isyak) + a label-only "Waktu Duha" virtual period
- Arc geometry constants: `ARC_W=360`, `ARC_PAD_X=20`, `ARC_TOP_Y=14`,
  `ARC_BOT_Y=70`, `CTRL_Y = 2*ARC_TOP_Y - ARC_BOT_Y`
- Live countdown + info bar (current/next prayer with Material Symbols icons)
- Pulse animations: current-prayer dot gets a gold ripple ring;
  next-prayer dot gets a red/`--error` ripple ring + countdown text turns
  red and opacity-pulses during the last 10 minutes before that prayer
- Progress arc grows from Subuh to "now", with a glowing progress-tip dot
- Zone selector (same grouped-dropdown pattern as `index.html`)

URL params: `?zone={code}`, `?embed=1` (transparent bg, scale-to-fit for
iframes), `?selector=hide` (hide zone dropdown, independent of embed),
`?date=hide` (hide date footer), `?testTime=HH:MM`, `?testDate=YYYY-MM-DD`,
`?mode=dark` (force dark theme)

localStorage caching (Session 11): zones cached 24h under `zones_cache`;
prayer times cached per zone+month under `prayers_{zone}_{year}_{month}`.
On return visits the widget renders immediately with zero API calls.
`widget.html` is NOT in the SW precache shell — no `CACHE_NAME` bump
needed when editing it.

Relationship to `index.html`: iframed by it (see above), but also designed
to be embedded standalone elsewhere (e.g. Google Sites — see
`gsites_embeded_guide.md`).

### `sw.js` — service worker

Cache-first strategy. Current `CACHE_NAME`:
`mamtj6-jadual-waktu-ramadan-v1.6.7`. Caches the app shell (`index.html`,
`info.html`, favicons, logo assets) only — prayer data from the API is never
cached, always fetched fresh. Old caches matching the
`mamtj6-jadual-waktu-ramadan-` prefix are purged on activate.

**When changing any cached file, bump `CACHE_NAME`** and hard-refresh
(`Ctrl+Shift+R`) to verify.

### `vercel.json`

`waktu-solat/vercel.json` is **empty (`{}`)** — no rewrites, no headers active here.

CORS and embed-permission headers for `/waktu-solat` and `/waktu-solat/(.*)` live in
the **root `vercel.json`**, not this file. Current state (as of Session 12):
- `Access-Control-Allow-Origin: *` — widget is embeddable from any origin
- No `Content-Security-Policy: frame-ancestors` restriction

If embedding breaks ("Can't embed due to provider site permissions"), look at root
`vercel.json` → `/waktu-solat` header blocks, not here. See `REVERSE_PROXY_FIX.md`
for the full history of why those headers exist.

### `archive/`

`widget.html` — old pre-SVG-arc version of the prayer widget. Historical
only, not in use.

### `test/`

`embed_test.html` — legitimate iframe-embed test harness for `widget.html`
(deliberately small iframe to verify scale-to-fit). `test_file.html` is an
unrelated leftover (a "Mimbar Jumaat" sermon display page) — flag as
out-of-place but don't remove without asking.

## Development

No build step. Serve locally:

```bash
python -m http.server
```

JSON fetches require an HTTP server (CORS) — `file://` won't work.

**Test parameters** (work across `index.html` and `widget.html`):
- `?location=` / `?zone=` — specific zone
- `?testDate=YYYY-MM-DD` — simulate date
- `?testTime=HH:MM` — simulate time (ticks forward live)

## External APIs

| Service | URL | Used by |
|---|---|---|
| Zones list | `api.waktusolat.app/zones` | `index.html`, `widget.html` |
| Prayer times | `api.waktusolat.app/v2/solat/{zone}?year=&month=` | `index.html`, `widget.html` |
| GPS zone lookup | `api.waktusolat.app/v2/solat/gps/{lat}/{long}` | `index.html` |
| DuitNow QR | `quickchart.io/qr` | `index.html` (infaq) |
| MST SIRIM | `mst.sirim.my/widget` | `info.html` |
| Infaq portal | `infaq.mamtj6.com` | `index.html`, `info.html` |

## Other docs in this folder

- **`DEV_NOTES.md`** — session handoff log for `widget.html` (the "read this
  first" doc for picking up `widget.html` work)
- **`gsites_embeded_guide.md`** — embed-mode reference for `widget.html`
  (scale-to-fit algorithm, Google Sites pattern)
- **`developer.md`** / **`README.md`** — currently describe the OLD
  jadual-waktu-era app and are stale (same issue this CLAUDE.md just had).
  Not refreshed in this pass — flag if/when they need updating too.

## Known issues

- Color theming — arc is white-on-dark only; no light variant
- GPS auto-detection in `widget.html` not implemented (only in `index.html`)
- `sw.js` `CACHE_NAME` and `vercel.json` still carry "ramadan"/jadual-waktu
  naming from before the de-branding pass — cosmetic, not functional
