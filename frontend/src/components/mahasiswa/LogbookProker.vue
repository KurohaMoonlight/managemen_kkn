<script setup>
import { ref, onMounted, watch } from 'vue';
import html2pdf from 'html2pdf.js';
import { useToast } from '../../composables/useNotification.js';

const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();

const props = defineProps({
  token: { type: String, required: true },
  prokerData: { type: Object, required: true },
  user: { type: Object, required: true }
});

const emit = defineEmits(['refresh-explorer']);

const logbooks = ref([]);
const logbookForm = ref({ 
  tanggal: new Date().toISOString().split('T')[0],
  waktu_mulai: '',
  waktu_selesai: '',
  tempat: '',
  tambahan_sasaran: '',
  semua_mahasiswa_ikut: false,
  deskripsi: '' 
});
const logbookFiles = ref([]);
const isSubmittingLogbook = ref(false);
const previewImageUrl = ref(null);
const fileInputRef = ref(null);

const fetchLogbooks = async () => {
  if (!props.prokerData?.id) return;
  try {
    const res = await fetch(`/api/mahasiswa/logbook?pic_id=${props.prokerData.id}`, {
      headers: { 'Authorization': `Bearer ${props.token}` }
    });
    logbooks.value = await res.json();
  } catch (err) {}
};

watch(() => props.prokerData, () => {
  fetchLogbooks();
});

onMounted(() => {
  fetchLogbooks();
});

const handleFileSelect = (e) => {
  logbookFiles.value = Array.from(e.target.files);
};

