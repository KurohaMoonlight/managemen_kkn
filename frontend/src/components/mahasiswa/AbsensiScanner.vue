<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { Html5Qrcode } from 'html5-qrcode';

const props = defineProps({
  token: { type: String, required: true },
  hasCheckedInToday: { type: Boolean, required: true },
  absensiData: { type: Object, default: null }
});

const emit = defineEmits(['refresh-absensi']);

// Scanner state
const isScanning = ref(false);
const scanStep = ref('idle'); // idle | scanning | getting_location | submitting | done | error
const scanMessage = ref('');
const scanError = ref('');
const scanResult = ref(null); // { status: 'hadir'|'telat', message }
let html5QrCode = null;

// Countdown to next day 07:00 WIB
const countdown = ref({ hours: '00', minutes: '00', seconds: '00' });
let countdownInterval = null;

const getNextCheckinTime = () => {
  const now = new Date();
  const target = new Date(now.getTime());
  target.setUTCHours(0, 0, 0, 0);
  if (now.getTime() >= target.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target.getTime();
};

const tickCountdown = () => {
  const targetMs = getNextCheckinTime();
  const nowMs = Date.now();
  let diff = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const h = Math.floor(diff / 3600);
  diff -= h * 3600;
  const m = Math.floor(diff / 60);
  const s = diff - m * 60;
  countdown.value = {
    hours: String(h).padStart(2, '0'),
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0'),
  };
};

const startCountdown = () => {
  if (countdownInterval) clearInterval(countdownInterval);
  tickCountdown();
  countdownInterval = setInterval(tickCountdown, 1000);
};

onMounted(() => {
  if (props.hasCheckedInToday) {
    startCountdown();
  }
});

watch(() => props.hasCheckedInToday, (newVal) => {
  if (newVal) {
    startCountdown();
  } else {
    if (countdownInterval) clearInterval(countdownInterval);
  }
});

onBeforeUnmount(() => {
  stopScanner();
  if (countdownInterval) clearInterval(countdownInterval);
});

const startScanner = () => {
  scanStep.value = 'scanning';
  scanError.value = '';
  scanMessage.value = 'Arahkan kamera ke QR Code di dinding Posko...';
  isScanning.value = true;
  
  setTimeout(() => {
    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 260, height: 260 } };
    
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, () => {})
      .catch((err) => {
        scanStep.value = 'error';
        scanError.value = 'Gagal mengakses kamera. Pastikan izin kamera diberikan di browser.';
        isScanning.value = false;
      });
  }, 100);
};

const stopScanner = async () => {
  if (html5QrCode && html5QrCode.isScanning) {
    try {
      await html5QrCode.stop();
      html5QrCode.clear();
    } catch(err) {}
  }
  isScanning.value = false;
};

const cancelScan = async () => {
  await stopScanner();
  scanStep.value = 'idle';
  scanError.value = '';
  scanMessage.value = '';
};

const onScanSuccess = async (decodedText) => {
  await stopScanner();
  scanStep.value = 'getting_location';
  scanMessage.value = '✅ QR terbaca! Mengambil koordinat GPS Anda...';
  requestLocation(decodedText);
};

const requestLocation = (qr_data) => {
  if (!navigator.geolocation) {
    scanStep.value = 'error';
    scanError.value = 'Browser Anda tidak mendukung Geolocation.';
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      scanStep.value = 'submitting';
      scanMessage.value = '📡 Memvalidasi lokasi & mengirim presensi...';
      submitAbsensi(qr_data, position.coords.latitude, position.coords.longitude);
    },
    (error) => {
      scanStep.value = 'error';
      if (error.code === error.PERMISSION_DENIED) {
        scanError.value = 'Izin lokasi (GPS) ditolak. Aktifkan GPS di pengaturan browser Anda.';
      } else {
        scanError.value = 'Gagal mendapatkan koordinat GPS. Pastikan GPS aktif dan coba lagi.';
      }
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
};

const submitAbsensi = async (qr_data, lat, lng) => {
  try {
    const res = await fetch('/api/mahasiswa/absensi/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${props.token}`
      },
      body: JSON.stringify({ qr_data, lat, lng })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      scanStep.value = 'done';
      scanResult.value = { status: data.status, message: data.message };
      setTimeout(() => {
        scanStep.value = 'idle';
        emit('refresh-absensi');
      }, 2000);
    } else {
      scanStep.value = 'error';
      scanError.value = data.message || 'Gagal memproses absensi.';
    }
  } catch(e) {
    scanStep.value = 'error';
    scanError.value = 'Kesalahan jaringan. Gagal terhubung ke server.';
  }
};
</script>

