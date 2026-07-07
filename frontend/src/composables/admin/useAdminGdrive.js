import { ref } from 'vue';
import { useToast } from '../useNotification.js';
import { adminToken } from './adminContext.js';

export function useAdminGdrive() {
  const { success: toastSuccess, error: toastError, warning: toastWarning, loading: toastLoading, dismiss: toastDismiss } = useToast();

  const gdriveStatus = ref({ connected: false, interval: 3, lastBackup: null });
  const gdriveLoading = ref(false);
  const backupRunning = ref(false);

  const fetchGDriveStatus = async () => {
    gdriveLoading.value = true;
    try {
      const res = await fetch('/api/backup/status', { headers: { Authorization: `Bearer ${adminToken}` } });
      if (res.ok) gdriveStatus.value = await res.json();
    } catch (e) {
      console.error('Failed fetching gdrive status', e);
    } finally {
      gdriveLoading.value = false;
    }
  };

  const connectGDrive = async () => {
    try {
      const res = await fetch('/api/google/auth', { headers: { Authorization: `Bearer ${adminToken}` } });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    } catch {
      toastError('Gagal menghubungkan layanan otentikasi Google.');
    }
  };

  const updateGDriveInterval = async (event) => {
    const interval = parseInt(event.target.value);
    gdriveStatus.value.interval = interval;
    try {
      const res = await fetch('/api/backup/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ interval }),
      });
      if (res.ok) toastSuccess('Jadwal backup otomatis diperbarui.');
    } catch {
      toastError('Gagal mengubah jadwal backup.');
    }
  };

  const manualBackup = async () => {
    if (backupRunning.value) return;
    backupRunning.value = true;
    const waitToastId = toastLoading({
      title: 'Backup ke Google Drive',
      message: 'Mengompresi PDF, arsip, dan data posko...',
      subtitle: 'Proses ini bisa memakan beberapa menit. Mohon jangan tutup halaman ini.',
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15 * 60 * 1000);
    try {
      const res = await fetch('/api/backup/manual', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        signal: controller.signal,
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = { message: res.ok ? 'Backup selesai.' : 'Respons server tidak valid.' };
      }
      toastDismiss(waitToastId);
      if (res.ok) {
        toastSuccess(data.message || 'Backup berhasil diunggah ke Google Drive!');
        fetchGDriveStatus();
      } else if (res.status === 429) {
        toastWarning(data.message || 'Backup masih berjalan, mohon tunggu.');
      } else {
        toastError(data.message || 'Gagal mengirim backup.');
      }
    } catch (e) {
      toastDismiss(waitToastId);
      if (e.name === 'AbortError') {
        toastError('Backup timeout (>15 menit). Cek Google Drive — file mungkin sudah terunggah.');
      } else {
        toastError('Koneksi terputus saat backup. Restart backend lalu coba lagi.');
      }
    } finally {
      clearTimeout(timeoutId);
      backupRunning.value = false;
    }
  };

  return {
    gdriveStatus,
    gdriveLoading,
    backupRunning,
    fetchGDriveStatus,
    connectGDrive,
    updateGDriveInterval,
    manualBackup,
  };
}
