<script setup>
import { useAdminUsers } from '../../composables/admin/useAdminUsers.js';

const {
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
  handleSearch,
  openAddModal,
  submitAddUser,
  openEditModal,
  submitEditUser,
  openDeleteModal,
  submitDeleteUser,
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
            <td colspan="6" class="text-center py-4">
              <span class="spinner-large" style="display:inline-block;"></span>
            </td>
          </tr>
        </tbody>
        <tbody v-else-if="users.length === 0">
          <tr>
            <td colspan="6" class="text-center py-4 text-muted">Tidak ada data pengguna mahasiswa.</td>
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
              <div class="action-btns">
                <button @click="openEditModal(user)" class="btn btn-small btn-edit" :id="`btn-edit-${user.id}`">Edit</button>
                <button @click="openDeleteModal(user)" class="btn btn-small btn-delete" :id="`btn-delete-${user.id}`">Hapus</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Add Modal -->
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
            <option value="PDD">PDD (Dokumentasi)</option>
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

  <!-- Edit Modal -->
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
            <option value="PDD">PDD (Dokumentasi)</option>
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

  <!-- Delete Confirmation Modal -->
  <div class="modal-overlay" v-if="showDeleteModal" @click.self="showDeleteModal = false">
    <div class="modal-content animate-slide-up modal-danger">
      <!-- Danger header -->
      <div class="delete-header">
        <div class="danger-icon-wrap">
          <div class="danger-ring"></div>
          <span class="danger-emoji">🗑️</span>
        </div>
        <h2>Hapus Akun Mahasiswa</h2>
        <p class="delete-desc">
          Anda akan menghapus akun <strong>{{ deleteTarget.nama_lengkap }}</strong>
          secara permanen. Tindakan ini tidak dapat dibatalkan.
        </p>
      </div>

      <!-- Target info -->
      <div class="delete-target-info">
        <div class="target-row">
          <span class="target-label">Nama</span>
          <span class="target-val">{{ deleteTarget.nama_lengkap }}</span>
        </div>
        <div class="target-row">
          <span class="target-label">NIM</span>
          <code class="target-nim">{{ deleteTarget.nim }}</code>
        </div>
      </div>

      <!-- Confirmation form -->
      <div class="delete-form">
        <div class="form-group">
          <label class="confirm-label">
            Ketik NIM <code class="inline-nim">{{ deleteTarget.nim }}</code> untuk konfirmasi
          </label>
          <input
            type="text"
            v-model="deleteForm.nim_konfirmasi"
            :placeholder="deleteTarget.nim"
            autocomplete="off"
            id="delete-nim-confirm"
            :class="{ 'input-match': deleteForm.nim_konfirmasi === deleteTarget.nim && deleteForm.nim_konfirmasi !== '' }"
          />
          <span v-if="deleteForm.nim_konfirmasi && deleteForm.nim_konfirmasi === deleteTarget.nim" class="match-badge">✓ Cocok</span>
          <span v-else-if="deleteForm.nim_konfirmasi && deleteForm.nim_konfirmasi !== deleteTarget.nim" class="nomatch-badge">✗ Tidak cocok</span>
        </div>

        <div class="form-group">
          <label class="confirm-label">Password Admin untuk otorisasi</label>
          <input
            type="password"
            v-model="deleteForm.password"
            placeholder="••••••••"
            autocomplete="new-password"
            id="delete-admin-password"
          />
        </div>
      </div>

      <div v-if="deleteError" class="delete-error-msg">
        ⚠️ {{ deleteError }}
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-outline" @click="showDeleteModal = false" :disabled="actionLoading">
          Batal
        </button>
        <button
          type="button"
          class="btn btn-danger"
          @click="submitDeleteUser"
          :disabled="actionLoading || deleteForm.nim_konfirmasi !== deleteTarget.nim || !deleteForm.password"
          id="btn-confirm-delete"
        >
          <span v-if="actionLoading">⏳ Menghapus...</span>
          <span v-else>🗑️ Ya, Hapus Permanen</span>
        </button>
      </div>
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
  flex: 1;
  max-width: 100%;
  min-width: 200px;
}

