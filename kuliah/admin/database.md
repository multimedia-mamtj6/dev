# Database — kuliah/admin

Everything about the Supabase (PostgreSQL) database backing `kuliah/admin/`: how to set it up from scratch, what's in it, how to maintain it, and how to fix it when something breaks.

The canonical setup script is [`setup.sql`](setup.sql) — this document explains *why* it's structured the way it is and walks through using it. **Never run parts of it blindly without reading what they do first** (per its own header comment).

---

## 1. Setup from scratch

Follow these in order — each step depends on the one before it.

### 1.1 Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Note the **Project URL** and the **anon (publishable) key** (Project Settings → API) — the anon key goes in `kuliah/admin/app.js` (`SUPABASE_URL`/`SUPABASE_ANON_KEY`, safe to expose in browser code, RLS enforces access control).
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

It's safe to re-run the whole script — every `CREATE TABLE`/`CREATE INDEX` uses `IF NOT EXISTS`, and bucket creation uses `ON CONFLICT DO NOTHING`. `CREATE POLICY` and `GRANT` are **not** idempotent the same way — re-running will error on `CREATE POLICY "name" already exists` if the policy is still there. That's expected and harmless; just skip that line if re-running after a partial failure.

### 1.3 Configure Google OAuth

Follow `setup.sql`'s §5 comment block:

