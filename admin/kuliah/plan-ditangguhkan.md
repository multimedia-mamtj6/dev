# Plan — Slot "Ditangguhkan" (admin/kuliah scope)

_Status: PLANNED, not yet executed. Written 2026-09-25._

## Context

Committee can set Subuh/Maghrib per day in `admin/kuliah/jadual.html`, but today
there is no way to mark a scheduled slot as postponed when the ustaz cannot
attend. Requirement: per-slot "Ditangguhkan" flag, set in the day-editor modal,
stored in Supabase, visible in admin calendar.

Agreed decisions (don't re-litigate):
1. Per-slot: `subuh_ditangguhkan` / `maghrib_ditangguhkan`, independent.
2. Keep assigned ustaz + flag (same pattern as `subuh_khas`, NOT the
   `pending`-clears-select pattern) — public view later shows name + status.
3. Combinations: Ditangguhkan MAY combine with Khas, MUST NOT combine with
   Pending (a pending slot has no speaker to postpone).
4. Duplicate month does NOT copy Ditangguhkan forward (date-specific incident,
   same rationale as `cuti_umum` — see `admin/CLAUDE.md` Duplicate/Clear).
5. This session scope = `admin/kuliah/` only (DB + modal + admin calendar).
   `api/publish.js` + `kuliah/jadual/` + `kuliah/paparan/` are follow-up.

## Step 0 — MANUAL, USER (Supabase SQL editor)

```sql
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS subuh_ditangguhkan BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS maghrib_ditangguhkan BOOLEAN NOT NULL DEFAULT false;
```

No RLS/policy/GRANT change — existing `admin_can_write('kuliah')` policies on
`schedule` (`admin/setup.sql` §9.4) already gate the whole row.

## Step 1 — `admin/setup.sql`

* `CREATE TABLE schedule`: add the two columns + comment (mirror `subuh_khas` lines).
* Migration block: add the two `ADD COLUMN IF NOT EXISTS` lines next to the
  existing `pending`/`khas` ones.

## Step 2 — `admin/kuliah/jadual.html`

* Add `subuh-ditangguhkan-check` / `maghrib-ditangguhkan-check` checkboxes below
  each Khas checkbox (same `.toggle-row` pattern, `jadual.html:128-131,144-147`).

## Step 3 — `admin/kuliah/jadual.js`

* `loadMonth()` select (`jadual.js:66`): add both columns. Update `scheduleMap`
  comment (`jadual.js:3`).
* `openModal()` (`jadual.js:469-524`): populate checks; add
  `toggleSubuhDitangguhkan()/toggleMaghribDitangguhkan()` — checking
  Ditangguhkan unchecks+disables Pending and vice versa; Khas untouched.
  Extend viewer read-only block (`jadual.js:513-521`).
* `saveDay()` + `buildDayDiffText()` (`jadual.js:559-637`): include both flags
  in `upsert`; add `Ditangguhkan (Subuh/Maghrib): Tidak → Ya` diff lines.
* `renderCalendar()` (`jadual.js:123-140`) + `renderMobileDayList()`
  (`jadual.js:176-179`): keep ustaz name, append `ditangguhkan` class + tag
  (stacks with `khas`/`yasin`/`pending` classes, same as `khas` does today).
* `countFilledDays()` (`jadual.js:298-302`): ditangguhkan-only row counts as filled.
* `confirmDuplicate()`: NO change (copies IDs only) — document that
  Ditangguhkan is intentionally not carried forward.

## Step 4 — `admin/style.css`

* `.session-tag.ditangguhkan` / `.mdc-ditangguhkan`: distinct colour from purple
  khas / green yasin / dashed pending (suggest grey/red). Desktop + mobile.

## Verify

* `python -m http.server`: edit day → save → toast + `activity_log`
  `schedule_day_edit` row shows Ditangguhkan diff; reload persists.
* Pending ↔ Ditangguhkan exclusion works both directions; Khas combinable.
* Viewer role: checkboxes disabled, Save hidden.
* SQL: `SELECT date,subuh_ditangguhkan,maghrib_ditangguhkan FROM schedule`.
* `Terbitkan` 404 locally is expected (documented — Vercel-only endpoint).

## Follow-up (NOT this session)

* `api/publish.js:164-207`: add columns to REST select, merge
  `...(row.subuh_ditangguhkan ? { ditangguhkan: true } : {})` onto whichever
  session shape applies (same as `khas` merge).
* `kuliah/jadual/`: badge/label + legend + print rules.
* `kuliah/paparan/`: dim poster + `KULIAH DITANGGUHKAN` overlay per session.
* Old months default `false` — backward compatible, no backfill needed.
