# kuliah

Public schedule view and digital signage for Masjid Al-Mukhlisin lecture schedule.
The admin CMS dashboard moved to root `admin/` on 2026-07-19 — see `admin/README`-equivalent
docs (`admin/CLAUDE.md`, `admin/developer.md`) for that side.

## Sub-projects

### `admin/` (root, not under `kuliah/`) — CMS Dashboard

Full admin interface for committee members to manage the lecture schedule (and other
modules — infaq, etc.). Documented in `admin/CLAUDE.md`, `admin/developer.md`, and
`admin/database.md` — not duplicated here, since this file's own admin section has gone
stale from real page moves/renames more than once already (no `admin/README.md` exists
as of this writing — those three files are the current audience-appropriate docs). See
them for current access URLs, features, and roles.

### `jadual/` — Public Schedule View

Read-only lecture schedule display. Reads from the published JSON.

**Access:**
```
/kuliah/jadual/index.html                 ← Current month
/kuliah/jadual/index.html?bulan=depan     ← Next month
```

**Features:**
- Dual view: desktop grid calendar / mobile "today card" + scrollable day list
- Mobile today-card day-select dropdown — jump to any day in the viewed month, not just today/tomorrow
- "Kuliah Khas" special-lecture labeling — a day flagged Khas relabels to "Kuliah Subuh/Maghrib Khas" (desktop cell + mobile badge), gets a distinct purple color, and lights up a legend entry on any month that has one
- Tap/click any lecture with a poster (desktop cell or mobile card) to view it enlarged in a full-screen lightbox
- On a day with both Subuh and Maghrib, a small toggle button lets the visitor swap which session displays first (session-only, resets on reload)
- Hijri date shown per day (`api.waktusolat.app`, with an offline calculator fallback)
- PDF export (`?file=pdf`)

### `paparan/` — Digital Signage

Drives a physical screen at the mosque. Reads the same published JSON as `jadual/`.

**Access:**
```
/kuliah/paparan/index.html?subuh          ← Kuliah Subuh Hari Ini
/kuliah/paparan/index.html?maghrib        ← Kuliah Maghrib Hari Ini
/kuliah/paparan/index.html?subuh-esok     ← Kuliah Subuh Esok
/kuliah/paparan/index.html?maghrib-esok   ← Kuliah Maghrib Esok
/kuliah/paparan/index.html                ← No query: 4-button landing menu (convenience/testing only)
```
The old per-page URLs (`today_subuh.html` etc.) still work — they're zero-JS redirect stubs to the query form above, kept for any screen already configured with the old URL.

### `penceramah/` — Public Penceramah Directory

Card-grid directory of the ustaz registry (photo, name, jawatan, topic per card), built 2026-09-12 for embedding in Google Sites. Reads `kuliah/data/penceramah.json` (published by `POST /api/publish-ustaz`, separate file — never merged into the schedule JSON).

**Access:**
```
/kuliah/penceramah/                 ← Full list view
/kuliah/penceramah/?embed=1         ← Chromeless embed mode (no header/footer,
                                      transparent background) for Sites iframe
```

**Features:**
- 3-per-row grid on desktop, 2-per-row on mobile (≤768px)
- Card click opens a profile popup: big photo, details, and that ustaz's sessions this month (resolved live from `jadual_lengkap_v2.json` by exact name match)
- Yasin entries excluded; alphabetical by name; `is_public = false` rows never published (filtered server-side)
- Linked from the `kuliah/index.html` hub ("Senarai Penceramah")

---

## Tech stack

- Pure HTML5 / CSS3 / Vanilla JS — no npm, no build tools
- Supabase (database, auth, storage)
- Vercel (hosting + serverless publish endpoint)
- GitHub (published JSON store via API push)

---

## Development

See `admin/developer.md` for the admin dashboard's setup/file map/architecture.

```bash
python -m http.server
# Open http://localhost:8000/kuliah/jadual/index.html
# Open http://localhost:8000/kuliah/penceramah/ (reads the committed penceramah.json)
```
Note: `/api/*` publish endpoints don't exist under this local method — Terbitkan buttons will 404 locally (expected).

---

## Data flow

```
Google Sheet (legacy) → [deprecated path]

Admin dashboard → Supabase (live edit)
               → Terbitkan → api/publish.js
               → kuliah/data/jadual_lengkap_v2.json on GitHub
               → served by Vercel

Admin ustaz edits → Supabase `ustaz` table
               → Terbitkan Penceramah → api/publish-ustaz.js (drops
                 is_public = false rows server-side; Yasin rows ship in
                 the file but are excluded client-side by the page)
               → kuliah/data/penceramah.json on GitHub
               → read by kuliah/penceramah/
```
