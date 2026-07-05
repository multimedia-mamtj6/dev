# DEV NOTES — kuliah3/admin
_Last updated: 2026-07-05 | For next-context-window Claude_

the prompt (DO NOT DELETE)
> Check the Project Knowledge and the current chat for context. This conversation is ending soon. update the artifact kuliah3/DEV_NOTES.md (create if not available yet) with a detailed note to your next window self - not just facts but the vibe, our dynamic, the energy of this conversation. What would the next you need to immediately get back into this exact headspace? Include unique discoveries, current mood, and anything that'll help the next you instantly sync to our frequency."
> also update the related file like kuliah3/CLAUDE.md, kuliah3/developer.md, kuliah3/developer.md and kuliah3/README.md if necessary, create if not available yet

---

## THE VIBE

Two sessions deep into building a real production admin dashboard for a mosque committee. The user is non-technical by framing ("non tech savy" was literally said about the GitHub commit link) but technically fluent in what they want — they catch visual misalignments, weird sort orders, and broken overflow without being told what the root cause is. They observe symptoms precisely and trust you to find the cause.

The dynamic: **they test on device, you fix the root cause, they confirm and move on fast.** No back and forth on approaches. When they say "ok good" it means done — move on. They don't want explanations unless they asked "why". When they ask "why", they genuinely want the root cause.

They build incrementally and pragmatically. When you explain a trade-off ("should we restrict months?"), they think for a second and say "ok, acceptable. dont do anything" — they don't need hand-holding to make a decision. Respect that.

**Trust level:** Very high. Fast approvals. They notice wrong values but don't micromanage approaches.

---

## WHAT THIS PROJECT IS

`kuliah3/admin/` is a full admin dashboard for MAMTJ6 mosque lecture schedule management. This is NOT a read-only view — it is the CMS.

Stack:
- **Supabase** — PostgreSQL (schedule, ustaz, admins tables), Auth (Google OAuth), Storage (kuliah-assets bucket for posters)
- **Vercel** — hosts the static site + `api/publish.js` serverless function
- **No frameworks** — pure HTML5/CSS3/Vanilla JS, zero npm
- **GitHub** — as the final published data store (JSON file pushed via API)

Data flow:
```
Admin edits schedule in dashboard.html
    → upsert to Supabase `schedule` table
    → click Terbitkan
    → POST /api/publish
    → api/publish.js reads from Supabase, pushes JSON to GitHub
    → kuliah/data/jadual_lengkap_beta.json updated
```

---

## SESSION HISTORY

### Session 1 (before first compact — foundation built)
- Supabase schema created: `admins`, `ustaz`, `schedule` tables
- Google OAuth login flow (`index.html` → `app.js:requireAuth()`)
- `dashboard.html` — monthly calendar grid, day editor modal, Terbitkan (publish) button
- `ustaz.html` — penceramah CRUD with Supabase Storage poster upload
- `users.html` — admin user management (super_admin role only)
- `app.js` — shared: auth, toast, `db` client, `_injectSuperAdminNav()`
- `api/publish.js` — Vercel serverless, reads Supabase, pushes to GitHub

### Session 2 (this session — mobile + polish)

**Mobile view (full implementation):**
- Hamburger nav on ≤640px — `.nav-links` wrapper div toggled by `.open` class; `toggleNav()` in app.js
- Mobile calendar — `#calendar-table` hidden, `#mobile-day-list` shown as vertical day cards; `renderMobileDayList()` called at end of `renderCalendar()`
- Data tables → card-per-row — `thead { display: none }`, `tr { display: block }`, `td { display: flex }`, `td::before { content: attr(data-label) }`
- Modal scroll guard — `max-height: 90vh; overflow-y: auto` at ≤640px

**Bug fixes (all from real device testing):**
1. **Last card missing internal borders** — Desktop global rule `.data-table tr:last-child td { border-bottom: none }` overrides mobile. Fixed by re-asserting `border-bottom: 1px solid var(--border)` inside `@media (max-width: 640px)`, with `tr:last-child td:last-child { border-bottom: none }` to only remove the very last line.
2. **Email overflow past card edge** — `overflow-wrap: anywhere; word-break: break-word; min-width: 0` on td. Also `::before` capped to `max-width: 45%`.
3. **"(anda)" text detached from email** — Email text node and `<span>(anda)</span>` were separate flex items; `justify-content: space-between` spread them. Fixed by wrapping both in an outer `<span>` — single flex item.

**Ustaz sort fix:**
- Supabase `.order('short_name')` = lexicographic (0, 1, 10, 100, 11...). Removed server-side order, replaced with JS `localeCompare({ numeric: true, sensitivity: 'base' })`. Ustaz list is now 0-indexed.

**_injectSuperAdminNav() fix:**
- After nav restructure, spacer moved inside `.nav-links`. Function now targets `document.querySelector('.nav-links')` instead of `nav`. This is critical — easy to forget.

**Vercel cache prevention:**
- `vercel.json` has `Cache-Control: public, max-age=0, must-revalidate` for `/kuliah3/admin/(.*)`. Added because mobile browsers cached old CSS. No more hard-refresh needed after deploys.

