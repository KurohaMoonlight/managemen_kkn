<template>
  <div
    class="maintenance-container"
    @mousemove="onMove"
    @mouseup="onRelease"
    @touchmove.prevent="onMove"
    @touchend="onRelease"
    @touchcancel="onRelease"
  >
    <!-- Hint teks kecil agar user tahu bisa dipegang -->
    <p class="game-hint">🔨 Ambil palu, ayunkan, dan hancurkan temboknya!</p>

    <!-- Progress bata hancur -->
    <div class="hit-progress">
      <span v-for="i in maxHits" :key="i" class="hit-dot" :class="{ filled: hitCount >= i }"></span>
    </div>

    <!-- Power bar (kecepatan ayunan palu) -->
    <div class="power-bar-wrap" v-if="isDragging">
      <div class="power-bar-label">Tenaga Ayunan</div>
      <div class="power-bar-track">
        <div class="power-bar-fill" :style="{ width: powerPercent + '%', background: powerColor }"></div>
      </div>
    </div>

    <!-- Area animasi -->
    <div class="animation-wrapper">
      <!-- Tembok bata -->
      <div class="wall" ref="wallRef" :class="{ 'shake-auto': isAutoAnim, 'shake-hit': wallShaking }">
        <div class="brick-row" v-for="r in 4" :key="'r-'+r">
          <div
            class="brick"
            v-for="b in 3"
            :key="'b-'+b"
            :class="{ broken: isBrickBroken(r, b), 'newly-broken': newlyBroken && isBrickNewlyBroken(r, b) }"
          ></div>
        </div>
      </div>

      <!-- Puing-puing -->
      <div class="debris debris-1" :class="{ fly: isAutoAnim || wallShaking }"></div>
      <div class="debris debris-2" :class="{ fly: isAutoAnim || wallShaking }"></div>
      <div class="debris debris-3" :class="{ fly: isAutoAnim || wallShaking }"></div>

      <!--
        Pivot palu ada di titik pegangannya (handle top-center).
        Kita render seluruh "palu" sebagai satu unit yang dirotasikan
        di sekitar ujung atas handlenya.
      -->
      <div
        class="hammer-pivot"
        ref="hammerPivotRef"
        :style="hammerPivotStyle"
        @mousedown.prevent="onGrab"
        @touchstart.prevent="onGrab"
      >
        <!-- Seluruh visual palu, dengan pivot di atas -->
        <div class="hammer-visual" :style="{ transform: `rotate(${angle}deg)` }">
          <div class="hammer-handle-vis"></div>
          <div class="hammer-head-vis"></div>
        </div>
      </div>
    </div>

    <div class="maintenance-content">
      <h1 class="maintenance-title">Sistem Sedang Diperbaiki</h1>
      <p class="maintenance-message">{{ message }}</p>
    </div>

    <!-- Secret Login Modal -->
    <Transition name="modal-pop">
      <div v-if="showSecretLogin" class="secret-modal-overlay" @click.self="closeSecretLogin">
        <div class="secret-modal-content">
          <div class="modal-icon">🔓</div>
          <h2>Superadmin Override</h2>
          <form @submit.prevent="handleSecretLogin">
            <input type="text" v-model="username" placeholder="Username" autocomplete="username" required />
            <input type="password" v-model="password" placeholder="Password" autocomplete="current-password" required />
            <button type="submit" :disabled="isLoading">{{ isLoading ? 'Memproses...' : 'Masuk' }}</button>
          </form>
          <p v-if="loginError" class="error-msg">{{ loginError }}</p>
          <button class="close-btn" @click="closeSecretLogin">Batal</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const message = ref('Sistem sedang dalam perbaikan rutin. Silakan kembali lagi nanti.');

// ─── GAME STATE ─────────────────────────────────────────────────────────────
const hitCount = ref(0);
const maxHits = 3;
const showSecretLogin = ref(false);
const isAutoAnim = ref(true);

// ─── WALL REFS & EFFECTS ────────────────────────────────────────────────────
const wallRef = ref(null);
const wallShaking = ref(false);
const newlyBroken = ref(false);
let newlyBrokenTimer = null;

// Bata mana yang baru pecah saat hit terakhir
const getNewBricksForHit = (n) => {
  if (n === 1) return [[1, 1], [2, 2]];
  if (n === 2) return [[1, 2], [1, 3], [3, 1]];
  if (n === 3) return [[2, 1], [3, 2], [3, 3], [4, 1], [4, 2], [4, 3]];
  return [];
};

