const fs = require('fs');
const file = 'c:/Apache24/htdocs/sistem_management_kkn/frontend/src/views/AdminDashboard.vue';
let content = fs.readFileSync(file, 'utf8');

// 1. Add isCompressing and isExtracting states
const statesInjection = `
const isCompressing = ref(false);
const isExtracting = ref(false);
`;
content = content.replace('const isDragging = ref(false);', 'const isDragging = ref(false);\n' + statesInjection);

// 2. Update compressSelectedFiles
const oldCompress = `const compressSelectedFiles = async () => {
  if(!compressZipName.value) return toastWarning('Masukkan nama ZIP');
  const file_ids = [];
  selectedItems.value.forEach(key => {
    const [type, id] = key.split('-');
    if(type === 'file') file_ids.push(id);
  });
  
  try {
    const res = await fetch('/api/arsip/compress', {`;

const newCompress = `const compressSelectedFiles = async () => {
  if(!compressZipName.value) return toastWarning('Masukkan nama ZIP');
  const file_ids = [];
  selectedItems.value.forEach(key => {
    const [type, id] = key.split('-');
    if(type === 'file') file_ids.push(id);
  });
  
  isCompressing.value = true;
  try {
    const res = await fetch('/api/arsip/compress', {`;

content = content.replace(oldCompress, newCompress);

// Add finally block to compressSelectedFiles
const oldCompressEnd = `showCompressModal.value = false;
      clearSelection();
      await fetchDirectory(currentFolder.value);
    }
  } catch(e) {
    toastError('Gagal mengompresi');
  }
};`;

const newCompressEnd = `showCompressModal.value = false;
      clearSelection();
      await fetchDirectory(currentFolder.value);
    }
  } catch(e) {
    toastError('Gagal mengompresi');
  } finally {
    isCompressing.value = false;
  }
};`;
content = content.replace(oldCompressEnd, newCompressEnd);


// 3. Update submitExtract
const oldExtract = `const submitExtract = async () => {
  if(!targetZipFile.value) return;
  try {
    const res = await fetch('/api/arsip/extract', {`;

const newExtract = `const submitExtract = async () => {
  if(!targetZipFile.value) return;
  isExtracting.value = true;
  try {
    const res = await fetch('/api/arsip/extract', {`;
content = content.replace(oldExtract, newExtract);

// Add finally block to submitExtract
const oldExtractEnd = `showExtractModal.value = false;
      await fetchDirectory(currentFolder.value);
    }
  } catch(e) {
    toastError('Gagal mengekstrak');
  }
};`;
const newExtractEnd = `showExtractModal.value = false;
      await fetchDirectory(currentFolder.value);
    }
  } catch(e) {
    toastError('Gagal mengekstrak');
  } finally {
    isExtracting.value = false;
  }
};`;
content = content.replace(oldExtractEnd, newExtractEnd);

// 4. Update UI for Extract Modal
const oldExtractBtn = `<button class="btn btn-primary" @click="submitExtract">⚙️ Mulai Ekstrak</button>`;
const newExtractBtn = `<button class="btn btn-primary" @click="submitExtract" :disabled="isExtracting">⚙️ {{ isExtracting ? 'Sedang Mengekstrak...' : 'Mulai Ekstrak' }}</button>`;
content = content.replace(oldExtractBtn, newExtractBtn);

// 5. Update UI for Compress Modal
const oldCompressBtn = `<button class="btn btn-primary" @click="compressSelectedFiles">📦 Mulai Kompresi</button>`;
const newCompressBtn = `<button class="btn btn-primary" @click="compressSelectedFiles" :disabled="isCompressing">📦 {{ isCompressing ? 'Sedang Mengompres...' : 'Mulai Kompresi' }}</button>`;
content = content.replace(oldCompressBtn, newCompressBtn);

fs.writeFileSync(file, content, 'utf8');
console.log('Frontend patched with loading states!');
