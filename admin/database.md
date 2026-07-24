# Database — admin

_Moved here from `kuliah/admin/` on 2026-07-19 — see `admin/plan.md` and `admin/CLAUDE.md`._

Everything about the Supabase (PostgreSQL) database backing `admin/`: how to set it up from scratch, what's in it, how to maintain it, and how to fix it when something breaks.

The canonical setup script is [`setup.sql`](setup.sql) — this document explains *why* it's structured the way it is and walks through using it. **Never run parts of it blindly without reading what they do first** (per its own header comment).

---

## 1. Setup from scratch

Follow these in order — each step depends on the one before it.

### 1.1 Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Note the **Project URL** and the **anon (publishable) key** (Project Settings → API) — the anon key goes in `admin/app.js` (`SUPABASE_URL`/`SUPABASE_ANON_KEY`, safe to expose in browser code, RLS enforces access control).
3. Note the **service_role key** separately — this is a secret, never put it in any file that gets committed. It only ever goes into a Vercel environment variable (see 1.4).

### 1.2 Run `setup.sql`

Open Supabase Dashboard → SQL Editor → New query, paste the entire contents of [`setup.sql`](setup.sql), and run it. This single script creates, in order:

1. **Tables** — `admins`, `ustaz`, `schedule` (§1)
2. **Indexes** on `schedule` for date/ustaz lookups (§2)
3. **RLS policies + explicit GRANTs** for all three tables (§3) — see [§3 RLS & permissions](#3-rls--permissions-the-part-thats-easy-to-get-wrong) below for why both are required
4. **Storage bucket** `kuliah-assets` for poster images, public-read/authenticated-write (§4)
5. **Google OAuth setup instructions** — manual steps, can't be done via SQL (§5)
6. **Bootstrap-the-first-super_admin instructions** — manual, one-time (§5b)
7. **Sample ustaz data** — commented out, optional (§6)
8. **`activity_log` table** + its own RLS/GRANTs (§7)
9. **Viewer role + write-gated RLS** (§9, added 2026-07-23) — extends the `role` CHECK, adds the `admin_can_write()`/`admin_is_super_admin()` helper functions, and replaces the single permissive policy on `admins`/`ustaz`/`schedule`/all 4 infaq tables with the SELECT-open/write-gated split described in [§3](#3-rls--permissions-the-part-thats-easy-to-get-wrong) — verify the `admins_role_check` constraint name first, per the comment at the top of §9

It's safe to re-run the whole script — every `CREATE TABLE`/`CREATE INDEX` uses `IF NOT EXISTS`, and bucket creation uses `ON CONFLICT DO NOTHING`. `CREATE POLICY` and `GRANT` are **not** idempotent the same way — re-running will error on `CREATE POLICY "name" already exists` if the policy is still there. That's expected and harmless; just skip that line if re-running after a partial failure.

### 1.3 Configure Google OAuth

Follow `setup.sql`'s §5 comment block:

1. Supabase Dashboard → Authentication → Providers → Google → enable it, paste your Google OAuth Client ID/Secret (create these at [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials).
2. Copy the Callback URL Supabase shows you, add it to your Google OAuth app's Authorised redirect URIs.
3. Supabase Dashboard → Authentication → URL Configuration → add your redirect URLs (`https://<your-domain>/admin/dashboard.html`, plus `http://localhost:8000/admin/dashboard.html` for local dev — `dashboard.html` is the OAuth `redirectTo` target as of 2026-07-22, replacing `admin/kuliah/jadual.html`).

### 1.4 Bootstrap the first super_admin

The `admins` table starts empty. But `users.html` — the page for adding admins — requires being logged in as a super_admin just to load. That's a chicken-and-egg problem the UI can't solve on its own. Break it with one manual insert, per `setup.sql` §5b:

```sql
INSERT INTO admins (email, name, role, permissions) VALUES
    ('your-email@gmail.com', 'Your Name', 'super_admin', '{"kuliah": true}'::jsonb);
```

The email must exactly match the Google account you'll log in with. After this one row exists, every other admin can be added normally through `users.html` — you never need to run this insert again.

### 1.5 Configure Vercel environment variables

`api/publish.js` needs these set in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Same project URL as `app.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | The service_role key from 1.1 — **never** put this in a committed file |
| `GITHUB_TOKEN` | Fine-grained PAT with `contents:write` on the target repo |
| `GITHUB_REPO` | e.g. `multimedia-mamtj6/dev` |

### 1.6 Verify

1. Serve the site locally (`python -m http.server` from repo root) or visit the deployed URL, open `admin/index.html`.
2. Log in with the Google account you bootstrapped in 1.4.
3. You should land on `dashboard.html` (the cross-module overview) with **both** "Pengguna" and "Log Aktiviti" visible in the sidebar (proves the `super_admin` role and `renderSidebar()`'s permission gating are both working).
4. Add a test ustaz on `ustaz.html`, assign them to a day on `jadual.html`, save — confirms `ustaz`/`schedule` writes work.
5. Check `userlog.html` shows the ustaz-create and day-edit rows you just made — confirms `activity_log` writes work.
6. `Terbitkan` only works where a Vercel serverless runtime actually runs `/api/publish` — it will fail locally with a connection-error toast, that's expected (see [Troubleshooting](#4-troubleshooting)).

### 1.7 Set up the infaq module (optional — separate from the kuliah setup above)

`admin/infaq/` (donation/expense tracking) is a second, independent module — skip this section entirely if you only need the lecture-schedule side. Its schema lives in `setup.sql` §8, run separately from §1-7 above:

1. In the Supabase SQL Editor, select and run `setup.sql` §8 in full (the `── 8. Infaq module ──` header through the end of that section) — **as one paste, not statement-by-statement.** Running it piecemeal can trip Supabase's own SQL Editor lint warning ("creates a table without enabling Row Level Security") on the `infaq_projects`/`infaq_kutipan_mingguan`/etc. `CREATE TABLE` statements individually, because the linter only sees the one statement you selected — it doesn't know the matching `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` exist later in the same section. Selecting and running the whole section together resolves this; the warning is a false alarm in that case, not a real gap.
2. **If your database already ran an earlier version of §8** (one that created `infaq_donations`/`infaq_expenses` — the per-row donation/expense model, replaced 2026-07-21 by the pre-aggregated tables in the current §8), don't re-run the whole section — `infaq_projects`/`infaq_activity_log`'s `CREATE POLICY` statements will error ("already exists," Postgres has no `IF NOT EXISTS` for policies). Run only the three new `CREATE TABLE` blocks (`infaq_kutipan_mingguan`/`infaq_projek_kutipan`/`infaq_perbelanjaan_bulanan`) plus their own indexes/RLS/policies/grants, then run §8b (next step) to clean up the old tables.
3. Run §8b (`DROP TABLE IF EXISTS infaq_donations, infaq_expenses`) — only relevant if step 2 applied to you; safe no-op otherwise. **Irreversible** — check Supabase's Table Editor first if those tables might hold real data you want to keep.
4. Optional: `admin/import-legacy-infaq-data.sql` bulk-imports historical donation/expense data transcribed from a Sheet — see that file's own header comment before running it (Section C, the project + its donations, is **not** idempotent — running it twice creates duplicate rows).
5. In `users.html`, grant `permissions.infaq` to whichever admins need it (unlike `permissions.kuliah`, this defaults to `false` on new rows — see [§2](#admins) below).
6. Verify: log in as an admin with `permissions.infaq`, confirm the "Infaq" nav links appear and `ringkasan.html` loads without a denied-redirect. Add a test row on `kutipan.html`, confirm it appears in Supabase's Table Editor.

No new Vercel environment variables are needed — `api/publish-infaq.js` reuses the same `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`GITHUB_TOKEN`/`GITHUB_REPO` from [1.5](#15-configure-vercel-environment-variables).

---

## 2. Database structure

Four kuliah tables + four infaq tables (§2.1 below), one storage bucket. No triggers, no stored procedures, no views — every table is written to directly from `admin/*.js` (and the two activity-log tables also from their respective `api/publish*.js` server-side). This repo has **zero** database-side logic beyond RLS/GRANTs; all business logic lives in the client JS.

```
admins ──────────────┐
  (who can log in)    │ (actor_email/actor_name — plain text, NOT a FK)
                       ▼
                 activity_log
                       ▲
  (subuh/maghrib_ustaz_id — FK, ON DELETE SET NULL)
ustaz ◄──────────── schedule
  (penceramah)         (one row per date)
```

infaq's tables are documented separately in [§2.1](#21-infaq-tables) — independent of the diagram above, they don't reference `ustaz`/`schedule` at all.

### `admins`

Who's allowed to log in, and what they can do. Checked by `app.js`'s `requireAuth()` after every Google OAuth login — an email not in this table gets signed out immediately and redirected to `index.html?denied=1`.

```sql
id          UUID PK
email       TEXT UNIQUE NOT NULL   -- must match the Google account exactly
name        TEXT                  -- display name, shown in nav/logs
role        TEXT NOT NULL DEFAULT 'editor'  CHECK ('editor' | 'super_admin' | 'viewer')
permissions JSONB NOT NULL DEFAULT '{"kuliah": true, "infaq": false}'
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

- `role = 'editor'` — can edit schedule + ustaz. `role = 'super_admin'` — also gets `users.html` (manage admins) and `userlog.html` (activity log). `role = 'viewer'` (added 2026-07-23) — can see whichever modules `permissions` grants, exactly like an editor, but can never write anywhere (Add/Edit/Delete/Terbitkan), in any module, regardless of `permissions`. Orthogonal axes: `role` decides *can they write at all*, `permissions` decides *which modules can they see*.
- `permissions` is a per-module flag object — `{ kuliah: bool, infaq: bool }` as of the infaq module (2026-07-19). `kuliah` defaults `true` (opt-out), `infaq` defaults `false` (opt-in) — set per-admin in `users.html`. **As of 2026-07-23, both `permissions.kuliah` and `permissions.infaq` are enforced** — `requireModuleAccess(moduleKey)` (`app.js`, `requireInfaqAccess()` is now a wrapper around it) gates page visibility for both modules, and real RLS policies (§3) gate writes at the database level. Before that date, `permissions.kuliah` was schema-only with no gate anywhere — see `DEV_NOTES.MD` for that history.
- No `updated_at` column (unlike the other three tables) — nobody has needed to know when an admin's role last changed. If that becomes important, add it the same way `ustaz`/`schedule` have theirs.

### `ustaz`

The penceramah (lecturer) registry.

```sql
id           UUID PK
short_name   TEXT UNIQUE NOT NULL   -- shown everywhere in the UI (dropdowns, pills, log)
full_name    TEXT NOT NULL          -- used in published JSON, formal contexts
tajuk_kuliah TEXT                   -- lecture topic, optional
poster_url   TEXT                   -- Supabase Storage public URL, optional
created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

- `short_name` is `UNIQUE` — this is what breaks if you try to add two ustaz with the same short name (see [Troubleshooting](#4-troubleshooting)).
- Sort order is **never** done via Supabase `.order('short_name')` — Postgres sorts that lexicographically (`"Ustaz 10"` before `"Ustaz 2"`), not numerically. Every page that lists ustaz sorts client-side with `localeCompare({ numeric: true })` instead. Don't add `.order()` back.
- Deleting a row is blocked in the UI (`ustaz.js`'s `confirmDelete()`) if the ustaz is still referenced in any `schedule` row — but nothing stops that check being bypassed by direct SQL, so the FK's `ON DELETE SET NULL` (below) is the real safety net.
- Poster files uploaded to Storage are **not** cleaned up when a poster is replaced or removed — old files are simply orphaned in the `kuliah-assets` bucket. Known gap, see [Maintenance](#3-maintenance).

### `schedule`

One row per calendar date — the actual lecture schedule.

```sql
id               UUID PK
date             DATE UNIQUE NOT NULL
subuh_ustaz_id   UUID REFERENCES ustaz(id) ON DELETE SET NULL
maghrib_ustaz_id UUID REFERENCES ustaz(id) ON DELETE SET NULL
subuh_pending    BOOLEAN NOT NULL DEFAULT false   -- "Belum Ditetapkan" — see note below
maghrib_pending  BOOLEAN NOT NULL DEFAULT false
cuti_umum        TEXT              -- public holiday label, optional
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

- `date` is `UNIQUE` — every write from the dashboard is an `upsert` keyed on `date` (`onConflict: 'date'`), never a plain insert.
- `ON DELETE SET NULL` on both ustaz FKs — if an ustaz row is ever deleted (bypassing the UI guard above), any schedule row that referenced them just goes back to "Tiada Kuliah" instead of erroring or cascading a delete.
- **`subuh_pending`/`maghrib_pending` (added session 8) are mutually exclusive with their matching `*_ustaz_id`** — `jadual.js`'s `saveDay()` forces the ustaz id to `null` whenever its pending checkbox is checked, so a slot is never both "assigned" and "pending" at once. Used for a Ceramah Khas day where a slot is known to be happening but the speaker/topic isn't decided yet ("Belum Ditetapkan") — publishing writes `{ pending: true }` for that slot instead of an ustaz object or `null`, so the public page can show "Ceramah Khas — Akan Diumumkan" instead of either a name or nothing at all.
- Month navigation in `jadual.js` is unrestricted (any past/future month), but only the **real current** and **real next** calendar month can ever be published (`api/publish.js` rejects any other `month` param) — editing further out is for early planning only.

### `activity_log`

Accountability changelog — who changed what, when. Added later than the other three tables; see [`developer.md`](developer.md)'s "Activity log" section for the full design rationale.

```sql
id           UUID PK
created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
actor_email  TEXT NOT NULL
actor_name   TEXT
action       TEXT NOT NULL   -- schedule_day_edit | schedule_duplicate | schedule_clear |
                             -- ustaz_create | ustaz_update | ustaz_delete |
                             -- admin_create | admin_update | admin_delete | publish
target_label TEXT            -- human-readable snapshot: a date, an ustaz short_name, an email, a month
detail       TEXT            -- human-readable before→after diff, or a summary for bulk actions
```

- **`actor_email`/`actor_name`/`target_label` are always plain-text snapshots taken at the moment of the action — never a foreign key to `admins`/`ustaz`/`schedule`.** This is deliberate: those rows can be renamed or hard-deleted later, and the log must stay readable regardless. If you're tempted to "normalize" this into a proper FK relationship, don't — that's the one design decision in this table that must not change.
- Written by `logActivity()` in `app.js` (every browser write) and separately by `api/publish.js` (server-side, for the `publish` action, using the service_role key).
- No `updated_at` and no `UPDATE`/`DELETE` code path exists anywhere in the app for this table — it's meant to be append-only. The `GRANT` includes `UPDATE`/`DELETE` for admin flexibility (e.g. manual cleanup via SQL Editor), but nothing in the UI ever calls it.
- Row count grows unboundedly over time but stays cheap at this app's realistic scale (a single mosque, a handful of admins) — `idx_activity_log_created_at` keeps the common "recent activity" queries fast regardless. See [Maintenance](#3-maintenance) if this ever needs revisiting.

### Storage: `kuliah-assets` bucket

Public bucket for ustaz poster images. Public read (anyone can view a poster URL), authenticated-only write/update/delete. Upload path convention: `posters/{safe-short-name}-{timestamp}.{ext}` (see `ustaz.js`'s `saveUstaz()`).

---

## 2.1 Infaq tables

Independent of the kuliah tables above — no foreign keys cross between the two groups, `infaq_projects` is the only table any of the others below reference. Added 2026-07-19, **rebuilt from scratch 2026-07-21** after comparing the original design against the mosque's real recording pattern (the live Sheet/JSON behind their separate, older `infaq.mamtj6.com` site) and finding it didn't match — see `DEV_NOTES.MD` session 11 for the full story. Nothing from the original design was ever run against live Supabase, so this was a clean rebuild, not a migration.

```
infaq_projects
    ▲ (project_id — FK, NOT NULL)
infaq_projek_kutipan

infaq_kutipan_mingguan          infaq_perbelanjaan_bulanan
  (no FK to anything)              (no FK to anything)
```

### `infaq_projects`

Named fundraising campaigns with a target (e.g. a building fund). History is kept — rows are never overwritten when a project ends, only `is_active` flips.

```sql
id            UUID PK
name          TEXT NOT NULL
target_amount NUMERIC(12,2) NOT NULL CHECK (> 0)
is_active     BOOLEAN NOT NULL DEFAULT false
completed_at  TIMESTAMPTZ
launch_date   DATE                -- optional, added 2026-07-23 (session 13)
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

- **At most one active project at a time**, enforced by a partial unique index (`idx_infaq_projects_one_active`, `ON is_active WHERE is_active = true`). `admin/infaq/projek.js`'s "Jadikan Aktif" action must deactivate the currently-active project (setting `completed_at`) **before** activating the target — two sequential `UPDATE`s, always in that order, so the index is never transiently violated by two concurrently-true rows.
- New projects are always created `is_active: false` — activating is a separate, explicit step, so drafting a new project can never silently deactivate whatever's currently live.
- General/unearmarked infaq (`infaq_kutipan_mingguan`) never touches this table — only donations explicitly recorded against a project (`infaq_projek_kutipan`) count toward `JumlahTerkumpul`.
- **`launch_date` (session 13, 2026-07-23)** — optional, filled in per-project via `projek.html`'s Edit modal, never backfilled via SQL. Exists because `infaq_projek_kutipan.jumlah` has a `CHECK (> 0)` constraint that blocks recording a real historical RM0 "launch marker" entry as a donation row — this field is the alternative home for that date. Drives `admin/infaq/projek-kutipan.js`'s "`X` hari sejak dilancarkan" display (`daysSince()` in `app.js`) — hidden entirely, not shown as a placeholder, when unset.

### `infaq_kutipan_mingguan`

General infaq (tabung Jumaat/harian) — **one row per week actually collected**, not per donor. This matches how the committee really records it: a single lump sum per week, exactly like the Sheet this schema was designed against.

```sql
id         UUID PK
tahun      INTEGER NOT NULL
bulan      INTEGER NOT NULL CHECK (1-12)
minggu     INTEGER NOT NULL CHECK (1-5)
jumlah     NUMERIC(12,2) NOT NULL CHECK (> 0)
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
UNIQUE (tahun, bulan, minggu)
```

- **Sparse by design** — a week with nothing collected simply has no row (matching the source Sheet's "-" cells), never a stored zero. Every rollup (`JumlahBulanan`, yearly `graf`, `ringkasan` totals) is computed by `api/publish-infaq.js`, never typed in.
- `admin/infaq/kutipan.js` writes via **upsert** on `(tahun, bulan, minggu)`, not plain insert — recording an already-existing week replaces its total rather than erroring, matching the real workflow (the committee just records "this week's number," they shouldn't need to check whether it already exists).

### `infaq_projek_kutipan`

Individual dated donations earmarked to ONE project — the only infaq table that's genuinely per-deposit, because that's how the real project ("Tabung Bangunan Tambahan MAMTJ6") is actually tracked in the source data.

```sql
id         UUID PK
project_id UUID NOT NULL REFERENCES infaq_projects(id)
tarikh     DATE NOT NULL
jumlah     NUMERIC(12,2) NOT NULL CHECK (> 0)
keterangan TEXT
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

- `project_id` is `NOT NULL` — general, unearmarked infaq lives in `infaq_kutipan_mingguan` instead, never here.
- No `ON DELETE CASCADE` on the FK — `admin/infaq/projek.js`'s `confirmDelete()` blocks deleting a project while any donation still references it (a client-side guard; direct SQL could still bypass it, at which point the delete would simply fail on the FK constraint rather than silently orphaning rows).
- No unique constraint — legitimate same-day duplicate donations exist in the real data (e.g. the tabung emptied twice in one collection run), so don't add one.
- Edited via `admin/infaq/projek-kutipan.html?project=<id>` — reached by clicking "Lihat Kutipan" on a project's row in `projek.html`, not a standalone nav link.

### `infaq_perbelanjaan_bulanan`

Mosque expenses — **one row per month total**, not per bill/receipt. The real Sheet never tracked category or description per expense, only a monthly lump sum, so this matches exactly (a deliberate simplification from the original per-expense design).

```sql
id         UUID PK
tahun      INTEGER NOT NULL
bulan      INTEGER NOT NULL CHECK (1-12)
jumlah     NUMERIC(12,2) NOT NULL CHECK (> 0)
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
UNIQUE (tahun, bulan)
```

- Same sparse-by-design + upsert-on-conflict pattern as `infaq_kutipan_mingguan`, just keyed on `(tahun, bulan)` only (no `minggu`).

### `infaq_activity_log`

A **separate** table from `activity_log` (kuliah's) — deliberate choice for independent auditability on money data. Otherwise identical shape/reasoning to `activity_log` above.

```sql
id           UUID PK
created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
actor_email  TEXT NOT NULL
actor_name   TEXT
action       TEXT NOT NULL  -- infaq_kutipan_mingguan_create/update/delete |
                             -- infaq_projek_kutipan_create/update/delete |
                             -- infaq_perbelanjaan_create/update/delete |
                             -- infaq_project_create/update/delete/activate |
                             -- publish_monthly | publish_daily | publish_perbelanjaan
target_label TEXT
detail       TEXT
```

- **Not yet shown anywhere in the UI** — `userlog.html` only reads kuliah's `activity_log`, so every infaq accountability row is currently write-only. Known gap, see `DEV_NOTES.MD`'s WHAT MIGHT COME NEXT.
- Written by `logActivity(action, targetLabel, detail, 'infaq_activity_log')` — `app.js`'s shared `logActivity()` gained an optional 4th param (table name, defaults to kuliah's `activity_log`) specifically so infaq pages could reuse it without duplicating the function.
- **`publish_monthly`/`publish_daily`/`publish_perbelanjaan` (2026-07-22) are 3 distinct actions, not one shared `publish`** — `api/publish-infaq.js` publishes each of its 3 output files independently (`?target=monthly|daily|perbelanjaan`), each logging its own row so `kutipan.html`/`perbelanjaan.html`/`projek-kutipan.html` can each show their own "last published" note next to their own Terbitkan button (moved off `ringkasan.html` the same day — see `admin/CLAUDE.md`'s Key Patterns).

---

## 3. RLS & permissions (the part that's easy to get wrong)

**As of 2026-07-23 (`setup.sql` §9), write access is enforced per-role in Postgres — this replaced the fully-open state described below for most tables.** `admins`, `ustaz`, `schedule`, and all 4 infaq data tables (`infaq_projects`/`infaq_kutipan_mingguan`/`infaq_projek_kutipan`/`infaq_perbelanjaan_bulanan`) each moved from one permissive `FOR ALL` policy to 4 separate policies: SELECT stays open to any authenticated admin (unchanged), INSERT/UPDATE/DELETE are gated behind two new `SECURITY DEFINER` SQL helper functions:
- `admin_can_write(module_key)` — `true` for `role = 'super_admin'`, or `role = 'editor'` AND `permissions.<module_key>` is truthy. Used by `ustaz`/`schedule` (`'kuliah'`) and the 4 infaq tables (`'infaq'`).
- `admin_is_super_admin()` — `true` only for `role = 'super_admin'`. Used by `admins`' own policies — a non-super_admin can no longer write to the `admins` table at all via a raw API call (previously possible, and how a non-super_admin could have self-promoted, bypassing `users.html`'s own client-side gate entirely).

Both functions look up the caller's row via `WHERE email ILIKE auth.email()` (case-insensitive, same reasoning as the client-side/`api/publish.js` email matching elsewhere in this repo) and mirror `app.js`'s `canWriteModule(moduleKey)` exactly — that function is UI-level defense-in-depth (hides doomed write controls), **this SQL is the real enforcement**, since RLS applies even to a hand-written call from the browser console, not just the app's own code paths.

**Deliberately left unchanged: `activity_log`/`infaq_activity_log` still use one open `FOR ALL` policy**, no role check. `logActivity()` is fire-and-forget, called from many sites across every role, and always swallows its own errors so a logging failure never masks a real save/delete/publish failure to the user. A `viewer`'s real data writes are already blocked everywhere above, so a spoofed log row from a direct API call is inert noise — gating these too risked a misconfigured policy silently swallowing a legitimate editor's own audit entry instead, a worse failure mode than the marginal risk being closed.

There's still no true per-row restriction anywhere (e.g. one editor can't be limited to only their own changes) — that remains out of scope.

**The lesson learned the hard way, twice, building `activity_log`:** an RLS policy is *necessary but not sufficient*. Postgres checks table-level `GRANT` privileges **before** RLS is even evaluated — a role with no `GRANT` gets `permission denied for table X`, regardless of what policies exist. `ustaz`/`schedule`/`admins` happened to work without an explicit `GRANT` early on because they inherited access from that particular Supabase project's default privileges at the time they were created by hand — `activity_log` (created later, via this script) did not inherit anything, and neither will any table you create from a fresh project. **`setup.sql` now issues an explicit `GRANT` for every table, for every role that touches it, precisely so a from-scratch setup never depends on inherited defaults that may or may not exist.** This is a separate, still-true concern from the write-gating above — a `GRANT` is what lets a role touch a table _at all_; the new `INSERT`/`UPDATE`/`DELETE` policies then decide _whether that specific write is allowed_. Both still apply — `setup.sql` §9 doesn't touch any `GRANT`, only policies.

Two roles matter here, and they need separate grants:
- **`authenticated`** — every browser write (the anon key + a valid session) uses this role.
- **`service_role`** — used only by `api/publish.js`/`api/publish-infaq.js`, server-side, with the secret service-role key. This role bypasses RLS entirely (including the new §9 policies) but **still** needs its own `GRANT` — RLS-bypass and table-privilege-grant are two independent things in Postgres.

**Rule for any future new table:** add both a `CREATE POLICY` and explicit `GRANT`s to `authenticated` (and `service_role` too, if anything server-side will ever touch it) in the same `setup.sql` block. Don't assume either is inherited. If the table needs write-gating by role/module, reuse `admin_can_write(module_key)` (or `admin_is_super_admin()` for admin-only tables) rather than writing a new one-off check.

The infaq tables (§2.1) follow this exact same pattern — explicit `GRANT`s to `authenticated`, and `service_role` grants for the four tables `api/publish-infaq.js` reads (SELECT only, publish never writes them) plus full CRUD on `infaq_activity_log` (publish does write there).

---

## 4. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Ralat: permission denied for table X` (anywhere in the UI, `X` = any table) | Table has an RLS policy but no explicit `GRANT` for the role hitting it | Run `GRANT SELECT, INSERT, UPDATE, DELETE ON X TO authenticated;` (and `TO service_role;` too if the failing write comes from `api/publish.js`). See [§3](#3-rls--permissions-the-part-thats-easy-to-get-wrong). |
| `new row violates row-level security policy for table X` (X is `activity_log`/`infaq_activity_log`, or the acting admin IS an editor/super_admin with the right module permission) | RLS is enabled but there's no policy permitting the operation, or the request isn't actually authenticated (expired/missing session) | Confirm the policy from `setup.sql` §3/§7/§9 actually exists (`CREATE POLICY` may have silently failed on a re-run — see 1.2). If it exists, the session is likely expired — log out and back in. |
| `new row violates row-level security policy for table X` (X is `admins`/`ustaz`/`schedule`/any infaq data table, acting admin is a `viewer`, or an `editor` without that module's `permissions` flag) | **Expected as of 2026-07-23** — `admin_can_write()`/`admin_is_super_admin()` (§9) are correctly blocking a write this admin genuinely shouldn't be able to make. Not a bug — the UI should have already hidden the control that led here (see `canWriteModule()` in `app.js`); if a *permitted* editor/super_admin hits this, that's the real bug, see the row above instead. | Confirm the admin's actual `role`/`permissions` in the `admins` table match what's expected. If they should be able to write, fix their row in `users.html`, not the policy. |
| Redirected to `index.html?denied=1` right after Google login | Login succeeded but the email isn't in `admins` | Insert them: `INSERT INTO admins (email, name, role) VALUES ('their-email@gmail.com', 'Name', 'editor');` (or `'super_admin'`) |
| `relation "X" does not exist` | A section of `setup.sql` was never run (partial run, or ran an older copy of the file) | Re-run the missing section — safe to re-run `CREATE TABLE IF NOT EXISTS` blocks even if others already exist |
| `duplicate key value violates unique constraint "ustaz_short_name_key"` | Adding/renaming an ustaz to a `short_name` another row already has | `short_name` must be unique across all ustaz — pick a different one, or edit the existing row instead of creating a duplicate |
| Can't delete an ustaz — "masih ada dalam N sesi jadual" toast | UI guard: this ustaz is still assigned to at least one `schedule` row | Remove them from those days first (or use "Kosongkan Bulan" if it's a whole month), then delete. (If you ever bypass this via direct SQL, the FK's `ON DELETE SET NULL` prevents an error — affected schedule rows just revert to empty.) |
| Poster upload fails with a Storage error | `kuliah-assets` bucket or its policies (§4 of `setup.sql`) weren't created, or the file exceeds Supabase's default size/type limits | Confirm the bucket exists (Supabase Dashboard → Storage) and §4 ran cleanly; check Supabase project's Storage size limits if the file is large |
| Google OAuth redirects to an error page / "redirect_uri_mismatch" | The callback URL isn't registered in either Google Cloud Console or Supabase's URL Configuration | Re-check both sides of §5 in `setup.sql` — the exact callback URL Supabase shows must be in Google's Authorised redirect URIs, and your app's actual page URLs must be in Supabase's Redirect URLs list |
| `Terbitkan` fails instantly with a connection-error toast | Testing under plain `python -m http.server` — no `/api` route exists outside a real Vercel deployment | Expected locally. Test publish only on an actual Vercel deployment (preview or production). |
| `Terbitkan` fails: "Invalid or expired session" | The browser's Supabase session/JWT expired | Log out and back in, then retry |
| `Terbitkan` fails: "Server misconfiguration: missing Supabase/GitHub env vars" | One or more of `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`GITHUB_TOKEN`/`GITHUB_REPO` isn't set in Vercel | Set them in Vercel Dashboard → Project → Settings → Environment Variables (see [1.5](#15-configure-vercel-environment-variables)), redeploy |
| `users.html`/`userlog.html` briefly flash then redirect to `dashboard.html` | Logged in as `role = 'editor'`, not `super_admin` — both pages are gated client-side | Expected behavior if you're not a super_admin. To promote someone: `UPDATE admins SET role = 'super_admin' WHERE email = '...';` |
| An admin's registered `name` shows up as their raw email address on rows written by `api/publish.js`/`api/publish-infaq.js` specifically (e.g. every "Terbitkan..." row in `userlog.html`, or the dashboard's "last published" note) — while rows logged from the browser (`logActivity()` calls) show the correct name fine | **Confirmed root cause (2026-07-22): `admins` was missing `GRANT SELECT ... TO service_role`** — both publish endpoints look up the actor's name from `admins` using the service-role key, and that lookup failed (permission denied) with **zero visible error**, silently falling back to the raw email. (A second, separate cause is still theoretically possible if it happens elsewhere: `admins.email` not case-matching what Google OAuth returns — Postgres `text` equality is case-sensitive by default. But this can't explain a *successfully logged-in* admin's own publish rows, since login itself already requires an exact `admins.email` match.) | Run `GRANT SELECT ON admins TO service_role;` (already added to `setup.sql` §3). If a *fresh* Supabase project still shows this, also check `admins.email` casing per the second cause. Existing already-logged rows don't retroactively fix themselves — only new ones after the grant is applied will show the name. |
| Nobody can access `users.html` to add the first admin | The bootstrap chicken-and-egg problem | Insert the first row manually via SQL — see [1.4](#14-bootstrap-the-first-super_admin) |
| Supabase SQL Editor shows "Potential issue detected — creates a table without enabling Row Level Security" while running part of `setup.sql` §8 | You selected/ran only a single `CREATE TABLE` statement in isolation — the matching `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` exist later in the same §8 section, so the linter (which only sees what you selected) can't see them | Cancel, then select and run the **entire** §8 section as one paste (see [1.7](#17-set-up-the-infaq-module-optional--separate-from-the-kuliah-setup-above)) — the warning doesn't apply once RLS-enable and the policy are part of the same run |
| Running `setup.sql` §8 errors on `CREATE POLICY "auth_all_infaq_projects" ... already exists` (or `auth_all_infaq_activity_log`) | Your database already ran an earlier version of §8 (the one that created `infaq_donations`/`infaq_expenses`, replaced 2026-07-21) — `infaq_projects`/`infaq_activity_log` are unchanged between versions, so their policies already exist | Don't re-run the whole section — see step 2 of [1.7](#17-set-up-the-infaq-module-optional--separate-from-the-kuliah-setup-above) for exactly which statements to run instead |
| `infaq_donations`/`infaq_expenses` still exist as tables but nothing in the app reads or writes them | Leftover from the pre-2026-07-21 schema, before the rebuild to match real Sheet data (see `DEV_NOTES.MD` session 11) | Harmless to leave (RLS-protected, just unused) — or run `setup.sql` §8b to drop them, after confirming in Table Editor they don't hold data you need |
| A project's `Terkumpul`/`Peratusan` in `projek.html` looks lower than expected, or lower than a figure quoted elsewhere (e.g. an older manually-maintained Sheet/site for the same project) | This system always **computes** the total by summing `infaq_projek_kutipan` rows — if an older system's own summary figure had drifted from its own underlying records (a real, confirmed issue found in the source Sheet during the 2026-07-21 import, see `DEV_NOTES.MD` session 11), the computed total here will legitimately differ, and the computed one is the trustworthy one | Don't "correct" this by inserting an adjustment row — investigate whether donation entries are genuinely missing from `infaq_projek_kutipan` (add them if so) or whether the other figure was simply wrong |

---

## 5. Maintenance

- **Adding/removing/promoting admins:** normally through `users.html` once at least one super_admin exists. Direct SQL only needed for the very first bootstrap (1.4) or if every super_admin account is somehow locked out.
- **Adding a new table:** always add both an RLS policy *and* explicit `GRANT`s for every role that will touch it (`authenticated` for browser code, `service_role` too if any Vercel function will write to it) — see [§3](#3-rls--permissions-the-part-thats-easy-to-get-wrong). Don't assume default privileges will cover it.
- **Orphaned poster files:** replacing or removing an ustaz's poster does not delete the old file from the `kuliah-assets` bucket — it just stops being referenced. Currently unmanaged; if bucket size ever becomes a concern, an admin can manually clear unreferenced files from Supabase Dashboard → Storage, or this could be scripted later (compare bucket contents against `ustaz.poster_url` values).
- **`activity_log` growth:** unbounded by design (append-only, nothing in the app deletes rows). Trivial at this app's realistic scale — see the table's own notes in [§2](#activity_log). If it ever needs trimming, a manual `DELETE FROM activity_log WHERE created_at < ...` (or a proper retention policy) is the way, not a UI feature — deliberately not built into `userlog.html` (see `DEV_NOTES.MD` for why deleting log entries via the UI was considered and rejected).
- **Backups:** handled by Supabase's own project-level backups (see Supabase Dashboard → Database → Backups) — not something this repo manages.
- **Schema changes:** always update `setup.sql` to match live reality when you change something by hand in the SQL Editor — this file is the single source of truth for "how do I reproduce this database from nothing." A live schema that's drifted from `setup.sql` is exactly the gap that made the `admins` table missing in the first place.
- **Bulk-importing historical infaq data:** `admin/import-legacy-infaq-data.sql` is a one-time script for seeding `infaq_kutipan_mingguan`/`infaq_perbelanjaan_bulanan`/`infaq_projects`/`infaq_projek_kutipan` from a transcribed Sheet. Sections A/B are idempotent (`ON CONFLICT DO NOTHING` against their unique constraints); Section C (the project + its donations) is **not** — it has no unique constraint to conflict against (legitimate same-day duplicate donations are expected in real data), so re-running it creates duplicate rows. Read the file's own header before reusing this pattern for a different dataset.
- **infaq's `Jumlah Terkumpul`/rollups can legitimately disagree with an older, separately-maintained figure** (e.g. from a Sheet or a different site) — this system always computes from raw rows, so if an older system's own summary cell had drifted from its own underlying log (a real, confirmed case found 2026-07-21, see [§4 Troubleshooting](#4-troubleshooting)), don't "fix" the discrepancy by inserting an adjustment row here. Figure out which source is actually wrong first.
