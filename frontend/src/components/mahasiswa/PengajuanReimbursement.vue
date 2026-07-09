<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from '../../composables/useNotification.js';
import CurrencyInput from '../CurrencyInput.vue';
import SearchableSelect from '../SearchableSelect.vue';
import { formatRupiah, toCurrencyNumber } from '../../composables/useCurrencyInput.js';

const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();

const props = defineProps({
  token: { type: String, required: true }
});

const kategoriList = ref([]);
const pengajuanList = ref([]);
const isSubmitting = ref(false);
const showForm = ref(false);

const form = ref({
  kategori_id: '',
  input_kategori: '',
  nominal: '',
  keterangan: ''
});
const fileNota = ref(null);
const fileInputRef = ref(null);

const fetchData = async () => {
  try {
    const [resKategori, resPengajuan] = await Promise.all([
      fetch('/api/bendahara/kategori', { headers: { 'Authorization': `Bearer ${props.token}` } }),
      fetch('/api/bendahara/pengajuan', { headers: { 'Authorization': `Bearer ${props.token}` } })
    ]);
    if (resKategori.ok) kategoriList.value = await resKategori.json();
    if (resPengajuan.ok) pengajuanList.value = await resPengajuan.json();
  } catch (error) {
    console.error("Error fetching pengajuan data:", error);
  }
};

const handleFileSelect = (e) => {
  if (e.target.files.length > 0) {
    fileNota.value = e.target.files[0];
  }
};