const isBrickBroken = (r, b) => {
  if (hitCount.value === 0) return false;
  for (let h = 1; h <= hitCount.value; h++) {
    if (getNewBricksForHit(h).some(([br, bb]) => br === r && bb === b)) return true;
  }
  return false;
};

const isBrickNewlyBroken = (r, b) => {
  return getNewBricksForHit(hitCount.value).some(([br, bb]) => br === r && bb === b);
};

// ─── HAMMER PHYSICS ─────────────────────────────────────────────────────────
const hammerPivotRef = ref(null);

// Posisi pivot (handle atas palu) di layar — kita tarik dari DOM
const pivotScreenX = ref(0);
const pivotScreenY = ref(0);

// Posisi terjemahan wrapper (agar user bisa drag palu ke mana saja)
const dragOffsetX = ref(0);
const dragOffsetY = ref(0);

// Sudut rotasi palu (derajat), dihitung dari fisika
const angle = ref(-40); // mulai agak miring seperti palu siap ayun
let angleVelocity = 0;   // kecepatan angular (derajat/frame)

// State drag
const isDragging = ref(false);
let pointerX = 0;
let pointerY = 0;
let lastAngle = 0;
let lastAngleTime = 0;
let angularVelocityAtRelease = 0;

// rAF
let rafId = null;

// ─── POWER BAR ──────────────────────────────────────────────────────────────
const swingSpeed = ref(0); // derajat/ms saat release

const powerPercent = computed(() => {
  const maxSpeed = 8; // derajat/ms yang dianggap "penuh"
  return Math.min(100, (Math.abs(swingSpeed.value) / maxSpeed) * 100);
});

const powerColor = computed(() => {
  const p = powerPercent.value;
  if (p < 40) return '#22c55e';
  if (p < 75) return '#f59e0b';
  return '#ef4444';
});

// ─── HAMMER PIVOT STYLE ─────────────────────────────────────────────────────
// Pivot selalu di posisi default (kanan bawah animation-wrapper) kecuali saat drag
const hammerPivotStyle = computed(() => ({
  transform: `translate(${dragOffsetX.value}px, ${dragOffsetY.value}px)`,
  cursor: isDragging.value ? 'grabbing' : 'grab',
  transition: isDragging.value ? 'none' : 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
}));

// ─── PHYSICS LOOP (hanya saat drag) ─────────────────────────────────────────
const physicsLoop = () => {
  if (!isDragging.value) return;

  // Hitung sudut target berdasarkan arah pointer dari pivot
  const pivotEl = hammerPivotRef.value;
  if (pivotEl) {
    const rect = pivotEl.getBoundingClientRect();
    // Titik pivot = atas tengah elemen hammer-pivot
    const pxInScreen = rect.left + rect.width / 2;
    const pyInScreen = rect.top + 4; // sedikit ke bawah dari tepi atas

    const dx = pointerX - pxInScreen;
    const dy = pointerY - pyInScreen;

    // Sudut target: arah dari pivot ke pointer (0 = atas)
    const targetAngle = Math.atan2(dx, -dy) * (180 / Math.PI);

    // Spring ke targetAngle — ini membuat kepala palu mengikuti tangan dengan "lag"
    const diff = targetAngle - angle.value;
    // Normalize diff ke -180..180
    const normalizedDiff = ((diff + 180) % 360) - 180;

    const spring = 0.22;
    const damping = 0.78;

    angleVelocity += normalizedDiff * spring;
    angleVelocity *= damping;
    
    const prevAngle = angle.value;
    const prevTime = lastAngle;
    angle.value += angleVelocity;

    // Catat kecepatan sudut untuk deteksi hit saat release
    const now = performance.now();
    if (lastAngleTime > 0) {
      const dt = now - lastAngleTime;
      if (dt > 0) {
        angularVelocityAtRelease = (angle.value - lastAngle) / dt;
        swingSpeed.value = Math.abs(angularVelocityAtRelease);
      }
    }
    lastAngle = angle.value;
    lastAngleTime = now;
  }

  rafId = requestAnimationFrame(physicsLoop);
};

// ─── EVENT HANDLERS ──────────────────────────────────────────────────────────
const onGrab = (e) => {
  if (showSecretLogin.value) return;
  isDragging.value = true;
  isAutoAnim.value = false;
  cancelAnimationFrame(rafId);

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  pointerX = clientX;
  pointerY = clientY;
  angleVelocity = 0;
  lastAngle = angle.value;
  lastAngleTime = 0;
  swingSpeed.value = 0;

  rafId = requestAnimationFrame(physicsLoop);
};

