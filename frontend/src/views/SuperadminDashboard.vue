<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';

// ─── Tab Components ───────────────────────────────────────────────────────
import SAOverview from '../components/superadmin/SAOverview.vue';
import SAPosko from '../components/superadmin/SAPosko.vue';
import SAUsers from '../components/superadmin/SAUsers.vue';
import SAResetPassword from '../components/superadmin/SAResetPassword.vue';
import SAAbsensi from '../components/superadmin/SAAbsensi.vue';
import SuperAdminFileExplorer from '../components/superadmin/SuperAdminFileExplorer.vue';

const router = useRouter();
const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

// ─── Navigation ───────────────────────────────────────────────────────────
const activeTab = ref('overview');
const sidebarCollapsed = ref(false);
const navItems = [
  { id: 'overview', icon: '📊', label: 'Ringkasan' },
  { id: 'posko', icon: '🏠', label: 'Manajemen Posko' },
  { id: 'users', icon: '👥', label: 'Manajemen Pengguna' },
  { id: 'reset', icon: '🔑', label: 'Reset Password' },
  { id: 'explorer', icon: '📁', label: 'File Explorer' },
  { id: 'absensi', icon: '📋', label: 'Laporan Global' },
];

// ─── Global Stats (dibutuhkan di Overview) ────────────────────────────────
const stats = ref({ totalPosko: 0, totalAdmin: 0, totalMahasiswa: 0, hadirHariIni: 0, poskoStats: [] });
const statsLoading = ref(true);

const fetchStats = async () => {
  statsLoading.value = true;
  try {
    const res = await fetch('/api/superadmin/stats', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) stats.value = await res.json();
  } catch (e) { console.error(e); }
  finally { statsLoading.value = false; }
};

// ─── GDrive Status (dibutuhkan di Overview & SAPosko) ────────────────────
const gdriveStatus = ref({ connected: false });
const fetchGDriveStatus = async () => {
  try {
    const res = await fetch('/api/backup/status', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      gdriveStatus.value.connected = data.connected;
    }
  } catch (e) { console.error('Failed to fetch GDrive status', e); }
};

const connectGDrive = async () => {
  try {
    const res = await fetch('/api/google/auth', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('Eror dari peladen: ' + (data.message || 'URL koneksi tidak ditemukan.'));
    }
  } catch (e) { alert('Gagal menghubungi Google: ' + e.message); }
};

// ─── Shared poskoList (digunakan SAUsers & SAAbsensi sebagai prop) ────────
// SAPosko meng-expose poskoList-nya, kita sinkronkan di sini.
const poskoRef = ref(null);
const usersRef = ref(null);
const resetRef = ref(null);
const absensiRef = ref(null);

// Getter reaktif untuk poskoList dari komponen SAPosko
const sharedPoskoList = ref([]);

const onPoskoDataChanged = async () => {
  await fetchStats();
  // Sync poskoList untuk diteruskan ke SAUsers & SAAbsensi
  if (poskoRef.value) {
    sharedPoskoList.value = poskoRef.value.poskoList;
  }
};

// ─── Modal: Ganti Password (global, dipicu dari sidebar & header) ─────────
const showPasswordModal = ref(false);
const passwordForm = ref({ old_password: '', new_password: '', confirm_password: '' });
const passwordError = ref('');
const passwordSaving = ref(false);
const passwordSuccess = ref('');

