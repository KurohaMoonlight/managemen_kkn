<template>
  <div class="maintenance-container" @mousemove="onDrag" @mouseup="endDrag" @touchmove="onDrag" @touchend="endDrag">
    <!-- Star Indicator (tidak perlu lagi karena pakai klik/drag, tapi kita bisa pakai hitCount) -->
    <div v-if="hitCount > 0" class="secret-indicator">
      {{ '*'.repeat(hitCount) }}
    </div>
    <div class="animation-wrapper">
      <div class="wall" ref="wallRef" :class="{ 'shake-manual': manualShake, 'shake-auto': isAutoAnim }">
        <div class="brick-row" v-for="r in 4" :key="'r-'+r">
          <!-- Bata akan semakin banyak yang hancur seiring hitCount bertambah -->
          <div class="brick" 
               v-for="b in 3" 
               :key="'b-'+b" 
               :class="{'broken': isBrickBroken(r, b)}">
          </div>
        </div>
      </div>
      
      <!-- Efek puing-puing (debris) yang terbang saat dipalu -->
      <div class="debris debris-1" :class="{'fly': isAutoAnim || manualShake}"></div>
      <div class="debris debris-2" :class="{'fly': isAutoAnim || manualShake}"></div>
      <div class="debris debris-3" :class="{'fly': isAutoAnim || manualShake}"></div>

      <!-- Wrapper baru untuk drag & drop -->
      <div class="hammer-wrapper" 
           ref="hammerRef"
           :style="{ 
             transform: `translate(${hammerX}px, ${hammerY}px)`, 
             cursor: isDragging ? 'grabbing' : 'grab',
             transition: isDragging ? 'none' : 'transform 0.5s ease-out'
           }"
           @mousedown.prevent="startDrag"
           @touchstart.prevent="startDrag">
        
        <div class="hammer-container" 
             :class="{ 'auto-hit': isAutoAnim, 'manual-hit': manualHitAnim }"
             :style="isDragging ? { transform: `rotate(${hammerRotation}deg)`, transition: 'none' } : { transition: 'transform 0.3s ease-out' }">
          <div class="hammer">
            <div class="hammer-head"></div>
            <div class="hammer-handle"></div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="maintenance-content">
      <h1 class="maintenance-title">Sistem Sedang Diperbaiki</h1>
      <p class="maintenance-message">{{ message }}</p>
    </div>

    <!-- Secret Login Modal -->
    <div v-if="showSecretLogin" class="secret-modal-overlay">
      <div class="secret-modal-content">
        <h2>Superadmin Override</h2>
        <form @submit.prevent="handleSecretLogin">
          <input type="text" v-model="username" placeholder="Username" required />
          <input type="password" v-model="password" placeholder="Password" required />
          <button type="submit" :disabled="isLoading">{{ isLoading ? 'Memproses...' : 'Login' }}</button>
        </form>
        <p v-if="loginError" class="error-msg">{{ loginError }}</p>
        <button class="close-btn" @click="closeSecretLogin">Batal</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const message = ref('Sistem sedang dalam perbaikan rutin. Silakan kembali lagi nanti.');

// --- Secret Trigger Logic (Drag & Drop) ---
const showSecretLogin = ref(false);
const hitCount = ref(0);
const maxHits = 3;

const wallRef = ref(null);
const hammerRef = ref(null);

const isAutoAnim = ref(true);
const isDragging = ref(false);
const hammerX = ref(0);
const hammerY = ref(0);
const startX = ref(0);
const startY = ref(0);

const hammerRotation = ref(0);
let velocityR = 0;
let rafId = null;
let lastX = 0;

const manualShake = ref(false);
const manualHitAnim = ref(false);

const isBrickBroken = (r, b) => {
  // Bata hancur bertahap berdasarkan hitCount
  if (hitCount.value === 0) return (r === 1 && b === 3) || (r === 2 && b === 2);
  if (hitCount.value === 1) return (r === 1 && b === 3) || (r === 2 && b === 2) || (r === 1 && b === 2);
  if (hitCount.value === 2) return (r === 1 && b === 3) || (r === 2 && b === 2) || (r === 1 && b === 2) || (r === 2 && b === 1) || (r === 3 && b === 3);
  return true; // Hancur semua jika hitCount >= 3
};

const physicsLoop = () => {
  if (!isDragging.value) return;
  
  // Fisika bandul/loyo
  // Palu condong ke bawah (misal 110 derajat karena pegangannya di bawah kanan)
  const dangleAngle = 110; 
  
  // Spring force menuju dangle angle
  const springForce = (dangleAngle - hammerRotation.value) * 0.05;
  velocityR += springForce;
  
  // Redaman (friction) agar tidak berayun selamanya
  velocityR *= 0.85; 
  
  hammerRotation.value += velocityR;
  
  rafId = requestAnimationFrame(physicsLoop);
};

const startDrag = (e) => {
  if (showSecretLogin.value) return;
  isDragging.value = true;
  isAutoAnim.value = false; // Matikan animasi pukul otomatis saat ditarik
  hammerRotation.value = 0; // Reset rotasi
  velocityR = 0;
  
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  startX.value = clientX - hammerX.value;
  startY.value = clientY - hammerY.value;
  lastX = clientX;
  
  physicsLoop();
};