const submitPengajuan = async () => {
  const nominal = toCurrencyNumber(form.value.nominal);
  const hasKategori = form.value.kategori_id || form.value.input_kategori?.trim();
  if (!hasKategori) {
    toastWarning('Pilih kategori yang ada atau ketik nama kategori baru.');
    return;
  }
  if (!nominal || nominal <= 0) {
    toastWarning('Nominal harus lebih dari 0.');
    return;
  }
  if (!form.value.keterangan?.trim()) {
    toastWarning('Keterangan wajib diisi.');
    return;
  }

  isSubmitting.value = true;
  const formData = new FormData();
  if (form.value.kategori_id) {
    formData.append('kategori_id', form.value.kategori_id);
  } else {
    formData.append('nama_kategori_manual', form.value.input_kategori.trim());
  }
  formData.append('nominal', nominal);
  formData.append('keterangan', form.value.keterangan);
  if (fileNota.value) {
    formData.append('nota', fileNota.value);
  }

  try {
    const res = await fetch('/api/bendahara/pengajuan', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${props.token}` },
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      toastSuccess('Pengajuan berhasil dikirim!');
      showForm.value = false;
      form.value = { kategori_id: '', input_kategori: '', nominal: '', keterangan: '' };
      fileNota.value = null;
      if (fileInputRef.value) fileInputRef.value.value = '';
      fetchData();
    } else {
      toastError(data.message || 'Gagal mengirim pengajuan.');
    }
  } catch (error) {
    console.error(error);
    toastError('Terjadi kesalahan sistem.');
  } finally {
    isSubmitting.value = false;
  }
};

const previewImageUrl = ref(null);

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="reimburse-card">
    <!-- Header -->
    <div class="reimburse-header">
      <div>
        <h2 class="reimburse-title">💸 Pengajuan Reimbursement</h2>
        <p class="reimburse-subtitle">Ajukan pencairan dana ke Bendahara Posko berdasarkan RAB.</p>
      </div>
      <button @click="showForm = !showForm" class="btn-toggle" :class="{ active: showForm }">
        <span v-if="!showForm">➕ Buat Pengajuan</span>
        <span v-else>✕ Tutup Form</span>
      </button>
    </div>

    <!-- Form Pengajuan -->
    <Transition name="slide-down">
      <div v-if="showForm" class="reimburse-form">
        <!-- Row 1: Kategori + Nominal -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kategori RAB</label>
            <SearchableSelect
              v-model="form.kategori_id"
              v-model:manual-value="form.input_kategori"
              :options="kategoriList"
              placeholder="Pilih atau ketik kategori baru..."
            />
            <small class="form-hint">Pilih dari daftar atau ketik nama baru untuk membuat pos RAB otomatis.</small>
          </div>
          <div class="form-group">
            <label class="form-label">Nominal (Rp)</label>
            <CurrencyInput v-model="form.nominal" placeholder="0" />
          </div>
        </div>

        <!-- Row 2: Keterangan -->
        <div class="form-group">
          <label class="form-label">Keterangan / Rincian Pengeluaran</label>
          <textarea
            v-model="form.keterangan"
            class="form-input"
            rows="3"
            placeholder="Sebutkan rincian barang/jasa yang dibeli..."
          ></textarea>
        </div>

        <!-- Row 3: Upload Nota -->
        <div class="form-group">
          <label class="form-label">Bukti Pembayaran / Nota <span class="optional">(Opsional)</span></label>
          <div
            class="upload-zone"
            :class="{ 'has-file': fileNota }"
            @click="$refs.fileInputRef.click()"
          >
            <input type="file" ref="fileInputRef" style="display: none;" accept="image/*,.pdf" @change="handleFileSelect" />
            <span class="upload-icon">🧾</span>
            <span v-if="!fileNota" class="upload-text">Klik untuk mengunggah Bukti Pembayaran / Nota (Gambar/PDF)</span>
            <span v-else class="upload-filename">📎 {{ fileNota.name }}</span>
          </div>
        </div>

        <!-- Submit -->
        <div class="form-footer">
          <button @click="submitPengajuan" class="btn-submit" :disabled="isSubmitting">
            <span v-if="isSubmitting" class="spinner-sm"></span>
            {{ isSubmitting ? 'Mengirim...' : '📤 Kirim Pengajuan' }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- Tabel Riwayat -->
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
/* ── Card ────────────────────────────────────────── */
.reimburse-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  margin-top: 2rem;
  overflow: hidden;
}

.reimburse-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 1.5rem 1.75rem;
  border-bottom: 1px solid #f1f5f9;
}

.reimburse-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: #1e293b;
}

.reimburse-subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: #64748b;
}

.btn-toggle {
  padding: 0.55rem 1.2rem;
  border-radius: 10px;
  border: 1.5px solid var(--color-primary, #819A91);
  background: transparent;
  color: var(--color-primary, #819A91);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.btn-toggle:hover, .btn-toggle.active {
  background: var(--color-primary, #819A91);
  color: white;
}

/* ── Form ─────────────────────────────────────────── */
.reimburse-form {
  padding: 1.5rem 1.75rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

@media (max-width: 640px) {
  .form-row { grid-template-columns: 1fr; }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
}
.form-group:last-child { margin-bottom: 0; }

.form-label {
  font-weight: 600;
  color: #334155;
  font-size: 0.875rem;
}

.optional {
  font-weight: 400;
  color: #94a3b8;
  font-size: 0.8rem;
}

.form-hint {
  font-size: 0.78rem;
  color: #94a3b8;
  margin-top: 0.2rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1.5px solid #e2e8f0;
  background: white;
  font-size: 0.9rem;
  color: #334155;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  resize: vertical;
  font-family: inherit;
}
.form-input:focus {
  outline: none;
  border-color: var(--color-primary, #819A91);
  box-shadow: 0 0 0 3px rgba(129,154,145,0.12);
}

/* ── Upload Zone ──────────────────────────────────── */
.upload-zone {
  border: 2px dashed #cbd5e1;
  border-radius: 10px;
  padding: 1.25rem 1rem;
  text-align: center;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}
.upload-zone:hover {
  border-color: var(--color-primary, #819A91);
  background: #f0faf8;
}
.upload-zone.has-file {
  border-color: var(--color-primary, #819A91);
  background: #f0faf8;
}
.upload-icon { font-size: 1.8rem; line-height: 1; }
.upload-text { font-size: 0.875rem; color: #64748b; }
.upload-filename { font-size: 0.875rem; color: var(--color-primary, #819A91); font-weight: 600; word-break: break-all; }

/* ── Submit Button ────────────────────────────────── */
.form-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.25rem;
}

.btn-submit {
  padding: 0.65rem 1.75rem;
  background: var(--color-primary, #819A91);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 160px;
  justify-content: center;
}
.btn-submit:hover:not(:disabled) {
  background: var(--color-primary-dark, #6b847a);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(129,154,145,0.3);
}
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

.spinner-sm {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Transition ───────────────────────────────────── */
.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}
.slide-down-enter-from, .slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.slide-down-enter-to, .slide-down-leave-from {
  opacity: 1;
  max-height: 800px;
}

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
