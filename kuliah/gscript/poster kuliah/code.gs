// https://script.google.com/macros/s/AKfycbzil5QcquMpXTMuwdbgiZRzNJ1IWksEcqbyaRcoD5yx9gmbW_l5BR0oXDn0KdEPLF6NGQ/exec

// =========================================================================
// == WEB APP & MENU
// =========================================================================

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('GitHub Sync Control Panel')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GitHub Sync')
    .addItem('Sync Files Now', 'syncFilesToGithub')
    .addToUi();
}

// Called from index.html via google.script.run
function runSyncWithKey(providedKey) {
  const SECRET_KEY = PropertiesService.getScriptProperties().getProperty('SECRET_KEY');
  if (providedKey !== SECRET_KEY) {
    throw new Error('Invalid secret key. Access denied.');
  }
  clearProgress();
  return syncFilesToGithub();
}

// Called by HTML polling to show live progress
function getProgress() {
  const cached = CacheService.getScriptCache().get('sync_progress');
  return cached ? JSON.parse(cached) : [];
}


// =========================================================================
// == CONFIGURATION
// =========================================================================

const CONFIG = {
  DRIVE_FOLDER_ID: '1EvzlAiOkQJFthzcGUwOIITS2A8yuoJLq',
  GITHUB_USERNAME: 'multimedia-mamtj6',
  GITHUB_REPO: 'dev',
  GITHUB_BRANCH: 'main',
  REPO_PATH: 'kuliah/assets/poster-kuliah/1920X1080',
  COMMIT_MESSAGE: 'Sync files from Google Drive',
  ALLOWED_EXTENSIONS: ['jpeg', 'jpg', 'png', 'gif', 'svg', 'webp']
};


// =========================================================================
// == PROGRESS HELPERS
// =========================================================================

function clearProgress() {
  CacheService.getScriptCache().remove('sync_progress');
}

function logProgress(message) {
  const cache = CacheService.getScriptCache();
  const existing = cache.get('sync_progress');
  const messages = existing ? JSON.parse(existing) : [];
  messages.push(message);
  cache.put('sync_progress', JSON.stringify(messages), 600);
}


// =========================================================================
// == MAIN SYNC FUNCTION  (Git Trees API — produces exactly 1 commit)
// =========================================================================
//
// Flow: HEAD commit → base tree → list old files → upload blobs
//       → build tree (delete old + add new) → commit → update ref
//
// If anything fails before Step 8, the repo is completely unchanged.
// Error messages include [Step N] so you know exactly where it broke.

