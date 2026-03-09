
# JAKIM Hijri ICS Calendar Generator

[**Bahasa Melayu**](#bahasa-melayu) | [**English**](#english)

---

<a name="bahasa-melayu"></a>
## 🇲🇾 Bahasa Melayu
Projek automatik sepenuhnya yang mengambil data Takwim Hijri rasmi daripada **e-Solat (JAKIM)** Malaysia dan menjana fail `.ics` untuk kalendar digital anda.

### 👥 Cara Melanggan
1. Buka **Google Calendar** di komputer.
2. Klik **"+"** bersebelahan **"Other calendars"** > **"From URL"**.
3. Tampalkan pautan ini: `https://raw.githubusercontent.com/multimedia-mamtj6/dev/main/calendar/hijri/ics/jakim_hijri.ics`
4. Klik **Add calendar**.

### 🛠 Untuk Pembangun & Penyelenggaraan
Sila rujuk bahagian "English" di bawah untuk arahan teknikal (format adalah sama).

---

<a name="english"></a>
## 🇬🇧 English
A fully automated, open-source project that fetches the official Takwim Hijri data from Malaysia's **e-Solat (JAKIM)** and generates a downloadable `.ics` file for your digital calendar.

### 👥 How to Subscribe
1. Open **Google Calendar** on a computer.
2. Click the **"+"** button next to **"Other calendars"** > **"From URL"**.
3. Paste the following link: `https://raw.githubusercontent.com/multimedia-mamtj6/dev/main/calendar/hijri/ics/jakim_hijri.ics`
4. Click **Add calendar**.

### 🛠 For Developers
*   **Prerequisites:** Python 3.x and `pip install requests`.
*   **Running Locally:** Navigate to `calendar/hijri/ics/` and run `python generate_ics.py`.
*   **Customization:** Edit the `summary` or `DESCRIPTION` in the Python script to change how events appear.

### ⚙️ Maintenance & Automation
*   **Automation:** The script runs via GitHub Actions on the 1st of every month.
*   **Bot Permissions:** If the build fails with a 403 error, go to *Settings > Actions > General > Workflow permissions* and set to **"Read and write permissions"**.

---

## ⚖️ License
Open-source. Data sourced from e-Solat (JAKIM) and `api.waktusolat.app`.

*Dicipta oleh / Created by Admin MAMTJ6*



