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
    return `<div class="penceramah-card">${avatar}<div class="penceramah-info">`
        + `<div class="penceramah-name">${escapeHtml(p.full_name)}</div>`
        + jawatan + tajuk
        + `</div></div>`;
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
    if (updateEl && data.tarikhKemasKini) {
        updateEl.textContent = `Dikemaskini: ${data.tarikhKemasKini} · ${visible.length} penceramah`;
    }
}

initPenceramah();