const onDrag = (e) => {
  if (!isDragging.value) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  hammerX.value = clientX - startX.value;
  hammerY.value = clientY - startY.value;
  
  // Beri gaya (force) pada rotasi palu jika digeser secara horizontal
  const dx = clientX - lastX;
  velocityR -= dx * 0.8; // Ayunan kencang mengikuti geseran
  lastX = clientX;
};

const endDrag = (e) => {
  if (!isDragging.value) return;
  isDragging.value = false;
  cancelAnimationFrame(rafId);
  hammerRotation.value = 0;
  velocityR = 0;
  
  // Cek collision antara hammer dan wall
  if (wallRef.value && hammerRef.value) {
    const wallRect = wallRef.value.getBoundingClientRect();
    const hammerRect = hammerRef.value.getBoundingClientRect();
    
    // Simple AABB collision detection
    const isColliding = !(
      hammerRect.right < wallRect.left || 
      hammerRect.left > wallRect.right || 
      hammerRect.bottom < wallRect.top || 
      hammerRect.top > wallRect.bottom
    );
    
    if (isColliding) {
      // Hit success!
      hitCount.value++;
      
      // Animasi pukul manual dan tembok bergetar
      manualHitAnim.value = true;
      manualShake.value = true;
      
      setTimeout(() => {
        manualHitAnim.value = false;
        manualShake.value = false;
        if (hitCount.value >= maxHits) {
          showSecretLogin.value = true;
          hitCount.value = 0; // reset
        }
      }, 500);
    }
  }
  
  // Kembalikan palu ke posisi semula perlahan dengan CSS (transition)
  hammerX.value = 0;
  hammerY.value = 0;
  
  // Nyalakan lagi animasi otomatis setelah kembali (kasih jeda)
  setTimeout(() => {
    if (!isDragging.value && !showSecretLogin.value) {
      isAutoAnim.value = true;
    }
  }, 500);
};

onMounted(async () => {
  try {
    const res = await fetch('/api/maintenance');
    const data = await res.json();
    if (data.message) {
      message.value = data.message;
    }
  } catch (err) {
    console.error(err);
  }
});

// Secret Login Logic
const username = ref('');
const password = ref('');
const isLoading = ref(false);
const loginError = ref('');

const closeSecretLogin = () => {
  showSecretLogin.value = false;
  username.value = '';
  password.value = '';
  loginError.value = '';
};

const handleSecretLogin = async () => {
  isLoading.value = true;
  loginError.value = '';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        nim: username.value, 
        password: password.value,
        is_override_login: true
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('maintenance_bypassed', 'true');
      
      const roleToPath = {
        superadmin: '/superadmin',
        admin: '/admin',
        mahasiswa: '/mahasiswa'
      };
      window.location.href = roleToPath[data.user.role] || '/';
    } else {
      const data = await res.json();
      loginError.value = data.message || 'Login gagal.';
    }
  } catch (error) {
    loginError.value = 'Terjadi kesalahan jaringan.';
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.secret-indicator {
  position: absolute;
  top: 1rem;
  right: 1.5rem;
  font-size: 1.5rem;
  color: #94a3b8;
  letter-spacing: 0.2rem;
  opacity: 0.7;
}

.secret-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.secret-modal-content {
  background: #1e293b;
  padding: 2rem;
  border-radius: 8px;
  width: 90%;
  max-width: 400px;
  color: white;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  border: 1px solid #334155;
  text-align: left;
}

.secret-modal-content h2 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: #e2e8f0;
  font-size: 1.25rem;
  text-align: center;
}

.secret-modal-content form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.secret-modal-content input {
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid #475569;
  background: #0f172a;
  color: white;
  outline: none;
}

.secret-modal-content input:focus {
  border-color: #3b82f6;
}

.secret-modal-content button[type="submit"] {
  background: #3b82f6;
  color: white;
  padding: 0.75rem;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 0.5rem;
}

.secret-modal-content button[type="submit"]:hover {
  background: #2563eb;
}

.secret-modal-content button[type="submit"]:disabled {
  background: #475569;
  cursor: not-allowed;
}

.close-btn {
  background: transparent;
  color: #94a3b8;
  border: none;
  width: 100%;
  padding: 0.5rem;
  margin-top: 1rem;
  cursor: pointer;
}

.close-btn:hover {
  color: white;
}

.error-msg {
  color: #ef4444;
  font-size: 0.875rem;
  margin-top: 1rem;
  text-align: center;
}

.maintenance-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #f8fafc;
  font-family: 'Inter', sans-serif;
  color: #334155;
  text-align: center;
  padding: 2rem;
  overflow: hidden;
}

