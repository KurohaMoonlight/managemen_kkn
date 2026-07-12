import { ref, computed } from 'vue';
import { useToast } from '../useNotification.js';
import { useBaseExplorer } from '../useBaseExplorer.js';
import { getFileIcon, downloadBlob } from '../../utils/fileHelpers.js';

export function useSuperAdminExplorer(token) {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  // ─── Gunakan base composable (virtual scroll, selection, context menu, preview) ──
  const base = useBaseExplorer();

  const {
    explorerScrollTop, folderFiles, virtualFiles, spacerTop, spacerBottom,
    selectedItems, isSelected, clearSelection,
    contextMenu, closeContextMenu,
    previewFile, showPreviewModal,
  } = base;

  // ─── View State ───────────────────────────────────────────────────────────
  const explorerView = ref('cluster'); // 'cluster' | 'explorer'
  const activePosko = ref(null);

  // ─── Cluster State ────────────────────────────────────────────────────────
  const poskoList = ref([]);
  const poskoLoading = ref(false);
  const poskoSearchQuery = ref('');

  const filteredPoskoList = computed(() => {
    if (!poskoSearchQuery.value) return poskoList.value;
    const q = poskoSearchQuery.value.toLowerCase();
    return poskoList.value.filter(p => p.nama_posko.toLowerCase().includes(q));
  });

  // ─── Explorer State ───────────────────────────────────────────────────────
  const explorerFolders = ref([]);
  const currentFolder = ref({ id: null, nama_folder: 'Beranda' });
  const folderStack = ref([]);
  const isFetchingFiles = ref(false);
  const explorerPage = ref(1);
  const explorerHasMore = ref(false);
  const isLoadingMore = ref(false);
  const viewMode = ref('grid');
  const explorerSearchQuery = ref('');

  // ─── Cluster: Fetch All Posko ─────────────────────────────────────────────
  const fetchPoskoList = async () => {
    poskoLoading.value = true;
    try {
      const res = await fetch('/api/superadmin/posko', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) poskoList.value = await res.json();
    } catch (e) {
      toastError('Gagal memuat daftar posko.');
    } finally {
      poskoLoading.value = false;
    }
  };

  // ─── Enter Explorer for a Posko ───────────────────────────────────────────
  const enterPosko = async (posko) => {
    activePosko.value = posko;
    explorerView.value = 'explorer';
    explorerSearchQuery.value = '';
    folderStack.value = [{ id: null, nama_folder: 'Beranda' }];
    await fetchDirectory({ id: null, nama_folder: 'Beranda' });
  };

  const backToCluster = () => {
    explorerView.value = 'cluster';
    activePosko.value = null;
    explorerFolders.value = [];
    folderFiles.value = [];
    folderStack.value = [];
    explorerScrollTop.value = 0;
    clearSelection();
  };

  // ─── Explorer: Fetch Directory ────────────────────────────────────────────
  const fetchDirectory = async (folderObj) => {
    currentFolder.value = folderObj;
    isFetchingFiles.value = true;
    explorerPage.value = 1;
    explorerHasMore.value = false;
    explorerScrollTop.value = 0;

    const stackIndex = folderStack.value.findIndex(f => f.id === folderObj.id);
    if (stackIndex > -1) {
      folderStack.value = folderStack.value.slice(0, stackIndex + 1);
    } else {
      folderStack.value.push(folderObj);
    }

    const poskoParam = `posko_id=${activePosko.value.id}`;
    const parentParam = folderObj.id ? `&parentId=${folderObj.id}` : '';
    const searchParam = explorerSearchQuery.value
      ? `&search=${encodeURIComponent(explorerSearchQuery.value)}`
      : '';

    try {
      const res = await fetch(
        `/api/arsip/directory?${poskoParam}${parentParam}&page=1&limit=50${searchParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        explorerFolders.value = data.folders;
        folderFiles.value = data.files;
        explorerHasMore.value = data.hasMore;
      } else {
        toastError('Gagal memuat direktori.');
      }
    } catch (e) {
      toastError('Kesalahan jaringan saat memuat direktori.');
    } finally {
      isFetchingFiles.value = false;
    }
  };

  // ─── Lazy Load More Files ─────────────────────────────────────────────────
  const loadMoreFiles = async () => {
    if (!explorerHasMore.value || isLoadingMore.value) return;
    isLoadingMore.value = true;
    const nextPage = explorerPage.value + 1;
    const poskoParam = `posko_id=${activePosko.value.id}`;
    const parentParam = currentFolder.value.id ? `&parentId=${currentFolder.value.id}` : '';
    const searchParam = explorerSearchQuery.value
      ? `&search=${encodeURIComponent(explorerSearchQuery.value)}`
      : '';

    try {
      const res = await fetch(
        `/api/arsip/directory?${poskoParam}${parentParam}&page=${nextPage}&limit=50${searchParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        folderFiles.value = [...folderFiles.value, ...data.files];
        explorerPage.value = nextPage;
        explorerHasMore.value = data.hasMore;
      }
    } catch (e) {
      toastError('Gagal memuat lebih banyak file.');
    } finally {
      isLoadingMore.value = false;
    }
  };

  const handleExplorerSearch = () => fetchDirectory(currentFolder.value);

  // ─── Preview & Download ───────────────────────────────────────────────────
  const openPreview = (fileObj) => {
    if (fileObj.tipe_file === 'link') { window.open(fileObj.url_file, '_blank'); return; }
    if (!fileObj.tipe_file.includes('image') && !fileObj.tipe_file.includes('video') && !fileObj.tipe_file.includes('pdf')) {
      downloadFile(fileObj);
    } else {
      previewFile.value = fileObj;
      showPreviewModal.value = true;
    }
  };

  const downloadFile = async (fileObj) => {
    try {
      await downloadBlob(fileObj.url_file, fileObj.nama_file);
    } catch (error) {
      toastError('Gagal mengunduh file.');
    }
  };

  const downloadFolderZip = async (folderId, folderName) => {
    toastInfo(`Mempersiapkan ZIP untuk folder "${folderName}"...`);
    try {
      const res = await fetch(`/api/arsip/download-folder/${folderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Gagal mengunduh folder.'); }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `${folderName.trim()}.zip`;
      document.body.appendChild(link); link.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(link);
      toastSuccess(`Folder "${folderName}" berhasil diunduh!`);
    } catch (error) {
      toastError(error.message || 'Terjadi kesalahan saat mengunduh folder.');
    }
  };

  const downloadPoskoZip = async (posko) => {
    const target = posko || activePosko.value;
    if (!target) return;
    toastInfo(`Mempersiapkan ZIP semua arsip posko "${target.nama_posko}"...`);
    try {
      const res = await fetch(`/api/arsip/download-posko/${target.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Gagal mengunduh arsip posko.'); }
      let filename = `Arsip_${target.nama_posko}_${new Date().toISOString().split('T')[0]}.zip`;
      const cd = res.headers.get('Content-Disposition');
      if (cd) { const m = cd.match(/filename="(.+)"/); if (m && m[1]) filename = m[1]; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(link);
      toastSuccess(`Arsip posko "${target.nama_posko}" berhasil diunduh!`);
    } catch (error) {
      toastError(error.message || 'Terjadi kesalahan jaringan.');
    }
  };

  // ─── Context Menu (Read-Only: Preview & Download) ─────────────────────────
  const onFileRightClick = (event, file) => {
    clearSelection();
    selectedItems.value.add('file-' + file.id);
    contextMenu.value = { visible: true, x: event.clientX, y: event.clientY, targetType: 'file', item: file };
  };

  const onFolderRightClick = (event, folder) => {
    clearSelection();
    selectedItems.value.add('folder-' + folder.id);
    contextMenu.value = { visible: true, x: event.clientX, y: event.clientY, targetType: 'folder', item: folder };
  };

  const init = () => fetchPoskoList();

  return {
    // ─── Dari base ───────────────────────────────────────────
    explorerScrollTop, virtualFiles, spacerTop, spacerBottom,
    selectedItems, isSelected, clearSelection,
    contextMenu, closeContextMenu,
    previewFile, showPreviewModal,
    // ─── Local state ─────────────────────────────────────────
    explorerView, activePosko,
    poskoList, poskoLoading, poskoSearchQuery, filteredPoskoList,
    explorerFolders, folderFiles, currentFolder, folderStack,
    isFetchingFiles, explorerPage, explorerHasMore, isLoadingMore,
    viewMode, explorerSearchQuery,
    // ─── Methods ─────────────────────────────────────────────
    init, fetchPoskoList, enterPosko, backToCluster,
    fetchDirectory, loadMoreFiles, handleExplorerSearch,
    getFileIcon, openPreview, downloadFile, downloadFolderZip, downloadPoskoZip,
    closeContextMenu, onFileRightClick, onFolderRightClick,
  };
}
