<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import QrcodeVue from 'qrcode.vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const router = useRouter();
const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

// ─── Navigation ───────────────────────────────────────────────────────────────
const activeTab = ref('overview');
const sidebarCollapsed = ref(false);
const navItems = [
  { id: 'overview', icon: '📊', label: 'Ringkasan' },
  { id: 'posko', icon: '🏠', label: 'Manajemen Posko' },
  { id: 'users', icon: '👥', label: 'Manajemen Pengguna' },
  { id: 'reset', icon: '🔑', label: 'Reset Password' },
  { id: 'absensi', icon: '📋', label: 'Laporan Global' },
];

// ─── Stats ────────────────────────────────────────────────────────────────────
const stats = ref({ totalPosko: 0, totalAdmin: 0, totalMahasiswa: 0, hadirHariIni: 0, poskoStats: [] });
const statsLoading = ref(true);

const fetchStats = async () => {
  statsLoading.value = true;
  try {
    const res = await fetch('/api/superadmin/stats', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) stats.value = await res.json();
  } catch (e) { console.error(e); }
  finally { statsLoading.value = false; }
};

// --- GDrive Failsafe ---
const gdriveStatus = ref({ connected: false });
const fetchGDriveStatus = async () => {
  try {
    const res = await fetch('/api/backup/status', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      gdriveStatus.value.connected = data.connected;
    }
  } catch (e) { console.error('Failed to fetch GDrive status', e); }
};
const connectGDrive = async () => {
  try {
    const res = await fetch('/api/google/auth', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('Eror dari peladen: ' + (data.message || 'URL koneksi tidak ditemukan.'));
    }
  } catch (e) { alert('Gagal menghubungi Google: ' + e.message); }
};

// ─── Posko Management ─────────────────────────────────────────────────────────
const poskoList = ref([]);
const poskoLoading = ref(false);
const showPoskoModal = ref(false);
const editingPosko = ref(null);
const poskoForm = ref({ nama_posko: '', deskripsi: '', lat: '', lng: '', radius: 50, qr_secret: '', jam_masuk: '10:00:00' });
const poskoSaving = ref(false);
const poskoError = ref('');
let mapInstance = null;
let mapMarker = null;

const fetchPosko = async () => {
  poskoLoading.value = true;
  try {
    const res = await fetch('/api/superadmin/posko', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) poskoList.value = await res.json();
  } catch (e) { console.error(e); }
  finally { poskoLoading.value = false; }
};

// --- MAP SEARCH & AUTOCOMPLETE ---
const locationSearchQuery = ref('');
const searchSuggestions = ref([]);
let searchTimeout = null;

