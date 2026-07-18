<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { getSuratPreviewHtml } from '../utils/suratTemplate.js';
import html2pdf from 'html2pdf.js';
import { useToast } from '../composables/useNotification.js';

const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();

const router = useRouter();
const token = ref(localStorage.getItem('token'));
const user = ref(JSON.parse(localStorage.getItem('user') || '{}'));

const isSekreOrKordes = computed(() => {
  return ['Sekretaris', 'Kordes'].includes(user.value?.jabatan) || ['admin', 'superadmin'].includes(user.value?.role);
});

// ─── VIEW STATE ──────────────────────────────────────────────────────────────
// 'list' | 'editor'
const view = ref('list');

// ─── LIST STATE ──────────────────────────────────────────────────────────────
const suratList = ref([]);
const activeTab = ref(isSekreOrKordes.value ? 'draft' : 'selesai');
const searchQuery = ref('');
const isListLoading = ref(false);

const filteredList = computed(() => {
  return suratList.value
    .filter(s => {
      if (!isSekreOrKordes.value && s.status !== 'selesai') return false;
      return s.status === activeTab.value;
    })
    .filter(s => {
      if (!searchQuery.value) return true;
      const q = searchQuery.value.toLowerCase();
      return (
        s.nama_surat?.toLowerCase().includes(q) ||
        s.jenis_surat?.toLowerCase().includes(q) ||
        s.nomor_surat?.toLowerCase().includes(q)
      );
    });
});

// ─── CONTEXT MENU ────────────────────────────────────────────────────────────
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  surat: null
});

const openContextMenu = (event, surat) => {
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    surat
  };
};

const closeContextMenu = () => {
  if (contextMenu.value.show) {
    contextMenu.value.show = false;
  }
};

onMounted(() => {
  window.addEventListener('click', closeContextMenu);
});
onUnmounted(() => {
  window.removeEventListener('click', closeContextMenu);
});

const fetchSuratList = async () => {
  isListLoading.value = true;
  try {
    const res = await fetch('/api/surat', {
      headers: { Authorization: `Bearer ${token.value}` }
    });
    if (res.ok) {
      const data = await res.json();
      suratList.value = data.data || [];
    }
  } catch (e) {
    console.error(e);
  } finally {
    isListLoading.value = false;
  }
};

const TEMPLATE_OPTIONS = [
  { title: 'Surat Permohonan Izin Kegiatan', desc: 'Izin penyelenggaraan kegiatan ke desa/pihak terkait', icon: '📝' },
  { title: 'Surat Undangan', desc: 'Undangan resmi untuk narasumber, pejabat, atau peserta', icon: '✉️' },
  { title: 'Surat Permohonan Narasumber', desc: 'Permohonan kesediaan menjadi pemateri/narasumber', icon: '🗣️' },
  { title: 'Surat Peminjaman Tempat', desc: 'Peminjaman gedung, lapangan, atau ruangan', icon: '🏢' },
  { title: 'Surat Peminjaman Peralatan', desc: 'Peminjaman barang, tenda, sound system, dll', icon: '🔧' },
  { title: 'Surat Dukungan / Kerja Sama', desc: 'Permohonan kolaborasi program kerja', icon: '🤝' },
  { title: 'Surat Tugas Internal', desc: 'Surat tugas untuk anggota kelompok KKN', icon: '📋' },
  { title: 'Surat Keterangan Keikutsertaan', desc: 'Bukti partisipasi aktif warga dalam program', icon: '🏅' },
  { title: 'Surat Permohonan Data', desc: 'Permintaan data primer/sekunder ke instansi', icon: '📊' },
  { title: 'Surat Berita Acara', desc: 'Pencatatan serah terima atau hasil kesepakatan', icon: '📑' },
  { title: 'Surat Pengantar', desc: 'Pengantar resmi untuk observasi atau kunjungan', icon: '📬' },
  { title: 'Surat Permohonan Sponsorship', desc: 'Pengajuan dana atau bantuan materiil', icon: '💰' },
];

// Field definitions per jenis surat
const FIELD_DEFS = {
  'Surat Permohonan Izin Kegiatan': [
    { key: 'nama_kegiatan', label: 'Nama Kegiatan', type: 'text' },
    { key: 'tanggal', label: 'Tanggal', type: 'date' },
    { key: 'waktu', label: 'Waktu', type: 'time' },
    { key: 'lokasi', label: 'Lokasi', type: 'text' },
    { key: 'penanggung_jawab', label: 'Penanggung Jawab', type: 'text' },
    { key: 'daftar_panitia', label: 'Daftar Panitia', type: 'textarea' },
  ],
  'Surat Undangan': [
    { key: 'nama_penerima', label: 'Nama Penerima', type: 'text' },
    { key: 'jabatan', label: 'Jabatan Penerima', type: 'text' },
    { key: 'acara', label: 'Nama Acara', type: 'text' },
    { key: 'tanggal', label: 'Tanggal', type: 'date' },
    { key: 'waktu', label: 'Waktu', type: 'time' },
    { key: 'tempat', label: 'Tempat', type: 'text' },
  ],
  'Surat Permohonan Narasumber': [
    { key: 'nama_narasumber', label: 'Nama Narasumber', type: 'text' },
    { key: 'instansi', label: 'Instansi', type: 'text' },
    { key: 'topik_materi', label: 'Topik Materi', type: 'text' },
    { key: 'tanggal', label: 'Tanggal', type: 'date' },
    { key: 'waktu', label: 'Waktu', type: 'time' },
  ],
  'Surat Peminjaman Tempat': [
    { key: 'nama_tempat', label: 'Nama Tempat', type: 'text' },
    { key: 'keperluan', label: 'Keperluan', type: 'text' },
    { key: 'tanggal', label: 'Tanggal', type: 'date' },
    { key: 'waktu', label: 'Waktu', type: 'time' },
  ],
  'Surat Peminjaman Peralatan': [
    { key: 'daftar_alat', label: 'Daftar Alat', type: 'textarea' },
    { key: 'tanggal', label: 'Tanggal', type: 'date' },
    { key: 'waktu', label: 'Waktu', type: 'time' },
    { key: 'keperluan', label: 'Keperluan', type: 'text' },
  ],
  'Surat Dukungan / Kerja Sama': [
    { key: 'nama_organisasi', label: 'Nama Organisasi / Instansi', type: 'text' },
    { key: 'bentuk_kerjasama', label: 'Bentuk Kerja Sama', type: 'text' },
    { key: 'tujuan', label: 'Tujuan Kerja Sama', type: 'text' },
  ],
  'Surat Tugas Internal': [
    { key: 'nama_anggota', label: 'Nama Anggota', type: 'text' },
    { key: 'nim', label: 'NIM Anggota', type: 'text' },
    { key: 'tugas_spesifik', label: 'Tugas Spesifik', type: 'textarea' },
    { key: 'tanggal', label: 'Tanggal', type: 'date' },
    { key: 'waktu', label: 'Waktu', type: 'time' },
  ],
  'Surat Keterangan Keikutsertaan': [
    { key: 'nama_anggota', label: 'Nama Anggota', type: 'text' },
    { key: 'nim', label: 'NIM', type: 'text' },
    { key: 'nama_kegiatan', label: 'Nama Kegiatan', type: 'text' },
    { key: 'tanggal', label: 'Tanggal', type: 'date' },
  ],
  'Surat Permohonan Data': [
    { key: 'nama_instansi', label: 'Nama Instansi', type: 'text' },
    { key: 'jenis_data', label: 'Jenis Data yang Diminta', type: 'text' },
    { key: 'tujuan', label: 'Tujuan Permintaan Data', type: 'text' },
  ],
  'Surat Berita Acara': [
    { key: 'tanggal', label: 'Tanggal', type: 'date' },
    { key: 'pihak_pertama', label: 'Pihak Pertama', type: 'text' },
    { key: 'pihak_kedua', label: 'Pihak Kedua', type: 'text' },
    { key: 'isi_berita_acara', label: 'Isi Berita Acara', type: 'textarea' },
  ],
  'Surat Pengantar': [
    { key: 'nama_penerima', label: 'Nama Orang / Pihak yang Diantar', type: 'text' },
    { key: 'keperluan', label: 'Keperluan / Tujuan', type: 'text' },
    { key: 'tujuan_instansi', label: 'Instansi Tujuan', type: 'text' },
  ],
  'Surat Permohonan Sponsorship': [
    { key: 'nama_perusahaan', label: 'Nama Perusahaan / Sponsor', type: 'text' },
    { key: 'nama_kegiatan', label: 'Nama Kegiatan', type: 'text' },
    { key: 'bentuk_sponsorship', label: 'Bentuk Sponsorship yang Diminta', type: 'text' },
  ],
};