.search-box input {
  background: transparent;
  border: none;
  color: var(--text-main);
  outline: none;
  flex: 1;
  min-width: 0;
  width: 100%;
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

/* Action buttons */
.action-btns {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.btn-small {
  padding: 0.35rem 0.7rem;
  font-size: 0.82rem;
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

.btn-delete {
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.2);
  font-weight: 600;
}

.btn-delete:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
}

/* ─── Shared modal ─────────────────────────────────────────────── */
.text-muted { color: var(--text-muted); }
.text-center { text-align: center; }
.py-4 { padding-top: 2rem !important; padding-bottom: 2rem !important; }
.font-mono { font-family: monospace; font-size: 1.05rem; }
.font-bold { font-weight: 600; color: var(--text-main); }

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
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
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
  position: relative;
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
  box-sizing: border-box;
  transition: border-color 0.2s;
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
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ─── Delete Modal specific ───────────────────────────────────── */
.modal-danger {
  border-color: rgba(239, 68, 68, 0.25);
  max-width: 460px;
}

.delete-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.danger-icon-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: 0.75rem;
}

.danger-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(239, 68, 68, 0.25);
  animation: dangerPulse 2s ease-in-out infinite;
}

@keyframes dangerPulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 0.1; }
}

.danger-emoji {
  font-size: 2.2rem;
  z-index: 1;
}

.delete-header h2 {
  color: #dc2626;
  margin: 0 0 0.5rem 0;
}

.delete-desc {
  font-size: 0.9rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
}

/* Target info box */
.delete-target-info {
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: 10px;
  padding: 0.85rem 1rem;
  margin-bottom: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.target-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
}

.target-label {
  color: var(--text-muted);
  font-weight: 600;
  min-width: 45px;
}

.target-val {
  font-weight: 600;
  color: var(--text-main);
}

.target-nim {
  font-family: ui-monospace, monospace;
  font-size: 0.88rem;
  color: #dc2626;
  background: rgba(239,68,68,0.07);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

/* Confirm form */
.delete-form {
  margin-bottom: 0;
}

.confirm-label {
  font-size: 0.85rem !important;
  line-height: 1.4;
}

.inline-nim {
  font-family: ui-monospace, monospace;
  background: rgba(239,68,68,0.08);
  color: #dc2626;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-size: 0.85rem;
}

/* NIM match/no-match feedback */
.form-group input.input-match {
  border-color: #16a34a;
  background: rgba(34,197,94,0.04);
}

.match-badge {
  display: block;
  font-size: 0.75rem;
  color: #16a34a;
  font-weight: 600;
  margin-top: 0.3rem;
}

.nomatch-badge {
  display: block;
  font-size: 0.75rem;
  color: #dc2626;
  font-weight: 600;
  margin-top: 0.3rem;
}

/* Delete error */
.delete-error-msg {
  font-size: 0.85rem;
  color: #991b1b;
  background: rgba(220,38,38,0.08);
  border: 1px solid rgba(220,38,38,0.2);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
}

/* Danger button */
.btn-danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
  border: none;
  transition: all 0.2s;
}

.btn-danger:hover:not(:disabled) {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  box-shadow: 0 4px 12px rgba(220,38,38,0.35);
  transform: translateY(-1px);
}

.btn-danger:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

/* Shared btn styles */
.btn {
  font-family: var(--font-sans);
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.25s ease;
  border: none;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--color-primary-hover);
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
}

.btn-outline:hover:not(:disabled) {
  background: var(--color-primary);
  color: white;
}

.btn-secondary {
  background-color: var(--color-border);
  color: var(--text-main);
  padding: 0.5rem 1rem;
  border-radius: 6px;
}

.btn-secondary:hover {
  background-color: var(--color-primary-hover);
  color: white;
}
</style>
