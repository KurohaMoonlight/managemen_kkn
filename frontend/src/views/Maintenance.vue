<template>
  <div
    class="maintenance-page"
    @mousemove="onMove"
    @mouseup="onRelease"
    @touchmove.prevent="onMove"
    @touchend="onRelease"
    @touchcancel="onRelease"
  >
    <!-- Panel listrik -->
    <div class="fuse-panel" ref="panelRef">
      <div class="panel-header">
        <span class="panel-label">⚡ ELECTRICAL PANEL</span>
        <span class="status-light" :class="{ on: allConnected }"></span>
      </div>

      <div class="panel-body">

        <!-- KIRI: Kabel sumber (yang bisa di-drag) -->
        <div class="cables-side">
          <div class="side-label">INPUT</div>
          <div
            v-for="cable in cables"
            :key="cable.id"
            class="cable-plug"
            :class="{ 'cable-connected': cable.connected }"
            :data-id="cable.id"
            @mousedown.prevent="startDrag(cable, $event)"
            @touchstart.prevent="startDrag(cable, $event)"
          >
            <div class="cable-body" :style="{ background: cable.color }"></div>
            <span class="cable-tag">{{ cable.label }}</span>
          </div>
        </div>

        <!-- TENGAH: area kabel tergambar (SVG) -->
        <div class="wires-middle" ref="wiresAreaRef">
          <svg
            ref="svgRef"
            style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;"
          >
            <defs>
              <filter id="wire-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <!-- Kabel yang sudah tersambung: base wire -->
            <path
              v-for="w in connectedPaths"
              :key="'base-' + w.id"
              :d="w.d"
              :stroke="w.color + '55'"
              stroke-width="6"
              fill="none"
              stroke-linecap="round"
            />
            <!-- Neon glow layer -->
            <path
              v-for="w in connectedPaths"
              :key="'glow-' + w.id"
              :d="w.d"
              :stroke="w.color"
              stroke-width="3"
              fill="none"
              stroke-linecap="round"
              filter="url(#wire-glow)"
            />
            <!-- Kabel yang sedang di-drag -->
            <path
              v-if="dragPath"
              :d="dragPath"
              :stroke="dragging.color"
              stroke-width="4"
              fill="none"
              stroke-linecap="round"
              stroke-dasharray="10 6"
              opacity="0.8"
            />
          </svg>
        </div>

        <!-- KANAN: Soket tujuan -->
        <div class="sockets-side">
          <div class="side-label">OUTPUT</div>
          <div
            v-for="socket in sockets"
            :key="socket.id"
            class="socket-item"
            :class="{ 'socket-connected': socket.connectedColor }"
            :ref="el => { if (el) socketEls[socket.id] = el }"
          >
            <span class="socket-tag">{{ socket.label }}</span>
            <div
            class="socket-hole"
            :class="{ 'socket-hole--connected': socket.connectedColor }"
            :style="socket.connectedColor ? {
              borderColor: socket.connectedColor,
              boxShadow: `0 0 10px ${socket.connectedColor}80, 0 0 20px ${socket.connectedColor}40`
            } : {}"
          >
            <div
              class="socket-dot"
              :style="socket.connectedColor ? { background: socket.connectedColor, boxShadow: `0 0 8px ${socket.connectedColor}` } : {}"
            ></div>
          </div>
          </div>
        </div>
      </div>

      <div class="panel-footer">
        <div v-for="i in 4" :key="i" class="breaker" :class="{ tripped: !allConnected && i <= 2 }"></div>
      </div>
    </div>

    <!-- Teks maintenance -->
    <div class="maintenance-content">
      <div class="maint-icon">🔧</div>
      <h1>Sistem Sedang Dalam Perbaikan</h1>
      <p>{{ message }}</p>
      <div class="dots"><span/><span/><span/></div>
    </div>

    <!-- Modal login rahasia -->
    <Transition name="modal-pop">
      <div v-if="showLogin" class="modal-overlay" @click.self="closeModal">
        <div class="modal-box">
          <div style="font-size:2.5rem;margin-bottom:0.5rem;">⚡</div>
          <h2>Sistem Terhubung</h2>
          <p class="modal-sub">Panel aktif. Masukkan kredensial untuk override maintenance.</p>
          <form @submit.prevent="doLogin">
            <input v-model="loginUser" type="text" placeholder="Username" autocomplete="username" required />
            <input v-model="loginPass" type="password" placeholder="Password" autocomplete="current-password" required />
            <button type="submit" :disabled="loginLoading">
              {{ loginLoading ? 'Mengautentikasi...' : 'Override & Masuk' }}
            </button>
          </form>
          <p v-if="loginErr" class="err">⚠ {{ loginErr }}</p>
          <button class="cancel-btn" @click="closeModal">Batalkan</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';

