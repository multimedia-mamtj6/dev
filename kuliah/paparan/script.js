// =================================================================
// SCRIPT.JS UNTUK DIGITAL SIGNAGE
// Versi 4.1 - Paparan imej sebagai <img> (sokong klik kanan/muat turun)
// =================================================================

const JSON_URL = 'https://dev.mamtj6.com/kuliah/data/jadual_lengkap_v2.json';

const MESSAGES = {
    pending: 'Ceramah Khas — Akan Diumumkan',
    ditangguhkan: 'KULIAH DITANGGUHKAN',
    error: 'Error: Could not load schedule data'
};

// Local Malay date parts — paparan must never load admin JS (same reason
// kuliah/penceramah/ copies its helper locally instead of importing app.js).
const HARI_MALAY = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const BULAN_MALAY = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
    'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];

function formatTargetDate(dateString) {
    const d = new Date(dateString + 'T00:00:00');
    return `${d.getDate()} ${BULAN_MALAY[d.getMonth()]} ${d.getFullYear()} (${HARI_MALAY[d.getDay()]})`;
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Empty-slot message — two lines: the reason at full size, the date smaller
// below. Returns HTML (rendered via innerHTML), so the admin-controlled
// cuti_umum value is escaped — it is the first admin string this page
// ever puts into HTML rather than textContent.
function buildEmptyMessage(day, lectureType, targetDate, entry) {
    const sesi = lectureType === 'subuh' ? 'Subuh' : 'Maghrib';
    const tarikh = `<br><span class="empty-date">${formatTargetDate(targetDate)}</span>`;
    if (entry?.cuti_umum) {
        return `Cuti Umum: ${escapeHtml(entry.cuti_umum)} — Tiada Kuliah${tarikh}`;
    }
    const bila = day === 'today' ? 'Hari Ini' : 'Hari Esok';
    return `Tiada Kuliah ${sesi} dijadualkan pada ${bila}${tarikh}`;
}

function getTargetDate(target) {
    const date = new Date();
    if (target === 'tomorrow') {
        date.setDate(date.getDate() + 1);
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return { dateString: `${year}-${month}-${day}`, monthKey: `${year}-${month}` };
}

function setDisplay(imageUrl, message, opts = {}) {
    const container = document.getElementById('display-container');
    const messageBox = document.getElementById('message');
    const existingImg = container.querySelector('img');
    if (existingImg) existingImg.remove();
    const existingOverlay = container.querySelector('.ditangguhkan-overlay');
    if (existingOverlay) existingOverlay.remove();

    if (imageUrl) {
        messageBox.style.display = 'none';
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Poster Kuliah';
        if (opts.dim) img.classList.add('is-dimmed');
        container.appendChild(img);
        if (opts.overlay) {
            const overlay = document.createElement('div');
            overlay.className = 'ditangguhkan-overlay';
            overlay.innerHTML = '<span>KULIAH<br>DITANGGUHKAN</span>';
            container.appendChild(overlay);
        }
    } else {
        // innerHTML (not textContent): the empty-slot message carries its own
        // two-line markup. Every other caller passes plain text, and the one
        // admin-controlled value (cuti_umum) is escaped at build time.
        messageBox.style.display = 'flex';
        messageBox.querySelector('h1').innerHTML = message;
    }
}

async function initializeDisplay(day, lectureType) {
    const { dateString: targetDate, monthKey } = getTargetDate(day);

    // Log tarikh yang sedang dicari
    console.log(`Mencari jadual untuk: ${day} (${targetDate}), Slot: ${lectureType}`);

    try {
        const response = await fetch(`${JSON_URL}?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);

        const jsonData = await response.json();
        const scheduleList = jsonData.months?.[monthKey]?.senaraiHari ?? [];
        const entry = scheduleList.find(item => item.date === targetDate);

        // Log entri yang ditemui (jika ada)
        console.log("Entri data yang ditemui:", entry);

        const session = entry?.[lectureType];

        // --- TAMBAHAN CONSOLE LOG DI SINI ---
        if (session?.pending) {
            console.log("Slot ditandakan Belum Ditetapkan — memaparkan mesej sementara.");
            setDisplay(null, MESSAGES.pending);
        } else if (session?.ditangguhkan) {
            console.log("Slot ditandakan Ditangguhkan — memaparkan poster malap + notis.");
            if (session?.poster_url) {
                setDisplay(session.poster_url, '', { dim: true, overlay: MESSAGES.ditangguhkan });
            } else {
                setDisplay(null, MESSAGES.ditangguhkan);
            }
        } else if (session?.poster_url) {
            console.log("URL Imej untuk dipaparkan:", session.poster_url);
            setDisplay(session.poster_url, '');
        } else {
            console.log("Tiada URL imej ditemui. Memaparkan mesej.");
            setDisplay(null, buildEmptyMessage(day, lectureType, targetDate, entry));
        }
        // --- AKHIR TAMBAHAN ---

    } catch (error) {
        console.error('Failed to initialize display:', error);
        setDisplay(null, MESSAGES['error']);
    }
}

// =================================================================
// index.html query routing — ?subuh / ?maghrib / ?subuh-esok / ?maghrib-esok
// No recognized query (or none at all) falls back to the button landing menu.
// =================================================================
const QUERY_MAP = {
    'subuh':        { day: 'today',    type: 'subuh',   title: 'KULIAH SUBUH HARI INI' },
    'maghrib':      { day: 'today',    type: 'maghrib', title: 'KULIAH MAGHRIB HARI INI' },
    'subuh-esok':   { day: 'tomorrow', type: 'subuh',   title: 'KULIAH SUBUH HARI INI ESOK' },
    'maghrib-esok': { day: 'tomorrow', type: 'maghrib', title: 'KULIAH MAGHRIB HARI ESOK' },
};

function bootstrapPaparan() {
    const params = new URLSearchParams(window.location.search);
    const matchedKey = Object.keys(QUERY_MAP).find(key => params.has(key));

    const displayContainer = document.getElementById('display-container');
    const landingMenu = document.getElementById('landing-menu');

    if (!matchedKey) {
        displayContainer.style.display = 'none';
        landingMenu.style.display = 'flex';
        return;
    }

    landingMenu.style.display = 'none';
    displayContainer.style.display = 'flex';

    const { day, type, title } = QUERY_MAP[matchedKey];
    document.title = title;
    initializeDisplay(day, type);
}
