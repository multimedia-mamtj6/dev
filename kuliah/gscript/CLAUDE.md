# CLAUDE.md — kuliah/gscript

Google Apps Script tooling for the MAMTJ6 mosque website. Two sub-projects:

```
poster kuliah/   ← Syncs 1920×1080 poster images: Google Drive → GitHub
jadual kuliah/   ← Syncs kuliah schedule: Google Sheet → GitHub JSON
```

## Important: These Files Are Not Deployed Here

The `.gs` and `.html` files in this folder are the **local source of truth** — they are copy-pasted into the Google Apps Script editor manually. They do not run from this repo. Changes here have no effect until deployed in GAS.

The deployed Web App URL for `poster kuliah` is at the top of `code.gs` as a comment.

## Deployment Gotcha

`/exec` URL always runs the **last deployed version**, not the latest saved code. After any change to `code.gs` or `index.html`, the user must:
`Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy`

Forgetting this is the #1 cause of "why isn't my change working?"

## poster kuliah — Architecture

**Single-commit sync via Git Trees API.** All file changes land in one commit — this avoids triggering Vercel once per file (which caused rate limiting at 19+ files).

```
code.gs    ← Server-side: 8-step sync function + progress logging via CacheService
index.html ← Client-side: password gate + live progress log (polls getProgress() every 1.5s)
```

### Secret Config (not in repo)
Two Script Properties must be set in the GAS project settings:
- `GITHUB_TOKEN` — fine-grained PAT with `contents:write` on `multimedia-mamtj6/dev`
- `SECRET_KEY` — arbitrary password shown in the HTML login form

### CONFIG object (top of code.gs)
```javascript
const CONFIG = {
  DRIVE_FOLDER_ID: '1EvzlAiOkQJFthzcGUwOIITS2A8yuoJLq',
  GITHUB_USERNAME: 'multimedia-mamtj6',
  GITHUB_REPO: 'dev',
  GITHUB_BRANCH: 'main',
  REPO_PATH: 'kuliah/assets/poster-kuliah/1920X1080',
  COMMIT_MESSAGE: 'Sync files from Google Drive',
  ALLOWED_EXTENSIONS: ['jpeg', 'jpg', 'png', 'gif', 'svg', 'webp']
};
```

### 8-Step Git Trees Flow
Steps 1–7 are safe/staging. **Only Step 8 changes the repo.**

| Step | API | What |
|------|-----|------|
| 1 | GET `/git/ref/heads/main` | Get HEAD commit SHA |
| 2 | GET `/git/commits/{sha}` | Get base tree SHA |
| 3 | GET `/contents/{REPO_PATH}` | List existing files → mark for deletion (`sha: null`) |
| 4 | DriveApp | Read + sort Drive files numerically |
| 5 | POST `/git/blobs` ×N | Upload raw binary as base64 blobs |
| 6 | POST `/git/trees` | Build new tree (delete old + add new) |
| 7 | POST `/git/commits` | Create commit (not yet visible) |
| 8 | PATCH `/git/refs/heads/main` | Move branch pointer → repo now updated |

### Progress Visibility
- `logProgress(message)` writes to `CacheService.getScriptCache()` under key `sync_progress`
- HTML polls `getProgress()` every 1.5s via `google.script.run`
- CacheService is the only shared state between the running sync and the polling calls

## Key Patterns

- `muteHttpExceptions: true` on every `UrlFetchApp.fetch()` — without it, non-2xx responses throw opaque errors with no status code
- `Utilities.base64Encode(file.getBlob().getBytes())` — required for binary image upload to GitHub blobs API
- Error messages include `[Step N]` so failures are immediately locatable in the 8-step flow
- Files renamed on upload: `(index+1).padStart(2,'0') + '_' + originalName` for ordered display

## Detailed Notes

See `DEV_NOTES.md` in this folder for full session history, debugging decisions, and context on what was built and why.
