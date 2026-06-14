# Developer Guide — waktu-solat

Technical reference for the `waktu-solat/` prayer times suite. Year-round
(not Ramadan-specific), three static entry points, no build step.

For session-by-session implementation history of `widget.html` (arc
geometry decisions, animation iterations, embed-mode debugging), see
`DEV_NOTES.md`. For the high-level architecture map, see `CLAUDE.md`. This
file is the function/API/CSS reference for all three pages.

## File Structure

```
waktu-solat/
├── index.html               # Main schedule + infaq page (entry point)
├── info.html                # Documentation / info page
├── widget.html               # Embeddable SVG-arc countdown widget
├── sw.js                     # Service worker (cache-first)
├── vercel.json                # Deployment rewrites
├── site.webmanifest           # PWA manifest
├── archive/
│   └── widget.html          # Old pre-SVG-arc widget (historical, unused)
├── test/
│   ├── embed_test.html      # Iframe embed test harness for widget.html
│   └── test_file.html       # Unrelated "Mimbar Jumaat" leftover
├── CLAUDE.md                  # Architecture map (Claude Code instructions)
├── DEV_NOTES.md               # Session handoff log for widget.html
├── gsites_embeded_guide.md    # Embed-mode / Google Sites reference
├── README.md                  # User-facing documentation (Malay)
└── developer.md               # This file
```

## Pages

### `index.html` — main schedule + infaq page

- **Zone selector** (`#zone-select`) — 61 zones grouped by state, compact
  text when closed (`Negeri - KOD`), full detail (`KOD — daerah`) on focus
- **GPS detection** — auto-runs on first visit when no zone is saved, plus
  a manual 📍 GPS button (`#gps-btn`)
- **Share button** (`#share-btn`) — shares/copies `?location={zone}` URL
  with zone info (state, zone code, district)
- **"Info Hari Ini"** (`.today-container`) — embeds `widget.html` via an
  iframe (`#prayerWidgetFrame`), built by `updatePrayerWidgetFrame()`. All
  countdown/progress-arc UI lives in `widget.html`, not here
- **Infaq & Wakaf** (`.infaq-section`) — DuitNow QR (QuickChart.io, desktop
  only via `@media (min-width: 601px)`) + donation button linking to
  `infaq.mamtj6.com`
- **Schedule tables** — desktop table (`#desktop-schedule-table`) + mobile
  cards (`#mobile-schedule-table`), today-row highlight, midnight
  auto-refresh via `scheduleMiddnightRefresh()`
- **PWA** — registers `/jadual-waktu/sw.js`, shows an update toast on new
  service-worker versions

~1240 lines.

### `info.html` — documentation page

De-branded (Session 8) from "Ramadan 2026" to generic "Jadual Waktu Solat".
Sections with shareable anchors (`info.html#section`):

| Anchor | Section | Summary |
|---|---|---|
| `#tentang` | Tentang Projek | CSR project overview, feature list |
| `#sumber` | Sumber Data | JAKIM / Waktu Solat API credits |
| `#data` | Ketepatan Data | Accuracy disclaimers, verify with local mosque |
| `#waktu` | Peringatan Ketepatan Waktu | MST SIRIM widget (iframe), device time-sync tips |
| `#pwa` | Pasang Sebagai Aplikasi (PWA) | Android/iOS/Desktop install guides, offline app-shell note |
| `#infaq` | Infaq & Wakaf | Link to `infaq.mamtj6.com` |
| `#berkaitan` | Pautan Berkaitan | External links + contact |

Deliberately untouched during de-branding: Imsak/Subuh/Berbuka terminology
(core feature labels, not branding), and `og:image`/`og:url` (live hosting
paths under `/info/jadual/`, infra not display).

~526 lines.

### `widget.html` — embeddable SVG-arc widget

The most actively developed file — see `DEV_NOTES.md` for deep
implementation history. Functional summary:

- SVG quadratic-bezier arc spanning Subuh → Isyak, with 6 prayer dots
  (Subuh, Syuruk, Zohor, Asar, Maghrib, Isyak) plus a label-only "Waktu
  Duha" virtual period (28 min after Syuruk to 10 min before Zohor)
