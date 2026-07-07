<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';
import { Pie } from 'vue-chartjs';
import ExcelJS from 'exceljs';
import html2pdf from 'html2pdf.js';
import SearchableSelect from '../components/SearchableSelect.vue';
import CurrencyInput from '../components/CurrencyInput.vue';
import { useToast, useConfirm, usePrompt } from '../composables/useNotification.js';
import { formatRupiah, toCurrencyNumber } from '../composables/useCurrencyInput.js';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

const router = useRouter();
const { success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning } = useToast();
const { confirm } = useConfirm();
const { prompt } = usePrompt();

const user = ref(null);
const activeTab = ref('dashboard');

// State
const summary = ref({ saldo: 0, totalPemasukan: 0, totalPengeluaran: 0, totalIuranTarget: 0, kategori: [] });
const kategoriList = ref([]);
const transaksiList = ref([]);
const token = ref('');

// --- IURAN & PENGAJUAN STATES ---
const iuranList = ref([]);
const iuranTarget = ref('');
const isSettingTarget = ref(false);
const pengajuanList = ref([]);
const pengajuanProcessingId = ref(null);
const iuranInterval = ref('sekali');

const iuranIntervalLabels = {
  sekali: 'Sekali (Sekali Bayar)',
  harian: 'Harian',
  mingguan: 'Mingguan',
  bulanan: 'Bulanan',
};

const isIuranKategori = (nama) => (nama || '').toLowerCase() === 'iuran anggota';

const getKategoriProgress = (kat) => {
  const isIuran = isIuranKategori(kat.nama_kategori);
  const used = isIuran
    ? Number(kat.total_pemasukan || 0)
    : Number(kat.total_pengeluaran || 0);
  const plafon = isIuran
    ? (Number(kat.plafon_dana) > 0 ? Number(kat.plafon_dana) : Number(summary.value.totalIuranTarget || 0))
    : Number(kat.plafon_dana || 0);
  const percent = plafon > 0 ? Math.min(100, (used / plafon) * 100) : (used > 0 ? 100 : 0);
  const over = plafon > 0 && used > plafon;
  return { isIuran, used, plafon, percent, over };
};

// Modals & Forms
const showModalKategori = ref(false);
const formKategori = ref({ id: null, nama_kategori: '', plafon_dana: '' });

const todayDate = () => new Date().toISOString().split('T')[0];

const openModalTransaksi = () => {
  formTransaksi.value = {
    jenis: 'pengeluaran',
    kategori_id: '',
    input_kategori: '',
    nominal: '',
    tanggal: todayDate(),
    keterangan: '',
    file: null,
  };
  fileNotaPreview.value = null;
  if (fileNotaRef.value) fileNotaRef.value.value = null;
  showModalTransaksi.value = true;
};
const showModalTransaksi = ref(false);
const formTransaksi = ref({ jenis: 'pengeluaran', kategori_id: '', input_kategori: '', nominal: '', tanggal: todayDate(), keterangan: '', file: null });
const fileNotaPreview = ref(null);
const fileNotaRef = ref(null);

onMounted(() => {
  const userData = localStorage.getItem('user');
  token.value = localStorage.getItem('token');
  if (userData && token.value) {
    user.value = JSON.parse(userData);
    if (user.value.role !== 'admin' && user.value.jabatan !== 'Bendahara') {
      router.push('/mahasiswa');
      return;
    }
    fetchSummary();
    fetchKategori();
    fetchTransaksi();
    fetchIuran();
    fetchPengajuan();
    initKeuanganExplorer();
  } else {
    router.push('/login');
  }
});

// --- DATA FETCHING ---
const fetchSummary = async () => {
  try {
    const res = await fetch('/api/bendahara/summary', {
      headers: { 'Authorization': `Bearer ${token.value}` }
    });
    if (res.ok) summary.value = await res.json();
  } catch (err) {
    console.error(err);
  }
};

const fetchKategori = async () => {
  try {
    const res = await fetch('/api/bendahara/kategori', {
      headers: { 'Authorization': `Bearer ${token.value}` }
    });
    if (res.ok) kategoriList.value = await res.json();
  } catch (err) {
    console.error(err);
  }
};

const fetchTransaksi = async () => {
  try {
    const res = await fetch('/api/bendahara/transaksi', {
      headers: { 'Authorization': `Bearer ${token.value}` }
    });
    if (res.ok) transaksiList.value = await res.json();
  } catch (err) {
    console.error(err);
  }
};

const fetchIuran = async () => {
  try {
    const res = await fetch('/api/bendahara/iuran', { headers: { 'Authorization': `Bearer ${token.value}` } });
    if (res.ok) {
      const data = await res.json();
      iuranList.value = data.list || [];
      iuranInterval.value = data.iuran_interval || 'sekali';
      if (iuranList.value.length > 0 && iuranList.value[0].nominal_target) {
        iuranTarget.value = String(iuranList.value[0].nominal_target);
      }
    }
  } catch(e) { console.error(e) }
};

const fetchPengajuan = async () => {
  try {
    const res = await fetch('/api/bendahara/pengajuan', { headers: { 'Authorization': `Bearer ${token.value}` } });
    if (res.ok) pengajuanList.value = await res.json();
  } catch(e) { console.error(e) }
};

