# Reverse-Proxy Fix Writeup — `waktu-solat` on `www.mamtj6.com`

**Date:** 2026-06-14
**Symptom:** `https://www.mamtj6.com/waktu-solat` loaded correctly, but the
embedded "Info Hari Ini" widget area showed **"dev.mamtj6.com refused to
connect."** The canonical page, `https://dev.mamtj6.com/waktu-solat`, worked
perfectly on its own.

## 1. The setup

- `waktu-solat/` is canonically hosted on Vercel at
  `https://dev.mamtj6.com/waktu-solat`.
- `mamtj6.com` is a Google Sites domain. To avoid showing the Sites nav bar,
  a **Cloudflare Worker** reverse-proxies `https://www.mamtj6.com/waktu-solat`
  by:
  1. Server-side `fetch()`-ing the fixed URL `https://dev.mamtj6.com/waktu-solat`.
  2. String-replacing `"<head>"` with
     `"<head><base href=\"https://dev.mamtj6.com/waktu-solat/\">"`.
  3. Returning the HTML body to the visitor with **only**
     `Content-Type: text/html; charset=utf-8` — all other origin response
     headers (CSP, CORS, etc.) are dropped.
- The page itself embeds a second document, `widget.html`, in an `<iframe
  id="prayerWidgetFrame">` via `updatePrayerWidgetFrame(zoneCode)` in
  `index.html`.

Because the Worker injects a `<base href="https://dev.mamtj6.com/...">` tag,
and the visible URL bar shows `www.mamtj6.com`, the page ends up running with
**two different "origins" in play at once** — this mismatch is the source of
every bug below.

## 2. Root causes (three separate bugs, one symptom)

### Bug A — `cleanUrls: true` 308-redirect dropped headers

The widget iframe `src` was originally
`https://dev.mamtj6.com/waktu-solat/widget.html`. Because root `vercel.json`
has `cleanUrls: true`, Vercel responds to `*.html` URLs with a
**308 Permanent Redirect** to the extension-less path (`/waktu-solat/widget`).

Verified with `curl -sIL`:

```
GET /waktu-solat/widget.html  → 308, Location: /waktu-solat/widget   (no CORS/CSP headers on this hop)
GET /waktu-solat/widget       → 200 OK, with our CORS/CSP headers
```

The 308 response itself carried **none** of our custom CORS/CSP headers
(Vercel's `headers` config doesn't apply to redirects it generates), adding
an unnecessary extra cross-origin hop.

**Fix:** point the iframe directly at the clean URL,
`https://dev.mamtj6.com/waktu-solat/widget` (no `.html`), in
`index.html` → `updatePrayerWidgetFrame()`. Removes the redirect hop entirely.

### Bug B — CORS/CSP allow-list used the wrong origin (`mamtj6.com` vs `www.mamtj6.com`)

The actual live site is `https://www.mamtj6.com` (with `www`). The root
`vercel.json` `headers` block for `/waktu-solat` and `/waktu-solat/(.*)` only
allowed:

```
Access-Control-Allow-Origin: https://mamtj6.com
Content-Security-Policy: frame-ancestors 'self' https://mamtj6.com https://dev.mamtj6.com
```

`https://www.mamtj6.com` is a **different origin** from `https://mamtj6.com`
as far as `frame-ancestors` and CORS are concerned. The browser console
confirmed this directly:

```
Framing 'https://dev.mamtj6.com/' violates the following Content Security
Policy directive: "frame-ancestors 'self' https://mamtj6.com
https://dev.mamtj6.com". The request has been blocked.

Access to manifest at 'https://dev.mamtj6.com/waktu-solat/favicon/site.webmanifest'
from origin 'https://www.mamtj6.com' has been blocked by CORS policy: The
'Access-Control-Allow-Origin' header has a value 'https://mamtj6.com' that is
not equal to the supplied origin.
```

This is the actual mechanism behind **"dev.mamtj6.com refused to connect"** —
Chrome's iframe error page for a cross-origin frame blocked by
`X-Frame-Options`/CSP `frame-ancestors` shows the *target's* origin
(`dev.mamtj6.com`) with "refused to connect," even though the real cause is
the *parent's* origin (`www.mamtj6.com`) not being in the allow-list.