// ─── MESSAGE ──────────────────────────────────────────────────────────────────
const message = ref('Kami sedang melakukan perbaikan sistem. Silakan kembali lagi dalam beberapa saat.');

// ─── KABEL & SOKET ────────────────────────────────────────────────────────────
// Kabel kiri (INPUT), soket kanan (OUTPUT). Harus cocokkan warna.
const WIRES = [
  { id: 'red',    color: '#ef4444', label: 'L1' },
  { id: 'blue',   color: '#3b82f6', label: 'L2' },
  { id: 'yellow', color: '#eab308', label: 'N'  },
];

// Soket dikocok agar tidak linear (R, B, Y tidak urut dengan L1, L2, N)
const SOCKET_ORDER = ['yellow', 'red', 'blue'];

const cables = reactive(WIRES.map(w => ({ ...w, connected: false })));
const sockets = reactive(SOCKET_ORDER.map((id, i) => {
  const wire = WIRES.find(w => w.id === id);
  return { id, color: wire.color, label: ['Y', 'R', 'B'][i], connectedColor: null };
}));

// ─── REFS ─────────────────────────────────────────────────────────────────────
const svgRef = ref(null);
const wiresAreaRef = ref(null);
const socketEls = reactive({});

// ─── DRAG STATE ───────────────────────────────────────────────────────────────
const dragging = ref(null);   // { id, color, label }
const curX = ref(0);
const curY = ref(0);

// ─── CONNECTED PATHS (SVG) ────────────────────────────────────────────────────
const connectedPaths = reactive([]); // { id, color, d }

// Hitung path SVG dari titik awal (ujung kabel) ke soket
const makePath = (x1, y1, x2, y2) => {
  const sag = Math.max(30, Math.abs(y2 - y1) * 0.4);
  const cx1 = x1 + (x2 - x1) * 0.35;
  const cy1 = y1 + sag;
  const cx2 = x1 + (x2 - x1) * 0.65;
  const cy2 = y2 + sag;
  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
};

// Path kabel saat sedang di-drag
const dragPath = computed(() => {
  if (!dragging.value || !svgRef.value) return null;
  const svg = svgRef.value;
  const svgRect = svg.getBoundingClientRect();
  // Titik awal: cari elemen kabel
  const cableEls = document.querySelectorAll('.cable-plug');
  let startX = 0, startY = 0;
  for (const el of cableEls) {
    const body = el.querySelector('.cable-body');
    if (!body) continue;
    // Cocokkan warna via data-id
    if (el.dataset.id === dragging.value.id) {
      const r = body.getBoundingClientRect();
      startX = r.right - svgRect.left;
      startY = r.top + r.height / 2 - svgRect.top;
      break;
    }
  }
  const ex = curX.value - svgRect.left;
  const ey = curY.value - svgRect.top;
  return makePath(startX, startY, ex, ey);
});

// ─── START DRAG ───────────────────────────────────────────────────────────────
const startDrag = (cable, e) => {
  // Jika sudah tersambung, cabut dulu
  if (cable.connected) {
    disconnect(cable.id);
  }
  dragging.value = { id: cable.id, color: cable.color, label: cable.label };
  const touch = e.touches ? e.touches[0] : e;
  curX.value = touch.clientX;
  curY.value = touch.clientY;
};

const onMove = (e) => {
  if (!dragging.value) return;
  const touch = e.touches ? e.touches[0] : e;
  curX.value = touch.clientX;
  curY.value = touch.clientY;
};

