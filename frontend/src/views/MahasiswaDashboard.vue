<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import AbsensiScanner from '../components/mahasiswa/AbsensiScanner.vue';
import KanbanBoard from '../components/mahasiswa/KanbanBoard.vue';
import LogbookProker from '../components/mahasiswa/LogbookProker.vue';
import FileExplorer from '../components/mahasiswa/FileExplorer.vue';
import SuratGenerator from '../components/SuratGenerator.vue';
import PengajuanReimbursement from '../components/mahasiswa/PengajuanReimbursement.vue';
import { useToast } from '../composables/useNotification.js';

const router = useRouter();
const { success: toastSuccess, error: toastError } = useToast();
const user = ref(null);
const token = ref(null);

const isLoading = ref(true);
const hasCheckedInToday = ref(false);
const absensiData = ref(null);

const prokerData = ref(null);
const isProkerLoading = ref(true);

const fileExplorerRef = ref(null);

const isDefaultPassword = ref(false);
const securityChecked = ref(false);
const alertDismissed = ref(false);
const showPasswordModal = ref(false);
const showSettingsMenu = ref(false);
const settingsBtnRef = ref(null);
const dropdownStyle = ref({});
const isSavingPassword = ref(false);
const passwordForm = ref({
  old_password: '',
  new_password: '',
  confirm_password: '',
});
const passwordError = ref('');

const showSecurityAlert = computed(() =>
  securityChecked.value && isDefaultPassword.value && !alertDismissed.value
);

onMounted(() => {
  user.value = JSON.parse(localStorage.getItem('user') || '{}');
  token.value = localStorage.getItem('token');
  
  if (!token.value) {
    router.push('/login');
    return;
  }

  const dismissKey = `mhs_pwd_alert_dismissed_${user.value?.id}`;
  alertDismissed.value = sessionStorage.getItem(dismissKey) === '1';
  
  checkAbsensiStatus();
  fetchProkerData();
  checkPasswordSecurity();

  document.addEventListener('click', closeSettingsMenu);
  window.addEventListener('resize', closeSettingsMenu);
  window.addEventListener('scroll', closeSettingsMenu, true);
});

const updateDropdownPosition = () => {
  const btn = settingsBtnRef.value;
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const menuWidth = Math.min(260, window.innerWidth - 24);
  let left = rect.left;
  if (left + menuWidth > window.innerWidth - 12) {
    left = window.innerWidth - menuWidth - 12;
  }
  if (left < 12) left = 12;
  dropdownStyle.value = {
    top: `${rect.bottom + 8}px`,
    left: `${left}px`,
    width: `${menuWidth}px`,
  };
};

const toggleSettingsMenu = async () => {
  if (showSettingsMenu.value) {
    showSettingsMenu.value = false;
    return;
  }
  await nextTick();
  updateDropdownPosition();
  showSettingsMenu.value = true;
};

const closeSettingsMenu = () => {
  showSettingsMenu.value = false;
};

const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  router.push('/login');
};

const checkPasswordSecurity = async () => {
  try {
    const res = await fetch('/api/mahasiswa/profile/security', {
      headers: { Authorization: `Bearer ${token.value}` },
    });
    if (res.ok) {
      const data = await res.json();
      isDefaultPassword.value = !!data.isDefaultPassword;
    }
  } catch (e) {
    console.error('Gagal cek keamanan password:', e);
  } finally {
    securityChecked.value = true;
  }
};

const dismissSecurityAlert = () => {
  alertDismissed.value = true;
  sessionStorage.setItem(`mhs_pwd_alert_dismissed_${user.value?.id}`, '1');
};

const openPasswordModal = () => {
  passwordForm.value = { old_password: '', new_password: '', confirm_password: '' };
  passwordError.value = '';
  showPasswordModal.value = true;
  showSettingsMenu.value = false;
};

