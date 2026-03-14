import requests
from datetime import datetime, timedelta
import os

# Dictionary to translate Hijri month numbers to exact Malay names
HIJRI_MONTHS = {
    "01": "Muharram", "02": "Safar", "03": "Rabiulawal", "04": "Rabiulakhir",
    "05": "Jamadilawal", "06": "Jamadilakhir", "07": "Rejab", "08": "Syaaban",
    "09": "Ramadhan", "10": "Syawal", "11": "Zulkaedah", "12": "Zulhijjah"
}

def fetch_waktusolat_data():
    # Fetch data for this year AND next year so your calendar always has future dates
    current_year = datetime.now().year
    years_to_fetch =[current_year, current_year + 1]
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    all_prayer_times =[]
    
    for year in years_to_fetch:
        print(f"Fetching data from api.waktusolat.app for the year {year}...")
        
        # We loop through all 12 months to guarantee we securely get the full year's data
        for month in range(1, 13):
            # Using the V1 endpoint which perfectly mimics JAKIM's data structure
            url = f"https://api.waktusolat.app/solat/WLY01?year={year}&month={month}"
            
            try:
                response = requests.get(url, headers=headers, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    if 'prayerTime' in data:
                        all_prayer_times.extend(data['prayerTime'])
            except requests.exceptions.RequestException as e:
                print(f"Failed to fetch data for {year}-{month}: {e}")
                
    return all_prayer_times

def generate_calendar():
    prayer_times = fetch_waktusolat_data()
    
    if not prayer_times:
        print("Error: No data fetched from API.")
        return
        
    # Setup the main ICS Calendar headers
    ics_lines =[
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//My Custom JAKIM Calendar//MY",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Takwim Hijri JAKIM", 
        "X-WR-TIMEZONE:Asia/Kuala_Lumpur"
    ]

    print(f"Processing {len(prayer_times)} days of data into ICS format...")
    
    for day in prayer_times:
        # Flexible date parsing: Handles both JAKIM's 'dd-MMM-yyyy' and standard 'YYYY-MM-DD'
        try:
            gregorian_date = datetime.strptime(day['date'], "%d-%b-%Y")
        except ValueError:
            gregorian_date = datetime.strptime(day['date'], "%Y-%m-%d")
            
        next_day = gregorian_date + timedelta(days=1)
        
        dtstart = gregorian_date.strftime("%Y%m%d")
        dtend = next_day.strftime("%Y%m%d")
        
        hijri_raw = day['hijri'] 
        parts = hijri_raw.split('-')
        
        if len(parts) == 3:
            h_year, h_month, h_day = parts
            month_name = HIJRI_MONTHS.get(h_month, h_month)
            summary = f"{int(h_day)} {month_name} {h_year}H"
        else:
            summary = f"{hijri_raw}H"

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

    # Save the file
    os.makedirs("calendar/hijri/ics", exist_ok=True)
    output_path = "calendar/hijri/ics/jakim_hijri.ics"
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(ics_lines))

    print(f"Success! Calendar saved to {output_path}")

if __name__ == "__main__":
    generate_calendar()
