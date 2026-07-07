import { ref } from 'vue';
import L from 'leaflet';
import { useToast } from '../useNotification.js';
import { adminToken, poskoData, fetchPoskoSettings } from './adminContext.js';

export { poskoData };

export function useAdminGeofence() {
  const { success: toastSuccess, error: toastError } = useToast();

  // QR Generator States
  const qrValue = ref('Memuat...');
  const isRegenerating = ref(false);

  const loadQRSecret = async () => {
    try {
      const res = await fetch('/api/posko/qr', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        qrValue.value = data.qr_secret || 'KKN_POSKO_2026';
      }
    } catch (err) {
      console.error('Gagal memuat QR Secret', err);
      qrValue.value = 'KKN_POSKO_2026';
    }
  };

  const generateAbsenKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = 'KKN_';
    for (let i = 0; i < 8; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const regenerateQR = async () => {
    isRegenerating.value = true;
    const newSecret = generateAbsenKey();

    try {
      const res = await fetch('/api/posko/qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ qr_secret: newSecret }),
      });

      if (res.ok) {
        qrValue.value = newSecret;
      } else {
        const data = await res.json();
        toastError('Gagal menyimpan QR baru: ' + (data.message || 'Coba lagi.'));
      }
    } catch (err) {
      console.error('Regenerate QR error:', err);
      toastError('Terjadi kesalahan jaringan saat menyimpan QR.');
    } finally {
      setTimeout(() => {
        isRegenerating.value = false;
      }, 600);
    }
  };

  const printQR = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=500');
    const qrSvg = document.getElementById('qr-print-area').innerHTML;
    printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>QR Absensi KKN - Posko Wergu Wetan</title>
      <style>
        body { margin: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; font-family: Arial, sans-serif; background: #fff; }
        .print-wrapper { text-align: center; padding: 2rem; border: 2px dashed #aaa; border-radius: 12px; }
        h2 { font-size: 1.4rem; margin-bottom: 0.5rem; color: #202120; }
        p { color: #555; font-size: 0.9rem; margin-top: 0.5rem; }
        .key-box { font-family: monospace; font-size: 0.85rem; background: #f3f4f6; padding: 0.5rem 1rem; border-radius: 8px; margin-top: 0.75rem; color: #333; }
        canvas, svg { max-width: 220px; height: auto !important; }
      </style>
    </head>
    <body>
      <div class="print-wrapper">
        <h2>📍 Absensi KKN Wergu Wetan</h2>
        ${qrSvg}
        <p>Scan QR ini untuk presensi harian</p>
        <div class="key-box">${qrValue.value}</div>
      </div>
    </body>
    </html>
  `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // Map & Posko States
  const poskoLat = ref(-6.2);
  const poskoLng = ref(106.816666);
  const poskoRadius = ref(50);
  const poskoLastUpdated = ref(null);
  const isEditingPosko = ref(false);
  const verifiedAdminPassword = ref('');

  // Map Search & Autocomplete
  const locationSearchQuery = ref('');
  const searchSuggestions = ref([]);
  let searchTimeout = null;

  const handleSearchInput = async () => {
    if (searchTimeout) clearTimeout(searchTimeout);

    const query = locationSearchQuery.value.trim();

    if (query.startsWith('http://') || query.startsWith('https://')) {
      searchTimeout = setTimeout(async () => {
        try {
          let finalUrl = query;
          if (query.includes('goo.gl') || query.includes('maps.app')) {
            const res = await fetch('/api/resolve-link', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: query }),
            });
            const data = await res.json();
            finalUrl = data.longUrl || query;
          }

          const gmMatch =
            finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
            finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
            finalUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
            finalUrl.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
            finalUrl.match(/[?&]query=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
            finalUrl.match(/[?&]sll=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
            finalUrl.match(/[?&]center=(-?\d+\.\d+),(-?\d+\.\d+)/);

          if (gmMatch) {
            poskoLat.value = parseFloat(gmMatch[1]);
            poskoLng.value = parseFloat(gmMatch[2]);
            locationSearchQuery.value = `📍 Koordinat GMap: ${gmMatch[1]}, ${gmMatch[2]}`;
            updateMapVisuals();
            if (map) map.setView([poskoLat.value, poskoLng.value], 16);
          } else {
            const placenameMatch = finalUrl.match(/\/maps\/place\/([^/@]+)/);
            if (placenameMatch) {
              const placename = decodeURIComponent(placenameMatch[1].replace(/\+/g, ' ').split(',')[0]);
              locationSearchQuery.value = `🔎 Mencari tempat: "${placename}"...`;
              const nomiRes = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placename)}&limit=1`
              );
              const nomiData = await nomiRes.json();
              if (nomiData.length > 0) {
                poskoLat.value = parseFloat(nomiData[0].lat);
                poskoLng.value = parseFloat(nomiData[0].lon);
                locationSearchQuery.value = `📍 Ditemukan: ${nomiData[0].display_name.substring(0, 50)}...`;
                updateMapVisuals();
                if (map) map.setView([poskoLat.value, poskoLng.value], 16);
              } else {
                locationSearchQuery.value = '❌ Tempat tidak ditemukan. Coba tempel link lain atau cari manual.';
              }
            } else {
              locationSearchQuery.value = '❌ Gagal baca koordinat. Coba link lain atau ketik manual.';
            }
          }
        } catch (e) {
          console.error(e);
          locationSearchQuery.value = '❌ Gagal memproses link.';
        }
      }, 500);
      return;
    }

    if (query.length < 3) {
      searchSuggestions.value = [];
      return;
    }
    searchTimeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
        );
        const data = await res.json();
        searchSuggestions.value = data;
      } catch (e) {
        console.error(e);
      }
    }, 500);
  };

  const selectSuggestion = (s) => {
    poskoLat.value = parseFloat(s.lat);
    poskoLng.value = parseFloat(s.lon);
    locationSearchQuery.value = s.display_name;
    searchSuggestions.value = [];
    updateMapVisuals();
    if (map) map.setView([poskoLat.value, poskoLng.value], 15);
  };

  const isGettingGPS = ref(false);
  const useGPS = () => {
    if (!navigator.geolocation) {
      toastError('Browser Anda tidak mendukung GPS.');
      return;
    }
    isGettingGPS.value = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        poskoLat.value = pos.coords.latitude;
        poskoLng.value = pos.coords.longitude;
        locationSearchQuery.value = 'Lokasi Saat Ini (GPS)';
        updateMapVisuals();
        if (map) map.setView([poskoLat.value, poskoLng.value], 16);
        isGettingGPS.value = false;
      },
      (err) => {
        console.error(err);
        toastError(
          'Gagal mendeteksi lokasi otomatis. GPS tidak tersedia di PC/Laptop tanpa Location Services aktif. Gunakan fitur Cari manual.'
        );
        isGettingGPS.value = false;
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const showPasswordModal = ref(false);
  const adminPassword = ref('');
  const passwordError = ref('');
  const isVerifyingPassword = ref(false);

  const promptUnlockSettings = () => {
    adminPassword.value = '';
    passwordError.value = '';
    showPasswordModal.value = true;
  };

  const verifyAndUnlock = async () => {
    if (!adminPassword.value) {
      passwordError.value = 'Password harus diisi.';
      return;
    }
    isVerifyingPassword.value = true;
    passwordError.value = '';

    try {
      const adminData = JSON.parse(localStorage.getItem('user'));
      const adminId = adminData ? adminData.id : null;
      if (!adminId) throw new Error('Sesi tidak valid.');

      const res = await fetch('/api/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: adminId, password: adminPassword.value }),
      });
      const data = await res.json();

      if (res.ok) {
        verifiedAdminPassword.value = adminPassword.value;
        showPasswordModal.value = false;
        isEditingPosko.value = true;
      } else {
        passwordError.value = data.message || 'Password salah.';
      }
    } catch (e) {
      console.error(e);
      passwordError.value = 'Terjadi kesalahan sistem.';
    } finally {
      isVerifyingPassword.value = false;
    }
  };

  const savePoskoSettings = async () => {
    try {
      const adminData = JSON.parse(localStorage.getItem('user'));
      const res = await fetch('/api/posko', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          adminId: adminData.id,
          password: verifiedAdminPassword.value,
          lat: poskoLat.value,
          lng: poskoLng.value,
          radius: poskoRadius.value,
          qr_secret: qrValue.value,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        isEditingPosko.value = false;
        poskoLastUpdated.value = data.data.last_updated;
        toastSuccess('Pengaturan Geofencing & QR berhasil disimpan!');
      } else {
        toastError('Gagal menyimpan: ' + data.message);
      }
    } catch (e) {
      console.error(e);
      toastError('Gagal menyimpan pengaturan ke server.');
    }
  };

  const loadPoskoSettings = async () => {
    try {
      const data = await fetchPoskoSettings();
      if (data) {
        if (data.lat && data.lng) {
          poskoLat.value = parseFloat(data.lat);
          poskoLng.value = parseFloat(data.lng);
        }
        poskoRadius.value = data.radius || 50;
        poskoLastUpdated.value = data.last_updated;
      }
    } catch (e) {
      console.error('Gagal mengambil data posko:', e);
    }
  };

  let map = null;
  let mapMarker = null;
  let mapCircle = null;

  const updateMapVisuals = () => {
    if (!map) return;

    const latlng = [poskoLat.value, poskoLng.value];

    if (mapMarker) {
      mapMarker.setLatLng(latlng);
    } else {
      mapMarker = L.marker(latlng).addTo(map);
    }

    if (mapCircle) {
      mapCircle.setLatLng(latlng);
      mapCircle.setRadius(poskoRadius.value);
    } else {
      mapCircle = L.circle(latlng, {
        color: '#819A91',
        fillColor: '#819A91',
        fillOpacity: 0.3,
        radius: poskoRadius.value,
      }).addTo(map);
    }
  };

  const initMap = () => {
    map = L.map('posko-map').setView([poskoLat.value, poskoLng.value], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    updateMapVisuals();

    map.on('click', (e) => {
      if (!isEditingPosko.value) return;
      poskoLat.value = e.latlng.lat;
      poskoLng.value = e.latlng.lng;
      updateMapVisuals();
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 300);
  };

  const init = async () => {
    loadQRSecret();
    await loadPoskoSettings();
    await new Promise((r) => setTimeout(r, 100));
    initMap();
  };

  return {
    poskoData,
    qrValue,
    isRegenerating,
    loadQRSecret,
    regenerateQR,
    printQR,
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
    initMap,
    init,
  };
}
