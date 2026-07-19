# Plan — Pahang Weather-Warning Map Page (csr/weather/)

_Status: **v1 BUILT** (2026-07-18, see "v1 as-built notes"). **v2 BUILT** (2026-07-18, both phases — proxy `api/weather-warning.js` + SEKSYEN parser, see "v2 as-built notes" at the bottom). **⚠️ v2 needs one manual step before it works live: set the `MET_TOKEN` env var in Vercel Dashboard → Project → Settings → Environment Variables, then redeploy.** Sibling of `telegram-warning-plan.md` — same data sources, same matching rules; this covers the WEB PAGE._

## Goal

Evolve the current district-explorer map into a live weather page: when MET issues a warning mentioning Pahang, the affected district polygons highlight automatically on the map, with the warning text and validity shown alongside. No warning → the map is a normal, calm district explorer.

## What already exists (reuse, don't rebuild)

`csr/weather/index.html` already has:
- Leaflet 1.9.4 + CARTO light basemap, centered on Pahang
- District polygons from `mptwaktusolat/jakim.geojson` (`malaysia.district.geojson`, filtered to `state === "PHG"`), each with `feature.properties.name` matching the 11 districts
- `defaultStyle` / `highlightStyle` (hover) / dropdown red highlight via `highlightByName()`
- `.info-box` CSS class (styled, currently unused in markup)

## Data source (verified live 2026-07-18)

- `GET https://api.data.gov.my/weather/warning?contains=Pahang@text_en` — server-side pre-filter works (returned 2 live thunderstorm warnings). Fetch BOTH `text_en` and `text_bm` rows? No — one call filtered on `text_en` is enough in practice, but parse district names from whichever text field matches (MET writes both consistently).
- Fields used: `warning_issue.issued`, `warning_issue.title_bm/en`, `heading_bm`, `text_bm/en`, `instruction_bm`, `valid_from`, `valid_to`.
- No structured location — free text. Format observed: `… • Pahang (Kuantan)` / `Kedah (Kulim and Bandar Baharu)`.

## Page design

```
┌──────────────────────────────────────────────┐
│ H2  Cuaca Pahang — Amaran & Peta Daerah      │
│ [warning banner — only when active warning]  │  ← amber/red bar: heading_bm,
│                                              │     "Sah sehingga {valid_to}",
│                                              │     districts named, expand for full text
│ [Jump-to-district dropdown]   (existing)     │
│ ┌──────────────────────────────────────────┐ │
│ │            LEAFLET MAP                   │ │  ← warning districts filled amber/red;
│ │   (info-box control, top-right:          │ │     whole-state warning = all 11 tinted
│ │    active-warning summary or "Tiada      │ │     lighter + banner carries the weight
│ │    amaran aktif ketika ini")             │ │
│ └──────────────────────────────────────────┘ │
│ Legend: ▪ default ▪ hover ▪ dipilih ▪ AMARAN │
│ Footer: Sumber MET Malaysia / data.gov.my ·  │
│         dikemaskini {fetch time} · auto 15min │
└──────────────────────────────────────────────┘
```

- **Malay-first UI** (site convention), keep the English page title internals as-is or translate — low priority.
- **No fake "all clear":** when no warning matches, info-box says "Tiada amaran aktif ketika ini" with the last-checked time — never imply MET said "safe".

## Implementation

### 1. Style layering — fix the reset conflict FIRST (prerequisite)
Current code uses a static `defaultStyle` object; `geojsonLayer.resetStyle(e.target)` on mouseout would wipe any warning highlight. **Replace the static style with a style function** consulting module state:

```js
let warningDistricts = new Set();   // e.g. {"Kuantan","Pekan"}
function baseStyle(feature) {
  return warningDistricts.has(feature.properties.name) ? warningStyle : defaultStyle;
}
// L.geoJSON(data, { style: baseStyle, ... })
```
Leaflet's `resetStyle()` re-invokes the layer's style function — so hover-out naturally restores the warning fill with zero extra bookkeeping. After updating `warningDistricts`, call `geojsonLayer.setStyle(baseStyle)` to repaint. `warningStyle`: amber/red fill (e.g. `#f59e0b` fill, `#b45309` border), visually distinct from the dropdown's `#e74c3c` selection red — adjust so the two are never confusable, or restyle the dropdown selection to an outline-only look.

