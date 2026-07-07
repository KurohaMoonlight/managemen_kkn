<script setup>
import { onMounted, inject } from 'vue';
import { useAdminPic } from '../../composables/admin/useAdminPic.js';

const props = defineProps({
  onRefreshExplorer: {
    type: Function,
    default: null,
  },
});

const emit = defineEmits(['refresh-explorer']);

const injectedRefresh = inject('onRefreshExplorer', null);

const resolveRefreshExplorer = () => {
  if (typeof props.onRefreshExplorer === 'function') {
    props.onRefreshExplorer();
  } else if (typeof injectedRefresh === 'function') {
    injectedRefresh();
  } else {
    emit('refresh-explorer');
  }
};

const {
  picGroups,
  picForm,
  isSubmittingPic,
  picError,
  editingPic,
  isDeletingPic,
  showMinMaxModal,
  selectedPicForSettings,
  formMinMax,
  isSavingMinMax,
  showGlobalMinMaxModal,
  formGlobalMinMax,
  isSavingGlobalMinMax,
  mahasiswaList,
  fetchPicGroups,
  resetPicForm,
  startEditPic,
  poskoMinAnggota,
  poskoMaxAnggota,
  submitPicForm,
  openMinMaxSettings,
  openGlobalMinMaxSettings,
  saveMinMaxSettings,
  saveGlobalMinMaxSettings,
  deletePic,
} = useAdminPic({ onRefreshExplorer: resolveRefreshExplorer });

onMounted(() => {
  fetchPicGroups();
});
</script>

