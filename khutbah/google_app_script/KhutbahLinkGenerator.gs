/**
 * Main function to generate the khutbah link for the upcoming Friday.
 */
function generateKhutbahLink() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("link extractor");
  if (!sheet) {
    console.error("Sheet 'link extractor' not found.");
    return;
  }

  // Get the next Friday's date
  const nextFriday = getNextFriday();
  const gregorianDate = formatGregorianDate(nextFriday);
  console.log("Generated Gregorian Date: " + gregorianDate);

  // Convert Gregorian date to Hijri date using the new method
  const hijriDate = getHijriDate(nextFriday);
  if (!hijriDate) {
    console.error("Failed to retrieve Hijri date.");
    return;
  }
  console.log("Generated Hijri Date: " + hijriDate);

  // Generate the final link in the specified format
  const year = nextFriday.getFullYear();
  const finalLink = `https://mufti.pahang.gov.my/khutbah/${year}/${gregorianDate}m-${hijriDate}h`;
  console.log("Final Generated Link: " + finalLink);

  // Insert the link into cell A2
  sheet.getRange("A2").setValue(finalLink);
  console.log("Link inserted successfully into cell A2.");

  // Call extractKhutbahData after inserting the link
  extractKhutbahData();
}

/**
 * Calculates the date of the next Friday.
 * If today is Friday, it returns today's date.
 */
function getNextFriday() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 5 = Friday
  
  if (dayOfWeek === 5) {
    return today;
  }
  
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + daysUntilFriday);
  return nextFriday;
}

/**
 * Formats a Gregorian date into "dd-monthname-yyyy" format.
 * @param {Date} date The date to format.
 * @return {string} The formatted date string.
 */
function formatGregorianDate(date) {
  const months = [
    "januari", "februari", "mac", "april", "mei", "jun",
    "julai", "ogos", "september", "oktober", "november", "desember"
  ];
  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * [MODIFIED FUNCTION]
 * Fetches Hijri date from api.waktusolat.app by providing a Gregorian date.
 * @param {Date} gregorianDate The Gregorian date to be converted.
 * @return {string|null} The formatted Hijri date string or null on error.
 */
function getHijriDate(gregorianDate) {
  // Using the API from the Waktu Solat Widget. PHG03 is the zone for Temerloh.
  const apiUrl = "https://api.waktusolat.app/v2/solat/PHG03";
  console.log("API Request URL: " + apiUrl);

  try {
    const response = UrlFetchApp.fetch(apiUrl);
    const data = JSON.parse(response.getContentText());

    if (!data.prayers) {
      throw new Error("Invalid API response: 'prayers' array not found.");
    }

    // Find the prayer data for the specific Gregorian date
    const dayToFind = gregorianDate.getDate();
    const todayPrayer = data.prayers.find(prayer => prayer.day === dayToFind);

    if (!todayPrayer) {
      throw new Error(`Could not find data for day ${dayToFind} in the API response.`);
    }

    const hijriDateString = todayPrayer.hijri; // e.g., "1447-04-04"
    const [hijriYear, hijriMonth, hijriDay] = hijriDateString.split("-");

    const hijriMonths = [
      "muharram", "safar", "rabiulawal", "rabiulakhir", "jamadilawal", "jamadilakhir",
      "rejab", "syaaban", "ramadan", "syawal", "zulkaedah", "zulhijjah"
    ];
    
    // The month number is 1-based, array is 0-based
    const hijriMonthName = hijriMonths[parseInt(hijriMonth, 10) - 1];

    // Pad Hijri day with a leading zero if needed
    const paddedHijriDay = String(parseInt(hijriDay, 10)).padStart(2, "0");

    return `${paddedHijriDay}-${hijriMonthName}-${hijriYear}`;
    
  } catch (error) {
    console.error("Error fetching Hijri date: " + error.toString());
    return null;
  }
}


// --- FUNCTIONS BELOW REMAIN UNCHANGED ---

/**
 * Schedules the script to run automatically.
 */
function scheduleScript() {
  // Deletes any existing triggers to avoid duplicates
  const allTriggers = ScriptApp.getProjectTriggers();
  for (const trigger of allTriggers) {
    if (trigger.getHandlerFunction() === "generateKhutbahLink") {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  
  // Creates a new trigger to run every Monday
  ScriptApp.newTrigger("generateKhutbahLink")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9) // Adjust the time as needed
    .create();
}

/**
 * Generates a khutbah link for the previous Friday.
 */
function getPastWeekKhutbahLink() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("link extractor");
  if (!sheet) {
    console.error("Sheet 'link extractor' not found.");
    return;
  }

  const pastFriday = getPreviousFriday();
  const gregorianDate = formatGregorianDate(pastFriday);
  console.log("Generated Gregorian Date (Past): " + gregorianDate);

  const hijriDate = getHijriDate(pastFriday);
  if (!hijriDate) {
    console.error("Failed to retrieve Hijri date for past Friday.");
    return;
  }
  console.log("Generated Hijri Date (Past): " + hijriDate);

  const year = pastFriday.getFullYear();
  // Note: The URL structure for past khutbahs might be different. 
  // This assumes the same structure.
  const finalLink = `https://mufti.pahang.gov.my/khutbah/${year}/${gregorianDate}m-${hijriDate}h`;
  console.log("Final Generated Link (Past): " + finalLink);

  sheet.getRange("A4").setValue(finalLink);
  console.log("Past link inserted successfully into cell A4.");
}

/**
 * Calculates the date of the previous Friday.
 */
function getPreviousFriday() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  
  if (dayOfWeek === 5) {
    const lastFriday = new Date(today);
    lastFriday.setDate(today.getDate() - 7);
    return lastFriday;
  }
  
  const daysSinceLastFriday = (dayOfWeek + 2) % 7;
  const pastFriday = new Date(today);
  pastFriday.setDate(today.getDate() - daysSinceLastFriday);
  return pastFriday;
}

/**
 * Placeholder function call. Assumes this function exists in another script file.
 */
function extractKhutbahData() {
  // This function is defined in your "get tajuk khutbah.gs" file.
  // No implementation is needed here.
  console.log("Calling extractKhutbahData()...");
}