<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useToast } from '../../composables/useNotification.js';

const { success: toastSuccess, error: toastError } = useToast();

const props = defineProps({
  token: { type: String, required: true },
  prokerData: { type: Object, required: true }
});

const previewImageUrl = ref(null);
const explorerCurrentFolderId = ref(null);
const explorerFolders = ref([]);
const explorerFiles = ref([]);
const explorerPathHistory = ref([]);
const explorerSearchQuery = ref('');
const clipboard = ref({ action: null, items: [] });
const showCreateFolderModal = ref(false);
const folderFormName = ref('');

const selectedKeys = ref(new Set());
const lastSelectedKey = ref(null);

const getKey = (type, id) => `${type}-${id}`;

const isSelected = (type, id) => selectedKeys.value.has(getKey(type, id));

const clearSelection = () => {
  selectedKeys.value = new Set();
  lastSelectedKey.value = null;
};

const allExplorerItems = () => [
  ...explorerFolders.value.map(f => ({ type: 'folder', id: f.id, nama: f.nama_folder, _raw: f })),
  ...explorerFiles.value.map(f => ({ type: 'file', id: f.id, nama: f.nama_file, _raw: f }))
];

const handleItemClick = (e, type, id) => {
  const key = getKey(type, id);
  const items = allExplorerItems();
  const idx = items.findIndex(i => getKey(i.type, i.id) === key);

  if (e.ctrlKey || e.metaKey) {
    const next = new Set(selectedKeys.value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selectedKeys.value = next;
    lastSelectedKey.value = key;
  } else if (e.shiftKey && lastSelectedKey.value) {
    const lastIdx = items.findIndex(i => getKey(i.type, i.id) === lastSelectedKey.value);
    const [from, to] = [Math.min(idx, lastIdx), Math.max(idx, lastIdx)];
    const next = new Set(selectedKeys.value);
    for (let i = from; i <= to; i++) next.add(getKey(items[i].type, items[i].id));
    selectedKeys.value = next;
  } else {
    selectedKeys.value = new Set([key]);
    lastSelectedKey.value = key;
  }
};

const selectAll = () => {
  const next = new Set();
  allExplorerItems().forEach(i => next.add(getKey(i.type, i.id)));
  selectedKeys.value = next;
};

const getSelectedItems = () => {
  const items = allExplorerItems();
  return items.filter(i => selectedKeys.value.has(getKey(i.type, i.id)));
};

const contextMenu = ref({ show: false, x: 0, y: 0, type: '', item: null });

const onRightClick = (e, item, type) => {
  e.preventDefault();
  e.stopPropagation();
  const key = getKey(type, item.id);
  if (!selectedKeys.value.has(key)) {
    selectedKeys.value = new Set([key]);
    lastSelectedKey.value = key;
  }
  const menuWidth = 200;
  const menuHeight = 220;
  const x = (e.clientX + menuWidth > window.innerWidth) ? e.clientX - menuWidth : e.clientX;
  const y = (e.clientY + menuHeight > window.innerHeight) ? e.clientY - menuHeight : e.clientY;
  contextMenu.value = { show: true, x, y, item, type };
};

const closeContextMenu = () => {
  contextMenu.value.show = false;
};

onMounted(() => {
  document.addEventListener('click', closeContextMenu);
  if (props.prokerData?.folder_id) {
    fetchExplorerDirectory(props.prokerData.folder_id);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenu);
});

watch(() => props.prokerData, (newVal) => {
  if (newVal?.folder_id) {
    fetchExplorerDirectory(newVal.folder_id);
  }
});

const fetchExplorerDirectory = async (folderId, search = '') => {
  clearSelection();
  try {
    let url = `/api/arsip/directory?limit=100`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    } else if (folderId) {
      url += `&parentId=${folderId}`;
    }
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${props.token}` }
    });
    if (res.ok) {
      const data = await res.json();
      explorerFolders.value = data.folders;
      explorerFiles.value = data.files;
      if (!search) explorerCurrentFolderId.value = folderId;
    }
  } catch (err) {
    console.error('Failed to fetch explorer directory', err);
  }
};

const handleExplorerSearch = () => {
  if (props.prokerData && props.prokerData.folder_id) {
    if (explorerSearchQuery.value) {
      fetchExplorerDirectory(null, explorerSearchQuery.value);
    } else {
      const parentId = explorerPathHistory.value.length > 0 
        ? explorerPathHistory.value[explorerPathHistory.value.length - 1]
        : props.prokerData.folder_id;
      fetchExplorerDirectory(parentId);
    }
  }
};

const openExplorerFolder = (folder) => {
  explorerSearchQuery.value = '';
  explorerPathHistory.value.push(explorerCurrentFolderId.value);
  fetchExplorerDirectory(folder.id);
};

const goBackExplorer = () => {
  explorerSearchQuery.value = '';
  if (explorerPathHistory.value.length > 0) {
    const prevFolder = explorerPathHistory.value.pop();
    fetchExplorerDirectory(prevFolder);
  }
};

const submitFolderForm = async () => {
  if (!folderFormName.value) return;
  try {
    const res = await fetch('/api/arsip/folders', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${props.token}`
      },
      body: JSON.stringify({ nama_folder: folderFormName.value, parent_id: explorerCurrentFolderId.value })
    });
    if (res.ok) {
      showCreateFolderModal.value = false;
      folderFormName.value = '';
      fetchExplorerDirectory(explorerCurrentFolderId.value);
    } else {
      const d = await res.json();
      toastError(d.message || 'Gagal membuat folder');
    }
  } catch(e) {
    toastError('Terjadi kesalahan jaringan.');
  }
};

