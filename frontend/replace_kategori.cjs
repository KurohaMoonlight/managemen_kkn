const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/views/BendaharaDashboard.vue');
let content = fs.readFileSync(file, 'utf8');

// 1. Update formTransaksi initialization
content = content.replace(
  /const formTransaksi = ref\(\{ jenis: 'pengeluaran', kategori_id: '', nominal: 0, tanggal: '', keterangan: '', file: null \}\);/,
  "const formTransaksi = ref({ jenis: 'pengeluaran', kategori_id: '', input_kategori: '', nominal: 0, tanggal: '', keterangan: '', file: null });"
);

// 2. Update resetFormTransaksi
content = content.replace(
  /formTransaksi\.value = \{ jenis: 'pengeluaran', kategori_id: '', nominal: 0, tanggal: '', keterangan: '', file: null \};/,
  "formTransaksi.value = { jenis: 'pengeluaran', kategori_id: '', input_kategori: '', nominal: 0, tanggal: '', keterangan: '', file: null };"
);

// 3. Update submitTransaksi logic
content = content.replace(
  /const submitTransaksi = async \(\) => \{\r?\n  if \(formTransaksi\.value\.jenis === 'pengeluaran' && formTransaksi\.value\.kategori_id\) \{\r?\n    const katId = formTransaksi\.value\.kategori_id;\r?\n    const nominalInput = Number\(formTransaksi\.value\.nominal\);\r?\n    const catData = summary\.value\.kategori\.find\(k => k\.id == katId\);\r?\n    if \(catData\) \{\r?\n      const sisa = Number\(catData\.plafon_dana\) - Number\(catData\.total_pengeluaran\);\r?\n      if \(nominalInput > sisa\) \{\r?\n        if \(\!confirm\(`Peringatan: Nominal ini melebihi sisa anggaran RAB!\\nSisa anggaran untuk \$\{catData\.nama_kategori\} hanya \$\{formatRupiah\(sisa\)\}\.\\nTetap lanjutkan menyimpan transaksi ini\?`\)\) \{\r?\n          return;\r?\n        \}\r?\n      \}\r?\n    \}\r?\n  \}\r?\n\r?\n  const formData = new FormData\(\);\r?\n  formData\.append\('jenis', formTransaksi\.value\.jenis\);\r?\n  if \(formTransaksi\.value\.kategori_id\) formData\.append\('kategori_id', formTransaksi\.value\.kategori_id\);/,
  `const submitTransaksi = async () => {
  let selectedKatId = '';
  let manualName = '';
  if (formTransaksi.value.input_kategori) {
    const existing = summary.value.kategori.find(k => k.nama_kategori.toLowerCase() === formTransaksi.value.input_kategori.toLowerCase());
    if (existing) {
      selectedKatId = existing.id;
    } else {
      manualName = formTransaksi.value.input_kategori;
    }
  }

  if (formTransaksi.value.jenis === 'pengeluaran' && selectedKatId) {
    const nominalInput = Number(formTransaksi.value.nominal);
    const catData = summary.value.kategori.find(k => k.id == selectedKatId);
    if (catData) {
      const sisa = Number(catData.plafon_dana) - Number(catData.total_pengeluaran);
      if (nominalInput > sisa) {
        if (!confirm(\`Peringatan: Nominal ini melebihi sisa anggaran RAB!\\nSisa anggaran untuk \${catData.nama_kategori} hanya \${formatRupiah(sisa)}.\\nTetap lanjutkan menyimpan transaksi ini?\`)) {
          return;
        }
      }
    }
  }

  const formData = new FormData();
  formData.append('jenis', formTransaksi.value.jenis);
  if (selectedKatId) formData.append('kategori_id', selectedKatId);
  if (manualName) formData.append('nama_kategori_manual', manualName);`
);

// 4. Update the HTML Form in template
content = content.replace(
  /<div class="form-group" v-if="formTransaksi\.jenis === 'pengeluaran'">\r?\n\s*<label>Kategori \/ Pos RAB<\/label>\r?\n\s*<select v-model="formTransaksi\.kategori_id">\r?\n\s*<option value="">-- Pilih Kategori --<\/option>\r?\n\s*<option v-for="kat in kategoriList" :key="kat\.id" :value="kat\.id">\{\{ kat\.nama_kategori \}\}<\/option>\r?\n\s*<\/select>\r?\n\s*<\/div>/,
  `<div class="form-group">
            <label>Kategori / Pos RAB <small>(Bisa ketik kategori baru)</small></label>
            <input type="text" list="kategoriListDatalist" v-model="formTransaksi.input_kategori" placeholder="Pilih atau ketik kategori..." required class="form-control" style="width: 100%; padding: 0.75rem; border-radius: 6px; border: 1px solid var(--color-border); box-sizing: border-box; font-size: 0.95rem; background-color: #f9fafb;" />
            <datalist id="kategoriListDatalist">
              <option v-for="kat in kategoriList" :key="kat.id" :value="kat.nama_kategori"></option>
            </datalist>
          </div>`
);

fs.writeFileSync(file, content);
console.log('Replaced kategori manual');