function syncFilesToGithub() {
  const GITHUB_TOKEN = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!GITHUB_TOKEN) throw new Error('GitHub token not found in Script Properties.');

  const headers = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json'
  };

  const BASE_URL = `https://api.github.com/repos/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}`;


  // ── Step 1: Get current HEAD commit SHA ──────────────────────────────────
  // Required as (a) the parent pointer for the new commit and
  // (b) the entry point to retrieve the base tree in Step 2.
  logProgress('🔍 [Step 1] Getting branch HEAD...');

  const refResponse = UrlFetchApp.fetch(
    `${BASE_URL}/git/ref/heads/${CONFIG.GITHUB_BRANCH}`,
    { headers: headers, muteHttpExceptions: true }
  );
  if (refResponse.getResponseCode() !== 200) {
    throw new Error(`[Step 1] Cannot get branch ref: HTTP ${refResponse.getResponseCode()} — ${refResponse.getContentText()}`);
  }
  // object.sha is the commit SHA (not the tree SHA) at the tip of the branch
  const currentCommitSha = JSON.parse(refResponse.getContentText()).object.sha;
  logProgress(`  📌 HEAD commit: ${currentCommitSha.slice(0, 7)}`);


  // ── Step 2: Get base tree SHA from that commit ───────────────────────────
  // The base tree SHA represents the full repo file structure at HEAD.
  // New tree (Step 6) is built as a patch on top of this.
  const commitResponse = UrlFetchApp.fetch(
    `${BASE_URL}/git/commits/${currentCommitSha}`,
    { headers: headers, muteHttpExceptions: true }
  );
  if (commitResponse.getResponseCode() !== 200) {
    throw new Error(`[Step 2] Cannot get commit data: HTTP ${commitResponse.getResponseCode()} — ${commitResponse.getContentText()}`);
  }
  const baseTreeSha = JSON.parse(commitResponse.getContentText()).tree.sha;
  logProgress(`  🌳 Base tree: ${baseTreeSha.slice(0, 7)}`);


  // ── Step 3: List existing files in the target folder ─────────────────────
  // We must know the old filenames so we can explicitly mark them deleted.
  // Without this, files with different names would persist after the sync
  // (the Trees API only patches — it does not wipe a folder automatically).
  logProgress('🔍 [Step 3] Listing existing files on GitHub...');

  const listResponse = UrlFetchApp.fetch(
    `${BASE_URL}/contents/${CONFIG.REPO_PATH}`,
    { headers: headers, muteHttpExceptions: true }
  );

  // treeEntries accumulates both deletions and additions for Step 6
  const treeEntries = [];

  const listCode = listResponse.getResponseCode();
  if (listCode === 200) {
    const existing = JSON.parse(listResponse.getContentText()).filter(function(f) { return f.type === 'file'; });
    existing.forEach(function(f) {
      // sha: null is the Trees API signal to delete this path from the repo
      treeEntries.push({ path: CONFIG.REPO_PATH + '/' + f.name, mode: '100644', type: 'blob', sha: null });
    });
    logProgress('  🗑️ Marked ' + existing.length + ' existing file(s) for deletion.');
  } else if (listCode === 404) {
    // Folder doesn't exist yet — first run. Nothing to delete.
    logProgress('  📂 Folder does not exist yet — will be created on upload.');
  } else {
    throw new Error(`[Step 3] Cannot list GitHub folder: HTTP ${listCode} — ${listResponse.getContentText()}`);
  }


  // ── Step 4: Read and sort files from Google Drive ────────────────────────
  logProgress('📁 [Step 4] Reading files from Google Drive...');

  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const fileIterator = folder.getFiles();
  const filesToSort = [];

  while (fileIterator.hasNext()) {
    const file = fileIterator.next();
    const ext = file.getName().split('.').pop().toLowerCase();
    if (CONFIG.ALLOWED_EXTENSIONS.includes(ext)) filesToSort.push(file);
  }

  // Sort numerically by leading digits in filename, then alphabetically
  filesToSort.sort(function(a, b) {
    const nameA = a.getName(), nameB = b.getName();
    const numA = parseInt(nameA.match(/^\d+/), 10);
    const numB = parseInt(nameB.match(/^\d+/), 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return nameA.localeCompare(nameB);
  });

  logProgress('  📋 Found ' + filesToSort.length + ' file(s) in Drive.');

  if (filesToSort.length === 0 && treeEntries.length === 0) {
    return '✅ Nothing to sync — Drive folder and GitHub folder are both empty.';
  }


  // ── Step 5: Upload each file as a raw blob ────────────────────────────────
  // Blobs are raw binary data stored in GitHub's object store.
  // They are NOT commits — just data. If this step fails partway through,
  // the orphaned blobs are harmless and GitHub garbage-collects them.
  // The repo remains completely unchanged until Step 8.
  logProgress('📤 [Step 5] Uploading ' + filesToSort.length + ' blob(s)...');

  filesToSort.forEach(function(file, index) {
    const newFileName = (index + 1).toString().padStart(2, '0') + '_' + file.getName().replace(/ /g, '-');

    const blobResponse = UrlFetchApp.fetch(`${BASE_URL}/git/blobs`, {
      method: 'POST',
      headers: headers,
      contentType: 'application/json',
      // Images are binary — must be base64-encoded before sending to GitHub
      payload: JSON.stringify({
        content: Utilities.base64Encode(file.getBlob().getBytes()),
        encoding: 'base64'
      }),
      muteHttpExceptions: true
    });

    if (blobResponse.getResponseCode() !== 201) {
      throw new Error(`[Step 5] Failed to upload blob "${newFileName}": HTTP ${blobResponse.getResponseCode()} — ${blobResponse.getContentText()}`);
    }

    // blobSha is a content-addressable hash — identical files produce the same SHA
    const blobSha = JSON.parse(blobResponse.getContentText()).sha;
    logProgress('  ✅ Blob (' + (index + 1) + '/' + filesToSort.length + '): ' + newFileName);

    treeEntries.push({
      path: CONFIG.REPO_PATH + '/' + newFileName,
      mode: '100644', // regular file (not executable, not symlink, not directory)
      type: 'blob',
      sha: blobSha   // non-null SHA = create/update this file
    });
  });


  // ── Step 6: Create a new Git tree ────────────────────────────────────────
  // base_tree: start from the current full repo structure
  // tree: patch to apply — entries with sha:null are deleted,
  //       entries with a blob SHA are created or updated
  logProgress('🌳 [Step 6] Creating new Git tree...');

  const treeResponse = UrlFetchApp.fetch(`${BASE_URL}/git/trees`, {
    method: 'POST',
    headers: headers,
    contentType: 'application/json',
    payload: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
    muteHttpExceptions: true
  });

  if (treeResponse.getResponseCode() !== 201) {
    throw new Error(`[Step 6] Failed to create tree: HTTP ${treeResponse.getResponseCode()} — ${treeResponse.getContentText()}`);
  }
  const newTreeSha = JSON.parse(treeResponse.getContentText()).sha;
  logProgress('  🌳 New tree: ' + newTreeSha.slice(0, 7));


  // ── Step 7: Create a commit pointing to the new tree ─────────────────────
  // parents: [currentCommitSha] links this into the branch history.
  // Without a parent, this would be a detached root commit — repo would break.
  logProgress('📝 [Step 7] Creating commit...');

  const newCommitResponse = UrlFetchApp.fetch(`${BASE_URL}/git/commits`, {
    method: 'POST',
    headers: headers,
    contentType: 'application/json',
    payload: JSON.stringify({
      message: CONFIG.COMMIT_MESSAGE + ' (' + filesToSort.length + ' files)',
      tree: newTreeSha,
      parents: [currentCommitSha]
    }),
    muteHttpExceptions: true
  });

  if (newCommitResponse.getResponseCode() !== 201) {
    throw new Error(`[Step 7] Failed to create commit: HTTP ${newCommitResponse.getResponseCode()} — ${newCommitResponse.getContentText()}`);
  }
  const newCommitSha = JSON.parse(newCommitResponse.getContentText()).sha;
  logProgress('  📌 New commit: ' + newCommitSha.slice(0, 7));


  // ── Step 8: Move the branch pointer to the new commit ───────────────────
  // This is the only step that changes the repo visibly.
  // If Steps 1–7 succeeded but this fails, the commit exists in GitHub's
  // object store but the branch still points to the old commit — repo is safe.
  // Simply retry the full sync to recover.
  logProgress('🔗 [Step 8] Updating branch ref...');

  const updateRefResponse = UrlFetchApp.fetch(
    `${BASE_URL}/git/refs/heads/${CONFIG.GITHUB_BRANCH}`,
    {
      method: 'PATCH',
      headers: headers,
      contentType: 'application/json',
      payload: JSON.stringify({ sha: newCommitSha }),
      muteHttpExceptions: true
    }
  );

  if (updateRefResponse.getResponseCode() !== 200) {
    throw new Error(`[Step 8] Failed to update branch ref: HTTP ${updateRefResponse.getResponseCode()} — ${updateRefResponse.getContentText()}`);
  }

  return '✅ Sync complete. Mirrored ' + filesToSort.length + ' files in 1 commit to ' + CONFIG.GITHUB_REPO + '/' + CONFIG.REPO_PATH;
}
