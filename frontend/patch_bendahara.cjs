const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/views/BendaharaDashboard.vue');
let content = fs.readFileSync(file, 'utf8');

// 1. Add formatCurrencyInput and parseCurrencyInput in script setup
const currencyHelpers = `
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

content = content.replace(/\/\/ Format Rupiah\s*const formatRupiah = \(angka\) => \{\s*return new Intl\.NumberFormat\('id-ID', \{ style: 'currency', currency: 'IDR', maximumFractionDigits: 0 \}\)\.format\(angka \|\| 0\);\s*\};\s*/, currencyHelpers);

// 2. Add Iuran Interval Dropdown AND Format the iuranTarget
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

// 3. Replace all confirms and prompts
content = content.replace(/if \(!confirm\((.*?)\)\) return;/g, 'if (!(await showConfirm($1))) return;');
content = content.replace(/if \(!confirm\((.*?)\)\) \{\s*return;\s*\}/g, 'if (!(await showConfirm($1))) { return; }');
content = content.replace(/const amountStr = prompt\((.*?)\);/g, 'const amountStr = await showPrompt($1, "", "number");');
content = content.replace(/catatan = prompt\((.*?)\);/g, 'catatan = await showPrompt($1);');
content = content.replace(/const newName = prompt\((.*?),\s*(.*?)\);/g, 'const newName = await showPrompt($1, $2);');

// 4. Add Dialog HTML at the end of <template> before </template>
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
console.log('Patched BendaharaDashboard successfully!');
