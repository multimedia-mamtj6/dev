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
    url = "https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=year&zone=WLY01"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    try:
        print("Attempting direct connection to JAKIM e-Solat API...")
        # Added a 10-second timeout so it doesn't get stuck waiting
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status() 
        return response.json()
        
    except requests.exceptions.RequestException as e:
        print("Direct connection failed (Likely geo-blocked by JAKIM firewall).")
        print("Switching to proxy server to bypass the block...")
        
        # We use a free proxy (AllOrigins) to bypass the government IP block.
        # Passing 'url' into 'params' ensures the special characters (&) don't break the link.
        proxy_response = requests.get("https://api.allorigins.win/raw", params={"url": url}, timeout=20)
        proxy_response.raise_for_status()
        return proxy_response.json()

def generate_calendar():
    data = fetch_jakim_data()
    
    # 2. Setup the main ICS Calendar headers
    ics_lines =[
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//My Custom JAKIM Calendar//MY",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Takwim Hijri JAKIM", 
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
            summary = f"{int(h_day)} {month_name} {h_year}H"
        else:
            summary = f"{hijri_raw}H"

        # 4. Add the daily event
        ics_lines.extend([
            "BEGIN:VEVENT",
            f"DTSTART;VALUE=DATE:{dtstart}",
            f"DTEND;VALUE=DATE:{dtend}",
            f"SUMMARY:{summary}",
            "TRANSP:TRANSPARENT", 
            f"UID:jakim-hijri-{dtstart}@github.com",
            "END:VEVENT"
        ])

    ics_lines.append("END:VCALENDAR")

    # 5. Save the file
    os.makedirs("calendar/hijri/ics", exist_ok=True)
    output_path = "calendar/hijri/ics/jakim_hijri.ics"
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(ics_lines))

    print(f"Success! Calendar saved to {output_path}")

if __name__ == "__main__":
    generate_calendar()
