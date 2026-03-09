import requests
from datetime import datetime, timedelta

# 1. Fetch data from JAKIM API (Yearly data for KL zone)
url = "https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=year&zone=WLY01"
response = requests.get(url)
data = response.json()

# 2. Setup the ICS header
ics_lines =[
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//My JAKIM Hijri Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:JAKIM Hijri Daily", # Calendar Name
    "X-WR-TIMEZONE:Asia/Kuala_Lumpur"
]

# 3. Loop through the API response
for day in data.get('prayerTime',[]):
    # JAKIM Date format: "09-Mar-2026"
    gregorian_date = datetime.strptime(day['date'], "%d-%b-%Y")
    
    # Next day for DTEND (All-day events require DTEND to be the next day)
    next_day = gregorian_date + timedelta(days=1)
    
    dtstart = gregorian_date.strftime("%Y%m%d")
    dtend = next_day.strftime("%Y%m%d")
    
    # JAKIM Hijri format varies, usually "1447-09-19"
    hijri_raw = day['hijri'] 
    
    # Add the event to ICS
    ics_lines.extend([
        "BEGIN:VEVENT",
        f"DTSTART;VALUE=DATE:{dtstart}",
        f"DTEND;VALUE=DATE:{dtend}",
        f"SUMMARY:{hijri_raw}H", # You can parse this to say "19 Ramadhan 1447H"
        "STATUS:CONFIRMED",
        f"UID:{dtstart}@yourdomain.com", # Unique ID for the event
        "END:VEVENT"
    ])

# 4. Close the calendar
ics_lines.append("END:VCALENDAR")

# 5. Write to a file
with open("jakim_hijri.ics", "w") as f:
    f.write("\n".join(ics_lines))

print("jakim_hijri.ics successfully generated!")
