import { ref, computed } from 'vue';
import { useToast, useConfirm } from '../useNotification.js';
import { adminToken, users } from './adminContext.js';

export function useAdminPic(options = {}) {
  const { onRefreshExplorer } = options;
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const { confirm: showConfirm } = useConfirm();

  const picGroups = ref([]);
  const picForm = ref({
    nama_pic: '',
    proker: '',
    selectedMahasiswa: [],
  });
  const isSubmittingPic = ref(false);
  const picError = ref('');
  const editingPic = ref(null);
  const isDeletingPic = ref(null);

  const showMinMaxModal = ref(false);
  const selectedPicForSettings = ref(null);
  const formMinMax = ref({ min_anggota: 2, max_anggota: '' });
  const isSavingMinMax = ref(false);

  const showGlobalMinMaxModal = ref(false);
  const formGlobalMinMax = ref({ default_min_anggota: 2, default_max_anggota: '' });
  const isSavingGlobalMinMax = ref(false);

  const mahasiswaList = computed(() => {
    const allMahasiswa = users.value.filter((u) => u.role === 'mahasiswa' || u.role === 'admin');
    const assignedIds = new Set(
      picGroups.value.flatMap((g) => {
        if (editingPic.value && editingPic.value.id === g.id) return [];
        return g.member_ids || [];
      })
    );
    return allMahasiswa.filter((u) => !assignedIds.has(u.id));
  });

  const fetchPicGroups = async () => {
    try {
      const res = await fetch('/api/pic', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) picGroups.value = await res.json();
    } catch (e) {
      /* ignore */
    }
  };

  const resetPicForm = () => {
    picForm.value = { nama_pic: '', proker: '', selectedMahasiswa: [] };
    editingPic.value = null;
    picError.value = '';
  };

  const startEditPic = (group) => {
    editingPic.value = group;
    picForm.value = {
      nama_pic: group.nama_pic,
      proker: group.proker,
      selectedMahasiswa: [...(group.member_ids || [])],
    };
    picError.value = '';
    document.querySelector('.pic-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const poskoMinAnggota = computed(() => {
    if (picGroups.value.length > 0) return picGroups.value[0].default_min_anggota ?? 2;
    return formGlobalMinMax.value.default_min_anggota ?? 2;
  });

  const poskoMaxAnggota = computed(() => {
    if (picGroups.value.length > 0) return picGroups.value[0].default_max_anggota ?? null;
    return formGlobalMinMax.value.default_max_anggota || null;
  });

  const refreshExplorerIfNeeded = () => {
    if (typeof onRefreshExplorer === 'function') {
      onRefreshExplorer();
    }
  };

  const submitPicForm = async () => {
    const min = poskoMinAnggota.value;
    const max = poskoMaxAnggota.value;
    const len = picForm.value.selectedMahasiswa.length;

    if (len < min || (max && len > max)) {
      picError.value = `Silakan pilih minimal ${min}${max ? ' dan maksimal ' + max : ''} mahasiswa.`;
      return;
    }
    isSubmittingPic.value = true;
    picError.value = '';

    try {
      const isEdit = editingPic.value !== null;
      const url = isEdit ? `/api/pic/${editingPic.value.id}` : '/api/pic';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nama_pic: picForm.value.nama_pic,
          proker: picForm.value.proker,
          mahasiswa_ids: picForm.value.selectedMahasiswa,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        resetPicForm();
        fetchPicGroups();
        refreshExplorerIfNeeded();
        toastSuccess(data.message);
      } else {
        picError.value = data.message;
      }
    } catch (e) {
      picError.value = 'Terjadi kesalahan jaringan saat menyimpan PIC.';
    } finally {
      isSubmittingPic.value = false;
    }
  };

  const openMinMaxSettings = (group) => {
    selectedPicForSettings.value = group;
    formMinMax.value = {
      min_anggota: group.min_anggota ?? group.default_min_anggota ?? 2,
      max_anggota: group.max_anggota || '',
    };
    showMinMaxModal.value = true;
  };

  const openGlobalMinMaxSettings = () => {
    const min = picGroups.value.length > 0 ? (picGroups.value[0].default_min_anggota ?? 2) : 2;
    const max = picGroups.value.length > 0 ? (picGroups.value[0].default_max_anggota || '') : '';
    formGlobalMinMax.value = { default_min_anggota: min, default_max_anggota: max };
    showGlobalMinMaxModal.value = true;
  };

  const saveMinMaxSettings = async () => {
    isSavingMinMax.value = true;
    try {
      const res = await fetch(`/api/pic/${selectedPicForSettings.value.id}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(formMinMax.value),
      });
      const data = await res.json();
      if (res.ok) {
        toastSuccess(data.message);
        showMinMaxModal.value = false;
        fetchPicGroups();
      } else {
        toastError(data.message);
      }
    } catch (error) {
      toastError('Terjadi kesalahan jaringan.');
    } finally {
      isSavingMinMax.value = false;
    }
  };

  const saveGlobalMinMaxSettings = async () => {
    isSavingGlobalMinMax.value = true;
    try {
      const res = await fetch('/api/admin/posko/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(formGlobalMinMax.value),
      });
      const data = await res.json();
      if (res.ok) {
        toastSuccess(data.message);
        showGlobalMinMaxModal.value = false;
        await fetchPicGroups();
      } else {
        toastError(data.message || 'Gagal menyimpan pengaturan posko.');
      }
    } catch (error) {
      toastError('Terjadi kesalahan jaringan saat menyimpan.');
    } finally {
      isSavingGlobalMinMax.value = false;
    }
  };

  const deletePic = async (group) => {
    const confirmed = await showConfirm({
      title: 'Hapus Kelompok PIC?',
      message: `Hapus kelompok "${group.nama_pic}"?\n\nFolder arsipnya akan masuk status EXPIRED dan bisa di-download selama 24 jam sebelum dihapus permanen.`,
      confirmText: '🗑️ Ya, Hapus',
      cancelText: 'Batal',
      type: 'danger',
    });
    if (!confirmed) return;
    isDeletingPic.value = group.id;
    try {
      const res = await fetch(`/api/pic/${group.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (res.ok) toastWarning(data.message, 6000);
      else toastError(data.message);
      fetchPicGroups();
      refreshExplorerIfNeeded();
    } catch (e) {
      toastError('Gagal menghapus PIC.');
    } finally {
      isDeletingPic.value = null;
    }
  };

  return {
    picGroups,
    picForm,
    isSubmittingPic,
    picError,
    editingPic,
    isDeletingPic,
    showMinMaxModal,
    selectedPicForSettings,
    formMinMax,
    isSavingMinMax,
    showGlobalMinMaxModal,
    formGlobalMinMax,
    isSavingGlobalMinMax,
    mahasiswaList,
    fetchPicGroups,
    resetPicForm,
    startEditPic,
    poskoMinAnggota,
    poskoMaxAnggota,
    submitPicForm,
    openMinMaxSettings,
    openGlobalMinMaxSettings,
    saveMinMaxSettings,
    saveGlobalMinMaxSettings,
    deletePic,
  };
}