- Top bar: zone selector (left, same grouped-dropdown pattern as
  `index.html`) + Gregorian/Hijri date (right)
- Live countdown + info bar (current/next prayer, each with a Material
  Symbols icon from `PRAYER_ICONS`)
- Progress arc grows from Subuh to "now", with a glowing progress-tip dot
- Pulse animations: current-prayer dot gets a gold ripple ring
  (`#pulseRing`); in the last 10 minutes before the next prayer, the
  countdown turns `--error` red and opacity-pulses (`.warning` /
  `pulse-warning` keyframes), and the next-prayer dot gets a red ripple
  ring (`#pulseRingNext`) while the current dot's gold ring hides
- Responsive: `@media (max-width: 360px)` compact layout, plus
  `body.large-viewport` (≥768×480) for scale-up on desktop/signage
- Light/dark theming via CSS variables, `?mode=dark` forces dark

~1047 lines. No OG tags (not a share target — used in iframes/embeds).

## API Endpoints

| Service | URL | Used by |
|---|---|---|
| Zones list | `https://api.waktusolat.app/zones` | `index.html`, `widget.html` |
| Prayer times | `https://api.waktusolat.app/v2/solat/{zone}?year={year}&month={month}` | `index.html`, `widget.html` |
| GPS zone lookup | `https://api.waktusolat.app/v2/solat/gps/{lat}/{long}` | `index.html` |
| DuitNow QR | `https://quickchart.io/qr/...` | `index.html` (infaq) |
| MST SIRIM widget | `https://mst.sirim.my/widget` | `info.html` |
| Infaq portal | `https://infaq.mamtj6.com/` | `index.html`, `info.html` |

### Zones list response

```json
[
  { "jakimCode": "PHG03", "negeri": "Pahang", "daerah": "Jerantut, Temerloh, Maran..." }
]
```

Field names are `jakimCode` / `negeri` / `daerah` — **not** `state` or
`zone` (those return `undefined`).

### Prayer times response

```json
{
  "prayers": [
    { "day": 19, "hijri": "1447-09-01", "fajr": 1740009600, "syuruk": ..., "dhuhr": ..., "asr": ..., "maghrib": 1740052800, "isha": ... }
  ]
}
```

`hijri` is `"YYYY-MM-DD"` — used directly for Hijri date display (see
"Arc Geometry & Widget Internals" below), no extra fetch needed.

Example: `https://api.waktusolat.app/v2/solat/PHG03?year=2026&month=2`

## Key Functions — `index.html`

| Function | Purpose |
|---|---|
| `getSavedZone()` | Reads `?location=` → `localStorage('selectedZone')` → defaults `PHG03` |
| `saveZone(zoneCode)` | Saves to localStorage, updates URL via `history.replaceState()` |
| `loadZones()` | Fetches zones API, groups by state, populates dropdown (focus/blur compact-full swap) |
| `fetchData()` | Fetches current month's prayer times, renders desktop table + mobile cards |
| `shareLink()` | `navigator.share()` on mobile / clipboard fallback on desktop; includes zone info |
| `detectZoneByGPS()` | `navigator.geolocation` → GPS zone-lookup API, returns zone code or null |
| `triggerGPSDetection()` | Manual GPS button handler — `.loading` pulse, re-detects, reloads data |
| `updatePrayerWidgetFrame(zoneCode)` | Builds `#prayerWidgetFrame` iframe `src`: `widget.html?embed=1&selector=hide&date=hide&zone={zone}` (+ `testTime` passthrough) |
| `showSimpleToast(message, type)` | Self-dismissing (3s) toast; `type='error'` → red |
| `isToday(day, month, year)` | Checks date against `getTestDate()` |
| `calculateImsak(fajrTimestamp)` | Returns `fajrTimestamp - 600` (10 min before Subuh) |
| `getDayOfWeek(timestamp)` | Malay day name |
| `formatTime(timestamp)` | 12-hour AM/PM format |
| `formatMalayDate(day, month)` | e.g. `"19 Feb"` |
| `formatHijri(hijri)` | Parses `"YYYY-MM-DD"` → `"DD MonthName"` |
| `getHijriYear(hijri)` | Extracts Hijri year |
| `getTestDate()` | Reads `?testDate=`/`?testTime=`, returns `Date` |
| `getNow()` | `Date.now() + timeOffset` |
| `scheduleMiddnightRefresh()` | Auto-calls `fetchData()` at 00:00:05, reschedules recursively |

