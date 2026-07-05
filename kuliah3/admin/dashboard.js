// ─── State ────────────────────────────────────────────────────────────────────
let currentYear, currentMonth;
let scheduleMap = {};   // dateStr → { date, cuti_umum, subuh_ustaz_id, maghrib_ustaz_id, subuh, maghrib }
let ustazList   = [];   // full list from DB
let ustazMap    = {};   // id → ustaz object
let editingDate = null; // date string currently open in modal

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
    const session = await requireAuth();
    if (!session) return;

    const now = new Date();
    currentYear  = now.getFullYear();
    currentMonth = now.getMonth() + 1;

    await loadMonth();
}

// ─── Load month data ──────────────────────────────────────────────────────────
async function loadMonth() {
    const labelEl   = document.getElementById('month-label');
    const publishBtn = document.getElementById('publish-btn');
    const label     = monthLabel(currentYear, currentMonth);

    labelEl.textContent    = label;
    publishBtn.textContent = `Terbitkan ${label}`;

    document.getElementById('calendar-body').innerHTML =
        '<tr><td colspan="7" class="state-cell">Memuatkan...</td></tr>';

    // Load ustaz list (needed for dropdowns and display)
    const { data: ustaz, error: ustazErr } = await db
        .from('ustaz')
        .select('id, short_name, full_name, tajuk_kuliah, poster_url')
        .order('full_name');

    if (ustazErr) {
        showToast('Gagal memuatkan senarai penceramah: ' + ustazErr.message, 'error');
        return;
    }
    ustazList = ustaz || [];
    ustazMap  = Object.fromEntries(ustazList.map(u => [u.id, u]));

    // Load schedule rows for this month
    const padMonth  = String(currentMonth).padStart(2, '0');
    const startDate = `${currentYear}-${padMonth}-01`;
    const lastDay   = lastDayOfMonth(currentYear, currentMonth);
    const endDate   = `${currentYear}-${padMonth}-${String(lastDay).padStart(2, '0')}`;

    const { data: rows, error: schedErr } = await db
        .from('schedule')
        .select('date, cuti_umum, subuh_ustaz_id, maghrib_ustaz_id')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

    if (schedErr) {
        showToast('Gagal memuatkan jadual: ' + schedErr.message, 'error');
        return;
    }

    // Build schedule map with ustaz objects resolved
    scheduleMap = {};
    (rows || []).forEach(row => {
        scheduleMap[row.date] = {
            ...row,
            subuh:   row.subuh_ustaz_id   ? ustazMap[row.subuh_ustaz_id]   : null,
            maghrib: row.maghrib_ustaz_id ? ustazMap[row.maghrib_ustaz_id] : null,
        };
    });

    renderCalendar();
}

// ─── Render calendar grid ─────────────────────────────────────────────────────
function renderCalendar() {
    const tbody    = document.getElementById('calendar-body');
    const today    = todayString();
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 = Ahad
    const total    = lastDayOfMonth(currentYear, currentMonth);
    const padMonth = String(currentMonth).padStart(2, '0');

    const weeks = Math.ceil((firstDay + total) / 7);
    let dayNum = 1;
    let html   = '';

    for (let week = 0; week < weeks; week++) {
        html += '<tr>';
        for (let col = 0; col < 7; col++) {
            const pos = week * 7 + col;
            if (pos < firstDay || dayNum > total) {
                html += '<td><div class="day-cell padding"></div></td>';
            } else {
                const dateStr    = `${currentYear}-${padMonth}-${String(dayNum).padStart(2, '0')}`;
                const row        = scheduleMap[dateStr];
                const isToday    = dateStr === today;
                const isWeekend  = col === 0 || col === 6;

                let cellClass = 'day-cell';
                if (isToday)   cellClass += ' is-today';
                if (isWeekend) cellClass += ' is-weekend';

                html += `<td><div class="${cellClass}" onclick="openModal('${dateStr}')">`;
                html += `<div class="day-num">${dayNum}</div>`;

                if (row?.cuti_umum) {
                    html += `<span class="holiday-tag">${escapeHtml(row.cuti_umum)}</span>`;
                }
                if (row?.subuh) {
                    html += `<span class="session-tag subuh">S: ${escapeHtml(row.subuh.short_name || row.subuh.full_name)}</span>`;
                } else if (row) {
                    html += `<span class="session-tag empty">S: Tiada</span>`;
                }
                if (row?.maghrib) {
                    html += `<span class="session-tag maghrib">M: ${escapeHtml(row.maghrib.short_name || row.maghrib.full_name)}</span>`;
                } else if (row) {
                    html += `<span class="session-tag empty">M: Tiada</span>`;
                }

                html += '</div></td>';
                dayNum++;
            }
        }
        html += '</tr>';
    }

    tbody.innerHTML = html;
}

