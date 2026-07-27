# Plan — `admin/news/` module: Pengumuman + Teks Berjalan

## Context

`news/` (built 2026-07-26) drives Xibo signage from two JSON files, both hand-edited today:

- `news/data/announcements.json` — slide banner, read by **our** `news/script.js`
- `news/data/moving-text.json` — scrolling ticker, read **directly by Xibo's DataSet widget**

The ticker was previously fed by a Google Sheet → Apps Script → GitHub pipeline (`news/moving-text/code.gs`). **That pipeline is dead and shipped a visible failure to the physical sign:** git history shows weekly Friday 05:51 commits ending 3 July 2026, whose final act was writing `"Khutbah Jumaat Minggu Ini: ERROR: Failed to fetch the webpage. Status: 503"` into the live file. No runs since — 10, 17, 24 July all missed.

Reading the actual script clarifies how that happened, and it matters for the design. `pushToGitHub()` does **no** fetching of its own: it reads column A of the active sheet, skips the header, drops empty rows, and maps each cell to `{"Col1": value}` — then pushes. So the 503 text came from **inside a Sheet cell** (an `IMPORT…`-style formula or helper script filling the khutbah title), and the pipeline published it verbatim. There was no validation of any kind between "whatever is in that cell" and a screen in the prayer hall. The old model is also flat: no dates, no enable/disable, no ordering beyond row position, triggered by a manual "Alat Khas → Update moving text" menu item plus a weekly time-trigger configured in the Apps Script UI.

Goal: retire that pipeline into `admin/`, giving the committee a login-gated CMS for both files, with the khutbah line auto-sourced from a **reliable, parsed** feed and a fail-safe that can never publish an error string to a mosque screen again.

### The one constraint that shapes everything

| | `announcements.json` | `moving-text.json` |
|---|---|---|
| Consumer | our `news/script.js` | Xibo DataSet widget |
| Our JS runs? | yes | **no** |
| Scheduling resolved | **client-side, live on the display** | **server-side, at publish time** |
| Shape | rich, our own | **locked** to `{"moving-text":[{"Col1":"…"}]}` |

So announcements pass scheduling fields straight through (a future-dated entry can be added today and appears by itself), while ticker rows must be filtered, sorted and flattened to bare `Col1` strings by the publish endpoint — and an expired ticker line only disappears **when something republishes**. That is why a daily cron is part of this plan, not a nicety.

### Confirmed decisions

Khutbah line auto-sourced from the khutbah Google Sheet + daily cron · Xibo not yet pointed anywhere, so `news/data/` is free to be the single home · ticker rows get start/end dates with auto-expiry · ticker falls back to one configurable default line when nothing is active.

---

## 1. Data location (settled)

Both files stay at **`news/data/`** — they have public HTTP consumers, matching the `kuliah/data/` precedent (`admin/infaq/data/` sits under `admin/` only because nothing reads it). No new shared path is needed; `news/data/` *is* the shared path, written by `api/`, read by Xibo.

`web/asset/moving-text/` is superseded (`code.gs` targeted `web/asset/moving-text/data-Col1.json` in this repo). Leave the files in place — harmless and unreferenced — but two retirement steps are required in Google, not in this repo:

