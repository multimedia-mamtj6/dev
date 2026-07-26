# CLAUDE.md — news

Architecture reference for Claude Code when working in `news/`.

## What this is

`news/` is the **Paparan Pengumuman** — a fullscreen announcement display
for the mosque's Xibo digital-signage screens, built 2026-07-26 (see
`news/DEV_NOTES.md` for the session history). It's the same "URL a signage
player points at" pattern as `kuliah/paparan/`, but for general
announcements instead of lecture posters: content is a hand-edited JSON
file, each announcement has an active window (`start_at`/`end_at`), and
when nothing is active the screen shows a default slide. **No database, no
admin module, no server code** — a deliberate manual-JSON v1 (a future
`admin/news/` module + `api/publish-news.js` was designed but deferred;
the display page needs zero changes when it arrives).

## File Structure

```
news/
  index.html              ← Entry point (two stacked .slide-layer divs + .message-box)
  script.js               ← All logic: fetch, active-window filter, rotation, crossfade, routing
  style.css               ← Fullscreen display styles, all 3 slide kinds, fade transition
  default.svg             ← Default "Selamat Datang" slide (1920×1080, green/gold, pure SVG text)
  data/announcements.json ← THE content file — hand-edited (single source of truth)
  README.md               ← Editor-facing guide (URL modes, JSON field rules)
  DEV_NOTES.md            ← Session memo (bugs, lessons, vibe — read before touching anything)
  CLAUDE.md               ← This file
  developer.md            ← Developer guide (testing harness, tuning knobs, edge cases)
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