const onRelease = (e) => {
  if (!dragging.value) return;

  const touch = e.changedTouches ? e.changedTouches[0] : e;
  const rx = touch.clientX;
  const ry = touch.clientY;

  let matched = false;
  for (const socket of sockets) {
    if (socket.connectedColor) continue; // soket sudah terpakai
    const el = socketEls[socket.id];
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const pad = 24;
    if (rx >= rect.left - pad && rx <= rect.right + pad && ry >= rect.top - pad && ry <= rect.bottom + pad) {
      // Cek cocok warna
      if (socket.id === dragging.value.id) {
        connect(dragging.value.id, socket.id);
      } else {
        // Salah warna — shake soket
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 450);
      }
      matched = true;
      break;
    }
  }

  dragging.value = null;
};

// ─── CONNECT / DISCONNECT ─────────────────────────────────────────────────────
const connect = async (cableId, socketId) => {
  const cable = cables.find(c => c.id === cableId);
  const socket = sockets.find(s => s.id === socketId);
  if (!cable || !socket) return;

  cable.connected = true;
  socket.connectedColor = cable.color;

  await nextTick();

  // Hitung posisi SVG path
  const svg = svgRef.value;
  if (!svg) return;
  const svgRect = svg.getBoundingClientRect();

  // Titik awal: ujung kanan .cable-body dari kabel ini
  const cableEls = document.querySelectorAll('.cable-plug');
  let x1 = 0, y1 = 0;
  for (const el of cableEls) {
    if (el.dataset.id === cableId) {
      const body = el.querySelector('.cable-body');
      if (body) {
        const r = body.getBoundingClientRect();
        x1 = r.right - svgRect.left;
        y1 = r.top + r.height / 2 - svgRect.top;
      }
      break;
    }
  }

  // Titik akhir: pusat .socket-hole
  const socketEl = socketEls[socketId];
  let x2 = 0, y2 = 0;
  if (socketEl) {
    const hole = socketEl.querySelector('.socket-hole');
    if (hole) {
      const r = hole.getBoundingClientRect();
      x2 = r.left - svgRect.left;
      y2 = r.top + r.height / 2 - svgRect.top;
    }
  }

  const existing = connectedPaths.findIndex(p => p.id === cableId);
  const pathObj = { id: cableId, color: cable.color, d: makePath(x1, y1, x2, y2) };
  if (existing >= 0) connectedPaths[existing] = pathObj;
  else connectedPaths.push(pathObj);
};

const disconnect = (cableId) => {
  const cable = cables.find(c => c.id === cableId);
  const socket = sockets.find(s => s.id === cableId);
  if (cable) cable.connected = false;
  if (socket) socket.connectedColor = null;
  const idx = connectedPaths.findIndex(p => p.id === cableId);
  if (idx >= 0) connectedPaths.splice(idx, 1);
};

// ─── WIN CONDITION ────────────────────────────────────────────────────────────
const allConnected = computed(() => cables.every(c => c.connected));
const showLogin = ref(false);
let winTimer = null;

watch(allConnected, (val) => {
  if (val) {
    winTimer = setTimeout(() => { showLogin.value = true; }, 900);
  } else {
    clearTimeout(winTimer);
  }
});

// ─── LOGIN MODAL ──────────────────────────────────────────────────────────────
const loginUser = ref('');
const loginPass = ref('');
const loginLoading = ref(false);
const loginErr = ref('');

const closeModal = () => {
  showLogin.value = false;
  loginUser.value = '';
  loginPass.value = '';
  loginErr.value = '';
  // Reset semua kabel
  cables.forEach(c => c.connected = false);
  sockets.forEach(s => s.connectedColor = null);
  connectedPaths.splice(0);
};