// --- KATEGORI (RAB) ACTIONS ---
const editKategori = (k) => {
  formKategori.value = { ...k, plafon_dana: k.plafon_dana ? String(k.plafon_dana) : '' };
  showModalKategori.value = true;
};
const resetFormKategori = () => {
  formKategori.value = { id: null, nama_kategori: '', plafon_dana: '' };
  showModalKategori.value = false;
};
const submitKategori = async () => {
  const url = formKategori.value.id ? `/api/bendahara/kategori/${formKategori.value.id}` : `/api/bendahara/kategori`;
  const method = formKategori.value.id ? 'PUT' : 'POST';
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token.value}` },
      body: JSON.stringify({
        ...formKategori.value,
        plafon_dana: toCurrencyNumber(formKategori.value.plafon_dana),
      })
    });
    if (res.ok) {
      toastSuccess(formKategori.value.id ? 'Kategori diperbarui.' : 'Kategori ditambahkan.');
      resetFormKategori();
      fetchKategori();
      fetchSummary();
    }
  } catch (err) {
    console.error(err);
  }
};
const hapusKategori = async (id) => {
  if (!(await confirm({
    title: 'Hapus Kategori RAB?',
    message: 'Yakin ingin menghapus kategori/pos ini? Transaksi yang terkait akan kehilangan kategorinya.',
    type: 'danger',
    confirmText: 'Ya, Hapus',
  }))) return;
  try {
    const res = await fetch(`/api/bendahara/kategori/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token.value}` }
    });
    if (res.ok) {
      toastSuccess('Kategori dihapus.');
      fetchKategori();
      fetchSummary();
    }
  } catch (err) {
    console.error(err);
  }
};

// --- TRANSAKSI ACTIONS ---
const onFileChange = (e) => {
  const file = e.target.files[0];
  if (file) {
    formTransaksi.value.file = file;
    fileNotaPreview.value = file.name;
  }
};
const resetFormTransaksi = () => {
  formTransaksi.value = { jenis: 'pengeluaran', kategori_id: '', input_kategori: '', nominal: '', tanggal: todayDate(), keterangan: '', file: null };
  fileNotaPreview.value = null;
  if (fileNotaRef.value) fileNotaRef.value.value = null;
  showModalTransaksi.value = false;
};
const submitTransaksi = async () => {
  const hasKategori = formTransaksi.value.kategori_id || formTransaksi.value.input_kategori?.trim();
  const nominalInput = toCurrencyNumber(formTransaksi.value.nominal);
  if (!hasKategori) {
    toastWarning('Pilih kategori RAB yang sudah ada atau ketik nama kategori baru.');
    return;
  }
  if (!nominalInput || nominalInput <= 0) {
    toastWarning('Nominal transaksi harus diisi dan lebih dari 0.');
    return;
  }

  if (formTransaksi.value.jenis === 'pengeluaran') {
    let catData = null;

    if (formTransaksi.value.kategori_id) {
      catData = summary.value.kategori.find(k => k.id == formTransaksi.value.kategori_id);
    } else if (formTransaksi.value.input_kategori) {
      catData = summary.value.kategori.find(
        k => k.nama_kategori.toLowerCase() === formTransaksi.value.input_kategori.trim().toLowerCase()
      );
    }

    if (catData) {
      const sisa = Number(catData.plafon_dana) - Number(catData.total_pengeluaran);
      if (nominalInput > sisa) {
        if (!(await confirm({
          title: 'Melebihi Anggaran RAB',
          message: `Nominal ini melebihi sisa anggaran RAB!\n\nSisa anggaran untuk "${catData.nama_kategori}" hanya ${formatRupiah(sisa)}.\n\nTetap lanjutkan menyimpan transaksi ini?`,
          type: 'warning',
          confirmText: 'Ya, Tetap Simpan',
        }))) {
          return;
        }
      }
    }
  }

  const formData = new FormData();
  formData.append('jenis', formTransaksi.value.jenis);
  if (formTransaksi.value.kategori_id) {
    formData.append('kategori_id', formTransaksi.value.kategori_id);
  } else if (formTransaksi.value.input_kategori?.trim()) {
    formData.append('nama_kategori_manual', formTransaksi.value.input_kategori.trim());
  }
  formData.append('nominal', nominalInput);
  formData.append('tanggal', formTransaksi.value.tanggal);
  formData.append('keterangan', formTransaksi.value.keterangan);
  if (formTransaksi.value.file) {
    formData.append('nota', formTransaksi.value.file);
  }

  try {
    const res = await fetch('/api/bendahara/transaksi', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token.value}` },
      body: formData
    });
    if (res.ok) {
      toastSuccess('Transaksi berhasil dicatat!');
      resetFormTransaksi();
      fetchTransaksi();
      fetchSummary();
      fetchKategori();
      // Reload explorer if open
      if (activeTab.value === 'explorer') {
        fetchExplorerDirectory(explorerCurrentFolderId.value);
      }
    } else {
      const data = await res.json();
      toastError(data.message || 'Gagal mencatat transaksi.');
    }
  } catch (err) {
    console.error(err);
  }
};
const hapusTransaksi = async (id) => {
  if (!(await confirm({
    title: 'Hapus Transaksi?',
    message: 'Yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan.',
    type: 'danger',
    confirmText: 'Ya, Hapus',
  }))) return;
  try {
    const res = await fetch(`/api/bendahara/transaksi/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token.value}` }
    });
    if (res.ok) {
      toastSuccess('Transaksi dihapus.');
      fetchTransaksi();
      fetchSummary();
    }
  } catch (err) {
    console.error(err);
  }
};

// --- PIE CHART DATA ---
const pieChartData = computed(() => {
  const labels = [];
  const data = [];
  const backgroundColors = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e', '#64748b'];
  
  let totalCategorized = 0;
  if (summary.value.kategori && summary.value.kategori.length > 0) {
    summary.value.kategori.forEach((k) => {
      if (Number(k.total_pengeluaran) > 0) {
        labels.push(k.nama_kategori);
        data.push(Number(k.total_pengeluaran));
        totalCategorized += Number(k.total_pengeluaran);
      }
    });
  }

  const sisaUncategorized = summary.value.totalPengeluaran - totalCategorized;
  if (sisaUncategorized > 0) {
    labels.push('Tanpa Kategori/Lainnya');
    data.push(sisaUncategorized);
  }

  return {
    labels,
    datasets: [{
      backgroundColor: backgroundColors.slice(0, Math.max(labels.length, 1)),
      data: data.length > 0 ? data : [0]
    }]
  };
});
const pieChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' },
    title: { display: true, text: 'Proporsi Pengeluaran Berdasarkan Kategori' }
  }
};

// --- LPJ EXPORT ---
const lpjTableRef = ref(null);
const lpjFilter = ref('semua');

const filteredLpjList = computed(() => {
  if (lpjFilter.value === 'semua') return transaksiList.value;
  const now = new Date();
  return transaksiList.value.filter(t => {
    const d = new Date(t.tanggal);
    if (lpjFilter.value === 'hari') {
      return d.toDateString() === now.toDateString();
    }
    if (lpjFilter.value === 'minggu') {
      const diff = (now - d) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    }
    if (lpjFilter.value === 'bulan') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true;
  });
});

const lpjSummary = computed(() => {
  let masuk = 0;
  let keluar = 0;
  filteredLpjList.value.forEach(t => {
    if (t.jenis === 'pemasukan') masuk += Number(t.nominal);
    if (t.jenis === 'pengeluaran') keluar += Number(t.nominal);
  });
  return { masuk, keluar, saldo: masuk - keluar };
});

const exportPDF = () => {
  if (filteredLpjList.value.length === 0) {
    toastInfo('Tidak ada data untuk diekspor.');
    return;
  }
  const element = lpjTableRef.value;
  const opt = {
    margin: 1,
    filename: `LPJ_Keuangan_${lpjFilter.value}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
  };
  html2pdf().set(opt).from(element).save();
};

// --- IURAN METHODS ---
const saveIuranTarget = async () => {
  const target = toCurrencyNumber(iuranTarget.value);
  if (!target || target <= 0) {
    toastWarning('Target iuran harus lebih dari Rp 0.');
    return;
  }
  const intervalLabel = iuranIntervalLabels[iuranInterval.value] || iuranInterval.value;
  if (!(await confirm({
    title: 'Ubah Target Iuran?',
    message: `Ubah target iuran menjadi ${formatRupiah(iuranTarget.value)} per orang dengan periode ${intervalLabel} untuk semua anggota?`,
    type: 'warning',
    confirmText: 'Ya, Simpan',
  }))) return;
  isSettingTarget.value = true;
  try {
    const res = await fetch('/api/bendahara/iuran/target', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token.value}` },
      body: JSON.stringify({ nominal_target: toCurrencyNumber(iuranTarget.value), iuran_interval: iuranInterval.value })
    });
    if (res.ok) {
      toastSuccess('Target iuran berhasil diperbarui!');
      fetchIuran();
      fetchSummary();
    } else toastError('Gagal memperbarui target.');
  } catch(e) { console.error(e) }
  isSettingTarget.value = false;
};

