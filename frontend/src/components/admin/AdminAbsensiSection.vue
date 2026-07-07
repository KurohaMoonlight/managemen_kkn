<script setup>
import { onMounted } from 'vue';
import CetakAbsensiModal from '../CetakAbsensiModal.vue';
import CetakLogbookModal from '../CetakLogbookModal.vue';
import { adminToken, currentAdminUser } from '../../composables/admin/adminContext.js';
import { useAdminAbsensi } from '../../composables/admin/useAdminAbsensi.js';

const {
  selectedDate,
  currentCalendarMonth,
  absensiData,
  absensiLoading,
  showPeriodeModal,
  editPeriode,
  isSavingPeriode,
  periodeError,
  showAbsenModal,
  absensiTableRef,
  newAbsen,
  isSavingAbsen,
  absenError,
  showCetakModal,
  showCetakLogbookModal,
  calendarDays,
  periodDates,
  allMahasiswaList,
  formatDateStr,
  selectDate,
  changeMonth,
  promptPeriodeModal,
  savePeriode,
  openAddAbsenModal,
  exportAbsensiExcel,
  submitAddAbsen,
  init,
} = useAdminAbsensi();

onMounted(init);
</script>

<template>
  <!-- NEW GRID: Calendar & Absensi -->
  <div class="bottom-grid">
    <!-- Calendar Card -->
    <div class="card calendar-card">
      <div style="display:flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem; margin-bottom: 1rem;">
        <h2 style="border:none; margin:0; padding:0;">Kalender Absensi</h2>
        <button class="btn btn-outline btn-small" @click="promptPeriodeModal">⚙️ Atur Periode</button>
      </div>

      <div class="calendar-header">
        <button @click="changeMonth(-1)" class="btn-cal">◀</button>
        <h3 class="cal-month">{{ currentCalendarMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) }}</h3>
        <button @click="changeMonth(1)" class="btn-cal">▶</button>
      </div>

      <div class="calendar-grid">
        <div class="cal-day-name">Min</div>
        <div class="cal-day-name">Sen</div>
        <div class="cal-day-name">Sel</div>
        <div class="cal-day-name">Rab</div>
        <div class="cal-day-name">Kam</div>
        <div class="cal-day-name">Jum</div>
        <div class="cal-day-name">Sab</div>

        <div
          v-for="(day, index) in calendarDays"
          :key="index"
          class="cal-cell"
          :class="{
            'empty': day.empty,
            'disabled': !day.empty && !day.inPeriod,
            'active': day.dateStr === selectedDate,
            'today': day.isToday
          }"
          @click="!day.empty && day.inPeriod && selectDate(day.dateStr)"
        >
          {{ day.empty ? '' : day.day }}
        </div>
      </div>

      <div class="cal-legend">
        <span class="legend-item"><span class="box active"></span> Dipilih</span>
        <span class="legend-item"><span class="box in-period"></span> Periode KKN</span>
        <span class="legend-item"><span class="box disabled"></span> Luar Periode</span>
      </div>
    </div>

    <!-- Absensi Table Card -->
    <div class="card absensi-card">
      <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
        <h2 style="border:none; margin:0; padding:0;">Laporan Absensi ({{ formatDateStr(selectedDate) }})</h2>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-outline btn-small" style="background-color: #10b981; color: white; border-color: #10b981; flex: 1; min-width: 120px;" @click="exportAbsensiExcel">📊 Excel</button>
          <button class="btn btn-outline btn-small" style="background-color: #f59e0b; color: white; border-color: #f59e0b; flex: 1; min-width: 120px;" @click="showCetakLogbookModal = true">📄 Cetak Logbook</button>
          <button class="btn btn-outline btn-small" style="background-color: #ef4444; color: white; border-color: #ef4444; flex: 1; min-width: 120px;" @click="showCetakModal = true">📄 PDF Absensi</button>
          <button class="btn btn-primary btn-small" style="flex: 1; min-width: 120px;" @click="openAddAbsenModal">+ Tambah Manual</button>
        </div>
      </div>

      <!-- Horizontal Date Scroller -->
      <div class="date-scroller-wrapper">
        <div class="date-scroller" v-if="periodDates.length > 0">
          <button
            v-for="d in periodDates"
            :key="d.dateStr"
            class="date-pill"
            :class="{'active': selectedDate === d.dateStr}"
            @click="selectDate(d.dateStr)"
          >
            {{ d.display }}
          </button>
        </div>
        <div v-else class="text-muted" style="font-size: 0.85rem; padding: 0.5rem 0;">
          Periode KKN belum diatur.
        </div>
      </div>

      <!-- Absensi Table -->
      <div ref="absensiTableRef" class="table-responsive mt-3" style="max-height: 400px; overflow-y: auto;">
        <table class="users-table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>NIM</th>
              <th>Nama Lengkap</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody v-if="absensiLoading">
            <tr>
              <td colspan="4" class="text-center py-4">Memuat data...</td>
            </tr>
          </tbody>
          <tbody v-else-if="absensiData.length === 0">
            <tr>
              <td colspan="4" class="text-center py-4 text-muted">Belum ada data absen pada tanggal ini.</td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr v-for="absen in absensiData" :key="absen.id">
              <td class="font-bold text-primary">{{ absen.waktu }}</td>
              <td class="font-mono">{{ absen.nim }}</td>
              <td>{{ absen.nama_lengkap }}</td>
              <td>
                <span class="role-badge" :class="{'admin': absen.status === 'hadir', 'mahasiswa': absen.status !== 'hadir'}" :title="absen.alasan">
                  {{ absen.status.toUpperCase() }} {{ absen.alasan ? '- ' + absen.alasan : '' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Periode KKN Modal -->
  <div class="modal-overlay" v-if="showPeriodeModal" @click.self="showPeriodeModal = false">
    <div class="modal-content animate-slide-up">
      <div style="font-size: 2.5rem; text-align:center;">🗓️</div>
      <h2 style="text-align:center; margin-top:0;">Pengaturan Periode KKN</h2>

      <form @submit.prevent="savePeriode">
        <div class="form-group">
          <label>Tanggal Mulai</label>
          <input type="date" v-model="editPeriode.start" required />
        </div>
        <div class="form-group">
          <label>Tanggal Selesai</label>
          <input type="date" v-model="editPeriode.end" required />
        </div>

        <hr style="border:0; border-top: 1px solid var(--color-border); margin: 1.5rem 0;" />

        <div class="form-group">
          <label>Password Admin (Otorisasi)</label>
          <input type="password" v-model="editPeriode.password" placeholder="Masukkan password admin..." autocomplete="new-password" required />
        </div>

        <div v-if="periodeError" class="error-msg">{{ periodeError }}</div>

        <div class="modal-actions">
          <button type="button" class="btn btn-outline" @click="showPeriodeModal = false">Batal</button>
          <button type="submit" class="btn btn-primary" :disabled="isSavingPeriode">
            {{ isSavingPeriode ? 'Menyimpan...' : 'Simpan Periode' }}
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- Manual Absensi Modal -->
  <div class="modal-overlay" v-if="showAbsenModal" @click.self="showAbsenModal = false">
    <div class="modal-content animate-slide-up">
      <h2 style="margin-top:0;">Tambah Presensi Manual</h2>
      <p class="text-muted" style="margin-bottom: 1.5rem; font-size: 0.9rem;">
        Presensi ditambahkan untuk tanggal: <strong class="text-primary">{{ formatDateStr(selectedDate) }}</strong>
      </p>

      <form @submit.prevent="submitAddAbsen">
        <div class="form-group">
          <label>Mahasiswa</label>
          <select v-model="newAbsen.user_id" required>
            <option value="" disabled>-- Pilih Mahasiswa --</option>
            <option v-for="m in allMahasiswaList" :key="m.id" :value="m.id">
              {{ m.nim }} - {{ m.nama_lengkap }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Waktu (Jam:Menit)</label>
          <input type="time" v-model="newAbsen.waktu" required />
        </div>

        <div class="form-group">
          <label>Status</label>
          <select v-model="newAbsen.status" required>
            <option value="hadir">Hadir</option>
            <option value="izin">Izin</option>
            <option value="sakit">Sakit</option>
          </select>
        </div>

        <div class="form-group" v-if="newAbsen.status === 'izin' || newAbsen.status === 'sakit'">
          <label>Alasan / Keterangan</label>
          <input type="text" v-model="newAbsen.alasan" placeholder="Masukkan alasan (opsional)" />
        </div>

        <div v-if="absenError" class="error-msg">{{ absenError }}</div>

        <div class="modal-actions">
          <button type="button" class="btn btn-outline" @click="showAbsenModal = false">Batal</button>
          <button type="submit" class="btn btn-primary" :disabled="isSavingAbsen">
            {{ isSavingAbsen ? 'Menyimpan...' : 'Simpan Presensi' }}
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- Cetak Absensi Modal -->
  <CetakAbsensiModal
    :show="showCetakModal"
    :posko-id="currentAdminUser.posko_id"
    :token="adminToken"
    @close="showCetakModal = false"
  />

  <!-- Cetak Logbook Modal -->
  <CetakLogbookModal
    :show="showCetakLogbookModal"
    :posko-id="currentAdminUser.posko_id"
    :token="adminToken"
    @close="showCetakLogbookModal = false"
  />
</template>

<style scoped>
/* Bottom Grid (Calendar & Absensi) */
.bottom-grid {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 1.5rem;
  margin-top: 2rem;
}

/* Calendar Styles */
.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.btn-cal {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  color: var(--color-primary);
}
.btn-cal:hover {
  background: var(--bg-main);
}
.cal-month {
  margin: 0;
  font-size: 1.1rem;
  font-family: var(--font-display);
  font-weight: 600;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.cal-day-name {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}
.cal-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  background-color: rgba(129, 154, 145, 0.1);
  color: var(--text-main);
  transition: all 0.2s;
  border: 1px solid transparent;
}
.cal-cell:hover:not(.empty):not(.disabled) {
  background-color: rgba(129, 154, 145, 0.3);
  transform: translateY(-1px);
}
.cal-cell.empty {
  background: transparent;
  cursor: default;
}
.cal-cell.disabled {
  background-color: transparent;
  color: #ccc;
  cursor: not-allowed;
  text-decoration: line-through;
}
.cal-cell.today {
  border: 1px solid var(--color-primary);
  font-weight: bold;
}
.cal-cell.active {
  background-color: var(--color-primary);
  color: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.cal-legend {
  display: flex;
  justify-content: space-around;
  margin-top: 1.5rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.legend-item .box {
  width: 12px; height: 12px; border-radius: 3px;
}
.legend-item .box.active { background: var(--color-primary); }
.legend-item .box.in-period { background: rgba(129, 154, 145, 0.1); border: 1px solid var(--color-border); }
.legend-item .box.disabled { background: transparent; border: 1px dashed #ccc; }

/* Horizontal Date Scroller */
.date-scroller-wrapper {
  margin: 1rem 0;
  position: relative;
}
.date-scroller {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.75rem;
  scroll-behavior: smooth;
}
.date-scroller::-webkit-scrollbar {
  height: 6px;
}
.date-scroller::-webkit-scrollbar-thumb {
  background-color: var(--color-border);
  border-radius: 4px;
}
.date-pill {
  padding: 0.5rem 1rem;
  transition: all 0.2s;
}
.date-pill:hover {
  background: rgba(129, 154, 145, 0.2);
}
.date-pill.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.text-primary { color: var(--color-primary); }

.absensi-card {
  min-width: 0;
}

@media (max-width: 900px) {
  .bottom-grid {
    grid-template-columns: 1fr;
  }
}
</style>
