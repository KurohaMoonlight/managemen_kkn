<script setup>
import { onMounted } from 'vue';
import { useAdminExplorer } from '../../composables/admin/useAdminExplorer.js';

const {
  selectedItems,
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
  uploadMode,
  uploadCustomName,
  uploadLinkUrl,
  showFolderModal,
  folderModalType,
  folderFormName,
  contextMenu,
  previewFile,
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
  fetchDirectory,
  init,
  loadMoreFiles,
  handleExplorerSearch,
  submitFolderForm,
  openCreateFolderModal,
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
} = useAdminExplorer();

onMounted(() => {
  init();
});

defineExpose({ fetchDirectory, init });
</script>

<template>
  <!-- NEW SECTION: FILE EXPLORER -->
  <div class="card" style="margin-top: 2rem;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h2 style="margin:0;">Arsip KKN (File Explorer)</h2>
      <button class="btn btn-primary" @click="downloadAllFilesZip" style="display: flex; align-items: center; gap: 0.5rem;">
        📦 Unduh Semua File (ZIP)
      </button>
    </div>

    <div class="file-explorer-container">

      <!-- Breadcrumbs / Top Bar -->
      <div class="explorer-topbar">
        <div class="breadcrumbs">
          <span
            v-for="(bc, index) in folderStack"
            :key="'bc-'+index"
            class="bc-item"
          >
            <span class="bc-link" @click="fetchDirectory(bc)">{{ bc.id === null ? '🏠 ' + bc.nama_folder : bc.nama_folder }}</span>
            <span v-if="index < folderStack.length - 1" class="bc-separator">/</span>
          </span>
        </div>
        <div class="explorer-actions" style="display: flex; align-items: center; gap: 0.5rem;">
          <div class="search-box" style="position: relative;">
            <input type="text" v-model="explorerSearchQuery" @keyup.enter="handleExplorerSearch" placeholder="Cari file atau folder..." style="padding: 0.4rem 0.8rem; border: 1px solid var(--color-border); border-radius: 6px; font-size: 0.85rem;" />
            <button @click="handleExplorerSearch" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-muted);">🔍</button>
          </div>
          <button class="btn btn-outline btn-small" @click="openCreateFolderModal">
            + Buat Folder Baru
          </button>
          <button class="btn btn-primary btn-small" @click="showUploadModal = true">
            ⬆️ Upload File
          </button>
        </div>
      </div>

      <!-- View Mode Toggle -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 10px;">
         <div style="font-size:0.85rem; color:var(--text-muted);">
            💡 <b>Tips:</b> Gunakan Ctrl+Klik / Shift+Klik untuk memilih banyak, atau seret & lepas file ke kotak di bawah!
         </div>
         <div style="display: flex; gap: 5px; background: var(--bg-card); padding: 3px; border-radius: 6px; border: 1px solid var(--color-border);">
           <button class="btn btn-small" :style="viewMode === 'grid' ? 'background:var(--color-primary); color:white;' : 'background:transparent; color:var(--text-muted);'" @click="viewMode = 'grid'">📱 Grid</button>
           <button class="btn btn-small" :style="viewMode === 'list' ? 'background:var(--color-primary); color:white;' : 'background:transparent; color:var(--text-muted);'" @click="viewMode = 'list'">📄 List</button>
         </div>
      </div>
      <!-- Clipboard Status Indicator -->
      <div v-if="clipboard.id" style="font-size: 0.85rem; color: var(--color-primary); margin-top: 0.5rem; background: var(--bg-card); display:inline-block; padding: 4px 10px; border-radius: 20px; border: 1px solid var(--color-primary);">
        📋 Clipboard: <b>{{ clipboard.nama }}</b> ({{ clipboard.action === 'cut' ? 'Pindah' : 'Salin' }})
        <button class="btn btn-small" style="padding:0 5px; margin-left: 5px; background: transparent; color: red;" @click="clipboard = { action:null, type:null, id:null, nama:null }">✕</button>
      </div>

      <hr style="border:0; border-top: 1px solid var(--color-border); margin: 1rem 0;" />

      <!-- UNIFIED VIEW: Folders & Files Grid -->
      <div
        class="grid-view"
        :class="{ 'list-view-mode': viewMode === 'list', 'drag-active': isDragging }"
        @contextmenu.prevent="onAdvancedRightClick"
        @click.self="clearSelection"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
        style="min-height: 200px; transition: 0.2s; position: relative;"
        @scroll="explorerScrollTop = $event.target.scrollTop"
      >
        <div v-if="isFetchingFiles" class="text-muted text-center" style="grid-column: 1 / -1; padding: 2rem;">
          Memuat direktori...
        </div>
        <div v-else-if="explorerFolders.length === 0 && folderFiles.length === 0" class="text-muted text-center" style="grid-column: 1 / -1; padding: 2rem; pointer-events: none;">
          Direktori ini kosong. Klik kanan untuk membuat folder atau mem-paste file.
        </div>


        <!-- Drag Overlay -->
        <div v-if="isDragging" style="position:absolute; top:0; left:0; right:0; bottom:0; background: rgba(16, 185, 129, 0.1); border: 2px dashed #10b981; z-index: 10; display:flex; align-items:center; justify-content:center; border-radius: 8px; pointer-events:none;">
          <h2 style="color: #10b981;">⬇️ Lepaskan file untuk mengunggah</h2>
        </div>

        <!-- Folders - usually few) -->
        <div
          v-for="folder in explorerFolders"
          :key="'fol-'+folder.id"
          class="file-item folder"
          :class="{ 'folder-expired': folder.expired_at, 'selected-item': isSelected('folder', folder.id) }"
          @click.exact.prevent="toggleSelection($event, 'folder', folder.id)" @dblclick.prevent="folder.expired_at ? null : fetchDirectory(folder)" @click.ctrl.prevent="toggleSelection($event, 'folder', folder.id)" @click.shift.prevent="toggleSelection($event, 'folder', folder.id)"
          @contextmenu.prevent.stop="folder.expired_at ? null : onFolderRightClick($event, folder)"
          :style="folder.expired_at ? 'cursor: default; border: 1.5px solid #f87171; background: #fff1f1;' : ''"
        >
          <div class="file-icon">{{ folder.expired_at ? '🗑️' : '📂' }}</div>
          <div class="file-name" :style="folder.expired_at ? 'color: #dc2626; font-size: 0.78rem;' : ''">{{ folder.nama_folder }}</div>
          <!-- Expired folder extra info -->
          <template v-if="folder.expired_at">
            <div style="font-size: 0.68rem; color: #ef4444; background: #fee2e2; border-radius: 4px; padding: 1px 5px; margin-top: 3px; text-align: center; font-weight: 600;">
              ⏰ Expired {{ formatExpiredCountdown(folder.expired_at) }}
            </div>
            <button
              @click.stop="downloadFolderZip(folder.id, folder.nama_folder)"
              style="margin-top: 5px; width: 100%; font-size: 0.7rem; padding: 3px 6px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;"
            >📦 Download ZIP</button>
          </template>
          <div v-else class="file-meta">{{ new Date(folder.created_at).toLocaleDateString('id-ID') }}</div>
        </div>


        <!-- Virtual Scroll Spacer Top -->
        <div v-if="folderFiles.length > 0" :style="{ height: spacerTop, gridColumn: '1 / -1' }"></div>

        <!-- Files (Virtually Scrolled) -->
        <div
          v-for="file in virtualFiles"
          :key="'fil-'+file.id"
          class="file-item"
          :class="{ 'selected-item': isSelected('file', file.id) }"
          @click.exact.prevent="toggleSelection($event, 'file', file.id)" @dblclick.prevent="openPreview(file)" @click.ctrl.prevent="toggleSelection($event, 'file', file.id)" @click.shift.prevent="toggleSelection($event, 'file', file.id)"
          @contextmenu.prevent.stop="onFileRightClick($event, file)"
        >
          <!-- Image: show lazy-loaded thumbnail -->
          <div v-if="file.tipe_file.includes('image')" class="file-thumb-container">
            <img
              :src="file.thumbnail_url ? file.thumbnail_url : file.url_file"
              loading="lazy"
              class="file-thumb"
              :alt="file.nama_file"
              @error="$event.target.src=file.url_file"
            />
          </div>
          <!-- Other file types: show icon -->
          <div v-else class="file-icon">{{ getFileIcon(file.tipe_file, file.nama_file) }}</div>
          <div class="file-name" :title="file.nama_file">{{ file.nama_file }}</div>
          <div class="file-meta">{{ new Date(file.uploaded_at).toLocaleDateString('id-ID') }}</div>
        </div>

        <!-- Virtual Scroll Spacer Bottom -->
        <div v-if="folderFiles.length > 0" :style="{ height: spacerBottom, gridColumn: '1 / -1' }"></div>

        <!-- Load More Button -->
        <div v-if="explorerHasMore" style="grid-column: 1 / -1; text-align: center; padding: 1rem;">
          <button class="btn btn-outline" @click="loadMoreFiles" :disabled="isLoadingMore" style="min-width: 150px;">
            {{ isLoadingMore ? 'Memuat...' : `⬇️ Muat Lebih Banyak` }}
          </button>
        </div>

      </div>

    </div>
  </div>

  <!-- Folder Modal (Create/Rename) -->
  <div class="modal-overlay" v-if="showFolderModal" @click.self="showFolderModal = false">
    <div class="modal-content animate-slide-up" style="max-width: 400px;">
      <h2 style="margin-top:0;">{{ folderModalType === 'create' ? 'Buat Folder Baru' : 'Ubah Nama Folder' }}</h2>

      <form @submit.prevent="submitFolderForm">
        <div class="form-group">
          <label>Nama Kelompok / Folder</label>
          <input type="text" v-model="folderFormName" placeholder="Contoh: Kelompok Wergu Wetan" required />
        </div>
        <div class="modal-actions" style="margin-top: 1.5rem;">
          <button type="button" class="btn btn-outline" @click="showFolderModal = false">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </div>
      </form>
    </div>
  </div>


  <!-- Extract Modal -->
  <div class="modal-overlay" v-if="showExtractModal" @click.self="showExtractModal = false">
    <div class="modal-content animate-slide-up">
      <h2 style="margin-top:0;">📂 Ekstrak ZIP</h2>
      <p>Pilih metode ekstraksi untuk <b>{{ targetZipFile?.nama_file }}</b>:</p>
      <div style="margin: 1.5rem 0; text-align: left;">
        <label style="display:block; margin-bottom:10px; cursor: pointer; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px;" :style="extractMode === 'new_folder' ? 'border-color: var(--color-primary); background: rgba(16,185,129,0.05);' : ''">
          <input type="radio" v-model="extractMode" value="new_folder" style="margin-right:10px;">
          <b>Buat Folder Baru</b>
          <div v-if="extractMode === 'new_folder'" style="margin-top: 10px;">
            <input type="text" class="form-input" v-model="extractNewFolderName" placeholder="Nama Folder Baru..." style="width:100%;" />
          </div>
        </label>
        <label style="display:block; cursor: pointer; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px;" :style="extractMode === 'here' ? 'border-color: var(--color-primary); background: rgba(16,185,129,0.05);' : ''">
          <input type="radio" v-model="extractMode" value="here" style="margin-right:10px;">
          <b>Ekstrak di Sini (Isi ZIP berserakan di folder ini)</b>
        </label>
      </div>
      <div class="modal-actions" style="margin-top: 2rem;">
        <button class="btn btn-outline" @click="showExtractModal = false">Batal</button>
        <button class="btn btn-primary" @click="submitExtract" :disabled="isExtracting">⚙️ {{ isExtracting ? 'Sedang Mengekstrak...' : 'Mulai Ekstrak' }}</button>
      </div>
    </div>
  </div>

  <!-- Compress Modal -->
  <div class="modal-overlay" v-if="showCompressModal" @click.self="showCompressModal = false">
    <div class="modal-content animate-slide-up">
      <h2 style="margin-top:0;">📦 Kompres {{ selectedItems.size }} Item</h2>
      <div class="form-group" style="text-align: left;">
        <label>Nama File ZIP Baru</label>
        <input type="text" v-model="compressZipName" placeholder="Contoh: Kumpulan_Laporan.zip" required class="form-input" />
      </div>
      <div class="modal-actions" style="margin-top: 2rem;">
        <button class="btn btn-outline" @click="showCompressModal = false">Batal</button>
        <button class="btn btn-primary" @click="compressSelectedFiles" :disabled="isCompressing">📦 {{ isCompressing ? 'Sedang Mengompres...' : 'Mulai Kompresi' }}</button>
      </div>
    </div>
  </div>

  <!-- Upload File Modal -->
  <div class="modal-overlay" v-if="showUploadModal" @click.self="showUploadModal = false">
    <div class="modal-content animate-slide-up" style="max-width: 500px;">
      <h2 style="margin-top:0;">{{ uploadMode === 'file' ? 'Unggah Berkas' : 'Simpan Tautan' }}</h2>
      <p class="text-muted" style="margin-bottom: 1rem; font-size: 0.9rem;">
        Tujuan: <strong class="text-primary">{{ currentFolder?.nama_folder }}</strong>
      </p>

      <!-- Tabs -->
      <div style="display:flex; gap: 10px; margin-bottom: 1.5rem;">
        <button type="button" class="btn" :class="uploadMode === 'file' ? 'btn-primary' : 'btn-outline'" @click="uploadMode = 'file'" style="flex:1;">📁 Unggah Berkas</button>
        <button type="button" class="btn" :class="uploadMode === 'link' ? 'btn-primary' : 'btn-outline'" @click="uploadMode = 'link'" style="flex:1;">🔗 Simpan Tautan</button>
      </div>

      <form @submit.prevent="submitUpload">
        <template v-if="uploadMode === 'file'">
          <div class="form-group">
            <label>Pilih File (Maks 50 MB)</label>
            <input type="file" @change="handleFileSelect" multiple required />
          </div>
          <div class="form-group">
            <label>Ubah Nama File (Opsional)</label>
            <input type="text" v-model="uploadCustomName" placeholder="Kosongkan untuk pakai nama asli" />
          </div>
        </template>

        <template v-else>
          <div class="form-group">
            <label>Keterangan Tautan</label>
            <input type="text" v-model="uploadCustomName" placeholder="Contoh: Referensi Jurnal Stunting" required />
          </div>
          <div class="form-group">
            <label>URL Tautan</label>
            <input type="url" v-model="uploadLinkUrl" placeholder="https://..." required />
          </div>
        </template>

        <div v-if="uploadError" class="error-msg">{{ uploadError }}</div>

        <div class="modal-actions" style="margin-top: 2rem;">
          <button type="button" class="btn btn-outline" @click="showUploadModal = false">Batal</button>
          <button type="submit" class="btn btn-primary" :disabled="isUploading">
            {{ isUploading ? 'Memproses...' : 'Simpan' }}
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- File Preview / Iframe Modal -->
  <div class="modal-overlay" v-if="previewFile" @click.self="previewFile = null">
    <div class="modal-content animate-slide-up" style="max-width: 900px; width: 95%; height: 80vh; display:flex; flex-direction:column;">
      <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          {{ previewFile.nama_file }}
        </h2>
        <button class="btn btn-outline btn-small" @click="previewFile = null">Tutup</button>
      </div>

      <div class="preview-container" style="flex:1; display:flex; justify-content:center; align-items:center; background:#1e1e1e; padding:1rem; border-radius:12px; margin-bottom:1rem; overflow:hidden;">
        <!-- Image Preview -->
        <img v-if="previewFile.tipe_file.includes('image')" :src="previewFile.url_file" style="max-width: 100%; max-height: 100%; object-fit: contain;" />

        <!-- Video Preview -->
        <video v-else-if="previewFile.tipe_file.includes('video')" controls style="max-width: 100%; max-height: 100%; background: #000;">
          <source :src="previewFile.url_file" type="video/mp4">
          Video tidak didukung.
        </video>

        <!-- PDF Preview -->
        <iframe v-else-if="previewFile.tipe_file.includes('pdf')" :src="previewFile.url_file" style="width: 100%; height: 100%; border: none;">
          <p>PDF tidak dapat ditampilkan.</p>
        </iframe>

        <div v-else class="text-muted text-center" style="color:white;">
          <div style="font-size:3rem; margin-bottom:1rem;">📄</div>
          <p>Format file ini tidak mendukung pratinjau.</p>
        </div>
      </div>

      <div style="text-align: right; margin-top: 1rem;">
        <button class="btn btn-primary" @click="downloadOriginal(previewFile)">Unduh File Asli</button>
      </div>
    </div>
  </div>

  <!-- Clipboard Floating Indicator -->
  <div v-if="clipboard.items && clipboard.items.length > 0" class="clipboard-floating-bar">
    <div class="clipboard-info">
      <span class="clipboard-icon">📋</span>
      <span class="clipboard-text">
        {{ clipboard.action === 'cut' ? 'Memindah' : 'Menyalin' }} {{ clipboard.items.length }} Item
      </span>
    </div>
    <div class="clipboard-actions">
      <button class="btn-paste" @click="handlePaste">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>
        Paste Di Sini
      </button>
      <button class="btn-cancel" @click="clipboard.items = []">
        Batal
      </button>
    </div>
  </div>

  <!-- Custom Right Click Context Menu -->
  <div v-if="contextMenu.visible" class="context-overlay" @click="closeContextMenu" @contextmenu.prevent="closeContextMenu"></div>
  <div v-if="contextMenu.visible" class="context-menu" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }">

    <!-- Multi-select Actions -->
    <template v-if="contextMenu.targetType === 'multi'">
      <div class="context-item" @click="handleCutCopy('copy')">📄 Salin {{ selectedItems.size }} Item</div>
      <div class="context-item" @click="handleCutCopy('cut')">✂️ Pindah {{ selectedItems.size }} Item</div>
      <div class="context-item" style="color: #10b981;" @click="showCompressModal = true; closeContextMenu();">📦 Kompres {{ selectedItems.size }} Item</div>
      <div class="context-item text-danger" @click="deleteSelectedItems(); closeContextMenu();">🗑️ Hapus {{ selectedItems.size }} Item</div>
    </template>

    <!-- Whitespace Actions -->
    <template v-if="contextMenu.targetType === 'whitespace'">
      <div class="context-item" @click="openCreateFolderModal(); closeContextMenu();">📁 Buat Folder Baru</div>
      <div class="context-item" @click="showUploadModal = true; closeContextMenu();">⬆️ Upload File Kesini</div>
      <div v-if="clipboard.items && clipboard.items.length > 0" class="context-item" @click="handlePaste">📋 Paste ({{ clipboard.nama }})</div>
    </template>

    <!-- Folder Actions -->
    <template v-if="contextMenu.targetType === 'folder'">
      <div class="context-item" @click="handleContextRename">✏️ Ubah Nama Folder</div>
      <div class="context-item" @click="handleCutCopy('copy')">📄 Salin (Copy)</div>
      <div class="context-item" @click="handleCutCopy('cut')">✂️ Pindah (Cut)</div>
      <div class="context-item" style="color: #10b981;" @click="showCompressModal = true; closeContextMenu();">📦 Kompres ke ZIP</div>
      <div class="context-item text-danger" @click="handleContextDelete">🗑️ Hapus Folder</div>
    </template>

    <!-- File Actions -->
    <template v-if="contextMenu.targetType === 'file'">
      <div class="context-item" @click="openPreview(contextMenu.item); closeContextMenu();">👁️ Lihat / Unduh</div>
      <div v-if="contextMenu.item && contextMenu.item.nama_file && (contextMenu.item.nama_file.toLowerCase().endsWith('.zip') || contextMenu.item.nama_file.toLowerCase().endsWith('.rar'))" class="context-item" style="color: #10b981;" @click="targetZipFile = contextMenu.item; showExtractModal = true; closeContextMenu();">📂 Ekstrak ZIP...</div>
      <div class="context-item" @click="handleCutCopy('copy')">📄 Salin (Copy)</div>
      <div class="context-item" @click="handleCutCopy('cut')">✂️ Pindah (Cut)</div>
      <div class="context-item" style="color: #10b981;" @click="showCompressModal = true; closeContextMenu();">📦 Kompres ke ZIP</div>
      <div class="context-item" @click="handleContextRename">✏️ Ubah Nama</div>
      <div class="context-item text-danger" @click="handleContextDelete">🗑️ Hapus File</div>
    </template>

  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
}

