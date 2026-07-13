<script setup>
import { ref, watch, nextTick } from 'vue';
import html2pdf from 'html2pdf.js';

const props = defineProps({
  show: Boolean,
  poskoId: Number,
  token: String
});

const emit = defineEmits(['close']);

// Form State
const startDate = ref(new Date().toISOString().split('T')[0]);
const endDate = ref(new Date().toISOString().split('T')[0]);

const isLoadingData = ref(false);
const isGeneratingPdf = ref(false);

const rekapData = ref({ logbooks: [] });

// Watch for poskoId and fetch data
watch(() => props.show, async (newVal) => {
  if (newVal && props.poskoId) {
    await fetchRekapData();
  }
});

const fetchRekapData = async () => {
  if (!props.poskoId) return;
  isLoadingData.value = true;
  try {
    let url = `/api/posko/${props.poskoId}/rekap-logbook?start_date=${startDate.value}&end_date=${endDate.value}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${props.token}` }
    });
    const result = await res.json();
    if (result.logbooks) {
      rekapData.value.logbooks = result.logbooks;
    }
  } catch (e) {
    console.error(e);
  } finally {
    isLoadingData.value = false;
  }
};

// Whenever start date or end date changes, re-fetch
watch([startDate, endDate], () => {
  if (props.show) fetchRekapData();
});

