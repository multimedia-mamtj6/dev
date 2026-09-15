# Upgrade Plan — `admin/khutbah/` automation-first → target `khutbah/paparan-tajuk.html` + shared-sender alerts

_Status: PLANNED, not yet executed. Written 2026-09-15._

Locked decisions (don't re-litigate):
1. Scraper is primary, manual key-in is secondary (automation-first).
2. Cron: Monday 9am only (exact port of GAS `scheduleScript()`).
3. Manual edit locks its row from auto-overwrite (`manual_override=true`, cron skips with `skipped_locked`).
4. Full weekly history kept (one row per Friday), not current-only.
5. Email alerts: Resend via `fetch`, all failures (404 + network + Hijri + regex parse miss), recipients in settings table (comma-separated, multi-account).
6. Display target: `khutbah/paparan-tajuk.html` (maintained page going forward). `khutbah/index.html` frozen as-is.
7. Shared sender built once here, reused by all future modules. Zero money cost at this scale (see §8).

## 0. Context

Current system (`khutbah/`, see `khutbah/CLAUDE.md` + `khutbah/DEV_NOTES.md`):
- `KhutbahLinkGenerator.gs:generateKhutbahLink()` computes `getNextFriday()` (today if Friday), formats
  `dd-{malay-month}-yyyy`, fetches Hijri via `api.waktusolat.app/v2/solat/PHG03` (day-of-month match in
  `prayers[]`), builds `https://mufti.pahang.gov.my/khutbah/{year}/{greg}m-{hijri}h`, writes
  `link extractor!A2` + `MIMBAR JUMAAT SIRI {M}|{YYYY}` to B2 (Friday date, not today — deliberate at month
  boundaries), logs to `Link Log`, then calls `extractKhutbahData()` directly (formula recalc never fires `onEdit`).
- `gettajukkhutbah.gs:extractKhutbahData()` reads `tajuk khutbah!A2` (`getSheets()[0]`), fetches with
  `muteHttpExceptions`, regex scrapes (primary `dateRegex` already stale — falls through to `altDateRegex`;
  `titleRegex` + `cleanTitleHtml(<br/>→space)`), writes C2 date / D2 title or `ERROR: ...` strings on failure.
- Bridge bug to kill: `tajuk khutbah!A2 == ='link extractor'!A2` formula — any hand-correction replaces the
  formula with a plain value and silently breaks automation. The new `manual_override` flag replaces this
  with an explicit lock.
- `refresh.gs:onOpen()` Custom Menu → manual run. `onOpen2()`/`runMyFunction()` dead/scratch.
- Display: `paparan-tajuk.html` (naive `row.split(",")`, line 137 — CSV-quoting bug) and `index.html`
  (quote-aware `parseCSVRow()` fix). Targeting `paparan-tajuk.html` fixes the bug by construction (JSON has
  no CSV quoting, no parser port needed).
- Pre-verify before build: confirm the mosque screen / Google Sites embed points at `paparan-tajuk.html`.
  If it points at `index.html`, this target puts the upgrade on the wrong URL.

## 1. Schema (`admin/setup.sql` §12 — new)

```sql
khutbah_weeks: id uuid PK, friday_date date UNIQUE NOT NULL,
  source_url text NOT NULL, siri_text text NOT NULL,
  title text, date_text text, main_text text,
  hijri_part text, gregorian_part text,
  manual_override boolean DEFAULT false,
  scrape_status text,  -- ok | fetch_failed | parse_failed | skipped_locked
  scrape_error text, fetched_at timestamptz,
  created_at timestamptz, updated_at timestamptz

khutbah_settings: key text PK, value text, updated_at timestamptz
  -- seed keys: alert_emails ("" = no mail, comma-separated),
  -- alert_from, last_alert_at, last_alert_reason

khutbah_activity_log: id uuid PK, created_at timestamptz,
  actor_email text NOT NULL, actor_name text,
  action text NOT NULL,  -- khutbah_auto_generate | khutbah_scrape_ok |
                         -- khutbah_scrape_failed | khutbah_manual_update |
                         -- khutbah_lock | khutbah_unlock | publish_khutbah
  target_label text, detail text  -- target_label = friday_date, plain-text snapshots, never FKs
```

RLS: same 4-policy `admin_can_write('khutbah')` shape as `admin/setup.sql` §10 (news). `service_role`:
`khutbah_weeks` SELECT+INSERT+UPDATE (cron writes — deliberate, document it), `khutbah_settings`
SELECT+INSERT+UPDATE (alert cache writeback — same documented divergence as `news_settings`),
`khutbah_activity_log` full CRUD (server-side publish writes). Browser uses anon key + RLS;
`logActivity(..., 'khutbah_activity_log')` never throws (logging failure must not look like save failure).

Fail-safe rule (from news post-mortem): NEVER publish an `ERROR: ...` string. On any failure keep
last-good values and publish old JSON unchanged.

## 2. Shared sender (built once here, reused by every future module)

- New `admin/alert-send-pure.js`: `sendAlert({ to, subject, text })` + `shouldAlert(lastAlertAt)` —
  pure `fetch` POST to `https://api.resend.com/emails`, `Authorization: Bearer RESEND_API_KEY`, no npm.
  Returns `{ sent, reason }`, never throws (mail failure can't fail a publish). Same convention as
  `admin/news/publish-news-pure.js` / `admin/staff/staff-pin-pure.js`: plain static file, `require()`d
  server-side by any `api/*.js`, loadable later via `<script>` for previews. Never put shared pure logic
  under `api/` (any file there is a live route, not servable source).
- One env var: `RESEND_API_KEY` (Vercel only). Sender domain (`alert_from`, e.g. `noreply@mamtj6.com`)
  verified once in the Resend dashboard.
- Recipients are per-module, in each module's own settings table (`khutbah_settings.alert_emails` here) —
  khutbah failures never spam infaq/news people. Editable in the module's Tetapan card, no redeploy.
- Reuse contract for module #2: `require` helper + read own `*_settings.alert_emails` + call. No new
  vendor, keys, domain verification, or table-shape invention.
- Why Resend over Gmail API: 1 key + 1 fetch vs client ID + secret + refresh token + consent flow +
  hourly token-refresh code + hand-rolled base64url MIME + 7-day test-mode expiry/verification upkeep.
  Gmail is free in money, expensive in complexity; every future module re-pays it.

## 3. Scraper port (`admin/khutbah/publish-khutbah-pure.js` + `api/publish-khutbah.js`)

- Pure file ports `.gs` logic verbatim: `getNextFriday()` (today if Friday), `formatGregorianDate()`
  (Malay month names), Hijri via `fetch("https://api.waktusolat.app/v2/solat/PHG03")` with the same
  `prayers.find(p => p.day === friday.getDate())` day-match (month-boundary miss → `fetch_failed`, never
  guess), `buildMuftiLink()`, `cleanTitleHtml()`, `extractDateTitle(html)` returning
  `{ dateText, titleText, dateMatched, titleMatched }` with primary + alt regexes both kept — the flags
  make the next mufti markup drift visible in admin instead of silent fallback.
- `api/publish-khutbah.js` dual-auth, exactly the `api/publish-news.js` shape: `POST` + Supabase session
  Bearer (admin "Jana & Terbitkan" button) / `GET` + `Bearer CRON_SECRET` fail-closed (Vercel cron Mon 9am;
  Hobby granularity caveat — exact 9am may arrive as "Monday sometime", same as the existing daily cron).
- Handler steps: compute Friday/Hijri/link+siri → locked-check (`manual_override` → `skipped_locked`,
  stop, no mail) → fetch mufti URL (`response.ok` check; non-200 incl. 404 → `fetch_failed/HTTP_404`) →
  regex extract (miss → `parse_failed/DATE|TITLE`) → upsert row → rebuild `khutbah/data/khutbah.json`
  (`{ current: {...}, history: [...] }`, Friday-desc) → GitHub push via API (skip commit if byte-identical,
  news pattern) → activity-log row.

## 4. Error → email flow (all failures)

```
cron GET (CRON_SECRET) or admin POST (session) → compute → locked? (skip, no mail)
  → fetch mufti URL → !ok (incl. 404) → fetch_failed
  → ok → regex extract → miss → parse_failed
  → success → upsert ok, publish JSON, log khutbah_scrape_ok, END (no mail)
failure branch:
  a. upsert row (keep last-good title/date_text, set scrape_status + scrape_error + fetched_at)
  b. spam guard — send ONLY if transition (prev status for this friday_date was ok or row is new)
     AND khutbah_settings.last_alert_at is null or >24h ago; else log
     khutbah_scrape_failed alert_sent:false(suppressed), publish unchanged JSON, END
  c. sendAlert({ to: alert_emails.split(",").map(trim).filter(Boolean),
       subject: `[Khutbah] Gagal — Jumaat {friday_date} ({HTTP_404|...})`,
       text: attempted URL, failed step, HTTP code, missed regex,
             last-good title, admin link /admin/khutbah/senarai })
  d. write last_alert_at=now(), last_alert_reason=code;
     log khutbah_scrape_failed detail = error + alert_sent:true/false(send_error).
     Send failure is caught — publish still succeeds (mail never blocks display).
```

What the committee gets on a 404 Monday: display keeps last week's good title (never breaks), inbox
gets 1 mail per address in `alert_emails` (one Resend call, `to[]` array, ≤50 recipients) with bad URL +
code + admin link, admin table shows red `fetch_failed/404` + "alert 09:02". Re-runs that week stay
silent until fixed; fixing re-arms the next alert.

## 5. Admin UI (`admin/khutbah/` — new module)

- `senarai.html/.js`: weekly history table (Friday, Siri, title, status pill, lock icon) + row edit modal
  (URL/title/date_text/main_text + override checkbox + Lock/Unlock buttons) + Tetapan card
  (`alert_emails`, `alert_from`) + "Jana & Terbitkan" button (manual trigger of the same pipeline,
  replaces GAS Custom Menu).
- `khutbah-common.js`: `requireKhutbahAccess()`, `publishKhutbah()`, `loadLastPublishedKhutbahNote()`
  (same per-module-common pattern as `infaq-common.js`/`news-common.js`).
- Wiring checklist: `app.js` `MODULES` +1 entry (absolute `/admin/khutbah/...` paths — cleanUrls landmine:
  relative refs break under slash-less `/admin/khutbah` on Vercel but pass locally),
  `defaultLandingPageFor()`, `users.html` perm-khutbah checkbox, `userlog.js` `LOG_SOURCES` +1 entry,
  `dashboard.html` khutbah glimpse (reuse `.stat-card`/`.progress-*` classes, no new CSS),
  `vercel.json` no-store already covers `/admin/(.*)` — add `/khutbah/data/(.*)` rule + Mon-9am cron entry.

## 6. Display (`paparan-tajuk.html` ONLY)

- Replace `sheetURL` CSV fetch with `fetch("/khutbah/data/khutbah.json", { cache: "no-store" })`, render
  `current.title` → `.title`, `current.date_text` → `.date`, `current.main_text` → `.main-text`.
- Keep untouched: 60s poll + `lastFetchedData` flicker guard, `adjustFontSize()` shrink-to-fit loop,
  `scaleToFit()` iframe scaling, spinner/error states (`TIADA DATA`/`ERROR`).
- `index.html` and `beta-paparan-tajuk.html`: explicitly untouched (frozen legacy).
- Later (separate step): `admin/news` ticker `kind='khutbah'` source switches from CSV URL to this same
  JSON (small `publish-news-pure.js` change, same fail-safe cache semantics).

## 7. Build order + verification

Build: setup.sql §12 → `publish-khutbah-pure.js` → `alert-send-pure.js` → `api/publish-khutbah.js` →
`admin/khutbah/` UI + wiring → `paparan-tajuk.html` JSON switch → cron + Tetapan → docs.

1. Schema + grants run in Supabase; seed one row from live Sheet A2–D2.
2. Manual `POST /api/publish-khutbah` from admin button → JSON written + `khutbah_scrape_ok` log row.
3. Bad-URL run → row `fetch_failed/404`, 1 mail to ALL `alert_emails`, log `alert_sent:true`; immediate
   re-run → suppressed, no 2nd mail.
4. Lock row → re-run → `skipped_locked`, values untouched (old formula-break case, now explicit).
5. `RESEND_API_KEY` unset → publish still succeeds, logged `alert_skipped_no_key` (fail-open display).
6. `paparan-tajuk.html` renders from JSON; forced scrape failure → keeps last-good, no `ERROR:` on screen.
7. Two successful Monday crons → retire `.gs`/Sheet (repo copies stay as history); update
   `khutbah/CLAUDE.md` (swap primary/legacy roles, automation section), `khutbah/DEV_NOTES.md` (session
   note), root `CLAUDE.md` tree if needed.

## 8. Cost

Zero added money cost at this scale: Resend free (100/day, 3k/mo; this use ≈ 1–5 mails/week — stays free
permanently; upgrade only if sustained >100/day, which the spam guard structurally prevents); Supabase
new tables ≈ 52 rows/year (fits existing usage); Vercel 2nd cron rides existing Hobby setup (exact-minute
precision would be the only Pro-plan trigger, not adopted here); GitHub API publishes already in use.
Domain verification for `alert_from` is free (domain already owned).

## 9. Out of scope

Sheet/Apps Script deletion now (after §7.7 only); `index.html` / `beta-paparan-tajuk.html` changes;
pre-2026 history backfill; `getPastWeekKhutbahLink()`/A4-A5 port (superseded by full-history table);
exact-to-the-minute cron guarantee on Hobby.
