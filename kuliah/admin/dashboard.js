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
    await updateScheduleActions();

    const src = getPrevMonthOf(currentYear, currentMonth);
    document.getElementById('duplicate-month-label').textContent = `Salin Data ${monthLabel(src.year, src.month)}`;

    document.getElementById('calendar-body').innerHTML =
        '<tr><td colspan="7" class="state-cell">Memuatkan...</td></tr>';

    // Load ustaz list (needed for dropdowns and display)
    const { data: ustaz, error: ustazErr } = await db
        .from('ustaz')
        .select('id, short_name, full_name, tajuk_kuliah, poster_url');

    if (ustazErr) {
        showToast('Gagal memuatkan senarai penceramah: ' + ustazErr.message, 'error');
        return;
    }
    // Client-side sort by short_name (same as ustaz.js) — Supabase .order('short_name')
    // sorts lexicographically, not numerically, so never sort short_name server-side.
    ustazList = (ustaz || []).sort((a, b) =>
        a.short_name.localeCompare(b.short_name, undefined, { numeric: true, sensitivity: 'base' })
    );
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
                    const subuhClass = isYasinEntry(row.subuh) ? 'session-tag yasin' : 'session-tag subuh';
                    html += `<span class="${subuhClass}">S: ${escapeHtml(row.subuh.short_name || row.subuh.full_name)}</span>`;
                } else if (row) {
                    html += `<span class="session-tag empty">S: Tiada</span>`;
                }
                if (row?.maghrib) {
                    const maghribClass = isYasinEntry(row.maghrib) ? 'session-tag yasin' : 'session-tag maghrib';
                    html += `<span class="${maghribClass}">M: ${escapeHtml(row.maghrib.short_name || row.maghrib.full_name)}</span>`;
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
    renderMobileDayList();
}

// ─── Mobile day list (phone view, ≤640px) ─────────────────────────────────────
function renderMobileDayList() {
    const list = document.getElementById('mobile-day-list');
    if (!list) return;

    const today    = todayString();
    const total    = lastDayOfMonth(currentYear, currentMonth);
    const padMonth = String(currentMonth).padStart(2, '0');
    let html = '';

    for (let d = 1; d <= total; d++) {
        const dateStr = `${currentYear}-${padMonth}-${String(d).padStart(2, '0')}`;
        const row     = scheduleMap[dateStr];
        const dow     = new Date(dateStr + 'T00:00:00').getDay();

        let cls = 'mobile-day-card';
        if (dateStr === today)  cls += ' is-today';
        if (row?.cuti_umum)     cls += ' has-holiday';

        const subuhName   = row?.subuh   ? escapeHtml(row.subuh.short_name   || row.subuh.full_name)   : null;
        const maghribName = row?.maghrib ? escapeHtml(row.maghrib.short_name || row.maghrib.full_name) : null;
        const subuhClass   = subuhName   ? (isYasinEntry(row.subuh)   ? 'mdc-s mdc-yasin' : 'mdc-s')   : 'mdc-empty';
        const maghribClass = maghribName ? (isYasinEntry(row.maghrib) ? 'mdc-m mdc-yasin' : 'mdc-m')   : 'mdc-empty';

        html += `<div class="${cls}" onclick="openModal('${dateStr}')">
            <div class="mdc-date">${d}</div>
            <div class="mdc-day">${HARI_MALAY[dow]}</div>
            <div class="mdc-sessions">
                ${row?.cuti_umum ? `<span class="mdc-holiday">${escapeHtml(row.cuti_umum)}</span>` : ''}
                <span class="${subuhClass}">S: ${subuhName || 'Tiada'}</span>
                <span class="${maghribClass}">M: ${maghribName || 'Tiada'}</span>
            </div>
            <div class="mdc-arrow">›</div>
        </div>`;
    }

    list.innerHTML = html;
}