**Fix:** updated root `vercel.json` for both `/waktu-solat` and
`/waktu-solat/(.*)`:

```json
{
  "key": "Access-Control-Allow-Origin", "value": "https://www.mamtj6.com"
},
{
  "key": "Content-Security-Policy",
  "value": "frame-ancestors 'self' https://mamtj6.com https://www.mamtj6.com https://dev.mamtj6.com"
}
```

(`frame-ancestors` supports multiple values, so both the bare and `www.`
domains are listed for safety; `Access-Control-Allow-Origin` only supports a
single value, set to the one that's actually used, `https://www.mamtj6.com`.)

### Bug C — `<base>` tag hijacked the Service Worker registration's *host*, not just its path

`index.html`/`info.html` registered the service worker with a root-relative
URL:

```js
navigator.serviceWorker.register('/waktu-solat/sw.js')
```

The intuition was that a root-relative URL (`/...`) is immune to `<base
href>` — only *relative* URLs (no leading `/`) are supposed to be affected.
**That's true for the path, but not for the origin.** Per the URL spec, when
resolving a reference that starts with `/` against a base URL, the result
keeps the **base URL's scheme + host**, only replacing the path. Since the
Worker injects `<base href="https://dev.mamtj6.com/waktu-solat/">`,
`/waktu-solat/sw.js` resolves to `https://dev.mamtj6.com/waktu-solat/sw.js` —
a different origin than the page (`https://www.mamtj6.com`).

`navigator.serviceWorker.register()` requires same-origin script URLs, so
this threw:

```
SW registration failed: SecurityError: Failed to register a ServiceWorker:
The origin of the provided scriptURL ('https://dev.mamtj6.com') does not
match the current origin ('https://www.mamtj6.com').
```

**Fix:** build the registration URL explicitly against the real page origin,
bypassing `document.baseURI`/`<base>` entirely:

```js
navigator.serviceWorker.register(window.location.origin + '/waktu-solat/sw.js')
```

Applied in both `index.html` (~line 1208) and `info.html` (~line 489), each
already wrapped with `.catch(err => console.warn('SW registration failed:',
err))` from an earlier pass so a failed registration degrades silently.

## 3. Files changed

| File | Change |
|---|---|
| `waktu-solat/index.html` | Widget iframe `src` → `https://dev.mamtj6.com/waktu-solat/widget` (no `.html`, avoids 308); SW registration → `window.location.origin + '/waktu-solat/sw.js'` |
| `waktu-solat/info.html` | SW registration → `window.location.origin + '/waktu-solat/sw.js'` |
| `vercel.json` (root) | `/waktu-solat` and `/waktu-solat/(.*)` header blocks: `Access-Control-Allow-Origin` → `https://www.mamtj6.com`; `Content-Security-Policy: frame-ancestors` now includes `https://mamtj6.com`, `https://www.mamtj6.com`, and `https://dev.mamtj6.com` |

`trailingSlash: false` / `cleanUrls: true` in root `vercel.json` were left
untouched (required by another part of the project).

## 4. Lessons for next time

- **A reverse proxy that injects `<base href>` changes the effective origin
  for *every* root-relative URL on the page**, not just relative ones. Any
  same-origin API that's sensitive to origin (Service Worker registration,
  `fetch()` with credentials, etc.) must be built from `window.location.origin`
  explicitly, not left as a bare `/path`.
- **Always verify the *exact* origin** (including `www.` vs bare domain) that
  will appear in `Origin`/`frame-ancestors` checks — `mamtj6.com` and
  `www.mamtj6.com` are different origins to the browser, even if they're "the
  same site" to a human.
- **`cleanUrls`/`trailingSlash` redirects strip custom headers** on the
  redirect response itself in Vercel — if a resource needs CORS/CSP headers
  and is also subject to a clean-URL redirect, link directly to the final
  (post-redirect) URL to avoid an unheaded hop.
- Browser CSP/X-Frame-Options violation messages for cross-origin iframes
  report the **target's** origin ("X refused to connect"), which can mislead
  you into debugging the wrong side — the actual missing piece is usually the
  **parent's** origin missing from the target's `frame-ancestors`/CORS
  allow-list.
