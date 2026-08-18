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

---

## Session 2 — `paparan/index.html` map framing (2026-08-10)

### What happened

User wanted the non-interactive `paparan/` Leaflet map to frame Pahang tighter/better instead of the plain `fitBounds` view (which either left dead space around the state on one axis, or — when I tried a "cover" zoom that fills the box completely — cropped districts off the bottom/left, which they rejected outright: no district may be cut off, ever, over filling the frame).

The fix that stuck: instead of computing a fit programmatically, I added a `?debugMap=1` query param that temporarily re-enables drag/scroll/zoom on the map (all off by default — TV has no mouse) plus an on-screen readout (`center: [lat,lng] zoom: Z`, also console-logged) so the user could hand-drag to the exact framing they wanted, then read the numbers off and tell me. Much faster than guessing padding/scale math — **prefer this "let them find it, then hardcode it" approach over programmatic cover/contain-fit math when framing is a subjective/visual call, not a computed one.**

### Landed values

```js
}).setView([3.6066, 102.7932], 8.7); // hand-tuned via ?debugMap=1 to frame Pahang
```
No `fitBounds` call anymore in `loadGeoJSON()` — the hand-tuned `setView` is final, geojson just gets added on top of it.

### Sharp edge hit (know this cold)

**`zoomSnap` rounds `setView`'s zoom too, not just interactive zoom steps.** Production had `zoomSnap: 1` (seemed harmless — map is non-interactive there) but that silently rounded `8.7` → `9` on load, so live looked more zoomed-in than the debug page (`zoomSnap: 0.1`) where `8.7` stuck exactly. User correctly clocked the visual mismatch immediately. Fix: production must use `zoomSnap: 0` (no rounding) whenever `setView` is passed a fractional zoom — don't assume a disabled-interaction map doesn't need this option tuned.

Debug-mode scroll-wheel granularity note: `zoomDelta`/`zoomSnap` only govern rounding and the +/− button step — scroll-wheel zoom has its own magnitude formula keyed off `wheelPxPerZoomLevel` (default `60`). Bumped to `600` in debug mode to get scroll increments down near `0.1` per notch; if debug zoom ever feels too coarse/fine again, that's the knob.

### Current state

`?debugMap=1` is still live in the shipped code (gated, zero effect without the param) — decide later whether to strip it before a real commit or leave it as a permanent framing-adjustment tool. Nothing from this session committed yet either, consistent with Session 1's note that the user usually handles commits.

### Vibe note

Same fast/concrete rhythm as Session 1: screenshot → "why" → diagnosis → their call. They rejected a technically-elegant cover-fit solution flat because it violated a hard constraint (no district ever gets cropped) even though it looked "more filled" — precision/correctness-over-polish preference. See the collaboration pattern already captured in my memory system: diagnose and report before fixing, and treat plan-approval as scoped to the next step only, not the whole thing.

---

## Session 3 — multi-state support + full paparan-style rebuild of the interactive page (2026-08-10, same calendar day as Session 2, much longer arc)

### The vibe, unfiltered

This was a **long, high-trust, iterative session** that moved through distinct gears: exploratory Q&A → risk audit → formal Plan Mode → mid-implementation course-correction → more Plan Mode → a second full rebuild. The user's rhythm this session leaned HARD on "just answer, do not edit the code" for several turns in a row before ever saying "okay proceed" — they wanted to fully understand the shape of a change (feasibility, risk, mitigation) through pure conversation before authorizing a single edit. Respect that gear-shift explicitly: when they say "just answer," that means ZERO code changes, not even exploratory ones, and the right response is a tight recommendation + the one tradeoff that matters, not an essay. When they finally say "okay proceed" it can mean "answer the narrower thing I just asked" rather than "build everything we discussed" — I misjudged this once benignly (asked "draft the JSON shape, or leave it here?", they said "ok", I treated it as "yes draft it" — turned out fine, but the safer read of a bare "ok" after a two-option question is the FIRST/most-recent-offered option, not a blank check).