1. **Delete the weekly time-trigger and the `onOpen` menu** in the Apps Script project, so it can't resume and start fighting the new endpoint over the same repo.
2. **Revoke the GitHub PAT hardcoded at `code.gs:1`.** The copy committed here is redacted, but the real token still lives in the Apps Script project with write access to this repo, and it becomes an unnecessary standing credential the moment the script is retired. (This repo already has one unresolved leaked-PAT item — `kuliah3/kuliah(beta)/.../config.json`, flagged across sessions in `kuliah/DEV_NOTES.MD` — so don't add a second.)

Migration of existing content is trivial: the six current lines become six `kind='static'` rows in `news_ticker`, ordered as they appear. Note `web/asset/moving-text/index.html` is separately broken (it does `data.map(item => item.text)` against an object keyed `moving-text` holding `Col1` fields — it cannot ever have worked); do not use it as a reference.

## 2. Supabase schema — append as `setup.sql` §10

Four tables, following §8/§9 conventions exactly (4-policy RLS gated on `admin_can_write('news')`, explicit GRANTs to **both** roles — the documented "policy without GRANT = permission denied" trap).

```sql
-- news_announcements → announcements.json
id uuid PK, title text NOT NULL,            -- internal label, also JSON "title"
heading text, body_text text, image_url text,   -- body_text maps to JSON "text"
start_at date, end_at date,
enabled boolean NOT NULL DEFAULT true,
sort_order integer NOT NULL DEFAULT 0,
created_at, updated_at timestamptz,
CHECK (image_url IS NOT NULL OR body_text IS NOT NULL)   -- mirrors news/script.js isActive():
                                                         -- an entry with neither can never display

-- news_ticker → moving-text.json
id uuid PK, message text NOT NULL,
kind text NOT NULL DEFAULT 'static' CHECK (kind IN ('static','khutbah')),
prefix text,                                 -- khutbah rows: 'Khutbah Jumaat Minggu Ini: '
start_at date, end_at date,
enabled boolean NOT NULL DEFAULT true,
sort_order integer NOT NULL DEFAULT 0,
created_at, updated_at timestamptz

-- news_settings — key/value, avoids hardcoding defaults in the endpoint
key text PK, value text, updated_at timestamptz
-- seed: default_image='/news/default.svg',
--       default_ticker_line='Selamat datang ke Masjid Al-Mukhlisin Taman Jaya 6',
--       khutbah_csv_url=<the published CSV from khutbah/index.html:127>,
--       khutbah_last_title='', khutbah_last_fetched_at=''

-- news_activity_log — verbatim copy of the infaq_activity_log template
--   (open FOR ALL policy, full CRUD grants to authenticated AND service_role)
```

**GRANT note that differs from infaq:** `service_role` needs `SELECT` on `news_announcements`/`news_ticker` but **`SELECT, INSERT, UPDATE` on `news_settings`** — the publish endpoint writes the khutbah last-good cache back. Infaq's publish is read-only, so this is the one place the pattern diverges; call it out in `database.md`.

Also: `ALTER TABLE admins ALTER COLUMN permissions SET DEFAULT '{"kuliah": true, "infaq": false, "news": false}'::jsonb;` (existing rows keep their JSON; a missing key reads false everywhere).

**Storage:** new public bucket `news-assets` with the same 4 policies as `kuliah-assets` (§4 template). Path convention `announcements/<slug>-<Date.now()>.<ext>`. Cleaner than prefixing into `kuliah-assets`, and it's the same 5 lines of SQL we're already running.

## 3. `api/publish-news.js`

Structural copy of `api/publish-infaq.js` (CORS → validate → service-role PostgREST reads → build → `pushJsonToGitHub` → activity log → `{success, target, commitUrl}`). Reuses all four existing env vars unchanged; adds **`CRON_SECRET`**.

```js
const TARGETS = {
  announcements: { file: 'news/data/announcements.json', commitMessage: '[Admin] Terbitkan pengumuman',   action: 'publish_announcements' },
  'moving-text': { file: 'news/data/moving-text.json',   commitMessage: '[Admin] Terbitkan teks berjalan', action: 'publish_moving_text' },
};
```

**Dual auth.** `POST ?target=…` with a Supabase user JWT → validated against `/auth/v1/user` exactly as infaq does. `GET` with `Authorization: Bearer <CRON_SECRET>` → the Vercel cron path; publishes **both** targets, `actor_email = 'vercel-cron'`. **Fail closed:** if `CRON_SECRET` is unset in the environment, reject every GET rather than defaulting open.

**Khutbah resolution (`kind='khutbah'` rows), fail-safe by design.** Fetch `khutbah_csv_url` — the CSV `khutbah/index.html` already reads reliably, a different and better source than whatever formula was feeding the old Sheet cell — parse with `parseCSVRow()` copied verbatim from `khutbah/index.html:133-161` (quote-aware; a naive `split(",")` truncates titles containing commas, a bug already documented in `khutbah/CLAUDE.md`), read `rows[1][1]`. On success, emit `prefix + title` and cache the title to `news_settings.khutbah_last_title`. On **any** failure — non-200, timeout, empty sheet, unparseable, or a value that smells like an error (`/^ERROR/i`, `Status: \d{3}`) — fall back to `khutbah_last_title`; if that's also empty, **omit the row entirely**.

Never interpolate an error, status code, or placeholder into a published line. The old pipeline had no such gate — it forwarded a cell's contents unconditionally — which is exactly how a 503 message ended up scrolling across the prayer hall for three weeks. Treat this validation layer as the point of the rewrite, not a detail of it.

**Pure exported functions** (the repo's testability convention — `module.exports.x = x` so node can unit-test without deploying):

- `parseCSVRow(line)`
- `isActiveNow(row, now)` — date-only expansion to full day, `enabled` check; must mirror `news/script.js`'s `isActive()` semantics so admin and display never disagree
- `buildAnnouncementsJson(rows, settings)` — drops `enabled=false` rows, **keeps future/expired ones** (the display filters live; this is what makes "schedule it now, it appears next week" work without a republish), maps `body_text`→`text`, orders by `sort_order`, attaches `default_image`
- `buildMovingTextJson(rows, settings, khutbahTitle, now)` — filters by `isActiveNow`, sorts, resolves khutbah rows, flattens to `{Col1}`, and if the result is empty emits exactly one row from `default_ticker_line`

**Skip the commit when nothing changed.** `pushJsonToGitHub` already GETs the file for its SHA — decode that content and compare with the newly-built JSON; if identical, skip the PUT and return `{success:true, unchanged:true}`. Without this the daily cron manufactures a commit every single day (exactly the noise the old `"Update ticker: …"` weekly commits created). Worth building in from the start.

MYT handling copies infaq's `MYT_OFFSET_MS = 8*60*60*1000` (UTC+8, no DST).

## 4. Admin pages

One module, permission key `news`, two pages each owning its own Terbitkan button and target — the infaq multi-target shape. **No `index.html`** under `admin/news/` (the documented `cleanUrls` landmine); landing page is `pengumuman.html`. Every page copies the standard sidebar shell verbatim, script order `app.js` → `news-common.js` → page script, all paths absolute `/admin/news/…`.

**`admin/news/news-common.js`** — `requireNewsAccess()`, `PUBLISH_BUTTON_LABELS`, `PUBLISH_NOTE_TARGETS`, `publishNews(target, btnId)`, `loadLastPublishedNewsNote(action, elId)` (querying `news_activity_log`, with the mandatory `.ilike()` email lookup — never `.eq()`), plus `getSetting()`/`saveSetting()` and a shared `computeStatus(row, now)` used by both pages' tables.

**`admin/news/pengumuman.html/.js`** — table columns Susunan · Tajuk · Jenis (Imej / Teks / Imej+Teks, derived from which fields are set) · Tempoh · Status (Aktif / Akan Datang / Tamat / Dimatikan) · actions. Modal fields: title, heading, text, image (file upload **or** URL, mutually exclusive — reuse `ustaz.js:172-206`'s upload + 3-way save logic verbatim, including `pendingRemovePoster`), start/end date, enabled, sort order. A small Tetapan card edits `default_image`.

**`admin/news/teks-berjalan.html/.js`** — table of lines with ↑/↓ reorder buttons swapping `sort_order` (no drag-drop library — no-framework rule). The `kind='khutbah'` row renders with a badge, edits its `prefix` rather than free text, and displays the last fetched title plus its timestamp. Tetapan card edits `default_ticker_line`.

**Add a "what will actually be published" preview panel to the ticker page.** Because ticker scheduling resolves server-side, an admin otherwise has no way to see what Xibo will receive — they'd be editing rows and guessing. The panel renders the exact `buildMovingTextJson` output for "now" (recomputed client-side from the same rules), including the resolved khutbah line and the default-line fallback. This is the main UX defense against pushing something wrong to a physical screen.

All Add/Edit/Delete/reorder/Terbitkan controls gated on `canWriteModule('news')`; every mutation logs to `news_activity_log` via `logActivity(action, label, detail, 'news_activity_log')` with the no-op skip.

## 5. Integration touchpoints

| File | Change |
|---|---|
| `admin/app.js` | `MODULES` — new `news` group (label "Pengumuman", permission `news`, items Pengumuman + Teks Berjalan) inserted **before** `pentadbiran`, which stays last; `defaultLandingPageFor()` — add `\|\| admin.permissions?.news` |
| `admin/users.html` / `users.js` | `perm-news` checkbox wired into the 4 documented places (add default, edit read, perms build, save) |
| `admin/userlog.js` | one `LOG_SOURCES` entry for `news_activity_log` — merging into the timeline is then automatic |
| `admin/dashboard.js` | optional gated glimpse (active announcements, active ticker lines, last published) — defer to a follow-up |
| `vercel.json` | add `"crons": [{ "path": "/api/publish-news", "schedule": "0 20 * * *" }]` (20:00 UTC = 04:00 MYT, before Subuh) and a `/news/data/(.*)` `Cache-Control: no-store` header — `news/CLAUDE.md` already flags the missing rule as the first suspect for stale content |
| `admin/setup.sql` | §10 as above |
| Docs | `admin/CLAUDE.md` (File Structure, Schema, Data Flow, Key Patterns), `admin/database.md` (incl. the service_role write-grant divergence), `news/CLAUDE.md` + `README.md` + `developer.md` (all three currently say this module is deliberately unbuilt), both `DEV_NOTES` |

## 6. Verification

**Node unit tests for the pure builders** (`api/publish-infaq.js`'s export convention + the `news/developer.md` harness style) — this is the real safety net, since the endpoint can't run locally:
- `isActiveNow` — date-only expansion, boundary days, disabled, open-ended windows; assert it agrees with `news/script.js`'s `isActive()` on identical inputs
- `buildMovingTextJson` — ordering, filtering, khutbah resolution, **khutbah fetch failure never emits an error string**, empty→default-line fallback, output shape is exactly `{"moving-text":[{"Col1":…}]}`
- `buildAnnouncementsJson` — future entries retained, disabled dropped, `body_text`→`text`, `default_image` attached; feed the result through `news/script.js` in the existing DOM-stub harness to prove the display renders it
- `parseCSVRow` — the comma-inside-quotes case

**Locally** (`python -m http.server`): admin pages, CRUD against Supabase, the ticker preview panel, and the `news/` display against a hand-edited JSON all work. **Cannot** be tested locally: `/api/publish-news` (404s → "Ralat sambungan" toast) and the cron. Remember every Supabase write hits **production** data — no local/prod split.

**On deploy:** publish announcements first (lower risk, our own JS filters it), confirm the committed JSON, then the ticker; verify `/news` renders and the ticker JSON shape byte-matches the sample; only then point Xibo at `/news/data/moving-text.json` and enable the cron. Confirm the second cron run produces **no** commit (proving the skip-if-unchanged path).

## 7. Ordering and risks

1. SQL §10 + `news-assets` bucket (invisible to users)
2. `api/publish-news.js` + its node tests — **before** any UI, so builders are proven
3. Admin pages + `news-common.js` + MODULES/permission wiring
4. `vercel.json` cache header, one manual publish of each target, then enable the cron
5. Point Xibo at the new URL; **disable the old Apps Script trigger in Google**; update docs

**Risks.** Publishing bad data to a physical mosque screen is the real one — mitigated by the preview panel, the khutbah fail-safe, the never-blank default, and the CHECK constraint that makes an undisplayable announcement impossible to save. Secondary: `CRON_SECRET` must be set before the cron is enabled (endpoint fails closed if absent); the daily commit noise is handled by skip-if-unchanged; and the old Apps Script must be stopped or it may resume writing to the retired path.

**Overlooked items surfaced by exploration, now folded in:** the old pipeline published Sheet-cell contents with zero validation (the 503 incident) so an output gate is mandatory; the khutbah CSV needs quote-aware parsing (the naive-split bug is already documented in this repo); `service_role` needs a write grant here unlike infaq; the cron's GET auth path needs deliberate fail-closed handling; the Apps Script's hardcoded GitHub PAT must be revoked at retirement; and `web/asset/moving-text/index.html` is broken and must not be copied as a reference.

**One deliberate scope increase to sanity-check:** the old model was a flat column of text with no dates, enable flag, or ordering. The new schema is a superset of that. Everything still works if the committee only ever types plain lines and publishes — dates and enable are opt-in, and the `Susunan` column defaults to insertion order. But it is more machinery than they use today, so if it feels heavy in practice, the ticker page can ship with dates hidden behind an "Advanced" disclosure without any schema change.
