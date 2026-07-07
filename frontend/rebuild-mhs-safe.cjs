const fs = require('fs');

try {
  const adminFile = 'c:/Apache24/htdocs/sistem_management_kkn/frontend/src/views/AdminDashboard.vue';
  const mhsFile = 'c:/Apache24/htdocs/sistem_management_kkn/frontend/src/views/MahasiswaDashboard.vue';
  const adminContent = fs.readFileSync(adminFile, 'utf8');
  let mhsContent = fs.readFileSync(mhsFile, 'utf8');
  const lines = adminContent.split('\n');

  // ============================================
  // 1. EXTRACT FILE EXPLORER METHODS FROM ADMIN
  // ============================================
  const getRange = (startStr, endStr) => {
    const start = lines.findIndex(l => l.includes(startStr));
    let end = lines.findIndex((l, i) => i > start && l.includes(endStr));
    return lines.slice(start, end).join('\n');
  };

  const part1 = getRange('const toggleSelection =', '// --- PIC & PROKER STATES ---');
  const part2 = getRange('const contextMenu = ref({', 'const handleSearchInput =');
  const part3 = getRange('const fetchDirectory =', '// --- EXPIRED FOLDER HELPERS ---');

  let explorerScript = (part1 + '\n' + part2 + '\n' + part3)
    .replace(/adminToken/g, 'token')
    .replace(/fetchPicGroups\(\);/g, '')
    .replace(/loadQRSecret\(\);/g, '')
    .replace(/fetchGDriveStatus\(\);/g, '')
    .replace(/currentAdminUser/g, 'user');

  // ============================================
  // 2. BUILD SURAT SCRIPT (NEW)
  // ============================================
  const suratScript = `
// --- ARSIP SURAT RESMI STATES ---
import { getSuratPreviewHtml } from '../utils/suratTemplate';

const suratList = ref([]);
const suratTab = ref('draft'); 
const suratSearch = ref('');
const isSuratLoading = ref(false);

const isSuratEditorOpen = ref(false);
const currentSurat = ref(null);

const availableTemplates = [
  'Surat Permohonan Izin Kegiatan',
  'Surat Undangan',
  'Surat Permohonan Narasumber',
  'Surat Peminjaman Tempat',
  'Surat Peminjaman Peralatan',
  'Surat Dukungan / Kerja Sama',
  'Surat Tugas Internal',
  'Surat Keterangan Keikutsertaan',
  'Surat Permohonan Data',
  'Surat Berita Acara',
  'Surat Pengantar',
  'Surat Permohonan Sponsorship'
];

const fetchSurat = async () => {
  isSuratLoading.value = true;
  try {
    const res = await fetch('/api/surat', { headers: { 'Authorization': \`Bearer \${token.value}\` } });
    const data = await res.json();
    if(data.success) {
      suratList.value = data.data;
    }
  } catch(e) { console.error('Fetch Surat Failed', e); }
  finally { isSuratLoading.value = false; }
};

const openSuratCreator = () => {
  currentSurat.value = {
    id: null,
    jenis_surat: availableTemplates[0],
    nama_surat: '',
    nomor_surat: '',
    data_field: {
      universitas: 'UNIVERSITAS X',
      nama_desa: 'DESA CONTOH',
      nama_kecamatan: 'KEC. CONTOH',
      alamat_sekretariat: 'Jl. Raya Desa Contoh No. 123, Kab. Contoh'
    },
    status: 'draft'
  };
  isSuratEditorOpen.value = true;
};

const openSuratEditor = (surat) => {
  if (user.value?.jabatan !== 'Sekretaris' && surat.status === 'draft') {
    toastError('Hanya Sekretaris yang dapat mengedit draft surat.');
    return;
  }
  currentSurat.value = JSON.parse(JSON.stringify(surat));
  if (!currentSurat.value.data_field) currentSurat.value.data_field = {};
  isSuratEditorOpen.value = true;
};

const saveSurat = async (isFinal = false) => {
  try {
    const payload = { ...currentSurat.value, status: isFinal ? 'complete' : 'draft' };
    const method = payload.id ? 'PUT' : 'POST';
    const url = payload.id ? \`/api/surat/\${payload.id}\` : '/api/surat';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token.value}\` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(data.success) {
      toastSuccess(isFinal ? 'Surat difinalisasi!' : 'Draft disimpan!');
      isSuratEditorOpen.value = false;
      fetchSurat();
    } else {
      toastError(data.message || 'Gagal menyimpan surat');
    }
  } catch(e) { toastError('Terjadi kesalahan koneksi'); }
};

const cetakSurat = () => {
  if(!currentSurat.value) return;
  const element = document.createElement('div');
  element.innerHTML = getSuratPreviewHtml(currentSurat.value, user.value);
  html2pdf().set({
    margin: 10,
    filename: (currentSurat.value.nama_surat || currentSurat.value.jenis_surat) + '.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(element).save();
};

const deleteSurat = async (id) => {
  if(!await showConfirm('Hapus surat ini secara permanen?')) return;
  try {
    const res = await fetch(\`/api/surat/\${id}\`, {
      method: 'DELETE',
      headers: { 'Authorization': \`Bearer \${token.value}\` }
    });
    if(res.ok) {
      toastSuccess('Surat dihapus');
      fetchSurat();
    }
  } catch(e) { toastError('Gagal menghapus'); }
};
`;

  // GABUNGKAN SCRIPT LAMA + BARU
  const oldScriptStart = mhsContent.indexOf('const explorerFolders = ref([]);');
  const oldScriptEnd = mhsContent.indexOf('</script>');
  mhsContent = mhsContent.substring(0, oldScriptStart) + explorerScript + '\n' + suratScript + '\n' + mhsContent.substring(oldScriptEnd);

  // Inject fetchSurat into onMounted
  const onMountedIndex = mhsContent.indexOf('if (token.value) {');
  if (onMountedIndex > -1) {
    mhsContent = mhsContent.slice(0, onMountedIndex + 18) + '\n        fetchSurat();\n' + mhsContent.slice(onMountedIndex + 18);
  }

  // Lift import to top
  const importStr = "import { getSuratPreviewHtml } from '../utils/suratTemplate';";
  if (mhsContent.includes(importStr)) {
    mhsContent = mhsContent.replace(importStr, ''); // Remove from middle
    const scriptSetupIndex = mhsContent.indexOf('<script setup>');
    if (scriptSetupIndex !== -1) {
      const nextLineIndex = mhsContent.indexOf('\n', scriptSetupIndex);
      mhsContent = mhsContent.slice(0, nextLineIndex + 1) + importStr + '\n' + mhsContent.slice(nextLineIndex + 1);
    }
  }

  // ============================================
  // 3. EXTRACT HTML FROM ADMIN FOR EXPLORER
  // ============================================
  const getDivBlock = (startString) => {
    const startIdx = adminContent.indexOf(startString);
    if(startIdx === -1) return '';
    let endIdx = startIdx;
    let count = 0; let found = false;
    for(let i=startIdx; i<adminContent.length; i++){
      if(adminContent.substr(i, 4) === '<div') { count++; found = true; }
      if(adminContent.substr(i, 5) === '</div') { count--; }
      if(found && count === 0) { endIdx = i + 6; break; }
    }
    return adminContent.substring(startIdx, endIdx);
  };

  let adaptedHtml = getDivBlock('<div class="file-explorer-container">')
    .replace(/adminToken/g, 'token').replace(/currentAdminUser/g, 'user');
  let fbHtml = getDivBlock('<!-- Clipboard Floating Indicator -->')
    .replace(/adminToken/g, 'token');
  let ctxHtml = getDivBlock('<!-- Custom Right Click Context Menu -->')
    .replace(/adminToken/g, 'token');
  
  const overlayMatch = adminContent.match(/<div v-if="contextMenu.visible"[^>]*class="context-overlay"[^>]*><\/div>/);
  const overlayHtml = overlayMatch ? overlayMatch[0] : '';

  // ============================================
  // 4. BUILD SURAT HTML (NEW)
  // ============================================
  const suratHtml = `
        <!-- ARSIP SURAT RESMI -->
        <div class="status-card logbook-card animate-fade-in" style="margin-top: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <h2 style="margin: 0; color: var(--text-main); font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
              ✉️ Arsip Surat Resmi
            </h2>
            <button v-if="user?.jabatan === 'Sekretaris'" @click="openSuratCreator" class="btn-primary" style="background: #4f46e5; border-radius: 8px; font-weight: 600; padding: 0.6rem 1.2rem;">
              + Buat Surat Baru
            </button>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; gap: 0.5rem;">
              <button @click="suratTab = 'draft'" :class="suratTab === 'draft' ? 'btn-primary' : 'btn-outline'" style="border-radius: 20px; padding: 0.4rem 1.5rem; font-weight: 600;">Draft</button>
              <button @click="suratTab = 'complete'" :class="suratTab === 'complete' ? 'btn-primary' : 'btn-outline'" style="border-radius: 20px; padding: 0.4rem 1.5rem; font-weight: 600; background: suratTab === 'complete' ? '#fff' : ''; color: suratTab === 'complete' ? '#4f46e5' : ''; border: suratTab === 'complete' ? '1px solid #4f46e5' : ''">Selesai</button>
            </div>
            <input type="text" v-model="suratSearch" placeholder="Cari surat..." style="padding: 0.5rem 1rem; border: 1px solid #cbd5e1; border-radius: 20px; outline: none; width: 250px;" />
          </div>

          <div class="table-container" style="background: #f8fafc; border-radius: 12px; padding: 1rem; border: 1px solid #e2e8f0;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 2px solid #cbd5e1; color: #1e293b;">
                  <th style="padding: 1rem; font-weight: 700; font-size: 1.1rem;">Nomor Surat</th>
                  <th style="padding: 1rem; font-weight: 700; font-size: 1.1rem;">Nama Surat</th>
                  <th style="padding: 1rem; font-weight: 700; font-size: 1.1rem;">Jenis</th>
                  <th style="padding: 1rem; font-weight: 700; font-size: 1.1rem;">Tanggal</th>
                  <th style="padding: 1rem; font-weight: 400; font-style: italic; color: #64748b; text-align: right;">Opsi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="surat in suratList.filter(s => s.status === suratTab && (s.nama_surat.toLowerCase().includes(suratSearch.toLowerCase()) || s.jenis_surat.toLowerCase().includes(suratSearch.toLowerCase())))" :key="surat.id" style="border-bottom: 1px solid #e2e8f0; transition: background 0.2s;">
                  <td style="padding: 1rem; font-weight: 600; color: #334155;">{{ surat.nomor_surat }}</td>
                  <td style="padding: 1rem; color: #475569; font-weight: 500;">{{ surat.nama_surat }}</td>
                  <td style="padding: 1rem; color: #475569;">{{ surat.jenis_surat }}</td>
                  <td style="padding: 1rem; color: #64748b;">{{ new Date(surat.created_at).toLocaleDateString('id-ID') }}</td>
                  <td style="padding: 1rem; text-align: right; display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button v-if="surat.status === 'complete' || user?.jabatan === 'Sekretaris'" @click="openSuratEditor(surat)" style="background: #3b82f6; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">
                      {{ surat.status === 'draft' ? '📝 Edit' : '📄 Lihat PDF' }}
                    </button>
                    <button v-if="user?.jabatan === 'Sekretaris'" @click="deleteSurat(surat.id)" style="background: #ef4444; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">🗑️</button>
                  </td>
                </tr>
                <tr v-if="suratList.filter(s => s.status === suratTab).length === 0">
                  <td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">Belum ada surat yang ditemukan di tab ini.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- MODAL EDITOR SURAT -->
        <div v-if="isSuratEditorOpen" class="modal-overlay" style="z-index: 9999;">
          <div class="modal-content" style="max-width: 95vw; width: 1400px; padding: 0; display: flex; flex-direction: column; max-height: 95vh; overflow: hidden; background: #f8fafc;">
            
            <!-- HEADER EDITOR -->
            <div style="padding: 1rem 1.5rem; background: white; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <div>
                <h3 style="margin: 0; font-size: 1.25rem; color: #1e293b; font-weight: 700;">Editor: {{ currentSurat?.jenis_surat }}</h3>
                <p style="margin: 0; color: #64748b; font-size: 0.85rem;">Isi form di kiri, lihat hasil PDF di kanan secara real-time.</p>
              </div>
              <div style="display: flex; gap: 0.75rem;">
                <button @click="isSuratEditorOpen = false" class="btn-outline" style="border-radius: 20px; border: 1px solid #cbd5e1; color: #475569;">Batal</button>
                <button v-if="user?.jabatan === 'Sekretaris' && currentSurat?.status === 'draft'" @click="saveSurat(false)" class="btn-primary" style="border-radius: 20px; background: #3b82f6;">Simpan sebagai Draft</button>
                <button v-if="user?.jabatan === 'Sekretaris' && currentSurat?.status === 'draft'" @click="saveSurat(true); cetakSurat()" class="btn-primary" style="border-radius: 20px; background: #10b981;">Simpan Final & Cetak</button>
                <button v-if="currentSurat?.status === 'complete'" @click="cetakSurat()" class="btn-primary" style="border-radius: 20px; background: #10b981;">Cetak / Unduh PDF</button>
              </div>
            </div>

            <div style="display: flex; flex: 1; overflow: hidden;">
              <!-- KIRI: FORM INPUT -->
              <div v-if="user?.jabatan === 'Sekretaris' && currentSurat?.status === 'draft'" style="flex: 1; padding: 1.5rem; overflow-y: auto; background: white; border-right: 1px solid #e2e8f0;">
                
                <div class="form-group" style="margin-bottom: 1.5rem;">
                  <label style="font-weight: 700; color: #3b82f6;">Pilih Template Surat</label>
                  <select v-model="currentSurat.jenis_surat" class="form-input" style="border: 1px solid #93c5fd; background: #eff6ff;">
                    <option v-for="t in availableTemplates" :key="t" :value="t">{{ t }}</option>
                  </select>
                </div>

                <div class="form-group" style="margin-bottom: 1.5rem;">
                  <label style="font-weight: 700; color: #3b82f6;">Judul Surat (Nama Bebas)</label>
                  <input type="text" v-model="currentSurat.nama_surat" placeholder="Contoh: Undangan Rapat Karang Taruna..." class="form-input" style="border: 1px solid #93c5fd; background: #eff6ff;" />
                </div>
                
                <div class="form-group" style="margin-bottom: 1.5rem;">
                  <label style="font-weight: 700; color: #3b82f6;">Nomor Surat Resmi</label>
                  <input type="text" v-model="currentSurat.nomor_surat" placeholder="Contoh: 001/KKN-DS/2026" class="form-input" style="border: 1px solid #93c5fd; background: #eff6ff;" />
                </div>

                <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px dashed #cbd5e1; margin-bottom: 1.5rem;">
                  <h4 style="margin-top: 0; color: #475569; font-size: 0.85rem; letter-spacing: 0.5px;">PENGATURAN KOP SURAT (OTOMATIS TERSIMPAN)</h4>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                      <label style="font-size: 0.8rem; color: #64748b;">Universitas</label>
                      <input type="text" v-model="currentSurat.data_field.universitas" class="form-input" style="padding: 0.4rem; font-size: 0.9rem;" />
                    </div>
                    <div>
                      <label style="font-size: 0.8rem; color: #64748b;">Nama Desa</label>
                      <input type="text" v-model="currentSurat.data_field.nama_desa" class="form-input" style="padding: 0.4rem; font-size: 0.9rem;" />
                    </div>
                    <div>
                      <label style="font-size: 0.8rem; color: #64748b;">Nama Kecamatan</label>
                      <input type="text" v-model="currentSurat.data_field.nama_kecamatan" class="form-input" style="padding: 0.4rem; font-size: 0.9rem;" />
                    </div>
                    <div>
                      <label style="font-size: 0.8rem; color: #64748b;">Alamat Sekretariat</label>
                      <input type="text" v-model="currentSurat.data_field.alamat_sekretariat" class="form-input" style="padding: 0.4rem; font-size: 0.9rem;" />
                    </div>
                  </div>
                </div>

                <!-- DYNAMIC FIELDS BASED ON TEMPLATE -->
                <div v-if="currentSurat.jenis_surat === 'Surat Peminjaman Peralatan'">
                  <div class="form-group" style="margin-bottom: 1rem;">
                    <label style="font-weight: 700; color: #1e293b;">Daftar Alat</label>
                    <textarea v-model="currentSurat.data_field.daftar_alat" placeholder="Ketik disini..." class="form-input" rows="4"></textarea>
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div><label style="font-weight: 700;">Tanggal</label><input type="date" v-model="currentSurat.data_field.tanggal_pinjam" class="form-input" /></div>
                    <div><label style="font-weight: 700;">Waktu</label><input type="text" v-model="currentSurat.data_field.waktu_pinjam" placeholder="Contoh: 08:00 - Selesai" class="form-input" /></div>
                  </div>
                  <div class="form-group"><label style="font-weight: 700;">Keperluan</label><input type="text" v-model="currentSurat.data_field.keperluan" placeholder="Ketik disini..." class="form-input" /></div>
                </div>
                
                <div v-else-if="currentSurat.jenis_surat === 'Surat Undangan'">
                  <div class="form-group"><label style="font-weight: 700;">Tujuan Undangan (Yth...)</label><input type="text" v-model="currentSurat.data_field.tujuan" class="form-input" /></div>
                  <div class="form-group"><label style="font-weight: 700;">Nama Kegiatan</label><input type="text" v-model="currentSurat.data_field.nama_kegiatan" class="form-input" /></div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div><label style="font-weight: 700;">Tanggal</label><input type="date" v-model="currentSurat.data_field.tanggal_kegiatan" class="form-input" /></div>
                    <div><label style="font-weight: 700;">Waktu</label><input type="text" v-model="currentSurat.data_field.waktu_kegiatan" class="form-input" /></div>
                  </div>
                  <div class="form-group"><label style="font-weight: 700;">Tempat</label><input type="text" v-model="currentSurat.data_field.tempat_kegiatan" class="form-input" /></div>
                </div>
                
                <div v-else class="text-muted" style="padding: 1rem; text-align: center; background: #f1f5f9; border-radius: 8px;">
                  Template otomatis. Pastikan informasi KKN (Kop) sudah benar.
                </div>
              </div>

              <!-- KANAN: LIVE PREVIEW -->
              <div style="flex: 1.2; background: #94a3b8; padding: 2rem; overflow-y: auto; display: flex; justify-content: center;">
                <div style="background: white; width: 210mm; min-height: 297mm; padding: 20mm; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border-radius: 4px;" v-html="getSuratPreviewHtml(currentSurat, user)">
                </div>
              </div>
            </div>
          </div>
        </div>
`;

  // ============================================
  // 5. INJECT HTML TO MAHASISWA (SAFE REPLACE)
  // ============================================
  const mhsHtmlStartStr = '<!-- MINI EXPLORER (UNDER ABSENSI) -->';
  const mhsHtmlStart = mhsContent.indexOf(mhsHtmlStartStr);
  const mhsHtmlEnd = mhsContent.indexOf('</template>', mhsHtmlStart) + 11; // 11 is length of '</template>'
  
  if (mhsHtmlStart === -1 || mhsHtmlEnd < 11) throw new Error('Penanda MINI EXPLORER atau </template> tidak ditemukan!');

  mhsContent = mhsContent.substring(0, mhsHtmlStart) + 
    suratHtml + '\n' +
    adaptedHtml + '\n' + fbHtml + '\n' + overlayHtml + '\n' + ctxHtml + '\n' + 
    mhsContent.substring(mhsHtmlEnd);

  // ============================================
  // 6. INJECT HARDCODED CSS (Mencegah keracunan HTML Print Admin)
  // ============================================
  const pureCSS = `
/* --- Advanced Explorer CSS --- */
.file-item.selected-item {
  background-color: rgba(16, 185, 129, 0.15) !important;
  border-color: var(--color-primary) !important;
  box-shadow: 0 0 0 1px var(--color-primary);
}
.grid-view.list-view-mode {
  display: flex !important;
  flex-direction: column !important;
  gap: 0.5rem !important;
}
.grid-view.list-view-mode .file-item {
  width: 100% !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-start !important;
  padding: 0.5rem 1rem !important;
  height: auto !important;
}
.grid-view.list-view-mode .file-icon {
  font-size: 1.5rem !important;
  margin-bottom: 0 !important;
  margin-right: 1rem !important;
}
.grid-view.list-view-mode .file-name {
  flex: 1 !important;
  text-align: left !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.grid-view.list-view-mode .file-meta {
  margin-top: 0 !important;
  margin-left: 1rem !important;
}
.context-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9998;
}
`;

  const mhsCssEnd = mhsContent.lastIndexOf('</style>');
  mhsContent = mhsContent.substring(0, mhsCssEnd) + '\n' + pureCSS + '\n' + mhsContent.substring(mhsCssEnd);

  fs.writeFileSync(mhsFile, mhsContent, 'utf8');
  console.log('Mahasiswa Dashboard FULLY REBUILT WITH PURE CSS!');

} catch(err) {
  console.error('Error saat rebuild:', err.message);
}
