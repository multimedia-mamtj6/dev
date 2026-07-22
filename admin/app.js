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
        window.location.replace('/admin/index.html');
        return null;
    }
    const { data } = await db.from('admins').select('*').eq('email', session.user.email).single();
    if (!data) {
        await db.auth.signOut();
        window.location.replace('/admin/index.html?denied=1');
        return null;
    }
    currentAdmin = data;
    renderSidebar();
    return session;
}

// Every module's dashboard sits at a different depth now (admin/kuliah/,
// admin/infaq/) — used for the OAuth return URL and any "no access, go
// somewhere sane" redirect. Returns null when the admin has no module
// access at all; callers must show a message in that case, never redirect
// (redirecting to another gated/denied page is how you get a bounce loop).
function defaultLandingPageFor(admin) {
    if (!admin) return null;
    if (admin.role === 'super_admin' || admin.permissions?.kuliah) return '/admin/kuliah/dashboard.html';
    if (admin.permissions?.infaq) return '/admin/infaq/ringkasan.html';
    return null;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
// Single source of truth for every nav link in the admin CMS — hrefs are
// always absolute (/admin/...) since they only ever live here now, which
// structurally rules out the relative-path-under-cleanUrls landmine that
// used to require a comment on every hand-copied nav block. `match` lists
// every pathname that should highlight an item as active, so a sub-page
// like projek-kutipan.html (an infaq detail view, not one of the visible
// labels) can highlight its logical parent ("Projek") without any
// filename-guessing.
const MODULES = [
    {
        key: 'kuliah', label: 'Kuliah', permission: 'kuliah', requiresSuperAdmin: false,
        items: [
            { label: 'Jadual',     href: '/admin/kuliah/dashboard.html', match: ['/admin/kuliah/dashboard.html'] },
            { label: 'Penceramah', href: '/admin/kuliah/ustaz.html',     match: ['/admin/kuliah/ustaz.html'] },
        ],
    },
    {
        key: 'infaq', label: 'Infaq', permission: 'infaq', requiresSuperAdmin: false,
        items: [
            { label: 'Ringkasan',    href: '/admin/infaq/ringkasan.html',    match: ['/admin/infaq/ringkasan.html'] },
            { label: 'Kutipan',      href: '/admin/infaq/kutipan.html',      match: ['/admin/infaq/kutipan.html'] },
            { label: 'Perbelanjaan', href: '/admin/infaq/perbelanjaan.html', match: ['/admin/infaq/perbelanjaan.html'] },
            { label: 'Projek',       href: '/admin/infaq/projek.html',
              match: ['/admin/infaq/projek.html', '/admin/infaq/projek-kutipan.html'] },
        ],
    },
    {
        key: 'pentadbiran', label: 'Pentadbiran', permission: null, requiresSuperAdmin: true,
        items: [
            { label: 'Pengguna',     href: '/admin/users.html',   match: ['/admin/users.html'] },
            { label: 'Log Aktiviti', href: '/admin/userlog.html', match: ['/admin/userlog.html'] },
        ],
    },
];

const SIDEBAR_LINK_BASE  = 'block px-3 py-1.5 rounded-md text-sm transition-colors';
const SIDEBAR_LINK_IDLE  = 'text-slate-300 hover:bg-white/10 hover:text-white';
const SIDEBAR_LINK_ACTIVE = 'bg-green-600 text-white font-medium';

// Builds the static sidebar chrome (topbar/backdrop/aside frame, an empty
// #sidebar-nav placeholder inside it) and mounts it into #sidebar-root.
// Deliberately has no dependency on currentAdmin/auth — called once, at
// script-load time (see the top-level call below), so the sidebar panel
// paints immediately on every navigation instead of waiting on the
// Supabase session round-trip in requireAuth(). Without this split, the
// panel didn't exist until auth resolved, which on a traditional
// multi-page app (a fresh JS context + fresh network round-trip on every
// single click) was visible as the sidebar flickering in on every page.
function renderSidebarShell() {
    const root = document.getElementById('sidebar-root');
    if (!root) return;
    root.innerHTML = `
        <div class="md:hidden sticky top-0 z-40 flex items-center gap-3 bg-slate-900 text-white px-4 h-14">
            <button onclick="toggleNav()" aria-label="Menu" class="p-1.5 -ml-1.5 rounded hover:bg-white/10 text-xl leading-none">&#9776;</button>
            <span class="font-semibold text-sm">Admin MAMTJ6</span>
        </div>
        <div id="sidebar-backdrop" onclick="closeNav()" class="hidden md:hidden fixed inset-0 bg-black/50 z-40"></div>
        <aside id="sidebar" class="fixed inset-y-0 left-0 z-50 w-64 -translate-x-full transition-transform duration-200 md:translate-x-0 bg-slate-900 text-slate-200 flex flex-col">
            <div class="h-14 flex items-center px-4 font-semibold text-white border-b border-white/10 shrink-0">Admin MAMTJ6</div>
            <nav id="sidebar-nav" class="flex-1 overflow-y-auto py-3 px-2 space-y-4"></nav>
            <div class="border-t border-white/10 p-2 shrink-0">
                <button onclick="signOut()" class="w-full text-left px-3 py-1.5 rounded-md text-sm text-slate-300 hover:bg-white/10 hover:text-white">Log Keluar</button>
            </div>
        </aside>
    `;
}
// app.js's own <script> tag sits at the end of <body>, after #sidebar-root
// in every page's markup, so by the time this line runs the mount point
// already exists in the DOM — no DOMContentLoaded wrapper needed.
renderSidebarShell();

// Fills the shell's #sidebar-nav with the actual module groups from
// MODULES + currentAdmin — the only part that genuinely depends on auth.
// Called from requireAuth() once currentAdmin is populated. Rebuilds from
// scratch every call, so unlike the old _injectSuperAdminNav()'s per-link
// double-injection guard, this is naturally idempotent.
function renderSidebar() {
    const nav = document.getElementById('sidebar-nav');
    if (!nav || !currentAdmin) return;

    const path = window.location.pathname;
    const canSeeModule = (m) => currentAdmin.role === 'super_admin'
        ? true
        : (m.requiresSuperAdmin ? false : !!currentAdmin.permissions?.[m.permission]);

    nav.innerHTML = MODULES
        .filter(canSeeModule)
        .map(m => `
            <div>
                <div class="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">${m.label}</div>
                ${m.items.map(item => {
                    const active = item.match.includes(path);
                    return `<a href="${item.href}" class="${SIDEBAR_LINK_BASE} ${active ? SIDEBAR_LINK_ACTIVE : SIDEBAR_LINK_IDLE}">${item.label}</a>`;
                }).join('')}
            </div>
        `).join('');

    // Full page navigation closes the drawer naturally on unload, but
    // closing explicitly avoids a visible flash of the open drawer during
    // a slow navigation.
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));
}