const submitPasswordChange = async () => {
  passwordError.value = '';
  const { old_password, new_password, confirm_password } = passwordForm.value;

  if (!old_password || !new_password || !confirm_password) {
    passwordError.value = 'Semua field wajib diisi.';
    return;
  }
  if (new_password.length < 6) {
    passwordError.value = 'Password baru minimal 6 karakter.';
    return;
  }
  if (new_password === user.value?.nim) {
    passwordError.value = 'Password baru tidak boleh sama dengan NIM.';
    return;
  }
  if (new_password !== confirm_password) {
    passwordError.value = 'Konfirmasi password tidak cocok.';
    return;
  }

  isSavingPassword.value = true;
  try {
    const res = await fetch('/api/mahasiswa/profile/password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token.value}`,
      },
      body: JSON.stringify({ old_password, new_password }),
    });
    const data = await res.json();
    if (res.ok) {
      toastSuccess(data.message || 'Password berhasil diperbarui!');
      isDefaultPassword.value = false;
      showPasswordModal.value = false;
      alertDismissed.value = true;
    } else {
      passwordError.value = data.message || 'Gagal mengubah password.';
    }
  } catch (e) {
    passwordError.value = 'Terjadi kesalahan jaringan.';
  } finally {
    isSavingPassword.value = false;
  }
};

const checkAbsensiStatus = async () => {
  try {
    const res = await fetch('/api/mahasiswa/absensi/status', {
      headers: { 'Authorization': `Bearer ${token.value}` }
    });
    
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }
    
    const data = await res.json();
    hasCheckedInToday.value = data.hasCheckedInToday;
    if (data.hasCheckedInToday) {
      absensiData.value = data.data;
    }
  } catch (error) {
    console.error('Gagal cek status absensi:', error);
  } finally {
    isLoading.value = false;
  }
};

const fetchProkerData = async () => {
  try {
    const res = await fetch('/api/mahasiswa/proker', {
      headers: { 'Authorization': `Bearer ${token.value}` }
    });
    if (res.ok) {
      const data = await res.json();
      prokerData.value = data.proker;
    }
  } catch (err) {
    console.error('Failed to load proker data:', err);
  } finally {
    isProkerLoading.value = false;
  }
};

const refreshExplorer = () => {
  if (fileExplorerRef.value) {
    fileExplorerRef.value.refresh();
  }
};

onUnmounted(() => {
  document.removeEventListener('click', closeSettingsMenu);
  window.removeEventListener('resize', closeSettingsMenu);
  window.removeEventListener('scroll', closeSettingsMenu, true);
});
</script>

