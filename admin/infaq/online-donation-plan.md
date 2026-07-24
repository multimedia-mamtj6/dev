# Plan — Online (bank transfer) donation total for infaq projects

## Context

The reference site's own project data (`data.json`) reported `JumlahTerkumpul:
196741` for "Infaq Tabung Bangunan Tambahan MAMTJ6" — but summing every
individual entry in its own `paparanHarian` log only comes to 176,314 (RM
20,427 short). The user has confirmed the missing RM 20,427 is real data,
not an error: it's a **second donation channel** — direct bank transfers,
verified against the bank statement — tracked as a single running total
(not itemized per-donation like the physical tabung box), last confirmed
**30/06/2026**. `176,314 + 20,427 = 196,741` — exact match.

This system's `infaq_projek_kutipan` only tracks the itemized
physical-tabung donations, so this online total needs a new home, and
every place that currently computes "Terkumpul" (sum of physical
donations only) needs to add this figure in too — otherwise the number
shown in this admin CMS will permanently undercount by exactly the online
amount, reproducing the exact gap that was just root-caused.

**Decisions confirmed with the user:**
1. Single overwritable running total + one "last checked" date (no history
   log of past bank-statement checks) — matches the source data exactly
   (one row: date + figure), same shape/pattern as the `launch_date` field
   added earlier this session.
2. "Terkumpul" gets `+ online total` in **every** place it's currently
   computed — project list, project detail page, `ringkasan.html`,
   dashboard glimpse, and the published `daily.json`/`data.json` — so the
   figure is always the same everywhere, never inconsistent page-to-page.
3. The 5-point Nota (explanation) block only displays on the project
   detail page (`projek-kutipan.html`), same scoping as the launch date.

## Files to change

**`admin/setup.sql`** — 2 new nullable columns on `infaq_projects`, same
migration convention as `launch_date` (inline right after its `CREATE
TABLE IF NOT EXISTS` block):
```sql
ALTER TABLE infaq_projects ADD COLUMN IF NOT EXISTS online_total NUMERIC(12,2);
ALTER TABLE infaq_projects ADD COLUMN IF NOT EXISTS online_total_updated_at DATE;
```
Both nullable, no default — treated as 0 wherever read if unset (`Number(project.online_total || 0)`).

**`admin/infaq/projek.html`** — 2 new optional fields in the Add/Edit
modal, after the `edit-launch-date` field added earlier:
```html
<div class="form-group">
  <label for="edit-online-total">Jumlah Terkumpul (Online) (RM, pilihan)</label>
  <input type="number" id="edit-online-total" min="0" step="0.01" placeholder="0.00">
</div>
<div class="form-group">
  <label for="edit-online-updated">Tarikh Kemaskini (Online) (pilihan)</label>
  <input type="date" id="edit-online-updated">
</div>
```

**`admin/infaq/projek.js`** — same 4-function pattern as `launch_date`:
- `openAddModal()` / `openEditModal(id)`: blank/populate the 2 new fields
  (`p.online_total ?? ''`, `p.online_total_updated_at || ''`).
- `buildProjectDiffText()`: one more diff branch for the pair (amount +
  its date), using `formatRM()`/`formatDateMY()`, "Tiada" for absent.
- `saveProject()`: read both fields, add
  `online_total: onlineTotalInput ? parseFloat(onlineTotalInput) : null` and
  `online_total_updated_at: onlineUpdatedInput || null` to `payload`.
- `renderTable()`'s existing `terkumpul` computation (the `totals` map
  built from `infaq_projek_kutipan` donations) becomes:
  `terkumpul: (totals[p.id] || 0) + Number(p.online_total || 0)`.

**4 other "Terkumpul" computation sites — identical one-line fix each**
(confirmed by reading all 4 this session): add `+ Number(project.online_total
|| 0)` (or `p.online_total` where the loop variable is named `p`) right
where each currently does `(donations||[]).reduce((s,r)=>s+Number(r.jumlah),0)`:
- `admin/infaq/projek-kutipan.js` — `updateProgress()`
- `admin/infaq/ringkasan.js` — `loadActiveProject()`
- `admin/dashboard.js` — `loadInfaqOverview()`
- `api/publish-infaq.js` — `computeProjectProgress(project, donationsForProject)`:
  `const terkumpul = sumJumlah(donationsForProject) + Number(project.online_total || 0);`
  (this one feeds both `daily.json` and `data.json`, per the earlier
  piggyback design — no extra change needed there, it inherits automatically)

**`admin/infaq/projek-kutipan.js`/`.html`** — two additions to the project
header, both scoped to this page only:
1. A breakdown line near the progress bar so the combined total is legible
   (physical vs. online, not just a bigger unexplained number), e.g.:
   `Tabung Fizikal: RM 176,314.00 · Online: RM 20,427.00 (dikemaskini 30 Jun 2026) · Jumlah: RM 196,741.00 (78.7%)`
   — only shown if `online_total` is set, otherwise the existing
   physical-only progress text is unchanged. (My own addition, not
   explicitly requested — without it, "Terkumpul" just silently gets
   bigger with no visible explanation of why.)
2. A static Nota block (new `<div class="card">` below the progress bar),
   rendering the user's exact text, with point 5 pulling the live
   `project.target_amount` via `formatRM()` instead of a hardcoded number
   (so it can't drift out of sync with the actual target field):
   ```
   Nota :
   1) Tarikh deposit ke akaun bank
   2) Nilai deposit mengikut kiraan muktamad kaunter penerimaan bank
   3) Jumlah kutipan tidak termasuk sumbangan terus ke akaun bank.
   4) Tabung Fizikal adalah tabung-tabung yang disediakan di premis masjid
   5) Sasaran Kutipan RM{target_amount, live}
   *) Semakan sumbangan ONLINE pada Penyata Akaun Bank yang diterima
   ```

**Docs** — `admin/CLAUDE.md`/`admin/database.md`: add `online_total`/
`online_total_updated_at` to the `infaq_projects` schema listing, same as
`launch_date` got documented.

## Explicitly out of scope
- No history/log table for past bank-statement checks (decision #1) —
  only the latest figure + date is kept, overwritten each time.
- `admin/infaq/projek.js`'s list table itself doesn't show a breakdown —
  only the single combined `Terkumpul`/`Peratusan` columns it already has,
  now just computed with the online figure folded in.
- Nota block not added to `ringkasan.html`/`dashboard.js` (decision #3).

## Verification
- `node --check` on every edited `.js` file.
- Standalone script asserting `terkumpul = sum(donations) + online_total`
  reproduces exactly 196,741 given the real numbers from this session
  (176,314 physical + 20,427 online) — the exact reconciliation that
  motivated this feature.
- Manually: set online_total=20427 + its date on the real active project
  via `projek.html`'s Edit modal, confirm the combined total (196,741) and
  percentage (78.7% at target 250,000) show correctly on
  `projek-kutipan.html`, `ringkasan.html`, the dashboard glimpse, and the
  project list — all matching. Click Terbitkan and confirm `daily.json`/
  `data.json` also reflect the combined figure.

## Critical files
- `admin/setup.sql` (2 new nullable columns)
- `admin/infaq/projek.html`, `admin/infaq/projek.js` (modal fields + save/diff + list total)
- `admin/infaq/projek-kutipan.js`/`.html` (breakdown line + Nota block)
- `admin/infaq/ringkasan.js`, `admin/dashboard.js` (terkumpul formula)
- `api/publish-infaq.js` (`computeProjectProgress()`)
