<template>
  <div class="maintenance-page" @mousemove="onMove" @mouseup="onRelease" @touchmove.prevent="onMove" @touchend="onRelease" @touchcancel="onRelease">

    <!-- Panel Listrik Utama -->
    <div class="fuse-panel">
      <div class="panel-header">
        <div class="panel-label">⚡ ELECTRICAL PANEL</div>
        <div class="status-light" :class="{ active: allConnected }"></div>
      </div>

      <div class="panel-body">
        <!-- Soket (kanan panel) -->
        <div class="sockets-col">
          <div class="socket-group-label">OUTPUT</div>
          <div
            v-for="socket in sockets"
            :key="socket.id"
            class="socket"
            :class="{ connected: socket.connected, [`socket-${socket.color}`]: true }"
            :ref="el => { if (el) socketRefs[socket.id] = el }"
          >
            <div class="socket-hole">
              <div class="socket-inner" :class="{ glow: socket.connected }"></div>
            </div>
            <div class="socket-label">{{ socket.label }}</div>
          </div>
        </div>

        <!-- Tengah panel: kabel yang sudah tersambung -->
        <div class="wires-area">
          <svg class="wires-svg" ref="wiresSvgRef" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;">
            <!-- Kabel yang sudah terhubung -->
            <path
              v-for="wire in connectedWires"
              :key="'connected-' + wire.id"
              :d="wire.path"
              :stroke="wire.color"
              stroke-width="5"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
              filter="url(#glow)"
            />
            <!-- Kabel yang sedang didrag -->
            <path
              v-if="dragging"
              :d="draggingPath"
              :stroke="dragging.color"
              stroke-width="5"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-dasharray="8 4"
              opacity="0.8"
            />
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
          </svg>
        </div>

        <!-- Kabel sumber (kiri panel) -->
        <div class="cables-col">
          <div class="cable-group-label">INPUT</div>
          <div
            v-for="cable in cables"
            :key="cable.id"
            class="cable-plug"
            :class="{ connected: cable.connected, [`cable-${cable.color}`]: true, dragging: dragging?.id === cable.id }"
            :ref="el => { if (el) cableRefs[cable.id] = el }"
            @mousedown.prevent="startDrag(cable, $event)"
            @touchstart.prevent="startDrag(cable, $event)"
          >
            <div class="cable-end"></div>
            <div class="cable-label">{{ cable.colorLabel }}</div>
          </div>
        </div>
      </div>

      <!-- Indikator status panel -->
      <div class="panel-footer">
        <div class="breaker" v-for="i in 4" :key="i" :class="{ tripped: !allConnected && i <= 2 }"></div>
      </div>
    </div>

    <!-- Konten maintenance -->
    <div class="maintenance-content">
      <div class="maintenance-icon">🔧</div>
      <h1 class="maintenance-title">Sistem Sedang Dalam Perbaikan</h1>
      <p class="maintenance-message">{{ message }}</p>
      <div class="maintenance-dots">
        <span></span><span></span><span></span>
      </div>
    </div>

    <!-- Modal Login Rahasia -->
    <Transition name="modal-pop">
      <div v-if="showSecretLogin" class="secret-modal-overlay" @click.self="closeModal">
        <div class="secret-modal">
          <div class="modal-icon">⚡</div>
          <h2>Sistem Terhubung</h2>
          <p class="modal-sub">Panel aktif. Masukkan kredensial untuk override maintenance.</p>
          <form @submit.prevent="handleLogin">
            <input type="text" v-model="username" placeholder="Username" autocomplete="username" required />
            <input type="password" v-model="password" placeholder="Password" autocomplete="current-password" required />
            <button type="submit" :disabled="isLoading">{{ isLoading ? 'Mengautentikasi...' : 'Override & Masuk' }}</button>
          </form>
          <p v-if="loginError" class="error-msg">⚠ {{ loginError }}</p>
          <button class="close-btn" @click="closeModal">Batalkan</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';