const onMove = (e) => {
  if (!isDragging.value) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  pointerX = clientX;
  pointerY = clientY;
};

const onRelease = (e) => {
  if (!isDragging.value) return;
  isDragging.value = false;
  cancelAnimationFrame(rafId);

  // Deteksi hit: Apakah kepala palu overlapping dengan tembok?
  const MIN_SPEED_DEG_PER_MS = 0.25; // threshold minimum kecepatan
  const speed = Math.abs(angularVelocityAtRelease);

  if (speed >= MIN_SPEED_DEG_PER_MS && wallRef.value && hammerPivotRef.value) {
    // Hitung posisi kepala palu saat ini menggunakan trigonometri
    const pivotEl = hammerPivotRef.value;
    const pivotRect = pivotEl.getBoundingClientRect();
    const px = pivotRect.left + pivotRect.width / 2;
    const py = pivotRect.top + 4;

    // Panjang handle handle ≈ 80px (dari CSS), kepala ada di ujungnya
    const handleLength = 80;
    const rad = (angle.value - 90) * (Math.PI / 180);
    const headX = px + Math.cos(rad) * handleLength;
    const headY = py + Math.sin(rad) * handleLength;

    const wallRect = wallRef.value.getBoundingClientRect();
    const isHit =
      headX >= wallRect.left - 20 &&
      headX <= wallRect.right + 20 &&
      headY >= wallRect.top - 20 &&
      headY <= wallRect.bottom + 20;

    if (isHit) {
      registerHit(speed);
    }
  }

  // Kembalikan palu ke posisi semula
  dragOffsetX.value = 0;
  dragOffsetY.value = 0;

  // Lanjutkan fisika "bandul bebas" setelah dilepas (inertia)
  const inertiaLoop = () => {
    if (isDragging.value) return;
    // Fisika bandul: gravitasi menarik ke bawah (sudut 0 = vertikal ke bawah = 90 derajat dari atas)
    const gravity = 0.8;
    const restAngle = -40; // posisi istirahat palu
    const springBack = (restAngle - angle.value) * 0.04;
    angleVelocity = (angleVelocity + springBack) * 0.92;
    angle.value += angleVelocity;

    if (Math.abs(angleVelocity) > 0.05 || Math.abs(angle.value - restAngle) > 0.5) {
      rafId = requestAnimationFrame(inertiaLoop);
    } else {
      angle.value = restAngle;
      angleVelocity = 0;
      // Aktifkan kembali animasi otomatis setelah 1 detik
      setTimeout(() => {
        if (!isDragging.value && !showSecretLogin.value) isAutoAnim.value = true;
      }, 1000);
    }
  };
  rafId = requestAnimationFrame(inertiaLoop);
};

// ─── HIT LOGIC ──────────────────────────────────────────────────────────────
const registerHit = (speed) => {
  hitCount.value++;
  wallShaking.value = true;
  newlyBroken.value = true;

  clearTimeout(newlyBrokenTimer);
  newlyBrokenTimer = setTimeout(() => {
    wallShaking.value = false;
    newlyBroken.value = false;
    if (hitCount.value >= maxHits) {
      showSecretLogin.value = true;
    }
  }, 600);
};

// ─── SECRET LOGIN LOGIC ──────────────────────────────────────────────────────
const username = ref('');
const password = ref('');
const isLoading = ref(false);
const loginError = ref('');

const closeSecretLogin = () => {
  showSecretLogin.value = false;
  username.value = '';
  password.value = '';
  loginError.value = '';
  hitCount.value = 0;
  angle.value = -40;
  setTimeout(() => { isAutoAnim.value = true; }, 300);
};

const handleSecretLogin = async () => {
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
      const roleToPath = { superadmin: '/superadmin', admin: '/admin', mahasiswa: '/mahasiswa' };
      window.location.href = roleToPath[data.user.role] || '/';
    } else {
      const data = await res.json();
      loginError.value = data.message || 'Login gagal.';
    }
  } catch (e) {
    loginError.value = 'Terjadi kesalahan jaringan.';
  } finally {
    isLoading.value = false;
  }
};

// ─── LIFECYCLE ───────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const res = await fetch('/api/maintenance');
    const data = await res.json();
    if (data.message) message.value = data.message;
  } catch (e) {
    console.error(e);
  }
});

onUnmounted(() => {
  cancelAnimationFrame(rafId);
  clearTimeout(newlyBrokenTimer);
});
</script>

