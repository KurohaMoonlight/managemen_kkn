<script setup>
import { ref, watch, onMounted, nextTick, computed } from 'vue';
import html2pdf from 'html2pdf.js';

const props = defineProps({
  show: Boolean,
  poskoId: Number,
  token: String
});

const emit = defineEmits(['close']);

// Form State
const desa = ref('');
const kecamatanKabupaten = ref('');
const dplNama = ref('');
const dplNidn = ref('');
const kordesNama = ref('');
const kordesNim = ref('');
const formatCetak = ref('mingguan'); // 'mingguan' atau 'harian'
const startDate = ref(new Date().toISOString().split('T')[0]);
const endDate = ref(new Date().toISOString().split('T')[0]);

const isLoadingData = ref(false);
const isGeneratingPdf = ref(false);

const rekapData = ref({ mahasiswa: [], absensi: [] });

// Watch for poskoId and fetch data to autofill DPL & Kordes
watch(() => props.show, async (newVal) => {
  if (newVal && props.poskoId) {
    await fetchRekapData();
  }
});

const fetchRekapData = async () => {
  if (!props.poskoId) return;
  isLoadingData.value = true;
  try {
    let url = `/api/posko/${props.poskoId}/rekap-absensi`;
    const strStart = startDate.value;
    
    if (formatCetak.value === 'mingguan') {
      const d = new Date(startDate.value);
      d.setDate(d.getDate() + 6);
      const strEnd = d.toISOString().split('T')[0];
      url += `?start_date=${strStart}&end_date=${strEnd}`;
    } else if (formatCetak.value === 'seluruh') {
      url += `?start_date=${strStart}&end_date=${endDate.value}`;
    } else {
      url += `?start_date=${strStart}&end_date=${strStart}`;
    }

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${props.token}` }
    });
    const result = await res.json();
    if (result.success) {
      const d = result.data;
      if (d.dpl) {
        dplNama.value = dplNama.value || d.dpl.nama_lengkap;
        dplNidn.value = dplNidn.value || d.dpl.nidn;
      }
      if (d.kordes) {
        kordesNama.value = kordesNama.value || d.kordes.nama_lengkap;
        kordesNim.value = kordesNim.value || d.kordes.nim;
      }
      
      rekapData.value.mahasiswa = d.mahasiswa;
      rekapData.value.absensi = d.absensi;
    }
  } catch (e) {
    console.error(e);
  } finally {
    isLoadingData.value = false;
  }
};

// Whenever start date, end date, or format changes, re-fetch to get correct attendance range
watch([formatCetak, startDate, endDate], () => {
  if (props.show) fetchRekapData();
});

const weeklyChunks = computed(() => {
  if (formatCetak.value === 'harian') {
    return [[new Date(startDate.value)]];
  }
  
  if (formatCetak.value === 'mingguan') {
    const start = new Date(startDate.value);
    const arr = [];
    for(let i=0; i<7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push(d);
    }
    return [arr];
  }
  
  if (formatCetak.value === 'seluruh') {
    const start = new Date(startDate.value);
    const end = new Date(endDate.value);
    const chunks = [];
    let current = new Date(start);
    
    while (current <= end) {
      const chunk = [];
      for(let i=0; i<7; i++) {
        if (current > end) break;
        chunk.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      chunks.push(chunk);
    }
    return chunks;
  }
  return [];
});

const pad = (n) => n.toString().padStart(2, '0');
const toLocalISOString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const getAbsensiStatus = (userId, dateObj) => {
  const tglStr = toLocalISOString(dateObj);
  const rec = rekapData.value.absensi.find(a => a.user_id === userId && a.tanggal.startsWith(tglStr));
  if (!rec) return '';
  if (rec.status === 'hadir') return '✅';
  if (rec.status === 'izin') return 'I';
  if (rec.status === 'sakit') return 'S';
  if (rec.status === 'alpha') return 'A';
  return rec.status; // telat -> hadir?
};

const getKeterangan = (userId, chunk) => {
  let kets = [];
  for (const d of chunk) {
    const tglStr = toLocalISOString(d);
    const rec = rekapData.value.absensi.find(a => a.user_id === userId && a.tanggal.startsWith(tglStr));
    if (rec && rec.status !== 'hadir') {
      let ketStr = `${d.getDate()}/${d.getMonth()+1}: ${rec.status.toUpperCase()}`;
      if (rec.alasan) {
        ketStr += ` (${rec.alasan})`;
      }
      kets.push(ketStr);
    }
  }
  return kets.join(', ');
};

const generatePDF = async () => {
  isGeneratingPdf.value = true;
  await nextTick(); // Ensure hidden template is rendered
  
  const element = document.getElementById('cetak-absensi-template');
  
  // Clone element to apply inline styles specifically for PDF, bypassing scoped styles
  const cloned = element.cloneNode(true);
  cloned.style.display = 'block';
  document.body.appendChild(cloned);

  const opt = {
    margin:       10,
    filename:     `Daftar_Hadir_Tim_KKN_${Date.now()}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: formatCetak.value === 'mingguan' ? 'landscape' : 'portrait' }
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
        <h3>Cetak Rekap Absensi</h3>
        <p class="text-muted" style="margin-bottom: 1.5rem; font-size: 0.9rem;">Sesuaikan data untuk Lampiran 4. Daftar Hadir Harian Tim KKN</p>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Desa</label>
            <input type="text" v-model="desa" placeholder="Contoh: Margosari" class="form-input" />
          </div>
          <div class="form-group">
            <label>Kecamatan / Kabupaten</label>
            <input type="text" v-model="kecamatanKabupaten" placeholder="Contoh: Patebon / Kendal" class="form-input" />
          </div>
          
          <div class="form-group">
            <label>Nama Kordes</label>
            <input type="text" v-model="kordesNama" placeholder="Otomatis jika Kordes diset..." class="form-input" />
          </div>
          <div class="form-group">
            <label>NIM Kordes</label>
            <input type="text" v-model="kordesNim" class="form-input" />
          </div>

          <div class="form-group">
            <label>Nama DPL</label>
            <input type="text" v-model="dplNama" placeholder="Otomatis jika ada DPL..." class="form-input" />
          </div>
          <div class="form-group">
            <label>NIDN DPL</label>
            <input type="text" v-model="dplNidn" class="form-input" />
          </div>

          <div class="form-group" style="grid-column: span 2;">
            <label>Format Cetak</label>
            <select v-model="formatCetak" class="form-input">
              <option value="mingguan">Mingguan (7 Hari) - Rekomendasi Format UMK</option>
              <option value="harian">Harian (1 Hari)</option>
              <option value="seluruh">Seluruh Periode KKN (Beda Kertas Per Minggu)</option>
            </select>
          </div>
          
          <div class="form-group" :style="{ gridColumn: formatCetak === 'seluruh' ? 'span 1' : 'span 2' }">
            <label>Tanggal Mulai</label>
            <input type="date" v-model="startDate" class="form-input" />
            <small class="text-muted" style="margin-top:0.3rem; display:block;">
              <template v-if="formatCetak === 'mingguan'">
                7 kolom absensi akan dihitung dari tanggal ini.
              </template>
              <template v-else-if="formatCetak === 'seluruh'">
                Tanggal observasi / penerjunan.
              </template>
            </small>
          </div>

          <div class="form-group" v-if="formatCetak === 'seluruh'">
            <label>Tanggal Selesai</label>
            <input type="date" v-model="endDate" class="form-input" />
            <small class="text-muted" style="margin-top:0.3rem; display:block;">
              Sistem akan membagi rentang ini menjadi per minggu dan memisahkan halamannya.
            </small>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem;">
          <button @click="$emit('close')" class="btn-cancel">Batal</button>
          <button @click="generatePDF" class="btn-primary" :disabled="isGeneratingPdf || isLoadingData">
            <span v-if="isGeneratingPdf">Membuat PDF...</span>
            <span v-else-if="isLoadingData">Memuat Data...</span>
            <span v-else>Download PDF 🖨️</span>
          </button>
        </div>
      </div>
    </div>

    <!-- HIDDEN PDF TEMPLATE -->
    <div v-if="show" id="cetak-absensi-template" style="display: none; padding: 20px; font-family: 'Times New Roman', Times, serif; color: black; background: white;">
      
      <div v-for="(chunk, idx) in weeklyChunks" :key="idx" :style="{ pageBreakAfter: idx < weeklyChunks.length - 1 ? 'always' : 'auto', marginBottom: idx < weeklyChunks.length - 1 ? '0' : '0' }">
        <h3 style="color: #1e3a8a; text-align: left; font-size: 14pt; margin-bottom: 20px; font-weight: bold;">
          Lampiran 4. Daftar Hadir Harian Tim KKN <span v-if="formatCetak === 'seluruh'">(Minggu ke-{{ idx + 1 }})</span>
        </h3>
        
        <h2 style="text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 30px;">
          DAFTAR HADIR HARIAN TIM KKN
        </h2>
        
        <table style="width: 100%; max-width: 600px; margin-bottom: 20px; border: none; font-size: 11pt;">
        <tbody>
          <tr>
            <td style="width: 100px; border: none; padding: 4px;">Desa</td>
            <td style="border: none; padding: 4px;">: {{ desa || '........................' }} &nbsp;&nbsp;&nbsp; Kec./Kab. : {{ kecamatanKabupaten || '........................' }} / {{ kecamatanKabupaten || '........................' }}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px;">Kordes</td>
            <td style="border: none; padding: 4px;">: {{ kordesNama || '........................' }} / NIM. {{ kordesNim || '........' }}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px;">DPL</td>
            <td style="border: none; padding: 4px;">: {{ dplNama || '........................' }} / NIDN. {{ dplNidn || '........' }}</td>
          </tr>
        </tbody>
      </table>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 11pt;">
        <thead>
          <tr>
            <th style="border: 1px solid black; padding: 8px; text-align: center;">No</th>
            <th style="border: 1px solid black; padding: 8px; text-align: center;">NIM</th>
            <th style="border: 1px solid black; padding: 8px; text-align: center;">Nama</th>
            <template v-for="d in chunk" :key="d.getTime()">
              <th style="border: 1px solid black; padding: 8px; text-align: center; min-width: 30px;">
                Tgl<br>{{ d.getDate() }}/{{ d.getMonth()+1 }}
              </th>
            </template>
            <th style="border: 1px solid black; padding: 8px; text-align: center; width: 150px;">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(mhs, index) in rekapData.mahasiswa" :key="mhs.id">
            <td style="border: 1px solid black; padding: 6px; text-align: center;">{{ index + 1 }}</td>
            <td style="border: 1px solid black; padding: 6px; text-align: center;">{{ mhs.nim }}</td>
            <td style="border: 1px solid black; padding: 6px;">{{ mhs.nama_lengkap }}</td>
            
            <template v-for="d in chunk" :key="'td'+d.getTime()">
              <td style="border: 1px solid black; padding: 6px; text-align: center;">
                {{ getAbsensiStatus(mhs.id, d) }}
              </td>
            </template>
            
            <td style="border: 1px solid black; padding: 6px; font-size: 10pt;">
              {{ getKeterangan(mhs.id, chunk) }}
            </td>
          </tr>
        </tbody>
      </table>

      <div style="font-size: 11pt; line-height: 1.5;">
        <strong>Keterangan:</strong>
        <ol style="padding-left: 20px; margin-top: 5px;">
          <li>Daftar hadir dibuat perminggu (minggu ke-1, 2, 3, 4 setiap 7 hari, untuk minggu ke-5 dibuat sisa harinya sampai hari penarikan)</li>
          <li>Tanggal dimulai dari saat observasi lapangan sampai penarikan</li>
          <li>Kolom keterangan diisi alasan jika anggota tim ada ijin/tidak hadir di posko KKN dan telah mendapatkan ijin dari DPL, misalnya bekerja (untuk mahasiswa yang bekerja)</li>
          <li>Format daftar hadir dapat dibuat landscape</li>
        </ol>
      </div>
      
      </div>
    </div>

  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
}

.modal-content {
  background: white;
  padding: 2.5rem;
  border-radius: 20px;
  width: 100%;
  max-width: 600px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
}

.modal-content h3 {
  margin: 0 0 0.5rem;
  color: var(--text-main);
  font-family: var(--font-display);
  font-size: 1.5rem;
}

.text-muted {
  color: var(--text-muted);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-main);
}

.form-input {
  padding: 0.75rem 1rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.95rem;
  transition: all 0.2s;
  background: #f8fafc;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  background: white;
  box-shadow: 0 0 0 3px rgba(37, 187, 151, 0.1);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(37, 187, 151, 0.3);
}

.btn-primary:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.btn-cancel {
  background: white;
  color: #64748b;
  border: 1px solid #cbd5e1;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: #f1f5f9;
  color: #0f172a;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .form-group {
    grid-column: span 1 !important;
  }
}
</style>
