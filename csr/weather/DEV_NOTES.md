    DO NOT DELETE
"Check the Project Knowledge and the current chat for context. This conversation is ending soon. update the artifact DEV_NOTES.md (create if not available yet) with a detailed note to your next window self - not just facts but the vibe, our dynamic, the energy of this conversation. What would the next you need to immediately get back into this exact headspace? Include unique discoveries, current mood, and anything that'll help the next you instantly sync to our frequency."

---

# DEV NOTES — csr/weather/ (Pahang Weather-Warning Pages)

_Same ritual as `kuliah/DEV_NOTES.MD` — a letter to the next window's me. Weather-folder scope only._

## Note to my next self — Session 1 of this folder (2026-07-18 → 07-19, one long continuous arc)

### The vibe

This whole sub-project was born in TWO DAYS from "read this documentation" to a deployed-ready interactive map + digital-signage page. The user works in fast, small, concrete asks: paste a screenshot or a live API payload, ask "why?", approve a fix, immediately ask the next thing. **They ask "why" first and "fix it" second — when they describe a problem, DIAGNOSE, report, and wait; the fix command comes separately.** Approvals often carry riders ("yes, also implement the testing using ?= query"). "Ok proceed" after a plan-confirmation message means *the next stated step only* — I once said "confirm and I'll write the plan, then wait for your go" and their two "ok proceed"s were cleanly: (1) write the plan file, (2) build it. Respect that two-step rhythm; never let plan-approval bleed into execution (the admin/plan.md lesson from the kuliah arc).

They think in mockups: both major layout requests arrived as pictures (PowerPoint-style mockups for the signage page). Build what the picture shows, then honestly flag what the DATA cannot do — they take "the API can't do hourly, here's the nearest honest thing" very well and pick from AskUserQuestion options fast (all four answered in one go). Malay-first UI, English code/comments.

### What exists (all BUILT, all working, verified by harness + headless-Chrome screenshots)