.animate-slide-up {
  animation: slideUpModal 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideUpModal {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.error-msg {
  color: #ef4444;
  font-size: 0.9rem;
}

.text-primary {
  color: var(--color-primary);
}

.explorer-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.breadcrumbs {
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bc-link {
  color: var(--color-primary);
  cursor: pointer;
  transition: color 0.2s;
}

.bc-link:hover {
  color: var(--text-main);
}

.bc-separator {
  color: var(--text-muted);
}

.grid-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1.5rem;
  padding: 1rem 0;
}

.file-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  cursor: pointer;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid transparent;
  transition: all 0.2s;
  position: relative;
}

.file-item:hover {
  background-color: var(--bg-main);
  border-color: var(--color-border);
  transform: translateY(-2px);
}

.file-item.folder .file-icon {
  font-size: 4rem;
  margin-bottom: 0.5rem;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
}

.file-icon {
  font-size: 3.5rem;
  margin-bottom: 0.5rem;
}

.file-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-main);
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.file-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.file-thumb-container {
  width: 100%;
  height: 80px;
  margin-bottom: 0.5rem;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  transition: opacity 0.3s;
}

.context-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9998;
}

.context-menu {
  position: fixed;
  background: var(--bg-card);
  border: 1px solid var(--color-border);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 0.5rem 0;
  min-width: 180px;
  z-index: 9999;
}

