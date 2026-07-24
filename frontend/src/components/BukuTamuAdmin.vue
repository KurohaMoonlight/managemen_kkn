<script setup>
import { ref, onMounted, nextTick, computed } from 'vue';
import html2pdf from 'html2pdf.js';
import { useToast, useConfirm } from '../composables/useNotification.js';

const props = defineProps({
  token: { type: String, required: true },
  users: { type: Array, default: () => [] },
  poskoData: { type: Object, default: () => ({}) }
});

const { success: toastSuccess, error: toastError } = useToast();
const { confirm } = useConfirm();
const tamuList = ref([]);
const showForm = ref(false);
const isSubmitting = ref(false);
const isExtracting = ref(false);
const fileInput = ref(null);
const showPrintSettings = ref(false);
const printConfigMode = ref('otomatis');
const isLoadingLocation = ref(false);
const printConfig = ref({
  desa: props.poskoData?.nama_desa || '',
  kecamatan: props.poskoData?.kecamatan || '',
  kabupaten: props.poskoData?.kabupaten || ''
});

const loadLocationFromMap = async () => {
  if (printConfigMode.value === 'otomatis') {
    if (!props.poskoData?.lat || !props.poskoData?.lng || props.poskoData.lat == 0 || props.poskoData.lng == 0) {
      toastError("Koordinat posko belum diatur. Silakan gunakan mode manual.");
      printConfigMode.value = 'manual';
      return;
    }

    isLoadingLocation.value = true;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${props.poskoData.lat}&lon=${props.poskoData.lng}&zoom=14&addressdetails=1`, {
        headers: {
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.address) {
          printConfig.value.desa = data.address.village || data.address.town || data.address.suburb || data.address.hamlet || '';
          printConfig.value.kecamatan = data.address.city_district || data.address.district || data.address.county || data.address.municipality || '';
          let kab = data.address.city || data.address.county || data.address.state_district || data.address.region || '';
          printConfig.value.kabupaten = kab.replace('Kabupaten ', '').replace('Kota ', '');
        } else {
          toastError("Alamat tidak ditemukan dari koordinat ini. Silakan gunakan mode manual.");
          printConfigMode.value = 'manual';
        }
      } else {
        throw new Error('API Error');
      }
    } catch(e) {
       console.error("Gagal mengambil lokasi dari map", e);
       toastError("Gagal mengambil lokasi otomatis, silakan gunakan mode manual.");
       printConfigMode.value = 'manual';
    } finally {
      isLoadingLocation.value = false;
    }
  }
};

const chunkedTamuList = computed(() => {
  if (tamuList.value.length === 0) return [[]];
  const chunks = [];
  for (let i = 0; i < tamuList.value.length; i += 5) {
    chunks.push(tamuList.value.slice(i, i + 5));
  }
  return chunks;
});

const form = ref({
  tanggal: new Date().toISOString().split('T')[0],
  nama_tamu: '',
  alamat_jabatan: '',
  keperluan: '',
  mhs_penyambut_id: ''
});

const editingId = ref(null);

// Canvas Signature Refs
const sigCanvas = ref(null);
let isDrawing = false;
let ctx = null;

const fetchTamu = async () => {
  try {
    const res = await fetch('/api/admin/buku-tamu', {
      headers: { 'Authorization': `Bearer ${props.token}` }
    });
    if (res.ok) tamuList.value = await res.json();
  } catch (error) {
    console.error("Gagal memuat buku tamu:", error);
  }
};

const getRelativeCoords = (event) => {
  const rect = sigCanvas.value.getBoundingClientRect();
  const scaleX = sigCanvas.value.width / rect.width;
  const scaleY = sigCanvas.value.height / rect.height;
  
  if (event.touches && event.touches.length > 0) {
    return {
      x: (event.touches[0].clientX - rect.left) * scaleX,
      y: (event.touches[0].clientY - rect.top) * scaleY
    };
  } else {
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }
};

const startDrawing = (e) => {
  isDrawing = true;
  const coords = getRelativeCoords(e);
  ctx.beginPath();
  ctx.moveTo(coords.x, coords.y);
};

const draw = (e) => {
  if (!isDrawing) return;
  const coords = getRelativeCoords(e);
  ctx.lineTo(coords.x, coords.y);
  ctx.stroke();
};

const stopDrawing = () => {
  isDrawing = false;
  ctx.closePath();
};

const startDrawingTouch = (e) => {
  e.preventDefault();
  startDrawing(e);
};
const drawTouch = (e) => {
  e.preventDefault();
  draw(e);
};

const clearSignature = () => {
  if (ctx && sigCanvas.value) {
    ctx.clearRect(0, 0, sigCanvas.value.width, sigCanvas.value.height);
  }
};

const uploadAndExtractSignature = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  isExtracting.value = true;
  const formData = new FormData();
  formData.append('signature_image', file);

  try {
    const res = await fetch('/api/admin/extract-signature', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${props.token}`
      },
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      const img = new Image();
      img.onload = () => {
        if (ctx && sigCanvas.value) {
          ctx.clearRect(0, 0, sigCanvas.value.width, sigCanvas.value.height);
          
          const scale = Math.min(sigCanvas.value.width / img.width, sigCanvas.value.height / img.height);
          const drawWidth = img.width * scale * 0.8;
          const drawHeight = img.height * scale * 0.8;
          
          const x = (sigCanvas.value.width - drawWidth) / 2;
          const y = (sigCanvas.value.height - drawHeight) / 2;
          
          ctx.drawImage(img, x, y, drawWidth, drawHeight);
          toastSuccess('Berhasil mengekstrak tanda tangan');
        }
      };
      img.src = data.signature_base64;
    } else {
      const data = await res.json();
      toastError(data.message || 'Gagal mengekstrak tanda tangan');
    }
  } catch (err) {
    console.error(err);
    toastError('Terjadi kesalahan saat memproses gambar');
  } finally {
    isExtracting.value = false;
    event.target.value = '';
  }
};

