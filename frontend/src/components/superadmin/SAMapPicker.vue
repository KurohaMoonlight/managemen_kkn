<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

/**
 * SAMapPicker.vue
 * Komponen reusable untuk memilih koordinat via peta Leaflet.
 * Mendukung: klik peta, drag marker, search nama tempat (Nominatim),
 * paste link Google Maps, dan GPS browser.
 *
 * Props: lat, lng (number)
 * Emits: update:lat, update:lng
 */
const props = defineProps({
  lat: { type: [Number, String], default: -7.0 },
  lng: { type: [Number, String], default: 110.4 },
});
const emit = defineEmits(['update:lat', 'update:lng']);

// ─── Map Instance ─────────────────────────────────────────────────────────
let mapInstance = null;
let mapMarker = null;

const initMap = () => {
  if (mapInstance) { mapInstance.remove(); mapInstance = null; mapMarker = null; }
  const el = document.getElementById('sa-map-picker');
  if (!el) return;
  const lat = parseFloat(props.lat) || -7.0;
  const lng = parseFloat(props.lng) || 110.4;
  mapInstance = L.map('sa-map-picker').setView([lat, lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapInstance);
  mapMarker = L.marker([lat, lng], { draggable: true }).addTo(mapInstance);

  mapMarker.on('dragend', (e) => {
    const pos = e.target.getLatLng();
    emit('update:lat', parseFloat(pos.lat.toFixed(6)));
    emit('update:lng', parseFloat(pos.lng.toFixed(6)));
  });

  mapInstance.on('click', (e) => {
    emit('update:lat', parseFloat(e.latlng.lat.toFixed(6)));
    emit('update:lng', parseFloat(e.latlng.lng.toFixed(6)));
    mapMarker.setLatLng(e.latlng);
  });

  mapInstance.on('moveend', () => {
    const center = mapInstance.getCenter();
    emit('update:lat', parseFloat(center.lat.toFixed(6)));
    emit('update:lng', parseFloat(center.lng.toFixed(6)));
    mapMarker.setLatLng(center);
  });
};

// Saat lat/lng berubah dari luar, update marker
watch([() => props.lat, () => props.lng], ([lat, lng]) => {
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  if (!isNaN(parsedLat) && !isNaN(parsedLng) && mapInstance && mapMarker) {
    mapMarker.setLatLng([parsedLat, parsedLng]);
  }
});

onMounted(() => {
  // Delay sedikit agar DOM modal sudah render
  setTimeout(initMap, 100);
});

onUnmounted(() => {
  if (mapInstance) { mapInstance.remove(); mapInstance = null; mapMarker = null; }
});

// ─── Location Search & Autocomplete ──────────────────────────────────────
const locationSearchQuery = ref('');
const searchSuggestions = ref([]);
let searchTimeout = null;

const handleSearchInput = async () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  const query = locationSearchQuery.value.trim();

  // 1. Google Maps URL Detector
  if (query.startsWith('http://') || query.startsWith('https://')) {
    searchTimeout = setTimeout(async () => {
      try {
        let finalUrl = query;
        if (query.includes('goo.gl') || query.includes('maps.app')) {
          const res = await fetch('/api/resolve-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: query })
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
          emit('update:lat', parseFloat(gmMatch[1]));
          emit('update:lng', parseFloat(gmMatch[2]));
          locationSearchQuery.value = `📍 Koordinat GMap: ${gmMatch[1]}, ${gmMatch[2]}`;
          if (mapInstance) mapInstance.setView([parseFloat(gmMatch[1]), parseFloat(gmMatch[2])], 16);
        } else {
          const placenameMatch = finalUrl.match(/\/maps\/place\/([^/@]+)/);
          if (placenameMatch) {
            const placename = decodeURIComponent(placenameMatch[1].replace(/\+/g, ' ').split(',')[0]);
            locationSearchQuery.value = `🔎 Mencari: "${placename}"...`;
            const nomiRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placename)}&limit=1`);
            const nomiData = await nomiRes.json();
            if (nomiData.length > 0) {
              emit('update:lat', parseFloat(nomiData[0].lat));
              emit('update:lng', parseFloat(nomiData[0].lon));
              locationSearchQuery.value = `📍 Ditemukan: ${nomiData[0].display_name.substring(0, 50)}...`;
              if (mapInstance) mapInstance.setView([parseFloat(nomiData[0].lat), parseFloat(nomiData[0].lon)], 16);
            } else {
              locationSearchQuery.value = '❌ Tempat tidak ditemukan.';
            }
          } else {
            locationSearchQuery.value = '❌ Gagal baca koordinat/link GMap.';
          }
        }
      } catch (e) {
        locationSearchQuery.value = '❌ Gagal memproses link.';
      }
    }, 500);
    return;
  }

  // 2. Normal Geocoding Autocomplete
  if (query.length < 3) {
    searchSuggestions.value = [];
    return;
  }
  searchTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
      searchSuggestions.value = await res.json();
    } catch (e) {
      console.error(e);
    }
  }, 500);
};

const selectSuggestion = (s) => {
  emit('update:lat', parseFloat(s.lat));
  emit('update:lng', parseFloat(s.lon));
  locationSearchQuery.value = s.display_name;
  searchSuggestions.value = [];
  if (mapInstance) mapInstance.setView([parseFloat(s.lat), parseFloat(s.lon)], 15);
};

// ─── GPS ──────────────────────────────────────────────────────────────────
const isGettingGPS = ref(false);
const useGPS = () => {
  if (!navigator.geolocation) return;
  isGettingGPS.value = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      emit('update:lat', pos.coords.latitude);
      emit('update:lng', pos.coords.longitude);
      locationSearchQuery.value = '📍 Lokasi GPS Anda ditemukan.';
      if (mapInstance) mapInstance.setView([pos.coords.latitude, pos.coords.longitude], 16);
      isGettingGPS.value = false;
    },
    () => { isGettingGPS.value = false; },
    { enableHighAccuracy: true }
  );
};
</script>

<template>
  <div class="map-picker-wrap">
    <div class="map-search-row">
      <input
        type="text"
        v-model="locationSearchQuery"
        placeholder="Cari daerah atau tempel link GMap..."
        @input="handleSearchInput"
        class="map-search-input"
      />
      <button class="sa-btn sa-btn-outline" type="button" @click="useGPS" :disabled="isGettingGPS">
        {{ isGettingGPS ? '...' : '🎯 GPS' }}
      </button>
      <ul v-if="searchSuggestions.length > 0" class="autocomplete-dropdown">
        <li v-for="s in searchSuggestions" :key="s.place_id" @click="selectSuggestion(s)">
          {{ s.display_name }}
        </li>
      </ul>
    </div>
    <div id="sa-map-picker" class="sa-map-container"></div>
  </div>
</template>

<style scoped>
.map-picker-wrap { display: flex; flex-direction: column; gap: 0.5rem; }

.map-search-row {
  display: flex;
  gap: 0.5rem;
  position: relative;
}

.map-search-input {
  flex-grow: 1;
  padding: 0.6rem 1rem;
  border-radius: 10px;
  border: 1.5px solid rgba(148,163,184,0.2);
  background: #0f172a;
  color: #f1f5f9;
  font-size: 0.9rem;
  outline: none;
}
.map-search-input:focus { border-color: #6366f1; }

.sa-map-container { height: 300px; border-radius: 12px; overflow: hidden; border: 1.5px solid rgba(148,163,184,0.2); }

.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 80px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  max-height: 200px;
  overflow-y: auto;
  list-style: none;
  padding: 0;
  margin: 4px 0 0 0;
  z-index: 2000;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.autocomplete-dropdown li {
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}
.autocomplete-dropdown li:hover { background: #f8fafc; }
.autocomplete-dropdown li:last-child { border-bottom: none; }
</style>