// ─── PESAN MAINTENANCE ────────────────────────────────────────────────────────
const message = ref('Kami sedang melakukan perbaikan sistem. Silakan kembali lagi dalam beberapa saat.');

// ─── DEFINISI KABEL & SOKET ───────────────────────────────────────────────────
// Kabel di kiri, soket di kanan. Harus disambungkan berdasarkan warna.
const cables = reactive([
  { id: 'c1', color: '#ef4444', colorLabel: 'L1', connected: false },
  { id: 'c2', color: '#3b82f6', colorLabel: 'L2', connected: false },
  { id: 'c3', color: '#f59e0b', colorLabel: 'N',  connected: false },
]);

const sockets = reactive([
  { id: 's1', color: '#ef4444', label: 'R', connected: false, cableId: null },
  { id: 's2', color: '#3b82f6', label: 'B', connected: false, cableId: null },
  { id: 's3', color: '#f59e0b', label: 'Y', connected: false, cableId: null },
]);

// Mapping kabel -> soket yang benar
const correctMap = { c1: 's1', c2: 's2', c3: 's3' };

// ─── REFS ─────────────────────────────────────────────────────────────────────
const cableRefs = reactive({});
const socketRefs = reactive({});
const wiresSvgRef = ref(null);

// ─── DRAG STATE ───────────────────────────────────────────────────────────────
const dragging = ref(null);
const pointerX = ref(0);
const pointerY = ref(0);

// ─── CONNECTED WIRES (untuk render SVG path) ─────────────────────────────────
const connectedWires = reactive([]);

// ─── PATH KABEL SAAT DRAG ─────────────────────────────────────────────────────
const draggingPath = computed(() => {
  if (!dragging.value || !wiresSvgRef.value) return '';
  const svgRect = wiresSvgRef.value.getBoundingClientRect();
  const cableEl = cableRefs[dragging.value.id];
  if (!cableEl) return '';
  const cableRect = cableEl.getBoundingClientRect();

  // Titik awal = ujung kanan kabel (sisi panel)
  const x1 = cableRect.right - svgRect.left;
  const y1 = cableRect.top + cableRect.height / 2 - svgRect.top;

  // Titik akhir = pointer
  const x2 = pointerX.value - svgRect.left;
  const y2 = pointerY.value - svgRect.top;

  // Bezier curve agar terlihat seperti kabel yang lemas
  const cx1 = x1 + (x2 - x1) * 0.4;
  const cy1 = y1 + 30; // turun sedikit (efek berat kabel)
  const cx2 = x1 + (x2 - x1) * 0.6;
  const cy2 = y2 + 30;

  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
});

// ─── DRAG HANDLERS ────────────────────────────────────────────────────────────
const startDrag = (cable, e) => {
  if (cable.connected) {
    // Lepaskan kabel yang sudah tersambung
    disconnectCable(cable.id);
  }
  dragging.value = { ...cable };
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  pointerX.value = clientX;
  pointerY.value = clientY;
};

const onMove = (e) => {
  if (!dragging.value) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  pointerX.value = clientX;
  pointerY.value = clientY;
};

const onRelease = (e) => {
  if (!dragging.value) return;

  // Cek apakah dilepas di atas soket yang tepat
  const clientX = e.changedTouches ? e.changedTouches[0].clientX : pointerX.value;
  const clientY = e.changedTouches ? e.changedTouches[0].clientY : pointerY.value;

  let connected = false;
  for (const socket of sockets) {
    if (socket.connected) continue; // soket sudah terpakai
    const socketEl = socketRefs[socket.id];
    if (!socketEl) continue;
    const rect = socketEl.getBoundingClientRect();
    const margin = 20;
    if (
      clientX >= rect.left - margin &&
      clientX <= rect.right + margin &&
      clientY >= rect.top - margin &&
      clientY <= rect.bottom + margin
    ) {
      // Cocokkan warna
      if (correctMap[dragging.value.id] === socket.id) {
        connectCable(dragging.value.id, socket.id);
        connected = true;
      } else {
        // Warna salah — efek shake
        socketEl.classList.add('wrong-socket');
        setTimeout(() => socketEl.classList.remove('wrong-socket'), 500);
      }
      break;
    }
  }

  dragging.value = null;
};