// ─── Schedule view / PDF export links (real current or next month only) ──────
async function updateScheduleActions() {
    const now       = new Date();
    const realYear  = now.getFullYear();
    const realMonth = now.getMonth() + 1;
    let nextYear = realYear, nextMonth = realMonth + 1;
    if (nextMonth > 12) { nextMonth = 1; nextYear++; }

    const container       = document.getElementById('schedule-actions');
    const note            = document.getElementById('schedule-actions-note');
    const futureMonthNote = document.getElementById('future-month-note');
    const scheduleLabel   = document.getElementById('schedule-actions-label');
    const viewBtn         = document.getElementById('view-schedule-btn');
    const pdfBtn          = document.getElementById('export-pdf-btn');
    const publishBtn      = document.getElementById('publish-btn');
    const publishHint     = document.getElementById('publish-hint');
    const lastPublishedNote = document.getElementById('last-published-note');

    const isRealCurrent = currentYear === realYear && currentMonth === realMonth;
    const isRealNext    = currentYear === nextYear  && currentMonth === nextMonth;

    const tagEl = document.getElementById('month-tag');
    if (tagEl) tagEl.textContent = isRealCurrent ? 'Bulan Ini' : (isRealNext ? 'Bulan Depan' : '');

    if (!isRealCurrent && !isRealNext) {
        container.style.display         = 'none';
        note.style.display              = 'none';
        futureMonthNote.style.display   = 'block';
        publishBtn.style.display        = 'none';
        publishHint.style.display       = 'none';
        lastPublishedNote.style.display = 'none';
        return;
    }
    futureMonthNote.style.display = 'none';
    publishBtn.style.display      = '';
    publishHint.style.display     = '';

    const query    = isRealNext ? '?bulan=depan' : '';
    const pdfQuery = isRealNext ? '?file=pdf&bulan=depan' : '?file=pdf';
    const label    = monthLabel(currentYear, currentMonth);
    viewBtn.href = `/kuliah/jadual/jadual.html${query}`;
    pdfBtn.href  = `/kuliah/jadual/jadual.html${pdfQuery}`;
    scheduleLabel.textContent = `Lihat Terbitan ${label}`;
    container.style.display = 'block';
    note.style.display      = 'block';

    await loadLastPublishedNote(label);
}

// Reads the most recent 'publish' activity_log row for this exact month label
// (e.g. "Julai 2026") and renders it, or "Belum diterbitkan" if none exists yet.
async function loadLastPublishedNote(label) {
    const el = document.getElementById('last-published-note');
    const { data, error } = await db
        .from('activity_log')
        .select('created_at, actor_name, actor_email')
        .eq('action', 'publish')
        .eq('target_label', label)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) { el.style.display = 'none'; return; } // informational only, never block the page

    if (!data || !data.length) {
        el.textContent = 'Bulan ini belum pernah diterbitkan.';
    } else {
        const row = data[0];
        let who = row.actor_name;
        if (!who) {
            // Log row predates a name being set, or was written before the admin
            // filled in their name — look up the current name as a fallback so we
            // never show a raw email address when a name is available.
            const { data: adminRow } = await db.from('admins').select('name').ilike('email', row.actor_email).single();
            who = adminRow?.name || row.actor_email;
        }
        el.textContent = `Terakhir diterbitkan pada ${formatDateTimeMY(row.created_at)} (${formatRelativeMY(row.created_at)}) oleh ${who}`;
    }
    el.style.display = 'block';
}

// ─── Month actions dropdown ───────────────────────────────────────────────────
function toggleMonthActionsMenu(e) {
    e.stopPropagation();
    document.getElementById('month-actions-menu').classList.toggle('open');
}

function toggleScheduleActionsMenu(e) {
    e.stopPropagation();
    document.getElementById('schedule-actions-menu').classList.toggle('open');
}

document.addEventListener('click', () => {
    document.getElementById('month-actions-menu')?.classList.remove('open');
    document.getElementById('schedule-actions-menu')?.classList.remove('open');
});

function getPrevMonthOf(year, month) {
    let y = year, m = month - 1;
    if (m < 1) { m = 12; y--; }
    return { year: y, month: m };
}

function countFilledDays(map) {
    return Object.values(map).filter(row => row.subuh_ustaz_id || row.maghrib_ustaz_id || row.cuti_umum).length;
}

