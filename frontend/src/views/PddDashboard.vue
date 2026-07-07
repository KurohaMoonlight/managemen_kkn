<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { usePddExplorer } from '../composables/usePddExplorer.js';

const router = useRouter();
const user = ref(null);
const token = ref('');

onMounted(() => {
  const u = localStorage.getItem('user');
  token.value = localStorage.getItem('token') || '';
  if (!u || !token.value) { router.push('/login'); return; }
  user.value = JSON.parse(u);
  if (user.value.jabatan !== 'PDD') { router.push('/mahasiswa'); return; }
  init();
  document.addEventListener('click', closeContextMenu);
  document.addEventListener('keydown', handleKeyboard);
});

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu);
  document.removeEventListener('keydown', handleKeyboard);
});

const {
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
} = usePddExplorer(token);

const fileInputRef = ref(null);

const handleKeyboard = (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); explorerFolders.value.forEach(f => selectedItems.value.add('folder-' + f.id)); folderFiles.value.forEach(f => selectedItems.value.add('file-' + f.id)); }
  if (e.key === 'Delete' && selectedItems.value.size > 0) deleteSelectedItems();
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') { if (contextMenu.value.item) { handleCutCopy('copy'); } }
  if ((e.ctrlKey || e.metaKey) && e.key === 'x') { if (contextMenu.value.item) { handleCutCopy('cut'); } }
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') { handlePaste(); }
};

const onScroll = (e) => {
  explorerScrollTop.value = e.target.scrollTop;
  const el = e.target;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) loadMoreFiles();
};

const triggerFileInput = () => fileInputRef.value?.click();

const isImage = (f) => f.tipe_file && f.tipe_file.includes('image');
const isVideo = (f) => f.tipe_file && f.tipe_file.includes('video');
const isPdf = (f) => f.tipe_file && (f.tipe_file.includes('pdf') || f.nama_file?.endsWith('.pdf'));
const isZip = (f) => f.nama_file && (f.nama_file.endsWith('.zip') || f.nama_file.endsWith('.rar'));

</script>