<style scoped>
/* ─── LAYOUT ─────────────────────────────────────────────────────────────── */
.maintenance-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(160deg, #f8fafc 0%, #e2e8f0 100%);
  font-family: 'Inter', sans-serif;
  color: #334155;
  text-align: center;
  padding: 2rem;
  overflow: hidden;
  user-select: none;
}

.game-hint {
  font-size: 0.9rem;
  color: #94a3b8;
  margin-bottom: 0.5rem;
  letter-spacing: 0.02em;
}

/* ─── HIT PROGRESS DOTS ──────────────────────────────────────────────────── */
.hit-progress {
  display: flex;
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.hit-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid #cbd5e1;
  background: transparent;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.hit-dot.filled {
  background: #ef4444;
  border-color: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
  transform: scale(1.2);
}

/* ─── POWER BAR ──────────────────────────────────────────────────────────── */
.power-bar-wrap {
  margin-bottom: 0.75rem;
  width: 200px;
  text-align: left;
}

.power-bar-label {
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 4px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.power-bar-track {
  height: 8px;
  background: #e2e8f0;
  border-radius: 99px;
  overflow: hidden;
}

.power-bar-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.05s linear, background 0.2s;
}

/* ─── ANIMATION WRAPPER ──────────────────────────────────────────────────── */
.animation-wrapper {
  position: relative;
  width: 280px;
  height: 220px;
  margin-bottom: 2rem;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* ─── WALL ───────────────────────────────────────────────────────────────── */
.wall {
  width: 120px;
  height: 100px;
  background: #cbd5e1;
  display: flex;
  flex-direction: column;
  border: 2px solid #94a3b8;
  border-bottom: none;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.wall.shake-auto {
  animation: wall-shake 2s infinite linear;
}

.wall.shake-hit {
  animation: wall-shake-hit 0.5s ease-out 1;
}

.brick-row {
  display: flex;
  height: 25px;
  width: 100%;
}

.brick-row:nth-child(even) {
  margin-left: -20px;
}

.brick {
  width: 40px;
  height: 100%;
  border: 1px solid #f8fafc;
  background: #e2e8f0;
  flex-shrink: 0;
  position: relative;
  transition: background 0.3s, opacity 0.3s;
}

.brick.broken {
  background: #94a3b8;
  opacity: 0.5;
}

.brick.broken::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(47deg, transparent 38%, rgba(0,0,0,0.15) 42%, transparent 46%),
    linear-gradient(-47deg, transparent 28%, rgba(0,0,0,0.12) 32%, transparent 38%);
}

.brick.newly-broken {
  animation: brick-flash 0.5s ease-out 1;
}

/* ─── DEBRIS ─────────────────────────────────────────────────────────────── */
.debris {
  position: absolute;
  width: 12px;
  height: 8px;
  background: #cbd5e1;
  border: 1px solid #94a3b8;
  z-index: 3;
  opacity: 0;
  border-radius: 2px;
}

.debris-1.fly { right: 85px; top: 80px; animation: fly-1 2s infinite linear; }
.debris-2.fly { right: 75px; top: 95px;  animation: fly-2 2s infinite linear; }
.debris-3.fly { right: 95px; top: 90px;  animation: fly-3 2s infinite linear; }

/* ─── HAMMER PIVOT ───────────────────────────────────────────────────────── */
/*
  Pivot adalah titik tempat palu "dipegang" / berputar.
  Posisinya di kanan bawah animation-wrapper.
  transform-origin dari .hammer-visual adalah top center
  sehingga kepala palu berayun di sekitar pegangannya.
*/
.hammer-pivot {
  position: absolute;
  right: 20px;
  bottom: 10px;
  width: 24px;
  height: 24px;
  z-index: 5;
  /* Visual titik pegangan (tidak terlihat, hanya untuk referensi ukuran) */
}

.hammer-visual {
  position: absolute;
  /* transform-origin di atas center — titik pegangan handle */
  transform-origin: 50% 0%;
  /* Kita render ke bawah dari pivot */
  top: 0;
  left: 50%;
  translate: -50% 0;
  width: 20px;
}

/* Handle (gagang) */
.hammer-handle-vis {
  width: 14px;
  height: 80px;
  background: linear-gradient(to right, #92400e, #b45309, #78350f);
  border-radius: 3px 3px 5px 5px;
  margin: 0 auto;
  box-shadow: inset -2px 0 4px rgba(0,0,0,0.2);
}

/* Kepala palu — ada di ujung bawah handle */
.hammer-head-vis {
  width: 60px;
  height: 28px;
  background: linear-gradient(to bottom, #475569, #334155, #1e293b);
  border-radius: 5px;
  position: relative;
  left: 50%;
  translate: -50% 0;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3), inset 0 -3px 0 rgba(0,0,0,0.2);
}

.hammer-head-vis::before {
  content: '';
  position: absolute;
  top: 50%;
  left: -12px;
  translate: 0 -50%;
  width: 12px;
  height: 16px;
  background: #64748b;
  border-radius: 3px 0 0 3px;
}

/* ─── CONTENT ────────────────────────────────────────────────────────────── */
.maintenance-content {
  max-width: 500px;
}

.maintenance-title {
  font-size: 2.2rem;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 0.75rem;
}

.maintenance-message {
  font-size: 1.1rem;
  color: #475569;
  line-height: 1.6;
}

/* ─── MODAL ──────────────────────────────────────────────────────────────── */
.secret-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.secret-modal-content {
  background: #1e293b;
  padding: 2.5rem 2rem;
  border-radius: 16px;
  width: 90%;
  max-width: 380px;
  color: white;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border: 1px solid #334155;
  text-align: center;
}

.modal-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.secret-modal-content h2 {
  margin: 0 0 1.5rem;
  color: #e2e8f0;
  font-size: 1.2rem;
}

.secret-modal-content form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.secret-modal-content input {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #475569;
  background: #0f172a;
  color: white;
  font-size: 0.95rem;
  outline: none;
  text-align: left;
}

.secret-modal-content input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.secret-modal-content button[type='submit'] {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  padding: 0.85rem;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  margin-top: 0.25rem;
  transition: opacity 0.2s;
}

.secret-modal-content button[type='submit']:hover { opacity: 0.9; }
.secret-modal-content button[type='submit']:disabled { background: #475569; cursor: not-allowed; }

.close-btn {
  background: transparent;
  color: #64748b;
  border: none;
  width: 100%;
  padding: 0.6rem;
  margin-top: 0.75rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.close-btn:hover { color: #e2e8f0; }

.error-msg {
  color: #f87171;
  font-size: 0.875rem;
  margin-top: 0.75rem;
  text-align: center;
}

/* ─── ANIMATIONS ─────────────────────────────────────────────────────────── */
@keyframes wall-shake {
  0%, 44%  { transform: translateX(0); }
  45%      { transform: translateX(-4px) rotate(-0.8deg); }
  47%      { transform: translateX(4px) rotate(0.8deg); }
  49%      { transform: translateX(-2px); }
  51%      { transform: translateX(0); }
  100%     { transform: translateX(0); }
}

@keyframes wall-shake-hit {
  0%   { transform: translateX(0); }
  15%  { transform: translateX(-8px) rotate(-1.5deg); }
  30%  { transform: translateX(8px) rotate(1.5deg); }
  50%  { transform: translateX(-4px) rotate(-0.5deg); }
  70%  { transform: translateX(3px); }
  85%  { transform: translateX(-2px); }
  100% { transform: translateX(0); }
}

@keyframes brick-flash {
  0%   { filter: brightness(2) saturate(0); }
  50%  { filter: brightness(1.5) saturate(0.5); }
  100% { filter: brightness(1) saturate(1); }
}

@keyframes fly-1 {
  0%, 44% { opacity: 0; transform: translate(0,0) rotate(0deg); }
  45%     { opacity: 1; transform: translate(0,0) rotate(0deg); }
  70%     { opacity: 0; transform: translate(32px,-42px) rotate(130deg) scale(0.5); }
  100%    { opacity: 0; }
}

@keyframes fly-2 {
  0%, 44% { opacity: 0; transform: translate(0,0) rotate(0deg); }
  45%     { opacity: 1; transform: translate(0,0) rotate(0deg); }
  75%     { opacity: 0; transform: translate(52px,-18px) rotate(-160deg) scale(0.8); }
  100%    { opacity: 0; }
}

@keyframes fly-3 {
  0%, 44% { opacity: 0; transform: translate(0,0) rotate(0deg); }
  45%     { opacity: 1; transform: translate(0,0) rotate(0deg); }
  65%     { opacity: 0; transform: translate(14px,-52px) rotate(95deg) scale(0.4); }
  100%    { opacity: 0; }
}

/* ─── MODAL TRANSITION ───────────────────────────────────────────────────── */
.modal-pop-enter-active { animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.modal-pop-leave-active { animation: pop-in 0.2s reverse ease-in; }

@keyframes pop-in {
  from { opacity: 0; transform: scale(0.8); }
  to   { opacity: 1; transform: scale(1); }
}
</style>
