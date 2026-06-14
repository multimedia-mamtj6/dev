# Embedding widgets into Google Sites (iframe) — Guide

Notes from getting `widget.html`'s `?embed=1` mode to work correctly inside a Google
Sites embed (`<iframe>`), referencing the existing pattern in `test_file.html`.

## 1. Why Google Sites embedding is tricky

- Google Sites iframes are a **fixed-size box** — they don't auto-grow to fit the
  embedded page's content. Whatever HTML you embed must fit inside that box with
  **no scrollbars and no clipping**.
- The embedded page's own background must be **transparent** so the Sites page
  background shows through around the widget. The widget's own card/container
  (e.g. `.widget` with `#161b22`) stays opaque — only the outer page background
  goes transparent.

## 2. The `?embed=1` pattern

Toggle an `embed-mode` class on `<body>` based on a URL param, then style for it:

```js
(function initEmbedMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('embed') === '1') {
    document.body.classList.add('embed-mode');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    window.addEventListener('resize', scaleWidgetToFit);
  }
})();
```

```css
body.embed-mode {
  background: transparent;
  display: block;
  justify-content: initial;
  align-items: initial;
  min-height: 0;
  padding: 0;
}

body.embed-mode .widget {
  border-radius: 0;
  box-shadow: none;
  max-width: none;      /* see "max-width trap" below */
  width: 100%;
  min-height: 100%;
  transform-origin: top left;
}
```

## 3. Scale-to-fit algorithm

Goal: shrink the widget via `transform: scale()` so its **full height** fits the
iframe viewport (no scroll), while making sure the scaled-down result still
**fills the iframe's width** (no empty side margins).

A naive single-pass approach — `scale = min(1, innerHeight / naturalHeight)`
applied as a uniform `transform: scale()` — also shrinks the width, leaving empty
margins (worse with `transform-origin: center`, which centers the gap on both sides).

**Fix: iterative widen-then-scale loop.** Before measuring height, set the
widget's inline `width` to `containerWidth / scale` so that after scaling down by
`scale`, it renders back out at exactly `containerWidth`. Recompute the natural
height at this new width, recompute `scale`, and repeat until it converges
(~5 iterations is enough):

```js
function scaleWidgetToFit() {
  if (!document.body.classList.contains('embed-mode')) return;
  const widget = document.querySelector('.widget');
  const containerWidth = window.innerWidth;
  const containerHeight = window.innerHeight;

  let scale = 1;
  for (let i = 0; i < 5; i++) {
    widget.style.transform = 'none';
    widget.style.width = (containerWidth / scale) + 'px';
    const naturalHeight = widget.offsetHeight;
    const next = Math.min(1, containerHeight / naturalHeight);
    if (Math.abs(next - scale) < 0.005) { scale = next; break; }
    scale = next;
  }

  widget.style.transform = `scale(${scale})`;
}
```

**Why it converges**: the widget's natural height is roughly
`H(W) = C + W/3` (a fixed-height "chrome" part `C`, plus an SVG that scales
linearly with width via `viewBox="0 0 360 120"` + `width:100%; height:auto`).
The recurrence `W_{i+1} = Wc · H(W_i) / Hc` (where `Wc`/`Hc` are the container
dimensions) converges geometrically to a fixed point whenever
`Hc > Wc / 3` — i.e. as long as the iframe isn't *extremely* short relative to
its width.

**`transform-origin: top left`** anchors the scaled widget to the top-left
corner. With the widen-then-scale result rendering at `containerWidth`, a
center-based origin would re-introduce side margins by centering the scale
operation; top-left keeps it flush.

Call `scaleWidgetToFit()` after content is rendered (e.g. at the end of
`renderArc()`) and again on `resize`.

## 4. The `max-width` trap

`.widget` normally has `max-width: 480px` (or `max-width: 100%`) for the
non-embed layout. **In embed mode this must be `max-width: none`.**

Why: the widen-then-scale algorithm intentionally sets `widget.style.width`
*larger* than `containerWidth` whenever `scale < 1`. A `max-width: 100%` rule
silently clamps that inline width back down to `containerWidth`, which:

- breaks the natural-height measurement (measured at the wrong width), and
- breaks the final `scale` calculation,

...causing the widget to render **smaller than the container** after
`transform: scale()` — it appears narrow and left-aligned (because of
`transform-origin: top left`), with empty space to the right/below.

