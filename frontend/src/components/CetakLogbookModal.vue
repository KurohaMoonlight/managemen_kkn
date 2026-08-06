<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  show: Boolean,
  poskoId: Number,
  token: String
});

const emit = defineEmits(['close']);

// Form State
const startDate = ref(new Date().toISOString().split('T')[0]);
const endDate = ref(new Date().toISOString().split('T')[0]);

const isLoadingData = ref(false);
const isGeneratingPdf = ref(false);

const rekapData = ref({ logbooks: [] });

// Watch for poskoId and fetch data
watch(() => props.show, async (newVal) => {
  if (newVal && props.poskoId) {
    await fetchRekapData();
  }
});

const fetchRekapData = async () => {
  if (!props.poskoId) return;
  isLoadingData.value = true;
  try {
    let url = `/api/posko/${props.poskoId}/rekap-logbook?start_date=${startDate.value}&end_date=${endDate.value}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${props.token}` }
    });
    const result = await res.json();
    if (result.logbooks) {
      rekapData.value.logbooks = result.logbooks;
    }
  } catch (e) {
    console.error(e);
  } finally {
    isLoadingData.value = false;
  }
};

// Whenever start date or end date changes, re-fetch
watch([startDate, endDate], () => {
  if (props.show) fetchRekapData();
});

const generatePDF = async () => {
  isGeneratingPdf.value = true;
  
  try {
    const url = `/api/posko/${props.poskoId}/rekap-logbook?start_date=${startDate.value}&end_date=${endDate.value}&pdf=true`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${props.token}` }
    });
    
    if (!res.ok) throw new Error("Gagal mengunduh PDF");
    
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `Logbook_Kegiatan_${startDate.value}_sd_${endDate.value}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
    
    emit('close');
  } catch (err) {
    console.error(err);
    alert("Gagal mencetak PDF dari server.");
  } finally {
    isGeneratingPdf.value = false;
  }
};
</script>

<template>
  <div>
    <!-- MODAL -->
    <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content">
        <h3>Cetak Logbook Kegiatan (Lampiran 8)</h3>
        <p class="text-muted" style="margin-bottom: 1.5rem; font-size: 0.9rem;">Menghasilkan PDF gabungan seluruh logbook dari setiap PIC kelompok</p>
        
        <div class="form-grid">
          <div class="form-group" style="grid-column: span 1;">
            <label>Dari Tanggal</label>
            <input type="date" v-model="startDate" class="form-input" />
          </div>
          <div class="form-group" style="grid-column: span 1;">
            <label>Sampai Tanggal</label>
            <input type="date" v-model="endDate" class="form-input" />
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem;">
          <button @click="$emit('close')" class="btn-cancel">Batal</button>
          <button @click="generatePDF" class="btn-primary" :disabled="isGeneratingPdf || isLoadingData || rekapData.logbooks.length === 0">
            <span v-if="isGeneratingPdf">Membuat PDF...</span>
            <span v-else-if="isLoadingData">Memuat Data...</span>
            <span v-else-if="rekapData.logbooks.length === 0">Data Kosong</span>
            <span v-else>Download PDF ({{ rekapData.logbooks.length }} Kegiatan) ???</span>
          </button>
        </div>
      </div>
    </div>



  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}
.modal-content {
  background: white; padding: 2.5rem; border-radius: 16px;
  width: 90%; max-width: 500px;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
}
h3 { margin-top: 0; margin-bottom: 0.5rem; color: #1e293b; font-size: 1.25rem; font-weight: 600; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #475569; font-size: 0.9rem; }
.form-input {
  width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem;
  background: #f8fafc; color: #1e293b; transition: all 0.2s;
}
.form-input:focus { border-color: #3b82f6; outline: none; background: white; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.btn-primary {
  background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white;
  border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;
}
.btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2); }
.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
.btn-cancel {
  background: white; color: #475569; border: 1px solid #cbd5e1;
  padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;
}
.btn-cancel:hover { background: #f1f5f9; color: #1e293b; }
.text-muted { color: #64748b; }
.text-center { text-align: center; }
</style>
