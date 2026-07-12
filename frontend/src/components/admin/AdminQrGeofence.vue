<script setup>
import { onMounted, computed } from 'vue';

const KEY_MIN = 3;
const KEY_MAX = 12;
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
  isGeneratingAnim,
  poskoName,
  customUniqueKey,
  structuredKey,
  generateRandom,
  applyAndSaveQR,
  printQR,
  // QR password
  showQRPasswordModal,
  qrPassword,
  qrPasswordError,
  isVerifyingQRPassword,
  qrPasswordVerified,
  promptQREdit,
  verifyQRPassword,
  lockQREdit,
  // Map/Posko
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

// ─── Key length validation ─────────────────────────────────────────────────
const keyLen = computed(() => customUniqueKey.value.length);
const keyStatus = computed(() => {
  if (keyLen.value === 0) return 'empty';
  if (keyLen.value < KEY_MIN) return 'short';
  if (keyLen.value > KEY_MAX) return 'long';
  return 'ok';
});
const keyIsValid = computed(() => keyStatus.value === 'ok');
const keyBarWidth = computed(() => {
  if (keyLen.value === 0) return '0%';
  return Math.min(100, (keyLen.value / KEY_MAX) * 100) + '%';
});
const keyMessage = computed(() => {
  if (keyStatus.value === 'empty')  return '';
  if (keyStatus.value === 'short')  return `Terlalu pendek — minimal ${KEY_MIN} karakter (sekarang ${keyLen.value})`;
  if (keyStatus.value === 'long')   return `Terlalu panjang — maksimal ${KEY_MAX} karakter (sekarang ${keyLen.value})`;
  return `✓ Panjang kunci valid (${keyLen.value}/${KEY_MAX})`;
});

onMounted(() => {
  init();
});
</script>

