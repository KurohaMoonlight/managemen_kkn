const fs = require('fs');
const file = 'frontend/src/views/BendaharaDashboard.vue';
let content = fs.readFileSync(file, 'utf8');

// 1. Add toastList, showToast, confirmDialog, promptDialog, showConfirm, showPrompt, formatCurrencyInput, parseCurrencyInput
const missingVars = `
const iuranInterval = ref('sekali');
const toastList = ref([]);
const showToast = (message, type = 'info') => {
  const id = Date.now();
  toastList.value.push({ id, message, type });
  setTimeout(() => {
    toastList.value = toastList.value.filter(t => t.id !== id);
  }, 3500);
};

const confirmDialog = ref({ show: false, message: '', onConfirm: null, onCancel: null });
const showConfirm = (message) => {
  return new Promise((resolve) => {
    confirmDialog.value = {
      show: true, message,
      onConfirm: () => { confirmDialog.value.show = false; resolve(true); },
      onCancel: () => { confirmDialog.value.show = false; resolve(false); }
    };
  });
};

const promptDialog = ref({ show: false, message: '', value: '', type: 'text', onConfirm: null, onCancel: null });
const showPrompt = (message, defaultValue = '', type = 'text') => {
  return new Promise((resolve) => {
    promptDialog.value = {
      show: true, message, value: defaultValue, type,
      onConfirm: () => { promptDialog.value.show = false; resolve(promptDialog.value.value); },
      onCancel: () => { promptDialog.value.show = false; resolve(null); }
    };
  });
};

const formatCurrencyInput = (val) => {
  if (!val) return '';
  return Number(val).toLocaleString('id-ID');
};
const parseCurrencyInput = (val) => {
  if (!val) return '';
  return val.toString().replace(/\\D/g, '');
};
`;

if (!content.includes('const showToast = ')) {
  content = content.replace("const pengajuanList = ref([]);", "const pengajuanList = ref([]);" + missingVars);
}

// Replace alerts
content = content.replace(/alert\(formKategori\.value\.id \? 'Kategori diperbarui\.' : 'Kategori ditambahkan\.'\);/g, "showToast(formKategori.value.id ? 'Kategori diperbarui.' : 'Kategori ditambahkan.', 'success');");
content = content.replace(/alert\('Kategori dihapus\.'\);/g, "showToast('Kategori dihapus.', 'success');");
content = content.replace(/alert\('Transaksi berhasil dicatat!'\);/g, "showToast('Transaksi berhasil dicatat!', 'success');");
content = content.replace(/alert\(data\.message \|\| 'Gagal'\);/g, "showToast(data.message || 'Gagal', 'error');");
content = content.replace(/alert\('Transaksi dihapus\.'\);/g, "showToast('Transaksi dihapus.', 'success');");
content = content.replace(/alert\("Target iuran berhasil diperbarui!"\);/g, "showToast('Target iuran berhasil diperbarui!', 'success');");
content = content.replace(/alert\("Gagal memperbarui target\."\);/g, "showToast('Gagal memperbarui target.', 'error');");
content = content.replace(/alert\("Nominal tidak valid!"\);/g, "showToast('Nominal tidak valid!', 'error');");
content = content.replace(/alert\("Pembayaran berhasil dicatat, dan uang otomatis masuk ke Kas Pemasukan!"\);/g, "showToast('Pembayaran berhasil dicatat, dan uang otomatis masuk ke Kas Pemasukan!', 'success');");
content = content.replace(/alert\(data\.message \|\| "Gagal mencatat pembayaran\."\);/g, "showToast(data.message || 'Gagal mencatat pembayaran.', 'error');");
content = content.replace(/alert\(`Pengajuan berhasil \${newStatus}!`\);/g, "showToast(`Pengajuan berhasil \${newStatus}!`, 'success');");
content = content.replace(/alert\("Gagal memperbarui status pengajuan\."\);/g, "showToast('Gagal memperbarui status pengajuan.', 'error');");
content = content.replace(/alert\("Tidak ada data untuk diekspor\."\);/g, "showToast('Tidak ada data untuk diekspor.', 'warning');");
content = content.replace(/alert\(d\.message \|\| "Gagal mengganti nama\."\);/g, "showToast(d.message || 'Gagal mengganti nama.', 'error');");
content = content.replace(/alert\("Terjadi kesalahan jaringan\."\);/g, "showToast('Terjadi kesalahan jaringan.', 'error');");
content = content.replace(/alert\("Gagal mengunduh file\."\);/g, "showToast('Gagal mengunduh file.', 'error');");

