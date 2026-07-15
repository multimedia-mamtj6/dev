/* =========================================================
   Masjid Al-Mukhlisin — Jadual Kuliah Maghrib & Subuh
   Vanilla JS (ES6+). Renders desktop table for browser + Xibo.
   ========================================================= */


const DAY_NAMES = ['AHAD', 'ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT', 'SABTU'];
const MONTH_NAMES = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
    'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];

let cachedSenaraiHari = null;

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
    const response = await fetch(`/kuliah/data/jadual_lengkap_beta.json?v=${new Date().getTime()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

/* ---------------------------------------------------------
   Lecture block builders (return HTML strings)
   --------------------------------------------------------- */
function createLectureBlock(type, sessionData) {
    // Special case — slot reserved but ustaz/topic not decided yet
    if (sessionData.pending) {
        const label = type === 'subuh' ? 'Subuh' : 'Maghrib';
        return `<div class="lecture-block is-pending">
                    <div class="lecture-time ${type}">${label}</div>
                    <div class="pending-label">Ceramah Khas — Akan Diumumkan</div>
                </div>`;
    }

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

function createEmptyLectureBlock(type) {
    const label = type === 'subuh' ? 'Subuh' : 'Maghrib';
    return `<div class="lecture-block is-weekend-empty">
                <div class="lecture-time ${type}">${label}</div>
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
        blocks += createEmptyLectureBlock('subuh');
    }

    // Maghrib
    if (maghrib) {
        blocks += createLectureBlock('maghrib', maghrib);
    } else if (isWeekend) {
        blocks += createEmptyLectureBlock('maghrib');
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
   Mobile lecture block builder (returns HTML string)
   --------------------------------------------------------- */
function createMobileLectureBlock(time, lecture) {
    const badgeClass = time.toLowerCase();
    if (lecture.pending) {
        return `<div class="lecture-block-v2 is-pending">
                    <span class="session-badge ${badgeClass}">${time}</span>
                    <div class="pending-label">Ceramah Khas — Akan Diumumkan</div>
                </div>`;
    }
    if (lecture.nama_penceramah && lecture.nama_penceramah.indexOf('Yasiin') !== -1) {
        return `<div class="lecture-block-v2">
                    <span class="session-badge ${badgeClass}">${time}</span>
                    <div class="lecture-ustaz" lang="ar" dir="rtl" style="font-size:1.1rem;text-align:center;">باچاءن يسٓ دان تهليل</div>
                    <div class="lecture-tajuk">BACAAN YASIIN &amp; TAHLIL</div>
                </div>`;
    }
    return `<div class="lecture-block-v2">
                <span class="session-badge ${badgeClass}">${time}</span>
                <div class="lecture-ustaz">${escapeHtml(lecture.nama_penceramah)}</div>
                <div class="lecture-tajuk">${escapeHtml(lecture.tajuk_kuliah)}</div>
            </div>`;
}

/* ---------------------------------------------------------
   Mobile view — monthly card list
   --------------------------------------------------------- */
async function initializeMobileView(senaraiHari, targetDate, notYetPublished = false) {
    const mobileListContainer = document.getElementById('mobile-card-list');
    if (!mobileListContainer) return;

    if (notYetPublished) {
        mobileListContainer.innerHTML = '<div class="no-kuliah-today">Jadual belum diterbitkan buat masa ini.</div>';
        const todayCard = document.getElementById('today-kuliah-card');
        if (todayCard) todayCard.style.display = 'none';
        return;
    }

    const today = new Date();
    const isCurrentMonth = targetDate.getMonth() === today.getMonth() &&
        targetDate.getFullYear() === today.getFullYear();

    if (isCurrentMonth) {
        await renderTodayCard(senaraiHari);
    } else {
        const todayCard = document.getElementById('today-kuliah-card');
        if (todayCard) todayCard.style.display = 'none';
    }

    const daysInMalay = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
    const monthNames = MONTH_NAMES;
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();

    const days = senaraiHari.filter(d => {
        const date = new Date(d.date + 'T00:00:00');
        return date.getMonth() === targetMonth && date.getFullYear() === targetYear;
    });

    const emptyCards = [];

    days.forEach(dayData => {
        const currentDate = new Date(dayData.date + 'T00:00:00');
        if (isCurrentMonth && currentDate.toDateString() === today.toDateString()) return;

        const isEmpty = !dayData.subuh && !dayData.maghrib;
        const card = document.createElement('div');
        card.className = 'mobile-card-v2' + (dayData.cuti_umum ? ' is-holiday' : '');

        const dayName = daysInMalay[currentDate.getDay()];
        const dateNum = `${currentDate.getDate()} ${monthNames[currentDate.getMonth()]}`;
        const holidayPill = dayData.cuti_umum
            ? `<span class="mobile-holiday-label">${escapeHtml(dayData.cuti_umum)}</span>` : '';

        let bodyHtml = '';
        if (isEmpty) {
            bodyHtml = `<div class="empty-slot-v2">Tiada kuliah</div>`;
        } else {
            if (dayData.subuh) bodyHtml += createMobileLectureBlock('Subuh', dayData.subuh);
            if (dayData.maghrib) bodyHtml += createMobileLectureBlock('Maghrib', dayData.maghrib);
        }

        card.innerHTML = `
            <div class="card-date-header-v2">
                <span class="card-day-label">${dayName}${holidayPill}</span>
                <span class="card-date-number">${dateNum}</span>
            </div>
            <div class="card-body-v2">${bodyHtml}</div>`;

        if (isEmpty) {
            emptyCards.push(card);
        } else {
            mobileListContainer.appendChild(card);
        }
    });

    if (emptyCards.length > 0) {
        const toggle = document.createElement('button');
        toggle.className = 'show-empty-toggle';
        toggle.textContent = `Tunjuk ${emptyCards.length} hari tiada kuliah ▾`;
        toggle.addEventListener('click', () => {
            emptyCards.forEach(c => mobileListContainer.appendChild(c));
            toggle.remove();
        });
        mobileListContainer.appendChild(toggle);
    }
}

/* ---------------------------------------------------------
   Mobile view — today / tomorrow / any-day-this-month card
   --------------------------------------------------------- */
// Lists every day of `today`'s month, with "Hari Ini"/"Hari Esok" pinned first
// (using their real dates, even if "tomorrow" spills into next month).
function buildDaySelectOptions(today, selectedDateString) {
    const year  = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const todayString = `${year}-${pad2(month + 1)}-${pad2(today.getDate())}`;
    const tomorrowDate = new Date(today);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowString = `${tomorrowDate.getFullYear()}-${pad2(tomorrowDate.getMonth() + 1)}-${pad2(tomorrowDate.getDate())}`;

    const opt = (value, label) => `<option value="${value}" ${value === selectedDateString ? 'selected' : ''}>${label}</option>`;

    let opts = opt(todayString, 'Hari Ini') + opt(tomorrowString, 'Hari Esok');

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
        if (dateStr === todayString || dateStr === tomorrowString) continue; // already pinned above
        opts += opt(dateStr, `${d} ${MONTH_NAMES[month]}`);
    }
    return opts;
}

