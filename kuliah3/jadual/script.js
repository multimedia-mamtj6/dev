// =================================================================
// SCRIPT.JS - VERSI 15.4 (DENGAN DROPDOWN HARI INI/ESOK)
// =================================================================

// Cache data untuk re-rendering kad hari ini/esok
let cachedSenaraiHari = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const jsonData = await fetch(`../data/jadual_lengkap.json?v=${new Date().getTime()}`).then(res => res.json());
        
        // --- LOGIK BAHARU UNTUK MENENTUKAN BULAN ---
        const urlParams = new URLSearchParams(window.location.search);
        const targetMonthParam = urlParams.get('bulan');

        const baseDate = new Date();
        if (targetMonthParam === 'depan') {
            baseDate.setMonth(baseDate.getMonth() + 1);
        }

        // Check for PDF export parameter
        const pdfExportMode = urlParams.get('file') === 'pdf';

        // Kemas kini pengaki (tarikh kemas kini)
        const updateInfoElement = document.getElementById('update-info');
        if (updateInfoElement && jsonData.infoJadual.tarikhKemasKini) {
            updateInfoElement.textContent = jsonData.infoJadual.tarikhKemasKini;
        }

        // Hantar tarikh sasaran kepada kedua-dua fungsi render
        renderCalendarDesktop(jsonData.senaraiHari, baseDate);
        initializeMobileView(jsonData.senaraiHari, baseDate);

        // --- PDF EXPORT AUTO-PRINT ---
        if (pdfExportMode) {
            // Wait for rendering to complete and CSS to be applied
            // Use requestAnimationFrame twice to ensure paint cycle completes
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // Additional small delay for mobile browsers to apply print styles
                    setTimeout(() => {
                        window.print();
                    }, 250);
                });
            });
        }

    } catch (error) {
        console.error("Gagal memuatkan data:", error);
        // ... (kod ralat tidak berubah) ...
    }
});

// =================================================================
// BAHAGIAN 1: FUNGSI UNTUK PAPARAN DESKTOP (DIKEMAS KINI)
// =================================================================
function renderCalendarDesktop(senaraiHari, targetDate) {
    const calendarBody = document.getElementById('calendar-body');
    if (!calendarBody) return;
    
    calendarBody.innerHTML = '';
    const today = new Date(); // Untuk highlight hari ini sahaja

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    
    // Kemas kini tajuk bulan secara dinamik
    const monthNames = ["JANUARI", "FEBRUARI", "MAC", "APRIL", "MEI", "JUN", "JULAI", "OGOS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DISEMBER"];
    document.getElementById('schedule-title').textContent = `BULAN ${monthNames[month]} ${year}`;

    // ... (Logik binaan kalendar tidak berubah) ...
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let calendarDays = Array(35).fill(null);
    let dayCounter = 1;
    for (let i = firstDayOfMonth; i < 35 && dayCounter <= daysInMonth; i++) { calendarDays[i] = dayCounter++; }
    let overflowingDays = [];
    while (dayCounter <= daysInMonth) { overflowingDays.push(dayCounter++); }
    for (let i = 0; i < 35 && overflowingDays.length > 0; i++) { if (calendarDays[i] === null) { calendarDays[i] = overflowingDays.shift(); } }

    for (let i = 0; i < 5; i++) {
        const row = document.createElement('tr');
        const weekCell = document.createElement('td');
        weekCell.className = 'week-number-cell';
        const weekLabel = document.createElement('div');
        weekLabel.className = 'week-label';
        [...'MINGGU'].forEach(ch => {
            const span = document.createElement('span');
            span.textContent = ch;
            weekLabel.appendChild(span);
        });
        const spacer = document.createElement('span');
        spacer.innerHTML = '&nbsp;';
        weekLabel.appendChild(spacer);
        const numSpan = document.createElement('span');
        numSpan.textContent = String(i + 1);
        weekLabel.appendChild(numSpan);
        weekCell.appendChild(weekLabel);
        row.appendChild(weekCell);

        for (let j = 0; j < 7; j++) {
            const cell = document.createElement('td');
            cell.className = 'day-cell';
            const dayNumber = calendarDays[i * 7 + j];

            if (dayNumber !== null) {
                const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                const dayData = senaraiHari.find(d => d.date === dateString);
                
                cell.innerHTML = `<div class="date-number">${dayNumber}</div>`;

                if (dayData && dayData.cuti_umum) {
                    const dateHeader = document.createElement('div');
                    dateHeader.className = 'date-header';
                    dateHeader.appendChild(document.createElement('span')); 
                    const holidayLabel = document.createElement('span');
                    holidayLabel.className = 'holiday-label';
                    holidayLabel.textContent = dayData.cuti_umum;
                    dateHeader.appendChild(holidayLabel);
                    cell.appendChild(dateHeader);
                }

                const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                if (dateString === todayString) {
                    cell.classList.add('is-today');
                }
                
                const lectureWrapper = document.createElement('div');
                lectureWrapper.className = 'lecture-content';
                if (dayData) {
                    const tiadaSubuh = !dayData.subuh;
                    const tiadaMaghrib = !dayData.maghrib;
                    if (tiadaSubuh && tiadaMaghrib) {
                        lectureWrapper.classList.add('is-empty-slot');
                        lectureWrapper.innerHTML = `<div class="empty-slot-text">Slot Kosong</div>`;
                    } else if (dayData.subuh?.nama_penceramah.includes('Yasiin') || dayData.maghrib?.nama_penceramah.includes('Yasiin')) {
                        lectureWrapper.innerHTML = `<div><div class="arabic-text" lang="ar" dir="rtl"> باچاءن يسٓ دان تهليل </div><div class="yasin-title">BACAAN YASIIN & TAHLIL</div></div>`;
                    } else {
                        const currentDate = new Date(year, month, dayNumber);
                        const dayOfWeek = currentDate.getDay();
                        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
                        if (isWeekend) {
                            if (dayData.subuh) { lectureWrapper.innerHTML += createDesktopLectureBlock('Subuh', dayData.subuh); } else { lectureWrapper.innerHTML += createEmptyLectureBlock(); }
                            if (dayData.maghrib) { lectureWrapper.innerHTML += createDesktopLectureBlock('Maghrib', dayData.maghrib); } else { lectureWrapper.innerHTML += createEmptyLectureBlock(); }
                        } else {
                            if (dayData.subuh) { lectureWrapper.innerHTML += createDesktopLectureBlock('Subuh', dayData.subuh); }
                            if (dayData.maghrib) { lectureWrapper.innerHTML += createDesktopLectureBlock('Maghrib', dayData.maghrib); }
                        }
                    }
                }
                cell.appendChild(lectureWrapper);
                if (!dayData && dayNumber) { 
                    cell.innerHTML = `<div class="date-number">${dayNumber}</div><div class="lecture-content"></div>`;
                }
            } else {
                cell.classList.add('empty-cell');
            }
            row.appendChild(cell);
        }
        calendarBody.appendChild(row);
    }
}

