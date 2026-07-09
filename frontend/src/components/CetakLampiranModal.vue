<script setup>
import { ref, watch } from 'vue';
import html2pdf from 'html2pdf.js';

const props = defineProps({
  show: Boolean,
  poskoId: Number,
  token: String
});

const emit = defineEmits(['close']);

const isLoadingData = ref(false);
const isGeneratingPdf = ref(false);
const rekapData = ref([]);

watch(() => props.show, async (newVal) => {
  if (newVal && props.poskoId) {
    await fetchRekapLampiran();
  }
});

const fetchRekapLampiran = async () => {
  if (!props.poskoId) return;
  isLoadingData.value = true;
  try {
    const res = await fetch(`/api/posko/${props.poskoId}/rekap-lampiran`, {
      headers: { 'Authorization': `Bearer ${props.token}` }
    });
    const result = await res.json();
    if (result.success) {
      rekapData.value = result.data;
    }
  } catch (e) {
    console.error('Error loading rekap lampiran:', e);
  } finally {
    isLoadingData.value = false;
  }
};

const generatePDF = async () => {
  isGeneratingPdf.value = true;
  
  try {
    const tempDiv = document.createElement('div');
    tempDiv.style.width = '210mm';
    tempDiv.style.padding = '20mm';
    tempDiv.style.fontFamily = '"Times New Roman", Times, serif';
    tempDiv.style.color = 'black';
    tempDiv.style.backgroundColor = 'white';
    tempDiv.style.position = 'relative';

    // Title
    const title = document.createElement('h3');
    title.style.color = '#002060';
    title.style.fontSize = '14pt';
    title.style.marginBottom = '20px';
    title.style.fontWeight = 'bold';
    title.innerText = 'Lampiran 9. Rekapitulasi Keaktifan Tiap Mahasiswa';
    tempDiv.appendChild(title);

    // Subtitle
    const subtitle = document.createElement('h4');
    subtitle.style.fontSize = '12pt';
    subtitle.style.marginBottom = '20px';
    subtitle.style.fontWeight = 'bold';
    subtitle.innerText = 'REKAPITULASI KEAKTIFAN MAHASISWA';
    tempDiv.appendChild(subtitle);

    // Table
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.marginBottom = '30px';
    
    // Thead
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    
    const headers = [
      { text: 'No', width: '10%' },
      { text: 'NIM', width: '20%' },
      { text: 'Nama', width: '45%' },
      { text: 'Total Jam', width: '25%' }
    ];

    headers.forEach(h => {
      const th = document.createElement('th');
      th.innerText = h.text;
      th.style.border = '1px solid black';
      th.style.padding = '8px';
      th.style.textAlign = 'center';
      th.style.fontWeight = 'bold';
      th.style.fontSize = '11pt';
      th.style.width = h.width;
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    // Tbody
    const tbody = document.createElement('tbody');
    rekapData.value.forEach((mhs, idx) => {
      const tr = document.createElement('tr');
      
      const tdNo = document.createElement('td');
      tdNo.innerText = idx + 1;
      tdNo.style.border = '1px solid black';
      tdNo.style.padding = '8px';
      tdNo.style.textAlign = 'center';
      tdNo.style.fontSize = '11pt';
      tr.appendChild(tdNo);

      const tdNim = document.createElement('td');
      tdNim.innerText = mhs.nim;
      tdNim.style.border = '1px solid black';
      tdNim.style.padding = '8px';
      tdNim.style.textAlign = 'center';
      tdNim.style.fontSize = '11pt';
      tr.appendChild(tdNim);

      const tdNama = document.createElement('td');
      tdNama.innerText = mhs.nama;
      tdNama.style.border = '1px solid black';
      tdNama.style.padding = '8px';
      tdNama.style.textAlign = 'left';
      tdNama.style.fontSize = '11pt';
      tr.appendChild(tdNama);

      const tdJam = document.createElement('td');
      tdJam.innerText = mhs.total_jam;
      tdJam.style.border = '1px solid black';
      tdJam.style.padding = '8px';
      tdJam.style.textAlign = 'center';
      tdJam.style.fontSize = '11pt';
      tr.appendChild(tdJam);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tempDiv.appendChild(table);

    // Footer note
    const footer = document.createElement('div');
    footer.innerHTML = '<strong>Keterangan:</strong> total Jam dihitung dari logbook';
    footer.style.fontSize = '11pt';
    tempDiv.appendChild(footer);

    const opt = {
      margin:       [10, 10, 10, 10],
      filename:     `Lampiran_9_Rekapitulasi_Keaktifan.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    await html2pdf().from(tempDiv).set(opt).save();

  } catch (error) {
    console.error('PDF Generation Error:', error);
    alert('Terjadi kesalahan saat meng-generate PDF.');
  } finally {
    isGeneratingPdf.value = false;
  }
};
</script>

<template>
  <div class="modal-overlay" v-if="show" @click.self="emit('close')">
    <div class="modal-content animate-slide-up" style="max-width: 700px;">
      <h2 style="margin-top:0;">Cetak Rekapitulasi Keaktifan</h2>
      <p class="text-muted" style="margin-bottom: 1.5rem;">Lampiran 9 - Keaktifan Tiap Mahasiswa</p>

      <div v-if="isLoadingData" style="text-align: center; padding: 2rem;">
        Memuat data logbook mahasiswa...
      </div>
      <div v-else>
        <div style="max-height: 400px; overflow-y: auto; margin-bottom: 1.5rem;">
          <table class="users-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">No</th>
                <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">NIM</th>
                <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Nama</th>
                <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Total Jam</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(mhs, idx) in rekapData" :key="mhs.user_id">
                <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{ idx + 1 }}</td>
                <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{ mhs.nim }}</td>
                <td style="border: 1px solid #ccc; padding: 8px;">{{ mhs.nama }}</td>
                <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{ mhs.total_jam }}</td>
              </tr>
              <tr v-if="rekapData.length === 0">
                <td colspan="4" style="text-align: center; padding: 1rem;">Tidak ada data mahasiswa.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-outline" @click="emit('close')">Batal</button>
        <button type="button" class="btn btn-primary" @click="generatePDF" :disabled="isGeneratingPdf || isLoadingData || rekapData.length === 0">
          {{ isGeneratingPdf ? 'Membuat PDF...' : 'Unduh PDF Lampiran 9' }}
        </button>
      </div>
    </div>
  </div>
</template>
