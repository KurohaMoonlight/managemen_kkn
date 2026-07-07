<script setup>
import { ref, provide } from 'vue';
import { useRouter } from 'vue-router';
import { adminToken, currentAdminUser, users } from '../composables/admin/adminContext.js';
import { poskoData } from '../composables/admin/useAdminGeofence.js';
import AdminQrGeofence from '../components/admin/AdminQrGeofence.vue';
import AdminUserManagement from '../components/admin/AdminUserManagement.vue';
import AdminAbsensiSection from '../components/admin/AdminAbsensiSection.vue';
import AdminPicSection from '../components/admin/AdminPicSection.vue';
import AdminGdriveBackup from '../components/admin/AdminGdriveBackup.vue';
import AdminFileExplorer from '../components/admin/AdminFileExplorer.vue';
import BukuTamuAdmin from '../components/BukuTamuAdmin.vue';
import '../components/admin/admin-shared.css';

const router = useRouter();
const explorerRef = ref(null);

const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  router.push('/login');
};

const refreshExplorer = () => {
  explorerRef.value?.fetchDirectory?.({ id: null, nama_folder: 'Beranda' });
};

provide('onRefreshExplorer', refreshExplorer);
</script>

<template>
  <div class="admin-dashboard dashboard-wrapper">
    <header class="navbar">
      <div class="nav-content">
        <div class="logo-area">
          <div class="logo-icon">🎓</div>
          <div class="logo-text">
            <span class="logo-title">Sistem Management KKN</span>
            <span v-if="currentAdminUser.nama_posko" class="posko-badge">🏠 {{ currentAdminUser.nama_posko }}</span>
          </div>
        </div>
        <div class="nav-actions">
          <router-link to="/mahasiswa" class="btn btn-outline" style="margin-right: 10px;">Ke Dashboard Mahasiswa</router-link>
          <button type="button" @click="logout" class="btn btn-outline nav-logout">Logout</button>
        </div>
      </div>
    </header>

    <main class="dashboard-main">
      <div class="container animate-fade-in">
        <div class="page-header">
          <div>
            <h1>Admin Dashboard</h1>
            <p>Mengelola Posko: <strong>{{ currentAdminUser.nama_posko || '—' }}</strong></p>
          </div>
        </div>

        <AdminQrGeofence />
        <AdminUserManagement />

        <BukuTamuAdmin
          :token="adminToken"
          :users="users"
          :posko-data="{
            nama_posko: currentAdminUser.nama_posko,
            nama_desa: poskoData?.desa,
            kecamatan: '....',
            kabupaten: '....',
            lat: poskoData?.lat,
            lng: poskoData?.lng
          }"
        />

        <AdminAbsensiSection />
        <AdminPicSection @refresh-explorer="refreshExplorer" />
        <AdminGdriveBackup />
        <AdminFileExplorer ref="explorerRef" />
      </div>
    </main>
  </div>
</template>

<style scoped>
.posko-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: rgba(129, 154, 145, 0.15);
  border: 1px solid rgba(129, 154, 145, 0.3);
  color: #819A91;
  padding: 0.2rem 0.7rem;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 600;
  margin-left: 0.75rem;
}
</style>