### 2. Warning fetch + parse
- `fetchWithTimeout()` — same 5s AbortController helper as `kuliah/jadual/script.js` (copy it; this repo has no shared JS). **Never block map render on the warning fetch** — map boots first, warnings layer on when they arrive (the session-9 e-solat lesson).
- Filter client-side: skip `valid_to` in the past; skip `title_en === "No Advisory"`.
- **Parse Pahang's districts with a scoped regex, not whole-text substring** (other states' districts appear in the same sentence): `/Pahang\s*\(([^)]+)\)/i` against `text_en` (fallback `text_bm`) → split the capture on `,` / `dan` / `and` → trim → map through the alias table → collect into `warningDistricts`.
- `Pahang` mentioned but NO parenthetical → whole-state warning: banner carries the message, all 11 districts get a lighter tint (`fillOpacity` ~0.35) so the map doesn't scream when MET was only being vague.
- Multiple active warnings → union of districts; banner lists each warning (stacked, newest first).

### 3. Alias table (the silent-failure guard)
MET wording vs GeoJSON `name` will not always agree. Known/expected cases — verify against real bulletins during build and extend:

```js
const DISTRICT_ALIASES = {
  'kuala lipis': 'Lipis',
  'cameron highland': 'Cameron Highlands',  // singular/plural drift
  // add as observed — an unmatched name must console.warn, never silently drop
};
```
Rule: normalize (lowercase, trim) → alias lookup → exact match against the 11 known names → **`console.warn` on anything unmatched** so a new MET spelling is discoverable instead of silently un-highlighted.

### 4. Banner + info-box
- Banner `<div>` above the map, hidden by default: `heading_bm`, districts named (or "seluruh Pahang"), `Sah sehingga {valid_to}` formatted `ms-MY`, tap/click to expand full `text_bm` + `instruction_bm`.
- Reuse the existing `.info-box` class as a Leaflet control (top-right): one-liner summary or "Tiada amaran aktif ketika ini · {HH:MM}".

### 5. Refresh loop
`setInterval` 15 min: refetch → recompute `warningDistricts` → `setStyle(baseStyle)` → update banner/info-box. Also refresh on `visibilitychange` → visible (kiosk/phone returning from background). No meta-refresh — this page is interactive, a full reload would drop the user's zoom/selection.

### 6. GeoJSON resilience (pre-existing gap, fix in passing)
The current `fetch(GEOJSON_URL)` has no error handling and hits `raw.githubusercontent.com` (third-party). Add: timeout + `.catch` showing "Peta tidak dapat dimuatkan" in the map div. Optional hardening later: commit a Pahang-only GeoJSON extract into `csr/weather/data/` and serve it same-origin (smaller file, no third-party dependency, survives upstream repo changes) — recommended but not required for v1.

## Verification

1. Node harness (the established `vm` technique) for the pure parts: the Pahang-parenthetical regex + alias normalization against real bulletin strings — including today's live `"… • Pahang (Kuantan)"`, a state-only mention, a multi-district `(X, Y dan Z)` form, and an unmatched-name case asserting the `console.warn` path.
2. Browser (`python -m http.server`): mock the warning fetch with a stub returning fixture warnings → confirm highlight, banner, whole-state tint, hover-out NOT wiping warning fill (the style-function fix), dropdown selection coexisting with warning fill.
3. Live: there are real Pahang thunderstorm warnings most weeks — confirm end-to-end on a day one is active (2026-07-18 had two).

## Relationship to the Telegram plan

- Same source, same "Pahang net, district detail" rule — keep the regex/alias logic textually identical in both codebases (page JS and Apps Script) since they can't literally share code.
- The MET image crop (telegram-warning-plan.md v1.1) is now **Telegram-only** — this vector map supersedes it for the web page.

## Out of scope (v1)

- 7-day Temerloh forecast section (`forecast?contains=Ds061@location__location_id` — verified working earlier) — natural later addition to this same page, not part of the map-warning build.
- Earthquake endpoint, other states.
- Dark mode (site pattern exists; add when the page graduates from tool to public-facing).

---

## Reference file: `region_mapping.json`

District/town mapping **courtesy of Ker, myWX (mywx.kerserver.org), shared privately 2026-07** — his project is not open source; keep this credit if the file is ever reused or the repo goes public. Built empirically from years of real MET bulletins: keys are MET's observed area names (states, directional groupings like `east-johor`, Sabah regions like `west-coast`/`interior`, division keys), values are member districts/towns.

