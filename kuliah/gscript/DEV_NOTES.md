# DEV NOTES — kuliah/gscript (Poster Sync Tool)

_Written for the next Claude window. Don't skip this — it'll save you 20 minutes of archaeology._

---

## What This Folder Is

Google Apps Script tooling that syncs poster images from Google Drive into the GitHub repo `multimedia-mamtj6/dev`. Two GAS projects live here:

```
poster kuliah/   ← ACTIVE. Syncs 1920×1080 poster images. This is the one we worked on.
jadual kuliah/   ← Separate GAS project (jadual/schedule sync, different beast entirely)
```

The `poster kuliah` tool is a **Web App** deployed on GAS — accessed via `/exec` URL in a browser, password-gated. It's also callable from the spreadsheet via a custom menu (`onOpen → GitHub Sync → Sync Files Now`).

---

## The Vibe of This Session

The user (multimedia-mamtj6, Malay-speaking, mosque digital team) is technically sharp but not a professional dev. He knows what he wants, tests things himself, and reports back clearly — e.g. pasted full error messages, described "works in GAS console but not HTML." He doesn't want verbose explanations unless he asks. He asks short follow-up questions ("so this is good?") and trusts you when you confirm.

Energy: collaborative, iterative, practical. He's building real infrastructure for a real mosque, not a side project. Treat errors seriously. He appreciates when you explain the *why* behind technical decisions (he asked "explain GITHUB_BRANCH being added to CONFIG", "explain the single commit approach", "what are the risks").

He moves the goalposts naturally as we progress — that's not scope creep, it's the organic flow of someone building something real. Just roll with it.

---

## The Journey (What We Actually Solved)

### Problem 1: GitHub 404 on DELETE
Old code used Contents API (`DELETE /contents/{path}`) per file — one commit per file. The forEach loop had no `muteHttpExceptions: true` so any 404 on a missing file crashed the whole thing.

**Fix**: Switched to **Git Trees API** (single commit for the entire sync). Deletion is now done by setting `sha: null` in tree entries — no per-file DELETE calls at all.

### Problem 2: Works in GAS console but not HTML
Classic GAS "deployment lag" — `/exec` URL runs the **last deployed version**, not the latest saved code. Every code change needs: `Deploy → Manage deployments → Edit → New version → Deploy`.

**Fix**: Re-deploy. That's it. But worth knowing this will happen again.

### Problem 3: Progress log looped with no output
Polling worked but `getProgress()` didn't exist in the deployed version. Also: polling calls had no `withFailureHandler` so failures were silent.

**Fix**: Added `withFailureHandler` to the polling `setInterval`. Added final `getProgress()` call in both `onSuccess` and `onFailure` (with its own `withFailureHandler`) so the button always re-enables.

### Problem 4: Vercel rate limit
19 files = 19 commits = Vercel deploys 19 times = "Deployment rate limited, retry in 24 hours."

**Fix**: Git Trees API → **1 commit per full sync**, regardless of file count. Vercel triggers once.

---

## Current State (End of Session)

**Working.** User confirmed successful sync:
```
✅ Sync complete. Mirrored 19 files in 1 commit to dev/kuliah/assets/poster-kuliah/1920X1080
[Step 1] Getting branch HEAD... → bf3401f
[Step 3] Marked 19 existing file(s) for deletion.
[Step 4] Found 19 file(s) in Drive.
[Step 5] Uploaded 19 blobs
[Step 6] New tree: d85d2a0  ← same SHA as base tree (content-addressable, expected)
[Step 7] New commit: 3a9fc1b
[Step 8] Branch ref updated.
```

One Vercel deploy fires. GitHub gets 1 commit. All 8 steps visible in the HTML progress log.

---

## Active File Paths

| File | What It Is |
|------|------------|
| `kuliah/gscript/poster kuliah/code.gs` | Server-side GAS logic — 8-step Git Trees API sync |
| `kuliah/gscript/poster kuliah/index.html` | HTML Service UI — password gate + live progress log |

The GAS project is **not in this repo** — it lives on Google's servers. These files are the *source of truth* that you copy-paste into the GAS editor. The deployed script URL is at the top of `code.gs` as a comment.

---

## Architecture: Git Trees API (8 Steps)

Steps 1–7 are **read-only or staging-only** — repo is completely unchanged.  
Step 8 (`PATCH /git/refs/heads/main`) is the only step that makes anything visible.

```
Step 1: GET  /git/ref/heads/main          → currentCommitSha
Step 2: GET  /git/commits/{sha}           → baseTreeSha
Step 3: GET  /contents/{REPO_PATH}        → list old files → mark sha:null for deletion
Step 4: DriveApp.getFiles()               → sort numerically by leading digits
Step 5: POST /git/blobs (×N)              → get blobSha per file
Step 6: POST /git/trees                   → combines deletion + addition entries
Step 7: POST /git/commits                 → creates commit (parents: [currentCommitSha])
Step 8: PATCH /git/refs/heads/main        → moves branch pointer → repo changes
```

If Step 8 fails: the orphaned commit+tree+blobs exist in GitHub's object store but the branch is untouched. Just re-run the sync.

---

## Things the Next Window Might Be Asked to Do

**Pending observation I flagged but user didn't act on:**
Files in Drive are already named `0. bacaan-yasin.png`, `1. Ustaz-Ahmad.jpg`, etc. The script currently prefixes them with `01_`, `02_`... producing names like `01_0.-bacaan-yasin.png`. The leading number is doubled. The user didn't respond to this — might come back to it.

Fix is in `code.gs` line 189:
```javascript
// Current:
const newFileName = (index + 1).toString().padStart(2, '0') + '_' + file.getName().replace(/ /g, '-');

// Fix if user wants clean names (strip the "N. " prefix from Drive filename):
const cleanName = file.getName().replace(/^\d+\.\s*/, '').replace(/ /g, '-');
const newFileName = (index + 1).toString().padStart(2, '0') + '_' + cleanName;
```

**Other things they might ask:**
- Extend to other poster sizes (e.g. 1080×1080) — just add another `CONFIG` object and a second call
- Add confirmation before sync ("are you sure? N files will be replaced")
- Port the same pattern to `jadual kuliah/` if it has similar GitHub sync needs

---

## Key "Why" Decisions to Remember

- **`GITHUB_BRANCH: 'main'` in CONFIG**: Branch was previously hardcoded inside the URL string. Making it a CONFIG param means changing branches is a 1-character edit, not hunting through the code.
- **`CacheService` as message bus**: GAS `google.script.run` calls are async and run in a separate execution context. The only way for the HTML to see progress from a running server function is shared state — `CacheService.getScriptCache()` is that shared state.
- **`muteHttpExceptions: true` everywhere**: Without it, any non-2xx HTTP response throws an exception, which in GAS means an opaque `Script error.` with no status code. With it, you get the response code and body, so `[Step N]` error messages are useful.
- **`base64` encoding for images**: GitHub blobs API requires binary data as base64 string. `Utilities.base64Encode(file.getBlob().getBytes())` is the correct GAS approach.

---

_Last updated: 2026-06-20_