// Off-canvas sidebar toggle (mobile). Desktop (md:) keeps the sidebar
// permanently visible via md:translate-x-0, so these classes are only ever
// meaningful below that breakpoint.
function toggleNav() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        sidebar.classList.add('translate-x-0');
        document.getElementById('sidebar-backdrop')?.classList.remove('hidden');
    } else {
        closeNav();
    }
}

function closeNav() {
    document.getElementById('sidebar')?.classList.add('-translate-x-full');
    document.getElementById('sidebar')?.classList.remove('translate-x-0');
    document.getElementById('sidebar-backdrop')?.classList.add('hidden');
}

async function signInWithGoogle() {
    const btn = document.getElementById('google-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Menghubungi Google...'; }

    const { error } = await db.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/admin/kuliah/dashboard.html'
        }
    });
    if (error) {
        showToast('Gagal log masuk: ' + error.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Log Masuk dengan Google'; }
    }
}

async function signOut() {
    await db.auth.signOut();
    window.location.replace('/admin/index.html');
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

// Matches the "Bacaan Yasiin & Tahlil" special-case ustaz entry (also special-cased
// by name on the public kuliah/jadual/script.js page) regardless of Yasin/Yasiin spelling.
function isYasinEntry(ustaz) {
    if (!ustaz) return false;
    return /yasi+n/i.test(`${ustaz.short_name || ''} ${ustaz.full_name || ''}`);
}

function formatDateMY(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()} ${BULAN_MALAY[d.getMonth()]} ${d.getFullYear()} (${HARI_MALAY[d.getDay()]})`;
}

function formatDateTimeMY(iso) {
    const d = new Date(iso);
    return d.toLocaleString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatRelativeMY(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1)  return 'Baru sahaja';
    if (min < 60) return `${min} minit lalu`;
    const hr = Math.floor(min / 60);
    if (hr < 24)  return `${hr} jam lalu`;
    const day = Math.floor(hr / 24);
    if (day < 7)  return `${day} hari lalu`;
    const week = Math.floor(day / 7);
    if (day < 30) return `${week} minggu lalu`;
    const month = Math.floor(day / 30);
    return `${month} bulan lalu`;
}

// ─── Activity log ─────────────────────────────────────────────────────────────
// Fire-and-forget insert into activity_log (or infaq_activity_log — infaq is
// a deliberately separate table, see admin/setup.sql), called right after a
// mutating write already succeeded. Never throws/toasts — a logging failure
// must not make the admin think their actual save/delete/publish failed.
async function logActivity(action, targetLabel, detail, table = 'activity_log') {
    if (!currentAdmin) return;
    try {
        const { error } = await db.from(table).insert({
            actor_email:  currentAdmin.email,
            actor_name:   currentAdmin.name || null,
            action,
            target_label: targetLabel || null,
            detail:       detail || null,
        });
        if (error) console.error('logActivity gagal:', error.message);
    } catch (e) {
        console.error('logActivity gagal:', e);
    }
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