const formatTanggal = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${days[d.getDay()]},\n${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const hitungDurasi = (start, end) => {
  if (!start || !end) return '-';
  const d1 = new Date(`2000-01-01T${start}`);
  const d2 = new Date(`2000-01-01T${end}`);
  let diff = (d2 - d1) / 3600000;
  if (diff < 0) diff += 24; // If crosses midnight
  return diff.toFixed(1).replace('.0', '');
};

const getFirstImage = (photos) => {
  if (!photos || photos.length === 0) return null;
  const img = photos.find(p => p.nama_file && p.nama_file.match(/\.(jpg|jpeg|png|gif)$/i));
  return img ? img.file_path : null;
};

const generatePDF = async () => {
  isGeneratingPdf.value = true;
  await nextTick();
  
  const element = document.getElementById('cetak-logbook-template');
  const cloned = element.cloneNode(true);
  cloned.style.display = 'block';
  document.body.appendChild(cloned);
  
  const opt = {
    margin:       10,
    filename:     `Logbook_Kegiatan_${startDate.value}_sd_${endDate.value}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
  };
  
  try {
    await html2pdf().from(cloned).set(opt).save();
  } catch (err) {
    alert("Gagal mencetak PDF.");
  } finally {
    document.body.removeChild(cloned);
    isGeneratingPdf.value = false;
    emit('close');
  }
};
</script>

<template>
  <div>
    <!-- MODAL -->
    <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content">
        <h3>Cetak Logbook Kegiatan (Lampiran 8)</h3>
        <p class="text-muted" style="margin-bottom: 1.5rem; font-size: 0.9rem;">Menghasilkan PDF gabungan seluruh logbook dari setiap PIC kelompok</p>
        
        <div class="form-grid">
          <div class="form-group" style="grid-column: span 1;">
            <label>Dari Tanggal</label>
            <input type="date" v-model="startDate" class="form-input" />
          </div>
          <div class="form-group" style="grid-column: span 1;">
            <label>Sampai Tanggal</label>
            <input type="date" v-model="endDate" class="form-input" />
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem;">
          <button @click="$emit('close')" class="btn-cancel">Batal</button>
          <button @click="generatePDF" class="btn-primary" :disabled="isGeneratingPdf || isLoadingData || rekapData.logbooks.length === 0">
            <span v-if="isGeneratingPdf">Membuat PDF...</span>
            <span v-else-if="isLoadingData">Memuat Data...</span>
            <span v-else-if="rekapData.logbooks.length === 0">Data Kosong</span>
            <span v-else>Download PDF ({{ rekapData.logbooks.length }} Kegiatan) ???</span>
          </button>
        </div>
      </div>
    </div>

    <!-- HIDDEN PDF TEMPLATE -->
    <div v-if="show" id="cetak-logbook-template" style="display: none; padding: 20px; font-family: 'Times New Roman', Times, serif; color: black; background: white;">
      <h3 style="color: #1e3a8a; text-align: left; font-size: 12pt; margin-bottom: 20px; font-weight: bold;">
        Lampiran 8. Logbook Kegiatan Harian
      </h3>
      
      <h2 style="text-align: center; font-size: 12pt; font-weight: bold; margin-bottom: 30px;">
        LOGBOOK KEGIATAN HARIAN
      </h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 10pt;">
        <thead>
          <tr>
            <th style="border: 1px solid black; padding: 8px; text-align: center; width: 30px;">No</th>
            <th style="border: 1px solid black; padding: 8px; text-align: center; width: 100px;">Hari /<br>Tanggal</th>
            <th style="border: 1px solid black; padding: 8px; text-align: center; width: 100px;">Waktu &<br>Durasi<br>Kegiatan</th>
            <th style="border: 1px solid black; padding: 8px; text-align: center;">Kegiatan yang<br>Dilakukan</th>
            <th style="border: 1px solid black; padding: 8px; text-align: center; width: 120px;">Tempat</th>
            <th style="border: 1px solid black; padding: 8px; text-align: center; width: 150px;">Penanggung Jawab/PIC<br>dan sasaran/peserta</th>
            <th style="border: 1px solid black; padding: 8px; text-align: center; width: 110px;">Foto<br>Kegiatan</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(log, index) in rekapData.logbooks" :key="log.id">
            <td style="border: 1px solid black; padding: 6px; text-align: center; vertical-align: top;">{{ index + 1 }}</td>
            <td style="border: 1px solid black; padding: 6px; vertical-align: top; white-space: pre-line;">{{ formatTanggal(log.tanggal) }}</td>
            <td style="border: 1px solid black; padding: 6px; vertical-align: top;">
              {{ log.waktu_mulai?.slice(0,5) || '-' }} - {{ log.waktu_selesai?.slice(0,5) || '-' }}<br>
              <span v-if="log.waktu_mulai && log.waktu_selesai">{{ hitungDurasi(log.waktu_mulai, log.waktu_selesai) }} jam</span>
            </td>
            <td style="border: 1px solid black; padding: 6px; vertical-align: top;">
              <div v-html="log.deskripsi" class="pdf-html-content"></div>
            </td>
            <td style="border: 1px solid black; padding: 6px; vertical-align: top;">{{ log.tempat || '-' }}</td>
            <td style="border: 1px solid black; padding: 6px; vertical-align: top;">
              <strong>PIC:</strong> {{ log.proker }} ({{ log.nama_pic }})<br><br>
              <strong>Peserta:</strong> {{ log.sasaran || '-' }}
            </td>
            <td style="border: 1px solid black; padding: 6px; text-align: center; vertical-align: top;">
               <img v-if="getFirstImage(log.photos)" :src="getFirstImage(log.photos)" style="max-width: 90px; max-height: 90px; object-fit: cover;" crossorigin="anonymous" />
            </td>
          </tr>
        </tbody>
      </table>

      <div style="font-size: 10pt; line-height: 1.5;">
        <strong>Keterangan:</strong>
        <ol style="padding-left: 20px; margin-top: 5px;">
          <li>Pengisian logbook dimulai dari orientasi dan observasi lapangan, penerjunan, sampai dengan penarikan</li>
          <li>Semua kegiatan yang dilakukan tim KKN dapat dicatat, mulai persiapan/penyiapan perlengkapan untuk kegiatan</li>
          <li>Dalam sehari dapat mencatat beberapa kegiatan</li>
          <li>Dalam waktu yang bersamaan memungkinkan ada 2 atau lebih kegiatan (ditulis semua) jika memang ada pembagian tugas</li>
        </ol>
      </div>
    </div>

  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}
.modal-content {
  background: white; padding: 2.5rem; border-radius: 16px;
  width: 90%; max-width: 500px;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
}
h3 { margin-top: 0; margin-bottom: 0.5rem; color: #1e293b; font-size: 1.25rem; font-weight: 600; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #475569; font-size: 0.9rem; }
.form-input {
  width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem;
  background: #f8fafc; color: #1e293b; transition: all 0.2s;
}
.form-input:focus { border-color: #3b82f6; outline: none; background: white; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.btn-primary {
  background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white;
  border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;
}
.btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2); }
.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
.btn-cancel {
  background: white; color: #475569; border: 1px solid #cbd5e1;
  padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;
}
.btn-cancel:hover { background: #f1f5f9; color: #1e293b; }
.text-muted { color: #64748b; }
.text-center { text-align: center; }
:deep(.pdf-html-content p) { margin: 0 0 5px 0; }
:deep(.pdf-html-content ul) { margin: 0; padding-left: 15px; }
</style>