// ─── EDITOR STATE ────────────────────────────────────────────────────────────
const editingId = ref(null);
const isSaving = ref(false);
const editorJenis = ref('');
const editorNamaSurat = ref('');
const editorNomorSurat = ref('');
const editorDataField = ref({});

// Kop surat settings (persisted to localStorage)
const kopSettings = ref(
  JSON.parse(localStorage.getItem('kkn_kop_settings') || '{}')
);
const defaultKop = {
  universitas: 'UNIVERSITAS X',
  nama_desa: 'DESA CONTOH',
  nama_kecamatan: 'KEC. CONTOH',
  alamat_sekretariat: 'Jl. Raya Desa Contoh No. 123, Kab. Contoh, Prov. Contoh',
  logo_kiri: '',
  logo_kanan: '',
  logo_kiri_size: 70,
  logo_kanan_size: 70,
  chain_logo_size: true
};
// Merge defaults (pastikan tipe data angka)
kopSettings.value = { ...defaultKop, ...kopSettings.value };
kopSettings.value.logo_kiri_size = Number(kopSettings.value.logo_kiri_size) || 70;
kopSettings.value.logo_kanan_size = Number(kopSettings.value.logo_kanan_size) || 70;

// Watcher untuk sinkronisasi ukuran logo jika di-chain
watch(() => kopSettings.value.logo_kiri_size, (newVal) => {
  if (kopSettings.value.chain_logo_size) kopSettings.value.logo_kanan_size = newVal;
});
watch(() => kopSettings.value.logo_kanan_size, (newVal) => {
  if (kopSettings.value.chain_logo_size) kopSettings.value.logo_kiri_size = newVal;
});

const poskoId = user.value?.posko_id || 'default';
const LOGO_HISTORY_KEY = `kkn_logo_history_${poskoId}`;

const MAX_LOGO_HISTORY = 8;
const logoHistory = ref(JSON.parse(localStorage.getItem(LOGO_HISTORY_KEY) || '[]'));
const logoPickerOpen = ref(null); // 'kiri' | 'kanan' | null

const addToLogoHistory = (url) => {
  // Hapus duplikat
  const filtered = logoHistory.value.filter(h => h !== url);
  // Taruh yang baru di depan
  filtered.unshift(url);
  // Batasi max
  logoHistory.value = filtered.slice(0, MAX_LOGO_HISTORY);
  localStorage.setItem(LOGO_HISTORY_KEY, JSON.stringify(logoHistory.value));
};

const handleLogoUpload = async (side, event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  const fileName = file.name.toLowerCase();
  const isValidExt = /\.(png|jpe?g|svg|webp|gif|bmp)$/.test(fileName);

  if (!file.type.startsWith('image/') && !isValidExt) {
    toastWarning('File harus berupa gambar (PNG, JPG, SVG, WebP, dll)');
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    toastWarning('Ukuran file logo terlalu besar (maksimal 15MB)');
    return;
  }
  
  const formData = new FormData();
  formData.append('logo', file);

  try {
    const res = await fetch('/api/surat/logo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.value}` },
      body: formData
    });
    const data = await res.json();
    
    if (res.ok && data.success) {
      const url = data.url;
      if (side === 'kiri') kopSettings.value.logo_kiri = url;
      else kopSettings.value.logo_kanan = url;
      addToLogoHistory(url);
      logoPickerOpen.value = null;
    } else {
      toastError(data.message || 'Gagal mengupload logo');
    }
  } catch (err) {
    toastError('Terjadi kesalahan saat upload logo');
  }
};

const removeLogo = (side) => {
  if (side === 'kiri') kopSettings.value.logo_kiri = '';
  else kopSettings.value.logo_kanan = '';
};

const openLogoPicker = (side) => {
  logoPickerOpen.value = logoPickerOpen.value === side ? null : side;
};

const selectLogoFromHistory = (side, b64) => {
  if (side === 'kiri') kopSettings.value.logo_kiri = b64;
  else kopSettings.value.logo_kanan = b64;
  logoPickerOpen.value = null;
};

const removeFromHistory = (idx) => {
  logoHistory.value.splice(idx, 1);
  localStorage.setItem(LOGO_HISTORY_KEY, JSON.stringify(logoHistory.value));
};

// Refs untuk hidden file inputs (selalu ada di DOM, tidak bergantung pada picker v-if)
const logoInputKiri = ref(null);
const logoInputKanan = ref(null);

const triggerLogoUpload = (side) => {
  // Reset value dulu supaya @change selalu fire meski file sama
  if (side === 'kiri') {
    if (logoInputKiri.value) { logoInputKiri.value.value = ''; logoInputKiri.value.click(); }
  } else {
    if (logoInputKanan.value) { logoInputKanan.value.value = ''; logoInputKanan.value.click(); }
  }
};

// Tutup picker kalau klik di luar
const handlePickerOutsideClick = (e) => {
  if (logoPickerOpen.value && !e.target.closest('.sg-logo-picker-wrap')) {
    logoPickerOpen.value = null;
  }
};
onMounted(() => window.addEventListener('click', handlePickerOutsideClick));
onUnmounted(() => window.removeEventListener('click', handlePickerOutsideClick));

watch(kopSettings, (val) => {
  localStorage.setItem('kkn_kop_settings', JSON.stringify(val));
}, { deep: true });

const currentFields = computed(() => {
  return FIELD_DEFS[editorJenis.value] || [];
});

const previewHtml = computed(() => {
  const s = {
    jenis_surat: editorJenis.value,
    nomor_surat: editorNomorSurat.value,
    data_field: {
      ...editorDataField.value,
      ...kopSettings.value,
    },
  };
  return getSuratPreviewHtml(s, user.value);
});

// When jenis changes, reset data_field
watch(editorJenis, () => {
  editorDataField.value = {};
});

// Generation counter: naik setiap kali openNew/backToList dipanggil,
// sehingga openExistingEditor yang sedang async bisa deteksi sudah dibatalkan
let editorGeneration = 0;

