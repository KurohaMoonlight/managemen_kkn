<script setup>
import { ref } from 'vue';

/**
 * SAResetPassword.vue
 * Tab permintaan reset password di SuperAdmin Dashboard.
 */
const props = defineProps({
  token: { type: String, required: true },
});

const resetRequests = ref([]);
const resetLoading = ref(false);

const fetchResetRequests = async () => {
  resetLoading.value = true;
  try {
    const res = await fetch('/api/superadmin/reset-password-requests', { headers: { Authorization: `Bearer ${props.token}` } });
    if (res.ok) resetRequests.value = await res.json();
  } catch (e) { console.error(e); }
  finally { resetLoading.value = false; }
};

defineExpose({ fetchResetRequests });

const handleResetAction = async (id, action) => {
  if (!confirm(`Anda yakin ingin ${action === 'approve' ? 'menyetujui' : 'menolak'} permintaan ini?`)) return;
  try {
    const res = await fetch(`/api/superadmin/reset-password-requests/${id}/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${props.token}` },
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.message);
    alert(d.message);
    await fetchResetRequests();
  } catch (e) {
    alert('Gagal: ' + e.message);
  }
};
</script>

<template>
  <div class="sa-content">
    <div class="sa-header-actions">
      <h2>🔑 Permintaan Reset Password</h2>
      <button class="sa-btn" @click="fetchResetRequests">🔄 Segarkan</button>
    </div>

    <div v-if="resetLoading" class="sa-loading-placeholder">Memuat data permintaan...</div>
    <div v-else-if="resetRequests.length === 0" class="sa-empty-state">
      <div class="empty-icon">✨</div>
      <p>Tidak ada permintaan reset password saat ini.</p>
    </div>

    <div v-else class="sa-table-wrapper">
      <table class="sa-table">
        <thead>
          <tr>
            <th>Tanggal Pengajuan</th>
            <th>NIM</th>
            <th>Nama Lengkap</th>
            <th>Role / Posko</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in resetRequests" :key="r.id">
            <td>{{ new Date(r.created_at).toLocaleString('id-ID') }}</td>
            <td><strong>{{ r.nim }}</strong></td>
            <td>{{ r.nama_lengkap }}</td>
            <td>{{ r.role }} <span v-if="r.nama_posko">({{ r.nama_posko }})</span></td>
            <td>
              <span class="sa-badge" :class="{ 'sa-badge-warning': r.status === 'pending', 'sa-badge-success': r.status === 'approved', 'sa-badge-danger': r.status === 'rejected' }">
                {{ r.status }}
              </span>
            </td>
            <td>
              <div class="sa-action-group" v-if="r.status === 'pending'">
                <button class="sa-btn-icon success" @click="handleResetAction(r.id, 'approve')" title="Setujui">✔️</button>
                <button class="sa-btn-icon danger" @click="handleResetAction(r.id, 'reject')" title="Tolak">❌</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="sa-table-footer">Total: {{ resetRequests.length }} permintaan</div>
    </div>
  </div>
</template>

<style>
@import '../../assets/sa-shared.css';
</style>
