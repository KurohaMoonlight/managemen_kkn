const fs = require('fs');

const adminFile = 'c:/Apache24/htdocs/sistem_management_kkn/frontend/src/views/AdminDashboard.vue';
const mhsFile = 'c:/Apache24/htdocs/sistem_management_kkn/frontend/src/views/MahasiswaDashboard.vue';

let adminContent = fs.readFileSync(adminFile, 'utf8');
let mhsContent = fs.readFileSync(mhsFile, 'utf8');

// 1. EXTRACT ADMIN SCRIPT
const adminScriptStart = adminContent.indexOf('// --- FILE EXPLORER STATES ---');
const scriptBlockMatch = adminContent.match(/\/\/ --- FILE EXPLORER STATES ---[\s\S]*?(?=\/\/ --- (?:MODALS & FORMS|CRUD|PENGATURAN|PIC))/i);
let extractedScript = scriptBlockMatch ? scriptBlockMatch[0] : '';
if(!extractedScript) {
    const endIdx = adminContent.indexOf('// --- PIC (Penanggung Jawab) ---');
    extractedScript = adminContent.substring(adminScriptStart, endIdx);
}

// 2. EXTRACT ADMIN HTML
const htmlStartStr = '<div class="file-explorer-container">';
const adminHtmlStart = adminContent.indexOf(htmlStartStr);
let adminHtmlEnd = adminHtmlStart;
let divCount = 0;
let foundFirst = false;
for (let i = adminHtmlStart; i < adminContent.length; i++) {
  if (adminContent.substr(i, 4) === '<div') { divCount++; foundFirst = true; }
  if (adminContent.substr(i, 5) === '</div') { divCount--; }
  if (foundFirst && divCount === 0) {
    adminHtmlEnd = i + 6;
    break;
  }
}
let extractedHtml = adminContent.substring(adminHtmlStart, adminHtmlEnd);

// 2b. EXTRACT MODALS AND MENUS CAREFULLY
const floatingBarStr = '<!-- Clipboard Floating Indicator -->';
const contextMenuStr = '<!-- Custom Right Click Context Menu -->';

const floatingStart = adminContent.indexOf(floatingBarStr);
let contextEnd = adminContent.indexOf(contextMenuStr);
let ctxDivCount = 0;
let ctxFoundFirst = false;
let ctxHtmlEnd = contextEnd;
for (let i = contextEnd; i < adminContent.length; i++) {
  if (adminContent.substr(i, 4) === '<div') { ctxDivCount++; ctxFoundFirst = true; }
  if (adminContent.substr(i, 5) === '</div') { ctxDivCount--; }
  if (ctxFoundFirst && ctxDivCount === 0) {
    ctxHtmlEnd = i + 6;
    break;
  }
}

let fbDivCount = 0;
let fbFoundFirst = false;
let fbHtmlEnd = floatingStart;
for (let i = floatingStart; i < adminContent.length; i++) {
  if (adminContent.substr(i, 4) === '<div') { fbDivCount++; fbFoundFirst = true; }
  if (adminContent.substr(i, 5) === '</div') { fbDivCount--; }
  if (fbFoundFirst && fbDivCount === 0) {
    fbHtmlEnd = i + 6;
    break;
  }
}

const floatingBarHtml = adminContent.substring(floatingStart, fbHtmlEnd);
const contextMenuHtml = adminContent.substring(contextEnd, ctxHtmlEnd);

const overlayMatch = adminContent.match(/<div v-if="contextMenu.visible"[^>]*class="context-overlay"[^>]*><\/div>/);
const overlayHtml = overlayMatch ? overlayMatch[0] : '';


// 3. ADAPT FOR MAHASISWA
// Change all 'adminToken' to 'token', and 'currentAdminUser' to 'user' IN BOTH SCRIPT AND HTML!
let adaptedScript = extractedScript
  .replace(/adminToken/g, 'token')
  .replace(/fetchPicGroups\(\);/g, '')
  .replace(/loadQRSecret\(\);/g, '')
  .replace(/fetchGDriveStatus\(\);/g, '')
  .replace(/currentAdminUser/g, 'user')
  .replace(/showUploadModal = ref\(false\)/g, 'showUploadModal = ref(false)');

let adaptedHtml = extractedHtml
  .replace(/adminToken/g, 'token')
  .replace(/currentAdminUser/g, 'user');

let adaptedFloatingBar = floatingBarHtml
  .replace(/adminToken/g, 'token')
  .replace(/currentAdminUser/g, 'user');
  
let adaptedContextMenu = contextMenuHtml
  .replace(/adminToken/g, 'token')
  .replace(/currentAdminUser/g, 'user');

// 4. INJECT INTO MAHASISWA
// HTML REPLACEMENT
const templateTagStart = mhsContent.indexOf('<template>');
const mhsHtmlStartStr = '<div class="status-card logbook-card" style="margin-top: 2rem;">';
const mhsHtmlStart = mhsContent.indexOf(mhsHtmlStartStr, templateTagStart);

if (mhsHtmlStart === -1) {
    throw new Error('mhsHtmlStartStr tidak ditemukan di MahasiswaDashboard.vue');
}

let mhsHtmlEnd = mhsHtmlStart;
let mhsDivCount = 0;
let mhsFoundFirst = false;
for (let i = mhsHtmlStart; i < mhsContent.length; i++) {
  if (mhsContent.substr(i, 4) === '<div') { mhsDivCount++; mhsFoundFirst = true; }
  if (mhsContent.substr(i, 5) === '</div') { mhsDivCount--; }
  if (mhsFoundFirst && mhsDivCount === 0) {
    mhsHtmlEnd = i + 6;
    break;
  }
}

mhsContent = mhsContent.substring(0, mhsHtmlStart) + 
  adaptedHtml + '\n\n' + 
  adaptedFloatingBar + '\n' + 
  overlayHtml + '\n' + 
  adaptedContextMenu + '\n' + 
  mhsContent.substring(mhsHtmlEnd);


// Replace Script in Mahasiswa
const oldScriptStart = mhsContent.indexOf('const explorerFolders = ref([]);');
const oldScriptEnd = mhsContent.indexOf('</script>');

if (oldScriptStart === -1 || oldScriptEnd === -1) {
    throw new Error('Script boundaries tidak ditemukan di MahasiswaDashboard.vue');
}

mhsContent = mhsContent.substring(0, oldScriptStart) + adaptedScript + '\n' + mhsContent.substring(oldScriptEnd);

// Copy styles
const adminCssStart = adminContent.indexOf('/* --- Advanced Explorer CSS --- */');
const adminCssEnd = adminContent.lastIndexOf('</style>');
if(adminCssStart > -1) {
    let extractedCss = adminContent.substring(adminCssStart, adminCssEnd);
    if(!mhsContent.includes('/* --- Advanced Explorer CSS --- */')) {
        const mhsCssEnd = mhsContent.lastIndexOf('</style>');
        if (mhsCssEnd > -1) {
            mhsContent = mhsContent.substring(0, mhsCssEnd) + '\n' + extractedCss + '\n' + mhsContent.substring(mhsCssEnd);
        } else {
             mhsContent += '\n<style scoped>\n' + extractedCss + '\n</style>\n';
        }
    }
}

fs.writeFileSync('c:/Apache24/htdocs/sistem_management_kkn/patch-porting.cjs', `
const fs = require('fs');
fs.writeFileSync('${mhsFile}', ${JSON.stringify(mhsContent)}, 'utf8');
console.log('Porting successful!');
`, 'utf8');

console.log('Patch generator generated!');
