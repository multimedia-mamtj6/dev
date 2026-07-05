// ─── Supabase configuration ──────────────────────────────────────────────────
const SUPABASE_URL      = 'https://qeantrmluevgybkwgvbq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mhfFUZQWurQGZQ7A6DwCYQ_fALDGOnl';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Current admin (populated by requireAuth) ─────────────────────────────────
let currentAdmin = null;

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function requireAuth() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
        window.location.replace('index.html');
        return null;
    }
    const { data } = await db.from('admins').select('*').eq('email', session.user.email).single();
    if (!data) {
        await db.auth.signOut();
        window.location.replace('index.html?denied=1');
        return null;
    }
    currentAdmin = data;
    _injectSuperAdminNav();
    return session;
}

// Inject "Pengguna" nav link for super_admin (non-super admins never see it)
function _injectSuperAdminNav() {
    if (currentAdmin?.role !== 'super_admin') return;
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks || navLinks.querySelector('a[href="users.html"]')) return;
    const spacer = navLinks.querySelector('.spacer');
    const link = document.createElement('a');
    link.href = 'users.html';
    link.textContent = 'Pengguna';
    navLinks.insertBefore(link, spacer);
}

// Hamburger nav toggle (mobile)
function toggleNav() {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) navLinks.classList.toggle('open');
}

// Close hamburger when a nav link is clicked
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-links a').forEach(a => {
        a.addEventListener('click', () => {
            document.querySelector('.nav-links')?.classList.remove('open');
        });
    });
});

async function signInWithGoogle() {
    const btn = document.getElementById('google-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Menghubungi Google...'; }

    const { error } = await db.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/kuliah3/admin/dashboard.html'
        }
    });
    if (error) {
        showToast('Gagal log masuk: ' + error.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Log Masuk dengan Google'; }
    }
}

async function signOut() {
    await db.auth.signOut();
    window.location.replace('index.html');
}

// ─── Toast notifications ──────────────────────────────────────────────────────

let toastContainer = null;

function ensureToastContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
}

function showToast(message, type = 'info', duration = 4000) {
    ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ─── Date / month utilities ───────────────────────────────────────────────────

const BULAN_MALAY = [
    'Januari','Februari','Mac','April','Mei','Jun',
    'Julai','Ogos','September','Oktober','November','Disember'
];
const HARI_MALAY = ['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu'];

function monthLabel(year, month) {
    return `${BULAN_MALAY[month - 1]} ${year}`;
}

function lastDayOfMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

function todayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateMY(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()} ${BULAN_MALAY[d.getMonth()]} ${d.getFullYear()} (${HARI_MALAY[d.getDay()]})`;
}

// ─── XSS utility ─────────────────────────────────────────────────────────────

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
