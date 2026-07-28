# developer.md — news/

Developer guide for the announcement display. Editor-facing docs (JSON
fields, URL modes) live in `README.md`; architecture + hard-won lessons in
`CLAUDE.md` and `DEV_NOTES.md`. This file: how to run, tune, and test it.

## Run locally

```bash
# from the repo root — file:// won't work (JSON fetch needs HTTP)
python -m http.server
# http://localhost:8000/news/            → slideshow
# http://localhost:8000/news/?ann=1      → pinned mode
```

To see specific states, edit `data/announcements.json` dates relative to
today: all entries expired/none started → default slide; one active → no
rotation; two+ active → 15s slideshow with crossfade.

## Tuning knobs

| What | Where | Default |
|---|---|---|
| Seconds per slide in rotation | `ROTATE_MS`, script.js | 15000 |
| Active-window re-check interval | `REEVAL_MS`, script.js | 60000 |
| Crossfade duration | `.slide-layer` transition, style.css **AND** `FADE_MS`, script.js — change BOTH | 0.7s / 700 |
| JSON pickup (full reload) | `<meta http-equiv="refresh">`, index.html | 600s |
| Theme colors (green/gold) | gradient + `#c9a84c` in style.css and default.svg | — |

## Testing harness (no framework — node vm + DOM stub)

All of this folder's logic is testable headlessly. Pattern used for every
feature so far — paste into a `node -e "..."` or a scratch file:

```js
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('news/script.js', 'utf8');

// Minimal DOM stub. Note the src setter: fires onload async, or onerror
// if the URL contains "broken" — lets you test the image fallback ladder.
function newEl(tag) { const s = new Set(); return {
  tagName: tag, className: '', children: [], style: {}, textContent: '',
  classList: { add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c) },
  appendChild(c) { this.children.push(c); return c; },
  replaceChildren(...c) { this.children = c; },
  set src(v) { this._src = v;
    if (v.includes('broken')) { if (this._onerror) setTimeout(() => this._onerror(), 0); }
    else if (this._onload) setTimeout(() => this._onload(), 0); },
  get src() { return this._src; },
  set onload(f) { this._onload = f; }, get onload() { return this._onload; },
  set onerror(f) { this._onerror = f; }, get onerror() { return this._onerror; },
  offsetHeight: 0 }; }

const els = {}; const byId = id => els[id] || (els[id] = newEl('div'));
const ctx = vm.createContext({
  console, document: { getElementById: byId, createElement: newEl },
  window: { location: { search: '?slideshow' } }, URLSearchParams,
  fetch: async () => ({ ok: true, json: async () =>
    JSON.parse(fs.readFileSync('news/data/announcements.json', 'utf8')) }),
  setInterval: () => 0, clearInterval: () => {},
  requestAnimationFrame: f => f(), setTimeout, clearTimeout,
});
vm.runInContext(src, ctx);
vm.runInContext('initNewsDisplay()', ctx);
// assert against els['layer-a'] / els['layer-b'] after a setTimeout(…, 20)
```

Conventions that matter when extending tests:

- Pure functions (`parseLocalDate`, `isActive`, `itemKey`, `hasCaption`)
  can be pulled out via `vm.runInContext('globalThis.__t = {...}', ctx)`
  and tested synchronously.
- Anything involving images or `swapTo()` needs `setTimeout` waits (the
  stub fires onload async, and the old-layer hide runs on a `FADE_MS + 100`
  timer — wait ≥900ms to assert the post-fade state).
- **Re-read `data/announcements.json` inside the test run** rather than
  hardcoding expectations — the file is hand-edited and changes often
  (a "failing" suite here has already once been just a stale fixture).

## Edge cases the code deliberately handles (don't regress these)

- Two dark slides crossfading must never show a white blink → fade-over-top
  in `swapTo()`, see CLAUDE.md Key Patterns.
- Image slower than the rotation: old slide stays until `onload`; a stale
  onload can't overwrite a newer slide (`currentKey` guard).
- Combo image fails: the text/heading still shows (text-slide fallback) —
  the announcement's message survives a dead image URL.
- Aspect-mismatched image: letterboxes onto the dark theme (combo) — no
  white bars, no caption covering the image.
- `?ann=` pointing at nothing valid → default slide; `?ann=abc` → slideshow.
- Interrupted fade (JSON change mid-transition) → incoming layer snaps to
  opacity 0 with transition disabled, then fades normally.

## Deploy

Static files only — push to main, Vercel serves them. No env vars, no
serverless function, no Supabase, no database (that's why there is no
`database.md` in this folder). The only external dependency is whatever
image URLs editors put in the JSON — prefer repo-hosted `/media/...` or
Supabase Storage over hotlinks.

## CMS (built 2026-07-28)

`admin/news/` (Pengumuman + Teks Berjalan pages) + `api/publish-news.js`
now write `data/announcements.json` and `data/moving-text.json`
respectively, via the same Supabase→GitHub publish shape as
`api/publish-infaq.js` — plus a daily Vercel cron (`vercel.json`) so an
expired ticker line eventually disappears even with no admin action. The
display page in THIS folder needed zero changes, as designed. Full
architecture: `admin/CLAUDE.md`, `admin/database.md`, `admin/developer.md`.
Retires the old `news/moving-text/code.gs` Sheets pipeline — see
`news/newplan.md` for why (an unvalidated Sheet cell shipped a raw
`"ERROR: ... Status: 503"` to the live ticker for weeks).
