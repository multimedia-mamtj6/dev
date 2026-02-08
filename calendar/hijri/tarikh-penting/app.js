/**
 * app.js
 * Skrip utama untuk Kalendar Tarikh Penting Islam Malaysia
 *
 * Fail ini mengandungi:
 * 1. initThemeToggle() - Logik tukar tema terang/gelap
 * 2. loadTodayDate() - Memuatkan tarikh Masihi dan Hijri hari ini dari API e-Solat JAKIM
 * 3. Event listener DOMContentLoaded - Memuatkan dan memaparkan senarai acara dari events.json
 */

// ============================================
// Kelas CSS yang digunakan berulang kali
// (disimpan sebagai pemalar untuk kejelasan)
// ============================================
const BADGE_COUNTDOWN = 'inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300';
const BADGE_TODAY = 'inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300';
const BADGE_PASSED = 'text-xs text-zinc-400 dark:text-zinc-500 italic';

// ============================================
// BAHAGIAN 0: Logik Tukar Tema (Terang/Gelap)
// ============================================

function initThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', function() {
        const html = document.documentElement;
        const isDark = html.classList.contains('dark');

        if (isDark) {
            html.classList.replace('dark', 'light');
            localStorage.setItem('theme', 'light');
        } else {
            html.classList.replace('light', 'dark');
            localStorage.setItem('theme', 'dark');
        }
    });
}

// ============================================
// BAHAGIAN 1: Fungsi Memuatkan Tarikh Hari Ini
// ============================================

async function loadTodayDate() {
    const todayContainer = document.getElementById('today-date-container');
    const solatApiUrl = 'https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=today&zone=WLY01';

    const hijriMonthNames = {
        "01": "Muharam", "02": "Safar", "03": "Rabi'ul Awwal", "04": "Rabi'ul Akhir",
        "05": "Jamadil Awal", "06": "Jamadil Akhir", "07": "Rejab", "08": "Syaaban",
        "09": "Ramadan", "10": "Syawal", "11": "Zulkaedah", "12": "Zulhijah"
    };

    try {
        const response = await fetch(solatApiUrl);
        if (!response.ok) { throw new Error('Gagal menghubungi Server e-Solat.'); }
        const data = await response.json();
        const todayPrayerInfo = data.prayerTime[0];
        if (!todayPrayerInfo) { throw new Error('Tiada data untuk hari ini.'); }

        const today = new Date();
        const daysInMalay = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
        const masihiDateStr = `${daysInMalay[today.getDay()]}, ${today.getDate()} ${today.toLocaleString('ms-MY', { month: 'long' })} ${today.getFullYear()}`;

        const hijriParts = todayPrayerInfo.hijri.split('-');
        const hijriYear = hijriParts[0];
        const hijriMonthNum = hijriParts[1];
        const hijriDay = hijriParts[2];

        const hijriMonthName = hijriMonthNames[hijriMonthNum] || '';
        const hijriDateStr = `${hijriDay} ${hijriMonthName} ${hijriYear}`;

        todayContainer.innerHTML = `<p class="text-sm font-medium text-zinc-600 dark:text-zinc-400">Tarikh hari ini: ${masihiDateStr} / ${hijriDateStr}</p>`;

    } catch (error) {
        console.error('Ralat memuatkan tarikh hari ini:', error);
        todayContainer.innerHTML = `<p class="text-sm italic text-red-500 dark:text-red-400">Tidak dapat memuatkan tarikh hari ini.</p>`;
    }
}