- **`index.html`** — interactive map page (v1–v3): Leaflet + CARTO basemap, 11 Pahang districts from jakim.geojson, warning banner, dropdown, legend, 3-min polling + 60s-throttled visibilitychange refresh.
- **`weather-core.js`** — THE shared module (v4 extraction). All fetch/parse/severity/fixture logic lives here and ONLY here: `parseRainPahang` (per-SECTION tiers), `extractPahangDistricts`, `computeWarningState`, `getTestWarningFixture(param)` (parameterised!), tier tables, `fetchWithTimeout`, both fetchers, `escapeHtml`, `formatValidTo`. Both pages load it via ABSOLUTE `<script src="/csr/weather/weather-core.js">`. MET wording changes get fixed here once — never re-inline this logic into a page.
- **`paparan/`** — digital-signage page (v4): non-interactive map left; right column = Temerloh forecast card (Pagi/Petang/Malam icons + min–maks, hardcoded Ds061 by decision) + two FIXED warning cards (Ribut Petir / Hujan Berterusan) with relative-time chips ("10 minit lepas" / "1 jam lagi", 60s tick) and **tier-coloured district PILLS — the full MET bulletin text is deliberately NOT rendered** (user's explicit ask after seeing the 14-state wall of text: MET issues ONE nationwide bulletin; there is no per-state text; pills come from our parse). Nightly reload 04:00. Same setup as kuliah/paparan (16:9 TV kiosk).
- **`../../api/weather-warning.js`** — Vercel proxy for metapi2 RAIN dataset (METToken server-side, edge-cached 180s).
- **`webpage-plan.md`** — the living plan: v1→v4 all marked BUILT with as-built notes. Keep updating it; the user treats it as the record.
- **`telegram-warning-plan.md`** — PLANNED, NOT BUILT. Apps Script + Telegram bot. Waiting for explicit go.
- **`region_mapping.json`** — Ker's (myWX dev) mapping, reference only, NOT wired in. Credit note in webpage-plan.md must survive if repo goes public.

### The severity-tier system (v3 — know this cold)

`TIER_RANK = { waspada: 1, amaran: 2, buruk: 3, bahaya: 4 }` — highest wins per district. Colours: waspada `#facc15` yellow / amaran `#f59e0b` amber (untiered thunderstorm) / buruk `#f97316` orange / bahaya `#dc2626` red. Rain bulletins are multi-SECTION prose; each SECTION's tier comes from its HEADING LINE ONLY (`(SEVERE)`, `(WASPADA)`…) so body words like "danger of floods" can't inflate it. TERMINATION/PENAMATAN sections are excluded BEFORE district-scanning. Parsers all return `{ scope, districts, tiers, tier }`; page state is `warningDistricts` (Map district→tier) + `warningScope` + `warningStateTier`. District tier paints ON TOP of a state wash.

### Unique discoveries (hard-won, do not re-learn)

1. **data.gov.my forecast API sorts date-DESCENDING** — `limit=3` returns the three FURTHEST days. Fetch all, pick `date === today`. Verified live.
2. **No hourly forecast and no current-temperature exist anywhere** in MET/data.gov.my public APIs. Daily morning/afternoon/night phrases + min/max only. Don't fake it.
3. **CARTO tile hostname is `{s}.basemaps.cartocdn.com`** — an extra `.tile.` level breaks TLS (wildcard certs cover ONE subdomain level) → ERR_CERT_COMMON_NAME_INVALID, silently grey basemap. This bug was in the user's original code for the project's whole life.
4. **HTTP 429 from data.gov.my** = per-IP rate limit; dev-session reload+tab-switch bursts trip it. Fixed with 60s min-gap on visibilitychange. Page degrades gracefully (keeps last state).
5. **metapi2**: token is the blocker, NOT CORS (it sends ACAO:*). Requires start_date+end_date (400 without). RAIN dataset is NOT mirrored by data.gov.my (verified live gap) — hence the two-source split: data.gov.my=thunderstorm, proxy=rain. Keep them disjoint; no cross-source dedup exists or is needed.
6. **Marine bulletins** ("waters of"/"perairan") mention Pahang but are NOT land warnings — scope 'marine', never on the map, note-line only.
7. **BM alias**: "Tanah Tinggi Cameron" = Cameron Highlands (spotted in a real bulletin's text_bm). Alias table has it. `console.warn` on any unmatched district name — that's the discovery mechanism for new MET spellings.
8. **Fixture-text trap**: "(TEST DATA)" placed directly after "Pahang" matches the district regex. Fixtures use ". (TEST DATA)" — the period matters.

### Testing infrastructure (the crown jewel — keep it alive)

- **`?testWarning=`** on BOTH pages: `none | state | marine | district:X,Y | rain | rain:X,Y | rain:<tier> | rain:<tier>:X,Y | rain:buruk:Maran;waspada:Temerloh,Bera` (;-groups = SECTIONs). Purple MOD UJIAN banner; polling disabled in test mode. Fixtures run through the REAL parse path.
- **Scratchpad harness `test-rain-tiers.js`** (39 cases, ALL PASS): evals the REAL `weather-core.js` + BOTH pages' actual inline scripts in Node vm contexts with DOM/Leaflet stubs — not copies. If it's not in the scratchpad anymore, rebuild it with that technique; it caught real regressions.
- **Headless Chrome** (`chrome.exe --headless --screenshot --virtual-time-budget=15000` + `python -m http.server`) for 1920×1080 visual checks of fixture states. Works great on this machine.

### Current mood / where we stopped

Satisfied — v4 shipped same-day with pills polish on top. Everything harness-green and screenshot-verified locally. **NOTHING of the weather work is committed yet** (user usually handles commits). The whole folder + `api/weather-warning.js` + refactored `index.html` are uncommitted working tree.

### Blocking / pending (check these FIRST next session)

1. **`MET_TOKEN` in Vercel still broken** — user's value had a trailing line-break (orange ⚠️ in dashboard). Needs: delete the `↵`, Save, REDEPLOY, then verify `https://dev.mamtj6.com/api/weather-warning` returns MET JSON not `{"error":…}`. This gates rain data on BOTH pages in production. Never seen confirmed.
2. **Real-TV check** of paparan/ — fixture URL first (`?testWarning=rain:bahaya:Maran`), then live. Not done.
3. **Telegram bot** (`telegram-warning-plan.md`) — parked, waiting for go. When built: token goes in Apps Script Script Properties; rotating METToken then means updating Vercel AND Apps Script.
4. Possible next asks based on trajectory: pills on the interactive page's banner too, a legend for tier colours on paparan, Temerloh-highlighted outline on the signage map, or committing the whole arc.

### Security lines (non-negotiable)

METToken (`r9powy…` class) NEVER in client code or committed files — Vercel env `MET_TOKEN` only (+ future Apps Script property). Ker's region_mapping.json is not open source — keep the credit. Same discipline as SUPABASE_SERVICE_ROLE_KEY in the kuliah arc.