const copySelected = () => {
  const sel = getSelectedItems();
  if (!sel.length) return;
  clipboard.value = {
    action: 'copy',
    items: sel.map(i => ({ type: i.type, id: i.id, nama: i.nama }))
  };
  closeContextMenu();
};

const cutSelected = () => {
  const sel = getSelectedItems();
  if (!sel.length) return;
  clipboard.value = {
    action: 'cut',
    items: sel.map(i => ({ type: i.type, id: i.id, nama: i.nama }))
  };
  closeContextMenu();
};

const copyItem = (item, type) => {
  clipboard.value = { action: 'copy', items: [{ type, id: item.id, nama: type === 'folder' ? item.nama_folder : item.nama_file }] };
};

const cutItem = (item, type) => {
  clipboard.value = { action: 'cut', items: [{ type, id: item.id, nama: type === 'folder' ? item.nama_folder : item.nama_file }] };
};

const pasteItem = async () => {
  if (!clipboard.value.items.length || !explorerCurrentFolderId.value) return;
  const action = clipboard.value.action;
  try {
    for (const itm of clipboard.value.items) {
      await fetch('/api/arsip/paste', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${props.token}`
        },
        body: JSON.stringify({
          type: itm.type,
          action,
          id: itm.id,
          target_folder_id: explorerCurrentFolderId.value
        })
      });
    }
    if (action === 'cut') {
      clipboard.value = { action: null, items: [] };
    }
    fetchExplorerDirectory(explorerCurrentFolderId.value);
  } catch (e) {
    toastError('Terjadi kesalahan jaringan.');
  }
};

const downloadFile = async (fileObj) => {
  try {
    const response = await fetch(fileObj.url_file);
    if (!response.ok) throw new Error("Network response was not ok");
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
    console.error("Download failed:", error);
    toastError('Gagal mengunduh file.');
  }
};

const renameItem = async (item, type) => {
  const currentName = type === 'folder' ? item.nama_folder : item.nama_file;
  const newName = prompt(`Ganti nama ${type === 'folder' ? 'folder' : 'file'}:`, currentName);
  if (!newName || newName.trim() === '' || newName === currentName) return;
  
  try {
    const res = await fetch('/api/arsip/rename', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${props.token}`
      },
      body: JSON.stringify({
        id: item.id,
        type: type,
        newName: newName.trim()
      })
    });
    if (res.ok) {
      fetchExplorerDirectory(explorerCurrentFolderId.value);
    } else {
      const d = await res.json();
      toastError(d.message || 'Gagal mengganti nama.');
    }
  } catch (e) {
    toastError('Terjadi kesalahan jaringan.');
  }
};