const promptBayarIuran = async (userObj) => {
  const sisa = userObj.nominal_target - userObj.nominal_terbayar;
  const amountStr = await prompt({
    title: 'Catat Pembayaran Iuran',
    message: `Anggota: ${userObj.nama_lengkap}\nTarget iuran: ${formatRupiah(userObj.nominal_target)}\nSudah terbayar: ${formatRupiah(userObj.nominal_terbayar)}\nSisa tagihan: ${formatRupiah(sisa)}`,
    placeholder: 'Rp 0',
    inputType: 'currency',
    confirmText: 'Catat Bayar',
  });
  if (!amountStr) return;
  const nominal = toCurrencyNumber(amountStr);
  if (isNaN(nominal) || nominal <= 0) {
    toastError('Nominal tidak valid!');
    return;
  }
  
  try {
    const res = await fetch('/api/bendahara/iuran/bayar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token.value}` },
      body: JSON.stringify({ user_id: userObj.user_id, nominal_bayar: nominal })
    });
    if (res.ok) {
      toastSuccess('Pembayaran berhasil dicatat dan otomatis masuk ke Arus Kas (Kategori: Iuran Anggota).');
      fetchIuran();
      fetchTransaksi();
      fetchSummary();
    } else {
      const data = await res.json();
      toastError(data.message || 'Gagal mencatat pembayaran.');
    }
  } catch(e) { console.error(e) }
};

// --- PENGAJUAN METHODS ---
const updatePengajuan = async (p, newStatus) => {
  if (pengajuanProcessingId.value) return;
  let catatan = '';
  if (newStatus === 'ditolak') {
    catatan = await prompt({
      title: 'Tolak Pengajuan',
      message: `Pengaju: ${p.nama_lengkap}${p.nim ? ` (${p.nim})` : ''}\nNominal: ${formatRupiah(p.nominal)}`,
      placeholder: 'Tuliskan alasan penolakan...',
      confirmText: 'Tolak Pengajuan',
    });
    if (catatan === null) return;
    if (!catatan.trim()) {
      toastWarning('Alasan penolakan wajib diisi.');
      return;
    }
  } else {
    if (!(await confirm({
      title: 'Setujui Pengajuan?',
      message: `Setujui pengajuan sebesar ${formatRupiah(p.nominal)} dari ${p.nama_lengkap}${p.nim ? ` (${p.nim})` : ''}?\n\nSaldo kas saat ini: ${formatRupiah(summary.value.saldo)}\nSaldo akan otomatis terpotong.`,
      type: 'info',
      confirmText: 'Ya, Setujui',
    }))) return;
  }

  pengajuanProcessingId.value = p.id;
  try {
    const res = await fetch(`/api/bendahara/pengajuan/${p.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token.value}` },
      body: JSON.stringify({ status: newStatus, catatan_bendahara: catatan.trim() })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toastSuccess(`Pengajuan berhasil ${newStatus === 'disetujui' ? 'disetujui' : 'ditolak'}!`);
      fetchPengajuan();
      if (newStatus === 'disetujui') {
        fetchTransaksi();
        fetchSummary();
      }
    } else {
      toastError(data.message || 'Gagal memperbarui status pengajuan.');
    }
  } catch(e) {
    toastError('Terjadi kesalahan jaringan.');
  } finally {
    pengajuanProcessingId.value = null;
  }
};

const exportExcel = async () => {
  if (filteredLpjList.value.length === 0) {
    toastInfo('Tidak ada data untuk diekspor.');
    return;
  }
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Arus Kas');
  
  worksheet.columns = [
    { header: 'Tanggal', key: 'tanggal', width: 15 },
    { header: 'Jenis', key: 'jenis', width: 15 },
    { header: 'Kategori / Pos', key: 'kategori', width: 25 },
    { header: 'Keterangan', key: 'keterangan', width: 40 },
    { header: 'Nominal', key: 'nominal', width: 20 }
  ];
  
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
    cell.alignment = { horizontal: 'center' };
  });

  filteredLpjList.value.forEach(t => {
    worksheet.addRow({
      tanggal: new Date(t.tanggal).toLocaleDateString('id-ID'),
      jenis: t.jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
      kategori: t.nama_kategori || '-',
      keterangan: t.keterangan,
      nominal: Number(t.nominal)
    });
  });

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: {style:'thin'},
        left: {style:'thin'},
        bottom: {style:'thin'},
        right: {style:'thin'}
      };
      if (rowNumber > 1) {
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 5 ? 'right' : 'left' };
        if (colNumber === 5) {
          cell.numFmt = '"Rp"#,##0;[Red]\-"Rp"#,##0';
          if (row.getCell(2).value === 'Pemasukan') {
            cell.font = { color: { argb: 'FF10B981' } };
          } else {
            cell.font = { color: { argb: 'FFEF4444' } };
          }
        }
      }
    });
  });
  
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `LPJ_Keuangan_${lpjFilter.value}_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(link);
};

// --- FILE EXPLORER KEUANGAN ---
const keuanganRootFolderId = ref(null);
const explorerReady = ref(false);
const explorerCurrentFolderId = ref(null);
const explorerFolders = ref([]);
const explorerFiles = ref([]);
const explorerPathHistory = ref([]);
const explorerSearchQuery = ref('');
const showCreateFolderModal = ref(false);
const folderFormName = ref('');
const contextMenu = ref({ x: 0, y: 0, show: false, item: null, type: null });

const initKeuanganExplorer = async () => {
  try {
    const res = await fetch('/api/bendahara/keuangan-folder', {
      headers: { 'Authorization': `Bearer ${token.value}` }
    });
    if (res.ok) {
      const data = await res.json();
      keuanganRootFolderId.value = data.id;
      explorerReady.value = true;
      if (activeTab.value === 'explorer') {
        openRootExplorer();
      }
    } else {
      toastError('Gagal memuat folder Keuangan.');
    }
  } catch(e) {
    console.error(e);
  }
};

const openRootExplorer = () => {
  explorerPathHistory.value = [];
  fetchExplorerDirectory(keuanganRootFolderId.value);
};

const fetchExplorerDirectory = async (folderId) => {
  if (!folderId) return;
  try {
    const res = await fetch(`/api/arsip/directory?parentId=${folderId}&limit=100`, {
      headers: { 'Authorization': `Bearer ${token.value}` }
    });
    if (res.ok) {
      const data = await res.json();
      const q = explorerSearchQuery.value.trim().toLowerCase();
      explorerFolders.value = q
        ? data.folders.filter(f => f.nama_folder.toLowerCase().includes(q))
        : data.folders;
      explorerFiles.value = q
        ? data.files.filter(f => f.nama_file.toLowerCase().includes(q))
        : data.files;
      explorerCurrentFolderId.value = folderId;
    }
  } catch (err) {
    console.error(err);
    toastError('Gagal memuat isi folder.');
  }
};

const handleExplorerSearch = () => {
  const parentId = explorerCurrentFolderId.value || keuanganRootFolderId.value;
  if (!parentId) {
    toastWarning('Folder Keuangan belum siap. Tunggu sebentar...');
    return;
  }
  fetchExplorerDirectory(parentId);
};

const openExplorerFolder = (folder) => {
  explorerSearchQuery.value = '';
  explorerPathHistory.value.push(explorerCurrentFolderId.value);
  fetchExplorerDirectory(folder.id);
};

const goBackExplorer = () => {
  explorerSearchQuery.value = '';
  if (explorerPathHistory.value.length > 0) {
    const prevFolder = explorerPathHistory.value.pop();
    fetchExplorerDirectory(prevFolder);
  }
};

const createFolder = async () => {
  if (!folderFormName.value.trim()) return;
  const parentId = explorerCurrentFolderId.value || keuanganRootFolderId.value;
  if (!parentId) {
    toastWarning('Folder Keuangan belum siap. Tunggu sebentar...');
    return;
  }
  try {
    const res = await fetch('/api/arsip/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token.value}` },
      body: JSON.stringify({ nama_folder: folderFormName.value, parent_id: parentId })
    });
    if (res.ok) {
      showCreateFolderModal.value = false;
      folderFormName.value = '';
      fetchExplorerDirectory(explorerCurrentFolderId.value);
    }
  } catch (err) {
    console.error(err);
  }
};

