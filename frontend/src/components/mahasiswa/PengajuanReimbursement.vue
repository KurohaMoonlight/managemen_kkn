<script setup>
import { ref, onMounted } from 'vue';
import FormPengajuanReimbursement from './FormPengajuanReimbursement.vue';
import TabelRiwayatReimbursement from './TabelRiwayatReimbursement.vue';

/**
 * PengajuanReimbursement.vue — Container
 * Mengelola state data (kategoriList, pengajuanList) dan fetch,
 * lalu meneruskannya ke komponen form dan tabel sebagai props.
 */
const props = defineProps({
  token: { type: String, required: true },
});

const kategoriList = ref([]);
const pengajuanList = ref([]);
const showForm = ref(false);

const fetchData = async () => {
  try {
    const [resKategori, resPengajuan] = await Promise.all([
      fetch('/api/bendahara/kategori', { headers: { Authorization: `Bearer ${props.token}` } }),
      fetch('/api/bendahara/pengajuan', { headers: { Authorization: `Bearer ${props.token}` } }),
    ]);
    if (resKategori.ok) kategoriList.value = await resKategori.json();
    if (resPengajuan.ok) pengajuanList.value = await resPengajuan.json();
  } catch (error) {
    console.error('Error fetching pengajuan data:', error);
  }
};

const onSubmitted = async () => {
  showForm.value = false;
  await fetchData();
};

onMounted(fetchData);
</script>

<template>
  <div class="reimburse-card">
    <!-- Header -->
    <div class="reimburse-header">
      <div>
        <h2 class="reimburse-title">💸 Pengajuan Reimbursement</h2>
        <p class="reimburse-subtitle">Ajukan pencairan dana ke Bendahara Posko berdasarkan RAB.</p>
      </div>
      <button @click="showForm = !showForm" class="btn-toggle" :class="{ active: showForm }">
        <span v-if="!showForm">➕ Buat Pengajuan</span>
        <span v-else>✕ Tutup Form</span>
      </button>
    </div>

    <!-- Form Pengajuan -->
    <Transition name="slide-down">
      <FormPengajuanReimbursement
        v-if="showForm"
        :token="token"
        :kategori-list="kategoriList"
        @submitted="onSubmitted"
      />
    </Transition>

    <!-- Tabel Riwayat -->
    <TabelRiwayatReimbursement :pengajuan-list="pengajuanList" />
  </div>
</template>

<style scoped>
/* ── Card ────────────────────────────────────────── */
.reimburse-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  margin-top: 2rem;
  overflow: hidden;
}

.reimburse-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 1.5rem 1.75rem;
  border-bottom: 1px solid #f1f5f9;
}

.reimburse-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: #1e293b;
}

.reimburse-subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: #64748b;
}

.btn-toggle {
  padding: 0.55rem 1.2rem;
  border-radius: 10px;
  border: 1.5px solid var(--color-primary, #819A91);
  background: transparent;
  color: var(--color-primary, #819A91);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.btn-toggle:hover, .btn-toggle.active {
  background: var(--color-primary, #819A91);
  color: white;
}

/* ── Transition ───────────────────────────────────── */
.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}
.slide-down-enter-from, .slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.slide-down-enter-to, .slide-down-leave-from {
  opacity: 1;
  max-height: 800px;
}
</style>