1. Supabase Dashboard → Authentication → Providers → Google → enable it, paste your Google OAuth Client ID/Secret (create these at [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials).
2. Copy the Callback URL Supabase shows you, add it to your Google OAuth app's Authorised redirect URIs.
3. Supabase Dashboard → Authentication → URL Configuration → add your redirect URLs (production domain's `dashboard.html`, plus `http://localhost:8000/kuliah/admin/dashboard.html` for local dev).

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

1. Serve the site locally (`python -m http.server` from repo root) or visit the deployed URL, open `kuliah/admin/index.html`.
2. Log in with the Google account you bootstrapped in 1.4.
3. You should land on `dashboard.html` with **both** "Pengguna" and "Log Aktiviti" visible in the nav (proves the `super_admin` role and `_injectSuperAdminNav()` are both working).
4. Add a test ustaz on `ustaz.html`, assign them to a day on `dashboard.html`, save — confirms `ustaz`/`schedule` writes work.
5. Check `userlog.html` shows the ustaz-create and day-edit rows you just made — confirms `activity_log` writes work.
6. `Terbitkan` only works where a Vercel serverless runtime actually runs `/api/publish` — it will fail locally with a connection-error toast, that's expected (see [Troubleshooting](#4-troubleshooting)).

---

## 2. Database structure

Four tables, one storage bucket. No triggers, no stored procedures, no views — every table is written to directly from `kuliah/admin/*.js` (and `activity_log` also from `api/publish.js` server-side). This repo has **zero** database-side logic beyond RLS/GRANTs; all business logic lives in the client JS.

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

### `admins`

Who's allowed to log in, and what they can do. Checked by `app.js`'s `requireAuth()` after every Google OAuth login — an email not in this table gets signed out immediately and redirected to `index.html?denied=1`.

```sql
id          UUID PK
email       TEXT UNIQUE NOT NULL   -- must match the Google account exactly
name        TEXT                  -- display name, shown in nav/logs
role        TEXT NOT NULL DEFAULT 'editor'  CHECK ('editor' | 'super_admin')
permissions JSONB NOT NULL DEFAULT '{"kuliah": true}'
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

- `role = 'editor'` — can edit schedule + ustaz. `role = 'super_admin'` — also gets `users.html` (manage admins) and `userlog.html` (activity log).
- `permissions` is a per-module flag object, currently only `{ kuliah: bool }` — reserved for future modules beyond the lecture schedule.
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
cuti_umum        TEXT              -- public holiday label, optional
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

- `date` is `UNIQUE` — every write from the dashboard is an `upsert` keyed on `date` (`onConflict: 'date'`), never a plain insert.
- `ON DELETE SET NULL` on both ustaz FKs — if an ustaz row is ever deleted (bypassing the UI guard above), any schedule row that referenced them just goes back to "Tiada Kuliah" instead of erroring or cascading a delete.
- Month navigation in `dashboard.js` is unrestricted (any past/future month), but only the **real current** and **real next** calendar month can ever be published (`api/publish.js` rejects any other `month` param) — editing further out is for early planning only.

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

## 3. RLS & permissions (the part that's easy to get wrong)

Every table has Row Level Security **enabled**, with one permissive policy each (`FOR ALL TO authenticated USING (true) WITH CHECK (true)`) — any logged-in admin can read/write everything. There's no per-row restriction (e.g. editors can't be limited to only their own changes) — role-based restriction happens entirely client-side (`currentAdmin.role` checks in the JS, e.g. `users.js`/`userlog.js` redirect non-super_admins away).

**The lesson learned the hard way, twice, building `activity_log`:** an RLS policy is *necessary but not sufficient*. Postgres checks table-level `GRANT` privileges **before** RLS is even evaluated — a role with no `GRANT` gets `permission denied for table X`, regardless of what policies exist. `ustaz`/`schedule`/`admins` happened to work without an explicit `GRANT` early on because they inherited access from that particular Supabase project's default privileges at the time they were created by hand — `activity_log` (created later, via this script) did not inherit anything, and neither will any table you create from a fresh project. **`setup.sql` now issues an explicit `GRANT` for every table, for every role that touches it, precisely so a from-scratch setup never depends on inherited defaults that may or may not exist.**

Two roles matter here, and they need separate grants:
- **`authenticated`** — every browser write (the anon key + a valid session) uses this role.
- **`service_role`** — used only by `api/publish.js`, server-side, with the secret service-role key. This role bypasses RLS entirely but **still** needs its own `GRANT` — RLS-bypass and table-privilege-grant are two independent things in Postgres.

**Rule for any future new table:** add both a `CREATE POLICY` and explicit `GRANT`s to `authenticated` (and `service_role` too, if anything server-side will ever touch it) in the same `setup.sql` block. Don't assume either is inherited.

---

## 4. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Ralat: permission denied for table X` (anywhere in the UI, `X` = any table) | Table has an RLS policy but no explicit `GRANT` for the role hitting it | Run `GRANT SELECT, INSERT, UPDATE, DELETE ON X TO authenticated;` (and `TO service_role;` too if the failing write comes from `api/publish.js`). See [§3](#3-rls--permissions-the-part-thats-easy-to-get-wrong). |
| `new row violates row-level security policy for table X` | RLS is enabled but there's no policy permitting the operation, or the request isn't actually authenticated (expired/missing session) | Confirm the policy from `setup.sql` §3/§7 actually exists (`CREATE POLICY` may have silently failed on a re-run — see 1.2). If it exists, the session is likely expired — log out and back in. |
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
| Nobody can access `users.html` to add the first admin | The bootstrap chicken-and-egg problem | Insert the first row manually via SQL — see [1.4](#14-bootstrap-the-first-super_admin) |

---

## 5. Maintenance

- **Adding/removing/promoting admins:** normally through `users.html` once at least one super_admin exists. Direct SQL only needed for the very first bootstrap (1.4) or if every super_admin account is somehow locked out.
- **Adding a new table:** always add both an RLS policy *and* explicit `GRANT`s for every role that will touch it (`authenticated` for browser code, `service_role` too if any Vercel function will write to it) — see [§3](#3-rls--permissions-the-part-thats-easy-to-get-wrong). Don't assume default privileges will cover it.
- **Orphaned poster files:** replacing or removing an ustaz's poster does not delete the old file from the `kuliah-assets` bucket — it just stops being referenced. Currently unmanaged; if bucket size ever becomes a concern, an admin can manually clear unreferenced files from Supabase Dashboard → Storage, or this could be scripted later (compare bucket contents against `ustaz.poster_url` values).
- **`activity_log` growth:** unbounded by design (append-only, nothing in the app deletes rows). Trivial at this app's realistic scale — see the table's own notes in [§2](#activity_log). If it ever needs trimming, a manual `DELETE FROM activity_log WHERE created_at < ...` (or a proper retention policy) is the way, not a UI feature — deliberately not built into `userlog.html` (see `DEV_NOTES.MD` for why deleting log entries via the UI was considered and rejected).
- **Backups:** handled by Supabase's own project-level backups (see Supabase Dashboard → Database → Backups) — not something this repo manages.
- **Schema changes:** always update `setup.sql` to match live reality when you change something by hand in the SQL Editor — this file is the single source of truth for "how do I reproduce this database from nothing." A live schema that's drifted from `setup.sql` is exactly the gap that made the `admins` table missing in the first place.
