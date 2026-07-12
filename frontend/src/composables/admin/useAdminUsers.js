import { ref, onMounted } from 'vue';
import { users, adminToken, fetchUsers } from './adminContext.js';

export function useAdminUsers() {
  const loading = ref(true);
  const searchQuery = ref('');
  const showAddModal = ref(false);
  const showEditModal = ref(false);
  const showDeleteModal = ref(false);
  const newUser = ref({ nim: '', nama_lengkap: '', role: 'mahasiswa', jabatan: 'Anggota' });
  const editUser = ref({ id: null, nama_lengkap: '', role: '', jabatan: '', password: '' });
  const deleteTarget = ref({ id: null, nim: '', nama_lengkap: '' });
  const deleteForm = ref({ nim_konfirmasi: '', password: '' });
  const actionLoading = ref(false);
  const errorMessage = ref('');
  const deleteError = ref('');

  const loadUsers = async () => {
    loading.value = true;
    try {
      await fetchUsers(searchQuery.value);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      loading.value = false;
    }
  };

  const handleSearch = () => {
    loadUsers();
  };

  const openAddModal = () => {
    newUser.value = { nim: '', nama_lengkap: '', role: 'mahasiswa', jabatan: 'Anggota' };
    errorMessage.value = '';
    showAddModal.value = true;
  };

  const submitAddUser = async () => {
    actionLoading.value = true;
    errorMessage.value = '';
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(newUser.value),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Gagal menambah user');

      showAddModal.value = false;
      loadUsers();
    } catch (error) {
      errorMessage.value = error.message;
    } finally {
      actionLoading.value = false;
    }
  };

  const openEditModal = (user) => {
    editUser.value = {
      id: user.id,
      nama_lengkap: user.nama_lengkap,
      role: user.role,
      jabatan: user.jabatan,
      password: '',
    };
    errorMessage.value = '';
    showEditModal.value = true;
  };

  const submitEditUser = async () => {
    actionLoading.value = true;
    errorMessage.value = '';
    try {
      const payload = {
        nama_lengkap: editUser.value.nama_lengkap,
        role: editUser.value.role,
        jabatan: editUser.value.jabatan,
      };
      if (editUser.value.password) {
        payload.password = editUser.value.password;
      }

      const res = await fetch(`/api/users/${editUser.value.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Gagal mengubah user');

      showEditModal.value = false;
      loadUsers();
    } catch (error) {
      errorMessage.value = error.message;
    } finally {
      actionLoading.value = false;
    }
  };

  // ─── Delete User ────────────────────────────────────────────────────────────
  const openDeleteModal = (user) => {
    deleteTarget.value = { id: user.id, nim: user.nim, nama_lengkap: user.nama_lengkap };
    deleteForm.value = { nim_konfirmasi: '', password: '' };
    deleteError.value = '';
    showDeleteModal.value = true;
  };

  const submitDeleteUser = async () => {
    if (!deleteForm.value.nim_konfirmasi || !deleteForm.value.password) {
      deleteError.value = 'NIM konfirmasi dan password wajib diisi.';
      return;
    }
    actionLoading.value = true;
    deleteError.value = '';
    try {
      const res = await fetch(`/api/users/${deleteTarget.value.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nim_konfirmasi: deleteForm.value.nim_konfirmasi,
          password: deleteForm.value.password,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Gagal menghapus user');

      showDeleteModal.value = false;
      loadUsers();
    } catch (error) {
      deleteError.value = error.message;
    } finally {
      actionLoading.value = false;
    }
  };

  onMounted(loadUsers);

  return {
    users,
    loading,
    searchQuery,
    showAddModal,
    showEditModal,
    showDeleteModal,
    newUser,
    editUser,
    deleteTarget,
    deleteForm,
    deleteError,
    actionLoading,
    errorMessage,
    loadUsers,
    handleSearch,
    openAddModal,
    submitAddUser,
    openEditModal,
    submitEditUser,
    openDeleteModal,
    submitDeleteUser,
  };
}
