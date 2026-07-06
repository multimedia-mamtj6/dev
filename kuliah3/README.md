# kuliah3

Admin dashboard and public schedule view for Masjid Al-Mukhlisin lecture schedule.

## Sub-projects

### `admin/` — CMS Dashboard

Full admin interface for committee members to manage the lecture schedule.

**Access:**
```
/kuliah3/admin/index.html      ← Login (Google OAuth)
/kuliah3/admin/dashboard.html  ← Monthly schedule editor
/kuliah3/admin/ustaz.html      ← Penceramah management
/kuliah3/admin/users.html      ← Admin user accounts (super_admin only)
```

Live at: `dev-data.mamtj6.com/kuliah3/admin/`

**Features:**
- Google OAuth login — only pre-registered emails can access
- Monthly calendar view with day editor modal (subuh + maghrib ustaz, public holiday)
- Dual view: desktop grid calendar / mobile scrollable day list
- Penceramah (ustaz) registry with poster images (upload file or URL), two-column layout on desktop
- "Lihat Terbitan" — quick view/export-PDF links to the live published schedule (current + next month only)
- "Tindakan Bulan" — duplicate the previous month's ustaz assignments forward, or clear a month's data, both with a confirmation safeguard
- Publish schedule to GitHub (pushes `jadual_lengkap_beta.json` — each publish replaces the whole file with just that month's data, not a merge)
- Admin user management with role-based access (editor / super_admin)
- Fully responsive — desktop and mobile (≤640px hamburger nav, card-per-row tables)

**Roles:**
| Role | Can do |
|------|--------|
| editor | Edit schedule, manage ustaz |
| super_admin | All of above + manage admin users |

### `jadual/` — Public Schedule View

Read-only lecture schedule display. Reads from the published JSON.

**Access:**
```
/kuliah3/jadual/jadual.html
```

---

## Tech stack

- Pure HTML5 / CSS3 / Vanilla JS — no npm, no build tools
- Supabase (database, auth, storage)
- Vercel (hosting + serverless publish endpoint)
- GitHub (published JSON store via API push)

---

## Development

See [`developer.md`](developer.md) for full setup, file map, and architecture.

```bash
python -m http.server
# Open http://localhost:8000/kuliah3/admin/index.html
```

---

## Data flow

```
Google Sheet (legacy) → [deprecated path]

Admin dashboard → Supabase (live edit)
               → Terbitkan → api/publish.js
               → kuliah/data/jadual_lengkap_beta.json on GitHub
               → served by GitHub Pages / Vercel
```