const openNewEditor = () => {
  editorGeneration++;           // ← batalkan openExistingEditor yang mungkin sedang loading
  isLoadingEditor.value = false; // ← pastikan loading overlay tidak nyangkut
  editingId.value = null;
  editorJenis.value = '';
  editorNamaSurat.value = '';
  editorNomorSurat.value = '';
  editorDataField.value = {
    signatures: []
  };
  view.value = 'step1';
};

const proceedToEditor = () => {
  if (!editorJenis.value) {
    toastWarning('Pilih jenis surat terlebih dahulu!');
    return;
  }
  // Initialize signatures for new surat if empty
  if (!editorDataField.value.signatures || editorDataField.value.signatures.length === 0) {
    editorDataField.value.signatures = [
      {
        jabatan: 'Sekretaris KKN',
        nama: user.value?.jabatan === 'Sekretaris' ? user.value.nama_lengkap : '',
        id: user.value?.jabatan === 'Sekretaris' ? user.value.nim : ''
      },
      {
        jabatan: 'Koordinator Desa (Kordes)',
        nama: user.value?.jabatan === 'Kordes' ? user.value.nama_lengkap : '',
        id: user.value?.jabatan === 'Kordes' ? user.value.nim : ''
      }
    ];
  }
  view.value = 'editor';
};

const isLoadingEditor = ref(false);

const openExistingEditor = async (surat) => {
  const myGeneration = ++editorGeneration;  // ambil generation saat ini
  isLoadingEditor.value = true;
  // Reset state dulu sebelum fetch
  editingId.value = null;
  editorDataField.value = { signatures: [] };

  try {
    // Fetch full data (termasuk data_field) via GET /api/surat/:id
    // karena list endpoint sudah exclude data_field untuk performa
    const res = await fetch(`/api/surat/${surat.id}`, {
      headers: { Authorization: `Bearer ${token.value}` }
    });

    // Jika selama fetch ada openNewEditor/backToList → batalkan
    if (myGeneration !== editorGeneration) return;

    if (!res.ok) {
      toastError('Gagal memuat data surat');
      return;
    }
    const result = await res.json();

    // Cek lagi setelah await res.json()
    if (myGeneration !== editorGeneration) return;

    const full = result.data;

    editingId.value = full.id;
    editorJenis.value = full.jenis_surat;
    editorNamaSurat.value = full.nama_surat;
    editorNomorSurat.value = full.nomor_surat === '-' ? '' : full.nomor_surat;

    try {
      const raw = typeof full.data_field === 'string' ? JSON.parse(full.data_field) : (full.data_field || {});
      // Pisahkan kop & logo dari field isi surat
      const { universitas, nama_desa, nama_kecamatan, alamat_sekretariat, logo_kiri, logo_kanan, ...rest } = raw;
      editorDataField.value = rest;
      if (!editorDataField.value.signatures) {
        editorDataField.value.signatures = [];
      }
      // Update kopSettings jika data ada di surat
      if (universitas) kopSettings.value.universitas = universitas;
      if (nama_desa) kopSettings.value.nama_desa = nama_desa;
      if (nama_kecamatan) kopSettings.value.nama_kecamatan = nama_kecamatan;
      if (alamat_sekretariat) kopSettings.value.alamat_sekretariat = alamat_sekretariat;
      if (logo_kiri) kopSettings.value.logo_kiri = logo_kiri;
      if (logo_kanan) kopSettings.value.logo_kanan = logo_kanan;
    } catch (e) {
      editorDataField.value = { signatures: [] };
    }

    view.value = 'editor';
  } catch (e) {
    if (myGeneration === editorGeneration) {
      toastError('Terjadi kesalahan saat memuat surat');
    }
  } finally {
    if (myGeneration === editorGeneration) {
      isLoadingEditor.value = false;
    }
  }
};

const backToList = () => {
  editorGeneration++;           // ← batalkan openExistingEditor yang mungkin sedang loading
  view.value = 'list';
  editingId.value = null;
  isLoadingEditor.value = false;
  fetchSuratList();
};

const saveSurat = async (status) => {
  if (!editorJenis.value) {
    toastWarning('Pilih jenis surat terlebih dahulu');
    return;
  }
  isSaving.value = true;
  const payload = {
    jenis_surat: editorJenis.value,
    nama_surat: editorNamaSurat.value || editorJenis.value,
    nomor_surat: editorNomorSurat.value || '-',
    data_field: { ...editorDataField.value, ...kopSettings.value },
    status,
  };

  try {
    let res;
    if (editingId.value) {
      res = await fetch(`/api/surat/${editingId.value}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.value}` },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch('/api/surat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.value}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        editingId.value = data.id;
      }
    }
    if (res.ok) {
      if (status === 'selesai') {
        toastSuccess('Surat berhasil disimpan sebagai final!');
        backToList();
      } else {
        toastSuccess('Draft berhasil disimpan!');
      }
    } else {
      const d = await res.json();
      toastError(d.message || 'Gagal menyimpan surat');
    }
  } catch (e) {
    toastError('Terjadi kesalahan jaringan');
  } finally {
    isSaving.value = false;
  }
};

const deleteSurat = async (id) => {
  if (!confirm('Yakin hapus surat ini?')) return;
  const res = await fetch(`/api/surat/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token.value}` },
  });
  if (res.ok) {
    suratList.value = suratList.value.filter(s => s.id !== id);
  } else {
    toastError('Gagal menghapus surat');
  }
};

const printSurat = () => {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <base href="${window.location.origin}">
  <title>${editorNamaSurat.value || editorJenis.value}</title>
  <style>
    body { margin: 0; padding: 0; background: white; }
    @page { margin: 15mm 20mm; size: A4; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  ${previewHtml.value}
  <script>
    window.onload = function() { window.print(); window.close(); };
  <\/script>
</body>
</html>`);
  printWindow.document.close();
};

const printSuratDirect = async (suratItem) => {
  try {
    let surat = suratItem;
    if (!surat.data_field) {
      const res = await fetch(`/api/surat/${suratItem.id}`, { headers: { Authorization: `Bearer ${token.value}` } });
      if (res.ok) {
        const full = await res.json();
        surat = full.data;
      }
    }
    const raw = typeof surat.data_field === 'string' ? JSON.parse(surat.data_field) : surat.data_field;
    const s = {
      jenis_surat: surat.jenis_surat,
      nomor_surat: surat.nomor_surat,
      data_field: raw || {},
    };
    const html = getSuratPreviewHtml(s, user.value);
    
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <base href="${window.location.origin}">
  <title>${surat.nama_surat || surat.jenis_surat}</title>
  <style>
    body { margin: 0; padding: 0; background: white; }
    @page { margin: 15mm 20mm; size: A4; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  ${html}
  <script>
    window.onload = function() { window.print(); window.close(); };
  <\/script>
</body>
</html>`);
    printWindow.document.close();
  } catch (e) {
    toastError('Gagal mencetak surat.');
  }
};