.animation-wrapper {
  position: relative;
  width: 250px;
  height: 200px;
  margin-bottom: 2rem;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* Wall Styles */
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

/* Animasi otomatis tembok bergetar jika isAutoAnim aktif */
.wall.shake-auto {
  animation: wall-shake 2s infinite linear;
}
.wall.shake-manual {
  animation: wall-shake 0.5s 1 linear; /* Getaran cepat saat dipukul manual */
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
}

/* Efek retakan pada bata tertentu */
.brick.broken::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: 
    linear-gradient(45deg, transparent 40%, rgba(0,0,0,0.1) 45%, transparent 50%),
    linear-gradient(-45deg, transparent 30%, rgba(0,0,0,0.1) 35%, transparent 40%);
  animation: crack-appear 2s infinite linear;
}

/* Debris Styles */
.debris {
  position: absolute;
  width: 12px;
  height: 8px;
  background: #cbd5e1;
  border: 1px solid #94a3b8;
  z-index: 3;
  opacity: 0;
}

.debris-1.fly { right: 80px; top: 100px; animation: fly-1 2s infinite linear; }
.debris-2.fly { right: 70px; top: 110px; animation: fly-2 2s infinite linear; }
.debris-3.fly { right: 90px; top: 120px; animation: fly-3 2s infinite linear; }

/* Hammer Wrapper untuk Drag */
.hammer-wrapper {
  position: absolute;
  right: 10px;
  bottom: 0px;
  width: 100px;
  height: 150px;
  z-index: 5;
  transition: transform 0.2s ease-out; /* Animasi kembali saat dilepas */
  touch-action: none; /* Mencegah scrolling halaman saat drag di mobile */
}

/* Hammer Styles */
.hammer-container {
  width: 100%;
  height: 100%;
  transform-origin: bottom right;
}

.hammer-container.auto-hit {
  animation: hit 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
}

.hammer-container.manual-hit {
  animation: hit-manual 0.4s 1 cubic-bezier(0.4, 0, 0.2, 1);
}

.hammer {
  position: absolute;
  top: 0;
  right: 0;
  width: 50px;
  height: 100px;
}

.hammer-head {
  position: absolute;
  top: 0;
  left: -20px;
  width: 60px;
  height: 30px;
  background: #334155;
  border-radius: 4px;
  box-shadow: inset 0 -4px 0 rgba(0,0,0,0.2);
}

.hammer-head::after {
  content: '';
  position: absolute;
  top: 50%;
  left: -10px;
  transform: translateY(-50%);
  width: 10px;
  height: 14px;
  background: #475569;
  border-radius: 2px 0 0 2px;
}

.hammer-handle {
  position: absolute;
  top: 15px;
  left: 5px;
  width: 12px;
  height: 70px;
  background: #b45309;
  border-radius: 0 0 4px 4px;
  box-shadow: inset -2px 0 0 rgba(0,0,0,0.2);
}

/* Animations */
@keyframes hit {
  0% { transform: rotate(0deg); }
  45% { transform: rotate(60deg); }
  50% { transform: rotate(-30deg); } /* Impact! */
  55% { transform: rotate(-10deg); } /* Bounce */
  60% { transform: rotate(-25deg); } /* Settle */
  70% { transform: rotate(0deg); }
  100% { transform: rotate(0deg); }
}

@keyframes hit-manual {
  0% { transform: rotate(60deg); }
  30% { transform: rotate(-30deg); } /* Impact! */
  50% { transform: rotate(-10deg); } /* Bounce */
  70% { transform: rotate(-25deg); } /* Settle */
  100% { transform: rotate(0deg); }
}

@keyframes wall-shake {
  0%, 49% { transform: translateX(0); }
  50% { transform: translateX(-4px) rotate(-1deg); } /* Pukulan masuk */
  52% { transform: translateX(4px) rotate(1deg); }
  54% { transform: translateX(-2px) rotate(0deg); }
  56% { transform: translateX(0); }
  100% { transform: translateX(0); }
}

@keyframes crack-appear {
  0%, 49% { opacity: 0; }
  50% { opacity: 1; }
  100% { opacity: 1; }
}

@keyframes fly-1 {
  0%, 49% { opacity: 0; transform: translate(0, 0) rotate(0); }
  50% { opacity: 1; transform: translate(0, 0) rotate(0); }
  70% { opacity: 0; transform: translate(30px, -40px) rotate(120deg) scale(0.5); }
  100% { opacity: 0; }
}

@keyframes fly-2 {
  0%, 49% { opacity: 0; transform: translate(0, 0) rotate(0); }
  50% { opacity: 1; transform: translate(0, 0) rotate(0); }
  75% { opacity: 0; transform: translate(50px, -20px) rotate(-150deg) scale(0.8); }
  100% { opacity: 0; }
}

@keyframes fly-3 {
  0%, 49% { opacity: 0; transform: translate(0, 0) rotate(0); }
  50% { opacity: 1; transform: translate(0, 0) rotate(0); }
  65% { opacity: 0; transform: translate(15px, -50px) rotate(90deg) scale(0.4); }
  100% { opacity: 0; }
}

.maintenance-content {
  max-width: 500px;
}

.maintenance-title {
  font-size: 2.5rem;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 1rem;
  text-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.maintenance-message {
  font-size: 1.15rem;
  color: #475569;
  line-height: 1.6;
}
</style>