// Replace confirm
content = content.replace(/if \(!confirm\('Yakin ingin menghapus kategori\/pos ini\? Transaksi yang terkait akan kehilangan kategorinya\.'\)\) return;/g, "if (!(await showConfirm('Yakin ingin menghapus kategori/pos ini? Transaksi yang terkait akan kehilangan kategorinya.'))) return;");
content = content.replace(/if \(!confirm\(`Peringatan: Nominal ini melebihi sisa anggaran RAB!\\nSisa anggaran untuk \$\{catData\.nama_kategori\} hanya \$\{formatRupiah\(sisa\)\}\.\\nTetap lanjutkan menyimpan transaksi ini\?`\)\) \{/g, "if (!(await showConfirm(`Peringatan: Nominal ini melebihi sisa anggaran RAB!\\nSisa anggaran untuk \${catData.nama_kategori} hanya \${formatRupiah(sisa)}.\\nTetap lanjutkan menyimpan transaksi ini?`))) {");
content = content.replace(/if \(!confirm\('Yakin ingin menghapus transaksi ini\?'\)\) return;/g, "if (!(await showConfirm('Yakin ingin menghapus transaksi ini?'))) return;");
content = content.replace(/if \(!confirm\(`Ubah target iuran menjadi \$\{formatRupiah\(iuranTarget\.value\)\} untuk semua anggota\?`\)\) return;/g, "if (!(await showConfirm(`Ubah target iuran menjadi \${formatRupiah(iuranTarget.value)} untuk semua anggota?`))) return;");
content = content.replace(/if \(!confirm\(`Setujui pengajuan sebesar \$\{formatRupiah\(p\.nominal\)\} dari \$\{p\.nama_lengkap\}\? Saldo Kas akan otomatis terpotong\.`\)\) return;/g, "if (!(await showConfirm(`Setujui pengajuan sebesar \${formatRupiah(p.nominal)} dari \${p.nama_lengkap}? Saldo Kas akan otomatis terpotong.`))) return;");
content = content.replace(/if \(!confirm\(`Yakin ingin menghapus \$\{type === 'folder' \? 'folder' : 'file'\} "\$\{type === 'folder' \? item\.nama_folder : item\.nama_file\}"\?`\)\) \{/g, "if (!(await showConfirm(`Yakin ingin menghapus \${type === 'folder' ? 'folder' : 'file'} \"\${type === 'folder' ? item.nama_folder : item.nama_file}\"?`))) {");

// Replace prompt
content = content.replace(/const amountStr = prompt\(`Catat pembayaran iuran untuk \$\{userObj\.nama_lengkap\}:\\n\\nTarget sisa: \$\{formatRupiah\(userObj\.nominal_target - userObj\.nominal_terbayar\)\}\\nMasukkan nominal bayar \(Angka saja\):`\);/g, "const amountStr = await showPrompt(`Catat pembayaran iuran untuk \${userObj.nama_lengkap}:\\n\\nTarget sisa: \${formatRupiah(userObj.nominal_target - userObj.nominal_terbayar)}\\nMasukkan nominal bayar (Angka saja):`, '', 'number');");
content = content.replace(/catatan = prompt\("Alasan penolakan:"\);/g, "catatan = await showPrompt('Alasan penolakan:');");
content = content.replace(/const newName = prompt\(`Ganti nama \$\{type === 'folder' \? 'folder' : 'file'\}:`, currentName\);/g, "const newName = await showPrompt(`Ganti nama \${type === 'folder' ? 'folder' : 'file'}:`, currentName);");

// Fix transaction form
content = content.replace(/const formTransaksi = ref\(\{ jenis: 'pengeluaran', kategori_id: '', nominal: 0, tanggal: '', keterangan: '', file: null \}\);/g, "const formTransaksi = ref({ jenis: 'pengeluaran', kategori_id: '', input_kategori: '', nominal: 0, tanggal: '', keterangan: '', file: null });");
content = content.replace(/formTransaksi\.value = \{ jenis: 'pengeluaran', kategori_id: '', nominal: 0, tanggal: '', keterangan: '', file: null \};/g, "formTransaksi.value = { jenis: 'pengeluaran', kategori_id: '', input_kategori: '', nominal: 0, tanggal: '', keterangan: '', file: null };");

const submitTxSearch = `const submitTransaksi = async () => {
  if (formTransaksi.value.jenis === 'pengeluaran' && formTransaksi.value.kategori_id) {`;
const submitTxReplace = `const submitTransaksi = async () => {
  if (formTransaksi.value.input_kategori) {
    const match = kategoriList.value.find(k => k.nama_kategori.toLowerCase() === formTransaksi.value.input_kategori.toLowerCase());
    if (match) formTransaksi.value.kategori_id = match.id;
    else formTransaksi.value.kategori_id = '';
  }

  if (formTransaksi.value.jenis === 'pengeluaran' && formTransaksi.value.kategori_id) {`;
content = content.replace(submitTxSearch, submitTxReplace);

const formDataSearch = `  const formData = new FormData();
  formData.append('jenis', formTransaksi.value.jenis);
  if (formTransaksi.value.kategori_id) formData.append('kategori_id', formTransaksi.value.kategori_id);`;
const formDataReplace = `  const formData = new FormData();
  formData.append('jenis', formTransaksi.value.jenis);
  if (formTransaksi.value.input_kategori && !formTransaksi.value.kategori_id) {
    formData.append('nama_kategori_manual', formTransaksi.value.input_kategori);
  }
  if (formTransaksi.value.kategori_id) formData.append('kategori_id', formTransaksi.value.kategori_id);`;
content = content.replace(formDataSearch, formDataReplace);

// Fix iuran fetch response
const iuranFetchSearch = `      iuranList.value = await res.json();
      if (iuranList.value.length > 0) iuranTarget.value = iuranList.value[0].nominal_target;`;
const iuranFetchReplace = `      const data = await res.json();
      if (Array.isArray(data)) {
        iuranList.value = data;
      } else {
        iuranList.value = data.list || [];
        iuranInterval.value = data.iuran_interval || 'sekali';
      }
      if (iuranList.value.length > 0) iuranTarget.value = iuranList.value[0].nominal_target;`;
content = content.replace(iuranFetchSearch, iuranFetchReplace);

// Fix kategori dropdown HTML
const htmlDropdownSearch = `<div class="form-group" v-if="formTransaksi.jenis === 'pengeluaran'">
            <label>Kategori / Pos RAB</label>
            <select v-model="formTransaksi.kategori_id">
              <option value="">-- Pilih Kategori --</option>
              <option v-for="kat in kategoriList" :key="kat.id" :value="kat.id">{{ kat.nama_kategori }}</option>
            </select>
          </div>`;
const htmlDropdownReplace = `<div class="form-group">
            <label>Kategori <small style="font-weight:normal; color:#6b7280;">(Pilih dari RAB atau ketik kategori baru)</small></label>
            <input type="text" list="kategoriDatalist" v-model="formTransaksi.input_kategori"
              :placeholder="formTransaksi.jenis === 'pengeluaran' ? 'Pilih/ketik kategori pengeluaran...' : 'Pilih/ketik kategori pemasukan...'"
              class="form-control"
              style="width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:8px;box-sizing:border-box;font-size:0.95rem;" />
            <datalist id="kategoriDatalist">
              <option v-for="kat in kategoriList" :key="kat.id" :value="kat.nama_kategori"></option>
              <option value="Iuran Anggota"></option>
              <option value="Dana Proker"></option>
              <option value="Transportasi"></option>
              <option value="Konsumsi"></option>
            </datalist>
          </div>`;
content = content.replace(htmlDropdownSearch, htmlDropdownReplace);

// Fix nominal Rp HTML
const htmlNominalSearch = `<div class="form-group">
            <label>Nominal (Rp)</label>
            <input type="number" v-model="formTransaksi.nominal" required min="1" placeholder="Misal: 50000" />
          </div>`;
const htmlNominalReplace = `<div class="form-group">
            <label>Nominal (Rp)</label>
            <input type="text" :value="formatCurrencyInput(formTransaksi.nominal)" @input="formTransaksi.nominal = parseCurrencyInput($event.target.value)"
              required placeholder="Misal: 50.000"
              style="width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:8px;box-sizing:border-box;font-size:0.95rem;" />
          </div>`;
content = content.replace(htmlNominalSearch, htmlNominalReplace);

// Fix plafon input
const plafonSearch = `<input type="number" v-model="formKategori.plafon_dana" min="0" placeholder="Rp 0" />`;
const plafonReplace = `<input type="text" :value="formatCurrencyInput(formKategori.plafon_dana)" @input="formKategori.plafon_dana = parseCurrencyInput($event.target.value)" placeholder="Rp 0" style="width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:8px;box-sizing:border-box;font-size:0.95rem;" />`;
content = content.replace(plafonSearch, plafonReplace);

// Add missing Modals to the end of template
if (!content.includes('Toast Notifications')) {
const modalHtml = `
    <!-- Custom Confirm Dialog -->
    <div v-if="confirmDialog.show" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;" @click.self="confirmDialog.onCancel">
      <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <h3 style="margin-bottom: 1rem;">Konfirmasi</h3>
        <p style="margin-bottom: 1.5rem; color: #6b7280; white-space: pre-line;">{{ confirmDialog.message }}</p>
        <div style="display: flex; justify-content: center; gap: 1rem;">
          <button class="btn-secondary" @click="confirmDialog.onCancel">Batal</button>
          <button class="btn-primary" @click="confirmDialog.onConfirm">Ya, Lanjutkan</button>
        </div>
      </div>
    </div>

    <!-- Custom Prompt Dialog -->
    <div v-if="promptDialog.show" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;" @click.self="promptDialog.onCancel">
      <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 400px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <h3 style="margin-bottom: 1rem;">Input Diperlukan</h3>
        <p style="margin-bottom: 1rem; color: #6b7280; white-space: pre-line;">{{ promptDialog.message }}</p>
        <input v-if="promptDialog.type === 'text'" type="text" v-model="promptDialog.value" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 8px; margin-bottom: 1.5rem; box-sizing: border-box; font-size: 1rem;" @keyup.enter="promptDialog.onConfirm" />
        <input v-if="promptDialog.type === 'number'" type="text" :value="formatCurrencyInput(promptDialog.value)" @input="promptDialog.value = parseCurrencyInput($event.target.value)" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 8px; margin-bottom: 1.5rem; box-sizing: border-box; font-size: 1rem;" @keyup.enter="promptDialog.onConfirm" />
        <div style="display: flex; justify-content: flex-end; gap: 1rem;">
          <button class="btn-secondary" @click="promptDialog.onCancel">Batal</button>
          <button class="btn-primary" @click="promptDialog.onConfirm">Simpan</button>
        </div>
      </div>
    </div>

    <!-- Toast Notifications -->
    <div style="position:fixed;bottom:1.5rem;right:1.5rem;z-index:99999;display:flex;flex-direction:column;gap:0.75rem;pointer-events:none;">
      <div v-for="t in toastList" :key="t.id"
        style="min-width:280px;max-width:380px;padding:1rem 1.25rem;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.15);display:flex;align-items:center;gap:0.75rem;animation:slideInRight 0.3s ease;pointer-events:all;color:white;"
        :style="{background: t.type==='success'?'#10b981':t.type==='error'?'#ef4444':t.type==='warning'?'#f59e0b':'#3b82f6'}">
        <span style="font-size:1.25rem;">{{ t.type==='success'?'✅':t.type==='error'?'❌':t.type==='warning'?'⚠️':'ℹ️' }}</span>
        <span style="flex:1;font-size:0.9rem;font-weight:500;">{{ t.message }}</span>
      </div>
    </div>
  </div>
</template>`;
content = content.replace(/  <\/div>\n<\/template>/, modalHtml);
}

// Add animation to style
if (!content.includes('slideInRight')) {
  content = content.replace('<style scoped>', "<style scoped>\\n@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }");
}

// Fix iuran HTML
const iuranInputSearch = `<div style="display: flex; gap: 0.5rem;">
                <input type="number" v-model="iuranTarget" class="form-control" style="width: 150px; padding: 0.5rem;" />
                <button class="btn-primary" @click="saveIuranTarget" :disabled="isSettingTarget" style="padding: 0.5rem 1rem;">{{ isSettingTarget ? 'Menyimpan...' : 'Set Target' }}</button>
              </div>`;
const iuranInputReplace = `<div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                <input type="text" :value="formatCurrencyInput(iuranTarget)" @input="iuranTarget = parseCurrencyInput($event.target.value)" class="form-control" style="width: 150px; padding: 0.5rem;" placeholder="Rp 0" />
                <select v-model="iuranInterval" class="form-control" style="padding: 0.5rem; width: auto; font-size: 0.9rem;">
                  <option value="sekali">Sekali Bayar</option>
                  <option value="harian">Harian</option>
                  <option value="mingguan">Mingguan</option>
                  <option value="bulanan">Bulanan</option>
                </select>
                <button class="btn-primary" @click="saveIuranTarget" :disabled="isSettingTarget" style="padding: 0.5rem 1rem;">{{ isSettingTarget ? 'Menyimpan...' : 'Set Target' }}</button>
              </div>`;
content = content.replace(iuranInputSearch, iuranInputReplace);

content = content.replace(/<span class="badge" :class="u\.status === 'lunas' \? 'badge-success' : u\.status === 'sebagian' \? 'badge-warning' : 'badge-danger'">\s*\{\{ u\.status\.toUpperCase\(\) \}\}\s*<\/span>/, `<span class="badge" :class="(u.status || 'belum') === 'lunas' ? 'badge-success' : (u.status || 'belum') === 'sebagian' ? 'badge-warning' : 'badge-danger'">\n                      {{ (u.status || 'belum').toUpperCase() }}\n                    </span>`);
content = content.replace(/<button v-if="u\.status !== 'lunas'" class="btn-primary btn-small" @click="promptBayarIuran\(u\)" style="background: #10b981; border: none;">\+ Catat Bayar<\/button>/, `<button v-if="(u.status || 'belum') !== 'lunas'" class="btn-primary btn-small" @click="promptBayarIuran(u)" style="background: #10b981; border: none;">+ Catat Bayar</button>`);

// Fix pengajuan nama_lengkap + divisi
content = content.replace(/<td style="font-weight: 500;">\{\{ p\.nama_lengkap \}\}<\/td>/, `<td style="font-weight: 500;">
                    {{ p.nama_lengkap }}
                    <div style="font-size:0.8rem;color:#6b7280;margin-top:2px;">
                      {{ p.divisi_pic ? '🏷️ ' + p.divisi_pic : (p.pengaju_jabatan ? '👤 ' + p.pengaju_jabatan : '') }}
                    </div>
                  </td>`);

fs.writeFileSync(file, content);
console.log('Fixed natively');