const changePassword = async () => {
  passwordError.value = ''; passwordSuccess.value = '';
  if (!passwordForm.value.old_password || !passwordForm.value.new_password) { passwordError.value = 'Semua field wajib diisi.'; return; }
  if (passwordForm.value.new_password !== passwordForm.value.confirm_password) { passwordError.value = 'Konfirmasi password tidak cocok.'; return; }
  if (passwordForm.value.new_password.length < 6) { passwordError.value = 'Password baru minimal 6 karakter.'; return; }
  passwordSaving.value = true;
  try {
    const res = await fetch('/api/superadmin/profile/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ old_password: passwordForm.value.old_password, new_password: passwordForm.value.new_password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    passwordSuccess.value = 'Password berhasil diperbarui!';
    passwordForm.value = { old_password: '', new_password: '', confirm_password: '' };
  } catch (e) { passwordError.value = e.message; }
  finally { passwordSaving.value = false; }
};

const closePasswordModal = () => {
  showPasswordModal.value = false;
  passwordSuccess.value = '';
  passwordError.value = '';
};

// ─── Lifecycle ────────────────────────────────────────────────────────────
const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  router.push('/login');
};

const switchTab = async (tab) => {
  activeTab.value = tab;
  await nextTick();
  if (tab === 'absensi' && absensiRef.value) await absensiRef.value.fetchAbsensi();
  if (tab === 'reset' && resetRef.value) await resetRef.value.fetchResetRequests();
  if (tab === 'users' && usersRef.value) await usersRef.value.fetchUsers();
};

