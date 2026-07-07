const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/views/BendaharaDashboard.vue');
let content = fs.readFileSync(file, 'utf8');

// Add iuranInterval ref
content = content.replace(
  /const iuranTarget = ref\(0\);\r?\nconst isSettingTarget = ref\(false\);/,
  "const iuranTarget = ref(0);\nconst iuranInterval = ref('sekali');\nconst isSettingTarget = ref(false);"
);

// Update fetchIuran
content = content.replace(
  /const fetchIuran = async \(\) => \{\r?\n  try \{\r?\n    const res = await fetch\('\/api\/bendahara\/iuran', \{ headers: \{ 'Authorization': `Bearer \$\{token.value\}` \} \}\);\r?\n    if \(res\.ok\) \{\r?\n      iuranList.value = await res\.json\(\);\r?\n      if \(iuranList\.value\.length > 0\) iuranTarget\.value = iuranList\.value\[0\]\.nominal_target;\r?\n    \}\r?\n  \} catch\(e\) \{ console\.error\(e\) \}\r?\n\};/,
  `const fetchIuran = async () => {
  try {
    const res = await fetch('/api/bendahara/iuran', { headers: { 'Authorization': \`Bearer \${token.value}\` } });
    if (res.ok) {
      const data = await res.json();
      iuranList.value = data.list || data;
      if (data.iuran_interval) iuranInterval.value = data.iuran_interval;
      if (iuranList.value.length > 0) iuranTarget.value = iuranList.value[0].nominal_target;
    }
  } catch(e) { console.error(e) }
};`
);

// Update saveIuranTarget
content = content.replace(
  /const saveIuranTarget = async \(\) => \{\r?\n  if \(\!confirm\(`Ubah target iuran menjadi \$\{formatRupiah\(iuranTarget\.value\)\} untuk semua anggota\?`\)\) return;\r?\n  isSettingTarget\.value = true;\r?\n  try \{\r?\n    const res = await fetch\('\/api\/bendahara\/iuran\/target', \{\r?\n      method: 'POST',\r?\n      headers: \{ 'Content-Type': 'application\/json', 'Authorization': `Bearer \$\{token.value\}` \},\r?\n      body: JSON\.stringify\(\{ nominal_target: iuranTarget\.value \}\)\r?\n    \}\);/,
  `const saveIuranTarget = async () => {
  if (!confirm(\`Ubah target iuran menjadi \${formatRupiah(iuranTarget.value)} (\${iuranInterval.value}) untuk semua anggota?\`)) return;
  isSettingTarget.value = true;
  try {
    const res = await fetch('/api/bendahara/iuran/target', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token.value}\` },
      body: JSON.stringify({ nominal_target: iuranTarget.value, iuran_interval: iuranInterval.value })
    });`
);

// Update HTML Form
content = content.replace(
  /<label style="font-weight: 600; font-size: 0\.9rem; display: block; margin-bottom: 0\.5rem;">Target Iuran per Orang \(Rp\):<\/label>\r?\n\s*<div style="display: flex; gap: 0\.5rem;">\r?\n\s*<input type="text" :value="formatCurrencyInput\(iuranTarget\)" @input="iuranTarget = parseCurrencyInput\(\$event\.target\.value\)" class="form-control" style="width: 150px; padding: 0\.5rem;" placeholder="Rp 0" \/>\r?\n\s*<button class="btn-primary" @click="saveIuranTarget" :disabled="isSettingTarget" style="padding: 0\.5rem 1rem;">\{\{ isSettingTarget \? 'Menyimpan\.\.\.' : 'Set Target' \}\}<\/button>\r?\n\s*<\/div>/,
  `<label style="font-weight: 600; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Target Iuran per Orang (Rp):</label>
              <div style="display: flex; gap: 0.5rem;">
                <input type="text" :value="formatCurrencyInput(iuranTarget)" @input="iuranTarget = parseCurrencyInput($event.target.value)" class="form-control" style="width: 150px; padding: 0.5rem;" placeholder="Rp 0" />
                <select v-model="iuranInterval" class="form-control" style="padding: 0.5rem; width: auto; font-size: 0.9rem;">
                  <option value="sekali">Sekali Bayar</option>
                  <option value="harian">Harian</option>
                  <option value="mingguan">Mingguan</option>
                  <option value="bulanan">Bulanan</option>
                </select>
                <button class="btn-primary" @click="saveIuranTarget" :disabled="isSettingTarget" style="padding: 0.5rem 1rem;">{{ isSettingTarget ? 'Menyimpan...' : 'Set Target' }}</button>
              </div>`
);

fs.writeFileSync(file, content);
console.log('Replaced iuran form');