<template>
  <div class="mhs-wrapper">
    <!-- NAVBAR -->
    <header class="mhs-navbar">
      <div class="nav-brand">
        <span class="nav-icon">👨‍🎓</span>
        <div>
          <div class="nav-title">Dashboard Mahasiswa</div>
          <div class="nav-sub">{{ user?.nama_lengkap }}</div>
        </div>
      </div>
      <div class="nav-actions">
        <div class="settings-wrap">
          <button
            ref="settingsBtnRef"
            type="button"
            class="btn-settings"
            :class="{ 'btn-settings--warn': isDefaultPassword }"
            @click.stop="toggleSettingsMenu"
            aria-label="Pengaturan Akun"
            aria-haspopup="true"
            :aria-expanded="showSettingsMenu"
          >
            ⚙️
            <span v-if="isDefaultPassword" class="settings-dot"></span>
          </button>
        </div>
        <router-link v-if="user?.jabatan === 'Bendahara'" to="/bendahara" class="btn-logout" style="background: #f59e0b; color: white; border-color: #f59e0b; text-decoration: none;">Ke Dashboard Bendahara</router-link>
        <router-link v-if="user?.role === 'admin'" to="/admin" class="btn-logout" style="background: var(--color-primary); color: white; text-decoration: none;">Ke Dashboard Admin</router-link>
        <button @click="logout" class="btn-logout">Logout</button>
      </div>
    </header>

    <!-- Security alert: default password -->
    <Transition name="alert-slide">
      <div v-if="showSecurityAlert" class="security-alert">
        <div class="security-alert-glow"></div>
        <div class="security-alert-inner">
          <div class="security-alert-icon">🛡️</div>
          <div class="security-alert-body">
            <strong>Akun Anda masih menggunakan password default</strong>
            <p>
              Password saat ini sama dengan NIM (<code>{{ user?.nim }}</code>).
              Demi keamanan data KKN, segera ganti password melalui pengaturan akun.
            </p>
          </div>
          <div class="security-alert-actions">
            <button type="button" class="btn-alert-primary" @click="openPasswordModal">Ganti Password</button>
            <button type="button" class="btn-alert-ghost" @click="dismissSecurityAlert">Nanti saja</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Password change modal -->
    <Teleport to="body">
      <Transition name="menu-fade">
        <div v-if="showSettingsMenu" class="settings-dropdown settings-dropdown--portal" :style="dropdownStyle" @click.stop>
          <div class="settings-dropdown-header">Pengaturan Akun</div>
          <button type="button" class="settings-item" @click="openPasswordModal">
            🔒 Ganti Password
          </button>
          <button v-if="isDefaultPassword" type="button" class="settings-item settings-item--warn" @click="openPasswordModal">
            ⚠️ Password masih default (NIM)
          </button>
        </div>
      </Transition>
      <Transition name="modal-fade">
        <div v-if="showPasswordModal" class="pwd-modal-backdrop" @click.self="showPasswordModal = false">
          <div class="pwd-modal">
            <div class="pwd-modal-header">
              <span class="pwd-modal-icon">🔐</span>
              <div>
                <h3>Ganti Password</h3>
                <p v-if="isDefaultPassword" class="pwd-modal-hint">Password default (NIM) tidak aman — buat password baru.</p>
                <p v-else class="pwd-modal-hint">Perbarui password akun KKN Anda.</p>
              </div>
              <button type="button" class="pwd-modal-close" @click="showPasswordModal = false">✕</button>
            </div>
            <form class="pwd-form" @submit.prevent="submitPasswordChange">
              <div class="pwd-field">
                <label>Password Lama</label>
                <input
                  v-model="passwordForm.old_password"
                  type="password"
                  autocomplete="current-password"
                  :placeholder="isDefaultPassword ? 'Masukkan NIM Anda' : 'Password saat ini'"
                />
              </div>
              <div class="pwd-field">
                <label>Password Baru</label>
                <input
                  v-model="passwordForm.new_password"
                  type="password"
                  autocomplete="new-password"
                  placeholder="Min. 6 karakter, bukan NIM"
                />
              </div>
              <div class="pwd-field">
                <label>Konfirmasi Password Baru</label>
                <input
                  v-model="passwordForm.confirm_password"
                  type="password"
                  autocomplete="new-password"
                  placeholder="Ulangi password baru"
                />
              </div>
              <p v-if="passwordError" class="pwd-error">{{ passwordError }}</p>
              <div class="pwd-actions">
                <button type="button" class="btn-pwd-cancel" @click="showPasswordModal = false">Batal</button>
                <button type="submit" class="btn-pwd-save" :disabled="isSavingPassword">
                  {{ isSavingPassword ? 'Menyimpan...' : 'Simpan Password' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <main class="mhs-main">
      <!-- LEFT COLUMN -->
      <div class="mhs-left-column">
        <!-- LOADING ABSENSI -->
        <div v-if="isLoading" class="status-card loading-card">
          <div class="spinner"></div>
          <p>Memuat status absensi hari ini...</p>
        </div>

        <!-- ABSENSI SCANNER COMPONENT -->
        <AbsensiScanner 
          v-else
          :token="token" 
          :hasCheckedInToday="hasCheckedInToday" 
          :absensiData="absensiData" 
          @refresh-absensi="checkAbsensiStatus" 
        />
        
        <template v-if="isProkerLoading">
           <div class="status-card loading-card" style="margin-top: 2rem;">
            <div class="spinner"></div>
            <p>Memuat data proker...</p>
          </div>
        </template>
        <template v-else-if="prokerData">
          <!-- FILE EXPLORER COMPONENT -->
          <div style="margin-top: 2rem;">
            <FileExplorer ref="fileExplorerRef" :token="token" :prokerData="prokerData" />
          </div>

          <!-- SURAT GENERATOR COMPONENT -->
          <div class="status-card" style="margin-top: 2rem; padding: 0; overflow: hidden; max-width: 100%;">
            <SuratGenerator />
          </div>
        </template>
      </div> <!-- END LEFT COLUMN -->

      <!-- RIGHT COLUMN (PROKER KANBAN & LOGBOOK) -->
      <div class="mhs-right-column">
        <template v-if="prokerData">
          <div class="proker-sections" style="width: 100%; display: flex; flex-direction: column; gap: 2rem;">
            
            <!-- KANBAN BOARD COMPONENT -->
            <KanbanBoard :token="token" :prokerData="prokerData" />

            <!-- LOGBOOK COMPONENT -->
            <LogbookProker :token="token" :prokerData="prokerData" :user="user" @refresh-explorer="refreshExplorer" />
            
            <!-- PENGAJUAN REIMBURSEMENT COMPONENT -->
            <PengajuanReimbursement :token="token" />
          </div>
        </template>
      </div> <!-- END RIGHT COLUMN -->
    </main>
  </div>
</template>

<style scoped>
.mhs-wrapper {
  min-height: 100vh;
  background: var(--bg-color);
  font-family: var(--font-sans);
  color: var(--text-main);
  padding-bottom: 3rem;
  overflow-x: hidden;
}

.mhs-navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 3rem;
  background: white;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.nav-icon {
  font-size: 2.2rem;
  background: #f1f5f9;
  padding: 0.5rem;
  border-radius: 12px;
}

.nav-title {
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--text-main);
}

.nav-sub {
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 500;
}

.btn-logout {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  padding: 0.6rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.95rem;
}

.btn-logout:hover {
  background: #fef2f2;
  color: #ef4444;
  border-color: #ef4444;
}

.mhs-main {
  max-width: 1400px;
  margin: 3rem auto 0;
  padding: 0 2rem;
  display: flex;
  gap: 3rem;
  align-items: flex-start;
}

.mhs-left-column {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 600px;
}

.mhs-right-column {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  max-width: 100%;
}

.status-card {
  width: 100%;
  max-width: 100%;
  background: white;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  border: 2px solid transparent;
}

.file-section {
  background: white;
  padding: 2.5rem;
  border-radius: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.03);
  border: 1px solid var(--border-color);
  width: 100%;
  box-sizing: border-box;
}