**This bug only shows up when `scale < 1`** — i.e. on iframes that are short
relative to their width (mobile-aspect embeds). A wide/tall iframe where
`scale = 1` never triggers the widen step, so `max-width: 100%` appears
harmless there — desktop testing alone won't catch this.

## 5. Comparison with `test_file.html`'s `scaleToFit()`

`test_file.html` (digital signage) uses a simpler, **fixed-size container**
(`.container { width: 1000px; }`) and a single-pass scale:

```js
function scaleToFit() {
  const container = document.querySelector('.container');
  container.style.transform = 'none';
  const naturalWidth = container.offsetWidth;
  const naturalHeight = container.offsetHeight;
  const scale = Math.min(
    window.innerWidth / naturalWidth,
    window.innerHeight / naturalHeight
  );
  container.style.transform = `scale(${scale})`;
}
```

This works there because:

- the container's width is **fixed** (doesn't need to fill the viewport), and
- `transform-origin: center center` + `body { display:flex; justify-content:center; align-items:center; }`
  is the *desired* look — a centered poster on a signage display.

`widget.html`'s widget instead needs to **fill** the iframe width responsively
(it's a content widget, not a fixed poster), which is why it needs the more
involved iterative widen-then-scale + top-left-anchor approach.

## 6. Testing checklist

- Use a local test harness (`embed_test.html`) with an `<iframe>` pointing at
  `<page>.html?embed=1&testTime=HH:MM`.
- Test **both**:
  - desktop-like iframe (wide & tall enough, `scale ≈ 1`)
  - mobile-like iframe (narrow & short, `scale < 1`) — bugs like the
    `max-width` trap *only* appear here.
- Hard-refresh (`Ctrl+Shift+R`) after editing local files — browser caching can
  make edits appear to have "no effect".
- Serve via `python -m http.server` (not `file://`) — pages that fetch
  JSON/API data need CORS, which `file://` doesn't provide.

## 7. Scaling UP for large viewports (desktop embed, standalone desktop, signage)

Everything above covers *shrinking* the widget to fit a small iframe. The same
`scaleWidgetToFit()` function can also *grow* the widget — useful for:

- a desktop-sized Google Sites embed area (bigger than the widget's base ~480px design),
- a plain desktop browser visit to the page directly (no iframe), or
- a 1920x1080 digital-signage screen.

### Auto-detecting "large viewport"

No new URL param needed — just check the viewport itself, alongside the
existing `embed-mode` class:

```js
const LARGE_VIEWPORT_MIN_W = 768;
const LARGE_VIEWPORT_MIN_H = 480;
const MAX_SCALE = 3; // upper bound for scale-up; tune against 1920x1080 testing

function updateViewportMode() {
  const isLarge = window.innerWidth >= LARGE_VIEWPORT_MIN_W && window.innerHeight >= LARGE_VIEWPORT_MIN_H;
  document.body.classList.toggle('large-viewport', isLarge);
}
```

In `scaleWidgetToFit()`, replace the shrink-only `Math.min(1, ...)` cap with:

```js
const upperBound = large ? MAX_SCALE : 1;
const next = Math.min(upperBound, containerHeight / naturalHeight);
```

- Small viewport (phone, small embed): `upperBound = 1` → shrink-only, identical to before.
- Large viewport (desktop embed, desktop standalone, signage): `upperBound = MAX_SCALE` → can grow.

By construction the loop always sets `widget.style.width = containerWidth / scale`
just before applying `transform: scale(scale)`, so the **rendered width always
equals `containerWidth`** (fills the available width) — growing just increases
how tall that becomes, up to `MAX_SCALE`.

**Convergence loop count**: bump the iteration count (e.g. 5 → 8) when allowing
scale-up — the wider range from shrink (`<1`) to grow (`up to 3`) needs a couple
more iterations to settle. Also, after the loop, **unconditionally re-apply**
`widget.style.width = containerWidth / scale` with the *final* `scale` before
setting the transform — if the loop exits at the iteration cap without
converging, the last-set `width` may correspond to a stale `scale`, leaving the
rendered width slightly off from `containerWidth` (visible as overflow or a gap).

### Anchor choice differs for embed vs. standalone scale-up

This is the trap that bit us: a single `transform-origin` doesn't work for both.

- **Embed mode**: keep `transform-origin: top left` for *both* shrink and grow.
  The box is positioned at `(0,0)` (no centering in embed mode), and by
  construction its scaled size stays within the container — growing from the
  top-left corner stays in-bounds.
- **Standalone (non-embed) large viewport**: use `transform-origin: center center`.
  The page's `body` flex-centers the widget *before* the transform is applied;
  scaling around the widget's own center keeps it centered as it grows.

**If you use `center center` in embed mode too**, a widget scaled up from a
small natural size will expand symmetrically around its center — pushing half
its content into *negative* coordinates relative to the iframe's `(0,0)`
origin. Combined with `overflow: hidden` on `html`/`body`, that half gets
silently clipped off-screen, leaving only a fragment of the widget visible in
one corner. Scope the rule so it doesn't apply when `embed-mode` is also set:

```css
body.large-viewport:not(.embed-mode) .widget {
  max-width: none;
  transform-origin: center center;
}
```

(`max-width: none` is already set by the `embed-mode` rule for the embed case —
see §4 — so this `:not(.embed-mode)` rule only needs to add it for the
standalone large-viewport case.)

### The `min-height: 100%` / `overflow: hidden` clipping trap

A previous iteration had `body.embed-mode .widget { min-height: 100%; }` so the
card would fill the iframe height even when its content was naturally shorter.
This **breaks scale-up**:

- `min-height: 100%` resolves against the *body's* height — but if `body` has
  no explicit height (e.g. `min-height: 0`), the body's height is itself
  derived from its content (the widget) → circular, and in practice resolves
  to the widget's own natural content height.
- During measurement, `widget.offsetHeight` then reports that *forced*
  min-height instead of the true content height, so `naturalHeight ≈
  containerHeight` always → the scale-up calculation collapses to `scale ≈ 1`
  (no growth at all).
- Separately, `html`/`body` end up sized to the widget's *natural* (pre-transform)
  height (~262px in our case), not the iframe's actual viewport height (e.g.
  800px). `overflow: hidden` then clips anything beyond that ~262px — including
  the *visually scaled-up* widget (e.g. 778px tall after `scale(3)`), even
  though 778px would otherwise fit comfortably inside an 800px iframe. Net
  effect: most of the widget gets clipped away.

**Fix**: give `body.embed-mode` an explicit `height: 100vh` (so its box —
and the `overflow: hidden` clip boundary — matches the real iframe viewport,
independent of content), and **remove** `min-height: 100%` from `.widget`
entirely:

```css
body.embed-mode {
  background: transparent;
  display: block;
  justify-content: initial;
  align-items: initial;
  height: 100vh;     /* was: min-height: 0 */
  padding: 0;
}

body.embed-mode .widget {
  border-radius: 0;
  box-shadow: none;
  max-width: none;
  width: 100%;
  /* min-height: 100% removed — see above */
  transform-origin: top left;
}
```

Trade-off: if the widget's content is naturally shorter than the iframe even
after scaling (rare — only when `scale` hits `MAX_SCALE` before filling the
height), there's a small transparent gap below the card showing the host
page's background. That's consistent with the "transparent page, opaque card"
embed philosophy (§1) and is preferable to clipping the widget.

## 8. Testing checklist (updated)

- Use local test harnesses with `<iframe>`s pointing at `<page>.html?embed=1&testTime=HH:MM`,
  and also test the page **without** `?embed=1` for the standalone-desktop case.
- Test **all** of:
  - phone-sized viewport / small mobile-aspect iframe (`scale < 1`, shrink-to-fit) — bugs like the `max-width` trap only appear here.
  - large desktop-aspect iframe with `?embed=1` (`scale > 1`, grow) — bugs like the `min-height`/clipping trap only appear here.
  - large standalone desktop viewport, no `?embed=1` (grow, `center center` anchor).
  - 1920x1080 (resized browser window or iframe) — the signage case; same code path as large desktop, just bigger.
- For each case, sanity-check `document.documentElement.scrollWidth/scrollHeight`
  equal the viewport's `innerWidth/innerHeight` — any mismatch indicates
  clipping or overflow.
- Hard-refresh (`Ctrl+Shift+R`) after editing local files — browser caching can
  make edits appear to have "no effect".
- Serve via `python -m http.server` (not `file://`) — pages that fetch
  JSON/API data need CORS, which `file://` doesn't provide.