// ─── CONNECT / DISCONNECT ─────────────────────────────────────────────────────
const connectCable = (cableId, socketId) => {
  const cable = cables.find(c => c.id === cableId);
  const socket = sockets.find(s => s.id === socketId);
  if (!cable || !socket) return;

  cable.connected = true;
  socket.connected = true;
  socket.cableId = cableId;

  // Tambahkan path kabel yang sudah terhubung ke SVG
  nextTick(() => {
    const svgEl = wiresSvgRef.value;
    const cableEl = cableRefs[cableId];
    const socketEl = socketRefs[socketId];
    if (!svgEl || !cableEl || !socketEl) return;

    const svgRect = svgEl.getBoundingClientRect();
    const cableRect = cableEl.getBoundingClientRect();
    const socketRect = socketEl.getBoundingClientRect();

    const x1 = cableRect.right - svgRect.left;
    const y1 = cableRect.top + cableRect.height / 2 - svgRect.top;
    const x2 = socketRect.left - svgRect.left;
    const y2 = socketRect.top + socketRect.height / 2 - svgRect.top;

    const cy = Math.max(y1, y2) + 25;
    const path = `M ${x1} ${y1} C ${x1 + 60} ${cy}, ${x2 - 60} ${cy}, ${x2} ${y2}`;

    connectedWires.push({ id: cableId, color: cable.color, path });
  });
};

const disconnectCable = (cableId) => {
  const cable = cables.find(c => c.id === cableId);
  const socket = sockets.find(s => s.cableId === cableId);
  if (cable) cable.connected = false;
  if (socket) { socket.connected = false; socket.cableId = null; }
  const idx = connectedWires.findIndex(w => w.id === cableId);
  if (idx !== -1) connectedWires.splice(idx, 1);
};

// ─── CEK APAKAH SEMUA TERSAMBUNG ─────────────────────────────────────────────
const allConnected = computed(() => cables.every(c => c.connected));

let panelSolvedTimer = null;
const showSecretLogin = ref(false);

// Watch allConnected — muncul modal setelah semua kabel tersambung
const checkWin = () => {
  if (allConnected.value) {
    clearTimeout(panelSolvedTimer);
    panelSolvedTimer = setTimeout(() => {
      showSecretLogin.value = true;
    }, 800); // jeda singkat supaya user lihat efek "panel nyala"
  }
};

// Perlu watch manual karena kita pakai reactive biasa
// Kita cek setiap kali connectedWires berubah
const connectedWiresProxy = computed(() => connectedWires.length);

import { watch } from 'vue';
watch(connectedWiresProxy, () => checkWin());

// ─── SECRET LOGIN ─────────────────────────────────────────────────────────────
const username = ref('');
const password = ref('');
const isLoading = ref(false);
const loginError = ref('');

const closeModal = () => {
  showSecretLogin.value = false;
  username.value = '';
  password.value = '';
  loginError.value = '';
  // Reset kabel
  cables.forEach(c => c.connected = false);
  sockets.forEach(s => { s.connected = false; s.cableId = null; });
  connectedWires.splice(0, connectedWires.length);
};

const handleLogin = async () => {
  isLoading.value = true;
  loginError.value = '';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nim: username.value, password: password.value, is_override_login: true }),
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('maintenance_bypassed', 'true');
      const map = { superadmin: '/superadmin', admin: '/admin', mahasiswa: '/mahasiswa' };
      window.location.href = map[data.user.role] || '/';
    } else {
      const data = await res.json();
      loginError.value = data.message || 'Login gagal.';
    }
  } catch {
    loginError.value = 'Terjadi kesalahan jaringan.';
  } finally {
    isLoading.value = false;
  }
};