<template>
  <div class="mhs-wrapper" @click="closeContextMenu" @contextmenu.prevent="onWhitespaceRightClick">
    <!-- NAVBAR (Mirip MahasiswaDashboard) -->
    <header class="mhs-navbar">
      <div class="nav-brand">
        <span class="nav-icon">📸</span>
        <div>
          <div class="nav-title">Dashboard PDD</div>
          <div class="nav-sub">{{ user?.nama_lengkap }}</div>
        </div>
      </div>
      <div class="nav-actions">
        <router-link to="/mahasiswa" class="btn-logout" style="color: var(--color-primary); border-color: var(--color-primary); text-decoration: none;">Ke Dashboard Mahasiswa</router-link>
        <button @click="router.push('/login'); localStorage.clear();" class="btn-logout">Logout</button>
      </div>
    </header>

    <!-- MAIN CONTENT -->
    <main class="mhs-main" style="max-width:1400px; margin:2rem auto; padding:0 2rem; display:block;">
      <!-- FOLDER NOT FOUND -->
      <div v-if="pddNotFound" class="status-card" style="text-align: center; padding: 4rem 2rem;">
        <div style="font-size:4rem;margin-bottom:1rem;">📁</div>
        <h2 style="color: var(--text-main); margin-bottom: 0.5rem;">Folder PDD Belum Ada</h2>
        <p style="color: var(--text-muted);">Minta Admin untuk membuat folder bernama <strong>PDD</strong> di Arsip KKN agar dashboard ini aktif.</p>
      </div>

      <!-- FILE EXPLORER -->
      <div v-else class="status-card" style="overflow: hidden;">
        <!-- TOOLBAR -->
        <div class="pdd-toolbar">
          <!-- Breadcrumb -->
          <div class="pdd-breadcrumb">
            <span
              v-for="(crumb, i) in folderStack" :key="crumb.id"
              class="pdd-crumb"
              :class="{ active: i === folderStack.length - 1 }"
              @click="fetchDirectory(crumb)"
            >
              {{ i === 0 ? '📸 PDD' : crumb.nama_folder }}
              <span v-if="i < folderStack.length - 1" class="pdd-crumb-sep">/</span>
            </span>
          </div>

          <!-- Actions -->
          <div class="pdd-toolbar-actions">
            <div class="pdd-search-box">
              <span>🔍</span>
              <input v-model="explorerSearchQuery" @keyup.enter="handleExplorerSearch" placeholder="Cari file..."/>
              <button @click="handleExplorerSearch" class="btn-scan" style="background: var(--bg-color); color: var(--text-main); border: 1px solid var(--border-color); padding: 0.4rem 0.8rem;">Cari</button>
            </div>
            <button @click="viewMode = viewMode === 'grid' ? 'list' : 'grid'" class="btn-scan" style="background: transparent; color: var(--text-main); border: 1px solid var(--border-color); padding: 0.4rem 0.8rem;" title="Ubah tampilan">
              {{ viewMode === 'grid' ? '☰' : '⊞' }}
            </button>
            <button @click="showUploadModal = true" class="btn-scan" style="background: var(--color-primary); color: white; padding: 0.4rem 1rem;">⬆ Upload</button>
            <button @click="openCreateFolderModal" class="btn-scan" style="background: white; color: var(--text-main); border: 1px solid var(--border-color); padding: 0.4rem 1rem;">📁 Folder Baru</button>
            <button v-if="selectedItems.size > 0" @click="deleteSelectedItems" class="btn-scan" style="background: #fee2e2; color: #ef4444; padding: 0.4rem 1rem;">🗑 Hapus ({{ selectedItems.size }})</button>
            <button v-if="selectedItems.size > 1" @click="showCompressModal = true" class="btn-scan" style="background: white; color: var(--text-main); border: 1px solid var(--border-color); padding: 0.4rem 1rem;">📦 Kompres</button>
            <button v-if="clipboard.items?.length" @click="handlePaste" class="btn-scan" style="background: white; color: var(--text-main); border: 1px solid var(--border-color); padding: 0.4rem 1rem;">📋 Tempel ({{ clipboard.nama }})</button>
          </div>
        </div>

        <!-- DROP ZONE -->
        <div
          class="pdd-drop-zone"
          :class="{ 'pdd-dragging': isDragging }"
          @dragover.prevent="handleDragOver"
          @dragleave="handleDragLeave"
          @drop.prevent="handleDrop"
          @scroll="onScroll"
        >
          <!-- Loading -->
          <div v-if="isFetchingFiles" class="pdd-empty" style="padding: 4rem;">
            <div class="spinner"></div>
            <p>Memuat...</p>
          </div>

          <!-- Empty -->
          <div v-else-if="explorerFolders.length === 0 && folderFiles.length === 0" class="pdd-empty" style="padding: 4rem;">
            <div style="font-size:3rem;margin-bottom:1rem;">📂</div>
            <p>Folder ini kosong. Drag & drop atau klik Upload untuk menambah file.</p>
          </div>

          <!-- Content -->
          <div v-else>
            <!-- GRID VIEW -->
            <div v-if="viewMode === 'grid'" class="pdd-grid">
              <!-- Folders -->
              <div
                v-for="folder in explorerFolders"
                :key="'f-' + folder.id"
                class="explorer-item-box"
                :class="{ 'explorer-item--selected': isSelected('folder', folder.id) }"
                @click.stop="toggleSelection($event, 'folder', folder.id)"
                @dblclick="fetchDirectory(folder)"
                @contextmenu.prevent.stop="onFolderRightClick($event, folder)"
              >
                <div class="pdd-item-icon">📁</div>
                <div class="pdd-item-name">{{ folder.nama_folder }}</div>
                <div class="pdd-item-actions">
                  <button @click.stop="downloadFolderZip(folder.id, folder.nama_folder)" title="Unduh" class="pdd-icon-btn">⬇</button>
                </div>
              </div>

              <!-- Files -->
              <div
                v-for="file in folderFiles"
                :key="'file-' + file.id"
                class="explorer-item-box"
                :class="{ 'explorer-item--selected': isSelected('file', file.id) }"
                @click.stop="toggleSelection($event, 'file', file.id)"
                @dblclick="openPreview(file)"
                @contextmenu.prevent.stop="onFileRightClick($event, file)"
              >
                <!-- Thumbnail for images -->
                <div class="pdd-item-thumb">
                  <img v-if="isImage(file)" :src="file.thumbnail_url || file.url_file" :alt="file.nama_file" loading="lazy" @error="$event.target.src = file.url_file" />
                  <div v-else-if="isVideo(file)" class="pdd-video-thumb">
                    <span class="pdd-play-icon">▶</span>
                  </div>
                  <div v-else class="pdd-file-thumb">
                    <span class="pdd-file-icon">{{ getFileIcon(file.tipe_file, file.nama_file) }}</span>
                  </div>
                </div>
                <div class="pdd-item-name">{{ file.nama_file }}</div>
                <div class="pdd-item-actions">
                  <button @click.stop="openPreview(file)" title="Preview" class="pdd-icon-btn" v-if="isImage(file) || isVideo(file) || isPdf(file)">👁</button>
                  <button @click.stop="downloadOriginal(file)" title="Unduh" class="pdd-icon-btn">⬇</button>
                </div>
              </div>
            </div>

            <!-- LIST VIEW -->
            <table v-else class="pdd-list-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Tipe</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="folder in explorerFolders" :key="'lf-' + folder.id"
                  class="explorer-list-row"
                  :class="{ 'explorer-item--selected': isSelected('folder', folder.id) }"
                  @click.stop="toggleSelection($event, 'folder', folder.id)"
                  @dblclick="fetchDirectory(folder)"
                  @contextmenu.prevent.stop="onFolderRightClick($event, folder)"
                >
                  <td><span style="margin-right:8px;">📁</span>{{ folder.nama_folder }}</td>
                  <td>Folder</td>
                  <td>
                    <button @click.stop="downloadFolderZip(folder.id, folder.nama_folder)" class="btn-scan pdd-btn-sm" style="background: transparent; border: 1px solid var(--border-color);">⬇ Unduh</button>
                  </td>
                </tr>
                <tr
                  v-for="file in folderFiles" :key="'lfile-' + file.id"
                  class="explorer-list-row"
                  :class="{ 'explorer-item--selected': isSelected('file', file.id) }"
                  @click.stop="toggleSelection($event, 'file', file.id)"
                  @dblclick="openPreview(file)"
                  @contextmenu.prevent.stop="onFileRightClick($event, file)"
                >
                  <td><span style="margin-right:8px;">{{ getFileIcon(file.tipe_file, file.nama_file) }}</span>{{ file.nama_file }}</td>
                  <td>{{ file.tipe_file }}</td>
                  <td style="display:flex;gap:4px;">
                    <button v-if="isImage(file) || isVideo(file) || isPdf(file)" @click.stop="openPreview(file)" class="btn-scan pdd-btn-sm" style="background: transparent; border: 1px solid var(--border-color);">👁 Preview</button>
                    <button @click.stop="downloadOriginal(file)" class="btn-scan pdd-btn-sm" style="background: transparent; border: 1px solid var(--border-color);">⬇ Unduh</button>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Load More -->
            <div v-if="explorerHasMore" style="text-align:center;padding:1rem;">
              <button @click="loadMoreFiles" class="btn-scan" style="background: var(--bg-color); color: var(--text-main); border: 1px solid var(--border-color); padding: 0.5rem 1rem;" :disabled="isLoadingMore">
                {{ isLoadingMore ? 'Memuat...' : 'Muat lebih banyak' }}
              </button>
            </div>
          </div>

          <!-- Dragging overlay -->
          <div v-if="isDragging" class="pdd-drag-overlay">
            <div class="pdd-drag-inner">
              <div style="font-size:4rem;">⬆</div>
              <p>Lepaskan untuk upload</p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- ═══ CONTEXT MENU ═══ -->
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      @click.stop
    >
      <div v-if="selectedItems.size > 1" style="padding: 0.4rem 1rem; font-size: 0.78rem; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">
        {{ selectedItems.size }} item dipilih
      </div>
      <template v-if="contextMenu.targetType === 'folder'">
        <div class="ctx-item" @click="fetchDirectory(contextMenu.item); closeContextMenu()"><span>📂</span> Buka</div>
        <div class="ctx-item" @click="downloadFolderZip(contextMenu.item.id, contextMenu.item.nama_folder); closeContextMenu()"><span>⬇️</span> Unduh sebagai ZIP</div>
        <div class="ctx-item" @click="handleCutCopy('cut')"><span>✂️</span> Potong</div>
        <div class="ctx-item" @click="handleCutCopy('copy')"><span>📋</span> Salin</div>
        <div style="border-top: 1px solid #f1f5f9;"></div>
        <div class="ctx-item" @click="handleContextRename"><span>✏️</span> Ganti Nama</div>
        <div class="ctx-item ctx-item--danger" @click="handleContextDelete"><span>🗑️</span> Hapus</div>
      </template>
      <template v-else-if="contextMenu.targetType === 'file'">
        <div v-if="isImage(contextMenu.item) || isVideo(contextMenu.item) || isPdf(contextMenu.item)" class="ctx-item" @click="openPreview(contextMenu.item); closeContextMenu()"><span>👁️</span> Preview</div>
        <div class="ctx-item" @click="downloadOriginal(contextMenu.item); closeContextMenu()"><span>⬇️</span> Unduh</div>
        <div class="ctx-item" @click="handleCutCopy('cut')"><span>✂️</span> Potong</div>
        <div class="ctx-item" @click="handleCutCopy('copy')"><span>📋</span> Salin</div>
        <div v-if="isZip(contextMenu.item)" class="ctx-item" @click="targetZipFile = contextMenu.item; showExtractModal = true; closeContextMenu()"><span>📦</span> Ekstrak</div>
        <div style="border-top: 1px solid #f1f5f9;"></div>
        <div class="ctx-item" @click="handleContextRename"><span>✏️</span> Ganti Nama</div>
        <div class="ctx-item ctx-item--danger" @click="handleContextDelete"><span>🗑️</span> Hapus</div>
      </template>
      <template v-else-if="contextMenu.targetType === 'multi'">
        <div class="ctx-item" @click="handleCutCopy('cut')"><span>✂️</span> Potong ({{ selectedItems.size }})</div>
        <div class="ctx-item" @click="handleCutCopy('copy')"><span>📋</span> Salin ({{ selectedItems.size }})</div>
        <div class="ctx-item" @click="showCompressModal = true; closeContextMenu()"><span>📦</span> Kompres</div>
        <div style="border-top: 1px solid #f1f5f9;"></div>
        <div class="ctx-item ctx-item--danger" @click="deleteSelectedItems(); closeContextMenu()"><span>🗑️</span> Hapus semua</div>
      </template>
      <template v-else-if="contextMenu.targetType === 'whitespace'">
        <div v-if="clipboard.items?.length" class="ctx-item" @click="handlePaste"><span>📋</span> Tempel</div>
        <div class="ctx-item" @click="showUploadModal = true; closeContextMenu()"><span>⬆️</span> Upload File</div>
        <div class="ctx-item" @click="openCreateFolderModal(); closeContextMenu()"><span>📁</span> Folder Baru</div>
        <div class="ctx-item" @click="fetchDirectory(currentFolder); closeContextMenu()"><span>🔄</span> Refresh</div>
      </template>
    </div>

    <!-- ═══ PREVIEW MODAL ═══ -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="previewFile" class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 10000;" @click.self="previewFile = null">
          <div style="position: relative; max-width: 90vw; max-height: 90vh; background: white; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 30px rgba(0,0,0,0.5);">
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); background: #f8fafc;">
              <span style="font-weight: 600; color: var(--text-main); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 70%;">{{ previewFile.nama_file }}</span>
              <div style="display:flex;gap:8px;align-items:center;">
                <button @click="downloadOriginal(previewFile)" class="btn-scan" style="background: var(--color-primary); color: white; padding: 0.4rem 1rem;">⬇ Unduh</button>
                <button @click="previewFile = null" style="background: white; border: 1px solid var(--border-color); border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
              </div>
            </div>
            <div style="flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; padding: 1rem; background: #e2e8f0;">
              <!-- IMAGE -->
              <img v-if="isImage(previewFile)" :src="previewFile.url_file" :alt="previewFile.nama_file" style="max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);" />
              <!-- VIDEO PLAYER -->
              <div v-else-if="isVideo(previewFile)" style="width: 100%; max-width: 800px; display: flex; justify-content: center;">
                <video controls autoplay preload="metadata" :key="previewFile.id" style="width: 100%; max-height: 70vh; border-radius: 8px; background: black;">
                  <source :src="previewFile.url_file" type="video/mp4">
                  <source :src="previewFile.url_file" type="video/webm">
                  Browser kamu tidak mendukung video.
                </video>
              </div>
              <!-- PDF -->
              <iframe v-else-if="isPdf(previewFile)" :src="previewFile.url_file" style="width: 800px; max-width: 100%; height: 70vh; border: none; border-radius: 8px; background: white;"></iframe>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ═══ UPLOAD MODAL ═══ -->
    <Teleport to="body">
      <div v-if="showUploadModal" class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1500;" @click.self="showUploadModal = false">
        <div class="modal-content" style="background: white; padding: 2rem; border-radius: 12px; width: 500px; max-width: 90%;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="margin: 0; color: var(--text-main);">⬆ Upload File</h3>
            <button @click="showUploadModal = false" style="background: transparent; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
          </div>
          
          <div style="display: flex; border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;">
            <button :style="{ padding: '0.5rem 1rem', background: 'transparent', border: 'none', borderBottom: uploadMode === 'file' ? '2px solid var(--color-primary)' : '2px solid transparent', color: uploadMode === 'file' ? 'var(--color-primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }" @click="uploadMode = 'file'">📄 File</button>
            <button :style="{ padding: '0.5rem 1rem', background: 'transparent', border: 'none', borderBottom: uploadMode === 'link' ? '2px solid var(--color-primary)' : '2px solid transparent', color: uploadMode === 'link' ? 'var(--color-primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }" @click="uploadMode = 'link'">🔗 Link</button>
          </div>

          <div v-if="uploadMode === 'file'">
            <div
              @dragover.prevent="isDragging = true"
              @dragleave="isDragging = false"
              @drop.prevent="(e) => { isDragging = false; selectedUploadFile = Array.from(e.dataTransfer.files); }"
              @click="triggerFileInput"
              style="border: 2px dashed var(--border-color); border-radius: 12px; padding: 2.5rem 1rem; text-align: center; cursor: pointer; background: #f8fafc; transition: all 0.2s;"
              :style="isDragging ? { borderColor: 'var(--color-primary)', background: '#eff6ff' } : {}"
            >
              <div style="font-size:2.5rem; color: #94a3b8; margin-bottom: 0.5rem;">☁</div>
              <p style="margin: 0; color: var(--text-main); font-weight: 500;">Klik atau drag file ke sini</p>
              <p style="margin: 0.5rem 0 0; color: var(--text-muted); font-size: 0.85rem;">Multi-file didukung, maks 50MB per file</p>
            </div>
            <input ref="fileInputRef" type="file" multiple style="display:none;" @change="handleFileSelect" />
            <div v-if="selectedUploadFile?.length" style="margin-top:1rem; padding:1rem; background:#f1f5f9; border-radius:8px;">
              <p style="font-size:0.85rem; font-weight:600; margin:0 0 6px; color: var(--text-main);">{{ selectedUploadFile.length }} file dipilih:</p>
              <p v-for="f in selectedUploadFile" :key="f.name" style="font-size:0.8rem; margin:0; color:var(--text-muted);">• {{ f.name }}</p>
            </div>
            <div v-if="selectedUploadFile?.length === 1" style="margin-top:1rem;">
              <label style="font-size:0.85rem; font-weight:600; color: var(--text-main); display: block; margin-bottom: 0.4rem;">Nama kustom (opsional)</label>
              <input v-model="uploadCustomName" placeholder="Biarkan kosong untuk nama asli..." style="width:100%; padding:0.6rem 0.8rem; border:1px solid var(--border-color); border-radius:6px; font-family: inherit;" />
            </div>
          </div>
          <div v-else>
            <div style="margin-bottom: 1rem;">
              <label style="font-size:0.85rem; font-weight:600; color: var(--text-main); display: block; margin-bottom: 0.4rem;">Keterangan Link</label>
              <input v-model="uploadCustomName" placeholder="Nama/keterangan link" style="width:100%; padding:0.6rem 0.8rem; border:1px solid var(--border-color); border-radius:6px; font-family: inherit;" />
            </div>
            <div style="margin-bottom: 1rem;">
              <label style="font-size:0.85rem; font-weight:600; color: var(--text-main); display: block; margin-bottom: 0.4rem;">URL Tautan</label>
              <input v-model="uploadLinkUrl" placeholder="https://..." style="width:100%; padding:0.6rem 0.8rem; border:1px solid var(--border-color); border-radius:6px; font-family: inherit;" />
            </div>
          </div>
          <p v-if="uploadError" style="color:#ef4444; font-size:0.85rem; margin-top:1rem;">{{ uploadError }}</p>
          
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
            <button @click="showUploadModal = false" class="btn-scan" style="background: white; border: 1px solid var(--border-color); color: var(--text-main); padding: 0.5rem 1rem;">Batal</button>
            <button @click="submitUpload" class="btn-scan" style="background: var(--color-primary); color: white; padding: 0.5rem 1.5rem;" :disabled="isUploading">
              {{ isUploading ? 'Mengupload...' : 'Upload' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ═══ FOLDER MODAL ═══ -->
    <Teleport to="body">
      <div v-if="showFolderModal" class="modal-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;" @click.self="showFolderModal = false">
        <div class="modal-content" style="background: white; padding: 2rem; border-radius: 12px; width: 400px; max-width: 90%;">
          <h3 style="margin-top: 0; margin-bottom: 1rem; color: var(--text-main);">{{ folderModalType === 'create' ? '📁 Folder Baru' : '✏ Rename Folder' }}</h3>
          <input type="text" v-model="folderFormName" placeholder="Nama folder..." style="width: 100%; padding: 0.8rem; border-radius: 6px; border: 1px solid var(--border-color); margin-bottom: 1rem;" @keyup.enter="submitFolderForm" autofocus />
          <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
            <button @click="showFolderModal = false" class="btn-scan" style="background: #e2e8f0; color: #475569; padding: 0.5rem 1rem;">Batal</button>
            <button @click="submitFolderForm" class="btn-scan" style="background: var(--color-primary); color: white; padding: 0.5rem 1rem;">Simpan</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ═══ COMPRESS MODAL ═══ -->
    <Teleport to="body">
      <div v-if="showCompressModal" class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1500;" @click.self="showCompressModal = false">
        <div class="modal-content" style="background: white; padding: 2rem; border-radius: 12px; width: 400px; max-width: 90%;">
          <h3 style="margin-top: 0; margin-bottom: 1rem; color: var(--text-main);">📦 Kompres File</h3>
          <label style="font-size:0.85rem; font-weight:600; color: var(--text-main); display: block; margin-bottom: 0.4rem;">Nama file ZIP</label>
          <input v-model="compressZipName" placeholder="nama_arsip" @keyup.enter="compressSelectedFiles" style="width: 100%; padding: 0.8rem; border-radius: 6px; border: 1px solid var(--border-color); margin-bottom: 0.5rem;" />
          <p style="font-size:0.85rem; color: var(--text-muted); margin-bottom: 1.5rem;">{{ selectedItems.size }} file akan dikompres</p>
          <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
            <button @click="showCompressModal = false" class="btn-scan" style="background: #e2e8f0; color: #475569; padding: 0.5rem 1rem;">Batal</button>
            <button @click="compressSelectedFiles" class="btn-scan" style="background: var(--color-primary); color: white; padding: 0.5rem 1rem;" :disabled="isCompressing">
              {{ isCompressing ? 'Mengompres...' : 'Kompres' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ═══ EXTRACT MODAL ═══ -->
    <Teleport to="body">
      <div v-if="showExtractModal" class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1500;" @click.self="showExtractModal = false">
        <div class="modal-content" style="background: white; padding: 2rem; border-radius: 12px; width: 400px; max-width: 90%;">
          <h3 style="margin-top: 0; margin-bottom: 1.5rem; color: var(--text-main);">📂 Ekstrak ZIP</h3>
          <div style="margin-bottom:1rem;">
            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;margin-bottom:0.8rem; color: var(--text-main);">
              <input type="radio" v-model="extractMode" value="same_folder" /> Ekstrak ke folder ini
            </label>
            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer; color: var(--text-main);">
              <input type="radio" v-model="extractMode" value="new_folder" /> Buat folder baru
            </label>
          </div>
          <div v-if="extractMode === 'new_folder'" style="margin-bottom: 1.5rem;">
            <label style="font-size:0.85rem; font-weight:600; color: var(--text-main); display: block; margin-bottom: 0.4rem;">Nama folder baru</label>
            <input v-model="extractNewFolderName" :placeholder="targetZipFile?.nama_file?.replace('.zip','')" style="width: 100%; padding: 0.8rem; border-radius: 6px; border: 1px solid var(--border-color);" />
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
            <button @click="showExtractModal = false" class="btn-scan" style="background: #e2e8f0; color: #475569; padding: 0.5rem 1rem;">Batal</button>
            <button @click="submitExtract" class="btn-scan" style="background: var(--color-primary); color: white; padding: 0.5rem 1rem;" :disabled="isExtracting">
              {{ isExtracting ? 'Mengekstrak...' : 'Ekstrak' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Base Styles copied from MahasiswaDashboard & FileExplorer */
.mhs-wrapper {
  min-height: 100vh;
  background: var(--bg-color);
  font-family: var(--font-sans);
  color: var(--text-main);
  padding-bottom: 3rem;
  overflow-x: hidden;
}

.mhs-navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 3rem;
  background: white;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.nav-icon {
  font-size: 2.2rem;
  background: #f1f5f9;
  padding: 0.5rem;
  border-radius: 12px;
}

.nav-title {
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--text-main);
}

.nav-sub {
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 500;
}

.nav-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.btn-logout {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  padding: 0.6rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.95rem;
}

.btn-logout:hover {
  background: #fef2f2;
  color: #ef4444;
  border-color: #ef4444;
}

.status-card {
  background: white;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  box-sizing: border-box;
}

.btn-scan {
  border: none;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.btn-scan:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.btn-scan:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.spinner {
  width: 36px; height: 36px;
  border: 3px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* EXPLORER SPECIFIC */
.pdd-toolbar {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;
  padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color);
  background: #f8fafc;
}

.pdd-breadcrumb { display: flex; align-items: center; gap: 0.25rem; flex: 1; flex-wrap: wrap; }
.pdd-crumb { font-size: 0.9rem; color: var(--text-muted); cursor: pointer; transition: color 0.15s; padding: 0.2rem 0.4rem; border-radius: 6px; }
.pdd-crumb:hover { color: var(--color-primary); background: #f1f5f9; }
.pdd-crumb.active { color: var(--text-main); font-weight: 600; cursor: default; }
.pdd-crumb-sep { margin: 0 0.25rem; color: #cbd5e1; }

.pdd-toolbar-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }

.pdd-search-box { display: flex; align-items: center; gap: 0.35rem; background: white; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.2rem 0.2rem 0.2rem 0.75rem; }
.pdd-search-box input { background: transparent; border: none; outline: none; color: var(--text-main); font-size: 0.85rem; width: 140px; }
.pdd-search-box input::placeholder { color: var(--text-muted); }

.pdd-drop-zone { min-height: 400px; padding: 1.5rem; position: relative; overflow-y: auto; max-height: 65vh; background: white; }
.pdd-drop-zone.pdd-dragging { background: #eff6ff; border: 2px dashed var(--color-primary); }

.pdd-empty { text-align: center; color: var(--text-muted); }

.pdd-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }

.explorer-item-box {
  background: #f8fafc; border: 1.5px solid transparent; border-radius: 12px;
  cursor: pointer; transition: all 0.18s; display: flex; flex-direction: column; align-items: center;
  padding: 0.75rem 0.5rem 0.5rem; gap: 0.4rem; position: relative; overflow: hidden; user-select: none;
}
.explorer-item-box:hover { background: #f1f5f9; border-color: #cbd5e1; transform: translateY(-2px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
.explorer-item--selected {
  background: #dbeafe !important;
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 1px #3b82f6 !important;
}

.pdd-item-icon { font-size: 2.8rem; }
.pdd-item-thumb { width: 100%; aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: #f1f5f9; display: flex; align-items: center; justify-content: center; }
.pdd-item-thumb img { width: 100%; height: 100%; object-fit: cover; }
.pdd-video-thumb { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #e2e8f0; }
.pdd-play-icon { font-size: 2rem; color: #64748b; }
.pdd-file-thumb { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.pdd-file-icon { font-size: 2.5rem; }

.pdd-item-name { font-size: 0.78rem; color: var(--text-main); font-weight: 500; text-align: center; word-break: break-word; line-height: 1.3; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }

.pdd-item-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s; }
.explorer-item-box:hover .pdd-item-actions, .explorer-item--selected .pdd-item-actions { opacity: 1; }
.pdd-icon-btn { background: white; border: 1px solid var(--border-color); border-radius: 6px; padding: 0.2rem 0.4rem; cursor: pointer; color: var(--text-main); font-size: 0.85rem; transition: background 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.pdd-icon-btn:hover { background: #f1f5f9; }

/* LIST VIEW */
.pdd-list-table { width: 100%; border-collapse: collapse; }
.pdd-list-table th { padding: 0.75rem 1rem; color: var(--text-muted); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border-color); text-align: left; }
.explorer-list-row { border-bottom: 1px solid var(--border-color); transition: background 0.15s; cursor: pointer; }
.explorer-list-row td { padding: 0.7rem 1rem; font-size: 0.87rem; color: var(--text-main); font-weight: 500; }
.explorer-list-row:hover { background: #f8fafc; }

.pdd-btn-sm { padding: 0.3rem 0.65rem; font-size: 0.78rem; }

/* CONTEXT MENU */
.context-menu {
  position: fixed; background: white; border: 1px solid var(--border-color);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08);
  border-radius: 8px; z-index: 2000; min-width: 180px; padding: 0.35rem 0;
  animation: fadeIn 0.1s ease;
}
.ctx-item {
  padding: 0.5rem 1rem; cursor: pointer; display: flex; align-items: center; gap: 0.6rem;
  color: var(--text-main); font-size: 0.88rem; transition: background 0.1s;
}
.ctx-item:hover { background: #f1f5f9; }
.ctx-item--danger { color: #ef4444; }
.ctx-item--danger:hover { background: #fef2f2; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.pdd-drag-overlay { position: absolute; inset: 0; background: rgba(239, 246, 255, 0.8); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 50; border: 2px dashed var(--color-primary); border-radius: 8px; }
.pdd-drag-inner { text-align: center; color: var(--color-primary); }
.pdd-drag-inner p { margin-top: 0.5rem; font-weight: 600; font-size: 1.1rem; }

/* Scrollbar */
.pdd-drop-zone::-webkit-scrollbar { width: 6px; }
.pdd-drop-zone::-webkit-scrollbar-track { background: transparent; }
.pdd-drop-zone::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

@media (max-width: 768px) {
  .mhs-navbar { flex-direction: column; padding: 1rem; align-items: flex-start; gap: 1rem; }
  .mhs-main { padding: 0 1rem; margin: 1rem auto; }
  .pdd-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
  .pdd-toolbar { flex-direction: column; align-items: flex-start; }
  .pdd-toolbar-actions { width: 100%; overflow-x: auto; padding-bottom: 0.25rem; }
}
</style>