<template>
  <div class="status-card" :class="{ 'card-present': hasCheckedInToday, 'card-pending': !hasCheckedInToday }">
    <template v-if="hasCheckedInToday">
      <div class="status-badge" :class="absensiData?.status === 'hadir' ? 'badge-present' : 'badge-late'">
        <span class="badge-icon">{{ absensiData?.status === 'hadir' ? '✨' : '⚠️' }}</span>
        {{ absensiData?.status === 'hadir' ? 'Hadir Tepat Waktu' : 'Terlambat' }}
      </div>
      <div class="status-icon-wrapper">
        <div class="status-icon pulse-animation">🎉</div>
      </div>
      <h1 class="status-title">Presensi Berhasil!</h1>
      <p class="status-desc">Tercatat pada pukul <b>{{ absensiData?.waktu ? absensiData.waktu.slice(0, 5) : '--:--' }}</b> WIB.</p>
      
      <div class="countdown-area">
        <p class="countdown-label">Sesi Presensi Berikutnya</p>
        <div class="countdown-timer">
          <div class="countdown-unit">
            <span class="countdown-num">{{ countdown.hours }}</span>
            <span class="countdown-sub">Jam</span>
          </div>
          <span class="countdown-sep">:</span>
          <div class="countdown-unit">
            <span class="countdown-num">{{ countdown.minutes }}</span>
            <span class="countdown-sub">Mnt</span>
          </div>
          <span class="countdown-sep">:</span>
          <div class="countdown-unit">
            <span class="countdown-num">{{ countdown.seconds }}</span>
            <span class="countdown-sub">Dtk</span>
          </div>
        </div>
      </div>
    </template>
    
    <template v-else>
      <div class="status-icon-wrapper pending-wrapper">
        <div class="status-icon float-animation">📷</div>
      </div>
      <h1 class="status-title">Waktunya Presensi</h1>
      <p class="status-desc">Arahkan kamera ke <b>QR Code</b> posko untuk mencatat kehadiran harian Anda.</p>
      
      <div v-if="!isScanning && scanStep === 'idle'" class="scan-action">
        <button class="btn-scan" @click="startScanner">
          <span>Pindai QR Code</span>
          <svg style="width:20px;height:20px" viewBox="0 0 24 24"><path fill="currentColor" d="M4,4H10V10H4V4M20,4V10H14V4H20M14,15H16V13H14V11H16V13H18V11H20V13H18V15H20V18H18V20H16V18H13V20H11V16H14V15M16,15V18H18V15H16M4,20V14H10V20H4M6,6V8H8V6H6M16,6V8H18V6H16M6,16V18H8V16H6M4,11H6V13H4V11M9,11H13V15H11V13H9V11M11,6H13V10H11V6M2,2V6H0V2A2,2 0 0,1 2,0H6V2H2M22,0A2,2 0 0,1 24,2V6H22V2H18V0H22M2,18V22H6V24H2A2,2 0 0,1 0,22V18H2M22,22V18H24V22A2,2 0 0,1 22,24H18V22H22Z" /></svg>
        </button>
      </div>

      <div v-if="isScanning || scanStep !== 'idle'" class="scan-area">
        <p v-if="scanMessage" class="scan-hint">{{ scanMessage }}</p>
        
        <div v-show="scanStep === 'scanning'" id="reader" class="qr-reader"></div>
        
        <div v-if="scanStep === 'getting_location' || scanStep === 'submitting'" class="scan-processing">
          <div class="spinner"></div>
          <p>Memproses lokasi & data...</p>
        </div>

        <div v-if="scanStep === 'done' && scanResult" class="scan-result" :class="scanResult.status === 'hadir' ? 'result-ok' : 'result-late'">
          <div class="result-icon">{{ scanResult.status === 'hadir' ? '✅' : '⚠️' }}</div>
          <p>{{ scanResult.message }}</p>
        </div>

        <div v-if="scanStep === 'error'" class="scan-result result-error">
          <div class="result-icon">❌</div>
          <p>{{ scanError }}</p>
          <button class="btn-cancel btn-danger" @click="cancelScan">Coba Lagi</button>
        </div>

        <button v-if="isScanning" class="btn-cancel" @click="cancelScan">Batalkan</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.status-card {
  width: 100%;
  max-width: 480px;
  background: white;
  border-radius: 24px;
  padding: 3rem 2.5rem;
  text-align: center;
  box-shadow: 0 20px 40px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.05);
  border: 1px solid rgba(255,255,255,0.8);
  position: relative;
  overflow: hidden;
  animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.status-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; height: 6px;
  background: var(--color-primary);
  opacity: 0;
  transition: opacity 0.3s;
}