.nav-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

@media (max-width: 900px) {
  .mhs-main {
    flex-direction: column;
    padding: 0 1rem;
    gap: 2rem;
    margin: 2rem auto 0;
    align-items: stretch;
  }
  .mhs-left-column {
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .mhs-navbar {
    flex-direction: column;
    padding: 1.5rem 1rem;
    gap: 1.5rem;
    align-items: flex-start;
  }
  .nav-actions {
    flex-wrap: wrap;
    width: 100%;
  }
  .nav-actions .btn-logout {
    flex: 1;
    text-align: center;
    font-size: 0.85rem;
    padding: 0.6rem 0.5rem;
  }
  .file-section {
    padding: 1.5rem;
  }
}

.loading-card { border-color: var(--border-color); color: var(--text-muted); padding: 3rem 2.5rem; text-align: center; }

.spinner {
  width: 36px; height: 36px;
  border: 3px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ─── Security alert ─── */
.security-alert {
  position: relative;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem;
  margin-top: 1.25rem;
}

.security-alert-inner {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  flex-wrap: wrap;
  padding: 1.25rem 1.5rem;
  border-radius: 18px;
  background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 45%, #fef3c7 100%);
  border: 1px solid rgba(245, 158, 11, 0.35);
  box-shadow: 0 12px 40px rgba(245, 158, 11, 0.12);
  overflow: hidden;
}

.security-alert-glow {
  position: absolute;
  top: -40px;
  right: -40px;
  width: 120px;
  height: 120px;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.35) 0%, transparent 70%);
  pointer-events: none;
}

.security-alert-icon {
  font-size: 2rem;
  line-height: 1;
  flex-shrink: 0;
}

.security-alert-body {
  flex: 1;
  min-width: 220px;
}

.security-alert-body strong {
  display: block;
  font-size: 1.05rem;
  color: #9a3412;
  margin-bottom: 0.35rem;
}