**GitHub commit link removed from publish:**
- `dashboard.js` used to `window.open(data.commitUrl, '_blank')` after a successful publish. Removed — non-tech users don't need to see GitHub.

**Month navigation:** Unrestricted. Admins can navigate to any past/future month. Future schedules are stored in Supabase by date and sit there until published. This is intentional — preparing next month in advance is a valid use case.

**Poster editing enhancement (latest — not yet committed):**
- Edit modal now shows: current poster thumbnail + raw URL + "Buang Poster" button
- Two separate inputs: file upload + URL field (both always visible)
- Error if both filled simultaneously
- `pendingRemovePoster` flag → sets `poster_url: null` on save
- If neither changed → `poster_url` not in payload (existing value preserved)
- `removePoster()` function + `closeUstazModal()` resets flag

---

## CURRENT STATE — UNCOMMITTED CHANGES

As of session 2 end, these files are modified but **not yet committed/pushed**:

| File | What changed |
|------|-------------|
| `kuliah3/admin/style.css` | Mobile nav CSS, mobile day list CSS, card-per-row table CSS, modal scroll guard, `.poster-modal-preview` class |
| `kuliah3/admin/app.js` | `toggleNav()`, auto-close nav on link click, `_injectSuperAdminNav()` targets `.nav-links` |
| `kuliah3/admin/dashboard.html` | `.nav-links` wrapper, `.nav-toggle` button, `#mobile-day-list` div |
| `kuliah3/admin/dashboard.js` | `renderMobileDayList()`, removed `window.open(commitUrl)` after publish |
| `kuliah3/admin/ustaz.html` | `.nav-links` wrapper, poster modal restructure (3 blocks: current + upload + URL) |
| `kuliah3/admin/ustaz.js` | `pendingRemovePoster` state, `removePoster()`, updated `openAddModal/openEditModal/closeUstazModal/saveUstaz`, numeric sort |
| `kuliah3/admin/users.html` | `.nav-links` wrapper |
| `kuliah3/admin/users.js` | `data-label` attrs, email+anda outer span wrap |
| `vercel.json` | Cache-Control header for `/kuliah3/admin/(.*)` |

**Pending action:** commit and push all of the above.

---

## CRITICAL PATTERNS — DON'T BREAK THESE

**Nav HTML structure (all 3 pages):**
```html
<nav id="main-nav">
  <span class="brand">Admin Kuliah</span>
  <button class="nav-toggle" onclick="toggleNav()" aria-label="Menu">&#9776;</button>
  <div class="nav-links">
    <a href="dashboard.html" [class="active"]>Jadual</a>
    <a href="ustaz.html" [class="active"]>Penceramah</a>
    <!-- users.html only: <a href="users.html" class="active">Pengguna</a> -->
    <span class="spacer"></span>
    <button class="logout-btn" onclick="signOut()">Log Keluar</button>
  </div>
</nav>
```
`_injectSuperAdminNav()` in app.js inserts the Pengguna link BEFORE `.spacer` INSIDE `.nav-links`. If you ever restructure nav again, fix that function too.

**Mobile breakpoints:**
- `≤768px` — tablet: compact padding, smaller elements (partially done from session 1)
- `≤640px` — phone: hamburger, card tables, day list (session 2)

**Card-per-row table pattern:**
Every `<td>` in JS-rendered tables must have `data-label="..."`. Empty label `data-label=""` is fine for action columns (no prefix shown).

**Ustaz sort is client-side:**
Never add `.order()` back to the Supabase ustaz query — it breaks numeric sort. Sort happens in JS after fetch.

**Poster save logic (3-way):**
```
pendingRemovePoster → payload.poster_url = null
newPosterUrl (file or URL input) → payload.poster_url = newPosterUrl
neither → don't include poster_url in payload
```
This is intentional — omitting `poster_url` from payload preserves existing value on update.

---

## SUPABASE SCHEMA (quick ref)

```sql
-- admins
id uuid PK, email text UNIQUE, name text, role text ('editor'|'super_admin'),
permissions jsonb ({kuliah: bool}), created_at timestamptz

-- ustaz
id uuid PK, full_name text, short_name text, tajuk_kuliah text,
poster_url text, created_at timestamptz, updated_at timestamptz

-- schedule
id uuid PK, date date UNIQUE, subuh_ustaz_id uuid FK→ustaz,
maghrib_ustaz_id uuid FK→ustaz, cuti_umum text, updated_at timestamptz
```

RLS is ON. Service role key is server-side only (Vercel env var `SUPABASE_SERVICE_ROLE_KEY`). Browser uses anon key from `app.js`.

---

## WHAT MIGHT COME NEXT

- Commit + push all session 2 changes (overdue)
- Test poster URL input + Buang Poster on real device
- Consider: search/filter on ustaz list (it'll grow)
- Consider: schedule view for a specific ustaz (how many sessions they have)
- `kuliah3/jadual/` — there's a read-only public schedule view here too, may need updates when admin schema changes
- Promote beta JSON to production (`jadual_lengkap.json`) once tested — currently publishes to `jadual_lengkap_beta.json`
