/**
 * Asma-ul-Husna: Google Sheet -> GitHub JSON sync
 *
 * Reads the main data table (svg_link, name_latin, arabic, translation,
 * explaination), applies the same cleanup used for the original hand-built
 * import (splits "N. Name" into index/latin, strips the arabic column's
 * wrapping parentheses, strips stray soft-hyphen characters), then pushes
 * csr/asma-ul-husna/data/names.json to GitHub.
 *
 * NOT deployed from this repo. Copy-paste this file into the Apps Script
 * editor bound to the Google Sheet (Extensions > Apps Script), same as
 * kuliah/gscript/ — see that folder's CLAUDE.md for the general pattern.
 *
 * --- SETUP (one-time) ---
 * 1. Bind this script to the Google Sheet (Extensions > Apps Script), paste
 *    this file in as Code.gs, save.
 * 2. Update DATA_SHEET_NAME below to match the actual tab name holding the
 *    main 99-row table (svg_link/name_latin/arabic/translation/explaination
 *    columns) — not the reference-transliteration or concatenated-string
 *    tabs, if this spreadsheet still has those as separate tabs.
 * 3. Project Settings (gear icon) > Script Properties > add:
 *      GITHUB_USERNAME = multimedia-mamtj6
 *      GITHUB_REPO     = dev
 *      GITHUB_TOKEN    = <a GitHub PAT with contents:write on that repo>
 *    Do NOT put the token anywhere in this file or in the sheet itself —
 *    Script Properties is the only place it should live. This repo has a
 *    documented incident of a real token committed in plain text
 *    (kuliah3/kuliah(beta)/jadual/), don't repeat that here.
 * 4. Reload the spreadsheet — a new "📤 Asma-ul-Husna" menu appears.
 * 5. Use "Publish to Website" whenever the sheet data is ready to go live.
 */

const SCRIPT_PROP_KEYS = {
  username: 'GITHUB_USERNAME', // multimedia-mamtj6
  repo: 'GITHUB_REPO',         // dev
  token: 'GITHUB_TOKEN'        // GitHub PAT with contents:write on multimedia-mamtj6/dev
};

const GITHUB_FILE_PATH = 'csr/asma-ul-husna/data/names.json';
const GITHUB_BRANCH = 'main';
const DATA_SHEET_NAME = 'DATA'; // <-- CONFIRM this matches the actual tab name
const EXPECTED_COUNT = 99;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📤 Asma-ul-Husna')
    .addItem('Publish to Website', 'publishToGithub_fromMenu')
    .addToUi();
}

function publishToGithub_fromMenu() {
  try {
    const result = publishToGithub();
    Logger.log('SUCCESS: ' + result);
    Browser.msgBox('Success!', result, Browser.Buttons.OK);
  } catch (e) {
    Logger.log('ERROR: ' + e.toString());
    Browser.msgBox('Error', e.message, Browser.Buttons.OK);
  }
}

function stripSoftHyphens_(text) {
  return String(text).replace(/\u00AD/g, '').trim();
}

function stripArabicParens_(text) {
  return String(text).replace(/^\(\s*|\s*\)$/g, '').trim();
}

function parseNameLatin_(raw) {
  const match = String(raw).trim().match(/^(\d+)\.\s*(.+)$/);
  if (!match) throw new Error(`Could not parse a "N. Name" index/name pair from "${raw}"`);
  return { index: parseInt(match[1], 10), latin: match[2].trim() };
}

function svgFilenameFromUrl_(url) {
  const parts = String(url).trim().split('/');
  return parts[parts.length - 1];
}

/**
 * Reads the sheet and returns the cleaned { lastUpdated, names: [...] } object.
 * Throws (rather than silently publishing bad data) if the row count is
 * wrong, indices aren't a clean 1-99 sequence, or a row's svg_link filename
 * number doesn't match that row's own index — this last check exists
 * because that exact mismatch happened once already (see names.json history:
 * row 12/Al-Baari' pointed at a file named "13._Al_Bari.svg").
 */
