import requests
from datetime import datetime, timedelta
import os

# 1. Dictionary to translate Hijri month numbers to names
HIJRI_MONTHS = {
    "01": "Muharram", "02": "Safar", "03": "Rabiulawal", "04": "Rabiulakhir",
    "05": "Jamadilawal", "06": "Jamadilakhir", "07": "Rejab", "08": "Syaaban",
    "09": "Ramadhan", "10": "Syawal", "11": "Zulkaedah", "12": "Zulhijjah"
}

def fetch_jakim_data():
    # We use WLY01 (Kuala Lumpur) as the standard reference for Malaysia's Takwim
    url = "https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=year&zone=WLY01"
    
    # Adding a User-Agent so the API doesn't block our automated request
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    print("Fetching data from JAKIM e-Solat API...")
    response = requests.get(url, headers=headers)
    response.raise_for_status() # Will raise an error if the website is down
    return response.json()

def generate_calendar():
    data = fetch_jakim_data()
    
    # 2. Setup the main ICS Calendar headers
    ics_lines =[
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//My Custom JAKIM Calendar//MY",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Takwim Hijri JAKIM", # The name that will appear in Google Calendar
        "X-WR-TIMEZONE:Asia/Kuala_Lumpur"
    ]

    print("Processing dates...")
    
    # 3. Loop through every day of the year from the API
    for day in data.get('prayerTime',[]):
        # API Gregorian format: "09-Mar-2026"
        gregorian_date = datetime.strptime(day['date'], "%d-%b-%Y")
        
        # All-day events in ICS format require the End Date to be the *next* day
        next_day = gregorian_date + timedelta(days=1)
        
        dtstart = gregorian_date.strftime("%Y%m%d")
        dtend = next_day.strftime("%Y%m%d")
        
        # API Hijri format: "1447-09-19"
        hijri_raw = day['hijri'] 
        parts = hijri_raw.split('-')
        
        # Format the title nicely (e.g., "19 Ramadhan 1447H")
        if len(parts) == 3:
            h_year, h_month, h_day = parts
            month_name = HIJRI_MONTHS.get(h_month, h_month)
            # int(h_day) removes leading zeros (e.g., "09" becomes "9")
            summary = f"{int(h_day)} {month_name} {h_year}H"
        else:
            # Fallback just in case JAKIM changes their format
            summary = f"{hijri_raw}H"

        # 4. Add the daily event
        ics_lines.extend([
            "BEGIN:VEVENT",
            f"DTSTART;VALUE=DATE:{dtstart}",
            f"DTEND;VALUE=DATE:{dtend}",
            f"SUMMARY:{summary}",
            "TRANSP:TRANSPARENT", # Crucial: Ensures it shows as "Free" not "Busy"
            f"UID:jakim-hijri-{dtstart}@github.com", # Must be a unique ID
            "END:VEVENT"
        ])

    # Close the calendar tag
    ics_lines.append("END:VCALENDAR")

    # 5. Save the file
    # We ensure the folder exists (GitHub Actions runs from the root repo folder)
    os.makedirs("calendar/hijri/ics", exist_ok=True)
    output_path = "calendar/hijri/ics/jakim_hijri.ics"
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(ics_lines))

    print(f"Success! Calendar saved to {output_path}")

if __name__ == "__main__":
    generate_calendar()