const handleSearchInput = async () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  
  const query = locationSearchQuery.value.trim();

  // 1. Google Maps URL Detector
  if (query.startsWith('http://') || query.startsWith('https://')) {
    searchTimeout = setTimeout(async () => {
      try {
        let finalUrl = query;
        if (query.includes('goo.gl') || query.includes('maps.app')) {
           const res = await fetch('/api/resolve-link', {
             method: 'POST',
             headers: {'Content-Type': 'application/json'},
             body: JSON.stringify({ url: query })
           });
           const data = await res.json();
           finalUrl = data.longUrl || query;
        }
        
        const gmMatch =
          finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
          finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
          finalUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
          finalUrl.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
          finalUrl.match(/[?&]query=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
          finalUrl.match(/[?&]sll=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
          finalUrl.match(/[?&]center=(-?\d+\.\d+),(-?\d+\.\d+)/);
        
        if (gmMatch) {
          poskoForm.value.lat = parseFloat(gmMatch[1]);
          poskoForm.value.lng = parseFloat(gmMatch[2]);
          locationSearchQuery.value = `📍 Koordinat GMap: ${gmMatch[1]}, ${gmMatch[2]}`;
          updateMapFromInput();
          if (mapInstance) mapInstance.setView([poskoForm.value.lat, poskoForm.value.lng], 16);
        } else {
          const placenameMatch = finalUrl.match(/\/maps\/place\/([^/@]+)/);
          if (placenameMatch) {
            const placename = decodeURIComponent(placenameMatch[1].replace(/\+/g, ' ').split(',')[0]);
            locationSearchQuery.value = `🔎 Mencari: "${placename}"...`;
            const nomiRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placename)}&limit=1`);
            const nomiData = await nomiRes.json();
            if (nomiData.length > 0) {
              poskoForm.value.lat = parseFloat(nomiData[0].lat);
              poskoForm.value.lng = parseFloat(nomiData[0].lon);
              locationSearchQuery.value = `📍 Ditemukan: ${nomiData[0].display_name.substring(0, 50)}...`;
              updateMapFromInput();
              if (mapInstance) mapInstance.setView([poskoForm.value.lat, poskoForm.value.lng], 16);
            } else {
              locationSearchQuery.value = '❌ Tempat tidak ditemukan.';
            }
          } else {
            locationSearchQuery.value = '❌ Gagal baca koordinat/link GMap.';
          }
        }
      } catch (e) {
        console.error(e);
        locationSearchQuery.value = '❌ Gagal memproses link.';
      }
    }, 500);
    return;
  }

  // 2. Normal Geocoding Autocomplete
  if (query.length < 3) {
    searchSuggestions.value = [];
    return;
  }
  searchTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
      const data = await res.json();
      searchSuggestions.value = data;
    } catch(e) {
      console.error(e);
    }
  }, 500);
};

const selectSuggestion = (s) => {
  poskoForm.value.lat = parseFloat(s.lat);
  poskoForm.value.lng = parseFloat(s.lon);
  locationSearchQuery.value = s.display_name;
  searchSuggestions.value = [];
  updateMapFromInput();
  if (mapInstance) mapInstance.setView([poskoForm.value.lat, poskoForm.value.lng], 15);
};

// GPS Tracking
const isGettingGPS = ref(false);
const useGPS = () => {
  if (!navigator.geolocation) {
    toastError('Browser Anda tidak mendukung GPS.');
    return;
  }
  isGettingGPS.value = true;
  navigator.geolocation.getCurrentPosition((pos) => {
    poskoForm.value.lat = pos.coords.latitude;
    poskoForm.value.lng = pos.coords.longitude;
    locationSearchQuery.value = '📍 Lokasi GPS Anda ditemukan.';
    updateMapFromInput();
    if (mapInstance) mapInstance.setView([poskoForm.value.lat, poskoForm.value.lng], 16);
    isGettingGPS.value = false;
  }, (err) => {
    toastError('Gagal mendapatkan lokasi GPS. Pastikan izin lokasi aktif.');
    isGettingGPS.value = false;
  }, { enableHighAccuracy: true });
};


const generateQRKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = 'KKN_';
  for (let i = 0; i < 8; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  return key;
};

const openPoskoModal = (posko = null) => {
  poskoError.value = '';
  if (posko) {
    editingPosko.value = posko;
    poskoForm.value = {
      nama_posko: posko.nama_posko,
      deskripsi: posko.deskripsi || '',
      lat: posko.lat,
      lng: posko.lng,
      radius: posko.radius,
      qr_secret: posko.qr_secret,
      jam_masuk: posko.jam_masuk || '10:00:00'
    };
  } else {
    editingPosko.value = null;
    poskoForm.value = { nama_posko: '', deskripsi: '', lat: -7.0, lng: 110.4, radius: 50, qr_secret: generateQRKey(), jam_masuk: '10:00:00' };
  }
  showPoskoModal.value = true;
  setTimeout(() => initPoskoMap(), 300);
};

const closePoskoModal = () => {
  showPoskoModal.value = false;
  if (mapInstance) { mapInstance.remove(); mapInstance = null; mapMarker = null; }
};

const initPoskoMap = () => {
  if (mapInstance) { mapInstance.remove(); mapInstance = null; mapMarker = null; }
  const el = document.getElementById('posko-map');
  if (!el) return;
  const lat = parseFloat(poskoForm.value.lat) || -7.0;
  const lng = parseFloat(poskoForm.value.lng) || 110.4;
  mapInstance = L.map('posko-map').setView([lat, lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapInstance);
  mapMarker = L.marker([lat, lng], { draggable: true }).addTo(mapInstance);
  mapMarker.on('dragend', (e) => {
    const pos = e.target.getLatLng();
    poskoForm.value.lat = pos.lat.toFixed(6);
    poskoForm.value.lng = pos.lng.toFixed(6);
  });
  mapInstance.on('click', (e) => {
    poskoForm.value.lat = e.latlng.lat.toFixed(6);
    poskoForm.value.lng = e.latlng.lng.toFixed(6);
    mapMarker.setLatLng(e.latlng);
  });
  
  // Update marker and form when map is moved/panned
  mapInstance.on('moveend', () => {
    const center = mapInstance.getCenter();
    poskoForm.value.lat = center.lat.toFixed(6);
    poskoForm.value.lng = center.lng.toFixed(6);
    mapMarker.setLatLng(center);
  });
};

const updateMapFromInput = () => {
  const lat = parseFloat(poskoForm.value.lat);
  const lng = parseFloat(poskoForm.value.lng);
  if (!isNaN(lat) && !isNaN(lng) && mapInstance && mapMarker) {
    mapInstance.setView([lat, lng], 15);
    mapMarker.setLatLng([lat, lng]);
  }
};

const savePosko = async () => {
  if (!poskoForm.value.nama_posko) { poskoError.value = 'Nama posko wajib diisi.'; return; }
  poskoSaving.value = true; poskoError.value = '';
  try {
    const url = editingPosko.value ? `/api/superadmin/posko/${editingPosko.value.id}` : '/api/superadmin/posko';
    const method = editingPosko.value ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(poskoForm.value)
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    await fetchPosko();
    await fetchStats();
    closePoskoModal();
  } catch (e) { poskoError.value = e.message; }
  finally { poskoSaving.value = false; }
};

const deletePoskoLoading = ref(null);

const deletePosko = async (posko) => {
  const gdriveNote = gdriveStatus.value.connected
    ? '\n\nFailsafe akan mengirim arsip ke Google Drive Superadmin'
    : '\n\n⚠️ Google Drive Superadmin belum terhubung — failsafe hanya ke Drive Posko (jika ada).';
  if (!confirm(`Hapus posko "${posko.nama_posko}"? Semua admin dan mahasiswa yang terikat akan dilepas.${gdriveNote}\n\nProses failsafe backup bisa memakan waktu beberapa menit.`)) return;

  deletePoskoLoading.value = posko.id;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 900000);

  try {
    const res = await fetch(`/api/superadmin/posko/${posko.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Gagal menghapus posko.');

    let msg = data.message || 'Posko berhasil dihapus.';
    if (data.failsafe) {
      const fs = data.failsafe;
      if (fs.uploaded?.length) {
        msg += `\n\n✅ Failsafe terkirim ke:\n${fs.uploaded.map(u => `• ${u.label}`).join('\n')}`;
      }
      if (fs.failed?.length) {
        msg += `\n\n⚠️ Failsafe gagal ke:\n${fs.failed.map(f => `• ${f.label}: ${f.error}`).join('\n')}`;
      }
      if (fs.skipped?.length && !fs.uploaded?.length) {
        msg += `\n\nℹ️ ${fs.skipped.map(s => s.reason).join(' ')}`;
      }
    }
    alert(msg);
    await fetchPosko();
    await fetchStats();
  } catch (e) {
    clearTimeout(timeoutId);
    const errMsg = e.name === 'AbortError'
      ? 'Waktu habis — failsafe backup mungkin masih berjalan di server. Cek log backend.'
      : (e.message || 'Gagal menghapus posko.');
    alert(errMsg);
  } finally {
    deletePoskoLoading.value = null;
  }
};

// ─── User Management ──────────────────────────────────────────────────────────
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

const fetchUsers = async () => {
  userLoading.value = true;
  try {
    const res = await fetch('/api/superadmin/users', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) userList.value = await res.json();
  } catch (e) { console.error(e); }
  finally { userLoading.value = false; }
};

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
      password_confirm: ''
    };
  } else {
    editingUser.value = null;
    userForm.value = { nim: '', nama_lengkap: '', role: 'admin', jabatan: 'Kordes', posko_id: poskoList.value[0]?.id || '', password: '', password_confirm: '' };
  }
  showUserModal.value = true;
};

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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    await fetchUsers();
    await fetchStats();
    showUserModal.value = false;
  } catch (e) { userError.value = e.message; }
  finally { userSaving.value = false; }
};