**Why it matters for this page:** the `"pahang"` entry is exactly our 11 districts with no sub-district towns or regional groupings — third-party empirical confirmation that MET references Pahang at district level only, i.e. our district parsing + alias table covers the Pahang case fully. **Not wired into the running page** (our map's unit is already the district); kept as (a) a catalogue of MET naming quirks (`n.-sembilan` abbreviation, `selangor` absorbing KL/Putrajaya, `mersing` including islands) for future alias debugging, and (b) a ready-made expansion table if this page or the Telegram bot ever covers states with messy MET naming (Sabah/Sarawak/Perak).

## v1 as-built notes (2026-07-18 — deviations/additions vs the plan above)

All plan sections implemented as written, plus the things that emerged during/after the build:

1. **Marine-bulletin scope (found via a real production bug the same day):** the "no parenthetical → whole-state" fallback misfired on a live *marine* bulletin ("…waters of … Pahang …"), painting all 11 land districts amber for an offshore-only warning. Fixed: `isMarineBulletin()` detects `waters of` / `perairan` phrasing → new scope `'marine'` → shown in the banner with 🌊 + "Perairan Pahang sahaja (bukan kawasan darat)" but contributes NOTHING to map highlighting. Regression-tested against the exact live payload (marine warning + already-terminated Kuantan warning together).
2. **`?testWarning=` fixture mode** (same convention as `waktu-solat`'s `?testDate=`): `none` | `state` | `marine` | `district:Temerloh` | `district:Kuantan,Pekan`. Replaces only the network fetch — the real parse/compute/render path runs on the fixture. Purple dashed "🧪 MOD UJIAN AKTIF" banner makes test mode unmistakable; polling is disabled in test mode.
3. **Refresh interval reduced 15 min → 3 min** (user request) — `REFRESH_MS` + footer text. ~480 API calls/day per open tab; fine for data.gov.my, but revisit if this page ever drives an always-on kiosk wall of tabs.
4. **Termination-bulletin guard in `isWarningActive()`** (insight surfaced by comparing notes with myWX's parser): MET publishes explicit "Termination of … / Penamatan …" bulletins. The live 2026-07-18 terminated-Kuantan bulletin was excluded only because its `valid_to` (11:00) happened to already be past — a termination bulletin whose `valid_to` hasn't ticked over yet would have rendered as an ACTIVE warning for the very districts whose warning just ended. Guard: skip any warning whose `heading_en` contains `termination` or `heading_bm` contains `penamatan` (case-insensitive), in addition to the existing `valid_to`-expiry and "No Advisory" checks. The v2 SEKSYEN-C exclusion rule is this same principle on the metapi2 side.

---

## v2 — PLANNED: MET continuous-rain warnings via Vercel proxy (not built)

### Why

Verified 2026-07-18 with a registered METToken: `metapi2.met.gov.my/api/v2.1` (`datasetid=WARNING&datacategoryid=RAIN`) carried a **live "Amaran Hujan Berterusan (Buruk)"** that `api.data.gov.my/weather/warning` did not have at all — data.gov.my mirrors only a subset of MET warning types (thunderstorm/cyclone observed; rain missing). Continuous-rain warnings are the flood-season type that matters most locally, so the page currently has a real coverage gap. data.gov.my remains the thunderstorm source; metapi2 fills RAIN.

### Why a proxy is mandatory (not optional)

metapi2 **does** send `Access-Control-Allow-Origin: *` (verified — CORS is NOT the blocker). The blocker is the **METToken**: a static page would have to ship the token in client JS, publishing a personal registered credential to every visitor (view-source/Network tab). Same secret class as the Supabase service-role key — server-side only, never in browser code, never committed.

### Architecture

```
index.html ──fetch──▶ /api/weather-warning (Vercel function, ~30-40 lines)
                        ├─ MET_TOKEN from process.env (set in Vercel dashboard)
                        ├─ GET metapi2 …?datasetid=WARNING&datacategoryid=RAIN
                        │     &start_date={today}&end_date={today}   ← BOTH required, 400 without
                        └─ Cache-Control: s-maxage=180, stale-while-revalidate=60
                              ← Vercel edge cache: visitors' polls mostly never reach MET;
                                also the answer to "strangers hammering the public proxy"
```

- Source split stays disjoint by design: **data.gov.my = thunderstorm (unchanged), metapi2 = RAIN only** — never fetch the same warning type from both, so no cross-source dedup problem exists.
- Local testing: `/api/*` does not exist under Live Server / `python -m http.server` (documented repo-wide limitation, same as Terbitkan) — local workflow stays `?testWarning=`; the live proxy is a deploy-time check.
- Token lifecycle: METToken will live in TWO places once the Telegram bot exists (Vercel env var + Apps Script Script Properties) — rotation must update both; Vercel env change requires a redeploy.

### Phased build (phase 1 independently shippable)

**Phase 1 — proxy + banner-only (~1 hour incl. deploy):** create `api/weather-warning.js`, set `MET_TOKEN` env var, page fetches it alongside the existing warning fetch (both timeout-wrapped, neither blocks the map) and renders the RAIN warning's `attributes.title.ms` + `valid_from/valid_to` as a banner item (🌧️ icon) with the full `value.text.ms.warning` behind the tap-to-expand. **No district highlighting yet** — rain warnings visible at all is the value; skip if payload empty/errored.

**Phase 2 — SEKSYEN parser + district highlighting (the real work, ~a session):** metapi2's RAIN payload is one multi-section prose string, NOT data.gov.my's shape:
- `SEKSYEN A/B/…` = active tiers (Waspada/Buruk/Bahaya — reflect severity in banner/fill color); **`SEKSYEN C: PENAMATAN…` = terminations and must be EXCLUDED** (same trap as the terminated-Kuantan thunderstorm bulletin).
- Area grammar differs from thunderstorm bulletins: `negeri {State}: {Region} ({districts})` hierarchy (seen for Sabah), `•` bullets between states, per-section validity written in prose (fall back to the structured `attributes.valid_from/to` for the whole bulletin).
- Needs its own parser + Node-harness fixture tests (reuse the real 2026-07-18 payload saved in the transcript/scratchpad as the first fixture) feeding the SAME `warningDistricts`/`warningScope` state as v1 — rendering layer unchanged.

### v2 out of scope

- Merging/deduping warning types across both sources (prevented by the disjoint split).
- Using metapi2 for forecast on this page (data.gov.my's Ds061 forecast filter already covers that need, token-free).
- Any METToken usage in client code, ever — if the proxy pattern ever feels heavy, drop rain warnings from the page rather than ship the token.

### v2 as-built notes (2026-07-18 — both phases done same day; deviations vs the phased plan above)

- **Phases 1+2 were built together, not sequentially** — the SEKSYEN parser turned out cheap for the Pahang-only scope, because it reuses v1's `splitDistrictList()`/`resolveDistrictName()` and the same `Pahang (…)` regex per active section, rather than needing MET's full multi-state grammar (Sabah's `Region (districts)` hierarchy never matters when you only ask "is Pahang mentioned?").
- `api/weather-warning.js`: GET-only, `MET_TOKEN` env var, computes today's date **in Malaysia time** for MET's mandatory `start_date`/`end_date` (Vercel runs UTC — naive date is wrong 8 h/night, same lesson as `api/publish.js`), 8 s abort, `Cache-Control: s-maxage=180, stale-while-revalidate=60`, 502 passthrough on MET failure.
- Page (`index.html`): `normalizeRainWarnings()` reshapes metapi2 rows into the same object shape the banner already consumes (+ `source:'rain'` + precomputed `pahang` scope); `parseRainPahang()` splits `SECTION/SEKSYEN X:` blocks, **drops TERMINATION/PENAMATAN sections before looking for Pahang**, then district-parens → state-mention → null ladder; rows whose active sections never mention Pahang are dropped entirely (a KL/Sabah-only bulletin shows nothing on a Pahang page — verified with the real 2026-07-18 payload as a fixture). Both sources fetched via `Promise.allSettled` — either failing alone can't take down the other (the rain proxy 404s under Live Server by design). Banner icon 🌧️ for rain items. `isWarningActive()`'s heading termination-guard exempts `source:'rain'` (rain terminations are per-SECTION, not per-bulletin).
- **Fixtures**: `?testWarning=rain` (whole-state) and `rain:Temerloh,Maran` (districts) — built as real metapi2-shaped payloads run through the actual normalize/parse path, each including a SEKSYEN C the parser must ignore.
- **Verified**: 21-case Node harness (all v1 cases + 6 rain cases incl. the real payload and the Pahang-only-in-termination trap) + `node --check` on proxy and page script. **Not yet verified live** — needs `MET_TOKEN` in Vercel (manual, see status line) and a deploy; the real bulletin currently doesn't mention Pahang, so live confirmation of highlighting waits for either a fixture check on the deployed URL or the next Pahang rain warning.
