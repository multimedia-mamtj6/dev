let allUsers = [];
let pendingDeleteEmail = null;

(async () => {
    const session = await requireAuth();
    if (!session) return;
    if (currentAdmin.role !== 'super_admin') {
        showToast('Akses ditolak. Halaman ini hanya untuk Super Admin.', 'error');
        setTimeout(() => window.location.replace('dashboard.html'), 2000);
        return;
    }
    await loadUsers();
})();

async function loadUsers() {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="state-cell">Memuatkan...</td></tr>';

    const { data, error } = await db.from('admins').select('*').order('created_at');
    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="state-cell">Ralat: ${escapeHtml(error.message)}</td></tr>`;
        return;
    }
    allUsers = data || [];
    renderUsers();
}

function renderUsers() {
    const tbody = document.getElementById('users-tbody');
    if (!allUsers.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="state-cell">Tiada pengguna.</td></tr>';
        return;
    }

    tbody.innerHTML = allUsers.map(u => {
        const isSelf = u.email === currentAdmin.email;
        const roleLabel = u.role === 'super_admin'
            ? `<span style="font-size:0.75rem;padding:0.2rem 0.5rem;border-radius:4px;background:var(--primary);color:#fff">Super Admin</span>`
            : `<span style="font-size:0.75rem;padding:0.2rem 0.5rem;border-radius:4px;background:var(--border);color:var(--text)">Editor</span>`;

        let permLabel = '—';
        if (u.role === 'super_admin') {
            permLabel = '<em style="color:var(--text-muted)">Semua</em>';
        } else {
            const perms = u.permissions || {};
            const active = Object.entries(perms).filter(([, v]) => v).map(([k]) => k);
            permLabel = active.length ? escapeHtml(active.join(', ')) : '<em style="color:var(--text-muted)">Tiada</em>';
        }

        return `<tr>
            <td data-label="E-mel">
                ${escapeHtml(u.email)}
                ${isSelf ? ' <span style="font-size:0.7rem;color:var(--text-muted)">(anda)</span>' : ''}
            </td>
            <td data-label="Nama">${escapeHtml(u.name || '—')}</td>
            <td data-label="Peranan">${roleLabel}</td>
            <td data-label="Kebenaran" style="font-size:0.85rem">${permLabel}</td>
            <td data-label="">
                <div class="actions">
                    <button class="btn btn-ghost btn-sm" onclick="openEditModal('${escapeHtml(u.email)}')">Edit</button>
                    ${!isSelf
                        ? `<button class="btn btn-danger btn-sm" onclick="openDeleteModal('${escapeHtml(u.email)}')">Buang</button>`
                        : ''}
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────

function openAddModal() {
    document.getElementById('user-modal-title').textContent = 'Tambah Pengguna';
    document.getElementById('edit-original-email').value = '';
    document.getElementById('edit-email').value = '';
    document.getElementById('edit-email').disabled = false;
    document.getElementById('edit-name').value = '';
    document.getElementById('edit-role').value = 'editor';
    document.getElementById('perm-kuliah').checked = true;
    togglePermFields();
    document.getElementById('user-modal').classList.add('open');
}

function openEditModal(email) {
    const u = allUsers.find(x => x.email === email);
    if (!u) return;
    document.getElementById('user-modal-title').textContent = 'Edit Pengguna';
    document.getElementById('edit-original-email').value = email;
    document.getElementById('edit-email').value = email;
    document.getElementById('edit-email').disabled = true;
    document.getElementById('edit-name').value = u.name || '';
    document.getElementById('edit-role').value = u.role;
    document.getElementById('perm-kuliah').checked = u.permissions?.kuliah !== false;
    togglePermFields();
    document.getElementById('user-modal').classList.add('open');
}

function closeUserModal() {
    document.getElementById('user-modal').classList.remove('open');
}

function handleUserOverlay(e) {
    if (e.target.id === 'user-modal') closeUserModal();
}

function togglePermFields() {
    const role = document.getElementById('edit-role').value;
    const permGroup = document.getElementById('perm-group');
    const hint = document.getElementById('role-hint');
    if (role === 'super_admin') {
        permGroup.style.display = 'none';
        hint.textContent = 'Super Admin boleh mengurus pengguna dan akses penuh ke semua modul.';
    } else {
        permGroup.style.display = '';
        hint.textContent = 'Editor boleh mengedit jadual dan data penceramah mengikut modul yang dibenarkan.';
    }
}

async function saveUser() {
    const originalEmail = document.getElementById('edit-original-email').value;
    const email = document.getElementById('edit-email').value.trim().toLowerCase();
    const name  = document.getElementById('edit-name').value.trim();
    const role  = document.getElementById('edit-role').value;
    const perms = { kuliah: document.getElementById('perm-kuliah').checked };

    if (!email) { showToast('Sila masukkan e-mel.', 'error'); return; }

    const btn = document.getElementById('user-save-btn');
    btn.disabled = true; btn.textContent = 'Menyimpan...';

    let error;
    if (!originalEmail) {
        ({ error } = await db.from('admins').insert({
            email,
            name: name || null,
            role,
            permissions: role === 'super_admin' ? {} : perms,
        }));
    } else {
        ({ error } = await db.from('admins').update({
            name: name || null,
            role,
            permissions: role === 'super_admin' ? {} : perms,
        }).eq('email', originalEmail));
    }

    btn.disabled = false; btn.textContent = 'Simpan';

    if (error) {
        showToast('Ralat: ' + error.message, 'error');
        return;
    }
    closeUserModal();
    showToast(originalEmail ? 'Pengguna dikemaskini.' : 'Pengguna ditambah.', 'success');
    await loadUsers();
}

// ─── Remove modal ─────────────────────────────────────────────────────────────

function openDeleteModal(email) {
    pendingDeleteEmail = email;
    document.getElementById('delete-user-email').textContent = email;
    document.getElementById('delete-user-modal').classList.add('open');
}

function closeDeleteModal() {
    document.getElementById('delete-user-modal').classList.remove('open');
    pendingDeleteEmail = null;
}

function handleDeleteOverlay(e) {
    if (e.target.id === 'delete-user-modal') closeDeleteModal();
}

async function confirmDeleteUser() {
    if (!pendingDeleteEmail) return;
    const btn = document.getElementById('confirm-delete-btn');
    btn.disabled = true; btn.textContent = 'Membuang...';

    const { error } = await db.from('admins').delete().eq('email', pendingDeleteEmail);

    btn.disabled = false; btn.textContent = 'Buang';
    closeDeleteModal();

    if (error) { showToast('Ralat: ' + error.message, 'error'); return; }
    showToast('Pengguna dibuang.', 'success');
    await loadUsers();
}