onMounted(async () => {
  if (Object.keys(currentUser).length === 0 || currentUser.role !== 'superadmin') {
    router.push('/login');
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('gdrive') === 'success') {
    alert('Google Drive Failsafe berhasil dikaitkan!');
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  await Promise.all([fetchStats(), fetchGDriveStatus()]);

  // Fetch poskoList dari SAPosko setelah komponen mount
  if (poskoRef.value) {
    await poskoRef.value.fetchPosko();
    sharedPoskoList.value = poskoRef.value.poskoList;
  }
  if (usersRef.value) await usersRef.value.fetchUsers();
  if (resetRef.value) await resetRef.value.fetchResetRequests();
});
</script>

<template>
  <div class="sa-app">
    <!-- Sidebar -->
    <aside class="sa-sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sa-sidebar-header">
        <div class="sa-brand" v-if="!sidebarCollapsed">
          <span class="sa-brand-icon">⚡</span>
          <div>
            <div class="sa-brand-title">KKN Control</div>
            <div class="sa-brand-sub">Super Admin Panel</div>
          </div>
        </div>
        <span v-else class="sa-brand-icon-only">⚡</span>
        <button class="sa-collapse-btn" @click="sidebarCollapsed = !sidebarCollapsed" :title="sidebarCollapsed ? 'Expand' : 'Collapse'">
          {{ sidebarCollapsed ? '›' : '‹' }}
        </button>
      </div>

      <nav class="sa-nav">
        <button
          v-for="item in navItems" :key="item.id"
          class="sa-nav-item" :class="{ active: activeTab === item.id }"
          @click="switchTab(item.id)" :title="item.label"
        >
          <span class="sa-nav-icon">{{ item.icon }}</span>
          <span class="sa-nav-label" v-if="!sidebarCollapsed">{{ item.label }}</span>
        </button>
      </nav>

      <div class="sa-sidebar-footer">
        <button class="sa-nav-item" @click="showPasswordModal = true" title="Ganti Password">
          <span class="sa-nav-icon">🔑</span>
          <span class="sa-nav-label" v-if="!sidebarCollapsed">Ganti Password</span>
        </button>
        <button class="sa-nav-item logout" @click="logout" title="Keluar">
          <span class="sa-nav-icon">🚪</span>
          <span class="sa-nav-label" v-if="!sidebarCollapsed">Keluar</span>
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="sa-main">
      <!-- Header -->
      <header class="sa-header">
        <div class="sa-header-left">
          <h1 class="sa-page-title">
            {{ navItems.find(n => n.id === activeTab)?.icon }}
            {{ navItems.find(n => n.id === activeTab)?.label }}
          </h1>
        </div>
        <div class="sa-header-right" style="display:flex; gap:0.5rem; align-items:center;">
          <button class="sa-btn sa-btn-outline sa-btn-sm sa-mobile-only" @click="showPasswordModal = true" title="Ganti Password">🔑</button>
          <div class="sa-user-badge">
            <span class="sa-user-avatar">👑</span>
            <span class="sa-user-name">{{ currentUser.nama_lengkap || 'Superadmin' }}</span>
          </div>
          <button class="sa-btn sa-btn-danger sa-btn-sm sa-mobile-only" @click="logout" title="Keluar">🚪</button>
        </div>
      </header>

      <!-- ─── TAB: Overview ────────────────────────────────────── -->
      <SAOverview
        v-if="activeTab === 'overview'"
        :stats="stats"
        :stats-loading="statsLoading"
        :gdrive-connected="gdriveStatus.connected"
        @go-to-posko="switchTab('posko')"
        @connect-gdrive="connectGDrive"
      />

      <!-- ─── TAB: Posko ───────────────────────────────────────── -->
      <SAPosko
        v-show="activeTab === 'posko'"
        ref="poskoRef"
        :token="token"
        :gdrive-connected="gdriveStatus.connected"
        @data-changed="onPoskoDataChanged"
      />

      <!-- ─── TAB: Users ───────────────────────────────────────── -->
      <SAUsers
        v-if="activeTab === 'users'"
        ref="usersRef"
        :token="token"
        :posko-list="sharedPoskoList"
        @data-changed="fetchStats"
      />

      <!-- ─── TAB: Reset Password ──────────────────────────────── -->
      <SAResetPassword
        v-if="activeTab === 'reset'"
        ref="resetRef"
        :token="token"
      />

      <!-- ─── TAB: File Explorer ───────────────────────────────── -->
      <SuperAdminFileExplorer v-if="activeTab === 'explorer'" :token="token" />

      <!-- ─── TAB: Absensi ─────────────────────────────────────── -->
      <SAAbsensi
        v-if="activeTab === 'absensi'"
        ref="absensiRef"
        :token="token"
        :posko-list="sharedPoskoList"
      />
    </main>

    <!-- ─── MODAL GLOBAL: Ganti Password ──────────────────── -->
    <div class="sa-modal-overlay" v-if="showPasswordModal" @click.self="closePasswordModal">
      <div class="sa-modal">
        <div class="sa-modal-header">
          <h3>🔑 Ganti Password Superadmin</h3>
          <button class="sa-modal-close" @click="closePasswordModal">✕</button>
        </div>
        <div class="sa-modal-body">
          <div class="sa-form-group">
            <label>Password Lama</label>
            <input type="password" class="sa-input" v-model="passwordForm.old_password" />
          </div>
          <div class="sa-form-group">
            <label>Password Baru</label>
            <input type="password" class="sa-input" v-model="passwordForm.new_password" />
          </div>
          <div class="sa-form-group">
            <label>Konfirmasi Password Baru</label>
            <input type="password" class="sa-input" v-model="passwordForm.confirm_password" />
          </div>
          <div v-if="passwordError" class="sa-alert sa-alert-danger">{{ passwordError }}</div>
          <div v-if="passwordSuccess" class="sa-alert sa-alert-success">{{ passwordSuccess }}</div>
        </div>
        <div class="sa-modal-footer">
          <button class="sa-btn sa-btn-outline" @click="closePasswordModal">Tutup</button>
          <button class="sa-btn sa-btn-primary" @click="changePassword" :disabled="passwordSaving">
            <span v-if="passwordSaving" class="sa-spinner"></span>
            {{ passwordSaving ? 'Menyimpan...' : 'Perbarui Password' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ─── CSS VARIABLES ─────────────────────────────────────── */
:root {
  --sa-bg: #0f172a;
  --sa-surface: #1e293b;
  --sa-surface2: #334155;
  --sa-border: rgba(148,163,184,0.15);
  --sa-text: #f1f5f9;
  --sa-text-muted: #94a3b8;
  --sa-indigo: #6366f1;
  --sa-indigo-light: #818cf8;
  --sa-violet: #8b5cf6;
  --sa-cyan: #06b6d4;
  --sa-emerald: #10b981;
  --sa-red: #ef4444;
  --sa-amber: #f59e0b;
}

/* ─── LAYOUT ────────────────────────────────────────────── */
.sa-app {
  display: flex;
  min-height: 100vh;
  background: #0f172a;
  color: #f1f5f9;
  font-family: 'Inter', 'Segoe UI', sans-serif;
}

/* ─── SIDEBAR ───────────────────────────────────────────── */
.sa-sidebar {
  width: 260px;
  min-height: 100vh;
  background: #0d1424;
  border-right: 1px solid rgba(99,102,241,0.2);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  position: sticky;
  top: 0;
  overflow: hidden;
  z-index: 100;
}

.sa-sidebar.collapsed { width: 72px; }

.sa-sidebar-header {
  padding: 1.5rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(99,102,241,0.15);
}

.sa-brand { display: flex; align-items: center; gap: 0.75rem; }
.sa-brand-icon { font-size: 1.8rem; }
.sa-brand-icon-only { font-size: 1.8rem; display: block; text-align: center; width: 100%; }
.sa-brand-title { font-size: 1rem; font-weight: 700; color: #f1f5f9; }
.sa-brand-sub { font-size: 0.7rem; color: #6366f1; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }

.sa-collapse-btn {
  background: none; border: 1px solid rgba(99,102,241,0.3); color: #94a3b8;
  width: 28px; height: 28px; border-radius: 6px; cursor: pointer;
  font-size: 1.1rem; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s ease; flex-shrink: 0;
}
.sa-collapse-btn:hover { background: rgba(99,102,241,0.2); color: #f1f5f9; }

.sa-nav { flex: 1; padding: 1rem 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; }
.sa-sidebar-footer { padding: 1rem 0.75rem; border-top: 1px solid rgba(99,102,241,0.15); display: flex; flex-direction: column; gap: 0.25rem; }

.sa-nav-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem 1rem; border-radius: 10px; border: none;
  background: transparent; color: #94a3b8; cursor: pointer;
  transition: all 0.2s ease; text-align: left; width: 100%;
  white-space: nowrap; overflow: hidden;
}
.sa-nav-item:hover { background: rgba(99,102,241,0.1); color: #f1f5f9; }
.sa-nav-item.active { background: rgba(99,102,241,0.2); color: #818cf8; font-weight: 600; }
.sa-nav-item.logout:hover { background: rgba(239,68,68,0.1); color: #ef4444; }

.sa-nav-icon { font-size: 1.2rem; flex-shrink: 0; }
.sa-nav-label { font-size: 0.9rem; }

/* ─── MAIN ──────────────────────────────────────────────── */
.sa-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

.sa-header {
  padding: 1.5rem 2rem;
  background: #0d1424;
  border-bottom: 1px solid rgba(99,102,241,0.15);
  display: flex; align-items: center; justify-content: space-between;
  position: sticky; top: 0; z-index: 50;
}

.sa-page-title { font-size: 1.4rem; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 0.5rem; }

.sa-user-badge {
  display: flex; align-items: center; gap: 0.75rem;
  background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2);
  padding: 0.5rem 1rem; border-radius: 30px;
}
.sa-user-avatar { font-size: 1.2rem; }
.sa-user-name { font-size: 0.9rem; font-weight: 600; color: #818cf8; }

/* ─── MODAL (global - password modal) ──────────────────── */
.sa-modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease;
}

.sa-modal {
  background: #1e293b; border-radius: 20px; width: 100%; max-width: 560px;
  border: 1px solid rgba(99,102,241,0.2); box-shadow: 0 25px 60px rgba(0,0,0,0.5);
  max-height: 90vh; overflow-y: auto; margin: 1rem;
  animation: slideUp 0.3s ease;
}

.sa-modal-header {
  padding: 1.5rem 2rem; border-bottom: 1px solid rgba(148,163,184,0.1);
  display: flex; align-items: center; justify-content: space-between;
  position: sticky; top: 0; background: #1e293b; z-index: 1;
}
.sa-modal-header h3 { margin: 0; font-size: 1.15rem; font-weight: 700; }
.sa-modal-close { background: none; border: none; color: #94a3b8; font-size: 1.3rem; cursor: pointer; padding: 0.25rem; }
.sa-modal-close:hover { color: #ef4444; }

.sa-modal-body { padding: 1.5rem 2rem; }
.sa-modal-footer {
  padding: 1.25rem 2rem; border-top: 1px solid rgba(148,163,184,0.1);
  display: flex; justify-content: flex-end; gap: 0.75rem;
  position: sticky; bottom: 0; background: #1e293b;
}

/* ─── FORM (password modal) ─────────────────────────────── */
.sa-form-group { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.sa-form-group:last-of-type { margin-bottom: 0; }
.sa-form-group label { font-size: 0.85rem; font-weight: 600; color: #94a3b8; }

.sa-input {
  background: #0f172a; border: 1.5px solid rgba(148,163,184,0.2);
  border-radius: 10px; padding: 0.75rem 1rem; color: #f1f5f9;
  font-size: 0.9rem; font-family: inherit; transition: all 0.2s ease; width: 100%;
  box-sizing: border-box;
}
.sa-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }

/* ─── BUTTONS ───────────────────────────────────────────── */
.sa-btn {
  padding: 0.6rem 1.25rem; border-radius: 10px; font-size: 0.9rem; font-weight: 600;
  border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem;
  transition: all 0.2s ease; white-space: nowrap;
}
.sa-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
.sa-btn-primary { background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; box-shadow: 0 4px 15px rgba(99,102,241,0.3); }
.sa-btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(99,102,241,0.5); }
.sa-btn-outline { background: transparent; border: 1.5px solid rgba(148,163,184,0.3); color: #94a3b8; }
.sa-btn-outline:hover:not(:disabled) { border-color: #6366f1; color: #818cf8; }
.sa-btn-danger { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; }
.sa-btn-sm { padding: 0.4rem 0.85rem; font-size: 0.8rem; border-radius: 8px; }

/* ─── ALERTS ────────────────────────────────────────────── */
.sa-alert { padding: 0.85rem 1rem; border-radius: 10px; font-size: 0.9rem; font-weight: 500; margin-top: 0.75rem; }
.sa-alert-danger { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #f87171; }
.sa-alert-success { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: #34d399; }

/* ─── SPINNER ───────────────────────────────────────────── */
.sa-spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white; border-radius: 50%;
  animation: spin 0.8s infinite linear;
}

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

/* ─── RESPONSIVE MOBILE ─────────────────────────────────── */
.sa-mobile-only { display: none; }

@media (max-width: 768px) {
  .sa-mobile-only { display: inline-flex; }
  .sa-user-name { display: none; }

  .sa-app { padding-bottom: 70px; }
  .sa-sidebar {
    position: fixed; bottom: 0; top: auto; left: 0; right: 0;
    width: 100% !important; height: 70px; min-height: 70px;
    flex-direction: row; border-right: none; border-top: 1px solid rgba(99,102,241,0.2);
    z-index: 1000; box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
  }
  .sa-sidebar-header { display: none; }
  .sa-sidebar-footer { display: none; }
  .sa-nav { flex-direction: row; width: 100%; justify-content: space-around; padding: 0; align-items: center; gap: 0; }
  .sa-nav-item { flex-direction: column; gap: 0.2rem; padding: 0.5rem; align-items: center; justify-content: center; border-radius: 0; }
  .sa-nav-label { display: block !important; font-size: 0.65rem; }

  .sa-header { padding: 1rem; flex-direction: row; gap: 0.5rem; flex-wrap: wrap; }
  .sa-page-title { font-size: 1.1rem; }

  .sa-modal { margin: 0.5rem; max-height: 85vh; }
  .sa-modal-header, .sa-modal-body, .sa-modal-footer { padding: 1rem; }
}
</style>