const closeForm = () => {
  showForm.value = false;
  editingId.value = null;
  form.value = {
    tanggal: new Date().toISOString().split('T')[0],
    nama_tamu: '',
    alamat_jabatan: '',
    keperluan: '',
    mhs_penyambut_id: ''
  };
};

const editTamu = (t) => {
  editingId.value = t.id;
  form.value = {
    tanggal: new Date(t.tanggal).toISOString().split('T')[0],
    nama_tamu: t.nama_tamu,
    alamat_jabatan: t.alamat_jabatan,
    keperluan: t.keperluan,
    mhs_penyambut_id: t.mhs_penyambut_id || ''
  };
  showForm.value = true;
};

const deleteTamu = async (id) => {
  const confirmed = await confirm({
    title: 'Hapus Buku Tamu?',
    message: 'Apakah Anda yakin ingin menghapus buku tamu ini?',
    confirmText: 'Ya, Hapus',
    type: 'danger'
  });
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/admin/buku-tamu/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${props.token}`
      }
    });

    if (res.ok) {
      toastSuccess('Buku Tamu berhasil dihapus!');
      fetchTamu();
    } else {
      const data = await res.json();
      toastError(data.message || 'Gagal menghapus buku tamu.');
    }
  } catch (error) {
    console.error(error);
    toastError('Terjadi kesalahan sistem saat menghapus.');
  }
};

const submitForm = async () => {
  if (!form.value.tanggal || !form.value.nama_tamu || !form.value.alamat_jabatan || !form.value.keperluan) {
    toastError("Mohon lengkapi semua kolom wajib (Kecuali mahasiswa menemui yang opsional).");
    return;
  }
  
  let signature_base64 = null;
  if (!editingId.value) {
    // Check if canvas is empty
    const blank = document.createElement('canvas');
    blank.width = sigCanvas.value.width;
    blank.height = sigCanvas.value.height;
    if (sigCanvas.value.toDataURL() === blank.toDataURL()) {
      toastError("Tamu diwajibkan memberikan tanda tangan di kanvas yang disediakan.");
      return;
    }
    signature_base64 = sigCanvas.value.toDataURL('image/png');
  }

  isSubmitting.value = true;

  try {
    const url = editingId.value ? `/api/admin/buku-tamu/${editingId.value}` : '/api/admin/buku-tamu';
    const method = editingId.value ? 'PUT' : 'POST';
    const bodyData = editingId.value ? { ...form.value } : { ...form.value, signature_base64 };

    const res = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${props.token}`
      },
      body: JSON.stringify(bodyData)
    });
    
    if (res.ok) {
      toastSuccess(`Buku Tamu berhasil ${editingId.value ? 'diubah' : 'disimpan'}!`);
      closeForm();
      fetchTamu();
    } else {
      const data = await res.json();
      toastError(data.message || "Gagal menyimpan buku tamu.");
    }
  } catch (error) {
    console.error(error);
    toastError("Terjadi kesalahan sistem saat menyimpan.");
  } finally {
    isSubmitting.value = false;
  }
};