// ─── LIFECYCLE ────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const res = await fetch('/api/maintenance');
    const data = await res.json();
    if (data.message) message.value = data.message;
  } catch {}
});

onUnmounted(() => clearTimeout(panelSolvedTimer));
</script>

<style scoped>
/* ─── GLOBAL ─────────────────────────────────────────────────────────────── */
.maintenance-page {
  min-height: 100vh;
  background: #0f172a;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  font-family: 'Inter', 'Segoe UI', sans-serif;
  color: #e2e8f0;
  user-select: none;
  gap: 2.5rem;
  overflow: hidden;
  position: relative;
}

/* Efek grid latar ala blueprint */
.maintenance-page::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(30, 58, 138, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(30, 58, 138, 0.07) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}

/* ─── PANEL LISTRIK ──────────────────────────────────────────────────────── */
.fuse-panel {
  background: #1e293b;
  border: 2px solid #334155;
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  box-shadow:
    0 0 0 1px #0f172a,
    0 20px 60px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255,255,255,0.05);
  overflow: visible;
  position: relative;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.25rem;
  background: #0f172a;
  border-bottom: 2px solid #334155;
  border-radius: 14px 14px 0 0;
}

.panel-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #64748b;
}

.status-light {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 6px #ef4444;
  transition: all 0.5s;
}

.status-light.active {
  background: #22c55e;
  box-shadow: 0 0 12px #22c55e, 0 0 24px rgba(34, 197, 94, 0.4);
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ─── PANEL BODY ─────────────────────────────────────────────────────────── */
.panel-body {
  display: flex;
  align-items: stretch;
  padding: 1.5rem;
  gap: 0;
  position: relative;
  min-height: 180px;
}

.wires-area {
  flex: 1;
  position: relative;
  min-height: 150px;
}

/* ─── KABEL (kiri) ───────────────────────────────────────────────────────── */
.cables-col {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: flex-start;
  z-index: 10;
  padding-right: 0.5rem;
}

.cable-group-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #475569;
  margin-bottom: -0.5rem;
}

.cable-plug {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: grab;
  transition: transform 0.15s, filter 0.15s;
  touch-action: none;
}

.cable-plug:hover { transform: scale(1.08); filter: brightness(1.2); }
.cable-plug:active, .cable-plug.dragging { cursor: grabbing; transform: scale(1.12); }

.cable-plug.connected {
  opacity: 0.4;
  cursor: default;
  pointer-events: none;
}

.cable-end {
  width: 32px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid rgba(255,255,255,0.15);
  position: relative;
  box-shadow: inset 0 -2px 4px rgba(0,0,0,0.3);
}

.cable-c1 .cable-end, .cable-c1.socket-\#ef4444 .socket-hole { background: #ef4444; }
.cable-c2 .cable-end { background: #3b82f6; }
.cable-c3 .cable-end { background: #f59e0b; }

.cable-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.08em;
}

/* ─── SOKET (kanan) ──────────────────────────────────────────────────────── */
.sockets-col {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: flex-end;
  z-index: 10;
  padding-left: 0.5rem;
}

.socket-group-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #475569;
  margin-bottom: -0.5rem;
}

.socket {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-direction: row-reverse;
  transition: transform 0.2s;
}

.socket.connected { transform: scale(1.1); }

.socket-hole {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #0f172a;
  border: 3px solid #334155;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.3s;
}

.socket.connected .socket-hole {
  border-color: v-bind('socket.color');
}

.socket-\#ef4444 .socket-hole { border-color: rgba(239, 68, 68, 0.4); }
.socket-\#3b82f6 .socket-hole { border-color: rgba(59, 130, 246, 0.4); }
.socket-\#f59e0b .socket-hole { border-color: rgba(245, 158, 11, 0.4); }

.socket-inner {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #1e293b;
  transition: all 0.4s;
}

.socket-inner.glow {
  background: white;
  box-shadow: 0 0 8px white;
}

.socket-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.08em;
}

