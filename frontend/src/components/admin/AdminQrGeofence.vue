<script setup>
import { onMounted } from 'vue';
import QrcodeVue from 'qrcode.vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAdminGeofence } from '../../composables/admin/useAdminGeofence.js';

// Fix for Leaflet default marker icon in Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const {
  qrValue,
  isRegenerating,
  regenerateQR,
  printQR,
  poskoLat,
  poskoLng,
  poskoRadius,
  poskoLastUpdated,
  isEditingPosko,
  locationSearchQuery,
  searchSuggestions,
  handleSearchInput,
  selectSuggestion,
  isGettingGPS,
  useGPS,
  showPasswordModal,
  adminPassword,
  passwordError,
  isVerifyingPassword,
  promptUnlockSettings,
  verifyAndUnlock,
  savePoskoSettings,
  updateMapVisuals,
  init,
} = useAdminGeofence();

onMounted(() => {
  init();
});
</script>

<template>
  <div class="top-grid">
    <!-- QR Generator Card -->
    <div class="card qr-card">
      <h2>QR Code Generator</h2>
      <div class="qr-content">
        <div class="qr-display" id="qr-print-area" :class="{ 'spin-anim': isRegenerating }">
          <qrcode-vue :value="qrValue" :size="150" level="M" render-as="svg" />
        </div>
        <div class="qr-controls">
          <div class="qr-info">
            <p class="text-muted" style="margin-top: 0; font-size: 0.9rem;">
              Generate token unik untuk absensi. Token ini tersimpan di dalam QR Code secara otomatis.
            </p>
            <div class="qr-key-box font-mono">{{ qrValue }}</div>
          </div>
          <div class="qr-buttons">
            <button class="btn btn-primary" @click="regenerateQR">Regenerate</button>
            <button class="btn btn-outline" @click="printQR">Print</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Map Card -->
    <div class="card map-card" style="display:flex; flex-direction: column; overflow: hidden; position: relative;">
      <h2>Validasi Lokasi (Geofencing)</h2>
      <div class="map-controls">
        <div v-if="!isEditingPosko" class="locked-mode">
          <div class="status-badge">
            <span class="icon">🔒</span> Terkunci & Aktif
          </div>
          <button class="btn btn-outline w-100 mt-2" @click="promptUnlockSettings" style="width: 100%;">
            🔒 Buka & Ubah Pengaturan Posko
          </button>
          <div class="posko-info mt-3">
            <p><strong>Pusat GPS:</strong> {{ poskoLat.toFixed(5) }}, {{ poskoLng.toFixed(5) }}</p>
            <p><strong>Radius Aktif:</strong> {{ poskoRadius }} meter</p>
            <p class="text-muted" style="margin-top: 0.5rem; font-size: 0.8rem;" v-if="poskoLastUpdated">
              🗓️ Diperbarui pada: {{ new Date(poskoLastUpdated).toLocaleString('id-ID') }}
            </p>
          </div>
        </div>
        <div v-else class="edit-mode-box">
          <p class="edit-instruction">📍 Klik pada peta untuk memindahkan titik posko.</p>

          <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; position: relative;">
            <input
              type="text"
              v-model="locationSearchQuery"
              placeholder="Cari daerah..."
              @input="handleSearchInput"
              style="flex-grow: 1; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--color-border); outline:none;"
            />
            <button class="btn btn-secondary" @click="useGPS" :disabled="isGettingGPS" style="padding: 0.5rem 1rem;">
              {{ isGettingGPS ? '...' : '📍 GPS' }}
            </button>

            <ul v-if="searchSuggestions.length > 0" class="autocomplete-dropdown">
              <li v-for="s in searchSuggestions" :key="s.place_id" @click="selectSuggestion(s)">
                {{ s.display_name }}
              </li>
            </ul>
          </div>

          <div class="slider-group">
            <label>Atur Radius: <strong>{{ poskoRadius }} m</strong></label>
            <input
              type="range"
              v-model.number="poskoRadius"
              min="10"
              max="500"
              step="10"
              @input="updateMapVisuals"
              class="radius-slider"
            />
          </div>

          <div style="display: flex; gap: 0.5rem;" class="mt-2">
            <button class="btn btn-outline" style="flex: 1;" @click="isEditingPosko = false">Batal</button>
            <button class="btn btn-primary" style="flex: 2;" @click="savePoskoSettings">Simpan ke Server</button>
          </div>
        </div>
      </div>
      <div
        id="posko-map"
        class="map-container"
        :class="{ editing: isEditingPosko }"
        style="position: relative; z-index: 1; min-height: 300px; width: 100%; overflow: hidden; border-radius: 8px;"
      ></div>
    </div>
  </div>

  <!-- Geofence Password Verification Modal -->
  <div class="modal-overlay" v-if="showPasswordModal" @click.self="showPasswordModal = false">
    <div class="modal-content animate-slide-up" style="max-width: 400px; text-align: center; padding: 2.5rem 2rem;">
      <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔒</div>
      <h3 style="margin-top: 0; font-family: var(--font-display); color: var(--text-main);">Verifikasi Keamanan</h3>
      <p class="text-muted" style="margin-bottom: 1.5rem; font-size: 0.95rem; line-height: 1.5;">
        Pengaturan Geofencing bersifat krusial. Masukkan password Admin untuk mengunci lokasi.
      </p>

      <div class="form-group">
        <input
          type="password"
          v-model="adminPassword"
          placeholder="••••••••"
          autocomplete="new-password"
          @keyup.enter="verifyAndUnlock"
          style="padding: 1rem; text-align: center; font-size: 1.5rem; letter-spacing: 8px; border-radius: 12px; border: 2px solid var(--color-border);"
          autofocus
        />
      </div>

      <div v-if="passwordError" class="error-msg" style="margin-top: -0.5rem; margin-bottom: 1rem;">{{ passwordError }}</div>

      <div class="modal-actions" style="margin-top: 1.5rem; display: flex; gap: 1rem;">
        <button
          type="button"
          class="btn btn-outline"
          @click="showPasswordModal = false"
          :disabled="isVerifyingPassword"
          style="flex: 1; padding: 0.75rem;"
        >
          Batal
        </button>
        <button
          type="button"
          class="btn btn-primary"
          @click="verifyAndUnlock"
          :disabled="isVerifyingPassword"
          style="flex: 1; padding: 0.75rem;"
        >
          {{ isVerifyingPassword ? '...' : 'Buka Kunci' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.top-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.card h2 {
  margin-top: 0;
  font-family: var(--font-display);
  color: var(--text-main);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.5rem;
}

.map-card {
  display: flex;
  flex-direction: column;
}

.map-controls {
  margin: 1rem 0;
}

.posko-info {
  background: var(--bg-main);
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.9rem;
}

.posko-info p {
  margin: 0.25rem 0;
}

.status-badge {
  display: inline-block;
  background-color: #e6f4ea;
  color: #1e8e3e;
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  border: 1px solid #ceead6;
}

.edit-mode-box {
  background: rgba(129, 154, 145, 0.1);
  border: 1px solid var(--color-primary);
  padding: 1rem;
  border-radius: 8px;
}

.edit-instruction {
  color: var(--color-primary);
  font-weight: 600;
  margin-top: 0;
  font-size: 0.9rem;
}

.slider-group {
  margin: 1rem 0;
}

.slider-group label {
  display: block;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.radius-slider {
  width: 100%;
  accent-color: var(--color-primary);
}

.mt-2 {
  margin-top: 0.5rem;
}

.mt-3 {
  margin-top: 1rem;
}

.w-100 {
  width: 100%;
}

.map-container {
  flex-grow: 1;
  min-height: 250px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  position: relative;
  z-index: 1;
  overflow: hidden;
}

.map-container.editing {
  cursor: crosshair;
  border: 2px solid var(--color-primary);
}

.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  list-style: none;
  padding: 0;
  margin: 0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.autocomplete-dropdown li {
  padding: 0.75rem;
  font-size: 0.85rem;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  color: var(--text-main);
}

.autocomplete-dropdown li:hover {
  background: rgba(129, 154, 145, 0.2);
}

.autocomplete-dropdown li:last-child {
  border-bottom: none;
}

.qr-content {
  display: flex;
  gap: 1.5rem;
  margin-top: 1rem;
}

.qr-display {
  padding: 1rem;
  background: white;
  border: 2px solid var(--color-border);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spin-anim {
  animation: spinQR 1s ease-in-out;
}

@keyframes spinQR {
  0% {
    transform: scale(1) rotate(0deg);
  }
  50% {
    transform: scale(0.9) rotate(180deg);
  }
  100% {
    transform: scale(1) rotate(360deg);
  }
}

.qr-controls {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1rem;
}

.qr-key-box {
  background: var(--bg-main);
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--color-primary);
  word-break: break-all;
  margin-bottom: 0.5rem;
}

.qr-buttons {
  display: flex;
  gap: 0.5rem;
}

.text-muted {
  color: var(--text-muted);
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.btn {
  font-family: var(--font-sans);
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
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

.btn-outline:hover {
  background: var(--color-primary);
  color: white;
}

.btn-secondary {
  background-color: var(--color-border);
  color: var(--text-main);
}

.btn-secondary:hover {
  background-color: var(--color-primary-hover);
  color: white;
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

.form-group {
  margin-bottom: 1.25rem;
}

.form-group input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--bg-card);
  color: var(--text-main);
  font-family: var(--font-sans);
}

.form-group input:focus {
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

@media (max-width: 900px) {
  .top-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .top-grid {
    grid-template-columns: 1fr;
  }

  .qr-content {
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .qr-display {
    width: 100%;
    box-sizing: border-box;
  }

  .qr-controls {
    width: 100%;
    box-sizing: border-box;
  }

  .qr-key-box {
    width: 100%;
    box-sizing: border-box;
    word-break: break-all;
  }

  .qr-buttons {
    flex-direction: column;
    width: 100%;
  }

  .qr-buttons button {
    width: 100%;
  }
}
</style>