const deleteItem = async (item, type) => {
  if (!confirm(`Yakin hapus ${type === 'folder' ? 'folder' : 'file'} "${type === 'folder' ? item.nama_folder : item.nama_file}"?`)) return;
  try {
    const url = type === 'folder' ? `/api/arsip/folders/${item.id}` : `/api/arsip/files/${item.id}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${props.token}` }
    });
    if (res.ok) {
      clearSelection();
      fetchExplorerDirectory(explorerCurrentFolderId.value);
    } else {
      const d = await res.json();
      toastError(d.message || 'Gagal menghapus.');
    }
  } catch(e) {
    toastError('Terjadi kesalahan jaringan.');
  }
};

const deleteSelected = async () => {
  const sel = getSelectedItems();
  if (!sel.length) return;
  const names = sel.map(i => i.nama).join(', ');
  if (!confirm(`Yakin hapus ${sel.length} item?\n${names}`)) return;
  closeContextMenu();
  for (const itm of sel) {
    const url = itm.type === 'folder' ? `/api/arsip/folders/${itm.id}` : `/api/arsip/files/${itm.id}`;
    await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${props.token}` }
    }).catch(() => {});
  }
  clearSelection();
  fetchExplorerDirectory(explorerCurrentFolderId.value);
};

// Expose refresh function to parent
defineExpose({ refresh: () => {
  if (explorerCurrentFolderId.value === props.prokerData?.folder_id) {
    fetchExplorerDirectory(props.prokerData.folder_id);
  }
}});
</script>

<template>
  <div class="status-card" style="width: 100%; max-width: 100%; padding: 2rem; display: flex; flex-direction: column; text-align: left;">
    <h2 style="border-bottom: 2px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1rem; color: var(--text-main);">
      📂 Arsip Proker: {{ prokerData?.proker }}
    </h2>
    <div class="explorer-actions" style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem; background: #f8fafc; padding: 1rem; border-radius: 12px; border: 1px solid var(--border-color); flex-wrap: wrap;">
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button v-if="explorerPathHistory.length > 0" @click="goBackExplorer" class="btn-scan" style="margin: 0; padding: 0.4rem 1rem; font-size: 0.85rem; background: white; color: var(--text-main); border: 1px solid var(--border-color);">&larr; Kembali</button>
        <button @click="showCreateFolderModal = true" class="btn-scan" style="margin: 0; padding: 0.4rem 1rem; font-size: 0.85rem; background: var(--color-primary); color: white;">+ Buat Folder</button>
        <button v-if="clipboard.items.length" @click="pasteItem" class="btn-scan" style="margin: 0; padding: 0.4rem 1rem; font-size: 0.85rem; background: #f59e0b; color: white;">📋 Paste ({{ clipboard.items.length }})</button>
        
        <template v-if="selectedKeys.size > 0">
          <button @click="copySelected" class="btn-scan" style="margin: 0; padding: 0.4rem 1rem; font-size: 0.85rem; background: #3b82f6; color: white;">📋 Salin ({{ selectedKeys.size }})</button>
          <button @click="cutSelected" class="btn-scan" style="margin: 0; padding: 0.4rem 1rem; font-size: 0.85rem; background: #8b5cf6; color: white;">✂️ Potong ({{ selectedKeys.size }})</button>
          <button @click="deleteSelected" class="btn-scan" style="margin: 0; padding: 0.4rem 1rem; font-size: 0.85rem; background: #ef4444; color: white;">🗑️ Hapus ({{ selectedKeys.size }})</button>
          <button @click="clearSelection" class="btn-scan" style="margin: 0; padding: 0.4rem 1rem; font-size: 0.85rem; background: #94a3b8; color: white;">✕ Batalkan Pilihan</button>
        </template>
        <button @click="selectAll" class="btn-scan" style="margin: 0; padding: 0.4rem 1rem; font-size: 0.85rem; background: #64748b; color: white;">☑ Pilih Semua</button>
      </div>
      <div class="search-box" style="position: relative; flex: 1; max-width: 250px;">
        <input type="text" v-model="explorerSearchQuery" @keyup.enter="handleExplorerSearch" placeholder="Cari file atau folder..." style="width: 100%; padding: 0.4rem 0.8rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.85rem;" />
        <button @click="handleExplorerSearch" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-muted);">🔍</button>
      </div>
    </div>

    <!-- Clipboard indicator -->
    <div v-if="clipboard.items.length" style="font-size: 0.8rem; color: var(--color-primary); margin-bottom: 1rem; padding: 0.4rem 0.8rem; background: #f1f5f9; border-radius: 4px; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
      <span>{{ clipboard.action === 'cut' ? '✂️ Potong' : '📋 Salin' }}: </span>
      <b>{{ clipboard.items.map(i => i.nama).join(', ') }}</b>
      <button @click="clipboard = {action:null, items:[]}" style="background: none; border: none; color: red; cursor: pointer; margin-left: auto;">✕ Batal</button>
    </div>

    <!-- Selection hint -->
    <div v-if="selectedKeys.size === 0 && (explorerFolders.length > 0 || explorerFiles.length > 0)" style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem;">
      💡 Klik untuk pilih · Ctrl+Klik multi pilih · Shift+Klik range · 2x Klik untuk buka folder
    </div>
    <div v-else-if="selectedKeys.size > 0" style="font-size: 0.75rem; color: #3b82f6; margin-bottom: 0.5rem; font-weight: 600;">
      ✓ {{ selectedKeys.size }} item dipilih
    </div>

    <div class="explorer-list" style="display: flex; flex-direction: column; gap: 0.5rem; padding-right: 0.5rem;" @click.self="clearSelection">
      <div v-if="explorerFolders.length === 0 && explorerFiles.length === 0" class="text-muted text-center" style="padding: 2rem; background: #f8fafc; border-radius: 8px; border: 1px dashed var(--border-color);">Folder ini kosong.</div>
      
      <!-- Folders -->
      <div
        v-for="folder in explorerFolders"
        :key="folder.id"
        @click.stop="handleItemClick($event, 'folder', folder.id)"
        @dblclick.stop="openExplorerFolder(folder)"
        @contextmenu.stop="onRightClick($event, folder, 'folder')"
        class="explorer-item"
        :class="{ 'explorer-item--selected': isSelected('folder', folder.id) }"
        style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border: 1px solid #e2e8f0; border-radius: 8px; transition: all 0.15s; cursor: pointer; user-select: none;"
      >
        <div style="display: flex; align-items: center; flex: 1;">
          <span style="font-size: 1.25rem; margin-right: 0.75rem;">📁</span>
          <span style="font-weight: 500; color: var(--text-main);">{{ folder.nama_folder }}</span>
        </div>
        <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 0.5rem;">2x klik buka</span>
      </div>

      <!-- Files -->
      <div
        v-for="file in explorerFiles"
        :key="file.id"
        @click.stop="handleItemClick($event, 'file', file.id)"
        @dblclick.stop="file.tipe_file.includes('image') ? previewImageUrl = 'http://localhost:5000' + file.url_file : window.open('http://localhost:5000' + file.url_file, '_blank')"
        @contextmenu.stop="onRightClick($event, file, 'file')"
        class="explorer-item"
        :class="{ 'explorer-item--selected': isSelected('file', file.id) }"
        style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border: 1px solid var(--border-color); border-radius: 8px; transition: all 0.15s; cursor: pointer; user-select: none;"
      >
        <div style="display: flex; align-items: center; flex: 1; overflow: hidden;">
          <span style="font-size: 1.25rem; margin-right: 0.75rem;">{{ file.tipe_file.includes('image') ? '🖼️' : '📄' }}</span>
          <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <a href="#" @click.prevent.stop="file.tipe_file.includes('image') ? previewImageUrl = file.url_file : window.open(file.url_file, '_blank')" style="color: var(--color-primary); text-decoration: none; font-weight: 500; cursor: pointer;">{{ file.nama_file }}</a>
            <div style="font-size: 0.75rem; color: var(--text-muted);">{{ new Date(file.uploaded_at).toLocaleDateString('id-ID') }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL BUAT FOLDER -->
  <div v-if="showCreateFolderModal" class="modal-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;" @click.self="showCreateFolderModal = false">
    <div class="modal-content" style="background: white; padding: 2rem; border-radius: 12px; width: 400px; max-width: 90%;">
      <h3 style="margin-top: 0; margin-bottom: 1rem; color: var(--text-main);">Buat Folder Baru</h3>
      <input type="text" v-model="folderFormName" placeholder="Nama folder..." class="form-input" style="width: 100%; padding: 0.8rem; border-radius: 6px; border: 1px solid var(--border-color); margin-bottom: 1rem;" @keyup.enter="submitFolderForm" />
      <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
        <button @click="showCreateFolderModal = false" class="btn-scan" style="background: #e2e8f0; color: #475569; margin:0; padding: 0.5rem 1rem;">Batal</button>
        <button @click="submitFolderForm" class="btn-scan" style="background: var(--color-primary); color: white; margin:0; padding: 0.5rem 1rem;">Simpan</button>
      </div>
    </div>
  </div>

  <!-- CONTEXT MENU -->
  <div
    v-if="contextMenu.show"
    class="context-menu"
    :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    @click.stop
  >
    <div v-if="selectedKeys.size > 1" style="padding: 0.4rem 1rem; font-size: 0.78rem; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">
      {{ selectedKeys.size }} item dipilih
    </div>
    <div v-if="contextMenu.type === 'file' && selectedKeys.size <= 1" @click="downloadFile(contextMenu.item); closeContextMenu()" class="ctx-item">
      <span>⬇️</span> Unduh (Download)
    </div>
    <div @click="selectedKeys.size > 1 ? copySelected() : (copyItem(contextMenu.item, contextMenu.type), closeContextMenu())" class="ctx-item">
      <span>📋</span> Salin{{ selectedKeys.size > 1 ? ` (${selectedKeys.size})` : '' }}
    </div>
    <div @click="selectedKeys.size > 1 ? cutSelected() : (cutItem(contextMenu.item, contextMenu.type), closeContextMenu())" class="ctx-item">
      <span>✂️</span> Potong{{ selectedKeys.size > 1 ? ` (${selectedKeys.size})` : '' }}
    </div>
    <div v-if="selectedKeys.size <= 1" @click="renameItem(contextMenu.item, contextMenu.type); closeContextMenu()" class="ctx-item">
      <span>✏️</span> Ganti Nama
    </div>
    <div style="border-top: 1px solid #f1f5f9;"></div>
    <div @click="selectedKeys.size > 1 ? deleteSelected() : (deleteItem(contextMenu.item, contextMenu.type), closeContextMenu())" class="ctx-item ctx-item--danger">
      <span>🗑️</span> Hapus{{ selectedKeys.size > 1 ? ` (${selectedKeys.size})` : '' }}
    </div>
  </div>

  <!-- IMAGE PREVIEW MODAL -->
  <div v-if="previewImageUrl" class="modal-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 10000;" @click.self="previewImageUrl = null">
    <div style="position: relative; max-width: 90vw; max-height: 90vh;">
      <button @click="previewImageUrl = null" style="position: absolute; top: -15px; right: -15px; background: white; color: black; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-weight: bold; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">✕</button>
      <img :src="previewImageUrl" style="max-width: 100%; max-height: 90vh; border-radius: 8px; box-shadow: 0 4px 30px rgba(0,0,0,0.5); object-fit: contain;" @click.stop />
    </div>
  </div>

</template>

<style scoped>
.status-card {
  background: white;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  box-sizing: border-box;
}
@media (max-width: 768px) {
  .status-card {
    padding: 1rem !important;
  }
}
.btn-scan {
  border: none;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-scan:hover { transform: translateY(-1px); box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
.explorer-item {
  background: #f8fafc;
}
.explorer-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  background: #f1f5f9;
}
.explorer-item--selected {
  background: #dbeafe !important;
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 2px rgba(59,130,246,0.25) !important;
}
.explorer-item--selected:hover {
  background: #bfdbfe !important;
}
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #e2e8f0;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08);
  border-radius: 8px;
  z-index: 2000;
  min-width: 180px;
  padding: 0.35rem 0;
  animation: fadeIn 0.1s ease;
}
.ctx-item {
  padding: 0.5rem 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: #334155;
  font-size: 0.88rem;
  transition: background 0.1s;
}
.ctx-item:hover {
  background: #f1f5f9;
}
.ctx-item--danger {
  color: #ef4444;
}
.ctx-item--danger:hover {
  background: #fef2f2;
}
.text-muted { color: var(--text-muted); }
.text-center { text-align: center; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