## Arc Geometry & Widget Internals — `widget.html`

### Arc geometry constants

```js
const ARC_W      = 360;      // SVG coordinate width
const ARC_PAD_X  = 20;
const DOT_PAD_X  = ARC_PAD_X; // = 20
const ARC_TOP_Y  = 14;
const ARC_BOT_Y  = 70;
const CTRL_Y     = 2 * ARC_TOP_Y - ARC_BOT_Y; // = -42
const VIEW_H     = 120;
```

Arc path: `M 20,70 Q 180,-42 340,70`.

**Critical invariant:** `CTRL_Y = 2*ARC_TOP_Y - ARC_BOT_Y` must hold so
`arcY(x)` matches the actual bezier path.

### PRAYER_ICONS (Material Symbols Rounded)

```js
const PRAYER_ICONS = {
  Subuh:   'wb_twilight_2',
  Syuruk:  'wb_twilight',
  Duha:    'wb_twilight',
  Zohor:   'sunny',
  Asar:    'partly_cloudy_day',
  Maghrib: 'wb_twilight',
  Isyak:   'bedtime',
};
```

### HIJRI_MONTH_NAMES

Lookup keyed `'01'`–`'12'` (Muharram…Zulhijjah). Combined with the API's
`todayPrayer.hijri` field to render e.g. `"Khamis, 11 Jun 2026 / 15
Zulhijjah 1447H"` — no extra API call needed.

### 10-minute warning system

When `diff <= 10*60*1000` (10 min to next prayer), `tick()` sets
`isWarning = true` each second:

- `#countdown` gets `.warning` → `color: var(--error)` +
  `@keyframes pulse-warning` (opacity 1 ↔ 0.4, 1s loop). No size/scale
  change.
- `#pulseRingNext` (next-prayer dot, red/`--error` ripple) becomes visible.
- `#pulseRing` (current-prayer dot, gold ripple) hides — focus shifts to
  the upcoming prayer.

### Key functions

| Function | Purpose |
|---|---|
| `timeToX(tsMs)` | Maps prayer Unix-ms timestamp → SVG x |
| `arcY(x)` | Maps SVG x → y on the bezier arc |
| `arcPointAtT(rawT)` | Returns `{x, y}` on the arc at progress `t ∈ [0,1]` |
| `progressArcPath(t)` | de Casteljau bezier split; SVG path for elapsed portion |
| `buildArcSvg()` | Builds the full SVG; returns `{ svg, currentIdx, displayCurrentIdx, nextIdx }` |
| `renderArc()` | Inserts SVG, starts pulse + countdown `tick()`, sets icons/labels |
| `tick()` | Per-second: updates countdown, warning flags, progress arc + tip |
| `startPulseAnimation()` | rAF loop animating `#pulseRing`/`#pulseRingNext` `r`/`opacity` |
| `getNow()` | `Date.now() + timeOffset` |
| `fmt24(tsMs)` | Formats Unix ms → `HH:MM` (24h) |
| `sizeSelect()` | Canvas-measures dropdown text, resizes `#zoneSelect` (+32px padding) |
| `loadZones()` | Fetches zones API, builds grouped dropdown (same pattern as `index.html`) |
| `getSavedZone()` | Reads `?zone=` → `localStorage('selectedZone')` → `PHG03` |
| `saveZone(code)` | Saves to localStorage + updates `?zone=` in URL (no reload) |
| `fetchPrayerTimes()` | Fetches API data, computes `duhaStart`/`duhaEnd`, builds date text |
| `scaleWidgetToFit()` | Scales `.widget` via `transform: scale()` to fit viewport — shrink (embed) or grow up to `MAX_SCALE=3` (large viewport) |
| `updateViewportMode()` | Toggles `body.large-viewport` when width ≥768px and height ≥480px |
| `initEmbedMode()` | Sets `body.embed-mode` if `?embed=1` |
| `initSelectorMode()` | Sets `body.hide-selector` if `?selector=hide` |
| `initDateMode()` | Sets `body.hide-date` if `?date=hide` |
| `initThemeMode()` | Sets `body.dark-mode` if `?mode=dark` |
| `initTestTime()` | Reads `?testTime=`/`?testDate=`, sets `timeOffset` |
| `svgEl(tag)` | `document.createElementNS(SVG_NS, tag)` helper |
| `themeColor(triplet, alpha)` | `rgba(triplet, alpha)` helper |