// ─── Duplicate month ──────────────────────────────────────────────────────────
function openDuplicateModal() {
    document.getElementById('month-actions-menu').classList.remove('open');

    const src         = getPrevMonthOf(currentYear, currentMonth);
    const srcLabel    = monthLabel(src.year, src.month);
    const targetLabel = monthLabel(currentYear, currentMonth);
    const filledCount = countFilledDays(scheduleMap);

    let text = `Salin semua data dari <strong>${escapeHtml(srcLabel)}</strong> ke <strong>${escapeHtml(targetLabel)}</strong>?`;
    if (filledCount > 0) {
        text += ` ${escapeHtml(targetLabel)} sudah mempunyai <strong>${filledCount}</strong> hari yang diisi — ia akan digantikan.`;
    }

    document.getElementById('duplicate-modal-text').innerHTML = text;
    document.getElementById('duplicate-modal').classList.add('open');
}

function closeDuplicateModal() {
    document.getElementById('duplicate-modal').classList.remove('open');
}

function handleDuplicateOverlay(e) {
    if (e.target === document.getElementById('duplicate-modal')) closeDuplicateModal();
}

async function confirmDuplicate() {
    const btn = document.getElementById('confirm-duplicate-btn');
    btn.disabled  = true;
    btn.innerHTML = '<span class="spinner"></span> Menyalin...';

    const src         = getPrevMonthOf(currentYear, currentMonth);
    const padSrcMonth = String(src.month).padStart(2, '0');
    const srcStart    = `${src.year}-${padSrcMonth}-01`;
    const srcLastDay  = lastDayOfMonth(src.year, src.month);
    const srcEnd      = `${src.year}-${padSrcMonth}-${String(srcLastDay).padStart(2, '0')}`;

    const { data: srcRows, error: srcErr } = await db
        .from('schedule')
        .select('date, subuh_ustaz_id, maghrib_ustaz_id')
        .gte('date', srcStart)
        .lte('date', srcEnd);

    if (srcErr) {
        showToast('Gagal memuatkan data sumber: ' + srcErr.message, 'error');
        btn.disabled   = false;
        btn.textContent = 'Salin & Gantikan';
        return;
    }

    const targetLastDay  = lastDayOfMonth(currentYear, currentMonth);
    const padTargetMonth = String(currentMonth).padStart(2, '0');

    const upserts = (srcRows || [])
        .filter(row => row.subuh_ustaz_id || row.maghrib_ustaz_id)
        .map(row => {
            const day = parseInt(row.date.split('-')[2], 10);
            if (day > targetLastDay) return null;
            return {
                date:             `${currentYear}-${padTargetMonth}-${String(day).padStart(2, '0')}`,
                subuh_ustaz_id:   row.subuh_ustaz_id,
                maghrib_ustaz_id: row.maghrib_ustaz_id,
                updated_at:       new Date().toISOString(),
            };
        })
        .filter(Boolean);

    if (upserts.length === 0) {
        showToast('Tiada data untuk disalin dari bulan sebelum ini.', 'info');
        btn.disabled   = false;
        btn.textContent = 'Salin & Gantikan';
        closeDuplicateModal();
        return;
    }

    const { error: upsertErr } = await db.from('schedule').upsert(upserts, { onConflict: 'date' });

    btn.disabled   = false;
    btn.textContent = 'Salin & Gantikan';

    if (upsertErr) {
        showToast('Gagal menyalin data: ' + upsertErr.message, 'error');
        return;
    }

    showToast(`Berjaya menyalin ${upserts.length} hari.`, 'success');
    await logActivity(
        'schedule_duplicate',
        monthLabel(currentYear, currentMonth),
        `${upserts.length} hari disalin dari ${monthLabel(src.year, src.month)} ke ${monthLabel(currentYear, currentMonth)}.`
    );
    closeDuplicateModal();
    await loadMonth();
}

// ─── Clear month ──────────────────────────────────────────────────────────────
function openClearModal() {
    document.getElementById('month-actions-menu').classList.remove('open');

    const label       = monthLabel(currentYear, currentMonth);
    const filledCount = countFilledDays(scheduleMap);

    document.getElementById('clear-modal-text').innerHTML =
        `Padam semua jadual <strong>${escapeHtml(label)}</strong>? ` +
        `<strong>${filledCount}</strong> hari akan dikosongkan. Tindakan ini tidak boleh diundur.`;
    document.getElementById('clear-modal').classList.add('open');
}

