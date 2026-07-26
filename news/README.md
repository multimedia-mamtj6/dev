# news/ — Paparan Pengumuman (Xibo digital display)

Fullscreen announcement display for Xibo. Point the Xibo **Webpage** widget at:

```
https://dev.mamtj6.com/news              ← slideshow: all active announcements rotate
https://dev.mamtj6.com/news?slideshow    ← same as above (explicit)
https://dev.mamtj6.com/news?ann=1        ← pin ONLY announcement #1 (1st entry in the JSON)
https://dev.mamtj6.com/news?ann=2        ← pin ONLY announcement #2, and so on
```

`?ann=N` counts entries in `data/announcements.json` top to bottom, starting
at 1. A pinned entry still follows its own `start_at`/`end_at`/`enabled` —
if it's expired, not started yet, disabled, or the number doesn't exist,
the screen shows the default slide. An invalid `ann` value falls back to
the slideshow.

## How it works

The page reads [`data/announcements.json`](data/announcements.json) and shows
whichever announcements are **active right now** (device local time, Malaysia):

- **No active announcement** → the default slide (`default_image`) is shown.
- **One active** → that image is shown fullscreen (`object-fit: contain`).
- **Several active** → they rotate as a slideshow, 15 seconds each.

Expiry is computed on the display itself — when an announcement's `end_at`
passes, the screen falls back to the default slide within ~1 minute, with no
edit or republish needed. New/changed JSON is picked up by the page's
10-minute auto-reload (`<meta refresh>`), same as `kuliah/paparan/`.

## Editing `data/announcements.json`

Two kinds of announcement — **image** and **text**:

```json
{
  "default_image": "/news/default.svg",
  "announcements": [
    {
      "title": "Kenduri / program name (label only, not displayed)",
      "image_url": "/media/img/program.png",
      "start_at": "2026-08-01",
      "end_at": "2026-08-05",
      "enabled": true
    },
    {
      "title": "Notis ringkas",
      "heading": "Pengumuman",
      "text": "Kuliah Maghrib pada hari Isnin ini ditangguhkan.\nHarap maklum.",
      "start_at": "2026-08-01",
      "end_at": "2026-08-03"
    }
  ]
}
```

Field rules:

- `image_url` — image announcement. Root-relative repo path (`/media/...`) or
  a full `https://` URL (e.g. Supabase Storage). Landscape ~1920×1080 fits best.
- `text` — text announcement: rendered as a styled fullscreen slide (dark
  green + gold, same look as the default slide). Use `\n` inside the string
  for line breaks. Optional `heading` shows above it in gold uppercase.
- **`image_url` + `text` and/or `heading`** — combined slide on the dark
  green theme background: the image is top-aligned and resized to fit the
  space above the caption bar (never cropped or stretched), with the
  caption bar in its own strip at the bottom (`heading` in gold uppercase,
  `text` in white below it — either alone works too). If the image fails
  to load, the entry falls back to the text-slide style so the message
  still shows. Every entry needs at least one of `image_url` / `text`.
- `start_at` / `end_at` — `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SS`, Malaysia
  local time. A date-only value covers the whole day (start 00:00:00,
  end 23:59:59). Omit `start_at` for "immediately"; omit `end_at` for
  "until removed".
- `enabled` — optional; set `false` to hide an entry without deleting it.
- `title` — optional label for humans reading this file; never rendered.
- `default_image` — the slide shown when nothing is active. If it fails to
  load (or the JSON itself is broken), the page falls back to
  `/news/default.svg`, then to a plain text card.

Future announcements are fine — an entry whose `start_at` is next week just
sits dormant until that day arrives.

Slides **crossfade** into each other (0.7s, two stacked layers in
`index.html` — see `swapTo()` in `script.js`); an image only fades in after
it has fully loaded. Rotation interval is `ROTATE_MS` in `script.js`
(15s), fade duration is the `.slide-layer` transition in `style.css`.

## Notes

- All asset paths in `index.html` are **absolute** (`/news/...`) — required
  under Vercel `cleanUrls`, see the Key Patterns section of the root
  `CLAUDE.md`. Keep them absolute.
- Managed manually for now (edit this JSON + commit, or via GitHub web UI).
  A future `admin/news/` module + `api/publish-news.js` can take over
  writing this file without any change to the display page.

## See also

- `CLAUDE.md` — architecture reference (slide kinds, crossfade design,
  change-detection keys)
- `developer.md` — local testing harness, tuning knobs, edge cases
- `DEV_NOTES.md` — session memo: bugs found on real hardware and the
  lessons baked into the current design
