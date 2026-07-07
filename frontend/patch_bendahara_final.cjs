const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/views/BendaharaDashboard.vue');
let content = fs.readFileSync(file, 'utf8');

// 1. Helpers & Dialogs
const helpers = `
// Format Rupiah
const formatRupiah = (angka) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
};

const formatCurrencyInput = (val) => {
  if (!val) return '';
  return Number(val).toLocaleString('id-ID');
};
const parseCurrencyInput = (val) => {
  if (!val) return '';
  return val.toString().replace(/\\D/g, '');
};

// Dialogs State
const confirmDialog = ref({ show: false, message: '', onConfirm: null, onCancel: null });
const promptDialog = ref({ show: false, message: '', value: '', type: 'text', onConfirm: null, onCancel: null });

const showConfirm = (message) => {
  return new Promise((resolve) => {
    confirmDialog.value = {
      show: true,
      message,
      onConfirm: () => {
        confirmDialog.value.show = false;
        resolve(true);
      },
      onCancel: () => {
        confirmDialog.value.show = false;
        resolve(false);
      }
    };
  });
};

const showPrompt = (message, defaultValue = '', type = 'text') => {
  return new Promise((resolve) => {
    promptDialog.value = {
      show: true,
      message,
      value: defaultValue,
      type,
      onConfirm: () => {
        promptDialog.value.show = false;
        resolve(promptDialog.value.value);
      },
      onCancel: () => {
        promptDialog.value.show = false;
        resolve(null);
      }
    };
  });
};
`;
content = content.replace(/\/\/ Format Rupiah\s*const formatRupiah = \(angka\) => \{\s*return new Intl\.NumberFormat\('id-ID', \{ style: 'currency', currency: 'IDR', maximumFractionDigits: 0 \}\)\.format\(angka \|\| 0\);\s*\};\s*/, helpers);

