# CLAUDE.md — staff

Architecture reference for Claude Code when working in `staff/`.

## What this is

`staff/` is the public-facing **identity/login layer** for a future
geolocation-based staff clock-in system (cleaners, guards, etc. — a
workforce distinct from `admins`), built 2026-07-29. This module is
**login only** — it deliberately does not include a clock-in/out punch,
geolocation check, or attendance log; those are a separate, not-yet-built
future addition. Once logged in, `staff/login.html` shows a stub "Log
Masuk Berjaya" success state and stores a session token in
`localStorage` — that token is what a future clock-in build will send
with each punch, but nothing currently reads it back.

Staff are managed by an admin via `admin/staff/roster.html` (see
`admin/CLAUDE.md`) — this folder has no CRUD of its own, only login.

## File Structure

```
staff/
  login.html   ← Entry point — name picker + PIN, or "Sign in with Google"
  script.js    ← Roster fetch, PIN submit, Google Identity Services wiring
  style.css    ← Standalone styles (green/gold brand, no Tailwind, no
                 dark-mode toggle — same "own self-contained look" choice
                 as news/, not part of the Tailwind/admin design system)
  CLAUDE.md    ← This file
```

## Critical design constraint — staff NEVER become a Supabase Auth principal

This is the one thing to understand before touching anything here. Every
RLS SELECT policy in this repo (`admins`, `ustaz`, `schedule`, every
`infaq_*`/`news_*` table) is `TO authenticated USING (true)` —
"authenticated" means "holds ANY valid Supabase Auth JWT for this
project," not "is a row in `admins`." The `admins` membership check only
happens client-side, after the fact, in `admin/app.js`'s `requireAuth()`.

If `staff/` ever called `db.auth.signInWithOAuth()` (the same call
`admin/index.html` uses), a staff member would get a real
`authenticated`-role JWT — and from browser devtools could query
`https://<project>.supabase.co/rest/v1/admins?select=*` (or any other
table) directly with that token + the public anon key, reading every
admin's email/role/permissions, every donation record, everything. This
is why **this folder never loads the Supabase JS SDK at all** — there is
no `<script src=".../supabase-js@2/...">` anywhere in `staff/`, and there
must never be one.

**Google login uses Google Identity Services (GIS) directly**
(`https://accounts.google.com/gsi/client` in `login.html`), completely
independent of Supabase Auth. The browser gets a Google ID token and
POSTs it straight to `/api/staff-login`, which verifies it itself against
Google's own `tokeninfo` endpoint — see `api/staff-login.js`'s header
comment and `admin/setup.sql` §11 for the full writeup. `staff/script.js`
never calls anything under `/auth/v1/...`.

## Login flow

1. `script.js`'s `loadRoster()` calls `GET /api/staff-login` — a public,
   name-only listing (`id, full_name` for `enabled = true` staff). Never
   returns `pin_hash`/`device_session_token`/phone/email.
2. Staff picks their name, then either:
   - **PIN**: enters their 6-digit PIN → `POST /api/staff-login
     {method:'pin', staff_id, pin}`. Server-side rate-limited: 5 wrong
     attempts locks the account for 15 minutes (see
     `admin/staff/staff-pin-pure.js`'s `LOCKOUT_THRESHOLD`/
     `LOCKOUT_MINUTES`) — the error message and `locked_until` come back
     from the server, this page has no rate-limit logic of its own
     (client-side limits are trivially bypassable and would be
     meaningless here).
   - **Google**: clicks the GIS button → `onGoogleCredential()` →
     `POST /api/staff-login {method:'google', id_token}`.
3. Either path, on success, returns `{ token, staff: {id, full_name} }`.
   `onLoginSuccess()` stores `token` in `localStorage` as
   `staff_device_session_token` and shows the stub success state.

**"Single active session" enforcement**: every successful login
(PIN or Google, doesn't matter which) overwrites `staff.device_session_token`
in the database unconditionally — whichever token is currently stored is
the only valid one. Logging in on a second device silently invalidates
whatever session was active on the first; there's no notification to the
now-logged-out device, and no admin action needed to "release" a device.
This is the deliberately chosen design (see the plan this was built
from), not an oversight — a future clock-in action would reject any
request whose token doesn't match what's currently stored.

## Setup required before this actually works

Two manual steps, neither of which is code:

1. **`staff/script.js`'s `GOOGLE_CLIENT_ID` constant** must be filled in
   by hand — this file has no build step to inject it. Use the same
   Google OAuth Client ID Supabase Auth already uses for admin login
   (Supabase Dashboard → Authentication → Providers → Google, or Google
   Cloud Console → Credentials). Not secret — Google Client IDs are
   meant to be public/client-side — but it MUST exactly match the
   `GOOGLE_CLIENT_ID` Vercel environment variable `api/staff-login.js`
   checks against, or Google login fails with a generic "tidak sah"
   error. Until this is set, `initGoogleSignIn()` hides the Google button
   entirely rather than showing a broken one — PIN login works standalone
   either way.
2. **Google Cloud Console → APIs & Services → Credentials → [the OAuth
   Client] → Authorized JavaScript origins** needs this page's origin(s)
   added (production domain + `http://localhost:8000` for local dev).
   **This is a different console/setting than Supabase's own Redirect
   URLs allowlist** — a very plausible mix-up given every other OAuth
   setup step in this repo's history (see `admin/DEV_NOTES.MD`) refers to
   the Supabase one. GIS doesn't use `redirectTo` at all, so the Supabase
   allowlist is untouched by this feature.

## Testing

`admin/staff/staff-pin-pure.js`'s hash/verify/lockout logic is unit
tested headlessly — `node api/staff-login.test.js` — no framework, same
convention as `news/developer.md`'s harness and
`api/publish-news.test.js`. There's no equivalent harness for this
folder's own `script.js` yet (no DOM stub written) — if extending this
page, consider adding one following that same pattern.
