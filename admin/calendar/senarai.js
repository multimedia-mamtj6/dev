// Admin editor for calendar/hijri/data/events.json — same browser pattern as
// admin/khutbah/senarai.js (Supabase-auth read gate, GitHub publish via API).
// Events are kept in-memory, sorted by eventDate on render + publish.

let calEvents = [];

(async () => {
    const session = await requireAuth();
    if (!session) return;
    if (!(await requireCalendarAccess())) return;
    applyWriteGate();
    await loadEvents();
    await loadLastPublishedCalendarNote('last-published-note');
})();

function applyWriteGate() {
    const canWrite = canWriteModule('kalendar');
    const pub = document.getElementById('publish-calendar-btn');
    const add = document.getElementById('add-event-btn');
    if (pub && !canWrite) pub.style.display = 'none';
    if (add && !canWrite) add.style.display = 'none';
}

async function loadEvents() {
    const tbody = document.getElementById('calendar-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="state-cell">Memuatkan...</td></tr>';
    try {
        // Absolute path — cleanUrls serves this page at bare /admin/calendar
        // (no trailing slash), so a relative fetch would resolve one level up.
        const res = await fetch(`/calendar/hijri/data/events.json?v=${Date.now()}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        calEvents = (data.events || []).slice().sort((a, b) =>
            new Date(a.eventDate) - new Date(b.eventDate));
        renderRows();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="state-cell">Ralat: ${escapeHtml(e.message)}</td></tr>`;
    }
}

function renderRows() {
    const tbody = document.getElementById('calendar-tbody');
    const canWrite = canWriteModule('kalendar');
    if (!calEvents.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="state-cell">Tiada acara.</td></tr>';
        return;
    }
    tbody.innerHTML = calEvents.map((e, i) => `<tr>
        <td data-label="#">${i + 1}</td>
        <td data-label="Nama Peristiwa">${escapeHtml(e.eventName || '')}</td>
        <td data-label="Tarikh Hijrah">${escapeHtml(e.hijriDate || '')}</td>
        <td data-label="Tarikh Masihi">${escapeHtml(e.eventDate || '')}</td>
        <td data-label="">${canWrite
            ? `<div class="actions">
                <button class="btn btn-ghost btn-sm" title="Edit" aria-label="Edit" onclick="openEditModal(${i})">${ACTION_ICONS.edit}</button>
                <button class="btn btn-danger btn-sm" title="Padam" aria-label="Padam" onclick="deleteRow(${i})">${ACTION_ICONS.delete}</button>
               </div>`
            : '<span class="page-hint">—</span>'}</td>
    </tr>`).join('');
}

function addRow() {
    document.getElementById('calendar-modal-title').textContent = 'Tambah Acara';
    document.getElementById('edit-index').value = '';
    document.getElementById('edit-name').value = '';
    document.getElementById('edit-hijri').value = '';
    document.getElementById('edit-date').value = '';
    document.getElementById('calendar-modal').classList.add('open');
}

function openEditModal(i) {
    const e = calEvents[i];
    if (!e) return;
    document.getElementById('calendar-modal-title').textContent = 'Edit Acara';
    document.getElementById('edit-index').value = String(i);
    document.getElementById('edit-name').value = e.eventName || '';
    document.getElementById('edit-hijri').value = e.hijriDate || '';
    document.getElementById('edit-date').value = e.eventDate || '';
    document.getElementById('calendar-modal').classList.add('open');
}

function closeCalendarModal() {
    document.getElementById('calendar-modal').classList.remove('open');
}

function handleCalendarOverlay(e) {
    if (e.target.id === 'calendar-modal') closeCalendarModal();
}

function saveRow() {
    const idx = document.getElementById('edit-index').value;
    const row = {
        eventName: document.getElementById('edit-name').value.trim(),
        hijriDate: document.getElementById('edit-hijri').value.trim(),
        eventDate: document.getElementById('edit-date').value,
    };
    if (!row.eventName || !row.eventDate || !row.hijriDate) {
        showToast('Lengkapkan ketiga-tiga medan.', 'error');
        return;
    }
    if (idx === '') calEvents.push(row);
    else calEvents[Number(idx)] = row;
    calEvents.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
    closeCalendarModal();
    renderRows();
}

function deleteRow(i) {
    if (!confirm(`Padam "${calEvents[i]?.eventName || ''}"?`)) return;
    calEvents.splice(i, 1);
    renderRows();
}

async function onSavePublish() {
    const json = await publishCalendarEvents(calEvents, 'publish-calendar-btn');
    if (json) await loadLastPublishedCalendarNote('last-published-note');
}
