-- ─────────────────────────────────────────────────────────────────────────────
-- Admin Kuliah MAMTJ6 — Supabase Setup
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Tables ─────────────────────────────────────────────────────────────────

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
    cuti_umum        TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── 2. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_schedule_date             ON schedule(date);
CREATE INDEX IF NOT EXISTS idx_schedule_subuh_ustaz_id   ON schedule(subuh_ustaz_id);
CREATE INDEX IF NOT EXISTS idx_schedule_maghrib_ustaz_id ON schedule(maghrib_ustaz_id);


-- ── 3. Row Level Security ─────────────────────────────────────────────────────
-- Blocks anonymous access. Only authenticated (logged-in) users can read/write.

ALTER TABLE ustaz    ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;

-- ustaz table policies
CREATE POLICY "auth_all_ustaz" ON ustaz
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- schedule table policies
CREATE POLICY "auth_all_schedule" ON schedule
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);


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
--     https://dev-data.mamtj6.com/kuliah3/admin/dashboard.html
--     http://localhost:8000/kuliah3/admin/dashboard.html    ← for local dev


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
-- successful write — see kuliah3/admin/app.js's logActivity(). Not run
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
-- already has base privileges; ustaz/schedule inherited this from the
-- project's default privileges, but don't rely on that for a new table.
-- `authenticated` is used by every browser write; `service_role` is used by
-- api/publish.js's own log insert (server-side, bypasses RLS but still needs
-- the grant) — both are required or one of the two log paths fails silently.
GRANT SELECT, INSERT, UPDATE, DELETE ON activity_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON activity_log TO service_role;