<template>
  <div class="top-grid">
    <!-- QR Generator Card -->
    <div class="card qr-card">
      <div class="qr-card-header">
        <div class="qr-title-area">
          <h2>🔲 Barcode Generator</h2>
          <span class="qr-subtitle">Token QR Absensi Posko</span>
        </div>
        <div class="qr-lock-status" :class="qrPasswordVerified ? 'unlocked' : 'locked'">
          <span class="lock-icon">{{ qrPasswordVerified ? '🔓' : '🔒' }}</span>
          <span>{{ qrPasswordVerified ? 'Mode Edit Aktif' : 'Terkunci' }}</span>
        </div>
      </div>

      <!-- QR Display Area -->
      <div class="qr-main-area">
        <div class="qr-visual-wrap">
          <div
            class="qr-display"
            id="qr-print-area"
            :class="{
              'anim-generate': isGeneratingAnim,
              'anim-idle': !isGeneratingAnim && !isRegenerating
            }"
          >
            <!-- Scanning line animation -->
            <div class="qr-scan-line" v-if="isRegenerating"></div>
            <!-- Corner accents -->
            <div class="qr-corner tl"></div>
            <div class="qr-corner tr"></div>
            <div class="qr-corner bl"></div>
            <div class="qr-corner br"></div>

            <qrcode-vue
              :value="qrValue"
              :size="160"
              level="M"
              render-as="svg"
              :class="{ 'qr-blur': isRegenerating }"
            />
          </div>

          <!-- Key display below QR -->
          <div class="qr-key-display">
            <span class="qr-key-text font-mono">{{ qrValue }}</span>
          </div>
        </div>

        <!-- Key Builder -->
        <div class="qr-builder">
          <div class="builder-label">Susun Kode Barcode</div>

          <!-- Part 1: KKN (locked) -->
          <div class="key-parts-row">
            <div class="key-part locked-part">
              <div class="part-label">Prefix</div>
              <div class="part-input locked-input">
                <span class="lock-badge">🔒</span>
                <span class="part-value">KKN</span>
              </div>
            </div>

            <div class="key-sep">_</div>

            <!-- Part 2: Posko Name (locked) -->
            <div class="key-part locked-part flex-2">
              <div class="part-label">Nama Posko</div>
              <div class="part-input locked-input">
                <span class="lock-badge">🔒</span>
                <span class="part-value">{{ (poskoName || 'POSKO').toUpperCase().replace(/\s+/g, '_') }}</span>
              </div>
            </div>

            <div class="key-sep">_</div>

            <!-- Part 3: Unique Key (editable if unlocked) -->
            <div class="key-part flex-2">
              <div class="part-label">
                Kunci Unik
                <span v-if="!qrPasswordVerified" class="part-hint">(terkunci)</span>
              </div>
              <div class="part-input" :class="qrPasswordVerified ? 'editable-input' : 'locked-input'">
                <template v-if="!qrPasswordVerified">
                  <span class="lock-badge">🔒</span>
                  <span class="part-value">{{ customUniqueKey || '——' }}</span>
                </template>
                <template v-else>
                  <input
                    v-model="customUniqueKey"
                    :maxlength="KEY_MAX"
                    placeholder="contoh: 2026"
                    class="unique-key-input"
                    :class="{
                      'input-ok':    keyStatus === 'ok',
                      'input-error': keyStatus === 'short' || keyStatus === 'long'
                    }"
                    @input="customUniqueKey = customUniqueKey.toUpperCase().replace(/[^A-Z0-9]/g, '')"
                    id="qr-unique-key-input"
                    autocomplete="off"
                  />
                  <span class="key-counter" :class="keyStatus">{{ keyLen }}/{{ KEY_MAX }}</span>
                </template>
              </div>
            </div>
          </div>

          <!-- Validation bar + message — OUTSIDE the row, full width -->
          <template v-if="qrPasswordVerified">
            <div class="key-length-bar-wrap">
              <div
                class="key-length-bar"
                :class="keyStatus"
                :style="{ width: keyBarWidth }"
              ></div>
            </div>
            <div v-if="keyMessage" class="key-hint" :class="keyStatus">
              <span v-if="keyStatus === 'short'">⚠️</span>
              <span v-else-if="keyStatus === 'long'">🚫</span>
              <span v-else>✅</span>
              {{ keyMessage }}
            </div>
          </template>

          <!-- Preview of final key -->
          <div class="key-preview">
            <span class="preview-label">Preview:</span>
            <code class="preview-code">{{ structuredKey }}</code>
          </div>

          <!-- Action Buttons -->
          <div class="qr-actions">
            <!-- Locked state -->
            <template v-if="!qrPasswordVerified">
              <button class="btn btn-unlock" @click="promptQREdit" id="btn-unlock-qr">
                <span class="btn-icon">🔓</span>
                Buka & Edit Kunci Unik
              </button>
            </template>

            <!-- Unlocked state -->
            <template v-else>
              <div class="edit-actions">
                <button class="btn btn-random" @click="generateRandom" :disabled="isRegenerating" id="btn-random-key">
                  <span class="btn-icon">🎲</span> Acak
                </button>
                <button
                  class="btn btn-apply"
                  @click="applyAndSaveQR"
                  :disabled="isRegenerating || !keyIsValid"
                  :title="!keyIsValid && keyLen > 0 ? keyMessage : ''"
                  id="btn-apply-qr"
                >
                  <span class="btn-icon" v-if="isRegenerating">⏳</span>
                  <span class="btn-icon" v-else>✅</span>
                  {{ isRegenerating ? 'Menyimpan...' : 'Simpan & Terapkan' }}
                </button>
                <button class="btn btn-lock-again" @click="lockQREdit" :disabled="isRegenerating" id="btn-lock-qr">
                  <span class="btn-icon">🔒</span>
                </button>
              </div>
            </template>
          </div>

          <!-- Print -->
          <div class="qr-print-area">
            <button class="btn btn-print" @click="printQR" id="btn-print-qr">
              <span class="btn-icon">🖨️</span> Cetak QR
            </button>
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

  <!-- ─── QR Password Modal ─────────────────────────────────────────────── -->
  <div class="modal-overlay" v-if="showQRPasswordModal" @click.self="showQRPasswordModal = false">
    <div class="modal-content animate-slide-up" style="max-width: 420px; text-align: center; padding: 2.5rem 2rem;">
      <!-- Animated lock icon -->
      <div class="modal-lock-icon">
        <div class="lock-ring"></div>
        <div class="lock-emoji">🔐</div>
      </div>
      <h3 style="margin-top: 0.75rem; font-family: var(--font-display); color: var(--text-main);">Verifikasi Keamanan QR</h3>
      <p class="text-muted" style="margin-bottom: 1.5rem; font-size: 0.9rem; line-height: 1.6;">
        Mengubah kunci QR akan mempengaruhi semua mahasiswa yang sedang menggunakan barcode lama.<br>
        <strong>Masukkan password Admin untuk melanjutkan.</strong>
      </p>

      <div class="form-group">
        <input
          type="password"
          v-model="qrPassword"
          placeholder="••••••••"
          autocomplete="new-password"
          @keyup.enter="verifyQRPassword"
          style="padding: 1rem; text-align: center; font-size: 1.5rem; letter-spacing: 8px; border-radius: 12px; border: 2px solid var(--color-border); width: 100%; box-sizing: border-box;"
          autofocus
          id="qr-password-input"
        />
      </div>

      <div v-if="qrPasswordError" class="error-msg" style="margin-top: -0.5rem; margin-bottom: 1rem;">
        ⚠️ {{ qrPasswordError }}
      </div>

      <div class="modal-actions" style="margin-top: 1.5rem; display: flex; gap: 1rem;">
        <button
          type="button"
          class="btn btn-outline"
          @click="showQRPasswordModal = false"
          :disabled="isVerifyingQRPassword"
          style="flex: 1; padding: 0.75rem;"
        >
          Batal
        </button>
        <button
          type="button"
          class="btn btn-primary"
          @click="verifyQRPassword"
          :disabled="isVerifyingQRPassword"
          style="flex: 1; padding: 0.75rem;"
          id="btn-verify-qr-password"
        >
          {{ isVerifyingQRPassword ? '⏳ Memverifikasi...' : '🔓 Buka Akses' }}
        </button>
      </div>
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
/* ─── Layout ─────────────────────────────────────────────────────────────── */
.top-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.2s ease;
}