.context-item {
  padding: 0.7rem 1rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.context-item:hover {
  background: var(--bg-main);
}

.context-item.text-danger {
  color: #ff4d4f;
}

@media (max-width: 768px) {
  .explorer-topbar {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .explorer-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .explorer-actions .search-box {
    width: 100%;
  }

  .explorer-actions .search-box input {
    width: 100%;
    box-sizing: border-box;
  }

  .explorer-actions .btn {
    flex: 1;
    text-align: center;
    justify-content: center;
    white-space: nowrap;
  }
}
</style>

<style>
/* --- Advanced Explorer CSS --- */
.file-item.selected-item {
  background-color: rgba(16, 185, 129, 0.15) !important;
  border-color: #10b981 !important;
  box-shadow: 0 0 0 1px #10b981;
}

.grid-view.list-view-mode {
  display: flex !important;
  flex-direction: column !important;
  gap: 0.5rem !important;
}

.grid-view.list-view-mode .file-item {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  text-align: left !important;
  height: auto !important;
  padding: 0.5rem 1rem !important;
}

.grid-view.list-view-mode .file-icon {
  margin-bottom: 0 !important;
  margin-right: 1rem !important;
  font-size: 1.5rem !important;
}

.grid-view.list-view-mode .file-thumb-container {
  width: 40px !important;
  height: 40px !important;
  margin-bottom: 0 !important;
  margin-right: 1rem !important;
}

.grid-view.list-view-mode .file-name {
  flex: 1 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

.grid-view.list-view-mode .file-meta {
  margin-top: 0 !important;
  margin-left: 1rem !important;
}


/* Clipboard Floating Bar */
.clipboard-floating-bar {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.75rem 1.5rem;
  z-index: 9999;
  border: 1px solid var(--border-color);
  animation: slideUp 0.3s ease-out forwards;
}

@keyframes slideUp {
  from { opacity: 0; transform: translate(-50%, 20px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

.clipboard-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.clipboard-icon {
  font-size: 1.25rem;
}

.clipboard-text {
  font-weight: 600;
  color: var(--text-primary);
}

.clipboard-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-paste {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--primary-color);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-paste:hover {
  background: var(--primary-hover);
  transform: translateY(-2px);
}

.btn-cancel {
  background: #f1f5f9;
  color: var(--text-secondary);
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cancel:hover {
  background: #e2e8f0;
  color: var(--text-primary);
}
</style>
