<script setup>
/**
 * SAOverview.vue
 * Tab Ringkasan di SuperAdmin Dashboard.
 * Menampilkan: stat cards, kartu GDrive failsafe, dan status per posko.
 */
const props = defineProps({
  stats: { type: Object, required: true },
  statsLoading: { type: Boolean, default: false },
  gdriveConnected: { type: Boolean, default: false },
});
const emit = defineEmits(['go-to-posko', 'connect-gdrive']);
</script>

<template>
  <div class="sa-content">
    <!-- Stat Cards -->
    <div class="sa-stats-grid">
      <div class="sa-stat-card indigo">
        <div class="sa-stat-icon">🏠</div>
        <div class="sa-stat-body">
          <div class="sa-stat-value">{{ statsLoading ? '—' : stats.totalPosko }}</div>
          <div class="sa-stat-label">Total Posko</div>
        </div>
      </div>
      <div class="sa-stat-card violet">
        <div class="sa-stat-icon">👨‍💼</div>
        <div class="sa-stat-body">
          <div class="sa-stat-value">{{ statsLoading ? '—' : stats.totalAdmin }}</div>
          <div class="sa-stat-label">Admin Posko</div>
        </div>
      </div>
      <div class="sa-stat-card cyan">
        <div class="sa-stat-icon">🎓</div>
        <div class="sa-stat-body">
          <div class="sa-stat-value">{{ statsLoading ? '—' : stats.totalMahasiswa }}</div>
          <div class="sa-stat-label">Mahasiswa</div>
        </div>
      </div>
      <div class="sa-stat-card emerald">
        <div class="sa-stat-icon">✅</div>
        <div class="sa-stat-body">
          <div class="sa-stat-value">{{ statsLoading ? '—' : stats.hadirHariIni }}</div>
          <div class="sa-stat-label">Hadir Hari Ini</div>
        </div>
      </div>
    </div>

    <!-- GDrive Failsafe -->
    <div class="sa-section">
      <h2 class="sa-section-title">☁️ Keamanan & Failsafe GDrive</h2>
      <div class="sa-card failsafe-card">
        <div class="failsafe-content">
          <div class="failsafe-icon">🛡️</div>
          <div class="failsafe-text">
            <h3>Google Drive Superadmin</h3>
            <p>Tautkan Google Drive Superadmin sebagai failsafe. Saat Posko dihapus, arsip lengkap (JSON, PDF, file) akan dikirim ke <strong>Google Drive Posko (Admin/Kordes)</strong> dan <strong>Google Drive Superadmin</strong> sebelum data dihapus permanen dari server.</p>
          </div>
        </div>
        <div class="failsafe-actions">
          <button v-if="!gdriveConnected" class="sa-btn sa-btn-primary" @click="emit('connect-gdrive')">
            🔗 Hubungkan Google Drive
          </button>
          <div v-else class="gdrive-connected">
            <span class="status-badge connected">✅ Terkoneksi & Melindungi</span>
            <button class="sa-btn sa-btn-outline" @click="emit('connect-gdrive')">Ganti Akun</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Status Per Posko -->
    <div class="sa-section">
      <h2 class="sa-section-title">Status Per Posko</h2>
      <div class="sa-posko-overview-grid">
        <div v-if="statsLoading" class="sa-loading-placeholder">Memuat...</div>
        <div v-else-if="stats.poskoStats.length === 0" class="sa-empty-state">
          <p>Belum ada posko. <button class="sa-link-btn" @click="emit('go-to-posko')">Buat posko pertama →</button></p>
        </div>
        <div v-else v-for="ps in stats.poskoStats" :key="ps.id" class="sa-posko-card">
          <div class="sa-posko-card-header">
            <span class="sa-posko-icon">🏠</span>
            <span class="sa-posko-name">{{ ps.nama_posko }}</span>
          </div>
          <div class="sa-posko-card-stats">
            <div class="sa-ps-item">
              <span class="sa-ps-val">{{ ps.jumlah_mahasiswa }}</span>
              <span class="sa-ps-label">Mahasiswa</span>
            </div>
            <div class="sa-ps-divider"></div>
            <div class="sa-ps-item">
              <span class="sa-ps-val emerald">{{ ps.hadir_hari_ini }}</span>
              <span class="sa-ps-label">Hadir Hari Ini</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@import '../../assets/sa-shared.css';
/* Card used by failsafe section */
.sa-card { background: #1e293b; border-radius: 16px; border: 1px solid rgba(148,163,184,0.1); overflow: hidden; }
</style>
