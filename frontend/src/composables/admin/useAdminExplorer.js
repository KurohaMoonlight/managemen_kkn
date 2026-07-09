import { ref, computed } from 'vue';
import { useToast, useConfirm } from '../useNotification.js';
import { adminToken, currentAdminUser } from './adminContext.js';

export function useAdminExplorer() {
  const { success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning } = useToast();
  const { confirm: showConfirm } = useConfirm();

  // --- ADVANCED EXPLORER STATES ---
  const selectedItems = ref(new Set());
  const lastSelectedId = ref(null);
  const viewMode = ref('grid');
  const isDragging = ref(false);

  const isCompressing = ref(false);
  const isExtracting = ref(false);

  const showCompressModal = ref(false);
  const compressZipName = ref('');
  const showExtractModal = ref(false);
  const extractMode = ref('new_folder');
  const targetZipFile = ref(null);
  const extractNewFolderName = ref('');

  // --- FILE EXPLORER STATES ---
  const explorerFolders = ref([]);
  const folderFiles = ref([]);
  const currentFolder = ref({ id: null, nama_folder: 'Beranda' });
  const folderStack = ref([{ id: null, nama_folder: 'Beranda' }]);
  const isFetchingFiles = ref(false);
  const explorerPage = ref(1);
  const explorerHasMore = ref(false);
  const isLoadingMore = ref(false);

  const ITEM_HEIGHT = 120;
  const COLS = 5;
  const VISIBLE_ROWS = 4;
  const explorerScrollTop = ref(0);
  const visibleStartIndex = computed(() => {
    return Math.max(0, Math.floor(explorerScrollTop.value / ITEM_HEIGHT) * COLS - COLS);
  });
  const visibleEndIndex = computed(() => {
    return visibleStartIndex.value + (VISIBLE_ROWS + 2) * COLS;
  });
  const virtualFiles = computed(() => folderFiles.value.slice(visibleStartIndex.value, visibleEndIndex.value));
  const spacerTop = computed(() => Math.floor(visibleStartIndex.value / COLS) * ITEM_HEIGHT + 'px');
  const spacerBottom = computed(() => {
    const totalRows = Math.ceil(folderFiles.value.length / COLS);
    const endRow = Math.ceil(visibleEndIndex.value / COLS);
    return Math.max(0, totalRows - endRow) * ITEM_HEIGHT + 'px';
  });

  const clipboard = ref({ action: null, type: null, id: null, nama: null });

  const showUploadModal = ref(false);
  const uploadError = ref('');
  const isUploading = ref(false);
  const selectedUploadFile = ref(null);
  const uploadMode = ref('file');
  const uploadCustomName = ref('');
  const uploadLinkUrl = ref('');

  const showFolderModal = ref(false);
  const folderModalType = ref('create');
  const folderFormName = ref('');
  const activeFolderId = ref(null);

  const contextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    targetType: null,
    item: null,
  });

  const previewFile = ref(null);
  const showPreviewModal = ref(false);

  const explorerSearchQuery = ref('');

  const isSelected = (type, id) => selectedItems.value.has(type + '-' + id);

  const toggleSelection = (e, type, id) => {
    const key = type + '-' + id;
    if (e.shiftKey && lastSelectedId.value) {
      const allItems = [
        ...explorerFolders.value.map((f) => 'folder-' + f.id),
        ...folderFiles.value.map((f) => 'file-' + f.id),
      ];
      const startIdx = allItems.indexOf(lastSelectedId.value);
      const endIdx = allItems.indexOf(key);
      if (startIdx !== -1 && endIdx !== -1) {
        const min = Math.min(startIdx, endIdx);
        const max = Math.max(startIdx, endIdx);
        for (let i = min; i <= max; i++) {
          selectedItems.value.add(allItems[i]);
        }
      }
    } else if (e.ctrlKey || e.metaKey) {
      if (selectedItems.value.has(key)) selectedItems.value.delete(key);
      else selectedItems.value.add(key);
      lastSelectedId.value = key;
    } else {
      selectedItems.value.clear();
      selectedItems.value.add(key);
      lastSelectedId.value = key;
    }
  };

  const clearSelection = () => {
    selectedItems.value.clear();
    lastSelectedId.value = null;
  };

  const handleDragOver = () => {
    isDragging.value = true;
  };

  const handleDragLeave = () => {
    isDragging.value = false;
  };

  const handleDrop = async (e) => {
    isDragging.value = false;
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const formData = new FormData();
    formData.append('folder_id', currentFolder.value.id || '');
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    isUploading.value = true;
    toastInfo('Mengunggah ' + files.length + ' file...');
    try {
      const res = await fetch('/api/arsip/upload/multi', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toastSuccess(data.message);
        await fetchDirectory(currentFolder.value);
      } else {
        toastError(data.message);
      }
    } catch (err) {
      toastError('Gagal multi-upload');
    } finally {
      isUploading.value = false;
    }
  };

  const deleteSelectedItems = async () => {
    if (selectedItems.value.size === 0) return;
    if (!(await showConfirm('Hapus ' + selectedItems.value.size + ' item terpilih?'))) return;

    const file_ids = [];
    const folder_ids = [];
    selectedItems.value.forEach((key) => {
      const [type, id] = key.split('-');
      if (type === 'file') file_ids.push(id);
      else if (type === 'folder') folder_ids.push(id);
    });

    try {
      const res = await fetch('/api/arsip/files/multi-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ file_ids, folder_ids }),
      });
      if (res.ok) {
        toastSuccess('Item terpilih berhasil dihapus');
        clearSelection();
        await fetchDirectory(currentFolder.value);
      }
    } catch (e) {
      toastError('Gagal menghapus item');
    }
  };

  const compressSelectedFiles = async () => {
    if (!compressZipName.value) return toastWarning('Masukkan nama ZIP');
    const file_ids = [];
    let hasFolder = false;
    selectedItems.value.forEach((key) => {
      const [type, id] = key.split('-');
      if (type === 'file') file_ids.push(id);
      if (type === 'folder') hasFolder = true;
    });

    if (file_ids.length === 0) {
      if (hasFolder) return toastWarning('Kompresi manual hanya untuk file. Buka folder terlebih dahulu.');
      return toastWarning('Pilih setidaknya 1 file.');
    }

    isCompressing.value = true;
    try {
      const res = await fetch('/api/arsip/compress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          file_ids,
          folder_id: currentFolder.value.id,
          zip_name: compressZipName.value,
        }),
      });
      if (res.ok) {
        toastSuccess('Berhasil dikompresi');
        showCompressModal.value = false;
        clearSelection();
        await fetchDirectory(currentFolder.value);
      }
    } catch (e) {
      toastError('Gagal mengompresi');
    } finally {
      isCompressing.value = false;
    }
  };

  const submitExtract = async () => {
    if (!targetZipFile.value) return;
    isExtracting.value = true;
    try {
      const res = await fetch('/api/arsip/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          file_id: targetZipFile.value.id,
          extract_mode: extractMode.value,
          new_folder_name: extractNewFolderName.value,
        }),
      });
      if (res.ok) {
        toastSuccess('Berhasil diekstrak');
        showExtractModal.value = false;
        await fetchDirectory(currentFolder.value);
      }
    } catch (e) {
      toastError('Gagal mengekstrak');
    } finally {
      isExtracting.value = false;
    }
  };

  const onWhitespaceRightClick = (event) => {
    if (event.target.closest('.file-item')) return;
    contextMenu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      targetType: 'whitespace',
      item: null,
    };
  };

  const onAdvancedRightClick = (e) => {
    if (selectedItems.value.size > 1) {
      contextMenu.value = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        targetType: 'multi',
        item: null,
      };
    } else {
      onWhitespaceRightClick(e);
    }
  };

  const fetchDirectory = async (folderObj) => {
    currentFolder.value = folderObj;
    isFetchingFiles.value = true;
    explorerPage.value = 1;
    explorerHasMore.value = false;
    explorerScrollTop.value = 0;

    const stackIndex = folderStack.value.findIndex((f) => f.id === folderObj.id);
    if (stackIndex > -1) {
      folderStack.value = folderStack.value.slice(0, stackIndex + 1);
    } else {
      folderStack.value.push(folderObj);
    }

    const pId = folderObj.id ? `?parentId=${folderObj.id}&page=1&limit=50` : '?page=1&limit=50';
    const searchParam = explorerSearchQuery.value
      ? `&search=${encodeURIComponent(explorerSearchQuery.value)}`
      : '';
    try {
      const res = await fetch(`/api/arsip/directory${pId}${searchParam}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        explorerFolders.value = data.folders;
        folderFiles.value = data.files;
        explorerHasMore.value = data.hasMore;
      }
    } catch (e) {
      console.error('Gagal ambil direktori', e);
    } finally {
      isFetchingFiles.value = false;
    }
  };

  const init = () => {
    fetchDirectory({ id: null, nama_folder: 'Beranda' });
  };

  const loadMoreFiles = async () => {
    if (!explorerHasMore.value || isLoadingMore.value) return;
    isLoadingMore.value = true;
    const nextPage = explorerPage.value + 1;
    const pId = currentFolder.value.id ? `parentId=${currentFolder.value.id}&` : '';
    const searchParam = explorerSearchQuery.value
      ? `search=${encodeURIComponent(explorerSearchQuery.value)}&`
      : '';
    try {
      const res = await fetch(`/api/arsip/directory?${pId}${searchParam}page=${nextPage}&limit=50`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        folderFiles.value = [...folderFiles.value, ...data.files];
        explorerPage.value = nextPage;
        explorerHasMore.value = data.hasMore;
      }
    } catch (e) {
      console.error('Load more failed', e);
    } finally {
      isLoadingMore.value = false;
    }
  };

  const goBackToRoot = () => {
    explorerSearchQuery.value = '';
    fetchDirectory({ id: null, nama_folder: 'Beranda' });
  };

  const handleExplorerSearch = () => {
    fetchDirectory(currentFolder.value);
  };

  const submitFolderForm = async () => {
    if (!folderFormName.value) return;
    const url =
      folderModalType.value === 'create'
        ? '/api/arsip/folders'
        : `/api/arsip/folders/${activeFolderId.value}`;
    const method = folderModalType.value === 'create' ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ nama_folder: folderFormName.value, parent_id: currentFolder.value.id }),
      });
      const data = await res.json();

      if (res.ok) {
        if (folderModalType.value === 'create') {
          explorerFolders.value.push({
            id: data.id,
            nama_folder: folderFormName.value,
            parent_id: currentFolder.value.id,
          });
        } else {
          const folder = explorerFolders.value.find((f) => f.id === activeFolderId.value);
          if (folder) folder.nama_folder = folderFormName.value;
        }

        explorerFolders.value.sort((a, b) => a.nama_folder.localeCompare(b.nama_folder));

        showFolderModal.value = false;
        folderFormName.value = '';
        activeFolderId.value = null;
      } else {
        toastError(data.message || 'Gagal menyimpan folder');
      }
    } catch (e) {
      toastError('Terjadi kesalahan jaringan.');
      console.error('Gagal simpan folder', e);
    }
  };

  const openCreateFolderModal = () => {
    folderModalType.value = 'create';
    folderFormName.value = '';
    showFolderModal.value = true;
  };

  const openRenameFolderModal = (folder, event) => {
    if (event) event.stopPropagation();
    folderModalType.value = 'rename';
    folderFormName.value = folder.nama_folder;
    activeFolderId.value = folder.id;
    showFolderModal.value = true;
  };

  const onFolderRightClick = (event, folder) => {
    if (!selectedItems.value.has('folder-' + folder.id)) {
      clearSelection();
      selectedItems.value.add('folder-' + folder.id);
      lastSelectedId.value = 'folder-' + folder.id;
    }
    if (selectedItems.value.size > 1) {
      return onAdvancedRightClick(event);
    }
    contextMenu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      targetType: 'folder',
      item: folder,
    };
  };

  const onFileRightClick = (event, file) => {
    if (!selectedItems.value.has('file-' + file.id)) {
      clearSelection();
      selectedItems.value.add('file-' + file.id);
      lastSelectedId.value = 'file-' + file.id;
    }
    if (selectedItems.value.size > 1) {
      return onAdvancedRightClick(event);
    }
    contextMenu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      targetType: 'file',
      item: file,
    };
  };

  const closeContextMenu = () => {
    contextMenu.value.visible = false;
  };

  const handleContextRename = async () => {
    const { item, targetType } = contextMenu.value;
    if (!item) return;
    const currentName = targetType === 'folder' ? item.nama_folder : item.nama_file;
    const newName = prompt(`Ganti nama ${targetType === 'folder' ? 'folder' : 'file'}:`, currentName);

    if (!newName || newName.trim() === '' || newName === currentName) {
      closeContextMenu();
      return;
    }

    try {
      const res = await fetch('/api/arsip/rename', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          id: item.id,
          type: targetType,
          newName: newName.trim(),
        }),
      });
      if (res.ok) {
        fetchDirectory(currentFolder.value);
      } else {
        const d = await res.json();
        toastError(d.message || 'Gagal mengganti nama.');
      }
    } catch (e) {
      toastError('Terjadi kesalahan jaringan.');
    }
    closeContextMenu();
  };

  const handleCutCopy = (action) => {
    if (contextMenu.value.targetType === 'multi') {
      const items = [];
      selectedItems.value.forEach((key) => {
        const [type, id] = key.split('-');
        items.push({ type, id });
      });
      clipboard.value = {
        action: action,
        items: items,
        nama: items.length + ' Item Terpilih',
      };
    } else if (contextMenu.value.item) {
      clipboard.value = {
        action: action,
        items: [
          {
            type: contextMenu.value.targetType,
            id: contextMenu.value.item.id,
          },
        ],
        nama: contextMenu.value.item.nama_folder || contextMenu.value.item.nama_file,
      };
    }
    closeContextMenu();
  };

  const handlePaste = async () => {
    if (!clipboard.value.items || clipboard.value.items.length === 0) return;
    try {
      const promises = clipboard.value.items.map((item) =>
        fetch('/api/arsip/paste', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            type: item.type,
            action: clipboard.value.action,
            id: item.id,
            target_folder_id: currentFolder.value ? currentFolder.value.id : null,
          }),
        })
      );
      const results = await Promise.all(promises);
      const allOk = results.every((res) => res.ok);

      if (allOk) {
        clipboard.value = { action: null, items: [], nama: null };
        fetchDirectory(currentFolder.value);
        toastSuccess('Berhasil dipaste!');
      } else {
        toastError('Sebagian item gagal diproses');
        fetchDirectory(currentFolder.value);
      }
    } catch (e) {
      console.error('Gagal paste', e);
      toastError('Terjadi kesalahan jaringan saat paste');
    }
    closeContextMenu();
  };

  const handleContextDelete = async () => {
    const { targetType, item } = contextMenu.value;
    const isFolder = targetType === 'folder';
    const confirmed = await showConfirm({
      title: isFolder ? 'Hapus Folder?' : 'Hapus File?',
      message: isFolder
        ? `Folder "${item.nama_folder}" beserta semua isinya akan dihapus permanen.`
        : `File "${item.nama_file}" akan dihapus permanen.`,
      confirmText: '🗑️ Ya, Hapus',
      type: 'danger',
    });
    if (confirmed) {
      try {
        const url = isFolder ? `/api/arsip/folders/${item.id}` : `/api/arsip/files/${item.id}`;
        const res = await fetch(url, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (res.ok) fetchDirectory(currentFolder.value);
      } catch (e) {
        /* ignore */
      }
    }
    closeContextMenu();
  };

  const getFileIcon = (tipe, nama = '') => {
    if (tipe === 'link') return '🔗';
    const nameLower = nama.toLowerCase();

    if (nameLower.endsWith('.zip') || nameLower.endsWith('.rar') || nameLower.endsWith('.7z')) return '📦';
    if (nameLower.endsWith('.pdf') || (tipe && tipe.includes('pdf'))) return '📕';
    if (nameLower.endsWith('.doc') || nameLower.endsWith('.docx') || (tipe && tipe.includes('word')))
      return '📘';
    if (
      nameLower.endsWith('.xls') ||
      nameLower.endsWith('.xlsx') ||
      (tipe && (tipe.includes('excel') || tipe.includes('spreadsheet')))
    )
      return '📗';
    if (
      nameLower.endsWith('.ppt') ||
      nameLower.endsWith('.pptx') ||
      (tipe && tipe.includes('presentation'))
    )
      return '📙';
    if (tipe && tipe.includes('image')) return '🖼️';
    if (tipe && tipe.includes('video')) return '🎬';
    return '📄';
  };

  const handleFileSelect = (e) => {
    selectedUploadFile.value = Array.from(e.target.files);
  };

  const submitUpload = async () => {
    uploadError.value = '';
    isUploading.value = true;

    if (uploadMode.value === 'file') {
      if (!selectedUploadFile.value || selectedUploadFile.value.length === 0) {
        uploadError.value = 'Pilih file terlebih dahulu.';
        isUploading.value = false;
        return;
      }
      for (let f of selectedUploadFile.value) {
        if (f.size > 50 * 1024 * 1024) {
          uploadError.value = 'Ada file yang ukurannya melebihi batas 50 MB.';
          isUploading.value = false;
          return;
        }
      }

      const formData = new FormData();
      formData.append('folder_id', currentFolder.value.id || '');
      if (uploadCustomName.value && selectedUploadFile.value.length === 1) {
        formData.append('custom_name', uploadCustomName.value);
      }

      for (let i = 0; i < selectedUploadFile.value.length; i++) {
        formData.append('files', selectedUploadFile.value[i]);
      }

      try {
        const res = await fetch('/api/arsip/upload/multi', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
          body: formData,
        });
        const data = await res.json();

        if (res.ok) {
          showUploadModal.value = false;
          selectedUploadFile.value = null;
          uploadCustomName.value = '';
          await fetchDirectory(currentFolder.value);
        } else {
          uploadError.value = data.message;
        }
      } catch (e) {
        uploadError.value = 'Terjadi kesalahan saat unggah file.';
      }
    } else {
      if (!uploadCustomName.value || !uploadLinkUrl.value) {
        uploadError.value = 'Keterangan dan URL Tautan wajib diisi.';
        isUploading.value = false;
        return;
      }
      try {
        const res = await fetch('/api/arsip/link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            folder_id: currentFolder.value.id || '',
            nama_file: uploadCustomName.value,
            url_file: uploadLinkUrl.value,
          }),
        });
        const data = await res.json();

        if (res.ok) {
          showUploadModal.value = false;
          uploadCustomName.value = '';
          uploadLinkUrl.value = '';
          await fetchDirectory(currentFolder.value);
        } else {
          uploadError.value = data.message;
        }
      } catch (e) {
        uploadError.value = 'Terjadi kesalahan saat menyimpan tautan.';
      }
    }
    isUploading.value = false;
  };

  const openPreview = (fileObj) => {
    if (fileObj.tipe_file === 'link') {
      window.open(fileObj.url_file, '_blank');
      return;
    }
    if (
      !fileObj.tipe_file.includes('image') &&
      !fileObj.tipe_file.includes('video') &&
      !fileObj.tipe_file.includes('pdf')
    ) {
      downloadOriginal(fileObj);
    } else {
      previewFile.value = fileObj;
      showPreviewModal.value = true;
    }
  };

  const downloadOriginal = async (fileObj) => {
    try {
      const response = await fetch(fileObj.url_file);
      if (!response.ok) throw new Error('Gagal mengunduh file.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileObj.nama_file;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      toastError('Gagal mengunduh file.');
    }
  };

  const downloadAllFilesZip = async () => {
    if (!currentAdminUser || !currentAdminUser.posko_id) {
      toastWarning('Data posko tidak ditemukan.');
      return;
    }

    try {
      const res = await fetch(`/api/arsip/download-posko/${currentAdminUser.posko_id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Gagal mengunduh file.');
      }

      let filename = `Arsip_Posko_${new Date().toISOString().split('T')[0]}.zip`;
      const contentDisposition = res.headers.get('Content-Disposition');
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error(error);
      toastError(error.message || 'Terjadi kesalahan jaringan.');
    }
  };

  const formatExpiredCountdown = (expiredAtStr) => {
    const now = new Date();
    const expiredAt = new Date(expiredAtStr);
    const diffMs = expiredAt - now;
    if (diffMs <= 0) return 'segera dihapus';
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    const diffM = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffH > 0) return `dalam ${diffH}j ${diffM}m`;
    return `dalam ${diffM} menit`;
  };

  const downloadFolderZip = async (folderId, folderName) => {
    try {
      const res = await fetch(`/api/arsip/download-folder/${folderId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Gagal mengunduh.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folderName.replace(/[⚠️\[\]]/g, '').trim()}.zip`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      toastError(error.message || 'Terjadi kesalahan saat mengunduh folder.');
    }
  };

  return {
    selectedItems,
    lastSelectedId,
    viewMode,
    isDragging,
    isCompressing,
    isExtracting,
    showCompressModal,
    compressZipName,
    showExtractModal,
    extractMode,
    targetZipFile,
    extractNewFolderName,
    explorerFolders,
    folderFiles,
    currentFolder,
    folderStack,
    isFetchingFiles,
    explorerPage,
    explorerHasMore,
    isLoadingMore,
    explorerScrollTop,
    virtualFiles,
    spacerTop,
    spacerBottom,
    clipboard,
    showUploadModal,
    uploadError,
    isUploading,
    selectedUploadFile,
    uploadMode,
    uploadCustomName,
    uploadLinkUrl,
    showFolderModal,
    folderModalType,
    folderFormName,
    activeFolderId,
    contextMenu,
    previewFile,
    showPreviewModal,
    explorerSearchQuery,
    isSelected,
    toggleSelection,
    clearSelection,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    deleteSelectedItems,
    compressSelectedFiles,
    submitExtract,
    onAdvancedRightClick,
    onWhitespaceRightClick,
    fetchDirectory,
    init,
    loadMoreFiles,
    goBackToRoot,
    handleExplorerSearch,
    submitFolderForm,
    openCreateFolderModal,
    openRenameFolderModal,
    onFolderRightClick,
    onFileRightClick,
    closeContextMenu,
    handleContextRename,
    handleCutCopy,
    handlePaste,
    handleContextDelete,
    getFileIcon,
    handleFileSelect,
    submitUpload,
    openPreview,
    downloadOriginal,
    downloadAllFilesZip,
    formatExpiredCountdown,
    downloadFolderZip,
  };
}
