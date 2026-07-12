<script setup>
import { ref } from 'vue';
import SAMapPicker from './SAMapPicker.vue';

/**
 * SAPosko.vue
 * Tab Manajemen Posko di SuperAdmin.
 * Menampilkan tabel daftar posko, modal tambah/edit posko (dengan SAMapPicker),
 * dan fitur hapus posko dengan failsafe GDrive.
 */
const props = defineProps({
  token: { type: String, required: true },
  gdriveConnected: { type: Boolean, default: false },
});
const emit = defineEmits(['data-changed']);

// ─── State ────────────────────────────────────────────────────────────────
const poskoList = ref([]);
const poskoLoading = ref(false);
const showPoskoModal = ref(false);
const editingPosko = ref(null);
const poskoForm = ref({ nama_posko: '', deskripsi: '', lat: -7.0, lng: 110.4, radius: 50, qr_secret: '', jam_masuk: '10:00:00' });
const poskoSaving = ref(false);
const poskoError = ref('');
const deletePoskoLoading = ref(null);

// ─── Fetch ────────────────────────────────────────────────────────────────
const fetchPosko = async () => {
  poskoLoading.value = true;
  try {
    const res = await fetch('/api/superadmin/posko', { headers: { Authorization: `Bearer ${props.token}` } });
    if (res.ok) poskoList.value = await res.json();
  } catch (e) { console.error(e); }
  finally { poskoLoading.value = false; }
};

// Expose untuk dipanggil dari parent (onMounted)
defineExpose({ fetchPosko, poskoList });

// ─── Modal ────────────────────────────────────────────────────────────────
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
      jam_masuk: posko.jam_masuk || '10:00:00',
    };
  } else {
    editingPosko.value = null;
    poskoForm.value = { nama_posko: '', deskripsi: '', lat: -7.0, lng: 110.4, radius: 50, qr_secret: generateQRKey(), jam_masuk: '10:00:00' };
  }
  showPoskoModal.value = true;
};

const closePoskoModal = () => {
  showPoskoModal.value = false;
};

// ─── Save ─────────────────────────────────────────────────────────────────
const savePosko = async () => {
  if (!poskoForm.value.nama_posko) { poskoError.value = 'Nama posko wajib diisi.'; return; }
  poskoSaving.value = true; poskoError.value = '';
  try {
    const url = editingPosko.value ? `/api/superadmin/posko/${editingPosko.value.id}` : '/api/superadmin/posko';
    const method = editingPosko.value ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.token}` },
      body: JSON.stringify(poskoForm.value),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    await fetchPosko();
    emit('data-changed');
    closePoskoModal();
  } catch (e) { poskoError.value = e.message; }
  finally { poskoSaving.value = false; }
};

// ─── Delete ───────────────────────────────────────────────────────────────
const deletePosko = async (posko) => {
  const gdriveNote = props.gdriveConnected
    ? '\n\nFailsafe akan mengirim arsip ke Google Drive Superadmin'
    : '\n\n⚠️ Google Drive Superadmin belum terhubung — failsafe hanya ke Drive Posko (jika ada).';
  if (!confirm(`Hapus posko "${posko.nama_posko}"? Semua admin dan mahasiswa yang terikat akan dilepas.${gdriveNote}\n\nProses failsafe backup bisa memakan waktu beberapa menit.`)) return;

  deletePoskoLoading.value = posko.id;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 900000);

  try {
    const res = await fetch(`/api/superadmin/posko/${posko.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${props.token}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Gagal menghapus posko.');

    let msg = data.message || 'Posko berhasil dihapus.';
    if (data.failsafe) {
      const fs = data.failsafe;
      if (fs.uploaded?.length) msg += `\n\n✅ Failsafe terkirim ke:\n${fs.uploaded.map(u => `• ${u.label}`).join('\n')}`;
      if (fs.failed?.length) msg += `\n\n⚠️ Failsafe gagal ke:\n${fs.failed.map(f => `• ${f.label}: ${f.error}`).join('\n')}`;
      if (fs.skipped?.length && !fs.uploaded?.length) msg += `\n\nℹ️ ${fs.skipped.map(s => s.reason).join(' ')}`;
    }
    alert(msg);
    await fetchPosko();
    emit('data-changed');
  } catch (e) {
    clearTimeout(timeoutId);
    alert(e.name === 'AbortError'
      ? 'Waktu habis — failsafe backup mungkin masih berjalan di server. Cek log backend.'
      : (e.message || 'Gagal menghapus posko.'));
  } finally {
    deletePoskoLoading.value = null;
  }
};
</script>

<template>
  <div class="sa-content">
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

    <!-- Modal Posko -->
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
              <input class="sa-input" v-model="poskoForm.lat" placeholder="-7.0001" />
            </div>
            <div class="sa-form-group">
              <label>Longitude</label>
              <input class="sa-input" v-model="poskoForm.lng" placeholder="110.4001" />
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
            <SAMapPicker
              v-model:lat="poskoForm.lat"
              v-model:lng="poskoForm.lng"
            />
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
  </div>
</template>

<style>
@import '../../assets/sa-shared.css';
</style>
