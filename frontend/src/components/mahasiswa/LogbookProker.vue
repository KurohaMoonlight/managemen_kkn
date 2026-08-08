<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
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

// --- FILTER STATE ---
const filterTanggalMulai = ref('');
const filterTanggalSelesai = ref('');
const selectedPembuat = ref([]);

const rekapJamLogbook = computed(() => {
  const recap = {};
  filteredLogbooks.value.forEach(log => {
    if (log.pembuat && log.waktu_mulai && log.waktu_selesai) {
      const startTime = log.waktu_mulai.slice(0, 5);
      const endTime = log.waktu_selesai.slice(0, 5);
      const start = new Date(`1970-01-01T${startTime}:00`);
      const end = new Date(`1970-01-01T${endTime}:00`);
      let diff = (end - start) / (1000 * 60 * 60);
      if (!isNaN(diff)) {
        if (diff < 0) diff += 24;
        if (!recap[log.pembuat]) {
          recap[log.pembuat] = 0;
        }
        recap[log.pembuat] += diff;
      }
    }
  });
  return recap;
});

const uniquePembuat = computed(() => {
  const pembuatSet = new Set();
  logbooks.value.forEach(log => {
    if (log.pembuat) pembuatSet.add(log.pembuat);
  });
  return Array.from(pembuatSet);
});

const filteredLogbooks = computed(() => {
  return logbooks.value.filter(log => {
    if (filterTanggalMulai.value && log.tanggal) {
      if (log.tanggal < filterTanggalMulai.value) return false;
    }
    if (filterTanggalSelesai.value && log.tanggal) {
      if (log.tanggal > filterTanggalSelesai.value) return false;
    }
    if (selectedPembuat.value.length > 0 && log.pembuat) {
      if (!selectedPembuat.value.includes(log.pembuat)) return false;
    }
    return true;
  });
});

const resetFilters = () => {
  filterTanggalMulai.value = '';
  filterTanggalSelesai.value = '';
  selectedPembuat.value = [];
};

// --- CONTEXT MENU STATE ---
const contextMenu = ref({ show: false, x: 0, y: 0, log: null });

const closeContextMenu = () => {
  contextMenu.value.show = false;
};

onMounted(() => {
  document.addEventListener('click', closeContextMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu);
});

const handleContextMenu = (e, log) => {
  if (log.user_id !== props.user.id) return;
  e.preventDefault();
  contextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    log
  };
};

// --- DELETE LOGBOOK STATE ---
const showDeleteModal = ref(false);
const deletePassword = ref('');
const isDeletingLogbook = ref(false);

const promptDeleteLogbook = () => {
  showDeleteModal.value = true;
  deletePassword.value = '';
};

