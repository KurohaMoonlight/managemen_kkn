const fs = require('fs');
const file = 'frontend/src/views/BendaharaDashboard.vue';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace ALL alert() with showToast / custom dialog
// Add showToast function after showPrompt
const toastRef = `const showPrompt = (message, defaultValue = '', type = 'text') => {
  return new Promise((resolve) => {
    promptDialog.value = {
      show: true, message, value: defaultValue, type,
      onConfirm: () => { promptDialog.value.show = false; resolve(promptDialog.value.value); },
      onCancel: () => { promptDialog.value.show = false; resolve(null); }
    };
  });
};`;

const toastRefWithToast = `const showPrompt = (message, defaultValue = '', type = 'text') => {
  return new Promise((resolve) => {
    promptDialog.value = {
      show: true, message, value: defaultValue, type,
      onConfirm: () => { promptDialog.value.show = false; resolve(promptDialog.value.value); },
      onCancel: () => { promptDialog.value.show = false; resolve(null); }
    };
  });
};

// Toast notifications
const toastList = ref([]);
const showToast = (message, type = 'info') => {
  const id = Date.now();
  toastList.value.push({ id, message, type });
  setTimeout(() => {
    toastList.value = toastList.value.filter(t => t.id !== id);
  }, 3500);
};`;

content = content.replace(toastRef, toastRefWithToast);

// 2. Replace alert() calls with showToast
content = content.replace(/alert\((['"`])(.*?)\1\)/g, (match, q, msg) => {
  if (msg.includes('berhasil') || msg.includes('Berhasil') || msg.includes('diperbarui') || msg.includes('ditambahkan') || msg.includes('dihapus')) {
    return `showToast(${q}${msg}${q}, 'success')`;
  } else if (msg.includes('Gagal') || msg.includes('gagal') || msg.includes('tidak valid') || msg.includes('Error')) {
    return `showToast(${q}${msg}${q}, 'error')`;
  } else {
    return `showToast(${q}${msg}${q}, 'info')`;
  }
});

// Replace template literal alerts
content = content.replace(/alert\((`[^`]+`)\)/g, (match, msg) => {
  if (msg.includes('berhasil') || msg.includes('Berhasil')) return `showToast(${msg}, 'success')`;
  if (msg.includes('Gagal') || msg.includes('gagal')) return `showToast(${msg}, 'error')`;
  return `showToast(${msg}, 'info')`;
});

// Replace variable alerts: alert(data.message || 'xxx')
content = content.replace(/} else alert\(("Gagal[^"]*")\)/g, '} else showToast($1, "error")');
content = content.replace(/} else alert\(("Gagal[^"]*")\);/g, '} else showToast($1, "error");');
content = content.replace(/alert\(data\.message \|\| '([^']+)'\)/g, "showToast(data.message || '$1', 'error')");
content = content.replace(/alert\(data\.message \|\| "([^"]+)"\)/g, 'showToast(data.message || "$1", "error")');
content = content.replace(/alert\(d\.message \|\| "([^"]+)"\)/g, 'showToast(d.message || "$1", "error")');

// 3. Fix kategori dropdown to datalist (both pemasukan AND pengeluaran)
content = content.replace(
  `<div class="form-group" v-if="formTransaksi.jenis === 'pengeluaran'">
            <label>Kategori / Pos RAB</label>
            <select v-model="formTransaksi.kategori_id">
              <option value="">-- Pilih Kategori --</option>
              <option v-for="kat in kategoriList" :key="kat.id" :value="kat.id">{{ kat.nama_kategori }}</option>
            </select>
          </div>`,
  `<div class="form-group">
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
          </div>`
);

// 4. Fix nominal input to use currency formatter
content = content.replace(
  `<div class="form-group">
            <label>Nominal (Rp)</label>
            <input type="number" v-model="formTransaksi.nominal" required min="1" placeholder="Misal: 50000" />
          </div>`,
  `<div class="form-group">
            <label>Nominal (Rp)</label>
            <input type="text" :value="formatCurrencyInput(formTransaksi.nominal)" @input="formTransaksi.nominal = parseCurrencyInput($event.target.value)"
              required placeholder="Misal: 50.000"
              style="width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:8px;box-sizing:border-box;font-size:0.95rem;" />
          </div>`
);

// 5. Fix plafon input in RAB modal
content = content.replace(
  `<input type="number" v-model="formKategori.plafon_dana" min="0" placeholder="Rp 0" />`,
  `<input type="text" :value="formatCurrencyInput(formKategori.plafon_dana)" @input="formKategori.plafon_dana = parseCurrencyInput($event.target.value)" placeholder="Rp 0" style="width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:8px;box-sizing:border-box;font-size:0.95rem;" />`
);

// 6. Pengajuan: add nama + divisi below name
content = content.replace(
  `<td style="font-weight: 500;">{{ p.nama_lengkap }}</td>`,
  `<td style="font-weight: 500;">
                    {{ p.nama_lengkap }}
                    <div style="font-size:0.8rem;color:#6b7280;margin-top:2px;">
                      {{ p.divisi_pic ? '🏷️ ' + p.divisi_pic : (p.pengaju_jabatan ? '👤 ' + p.pengaju_jabatan : '') }}
                    </div>
                  </td>`
);

// 7. Add toast container HTML before closing </div></template>
const toastHtml = `
    <!-- Toast Notifications -->
    <div style="position:fixed;bottom:1.5rem;right:1.5rem;z-index:99999;display:flex;flex-direction:column;gap:0.75rem;pointer-events:none;">
      <div v-for="t in toastList" :key="t.id"
        style="min-width:280px;max-width:380px;padding:1rem 1.25rem;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.15);display:flex;align-items:center;gap:0.75rem;animation:slideInRight 0.3s ease;pointer-events:all;color:white;"
        :style="{background: t.type==='success'?'#10b981':t.type==='error'?'#ef4444':t.type==='warning'?'#f59e0b':'#3b82f6'}">
        <span style="font-size:1.25rem;">{{ t.type==='success'?'✅':t.type==='error'?'❌':t.type==='warning'?'⚠️':'ℹ️' }}</span>
        <span style="flex:1;font-size:0.9rem;font-weight:500;">{{ t.message }}</span>
      </div>
    </div>`;

// Replace </div>\n</template> at very end
content = content.replace(/(\s*<\/div>\n<\/template>)$/, `${toastHtml}\n  </div>\n</template>`);

// 8. Add keyframe for toast animation to <style scoped>
const styleInsert = `\n@keyframes slideInRight {\n  from { transform: translateX(100%); opacity: 0; }\n  to { transform: translateX(0); opacity: 1; }\n}\n`;
content = content.replace('<style scoped>', `<style scoped>${styleInsert}`);

fs.writeFileSync(file, content);
console.log('All fixes applied!');
