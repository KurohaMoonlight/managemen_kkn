const fs = require('fs');

const file = 'c:/Apache24/htdocs/sistem_management_kkn/frontend/src/views/MahasiswaDashboard.vue';
let c = fs.readFileSync(file, 'utf8');

// ============================================
// STEP 1: Add computed to Vue import
// ============================================
c = c.replace(
  "import { ref, onMounted, onBeforeUnmount } from 'vue';",
  "import { ref, onMounted, onBeforeUnmount, computed } from 'vue';"
);
console.log('Step 1: computed import added');

// ============================================
// STEP 2: Inject helper functions before </script>
// ============================================
const helperFunctions = `
// ============================================
// HELPER: Toast Notification & Confirm Dialog
// ============================================
const toastMessage = ref('');
const toastType = ref('success');
const toastVisible = ref(false);
let toastTimer = null;

const showToast = (msg, type = 'success') => {
  toastMessage.value = msg;
  toastType.value = type;
  toastVisible.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastVisible.value = false; }, 3500);
};

const toastSuccess = (msg) => showToast(msg, 'success');
const toastError = (msg) => showToast(msg, 'error');

const showConfirm = (msg) => {
  return new Promise((resolve) => {
    resolve(window.confirm(msg));
  });
};

// ============================================
// SURAT RESMI STATES & FUNCTIONS
// ============================================
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
    if (data.success) suratList.value = data.data;
  } catch(e) { console.error('Fetch Surat Failed', e); }
  finally { isSuratLoading.value = false; }
};

const openSuratCreator = () => {
  currentSurat.value = {
    id: null, jenis_surat: availableTemplates[0], nama_surat: '', nomor_surat: '',
    data_field: { universitas: 'UNIVERSITAS X', nama_desa: 'DESA CONTOH', nama_kecamatan: 'KEC. CONTOH', alamat_sekretariat: 'Jl. Raya Desa No. 1' },
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
    if (data.success) {
      toastSuccess(isFinal ? 'Surat difinalisasi!' : 'Draft disimpan!');
      isSuratEditorOpen.value = false;
      fetchSurat();
    } else { toastError(data.message || 'Gagal menyimpan surat'); }
  } catch(e) { toastError('Terjadi kesalahan koneksi'); }
};

const cetakSurat = () => {
  if (!currentSurat.value) return;
  const element = document.createElement('div');
  element.innerHTML = getSuratPreviewHtml(currentSurat.value, user.value);
  html2pdf().set({
    margin: 10, filename: (currentSurat.value.nama_surat || currentSurat.value.jenis_surat) + '.pdf',
    image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(element).save();
};

const deleteSurat = async (id) => {
  if (!await showConfirm('Hapus surat ini secara permanen?')) return;
  try {
    const res = await fetch(\`/api/surat/\${id}\`, { method: 'DELETE', headers: { 'Authorization': \`Bearer \${token.value}\` } });
    if (res.ok) { toastSuccess('Surat dihapus'); fetchSurat(); }
  } catch(e) { toastError('Gagal menghapus'); }
};
`;

// Insert before </script>
c = c.replace('</script>', helperFunctions + '\n</script>');
console.log('Step 2: helper + surat functions injected');

// ============================================
// STEP 3: Move import to top (after <script setup>)
// ============================================
const importStr = "import { getSuratPreviewHtml } from '../utils/suratTemplate';";
// Remove from middle
c = c.replace('\n' + importStr, '');
// Add right after <script setup>
c = c.replace('<script setup>\n', '<script setup>\n' + importStr + '\n');
console.log('Step 3: import moved to top');

// ============================================
// STEP 4: Inject fetchSurat() into onMounted
// ============================================
if (c.includes("fetchSurat();")) {
  console.log('Step 4: fetchSurat already present');
} else {
  c = c.replace('checkAbsensiStatus();\n  fetchProkerData();', 'checkAbsensiStatus();\n  fetchProkerData();\n  fetchSurat();');
  console.log('Step 4: fetchSurat added to onMounted');
}

// ============================================
// STEP 5: Replace alert() calls with toastError in explorer
// ============================================
c = c.replace(/alert\(d\.message \|\| "Gagal menghapus\."\);/, 'toastError(d.message || "Gagal menghapus.");');
c = c.replace(/alert\("Terjadi kesalahan jaringan\."\);/, 'toastError("Terjadi kesalahan jaringan.");');
console.log('Step 5: alert() calls replaced');