// Context Menu (Right Click)
const onRightClick = (event, item, type) => {
  contextMenu.value = {
    x: event.clientX,
    y: event.clientY,
    show: true,
    item,
    type
  };
};

const closeContextMenu = () => {
  contextMenu.value.show = false;
};

const renameExplorerItem = async () => {
  const { item, type } = contextMenu.value;
  if (!item) return;
  const currentName = type === 'folder' ? item.nama_folder : item.nama_file;
  const newName = await prompt({
    title: `Ganti Nama ${type === 'folder' ? 'Folder' : 'File'}`,
    defaultValue: currentName,
    placeholder: 'Masukkan nama baru...',
    confirmText: 'Simpan',
  });
  if (!newName || newName.trim() === '' || newName === currentName) {
    closeContextMenu();
    return;
  }
  
  try {
    const res = await fetch('/api/arsip/rename', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify({
        id: item.id,
        type: type,
        newName: newName.trim()
      })
    });
    if (res.ok) {
      fetchExplorerDirectory(explorerCurrentFolderId.value);
    } else {
      const d = await res.json();
      toastError(d.message || 'Gagal mengganti nama.');
    }
  } catch (e) {
    toastInfo('Terjadi kesalahan jaringan.');
  }
  closeContextMenu();
};

const downloadFile = async (fileObj) => {
  try {
    const response = await fetch(fileObj.url_file); // Use proxied URL
    if (!response.ok) throw new Error("Network response was not ok");
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileObj.nama_file;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  } catch (error) {
    console.error("Download failed:", error);
    toastError('Gagal mengunduh file.');
  }
};

const deleteExplorerItem = async () => {
  const { item, type } = contextMenu.value;
  if (!item) return;
  if (!(await confirm({
    title: 'Hapus Item?',
    message: `Yakin ingin menghapus ${type === 'folder' ? 'folder' : 'file'} "${type === 'folder' ? item.nama_folder : item.nama_file}"?`,
    type: 'danger',
    confirmText: 'Ya, Hapus',
  }))) {
    closeContextMenu();
    return;
  }
  try {
    const url = type === 'folder' ? `/api/arsip/folders/${item.id}` : `/api/arsip/files/${item.id}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token.value}` }
    });
    if (res.ok) {
      fetchExplorerDirectory(explorerCurrentFolderId.value);
    }
  } catch(e) {
    console.error(e);
  }
  closeContextMenu();
};

window.addEventListener('click', closeContextMenu);
onBeforeUnmount(() => {
  window.removeEventListener('click', closeContextMenu);
});
</script>