// =================================================================
// BAHAGIAN 2: FUNGSI-FUNGSI UNTUK PAPARAN MUDAH ALIH (V2)
// =================================================================
async function initializeMobileView(senaraiHari, targetDate) {
    const mobileContainer = document.getElementById('mobile-view-container');
    if (!mobileContainer) return;
    const mobileListContainer = document.getElementById('mobile-card-list');
    if (!mobileListContainer) return;

    const today = new Date();
    const isCurrentMonth = targetDate.getMonth() === today.getMonth() && targetDate.getFullYear() === today.getFullYear();
    if (isCurrentMonth) {
        await renderTodayCard(senaraiHari);
    } else {
        const todayCard = document.getElementById('today-kuliah-card');
        if (todayCard) todayCard.style.display = 'none';
    }

    const daysInMalay = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
    const monthNames = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
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
            ? `<span class="mobile-holiday-label">${dayData.cuti_umum}</span>` : '';

        let bodyHtml = '';
        if (isEmpty) {
            bodyHtml = `<div class="empty-slot-v2">Tiada kuliah</div>`;
        } else {
            if (dayData.subuh) bodyHtml += createLectureBlock('Subuh', dayData.subuh);
            if (dayData.maghrib) bodyHtml += createLectureBlock('Maghrib', dayData.maghrib);
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

async function renderTodayCard(senaraiHari, selectedDay = 'today') {
    const todayContainer = document.getElementById('today-kuliah-card');
    if (!todayContainer) return;

    cachedSenaraiHari = senaraiHari;
    todayContainer.classList.add('is-today-card');

    const today = new Date();
    const targetDate = new Date(today);
    if (selectedDay === 'tomorrow') targetDate.setDate(targetDate.getDate() + 1);

    const targetDateString = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    const targetData = senaraiHari.find(d => d.date === targetDateString);

    const iframeSuffix = selectedDay === 'tomorrow' ? 'tomorrow' : 'today';

    let cardBody = '';
    if (targetData && (targetData.subuh || targetData.maghrib)) {
        if (targetData.subuh) {
            cardBody += createLectureBlock('Subuh', targetData.subuh);
            cardBody += `<div class="poster-section"><div class="poster-wrapper"><iframe class="poster-iframe" src="https://dev.mamtj6.com/kuliah/paparan/${iframeSuffix}_subuh.html" loading="lazy" scrolling="no"></iframe></div></div>`;
        }
        if (targetData.maghrib) {
            cardBody += createLectureBlock('Maghrib', targetData.maghrib);
            cardBody += `<div class="poster-section"><div class="poster-wrapper"><iframe class="poster-iframe" src="https://dev.mamtj6.com/kuliah/paparan/${iframeSuffix}_maghrib.html" loading="lazy" scrolling="no"></iframe></div></div>`;
        }
    } else if (selectedDay === 'tomorrow' && !targetData) {
        cardBody = `<div class="no-kuliah-today">Data jadual untuk esok belum tersedia.</div>`;
    } else {
        const dayLabel = selectedDay === 'tomorrow' ? 'esok' : 'hari ini';
        cardBody = `<div class="no-kuliah-today">Tiada kuliah dijadualkan ${dayLabel}.</div>`;
    }

    const holidayHtml = targetData && targetData.cuti_umum
        ? `<span class="mobile-holiday-label">${targetData.cuti_umum}</span>` : '';

    todayContainer.innerHTML = `
        <div class="today-card-top-bar"></div>
        <div class="today-card-header">
            <div class="day-select-wrapper">
                <select class="day-select">
                    <option value="today" ${selectedDay === 'today' ? 'selected' : ''}>Hari Ini</option>
                    <option value="tomorrow" ${selectedDay === 'tomorrow' ? 'selected' : ''}>Hari Esok</option>
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

    const daysInMalay = ["Ahad","Isnin","Selasa","Rabu","Khamis","Jumaat","Sabtu"];
    const miladi = `${daysInMalay[targetDate.getDay()]}, ${targetDate.getDate()} ${targetDate.toLocaleString('ms-MY',{month:'long'})} ${targetDate.getFullYear()}`;
    elGreg.textContent = miladi;

    const hijriMonthNames = {"01":"Muharam","02":"Safar","03":"Rabi'ul Awwal","04":"Rabi'ul Akhir","05":"Jamadil Awal","06":"Jamadil Akhir","07":"Rejab","08":"Syaaban","09":"Ramadan","10":"Syawal","11":"Zulkaedah","12":"Zulhijah"};

    const calcFallback = () => {
        const h = gregorianToHijri(targetDate);
        const mp = String(h.month).padStart(2,'0');
        if (elHijri) elHijri.textContent = `${h.day} ${hijriMonthNames[mp]} ${h.year}H`;
    };

    try {
        const isToday = targetDate.toDateString() === new Date().toDateString();
        const resp = await fetch('https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=month&zone=WLY01');
        if (!resp.ok) throw new Error('API failed');
        const data = await resp.json();

        const day = String(targetDate.getDate()).padStart(2,'0');
        const mNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const targetStr = `${day}-${mNames[targetDate.getMonth()]}-${targetDate.getFullYear()}`;
        let info = data.prayerTime.find(p => p.date === targetStr);

        if (!info && !isToday) {
            try {
                const nm = targetDate.getMonth() + 1, ny = nm > 12 ? targetDate.getFullYear() + 1 : targetDate.getFullYear(), am = nm > 12 ? 1 : nm;
                const nr = await fetch(`https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=month&zone=WLY01&year=${ny}&month=${am}`);
                if (nr.ok) { const nd = await nr.json(); info = nd.prayerTime.find(p => p.date === targetStr); }
            } catch(e) {}
        }

        if (!info) { calcFallback(); return; }
        const hp = info.hijri.split('-');
        if (elHijri) elHijri.textContent = `${parseInt(hp[2],10)} ${hijriMonthNames[hp[1]]} ${hp[0]}H`;
    } catch(e) {
        calcFallback();
    }
}

// =================================================================
// BAHAGIAN 3: FUNGSI-FUNGSI SOKONGAN
// =================================================================
function createDesktopLectureBlock(time, lecture) {
    const timeClass = time.toLowerCase();
    return `<div class="lecture-block"><div class="lecture-time ${timeClass}">${time}</div><div class="ustaz-name">${lecture.nama_penceramah}</div><div class="lecture-title">${lecture.tajuk_kuliah}</div></div>`;
}

function createEmptyLectureBlock() {
    return `<div class="lecture-block is-weekend-empty"><div class="empty-slot-text">Slot Kosong</div></div>`;
}

function createLectureBlock(time, lecture) {
    const badgeClass = time.toLowerCase();
    const isYasin = lecture.nama_penceramah && lecture.nama_penceramah.includes('Yasiin');
    if (isYasin) {
        return `<div class="lecture-block-v2">
            <span class="session-badge ${badgeClass}">${time}</span>
            <div class="lecture-ustaz" lang="ar" dir="rtl" style="font-size:1.1rem;text-align:right;">باچاءن يسٓ دان تهليل</div>
            <div class="lecture-tajuk">BACAAN YASIIN &amp; TAHLIL</div>
        </div>`;
    }
    return `<div class="lecture-block-v2">
        <span class="session-badge ${badgeClass}">${time}</span>
        <div class="lecture-ustaz">${lecture.nama_penceramah}</div>
        <div class="lecture-tajuk">${lecture.tajuk_kuliah}</div>
    </div>`;
}