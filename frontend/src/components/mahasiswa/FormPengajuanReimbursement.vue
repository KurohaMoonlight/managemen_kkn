<script setup>
import { ref } from 'vue';
import { useToast } from '../../composables/useNotification.js';
import CurrencyInput from '../CurrencyInput.vue';
import SearchableSelect from '../SearchableSelect.vue';
import { toCurrencyNumber } from '../../composables/useCurrencyInput.js';

/**
 * FormPengajuanReimbursement.vue
 * Form untuk membuat pengajuan reimbursement baru.
 * Props: token, kategoriList
 * Emits: submitted (setelah berhasil kirim, agar parent refresh data)
 */
const props = defineProps({
  token: { type: String, required: true },
  kategoriList: { type: Array, default: () => [] },
});
const emit = defineEmits(['submitted']);

const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();

const isSubmitting = ref(false);
const form = ref({
  kategori_id: '',
  input_kategori: '',
  nominal: '',
  keterangan: '',
});
const fileNota = ref(null);
const fileInputRef = ref(null);

const handleFileSelect = (e) => {
  if (e.target.files.length > 0) {
    fileNota.value = e.target.files[0];
  }
};

const submitPengajuan = async () => {
  const nominal = toCurrencyNumber(form.value.nominal);
  const hasKategori = form.value.kategori_id || form.value.input_kategori?.trim();
  if (!hasKategori) {
    toastWarning('Pilih kategori yang ada atau ketik nama kategori baru.');
    return;
  }
  if (!nominal || nominal <= 0) {
    toastWarning('Nominal harus lebih dari 0.');
    return;
  }
  if (!form.value.keterangan?.trim()) {
    toastWarning('Keterangan wajib diisi.');
    return;
  }

  isSubmitting.value = true;
  const formData = new FormData();
  if (form.value.kategori_id) {
    formData.append('kategori_id', form.value.kategori_id);
  } else {
    formData.append('nama_kategori_manual', form.value.input_kategori.trim());
  }
  formData.append('nominal', nominal);
  formData.append('keterangan', form.value.keterangan);
  if (fileNota.value) {
    formData.append('nota', fileNota.value);
  }

  try {
    const res = await fetch('/api/bendahara/pengajuan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${props.token}` },
      body: formData,
    });
    const data = await res.json();
    if (res.ok) {
      toastSuccess('Pengajuan berhasil dikirim!');
      form.value = { kategori_id: '', input_kategori: '', nominal: '', keterangan: '' };
      fileNota.value = null;
      if (fileInputRef.value) fileInputRef.value.value = '';
      emit('submitted');
    } else {
      toastError(data.message || 'Gagal mengirim pengajuan.');
    }
  } catch (error) {
    console.error(error);
    toastError('Terjadi kesalahan sistem.');
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="reimburse-form">
    <!-- Row 1: Kategori + Nominal -->
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Kategori RAB</label>
        <SearchableSelect
          v-model="form.kategori_id"
          v-model:manual-value="form.input_kategori"
          :options="kategoriList"
          placeholder="Pilih atau ketik kategori baru..."
        />
        <small class="form-hint">Pilih dari daftar atau ketik nama baru untuk membuat pos RAB otomatis.</small>
      </div>
      <div class="form-group">
        <label class="form-label">Nominal (Rp)</label>
        <CurrencyInput v-model="form.nominal" placeholder="0" />
      </div>
    </div>

    <!-- Row 2: Keterangan -->
    <div class="form-group">
      <label class="form-label">Keterangan / Rincian Pengeluaran</label>
      <textarea
        v-model="form.keterangan"
        class="form-input"
        rows="3"
        placeholder="Sebutkan rincian barang/jasa yang dibeli..."
      ></textarea>
    </div>

    <!-- Row 3: Upload Nota -->
    <div class="form-group">
      <label class="form-label">Bukti Pembayaran / Nota <span class="optional">(Opsional)</span></label>
      <div
        class="upload-zone"
        :class="{ 'has-file': fileNota }"
        @click="$refs.fileInputRef.click()"
      >
        <input type="file" ref="fileInputRef" style="display: none;" accept="image/*,.pdf" @change="handleFileSelect" />
        <span class="upload-icon">🧾</span>
        <span v-if="!fileNota" class="upload-text">Klik untuk mengunggah Bukti Pembayaran / Nota (Gambar/PDF)</span>
        <span v-else class="upload-filename">📎 {{ fileNota.name }}</span>
      </div>
    </div>

    <!-- Submit -->
    <div class="form-footer">
      <button @click="submitPengajuan" class="btn-submit" :disabled="isSubmitting">
        <span v-if="isSubmitting" class="spinner-sm"></span>
        {{ isSubmitting ? 'Mengirim...' : '📤 Kirim Pengajuan' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.reimburse-form {
  padding: 1.5rem 1.75rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

@media (max-width: 640px) {
  .form-row { grid-template-columns: 1fr; }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
}
.form-group:last-child { margin-bottom: 0; }

.form-label {
  font-weight: 600;
  color: #334155;
  font-size: 0.875rem;
}

.optional {
  font-weight: 400;
  color: #94a3b8;
  font-size: 0.8rem;
}

.form-hint {
  font-size: 0.78rem;
  color: #94a3b8;
  margin-top: 0.2rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1.5px solid #e2e8f0;
  background: white;
  font-size: 0.9rem;
  color: #334155;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  resize: vertical;
  font-family: inherit;
}
.form-input:focus {
  outline: none;
  border-color: var(--color-primary, #819A91);
  box-shadow: 0 0 0 3px rgba(129,154,145,0.12);
}

.upload-zone {
  border: 2px dashed #cbd5e1;
  border-radius: 10px;
  padding: 1.25rem 1rem;
  text-align: center;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}
.upload-zone:hover { border-color: var(--color-primary, #819A91); background: #f0faf8; }
.upload-zone.has-file { border-color: var(--color-primary, #819A91); background: #f0faf8; }
.upload-icon { font-size: 1.8rem; line-height: 1; }
.upload-text { font-size: 0.875rem; color: #64748b; }
.upload-filename { font-size: 0.875rem; color: var(--color-primary, #819A91); font-weight: 600; word-break: break-all; }

.form-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.25rem;
}

.btn-submit {
  padding: 0.65rem 1.75rem;
  background: var(--color-primary, #819A91);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 160px;
  justify-content: center;
}
.btn-submit:hover:not(:disabled) {
  background: var(--color-primary-dark, #6b847a);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(129,154,145,0.3);
}
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

.spinner-sm {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
