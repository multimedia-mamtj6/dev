# Blueprint: PIN-gated JSON admin panel → GitHub commit (Vercel)

Portable pattern extracted from this project's `calendar/hijri/data/` admin
panel (`index.html` + `api/publish-events.js`). Reusable for any project that
needs a simple admin page to edit a small JSON dataset and commit it to
GitHub — e.g. an academic calendar for a university.

## Architecture

```
Browser (admin/index.html)
   │ 1. fetch GET  → /data/events.json           (loads current data, public, no auth)
   │ 2. fetch POST → /api/publish-events          (submits full array + PIN)
   ▼
Vercel serverless function (api/publish-events.js)
   │ 3. verify PIN (timing-safe, from env var)
   │ 4. validate row shapes
   │ 5. GET  /repos/{owner}/{repo}/contents/{path}   → get current sha
   │ 6. PUT  /repos/{owner}/{repo}/contents/{path}   → commit new content
   ▼
GitHub repo → new commit → Vercel auto-redeploys → data/events.json is live
```

Three components, all generic — only field names change between "Islamic
calendar" and "academic calendar."

## 1. Data file — `data/events.json`

```json
{
  "lastUpdated": "06 August 2026, 3:00 PTG",
  "events": [
    { "eventName": "Peperiksaan Akhir Semester 1", "eventDate": "2026-12-15", "note": "Optional extra field" }
  ]
}
```

Rename `eventName`/`eventDate` to whatever fits the new domain (`title`/
`date`, `semester`/`startDate`, etc.) — just keep the field names consistent
across all three components.

## 2. Admin page — `admin/index.html`

Copy `calendar/hijri/data/index.html` as the starting point. Three things
change per project:

- The `<label>`/`placeholder` text in the `<template>` row and the
  `createEventRow`/save-handler field mappings (`.event-name`, `.hijri-date`
  → whatever the new fields are)
- The absolute fetch path for loading:
  `fetch('/data/events.json?v=' + Date.now())` — **must be absolute**, not
  relative, to survive `cleanUrls`/`trailingSlash` URL rewriting (this bit
  the original version — see the 404 fix comment in that file's load handler)
- The `fetch('/api/publish-events', ...)` POST target stays the same shape:
  `{ events: [...], pin }`

## 3. Serverless function — `api/publish-events.js`

Copy `api/publish-events.js` verbatim as the template. Change only:

```js
const FILE_PATH = 'data/events.json';        // ← path in the NEW repo
```

Everything else — PIN timing-safe compare, GET-sha→PUT commit logic,
validation loop — is domain-agnostic. The validation loop currently checks
`eventName`/`eventDate`/`hijriDate` are strings; adjust field names to match
the new schema — that's the only domain-specific part of the whole file.

## Vercel setup for the new repo

| Env var | Value |
|---|---|
| `GITHUB_TOKEN` | New PAT, **scoped to only the new repo** (fine-grained PAT → Contents: Read & Write, that repo only — don't reuse the MAMTJ6 token) |
| `GITHUB_REPO` | `owner/new-repo-name` |
| `EVENTS_ADMIN_PIN` | New PIN, don't reuse the MAMTJ6 one |

## Security notes carried over

- PIN is a single shared secret, not per-user auth — fine for one trusted
  editor, not for a multi-admin setup (no audit trail of *who* published).
  If attribution matters, swap the PIN gate for real auth (GitHub OAuth,
  Supabase Auth) — bigger lift, only worth it if needed.
- No brute-force lockout on the PIN (unlike this repo's `staff-login.js`,
  which tracks failed attempts in a DB). Fine for a low-traffic internal
  tool; skip it unless the page is easily discoverable and PIN-guessing is
  a real risk.
- Don't put a PIN hint on the page itself if it's public.