function closeClearModal() {
    document.getElementById('clear-modal').classList.remove('open');
}

function handleClearOverlay(e) {
    if (e.target === document.getElementById('clear-modal')) closeClearModal();
}

async function confirmClear() {
    const btn = document.getElementById('confirm-clear-btn');
    btn.disabled  = true;
    btn.innerHTML = '<span class="spinner"></span> Mengosongkan...';

    const padMonth  = String(currentMonth).padStart(2, '0');
    const startDate = `${currentYear}-${padMonth}-01`;
    const lastDay   = lastDayOfMonth(currentYear, currentMonth);
    const endDate   = `${currentYear}-${padMonth}-${String(lastDay).padStart(2, '0')}`;
    const filledCount = countFilledDays(scheduleMap);

    const { error } = await db
        .from('schedule')
        .delete()
        .gte('date', startDate)
        .lte('date', endDate);

    btn.disabled   = false;
    btn.textContent = 'Kosongkan';

    if (error) {
        showToast('Gagal mengosongkan jadual: ' + error.message, 'error');
        return;
    }

    showToast('Jadual bulan ini telah dikosongkan.', 'success');
    await logActivity(
        'schedule_clear',
        monthLabel(currentYear, currentMonth),
        `${filledCount} hari dikosongkan (jadual dipadam).`
    );
    closeClearModal();
    await loadMonth();
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

    // Populate ustaz dropdowns — numbered by Nama Ringkas (suffix, so type-to-jump-by-name still works)
    const opts = '<option value="">— Tiada Kuliah —</option>' +
        ustazList.map((u, i) =>
            `<option value="${escapeHtml(u.id)}">${escapeHtml(u.short_name || u.full_name)} (${i})</option>`
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
// Compares the pre-write scheduleMap row against the values about to be saved and
// returns a human-readable diff string, or null if nothing actually changed.
function buildDayDiffText(before, afterSubuhId, afterMaghribId, afterCuti) {
    const parts = [];
    const nameOf = u => u ? (u.short_name || u.full_name) : null;

    const beforeSubuh = nameOf(before?.subuh);
    const afterSubuh   = afterSubuhId ? nameOf(ustazMap[afterSubuhId]) : null;
    if ((beforeSubuh || null) !== (afterSubuh || null)) {
        parts.push(`Subuh: ${beforeSubuh || 'Tiada'} → ${afterSubuh || 'Tiada'}`);
    }

    const beforeMaghrib = nameOf(before?.maghrib);
    const afterMaghrib   = afterMaghribId ? nameOf(ustazMap[afterMaghribId]) : null;
    if ((beforeMaghrib || null) !== (afterMaghrib || null)) {
        parts.push(`Maghrib: ${beforeMaghrib || 'Tiada'} → ${afterMaghrib || 'Tiada'}`);
    }

    const beforeCuti = before?.cuti_umum || null;
    if ((beforeCuti || null) !== (afterCuti || null)) {
        parts.push(`Cuti Umum: ${beforeCuti ? `"${beforeCuti}"` : 'Tiada'} → ${afterCuti ? `"${afterCuti}"` : 'Tiada'}`);
    }

    return parts.length ? parts.join('; ') : null;
}

async function saveDay() {
    if (!editingDate) return;

    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled  = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Menyimpan...';

    const subuhId   = document.getElementById('subuh-select').value   || null;
    const maghribId = document.getElementById('maghrib-select').value || null;
    const hasCuti   = document.getElementById('cuti-check').checked;
    const cutiText  = hasCuti ? (document.getElementById('cuti-text').value.trim() || null) : null;
    const before    = scheduleMap[editingDate];

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
    const diff = buildDayDiffText(before, subuhId, maghribId, cutiText);
    if (diff) await logActivity('schedule_day_edit', formatDateMY(editingDate), diff);
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
            await updateScheduleActions();
        }
    } catch (err) {
        showToast('Ralat sambungan: ' + err.message, 'error');
    }

    btn.disabled  = false;
    btn.textContent = `Terbitkan ${monthLabel(currentYear, currentMonth)}`;
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
init();
