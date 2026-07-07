<script setup>
import { useAdminUsers } from '../../composables/admin/useAdminUsers.js';

const {
  users,
  loading,
  searchQuery,
  showAddModal,
  showEditModal,
  newUser,
  editUser,
  actionLoading,
  errorMessage,
  handleSearch,
  openAddModal,
  submitAddUser,
  openEditModal,
  submitEditUser,
} = useAdminUsers();
</script>

<template>
  <div class="table-card">
    <div class="toolbar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          v-model="searchQuery"
          @keyup.enter="handleSearch"
          placeholder="Cari NIM atau Nama..."
        />
        <button @click="handleSearch" class="btn btn-secondary">Cari</button>
      </div>
      <button @click="openAddModal" class="btn btn-primary">+ Tambah Akun</button>
    </div>

    <div class="table-responsive">
      <table class="users-table">
        <thead>
          <tr>
            <th>NIM</th>
            <th>Nama Lengkap</th>
            <th>Role</th>
            <th>Jabatan</th>
            <th>Last Login</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody v-if="loading">
          <tr>
            <td colspan="5" class="text-center py-4">
              <span class="spinner-large" style="display:inline-block;"></span>
            </td>
          </tr>
        </tbody>
        <tbody v-else-if="users.length === 0">
          <tr>
            <td colspan="5" class="text-center py-4 text-muted">Tidak ada data pengguna mahasiswa.</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr v-for="user in users" :key="user.id">
            <td class="font-mono">{{ user.nim }}</td>
            <td class="font-bold">{{ user.nama_lengkap }}</td>
            <td>
              <span class="role-badge" :class="user.role">{{ user.role }}</span>
            </td>
            <td class="font-bold">{{ user.jabatan || 'Anggota' }}</td>
            <td class="text-muted">{{ user.last_login ? new Date(user.last_login).toLocaleString('id-ID') : 'Belum pernah' }}</td>
            <td>
              <button @click="openEditModal(user)" class="btn btn-small btn-edit">Edit</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="modal-overlay" v-if="showAddModal" @click.self="showAddModal = false">
    <div class="modal-content animate-slide-up">
      <h2>Tambah Akun Baru</h2>
      <p class="modal-desc">Password default adalah NIM akun tersebut.</p>

      <form @submit.prevent="submitAddUser">
        <div class="form-group">
          <label>NIM (Username)</label>
          <input type="text" v-model="newUser.nim" required />
        </div>
        <div class="form-group">
          <label>Nama Lengkap</label>
          <input type="text" v-model="newUser.nama_lengkap" required />
        </div>
        <div class="form-group">
          <label>Jabatan</label>
          <select v-model="newUser.jabatan" required>
            <option value="Anggota">Anggota</option>
            <option value="Bendahara">Bendahara</option>
            <option value="Kordes">Kordes</option>
            <option value="Sekretaris">Sekretaris</option>
          </select>
        </div>

        <div v-if="errorMessage" class="error-msg">{{ errorMessage }}</div>

        <div class="modal-actions">
          <button type="button" class="btn btn-outline" @click="showAddModal = false">Batal</button>
          <button type="submit" class="btn btn-primary" :disabled="actionLoading">
            {{ actionLoading ? 'Menyimpan...' : 'Simpan' }}
          </button>
        </div>
      </form>
    </div>
  </div>

  <div class="modal-overlay" v-if="showEditModal" @click.self="showEditModal = false">
    <div class="modal-content animate-slide-up">
      <h2>Edit Akun</h2>

      <form @submit.prevent="submitEditUser">
        <div class="form-group">
          <label>Nama Lengkap</label>
          <input type="text" v-model="editUser.nama_lengkap" required />
        </div>
        <div class="form-group">
          <label>Jabatan</label>
          <select v-model="editUser.jabatan" required>
            <option value="Anggota">Anggota</option>
            <option value="Bendahara">Bendahara</option>
            <option value="Kordes">Kordes</option>
            <option value="Sekretaris">Sekretaris</option>
          </select>
        </div>
        <div class="form-group">
          <label>Password Baru <span class="text-muted" style="font-size:0.8rem">(Kosongkan jika tidak ingin diubah)</span></label>
          <input type="password" v-model="editUser.password" placeholder="Masukkan password baru..." />
        </div>

        <div v-if="errorMessage" class="error-msg">{{ errorMessage }}</div>

        <div class="modal-actions">
          <button type="button" class="btn btn-outline" @click="showEditModal = false">Batal</button>
          <button type="submit" class="btn btn-primary" :disabled="actionLoading">
            {{ actionLoading ? 'Menyimpan...' : 'Simpan' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.table-card {
  background: var(--bg-card);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
  gap: 1rem;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  padding: 0.25rem 0.25rem 0.25rem 1rem;
}

.search-box input {
  background: transparent;
  border: none;
  color: var(--text-main);
  outline: none;
  width: 250px;
}

.table-responsive {
  overflow-x: auto;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.users-table th,
.users-table td {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.users-table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(209, 216, 190, 0.3);
}

.users-table tbody tr:hover {
  background: rgba(209, 216, 190, 0.1);
}

.role-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 99px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: capitalize;
}

.role-badge.mahasiswa {
  background: var(--color-primary);
  color: white;
}

.role-badge.admin {
  background: var(--text-muted);
  color: white;
}

.text-muted {
  color: var(--text-muted);
}

.text-center {
  text-align: center;
}

.py-4 {
  padding-top: 2rem !important;
  padding-bottom: 2rem !important;
}

.font-mono {
  font-family: monospace;
  font-size: 1.05rem;
}

.font-bold {
  font-weight: 600;
  color: var(--text-main);
}

.btn-small {
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  border-radius: 6px;
}

.btn-edit {
  background: var(--bg-main);
  color: var(--text-main);
  border: 1px solid var(--color-border);
}

.btn-edit:hover {
  background: var(--color-border);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(32, 33, 32, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-card);
  width: 100%;
  max-width: 450px;
  padding: 2.5rem;
  border-radius: 16px;
  border: 1px solid var(--color-border);
}

.modal-content h2 {
  margin: 0 0 0.5rem 0;
  font-family: var(--font-display);
  color: var(--text-main);
}

.modal-desc {
  color: var(--text-main);
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
  background: var(--bg-main);
  padding: 0.75rem;
  border-radius: 8px;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-main);
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--bg-card);
  color: var(--text-main);
  font-family: var(--font-sans);
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.error-msg {
  color: #ef4444;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
}

.animate-slide-up {
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