// Every day (including today/tomorrow) renders its own poster_url directly.
function buildPosterHtml(type, session) {
    if (!session.poster_url) return '';
    const label = type === 'subuh' ? 'Subuh' : 'Maghrib';
    return `<div class="poster-section"><div class="poster-wrapper"><img class="poster-img" src="${escapeHtml(session.poster_url)}" alt="Poster Kuliah ${label}" loading="lazy"></div></div>`;
}

async function renderTodayCard(senaraiHari, selectedDate = null) {
    const todayContainer = document.getElementById('today-kuliah-card');
    if (!todayContainer) return;

    cachedSenaraiHari = senaraiHari;
    todayContainer.classList.add('is-today-card');

    const today = new Date();
    const todayString = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = `${tomorrow.getFullYear()}-${pad2(tomorrow.getMonth() + 1)}-${pad2(tomorrow.getDate())}`;

    const targetDateString = selectedDate || todayString;
    const targetDate = new Date(targetDateString + 'T00:00:00');
    const targetData = senaraiHari.find(d => d.date === targetDateString);

    const isToday    = targetDateString === todayString;
    const isTomorrow = targetDateString === tomorrowString;

    let cardBody = '';
    if (targetData && (targetData.subuh || targetData.maghrib)) {
        if (targetData.subuh) {
            cardBody += createMobileLectureBlock('Subuh', targetData.subuh);
            cardBody += buildPosterHtml('subuh', targetData.subuh);
        }
        if (targetData.maghrib) {
            cardBody += createMobileLectureBlock('Maghrib', targetData.maghrib);
            cardBody += buildPosterHtml('maghrib', targetData.maghrib);
        }
    } else if (isTomorrow && !targetData) {
        cardBody = `<div class="no-kuliah-today">Data jadual untuk esok belum tersedia.</div>`;
    } else {
        const dayLabel = isToday ? 'hari ini' : isTomorrow ? 'esok' : `pada ${targetDate.getDate()} ${MONTH_NAMES[targetDate.getMonth()]}`;
        cardBody = `<div class="no-kuliah-today">Tiada kuliah dijadualkan ${dayLabel}.</div>`;
    }

    const holidayHtml = targetData && targetData.cuti_umum
        ? `<span class="mobile-holiday-label">${escapeHtml(targetData.cuti_umum)}</span>` : '';

    todayContainer.innerHTML = `
        <div class="today-card-top-bar"></div>
        <div class="today-card-header">
            <div class="day-select-wrapper">
                <select class="day-select">
                    ${buildDaySelectOptions(today, targetDateString)}
                </select>
            </div>
            <div class="today-date-right">
                <div id="today-date-gregorian">Memuatkan tarikh...</div>
                <div id="today-date-hijri"></div>
            </div>
            ${holidayHtml}
        </div>
        <div class="today-card-body">${cardBody}</div>`;

    todayContainer.querySelector('.day-select').addEventListener('change', async function () {
        await renderTodayCard(cachedSenaraiHari, this.value);
    });

    await loadHijriDate(targetDate);
}