const submitLogbook = async () => {
  const plainText = logbookForm.value.deskripsi.replace(/<[^>]+>/g, '').trim();
  if (!plainText || !props.prokerData || !logbookForm.value.tanggal || !logbookForm.value.waktu_mulai || !logbookForm.value.waktu_selesai || !logbookForm.value.tempat) {
    toastWarning('Mohon isi lengkap seluruh form wajib (Tanggal, Waktu, Tempat, dan Deskripsi).');
    return;
  }
  isSubmittingLogbook.value = true;
  
  let sasaranFinal = '';
  if (logbookForm.value.semua_mahasiswa_ikut) {
    sasaranFinal = 'Seluruh Mahasiswa KKN';
    if (logbookForm.value.tambahan_sasaran.trim()) {
      sasaranFinal += ', ' + logbookForm.value.tambahan_sasaran.trim();
    }
  } else {
    const picMembers = props.prokerData.members ? props.prokerData.members.map(m => m.nama_lengkap).join(', ') : '';
    sasaranFinal = picMembers ? 'Anggota PIC: ' + picMembers : 'Anggota PIC';
    if (logbookForm.value.tambahan_sasaran.trim()) {
      sasaranFinal += '\nTambahan Peserta: ' + logbookForm.value.tambahan_sasaran.trim();
    }
  }
  
  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #333;">
        <h1 style="color: #0f172a; margin-bottom: 5px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Laporan Logbook Harian</h1>
        <p style="color: #64748b; margin-top: 15px; margin-bottom: 30px; font-size: 14px;">
          <strong>Proker:</strong> ${props.prokerData.proker} (PIC: ${props.prokerData.nama_pic})<br>
          <strong>Dilaporkan Oleh:</strong> ${props.user?.nama_lengkap || 'Mahasiswa'} (${props.user?.nim || '-'})<br>
          <strong>Waktu Pelaporan:</strong> ${new Date().toLocaleString('id-ID')}<br>
          <strong>Pelaksanaan:</strong> ${logbookForm.value.tanggal} (${logbookForm.value.waktu_mulai} - ${logbookForm.value.waktu_selesai})<br>
          <strong>Tempat:</strong> ${logbookForm.value.tempat}<br>
          <strong>Sasaran:</strong> ${sasaranFinal}<br>
        </p>
        <div style="font-size: 15px; line-height: 1.6; color: #1e293b;">
          ${logbookForm.value.deskripsi}
        </div>
      </div>
    `;

    const opt = {
      margin:       [10, 10, 10, 10],
      filename:     `Laporan_Logbook_${new Date().toISOString().split('T')[0]}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const pdfBlob = await html2pdf().from(tempDiv).set(opt).output('blob');

    const formData = new FormData();
    formData.append('pic_id', props.prokerData.id);
    formData.append('tanggal', logbookForm.value.tanggal);
    formData.append('waktu_mulai', logbookForm.value.waktu_mulai);
    formData.append('waktu_selesai', logbookForm.value.waktu_selesai);
    formData.append('tempat', logbookForm.value.tempat);
    formData.append('sasaran', sasaranFinal);
    formData.append('deskripsi', logbookForm.value.deskripsi);
    
    formData.append('photos', pdfBlob, opt.filename);
    
    logbookFiles.value.forEach(file => {
      formData.append('photos', file);
    });

    const res = await fetch('/api/mahasiswa/logbook', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${props.token}` },
      body: formData
    });
    
    if (res.ok) {
      logbookForm.value = {
        tanggal: new Date().toISOString().split('T')[0],
        waktu_mulai: '',
        waktu_selesai: '',
        tempat: '',
        tambahan_sasaran: '',
        semua_mahasiswa_ikut: false,
        deskripsi: ''
      };
      logbookFiles.value = [];
      if (fileInputRef.value) fileInputRef.value.value = '';
      toastSuccess('Logbook beserta PDF berhasil disimpan!');
      await fetchLogbooks();
      emit('refresh-explorer');
    } else {
      const data = await res.json();
      toastError(data.message || 'Gagal menyimpan logbook');
    }
  } catch (error) {
    console.error('Logbook Error:', error);
    toastError('Terjadi kesalahan sistem saat memproses logbook.');
  } finally {
    isSubmittingLogbook.value = false;
  }
};
</script>

<template>
  <div class="status-card logbook-card" style="width: 100%; max-width: 100%;">
    <h2 style="border-bottom: 2px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem; color: var(--text-main);">📝 Logbook Harian</h2>
    
    <div class="logbook-form">
      <div class="form-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <label style="display:block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-main);">Tanggal Kegiatan *</label>
          <input type="date" v-model="logbookForm.tanggal" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 8px;" required />
        </div>
        <div>
          <label style="display:block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-main);">Tempat *</label>
          <input type="text" v-model="logbookForm.tempat" placeholder="Contoh: Balai Desa" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 8px;" required />
        </div>
        <div>
          <label style="display:block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-main);">Jam Mulai *</label>
          <input type="time" v-model="logbookForm.waktu_mulai" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 8px;" required />
        </div>
        <div>
          <label style="display:block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-main);">Jam Selesai *</label>
          <input type="time" v-model="logbookForm.waktu_selesai" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 8px;" required />
        </div>
        <div class="span-full">
          <label style="display:flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; cursor: pointer; color: var(--color-primary); font-weight: bold;">
            <input type="checkbox" v-model="logbookForm.semua_mahasiswa_ikut" style="width: 18px; height: 18px; accent-color: var(--color-primary);" />
            Semua Mahasiswa Posko KKN Ikut Serta
          </label>
          <label style="display:block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-main);">Tambahan Sasaran / Peserta (Opsional)</label>
          <input type="text" v-model="logbookForm.tambahan_sasaran" placeholder="Contoh: Perangkat Desa dan Warga" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 8px;" />
          <small class="text-muted" style="display:block; margin-top: 4px; font-size: 0.8rem;">
            *Mahasiswa PIC otomatis dimasukkan ke sasaran. Anda hanya perlu menulis sasaran warga / audiens di atas jika ada.
          </small>
        </div>
      </div>

      <label style="display:block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-main);">Deskripsi Kegiatan / Target Proker Hari Ini *</label>
      <QuillEditor theme="snow" v-model:content="logbookForm.deskripsi" contentType="html" style="height: 150px; margin-bottom: 1rem;" />
      
      <label style="display:block; margin-top: 3.5rem; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-main);">Dokumentasi Foto (Multi-Photo)</label>
      <input type="file" multiple accept="image/*" @change="handleFileSelect" ref="fileInputRef" style="display:block; margin-bottom: 1.5rem; padding: 0.5rem; border: 1px dashed var(--color-primary); border-radius: 8px; width: 100%;" />
      
      <button class="btn-scan" style="width: 100%; margin-top: 0;" @click="submitLogbook" :disabled="isSubmittingLogbook">
        {{ isSubmittingLogbook ? 'Menyimpan...' : 'Kirim Logbook' }}
      </button>
    </div>

    <h3 style="margin-top: 3.5rem; margin-bottom: 1.5rem; color: var(--text-main);">Riwayat Logbook Kelompok</h3>
    <div class="logbook-list" style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div v-if="logbooks.length === 0" class="text-muted text-center" style="padding: 2rem; background: #f8fafc; border-radius: 12px; border: 1px dashed var(--border-color);">Belum ada logbook yang diunggah.</div>
      <div v-for="log in logbooks" :key="log.id" class="logbook-item" style="border: 1px solid var(--border-color); padding: 1.5rem; border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div class="log-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
          <strong style="color: var(--color-primary); font-size: 1.1rem;">{{ log.pembuat }}</strong>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.2rem;" class="log-header-right">
            <span class="text-muted" style="font-size: 0.85rem; background: #f1f5f9; padding: 0.2rem 0.6rem; border-radius: 4px;">Dilaporkan: {{ new Date(log.created_at).toLocaleString('id-ID') }}</span>
            <span v-if="log.tanggal" style="font-size: 0.85rem; color: #1e3a8a; font-weight: 600;">Pelaksanaan: {{ new Date(log.tanggal).toLocaleDateString('id-ID') }} ({{ log.waktu_mulai?.slice(0,5) }} - {{ log.waktu_selesai?.slice(0,5) }})</span>
          </div>
        </div>
        <div v-if="log.sasaran" style="margin-bottom: 1rem; font-size: 0.9rem; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div><strong>Tempat:</strong> {{ log.tempat }}</div>
          <div><strong>Sasaran:</strong> {{ log.sasaran }}</div>
        </div>
        <div class="log-content ql-editor" v-html="log.deskripsi" style="padding:0; margin: 0 0 1.5rem 0; color: #334155; font-size: 0.95rem;"></div>
        
        <div class="log-photos" v-if="log.photos && log.photos.length > 0" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1rem;">
          <template v-for="(photo, idx) in log.photos" :key="idx">
            <a v-if="photo.nama_file.match(/\.(jpg|jpeg|png|gif)$/i)" href="#" @click.prevent="previewImageUrl = photo.file_path" style="text-decoration: none;">
              <div style="width: 100%; padding-bottom: 100%; position: relative; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; background: #f8fafc;">
                <img :src="photo.file_path" style="position: absolute; width: 100%; height: 100%; object-fit: cover;" />
              </div>
            </a>
            <a v-else :href="photo.file_path" target="_blank" style="text-decoration: none;">
              <div style="width: 100%; padding: 1rem; text-align: center; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; word-break: break-all; font-size: 0.8rem; color: #64748b;">
                📄 {{ photo.nama_file }}
              </div>
            </a>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- IMAGE PREVIEW MODAL -->
  <div v-if="previewImageUrl" class="modal-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 10000;" @click.self="previewImageUrl = null">
    <div style="position: relative; max-width: 90vw; max-height: 90vh;">
      <button @click="previewImageUrl = null" style="position: absolute; top: -15px; right: -15px; background: white; color: black; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-weight: bold; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">✕</button>
      <img :src="previewImageUrl" style="max-width: 100%; max-height: 90vh; border-radius: 8px; box-shadow: 0 4px 30px rgba(0,0,0,0.5); object-fit: contain;" @click.stop />
    </div>
  </div>
</template>

<style scoped>
.status-card {
  background: white;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  padding: 2rem;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
}
.btn-scan {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-scan:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(129, 154, 145, 0.4); }
.btn-scan:disabled { background: #94a3b8; cursor: not-allowed; transform: none; box-shadow: none; }
.status-pending { background: #fef9c3; color: #a16207; }
.status-disetujui { background: #dcfce7; color: #166534; }
.status-ditolak { background: #fee2e2; color: #991b1b; }

@media (max-width: 768px) {
  .log-header-right {
    align-items: flex-start !important;
  }
}
.text-muted { color: var(--text-muted); }
.text-center { text-align: center; }
.span-full { grid-column: span 2; }
@media (max-width: 600px) {
  .span-full { grid-column: span 1; }
}
</style>
