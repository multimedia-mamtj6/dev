// Public penceramah directory — reads kuliah/data/penceramah.json
// (published by POST /api/publish-ustaz), renders a plain card list.
// ?embed=1 switches to chromeless mode for Google Sites iframe embedding.

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Same /yasi+n/i rule as admin/app.js's isYasinEntry() — matches "Yasin"
// and "Yasiin" spellings in either name field.
function isYasinEntry(p) {
    return /yasi+n/i.test(`${p.full_name || ''}`);
}

function initials(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function buildCard(p) {
    const avatar = p.profile_url
        ? `<img class="avatar" src="${escapeHtml(p.profile_url)}" alt="Mugshot ${escapeHtml(p.full_name)}" loading="lazy">`
        : `<div class="avatar avatar-fallback" aria-hidden="true">${escapeHtml(initials(p.full_name))}</div>`;
    const jawatan = p.jawatan
        ? `<div class="penceramah-jawatan">${escapeHtml(p.jawatan)}</div>`
        : '';
    const tajuk = p.tajuk_kuliah
        ? `<div class="penceramah-tajuk">${escapeHtml(p.tajuk_kuliah)}</div>`
        : '';
    return `<div class="penceramah-card" data-id="${escapeHtml(p.id || '')}">${avatar}<div class="penceramah-info">`
        + `<div class="penceramah-name">${escapeHtml(p.full_name)}</div>`
        + jawatan + tajuk
        + `</div></div>`;
}

// ─── Profile popup ──────────────────────────────────────────────────────────
// Session lookup reads the already-published schedule JSON — no new endpoint.
// Names match exactly: both files source full_name from the same ustaz table.
let penceramahById = {};
let monthsData = null;

function realMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function findSessions(fullName) {
    const month = monthsData && monthsData[realMonthKey()];
    const days = month && Array.isArray(month.senaraiHari) ? month.senaraiHari : [];
    const out = [];
    for (const day of days) {
        for (const sesi of ['subuh', 'maghrib']) {
            const s = day && day[sesi];
            if (s && !s.pending && s.nama_penceramah === fullName) {
                out.push({
                    date: day.date,
                    sesi: sesi === 'subuh' ? 'Subuh' : 'Maghrib',
                    tajuk: s.tajuk_kuliah || null,
                });
            }
        }
    }
    return out;
}

function formatDateMY(dateStr) {
    try {
        return new Date(dateStr + 'T00:00:00')
            .toLocaleString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (e) {
        return dateStr;
    }
}

function buildPopupHtml(p, sessions, scheduleOk) {
    const photo = p.profile_url
        ? `<img class="profile-lg" src="${escapeHtml(p.profile_url)}" alt="Mugshot ${escapeHtml(p.full_name)}">`
        : `<div class="profile-lg profile-lg-fallback" aria-hidden="true">${escapeHtml(initials(p.full_name))}</div>`;
    const jawatan = p.jawatan
        ? `<div class="penceramah-jawatan">${escapeHtml(p.jawatan)}</div>`
        : '';
    const tajuk = p.tajuk_kuliah
        ? `<div class="penceramah-tajuk">${escapeHtml(p.tajuk_kuliah)}</div>`
        : '';
    const monthLabel = new Date().toLocaleString('ms-MY', { month: 'long', year: 'numeric' });

    let scheduleHtml;
    if (!scheduleOk) {
        scheduleHtml = '<div class="session-empty">Jadual tidak tersedia buat masa ini.</div>';
    } else if (sessions.length === 0) {
        scheduleHtml = '<div class="session-empty">Tiada kuliah bulan ini.</div>';
    } else {
        scheduleHtml = '<div class="session-list">' + sessions.map(s =>
            `<div class="session-row"><div class="session-date">${escapeHtml(formatDateMY(s.date))}</div>`
            + `<div class="session-meta">Kuliah ${escapeHtml(s.sesi)}`
            + (s.tajuk ? ` — ${escapeHtml(s.tajuk)}` : '') + '</div></div>'
        ).join('') + '</div>';
    }

    return `<button type="button" class="profile-close" aria-label="Tutup" onclick="closeProfile()">&times;</button>`
        + photo
        + `<div class="penceramah-name profile-name">${escapeHtml(p.full_name)}</div>`
        + jawatan + tajuk
        + `<div class="session-heading">Kuliah bulan ${escapeHtml(monthLabel)}</div>`
        + scheduleHtml;
}

function openProfile(id) {
    const p = penceramahById[id];
    if (!p) return;
    document.getElementById('profile-lightbox-card').innerHTML =
        buildPopupHtml(p, findSessions(p.full_name), monthsData !== null);
    document.getElementById('profile-lightbox').hidden = false;
}

function closeProfile() {
    document.getElementById('profile-lightbox').hidden = true;
}

async function initPenceramah() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('embed') === '1') {
        document.body.classList.add('embed');
    }

    const statusEl = document.getElementById('penceramah-status');
    const listEl = document.getElementById('penceramah-list');
    const updateEl = document.getElementById('update-info');

    let data;
    try {
        const response = await fetch(`/kuliah/data/penceramah.json?v=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        data = await response.json();
    } catch (e) {
        statusEl.textContent = 'Senarai penceramah belum diterbitkan buat masa ini.';
        return;
    }

    const rows = Array.isArray(data.penceramah) ? data.penceramah : [];
    const visible = rows
        .filter(p => p && p.full_name && !isYasinEntry(p))
        .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), undefined, { sensitivity: 'base' }));

    if (visible.length === 0) {
        statusEl.textContent = 'Senarai penceramah belum diterbitkan buat masa ini.';
        return;
    }

    statusEl.style.display = 'none';
    listEl.innerHTML = visible.map(buildCard).join('');
    penceramahById = Object.fromEntries(visible.map(p => [p.id, p]));
    if (updateEl && data.tarikhKemasKini) {
        updateEl.textContent = `Dikemaskini: ${data.tarikhKemasKini} · ${visible.length} penceramah`;
    }

    // Schedule JSON is optional — the popup degrades to photo + details
    // when it is missing or unreachable.
    try {
        const schedRes = await fetch(`/kuliah/data/jadual_lengkap_v2.json?v=${new Date().getTime()}`);
        if (!schedRes.ok) throw new Error(`HTTP ${schedRes.status}`);
        const schedData = await schedRes.json();
        monthsData = schedData && typeof schedData.months === 'object' ? schedData.months : {};
    } catch (e) {
        monthsData = null;
    }
}

document.getElementById('penceramah-list').addEventListener('click', e => {
    const card = e.target.closest('.penceramah-card');
    if (card && card.dataset.id) openProfile(card.dataset.id);
});

document.getElementById('profile-lightbox').addEventListener('click', e => {
    if (e.target === document.getElementById('profile-lightbox')) closeProfile();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeProfile();
});

initPenceramah();