const confirmDeleteLogbook = async () => {
  if (!deletePassword.value) {
    toastWarning('Password wajib diisi!');
    return;
  }
  isDeletingLogbook.value = true;
  try {
    const res = await fetch(`/api/mahasiswa/logbook/${contextMenu.value.log.id}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${props.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: deletePassword.value })
    });
    const data = await res.json();
    if (res.ok) {
      toastSuccess('Logbook berhasil dihapus!');
      showDeleteModal.value = false;
      await fetchLogbooks();
      emit('refresh-explorer');
    } else {
      toastError(data.message || 'Gagal menghapus logbook');
    }
  } catch (error) {
    toastError('Terjadi kesalahan jaringan.');
  } finally {
    isDeletingLogbook.value = false;
  }
};

// --- EDIT LOGBOOK STATE ---
const showEditModal = ref(false);
const isEditingLogbook = ref(false);
const editLogbookForm = ref({
  tanggal: '',
  waktu_mulai: '',
  waktu_selesai: '',
  tempat: '',
  sasaran: '',
  deskripsi: ''
});
const editLogbookPhotos = ref([]); // Existing photos
const editLogbookFiles = ref([]);  // New uploaded files
const editDeletedFiles = ref([]);  // IDs of deleted photos + old PDF
const editFileInputRef = ref(null);

const openEditModal = () => {
  const log = contextMenu.value.log;
  // Format dates for input type date/time if needed, but usually they are returned as string formats.
  // We assume log.tanggal is a YYYY-MM-DD string or Date.
  editLogbookForm.value = {
    tanggal: new Date(log.tanggal).toISOString().split('T')[0],
    waktu_mulai: log.waktu_mulai?.slice(0,5) || '',
    waktu_selesai: log.waktu_selesai?.slice(0,5) || '',
    tempat: log.tempat || '',
    sasaran: log.sasaran || '',
    deskripsi: log.deskripsi || ''
  };
  editLogbookPhotos.value = [...(log.photos || [])];
  editLogbookFiles.value = [];
  editDeletedFiles.value = [];
  
  // Find the old PDF to add it to deleted files on save (since we will generate a new one)
  const oldPdf = editLogbookPhotos.value.find(p => p.nama_file.endsWith('.pdf'));
  if (oldPdf) {
    editDeletedFiles.value.push(oldPdf.id);
    // Remove old PDF from displayed photos so user doesn't see it as a normal image
    editLogbookPhotos.value = editLogbookPhotos.value.filter(p => p.id !== oldPdf.id);
  }

  showEditModal.value = true;
};

const handleEditFileSelect = (e) => {
  editLogbookFiles.value = Array.from(e.target.files);
};

const removeExistingPhoto = (photoId) => {
  editLogbookPhotos.value = editLogbookPhotos.value.filter(p => p.id !== photoId);
  editDeletedFiles.value.push(photoId);
};

const saveEditLogbook = async () => {
  const plainText = editLogbookForm.value.deskripsi.replace(/<[^>]+>/g, '').trim();
  if (!plainText || !editLogbookForm.value.tanggal || !editLogbookForm.value.waktu_mulai || !editLogbookForm.value.waktu_selesai || !editLogbookForm.value.tempat) {
    toastWarning('Mohon isi lengkap seluruh form wajib (Tanggal, Waktu, Tempat, dan Deskripsi).');
    return;
  }
  isEditingLogbook.value = true;
  
  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #333;">
        <h1 style="color: #0f172a; margin-bottom: 5px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Laporan Logbook Harian (Direvisi)</h1>
        <p style="color: #64748b; margin-top: 15px; margin-bottom: 30px; font-size: 14px;">
          <strong>Proker:</strong> ${props.prokerData.proker} (PIC: ${props.prokerData.nama_pic})<br>
          <strong>Dilaporkan Oleh:</strong> ${props.user?.nama_lengkap || 'Mahasiswa'} (${props.user?.nim || '-'})<br>
          <strong>Waktu Pelaporan/Revisi:</strong> ${new Date().toLocaleString('id-ID')}<br>
          <strong>Pelaksanaan:</strong> ${editLogbookForm.value.tanggal} (${editLogbookForm.value.waktu_mulai} - ${editLogbookForm.value.waktu_selesai})<br>
          <strong>Tempat:</strong> ${editLogbookForm.value.tempat}<br>
          <strong>Sasaran:</strong> ${editLogbookForm.value.sasaran}<br>
        </p>
        <div style="font-size: 15px; line-height: 1.6; color: #1e293b;">
          ${editLogbookForm.value.deskripsi}
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
    formData.append('tanggal', editLogbookForm.value.tanggal);
    formData.append('waktu_mulai', editLogbookForm.value.waktu_mulai);
    formData.append('waktu_selesai', editLogbookForm.value.waktu_selesai);
    formData.append('tempat', editLogbookForm.value.tempat);
    formData.append('sasaran', editLogbookForm.value.sasaran);
    formData.append('deskripsi', editLogbookForm.value.deskripsi);
    formData.append('deleted_files', JSON.stringify(editDeletedFiles.value));
    
    formData.append('photos', pdfBlob, opt.filename);
    
    editLogbookFiles.value.forEach(file => {
      formData.append('photos', file);
    });

    const res = await fetch(`/api/mahasiswa/logbook/${contextMenu.value.log.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${props.token}` },
      body: formData
    });
    
    if (res.ok) {
      showEditModal.value = false;
      toastSuccess('Logbook berhasil diperbarui!');
      await fetchLogbooks();
      emit('refresh-explorer');
    } else {
      const data = await res.json();
      toastError(data.message || 'Gagal memperbarui logbook');
    }
  } catch (error) {
    console.error('Edit Logbook Error:', error);
    toastError('Terjadi kesalahan sistem saat memperbarui logbook.');
  } finally {
    isEditingLogbook.value = false;
  }
};

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
    
    <!-- REKAPITULASI JAM LOGBOOK -->
    <div v-if="Object.keys(rekapJamLogbook).length > 0" class="logbook-recap" style="background: #f0fdf4; padding: 1.5rem; border-radius: 12px; border: 1px solid #bbf7d0; margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 1rem 0; color: #166534; font-size: 1.1rem;">⏱️ Rekapitulasi Jam Kegiatan</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <div v-for="(hours, pic) in rekapJamLogbook" :key="pic" style="background: white; padding: 1rem; border-radius: 8px; border: 1px solid #dcfce7; display: flex; flex-direction: column; gap: 0.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
          <span style="font-weight: 600; color: #166534; font-size: 0.95rem;">{{ pic }}</span>
          <span style="font-size: 1.25rem; font-weight: 700; color: #15803d;">{{ hours.toFixed(1) }} <span style="font-size: 0.9rem; font-weight: 500; color: #22c55e;">Jam</span></span>
        </div>
      </div>
    </div>

    <!-- FILTER SECTION -->
    <div class="logbook-filters" style="background: #f8fafc; padding: 1.5rem; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h4 style="margin: 0; color: var(--text-main); font-size: 1.1rem;">🔍 Filter Logbook</h4>
        <button v-if="filterTanggalMulai || filterTanggalSelesai || selectedPembuat.length > 0" @click="resetFilters" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.9rem; font-weight: 600; text-decoration: underline;">Reset Filter</button>
      </div>
      
      <div class="filter-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <div>
          <label style="display:block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Tanggal Mulai</label>
          <input type="date" v-model="filterTanggalMulai" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 8px;" />
        </div>
        <div>
          <label style="display:block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Tanggal Selesai</label>
          <input type="date" v-model="filterTanggalSelesai" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 8px;" />
        </div>
        <div style="grid-column: 1 / -1;" v-if="uniquePembuat.length > 0">
          <label style="display:block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Pembuat (PIC)</label>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <label v-for="pembuat in uniquePembuat" :key="pembuat" style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer; font-size: 0.9rem; background: white; padding: 0.3rem 0.6rem; border-radius: 6px; border: 1px solid #cbd5e1;">
              <input type="checkbox" v-model="selectedPembuat" :value="pembuat" style="accent-color: var(--color-primary);" />
              {{ pembuat }}
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="logbook-list" style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div v-if="filteredLogbooks.length === 0 && logbooks.length > 0" class="text-muted text-center" style="padding: 2rem; background: #f8fafc; border-radius: 12px; border: 1px dashed var(--border-color);">Tidak ada logbook yang sesuai dengan filter.</div>
      <div v-if="logbooks.length === 0" class="text-muted text-center" style="padding: 2rem; background: #f8fafc; border-radius: 12px; border: 1px dashed var(--border-color);">Belum ada logbook yang diunggah.</div>
      <div v-for="log in filteredLogbooks" :key="log.id" class="logbook-item" style="border: 1px solid var(--border-color); padding: 1.5rem; border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);"
           @contextmenu="handleContextMenu($event, log)" 
           :title="log.user_id === user.id ? 'Klik kanan untuk edit/hapus' : ''">
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

  <!-- CONTEXT MENU -->
  <div v-if="contextMenu.show" 
       :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
       class="context-menu" 
       @click.stop>
    <div class="context-menu-item" @click="openEditModal(); closeContextMenu()">✏️ Edit Logbook</div>
    <div class="context-menu-item delete" @click="promptDeleteLogbook(); closeContextMenu()">🗑️ Hapus Logbook</div>
  </div>

  <!-- EDIT MODAL -->
  <div v-if="showEditModal" class="modal-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;" @click.self="showEditModal = false">
    <div class="modal-content" style="background: white; padding: 2rem; border-radius: 16px; width: 90%; max-width: 800px; max-height: 90vh; overflow-y: auto;">
      <h3 style="margin-bottom: 1.5rem; color: var(--text-main);">✏️ Edit Logbook</h3>
      <div class="form-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <label style="display:block; font-weight: 600; margin-bottom: 0.5rem;">Tanggal Kegiatan</label>
          <input type="date" v-model="editLogbookForm.tanggal" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 8px;" />
        </div>
        <div>
          <label style="display:block; font-weight: 600; margin-bottom: 0.5rem;">Tempat</label>
          <input type="text" v-model="editLogbookForm.tempat" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 8px;" />
        </div>
        <div>
          <label style="display:block; font-weight: 600; margin-bottom: 0.5rem;">Jam Mulai</label>
          <input type="time" v-model="editLogbookForm.waktu_mulai" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 8px;" />
        </div>
        <div>
          <label style="display:block; font-weight: 600; margin-bottom: 0.5rem;">Jam Selesai</label>
          <input type="time" v-model="editLogbookForm.waktu_selesai" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 8px;" />
        </div>
        <div class="span-full">
          <label style="display:block; font-weight: 600; margin-bottom: 0.5rem;">Sasaran</label>
          <input type="text" v-model="editLogbookForm.sasaran" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 8px;" />
        </div>
      </div>

      <label style="display:block; margin-bottom: 0.5rem; font-weight: 600;">Deskripsi Kegiatan</label>
      <QuillEditor theme="snow" v-model:content="editLogbookForm.deskripsi" contentType="html" style="height: 150px; margin-bottom: 1rem;" />

      <label style="display:block; margin-top: 3.5rem; margin-bottom: 0.5rem; font-weight: 600;">Foto Saat Ini</label>
      <div v-if="editLogbookPhotos.length > 0" style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
        <div v-for="photo in editLogbookPhotos" :key="photo.id" style="position: relative; width: 100px; height: 100px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
          <img :src="photo.file_path" style="width: 100%; height: 100%; object-fit: cover;" />
          <button @click="removeExistingPhoto(photo.id)" style="position: absolute; top: 4px; right: 4px; background: red; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px;">✕</button>
        </div>
      </div>
      <div v-else class="text-muted" style="margin-bottom: 1.5rem; font-size: 0.9rem;">Tidak ada foto tambahan.</div>

      <label style="display:block; margin-bottom: 0.5rem; font-weight: 600;">Tambah Foto Baru</label>
      <input type="file" multiple accept="image/*" @change="handleEditFileSelect" ref="editFileInputRef" style="display:block; margin-bottom: 1.5rem; padding: 0.5rem; border: 1px dashed var(--color-primary); border-radius: 8px; width: 100%;" />

      <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
        <button @click="showEditModal = false" class="btn-scan" style="background: #e2e8f0; color: #475569;">Batal</button>
        <button @click="saveEditLogbook" class="btn-scan" :disabled="isEditingLogbook">{{ isEditingLogbook ? 'Menyimpan...' : 'Simpan Perubahan' }}</button>
      </div>
    </div>
  </div>

  <!-- DELETE MODAL -->
  <div v-if="showDeleteModal" class="modal-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;" @click.self="showDeleteModal = false">
    <div class="modal-content" style="background: white; padding: 2rem; border-radius: 16px; width: 90%; max-width: 400px; text-align: center;">
      <h3 style="color: #ef4444; margin-bottom: 1rem;">⚠️ Hapus Logbook?</h3>
      <p style="color: #64748b; margin-bottom: 1.5rem; font-size: 0.95rem;">Tindakan ini tidak dapat dibatalkan. PDF Laporan dan foto-foto yang terkait juga akan dihapus.</p>
      
      <input type="password" v-model="deletePassword" placeholder="Masukkan password Anda" style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 1.5rem; text-align: center;" />
      
      <div style="display: flex; gap: 1rem; justify-content: center;">
        <button @click="showDeleteModal = false" class="btn-scan" style="background: #e2e8f0; color: #475569; width: 100%;">Batal</button>
        <button @click="confirmDeleteLogbook" class="btn-scan" style="background: #ef4444; width: 100%;" :disabled="isDeletingLogbook">{{ isDeletingLogbook ? 'Menghapus...' : 'Hapus' }}</button>
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

.context-menu {
  position: fixed;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.15);
  border: 1px solid #e2e8f0;
  padding: 0.5rem 0;
  z-index: 10000;
  min-width: 150px;
}
.context-menu-item {
  padding: 0.6rem 1rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: #334155;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.context-menu-item:hover {
  background: #f1f5f9;
}
.context-menu-item.delete {
  color: #ef4444;
}
.context-menu-item.delete:hover {
  background: #fef2f2;
}
</style>
