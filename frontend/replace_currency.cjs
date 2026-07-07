const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/views/BendaharaDashboard.vue');
let content = fs.readFileSync(file, 'utf8');

// Replace Plafon Dana Input in formKategori
content = content.replace(
  /<input type="number" v-model="formKategori\.plafon_dana" min="0" placeholder="Rp 0" \/>/,
  `<input type="text" :value="formatCurrencyInput(formKategori.plafon_dana)" @input="formKategori.plafon_dana = parseCurrencyInput($event.target.value)" placeholder="Rp 0" class="form-control" style="width: 100%; box-sizing: border-box; padding: 0.75rem; border: 1px solid var(--color-border); border-radius: 6px; font-size: 0.95rem; background-color: #f9fafb;" />`
);

// Replace Nominal Input in formTransaksi
content = content.replace(
  /<input type="number" v-model="formTransaksi\.nominal" required min="1" placeholder="Misal: 50000" \/>/,
  `<input type="text" :value="formatCurrencyInput(formTransaksi.nominal)" @input="formTransaksi.nominal = parseCurrencyInput($event.target.value)" required placeholder="Misal: 50.000" class="form-control" style="width: 100%; box-sizing: border-box; padding: 0.75rem; border: 1px solid var(--color-border); border-radius: 6px; font-size: 0.95rem; background-color: #f9fafb;" />`
);

fs.writeFileSync(file, content);
console.log('Replaced currency inputs');