const formatDateWithDay = (dateStr) => {
  const date = new Date(dateStr);
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayName = hari[date.getDay()];
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${dayName}, ${d}/${m}/${y}`;
};

const cetakPdf = () => {
  if (printConfigMode.value === 'otomatis') {
    loadLocationFromMap();
  }
  showPrintSettings.value = true;
};

const executeCetakPdf = async () => {
  const element = document.getElementById('print-buku-tamu');
  element.style.display = 'block';
  
  const opt = {
    margin:       [10, 10, 10, 10],
    filename:     `Buku_Tamu_KKN_${props.poskoData?.nama_posko || 'Posko'}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
  };
  
  await html2pdf().from(element).set(opt).save();
  element.style.display = 'none';
  showPrintSettings.value = false;
};

onMounted(() => {
  fetchTamu();
});

// Watch for modal open to initialize canvas context
import { watch } from 'vue';
watch(showForm, async (newVal) => {
  if (newVal) {
    await nextTick();
    if (sigCanvas.value) {
      ctx = sigCanvas.value.getContext('2d');
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0f172a';
    }
  }
});

</script>

<template>
  <div class="card" style="margin-top: 2rem; margin-bottom: 2rem;">
    <h2>📖 Buku Tamu KKN</h2>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="margin: 0 0 0.5rem 0; color: var(--color-primary);">Buku Tamu Posko</h2>
        <p style="margin: 0; color: var(--text-muted); font-size: 0.95rem;">Catat riwayat kunjungan tamu di Posko (Dosen Pembimbing, Pejabat Desa, dsb).</p>
      </div>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button class="btn btn-outline" style="background-color: #e2e8f0; border-color: #cbd5e1; color: #0f172a; flex: 1; min-width: 140px;" @click="cetakPdf">🖨️ Cetak PDF</button>
        <button class="btn btn-primary" style="flex: 1; min-width: 140px;" @click="() => { editingId = null; showForm = true; }">➕ Tambah Tamu</button>
      </div>
    </div>
    
    <!-- Table Buku Tamu -->
    <div class="table-responsive" style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 8px;">
      <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
          <tr>
            <th style="padding: 1rem;">No</th>
            <th style="padding: 1rem;">Tanggal</th>
            <th style="padding: 1rem;">Nama Tamu</th>
            <th style="padding: 1rem;">Alamat / Jabatan</th>
            <th style="padding: 1rem;">Keperluan</th>
            <th style="padding: 1rem;">Mhs Menemui</th>
            <th style="padding: 1rem; text-align: center;">TTD</th>
            <th style="padding: 1rem; text-align: center;">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="tamuList.length === 0">
            <td colspan="8" class="text-center text-muted" style="padding: 2rem;">Belum ada histori tamu.</td>
          </tr>
          <tr v-for="(t, index) in tamuList" :key="t.id" style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 1rem;">{{ index + 1 }}</td>
            <td style="padding: 1rem;">{{ new Date(t.tanggal).toLocaleDateString('id-ID') }}</td>
            <td style="padding: 1rem; font-weight: 500;">{{ t.nama_tamu }}</td>
            <td style="padding: 1rem;">{{ t.alamat_jabatan }}</td>
            <td style="padding: 1rem; font-size: 0.9rem;">{{ t.keperluan }}</td>
            <td style="padding: 1rem; color: var(--color-primary);">{{ t.nama_penyambut || '-' }}</td>
            <td style="padding: 1rem; text-align: center;">
              <img v-if="t.ttd_tamu_url" :src="t.ttd_tamu_url" style="height: 40px; max-width: 80px; object-fit: contain;" />
            </td>
            <td style="padding: 1rem; text-align: center; display: flex; gap: 0.5rem; justify-content: center; border-bottom: none; height: 100%;">
              <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" @click="editTamu(t)">✏️ Edit</button>
              <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; color: #b91c1c; border-color: #b91c1c;" @click="deleteTamu(t.id)">🗑️ Hapus</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Cetak PDF -->
    <Teleport to="body">
      <div v-if="showPrintSettings" class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999;" @click.self="showPrintSettings = false">
        <div class="modal-content animate-fade-in" style="background: white; border-radius: 12px; padding: 2rem; width: 100%; max-width: 450px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
          <h3 style="margin-top: 0; color: var(--color-primary); border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 1.5rem;">Konfigurasi Cetak PDF</h3>
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Sumber Lokasi</label>
            <div style="display: flex; gap: 1rem;">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="radio" v-model="printConfigMode" value="otomatis" @change="loadLocationFromMap" /> Otomatis (Map)
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="radio" v-model="printConfigMode" value="manual" /> Manual
              </label>
            </div>
            <div v-if="printConfigMode === 'otomatis' && isLoadingLocation" style="font-size: 0.8rem; color: var(--color-primary); margin-top: 0.5rem;">
              ⏳ Mengambil lokasi dari map...
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
            <div>
              <label style="display: block; font-weight: 600; margin-bottom: 0.3rem;">Desa</label>
              <input type="text" v-model="printConfig.desa" placeholder="Contoh: Suka Maju" style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px;" :disabled="printConfigMode === 'otomatis'" />
            </div>
            <div>
              <label style="display: block; font-weight: 600; margin-bottom: 0.3rem;">Kecamatan</label>
              <input type="text" v-model="printConfig.kecamatan" placeholder="Contoh: Cikande" style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px;" :disabled="printConfigMode === 'otomatis'" />
            </div>
            <div>
              <label style="display: block; font-weight: 600; margin-bottom: 0.3rem;">Kabupaten / Kota</label>
              <input type="text" v-model="printConfig.kabupaten" placeholder="Contoh: Serang" style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px;" :disabled="printConfigMode === 'otomatis'" />
            </div>
          </div>
          
          <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem;">
            <button @click="showPrintSettings = false" class="btn btn-outline" style="min-width: 100px;">Batal</button>
            <button @click="executeCetakPdf" class="btn btn-primary" style="min-width: 120px;">Cetak Sekarang</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal Form Tambah Data Tamu -->
    <Teleport to="body">
      <div v-if="showForm" class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: block; z-index: 9999; overflow-y: auto; padding: 4rem 1rem;" @click.self="closeForm">
        <div class="modal-content animate-fade-in" style="background: white; border-radius: 12px; padding: 2.5rem; width: 100%; max-width: 900px; margin: 0 auto; flex-shrink: 0; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
          <h3 style="margin-top: 0; color: var(--color-primary); border-bottom: 1px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 2rem; font-size: 1.5rem;">
            {{ editingId ? 'Form Edit Data Tamu' : 'Form Tambah Data Tamu' }}
          </h3>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
            <!-- Left Column -->
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
              <div>
                <label style="display: block; font-weight: 600; margin-bottom: 0.3rem;">Tanggal Kunjungan</label>
                <input type="date" v-model="form.tanggal" style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;" />
              </div>
              <div>
                <label style="display: block; font-weight: 600; margin-bottom: 0.3rem;">Nama Tamu</label>
                <input type="text" v-model="form.nama_tamu" placeholder="Contoh: Bpk. Ahmad" style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;" />
              </div>
              <div>
                <label style="display: block; font-weight: 600; margin-bottom: 0.3rem;">Alamat / Jabatan Instansi</label>
                <input type="text" v-model="form.alamat_jabatan" placeholder="Contoh: Kepala Desa Suka Maju" style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;" />
              </div>
            </div>
            <!-- Right Column -->
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
              <div>
                <label style="display: block; font-weight: 600; margin-bottom: 0.3rem;">Mahasiswa yang Menemui (Opsional)</label>
                <select v-model="form.mhs_penyambut_id" style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; background: white;">
                  <option value="">-- Tidak Spesifik / Semua --</option>
                  <option v-for="u in props.users" :key="u.id" :value="u.id">{{ u.nama_lengkap }}</option>
                </select>
              </div>
              
              <div v-if="!editingId">
                <label style="display: block; font-weight: 600; margin-bottom: 0.3rem;">Keperluan / Tujuan</label>
                <textarea v-model="form.keperluan" rows="3" placeholder="Tujuan kedatangan..." style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; resize: vertical; box-sizing: border-box;"></textarea>
              </div>
            </div>
            
            <!-- Right Column -->
            <div style="display: flex; flex-direction: column;">
              <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #b91c1c;">Tanda Tangan Tamu (Wajib)</label>
              <p style="margin-top: 0; margin-bottom: 1rem; font-size: 0.85rem; color: #64748b;">Gunakan kursor mouse atau jari untuk membubuhkan tanda tangan di dalam kotak di bawah ini.</p>
              
              <div style="border: 2px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; position: relative; flex-grow: 1; min-height: 250px;">
                <canvas ref="sigCanvas" width="550" height="300" style="width: 100%; height: 100%; min-height: 250px; display: block; cursor: crosshair; touch-action: none;"
                  @mousedown="startDrawing" @mousemove="draw" @mouseup="stopDrawing" @mouseleave="stopDrawing"
                  @touchstart.prevent="startDrawingTouch" @touchmove.prevent="drawTouch" @touchend.prevent="stopDrawing">
                </canvas>
              </div>
                  <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; align-items: center;">
                    <span style="font-size: 0.8rem; color: var(--text-muted);">Tanda tangan di dalam kotak</span>
                    <div style="display: flex; gap: 0.5rem;">
                      <input type="file" ref="fileInput" @change="uploadAndExtractSignature" accept="image/*" style="display: none;" />
                      <button @click.prevent="$refs.fileInput.click()" class="btn btn-outline" style="padding: 0.25rem 0.75rem; font-size: 0.8rem; height: auto;" :disabled="isExtracting">
                        <i class="fas fa-camera"></i> {{ isExtracting ? 'Mengekstrak...' : 'Upload TTD (Auto Trace)' }}
                      </button>
                      <button @click.prevent="clearSignature" class="btn btn-outline" style="padding: 0.25rem 0.75rem; font-size: 0.8rem; height: auto;">Bersihkan</button>
                    </div>
                  </div>
            </div>
          </div>
          
          <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0;">
            <button @click="closeForm" class="btn btn-outline" style="min-width: 100px;">Batal</button>
            <button @click="submitForm" class="btn btn-primary" :disabled="isSubmitting" style="min-width: 150px;">
              {{ isSubmitting ? 'Menyimpan...' : (editingId ? 'Simpan Perubahan' : 'Simpan Buku Tamu') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    
    <!-- Hidden Print Container -->
    <div style="display: none;">
      <div id="print-buku-tamu" style="width: 297mm; padding: 20mm; font-family: 'Times New Roman', Times, serif; color: black; background: white;">
        
        <div v-for="(chunk, pageIndex) in chunkedTamuList" :key="'page-' + pageIndex" :class="{'html2pdf__page-break': pageIndex > 0}" :style="{ paddingTop: pageIndex > 0 ? '10mm' : '0' }">
          
          <h3 style="color: #1e3a8a; font-family: Arial, sans-serif; margin-bottom: 2rem;">Lampiran 5. Daftar Tamu</h3>
          <h2 style="text-align: center; margin-bottom: 5px; font-size: 16pt; font-weight: bold;">DAFTAR TAMU KKN</h2>
          <h3 style="text-align: center; margin-top: 0; margin-bottom: 20px; font-size: 14pt; font-weight: bold; text-transform: uppercase;">
            DESA {{ printConfig.desa }} KECAMATAN {{ printConfig.kecamatan }} KABUPATEN {{ printConfig.kabupaten }}
          </h3>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11pt;">
            <thead>
              <tr>
                <th style="border: 1px solid black; padding: 10px 5px; width: 5%;">No</th>
                <th style="border: 1px solid black; padding: 10px 5px; width: 15%;">Hari, Tanggal</th>
                <th style="border: 1px solid black; padding: 10px 5px; width: 20%;">Nama Tamu</th>
                <th style="border: 1px solid black; padding: 10px 5px; width: 20%;">Alamat / Jabatan<br>Tamu</th>
                <th style="border: 1px solid black; padding: 10px 5px; width: 15%;">Keperluan</th>
                <th style="border: 1px solid black; padding: 10px 5px; width: 15%;">Mhs Yang<br>Menemui</th>
                <th style="border: 1px solid black; padding: 10px 5px; width: 10%;">TTD<br>Tamu</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(t, idx) in chunk" :key="'print-'+t.id">
                <td style="border: 1px solid black; padding: 8px; text-align: center;">{{ (pageIndex * 5) + idx + 1 }}</td>
                <td style="border: 1px solid black; padding: 8px; text-align: center;">{{ formatDateWithDay(t.tanggal) }}</td>
                <td style="border: 1px solid black; padding: 8px;">{{ t.nama_tamu }}</td>
                <td style="border: 1px solid black; padding: 8px;">{{ t.alamat_jabatan }}</td>
                <td style="border: 1px solid black; padding: 8px;">{{ t.keperluan }}</td>
                <td style="border: 1px solid black; padding: 8px; text-align: center;">{{ t.nama_penyambut || '-' }}</td>
                <td style="border: 1px solid black; padding: 2px; text-align: center; vertical-align: middle; height: 50px;">
                  <img v-if="t.ttd_tamu_url" :src="t.ttd_tamu_url" style="max-height: 45px; max-width: 60px;" />
                </td>
              </tr>
              <tr v-if="chunk.length === 0">
                <td colspan="7" style="border: 1px solid black; padding: 15px; text-align: center; color: gray;">Belum ada histori tamu</td>
              </tr>
            </tbody>
          </table>
          
          <div v-if="pageIndex === chunkedTamuList.length - 1" style="margin-top: 30px; font-size: 10pt; line-height: 1.4;">
            <strong><u>Keterangan:</u></strong><br>
            1. Format daftar tamu dapat dibuat landscape<br>
            2. Kolom alamat/jabatan tamu silahkan diisi dengan alamat tamu dan jabatan di masyarakat jika mempunyai, misalnya: ketua RT 07 RW 03, Bayan, Bidan Desa, dan sebagainya<br>
            3. Keperluan diisi dengan keperluan dan penyelesaian/tanggapan dari tim KKN<br>
            4. Jika tim KKN mengadakan bimbingan belajar untuk anak sekolah, <strong>tidak perlu</strong> dimasukkan dalam daftar tamu
          </div>
          
        </div>
      </div>
    </div>
  </div>
</template>
