import { ref, computed } from 'vue';
import ExcelJS from 'exceljs';
import { users, adminToken } from './adminContext.js';
import { useToast } from '../useNotification.js';

export function useAdminAbsensi() {
  const { success: toastSuccess, warning: toastWarning } = useToast();

  const periodeKkn = ref({ start: null, end: null });
  const selectedDate = ref(new Date().toISOString().split('T')[0]);
  const currentCalendarMonth = ref(new Date());
  const absensiData = ref([]);
  const absensiLoading = ref(false);

  const showPeriodeModal = ref(false);
  const editPeriode = ref({ start: '', end: '', password: '' });
  const isSavingPeriode = ref(false);
  const periodeError = ref('');

  const showAbsenModal = ref(false);
  const absensiTableRef = ref(null);
  const newAbsen = ref({ user_id: '', waktu: '08:00', status: 'izin', alasan: '' });
  const isSavingAbsen = ref(false);
  const absenError = ref('');

  const contextMenu = ref({ show: false, x: 0, y: 0, absen: null });
  
  const showEditAbsenModal = ref(false);
  const editAbsenForm = ref({ id: null, waktu: '', status: '', alasan: '' });
  const isEditingAbsen = ref(false);
  const editAbsenError = ref('');

  const showDeleteAbsenModal = ref(false);
  const isDeletingAbsen = ref(false);

  const showCetakModal = ref(false);
  const showCetakLogbookModal = ref(false);

  const calendarDays = ref([]);
  const periodDates = ref([]);

  const formatDateStr = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const allMahasiswaList = computed(() => {
    const attendedIds = new Set(absensiData.value.map((a) => a.user_id));
    return users.value.filter(
      (u) => (u.role === 'mahasiswa' || u.role === 'admin') && !attendedIds.has(u.id)
    );
  });

  const fetchPeriodeKkn = async () => {
    try {
      const res = await fetch('/api/periode', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          periodeKkn.value = {
            start: data.start_date.split('T')[0],
            end: data.end_date.split('T')[0],
          };
        }
      }
    } catch (e) {
      console.error('Gagal ambil periode', e);
    }
  };

  const fetchAbsensi = async (dateStr) => {
    absensiLoading.value = true;
    try {
      const res = await fetch(`/api/absensi?tanggal=${dateStr}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        absensiData.value = await res.json();
      }
    } catch (e) {
      console.error('Gagal ambil absensi', e);
    } finally {
      absensiLoading.value = false;
    }
  };

  const selectDate = (dateStr) => {
    selectedDate.value = dateStr;
    fetchAbsensi(dateStr);
  };

  const generateCalendar = () => {
    const year = currentCalendarMonth.value.getFullYear();
    const month = currentCalendarMonth.value.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];

    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ empty: true });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

      let inPeriod = false;
      if (periodeKkn.value.start && periodeKkn.value.end) {
        inPeriod = dateStr >= periodeKkn.value.start && dateStr <= periodeKkn.value.end;
      }

      days.push({
        empty: false,
        day: i,
        dateStr,
        inPeriod,
        isToday: dateStr === new Date().toISOString().split('T')[0],
      });
    }

    calendarDays.value = days;
  };

  const changeMonth = (offset) => {
    const newMonth = new Date(
      currentCalendarMonth.value.setMonth(currentCalendarMonth.value.getMonth() + offset)
    );
    currentCalendarMonth.value = new Date(newMonth);
    generateCalendar();
  };

  const generatePeriodDates = () => {
    if (!periodeKkn.value.start || !periodeKkn.value.end) {
      periodDates.value = [];
      return;
    }
    const dates = [];
    let curr = new Date(periodeKkn.value.start);
    const end = new Date(periodeKkn.value.end);
    while (curr <= end) {
      dates.push({
        dateStr: curr.toISOString().split('T')[0],
        display: curr.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      });
      curr.setDate(curr.getDate() + 1);
    }
    periodDates.value = dates;
  };

  const promptPeriodeModal = () => {
    editPeriode.value = {
      start: periodeKkn.value.start || '',
      end: periodeKkn.value.end || '',
      password: '',
    };
    periodeError.value = '';
    showPeriodeModal.value = true;
  };

  const savePeriode = async () => {
    if (!editPeriode.value.password || !editPeriode.value.start || !editPeriode.value.end) {
      periodeError.value = 'Semua kolom dan password wajib diisi!';
      return;
    }
    isSavingPeriode.value = true;
    periodeError.value = '';
    try {
      const adminData = JSON.parse(localStorage.getItem('user'));
      const res = await fetch('/api/periode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          adminId: adminData.id,
          password: editPeriode.value.password,
          start_date: editPeriode.value.start,
          end_date: editPeriode.value.end,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showPeriodeModal.value = false;
        await fetchPeriodeKkn();
        generateCalendar();
        generatePeriodDates();
        toastSuccess('Periode KKN berhasil diperbarui!');
      } else {
        periodeError.value = data.message || 'Gagal mengubah periode.';
      }
    } catch {
      periodeError.value = 'Terjadi kesalahan sistem.';
    } finally {
      isSavingPeriode.value = false;
    }
  };

  const openAddAbsenModal = () => {
    newAbsen.value = {
      user_id: '',
      waktu: new Date().toTimeString().split(' ')[0].substring(0, 5),
      status: 'izin',
    };
    absenError.value = '';
    showAbsenModal.value = true;
  };

  const exportAbsensiExcel = async () => {
    if (!absensiData.value || absensiData.value.length === 0) {
      toastWarning('Tidak ada data absensi untuk diekspor.');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Absensi');

    worksheet.columns = [
      { header: 'Waktu', key: 'waktu', width: 15 },
      { header: 'NIM', key: 'nim', width: 20 },
      { header: 'Nama Lengkap', key: 'nama_lengkap', width: 35 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      cell.alignment = { horizontal: 'center' };
    });

    absensiData.value.forEach((absen) => {
      worksheet.addRow({
        waktu: absen.waktu,
        nim: absen.nim,
        nama_lengkap: absen.nama_lengkap,
        status: absen.status.toUpperCase(),
      });
    });

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        if (rowNumber > 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_Absensi_${selectedDate.value}.xlsx`;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  };

  const submitAddAbsen = async () => {
    if (!newAbsen.value.user_id) {
      absenError.value = 'Silakan pilih mahasiswa terlebih dahulu.';
      return;
    }
    isSavingAbsen.value = true;
    absenError.value = '';
    try {
      const payload = {
        user_id: newAbsen.value.user_id,
        tanggal: selectedDate.value,
        waktu: newAbsen.value.waktu + ':00',
        status: newAbsen.value.status,
        alasan: newAbsen.value.alasan,
      };
      const res = await fetch('/api/absensi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        showAbsenModal.value = false;
        fetchAbsensi(selectedDate.value);
      } else {
        absenError.value = data.message;
      }
    } catch {
      absenError.value = 'Gagal menyimpan presensi manual.';
    } finally {
      isSavingAbsen.value = false;
    }
  };

  const closeContextMenu = () => {
    contextMenu.value.show = false;
  };

  const promptEditAbsen = () => {
    const ab = contextMenu.value.absen;
    editAbsenForm.value = {
      id: ab.id,
      waktu: ab.waktu.length > 5 ? ab.waktu.slice(0, 5) : ab.waktu,
      status: ab.status,
      alasan: ab.alasan || ''
    };
    editAbsenError.value = '';
    showEditAbsenModal.value = true;
    closeContextMenu();
  };

  const submitEditAbsen = async () => {
    isEditingAbsen.value = true;
    editAbsenError.value = '';
    try {
      const payload = {
        waktu: editAbsenForm.value.waktu.length === 5 ? editAbsenForm.value.waktu + ':00' : editAbsenForm.value.waktu,
        status: editAbsenForm.value.status,
        alasan: editAbsenForm.value.alasan,
      };
      const res = await fetch(`/api/absensi/${editAbsenForm.value.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        showEditAbsenModal.value = false;
        toastSuccess('Presensi berhasil diperbarui!');
        fetchAbsensi(selectedDate.value);
      } else {
        editAbsenError.value = data.message;
      }
    } catch {
      editAbsenError.value = 'Gagal memperbarui presensi.';
    } finally {
      isEditingAbsen.value = false;
    }
  };

  const promptDeleteAbsen = () => {
    showDeleteAbsenModal.value = true;
    closeContextMenu();
  };

  const confirmDeleteAbsen = async () => {
    isDeletingAbsen.value = true;
    try {
      const res = await fetch(`/api/absensi/${contextMenu.value.absen.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        showDeleteAbsenModal.value = false;
        toastSuccess('Presensi berhasil dihapus!');
        fetchAbsensi(selectedDate.value);
      } else {
        toastWarning('Gagal menghapus presensi.');
      }
    } catch {
      toastWarning('Terjadi kesalahan jaringan.');
    } finally {
      isDeletingAbsen.value = false;
    }
  };

  const init = async () => {
    await fetchPeriodeKkn();
    generateCalendar();
    generatePeriodDates();
    fetchAbsensi(selectedDate.value);
  };

  return {
    periodeKkn,
    selectedDate,
    currentCalendarMonth,
    absensiData,
    absensiLoading,
    showPeriodeModal,
    editPeriode,
    isSavingPeriode,
    periodeError,
    showAbsenModal,
    absensiTableRef,
    newAbsen,
    isSavingAbsen,
    absenError,
    showCetakModal,
    showCetakLogbookModal,
    calendarDays,
    periodDates,
    allMahasiswaList,
    formatDateStr,
    fetchAbsensi,
    fetchPeriodeKkn,
    selectDate,
    changeMonth,
    promptPeriodeModal,
    savePeriode,
    openAddAbsenModal,
    exportAbsensiExcel,
    submitAddAbsen,
    init,
    contextMenu,
    closeContextMenu,
    showEditAbsenModal,
    editAbsenForm,
    isEditingAbsen,
    editAbsenError,
    promptEditAbsen,
    submitEditAbsen,
    showDeleteAbsenModal,
    isDeletingAbsen,
    promptDeleteAbsen,
    confirmDeleteAbsen,
  };
}
