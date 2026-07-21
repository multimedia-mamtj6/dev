-- ─────────────────────────────────────────────────────────────────────────────
-- Admin Kuliah MAMTJ6 — Supabase Setup
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Tables ─────────────────────────────────────────────────────────────────

-- admins: who is allowed to log in and what they can do. Checked by
-- app.js's requireAuth() after every Google OAuth login — an email that
-- isn't in this table gets signed out immediately (see index.html?denied=1).
CREATE TABLE IF NOT EXISTS admins (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE NOT NULL,
    name        TEXT,
    role        TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'super_admin')),
    permissions JSONB NOT NULL DEFAULT '{"kuliah": true, "infaq": false}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration for a database created before the infaq module existed — the
-- CREATE TABLE above only sets the default for brand-new rows on a
-- from-scratch database. Existing admin rows keep whatever `permissions`
-- they already have (no infaq key at all, which every permissions.infaq
-- check below treats the same as false) until edited via users.html.
ALTER TABLE admins ALTER COLUMN permissions SET DEFAULT '{"kuliah": true, "infaq": false}'::jsonb;

CREATE TABLE IF NOT EXISTS ustaz (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_name   TEXT UNIQUE NOT NULL,
    full_name    TEXT NOT NULL,
    tajuk_kuliah TEXT,
    poster_url   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedule (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date             DATE UNIQUE NOT NULL,
    subuh_ustaz_id   UUID REFERENCES ustaz(id) ON DELETE SET NULL,
    maghrib_ustaz_id UUID REFERENCES ustaz(id) ON DELETE SET NULL,
    subuh_pending    BOOLEAN NOT NULL DEFAULT false,  -- slot reserved but ustaz/topic not decided yet ("Belum Ditetapkan")
    maghrib_pending  BOOLEAN NOT NULL DEFAULT false,
    cuti_umum        TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration for a database where `schedule` already existed before these two
-- columns were added — CREATE TABLE IF NOT EXISTS above is a no-op on an
-- existing table, it does not retroactively add new columns.
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS subuh_pending   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS maghrib_pending BOOLEAN NOT NULL DEFAULT false;


-- ── 2. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_schedule_date             ON schedule(date);
CREATE INDEX IF NOT EXISTS idx_schedule_subuh_ustaz_id   ON schedule(subuh_ustaz_id);
CREATE INDEX IF NOT EXISTS idx_schedule_maghrib_ustaz_id ON schedule(maghrib_ustaz_id);


-- ── 3. Row Level Security ─────────────────────────────────────────────────────
-- Blocks anonymous access. Only authenticated (logged-in) users can read/write.
-- IMPORTANT: RLS policies alone are NOT enough — Postgres also requires a
-- separate table-level GRANT before RLS is even evaluated. Every table below
-- gets both a policy AND an explicit GRANT for exactly this reason (see
-- database.md's Troubleshooting section if you ever hit "permission denied
-- for table X" despite a policy existing).

ALTER TABLE admins   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ustaz    ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;

-- admins table policies
CREATE POLICY "auth_all_admins" ON admins
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON admins TO authenticated;

-- ustaz table policies
CREATE POLICY "auth_all_ustaz" ON ustaz
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON ustaz TO authenticated;

-- schedule table policies
CREATE POLICY "auth_all_schedule" ON schedule
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON schedule TO authenticated;


-- ── 4. Storage bucket ─────────────────────────────────────────────────────────
-- Creates the 'kuliah-assets' bucket for poster images.
-- Posters are public (anyone can view), but only authenticated users can upload.

INSERT INTO storage.buckets (id, name, public)
VALUES ('kuliah-assets', 'kuliah-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read of all objects in this bucket
CREATE POLICY "public_read_kuliah_assets" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'kuliah-assets');

-- Allow authenticated users to upload/update/delete
CREATE POLICY "auth_write_kuliah_assets" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'kuliah-assets');

CREATE POLICY "auth_update_kuliah_assets" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'kuliah-assets');

CREATE POLICY "auth_delete_kuliah_assets" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'kuliah-assets');


-- ── 5. Google OAuth setup (manual steps — cannot be done via SQL) ─────────────
--
-- In Supabase Dashboard → Authentication → Providers → Google:
--   1. Enable the Google provider
--   2. Enter your Google OAuth Client ID and Secret
--      (create at: console.cloud.google.com → APIs & Services → Credentials)
--   3. Copy the "Callback URL (for OAuth)" from Supabase and add it to
--      your Google OAuth app's "Authorised redirect URIs"
--
-- In Supabase Dashboard → Authentication → URL Configuration:
--   Add these redirect URLs (replace with your actual domain):
--     https://dev.mamtj6.com/admin/kuliah/dashboard.html
--     http://localhost:8000/admin/kuliah/dashboard.html    ← for local dev


-- ── 5b. Bootstrap the first super_admin (manual, one-time) ────────────────────
-- The `admins` table starts empty, but users.html (where you'd normally add an
-- admin) itself requires being logged in as a super_admin to even load —
-- chicken-and-egg. Break the loop by inserting the very first row directly:
--
-- INSERT INTO admins (email, name, role, permissions) VALUES
--     ('your-email@gmail.com', 'Your Name', 'super_admin', '{"kuliah": true, "infaq": true}'::jsonb);
--
-- The email must exactly match the Google account you'll log in with. After
-- this one row exists, log in once — you'll land in kuliah/dashboard.html
-- with the "Pengguna" and "Log Aktiviti" nav links visible — and manage
-- every admin after that through users.html normally. Never need to run
-- this insert again.


