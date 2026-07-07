import { ref, onMounted } from 'vue';
import { users, adminToken, fetchUsers } from './adminContext.js';

export function useAdminUsers() {
  const loading = ref(true);
  const searchQuery = ref('');
  const showAddModal = ref(false);
  const showEditModal = ref(false);
  const newUser = ref({ nim: '', nama_lengkap: '', role: 'mahasiswa', jabatan: 'Anggota' });
  const editUser = ref({ id: null, nama_lengkap: '', role: '', jabatan: '', password: '' });
  const actionLoading = ref(false);
  const errorMessage = ref('');

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

  onMounted(loadUsers);

  return {
    users,
    loading,
    searchQuery,
    showAddModal,
    showEditModal,
    newUser,
    editUser,
    actionLoading,
    errorMessage,
    loadUsers,
    handleSearch,
    openAddModal,
    submitAddUser,
    openEditModal,
    submitEditUser,
  };
}