const doLogin = async () => {
  loginLoading.value = true;
  loginErr.value = '';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nim: loginUser.value, password: loginPass.value, is_override_login: true }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      sessionStorage.setItem('maintenance_bypassed', 'true');
      const map = { superadmin: '/superadmin', admin: '/admin', mahasiswa: '/mahasiswa' };
      window.location.href = map[data.user.role] || '/';
    } else {
      loginErr.value = data.message || 'Login gagal.';
    }
  } catch {
    loginErr.value = 'Terjadi kesalahan jaringan.';
  } finally {
    loginLoading.value = false;
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

onUnmounted(() => clearTimeout(winTimer));
</script>

<style scoped>
/* ──── PAGE ──────────────────────────────────────────────────────────────── */
.maintenance-page {
  min-height: 100vh;
  background: #0d1117;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  gap: 2.5rem;
  font-family: 'Inter', 'Segoe UI', sans-serif;
  color: #e2e8f0;
  overflow: hidden;
  user-select: none;
  position: relative;
}

/* Grid blueprint di latar */
.maintenance-page::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px);
  background-size: 44px 44px;
  pointer-events: none;
}

/* ──── PANEL ──────────────────────────────────────────────────────────────── */
.fuse-panel {
  width: 100%;
  max-width: 520px;
  background: #161b22;
  border: 1.5px solid #30363d;
  border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.03);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem 1.2rem;
  background: #0d1117;
  border-bottom: 1.5px solid #30363d;
}

.panel-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #6e7681;
}

.status-light {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #da3633;
  box-shadow: 0 0 6px #da3633;
  transition: all 0.5s;
}

.status-light.on {
  background: #3fb950;
  box-shadow: 0 0 12px #3fb950, 0 0 28px rgba(63,185,80,0.35);
  animation: blink-light 1s infinite;
}

@keyframes blink-light {
  50% { opacity: 0.55; }
}

/* ──── PANEL BODY ─────────────────────────────────────────────────────────── */
.panel-body {
  display: flex;
  align-items: center;
  padding: 1.4rem 1.2rem;
  gap: 0;
  position: relative;
  min-height: 200px;
}

.side-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #484f58;
  margin-bottom: 1rem;
}

/* ──── KABEL (KIRI) ───────────────────────────────────────────────────────── */
.cables-side {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.4rem;
  flex-shrink: 0;
  z-index: 10;
}

.cable-plug {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  cursor: grab;
  transition: transform 0.15s, filter 0.15s;
  touch-action: none;
}

.cable-plug:hover {
  transform: scale(1.1);
  filter: brightness(1.15);
}

.cable-plug:active { cursor: grabbing; }

.cable-plug.cable-connected {
  opacity: 0.3;
  cursor: grab;
  pointer-events: auto; /* tetap bisa di-grab untuk disconnect */
}

.cable-body {
  width: 38px;
  height: 20px;
  border-radius: 5px;
  box-shadow: inset 0 -3px 0 rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.4);
  border: 1.5px solid rgba(255,255,255,0.12);
}

.cable-tag {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #8b949e;
}

/* ──── AREA KABEL TENGAH ──────────────────────────────────────────────────── */
.wires-middle {
  flex: 1;
  position: relative;
  align-self: stretch;
  min-width: 60px;
}


/* ──── SOKET (KANAN) ──────────────────────────────────────────────────────── */
.sockets-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1.4rem;
  flex-shrink: 0;
  z-index: 10;
}

.socket-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-direction: row-reverse;
  transition: transform 0.25s;
}

.socket-item.socket-connected { transform: scale(1.08); }

.socket-tag {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #8b949e;
}

.socket-hole {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #060a0f;
  border: 3px solid #21262d;
  box-shadow: inset 0 2px 6px rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.4s, box-shadow 0.4s;
}

.socket-hole--connected {
  animation: socket-pulse 2s ease-in-out infinite;
}

@keyframes socket-pulse {
  0%, 100% { box-shadow: var(--socket-glow, none); }
  50% { box-shadow: var(--socket-glow, none), 0 0 30px rgba(255,255,255,0.08); }
}

.socket-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #1a1f27;
  border: 1.5px solid #2d333b;
  transition: background 0.4s, box-shadow 0.4s, border-color 0.4s;
}

/* ──── SHAKE (SOKET SALAH) ───────────────────────────────────────────────── */
.shake {
  animation: do-shake 0.42s ease-out;
}

@keyframes do-shake {
  0%   { transform: translateX(0) rotate(0); }
  18%  { transform: translateX(-5px) rotate(-2deg); }
  36%  { transform: translateX(5px) rotate(2deg); }
  54%  { transform: translateX(-4px); }
  72%  { transform: translateX(3px); }
  88%  { transform: translateX(-2px); }
  100% { transform: translateX(0); }
}