### Data structures

```js
prayerList = []        // [{ name, ts }] for Subuh, Syuruk, Zohor, Asar, Maghrib, Isyak (Unix ms)
tomorrowFajr           // Unix ms — tomorrow's Subuh, used post-Isyak
duhaStart, duhaEnd      // Unix ms — Syuruk+28min to Dhuhr-10min, label-only
```

### Current visual spec

| Layer | stroke | stroke-width | opacity |
|---|---|---|---|
| Background arc (full) | white | 2 | 0.15 |
| Progress arc (elapsed) | white | 4 | 0.85 |
| Current dot | white | 2.5 | fill = card bg |
| Pulse ring (current) | gold | 1.5 | 0.7→0 animated |
| Pulse ring (next, warning) | error red | 1.5 | 0.7→0 animated |
| Past dot | white | 1.5 | fill 0.15, stroke 0.4 |
| Next dot | white | 1.5 | fill 0.95 |
| Future dot | white | 1.5 | fill 0.5 |

Label offsets: `timeOffset = r + 13`, `nameOffset = timeOffset + 11`.

### Color theme variables

- Light (default): `--bg: #f3f7f5`, `--card-bg: #ffffff`, `--ink: 16,61,41`
- Dark (`?mode=dark` or `prefers-color-scheme`): `--bg: #0d1117`,
  `--card-bg: #161b22`, `--ink: 255,255,255`
- Accent gold: `245,166,35`; `--error`: `220,38,38` (light) /
  `255,80,80` (dark)
- Alpha tiers: `a15`…`a95` (per-theme contrast adjustments)

## URL Parameters

### `index.html`

| Parameter | Example | Description |
|---|---|---|
| `location` | `?location=JHR01` | Load specific zone |
| `testDate` | `?testDate=2026-02-20` | Simulate date |
| `testTime` | `?testTime=18:30` | Simulate time (ticks forward live) |

Combine: `?location=JHR01&testDate=2026-02-20&testTime=12:00`

### `widget.html`

| Parameter | Example | Description |
|---|---|---|
| `zone` | `?zone=JHR01` | Zone code (checked before localStorage) |
| `embed` | `?embed=1` | Transparent page bg, scale-to-fit for iframes |
| `selector` | `?selector=hide` | Hide zone dropdown (independent of `embed`) |
| `date` | `?date=hide` | Hide footer date bar |
| `mode` | `?mode=dark` | Force dark theme |
| `testDate` | `?testDate=2026-02-20` | Simulate date |
| `testTime` | `?testTime=18:30` | Simulate time |

`index.html` builds its embed iframe `src` as:
`widget.html?embed=1&selector=hide&date=hide&zone={zone}` (+ `testTime`
passthrough).

**Gotcha**: `&embed=1`, not `&?embed=1` — a stray second `?` makes `?embed`
part of the param name, so `params.get('embed')` returns `null`.

For standalone embedding (Google Sites etc.), see
`gsites_embeded_guide.md`.

## localStorage Keys

| Key | Value | Used by |
|---|---|---|
| `selectedZone` | Zone code, e.g. `"PHG03"` | `index.html`, `widget.html` |

## Service Worker (`sw.js`)

- `CACHE_NAME = mamtj6-jadual-waktu-ramadan-v1.6.4` (legacy naming, see
  Known Issues)
