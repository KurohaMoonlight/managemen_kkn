import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

let globalPollingInterval = null;
let globalListenerCount = 0;

/**
 * Polling maintenance status setiap 30 detik.
 * Jika maintenance aktif dan user tidak punya bypass/bukan superadmin → kick ke /maintenance.
 * Hanya satu interval yang berjalan global (shared antar semua komponen yang memakainya).
 */
export function useMaintenanceWatcher() {
  const router = useRouter();

  const checkAndKick = async () => {
    try {
      const res = await fetch('/api/maintenance');
      const data = await res.json();

      if (!data.is_maintenance) return; // Tidak maintenance, aman

      const user = JSON.parse(localStorage.getItem('user') || 'null');
      const isSuperadmin = user?.role === 'superadmin';
      const hasBypassed = localStorage.getItem('maintenance_bypassed') === 'true';

      if (isSuperadmin || hasBypassed) return; // Boleh tetap

      // Kick! Bersihkan session dan arahkan ke maintenance
      const currentPath = window.location.pathname;
      if (currentPath !== '/maintenance') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/maintenance');
      }
    } catch (e) {
      // Gagal fetch tidak perlu apa-apa, coba lagi nanti
    }
  };

  onMounted(() => {
    globalListenerCount++;
    if (globalListenerCount === 1) {
      // Jalankan langsung sekali, lalu setiap 30 detik
      checkAndKick();
      globalPollingInterval = setInterval(checkAndKick, 30_000);
    }
  });

  onUnmounted(() => {
    globalListenerCount--;
    if (globalListenerCount <= 0) {
      clearInterval(globalPollingInterval);
      globalPollingInterval = null;
      globalListenerCount = 0;
    }
  });
}

/**
 * Helper logout yang sadar maintenance.
 * Jika maintenance aktif → redirect ke /maintenance.
 * Jika tidak → redirect ke /login.
 */
export async function logoutWithMaintenanceCheck(router) {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('maintenance_bypassed');

  try {
    const res = await fetch('/api/maintenance');
    const data = await res.json();
    if (data.is_maintenance) {
      router.push('/maintenance');
      return;
    }
  } catch (e) {
    // Gagal fetch, fallback ke login
  }

  router.push('/login');
}