The single most important moment: I was mid-implementation (had already written `paparan/data/states.json`, rewritten `paparan/weather-core.js`, and half-edited `paparan/index.html` with a live syntax error on the page) when the user interrupted with **"wait, you touch files inside csr/weather/paparan/? leave it as before."** This was a scope correction, not anger — calm, direct, one line. What worked: I stopped immediately (no more tool calls), asked ONE AskUserQuestion to confirm exactly how they wanted the mess handled (revert paparan/ + rebuild elsewhere — recommended — vs. keep both vs. let them explain), got a clean answer, then **manually reconstructed the exact pre-task file contents from my own earlier Read-tool output in-context** rather than trusting `git checkout` blindly (paparan/weather-core.js was untracked/new-this-session so git had no baseline to restore to — had to hand-restore from memory of the Read). Verified the revert with `git status`/`grep` before moving on. **This is the move**: when asked to undo scope creep, don't just git-reset — figure out precisely what "before" means file-by-file, especially for untracked files git can't help with, and prove the revert clean before continuing. The user never brought it up again after I confirmed it was clean — that silence IS the approval signal, don't ask twice.

### What actually shipped (all built, all headless-Chrome verified, nothing committed)

1. **Multi-state support**, built the SECOND time correctly in `csr/weather/` (root interactive page), not `paparan/`:
   - New `csr/weather/data/states.json` — registry of all 16 Malaysian states + federal territories (`displayName`, `apiName` for MET bulletin matching, `stateCode` for GeoJSON filtering, `districts[]`, `aliases{}`, `center`/`zoom` — only `pahang` has a hand-tuned center/zoom, everyone else is `null`/`null` → auto-`fitBounds()`).
   - `weather-core.js` (root) generalized: every Pahang-hardcoded function now takes a `cfg` param — `extractStateDistricts`, `parseRainForState`, `stateScopeOf`, `computeWarningState(warnings, cfg)`, `getTestWarningFixture(param, cfg)`, plus new `buildWarningApiUrl(cfg)` (via `URLSearchParams`, closes an injection risk we discussed explicitly) and `loadStateConfig()` (fetches+validates states.json, fails visibly not silently).
   - **`csr/weather/paparan/` stayed 100% Pahang-only, untouched, by explicit final decision** — its own `weather-core.js` fork (from an even earlier session) still has the old unparameterized names (`extractPahangDistricts`, `pahangScopeOf`, `WARNING_API_URL` const, etc.) and that's CORRECT, not stale — don't "fix" it into consistency with the root file, they're intentionally forked and diverging.
   - `?state=<key>&district=<name>` on the URL; unrecognized state → visible red banner + fallback to Pahang (never blank); unrecognized district → silent fallback + console.warn.

