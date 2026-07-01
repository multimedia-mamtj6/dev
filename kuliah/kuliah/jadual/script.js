/* =========================================================
   Masjid Al-Mukhlisin — Jadual Kuliah Maghrib & Subuh
   Vanilla JS (ES6+). Renders desktop table for browser + Xibo.
   ========================================================= */

/* ---------------------------------------------------------
   Embedded sample data (July 2026).
   Used as a fallback when the live JSON endpoint is
   unreachable (e.g. local preview / offline signage boot).
   --------------------------------------------------------- */
const EMBEDDED_DATA = {
    "infoJadual": {
        "tajukBulan": "BULAN JULAI 2026",
        "tarikhKemasKini": "*Dikemaskini oleh Biro Dakwah pada 29/6/2026"
    },
    "senaraiHari": [
        { "date": "2026-07-01", "subuh": null, "maghrib": { "nama_penceramah": "Ustaz Hairul Azam", "tajuk_kuliah": "Tadabbur ayat-ayat Surah Al-Baqarah", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-02", "subuh": null, "maghrib": { "nama_penceramah": "Ustaz Mohd Firdaus Azmy", "tajuk_kuliah": "Tadabbur ayat-ayat Surah Al-Anfal", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-03", "subuh": null, "maghrib": { "nama_penceramah": "Ustaz Nazir", "tajuk_kuliah": "Mukhtasar Tanbih Al-Ghafilin", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-04", "subuh": { "nama_penceramah": "Ustaz Badrul Hisham", "tajuk_kuliah": "Fadilat Sedekah", "poster_url": "" }, "maghrib": null, "cuti_umum": null },
        { "date": "2026-07-05", "subuh": { "nama_penceramah": "Ustaz Badrul Hisham", "tajuk_kuliah": "Fadilat Sedekah", "poster_url": "" }, "maghrib": { "nama_penceramah": "Ustaz Amir", "tajuk_kuliah": "Kitab Fekah: Syarah Safinah An-Naja", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-06", "subuh": null, "maghrib": { "nama_penceramah": "Ustaz Hisyamuddin", "tajuk_kuliah": "Nasihat Agama dan Wasiat Iman", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-07", "subuh": null, "maghrib": { "nama_penceramah": "Ustaz Shahruwardi", "tajuk_kuliah": "Tuhfah Ar-Raghibin", "poster_url": "" }, "cuti_umum": "Hari Kebangsaan" },
        { "date": "2026-07-08", "subuh": null, "maghrib": { "nama_penceramah": "YAA Dato' Sri Haji Abdul Rahman", "tajuk_kuliah": "Fekah Kesihatan Dalam Ibadah Dan Sunnah Nabi", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-09", "subuh": null, "maghrib": { "nama_penceramah": "Bacaan Yasiin & Tahlil", "tajuk_kuliah": "-", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-10", "subuh": null, "maghrib": { "nama_penceramah": "Ustaz Muhammad Fathmi", "tajuk_kuliah": "Syarah Hadis 40 Imam Nawawi", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-11", "subuh": { "nama_penceramah": "Ustaz Badrul Hisham", "tajuk_kuliah": "Fadilat Sedekah", "poster_url": "" }, "maghrib": { "nama_penceramah": "Ustaz Nawawi", "tajuk_kuliah": "Ringkasan Riyadhus Solihin", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-12", "subuh": { "nama_penceramah": "Ustaz Badrul Hisham", "tajuk_kuliah": "Fadilat Sedekah", "poster_url": "" }, "maghrib": { "nama_penceramah": "Ustaz Amir", "tajuk_kuliah": "Kitab Fekah: Syarah Safinah An-Naja", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-13", "subuh": null, "maghrib": { "nama_penceramah": "Ustaz Hisyamuddin", "tajuk_kuliah": "Nasihat Agama dan Wasiat Iman", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-14", "subuh": null, "maghrib": { "nama_penceramah": "Ustaz Ahmad Termizi", "tajuk_kuliah": "Sesi Tajwid & Talaqqi Al-Quran", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-15", "subuh": null, "maghrib": { "nama_penceramah": "Ustaz Mohd Firdaus Azmy", "tajuk_kuliah": "Tadabbur ayat-ayat Surah Al-Anfal", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-16", "subuh": null, "maghrib": { "nama_penceramah": "Ustaz Nazir", "tajuk_kuliah": "Mukhtasar Tanbih Al-Ghafilin", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-17", "subuh": null, "maghrib": { "nama_penceramah": "Ustaz Muhammad Fathmi", "tajuk_kuliah": "Syarah Hadis 40 Imam Nawawi", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-18", "subuh": { "nama_penceramah": "Ustaz Abd Maarof", "tajuk_kuliah": "Penawar Hati", "poster_url": "" }, "maghrib": { "nama_penceramah": "Ustaz Nawawi", "tajuk_kuliah": "Ringkasan Riyadhus Solihin", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-19", "subuh": { "nama_penceramah": "Ustaz Badrul Hisham", "tajuk_kuliah": "Fadilat Sedekah", "poster_url": "" }, "maghrib": { "nama_penceramah": "Ustaz Amir", "tajuk_kuliah": "Kitab Fekah: Syarah Safinah An-Naja", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-21", "subuh": null, "maghrib": null, "cuti_umum": null },
        { "date": "2026-07-23", "subuh": null, "maghrib": { "nama_penceramah": "Bacaan Yasiin & Tahlil", "tajuk_kuliah": "-", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-25", "subuh": { "nama_penceramah": "Ustaz Abd Maarof", "tajuk_kuliah": "Penawar Hati", "poster_url": "" }, "maghrib": { "nama_penceramah": "Ustaz Nawawi", "tajuk_kuliah": "Ringkasan Riyadhus Solihin", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-26", "subuh": { "nama_penceramah": "Ustaz Badrul Hisham", "tajuk_kuliah": "Fadilat Sedekah", "poster_url": "" }, "maghrib": null, "cuti_umum": null },
        { "date": "2026-07-30", "subuh": null, "maghrib": { "nama_penceramah": "Tuan Haji Hazarudin", "tajuk_kuliah": "Terjemahan Inti Sari Matan Al-Zubad", "poster_url": "" }, "cuti_umum": null },
        { "date": "2026-07-31", "subuh": null, "maghrib": { "nama_penceramah": "Ustaz Anuar Suhaimi", "tajuk_kuliah": "132 Langkah Penyucian Jiwa", "poster_url": "" }, "cuti_umum": null }
    ]
};

const DAY_NAMES = ['AHAD', 'ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT', 'SABTU'];

/* ---------------------------------------------------------
   Helpers
   --------------------------------------------------------- */
function pad2(n) {
    return String(n).padStart(2, '0');
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ---------------------------------------------------------
   Data fetch
   --------------------------------------------------------- */
async function fetchScheduleData() {
    try {
        const response = await fetch(`/kuliah/data/jadual_lengkap.json?v=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (err) {
        console.warn('Live JSON unavailable, using embedded data.', err);
        return EMBEDDED_DATA;
    }
}

/* ---------------------------------------------------------
   Lecture block builders (return HTML strings)
   --------------------------------------------------------- */
function createLectureBlock(type, sessionData) {
    // Special case — Bacaan Yasiin & Tahlil
    if (sessionData.nama_penceramah && sessionData.nama_penceramah.indexOf('Yasiin') !== -1) {
        return `<div class="lecture-block yasin-block">
                    <div class="arabic-text" lang="ar" dir="rtl">باچاءن يسٓ دان تهليل</div>
                    <div class="yasin-title">BACAAN YASIIN &amp; TAHLIL</div>
                </div>`;
    }

    const label = type === 'subuh' ? 'Subuh' : 'Maghrib';
    return `<div class="lecture-block">
                <div class="lecture-time ${type}">${label}</div>
                <div class="ustaz-name">${escapeHtml(sessionData.nama_penceramah)}</div>
                <div class="lecture-title">${escapeHtml(sessionData.tajuk_kuliah)}</div>
            </div>`;
}

function createEmptyLectureBlock() {
    return `<div class="lecture-block is-weekend-empty">
                <div class="empty-slot-text">Slot Kosong</div>
            </div>`;
}

/* ---------------------------------------------------------
   Single day cell builder (returns HTML string)
   --------------------------------------------------------- */
function buildDayCell(dayNumber, year, month, dataByDate, todayString) {
    // No day → padding cell
    if (!dayNumber) {
        return '<td class="day-cell empty-cell"></td>';
    }

    const dateObj = new Date(year, month, dayNumber);   // day-of-week detection
    const dayOfWeek = dateObj.getDay();                 // 0 = Sun, 6 = Sat
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const dateString = `${year}-${pad2(month + 1)}-${pad2(dayNumber)}`;
    const entry = dataByDate[dateString];

    let cellClass = 'day-cell';
    if (dateString === todayString) {
        cellClass += ' is-today';
    }

    // STATE 5 — no JSON entry for this date
    if (!entry) {
        return `<td class="${cellClass}">
                    <div class="date-number">${dayNumber}</div>
                    <div class="lecture-content"></div>
                </td>`;
    }

    // Layer 1 — date number
    let inner = `<div class="date-number">${dayNumber}</div>`;

    // Layer 2 — holiday header (STATE 3)
    if (entry.cuti_umum) {
        inner += `<div class="date-header">
                      <span class="holiday-label">🌙 ${escapeHtml(entry.cuti_umum)}</span>
                  </div>`;
    }

    // Layer 3 — lecture content
    const subuh = entry.subuh;
    const maghrib = entry.maghrib;

    // STATE 4 — full-day empty
    if (!subuh && !maghrib) {
        cellClass += ' empty-cell';
        return `<td class="${cellClass}">
                    ${inner}
                    <div class="lecture-content is-empty-slot">
                        <div class="empty-slot-text">Slot Kosong</div>
                    </div>
                </td>`;
    }

    // STATE 1 — normal day (one or both sessions)
    let blocks = '';

    // Subuh
    if (subuh) {
        blocks += createLectureBlock('subuh', subuh);
    } else if (isWeekend) {
        blocks += createEmptyLectureBlock();
    }

    // Maghrib
    if (maghrib) {
        blocks += createLectureBlock('maghrib', maghrib);
    } else if (isWeekend) {
        blocks += createEmptyLectureBlock();
    }

    inner += `<div class="lecture-content">${blocks}</div>`;

    return `<td class="${cellClass}">${inner}</td>`;
}

/* ---------------------------------------------------------
   Week label cell (stacked characters — Xibo-safe, no rotation)
   --------------------------------------------------------- */
function buildWeekLabelCell(weekNumber) {
    const chars = ['M', 'I', 'N', 'G', 'G', 'U'];
    let spans = chars.map(c => `<span>${c}</span>`).join('');
    spans += '<span>&nbsp;</span>';
    spans += `<span>${weekNumber}</span>`;
    return `<td class="week-number-cell"><div class="week-label">${spans}</div></td>`;
}

/* ---------------------------------------------------------
   Desktop calendar renderer
   --------------------------------------------------------- */
function renderCalendarDesktop(senaraiHari, targetDate) {
    const tbody = document.getElementById('calendar-body');
    if (!tbody) return;

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun … 6=Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Index data by ISO date string
    const dataByDate = {};
    senaraiHari.forEach(d => { dataByDate[d.date] = d; });

    // Today string (for highlight)
    const today = new Date();
    const todayString = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

    // Build a 35-slot grid; place day 1 at firstDayOfMonth.
    // Overflow beyond 35 wraps back into empty slots of the grid.
    const slots = new Array(35).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
        const idx = (firstDayOfMonth + day - 1) % 35;
        slots[idx] = day;
    }

    let html = '';
    for (let row = 0; row < 5; row++) {
        html += '<tr>';
        html += buildWeekLabelCell(row + 1);
        for (let col = 0; col < 7; col++) {
            const idx = row * 7 + col;
            html += buildDayCell(slots[idx], year, month, dataByDate, todayString);
        }
        html += '</tr>';
    }

    tbody.innerHTML = html;
}

/* ---------------------------------------------------------
   Boot
   --------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
    // 1. URL params
    const urlParams = new URLSearchParams(window.location.search);

    const baseDate = new Date();
    if (urlParams.get('bulan') === 'depan') {
        baseDate.setMonth(baseDate.getMonth() + 1);
    }

    // 2. Fetch JSON (cache-busted, with embedded fallback)
    const jsonData = await fetchScheduleData();

    // 3. Footer update info
    const updateInfoEl = document.getElementById('update-info');
    if (updateInfoEl && jsonData.infoJadual) {
        updateInfoEl.textContent = jsonData.infoJadual.tarikhKemasKini || '';
    }

    // 4. Schedule title
    const titleEl = document.getElementById('schedule-title');
    if (titleEl && jsonData.infoJadual) {
        titleEl.textContent = jsonData.infoJadual.tajukBulan || '';
    }

    // 5. Render desktop calendar
    renderCalendarDesktop(jsonData.senaraiHari, baseDate);

    // 6. Auto-print for PDF context
    if (urlParams.get('file') === 'pdf') {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(() => { window.print(); }, 250);
            });
        });
    }
});