const deleteUser = async (user) => {
  if (!confirm(`Hapus pengguna "${user.nama_lengkap}" (${user.nim})?`)) return;
  try {
    const res = await fetch(`/api/superadmin/users/${user.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    await fetchUsers();
    await fetchStats();
  } catch (e) { alert('Gagal: ' + e.message); }
};

// ─── Reset Password Management ────────────────────────────────────────────────
const resetRequests = ref([]);
const resetLoading = ref(false);

const fetchResetRequests = async () => {
  resetLoading.value = true;
  try {
    const res = await fetch('/api/superadmin/reset-password-requests', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) resetRequests.value = await res.json();
  } catch (e) { console.error(e); }
  finally { resetLoading.value = false; }
};

const handleResetAction = async (id, action) => {
  if (!confirm(`Anda yakin ingin ${action === 'approve' ? 'menyetujui' : 'menolak'} permintaan ini?`)) return;
  try {
    const res = await fetch(`/api/superadmin/reset-password-requests/${id}/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.message);
    alert(d.message);
    await fetchResetRequests();
  } catch (e) {
    alert('Gagal: ' + e.message);
  }
};

// ─── Global Absensi ───────────────────────────────────────────────────────────
const absensiDate = ref(new Date().toISOString().split('T')[0]);
const absensiPosko = ref('');
const absensiList = ref([]);
const absensiLoading = ref(false);

