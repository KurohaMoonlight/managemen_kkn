<template>
  <div class="maintenance-container">
    <div class="animation-wrapper">
      <div class="wall">
        <div class="brick-row" v-for="r in 4" :key="'r-'+r">
          <!-- Buat bata di baris pertama dan kedua sedikit hancur -->
          <div class="brick" 
               v-for="b in 3" 
               :key="'b-'+b" 
               :class="{'broken': (r === 1 && b === 3) || (r === 2 && b === 2)}">
          </div>
        </div>
      </div>
      
      <!-- Efek puing-puing (debris) yang terbang saat dipalu -->
      <div class="debris debris-1"></div>
      <div class="debris debris-2"></div>
      <div class="debris debris-3"></div>

      <div class="hammer-container">
        <div class="hammer">
          <div class="hammer-head"></div>
          <div class="hammer-handle"></div>
        </div>
      </div>
    </div>
    
    <div class="maintenance-content">
      <h1 class="maintenance-title">Sistem Sedang Diperbaiki</h1>
      <p class="maintenance-message">{{ message }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const message = ref('Sistem sedang dalam perbaikan rutin. Silakan kembali lagi nanti.');

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
</script>

<style scoped>
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
  animation: wall-shake 2s infinite linear;
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

.debris-1 { right: 80px; top: 100px; animation: fly-1 2s infinite linear; }
.debris-2 { right: 70px; top: 110px; animation: fly-2 2s infinite linear; }
.debris-3 { right: 90px; top: 120px; animation: fly-3 2s infinite linear; }

/* Hammer Styles */
.hammer-container {
  position: absolute;
  right: 10px;
  bottom: 0px;
  width: 100px;
  height: 150px;
  transform-origin: bottom right;
  z-index: 4;
  animation: hit 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
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