// ============================================
// STEP 6: Inject Surat HTML before </template>
// ============================================
const suratHtml = `
    <!-- ARSIP SURAT RESMI -->
    <div class="status-card animate-fade-in" style="margin-top: 2rem; background: white; border-radius: 16px; padding: 1.5rem; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <h2 style="margin: 0; color: #1e293b; font-size: 1.4rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
          ✉️ Arsip Surat Resmi
        </h2>
        <button v-if="user?.jabatan === 'Sekretaris'" @click="openSuratCreator" style="background: #4f46e5; color: white; border: none; border-radius: 8px; font-weight: 600; padding: 0.6rem 1.2rem; cursor: pointer;">
          + Buat Surat Baru
        </button>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; gap: 0.5rem;">
          <button @click="suratTab = 'draft'" :style="{ borderRadius: '20px', padding: '0.4rem 1.5rem', fontWeight: '600', background: suratTab === 'draft' ? '#4f46e5' : '#f1f5f9', color: suratTab === 'draft' ? 'white' : '#475569', border: 'none', cursor: 'pointer' }">Draft</button>
          <button @click="suratTab = 'complete'" :style="{ borderRadius: '20px', padding: '0.4rem 1.5rem', fontWeight: '600', background: suratTab === 'complete' ? '#4f46e5' : '#f1f5f9', color: suratTab === 'complete' ? 'white' : '#475569', border: 'none', cursor: 'pointer' }">Selesai</button>
        </div>
        <input type="text" v-model="suratSearch" placeholder="Cari surat..." style="padding: 0.5rem 1rem; border: 1px solid #cbd5e1; border-radius: 20px; outline: none; width: 250px;" />
      </div>

      <div style="background: #f8fafc; border-radius: 12px; padding: 1rem; border: 1px solid #e2e8f0;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 2px solid #cbd5e1; color: #1e293b;">
              <th style="padding: 0.8rem; font-weight: 700;">Nomor Surat</th>
              <th style="padding: 0.8rem; font-weight: 700;">Nama Surat</th>
              <th style="padding: 0.8rem; font-weight: 700;">Jenis</th>
              <th style="padding: 0.8rem; font-weight: 700;">Tanggal</th>
              <th style="padding: 0.8rem; text-align: right; font-style: italic; color: #64748b;">Opsi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="surat in suratList.filter(s => s.status === suratTab && ((s.nama_surat||'').toLowerCase().includes(suratSearch.toLowerCase()) || s.jenis_surat.toLowerCase().includes(suratSearch.toLowerCase())))" :key="surat.id" style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 0.8rem; font-weight: 600; color: #334155;">{{ surat.nomor_surat }}</td>
              <td style="padding: 0.8rem; color: #475569;">{{ surat.nama_surat }}</td>
              <td style="padding: 0.8rem; color: #475569; font-size: 0.85rem;">{{ surat.jenis_surat }}</td>
              <td style="padding: 0.8rem; color: #64748b; font-size: 0.85rem;">{{ new Date(surat.created_at).toLocaleDateString('id-ID') }}</td>
              <td style="padding: 0.8rem; text-align: right;">
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                  <button v-if="surat.status === 'complete' || user?.jabatan === 'Sekretaris'" @click="openSuratEditor(surat)" style="background: #3b82f6; color: white; border: none; padding: 0.35rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">
                    {{ surat.status === 'draft' ? '📝 Edit' : '📄 Lihat' }}
                  </button>
                  <button v-if="user?.jabatan === 'Sekretaris'" @click="deleteSurat(surat.id)" style="background: #ef4444; color: white; border: none; padding: 0.35rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">🗑️</button>
                </div>
              </td>
            </tr>
            <tr v-if="suratList.filter(s => s.status === suratTab).length === 0">
              <td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">Belum ada surat di tab ini.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL EDITOR SURAT -->
    <div v-if="isSuratEditorOpen" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 9999; display: flex; align-items: center; justify-content: center;">
      <div style="max-width: 95vw; width: 1400px; max-height: 95vh; background: #f8fafc; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <div style="padding: 1rem 1.5rem; background: white; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="margin: 0; font-size: 1.2rem; color: #1e293b; font-weight: 700;">✉️ Editor: {{ currentSurat?.jenis_surat }}</h3>
            <p style="margin: 0; color: #64748b; font-size: 0.8rem;">Isi form di kiri, lihat preview di kanan secara real-time.</p>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button @click="isSuratEditorOpen = false" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; border-radius: 20px; padding: 0.4rem 1rem; cursor: pointer;">Batal</button>
            <button v-if="user?.jabatan === 'Sekretaris' && currentSurat?.status === 'draft'" @click="saveSurat(false)" style="background: #3b82f6; color: white; border: none; border-radius: 20px; padding: 0.4rem 1rem; cursor: pointer; font-weight: 600;">💾 Simpan Draft</button>
            <button v-if="user?.jabatan === 'Sekretaris' && currentSurat?.status === 'draft'" @click="saveSurat(true); cetakSurat()" style="background: #10b981; color: white; border: none; border-radius: 20px; padding: 0.4rem 1rem; cursor: pointer; font-weight: 600;">✅ Final & Cetak</button>
            <button v-if="currentSurat?.status === 'complete'" @click="cetakSurat()" style="background: #10b981; color: white; border: none; border-radius: 20px; padding: 0.4rem 1rem; cursor: pointer; font-weight: 600;">🖨️ Cetak PDF</button>
          </div>
        </div>
        <div style="display: flex; flex: 1; overflow: hidden;">
          <div v-if="user?.jabatan === 'Sekretaris' && currentSurat?.status === 'draft'" style="flex: 1; padding: 1.5rem; overflow-y: auto; background: white; border-right: 1px solid #e2e8f0; min-width: 340px;">
            <div style="margin-bottom: 1.2rem;">
              <label style="display: block; font-weight: 700; color: #3b82f6; margin-bottom: 0.4rem;">Pilih Template Surat</label>
              <select v-model="currentSurat.jenis_surat" style="width: 100%; padding: 0.5rem; border: 1px solid #93c5fd; background: #eff6ff; border-radius: 8px;">
                <option v-for="t in availableTemplates" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div style="margin-bottom: 1.2rem;">
              <label style="display: block; font-weight: 700; color: #3b82f6; margin-bottom: 0.4rem;">Judul / Nama Surat</label>
              <input type="text" v-model="currentSurat.nama_surat" placeholder="Contoh: Undangan Rapat Karang Taruna..." style="width: 100%; padding: 0.5rem; border: 1px solid #93c5fd; background: #eff6ff; border-radius: 8px; box-sizing: border-box;" />
            </div>
            <div style="margin-bottom: 1.2rem;">
              <label style="display: block; font-weight: 700; color: #3b82f6; margin-bottom: 0.4rem;">Nomor Surat Resmi</label>
              <input type="text" v-model="currentSurat.nomor_surat" placeholder="Contoh: 001/KKN-DS/2026" style="width: 100%; padding: 0.5rem; border: 1px solid #93c5fd; background: #eff6ff; border-radius: 8px; box-sizing: border-box;" />
            </div>
            <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px dashed #cbd5e1; margin-bottom: 1.2rem;">
              <p style="margin: 0 0 0.8rem; font-size: 0.8rem; font-weight: 700; color: #475569; letter-spacing: 0.5px;">KOP SURAT</p>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                <div><label style="font-size: 0.78rem; color: #64748b; display: block;">Universitas</label><input type="text" v-model="currentSurat.data_field.universitas" style="width: 100%; padding: 0.4rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.85rem; box-sizing: border-box;" /></div>
                <div><label style="font-size: 0.78rem; color: #64748b; display: block;">Nama Desa</label><input type="text" v-model="currentSurat.data_field.nama_desa" style="width: 100%; padding: 0.4rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.85rem; box-sizing: border-box;" /></div>
                <div><label style="font-size: 0.78rem; color: #64748b; display: block;">Nama Kecamatan</label><input type="text" v-model="currentSurat.data_field.nama_kecamatan" style="width: 100%; padding: 0.4rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.85rem; box-sizing: border-box;" /></div>
                <div><label style="font-size: 0.78rem; color: #64748b; display: block;">Alamat Sekretariat</label><input type="text" v-model="currentSurat.data_field.alamat_sekretariat" style="width: 100%; padding: 0.4rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.85rem; box-sizing: border-box;" /></div>
              </div>
            </div>

            <div v-if="currentSurat.jenis_surat === 'Surat Undangan'">
              <div style="margin-bottom: 1rem;"><label style="display: block; font-weight: 700; margin-bottom: 0.4rem;">Tujuan (Yth...)</label><input type="text" v-model="currentSurat.data_field.tujuan" style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 8px; box-sizing: border-box;" /></div>
              <div style="margin-bottom: 1rem;"><label style="display: block; font-weight: 700; margin-bottom: 0.4rem;">Nama Kegiatan</label><input type="text" v-model="currentSurat.data_field.nama_kegiatan" style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 8px; box-sizing: border-box;" /></div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; margin-bottom: 1rem;">
                <div><label style="display: block; font-weight: 700; margin-bottom: 0.4rem;">Tanggal</label><input type="date" v-model="currentSurat.data_field.tanggal_kegiatan" style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 8px; box-sizing: border-box;" /></div>
                <div><label style="display: block; font-weight: 700; margin-bottom: 0.4rem;">Waktu</label><input type="text" v-model="currentSurat.data_field.waktu_kegiatan" placeholder="08:00 WIB" style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 8px; box-sizing: border-box;" /></div>
              </div>
              <div style="margin-bottom: 1rem;"><label style="display: block; font-weight: 700; margin-bottom: 0.4rem;">Tempat</label><input type="text" v-model="currentSurat.data_field.tempat_kegiatan" style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 8px; box-sizing: border-box;" /></div>
            </div>
            <div v-else-if="currentSurat.jenis_surat === 'Surat Peminjaman Peralatan'">
              <div style="margin-bottom: 1rem;"><label style="display: block; font-weight: 700; margin-bottom: 0.4rem;">Daftar Alat</label><textarea v-model="currentSurat.data_field.daftar_alat" rows="4" style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 8px; box-sizing: border-box; resize: vertical;"></textarea></div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; margin-bottom: 1rem;">
                <div><label style="display: block; font-weight: 700; margin-bottom: 0.4rem;">Tanggal Pinjam</label><input type="date" v-model="currentSurat.data_field.tanggal_pinjam" style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 8px; box-sizing: border-box;" /></div>
                <div><label style="display: block; font-weight: 700; margin-bottom: 0.4rem;">Waktu</label><input type="text" v-model="currentSurat.data_field.waktu_pinjam" placeholder="08:00 - Selesai" style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 8px; box-sizing: border-box;" /></div>
              </div>
              <div style="margin-bottom: 1rem;"><label style="display: block; font-weight: 700; margin-bottom: 0.4rem;">Keperluan</label><input type="text" v-model="currentSurat.data_field.keperluan" style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 8px; box-sizing: border-box;" /></div>
            </div>
            <div v-else style="padding: 1rem; text-align: center; background: #f1f5f9; border-radius: 8px; color: #64748b; font-size: 0.9rem;">
              Pastikan informasi KOP surat di atas sudah benar.
            </div>
          </div>

          <div style="flex: 1.2; background: #64748b; padding: 2rem; overflow-y: auto; display: flex; justify-content: center; align-items: flex-start;">
            <div style="background: white; width: 100%; max-width: 210mm; min-height: 297mm; padding: 20mm; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border-radius: 4px;" v-html="getSuratPreviewHtml(currentSurat, user)"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- TOAST NOTIFICATION -->
    <Transition name="toast">
      <div v-if="toastVisible" :style="{ position: 'fixed', bottom: '2rem', right: '2rem', padding: '1rem 1.5rem', borderRadius: '12px', color: 'white', fontWeight: '600', zIndex: '99999', background: toastType === 'success' ? '#10b981' : '#ef4444', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }">
        {{ toastType === 'success' ? '✅' : '❌' }} {{ toastMessage }}
      </div>
    </Transition>
`;

// Find position: just before </template>
const templateEnd = c.lastIndexOf('</template>');
c = c.substring(0, templateEnd) + suratHtml + '\n</template>';
console.log('Step 6: Surat HTML injected before </template>');

// ============================================
// STEP 7: Add toast transition CSS
// ============================================
const toastCss = `
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(20px); }
`;
const styleEnd = c.lastIndexOf('</style>');
c = c.substring(0, styleEnd) + toastCss + '\n</style>';
console.log('Step 7: Toast CSS added');

fs.writeFileSync(file, c, 'utf8');
console.log('\n✅ ALL DONE! MahasiswaDashboard.vue patched successfully!');