-- ── 6. Sample data (optional) ─────────────────────────────────────────────────
-- Uncomment and adjust to seed your ustaz list from the existing Posters sheet.
-- This is a one-time operation; the admin dashboard handles all future edits.

/*
INSERT INTO ustaz (short_name, full_name, tajuk_kuliah, poster_url) VALUES
    ('UA Hairul',  'Ustaz Hairul Azam',  'Tadabbur ayat-ayat Surah Al-Baqarah',  'https://dev.mamtj6.com/kuliah/assets/poster-kuliah/1920X1080/07_6.-Ustaz-Hairul-Azam.jpg'),
    ('UA Zaidi',   'Ustaz Zaidi Hassan', 'Fiqh Munakahat',                        null)
ON CONFLICT (short_name) DO NOTHING;
*/


-- ── 7. Activity log ───────────────────────────────────────────────────────────
-- Records who changed what across the dashboard (schedule edits, ustaz CRUD,
-- admin-account CRUD, Terbitkan/publish). Written by the client (and by
-- api/publish.js server-side for the publish action) right after each
-- successful write — see admin/app.js's logActivity(). Not run
-- automatically; run this manually in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS activity_log (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_email  TEXT NOT NULL,
    actor_name   TEXT,
    action       TEXT NOT NULL,
    target_label TEXT,
    detail       TEXT
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_activity_log" ON activity_log
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Explicit table-level grants — RLS policies only take effect once the role
-- already has base privileges (see §3's note — don't rely on inherited
-- defaults for any table). `authenticated` is used by every browser write;
-- `service_role` is used by api/publish.js's own log insert (server-side,
-- bypasses RLS but still needs the grant) — both are required or one of the
-- two log paths fails silently.
GRANT SELECT, INSERT, UPDATE, DELETE ON activity_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON activity_log TO service_role;


-- ── 8. Infaq module ──────────────────────────────────────────────────────────
-- Donation/expense tracking for admin/infaq/. Not run automatically — run
-- this manually in the Supabase SQL editor, same as every section above.

-- infaq_projects: named fundraising campaigns with a target. History is
-- kept — rows are never overwritten when a project ends, only is_active
-- flips. Donations are NOT required to belong to a project (most are
-- ordinary weekly infaq, counted in kutipan rollups regardless of project);
-- only donations an admin explicitly earmarks also count toward a
-- project's JumlahTerkumpul.
CREATE TABLE IF NOT EXISTS infaq_projects (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    target_amount NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
    is_active     BOOLEAN NOT NULL DEFAULT false,
    completed_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one active project at a time. admin/infaq/projek.js's "Jadikan
-- Aktif" action must deactivate the current one BEFORE activating a new
-- one (two sequential updates) so this index is never transiently violated.
CREATE UNIQUE INDEX IF NOT EXISTS idx_infaq_projects_one_active
    ON infaq_projects (is_active) WHERE is_active = true;

-- infaq_donations: one row per raw deposit/count, as it happens. Every
-- rollup (weekly/monthly/yearly/graf) and the active project's progress
-- are COMPUTED from these rows by api/publish-infaq.js — never typed in
-- directly, so the arithmetic-mismatch problems a hand-maintained
-- spreadsheet is prone to can't happen here.
CREATE TABLE IF NOT EXISTS infaq_donations (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     UUID REFERENCES infaq_projects(id) ON DELETE SET NULL,
    amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    donation_date  DATE NOT NULL,
    method         TEXT NOT NULL DEFAULT 'tunai' CHECK (method IN ('tunai','online','qr','lain')),
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- infaq_expenses: one row per raw mosque expense, same auto-aggregation
-- principle as donations.
CREATE TABLE IF NOT EXISTS infaq_expenses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    expense_date  DATE NOT NULL,
    category      TEXT,
    description   TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_infaq_donations_date       ON infaq_donations(donation_date);
CREATE INDEX IF NOT EXISTS idx_infaq_donations_project_id ON infaq_donations(project_id);
CREATE INDEX IF NOT EXISTS idx_infaq_expenses_date        ON infaq_expenses(expense_date);

ALTER TABLE infaq_projects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE infaq_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE infaq_expenses  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_infaq_projects" ON infaq_projects
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_infaq_donations" ON infaq_donations
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_infaq_expenses" ON infaq_expenses
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON infaq_projects  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON infaq_donations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON infaq_expenses  TO authenticated;

-- api/publish-infaq.js reads all three via the service-role key to compute
-- the published JSON — per §3's rule (new tables never inherit grants),
-- this must be explicit, not assumed. Read-only: publish never writes to
-- these three tables, so SELECT is all service_role needs here.
GRANT SELECT ON infaq_projects, infaq_donations, infaq_expenses TO service_role;

-- infaq_activity_log: a SEPARATE table from activity_log (kuliah's), by
-- deliberate choice — independent auditability for money data. Same
-- plain-text-snapshot shape/reasoning as activity_log (see §7).
CREATE TABLE IF NOT EXISTS infaq_activity_log (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_email  TEXT NOT NULL,
    actor_name   TEXT,
    action       TEXT NOT NULL,
    target_label TEXT,
    detail       TEXT
);

CREATE INDEX IF NOT EXISTS idx_infaq_activity_log_created_at ON infaq_activity_log(created_at DESC);

ALTER TABLE infaq_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_infaq_activity_log" ON infaq_activity_log
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Both grants required, same reasoning as activity_log's: `authenticated`
-- for browser writes (admin/infaq/*.js), `service_role` for
-- api/publish-infaq.js's own log insert (server-side, bypasses RLS but
-- still needs the grant).
GRANT SELECT, INSERT, UPDATE, DELETE ON infaq_activity_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON infaq_activity_log TO service_role;