/* ---------------------------------------------------------
   Hijri date — JAKIM API with JS calculator fallback
   --------------------------------------------------------- */
function gregorianToHijri(date) {
    const d = date.getDate(), m = date.getMonth() + 1, y = date.getFullYear();
    const a = Math.floor((14 - m) / 12);
    const yj = y + 4800 - a, mj = m + 12 * a - 3;
    const jd = d + Math.floor((153 * mj + 2) / 5) + 365 * yj +
        Math.floor(yj / 4) - Math.floor(yj / 100) + Math.floor(yj / 400) - 32045;
    const l = jd - 1948440 + 10632;
    const n = Math.floor((l - 1) / 10631);
    const l2 = l - 10631 * n + 354;
    const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
        Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
    const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
        Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
    const hMonth = Math.floor((24 * l3) / 709);
    return { day: l3 - Math.floor((709 * hMonth) / 24), month: hMonth, year: 30 * n + j - 30 };
}

async function loadHijriDate(targetDate = new Date()) {
    const elGreg = document.getElementById('today-date-gregorian');
    const elHijri = document.getElementById('today-date-hijri');
    if (!elGreg) return;

    const daysInMalay = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
    elGreg.textContent = `${daysInMalay[targetDate.getDay()]}, ${targetDate.getDate()} ${targetDate.toLocaleString('ms-MY', { month: 'long' })} ${targetDate.getFullYear()}`;

    const hijriMonthNames = {
        '01': 'Muharam', '02': 'Safar', '03': "Rabi'ul Awwal", '04': "Rabi'ul Akhir",
        '05': 'Jamadil Awal', '06': 'Jamadil Akhir', '07': 'Rejab', '08': 'Syaaban',
        '09': 'Ramadan', '10': 'Syawal', '11': 'Zulkaedah', '12': 'Zulhijah'
    };

    const calcFallback = () => {
        const h = gregorianToHijri(targetDate);
        const mp = String(h.month).padStart(2, '0');
        if (elHijri) elHijri.textContent = `${h.day} ${hijriMonthNames[mp]} ${h.year}H`;
    };

    try {
        const isToday = targetDate.toDateString() === new Date().toDateString();
        const resp = await fetch('https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=month&zone=WLY01');
        if (!resp.ok) throw new Error('API failed');
        const data = await resp.json();

        const day = String(targetDate.getDate()).padStart(2, '0');
        const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const targetStr = `${day}-${mNames[targetDate.getMonth()]}-${targetDate.getFullYear()}`;
        let info = data.prayerTime.find(p => p.date === targetStr);

        if (!info && !isToday) {
            try {
                const nm = targetDate.getMonth() + 1;
                const ny = nm > 12 ? targetDate.getFullYear() + 1 : targetDate.getFullYear();
                const am = nm > 12 ? 1 : nm;
                const nr = await fetch(`https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=month&zone=WLY01&year=${ny}&month=${am}`);
                if (nr.ok) { const nd = await nr.json(); info = nd.prayerTime.find(p => p.date === targetStr); }
            } catch (e) { /* silent */ }
        }

        if (!info) { calcFallback(); return; }
        const hp = info.hijri.split('-');
        if (elHijri) elHijri.textContent = `${parseInt(hp[2], 10)} ${hijriMonthNames[hp[1]]} ${hp[0]}H`;
    } catch (e) {
        calcFallback();
    }
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
    const monthKey = `${baseDate.getFullYear()}-${pad2(baseDate.getMonth() + 1)}`;

    // 2. Fetch JSON (cache-busted, with embedded fallback)
    const jsonData = await fetchScheduleData();
    const monthData = jsonData.months?.[monthKey];
    const senaraiHari = monthData?.senaraiHari ?? [];

    // 3. Footer update info
    const updateInfoEl = document.getElementById('update-info');
    if (updateInfoEl) {
        updateInfoEl.textContent = monthData?.infoJadual?.tarikhKemasKini || '';
    }

    // 4. Schedule title — always reflects the requested month, not the published data
    const titleEl = document.getElementById('schedule-title');
    if (titleEl) {
        titleEl.textContent = `BULAN ${MONTH_NAMES[baseDate.getMonth()].toUpperCase()} ${baseDate.getFullYear()}`;
    }

    // 5. Render desktop calendar + mobile view
    renderCalendarDesktop(senaraiHari, baseDate);
    await initializeMobileView(senaraiHari, baseDate, !monthData);

    // 6. Auto-print for PDF context
    if (urlParams.get('file') === 'pdf') {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(() => { window.print(); }, 250);
            });
        });
    }
});