<template>
  <div class="dashboard-container" @click="closeContextMenu">
    <!-- Header -->
    <header class="dashboard-header animate-slide-down">
      <div class="header-content">
        <div>
          <h1 class="text-gradient">Dashboard Bendahara</h1>
          <p class="text-muted">Kelola Keuangan Posko KKN Anda</p>
        </div>
        <div class="user-profile">
          <div class="avatar">💰</div>
          <div class="user-info">
            <span class="user-name">{{ user?.nama_lengkap }}</span>
            <span class="user-role badge badge-primary">{{ user?.jabatan }}</span>
          </div>
          <button @click="router.push('/mahasiswa')" class="btn-logout" style="background: var(--color-primary); color: white;">Kembali ke Mahasiswa</button>
        </div>
      </div>
    </header>

    <main class="dashboard-main">
      <!-- TABS NAVIGATION -->
      <div class="tabs-container animate-fade-in">
        <button :class="['tab-btn', { active: activeTab === 'dashboard' }]" @click="activeTab = 'dashboard'">📊 Overview</button>
        <button :class="['tab-btn', { active: activeTab === 'rab' }]" @click="activeTab = 'rab'">📋 RAB (Anggaran)</button>
        <button :class="['tab-btn', { active: activeTab === 'aruskas' }]" @click="activeTab = 'aruskas'">💸 Arus Kas</button>
        <button :class="['tab-btn', { active: activeTab === 'iuran' }]" @click="activeTab = 'iuran'">👥 Iuran Anggota</button>
        <button :class="['tab-btn', { active: activeTab === 'pengajuan' }]" @click="activeTab = 'pengajuan'">📩 Pengajuan Kas</button>
        <button :class="['tab-btn', { active: activeTab === 'explorer' }]" @click="activeTab = 'explorer'; if (explorerReady && explorerPathHistory.length === 0) openRootExplorer()">📁 File Explorer Nota</button>
        <button :class="['tab-btn', { active: activeTab === 'lpj' }]" @click="activeTab = 'lpj'">🖨️ Cetak LPJ</button>
      </div>

      <!-- TAB: OVERVIEW (DASHBOARD) -->
      <div v-show="activeTab === 'dashboard'" class="tab-content animate-fade-in">
        <div class="stats-grid">
          <div class="stat-card" style="background: linear-gradient(135deg, #10b981, #059669); color: white;">
            <div class="stat-icon">📥</div>
            <div class="stat-info">
              <span class="stat-label" style="color: rgba(255,255,255,0.8)">Total Pemasukan</span>
              <h3 class="stat-value">{{ formatRupiah(summary.totalPemasukan) }}</h3>
            </div>
          </div>
          <div class="stat-card" style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white;">
            <div class="stat-icon">📤</div>
            <div class="stat-info">
              <span class="stat-label" style="color: rgba(255,255,255,0.8)">Total Pengeluaran</span>
              <h3 class="stat-value">{{ formatRupiah(summary.totalPengeluaran) }}</h3>
            </div>
          </div>
          <div class="stat-card" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white;">
            <div class="stat-icon">💰</div>
            <div class="stat-info">
              <span class="stat-label" style="color: rgba(255,255,255,0.8)">Sisa Saldo Kas</span>
              <h3 class="stat-value">{{ formatRupiah(summary.saldo) }}</h3>
            </div>
          </div>
        </div>

        <div class="charts-section" style="margin-top: 2rem; display: flex; gap: 2rem; flex-wrap: wrap;">
          <div class="chart-card" style="flex: 1; min-width: 300px; background: white; padding: 2rem; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
            <h3 style="margin-bottom: 1rem; color: var(--text-main); font-weight: 600;">Grafik Pengeluaran per Pos</h3>
            <div style="position: relative; height: 300px; width: 100%;">
               <Pie v-if="summary.totalPengeluaran > 0" :data="pieChartData" :options="pieChartOptions" />
               <div v-else class="text-muted text-center" style="padding-top: 4rem;">Belum ada data pengeluaran.</div>
            </div>
          </div>
          
          <div class="progress-card" style="flex: 1; min-width: 300px; background: white; padding: 2rem; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
            <h3 style="margin-bottom: 1rem; color: var(--text-main); font-weight: 600;">Progress Sisa Anggaran (RAB)</h3>
            <div v-for="kat in summary.kategori" :key="kat.id" style="margin-bottom: 1.5rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="font-weight: 500; font-size: 0.95rem;">
                  {{ kat.nama_kategori }}
                  <span v-if="getKategoriProgress(kat).isIuran" style="font-size:0.75rem;color:#0369a1;margin-left:4px;">(Pemasukan)</span>
                </span>
                <span style="font-size: 0.85rem; color: var(--text-muted);">
                  {{ formatRupiah(getKategoriProgress(kat).used) }} / {{ formatRupiah(getKategoriProgress(kat).plafon) }}
                </span>
              </div>
              <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                <div 
                  :style="{
                    width: `${getKategoriProgress(kat).percent}%`, 
                    height: '100%', 
                    background: getKategoriProgress(kat).over ? '#ef4444' : (getKategoriProgress(kat).isIuran ? '#3b82f6' : '#10b981'),
                    transition: 'width 0.5s ease'
                  }">
                </div>
              </div>
            </div>
            <div v-if="!summary.kategori || summary.kategori.length === 0" class="text-muted text-center" style="padding: 1rem;">
              Belum ada data anggaran.
            </div>
          </div>
        </div>
      </div>

      <!-- TAB: RAB (ANGGARAN) -->
      <div v-show="activeTab === 'rab'" class="tab-content animate-fade-in">
        <div class="glass-card">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h2>Rencana Anggaran Biaya (RAB)</h2>
            <button @click="showModalKategori = true" class="btn-primary">+ Tambah Pos / Kategori</button>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Pos/Kategori</th>
                  <th>Plafon Anggaran</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(kat, index) in kategoriList" :key="kat.id">
                  <td>{{ index + 1 }}</td>
                  <td>{{ kat.nama_kategori }}</td>
                  <td>{{ formatRupiah(kat.plafon_dana) }}</td>
                  <td>
                    <div class="action-buttons">
                      <button @click="editKategori(kat)" class="btn-icon" title="Edit">✏️</button>
                      <button @click="hapusKategori(kat.id)" class="btn-icon delete" title="Hapus">🗑️</button>
                    </div>
                  </td>
                </tr>
                <tr v-if="kategoriList.length === 0">
                  <td colspan="4" class="text-center text-muted">Belum ada kategori RAB.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- TAB: ARUS KAS -->
      <div v-show="activeTab === 'aruskas'" class="tab-content animate-fade-in">
        <div class="glass-card">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h2>Catatan Arus Kas</h2>
            <button @click="openModalTransaksi" class="btn-primary">+ Tambah Transaksi</button>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Jenis</th>
                  <th>Kategori</th>
                  <th>Keterangan</th>
                  <th>Nominal</th>
                  <th>Bukti Nota</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in transaksiList" :key="t.id">
                  <td>{{ new Date(t.tanggal).toLocaleDateString('id-ID') }}</td>
                  <td>
                    <span :class="['badge', t.jenis === 'pemasukan' ? 'badge-success' : 'badge-danger']">
                      {{ t.jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran' }}
                    </span>
                  </td>
                  <td>{{ t.nama_kategori || '-' }}</td>
                  <td>{{ t.keterangan }}</td>
                  <td :style="{ color: t.jenis === 'pemasukan' ? '#10b981' : '#ef4444', fontWeight: 'bold' }">
                    {{ t.jenis === 'pemasukan' ? '+' : '-' }} {{ formatRupiah(t.nominal) }}
                  </td>
                  <td>
                    <a v-if="t.nota_url" :href="t.nota_url.startsWith('http') ? t.nota_url : t.nota_url" target="_blank" class="text-primary" style="text-decoration: underline; font-size: 0.85rem;">Lihat Bukti</a>
                    <span v-else class="text-muted" style="font-size: 0.85rem;">-</span>
                  </td>
                  <td>
                    <button @click="hapusTransaksi(t.id)" class="btn-icon delete" title="Hapus">🗑️</button>
                  </td>
                </tr>
                <tr v-if="transaksiList.length === 0">
                  <td colspan="7" class="text-center text-muted">Belum ada catatan transaksi.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- TAB: FILE EXPLORER KEUANGAN -->
      <div v-show="activeTab === 'explorer'" class="tab-content animate-fade-in">
        <div class="glass-card">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
            <h2 style="margin: 0; color: var(--text-main);">📁 File Explorer Keuangan</h2>
          </div>
          
          <div class="explorer-top-actions" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; align-items: center; justify-content: space-between;">
            <div style="display: flex; gap: 0.5rem;">
              <button v-if="explorerPathHistory.length > 0" @click="goBackExplorer" class="btn-primary" style="background: #cbd5e1; color: #334155;">⬅ Kembali</button>
              <button @click="showCreateFolderModal = true" class="btn-primary" style="background: var(--color-primary); color: white;">+ Buat Folder</button>
            </div>
            <div class="search-box" style="position: relative; flex: 1; max-width: 250px;">
              <input type="text" v-model="explorerSearchQuery" @keyup.enter="handleExplorerSearch" placeholder="Cari di folder ini..." style="width: 100%; padding: 0.5rem 1rem; border: 1px solid var(--color-border); border-radius: 8px; font-size: 0.9rem;" />
            </div>
          </div>

          <div class="explorer-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
            <div v-if="explorerFolders.length === 0 && explorerFiles.length === 0" class="text-muted text-center" style="padding: 3rem; background: #f8fafc; border-radius: 8px; border: 1px dashed var(--border-color);">Folder ini kosong.</div>
            
            <!-- Folders -->
            <div v-for="folder in explorerFolders" :key="folder.id" 
                 @contextmenu.prevent.stop="onRightClick($event, folder, 'folder')" 
                 class="explorer-item" style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.2s;"
                 @click="openExplorerFolder(folder)">
              <div style="display: flex; align-items: center; flex: 1;">
                <span style="font-size: 1.5rem; margin-right: 1rem;">📁</span>
                <span style="font-weight: 500; color: var(--text-main);">{{ folder.nama_folder }}</span>
              </div>
            </div>

            <!-- Files -->
            <div v-for="file in explorerFiles" :key="file.id" 
                 @contextmenu.prevent.stop="onRightClick($event, file, 'file')" 
                 class="explorer-item" style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: white; border: 1px solid var(--border-color); border-radius: 8px;">
              <div style="display: flex; align-items: center; flex: 1; overflow: hidden;">
                <span style="font-size: 1.5rem; margin-right: 1rem;">{{ file.tipe_file.includes('image') ? '🖼️' : '📄' }}</span>
                <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <a :href="file.url_file" target="_blank" style="font-weight: 500; color: var(--color-primary); text-decoration: none;">{{ file.nama_file }}</a>
                  <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                    Diupload pada: {{ new Date(file.uploaded_at).toLocaleDateString('id-ID') }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB: IURAN ANGGOTA -->
      <div v-show="activeTab === 'iuran'" class="tab-content animate-fade-in">
        <div class="glass-card">
          <div class="card-header" style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h2>Pemantau Iuran Anggota</h2>
              <p class="text-muted">
                Pantau status pembayaran iuran wajib setiap anggota posko.
                <span v-if="iuranInterval" style="display:inline-block;margin-top:0.25rem;padding:0.15rem 0.6rem;background:#e0f2fe;color:#0369a1;border-radius:99px;font-size:0.8rem;font-weight:600;">
                  Periode: {{ iuranIntervalLabels[iuranInterval] || iuranInterval }}
                </span>
              </p>
            </div>
            <div style="background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end;">
              <div>
                <label style="font-weight: 600; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Rentang Waktu Pembayaran:</label>
                <select v-model="iuranInterval" class="form-control" style="padding: 0.5rem; min-width: 160px;">
                  <option value="sekali">Sekali (Sekali Bayar)</option>
                  <option value="harian">Harian</option>
                  <option value="mingguan">Mingguan</option>
                  <option value="bulanan">Bulanan</option>
                </select>
              </div>
              <div>
                <label style="font-weight: 600; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Target Iuran per Orang (Rp):</label>
                <div style="display: flex; gap: 0.5rem;">
                  <CurrencyInput
                    v-model="iuranTarget"
                    placeholder="0"
                    input-style="border:none;padding:0.5rem 0;box-shadow:none;"
                  />
                  <button class="btn-primary" @click="saveIuranTarget" :disabled="isSettingTarget" style="padding: 0.5rem 1rem;">{{ isSettingTarget ? 'Menyimpan...' : 'Set Target' }}</button>
                </div>
              </div>
            </div>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Nama Anggota</th>
                  <th>Target Iuran</th>
                  <th>Terbayar</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="iuranList.length === 0">
                  <td colspan="5" class="text-center text-muted" style="padding: 2rem;">Belum ada anggota posko atau target iuran belum diatur.</td>
                </tr>
                <tr v-for="u in iuranList" :key="u.user_id">
                  <td style="font-weight: 500;">{{ u.nama_lengkap }}</td>
                  <td>{{ formatRupiah(u.nominal_target) }}</td>
                  <td>{{ formatRupiah(u.nominal_terbayar) }}</td>
                  <td>
                    <span class="badge" :class="(u.status || 'belum') === 'lunas' ? 'badge-success' : (u.status || 'belum') === 'sebagian' ? 'badge-warning' : 'badge-danger'">
                      {{ (u.status || 'belum').toUpperCase() }}
                    </span>
                  </td>
                  <td>
                    <button v-if="(u.status || 'belum') !== 'lunas'" class="btn-primary btn-small" @click="promptBayarIuran(u)" style="background: #10b981; border: none;">+ Catat Bayar</button>
                    <span v-else class="text-muted" style="font-size: 0.85rem;">Lunas ✓</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- TAB: PENGAJUAN REIMBURSEMENT -->
      <div v-show="activeTab === 'pengajuan'" class="tab-content animate-fade-in">
        <div class="glass-card">
          <div class="card-header" style="margin-bottom: 1.5rem;">
            <h2>Persetujuan Pengajuan Dana (Reimbursement)</h2>
            <p class="text-muted">Tinjau dan setujui permintaan pencairan dana kas dari anggota posko.</p>
          </div>
          <div class="table-container" style="overflow-x: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Pengaju</th>
                  <th>RAB (Pos)</th>
                  <th>Keterangan</th>
                  <th>Nominal</th>
                  <th>Bukti (Nota)</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="pengajuanList.length === 0">
                  <td colspan="8" class="text-center text-muted" style="padding: 2rem;">Belum ada pengajuan dana dari anggota.</td>
                </tr>
                <tr v-for="p in pengajuanList" :key="p.id">
                  <td>{{ new Date(p.created_at).toLocaleDateString('id-ID') }}</td>
                  <td style="font-weight: 500;">
                    <div>{{ p.nama_lengkap }}</div>
                    <div style="font-size:0.78rem;color:#64748b;margin-top:3px;display:flex;flex-direction:column;gap:2px;">
                      <span v-if="p.nim">🎓 NIM: {{ p.nim }}</span>
                      <span v-if="p.pengaju_jabatan">👤 {{ p.pengaju_jabatan }}</span>
                    </div>
                  </td>
                  <td>{{ p.nama_kategori }}</td>
                  <td>{{ p.keterangan }}</td>
                  <td style="color: #ef4444; font-weight: 600;">{{ formatRupiah(p.nominal) }}</td>
                  <td>
                    <a v-if="p.file_nota_url" :href="p.file_nota_url.startsWith('http') ? p.file_nota_url : p.file_nota_url" target="_blank" class="badge badge-primary" style="text-decoration: none;">Lihat Bukti</a>
                    <span v-else class="text-muted">-</span>
                  </td>
                  <td>
                    <span class="badge" :class="p.status === 'disetujui' ? 'badge-success' : p.status === 'ditolak' ? 'badge-danger' : 'badge-warning'">
                      {{ p.status.toUpperCase() }}
                    </span>
                  </td>
                  <td>
                    <div v-if="p.status === 'pending'" style="display: flex; gap: 5px;">
                      <button class="btn-primary btn-small" @click="updatePengajuan(p, 'disetujui')" :disabled="pengajuanProcessingId === p.id" style="background: #10b981; border: none; padding: 4px 8px;">{{ pengajuanProcessingId === p.id ? '...' : 'Setujui' }}</button>
                      <button class="btn-outline btn-small" @click="updatePengajuan(p, 'ditolak')" :disabled="pengajuanProcessingId === p.id" style="border-color: #ef4444; color: #ef4444; padding: 4px 8px;">Tolak</button>
                    </div>
                    <span v-else class="text-muted" style="font-size: 0.85rem;">{{ p.catatan_bendahara || '-' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- TAB: CETAK LPJ -->
      <div v-show="activeTab === 'lpj'" class="tab-content animate-fade-in">
        <div class="glass-card">
          <div class="card-header" style="margin-bottom: 1.5rem; text-align: center;">
            <h2>Ekspor Laporan Pertanggungjawaban (LPJ)</h2>
            <p class="text-muted">Pilih format laporan untuk diunduh dan diserahkan ke Kampus / DPL.</p>
            <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem; align-items: center; flex-wrap: wrap;">
              <div style="background: white; padding: 0.5rem 1rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 0.5rem;">
                <label style="font-weight: 500; font-size: 0.9rem;">Filter Periode:</label>
                <select v-model="lpjFilter" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; outline: none;">
                  <option value="semua">Semua Waktu</option>
                  <option value="hari">Hari Ini</option>
                  <option value="minggu">7 Hari Terakhir</option>
                  <option value="bulan">Bulan Ini</option>
                </select>
              </div>
              <button @click="exportExcel" class="btn-primary" style="background: #10b981; border: none; font-size: 1rem; padding: 0.75rem 1.5rem;">📊 Download Excel (XLSX)</button>
              <button @click="exportPDF" class="btn-primary" style="background: #ef4444; border: none; font-size: 1rem; padding: 0.75rem 1.5rem;">📄 Download PDF</button>
            </div>
          </div>
          
          <!-- Hidden Element for PDF Generator -->
          <div style="overflow-x: auto; margin-top: 2rem; border-top: 1px solid #e2e8f0; padding-top: 2rem;">
            <h3 style="text-align: center; margin-bottom: 1rem; color: #475569;">Preview Data LPJ</h3>
            <div ref="lpjTableRef" style="background: white; padding: 1rem;">
              <h2 style="text-align: center; margin-bottom: 0.5rem;">Laporan Kas Posko KKN</h2>
              <p style="text-align: center; color: #666; margin-bottom: 1.5rem;">Periode: {{ lpjFilter === 'semua' ? 'Semua Waktu' : lpjFilter === 'hari' ? 'Hari Ini' : lpjFilter === 'minggu' ? '7 Hari Terakhir' : 'Bulan Ini' }} | Tanggal Unduh: {{ new Date().toLocaleDateString('id-ID') }}</p>
              <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; font-family: sans-serif;">
                <thead>
                  <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                    <th style="padding: 0.5rem; text-align: left;">Tanggal</th>
                    <th style="padding: 0.5rem; text-align: left;">Jenis</th>
                    <th style="padding: 0.5rem; text-align: left;">Kategori / RAB</th>
                    <th style="padding: 0.5rem; text-align: left;">Keterangan</th>
                    <th style="padding: 0.5rem; text-align: right;">Pemasukan</th>
                    <th style="padding: 0.5rem; text-align: right;">Pengeluaran</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="filteredLpjList.length === 0">
                    <td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">Tidak ada transaksi pada periode ini.</td>
                  </tr>
                  <tr v-for="t in filteredLpjList" :key="t.id" style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 0.5rem;">{{ new Date(t.tanggal).toLocaleDateString('id-ID') }}</td>
                    <td style="padding: 0.5rem;">{{ t.jenis }}</td>
                    <td style="padding: 0.5rem;">{{ t.nama_kategori || '-' }}</td>
                    <td style="padding: 0.5rem;">{{ t.keterangan }}</td>
                    <td style="padding: 0.5rem; text-align: right;">{{ t.jenis === 'pemasukan' ? formatRupiah(t.nominal) : '-' }}</td>
                    <td style="padding: 0.5rem; text-align: right;">{{ t.jenis === 'pengeluaran' ? formatRupiah(t.nominal) : '-' }}</td>
                  </tr>
                  <tr style="font-weight: bold; background: #f8fafc;">
                    <td colspan="4" style="padding: 0.5rem; text-align: right;">TOTAL:</td>
                    <td style="padding: 0.5rem; text-align: right; color: #10b981;">{{ formatRupiah(lpjSummary.masuk) }}</td>
                    <td style="padding: 0.5rem; text-align: right; color: #ef4444;">{{ formatRupiah(lpjSummary.keluar) }}</td>
                  </tr>
                  <tr style="font-weight: bold; font-size: 1rem; background: #e0f2fe;">
                    <td colspan="4" style="padding: 0.75rem; text-align: right;">SALDO PERIODE:</td>
                    <td colspan="2" style="padding: 0.75rem; text-align: center; color: #0369a1;">{{ formatRupiah(lpjSummary.saldo) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Context Menu File Explorer -->
    <div v-if="contextMenu.show" 
         :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }" 
         class="context-menu" @click.stop>
      <ul style="list-style: none; padding: 0; margin: 0; background: white; border: 1px solid var(--border-color); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-radius: 6px; min-width: 150px; overflow: hidden;">
        <li v-if="contextMenu.type === 'file'" @click="downloadFile(contextMenu.item); closeContextMenu()" style="color: #334155; padding: 0.5rem 1rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
          <span>⬇️</span> Unduh (Download)
        </li>
        <li @click="renameExplorerItem" style="color: #334155; padding: 0.5rem 1rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
          <span>✏️</span> Ganti Nama
        </li>
        <li @click="deleteExplorerItem" class="text-danger" style="padding: 0.5rem 1rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='transparent'">
          <span>🗑️</span> Hapus
        </li>
      </ul>
    </div>

    <!-- Modal Kategori / RAB -->
    <div v-if="showModalKategori" class="modal-backdrop" @click.self="resetFormKategori">
      <div class="modal-content animate-slide-up">
        <h2>{{ formKategori.id ? 'Edit Kategori / Pos' : 'Tambah Kategori / Pos' }}</h2>
        <form @submit.prevent="submitKategori" class="modal-form">
          <div class="form-group">
            <label>Nama Kategori/Pos</label>
            <input type="text" v-model="formKategori.nama_kategori" required placeholder="Contoh: Transportasi, Proker Edukasi..." />
          </div>
          <div class="form-group">
            <label>Plafon Anggaran (RAB)</label>
            <CurrencyInput
              v-model="formKategori.plafon_dana"
              placeholder="0"
            />
            <small class="text-muted">Total anggaran maksimal yang direncanakan untuk pos ini.</small>
          </div>
          <div class="modal-actions">
            <button type="button" @click="resetFormKategori" class="btn-secondary">Batal</button>
            <button type="submit" class="btn-primary">Simpan</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Transaksi -->
    <div v-if="showModalTransaksi" class="modal-backdrop" @click.self="resetFormTransaksi">
      <div class="modal-content animate-slide-up" style="max-width: 600px;">
        <h2>Tambah Transaksi Arus Kas</h2>
        <form @submit.prevent="submitTransaksi" class="modal-form">
          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <div class="form-group" style="flex: 1; min-width: 200px;">
              <label>Jenis Transaksi</label>
              <select v-model="formTransaksi.jenis" required>
                <option value="pengeluaran">Pengeluaran (Uang Keluar)</option>
                <option value="pemasukan">Pemasukan (Uang Masuk)</option>
              </select>
            </div>
            <div class="form-group" style="flex: 1; min-width: 200px;">
              <label>Tanggal</label>
              <input type="date" v-model="formTransaksi.tanggal" required />
            </div>
          </div>
          
          <div class="form-group">
            <label>Kategori / Pos RAB</label>
            <SearchableSelect
              v-model="formTransaksi.kategori_id"
              v-model:manual-value="formTransaksi.input_kategori"
              :options="kategoriList"
              placeholder="Cari kategori RAB atau ketik nama baru..."
              required
            />
            <small class="text-muted">Pilih dari daftar atau ketik nama baru untuk membuat pos RAB otomatis.</small>
          </div>
          
          <div class="form-group">
            <label>Nominal (Rp)</label>
            <CurrencyInput
              v-model="formTransaksi.nominal"
              placeholder="0"
              required
            />
          </div>
          
          <div class="form-group">
            <label>Keterangan</label>
            <textarea v-model="formTransaksi.keterangan" required placeholder="Jelaskan detail transaksi..."></textarea>
          </div>
          
          <div class="form-group">
            <label>Upload Bukti Nota/Kuitansi (Opsional)</label>
            <input type="file" ref="fileNotaRef" @change="onFileChange" accept="image/*,.pdf" class="file-input" />
            <small class="text-muted">File akan disimpan otomatis ke folder "Keuangan".</small>
          </div>

          <div class="modal-actions">
            <button type="button" @click="resetFormTransaksi" class="btn-secondary">Batal</button>
            <button type="submit" class="btn-primary">Simpan Transaksi</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Create Folder Keuangan -->
    <div v-if="showCreateFolderModal" class="modal-backdrop" @click.self="showCreateFolderModal = false">
      <div class="modal-content animate-slide-up">
        <h2>Buat Folder Baru</h2>
        <form @submit.prevent="createFolder" class="modal-form">
          <div class="form-group">
            <label>Nama Folder</label>
            <input type="text" v-model="folderFormName" required placeholder="Nama folder..." autofocus />
          </div>
          <div class="modal-actions">
            <button type="button" @click="showCreateFolderModal = false" class="btn-secondary">Batal</button>
            <button type="submit" class="btn-primary">Buat</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

/* Basic styling matching the aesthetics of MahasiswaDashboard */
.form-group .currency-input-wrap,
.modal-form .currency-input-wrap {
  width: 100%;
  box-sizing: border-box;
}

.dashboard-container {
  min-height: 100vh;
  background-color: var(--bg-main);
}

.dashboard-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-color);
  padding: 1.5rem 2rem;
  position: sticky;
  top: 0;
  z-index: 40;
}
.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.text-gradient {
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin: 0 0 0.25rem 0;
}
.text-muted { color: var(--text-muted); margin: 0; font-size: 0.95rem; }

.user-profile {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.avatar {
  width: 48px;
  height: 48px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}
.user-info { display: flex; flex-direction: column; }
.user-name { font-weight: 600; color: var(--text-main); }
.badge { padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
.badge-primary { background: var(--color-primary-light); color: var(--color-primary); }
.badge-success { background: #d1fae5; color: #059669; }
.badge-danger { background: #fee2e2; color: #dc2626; }
.btn-logout {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.dashboard-main { max-width: 1200px; margin: 2rem auto; padding: 0 2rem; }

.tabs-container {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}
.tab-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: white;
  color: var(--text-main);
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.tab-btn:hover { background: #f8fafc; }
.tab-btn.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
}

.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
.stat-card {
  padding: 1.5rem;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
}
.stat-icon { font-size: 2.5rem; opacity: 0.9; }
.stat-value { margin: 0.25rem 0 0; font-size: 1.75rem; font-weight: 700; }

.glass-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
}

.table-container { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 1rem; text-align: left; border-bottom: 1px solid var(--border-color); }
.data-table th { background: #f8fafc; font-weight: 600; color: var(--text-muted); text-transform: uppercase; font-size: 0.85rem; }

.action-buttons { display: flex; gap: 0.5rem; }
.btn-icon { background: none; border: none; font-size: 1.25rem; cursor: pointer; opacity: 0.7; transition: opacity 0.2s; }
.btn-icon:hover { opacity: 1; }
.btn-primary, .btn-secondary { padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; }
.btn-primary { background: var(--color-primary); color: white; }
.btn-secondary { background: #e2e8f0; color: #475569; }

.context-menu { position: fixed; background: white; border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 1000; overflow: hidden; }
.context-menu ul { list-style: none; margin: 0; padding: 0.25rem 0; }
.context-menu li { padding: 0.5rem 1.5rem; cursor: pointer; transition: background 0.2s; }
.context-menu li:hover { background: #f1f5f9; }
.text-danger { color: #ef4444; }

.modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
.modal-content { background: white; padding: 2rem; border-radius: 16px; width: 90%; max-width: 500px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
.modal-form { margin-top: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: 0.5rem; }
.form-group label { font-weight: 600; color: var(--text-main); font-size: 0.95rem; }
.form-group input, .form-group select, .form-group textarea { padding: 0.75rem 1rem; border: 1px solid var(--border-color); border-radius: 8px; font-family: inherit; font-size: 1rem; transition: border-color 0.2s; }
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-light); }
.file-input { padding: 0.5rem 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem; }

.animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
.animate-slide-up { animation: slideUp 0.5s ease-out forwards; }
.animate-slide-down { animation: slideDown 0.5s ease-out forwards; }

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 1.5rem;
  }
  .user-profile {
    width: 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  .btn-logout {
    margin-top: 0.5rem;
  }
  .dashboard-main {
    padding: 0 1rem;
  }
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

.explorer-item:hover { transform: translateY(-2px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
</style>