// ─── Month navigation ─────────────────────────────────────────────────────────
function prevMonth() {
    currentMonth--;
    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    loadMonth();
}

function nextMonth() {
    currentMonth++;
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    loadMonth();
}

// ─── Day editor modal ─────────────────────────────────────────────────────────
function openModal(dateStr) {
    editingDate = dateStr;
    const row   = scheduleMap[dateStr];

    document.getElementById('modal-date-label').textContent = formatDateMY(dateStr);

    // Cuti umum
    const hasCuti = !!(row?.cuti_umum);
    document.getElementById('cuti-check').checked  = hasCuti;
    document.getElementById('cuti-text').value     = row?.cuti_umum || '';
    document.getElementById('cuti-text').style.display = hasCuti ? 'block' : 'none';

    // Populate ustaz dropdowns
    const opts = '<option value="">— Tiada Kuliah —</option>' +
        ustazList.map(u =>
            `<option value="${escapeHtml(u.id)}">${escapeHtml(u.full_name)}</option>`
        ).join('');

    const subuhSel   = document.getElementById('subuh-select');
    const maghribSel = document.getElementById('maghrib-select');
    subuhSel.innerHTML   = opts;
    maghribSel.innerHTML = opts;
    subuhSel.value   = row?.subuh_ustaz_id   || '';
    maghribSel.value = row?.maghrib_ustaz_id || '';

    document.getElementById('day-modal').classList.add('open');
}

function closeModal() {
    document.getElementById('day-modal').classList.remove('open');
    editingDate = null;
}

function handleOverlayClick(e) {
    if (e.target === document.getElementById('day-modal')) closeModal();
}

function toggleCutiField() {
    const checked = document.getElementById('cuti-check').checked;
    const field   = document.getElementById('cuti-text');
    field.style.display = checked ? 'block' : 'none';
    if (!checked) field.value = '';
}

// ─── Save day ─────────────────────────────────────────────────────────────────
async function saveDay() {
    if (!editingDate) return;

    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled  = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Menyimpan...';

    const subuhId   = document.getElementById('subuh-select').value   || null;
    const maghribId = document.getElementById('maghrib-select').value || null;
    const hasCuti   = document.getElementById('cuti-check').checked;
    const cutiText  = hasCuti ? (document.getElementById('cuti-text').value.trim() || null) : null;

    const { error } = await db.from('schedule').upsert(
        {
            date:             editingDate,
            subuh_ustaz_id:   subuhId,
            maghrib_ustaz_id: maghribId,
            cuti_umum:        cutiText,
            updated_at:       new Date().toISOString(),
        },
        { onConflict: 'date' }
    );

    saveBtn.disabled  = false;
    saveBtn.textContent = 'Simpan';

    if (error) {
        showToast('Gagal menyimpan: ' + error.message, 'error');
        return;
    }

    showToast('Berjaya disimpan', 'success');
    closeModal();
    await loadMonth();
}

// ─── Publish ──────────────────────────────────────────────────────────────────
async function publishMonth() {
    const btn      = document.getElementById('publish-btn');
    btn.disabled   = true;
    btn.innerHTML  = '<span class="spinner"></span> Menerbitkan...';

    const { data: { session } } = await db.auth.getSession();
    if (!session) {
        showToast('Sesi tamat. Sila log masuk semula.', 'error');
        btn.disabled  = false;
        btn.textContent = `Terbitkan ${monthLabel(currentYear, currentMonth)}`;
        return;
    }

    const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    try {
        const res  = await fetch(`/api/publish?month=${monthStr}`, {
            method:  'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const data = await res.json();

        if (!res.ok) {
            const detail = data.details ? ` (${data.status}: ${data.details})` : '';
            showToast('Gagal menerbitkan: ' + (data.error || res.statusText) + detail, 'error', 8000);
        } else {
            const rows = data.published?.rows ?? 0;
            showToast(`Berjaya diterbitkan! ${rows} hari dalam jadual.`, 'success', 6000);
            if (data.commitUrl) {
                setTimeout(() => window.open(data.commitUrl, '_blank'), 600);
            }
        }
    } catch (err) {
        showToast('Ralat sambungan: ' + err.message, 'error');
    }

    btn.disabled  = false;
    btn.textContent = `Terbitkan ${monthLabel(currentYear, currentMonth)}`;
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
init();