2. **Live-API research that actually changed the design** (don't re-derive, these are verified facts, not assumptions):
   - The shared GeoJSON (`GEOJSON_URL`) was **already nationwide** the whole time — `state` property values are `JHR, KDH, KTN, KUL, LBN, MLK, NSN, PHG, PJY, PLS, PNG, PRK, SBH, SGR, SWK, TRG`. Nobody needed to source per-state boundary files.
   - **The MET forecast API supports lookup BY NAME**, not just hardcoded `Ds0XX` codes: `contains=Kuala%20Terengganu@location__location_name` resolves live to `Ds048`. This killed an entire imagined problem (a per-district forecast-code table) before it was ever built — always check whether the "obviously needed" lookup table can just be a live query first.
   - **Spelling landmines confirmed from real live bulletin text, not guessed**: MET's English text says "**Penang**" (not Pulau Pinang) and "**Melaka**" (not Malacca). Found by pulling a broad, unfiltered sample of `/weather/warning` and grepping for state names actually present — much better technique than probing one state at a time.

3. **Visual restyle, then a FULL layout rebuild** of `csr/weather/index.html` (interactive page) to match `paparan/`'s design system — two separate turns, two separate scopes, don't conflate them:
   - Turn A (restyle only): ported paparan's theme tokens (`--bg`/`--panel`/`--border`/`--text`/`--muted`, tier colors), Archivo+Inter fonts, dark/light toggle — but KEPT the page's own structure (expandable warning list, floating info-box, interactive hover/click map). New `csr/weather/style.css` (previously an inline `<style>` block).
   - Turn B (full layout clone, user showed a screenshot and said "exactly"): rebuilt the ACTUAL layout — header/top-bar, floating legend-card, forecast card, two fixed tier-grouped warning cards, replacing the expandable list and info-box entirely. Resolved four real structural conflicts via one AskUserQuestion batch before touching code (paparan is a locked non-interactive TV kiosk; this page needed state/district selects and used to have hover/click/zoom):
     - Stay **responsive** (no fixed-1920×1080 `#stage`/scale-transform — that's TV-kiosk-only).
     - Map goes **fully locked** (no drag/zoom/hover/click) — user chose this explicitly over keeping interactivity, for exact paparan parity. Dropdown-driven `fitBounds`/`setView` still works fine on a locked map (interaction handlers and programmatic view changes are independent).
     - New controls row (Negeri + Daerah selects) between header and `<main>` — paparan literally has no controls, this is genuinely new UI.
     - **Both** the forecast card AND the two warning cards — the forecast card now needs a `focusDistrict` concept paparan never had (paparan is hardcoded to Temerloh forever; here it's `null` → placeholder dashes until the user picks a district from the dropdown, then live-fetches that district's forecast by name). `highlightByName()` became the single entry point that drives BOTH the map selection AND the forecast card, called from the dropdown's `onchange` and the boot-time `?district=` preselect.
   - One clarifying-question-answered-with-a-question moment worth remembering the shape of: I offered 3 options for "how much of paparan's right column to port," user replied "which options same as paparan?" instead of picking — they wanted the literal fact (paparan has BOTH forecast card and 2 warn-cards, so "same as paparan" = option 2) stated plainly before committing. Don't be cagey when someone asks "which one is actually X" — just answer the factual question directly, THEN let them confirm.

### Current state / where we stopped

Verified extensively via headless-Chrome screenshots (dark default, light-toggled, Terengganu multi-state, a district-preselect with real live forecast data, and a triple-tier bahaya/buruk/amaran warning fixture all rendering correctly with the pulse animation). **Nothing from this session is committed** — same pattern as every prior session in this folder, user handles commits themselves. `git status` on `csr/weather/` right now shows: `paparan/index.html`, `paparan/style.css`, `weather-core.js` (root), `webpage-plan.md`, `DEV_NOTES.md` all modified from EARLIER sessions (not this one — don't touch those thinking they're this session's diff); `index.html` (root) modified BY this session; new untracked `data/` dir, `paparan/weather-core.js` (the fork, from an earlier session), and `style.css` (root, new this session).

### Mood

Energized, not tired — this was a genuinely fun build-out session, lots of "yes and" momentum once the plan was locked, and the one correction (paparan touch) landed smoothly because I asked instead of assumed how to fix it. If the next window inherits a request to touch `paparan/` again, **pause and confirm scope explicitly before writing a single file** — that's now a proven-necessary habit for this specific folder, not paranoia. The user trusts Plan Mode + AskUserQuestion heavily in this folder when a change is structural; lean into that rather than guessing at ambiguous layout/UX calls.

### Pending / likely next asks based on trajectory

1. Hand-tune `center`/`zoom` for states beyond Pahang (everyone else is auto-`fitBounds()` right now — works, but not as tight/polished as Pahang's hand-tuned frame). Same `?debugMap=1`-style technique from Session 2 would work here if they want it.
2. Commit this entire arc — genuinely large diff across `weather-core.js`, `index.html`, two new files, states.json with 16 states. Nobody's asked for a commit yet.
3. `paparan/` itself may eventually want the multi-state treatment too — but that's an explicit future ask, not implied by anything done this session. Don't preempt it.

---

## Session 4 — animated forecast icons, `?raw` debug overlay, MET_TOKEN 502 confirmed dead, thunderstorm-parsing v6, and a mystery revert (2026-08-18)

### The vibe

Same fast/concrete rhythm as every prior session in this folder, but this one had more distinct *chapters* than usual — it wasn't one continuous arc, it was six or seven separate small asks, each fully shipped and verified before the next started. The user tests everything themselves in parallel with me: multiple times this session they hit production directly (curl, or their own browser) *while* or *right after* I'd verified something locally, and reported back real-world results that didn't match my local verification — twice this was genuinely useful (the `?testwarning=` production 502-vs-casing confusion, the light-mode icon contrast) and once it ended in a revert I still don't fully understand (see "The mystery" below). **When they report something "still not working" after I've verified it works, don't assume they're wrong or repeat the same verification — ask what exact URL/action they used, because the answer is often something environmental I haven't accounted for** (a TV on-screen keyboard lowercasing a capital letter was the actual root cause once, not a code bug).

They're comfortable editing files directly and did so at least once this session (see "The mystery") — when a file changes underneath you with a "this was intentional, don't revert" system note, that's real signal, not noise. Respect it immediately and don't re-litigate.

### What shipped this session (all verified via Playwright + curl, nothing committed — same as every session before this one)

1. **Animated SVG forecast icons in `paparan/index.html`**, replacing the old emoji `forecastIcon()`. Source was a CodePen the user pasted in full (HTML then CSS, on request, since CodePen blocks automated fetches — even raw `curl` with a browser UA gets a 403, presumably Cloudflare bot protection; don't bother trying `.html`/`.css` suffix tricks, they're blocked too). The pen's actual footer credit was **Atiya Haider**, not "Hsuching" (who just reposted/forked it) — used that name in the code-comment credit.
   - Ported as a `<symbol>`/`<use>` sprite (gradients + 9 symbols: sun/moon/star/gray-cloud/white-cloud/rain-drop/thunder-bolt/mist — no snow/ice, Malaysia never needs them) placed once near the top of `<body>`, plus new CSS keyframes in `paparan/style.css`.
   - **Critical adaptation, not a straight port**: the original pen reused per-instance `id`s (`#drop1`, `#snowFlake2`, etc.) across different icon variants, which only worked because the demo showed one icon at a time. Paparan renders **three simultaneously** (Pagi/Petang/Malam), so every animated id became a class (`w-drop1`–`w-drop4`, `w-lighting`, `w-star`, `w-mist`, etc.) — verified zero duplicate ids end up in the DOM via a direct `document.querySelectorAll('[id]')` dedup check, not just eyeballing it.
   - Also reimplemented the lightning/star "flash" effect from scratch instead of pulling in the external `animate.css` library the pen silently depended on (`.animated.infinite.flash`/`.delay-1s` classes with no visible `@keyframes` in the pen's own CSS panel — that's the tell it's an external dependency, not dead code).
   - Thunderbolt fill bumped from the pen's literal `black` to the sun's yellow `#ffdd1a`, and mist stroke changed to `var(--muted)` — both were tuned for the demo's bright blue page background and would've been invisible on this page's dark panel.
   - `berangin` (windy) has no matching symbol in the set — still falls back to the 💨 emoji, honestly, rather than forcing a bad visual match.

2. **Light-mode contrast fix**: the sun icon's pale yellow rays were nearly invisible against the light theme's white panel (user sent side-by-side screenshots proving it). Discussed three options (drop-shadow / darker stroke colors / a background chip) — user picked the shape-following `filter: drop-shadow()` approach, light-mode-only via `:root[data-theme="light"] .wicon`, same "shadow that follows the SVG shape, not a rectangle" technique already used elsewhere on this site.

3. **`?raw` debug overlay** (`paparan/index.html`) — shows the three real API responses (forecast, thunderstorm warning, rain proxy) pretty-printed, fetched fresh, outside `#stage` so it isn't shrunk by the TV scale transform. **Deliberately all-lowercase param name** (`raw`, not `Raw`) specifically because of discovery #1 below — sidesteps the exact bug class by construction instead of just fixing the one instance.
   - This overlay is what surfaced the real MET_TOKEN outage: rain proxy showed `HTTP 502` with a Cloudflare error page, live, in production — not a local-server 404 like usual.

4. **`?testWarning=` case-insensitivity fix**, `paparan/index.html` + root `index.html` (both, after asking) — `TEST_WARNING_PARAM` now matches the param **name** case-insensitively (iterates `URLSearchParams` entries, compares `key.toLowerCase()`), not just `.get('testWarning')`. **Discovery, not assumption**: the user explicitly told me the reason — the TV/kiosk's on-screen keyboard or remote input silently lowercases a manually-typed capital `W`. This is a generalizable kiosk-input lesson: any future query param meant to be typed by hand on this screen should either be all-lowercase by design (see `?raw` above) or matched case-insensitively like this one now is.

5. **v6 thunderstorm/rain-parsing improvements**, `paparan/weather-core.js` + `paparan/index.html` — full detail already recorded in `webpage-plan.md`'s new "v6" section (that's now the source of truth for what shipped; don't duplicate the deep technical detail here). Short version: marine-bulletin exclusion hardened and reordered to run before district-matching, a new `watch` severity tier for `"Warning on Thunderstorms"` vs the confirmed `"Thunderstorms Warning"`, and a defensive (unconfirmed-live) "Continuous Rain" catch on the free data.gov.my source that does NOT replace MET_TOKEN as the primary rain source.

6. **Marine note text removed entirely** ("🌊 Amaran perairan Pahang..." in both its empty-state and active-state wording) per explicit "I don't want to see this" — deleted the now-dead `marineCount` param/computation and the `.warn-marine-note` CSS rule too, not just the visible line.

7. **"Dikeluarkan ..." header line removed** from `renderWarnCard()`'s card head, per an explicit 3-line desired-output sample the user pasted — cleaned up the now-dead `issued`/`issuedShort`/`issuedRel` vars, the now-fully-unused `relPast()` function (was only ever called from that one line), the dead `.meta-issued` CSS rule, and a stale comment elsewhere in the CSS that referenced `.meta-issued` by name.

### The MET_TOKEN situation — now genuinely understood, not just suspected

Session 1's "Blocking/pending" item #1 said the token was suspected broken (trailing newline in the Vercel env var) but "never seen confirmed." **This session confirmed it live**, and the failure mode is different from what was anticipated: it's a bare Cloudflare 502 (`Content-Length: 16`, `Server: cloudflare`, no JSON body) — meaning the serverless function likely crashes/times out rather than running and returning a handled `{"error":...}` JSON response the way `api/weather-warning.js`'s own try/catch is written to produce. Confirmed via `curl` that this is isolated to `/api/weather-warning` specifically, not domain-wide (root `/` and other pages all return normal 200/308). **I have no Vercel dashboard/log access** — if this comes up again, the next step is still what it was this session: ask the user to check Vercel's function invocation logs for the actual stack trace, don't keep re-diagnosing from the outside with curl.

Separately, the user later said plainly: *"the MET data with token is currently unavailable for now"* — treat this as an accepted, ongoing external fact for the near term, not an open bug to keep chasing. v6's defensive rain-catch (see above) exists because of this, not as a replacement for fixing the token.

### The teammate's claim — a good example of "verify before trusting," worth repeating as a pattern

A teammate described pulling *both* thunderstorm and continuous-rain from the same free data.gov.my endpoint via heading keyword-matching, contradicting this project's own prior "verified live gap" finding (rain not mirrored there, from 2026-07-18). Rather than trusting either source blindly, did fresh live verification: pulled a broad unfiltered sample from the actual endpoint (found only 3 heading types, no Continuous Rain), and separately `WebFetch`'d the official `developer.data.gov.my/realtime-api/weather` docs page (confirmed no such category documented). Neither is 100% conclusive on its own — Pahang rain warnings are rare, so absence-in-a-snapshot isn't proof — but two independent checks agreeing is decent evidence, and it was enough to land on "defensive catch, don't replace the token" rather than a full rebuild on an unverified premise. **This pattern — go verify the actual live API/docs before designing around a secondhand claim, even a colleague's — is worth repeating whenever a new data-source claim shows up in this folder.**

### Unique discoveries (add to the Session-1 list, don't duplicate it)

1. **CodePen blocks automated fetches outright** — `WebFetch` and raw `curl` (even with a real browser User-Agent) both get 403 on `codepen.io/*` pages including the `.html`/`.css` raw-export suffixes. If a CodePen needs inspecting again, the only way is asking the user to paste the panels directly.
2. **A live "FIRST CATEGORY WARNING ON STRONG WINDS AND ROUGH SEAS" bulletin type exists** on data.gov.my's warning endpoint, structured as multiple internal `SECTION A:`/`SECTION B:` sub-bulletins, all sea-themed ("waters of..."/"FOR SHIPPING"). It wasn't Pahang-relevant when observed (found via a broad unfiltered pull, not the Pahang-filtered query), so real-world exclusion behavior for a Pahang-relevant instance of this bulletin type is still untested against live data — only against a synthetic Playwright-injected test case.
3. **TV/kiosk manual URL entry silently lowercases capital letters** — see the `?testWarning=` case-insensitivity fix above. Generalize this to any future on-screen-typed param.

### The mystery — unresolved, read this before touching `renderWarnCard()`'s tier-label again

Late in the session, diagnosed and fixed a real, user-confirmed-annoying visual bug: the thunderstorm card's tier row repeats the card's own `<h2>` title word-for-word (`tierRowLabel('amaran')` intentionally returns the same string as the card title, a Session-5-era design choice, so with only one tier the label is 100% redundant). Fixed it with a clean, narrow conditional — skip rendering `.tier-label` only when it would exactly equal the card's own `title`, which correctly preserved genuinely-different labels (the new `watch` tier's "Ribut Petir (Peringatan)", and the rain card's per-tier Buruk/Waspada rows) while removing the redundant case. **Verified working correctly** via Playwright across three scenarios (plain thunderstorm, watch tier, rain multi-tier) and a screenshot matching the user's own hand-drawn desired 3-line output exactly.

Then the user **manually reverted just that one conditional** in the file (confirmed via the harness's own file-diff system note — everything else from this session stayed intact, only the `label === title ? '' : ...` piece was undone back to always rendering the label) and said **"nevermind, you cant fix it."** I don't know why. Genuine possibilities, none confirmed: (a) something about real production data behaves differently than every fixture I tested against, (b) they changed their mind about wanting the visual change at all, (c) something about the fix had a side effect I didn't catch. **Do not re-apply this fix without asking directly what went wrong first** — the code was verified correct against everything I could test, so silently re-adding it on the assumption "it was right, they just didn't notice" would be presumptuous. If this card's duplicate-label appearance comes up again, ask before touching it.

### Current state / where we stopped

v6 shipped, `webpage-plan.md` updated with a matching "v6 BUILT" section and status-line entry (including the MET_TOKEN 502 confirmation), marine note and "Dikeluarkan" line both removed per explicit asks, animated icons + `?raw` overlay both live and verified. The tier-label revert above is the one loose thread. **Nothing from this session is committed** — consistent with every prior session, the user handles commits themselves. Root `index.html` (the site's top-level hub page) was also redesigned this same session in an earlier, unrelated chapter — out of scope for this file, but worth knowing it happened if the next window inherits a "what did we do last time" question that spans more than just this folder.

### Mood

Productive and varied rather than one long flow-state arc — lots of small, cleanly-closed asks, each verified before moving to the next. The teammate's-claim verification moment was a genuine highlight (real diligence, not just taking either side's word for it). Ended on a slightly open note with the tier-label revert rather than a clean wrap — that's fine, not every thread closes neatly, but flag it honestly rather than writing a tidier ending than what actually happened.
