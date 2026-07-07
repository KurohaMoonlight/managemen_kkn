const fs = require('fs');

try {
  const adminFile = 'c:/Apache24/htdocs/sistem_management_kkn/frontend/src/views/AdminDashboard.vue';
  const mhsFile = 'c:/Apache24/htdocs/sistem_management_kkn/frontend/src/views/MahasiswaDashboard.vue';
  const adminContent = fs.readFileSync(adminFile, 'utf8');
  let mhsContent = fs.readFileSync(mhsFile, 'utf8');
  
  const lines = adminContent.split('\n');

  const getRange = (startStr, endStr) => {
    const start = lines.findIndex(l => l.includes(startStr));
    let end = lines.findIndex((l, i) => i > start && l.includes(endStr));
    if(start === -1 || end === -1) throw new Error(`Range tidak ditemukan: ${startStr} hingga ${endStr}`);
    return lines.slice(start, end).join('\n');
  };

  const part1 = getRange('const toggleSelection =', '// --- PIC & PROKER STATES ---');
  const part2 = getRange('const contextMenu = ref({', 'const handleSearchInput =');
  const part3 = getRange('const fetchDirectory =', '// --- EXPIRED FOLDER HELPERS ---');

  let adaptedScript = (part1 + '\n' + part2 + '\n' + part3)
    .replace(/adminToken/g, 'token')
    .replace(/fetchPicGroups\(\);/g, '')
    .replace(/loadQRSecret\(\);/g, '')
    .replace(/fetchGDriveStatus\(\);/g, '')
    .replace(/currentAdminUser/g, 'user');

  // Hapus script explorer yang lama
  const oldScriptStart = mhsContent.indexOf('const explorerFolders = ref([]);');
  const oldScriptEnd = mhsContent.indexOf('</script>');
  if (oldScriptStart === -1 || oldScriptEnd === -1) throw new Error('Script explorer lama di Mahasiswa tidak ditemukan.');
  
  mhsContent = mhsContent.substring(0, oldScriptStart) + adaptedScript + '\n' + mhsContent.substring(oldScriptEnd);

  // Ganti HTML Explorer
  const adminHtmlStart = adminContent.indexOf('<div class="file-explorer-container">');
  if (adminHtmlStart === -1) throw new Error('adminHtmlStart tidak ditemukan.');
  let adminHtmlEnd = adminHtmlStart;
  let divCount = 0; let foundFirst = false;
  for (let i = adminHtmlStart; i < adminContent.length; i++) {
    if (adminContent.substr(i, 4) === '<div') { divCount++; foundFirst = true; }
    if (adminContent.substr(i, 5) === '</div') { divCount--; }
    if (foundFirst && divCount === 0) { adminHtmlEnd = i + 6; break; }
  }

  const fbStart = adminContent.indexOf('<!-- Clipboard Floating Indicator -->');
  const fbEnd = adminContent.indexOf('<!-- Custom Right Click Context Menu -->');
  if (fbStart === -1 || fbEnd === -1) throw new Error('Floating bar atau Context Menu marker tidak ditemukan.');
  
  let ctxEnd = fbEnd;
  let cCount = 0; let cFound = false;
  for (let i = fbEnd; i < adminContent.length; i++) {
    if (adminContent.substr(i, 4) === '<div') { cCount++; cFound = true; }
    if (adminContent.substr(i, 5) === '</div') { cCount--; }
    if (cFound && cCount === 0) { ctxEnd = i + 6; break; }
  }

  const overlayMatch = adminContent.match(/<div v-if="contextMenu.visible"[^>]*class="context-overlay"[^>]*><\/div>/);
  const overlayHtml = overlayMatch ? overlayMatch[0] : '';

  let adaptedHtml = adminContent.substring(adminHtmlStart, adminHtmlEnd)
    .replace(/adminToken/g, 'token')
    .replace(/currentAdminUser/g, 'user');
  let fbHtml = adminContent.substring(fbStart, fbEnd)
    .replace(/adminToken/g, 'token');
  let ctxHtml = adminContent.substring(fbEnd, ctxEnd)
    .replace(/adminToken/g, 'token');

  // TEMUKAN POSISI HTML DI MAHASISWA
  const mhsHtmlStartStr = '<div class="status-card logbook-card" style="margin-top: 2rem;">';
  const mhsHtmlStart = mhsContent.indexOf(mhsHtmlStartStr);
  if (mhsHtmlStart === -1) throw new Error('mhsHtmlStartStr tidak ditemukan di file mhsContent yang baru.');

  let mhsHtmlEnd = mhsHtmlStart;
  let mCount = 0; let mFound = false;
  for (let i = mhsHtmlStart; i < mhsContent.length; i++) {
    if (mhsContent.substr(i, 4) === '<div') { mCount++; mFound = true; }
    if (mhsContent.substr(i, 5) === '</div') { mCount--; }
    if (mFound && mCount === 0) { mhsHtmlEnd = i + 6; break; }
  }

  mhsContent = mhsContent.substring(0, mhsHtmlStart) + 
    adaptedHtml + '\n' + fbHtml + '\n' + overlayHtml + '\n' + ctxHtml + '\n' + 
    mhsContent.substring(mhsHtmlEnd);

  // Ambil CSS
  const adminCssStart = adminContent.indexOf('/* --- Advanced Explorer CSS --- */');
  const adminCssEnd = adminContent.lastIndexOf('</style>');
  if (adminCssStart > -1) {
    let extractedCss = adminContent.substring(adminCssStart, adminCssEnd);
    const mhsCssEnd = mhsContent.lastIndexOf('</style>');
    mhsContent = mhsContent.substring(0, mhsCssEnd) + '\n' + extractedCss + '\n' + mhsContent.substring(mhsCssEnd);
  }

  fs.writeFileSync(mhsFile, mhsContent, 'utf8');
  console.log('Mahasiswa Dashboard PERFECTLY patched!');

} catch(err) {
  console.error('Error saat patching:', err.message);
}
