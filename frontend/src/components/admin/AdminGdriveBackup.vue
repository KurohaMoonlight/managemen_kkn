<script setup>
import { onMounted } from 'vue';
import { useAdminGdrive } from '../../composables/admin/useAdminGdrive.js';

const {
  gdriveStatus,
  gdriveLoading,
  backupRunning,
  fetchGDriveStatus,
  connectGDrive,
  updateGDriveInterval,
  manualBackup,
} = useAdminGdrive();

onMounted(fetchGDriveStatus);
</script>

<template>
        <!-- NEW SECTION: GDRIVE BACKUP -->
        <div class="card" style="margin-top: 2rem; border-left: 4px solid #0f9d58;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
            <h2 style="margin:0; display:flex; align-items:center; gap:10px; font-size: 1.3rem;">
              <svg style="width:24px;height:24px;flex-shrink:0;" viewBox="0 0 24 24"><path fill="#0F9D58" d="M22 17.5L14.5 5H6L13.5 17.5H22Z"/><path fill="#4285F4" d="M14.5 5H6L2 12L9.5 24.5H17L14.5 5Z"/><path fill="#FFC107" d="M22 17.5H7.5L2 12L9.5 24.5H22V17.5Z"/></svg>
              Backup Cloud Google Drive
            </h2>
            <div>
              <span v-if="gdriveStatus.connected" class="badge bg-success">Terkoneksi</span>
              <span v-else class="badge bg-danger">Tidak Terhubung</span>
            </div>
          </div>
          
          <div style="display: flex; gap: 1.5rem; align-items: flex-start; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 0; width: 100%;">
              <p class="text-muted" style="margin-top:0;">Automasikan backup data dan arsip KKN Anda langsung ke dalam Google Drive milik Admin Posko. Backup dibungkus dalam bentuk .zip yang mencakup JSON Database dan arsip PDF/JPG.</p>
              
              <div v-if="!gdriveStatus.connected" style="margin-top: 1.5rem;">
                <button class="btn btn-primary" @click="connectGDrive" :disabled="gdriveLoading" style="display:flex; align-items:center; gap:8px; width: 100%; justify-content: center; flex-wrap: wrap;">
                  🔗 Hubungkan Akun Google Drive
                </button>
              </div>
              <div v-else style="margin-top: 1rem; display: flex; flex-direction: column; gap: 1rem;">
                <div class="form-group" style="margin-bottom:0;">
                  <label style="font-size: 0.9rem; margin-bottom: 5px;">Cronjob Interval (Hari):</label>
                  <select class="form-control" :value="gdriveStatus.interval" @change="updateGDriveInterval" style="max-width: 250px;">
                    <option :value="1">Setiap Hari</option>
                    <option :value="3">Setiap 3 Hari</option>
                    <option :value="7">Setiap 1 Minggu</option>
                    <option :value="14">Setiap 2 Minggu</option>
                  </select>
                  <small class="text-muted mt-1" style="display:block;">Sistem akan membackup otomatis pada jam 00:00.</small>
                </div>

                <div style="display: flex; gap: 1rem; align-items: center; padding-top: 0.5rem; border-top: 1px solid var(--color-border);">
                  <button type="button" class="btn btn-outline" @click="manualBackup" :disabled="backupRunning">
                    <span v-if="backupRunning">⏳ Mencadangkan...</span>
                    <span v-else>☁️ Backup Sekarang Manual</span>
                  </button>
                  <span class="text-muted" style="font-size:0.85rem;" v-if="gdriveStatus.lastBackup">
                    Terakhir: {{ new Date(gdriveStatus.lastBackup).toLocaleString('id-ID') }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
</template>

<style scoped>
.badge.bg-success {
  background: #dcfce7;
  color: #166534;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
}

.badge.bg-danger {
  background: #fee2e2;
  color: #991b1b;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
}
</style>