const fetchAbsensi = async () => {
  absensiLoading.value = true;
  try {
    const params = new URLSearchParams({ tanggal: absensiDate.value });
    if (absensiPosko.value) params.append('posko_id', absensiPosko.value);
    const res = await fetch(`/api/superadmin/absensi?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) absensiList.value = await res.json();
  } catch (e) { console.error(e); }
  finally { absensiLoading.value = false; }
};

// ─── Change Password ──────────────────────────────────────────────────────────
const showPasswordModal = ref(false);
const passwordForm = ref({ old_password: '', new_password: '', confirm_password: '' });
const passwordError = ref('');
const passwordSaving = ref(false);
const passwordSuccess = ref('');

const changePassword = async () => {
  passwordError.value = ''; passwordSuccess.value = '';
  if (!passwordForm.value.old_password || !passwordForm.value.new_password) { passwordError.value = 'Semua field wajib diisi.'; return; }
  if (passwordForm.value.new_password !== passwordForm.value.confirm_password) { passwordError.value = 'Konfirmasi password tidak cocok.'; return; }
  if (passwordForm.value.new_password.length < 6) { passwordError.value = 'Password baru minimal 6 karakter.'; return; }
  passwordSaving.value = true;
  try {
    const res = await fetch('/api/superadmin/profile/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ old_password: passwordForm.value.old_password, new_password: passwordForm.value.new_password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    passwordSuccess.value = 'Password berhasil diperbarui!';
    passwordForm.value = { old_password: '', new_password: '', confirm_password: '' };
  } catch (e) { passwordError.value = e.message; }
  finally { passwordSaving.value = false; }
};

// ─── Lifecycle ────────────────────────────────────────────────────────────────
const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  router.push('/login');
};

onMounted(() => {
  if (Object.keys(currentUser).length === 0 || currentUser.role !== 'superadmin') {
    router.push('/login');
    return;
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('gdrive') === 'success') {
    alert('Google Drive Failsafe berhasil dikaitkan!');
    // Hapus param dari url tanpa refresh
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  fetchStats();
  fetchGDriveStatus();
  fetchPosko();
  fetchUsers();
  fetchResetRequests();
});

const switchTab = async (tab) => {
  activeTab.value = tab;
  if (tab === 'absensi') await fetchAbsensi();
  if (tab === 'reset') await fetchResetRequests();
};

const getStatusBadge = (status) => {
  const map = { hadir: 'badge-success', telat: 'badge-warning', izin: 'badge-info', sakit: 'badge-danger' };
  return map[status] || 'badge-secondary';
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const formatTime = (t) => t ? t.substring(0, 5) : '-';
</script>

<template>
  <div class="sa-app">
    <!-- Sidebar -->
    <aside class="sa-sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sa-sidebar-header">
        <div class="sa-brand" v-if="!sidebarCollapsed">
          <span class="sa-brand-icon">⚡</span>
          <div>
            <div class="sa-brand-title">KKN Control</div>
            <div class="sa-brand-sub">Super Admin Panel</div>
          </div>
        </div>
        <span v-else class="sa-brand-icon-only">⚡</span>
        <button class="sa-collapse-btn" @click="sidebarCollapsed = !sidebarCollapsed" :title="sidebarCollapsed ? 'Expand' : 'Collapse'">
          {{ sidebarCollapsed ? '›' : '‹' }}
        </button>
      </div>

      <nav class="sa-nav">
        <button
          v-for="item in navItems" :key="item.id"
          class="sa-nav-item" :class="{ active: activeTab === item.id }"
          @click="switchTab(item.id)" :title="item.label"
        >
          <span class="sa-nav-icon">{{ item.icon }}</span>
          <span class="sa-nav-label" v-if="!sidebarCollapsed">{{ item.label }}</span>
        </button>
      </nav>

      <div class="sa-sidebar-footer">
        <button class="sa-nav-item" @click="showPasswordModal = true" title="Ganti Password">
          <span class="sa-nav-icon">🔑</span>
          <span class="sa-nav-label" v-if="!sidebarCollapsed">Ganti Password</span>
        </button>
        <button class="sa-nav-item logout" @click="logout" title="Keluar">
          <span class="sa-nav-icon">🚪</span>
          <span class="sa-nav-label" v-if="!sidebarCollapsed">Keluar</span>
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="sa-main">
      <!-- Header -->
      <header class="sa-header">
        <div class="sa-header-left">
          <h1 class="sa-page-title">
            {{ navItems.find(n => n.id === activeTab)?.icon }}
            {{ navItems.find(n => n.id === activeTab)?.label }}
          </h1>
        </div>
        <div class="sa-header-right" style="display:flex; gap:0.5rem; align-items:center;">
          <button class="sa-btn sa-btn-outline sa-btn-sm sa-mobile-only" @click="showPasswordModal = true" title="Ganti Password">🔑</button>
          <div class="sa-user-badge">
            <span class="sa-user-avatar">👑</span>
            <span class="sa-user-name">{{ currentUser.nama_lengkap || 'Superadmin' }}</span>
          </div>
          <button class="sa-btn sa-btn-danger sa-btn-sm sa-mobile-only" @click="logout" title="Keluar">🚪</button>
        </div>
      </header>

      <!-- ─── OVERVIEW TAB ─────────────────────────────────────── -->
      <div v-if="activeTab === 'overview'" class="sa-content">
        <div class="sa-stats-grid">
          <div class="sa-stat-card indigo">
            <div class="sa-stat-icon">🏠</div>
            <div class="sa-stat-body">
              <div class="sa-stat-value">{{ statsLoading ? '—' : stats.totalPosko }}</div>
              <div class="sa-stat-label">Total Posko</div>
            </div>
          </div>
          <div class="sa-stat-card violet">
            <div class="sa-stat-icon">👨‍💼</div>
            <div class="sa-stat-body">
              <div class="sa-stat-value">{{ statsLoading ? '—' : stats.totalAdmin }}</div>
              <div class="sa-stat-label">Admin Posko</div>
            </div>
          </div>
          <div class="sa-stat-card cyan">
            <div class="sa-stat-icon">🎓</div>
            <div class="sa-stat-body">
              <div class="sa-stat-value">{{ statsLoading ? '—' : stats.totalMahasiswa }}</div>
              <div class="sa-stat-label">Mahasiswa</div>
            </div>
          </div>
          <div class="sa-stat-card emerald">
            <div class="sa-stat-icon">✅</div>
            <div class="sa-stat-body">
              <div class="sa-stat-value">{{ statsLoading ? '—' : stats.hadirHariIni }}</div>
              <div class="sa-stat-label">Hadir Hari Ini</div>
            </div>
          </div>
        </div>

        <div class="sa-section">
          <h2 class="sa-section-title">☁️ Keamanan & Failsafe GDrive</h2>
          <div class="sa-card failsafe-card">
            <div class="failsafe-content">
              <div class="failsafe-icon">🛡️</div>
              <div class="failsafe-text">
                <h3>Google Drive Superadmin</h3>
                <p>Tautkan Google Drive Superadmin sebagai failsafe. Saat Posko dihapus, arsip lengkap (JSON, PDF, file) akan dikirim ke <strong>Google Drive Posko (Admin/Kordes)</strong> dan <strong>Google Drive Superadmin</strong> sebelum data dihapus permanen dari server.</p>
              </div>
            </div>
            <div class="failsafe-actions">
              <button v-if="!gdriveStatus.connected" class="sa-btn sa-btn-primary" @click="connectGDrive">
                🔗 Hubungkan Google Drive
              </button>
              <div v-else class="gdrive-connected">
                <span class="status-badge connected">✅ Terkoneksi & Melindungi</span>
                <button class="sa-btn sa-btn-outline" @click="connectGDrive">Ganti Akun</button>
              </div>
            </div>
          </div>
        </div>

        <div class="sa-section">
          <h2 class="sa-section-title">Status Per Posko</h2>
          <div class="sa-posko-overview-grid">
            <div v-if="statsLoading" class="sa-loading-placeholder">Memuat...</div>
            <div v-else-if="stats.poskoStats.length === 0" class="sa-empty-state">
              <p>Belum ada posko. <button class="sa-link-btn" @click="switchTab('posko')">Buat posko pertama →</button></p>
            </div>
            <div v-else v-for="ps in stats.poskoStats" :key="ps.id" class="sa-posko-card">
              <div class="sa-posko-card-header">
                <span class="sa-posko-icon">🏠</span>
                <span class="sa-posko-name">{{ ps.nama_posko }}</span>
              </div>
              <div class="sa-posko-card-stats">
                <div class="sa-ps-item">
                  <span class="sa-ps-val">{{ ps.jumlah_mahasiswa }}</span>
                  <span class="sa-ps-label">Mahasiswa</span>
                </div>
                <div class="sa-ps-divider"></div>
                <div class="sa-ps-item">
                  <span class="sa-ps-val emerald">{{ ps.hadir_hari_ini }}</span>
                  <span class="sa-ps-label">Hadir Hari Ini</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── POSKO TAB ────────────────────────────────────────── -->
      <div v-if="activeTab === 'posko'" class="sa-content">
        <div class="sa-toolbar">
          <h2 class="sa-section-title" style="margin:0">Daftar Posko KKN</h2>
          <button class="sa-btn sa-btn-primary" @click="openPoskoModal()">+ Tambah Posko</button>
        </div>

        <div v-if="poskoLoading" class="sa-loading-placeholder">Memuat data posko...</div>
        <div v-else-if="poskoList.length === 0" class="sa-empty-state">
          <div class="sa-empty-icon">🏠</div>
          <p>Belum ada posko yang dibuat.</p>
          <button class="sa-btn sa-btn-primary" @click="openPoskoModal()">Buat Posko Pertama</button>
        </div>
        <div v-else class="sa-table-container">
          <table class="sa-table">
            <thead>
              <tr>
                <th>Nama Posko</th>
                <th>Koordinat</th>
                <th>Radius</th>
                <th>Jam Masuk</th>
                <th>Admin</th>
                <th>Mahasiswa</th>
                <th>QR Secret</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in poskoList" :key="p.id">
                <td>
                  <div class="sa-table-name">{{ p.nama_posko }}</div>
                  <div class="sa-table-sub">{{ p.deskripsi || '—' }}</div>
                </td>
                <td>
                  <div class="sa-coord">{{ parseFloat(p.lat).toFixed(4) }}</div>
                  <div class="sa-coord">{{ parseFloat(p.lng).toFixed(4) }}</div>
                </td>
                <td>{{ p.radius }}m</td>
                <td>{{ p.jam_masuk?.substring(0,5) || '10:00' }}</td>
                <td><span class="badge badge-violet">{{ p.jumlah_admin }}</span></td>
                <td><span class="badge badge-cyan">{{ p.jumlah_mahasiswa }}</span></td>
                <td><code class="sa-code">{{ p.qr_secret }}</code></td>
                <td>
                  <div class="sa-action-btns">
                    <button class="sa-btn sa-btn-sm sa-btn-outline" @click="openPoskoModal(p)">✏️ Edit</button>
                    <button
                      class="sa-btn sa-btn-sm sa-btn-danger"
                      :disabled="deletePoskoLoading === p.id"
                      @click="deletePosko(p)"
                    >{{ deletePoskoLoading === p.id ? '⏳' : '🗑️' }}</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ─── USERS TAB ────────────────────────────────────────── -->
      <div v-if="activeTab === 'users'" class="sa-content">
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
                <td>
                  <div class="sa-table-name">{{ u.nama_lengkap }}</div>
                </td>
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
      </div>

      <!-- ─── RESET PASSWORD TAB ──────────────────────────────────────── -->
      <div v-if="activeTab === 'reset'" class="sa-content">
        <div class="sa-header-actions">
          <h2>🔑 Permintaan Reset Password</h2>
          <button class="sa-btn" @click="fetchResetRequests">🔄 Segarkan</button>
        </div>

        <div v-if="resetLoading" class="sa-loading-placeholder">Memuat data permintaan...</div>
        <div v-else-if="resetRequests.length === 0" class="sa-empty-state">
          <div class="empty-icon">✨</div>
          <p>Tidak ada permintaan reset password saat ini.</p>
        </div>

        <div v-else class="sa-table-wrapper">
          <table class="sa-table">
            <thead>
              <tr>
                <th>Tanggal Pengajuan</th>
                <th>NIM</th>
                <th>Nama Lengkap</th>
                <th>Role / Posko</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in resetRequests" :key="r.id">
                <td>{{ new Date(r.created_at).toLocaleString('id-ID') }}</td>
                <td><strong>{{ r.nim }}</strong></td>
                <td>{{ r.nama_lengkap }}</td>
                <td>{{ r.role }} <span v-if="r.nama_posko">({{ r.nama_posko }})</span></td>
                <td>
                  <span class="sa-badge" :class="{ 'sa-badge-warning': r.status === 'pending', 'sa-badge-success': r.status === 'approved', 'sa-badge-danger': r.status === 'rejected' }">
                    {{ r.status }}
                  </span>
                </td>
                <td>
                  <div class="sa-action-group" v-if="r.status === 'pending'">
                    <button class="sa-btn-icon success" @click="handleResetAction(r.id, 'approve')" title="Setujui">✔️</button>
                    <button class="sa-btn-icon danger" @click="handleResetAction(r.id, 'reject')" title="Tolak">❌</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="sa-table-footer">Total: {{ resetRequests.length }} permintaan</div>
        </div>
      </div>

      <!-- ─── ABSENSI TAB ──────────────────────────────────────── -->
      <div v-if="activeTab === 'absensi'" class="sa-content">
        <div class="sa-toolbar">
          <h2 class="sa-section-title" style="margin:0">Laporan Kehadiran Global</h2>
        </div>

        <div class="sa-filter-bar">
          <input type="date" class="sa-input" v-model="absensiDate" />
          <select class="sa-select" v-model="absensiPosko">
            <option value="">Semua Posko</option>
            <option v-for="p in poskoList" :key="p.id" :value="p.id">{{ p.nama_posko }}</option>
          </select>
          <button class="sa-btn sa-btn-primary" @click="fetchAbsensi">Tampilkan</button>
        </div>

        <div v-if="absensiLoading" class="sa-loading-placeholder">Memuat data absensi...</div>
        <div v-else-if="absensiList.length === 0" class="sa-empty-state">
          <div class="sa-empty-icon">📋</div>
          <p>Tidak ada data absensi pada tanggal ini.</p>
        </div>
        <div v-else class="sa-table-container">
          <table class="sa-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>NIM</th>
                <th>Posko</th>
                <th>Waktu Absen</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in absensiList" :key="a.id">
                <td><div class="sa-table-name">{{ a.nama_lengkap }}</div></td>
                <td><code class="sa-code">{{ a.nim }}</code></td>
                <td><span class="badge badge-indigo">🏠 {{ a.nama_posko || '—' }}</span></td>
                <td>{{ formatTime(a.waktu) }}</td>
                <td><span class="badge" :class="getStatusBadge(a.status)">{{ a.status }}</span></td>
              </tr>
            </tbody>
          </table>
          <div class="sa-table-footer">Total hadir: {{ absensiList.length }} mahasiswa</div>
        </div>
      </div>
    </main>

    <!-- ─── MODAL: Posko ─────────────────────────────────────────── -->
    <div class="sa-modal-overlay" v-if="showPoskoModal" @click.self="closePoskoModal">
      <div class="sa-modal sa-modal-lg">
        <div class="sa-modal-header">
          <h3>{{ editingPosko ? '✏️ Edit Posko' : '➕ Tambah Posko Baru' }}</h3>
          <button class="sa-modal-close" @click="closePoskoModal">✕</button>
        </div>
        <div class="sa-modal-body">
          <div class="sa-form-grid-2">
            <div class="sa-form-group full-width">
              <label>Nama Posko <span class="required">*</span></label>
              <input class="sa-input" v-model="poskoForm.nama_posko" placeholder="Contoh: Wergu Wetan" />
            </div>
            <div class="sa-form-group full-width">
              <label>Deskripsi</label>
              <input class="sa-input" v-model="poskoForm.deskripsi" placeholder="Deskripsi singkat posko..." />
            </div>
            <div class="sa-form-group">
              <label>Jam Masuk (Batas Tepat Waktu)</label>
              <input type="time" class="sa-input" v-model="poskoForm.jam_masuk" />
            </div>
            <div class="sa-form-group">
              <label>Radius Geofencing (meter)</label>
              <input type="number" class="sa-input" v-model="poskoForm.radius" min="10" max="5000" />
            </div>
            <div class="sa-form-group">
              <label>Latitude</label>
              <input class="sa-input" v-model="poskoForm.lat" @input="updateMapFromInput" placeholder="-7.0001" />
            </div>
            <div class="sa-form-group">
              <label>Longitude</label>
              <input class="sa-input" v-model="poskoForm.lng" @input="updateMapFromInput" placeholder="110.4001" />
            </div>
            <div class="sa-form-group full-width">
              <label>QR Secret</label>
              <div class="sa-input-group">
                <input class="sa-input" v-model="poskoForm.qr_secret" placeholder="KKN_XXXXXXXX" />
                <button class="sa-btn sa-btn-outline" type="button" @click="poskoForm.qr_secret = generateQRKey()">🔄 Generate</button>
              </div>
            </div>
          </div>

          <div class="sa-form-group full-width" style="margin-top:1rem">
            <label>📍 Titik Lokasi Posko (klik peta atau drag marker)</label>
            <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; position: relative;">
              <input type="text" v-model="locationSearchQuery" placeholder="Cari daerah atau tempel link GMap..." @input="handleSearchInput" style="flex-grow: 1; padding: 0.6rem; border-radius: 6px; border: 1px solid var(--color-border); outline:none; font-size:0.9rem;" />
              <button class="sa-btn sa-btn-outline" type="button" @click="useGPS" :disabled="isGettingGPS" style="padding: 0.6rem 1rem;">
                {{ isGettingGPS ? '...' : '🎯 GPS' }}
              </button>
              
              <ul v-if="searchSuggestions.length > 0" class="autocomplete-dropdown">
                <li v-for="s in searchSuggestions" :key="s.place_id" @click="selectSuggestion(s)">
                  {{ s.display_name }}
                </li>
              </ul>
            </div>
            <div id="posko-map" class="sa-map-container"></div>
          </div>

          <div v-if="poskoError" class="sa-alert sa-alert-danger">{{ poskoError }}</div>
        </div>
        <div class="sa-modal-footer">
          <button class="sa-btn sa-btn-outline" @click="closePoskoModal">Batal</button>
          <button class="sa-btn sa-btn-primary" @click="savePosko" :disabled="poskoSaving">
            <span v-if="poskoSaving" class="sa-spinner"></span>
            {{ poskoSaving ? 'Menyimpan...' : (editingPosko ? 'Simpan Perubahan' : 'Buat Posko') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ─── MODAL: User ──────────────────────────────────────────── -->
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

    <!-- ─── MODAL: Change Password ──────────────────────────────── -->
    <div class="sa-modal-overlay" v-if="showPasswordModal" @click.self="showPasswordModal = false; passwordSuccess = ''; passwordError = ''">
      <div class="sa-modal">
        <div class="sa-modal-header">
          <h3>🔑 Ganti Password Superadmin</h3>
          <button class="sa-modal-close" @click="showPasswordModal = false; passwordSuccess = ''; passwordError = ''">✕</button>
        </div>
        <div class="sa-modal-body">
          <div class="sa-form-group">
            <label>Password Lama</label>
            <input type="password" class="sa-input" v-model="passwordForm.old_password" />
          </div>
          <div class="sa-form-group">
            <label>Password Baru</label>
            <input type="password" class="sa-input" v-model="passwordForm.new_password" />
          </div>
          <div class="sa-form-group">
            <label>Konfirmasi Password Baru</label>
            <input type="password" class="sa-input" v-model="passwordForm.confirm_password" />
          </div>
          <div v-if="passwordError" class="sa-alert sa-alert-danger">{{ passwordError }}</div>
          <div v-if="passwordSuccess" class="sa-alert sa-alert-success">{{ passwordSuccess }}</div>
        </div>
        <div class="sa-modal-footer">
          <button class="sa-btn sa-btn-outline" @click="showPasswordModal = false; passwordSuccess = ''; passwordError = ''">Tutup</button>
          <button class="sa-btn sa-btn-primary" @click="changePassword" :disabled="passwordSaving">
            <span v-if="passwordSaving" class="sa-spinner"></span>
            {{ passwordSaving ? 'Menyimpan...' : 'Perbarui Password' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ─── CSS VARIABLES ─────────────────────────────────────── */
:root {
  --sa-bg: #0f172a;
  --sa-surface: #1e293b;
  --sa-surface2: #334155;
  --sa-border: rgba(148,163,184,0.15);
  --sa-text: #f1f5f9;
  --sa-text-muted: #94a3b8;
  --sa-indigo: #6366f1;
  --sa-indigo-light: #818cf8;
  --sa-violet: #8b5cf6;
  --sa-cyan: #06b6d4;
  --sa-emerald: #10b981;
  --sa-red: #ef4444;
  --sa-amber: #f59e0b;
}

/* ─── LAYOUT ────────────────────────────────────────────── */
.sa-app {
  display: flex;
  min-height: 100vh;
  background: #0f172a;
  color: #f1f5f9;
  font-family: 'Inter', 'Segoe UI', sans-serif;
}

/* ─── SIDEBAR ───────────────────────────────────────────── */
.sa-sidebar {
  width: 260px;
  min-height: 100vh;
  background: #0d1424;
  border-right: 1px solid rgba(99,102,241,0.2);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  position: sticky;
  top: 0;
  overflow: hidden;
  z-index: 100;
}

.sa-sidebar.collapsed { width: 72px; }

.sa-sidebar-header {
  padding: 1.5rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(99,102,241,0.15);
}

.sa-brand { display: flex; align-items: center; gap: 0.75rem; }
.sa-brand-icon { font-size: 1.8rem; }
.sa-brand-icon-only { font-size: 1.8rem; display: block; text-align: center; width: 100%; }
.sa-brand-title { font-size: 1rem; font-weight: 700; color: #f1f5f9; }
.sa-brand-sub { font-size: 0.7rem; color: #6366f1; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }

.sa-collapse-btn {
  background: none; border: 1px solid rgba(99,102,241,0.3); color: #94a3b8;
  width: 28px; height: 28px; border-radius: 6px; cursor: pointer;
  font-size: 1.1rem; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s ease; flex-shrink: 0;
}
.sa-collapse-btn:hover { background: rgba(99,102,241,0.2); color: #f1f5f9; }

.sa-nav { flex: 1; padding: 1rem 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; }
.sa-sidebar-footer { padding: 1rem 0.75rem; border-top: 1px solid rgba(99,102,241,0.15); display: flex; flex-direction: column; gap: 0.25rem; }

.sa-nav-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem 1rem; border-radius: 10px; border: none;
  background: transparent; color: #94a3b8; cursor: pointer;
  transition: all 0.2s ease; text-align: left; width: 100%;
  white-space: nowrap; overflow: hidden;
}
.sa-nav-item:hover { background: rgba(99,102,241,0.1); color: #f1f5f9; }
.sa-nav-item.active { background: rgba(99,102,241,0.2); color: #818cf8; font-weight: 600; }
.sa-nav-item.logout:hover { background: rgba(239,68,68,0.1); color: #ef4444; }

.sa-nav-icon { font-size: 1.2rem; flex-shrink: 0; }
.sa-nav-label { font-size: 0.9rem; }

/* ─── MAIN ──────────────────────────────────────────────── */
.sa-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

.sa-header {
  padding: 1.5rem 2rem;
  background: #0d1424;
  border-bottom: 1px solid rgba(99,102,241,0.15);
  display: flex; align-items: center; justify-content: space-between;
  position: sticky; top: 0; z-index: 50;
}

.sa-page-title { font-size: 1.4rem; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 0.5rem; }

.sa-user-badge {
  display: flex; align-items: center; gap: 0.75rem;
  background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2);
  padding: 0.5rem 1rem; border-radius: 30px;
}
.sa-user-avatar { font-size: 1.2rem; }
.sa-user-name { font-size: 0.9rem; font-weight: 600; color: #818cf8; }

.sa-content { flex: 1; padding: 2rem; overflow-y: auto; }

/* ─── STATS GRID ────────────────────────────────────────── */
.sa-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; margin-bottom: 2rem; }

@media (max-width: 1100px) { .sa-stats-grid { grid-template-columns: repeat(2, 1fr); } }

.sa-stat-card {
  background: #1e293b; border-radius: 16px; padding: 1.5rem;
  display: flex; align-items: center; gap: 1rem;
  border: 1px solid rgba(148,163,184,0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.sa-stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 30px rgba(0,0,0,0.3); }

.sa-stat-card.indigo { border-left: 4px solid #6366f1; }
.sa-stat-card.violet { border-left: 4px solid #8b5cf6; }
.sa-stat-card.cyan { border-left: 4px solid #06b6d4; }
.sa-stat-card.emerald { border-left: 4px solid #10b981; }

.sa-stat-icon { font-size: 2rem; }
.sa-stat-value { font-size: 2rem; font-weight: 800; color: #f1f5f9; line-height: 1; }
.sa-stat-label { font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem; }

/* ─── SECTION ───────────────────────────────────────────── */
.sa-section { margin-top: 2rem; }
.sa-section-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 1.25rem; color: #f1f5f9; }

/* ─── POSKO OVERVIEW ────────────────────────────────────── */
.sa-posko-overview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; }

.sa-posko-card {
  background: #1e293b; border-radius: 14px; padding: 1.25rem;
  border: 1px solid rgba(148,163,184,0.1);
  transition: all 0.2s ease;
}
.sa-posko-card:hover { border-color: rgba(99,102,241,0.3); transform: translateY(-2px); }

.sa-posko-card-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
.sa-posko-icon { font-size: 1.5rem; }
.sa-posko-name { font-weight: 700; font-size: 1rem; color: #f1f5f9; }

.sa-posko-card-stats { display: flex; align-items: center; gap: 1rem; }
.sa-ps-item { text-align: center; flex: 1; }
.sa-ps-val { display: block; font-size: 1.5rem; font-weight: 800; color: #818cf8; }
.sa-ps-val.emerald { color: #10b981; }
.sa-ps-label { font-size: 0.75rem; color: #94a3b8; }
.sa-ps-divider { width: 1px; height: 40px; background: rgba(148,163,184,0.2); }

/* ─── TOOLBAR ───────────────────────────────────────────── */
.sa-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }

/* ─── FILTER BAR ────────────────────────────────────────── */
.sa-filter-bar { display: flex; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap; }

/* ─── TABLE ─────────────────────────────────────────────── */
.sa-table-container {
  background: #1e293b; border-radius: 16px;
  border: 1px solid rgba(148,163,184,0.1); overflow: hidden;
}

.sa-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }

.sa-table thead { background: #0d1424; }
.sa-table th {
  padding: 1rem 1.25rem; text-align: left; font-size: 0.75rem;
  font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  color: #94a3b8; white-space: nowrap;
}
.sa-table td { padding: 1rem 1.25rem; border-top: 1px solid rgba(148,163,184,0.08); vertical-align: middle; }
.sa-table tr:hover td { background: rgba(99,102,241,0.05); }

.sa-table-name { font-weight: 600; color: #f1f5f9; }
.sa-table-sub { font-size: 0.8rem; color: #94a3b8; margin-top: 0.2rem; }
.sa-table-footer { padding: 1rem 1.25rem; border-top: 1px solid rgba(148,163,184,0.08); font-size: 0.85rem; color: #94a3b8; }

.sa-coord { font-size: 0.8rem; color: #94a3b8; font-family: monospace; }
.sa-code { background: rgba(99,102,241,0.1); color: #818cf8; padding: 0.25rem 0.5rem; border-radius: 6px; font-family: monospace; font-size: 0.8rem; }
.sa-no-posko { color: #475569; font-style: italic; font-size: 0.85rem; }

.sa-action-btns { display: flex; gap: 0.5rem; align-items: center; }

/* ─── BUTTONS ───────────────────────────────────────────── */
.sa-btn {
  padding: 0.6rem 1.25rem; border-radius: 10px; font-size: 0.9rem; font-weight: 600;
  border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem;
  transition: all 0.2s ease; white-space: nowrap;
}
.sa-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

.sa-btn-primary { background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; box-shadow: 0 4px 15px rgba(99,102,241,0.3); }
.sa-btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(99,102,241,0.5); }

.sa-btn-outline { background: transparent; border: 1.5px solid rgba(148,163,184,0.3); color: #94a3b8; }
.sa-btn-outline:hover:not(:disabled) { border-color: #6366f1; color: #818cf8; }

.sa-btn-danger { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; }
.sa-btn-danger:hover:not(:disabled) { background: rgba(239,68,68,0.25); }

.sa-btn-sm { padding: 0.4rem 0.85rem; font-size: 0.8rem; border-radius: 8px; }

.sa-link-btn { background: none; border: none; color: #818cf8; cursor: pointer; font-size: inherit; text-decoration: underline; }

/* ─── FORM ──────────────────────────────────────────────── */
.sa-form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.sa-form-group { display: flex; flex-direction: column; gap: 0.5rem; }
.sa-form-group.full-width { grid-column: 1 / -1; }

.sa-form-group label { font-size: 0.85rem; font-weight: 600; color: #94a3b8; }
.required { color: #ef4444; }

.sa-input {
  background: #0f172a; border: 1.5px solid rgba(148,163,184,0.2);
  border-radius: 10px; padding: 0.75rem 1rem; color: #f1f5f9;
  font-size: 0.9rem; font-family: inherit; transition: all 0.2s ease; width: 100%;
}
.sa-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
.sa-input:disabled { opacity: 0.5; cursor: not-allowed; }

.sa-select {
  background: #0f172a; border: 1.5px solid rgba(148,163,184,0.2);
  border-radius: 10px; padding: 0.75rem 1rem; color: #f1f5f9;
  font-size: 0.9rem; cursor: pointer; transition: all 0.2s ease;
}
.sa-select:focus { outline: none; border-color: #6366f1; }

.sa-input-group { display: flex; gap: 0.5rem; }
.sa-input-group .sa-input { flex: 1; }

/* ─── MAP ───────────────────────────────────────────────── */
.sa-map-container { height: 300px; border-radius: 12px; overflow: hidden; border: 1.5px solid rgba(148,163,184,0.2); }

/* 🔹 AUTOCOMPLETE DROPDOWN 🔹 */
.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 80px; /* leaves space for GPS button */
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  max-height: 200px;
  overflow-y: auto;
  list-style: none;
  padding: 0;
  margin: 4px 0 0 0;
  z-index: 2000;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.autocomplete-dropdown li {
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}
.autocomplete-dropdown li:hover {
  background: #f8fafc;
  color: #0f172a;
}
.autocomplete-dropdown li:last-child {
  border-bottom: none;
}

/* ─── BADGES ────────────────────────────────────────────── */
.badge {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.3rem 0.7rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600;
}
.badge-indigo { background: rgba(99,102,241,0.15); color: #818cf8; }
.badge-violet { background: rgba(139,92,246,0.15); color: #a78bfa; }
.badge-cyan { background: rgba(6,182,212,0.15); color: #22d3ee; }
.badge-success { background: rgba(16,185,129,0.15); color: #34d399; }
.badge-warning { background: rgba(245,158,11,0.15); color: #fbbf24; }
.badge-info { background: rgba(6,182,212,0.15); color: #22d3ee; }
.badge-danger { background: rgba(239,68,68,0.15); color: #f87171; }

/* ─── MODAL ─────────────────────────────────────────────── */
.sa-modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease;
}

.sa-modal {
  background: #1e293b; border-radius: 20px; width: 100%; max-width: 560px;
  border: 1px solid rgba(99,102,241,0.2); box-shadow: 0 25px 60px rgba(0,0,0,0.5);
  max-height: 90vh; overflow-y: auto; margin: 1rem;
  animation: slideUp 0.3s ease;
}

.sa-modal-lg { max-width: 760px; }

.sa-modal-header {
  padding: 1.5rem 2rem; border-bottom: 1px solid rgba(148,163,184,0.1);
  display: flex; align-items: center; justify-content: space-between;
  position: sticky; top: 0; background: #1e293b; z-index: 1;
}
.sa-modal-header h3 { margin: 0; font-size: 1.15rem; font-weight: 700; }
.sa-modal-close { background: none; border: none; color: #94a3b8; font-size: 1.3rem; cursor: pointer; padding: 0.25rem; }
.sa-modal-close:hover { color: #ef4444; }

.sa-modal-body { padding: 1.5rem 2rem; }
.sa-modal-footer {
  padding: 1.25rem 2rem; border-top: 1px solid rgba(148,163,184,0.1);
  display: flex; justify-content: flex-end; gap: 0.75rem;
  position: sticky; bottom: 0; background: #1e293b;
}

/* ─── ALERTS ────────────────────────────────────────────── */
.sa-alert { padding: 0.85rem 1rem; border-radius: 10px; font-size: 0.9rem; font-weight: 500; margin-top: 0.75rem; }
.sa-alert-danger { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #f87171; }
.sa-alert-success { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: #34d399; }
.sa-alert-info { background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); color: #818cf8; }

/* ─── STATES ────────────────────────────────────────────── */
.sa-loading-placeholder {
  padding: 3rem; text-align: center; color: #94a3b8;
  background: #1e293b; border-radius: 16px; border: 1px solid rgba(148,163,184,0.1);
}

.sa-empty-state {
  padding: 4rem 2rem; text-align: center; color: #94a3b8;
  background: #1e293b; border-radius: 16px; border: 1px dashed rgba(148,163,184,0.2);
}
.sa-empty-icon { font-size: 3rem; margin-bottom: 1rem; display: block; }
.sa-empty-state p { margin: 0 0 1.5rem; }

/* ─── SPINNER ───────────────────────────────────────────── */
.sa-spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white; border-radius: 50%;
  animation: spin 0.8s infinite linear;
}

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

/* ─── RESPONSIVE MOBILE ─────────────────────────────────── */
.sa-mobile-only { display: none; }

@media (max-width: 768px) {
  .sa-mobile-only { display: inline-flex; }
  .sa-user-name { display: none; } /* Hide text, keep emoji badge on small screens */

  .sa-app { padding-bottom: 70px; } /* Room for bottom nav */
  .sa-sidebar {
    position: fixed; bottom: 0; top: auto; left: 0; right: 0;
    width: 100% !important; height: 70px; min-height: 70px;
    flex-direction: row; border-right: none; border-top: 1px solid rgba(99,102,241,0.2);
    z-index: 1000; box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
  }
  .sa-sidebar-header { display: none; }
  .sa-sidebar-footer { display: none; }
  .sa-nav { flex-direction: row; width: 100%; justify-content: space-around; padding: 0; align-items: center; gap: 0; }
  .sa-nav-item { flex-direction: column; gap: 0.2rem; padding: 0.5rem; align-items: center; justify-content: center; border-radius: 0; }
  .sa-nav-label { display: block !important; font-size: 0.65rem; }

  .sa-header { padding: 1rem; flex-direction: row; gap: 0.5rem; flex-wrap: wrap; }
  .sa-page-title { font-size: 1.1rem; }
  .sa-content { padding: 1rem; }

  .sa-stats-grid { grid-template-columns: 1fr; gap: 1rem; margin-bottom: 1rem; }
  .sa-posko-overview-grid { grid-template-columns: 1fr; }
  
  .sa-toolbar { flex-direction: column; align-items: stretch; gap: 0.75rem; text-align: center; }
  .sa-filter-bar { flex-direction: column; gap: 0.5rem; }
  .sa-btn { justify-content: center; }

  .sa-form-grid-2 { grid-template-columns: 1fr; }
  .sa-modal-header, .sa-modal-body, .sa-modal-footer { padding: 1rem; }
  
  .sa-table-container { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .sa-table th, .sa-table td { padding: 0.75rem; }
  
  /* Modal resize for mobile */
  .sa-modal { margin: 0.5rem; max-height: 85vh; }
  /* Failsafe Card Mobile */
  .failsafe-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 1.5rem;
  }
  .failsafe-content {
    max-width: 100%;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
  }
  .failsafe-actions {
    width: 100%;
    justify-content: flex-start;
  }
  .gdrive-connected {
    align-items: flex-start;
  }
}

.failsafe-card { display: flex; justify-content: space-between; align-items: center; padding: 20px; background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 12px; color: white; margin-bottom: 24px; border: 1px solid #334155; }
.failsafe-content { display: flex; align-items: center; gap: 20px; max-width: 70%; }
.failsafe-icon { font-size: 3rem; }
.failsafe-text h3 { margin: 0 0 8px 0; font-size: 1.2rem; color: #f8fafc; }
.failsafe-text p { margin: 0; color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
.failsafe-actions { display: flex; align-items: center; }
.gdrive-connected { display: flex; flex-direction: column; gap: 10px; align-items: flex-end; }
.status-badge.connected { background-color: #10b981; color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 500; }
</style>
