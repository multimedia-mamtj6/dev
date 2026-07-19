# Plan — Telegram Weather-Warning Bot (Apps Script + data.gov.my)

_Status: PLANNED, not yet built. Written 2026-07-18. Companion to the `csr/weather/` page idea; the bot itself lives in Google Apps Script, not this repo — this file is the build reference._

## Goal

When MET Malaysia issues a weather warning that mentions one of our **pre-registered locations** (watch-list, e.g. Pahang / Temerloh / Maran), automatically post it to a Telegram channel — once per warning, no duplicates, no manual checking.

## Why this design

- `api.data.gov.my/weather/warning` has **no push mechanism** — polling is the only option.
- Warnings carry **no structured location field** — free-text only (`text_bm`/`text_en`). MET sometimes names districts, often only the state. So: match at state level for reliability, badge the district when explicitly named.
- Google Apps Script is chosen because this project already runs the identical pattern (time trigger + `UrlFetchApp` + secrets in `PropertiesService`) in the infaq pipeline — zero new infrastructure, free tier is far more than enough (~96 calls/day vs 20,000/day quota).

## Architecture

```
Apps Script time-driven trigger (every 15 min)
  → UrlFetchApp GET https://api.data.gov.my/weather/warning?limit=20
  → filter: not expired (valid_to ≥ now, when non-null)
  → filter: text_bm OR text_en contains any watch-list entry
  → dedup:  warning_issue.issued newer than last-sent record in Script Properties
  → for each new match: UrlFetchApp POST api.telegram.org/bot<TOKEN>/sendMessage
  → update Script Properties with sent warnings
```

## Components

### 1. Watch-list (pre-registered locations)
A `Konfigurasi` tab in a small Google Sheet the script is bound to (committee-editable, no code changes needed — same CMS habit as the other pipelines):

| Column | Example | Note |
|---|---|---|
| `keyword` | `Pahang` | matched case-insensitively against text_bm + text_en |
| `jenis` | `negeri` / `daerah` | daerah hits get the "(menyebut Temerloh)" badge |

**Must include the state name (`Pahang`)**, not only districts — MET frequently writes state-level bulletins without listing districts; a district-only watch-list silently misses those.

Optional row: `MAGHRIB_QUIET=false` style flags later if quiet hours are ever wanted — don't build now.

### 2. Script Properties (secrets + state)
- `TELEGRAM_BOT_TOKEN` — from BotFather. **Never hardcoded in code.gs** (the infaq PAT lesson, and the anti-lesson of the leaked kuliah3 PAT).
- `TELEGRAM_CHAT_ID` — `@channelusername` for a public channel, or the `-100…` numeric id for a private one.
- `SENT_WARNINGS` — JSON array of the last ~20 sent warning fingerprints: `issued + "|" + title_en`. Using a fingerprint (not just the newest timestamp) handles multiple distinct warnings issued in the same batch. Trim to 20 entries on every write so the property never grows unbounded.

### 3. code.gs — function breakdown (~80-100 lines)
- `checkWarnings()` — main entry point, the one the trigger calls. Fetch → filter → dedup → send → persist. Entire body in try/catch; a failed run must fail silently and let the next tick retry (no half-updated `SENT_WARNINGS` — persist only after successful send).
- `fetchWarnings_()` — `UrlFetchApp.fetch(..., { muteHttpExceptions: true })`, JSON parse, return `[]` on any failure. Apps Script's built-in fetch timeout is adequate; the every-15-min retry is the real resilience.
- `matchesWatchlist_(warning, watchlist)` — case-insensitive substring test of each keyword against `text_bm + " " + text_en`; returns the matched keywords (needed for the district badge).
- `isExpired_(warning)` — `valid_to` non-null and in the past → skip. `valid_to: null` (e.g. "No Advisory" bulletins) → also skip sending: **additionally skip any warning whose `title_en` is "No Advisory"** — those are routine "nothing happening" bulletins, not warnings.
- `buildMessage_(warning, matchedKeywords)` — Malay-first format:

```
⚠️ AMARAN CUACA — {heading_bm}
{text_bm}

📍 Kawasan dipantau: Pahang (menyebut Temerloh)   ← badge only if a daerah keyword matched
🕐 Sah: {valid_from} — {valid_to}                  ← omit line if null
📌 Nasihat: {instruction_bm}                       ← omit line if null

Sumber: MET Malaysia / data.gov.my
```
- `sendTelegram_(text)` — POST `https://api.telegram.org/bot{TOKEN}/sendMessage` with `{ chat_id, text, parse_mode: 'HTML' }` (escape the warning text; MET text can contain `&` — seen live as `&amp;`, decode entities before sending).
- `testRun()` — manual dry-run: does everything except send, logs what WOULD be sent. Develop against this before ever touching the channel.
- `testSend()` — sends one hardcoded test message to verify token/chat_id wiring.

