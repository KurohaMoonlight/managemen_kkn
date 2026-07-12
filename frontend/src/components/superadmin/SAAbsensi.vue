<script setup>
import { ref } from 'vue';

/**
 * SAAbsensi.vue
 * Tab Laporan Kehadiran Global di SuperAdmin Dashboard.
 */
const props = defineProps({
  token: { type: String, required: true },
  poskoList: { type: Array, default: () => [] },
});

const absensiDate = ref(new Date().toISOString().split('T')[0]);
const absensiPosko = ref('');
const absensiList = ref([]);
const absensiLoading = ref(false);

const fetchAbsensi = async () => {
  absensiLoading.value = true;
  try {
    const params = new URLSearchParams({ tanggal: absensiDate.value });
    if (absensiPosko.value) params.append('posko_id', absensiPosko.value);
    const res = await fetch(`/api/superadmin/absensi?${params}`, { headers: { Authorization: `Bearer ${props.token}` } });
    if (res.ok) absensiList.value = await res.json();
  } catch (e) { console.error(e); }
  finally { absensiLoading.value = false; }
};

defineExpose({ fetchAbsensi });

const getStatusBadge = (status) => {
  const map = { hadir: 'badge-success', telat: 'badge-warning', izin: 'badge-info', sakit: 'badge-danger' };
  return map[status] || 'badge-secondary';
};

const formatTime = (t) => t ? t.substring(0, 5) : '-';
</script>

<template>
  <div class="sa-content">
    <div class="sa-toolbar">
      <h2 class="sa-section-title" style="margin:0">Laporan Kehadiran Global</h2>
    </div>

    <div class="sa-filter-bar">
      <input type="date" class="sa-input" v-model="absensiDate" />
      <select class="sa-select" v-model="absensiPosko">
        <option value="">Semua Posko</option>
        <option v-for="p in poskoList" :key="p.id" :value="p.id">{{ p.nama_posko }}</option>
      </select>
      <button class="sa-btn sa-btn-primary" @click="fetchAbsensi">Tampilkan</button>
    </div>

    <div v-if="absensiLoading" class="sa-loading-placeholder">Memuat data absensi...</div>
    <div v-else-if="absensiList.length === 0" class="sa-empty-state">
      <div class="sa-empty-icon">📋</div>
      <p>Tidak ada data absensi pada tanggal ini.</p>
    </div>
    <div v-else class="sa-table-container">
      <table class="sa-table">
        <thead>
          <tr>
            <th>Nama</th>
            <th>NIM</th>
            <th>Posko</th>
            <th>Waktu Absen</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in absensiList" :key="a.id">
            <td><div class="sa-table-name">{{ a.nama_lengkap }}</div></td>
            <td><code class="sa-code">{{ a.nim }}</code></td>
            <td><span class="badge badge-indigo">🏠 {{ a.nama_posko || '—' }}</span></td>
            <td>{{ formatTime(a.waktu) }}</td>
            <td><span class="badge" :class="getStatusBadge(a.status)">{{ a.status }}</span></td>
          </tr>
        </tbody>
      </table>
      <div class="sa-table-footer">Total hadir: {{ absensiList.length }} mahasiswa</div>
    </div>
  </div>
</template>

<style>
@import '../../assets/sa-shared.css';
</style>