function buildNamesJson_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
  if (!sheet) throw new Error(`Sheet named "${DATA_SHEET_NAME}" not found. Update DATA_SHEET_NAME at the top of this script.`);

  const data = sheet.getDataRange().getValues();
  const headers = data.shift().map(h => String(h).trim().toLowerCase());

  const svgIndex = headers.indexOf('svg_link');
  const nameIndex = headers.indexOf('name_latin');
  const arabicIndex = headers.indexOf('arabic');
  const meaningIndex = headers.indexOf('translation');
  // Accept both spellings — the original sheet had a typo ("explaination"),
  // a later copy of the sheet fixed it to "explanation". Don't assume either.
  let explanationIndex = headers.indexOf('explanation');
  if (explanationIndex === -1) explanationIndex = headers.indexOf('explaination');

  if ([svgIndex, nameIndex, arabicIndex, meaningIndex, explanationIndex].includes(-1)) {
    throw new Error('One or more required columns (svg_link, name_latin, arabic, translation, explanation/explaination) are missing from the sheet header row.');
  }

  const names = data
    .filter(row => row[nameIndex])
    .map(row => {
      const { index, latin } = parseNameLatin_(row[nameIndex]);
      const svgFile = svgFilenameFromUrl_(row[svgIndex]);

      const svgLeadingNumberMatch = String(svgFile).match(/^\d+/);
      const svgLeadingNumber = svgLeadingNumberMatch ? parseInt(svgLeadingNumberMatch[0], 10) : null;
      if (svgLeadingNumber !== index) {
        throw new Error(`Row ${index} (${latin}): svg_link "${svgFile}" doesn't start with "${index}." — fix the svg_link column (or the actual file's name) before publishing.`);
      }

      return {
        index: index,
        latin: latin,
        arabic: stripArabicParens_(row[arabicIndex]),
        shortMeaning: stripSoftHyphens_(row[meaningIndex]),
        explanation: stripSoftHyphens_(row[explanationIndex]),
        svg: svgFile
      };
    });

  names.sort((a, b) => a.index - b.index);

  const indices = names.map(n => n.index);
  const expected = Array.from({ length: EXPECTED_COUNT }, (_, i) => i + 1);
  if (JSON.stringify(indices) !== JSON.stringify(expected)) {
    throw new Error(`Expected a clean 1-${EXPECTED_COUNT} sequence with no gaps/duplicates, got: ${indices.join(',')}`);
  }

  return {
    lastUpdated: Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd'),
    names: names
  };
}

/**
 * Builds the JSON from the sheet and pushes it to GitHub via the Contents API.
 * @returns {string} Success message shown in the menu's confirmation dialog.
 */
function publishToGithub() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const config = {
    username: scriptProperties.getProperty(SCRIPT_PROP_KEYS.username),
    repo: scriptProperties.getProperty(SCRIPT_PROP_KEYS.repo),
    token: scriptProperties.getProperty(SCRIPT_PROP_KEYS.token)
  };

  if (!config.username || !config.repo || !config.token) {
    throw new Error('Configuration is missing. Set GITHUB_USERNAME, GITHUB_REPO and GITHUB_TOKEN in Project Settings > Script Properties.');
  }

  const jsonData = buildNamesJson_();
  const jsonString = JSON.stringify(jsonData, null, 2);

  const apiUrl = `https://api.github.com/repos/${config.username}/${config.repo}/contents/${GITHUB_FILE_PATH}`;

  const getResponse = UrlFetchApp.fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`, {
    method: 'get',
    headers: { 'Authorization': `token ${config.token}` },
    muteHttpExceptions: true
  });

  let sha = null;
  if (getResponse.getResponseCode() === 200) {
    sha = JSON.parse(getResponse.getContentText()).sha;
  } else if (getResponse.getResponseCode() !== 404) {
    throw new Error(`Failed to check existing file. GitHub API responded with: ${getResponse.getResponseCode()}\n${getResponse.getContentText()}`);
  }

  const payload = {
    message: `[Auto] Update Asma-ul-Husna data from Google Sheets on ${new Date().toISOString()}`,
    // Explicit UTF-8 is required here — without it, Apps Script falls back
    // to an ASCII-only encoding and silently replaces every non-ASCII
    // character (Arabic script, curly apostrophes) with "?" before this
    // ever reaches GitHub. Hit this exact repo's published names.json once already.
    content: Utilities.base64Encode(jsonString, Utilities.Charset.UTF_8),
    branch: GITHUB_BRANCH,
    sha: sha
  };

  const putResponse = UrlFetchApp.fetch(apiUrl, {
    method: 'put',
    headers: { 'Authorization': `token ${config.token}` },
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (putResponse.getResponseCode() === 200 || putResponse.getResponseCode() === 201) {
    return `✅ Success! ${GITHUB_FILE_PATH} has been updated on GitHub (${jsonData.names.length} names).`;
  } else {
    throw new Error(`Failed to update file. GitHub API responded with: ${putResponse.getResponseCode()}\n${putResponse.getContentText()}`);
  }
}
