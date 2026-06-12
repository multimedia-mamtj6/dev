function createTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('onEditTrigger')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
}

function onEditTrigger(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]; // 1st sheet
  var range = e.range;

  // Check if the edited cell is A2
  if (range.getA1Notation() === "A2" && range.getSheet().getName() === sheet.getName()) {
    extractKhutbahData();
  }
}

// Converts an h1's inner HTML (which may contain <br /> line breaks) into
// a single-line, trimmed text string, e.g.
// "Puasa Sunat Bulan Muharam<br />(Tasua' dan Asyura)" -> "Puasa Sunat Bulan Muharam (Tasua' dan Asyura)"
function cleanTitleHtml(innerHtml) {
  return innerHtml
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKhutbahData() {
  Logger.log("Starting extraction...");
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]; // 1st sheet
  var linkCell = sheet.getRange("A2");
  var dateCell = sheet.getRange("C2");
  var titleCell = sheet.getRange("D2");

  var url = linkCell.getValue();
  
  // Log initial values
  Logger.log("URL in A2: " + url);
  
  if (!url) {
    var errorMsg = "ERROR: No URL provided";
    dateCell.setValue(errorMsg);
    titleCell.setValue(errorMsg);
    Logger.log(errorMsg);
    return;
  }

  try {
    Logger.log("Fetching URL: " + url);
    var response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    var responseCode = response.getResponseCode();
    Logger.log("HTTP Response Code: " + responseCode);
    
    if (responseCode !== 200) {
      throw new Error("Failed to fetch the webpage. Status: " + responseCode);
    }

    var html = response.getContentText();
    Logger.log("Successfully retrieved HTML content");
    
    // Fixed regex patterns based on the provided HTML structure
    // Look for the calendar icon followed by the date span
    var dateRegex = /<span class="el-image" uk-icon="icon:\s*calendar[^"]*"><\/span>\s*<span class="uk-text-middle uk-margin-remove-last-child">([^<]+)<\/span>/;
    
    // More flexible title regex to handle attributes, whitespace, and <br /> line breaks
    var titleRegex = /<h1 class="uk-h2 uk-heading-divider uk-margin-small"[^>]*>([\s\S]*?)<\/h1>/;
    
    var dateMatch = html.match(dateRegex);
    var titleMatch = html.match(titleRegex);
    
    Logger.log("Date match found: " + !!dateMatch);
    Logger.log("Title match found: " + !!titleMatch);
    
    var dateText = "ERROR: Could not extract date";
    if (dateMatch) {
      dateText = dateMatch[1].trim();
      Logger.log("Extracted date: " + dateText);
    } else {
      Logger.log("No date match found - trying alternative pattern");
      // Alternative pattern in case the structure is slightly different
      var altDateRegex = /uk-icon="icon:\s*calendar[^"]*"[^>]*>\s*<\/span>\s*<span[^>]*>([^<]+)<\/span>/;
      var altDateMatch = html.match(altDateRegex);
      if (altDateMatch) {
        dateText = altDateMatch[1].trim();
        Logger.log("Extracted date (alternative): " + dateText);
      }
    }

    var titleText = "ERROR: Could not extract title";
    if (titleMatch) {
      titleText = cleanTitleHtml(titleMatch[1]);
      Logger.log("Extracted title: " + titleText);
    } else {
      Logger.log("No title match found - trying alternative pattern");
      // Alternative pattern for title
      var altTitleRegex = /<h1[^>]*uk-h2[^>]*>([\s\S]*?)<\/h1>/;
      var altTitleMatch = html.match(altTitleRegex);
      if (altTitleMatch) {
        titleText = cleanTitleHtml(altTitleMatch[1]);
        Logger.log("Extracted title (alternative): " + titleText);
      }
    }

    dateCell.setValue(dateText);
    titleCell.setValue(titleText);
    Logger.log("Data extraction completed successfully");
    
  } catch (e) {
    var errorMsg = "ERROR: " + e.message;
    dateCell.setValue(errorMsg);
    titleCell.setValue(errorMsg);
    Logger.log("Extraction failed: " + e);
  }
}