### 4. Telegram side (one-time manual setup)
1. BotFather → `/newbot` → save token into Script Properties.
2. Create the channel; add the bot as **administrator** (post-messages permission is the only one it needs).
3. Public channel → `TELEGRAM_CHAT_ID = @channelname`. Private → post once manually, call `getUpdates` on the bot (or use a chat-id helper bot) to read the `-100…` id.

### 5. Trigger (the "cronjob")
Apps Script editor → Triggers → `checkWarnings()`, time-driven, **every 15 minutes**. Worst-case notification latency ≈ 15 min + data.gov.my's own ingestion lag from MET. Tighten to 5 min later if wanted — quota impact is trivial either way.

## Edge cases the plan already accounts for

- **Same warning re-issued/updated by MET**: new `issued` timestamp → new fingerprint → it re-sends. That's correct behavior (it IS new information), not a dedup bug.
- **Multiple matching warnings in one poll**: loop and send each; Telegram rate limit (~20 msg/min to a channel) is unreachable at this volume.
- **API down / hung**: `fetchWarnings_()` returns `[]`, run ends quietly, next tick retries. Never notify "API failed" to the channel — noise.
- **Marine "waters of Pahang" warnings**: will match the `Pahang` keyword even though they're offshore. Accept for v1 (they're rare and arguably still relevant); a v2 could de-prioritize bulletins whose text starts with marine phrasing ("waters of", "perairan").
- **Apps Script trigger occasionally fires twice / overlaps**: fingerprint dedup already makes double-fires harmless.

## Build order (when development starts)

1. Sheet + `Konfigurasi` watch-list tab.
2. `fetchWarnings_` + `matchesWatchlist_` + `isExpired_` + `testRun()` — iterate against the live API until dry-run output looks right (there are live Pahang thunderstorm warnings most weeks to test against).
3. BotFather + channel + `testSend()`.
4. Wire `checkWarnings()` end-to-end, run manually once with the channel live.
5. Install the 15-min trigger. Done.
6. (After it works) mirror `code.gs` into this repo for reference, the way `kuliah/gscript/` and infaq's `g-appscript/` do — script lives in Google, repo holds the copy.

## Image attachment — MET warning map, cropped to Pahang (v1.1, optional layer on top of v1)

MET publishes each warning as a map image at a **stable, overwritten URL**: `https://www.met.gov.my/data/AmaranRibutPetir.jpg`. Verified 2026-07-18: it is a fixed **1100×711** template (same map geometry every issuance — only the blue district highlights and the text change), it hotlinks fine, and it was in sync with the API warning fetched the same morning (issued 8:55 pagi, Kuantan visibly highlighted). Because the layout is fixed, Pahang always occupies the same pixel region — approximately **x≈210, y≈270, w≈190, h≈180** (calibrate visually once during build; one-time job).

**Web page (`csr/weather/`) — pure CSS crop, no server:** wrapper `div` with `overflow: hidden`, `<img>` scaled/offset by deterministic percentages of the 1100×711 source so only the Pahang box shows. Plain `<img>` hotlinking needs no CORS. Cache-bust with `?v=timestamp` like every other fetch in this repo. Tap-to-expand reveals the full map.

**Telegram bot — crop via image proxy, since Apps Script cannot crop natively:** `sendPhoto` with a `wsrv.nl` crop URL, e.g. `https://wsrv.nl/?url=www.met.gov.my/data/AmaranRibutPetir.jpg&cx=210&cy=270&cw=190&ch=180&w=600` (append a cache-bust param to the inner URL). Trade-off: adds a third-party dependency to the bot. **Zero-dependency alternative (acceptable v1 default): send the full 1100px image** — fully legible — and keep the cropped view web-only.

Rules that keep this layer honest:
- **The crop is cosmetic, not the filter.** The watch-list text match (v1) remains the sole decider of whether a warning is relevant/sent; the image is an attachment when it is. The two stay in sync naturally — same issuance feeds both.
- **Silent-breakage insurance:** if MET redesigns the image, a fixed crop shows the wrong region with no error. Always keep the full image one tap/click away, and treat "crop looks wrong" as a recalibration task, not a bug hunt.
- **Per-warning-type URLs:** `AmaranRibutPetir.jpg` is the thunderstorm map. Other warning types (hujan berterusan, angin kencang…) publish under their own filenames on `met.gov.my/data/` — map each warning title to its image URL if/when those types are added; don't assume one image covers all.

## Explicitly out of scope (v1)

- Forecast posting (daily "ramalan Temerloh" messages) — different feature, trivial to add later to the same script if wanted.
- Quiet hours, per-user subscriptions, inline buttons — not needed for a broadcast channel.
- The `csr/weather/` web page itself — separate build; it will share the same API + the same "Pahang net, Temerloh badge" matching rule (keep the two consistent when both exist).
