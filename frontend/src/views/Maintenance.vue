<template>
  <div class="maintenance-container">
    <div class="animation-wrapper">
      <div class="wall">
        <div class="brick-row" v-for="r in 4" :key="'r-'+r">
          <div class="brick" v-for="b in 3" :key="'b-'+b"></div>
        </div>
      </div>
      <div class="hammer-container">
        <div class="hammer">
          <div class="hammer-head"></div>
          <div class="hammer-handle"></div>
        </div>
      </div>
    </div>
    
    <div class="maintenance-content">
      <h1 class="maintenance-title">Under Maintenance</h1>
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
}

/* Hammer Styles */
.hammer-container {
  position: absolute;
  right: 10px;
  bottom: 0px;
  width: 100px;
  height: 150px;
  transform-origin: bottom center;
  z-index: 2;
  animation: hit 1.5s infinite ease-in-out;
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
  background: #475569;
  border-radius: 4px;
}

.hammer-head::after {
  content: '';
  position: absolute;
  top: 50%;
  left: -10px;
  transform: translateY(-50%);
  width: 10px;
  height: 14px;
  background: #64748b;
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
}

/* Hammer Animation */
@keyframes hit {
  0% { transform: rotate(0deg); }
  20% { transform: rotate(45deg); }
  40% { transform: rotate(-30deg); }
  50% { transform: rotate(0deg); }
  100% { transform: rotate(0deg); }
}

.maintenance-content {
  max-width: 500px;
}

.maintenance-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 1rem;
}

.maintenance-message {
  font-size: 1.1rem;
  color: #64748b;
  line-height: 1.6;
}
</style>
