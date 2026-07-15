// =================================================================
// SCRIPT.JS UNTUK DIGITAL SIGNAGE
// Versi 4.1 - Paparan imej sebagai <img> (sokong klik kanan/muat turun)
// =================================================================

const JSON_URL = 'https://dev.mamtj6.com/kuliah/data/jadual_lengkap_v2.json';

const MESSAGES = {
    today_subuh: 'Tiada Kuliah Subuh Hari Ini',
    today_maghrib: 'Tiada Kuliah Maghrib Hari Ini',
    tomorrow_subuh: 'Tiada Kuliah Subuh pada Hari Esok',
    tomorrow_maghrib: 'Tiada Kuliah Maghrib pada Hari Esok',
    pending: 'Ceramah Khas — Akan Diumumkan',
    error: 'Error: Could not load schedule data'
};

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

function setDisplay(imageUrl, message) {
    const container = document.getElementById('display-container');
    const messageBox = document.getElementById('message');
    const existingImg = container.querySelector('img');
    if (existingImg) existingImg.remove();

    if (imageUrl) {
        messageBox.style.display = 'none';
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Poster Kuliah';
        container.appendChild(img);
    } else {
        messageBox.style.display = 'flex';
        messageBox.querySelector('h1').textContent = message;
    }
}

async function initializeDisplay(day, lectureType) {
    const messageKey = `${day}_${lectureType}`;
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
        } else if (session?.poster_url) {
            console.log("URL Imej untuk dipaparkan:", session.poster_url);
            setDisplay(session.poster_url, '');
        } else {
            console.log("Tiada URL imej ditemui. Memaparkan mesej.");
            setDisplay(null, MESSAGES[messageKey]);
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