// 2. Alert to Toast
content = content.replace(/alert\((['"`].*?['"`])\)/g, (match, p1) => {
    if (match.toLowerCase().includes('berhasil') || match.toLowerCase().includes('sukses')) return `toast.success(${p1})`;
    else if (match.toLowerCase().includes('gagal') || match.toLowerCase().includes('error')) return `toast.error(${p1})`;
    else if (match.toLowerCase().includes('tidak ada data')) return `toast.warning(${p1})`;
    return `toast.info(${p1})`;
});

// 3. Iuran Dropdown & format input
const iuranHtml = `<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <input type="text" :value="formatCurrencyInput(iuranTarget)" @input="iuranTarget = parseCurrencyInput($event.target.value)" class="form-control" style="width: 150px; padding: 0.5rem;" />
                <select v-model="iuranInterval" class="form-control" style="padding: 0.5rem; width: auto; font-size: 0.9rem;">
                  <option value="sekali">Sekali Bayar</option>
                  <option value="harian">Harian</option>
                  <option value="mingguan">Mingguan</option>
                  <option value="bulanan">Bulanan</option>
                </select>
                <button class="btn-primary" @click="saveIuranTarget" :disabled="isSettingTarget" style="padding: 0.5rem 1rem;">{{ isSettingTarget ? 'Menyimpan...' : 'Set Target' }}</button>
              </div>`;
content = content.replace(/<div style="display: flex; gap: 0\.5rem;">\s*<input type="number" v-model="iuranTarget" class="form-control" style="width: 150px; padding: 0\.5rem;" \/>\s*<button class="btn-primary" @click="saveIuranTarget" :disabled="isSettingTarget" style="padding: 0\.5rem 1rem;">\{\{ isSettingTarget \? 'Menyimpan\.\.\.' : 'Set Target' \}\}<\/button>\s*<\/div>/, iuranHtml);

// 4. Input Plafon & Transaksi formatting
content = content.replace(/<input type="number" v-model="formKategori\.plafon_dana" min="0" placeholder="Rp 0" \/>/, `<input type="text" :value="formatCurrencyInput(formKategori.plafon_dana)" @input="formKategori.plafon_dana = parseCurrencyInput($event.target.value)" placeholder="Rp 0" class="form-control" style="width: 100%; box-sizing: border-box; padding: 0.75rem; border: 1px solid var(--color-border); border-radius: 6px; font-size: 0.95rem; background-color: #f9fafb;" />`);
content = content.replace(/<input type="number" v-model="formTransaksi\.nominal" required min="1" placeholder="Misal: 50000" \/>/, `<input type="text" :value="formatCurrencyInput(formTransaksi.nominal)" @input="formTransaksi.nominal = parseCurrencyInput($event.target.value)" required placeholder="Misal: 50.000" class="form-control" style="width: 100%; box-sizing: border-box; padding: 0.75rem; border: 1px solid var(--color-border); border-radius: 6px; font-size: 0.95rem; background-color: #f9fafb;" />`);

// 5. Kategori Dropdown Datalist
const catDatalist = `<div class="form-group">
            <label>Kategori / Pos RAB <small>(Bisa ketik kategori baru)</small></label>
            <input type="text" list="kategoriListDatalist" v-model="formTransaksi.input_kategori" placeholder="Pilih atau ketik kategori..." required class="form-control" style="width: 100%; padding: 0.75rem; border-radius: 6px; border: 1px solid var(--color-border); box-sizing: border-box; font-size: 0.95rem; background-color: #f9fafb;" />
            <datalist id="kategoriListDatalist">
              <option v-for="kat in kategoriList" :key="kat.id" :value="kat.nama_kategori"></option>
            </datalist>
          </div>`;
content = content.replace(/<div class="form-group" v-if="formTransaksi\.jenis === 'pengeluaran'">\s*<label>Kategori \/ Pos RAB<\/label>\s*<select v-model="formTransaksi\.kategori_id">\s*<option value="">-- Pilih Kategori --<\/option>\s*<option v-for="kat in kategoriList" :key="kat\.id" :value="kat\.id">\{\{ kat\.nama_kategori \}\}<\/option>\s*<\/select>\s*<\/div>/, catDatalist);

// 6. Fix backend submitTransaksi logic for manual category
content = content.replace(/formData\.append\('kategori_id', formTransaksi\.value\.kategori_id\);/, `if (formTransaksi.value.input_kategori) {
      const match = kategoriList.value.find(k => k.nama_kategori.toLowerCase() === formTransaksi.value.input_kategori.toLowerCase());
      if (match) {
        formData.append('kategori_id', match.id);
      } else {
        formData.append('nama_kategori_manual', formTransaksi.value.input_kategori);
      }
    }`);
content = content.replace(/kategori_id: '',/, "input_kategori: '',");

// 7. Pengajuan div pic
const replaceStr = `<td style="font-weight: 500;">
                    {{ p.nama_lengkap }}
                    <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal; margin-top: 2px;">
                      {{ p.divisi_pic ? 'Divisi: ' + p.divisi_pic : p.pengaju_jabatan }}
                    </div>
                  </td>`;
content = content.replace(/<td style="font-weight: 500;">\{\{ p\.nama_lengkap \}\}<\/td>/, replaceStr);

// 8. Replace Confirms & Prompts
content = content.replace(/if \(!confirm\((.*?)\)\) return;/g, 'if (!(await showConfirm($1))) return;');
content = content.replace(/if \(!confirm\((.*?)\)\) \{\s*return;\s*\}/g, 'if (!(await showConfirm($1))) { return; }');
content = content.replace(/const amountStr = prompt\((.*?)\);/g, 'const amountStr = await showPrompt($1, "", "number");');
content = content.replace(/catatan = prompt\((.*?)\);/g, 'catatan = await showPrompt($1);');
content = content.replace(/const newName = prompt\((.*?),\s*(.*?)\);/g, 'const newName = await showPrompt($1, $2);');

// 9. Add Dialog HTML at the end of <template> ONLY ONCE
const dialogHtml = `
    <!-- Custom Confirm Dialog -->
    <div v-if="confirmDialog.show" class="modal-backdrop" style="z-index: 9999;" @click.self="confirmDialog.onCancel">
      <div class="modal-content animate-slide-up" style="max-width: 400px; text-align: center;">
        <h3 style="margin-bottom: 1rem; color: var(--text-main);">Konfirmasi</h3>
        <p style="margin-bottom: 1.5rem; color: var(--text-muted); white-space: pre-line;">{{ confirmDialog.message }}</p>
        <div style="display: flex; justify-content: center; gap: 1rem;">
          <button class="btn-secondary" @click="confirmDialog.onCancel">Batal</button>
          <button class="btn-primary" @click="confirmDialog.onConfirm">Ya, Lanjutkan</button>
        </div>
      </div>
    </div>

    <!-- Custom Prompt Dialog -->
    <div v-if="promptDialog.show" class="modal-backdrop" style="z-index: 9999;" @click.self="promptDialog.onCancel">
      <div class="modal-content animate-slide-up" style="max-width: 400px;">
        <h3 style="margin-bottom: 1rem; color: var(--text-main);">Input Diperlukan</h3>
        <p style="margin-bottom: 1rem; color: var(--text-muted); white-space: pre-line;">{{ promptDialog.message }}</p>
        <input v-if="promptDialog.type === 'text'" type="text" v-model="promptDialog.value" class="form-control" style="width: 100%; padding: 0.75rem; margin-bottom: 1.5rem; box-sizing: border-box;" @keyup.enter="promptDialog.onConfirm" autofocus />
        <input v-if="promptDialog.type === 'number'" type="text" :value="formatCurrencyInput(promptDialog.value)" @input="promptDialog.value = parseCurrencyInput($event.target.value)" class="form-control" style="width: 100%; padding: 0.75rem; margin-bottom: 1.5rem; box-sizing: border-box;" @keyup.enter="promptDialog.onConfirm" autofocus />
        <div style="display: flex; justify-content: flex-end; gap: 1rem;">
          <button class="btn-secondary" @click="promptDialog.onCancel">Batal</button>
          <button class="btn-primary" @click="promptDialog.onConfirm">Simpan</button>
        </div>
      </div>
    </div>
  </div>
</template>`;

content = content.replace(/<\/div>\s*<\/template>/, dialogHtml);

fs.writeFileSync(file, content);
console.log('Bendahara patched completely!');