// ============================================
// BAHAGIAN 2: Memuatkan Senarai Acara
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    initThemeToggle();
    loadTodayDate();

    const daysInMalay = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
    const specialEvents = ['Aidiladha', 'Aidilfitri', 'Ramadan'];

    // Tahun hak cipta dinamik
    document.getElementById('copyright').textContent = `\u00A9 ${new Date().getFullYear()} MAMTJ6. Hak Cipta Terpelihara.`;

    fetch('/calendar/hijri/data/events.json')
        .then(response => {
            if (!response.ok) { throw new Error(`Ralat ${response.status}`); }
            return response.json();
        })
        .then(jsonData => {
            const lastUpdated = jsonData.lastUpdated;
            const eventData = jsonData.events;

            document.getElementById('last-updated').textContent = `Tarikh Kemaskini: ${lastUpdated}`;

            const tableBody = document.getElementById('events-tbody');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Susun acara mengikut tarikh
            eventData.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));

            // Cari acara seterusnya
            const nextEvent = eventData.find(event => new Date(event.eventDate + 'T00:00:00') >= today);
            let nextEventDateString = nextEvent ? nextEvent.eventDate : null;

            // --- Kad Peristiwa Terdekat ---
            if (nextEvent) {
                const upcomingContainer = document.getElementById('upcoming-event-container');
                const eventDate = new Date(nextEvent.eventDate + 'T00:00:00');
                const timeDiff = eventDate.getTime() - today.getTime();
                const dayDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                let countdownText = (dayDiff === 0) ? "Hari Ini!" : `${dayDiff} hari lagi`;

                // Tarikh Masihi dan Hijri
                const masihiInfo = eventDate.toLocaleString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' });
                const dayName = daysInMalay[eventDate.getDay()];
                const hijriInfo = nextEvent.hijriDate;

                // Semak jika acara khas (perlu asterisk)
                const isUpcomingSpecial = specialEvents.some(keyword => nextEvent.eventName.includes(keyword));
                const upcomingNameDisplay = isUpcomingSpecial ? nextEvent.eventName + ' *' : nextEvent.eventName;

                // Tentukan gaya badge countdown
                const countdownBadgeClass = (dayDiff === 0)
                    ? 'inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700 px-3 py-1 text-sm font-bold text-emerald-700 dark:text-emerald-300'
                    : 'inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 px-3 py-1 text-sm font-bold text-amber-700 dark:text-amber-300';

                upcomingContainer.innerHTML = `
                <div class="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-sm p-6">
                    <span class="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-3">
                        Peristiwa Terdekat
                    </span>
                    <h2 class="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">${upcomingNameDisplay}</h2>
                    <p class="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mb-3"><span class="font-bold">${hijriInfo}</span> / ${masihiInfo}  (${dayName})</p>
                    <span class="${countdownBadgeClass}">
                        ${countdownText}
                    </span>
                </div>`;
            }

            // --- Jadual Acara ---
            eventData.forEach(event => {
                const eventDate = new Date(event.eventDate + 'T00:00:00');
                const newRow = tableBody.insertRow();

                const timeDiff = eventDate.getTime() - today.getTime();
                const dayDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

                // Gaya baris jadual
                newRow.className = 'border-b border-zinc-100 dark:border-zinc-800 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50';

                if (dayDiff < 0) {
                    newRow.classList.add('is-passed', 'opacity-50');
                }
                if (event.eventDate === nextEventDateString) {
                    newRow.className = 'border-b border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 transition-colors is-next-event';
                }

                // Nama hari dan tarikh
                const dayStr = daysInMalay[eventDate.getDay()];
                const masihiStr = eventDate.toLocaleString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' });
                const hijriStr = event.hijriDate;

                // Semak jika acara khas (perlu asterisk)
                const isSpecialEvent = specialEvents.some(keyword => event.eventName.includes(keyword));
                let eventNameDisplay = event.eventName;
                let mobileSightingNote = '';
                if (isSpecialEvent) {
                    eventNameDisplay += ' *';
                    mobileSightingNote = '<div class="text-xs italic text-zinc-500 dark:text-zinc-400 mt-1">Tertakluk Kepada Pengisytiharan</div>';
                }

                // Sel 1: Nama Peristiwa
                const cellEvent = newRow.insertCell();
                cellEvent.className = 'mobile-event-name px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100';
                cellEvent.textContent = eventNameDisplay;

                // Sel 2: Tarikh & Hari
                const cellDate = newRow.insertCell();
                cellDate.className = 'mobile-date-info px-4 py-3 text-zinc-600 dark:text-zinc-400';
                cellDate.innerHTML = `
                    <div class="hidden md:block">${hijriStr} / ${masihiStr} (${dayStr})</div>
                    <div class="block md:hidden">${hijriStr} / ${masihiStr} (${dayStr})${mobileSightingNote}</div>`;

                // Sel 3: Countdown
                const cellCountdown = newRow.insertCell();
                cellCountdown.className = 'mobile-countdown-info px-4 py-3';

                let countdownHTML = '';
                if (dayDiff > 0) {
                    countdownHTML = `<span class="${BADGE_COUNTDOWN}">${dayDiff} hari lagi</span>`;
                } else if (dayDiff === 0) {
                    countdownHTML = `<span class="${BADGE_TODAY}">Hari Ini!</span>`;
                } else {
                    countdownHTML = `<span class="${BADGE_PASSED}">Telah lepas</span>`;
                }
                cellCountdown.innerHTML = countdownHTML;
            });
        })
        .catch(error => {
            console.error('Gagal memuatkan data acara:', error);
            document.getElementById('main-container').innerHTML = `
                <div class="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-6 text-center">
                    <p class="font-semibold text-red-700 dark:text-red-400">Gagal memuatkan data.</p>
                    <p class="text-sm text-red-600 dark:text-red-400 mt-1">Sila pastikan fail 'events.json' wujud di lokasi yang sama dan tidak mempunyai ralat sintaks.</p>
                </div>`;
        });
});