.security-alert-body p {
  margin: 0;
  font-size: 0.9rem;
  color: #b45309;
  line-height: 1.55;
}

.security-alert-body code {
  background: rgba(255, 255, 255, 0.7);
  padding: 0.1rem 0.4rem;
  border-radius: 6px;
  font-size: 0.85em;
  color: #92400e;
}

.security-alert-actions {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
  align-items: center;
  flex-shrink: 0;
}

.btn-alert-primary {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
  border: none;
  padding: 0.65rem 1.25rem;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(217, 119, 6, 0.35);
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-alert-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(217, 119, 6, 0.4);
}

.btn-alert-ghost {
  background: transparent;
  border: 1px solid rgba(180, 83, 9, 0.35);
  color: #b45309;
  padding: 0.65rem 1rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-alert-ghost:hover {
  background: rgba(255, 255, 255, 0.5);
}

.alert-slide-enter-active,
.alert-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.alert-slide-enter-from,
.alert-slide-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

/* ─── Settings dropdown ─── */
.settings-wrap {
  position: relative;
}

.btn-settings {
  position: relative;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: #f8fafc;
  font-size: 1.15rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-settings:hover {
  background: white;
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.btn-settings--warn {
  border-color: #fcd34d;
  background: #fffbeb;
}

.settings-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  border: 2px solid white;
}

.settings-dropdown {
  background: white;
  border-radius: 14px;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.14);
  border: 1px solid #e2e8f0;
  overflow: hidden;
  z-index: 10001;
}

.settings-dropdown--portal {
  position: fixed;
}

.settings-dropdown-header {
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #94a3b8;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
}

.settings-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.85rem 1rem;
  border: none;
  background: white;
  font-size: 0.9rem;
  font-weight: 500;
  color: #334155;
  cursor: pointer;
  transition: background 0.15s;
}

.settings-item:hover {
  background: #f1f5f9;
}

.settings-item--warn {
  color: #b45309;
  background: #fffbeb;
  border-top: 1px solid #fef3c7;
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ─── Password modal ─── */
.pwd-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(6px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.pwd-modal {
  background: white;
  border-radius: 20px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.pwd-modal-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.5rem 1.5rem 0;
  position: relative;
}

.pwd-modal-icon {
  font-size: 2rem;
  line-height: 1;
}

.pwd-modal-header h3 {
  margin: 0 0 0.25rem;
  font-size: 1.2rem;
  color: #0f172a;
}

.pwd-modal-hint {
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
}

.pwd-modal-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 1.1rem;
  color: #94a3b8;
  cursor: pointer;
  padding: 0.25rem;
}

.pwd-modal-close:hover {
  color: #0f172a;
}

.pwd-form {
  padding: 1.25rem 1.5rem 1.5rem;
}

.pwd-field {
  margin-bottom: 1rem;
}

.pwd-field label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.4rem;
}

.pwd-field input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.95rem;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.pwd-field input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 187, 151, 0.15);
}

.pwd-error {
  margin: 0 0 1rem;
  padding: 0.65rem 0.85rem;
  background: #fef2f2;
  color: #b91c1c;
  border-radius: 8px;
  font-size: 0.88rem;
}

.pwd-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.btn-pwd-cancel {
  padding: 0.7rem 1.25rem;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  font-weight: 600;
  cursor: pointer;
}

.btn-pwd-save {
  padding: 0.7rem 1.35rem;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, var(--color-primary), #059669);
  color: white;
  font-weight: 700;
  cursor: pointer;
  transition: filter 0.2s;
}

.btn-pwd-save:hover:not(:disabled) {
  filter: brightness(1.05);
}

.btn-pwd-save:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .security-alert {
    padding: 0 1rem;
  }
  .security-alert-inner {
    flex-direction: column;
  }
  .security-alert-actions {
    width: 100%;
  }
  .btn-alert-primary,
  .btn-alert-ghost {
    flex: 1;
    text-align: center;
  }
}

@media (max-width: 1100px) {
  .mhs-main {
    flex-direction: column;
    align-items: center;
  }
  .mhs-left-column {
    max-width: 100%;
  }
}
</style>