/* Tiap soket punya warna accent */
.socket-\#ef4444.connected .socket-hole { border-color: #ef4444; box-shadow: 0 0 8px rgba(239,68,68,0.4); }
.socket-\#3b82f6.connected .socket-hole { border-color: #3b82f6; box-shadow: 0 0 8px rgba(59,130,246,0.4); }
.socket-\#f59e0b.connected .socket-hole { border-color: #f59e0b; box-shadow: 0 0 8px rgba(245,158,11,0.4); }

/* Animasi shake saat kabel salah warna */
.wrong-socket {
  animation: wrong-shake 0.4s ease-out;
}

@keyframes wrong-shake {
  0%   { transform: translateX(0); }
  20%  { transform: translateX(-5px) rotate(-2deg); }
  40%  { transform: translateX(5px) rotate(2deg); }
  60%  { transform: translateX(-4px); }
  80%  { transform: translateX(3px); }
  100% { transform: translateX(0); }
}

/* ─── PANEL FOOTER (breaker) ─────────────────────────────────────────────── */
.panel-footer {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: #0f172a;
  border-top: 2px solid #334155;
  border-radius: 0 0 14px 14px;
}

.breaker {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: #334155;
  transition: background 0.4s;
}

.breaker.tripped {
  background: #ef4444;
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.5);
}

/* ─── KONTEN MAINTENANCE ─────────────────────────────────────────────────── */
.maintenance-content {
  text-align: center;
  max-width: 440px;
}

.maintenance-icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
  animation: spin-slow 4s linear infinite;
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.maintenance-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #f1f5f9;
  margin-bottom: 0.75rem;
  line-height: 1.2;
}

.maintenance-message {
  font-size: 1rem;
  color: #94a3b8;
  line-height: 1.65;
  margin-bottom: 1.25rem;
}

.maintenance-dots {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}

.maintenance-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #475569;
  animation: dot-pulse 1.4s ease-in-out infinite;
}

.maintenance-dots span:nth-child(2) { animation-delay: 0.2s; }
.maintenance-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes dot-pulse {
  0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* ─── MODAL ──────────────────────────────────────────────────────────────── */
.secret-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.secret-modal {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 20px;
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 380px;
  text-align: center;
  box-shadow: 0 25px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04);
}

.modal-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.secret-modal h2 {
  font-size: 1.35rem;
  font-weight: 700;
  color: #22c55e;
  margin: 0 0 0.4rem;
}

.modal-sub {
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 1.5rem;
}

.secret-modal form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.secret-modal input {
  padding: 0.85rem 1rem;
  border-radius: 10px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.secret-modal input:focus {
  border-color: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
}

.secret-modal button[type='submit'] {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  border: none;
  padding: 0.9rem;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  margin-top: 0.25rem;
  transition: opacity 0.2s, transform 0.15s;
}

.secret-modal button[type='submit']:hover { opacity: 0.92; transform: translateY(-1px); }
.secret-modal button[type='submit']:disabled { background: #334155; cursor: not-allowed; transform: none; }

.close-btn {
  background: transparent;
  color: #475569;
  border: none;
  width: 100%;
  padding: 0.65rem;
  margin-top: 0.75rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.close-btn:hover { color: #94a3b8; }

.error-msg {
  color: #f87171;
  font-size: 0.85rem;
  margin-top: 0.75rem;
}

/* ─── TRANSITION ─────────────────────────────────────────────────────────── */
.modal-pop-enter-active { animation: pop-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
.modal-pop-leave-active { animation: pop-in 0.2s reverse ease-in; }

@keyframes pop-in {
  from { opacity: 0; transform: scale(0.85) translateY(20px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

/* ─── WIRES SVG ──────────────────────────────────────────────────────────── */
.wires-svg { pointer-events: none; }

/* ─── RESPONSIF ──────────────────────────────────────────────────────────── */
@media (max-width: 500px) {
  .maintenance-title { font-size: 1.4rem; }
  .panel-body { padding: 1rem; gap: 0; }
  .cables-col, .sockets-col { gap: 1.1rem; }
}
</style>
