<script setup>
import { ref, computed } from 'vue';

/**
 * SAUsers.vue
 * Tab Manajemen Pengguna di SuperAdmin Dashboard.
 * Menampilkan tabel pengguna dengan filter, dan modal tambah/edit.
 */
const props = defineProps({
  token: { type: String, required: true },
  poskoList: { type: Array, default: () => [] },
});
const emit = defineEmits(['data-changed']);

// ─── State ────────────────────────────────────────────────────────────────
const userList = ref([]);
const userLoading = ref(false);
const showUserModal = ref(false);
const editingUser = ref(null);
const userForm = ref({ nim: '', nama_lengkap: '', role: 'mahasiswa', jabatan: '', posko_id: '', password: '', password_confirm: '' });
const userSaving = ref(false);
const userError = ref('');
const userSearchQuery = ref('');
const userFilterRole = ref('');
const userFilterPosko = ref('');

const filteredUsers = computed(() => {
  return userList.value.filter(u => {
    const q = userSearchQuery.value.toLowerCase();
    const matchSearch = !q || u.nama_lengkap?.toLowerCase().includes(q) || u.nim?.toLowerCase().includes(q);
    const matchRole = !userFilterRole.value || u.role === userFilterRole.value;
    const matchPosko = !userFilterPosko.value || String(u.posko_id) === String(userFilterPosko.value);
    return matchSearch && matchRole && matchPosko;
  });
});

// ─── Fetch ────────────────────────────────────────────────────────────────
const fetchUsers = async () => {
  userLoading.value = true;
  try {
    const res = await fetch('/api/superadmin/users', { headers: { Authorization: `Bearer ${props.token}` } });
    if (res.ok) userList.value = await res.json();
  } catch (e) { console.error(e); }
  finally { userLoading.value = false; }
};

defineExpose({ fetchUsers });

// ─── Modal ────────────────────────────────────────────────────────────────
const openUserModal = (user = null) => {
  userError.value = '';
  if (user) {
    editingUser.value = user;
    userForm.value = {
      nim: user.nim,
      nama_lengkap: user.nama_lengkap,
      role: user.role,
      jabatan: user.jabatan || '',
      posko_id: user.posko_id || '',
      password: '',
      password_confirm: '',
    };
  } else {
    editingUser.value = null;
    userForm.value = { nim: '', nama_lengkap: '', role: 'admin', jabatan: 'Kordes', posko_id: props.poskoList[0]?.id || '', password: '', password_confirm: '' };
  }
  showUserModal.value = true;
};

// ─── Save ─────────────────────────────────────────────────────────────────
const saveUser = async () => {
  if (!userForm.value.nim || !userForm.value.nama_lengkap) { userError.value = 'NIM dan Nama wajib diisi.'; return; }
  if (!userForm.value.posko_id) { userError.value = 'Posko wajib dipilih.'; return; }
  if (userForm.value.password && userForm.value.password !== userForm.value.password_confirm) { userError.value = 'Konfirmasi password tidak cocok.'; return; }
  userSaving.value = true; userError.value = '';
  try {
    const url = editingUser.value ? `/api/superadmin/users/${editingUser.value.id}` : '/api/superadmin/users';
    const method = editingUser.value ? 'PUT' : 'POST';
    const payload = { ...userForm.value, posko_id: userForm.value.posko_id || null };
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    await fetchUsers();
    emit('data-changed');
    showUserModal.value = false;
  } catch (e) { userError.value = e.message; }
  finally { userSaving.value = false; }
};

// ─── Delete ───────────────────────────────────────────────────────────────
const deleteUser = async (user) => {
  if (!confirm(`Hapus pengguna "${user.nama_lengkap}" (${user.nim})?`)) return;
  try {
    const res = await fetch(`/api/superadmin/users/${user.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${props.token}` } });
    if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    await fetchUsers();
    emit('data-changed');
  } catch (e) { alert('Gagal: ' + e.message); }
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
</script>

