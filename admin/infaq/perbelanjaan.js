// ─── State ────────────────────────────────────────────────────────────────────
let expenseLimit = 50;
const EXPENSE_PAGE_SIZE = 50;

let filterFrom = '';
let filterTo   = '';

let currentRows = [];
let deletingId  = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
    const session = await requireAuth();
    if (!session) return;
    if (!(await requireInfaqAccess())) return;
    await loadExpenses();
})();

// ─── Load and render ──────────────────────────────────────────────────────────
function applyFilters() {
    filterFrom = document.getElementById('filter-from').value;
    filterTo   = document.getElementById('filter-to').value;
    expenseLimit = EXPENSE_PAGE_SIZE;
    loadExpenses();
}

function resetFilters() {
    document.getElementById('filter-from').value = '';
    document.getElementById('filter-to').value   = '';
    applyFilters();
}

async function loadExpenses() {
    const tbody = document.getElementById('expense-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="state-cell">Memuatkan...</td></tr>';

    let query = db
        .from('infaq_expenses')
        .select('*')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(expenseLimit);
    if (filterFrom) query = query.gte('expense_date', filterFrom);
    if (filterTo)   query = query.lte('expense_date', filterTo);

    const { data, error } = await query;

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="state-cell">Ralat: ${escapeHtml(error.message)}</td></tr>`;
        return;
    }

    currentRows = data || [];
    renderTable();
    document.getElementById('load-more-btn').style.display = currentRows.length >= expenseLimit ? '' : 'none';
}

function renderTable() {
    const tbody = document.getElementById('expense-tbody');
    if (!currentRows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="state-cell">Tiada rekod perbelanjaan lagi. Klik "+ Catat Perbelanjaan" untuk mula.</td></tr>';
        return;
    }
    tbody.innerHTML = currentRows.map(r => `
        <tr>
            <td data-label="Tarikh">${escapeHtml(formatDateMY(r.expense_date))}</td>
            <td data-label="Jumlah"><strong>${escapeHtml(formatRM(r.amount))}</strong></td>
            <td data-label="Kategori" style="color:var(--text-muted)">${escapeHtml(r.category || '—')}</td>
            <td data-label="Perihal" style="color:var(--text-muted);font-size:0.8125rem">${escapeHtml(r.description)}</td>
            <td data-label="">
                <div class="actions">
                    <button class="btn btn-ghost btn-sm" onclick="openEditModal('${escapeHtml(r.id)}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${escapeHtml(r.id)}')">Padam</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function loadMore() {
    expenseLimit += EXPENSE_PAGE_SIZE;
    loadExpenses();
}

// ─── Add modal ────────────────────────────────────────────────────────────────
function openAddModal() {
    document.getElementById('expense-modal-title').textContent = 'Catat Perbelanjaan';
    document.getElementById('edit-id').value          = '';
    document.getElementById('edit-date').value        = todayString();
    document.getElementById('edit-amount').value      = '';
    document.getElementById('edit-category').value    = '';
    document.getElementById('edit-description').value = '';
    document.getElementById('expense-modal').classList.add('open');
}

// ─── Edit modal ───────────────────────────────────────────────────────────────
function openEditModal(id) {
    const r = currentRows.find(x => x.id === id);
    if (!r) return;
    document.getElementById('expense-modal-title').textContent = 'Edit Perbelanjaan';
    document.getElementById('edit-id').value          = r.id;
    document.getElementById('edit-date').value        = r.expense_date;
    document.getElementById('edit-amount').value      = r.amount;
    document.getElementById('edit-category').value    = r.category || '';
    document.getElementById('edit-description').value = r.description;
    document.getElementById('expense-modal').classList.add('open');
}

function closeModal() {
    document.getElementById('expense-modal').classList.remove('open');
}

function handleOverlay(e) {
    if (e.target === document.getElementById('expense-modal')) closeModal();
}

// ─── Save ─────────────────────────────────────────────────────────────────────
function buildExpenseDiffText(before, after) {
    const parts = [];
    if (before.expense_date !== after.expense_date) parts.push(`Tarikh: ${before.expense_date} → ${after.expense_date}`);
    if (Number(before.amount) !== Number(after.amount)) parts.push(`Jumlah: ${formatRM(before.amount)} → ${formatRM(after.amount)}`);
    if ((before.category || '') !== (after.category || '')) parts.push(`Kategori: ${before.category || 'Tiada'} → ${after.category || 'Tiada'}`);
    if (before.description !== after.description) parts.push('Perihal dikemaskini');
    return parts.length ? parts.join('; ') : null;
}

async function saveExpense() {
    const id          = document.getElementById('edit-id').value.trim();
    const date         = document.getElementById('edit-date').value;
    const amount       = parseFloat(document.getElementById('edit-amount').value);
    const category     = document.getElementById('edit-category').value.trim();
    const description  = document.getElementById('edit-description').value.trim();

    if (!date) { showToast('Tarikh diperlukan', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Jumlah mesti lebih daripada 0', 'error'); document.getElementById('edit-amount').focus(); return; }
    if (!description) { showToast('Perihal diperlukan', 'error'); document.getElementById('edit-description').focus(); return; }

    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled  = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Menyimpan...';

    const before = id ? currentRows.find(r => r.id === id) : null;
    const payload = {
        expense_date: date, amount, category: category || null,
        description, updated_at: new Date().toISOString(),
    };

    let error;
    if (id) ({ error } = await db.from('infaq_expenses').update(payload).eq('id', id));
    else    ({ error } = await db.from('infaq_expenses').insert(payload));

    saveBtn.disabled  = false;
    saveBtn.textContent = 'Simpan';

    if (error) { showToast('Gagal menyimpan: ' + error.message, 'error'); return; }

    showToast(id ? 'Perbelanjaan dikemaskini' : 'Perbelanjaan berjaya dicatat', 'success');
    const label = `${formatRM(amount)} (${date})`;
    if (id) {
        const diff = buildExpenseDiffText(before, payload);
        if (diff) await logActivity('infaq_expense_update', label, diff, 'infaq_activity_log');
    } else {
        await logActivity('infaq_expense_create', label, description, 'infaq_activity_log');
    }
    closeModal();
    await loadExpenses();
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function openDeleteModal(id) {
    deletingId = id;
    const r = currentRows.find(x => x.id === id);
    document.getElementById('delete-label').textContent = r ? `${formatRM(r.amount)} (${formatDateMY(r.expense_date)})` : '';
    document.getElementById('delete-modal').classList.add('open');
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('open');
    deletingId = null;
}

function handleDeleteOverlay(e) {
    if (e.target === document.getElementById('delete-modal')) closeDeleteModal();
}

async function confirmDelete() {
    if (!deletingId) return;
    const btn = document.getElementById('confirm-delete-btn');
    btn.disabled = true;
    btn.textContent = 'Memadam...';

    const target = currentRows.find(r => r.id === deletingId);
    const { error } = await db.from('infaq_expenses').delete().eq('id', deletingId);

    btn.disabled = false;
    btn.textContent = 'Padam';

    if (error) { showToast('Gagal memadam: ' + error.message, 'error'); return; }

    showToast('Rekod perbelanjaan dipadam', 'success');
    if (target) await logActivity('infaq_expense_delete', `${formatRM(target.amount)} (${formatDateMY(target.expense_date)})`, null, 'infaq_activity_log');
    closeDeleteModal();
    await loadExpenses();
}