.card:hover {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.card h2 {
  margin-top: 0;
  font-family: var(--font-display);
  color: var(--text-main);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.5rem;
  font-size: 1rem;
}

/* ─── QR Card Header ─────────────────────────────────────────────────────── */
.qr-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.75rem;
  margin-bottom: 1rem;
}

.qr-title-area h2 {
  border-bottom: none;
  padding-bottom: 0;
  margin: 0;
}

.qr-subtitle {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-top: 0.2rem;
  display: block;
}

.qr-lock-status {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.3rem 0.75rem;
  border-radius: 20px;
  transition: all 0.3s ease;
}

.qr-lock-status.locked {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.qr-lock-status.unlocked {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
  border: 1px solid rgba(34, 197, 94, 0.2);
  animation: pulse-green 2s infinite;
}

@keyframes pulse-green {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.3); }
  50% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
}

.lock-icon { font-size: 0.9rem; }

/* ─── QR Main Area ────────────────────────────────────────────────────────── */
.qr-main-area {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

/* ─── QR Visual ──────────────────────────────────────────────────────────── */
.qr-visual-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
}

.qr-display {
  position: relative;
  padding: 1rem;
  background: white;
  border: 2px solid var(--color-border);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: all 0.3s ease;
}

/* Corner accents */
.qr-corner {
  position: absolute;
  width: 14px;
  height: 14px;
  border-color: var(--color-primary, #819A91);
  border-style: solid;
  border-width: 0;
}

.qr-corner.tl { top: 6px; left: 6px; border-top-width: 2.5px; border-left-width: 2.5px; border-radius: 3px 0 0 0; }
.qr-corner.tr { top: 6px; right: 6px; border-top-width: 2.5px; border-right-width: 2.5px; border-radius: 0 3px 0 0; }
.qr-corner.bl { bottom: 6px; left: 6px; border-bottom-width: 2.5px; border-left-width: 2.5px; border-radius: 0 0 0 3px; }
.qr-corner.br { bottom: 6px; right: 6px; border-bottom-width: 2.5px; border-right-width: 2.5px; border-radius: 0 0 3px 0; }

/* Scan line animation */
.qr-scan-line {
  position: absolute;
  left: 10px;
  right: 10px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #819A91, #5fa898, #819A91, transparent);
  border-radius: 2px;
  animation: scanLine 1s ease-in-out infinite;
  z-index: 2;
  box-shadow: 0 0 8px rgba(129, 154, 145, 0.8);
}

@keyframes scanLine {
  0% { top: 10px; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: calc(100% - 14px); opacity: 0; }
}

/* Generate animation */
.anim-generate {
  animation: generateQR 1.2s cubic-bezier(0.23, 1, 0.32, 1);
  border-color: var(--color-primary, #819A91);
  box-shadow: 0 0 0 4px rgba(129, 154, 145, 0.2), 0 0 20px rgba(129, 154, 145, 0.3);
}

@keyframes generateQR {
  0% { transform: scale(1); filter: brightness(1); }
  20% { transform: scale(0.92); filter: brightness(0.5) blur(2px); }
  50% { transform: scale(0.95); filter: brightness(0.3) blur(4px); }
  70% { transform: scale(1.04); filter: brightness(1.2); }
  100% { transform: scale(1); filter: brightness(1); }
}

.qr-blur {
  filter: blur(3px);
  opacity: 0.4;
  transition: filter 0.3s, opacity 0.3s;
}

/* Idle subtle glow on QR */
.anim-idle {
  animation: idleGlow 3s ease-in-out infinite;
}

@keyframes idleGlow {
  0%, 100% { box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  50% { box-shadow: 0 4px 20px rgba(129, 154, 145, 0.15); }
}

/* QR Key display */
.qr-key-display {
  background: linear-gradient(135deg, rgba(129,154,145,0.08), rgba(95,168,152,0.05));
  border: 1px solid rgba(129, 154, 145, 0.2);
  border-radius: 8px;
  padding: 0.4rem 0.6rem;
  max-width: 180px;
  text-align: center;
}

.qr-key-text {
  font-size: 0.65rem;
  color: var(--color-primary, #819A91);
  word-break: break-all;
  letter-spacing: 0.5px;
}

/* ─── Key Builder ─────────────────────────────────────────────────────────── */
.qr-builder {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.builder-label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.key-parts-row {
  display: flex;
  align-items: flex-end;
  gap: 0.35rem;
}

.key-part {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
}

.key-part.flex-2 { flex: 2; }

.part-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.part-hint {
  font-weight: 400;
  font-style: italic;
  text-transform: none;
  color: #ef4444;
}

.part-input {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  min-height: 36px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
  transition: all 0.25s ease;
}

.locked-input {
  background: rgba(0,0,0,0.03);
  border: 1px solid var(--color-border);
  color: var(--text-muted);
}

.editable-input {
  background: rgba(129, 154, 145, 0.06);
  border: 1.5px solid var(--color-primary, #819A91);
  box-shadow: 0 0 0 3px rgba(129, 154, 145, 0.12);
}

.lock-badge {
  font-size: 0.7rem;
  opacity: 0.6;
}

.part-value {
  font-weight: 600;
  letter-spacing: 0.05em;
}

.unique-key-input {
  background: transparent;
  border: none;
  outline: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-main);
  width: 100%;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  flex: 1;
}

.key-sep {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-muted);
  padding-bottom: 0.25rem;
  align-self: flex-end;
  line-height: 36px;
}

/* Input validation color hints */
.unique-key-input.input-ok    { color: #16a34a; }
.unique-key-input.input-error { color: #dc2626; }

/* Character counter badge */
.key-counter {
  font-size: 0.65rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 700;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  white-space: nowrap;
  transition: all 0.2s ease;
  flex-shrink: 0;
}
.key-counter.empty  { color: var(--text-muted); background: transparent; }
.key-counter.short  { color: #b45309; background: rgba(251,191,36,0.12); }
.key-counter.long   { color: #dc2626; background: rgba(220,38,38,0.1); }
.key-counter.ok     { color: #16a34a; background: rgba(34,197,94,0.1); }

/* Progress bar */
.key-length-bar-wrap {
  height: 4px;
  background: rgba(0,0,0,0.07);
  border-radius: 99px;
  overflow: hidden;
  margin-top: 0.3rem;
}
.key-length-bar {
  height: 100%;
  border-radius: 99px;
  transition: width 0.25s ease, background-color 0.25s ease;
}
.key-length-bar.empty  { background: transparent; }
.key-length-bar.short  { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
.key-length-bar.long   { background: #ef4444; }
.key-length-bar.ok     { background: linear-gradient(90deg, #4ade80, #16a34a); }

/* Validation hint message */
.key-hint {
  font-size: 0.74rem;
  font-weight: 500;
  margin-top: 0.35rem;
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  line-height: 1.4;
  transition: all 0.2s ease;
}
.key-hint.short {
  color: #92400e;
  background: rgba(251,191,36,0.1);
  border: 1px solid rgba(251,191,36,0.25);
  animation: shakeHint 0.35s ease;
}
.key-hint.long {
  color: #991b1b;
  background: rgba(220,38,38,0.08);
  border: 1px solid rgba(220,38,38,0.2);
  animation: shakeHint 0.35s ease;
}
.key-hint.ok {
  color: #166534;
  background: rgba(34,197,94,0.08);
  border: 1px solid rgba(34,197,94,0.2);
}

@keyframes shakeHint {
  0%, 100% { transform: translateX(0); }
  25%  { transform: translateX(-3px); }
  75%  { transform: translateX(3px); }
}

/* Key Preview */
.key-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(0,0,0,0.03);
  border-radius: 8px;
  border: 1px dashed var(--color-border);
}

.preview-label {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 600;
  white-space: nowrap;
}

.preview-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
  color: var(--color-primary, #819A91);
  font-weight: 700;
  letter-spacing: 0.05em;
  word-break: break-all;
}

/* ─── Action Buttons ─────────────────────────────────────────────────────── */
.qr-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.edit-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  font-family: var(--font-sans);
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.25s ease;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  padding: 0.6rem 1rem;
  white-space: nowrap;
}

.btn-icon { font-size: 0.9rem; }

.btn-unlock {
  width: 100%;
  background: linear-gradient(135deg, rgba(129,154,145,0.12), rgba(95,168,152,0.08));
  border: 1.5px dashed rgba(129, 154, 145, 0.5);
  color: var(--color-primary, #819A91);
  padding: 0.7rem;
}

.btn-unlock:hover {
  background: linear-gradient(135deg, rgba(129,154,145,0.2), rgba(95,168,152,0.15));
  border-style: solid;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(129, 154, 145, 0.2);
}

.btn-random {
  background: rgba(251, 191, 36, 0.1);
  border: 1.5px solid rgba(251, 191, 36, 0.3);
  color: #b45309;
  padding: 0.6rem 0.75rem;
}

.btn-random:hover:not(:disabled) {
  background: rgba(251, 191, 36, 0.2);
  transform: translateY(-1px);
}

.btn-apply {
  flex: 1;
  background: var(--color-primary, #819A91);
  color: white;
}

.btn-apply:hover:not(:disabled) {
  background: var(--color-primary-hover, #6b8f85);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(129, 154, 145, 0.35);
}

.btn-apply:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-lock-again {
  background: rgba(239, 68, 68, 0.08);
  border: 1.5px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
  padding: 0.6rem 0.8rem;
}

.btn-lock-again:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.15);
  transform: translateY(-1px);
}

.qr-print-area {
  margin-top: auto;
}

.btn-print {
  width: 100%;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--text-muted);
  padding: 0.5rem;
}

.btn-print:hover {
  background: var(--bg-main);
  color: var(--text-main);
}

/* ─── Map Card ────────────────────────────────────────────────────────────── */
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

.mt-2 { margin-top: 0.5rem; }
.mt-3 { margin-top: 1rem; }
.w-100 { width: 100%; }

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

/* ─── Modal ──────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(32, 33, 32, 0.65);
  backdrop-filter: blur(6px);
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
  border-radius: 20px;
  border: 1px solid var(--color-border);
  box-shadow: 0 24px 64px rgba(0,0,0,0.2);
}

.modal-lock-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 70px;
  height: 70px;
}

.lock-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(129, 154, 145, 0.3);
  animation: lockRingPulse 2s ease-in-out infinite;
}

@keyframes lockRingPulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.15); opacity: 0.1; }
}

.lock-emoji {
  font-size: 2.5rem;
  z-index: 1;
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
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.error-msg {
  color: #ef4444;
  margin-bottom: 1rem;
  font-size: 0.88rem;
  background: rgba(239, 68, 68, 0.08);
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.15);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
}

.text-muted { color: var(--text-muted); }
.font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

/* Button variants for modal */
.btn-primary {
  background-color: var(--color-primary);
  color: white;
}
.btn-primary:hover:not(:disabled) {
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
}
.btn-secondary:hover {
  background-color: var(--color-primary-hover);
  color: white;
}

/* Animate slide up */
.animate-slide-up {
  animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(24px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* ─── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .top-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .top-grid {
    grid-template-columns: 1fr;
  }

  .qr-main-area {
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .qr-visual-wrap {
    width: 100%;
    align-items: center;
  }

  .key-parts-row {
    flex-wrap: wrap;
  }

  .key-part {
    min-width: 60px;
  }

  .edit-actions {
    flex-wrap: wrap;
  }

  .btn-apply {
    order: -1;
    width: 100%;
  }
}
</style>
