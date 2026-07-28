# CLAUDE.md — news

Architecture reference for Claude Code when working in `news/`.

## What this is

`news/` is the **Paparan Pengumuman** — a fullscreen announcement display
for the mosque's Xibo digital-signage screens, built 2026-07-26 (see
`news/DEV_NOTES.md` for the session history). It's the same "URL a signage
player points at" pattern as `kuliah/paparan/`, but for general
announcements instead of lecture posters: content lives in
`data/announcements.json`, each announcement has an active window
(`start_at`/`end_at`), and when nothing is active the screen shows a
default slide. **This folder itself still has no database, no admin
module, no server code** — that logic lives entirely in `admin/news/` +
`api/publish-news.js`, added 2026-07-28 (see `admin/CLAUDE.md`), which
write `data/announcements.json` the same way this file always expected:
**the display page needed, and got, zero changes** when the CMS arrived,
exactly as designed when `news/` shipped as manual-JSON v1.

A second file, `data/moving-text.json`, feeds the scrolling **ticker**
(read directly by Xibo's DataSet widget, not by anything in this folder)
— also now published by `admin/news/` + `api/publish-news.js`, replacing
the old Google Sheet → Apps Script → GitHub pipeline
(`news/moving-text/code.gs`, retired). See `admin/news/CLAUDE.md`-equivalent
docs in `admin/CLAUDE.md`/`admin/database.md` for the ticker's own
scheduling model, which is deliberately different from this folder's — it
has no client-side JS of its own to filter an active window live, so its
scheduling is resolved server-side at publish time instead.

## File Structure

```
news/
  index.html               ← Entry point (two stacked .slide-layer divs + .message-box)
  script.js                ← All logic: fetch, active-window filter, rotation, crossfade, routing
  style.css                ← Fullscreen display styles, all 3 slide kinds, fade transition
  default.svg              ← Default "Selamat Datang" slide (1920×1080, green/gold, pure SVG text)
  data/announcements.json  ← Announcement content — published by admin/news/pengumuman.html
                              (api/publish-news.js), read by script.js above
  data/moving-text.json    ← Xibo DataSet ticker content — published by
                              admin/news/teks-berjalan.html (api/publish-news.js), read DIRECTLY
                              by Xibo (nothing in THIS folder reads it)
  moving-text/code.gs      ← RETIRED (2026-07-28) — the old Google Sheet → Apps Script → GitHub
                              pipeline that used to write moving-text.json. Kept in the repo for
                              history; superseded by api/publish-news.js. See newplan.md
  README.md                ← Editor-facing guide (URL modes, JSON field rules)
  DEV_NOTES.md             ← Session memo (bugs, lessons, vibe — read before touching anything)
  CLAUDE.md                ← This file
  developer.md             ← Developer guide (testing harness, tuning knobs, edge cases)
  newplan.md               ← Implementation plan for the admin/news/ CMS module (2026-07-28) —
                              historical record of the design, now built; see admin/CLAUDE.md for
                              the current architecture reference rather than re-deriving it here
```

## URL modes (Xibo Webpage widget)

- `/news` or `/news?slideshow` — all currently-active announcements rotate
  (15s each, `ROTATE_MS`)
- `/news?ann=N` — pin ONLY the Nth entry, **1-based array position** in
  `announcements.json`. Deleting an entry above a pinned one shifts the
  numbers (known caveat, user accepted). A pinned entry still obeys its own
  schedule — expired/disabled/missing pin renders the default slide, never
  stale content. Invalid `ann` falls back to slideshow.

## Core design: client-side scheduling, two-tier refresh

`start_at`/`end_at` are compared against the **display device's own clock**
(screens are in Malaysia; date-only values expand to full-day 00:00:00 /
23:59:59 — hand-editor-friendly). `reevaluate()` re-checks every minute
(`REEVAL_MS`), so announcements appear/expire on schedule with **no
republish and no reload**. The `<meta refresh content="600">` reload exists
ONLY to pick up JSON *edits*. Don't conflate the two mechanisms.

## Three slide kinds — routed by which JSON fields exist

| Entry has | Renders | Key prefix |
|---|---|---|
| `image_url` only | plain fullscreen image (contain, white bg) | `img:` |
| `text` (± `heading`) | green/gold text slide (matches default.svg look) | `text:` |
| `image_url` + `text` and/or `heading` | combo: flex column on green gradient, image top-aligned fit, caption bar strip at bottom | `combo:` |

`hasCaption()` decides combo (an image with EITHER text or heading gets the
caption bar — a provided field must never be silently ignored, that was a
near-miss bug). `itemKey()`'s prefixed string keys drive ALL change
detection (rotation no-op guard + reevaluate diffing) — **a new slide kind
must get its own key shape or change detection silently breaks.**

## Key Patterns

- **Crossfade is fade-over-top, NEVER simultaneous dual-fade** (`swapTo()`):
  new slide fades in on top (z-index swap) while the old stays fully opaque
  underneath, hidden only after `FADE_MS + 100`. Fading both layers at once
  lets the white container background bleed through mid-fade — that was
  this folder's first shipped bug, caught by the user on a real screen.
  `FADE_MS` (script.js, 700) must stay in sync with the `.slide-layer`
  transition in style.css. First slide after page load appears with no fade.
- **Images crossfade only after `img.onload`** — a slow poster never fades
  in half-loaded; the previous slide stays up. `currentKey === key` guards
  in onload/onerror stop a stale load clobbering a newer slide (same idea
  as kuliah's `hijriRequestId`).
- **Fallback ladder — the screen can never go blank:** broken combo image →
  text-slide with the same content; broken plain image → JSON
  `default_image` → `/news/default.svg` → `.message-box` text card.
- **Letterbox case is designed-in, not incidental:** any fullscreen-image
  layout here must look right when the image does NOT match the screen
  aspect ratio (bug 2 in DEV_NOTES). `object-fit: contain` everywhere —
  posters are never cropped or stretched.
- **`textContent` only, never innerHTML** for anything from the JSON.
- **Absolute asset paths (`/news/...`) mandatory** — the repo-wide Vercel
  `cleanUrls` landmine (see root `CLAUDE.md`); relative paths work locally
  and 404 in production.
- **`data/announcements.json` is user-edited live, including mid-session.**
  Re-read it before every edit or test assertion; expect stale-file
  conflicts on Edit.
- No `vercel.json` cache rule for `/news/` yet — JSON freshness rides the
  `?v=` cache-buster + 10-min reload. First suspect if stale content is
  ever reported.

## Testing

No build/test framework — node `vm` + a small DOM stub harness, documented
with copy-paste examples in `news/developer.md`. Every feature this folder
has was verified that way; extend the same harness rather than standing up
a browser.