<template>
  <!-- NEW SECTION: PIC & PROKER -->
  <div class="pic-section-grid" style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 2rem; margin-top: 2rem;">
    <!-- Left: Form -->
    <div class="card card-shadow pic-form-card" style="border: 1px solid var(--color-border);">
      <div class="card-header" :style="editingPic ? 'background: linear-gradient(135deg, #3b82f6, #1d4ed8); display: flex; justify-content: space-between; align-items: center;' : 'display: flex; justify-content: space-between; align-items: center;'">
        <h3 style="margin:0;">{{ editingPic ? '✏️ Edit Kelompok PIC' : '📝 Buat Kelompok PIC' }}</h3>
        <button type="button" @click.prevent.stop="openGlobalMinMaxSettings" title="Pengaturan Global (Posko)" style="position: relative; z-index: 50; pointer-events: auto; background: transparent; border: none; cursor: pointer; font-size: 1.3rem; padding: 0.25rem; color: inherit; transition: transform 0.2s;" onmouseover="this.style.transform='rotate(45deg)'" onmouseout="this.style.transform='none'">⚙️</button>
      </div>
      <div class="card-body">
        <!-- Edit mode info banner -->
        <div v-if="editingPic" style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem; font-size: 0.85rem; color: #1e40af;">
          ✏️ Mode Edit: <strong>{{ editingPic.nama_pic }}</strong>. Mahasiswa yang sudah bergabung PIC lain tidak dapat dipilih.
        </div>
        <form @submit.prevent="submitPicForm">
          <div class="form-group">
            <label>Nama PIC (Divisi/Kelompok)</label>
            <input type="text" v-model="picForm.nama_pic" placeholder="Contoh: Divisi Acara" required />
          </div>
          <div class="form-group">
            <label>Program Kerja (Proker)</label>
            <input type="text" v-model="picForm.proker" placeholder="Contoh: Senam Pagi" required />
          </div>
          <div class="form-group">
            <label>Pilih Mahasiswa (Minimal {{ poskoMinAnggota }} Anggota)</label>
            <div class="checkbox-group" style="max-height: 150px; overflow-y: auto; border: 1px solid var(--color-border); padding: 0.8rem; border-radius: 8px; background: var(--bg-main);">
              <div v-if="mahasiswaList.length === 0" class="text-muted" style="font-size: 0.85rem; padding: 0.5rem 0;">
                Semua mahasiswa sudah terdaftar di PIC lain.
              </div>
              <label v-for="mhs in mahasiswaList" :key="mhs.id" style="display: flex; align-items: center; margin-bottom: 0.5rem; cursor: pointer; font-size: 0.9rem;">
                <input type="checkbox" :value="mhs.id" v-model="picForm.selectedMahasiswa"
                  :disabled="picForm.selectedMahasiswa.length >= 4 && !picForm.selectedMahasiswa.includes(mhs.id)"
                  style="margin-right: 8px; width: 16px; height: 16px; cursor: inherit;" />
                {{ mhs.nama_lengkap }} <span class="text-muted" style="margin-left:4px;">({{ mhs.nim }})</span>
              </label>
            </div>
            <small class="text-muted">Terpilih: <b>{{ picForm.selectedMahasiswa.length }}</b> mahasiswa</small>
          </div>
          <div v-if="picError" class="error-msg" style="margin-bottom: 1rem;">{{ picError }}</div>
          <div style="display: flex; gap: 0.5rem;">
            <button v-if="editingPic" type="button" class="btn btn-outline" style="flex: 1; justify-content:center;" @click="resetPicForm">
              ✕ Batal
            </button>
            <button type="submit" class="btn btn-primary" style="flex: 2; justify-content:center;" :disabled="isSubmittingPic">
              {{ isSubmittingPic ? 'Menyimpan...' : (editingPic ? '💾 Simpan Perubahan' : 'Simpan & Buat Folder') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Right: PIC List -->
    <div class="card card-shadow" style="border: 1px solid var(--color-border);">
      <div class="card-header">
        <h3 style="margin:0;">👥 Daftar PIC & Proker</h3>
      </div>
      <div class="card-body" style="max-height: 440px; overflow-y: auto;">
        <div v-if="picGroups.length === 0" class="text-muted text-center" style="padding: 2rem;">
          Belum ada kelompok PIC yang dibentuk.
        </div>
        <div v-else style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.2rem; padding-right: 0.5rem;">
          <div v-for="group in picGroups" :key="group.id"
            class="pic-card" :class="{'is-editing': editingPic?.id === group.id}">
            <div class="pic-card-header">
              <h4 class="pic-card-title">{{ group.nama_pic }}</h4>
              <button type="button" class="btn-pic-settings" @click.prevent.stop="openMinMaxSettings(group)" title="Pengaturan Batas Anggota Khusus">⚙️</button>
            </div>
            <div class="pic-card-content">
              <p class="pic-proker"><strong>Proker:</strong> {{ group.proker }}</p>
              <div class="pic-members-header">
                <span>Anggota ({{ group.members.length }})</span>
                <span class="badge-warning" v-if="group.members.length < (group.min_anggota || 2)">⚠️ Kurang</span>
              </div>
              <ul class="pic-members-list">
                <li v-for="(member, idx) in group.members" :key="idx">{{ member }}</li>
              </ul>
            </div>
            <!-- Action buttons -->
            <div style="display: flex; gap: 0.4rem; margin-top: 0.5rem;">
              <button
                class="btn btn-outline btn-small"
                style="flex: 1; justify-content: center; font-size: 0.78rem;"
                @click="startEditPic(group)"
                :disabled="isDeletingPic === group.id">
                ✏️ Edit
              </button>
              <button
                class="btn btn-small"
                style="flex: 1; justify-content: center; font-size: 0.78rem; background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5;"
                @click="deletePic(group)"
                :disabled="isDeletingPic === group.id">
                {{ isDeletingPic === group.id ? '...' : '🗑️ Hapus' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Global Min Max Settings Modal -->
  <div v-if="showGlobalMinMaxModal" class="modal-overlay" @click.self="showGlobalMinMaxModal = false">
    <div class="modal-content" style="padding: 1.5rem; width: 360px; max-width: 90%;">
      <h3 style="margin-top: 0; color: var(--text-main);">⚙️ Pengaturan Global Posko</h3>
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">Atur batas minimum dan maksimum anggota untuk seluruh kelompok PIC di Posko ini sebagai standar (default).</p>

      <div class="form-group">
        <label>Minimal Anggota (Standar)</label>
        <input type="number" v-model="formGlobalMinMax.default_min_anggota" class="form-input" placeholder="Contoh: 2" min="1" style="width: 100%; box-sizing: border-box;" />
        <small style="font-size:0.75rem; color:#64748b;">Standar: 2 (Akan memicu peringatan jika anggota kurang)</small>
      </div>

      <div class="form-group" style="margin-top: 1rem;">
        <label>Maksimal Anggota (Standar)</label>
        <input type="number" v-model="formGlobalMinMax.default_max_anggota" class="form-input" placeholder="Tidak ada batas (Kosongkan)" min="1" style="width: 100%; box-sizing: border-box;" />
        <small style="font-size:0.75rem; color:#64748b;">(Kosongkan jika tak ada batas maksimal)</small>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem;">
        <button class="btn btn-outline" @click="showGlobalMinMaxModal = false">Batal</button>
        <button class="btn btn-primary" @click="saveGlobalMinMaxSettings" :disabled="isSavingGlobalMinMax">
          {{ isSavingGlobalMinMax ? 'Menyimpan...' : 'Simpan Pengaturan' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Min Max Settings Modal -->
  <div v-if="showMinMaxModal" class="modal-overlay" @click.self="showMinMaxModal = false">
    <div class="modal-content" style="padding: 1.5rem; width: 360px; max-width: 90%;">
      <h3 style="margin-top: 0; color: var(--text-main);">⚙️ Pengaturan Batas Anggota</h3>
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">Atur batas minimum dan maksimum untuk <b>{{ selectedPicForSettings?.nama_pic }}</b>.</p>

      <div class="form-group">
        <label>Minimal Anggota</label>
        <input type="number" v-model="formMinMax.min_anggota" class="form-input" placeholder="Contoh: 2" min="1" style="width: 100%; box-sizing: border-box;" />
        <small style="font-size:0.75rem; color:#64748b;">Standar: 2 (Akan memicu peringatan jika kurang)</small>
      </div>

      <div class="form-group" style="margin-top: 1rem;">
        <label>Maksimal Anggota</label>
        <input type="number" v-model="formMinMax.max_anggota" class="form-input" placeholder="Tidak ada batas (Kosongkan)" min="1" style="width: 100%; box-sizing: border-box;" />
        <small style="font-size:0.75rem; color:#64748b;">Kosongkan jika tidak dibatasi.</small>
      </div>

      <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem; justify-content: flex-end;">
        <button @click="showMinMaxModal = false" class="btn btn-outline btn-small" style="padding: 0.5rem 1rem;">Batal</button>
        <button @click="saveMinMaxSettings" class="btn btn-primary btn-small" style="padding: 0.5rem 1rem;" :disabled="isSavingMinMax">
          {{ isSavingMinMax ? 'Menyimpan...' : 'Simpan' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.error-msg {
  color: #ef4444;
  font-size: 0.9rem;
}

.pic-card {
  padding: 1.2rem;
  border-radius: 12px;
  background: white;
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
}

.pic-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(129, 154, 145, 0.15);
  border-color: rgba(129, 154, 145, 0.4);
}

.pic-card.is-editing {
  border: 2px solid var(--color-primary);
  box-shadow: 0 0 0 4px rgba(129, 154, 145, 0.1);
}

.pic-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px dashed var(--color-border);
}

.pic-card-title {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.1rem;
  font-weight: 700;
  padding-right: 1rem;
}

.btn-pic-settings {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0.2rem;
  transition: transform 0.3s ease;
  color: var(--text-muted);
}

.btn-pic-settings:hover {
  transform: rotate(90deg);
}

.pic-card-content {
  flex-grow: 1;
}

.pic-proker {
  margin: 0 0 1rem 0;
  font-size: 0.85rem;
  color: var(--text-main);
  background: rgba(129, 154, 145, 0.05);
  padding: 0.5rem;
  border-radius: 6px;
  line-height: 1.4;
}

.pic-members-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.badge-warning {
  background: rgba(245, 158, 11, 0.15);
  color: #d97706;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.65rem;
}

.pic-members-list {
  margin: 0 0 1rem 0;
  padding-left: 1.2rem;
  font-size: 0.85rem;
  color: var(--text-main);
}

.pic-members-list li {
  margin-bottom: 0.25rem;
}

@media (max-width: 768px) {
  .pic-section-grid {
    grid-template-columns: 1fr !important;
    gap: 1rem;
  }
}
</style>