<template>
  <div class="sa-content">
    <div class="sa-toolbar">
      <h2 class="sa-section-title" style="margin:0">Manajemen Pengguna</h2>
      <button class="sa-btn sa-btn-primary" @click="openUserModal()" :disabled="poskoList.length === 0" title="Buat posko dulu sebelum menambah pengguna">
        + Tambah Pengguna
      </button>
    </div>

    <!-- Filters -->
    <div class="sa-filter-bar">
      <input class="sa-input" v-model="userSearchQuery" placeholder="🔍 Cari nama / NIM..." />
      <select class="sa-select" v-model="userFilterRole">
        <option value="">Semua Role</option>
        <option value="admin">Admin</option>
        <option value="mahasiswa">Mahasiswa</option>
      </select>
      <select class="sa-select" v-model="userFilterPosko">
        <option value="">Semua Posko</option>
        <option v-for="p in poskoList" :key="p.id" :value="String(p.id)">{{ p.nama_posko }}</option>
      </select>
    </div>

    <div v-if="userLoading" class="sa-loading-placeholder">Memuat data pengguna...</div>
    <div v-else-if="filteredUsers.length === 0" class="sa-empty-state">
      <div class="sa-empty-icon">👥</div>
      <p>Tidak ada pengguna ditemukan.</p>
    </div>
    <div v-else class="sa-table-container">
      <table class="sa-table">
        <thead>
          <tr>
            <th>Nama</th>
            <th>NIM/Username</th>
            <th>Role</th>
            <th>Jabatan</th>
            <th>Posko</th>
            <th>Last Login</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in filteredUsers" :key="u.id">
            <td><div class="sa-table-name">{{ u.nama_lengkap }}</div></td>
            <td><code class="sa-code">{{ u.nim }}</code></td>
            <td>
              <span class="badge" :class="u.role === 'admin' ? 'badge-violet' : 'badge-cyan'">
                {{ u.role === 'admin' ? '👨‍💼 Admin' : '🎓 Mahasiswa' }}
              </span>
            </td>
            <td>{{ u.jabatan || '—' }}</td>
            <td>
              <span class="badge badge-indigo" v-if="u.nama_posko">🏠 {{ u.nama_posko }}</span>
              <span class="sa-no-posko" v-else>—</span>
            </td>
            <td class="sa-table-sub">{{ u.last_login ? formatDate(u.last_login) : 'Belum pernah' }}</td>
            <td>
              <div class="sa-action-btns">
                <button class="sa-btn sa-btn-sm sa-btn-outline" @click="openUserModal(u)">✏️ Edit</button>
                <button class="sa-btn sa-btn-sm sa-btn-danger" @click="deleteUser(u)">🗑️</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="sa-table-footer">Total: {{ filteredUsers.length }} pengguna</div>
    </div>

    <!-- Modal User -->
    <div class="sa-modal-overlay" v-if="showUserModal" @click.self="showUserModal = false">
      <div class="sa-modal">
        <div class="sa-modal-header">
          <h3>{{ editingUser ? '✏️ Edit Pengguna' : '➕ Tambah Pengguna' }}</h3>
          <button class="sa-modal-close" @click="showUserModal = false">✕</button>
        </div>
        <div class="sa-modal-body">
          <div class="sa-form-grid-2">
            <div class="sa-form-group">
              <label>NIM / Username <span class="required">*</span></label>
              <input class="sa-input" v-model="userForm.nim" placeholder="NIM atau username" :disabled="!!editingUser" />
            </div>
            <div class="sa-form-group">
              <label>Nama Lengkap <span class="required">*</span></label>
              <input class="sa-input" v-model="userForm.nama_lengkap" placeholder="Nama lengkap" />
            </div>
            <div class="sa-form-group">
              <label>Jabatan</label>
              <input class="sa-input" v-model="userForm.jabatan" :placeholder="userForm.role === 'admin' ? 'Kordes / Admin Posko' : 'Anggota'" />
            </div>
            <div class="sa-form-group full-width">
              <label>Posko Penugasan <span class="required">*</span></label>
              <select class="sa-select" v-model="userForm.posko_id">
                <option value="" disabled>-- Pilih Posko --</option>
                <option v-for="p in poskoList" :key="p.id" :value="p.id">{{ p.nama_posko }}</option>
              </select>
            </div>
            <div class="sa-form-group full-width">
              <label>Password {{ editingUser ? '(kosongkan jika tidak diubah)' : '' }}</label>
              <input type="password" class="sa-input" v-model="userForm.password" :placeholder="editingUser ? 'Kosongkan jika tidak diubah' : 'Default: NIM pengguna'" />
            </div>
            <div class="sa-form-group full-width" v-if="userForm.password && userForm.password.length > 0">
              <label>Konfirmasi Password <span class="required">*</span></label>
              <input type="password" class="sa-input" v-model="userForm.password_confirm" placeholder="Ulangi password baru" />
            </div>
          </div>
          <div v-if="!editingUser" class="sa-alert sa-alert-info" style="margin-top:1rem">
            💡 Jika password dikosongkan, password default adalah NIM pengguna.
          </div>
          <div v-if="userError" class="sa-alert sa-alert-danger">{{ userError }}</div>
        </div>
        <div class="sa-modal-footer">
          <button class="sa-btn sa-btn-outline" @click="showUserModal = false">Batal</button>
          <button class="sa-btn sa-btn-primary" @click="saveUser" :disabled="userSaving">
            <span v-if="userSaving" class="sa-spinner"></span>
            {{ userSaving ? 'Menyimpan...' : (editingUser ? 'Simpan Perubahan' : 'Buat Pengguna') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@import '../../assets/sa-shared.css';
</style>