- Cache-first strategy; old caches matching the
  `mamtj6-jadual-waktu-ramadan-` prefix purged on activate
- Precaches the app shell only: `./`, `index.html`, `info.html`, favicons,
  manifest, and external logo/background assets
- Prayer data from the API is **never** cached — always fetched fresh
- **When changing any cached file, bump `CACHE_NAME`** and hard-refresh
  (`Ctrl+Shift+R`) to verify

## `vercel.json`

```json
{
  "rewrites": [
    {
      "source": "/",
      "has": [{ "type": "query", "key": "location" }],
      "destination": "/api/og"
    }
  ]
}
```

Rewrites `/` → `/api/og` when `?location=` is present, in preparation for
dynamic OG-image generation (backend not yet implemented).

## CSS Class Reference

### `index.html`

- `.zone-selector`, `.zone-row` — zone selector layout
- `#zone-select` — zone dropdown
- `.gps-btn`, `.gps-btn.loading` — GPS button + pulse animation
- `.share-btn` — share button (pill)
- `.today-container` — "Info Hari Ini" container
- `.prayer-widget-embed` — iframe wrapper for `widget.html` (aspect-ratio
  `550/300`)
- `.infaq-section`, `.infaq-qr`, `.infaq-button` — infaq/wakaf section
- `#desktop-schedule-table`, `#mobile-schedule-table` — responsive table/cards
- `tr.today`, `.mobile-day-today` — today-row highlight
- `.simple-toast`, `.simple-toast.error`, `.simple-toast.fade-out` — toasts
- `.update-toast`, `.update-toast.hidden` — PWA update notification

### `widget.html`

- `.widget` — main card container
- `.top-bar`, `.location-bar`, `#zoneSelect`, `.footer-bar`/`#dateText` —
  top row (zone selector + date)
- `#arcContainer` — SVG arc, dots, labels, progress tip
- `.info-bar`, `.info-side.left/.right`, `.countdown-block`,
  `.countdown-display.warning` — countdown/info bar
- `body.embed-mode` — transparent page, scale-to-fit (iframe embeds)
- `body.hide-selector` / `body.hide-date` — chrome toggles
- `body.dark-mode` / `body.large-viewport` — theming and scale-up

## Testing

`?testDate=`/`?testTime=` work across `index.html` and `widget.html`:

```
index.html?location=JHR01
index.html?testDate=2026-02-20&testTime=06:00
widget.html?zone=JHR01&testTime=18:30
widget.html?testTime=05:00     → before Subuh (progress arc full, Isyak pulsing)
widget.html?testTime=09:30     → Waktu Duha window
widget.html?testTime=18:25     → 10-min warning before Maghrib
widget.html?embed=1&testTime=18:30  → iframe-embed chrome
```

Serve via `python -m http.server` — `file://` won't work (JSON fetches
need CORS).

## Known Issues

- **Color theming** — `widget.html`'s arc accents are tuned per light/dark
  theme but the overall visual language still assumes a dark card in embed
  mode (see `gsites_embeded_guide.md` §1 — "transparent page, opaque card")
- **GPS auto-detection** — implemented in `index.html` only, not in
  `widget.html`
- **Legacy "ramadan" naming** — `sw.js` `CACHE_NAME` and
  `site.webmanifest` (`name`/`short_name`/`start_url: /jadual-waktu/`)
  still carry pre-de-branding naming; cosmetic, not functional
- **`test/test_file.html`** — unrelated "Mimbar Jumaat" sermon page,
  flagged as out-of-place leftover, don't remove without asking

## Other Docs in This Folder

- **`CLAUDE.md`** — architecture map / Claude Code instructions
- **`DEV_NOTES.md`** — session handoff log for `widget.html` (read first
  for implementation history, design decisions, and animation internals)
- **`gsites_embeded_guide.md`** — embed-mode reference (`?embed=1`
  scale-to-fit algorithm, Google Sites pattern)
- **`README.md`** — user-facing documentation (Malay)

For development history (why things are the way they are), see
`DEV_NOTES.md` and git history — this file intentionally has no version
changelog.