/* ──── FOOTER BREAKER ─────────────────────────────────────────────────────── */
.panel-footer {
  display: flex;
  gap: 0.5rem;
  padding: 0.7rem 1.2rem;
  background: #0d1117;
  border-top: 1.5px solid #30363d;
}

.breaker {
  flex: 1;
  height: 7px;
  border-radius: 99px;
  background: #21262d;
  transition: background 0.4s, box-shadow 0.4s;
}

.breaker.tripped {
  background: #da3633;
  box-shadow: 0 0 8px rgba(218, 54, 51, 0.45);
}

/* ──── MAINTENANCE CONTENT ────────────────────────────────────────────────── */
.maintenance-content {
  text-align: center;
  max-width: 440px;
}

.maint-icon {
  font-size: 2.4rem;
  margin-bottom: 0.75rem;
  display: inline-block;
  animation: slow-spin 5s linear infinite;
}

@keyframes slow-spin {
  to { transform: rotate(360deg); }
}

.maintenance-content h1 {
  font-size: 1.7rem;
  font-weight: 800;
  color: #f0f6fc;
  margin: 0 0 0.75rem;
  line-height: 1.25;
}

.maintenance-content p {
  font-size: 1rem;
  color: #8b949e;
  line-height: 1.65;
  margin: 0 0 1.25rem;
}

.dots {
  display: flex;
  justify-content: center;
  gap: 6px;
}

.dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #484f58;
  animation: dot-pulse 1.4s ease-in-out infinite;
}

.dots span:nth-child(2) { animation-delay: 0.2s; }
.dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes dot-pulse {
  0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
  40%            { transform: scale(1);   opacity: 1; }
}

/* ──── MODAL ──────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 1rem;
}

.modal-box {
  background: #161b22;
  border: 1.5px solid #30363d;
  border-radius: 18px;
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 370px;
  text-align: center;
  box-shadow: 0 30px 90px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04);
}

.modal-box h2 {
  font-size: 1.3rem;
  font-weight: 700;
  color: #3fb950;
  margin: 0 0 0.35rem;
}

.modal-sub {
  font-size: 0.82rem;
  color: #6e7681;
  margin-bottom: 1.5rem;
}

.modal-box form {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.modal-box input {
  padding: 0.8rem 1rem;
  border-radius: 8px;
  border: 1.5px solid #30363d;
  background: #0d1117;
  color: #e6edf3;
  font-size: 0.92rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.modal-box input:focus {
  border-color: #3fb950;
  box-shadow: 0 0 0 3px rgba(63, 185, 80, 0.15);
}

.modal-box button[type='submit'] {
  background: #238636;
  color: #fff;
  border: none;
  padding: 0.85rem;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  margin-top: 0.2rem;
  transition: background 0.2s, transform 0.15s;
}

.modal-box button[type='submit']:hover:not(:disabled) { background: #2ea043; transform: translateY(-1px); }
.modal-box button[type='submit']:disabled { background: #21262d; cursor: not-allowed; }

.cancel-btn {
  background: transparent;
  color: #484f58;
  border: none;
  width: 100%;
  padding: 0.6rem;
  margin-top: 0.5rem;
  cursor: pointer;
  font-size: 0.88rem;
  transition: color 0.2s;
}

.cancel-btn:hover { color: #8b949e; }

.err {
  color: #f85149;
  font-size: 0.82rem;
  margin-top: 0.6rem;
}

/* ──── MODAL TRANSITION ───────────────────────────────────────────────────── */
.modal-pop-enter-active { animation: pop-in 0.42s cubic-bezier(0.34, 1.56, 0.64, 1); }
.modal-pop-leave-active { animation: pop-in 0.2s reverse ease-in; }

@keyframes pop-in {
  from { opacity: 0; transform: scale(0.85) translateY(16px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

/* ──── RESPONSIVE ─────────────────────────────────────────────────────────── */
@media (max-width: 500px) {
  .panel-body { padding: 1rem 0.8rem; }
  .cables-side, .sockets-side { gap: 1.1rem; }
  .maintenance-content h1 { font-size: 1.4rem; }
}
</style>