.card-present { 
  background: linear-gradient(180deg, #ffffff 0%, #f4fdf8 100%);
}
.card-present::before {
  background: linear-gradient(90deg, #10b981, #059669);
  opacity: 1;
}
.card-pending {
  background: linear-gradient(180deg, #ffffff 0%, #fefcfbf0 100%);
}
.card-pending::before {
  background: linear-gradient(90deg, #f59e0b, #d97706);
  opacity: 1;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1.25rem;
  border-radius: 99px;
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 2rem;
  letter-spacing: 0.3px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}
.badge-icon { font-size: 1rem; }
.badge-present {
  background: linear-gradient(135deg, #ecfdf5, #d1fae5);
  color: #047857;
  border: 1px solid rgba(16, 185, 129, 0.25);
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.12);
}
.badge-late {
  background: linear-gradient(135deg, #fff7ed, #ffedd5);
  color: #c2410c;
  border: 1px solid rgba(245, 158, 11, 0.3);
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.12);
}

.status-icon-wrapper {
  width: 90px;
  height: 90px;
  margin: 0 auto 1.5rem;
  background: linear-gradient(135deg, #e6fcf5, #c6f6d5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 25px rgba(16, 185, 129, 0.15);
}
.pending-wrapper {
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
  box-shadow: 0 10px 25px rgba(245, 158, 11, 0.15);
}
.status-icon { font-size: 3rem; }

.status-title { 
  font-family: var(--font-display); 
  font-size: 1.75rem; 
  color: #1e293b; 
  margin: 0 0 0.5rem; 
  font-weight: 800;
  letter-spacing: -0.5px;
}
.status-desc { 
  color: #64748b; 
  font-size: 0.95rem; 
  line-height: 1.6; 
  margin: 0 0 2rem; 
}

/* Modern Countdown */
.countdown-area {
  margin-top: 1rem;
  padding: 1.5rem;
  background: rgba(255,255,255,0.6);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  border: 1px solid rgba(16, 185, 129, 0.1);
  box-shadow: inset 0 2px 10px rgba(0,0,0,0.02);
}
.countdown-label { 
  font-size: 0.75rem; 
  color: #94a3b8; 
  text-transform: uppercase; 
  letter-spacing: 1.2px; 
  margin: 0 0 1.2rem; 
  font-weight: 700; 
}
.countdown-timer { 
  display: flex; justify-content: center; align-items: center; gap: 0.75rem; 
}
.countdown-unit { 
  display: flex; flex-direction: column; align-items: center; 
  min-width: 64px; background: white; padding: 0.75rem 0.5rem; 
  border-radius: 14px; box-shadow: 0 4px 15px rgba(0,0,0,0.04); 
  border: 1px solid #f1f5f9;
}
.countdown-num { 
  font-size: 1.8rem; font-weight: 800; font-family: var(--font-display); 
  background: linear-gradient(135deg, var(--color-primary), #059669);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1; margin-bottom: 0.2rem;
}
.countdown-sub { font-size: 0.65rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
.countdown-sep { font-size: 1.5rem; font-weight: 700; color: #cbd5e1; line-height: 1; margin-bottom: 1rem; }

/* Buttons & Scanner */
.scan-action { margin-top: 1.5rem; }
.btn-scan { 
  background: linear-gradient(135deg, var(--color-primary), #10b981); 
  color: white; border: none; padding: 1.1rem 2rem; 
  font-size: 1.05rem; font-weight: 700; border-radius: 16px; 
  cursor: pointer; transition: all 0.3s cubic-bezier(0.16,1,0.3,1); 
  display: inline-flex; align-items: center; gap: 0.75rem;
  box-shadow: 0 8px 25px rgba(16, 185, 129, 0.25); 
}
.btn-scan:hover { 
  transform: translateY(-3px); box-shadow: 0 12px 30px rgba(16, 185, 129, 0.35); 
}
.scan-area { margin-top: 2rem; }
.scan-hint { color: var(--color-primary); font-weight: 600; margin-bottom: 1.5rem; font-size: 0.95rem; }
.qr-reader { width: 100%; max-width: 300px; margin: 0 auto; border-radius: 20px; overflow: hidden; border: 3px solid var(--color-primary); box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
.btn-cancel { 
  margin-top: 1.5rem; background: transparent; border: 2px solid #e2e8f0; 
  color: #64748b; padding: 0.75rem 2rem; border-radius: 12px; 
  cursor: pointer; font-weight: 600; transition: all 0.2s; 
}
.btn-cancel:hover { background: #f1f5f9; color: #334155; }
.btn-danger { border-color: #fca5a5; color: #ef4444; }
.btn-danger:hover { background: #fef2f2; color: #dc2626; border-color: #f87171; }

.scan-processing { display: flex; flex-direction: column; align-items: center; gap: 1rem; margin-top: 2rem; color: #64748b; font-weight: 500; }
.scan-result { margin-top: 2rem; padding: 1.5rem; border-radius: 16px; text-align: center; border: 1px solid transparent; }
.result-ok { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
.result-late { background: #fffbeb; border-color: #fde68a; color: #92400e; }
.result-error { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
.result-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
.scan-result p { margin: 0; font-size: 0.95rem; font-weight: 600; }

.spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.8s linear infinite; }

/* Animations */
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes slideUpFade { 
  from { opacity: 0; transform: translateY(20px) scale(0.98); } 
  to { opacity: 1; transform: translateY(0) scale(1); } 
}
.pulse-animation { animation: pulse 2s infinite ease-in-out; }
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}
.float-animation { animation: float 3s infinite ease-in-out; }
@keyframes float {
  0% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
  100% { transform: translateY(0); }
}
</style>
