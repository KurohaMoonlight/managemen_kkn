<script setup>
import { ref } from 'vue';
import { formatRupiah } from '../../composables/useCurrencyInput.js';

/**
 * TabelRiwayatReimbursement.vue
 * Tabel riwayat pengajuan reimbursement + image preview modal.
 * Props: pengajuanList (Array)
 */
defineProps({
  pengajuanList: { type: Array, default: () => [] },
});

const previewImageUrl = ref(null);
</script>

<template>
  <div class="table-wrapper">
    <table class="reimburse-table">
      <thead>
        <tr>
          <th>Tanggal</th>
          <th>Pengaju</th>
          <th>Kategori</th>
          <th>Keterangan</th>
          <th>Nominal</th>
          <th>Nota</th>
          <th>Status</th>
          <th>Catatan</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="pengajuanList.length === 0">
          <td colspan="8" class="empty-row">Belum ada riwayat pengajuan.</td>
        </tr>
        <tr v-for="p in pengajuanList" :key="p.id">
          <td>{{ new Date(p.created_at).toLocaleDateString('id-ID') }}</td>
          <td>
            <div class="pengaju-name">{{ p.nama_lengkap }}</div>
            <div class="pengaju-sub">
              <span v-if="p.nim">🎓 {{ p.nim }}</span>
              <span>{{ p.pengaju_jabatan || 'Anggota Posko' }}</span>
            </div>
          </td>
          <td class="td-kategori">{{ p.nama_kategori }}</td>
          <td class="td-ket">{{ p.keterangan }}</td>
          <td class="td-nominal">{{ formatRupiah(p.nominal) }}</td>
          <td class="td-nota">
            <a v-if="p.file_nota_url && p.file_nota_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)"
               href="#" @click.prevent="previewImageUrl = p.file_nota_url" title="Lihat Nota">🖼️</a>
            <a v-else-if="p.file_nota_url" :href="p.file_nota_url" target="_blank" title="Unduh Nota">📄</a>
            <span v-else class="text-muted">-</span>
          </td>
          <td>
            <span class="status-badge" :class="'status-' + p.status">
              {{ p.status === 'pending' ? '⏳ Pending' : p.status === 'disetujui' ? '✅ Disetujui' : '❌ Ditolak' }}
            </span>
          </td>
          <td class="td-catatan">{{ p.catatan_bendahara || '-' }}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- IMAGE PREVIEW MODAL -->
  <div v-if="previewImageUrl" class="preview-overlay" @click.self="previewImageUrl = null">
    <div class="preview-inner">
      <button class="preview-close" @click="previewImageUrl = null">×</button>
      <img :src="previewImageUrl" class="preview-img" @click.stop />
    </div>
  </div>
</template>

<style scoped>
/* ── Table ────────────────────────────────────────── */
.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.reimburse-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.reimburse-table thead tr {
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
}

.reimburse-table th {
  padding: 0.875rem 1rem;
  text-align: left;
  font-size: 0.8rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.reimburse-table td {
  padding: 0.875rem 1rem;
  border-top: 1px solid #f1f5f9;
  color: #334155;
  vertical-align: middle;
}

.reimburse-table tbody tr:hover td { background: #f8fafc; }

.empty-row {
  text-align: center;
  color: #94a3b8;
  padding: 2.5rem 1rem !important;
  font-style: italic;
}

.pengaju-name { font-weight: 600; color: #1e293b; }
.pengaju-sub { font-size: 0.75rem; color: #64748b; margin-top: 2px; display: flex; flex-direction: column; gap: 2px; }
.td-kategori { font-weight: 600; color: #0f172a; }
.td-ket { color: #475569; max-width: 200px; }
.td-nominal { color: #ef4444; font-weight: 700; white-space: nowrap; }
.td-nota { text-align: center; font-size: 1.2rem; }
.td-catatan { font-size: 0.82rem; color: #64748b; }

.status-badge {
  padding: 0.3rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  display: inline-block;
  white-space: nowrap;
}
.status-pending { background: #fef9c3; color: #a16207; }
.status-disetujui { background: #dcfce7; color: #166534; }
.status-ditolak { background: #fee2e2; color: #991b1b; }

/* ── Preview Modal ────────────────────────────────── */
.preview-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}
.preview-inner { position: relative; max-width: 90vw; max-height: 90vh; }
.preview-close {
  position: absolute; top: -15px; right: -15px;
  background: white; color: black; border: none; border-radius: 50%;
  width: 32px; height: 32px; cursor: pointer; font-weight: bold;
  font-size: 1.2rem; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
}
.preview-img {
  max-width: 100%; max-height: 90vh;
  border-radius: 8px;
  box-shadow: 0 4px 30px rgba(0,0,0,0.5);
  object-fit: contain;
}
</style>
