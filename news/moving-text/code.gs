const GITHUB_TOKEN = 'REDACTED';
const REPO_OWNER = 'multimedia-mamtj6';
const REPO_NAME = 'dev';
const FILE_PATH = 'web/asset/moving-text/data-Col1.json'; // The file name in GitHub

/**
 * Mencipta menu khas di dalam Google Sheet apabila fail dibuka.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Alat Khas')
    .addItem('1. Update moving text', 'pushToGitHub')
    .addToUi();
}


function pushToGitHub() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  // 1. Convert Sheet to your SPECIFIC JSON format
  const rows = data.slice(1); // Skip the header row
  
  const formattedData = {
    "moving-text": rows
      .filter(row => row[0] !== "") // Only include rows that aren't empty
      .map(row => {
        return { "Col1": row[0].toString() }; // Force data into "Col1" key
      })
  };
  
  const content = JSON.stringify(formattedData, null, 2);
  const message = "Update ticker: " + new Date().toLocaleString();
  
  // 2. Get the SHA of the existing file
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
  const headers = { "Authorization": "token " + GITHUB_TOKEN };
  
  let sha = "";
  try {
    const response = UrlFetchApp.fetch(url, { "method": "GET", "headers": headers });
    sha = JSON.parse(response.getContentText()).sha;
  } catch (e) {
    Logger.log("File not found, will create a new one.");
  }

  // 3. Push to GitHub
  const payload = {
    "message": message,
    "content": Utilities.base64Encode(Utilities.newBlob(content).getBytes()),
    "sha": sha
  };
  
  const putOptions = {
    "method": "PUT",
    "headers": headers,
    "contentType": "application/json",
    "payload": JSON.stringify(payload)
  };
  
  UrlFetchApp.fetch(url, putOptions);
  SpreadsheetApp.getUi().alert("✅ Data Moving Text telah dikemaskini!");
}