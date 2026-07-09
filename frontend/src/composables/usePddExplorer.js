import { ref, computed } from 'vue';
import { useToast, useConfirm } from './useNotification.js';

export function usePddExplorer(tokenRef) {
  const getToken = () => (typeof tokenRef === 'string' ? tokenRef : tokenRef?.value ?? localStorage.getItem('token'));
  const { success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning } = useToast();
  const { confirm: showConfirm } = useConfirm();

  const selectedItems = ref(new Set()); const lastSelectedId = ref(null); const viewMode = ref('grid'); const isDragging = ref(false);
  const isCompressing = ref(false); const isExtracting = ref(false); const showCompressModal = ref(false); const compressZipName = ref('');
  const showExtractModal = ref(false); const extractMode = ref('new_folder'); const targetZipFile = ref(null); const extractNewFolderName = ref('');
  const explorerFolders = ref([]); const folderFiles = ref([]); const currentFolder = ref({ id: null, nama_folder: 'PDD' });
  const folderStack = ref([]); const pddRootFolder = ref(null); const pddNotFound = ref(false);
  const isFetchingFiles = ref(false); const explorerPage = ref(1); const explorerHasMore = ref(false); const isLoadingMore = ref(false);
  const ITEM_HEIGHT = 120, COLS = 5, VISIBLE_ROWS = 4; const explorerScrollTop = ref(0);
  const visibleStartIndex = computed(() => Math.max(0, Math.floor(explorerScrollTop.value / ITEM_HEIGHT) * COLS - COLS));
  const visibleEndIndex = computed(() => visibleStartIndex.value + (VISIBLE_ROWS + 2) * COLS);
  const virtualFiles = computed(() => folderFiles.value.slice(visibleStartIndex.value, visibleEndIndex.value));
  const spacerTop = computed(() => Math.floor(visibleStartIndex.value / COLS) * ITEM_HEIGHT + 'px');
  const spacerBottom = computed(() => { const tr = Math.ceil(folderFiles.value.length / COLS), er = Math.ceil(visibleEndIndex.value / COLS); return Math.max(0, tr - er) * ITEM_HEIGHT + 'px'; });
  const clipboard = ref({ action: null, items: [], nama: null }); const showUploadModal = ref(false); const uploadError = ref('');
  const isUploading = ref(false); const selectedUploadFile = ref(null); const uploadMode = ref('file'); const uploadCustomName = ref(''); const uploadLinkUrl = ref('');
  const showFolderModal = ref(false); const folderModalType = ref('create'); const folderFormName = ref(''); const activeFolderId = ref(null);
  const contextMenu = ref({ visible: false, x: 0, y: 0, targetType: null, item: null }); const previewFile = ref(null); const explorerSearchQuery = ref('');

  const isSelected = (type, id) => selectedItems.value.has(type + '-' + id);
  const toggleSelection = (e, type, id) => {
    const key = type + '-' + id;
    if (e.shiftKey && lastSelectedId.value) {
      const all = [...explorerFolders.value.map(f => 'folder-' + f.id), ...folderFiles.value.map(f => 'file-' + f.id)];
      const s = all.indexOf(lastSelectedId.value), end = all.indexOf(key);
      if (s !== -1 && end !== -1) { const mn = Math.min(s,end), mx = Math.max(s,end); for (let i = mn; i <= mx; i++) selectedItems.value.add(all[i]); }
    } else if (e.ctrlKey || e.metaKey) { if (selectedItems.value.has(key)) selectedItems.value.delete(key); else selectedItems.value.add(key); lastSelectedId.value = key; }
    else { selectedItems.value.clear(); selectedItems.value.add(key); lastSelectedId.value = key; }
  };
  const clearSelection = () => { selectedItems.value.clear(); lastSelectedId.value = null; };
  const handleDragOver = () => { isDragging.value = true; }; const handleDragLeave = () => { isDragging.value = false; };
  const handleDrop = async (e) => {
    isDragging.value = false; const files = e.dataTransfer.files; if (!files.length) return;
    const fd = new FormData(); fd.append('folder_id', currentFolder.value.id || '');
    for (let i = 0; i < files.length; i++) fd.append('files', files[i]);
    isUploading.value = true; toastInfo('Mengunggah ' + files.length + ' file...');
    try { const res = await fetch('/api/arsip/upload/multi', { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd }); const d = await res.json(); if (res.ok) { toastSuccess(d.message); await fetchDirectory(currentFolder.value); } else toastError(d.message); } catch { toastError('Gagal upload'); } finally { isUploading.value = false; }
  };
  const deleteSelectedItems = async () => {
    if (!selectedItems.value.size) return; if (!(await showConfirm('Hapus ' + selectedItems.value.size + ' item terpilih?'))) return;
    const fi = [], fld = []; selectedItems.value.forEach(k => { const [t,id] = k.split('-'); if (t==='file') fi.push(id); else fld.push(id); });
    try { const res = await fetch('/api/arsip/files/multi-delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ file_ids: fi, folder_ids: fld }) }); if (res.ok) { toastSuccess('Berhasil dihapus'); clearSelection(); await fetchDirectory(currentFolder.value); } } catch { toastError('Gagal menghapus'); }
  };
  const compressSelectedFiles = async () => {
    if (!compressZipName.value) return toastWarning('Masukkan nama ZIP');
    const fi = []; let hasFolder = false;
    selectedItems.value.forEach(k => { const [t,id] = k.split('-'); if (t==='file') fi.push(id); if (t==='folder') hasFolder = true; });
    if (fi.length === 0) return hasFolder ? toastWarning('Kompresi manual hanya untuk file. Buka folder terlebih dahulu.') : toastWarning('Pilih setidaknya 1 file.');
    isCompressing.value = true;
    try { const res = await fetch('/api/arsip/compress', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ file_ids: fi, folder_id: currentFolder.value.id, zip_name: compressZipName.value }) }); if (res.ok) { toastSuccess('Berhasil dikompresi'); showCompressModal.value = false; clearSelection(); await fetchDirectory(currentFolder.value); } } catch { toastError('Gagal mengompresi'); } finally { isCompressing.value = false; }
  };
  const submitExtract = async () => {
    if (!targetZipFile.value) return; isExtracting.value = true;
    try { const res = await fetch('/api/arsip/extract', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ file_id: targetZipFile.value.id, extract_mode: extractMode.value, new_folder_name: extractNewFolderName.value }) }); if (res.ok) { toastSuccess('Berhasil diekstrak'); showExtractModal.value = false; await fetchDirectory(currentFolder.value); } } catch { toastError('Gagal mengekstrak'); } finally { isExtracting.value = false; }
  };
  const onAdvancedRightClick = (e) => { if (selectedItems.value.size > 1) contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, targetType: 'multi', item: null }; else onWhitespaceRightClick(e); };
  const onWhitespaceRightClick = (e) => { if (e.target.closest('.pdd-file-item')) return; contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, targetType: 'whitespace', item: null }; };
  const onFolderRightClick = (e, folder) => { if (!selectedItems.value.has('folder-' + folder.id)) { clearSelection(); selectedItems.value.add('folder-' + folder.id); lastSelectedId.value = 'folder-' + folder.id; } if (selectedItems.value.size > 1) return onAdvancedRightClick(e); contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, targetType: 'folder', item: folder }; };
  const onFileRightClick = (e, file) => { if (!selectedItems.value.has('file-' + file.id)) { clearSelection(); selectedItems.value.add('file-' + file.id); lastSelectedId.value = 'file-' + file.id; } if (selectedItems.value.size > 1) return onAdvancedRightClick(e); contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, targetType: 'file', item: file }; };
  const closeContextMenu = () => { contextMenu.value.visible = false; };
  const fetchDirectory = async (folderObj) => {
    currentFolder.value = folderObj; isFetchingFiles.value = true; explorerPage.value = 1; explorerHasMore.value = false; explorerScrollTop.value = 0;
    const si = folderStack.value.findIndex(f => f.id === folderObj.id); if (si > -1) folderStack.value = folderStack.value.slice(0, si + 1); else folderStack.value.push(folderObj);
    const pId = folderObj.id ? `?parentId=${folderObj.id}&page=1&limit=50` : '?page=1&limit=50';
    const sp = explorerSearchQuery.value ? `&search=${encodeURIComponent(explorerSearchQuery.value)}` : '';
    try { const res = await fetch(`/api/arsip/directory${pId}${sp}`, { headers: { Authorization: `Bearer ${getToken()}` } }); if (res.ok) { const d = await res.json(); explorerFolders.value = d.folders; folderFiles.value = d.files; explorerHasMore.value = d.hasMore; } } catch (e) { console.error(e); } finally { isFetchingFiles.value = false; }
  };
  const loadMoreFiles = async () => {
    if (!explorerHasMore.value || isLoadingMore.value) return; isLoadingMore.value = true;
    const np = explorerPage.value + 1, pId = currentFolder.value.id ? `parentId=${currentFolder.value.id}&` : '', sp = explorerSearchQuery.value ? `search=${encodeURIComponent(explorerSearchQuery.value)}&` : '';
    try { const res = await fetch(`/api/arsip/directory?${pId}${sp}page=${np}&limit=50`, { headers: { Authorization: `Bearer ${getToken()}` } }); if (res.ok) { const d = await res.json(); folderFiles.value = [...folderFiles.value, ...d.files]; explorerPage.value = np; explorerHasMore.value = d.hasMore; } } catch { } finally { isLoadingMore.value = false; }
  };
  const handleExplorerSearch = () => fetchDirectory(currentFolder.value);
  const init = async () => {
    isFetchingFiles.value = true;
    try { const res = await fetch('/api/arsip/pdd-gallery', { headers: { Authorization: `Bearer ${getToken()}` } }); if (res.ok) { const data = await res.json(); if (data.folder_exists && data.folder_id) { const pdd = { id: data.folder_id, nama_folder: 'PDD' }; pddRootFolder.value = pdd; folderStack.value = [pdd]; await fetchDirectory(pdd); } else { pddNotFound.value = true; isFetchingFiles.value = false; } } } catch { isFetchingFiles.value = false; }
  };
  const submitFolderForm = async () => {
    if (!folderFormName.value) return;
    const url = folderModalType.value === 'create' ? '/api/arsip/folders' : `/api/arsip/folders/${activeFolderId.value}`, method = folderModalType.value === 'create' ? 'POST' : 'PUT';
    try { const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ nama_folder: folderFormName.value, parent_id: currentFolder.value.id }) }); const d = await res.json(); if (res.ok) { if (folderModalType.value === 'create') explorerFolders.value.push({ id: d.id, nama_folder: folderFormName.value, parent_id: currentFolder.value.id }); else { const f = explorerFolders.value.find(f => f.id === activeFolderId.value); if (f) f.nama_folder = folderFormName.value; } explorerFolders.value.sort((a,b) => a.nama_folder.localeCompare(b.nama_folder)); showFolderModal.value = false; folderFormName.value = ''; activeFolderId.value = null; } else toastError(d.message || 'Gagal menyimpan folder'); } catch { toastError('Terjadi kesalahan jaringan.'); }
  };
  const openCreateFolderModal = () => { folderModalType.value = 'create'; folderFormName.value = ''; showFolderModal.value = true; };
  const handleContextRename = async () => {
    const { item, targetType } = contextMenu.value; if (!item) return;
    const cn = targetType === 'folder' ? item.nama_folder : item.nama_file, nn = prompt('Ganti nama:', cn);
    if (!nn || nn.trim() === '' || nn === cn) { closeContextMenu(); return; }
    try { const res = await fetch('/api/arsip/rename', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ id: item.id, type: targetType, newName: nn.trim() }) }); if (res.ok) fetchDirectory(currentFolder.value); else { const d = await res.json(); toastError(d.message || 'Gagal mengganti nama.'); } } catch { toastError('Terjadi kesalahan jaringan.'); }
    closeContextMenu();
  };
  const handleCutCopy = (action) => {
    if (contextMenu.value.targetType === 'multi') { const items = []; selectedItems.value.forEach(k => { const [t,id] = k.split('-'); items.push({type:t,id}); }); clipboard.value = { action, items, nama: items.length + ' Item Terpilih' }; }
    else if (contextMenu.value.item) { clipboard.value = { action, items: [{ type: contextMenu.value.targetType, id: contextMenu.value.item.id }], nama: contextMenu.value.item.nama_folder || contextMenu.value.item.nama_file }; }
    closeContextMenu();
  };
  const handlePaste = async () => {
    if (!clipboard.value.items?.length) return;
    try { const results = await Promise.all(clipboard.value.items.map(item => fetch('/api/arsip/paste', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ type: item.type, action: clipboard.value.action, id: item.id, target_folder_id: currentFolder.value?.id || null }) }))); if (results.every(r => r.ok)) { clipboard.value = { action: null, items: [], nama: null }; toastSuccess('Berhasil dipaste!'); } else toastError('Sebagian item gagal diproses'); fetchDirectory(currentFolder.value); } catch { toastError('Terjadi kesalahan saat paste'); }
    closeContextMenu();
  };
  const handleContextDelete = async () => {
    const { targetType, item } = contextMenu.value, isFolder = targetType === 'folder';
    const confirmed = await showConfirm({ title: isFolder ? 'Hapus Folder?' : 'Hapus File?', message: isFolder ? `Folder "${item.nama_folder}" beserta semua isinya akan dihapus permanen.` : `File "${item.nama_file}" akan dihapus permanen.`, confirmText: '🗑 Ya, Hapus', type: 'danger' });
    if (confirmed) { try { const res = await fetch(isFolder ? `/api/arsip/folders/${item.id}` : `/api/arsip/files/${item.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } }); if (res.ok) fetchDirectory(currentFolder.value); } catch { } }
    closeContextMenu();
  };
  const getFileIcon = (tipe, nama = '') => { if (tipe==='link') return '🔗'; const n = nama.toLowerCase(); if (n.endsWith('.zip')||n.endsWith('.rar')) return '📦'; if (n.endsWith('.pdf')||(tipe&&tipe.includes('pdf'))) return '📕'; if (n.endsWith('.doc')||n.endsWith('.docx')) return '📘'; if (n.endsWith('.xls')||n.endsWith('.xlsx')) return '📗'; if (tipe&&tipe.includes('image')) return '🖼️'; if (tipe&&tipe.includes('video')) return '🎬'; return '📄'; };
  const handleFileSelect = (e) => { selectedUploadFile.value = Array.from(e.target.files); };
  const submitUpload = async () => {
    uploadError.value = ''; isUploading.value = true;
    if (uploadMode.value === 'file') {
      if (!selectedUploadFile.value?.length) { uploadError.value = 'Pilih file terlebih dahulu.'; isUploading.value = false; return; }
      const fd = new FormData(); fd.append('folder_id', currentFolder.value.id || ''); if (uploadCustomName.value && selectedUploadFile.value.length === 1) fd.append('custom_name', uploadCustomName.value); for (let i=0;i<selectedUploadFile.value.length;i++) fd.append('files', selectedUploadFile.value[i]);
      try { const res = await fetch('/api/arsip/upload/multi', { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd }); const d = await res.json(); if (res.ok) { showUploadModal.value = false; selectedUploadFile.value = null; uploadCustomName.value = ''; await fetchDirectory(currentFolder.value); } else uploadError.value = d.message; } catch { uploadError.value = 'Terjadi kesalahan saat unggah.'; }
    } else {
      if (!uploadCustomName.value || !uploadLinkUrl.value) { uploadError.value = 'Keterangan dan URL wajib diisi.'; isUploading.value = false; return; }
      try { const res = await fetch('/api/arsip/link', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ folder_id: currentFolder.value.id || '', nama_file: uploadCustomName.value, url_file: uploadLinkUrl.value }) }); const d = await res.json(); if (res.ok) { showUploadModal.value = false; uploadCustomName.value = ''; uploadLinkUrl.value = ''; await fetchDirectory(currentFolder.value); } else uploadError.value = d.message; } catch { uploadError.value = 'Terjadi kesalahan saat menyimpan tautan.'; }
    }
    isUploading.value = false;
  };
  const openPreview = (fileObj) => { if (fileObj.tipe_file === 'link') { window.open(fileObj.url_file, '_blank'); return; } if (!fileObj.tipe_file.includes('image')&&!fileObj.tipe_file.includes('video')&&!fileObj.tipe_file.includes('pdf')) downloadOriginal(fileObj); else previewFile.value = fileObj; };
  const downloadOriginal = async (fileObj) => { try { const r = await fetch(fileObj.url_file); if (!r.ok) throw new Error(); const blob = await r.blob(), url = window.URL.createObjectURL(blob), a = document.createElement('a'); a.href=url; a.download=fileObj.nama_file; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a); } catch { toastError('Gagal mengunduh file.'); } };
  const downloadFolderZip = async (folderId, folderName) => { try { const res = await fetch(`/api/arsip/download-folder/${folderId}`, { headers: { Authorization: `Bearer ${getToken()}` } }); if (!res.ok) { const d = await res.json(); throw new Error(d.message); } const blob = await res.blob(), url = window.URL.createObjectURL(blob), a = document.createElement('a'); a.href=url; a.download=`${folderName}.zip`; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a); } catch (e) { toastError(e.message||'Gagal mengunduh folder.'); } };
  const goToPddRoot = () => { explorerSearchQuery.value = ''; if (pddRootFolder.value) fetchDirectory(pddRootFolder.value); };

  return {
    selectedItems, viewMode, isDragging, isCompressing, isExtracting,
    showCompressModal, compressZipName, showExtractModal, extractMode, targetZipFile, extractNewFolderName,
    explorerFolders, folderFiles, currentFolder, folderStack, pddRootFolder, pddNotFound,
    isFetchingFiles, explorerHasMore, isLoadingMore, explorerScrollTop,
    virtualFiles, spacerTop, spacerBottom, clipboard,
    showUploadModal, uploadError, isUploading, selectedUploadFile, uploadMode, uploadCustomName, uploadLinkUrl,
    showFolderModal, folderModalType, folderFormName, activeFolderId,
    contextMenu, previewFile, explorerSearchQuery,
    isSelected, toggleSelection, clearSelection,
    handleDragOver, handleDragLeave, handleDrop,
    deleteSelectedItems, compressSelectedFiles, submitExtract,
    onAdvancedRightClick, onWhitespaceRightClick,
    fetchDirectory, init, loadMoreFiles, handleExplorerSearch, goToPddRoot,
    submitFolderForm, openCreateFolderModal,
    onFolderRightClick, onFileRightClick, closeContextMenu, handleContextRename,
    handleCutCopy, handlePaste, handleContextDelete,
    getFileIcon, handleFileSelect, submitUpload, openPreview, downloadOriginal, downloadFolderZip,
  };
}
