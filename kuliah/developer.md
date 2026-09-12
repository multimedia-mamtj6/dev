# kuliah/developer.md

Developer notes for `kuliah/`'s public surface (`jadual/`, `penceramah/`, `paparan/`).
Created 2026-09-12 — until then this folder ran on `README.md` + `CLAUDE.md` alone;
the second data pipeline (`penceramah.json`) and the embed surface crossed the
"real setup/ops complexity" threshold the DEV_NOTES deliberately-not-created
judgment had been waiting for.

## Local dev

```bash
python -m http.server
# http://localhost:8000/kuliah/penceramah/  (reads the committed penceramah.json)
# http://localhost:8000/kuliah/penceramah/?embed=1
```

`/api/*` doesn't exist locally — Terbitkan buttons 404 here by design (same as
`admin/`'s documented limitation). But unlike `admin/`, these pages read
committed JSON files, so list rendering, popup, and embed mode are all fully
testable locally with zero Supabase involvement.

## Verifying `penceramah/` logic without a browser

Pure-logic changes (filtering, sorting, popup session-matching) can be checked
with a Node `vm` harness against stubbed DOM/fetch, same convention as
`news/developer.md`:

- Load `script.js` via `vm.runInThisContext`, stub `document` (`getElementById`,
  `body.classList`, `addEventListener`), `window.location.search`, and `fetch`
  returning the real `kuliah/data/penceramah.json` + `jadual_lengkap_v2.json`.
- Assert against the live data: card count after Yasin exclusion, alphabetical
  order, a known ustaz's session matches (e.g. Hairul → September sessions).
- Gotcha learned 2026-09-12: compare rendered names against the
  **HTML-escaped** expected values — `escapeHtml()` turns `'` into `&#39;`, so
  a raw-string comparison false-fails on names like `YAA Dato' Sri...`.

## Gotchas specific to this folder

- **New HTML entry point checklist** (cleanUrls landmine, bitten twice before
  in this folder): every `href`/`src` absolute root-relative; `vercel.json`
  `no-store` header for the new path; `?v=` cache-buster on every JSON fetch.
  Local servers keep `index.html` in the URL, so only production exposes a miss.
- **Live-data reality checks:** the committed JSONs are the fixtures — the
  `ustaz` table currently holds TWO Yasin spellings (`/yasi+n/i` covers both),
  and most `profile_url`/`jawatan` values may be null (fallbacks must render).
- **Overlay + `[hidden]`:** any `display: flex` overlay needs an explicit
  `[hidden] { display: none; }` rule or it renders open on load (author origin
  beats the UA rule).
- **Windows shell notes:** no `rg` on PATH here (use the file-search tool or
  `Select-String`); the search tool's regex has no lookahead (use negated
  classes like `(href|src)="[^"/h]`); keep PowerShell and `node -e` in
  separate calls (`$?` reflects command success, not `Test-Path` output).
