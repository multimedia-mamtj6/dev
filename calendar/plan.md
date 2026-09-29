# Plan: Integrate calendar/hijri maintenance into admin/ (Simplified)

## Goal
Move `calendar/hijri` annual editing from standalone PIN page
(`calendar/hijri/data/index.html` + `POST /api/publish-events` with
`EVENTS_ADMIN_PIN`) into a permission-gated `admin/calendar/` module.
Keep `data/events.json` on GitHub as single source of truth — no
public-reader changes.

## Scope (simplified only)
- IN: one editor page, Supabase-auth publish, permission gate, activity log.
- OUT: health/Tetapan card, ICS status, email alerts, spelling dropdowns,
  dashboard glimpse, Supabase table migration.

## New / changed files
```
admin/calendar/senarai.html/.js   ← NEW: editor table (copy khutbah/senarai.html shell)
admin/calendar/calendar-common.js ← NEW: requireCalendarAccess(), publishCalendar()
api/publish-events.js             ← EDIT: replace pinMatches() with Supabase Bearer check
admin/app.js                      ← EDIT: add MODULES entry { key:'kalendar', items:[Senarai] }
admin/users.html/.js              ← EDIT: perm-kalendar checkbox
admin/setup.sql + database.md     ← EDIT: admin_can_write('kalendar') RLS + calendar_activity_log table
calendar/hijri/data/index.html    ← RETIRE after cutover (keep as backup until verified)
```

## Implementation steps
1. [x] Milestone 1 — DB: `calendar_activity_log` + permissions default added to
   `admin/setup.sql` §13. **Done by user in Supabase SQL Editor (2026-09-29).**
2. [x] Milestone 2 — API: `api/publish-events.js` migrated PIN → Supabase
   Bearer JWT + server-side `kalendar` permission check + activity log.
   **Manual:** delete `EVENTS_ADMIN_PIN` env, ensure Supabase/GitHub envs set.
3. [x] Milestone 3 — Admin module: `admin/calendar/senarai.html/.js` +
   `calendar-common.js` created. Syntax-checked with `node --check`.
4. [x] Milestone 4 — Wiring: `MODULES` + `defaultLandingPageFor()` in
   `admin/app.js`, `perm-kalendar` in `admin/users.html/.js`.
5. [ ] Milestone 5 — Verify (manual): login as viewer/editor/super_admin →
   publish → GitHub commit → Vercel live → retire old
   `calendar/hijri/data/index.html` PIN page.

## Risks / notes
- `cleanUrls: true` — use absolute root-relative paths only, never `./events.json`.
- Keep `FILE_PATH = 'calendar/hijri/data/events.json'` unchanged.
- Old PIN page publicly exposes PIN hint — remove/redirect it on cutover.
