<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from '../../composables/useNotification.js';

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
  nominal: '',
  keterangan: ''
});
const fileNota = ref(null);
const fileInputRef = ref(null);

const formatRupiah = (angka) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
};

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
  if (!form.value.kategori_id || !form.value.nominal || !form.value.keterangan) {
    toastWarning('Mohon isi Kategori, Nominal, dan Keterangan.');
    return;
  }
  isSubmitting.value = true;
  
  const formData = new FormData();
  formData.append('kategori_id', form.value.kategori_id);
  formData.append('nominal', form.value.nominal);
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
      form.value = { kategori_id: '', nominal: '', keterangan: '' };
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
  <div class="glass-card" style="margin-top: 2rem;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="margin: 0; color: var(--text-main); font-size: 1.5rem;">💸 Pengajuan Reimbursement</h2>
        <p style="margin: 0.2rem 0 0; color: var(--text-muted); font-size: 0.95rem;">Ajukan pencairan dana ke Bendahara Posko berdasarkan RAB.</p>
      </div>
      <button @click="showForm = !showForm" class="btn-primary" style="margin: 0; display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.2rem; white-space: nowrap;">
        <span v-if="!showForm">➕ Buat Pengajuan</span>
        <span v-else>Tutup Form</span>
      </button>
    </div>

    <!-- Form Pengajuan -->
    <div v-if="showForm" style="background: #f8fafc; padding: 1.5rem; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 2rem;" class="animate-fade-in">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
        <div>
          <label class="form-label">Kategori RAB</label>
          <select v-model="form.kategori_id" class="form-input">
            <option value="" disabled>Pilih Kategori / Kegiatan</option>
            <option v-for="k in kategoriList" :key="k.id" :value="k.id">{{ k.nama_kategori }}</option>
          </select>
        </div>
        <div>
          <label class="form-label">Nominal (Rp)</label>
          <input type="number" v-model="form.nominal" class="form-input" placeholder="Contoh: 150000" />
        </div>
      </div>
      <div style="margin-bottom: 1rem;">
        <label class="form-label">Keterangan / Rincian Pengeluaran</label>
        <textarea v-model="form.keterangan" class="form-input" rows="3" placeholder="Sebutkan rincian barang/jasa yang dibeli..."></textarea>
      </div>
      <div style="margin-bottom: 1.5rem;">
        <label class="form-label">Bukti Pembayaran / Nota (Opsional)</label>
        <div style="border: 2px dashed #cbd5e1; border-radius: 8px; padding: 1.5rem; text-align: center; background: white; cursor: pointer; transition: all 0.2s; position: relative;"
             @click="$refs.fileInputRef.click()">
          <input type="file" ref="fileInputRef" style="display: none;" accept="image/*,.pdf" @change="handleFileSelect" />
          <span style="font-size: 2rem; display: block; margin-bottom: 0.5rem;">🧾</span>
          <span v-if="!fileNota" style="color: #64748b; font-size: 0.95rem;">Klik untuk mengunggah Bukti Pembayaran / Nota (Gambar/PDF)</span>
          <span v-else style="color: var(--color-primary); font-weight: 600; font-size: 0.95rem;">{{ fileNota.name }}</span>
        </div>
      </div>
      <div style="text-align: right;">
        <button @click="submitPengajuan" class="btn-primary" :disabled="isSubmitting" style="margin: 0; min-width: 150px;">
          {{ isSubmitting ? 'Mengirim...' : 'Kirim Pengajuan' }}
        </button>
      </div>
    </div>

    <!-- Tabel Riwayat -->
    <div class="table-container" style="overflow-x: auto; background: white; border-radius: 12px; border: 1px solid #e2e8f0;">
      <table class="data-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left; border-bottom: 2px solid #e2e8f0;">
            <th style="padding: 1rem;">Tanggal</th>
            <th style="padding: 1rem;">Pengaju</th>
            <th style="padding: 1rem;">Kategori</th>
            <th style="padding: 1rem;">Keterangan</th>
            <th style="padding: 1rem;">Nominal</th>
            <th style="padding: 1rem;">Nota</th>
            <th style="padding: 1rem;">Status</th>
            <th style="padding: 1rem;">Catatan Bendahara</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="pengajuanList.length === 0">
            <td colspan="8" style="padding: 2rem; text-align: center; color: #64748b;">Belum ada riwayat pengajuan.</td>
          </tr>
          <tr v-for="p in pengajuanList" :key="p.id" style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 1rem;">{{ new Date(p.created_at).toLocaleDateString('id-ID') }}</td>
            <td style="padding: 1rem;">
              <div style="font-weight: 600; color: #1e293b;">{{ p.nama_lengkap }}</div>
              <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">{{ p.pengaju_jabatan || 'Anggota' }}</div>
            </td>
            <td style="padding: 1rem; font-weight: 500;">{{ p.nama_kategori }}</td>
            <td style="padding: 1rem; font-size: 0.9rem;">{{ p.keterangan }}</td>
            <td style="padding: 1rem; color: #ef4444; font-weight: 600;">{{ formatRupiah(p.nominal) }}</td>
            <td style="padding: 1rem; text-align: center;">
              <a v-if="p.file_nota_url && p.file_nota_url.match(/\.(jpg|jpeg|png|gif)$/i)" href="#" @click.prevent="previewImageUrl = 'http://localhost:5000' + p.file_nota_url" style="font-size: 1.2rem; text-decoration: none;" title="Lihat Nota">🖼️</a>
              <a v-else-if="p.file_nota_url" :href="'http://localhost:5000' + p.file_nota_url" target="_blank" style="font-size: 1.2rem; text-decoration: none;" title="Unduh Nota">📄</a>
              <span v-else class="text-muted">-</span>
            </td>
            <td style="padding: 1rem;">
              <span :class="{'status-pending': p.status === 'pending', 'status-disetujui': p.status === 'disetujui', 'status-ditolak': p.status === 'ditolak'}" style="padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600; display: inline-block;">
                {{ p.status === 'pending' ? '⏳ Pending' : p.status === 'disetujui' ? '✅ Disetujui' : '❌ Ditolak' }}
              </span>
            </td>
            <td style="padding: 1rem; font-size: 0.85rem; color: #64748b;">
              {{ p.catatan_bendahara || '-' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- IMAGE PREVIEW MODAL -->
  <div v-if="previewImageUrl" class="modal-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 10000;" @click.self="previewImageUrl = null">
    <div style="position: relative; max-width: 90vw; max-height: 90vh;">
      <button @click="previewImageUrl = null" style="position: absolute; top: -15px; right: -15px; background: white; color: black; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-weight: bold; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">?</button>
      <img :src="previewImageUrl" style="max-width: 100%; max-height: 90vh; border-radius: 8px; box-shadow: 0 4px 30px rgba(0,0,0,0.5); object-fit: contain;" @click.stop />
    </div>
  </div>
</template>

<style scoped>
.form-label {
  display: block;
  font-weight: 600;
  color: #334155;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}
.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: white;
  font-size: 1rem;
  color: #334155;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}
.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
}
.status-pending { background: #fef9c3; color: #a16207; }
.status-disetujui { background: #dcfce7; color: #166534; }
.status-ditolak { background: #fee2e2; color: #991b1b; }
</style>