const downloadSuratPdf = async (suratItem) => {
  try {
    let surat = suratItem;
    if (!surat.data_field) {
      const res = await fetch(`/api/surat/${suratItem.id}`, { headers: { Authorization: `Bearer ${token.value}` } });
      if (res.ok) {
        const full = await res.json();
        surat = full.data;
      }
    }
    const raw = typeof surat.data_field === 'string' ? JSON.parse(surat.data_field) : surat.data_field;
    const s = {
      jenis_surat: surat.jenis_surat,
      nomor_surat: surat.nomor_surat,
      data_field: raw || {},
    };
    const html = getSuratPreviewHtml(s, user.value);
    
    const wrapperHTML = `
      <div style="width: 210mm; min-height: 297mm; padding: 15mm 20mm; box-sizing: border-box; background: white; font-family: 'Times New Roman', Times, serif; color: black;">
        ${html}
      </div>
    `;

    const opt = {
      margin: 0,
      filename: `${surat.nama_surat || surat.jenis_surat}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(wrapperHTML).save();
  } catch (e) {
    toastError('Gagal mengunduh surat.');
  }
};

const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const JENIS_COLORS = {
  'Surat Permohonan Izin Kegiatan': '#6b8078',
  'Surat Undangan': '#3b82f6',
  'Surat Permohonan Narasumber': '#8b5cf6',
  'Surat Peminjaman Tempat': '#06b6d4',
  'Surat Peminjaman Peralatan': '#f59e0b',
  'Surat Dukungan / Kerja Sama': '#10b981',
  'Surat Tugas Internal': '#ef4444',
  'Surat Keterangan Keikutsertaan': '#ec4899',
  'Surat Permohonan Data': '#84cc16',
  'Surat Berita Acara': '#64748b',
  'Surat Pengantar': '#0ea5e9',
  'Surat Permohonan Sponsorship': '#f97316',
};

const getJenisColor = (jenis) => JENIS_COLORS[jenis] || '#6b7280';

onMounted(() => {
  fetchSuratList();
  if (!token.value) router.push('/login');
});
</script>

<template>
  <div class="sg-root">

    <!-- ═══════════════ LIST VIEW ═══════════════ -->
    <div class="sg-list-view">

      <div class="sg-list-container">
        <!-- Header -->
        <div class="sg-list-header">
          <div class="sg-list-title">
            <div class="sg-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
            </div>
            <div>
              <h1>Arsip Surat Resmi</h1>
              <p class="sg-subtitle">Kelola semua surat resmi KKN posko Anda</p>
            </div>
          </div>
        </div>

        <div class="sg-divider"></div>

        <!-- Tabs + Search -->
        <div class="sg-controls">
          <div class="sg-tabs">
            <button
              v-if="isSekreOrKordes"
              :class="['sg-tab', activeTab === 'draft' && 'sg-tab--active']"
              @click="activeTab = 'draft'"
            >
              Draft
              <span v-if="suratList.filter(s => s.status === 'draft').length" class="tab-badge">
                {{ suratList.filter(s => s.status === 'draft').length }}
              </span>
            </button>
            <button
              :class="['sg-tab', activeTab === 'selesai' && 'sg-tab--active']"
              @click="activeTab = 'selesai'"
            >
              Surat Selesai
              <span v-if="suratList.filter(s => s.status === 'selesai').length" class="tab-badge">
                {{ suratList.filter(s => s.status === 'selesai').length }}
              </span>
            </button>
          </div>
          <div style="display: flex; gap: 1rem; margin-left: auto; flex-wrap: wrap;">
            <div class="sg-search">
              <span class="sg-search-icon">🔍</span>
              <input v-model="searchQuery" type="text" placeholder="Cari surat..." class="sg-search-input" />
            </div>
            <button v-if="isSekreOrKordes" @click="openNewEditor" class="btn-primary-lg" style="padding: 0.5rem 1.2rem; font-size: 0.95rem; box-shadow: none;">
              <span style="margin-right: 0.4rem; font-weight: bold;">+</span> Buat Surat Baru
            </button>
          </div>
        </div>

        <!-- Table -->
        <div class="sg-table-wrap">
          <table class="sg-table">
            <thead>
              <tr>
                <th>Nomor Surat</th>
                <th>Nama Surat</th>
                <th>Jenis</th>
                <th>Tanggal</th>
                <th>Pembuat</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="isListLoading">
                <td colspan="5" class="sg-empty">
                  <div class="spinner-sm"></div>
                  Memuat data...
                </td>
              </tr>
              <tr v-else-if="filteredList.length === 0">
                <td colspan="5" class="sg-empty">
                  <div class="sg-empty-icon">📭</div>
                  Belum ada surat yang ditemukan di tab ini.
                </td>
              </tr>
              <tr v-for="surat in filteredList" :key="surat.id" class="sg-row" @contextmenu.prevent="openContextMenu($event, surat)">
                <td class="sg-nomor">{{ surat.nomor_surat === '-' ? '—' : surat.nomor_surat }}</td>
                <td class="sg-nama">
                  <span class="sg-nama-text">{{ surat.nama_surat }}</span>
                </td>
                <td>
                  <span class="sg-jenis-badge" :style="{ background: getJenisColor(surat.jenis_surat) + '18', color: getJenisColor(surat.jenis_surat), borderColor: getJenisColor(surat.jenis_surat) + '40' }">
                    {{ surat.jenis_surat }}
                  </span>
                </td>
                <td class="sg-date">{{ formatDate(surat.created_at) }}</td>
                <td class="sg-pembuat">{{ surat.pembuat || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Stats footer -->
        <div class="sg-stats" v-if="!isListLoading">
          <span>Total: <b>{{ suratList.filter(s => isSekreOrKordes || s.status === 'selesai').length }}</b> surat</span>
          <span v-if="isSekreOrKordes">Draft: <b>{{ suratList.filter(s=>s.status==='draft').length }}</b></span>
          <span>Selesai: <b>{{ suratList.filter(s=>s.status==='selesai').length }}</b></span>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <div 
        v-if="contextMenu.show" 
        class="context-menu" 
        :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
        @click.stop
      >
        <template v-if="isSekreOrKordes">
          <button @click="closeContextMenu(); openExistingEditor(contextMenu.surat)" class="context-menu-item" :disabled="isLoadingEditor">✏️ Edit Surat</button>
          <button v-if="contextMenu.surat && contextMenu.surat.status === 'selesai'" @click="downloadSuratPdf(contextMenu.surat); closeContextMenu()" class="context-menu-item">⬇️ Unduh PDF</button>
          <button @click="deleteSurat(contextMenu.surat.id); closeContextMenu()" class="context-menu-item context-menu-item--danger">🗑️ Hapus</button>
        </template>
        <template v-else>
          <button v-if="contextMenu.surat && contextMenu.surat.status === 'selesai'" @click="downloadSuratPdf(contextMenu.surat); closeContextMenu()" class="context-menu-item">⬇️ Unduh PDF</button>
          <button v-if="contextMenu.surat && contextMenu.surat.status === 'selesai'" @click="printSuratDirect(contextMenu.surat); closeContextMenu()" class="context-menu-item">🖨️ Cetak</button>
        </template>
      </div>
    </Teleport>

    <!-- Loading overlay saat fetch data surat -->
    <Teleport to="body">
      <div v-if="isLoadingEditor" class="sg-modal-overlay" style="z-index: 999998;">
        <div style="background: white; border-radius: 12px; padding: 2rem 3rem; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.15);">
          <div class="spinner-sm" style="width: 32px; height: 32px; margin: 0 auto 1rem;"></div>
          <p style="margin: 0; color: #475569; font-weight: 600;">Memuat data surat...</p>
        </div>
      </div>
    </Teleport>

    <!-- ═══════════════ STEP 1 MODAL (PILIH SURAT) ═══════════════ -->
    <Teleport to="body">
      <div v-if="view === 'step1'" class="sg-modal-overlay">
        <div class="sg-modal-step1">
          <div class="sg-modal-header" style="text-align: center; margin-bottom: 2rem;">
            <button @click="view = 'list'" class="btn-back" style="position: absolute; left: 1.5rem; top: 1.5rem;">← Kembali</button>
            <h2 style="margin: 0; font-size: 1.6rem; color: #1e293b;">✨ Buat Surat Baru</h2>
            <p style="color: #64748b; font-size: 0.95rem; margin-top: 0.5rem;">Pilih jenis surat yang ingin Anda buat.</p>
          </div>
          
          <div class="sg-field-group">
            <label class="sg-label" style="text-align: center; display: block; color: var(--color-primary); font-weight: 700; letter-spacing: 0.5px;">JUDUL SURAT (NAMA BEBAS)</label>
            <input
              v-model="editorNamaSurat"
              type="text"
              class="sg-input"
              style="text-align: center; font-size: 1.1rem; padding: 0.9rem;"
              placeholder="Contoh: Undangan Rapat Karang Taruna..."
            />
          </div>

          <div class="sg-field-group" style="margin-top: 1.5rem;">
            <label class="sg-label" style="text-align: center; display: block; color: var(--color-primary); font-weight: 700; letter-spacing: 0.5px;">PILIH JENIS / TEMPLATE SURAT <span class="sg-required">*</span></label>
            <div class="template-grid">
              <div
                v-for="tpl in TEMPLATE_OPTIONS"
                :key="tpl.title"
                class="template-card"
                :class="{'template-card--active': editorJenis === tpl.title}"
                @click="editorJenis = tpl.title"
              >
                <div class="template-card-icon">{{ tpl.icon }}</div>
                <div class="template-card-title">{{ tpl.title }}</div>
                <div class="template-card-desc">{{ tpl.desc }}</div>
              </div>
            </div>
          </div>

          <button @click="proceedToEditor" class="btn-primary-lg" style="width: 100%; justify-content: center; margin-top: 2.5rem; font-size: 1.15rem; padding: 1rem;">
            Lanjut ke Editor ➔
          </button>
        </div>
      </div>
    </Teleport>

    <!-- ═══════════════ EDITOR VIEW (MODAL) ═══════════════ -->
    <Teleport to="body">
      <div v-if="view === 'editor'" class="sg-modal-overlay">
        <div class="sg-editor-view">

      <!-- Editor Top Bar -->
      <div class="sg-editor-topbar">
        <div class="sg-editor-topbar-left">
          <button @click="backToList" class="btn-back">← Kembali</button>
          <div>
            <div class="sg-editor-title">
              {{ editingId ? '✏️ Edit: ' + editorJenis : '✨ Baru: ' + editorJenis }}
            </div>
            <div class="sg-editor-hint">Isi form di kiri, lihat hasil di kanan secara real-time.</div>
          </div>
        </div>
        <div class="sg-editor-topbar-actions">
          <button @click="backToList" class="btn-cancel-ed">Batal</button>
          <button @click="saveSurat('draft')" :disabled="isSaving" class="btn-draft">
            {{ isSaving ? '⏳ Menyimpan...' : '💾 Simpan sebagai Draft' }}
          </button>
          <button @click="saveSurat('selesai')" :disabled="isSaving" class="btn-final">
            ✅ Simpan Final
          </button>
        </div>
      </div>

      <!-- Split Pane -->
      <div class="sg-split">

        <!-- ── LEFT PANE: Form ── -->
        <div class="sg-form-pane">
          <div class="sg-form-scroll">

            <!-- Nama bebas -->
            <div class="sg-field-group">
              <label class="sg-label">Judul Surat (Nama Bebas)</label>
              <input
                v-model="editorNamaSurat"
                type="text"
                class="sg-input"
                placeholder="Contoh: Undangan Rapat Karang Taruna..."
              />
            </div>

            <!-- Kop Surat -->
            <div class="sg-section-box">
              <div class="sg-section-title">📋 PENGATURAN KOP SURAT <span class="sg-section-hint">(OTOMATIS TERSIMPAN)</span></div>

              <!-- Hidden file inputs untuk upload logo (dipindahkan ke luar dari v-if dropdown) -->
              <input type="file" accept="image/*,.webp,.svg,.png,.jpg,.jpeg" @change="handleLogoUpload('kiri', $event)" ref="logoInputKiri" style="display:none" />
              <input type="file" accept="image/*,.webp,.svg,.png,.jpg,.jpeg" @change="handleLogoUpload('kanan', $event)" ref="logoInputKanan" style="display:none" />

              <!-- Logo Upload Row with History Picker -->
              <div class="sg-logo-row">

                <!-- Logo Kiri -->
                <div class="sg-logo-slot sg-logo-picker-wrap">
                  <div class="sg-logo-label">🖼️ Logo Kiri (Universitas)</div>
                  <!-- Trigger: preview jika ada logo, atau tombol + pilih -->
                  <div class="sg-logo-trigger" @click.stop="openLogoPicker('kiri')">
                    <div v-if="kopSettings.logo_kiri" class="sg-logo-preview">
                      <img :src="kopSettings.logo_kiri" alt="Logo Kiri" class="sg-logo-img" />
                      <button @click.stop="removeLogo('kiri')" class="sg-logo-remove" title="Hapus logo">✖</button>
                    </div>
                    <div v-else class="sg-logo-upload-btn">
                      <span>🖼️ Pilih / Upload</span>
                    </div>
                  </div>

                  <!-- Picker Dropdown Kiri -->
                  <div v-if="logoPickerOpen === 'kiri'" class="sg-logo-picker" @click.stop>
                    <div class="sg-logo-picker-title">Riwayat Logo</div>
                    <div v-if="logoHistory.length === 0" class="sg-logo-picker-empty">Belum ada logo tersimpan</div>
                    <div v-else class="sg-logo-history-grid">
                      <div
                        v-for="(logo, idx) in logoHistory"
                        :key="idx"
                        class="sg-logo-history-item"
                        :class="{ 'sg-logo-history-item--active': kopSettings.logo_kiri === logo }"
                        @click="selectLogoFromHistory('kiri', logo)"
                      >
                        <img :src="logo" class="sg-logo-history-img" />
                        <button @click.stop="removeFromHistory(idx)" class="sg-logo-history-del" title="Hapus dari riwayat">✖</button>
                      </div>
                    </div>
                    <div class="sg-logo-picker-upload" @click.stop="triggerLogoUpload('kiri')">
                      <span>⬆️ Upload Gambar Baru</span>
                    </div>
                  </div>
                </div>

                <!-- Logo Kanan -->
                <div class="sg-logo-slot sg-logo-picker-wrap">
                  <div class="sg-logo-label">🖼️ Logo Kanan (KKN/Fakultas)</div>
                  <div class="sg-logo-trigger" @click.stop="openLogoPicker('kanan')">
                    <div v-if="kopSettings.logo_kanan" class="sg-logo-preview">
                      <img :src="kopSettings.logo_kanan" alt="Logo Kanan" class="sg-logo-img" />
                      <button @click.stop="removeLogo('kanan')" class="sg-logo-remove" title="Hapus logo">✖</button>
                    </div>
                    <div v-else class="sg-logo-upload-btn">
                      <span>🖼️ Pilih / Upload</span>
                    </div>
                  </div>

                  <!-- Picker Dropdown Kanan -->
                  <div v-if="logoPickerOpen === 'kanan'" class="sg-logo-picker" @click.stop>
                    <div class="sg-logo-picker-title">Riwayat Logo</div>
                    <div v-if="logoHistory.length === 0" class="sg-logo-picker-empty">Belum ada logo tersimpan</div>
                    <div v-else class="sg-logo-history-grid">
                      <div
                        v-for="(logo, idx) in logoHistory"
                        :key="idx"
                        class="sg-logo-history-item"
                        :class="{ 'sg-logo-history-item--active': kopSettings.logo_kanan === logo }"
                        @click="selectLogoFromHistory('kanan', logo)"
                      >
                        <img :src="logo" class="sg-logo-history-img" />
                        <button @click.stop="removeFromHistory(idx)" class="sg-logo-history-del" title="Hapus dari riwayat">✖</button>
                      </div>
                    </div>
                    <div class="sg-logo-picker-upload" @click.stop="triggerLogoUpload('kanan')">
                      <span>⬆️ Upload Gambar Baru</span>
                    </div>
                  </div>
                </div>

              </div>

              <!-- Slider Ukuran Logo -->
              <div class="sg-logo-size-controls" style="margin-bottom: 1.5rem; background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px dashed #cbd5e1;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
                  <span style="font-size: 0.85rem; font-weight: 600; color: #475569;">📏 Ukuran Logo</span>
                  <label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; cursor: pointer; color: var(--color-primary); font-weight: 600;">
                    <input type="checkbox" v-model="kopSettings.chain_logo_size" />
                    🔗 Samakan Kiri Kanan
                  </label>
                </div>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                  <div style="flex: 1; min-width: 150px;">
                    <label style="font-size: 0.75rem; color: #64748b; display: block; margin-bottom: 0.3rem;">Logo Kiri ({{ kopSettings.logo_kiri_size }}px)</label>
                    <input type="range" v-model="kopSettings.logo_kiri_size" min="40" max="150" style="width: 100%;" />
                  </div>
                  <div style="flex: 1; min-width: 150px;">
                    <label style="font-size: 0.75rem; color: #64748b; display: block; margin-bottom: 0.3rem;">Logo Kanan ({{ kopSettings.logo_kanan_size }}px)</label>
                    <input type="range" v-model="kopSettings.logo_kanan_size" min="40" max="150" :disabled="kopSettings.chain_logo_size" style="width: 100%;" :style="{ opacity: kopSettings.chain_logo_size ? 0.5 : 1, cursor: kopSettings.chain_logo_size ? 'not-allowed' : 'pointer' }" />
                  </div>
                </div>
              </div>

              <div class="sg-grid-2">
                <div class="sg-field-group">
                  <label class="sg-label">Universitas</label>
                  <input v-model="kopSettings.universitas" type="text" class="sg-input sg-input--kop" />
                </div>
                <div class="sg-field-group">
                  <label class="sg-label">Nama Desa</label>
                  <input v-model="kopSettings.nama_desa" type="text" class="sg-input sg-input--kop" />
                </div>
                <div class="sg-field-group">
                  <label class="sg-label">Nama Kecamatan</label>
                  <input v-model="kopSettings.nama_kecamatan" type="text" class="sg-input sg-input--kop" />
                </div>
                <div class="sg-field-group">
                  <label class="sg-label">Alamat Sekretariat</label>
                  <input v-model="kopSettings.alamat_sekretariat" type="text" class="sg-input sg-input--kop" />
                </div>
              </div>
            </div>



            <!-- Nomor Surat -->
            <div class="sg-field-group" v-if="editorJenis">
              <label class="sg-label">Nomor Surat</label>
              <input
                v-model="editorNomorSurat"
                type="text"
                class="sg-input"
                placeholder="Contoh: 001/KKN-DESA/VII/2026"
              />
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                💡 <b>Panduan:</b> [No Urut]/[Kode Instansi]/[Bulan Romawi]/[Tahun]. Contoh: 001/KKN-DESA/VII/2026
              </div>
            </div>

            <!-- Dynamic Fields -->
            <template v-if="editorJenis">
              <div class="sg-section-box sg-section-box--fields">
                <div class="sg-section-title">📝 ISI SURAT</div>
                <div v-for="field in currentFields" :key="field.key" class="sg-field-group">
                  <label class="sg-label">{{ field.label }}</label>
                  <textarea
                    v-if="field.type === 'textarea'"
                    v-model="editorDataField[field.key]"
                    class="sg-input sg-textarea"
                    placeholder="Ketik disini..."
                    rows="3"
                  ></textarea>
                  <input
                    v-else
                    v-model="editorDataField[field.key]"
                    :type="field.type"
                    class="sg-input"
                    :placeholder="field.type === 'text' ? 'Ketik disini...' : ''"
                  />
                </div>
              </div>

              <!-- Signatures -->
              <div class="sg-section-box sg-section-box--fields" style="margin-top: 1rem;">
                <div class="sg-section-title" style="display: flex; justify-content: space-between; align-items: center;">
                  <span>✍️ PENGATURAN TANDA TANGAN</span>
                  <button @click="editorDataField.signatures.push({jabatan: '', nama: '', id: ''})" style="background: none; border: none; color: var(--color-primary); cursor: pointer; font-weight: bold; font-size: 0.8rem;">+ Tambah</button>
                </div>
                <div v-for="(sig, idx) in editorDataField.signatures" :key="idx" style="border-left: 3px solid #c7d2fe; padding-left: 1rem; position: relative; padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
                  <button @click="editorDataField.signatures.splice(idx, 1)" style="position: absolute; right: 0; top: 0; background: none; border: none; color: #ef4444; cursor: pointer; padding: 0.2rem;" title="Hapus">✖</button>
                  <div class="sg-field-group">
                    <label class="sg-label" style="font-size: 0.7rem;">Jabatan / Peran</label>
                    <input v-model="sig.jabatan" type="text" class="sg-input sg-input--kop" placeholder="Contoh: Kepala Desa" />
                  </div>
                  <div class="sg-grid-2" style="margin-top: 0.5rem;">
                    <div class="sg-field-group">
                      <label class="sg-label" style="font-size: 0.7rem;">Nama Lengkap</label>
                      <input v-model="sig.nama" type="text" class="sg-input sg-input--kop" placeholder="Nama..." />
                    </div>
                    <div class="sg-field-group">
                      <label class="sg-label" style="font-size: 0.7rem;">Identitas</label>
                      <input v-model="sig.id" type="text" class="sg-input sg-input--kop" placeholder="NIM/NIP..." />
                    </div>
                  </div>
                </div>
                <div v-if="!editorDataField.signatures || editorDataField.signatures.length === 0" style="text-align: center; color: #94a3b8; font-size: 0.85rem; padding: 1rem;">
                  Belum ada tanda tangan. Klik "+ Tambah"
                </div>
              </div>

            </template>

            <div v-else class="sg-select-prompt">
              👆 Pilih jenis surat di atas untuk mulai mengisi isi surat
            </div>

          </div>
        </div>

        <!-- ── RIGHT PANE: Preview ── -->
        <div class="sg-preview-pane">
          <div class="sg-preview-topbar">
            <span>📄 Pratinjau Surat (Real-time)</span>
            <button @click="printSurat" class="btn-print-sm" :disabled="!editorJenis">🖨️ Cetak</button>
          </div>
          <div class="sg-preview-body">
            <div v-if="!editorJenis" class="sg-preview-empty">
              <div style="font-size: 4rem; margin-bottom: 1rem;">📄</div>
              <p>Pilih template surat terlebih dahulu untuk melihat pratinjau</p>
            </div>
            <div v-else class="sg-preview-content" v-html="previewHtml"></div>
          </div>
        </div>

      </div>
      </div>
    </div>
    </Teleport>

  </div>
</template>

<style scoped>
/* ─── ROOT ──────────────────────────────────────────────── */
.sg-root {
  width: 100%;
}

/* ─── LIST VIEW ─────────────────────────────────────────── */
.sg-list-view {
  width: 100%;
}

.sg-list-container {
  background: transparent;
}

.sg-list-header {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1.5rem 1rem 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.sg-list-title {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.sg-icon {
  width: 2.2rem;
  height: 2.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e0e7ff, #f3e8ff);
  border-radius: 10px;
  color: var(--color-primary);
}

.sg-icon svg {
  width: 1.2rem;
  height: 1.2rem;
}

.sg-list-title h1 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 800;
  color: #1e293b;
  letter-spacing: -0.5px;
}

.sg-subtitle {
  margin: 0;
  color: #64748b;
  font-size: 0.9rem;
}

.sg-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, #e2e8f0 20%, #e2e8f0 80%, transparent);
  margin: 0 2rem;
}

.sg-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem 2.5rem 1rem;
  flex-wrap: wrap;
}

.sg-tabs {
  display: flex;
  gap: 0.5rem;
  background: #f1f5f9;
  padding: 0.3rem;
  border-radius: 50px;
}

.sg-tab {
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 50px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  color: #64748b;
  background: transparent;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.sg-tab--active {
  background: var(--color-primary);
  color: white;
  box-shadow: 0 2px 8px rgba(79,70,229,0.3);
}

.tab-badge {
  background: #e2e8f0;
  color: #475569;
  padding: 0.15rem 0.55rem;
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 700;
  transition: all 0.2s;
}

.sg-tab--active .tab-badge {
  background: rgba(255, 255, 255, 0.25);
  color: white;
}

.sg-search {
  position: relative;
  flex: 1;
  max-width: 320px;
}

.sg-search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.9rem;
  pointer-events: none;
}

.sg-search-input {
  width: 100%;
  padding: 0.6rem 1rem 0.6rem 2.5rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 50px;
  font-size: 0.9rem;
  outline: none;
  transition: border 0.2s;
  box-sizing: border-box;
}

.sg-search-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(79,70,229,0.1);
}

/* Table */
.sg-table-wrap {
  padding: 0;
  overflow-x: auto;
  width: 100%;
}

.sg-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
}

.sg-table th {
  text-align: left;
  padding: 0.85rem 1rem;
  font-weight: 700;
  color: #475569;
  font-size: 0.85rem;
  border-bottom: 2px solid #f1f5f9;
  background: #f8fafc;
}

.sg-table th:last-child, .text-right { text-align: right; }

.sg-row {
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.15s;
  cursor: context-menu;
}

.sg-row:hover {
  background: #fafbff;
}

.sg-row td {
  padding: 0.9rem 1rem;
  vertical-align: middle;
}

.sg-nomor {
  font-family: 'Courier New', monospace;
  font-size: 0.82rem;
  color: var(--color-primary);
  font-weight: 600;
  word-break: break-all;
}

.sg-nama-text {
  font-weight: 600;
  color: #1e293b;
}

.sg-jenis-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 99px;
  font-size: 0.77rem;
  font-weight: 600;
  border: 1px solid;
  white-space: nowrap;
}

.sg-date, .sg-pembuat {
  color: #64748b;
  font-size: 0.85rem;
  white-space: nowrap;
}

.sg-empty {
  text-align: center;
  padding: 4rem 2rem;
  color: #94a3b8;
  font-size: 0.95rem;
}

.sg-empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.sg-stats {
  display: flex;
  gap: 2rem;
  padding: 1rem;
  border-top: 1px solid #f1f5f9;
  color: #64748b;
  font-size: 0.85rem;
}

.sg-stats b { color: #1e293b; }

/* ─── BUTTONS (List) ────────────────────────────────────── */
.btn-primary-lg {
  background: linear-gradient(135deg, var(--color-primary), #6b8078);
  color: white;
  border: none;
  padding: 0.75rem 1.75rem;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 4px 15px rgba(79,70,229,0.35);
  transition: all 0.2s;
}

.btn-primary-lg:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(79,70,229,0.4);
}

.sg-modal-step1 {
  background: white;
  width: 95%;
  max-width: 900px;
  border-radius: 16px;
  padding: 2.5rem;
  box-shadow: 0 20px 50px rgba(0,0,0,0.15);
  position: relative;
  max-height: 90vh;
  overflow-y: auto;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.template-card {
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.template-card:hover {
  border-color: #cbd5e1;
  background: #f1f5f9;
  transform: translateY(-2px);
}

.template-card--active {
  border-color: var(--color-primary);
  background: #eef2ff;
}

.template-card-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.template-card-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.4rem;
}

.template-card-desc {
  font-size: 0.75rem;
  color: #64748b;
}

/* ─── MODAL OVERLAY ─────────────────────────────────────── */
.sg-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ─── EDITOR VIEW ───────────────────────────────────────── */
.sg-editor-view {
  background: white;
  width: 95vw;
  height: 90vh;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}

.sg-editor-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1.5rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 0.75rem;
  z-index: 10;
}

.sg-editor-topbar-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.sg-editor-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
}

.sg-editor-hint {
  font-size: 0.78rem;
  color: #94a3b8;
}

.sg-editor-topbar-actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: wrap;
}

.btn-back {
  background: #f1f5f9;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.15s;
}

.btn-back:hover { background: #e2e8f0; }

.btn-cancel-ed {
  background: transparent;
  border: 1.5px solid #e2e8f0;
  color: #64748b;
  padding: 0.5rem 1.2rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel-ed:hover { background: #f8fafc; }

.btn-draft {
  background: linear-gradient(135deg, var(--color-primary), #6b8078);
  color: white;
  border: none;
  padding: 0.55rem 1.3rem;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.9rem;
  box-shadow: 0 2px 8px rgba(79,70,229,0.3);
  transition: all 0.2s;
}

.btn-draft:hover:not(:disabled) { transform: translateY(-1px); }
.btn-draft:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-final {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border: none;
  padding: 0.55rem 1.3rem;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.9rem;
  box-shadow: 0 2px 8px rgba(16,185,129,0.3);
  transition: all 0.2s;
}

.btn-final:hover:not(:disabled) { transform: translateY(-1px); }
.btn-final:disabled { opacity: 0.6; cursor: not-allowed; }

/* ─── SPLIT PANE ────────────────────────────────────────── */
.sg-split {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Form Pane */
.sg-form-pane {
  width: 420px;
  flex-shrink: 0;
  border-right: 1px solid #e2e8f0;
  background: #fafbfc;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sg-form-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.sg-field-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.sg-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sg-required { color: #ef4444; }

.sg-input {
  padding: 0.6rem 0.9rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  background: white;
  outline: none;
  transition: border 0.2s, box-shadow 0.2s;
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
}

.sg-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(79,70,229,0.1);
}

.sg-input--kop {
  font-size: 0.85rem;
  background: #f8fafc;
  border-style: dashed;
}

.sg-textarea {
  resize: vertical;
  min-height: 72px;
}

.sg-section-box {
  border: 1.5px dashed #c7d2fe;
  border-radius: 10px;
  padding: 1rem;
  background: #eef2ff08;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.sg-section-box--fields {
  border-color: #bbf7d0;
  background: #f0fdf420;
}

.sg-section-title {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.sg-section-hint {
  font-weight: 400;
  color: #94a3b8;
}

/* ─── LOGO UPLOAD & PICKER ──────────────────────────────── */
.sg-logo-row {
  display: flex;
  gap: 0.75rem;
}

.sg-logo-slot {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  position: relative;
}

.sg-logo-picker-wrap {
  position: relative;
}

.sg-logo-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.sg-logo-trigger {
  cursor: pointer;
}

.sg-logo-upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 70px;
  border: 2px dashed #c7d2fe;
  border-radius: 8px;
  background: #eef2ff30;
  cursor: pointer;
  color: #818cf8;
  font-size: 0.78rem;
  font-weight: 600;
  transition: all 0.2s;
}

.sg-logo-trigger:hover .sg-logo-upload-btn {
  background: #eef2ff;
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.sg-logo-preview {
  position: relative;
  height: 70px;
  border: 1.5px solid #c7d2fe;
  border-radius: 8px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  transition: border-color 0.2s;
}

.sg-logo-trigger:hover .sg-logo-preview {
  border-color: var(--color-primary);
}

.sg-logo-img {
  max-width: 100%;
  max-height: 62px;
  object-fit: contain;
  border-radius: 4px;
}

.sg-logo-remove {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ef4444;
  color: white;
  border: none;
  font-size: 0.6rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(239,68,68,0.4);
  transition: all 0.15s;
}

.sg-logo-remove:hover {
  background: #dc2626;
  transform: scale(1.1);
}

/* Picker dropdown */
.sg-logo-picker {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  z-index: 1000;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 200px;
}

.sg-logo-picker-title {
  font-size: 0.7rem;
  font-weight: 800;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sg-logo-picker-empty {
  font-size: 0.78rem;
  color: #94a3b8;
  text-align: center;
  padding: 0.5rem 0;
}

.sg-logo-history-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.4rem;
}

.sg-logo-history-item {
  position: relative;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  padding: 3px;
  cursor: pointer;
  transition: all 0.15s;
  background: #f8fafc;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.sg-logo-history-item:hover {
  border-color: var(--color-primary);
  background: #eef2ff;
}

.sg-logo-history-item--active {
  border-color: var(--color-primary);
  background: #eef2ff;
  box-shadow: 0 0 0 2px rgba(79,70,229,0.2);
}

.sg-logo-history-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 3px;
}

.sg-logo-history-del {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ef4444;
  color: white;
  border: none;
  font-size: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}

.sg-logo-history-item:hover .sg-logo-history-del {
  opacity: 1;
}

.sg-logo-picker-upload {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border: 1.5px dashed #c7d2fe;
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 600;
  transition: all 0.2s;
}

.sg-logo-picker-upload:hover {
  background: #eef2ff;
  border-color: var(--color-primary);
}

.sg-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.sg-select-prompt {
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
  font-size: 0.9rem;
  border: 2px dashed #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
}

/* Preview Pane */
.sg-preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f1f5f9;
}

.sg-preview-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.7rem 1.25rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
  flex-shrink: 0;
}

.btn-print-sm {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 0.35rem 1rem;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-print-sm:hover:not(:disabled) {
  background: #4338ca;
}

.btn-print-sm:disabled { opacity: 0.5; cursor: not-allowed; }

.sg-preview-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  text-align: center;
}

.sg-preview-empty {
  color: #94a3b8;
  padding: 3rem;
}

.sg-preview-content {
  background: white;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  width: 100%;
  max-width: 750px;
  min-height: 800px;
  margin: 0 auto 2rem auto;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  text-align: left;
}

/* Spinner */
.spinner-sm {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid #e2e8f0;
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  vertical-align: middle;
  margin-right: 0.5rem;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: #f1f5f9; 
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1; 
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8; 
}

/* ─── CONTEXT MENU ──────────────────────────────────────── */
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  border-radius: 8px;
  z-index: 999999;
  min-width: 150px;
  padding: 0.5rem 0;
  display: flex;
  flex-direction: column;
}

.context-menu-item {
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  color: #475569;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  transition: background 0.1s;
}

.context-menu-item:hover {
  background: #f8fafc;
  color: var(--color-primary);
}

.context-menu-item--danger {
  color: #ef4444;
}

.context-menu-item--danger:hover {
  background: #fef2f2;
  color: #dc2626;
}

/* ─── LOGO PICKER ──────────────────────────────────────── */
.sg-logo-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.sg-logo-slot {
  flex: 1;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}

.sg-logo-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
}

.sg-logo-trigger {
  width: 100%;
  cursor: pointer;
}

.sg-logo-preview {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
}

.sg-logo-img {
  max-width: 80px;
  max-height: 80px;
  object-fit: contain;
}

.sg-logo-remove {
  position: absolute;
  top: -5px;
  right: 10px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
}

.sg-logo-upload-btn {
  background: white;
  border: 1px solid #e2e8f0;
  padding: 0.5rem;
  border-radius: 6px;
  text-align: center;
  font-size: 0.85rem;
  color: #64748b;
  transition: all 0.2s;
}

.sg-logo-upload-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.sg-logo-picker {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background: white;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  border-radius: 8px;
  z-index: 50;
  padding: 1rem;
  margin-top: 0.5rem;
}

.sg-logo-picker-title {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #1e293b;
}

.sg-logo-picker-empty {
  font-size: 0.8rem;
  color: #94a3b8;
  text-align: center;
  padding: 1rem 0;
}

.sg-logo-history-grid {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.sg-logo-history-item {
  position: relative;
  width: 45px;
  height: 45px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

.sg-logo-history-item--active {
  border-color: var(--color-primary);
  background: #eef2ff;
}

.sg-logo-history-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.sg-logo-history-del {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  font-size: 0.6rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sg-logo-picker-upload {
  text-align: center;
  font-size: 0.85rem;
  color: var(--color-primary);
  font-weight: 600;
  cursor: pointer;
  padding: 0.5rem;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px dashed #cbd5e1;
}

.sg-logo-picker-upload:hover {
  background: #f1f5f9;
}

@media (max-width: 768px) {
  .sg-split { flex-direction: column; }
  .sg-form-pane { width: 100%; border-right: none; border-bottom: 1px solid #e2e8f0; max-height: 60vh; }
  .sg-editor-topbar { flex-direction: column; align-items: flex-start; }
}

@media (max-width: 768px) {
  .sg-list-header {
    padding: 1.5rem 1rem 1rem;
    flex-direction: column;
    align-items: flex-start;
  }
  .sg-controls {
    padding: 1rem;
  }
  .sg-tabs {
    flex-wrap: wrap;
  }
  .sg-form-container {
    padding: 1.5rem 1rem;
  }
  .sg-preview-container {
    padding: 1rem;
  }
}
</style>
