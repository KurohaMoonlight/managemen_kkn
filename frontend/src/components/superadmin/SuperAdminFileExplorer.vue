<script setup>
import { onMounted } from 'vue';
import { useSuperAdminExplorer } from '../../composables/superadmin/useSuperAdminExplorer.js';

const props = defineProps({
  token: { type: String, required: true }
});

const {
  explorerView, activePosko,
  poskoList, poskoLoading, poskoSearchQuery, filteredPoskoList,
  explorerFolders, folderFiles, currentFolder, folderStack,
  isFetchingFiles, explorerHasMore, isLoadingMore,
  viewMode, explorerSearchQuery, previewFile, showPreviewModal,
  explorerScrollTop, virtualFiles, spacerTop, spacerBottom,
  contextMenu,
  isSelected, clearSelection,
  init, enterPosko, backToCluster,
  fetchDirectory, loadMoreFiles, handleExplorerSearch,
  getFileIcon, openPreview, downloadFile, downloadFolderZip, downloadPoskoZip,
  closeContextMenu, onFileRightClick, onFolderRightClick,
} = useSuperAdminExplorer(props.token);

onMounted(() => init());
</script>

<template>
  <div class="sa-content" @click="closeContextMenu">

    <!-- ══════════════════ CLUSTER VIEW ══════════════════ -->
    <div v-if="explorerView === 'cluster'">
      <div class="sa-header-actions" style="margin-bottom: 1.5rem;">
        <h2>📁 File Explorer Semua Posko</h2>
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div style="position:relative;">
            <input
              type="text"
              v-model="poskoSearchQuery"
              placeholder="🔍 Cari posko..."
              class="sa-input"
              style="padding-right: 2rem; min-width: 220px;"
            />
          </div>
          <button class="sa-btn" @click="fetchPoskoList" :disabled="poskoLoading">
            {{ poskoLoading ? '⏳' : '🔄' }} Segarkan
          </button>
        </div>
      </div>

      <div v-if="poskoLoading" class="sa-loading-placeholder">Memuat daftar posko...</div>

      <div v-else-if="filteredPoskoList.length === 0" class="sa-empty-state">
        <div class="empty-icon">🏡</div>
        <p>Tidak ada posko ditemukan.</p>
      </div>

      <div v-else class="posko-cluster-grid">
        <div
          v-for="posko in filteredPoskoList"
          :key="'posko-' + posko.id"
          class="posko-cluster-card"
        >
          <div class="posko-card-icon">🏠</div>
          <div class="posko-card-name">{{ posko.nama_posko }}</div>
          <div class="posko-card-sub">{{ posko.kelurahan || posko.kecamatan || 'KKN' }}</div>
          <div class="posko-card-actions">
            <button class="sa-btn sa-btn-primary posko-card-btn" @click="enterPosko(posko)">
              📂 Buka Explorer
            </button>
            <button class="sa-btn posko-card-btn-dl" @click="downloadPoskoZip(posko)" title="Download semua arsip posko ini sebagai ZIP">
              📦 ZIP
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════ EXPLORER VIEW ══════════════════ -->
    <div v-else-if="explorerView === 'explorer'">

      <!-- Top Bar -->
      <div class="sa-header-actions" style="margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
        <div style="display:flex; align-items:center; gap: 0.75rem; flex-wrap: wrap;">
          <button class="sa-btn" @click="backToCluster" style="font-size:0.9rem;">
            ← Semua Posko
          </button>
          <!-- Breadcrumb -->
          <div class="sa-breadcrumbs">
            <span style="font-size:0.85rem; font-weight:700; color: var(--color-primary-dark, #5a7a72);">
              🏠 {{ activePosko?.nama_posko }}
            </span>
            <span
              v-for="(bc, idx) in folderStack"
              :key="'bc-' + idx"
              style="display:inline-flex; align-items:center; gap: 0.25rem;"
            >
              <span style="color: #aaa; font-size: 0.9rem;"> / </span>
              <span
                class="sa-bc-link"
                :class="{ 'active': idx === folderStack.length - 1 }"
                @click="fetchDirectory(bc)"
              >{{ bc.id === null ? 'Beranda' : bc.nama_folder }}</span>
            </span>
          </div>
        </div>
        <!-- Download ZIP button for current posko -->
        <button class="sa-btn" @click="downloadPoskoZip()" title="Download semua arsip posko ini sebagai ZIP">
          📦 Download Semua ZIP
        </button>
      </div>

      <!-- Toolbar: Search + View Mode -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <div style="position:relative;">
            <input
              type="text"
              v-model="explorerSearchQuery"
              @keyup.enter="handleExplorerSearch"
              placeholder="🔍 Cari file atau folder..."
              class="sa-input"
              style="min-width: 220px;"
            />
          </div>
          <button class="sa-btn" @click="handleExplorerSearch">Cari</button>
        </div>
        <div style="display:flex; gap:4px; background: #1e293b; padding: 3px; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.2);">
          <button
            class="sa-btn sa-btn-sm"
            :style="viewMode === 'grid' ? 'background: rgba(99, 102, 241, 0.2); color: #818cf8; border-color: transparent;' : 'background: transparent; color: #94a3b8; border-color: transparent;'"
            @click="viewMode = 'grid'"
          >📱 Grid</button>
          <button
            class="sa-btn sa-btn-sm"
            :style="viewMode === 'list' ? 'background: rgba(99, 102, 241, 0.2); color: #818cf8; border-color: transparent;' : 'background: transparent; color: #94a3b8; border-color: transparent;'"
            @click="viewMode = 'list'"
          >📄 List</button>
        </div>
      </div>

      <div
        class="sa-explorer-grid"
        :class="{ 'sa-explorer-list': viewMode === 'list' }"
        @scroll="explorerScrollTop = $event.target.scrollTop"
        @click.self="clearSelection"
      >
        <div v-if="isFetchingFiles" class="sa-explorer-empty">
          Memuat direktori...
        </div>
        <div v-else-if="explorerFolders.length === 0 && folderFiles.length === 0" class="sa-explorer-empty">
          Direktori ini kosong.
        </div>

        <!-- Folders -->
        <div
          v-for="folder in explorerFolders"
          :key="'fol-' + folder.id"
          class="sa-file-item folder"
          :class="{ 'selected-item': isSelected('folder', folder.id) }"
          @dblclick.prevent="fetchDirectory(folder)"
          @contextmenu.prevent.stop="onFolderRightClick($event, folder)"
        >
          <div class="sa-file-icon">📂</div>
          <div class="sa-file-name" :title="folder.nama_folder">{{ folder.nama_folder }}</div>
          <div class="sa-file-meta">{{ new Date(folder.created_at).toLocaleDateString('id-ID') }}</div>
          <button
            class="sa-dl-btn"
            @click.stop="downloadFolderZip(folder.id, folder.nama_folder)"
            title="Download folder sebagai ZIP"
          >📦 ZIP</button>
        </div>

        <!-- Virtual Scroll Spacer Top -->
        <div v-if="folderFiles.length > 0" :style="{ height: spacerTop, gridColumn: '1 / -1' }"></div>

        <!-- Files (Virtually Scrolled) -->
        <div
          v-for="file in virtualFiles"
          :key="'fil-' + file.id"
          class="sa-file-item"
          :class="{ 'selected-item': isSelected('file', file.id) }"
          @dblclick.prevent="openPreview(file)"
          @contextmenu.prevent.stop="onFileRightClick($event, file)"
        >
          <!-- Image thumbnail (lazy) -->
          <div v-if="file.tipe_file && file.tipe_file.includes('image')" class="sa-file-thumb-container">
            <img
              :src="file.thumbnail_url ? file.thumbnail_url : file.url_file"
              loading="lazy"
              class="sa-file-thumb"
              :alt="file.nama_file"
              @error="$event.target.src = file.url_file"
            />
          </div>
          <!-- Other file types: icon -->
          <div v-else class="sa-file-icon">{{ getFileIcon(file.tipe_file, file.nama_file) }}</div>
          <div class="sa-file-name" :title="file.nama_file">{{ file.nama_file }}</div>
          <div class="sa-file-meta">{{ new Date(file.uploaded_at).toLocaleDateString('id-ID') }}</div>
        </div>

        <!-- Virtual Scroll Spacer Bottom -->
        <div v-if="folderFiles.length > 0" :style="{ height: spacerBottom, gridColumn: '1 / -1' }"></div>

        <!-- Lazy Load More -->
        <div v-if="explorerHasMore" style="grid-column: 1 / -1; text-align: center; padding: 1rem;">
          <button class="sa-btn" @click="loadMoreFiles" :disabled="isLoadingMore" style="min-width: 160px;">
            {{ isLoadingMore ? '⏳ Memuat...' : '⬇️ Muat Lebih Banyak' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ══════════════════ CONTEXT MENU ══════════════════ -->
    <div
      v-if="contextMenu.visible"
      class="sa-context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      @click.stop
    >
      <template v-if="contextMenu.targetType === 'file'">
        <button class="sa-ctx-item" @click="openPreview(contextMenu.item); closeContextMenu()">🔍 Preview / Buka</button>
        <button class="sa-ctx-item" @click="downloadFile(contextMenu.item); closeContextMenu()">⬇️ Download</button>
      </template>
      <template v-if="contextMenu.targetType === 'folder'">
        <button class="sa-ctx-item" @click="fetchDirectory(contextMenu.item); closeContextMenu()">📂 Buka Folder</button>
        <button class="sa-ctx-item" @click="downloadFolderZip(contextMenu.item.id, contextMenu.item.nama_folder); closeContextMenu()">📦 Download ZIP</button>
      </template>
    </div>

    <!-- ══════════════════ PREVIEW MODAL ══════════════════ -->
    <div class="sa-modal-overlay" v-if="showPreviewModal" @click.self="showPreviewModal = false">
      <div class="sa-modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h3 style="margin:0; font-size: 1rem; word-break: break-all;">{{ previewFile?.nama_file }}</h3>
          <div style="display:flex; gap:0.5rem;">
            <button class="sa-btn sa-btn-primary sa-btn-sm" @click="downloadFile(previewFile)">⬇️ Download</button>
            <button class="sa-btn sa-btn-sm" @click="showPreviewModal = false">✕ Tutup</button>
          </div>
        </div>
        <!-- Image Preview -->
        <img
          v-if="previewFile?.tipe_file?.includes('image')"
          :src="previewFile.url_file"
          style="max-width:100%; border-radius: 8px; display:block; margin: auto;"
          :alt="previewFile.nama_file"
        />
        <!-- PDF Preview -->
        <iframe
          v-else-if="previewFile?.tipe_file?.includes('pdf')"
          :src="previewFile.url_file"
          style="width:100%; height:70vh; border:none; border-radius: 8px;"
        ></iframe>
        <!-- Video Preview -->
        <video
          v-else-if="previewFile?.tipe_file?.includes('video')"
          :src="previewFile.url_file"
          controls
          style="max-width:100%; border-radius: 8px; display:block; margin: auto;"
        ></video>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ─── Cluster Grid ──────────────────────────────────────────── */
.posko-cluster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.25rem;
}

.posko-cluster-card {
  background: #1e293b;
  border: 1.5px solid rgba(148, 163, 184, 0.1);
  border-radius: 14px;
  padding: 1.25rem 1rem;
  text-align: center;
  transition: all 0.2s ease;
  cursor: default;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}

.posko-cluster-card:hover {
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 0 6px 24px rgba(99, 102, 241, 0.15);
  transform: translateY(-3px);
}

.posko-card-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
.posko-card-name { font-weight: 700; font-size: 0.95rem; color: #f1f5f9; margin-bottom: 0.25rem; word-break: break-word; }
.posko-card-sub { font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.75rem; }

.posko-card-actions { 
  display: flex; 
  gap: 0.5rem; 
  justify-content: center; 
  margin-top: auto; 
  flex-wrap: wrap; 
}
.posko-card-btn { flex: 1; font-size: 0.8rem; padding: 0.4rem 0.5rem; min-width: 100px; }
.posko-card-btn-dl {
  background: rgba(148, 163, 184, 0.1);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  font-size: 0.8rem;
  color: #94a3b8;
  transition: all 0.2s;
}
.posko-card-btn-dl:hover {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.3);
  color: #818cf8;
}

/* ─── Cluster Header ────────────────────────────────────────── */
.sa-header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.sa-header-actions h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: #f1f5f9;
}

/* ─── Breadcrumb ────────────────────────────────────────────── */
.sa-breadcrumbs { display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; }
.sa-bc-link {
  cursor: pointer;
  color: #818cf8;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.15s;
}
.sa-bc-link:hover { background: rgba(99, 102, 241, 0.15); }
.sa-bc-link.active { color: #f1f5f9; font-weight: 700; cursor: default; }
.sa-bc-link.active:hover { background: none; }

/* ─── Explorer Grid ─────────────────────────────────────────── */
.sa-explorer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
  min-height: 300px;
  max-height: 520px;
  overflow-y: auto;
  padding: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 12px;
  background: #0f172a;
  position: relative;
  scrollbar-width: thin;
  scrollbar-color: rgba(99, 102, 241, 0.3) transparent;
}
.sa-explorer-grid::-webkit-scrollbar { width: 6px; }
.sa-explorer-grid::-webkit-scrollbar-track { background: transparent; }
.sa-explorer-grid::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 3px; }

.sa-explorer-list { grid-template-columns: 1fr; }

.sa-explorer-empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem;
  color: #475569;
  font-size: 0.9rem;
  font-style: italic;
}

/* ─── File Items ────────────────────────────────────────────── */
.sa-file-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 0.85rem 0.5rem 0.65rem;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1.5px solid transparent;
  text-align: center;
  min-height: 110px;
  height: 100%;
  box-sizing: border-box;
  position: relative;
}

.sa-file-item:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.25);
}
.sa-file-item.selected-item {
  background: rgba(99, 102, 241, 0.15);
  border-color: #6366f1;
}

.sa-file-icon { font-size: 2.4rem; margin-bottom: 0.4rem; line-height: 1; }
.sa-file-name {
  font-size: 0.72rem;
  font-weight: 500;
  color: #cbd5e1;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  width: 100%;
  line-height: 1.3;
}
.sa-file-meta { font-size: 0.63rem; color: #475569; margin-top: 0.25rem; margin-bottom: 0.2rem; }

.sa-dl-btn {
  margin-top: auto;
  width: 100%;
  font-size: 0.65rem;
  padding: 3px 4px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 5px;
  cursor: pointer;
  color: #818cf8;
  transition: all 0.15s;
  white-space: nowrap;
}
.sa-dl-btn:hover {
  background: rgba(99, 102, 241, 0.25);
  border-color: #6366f1;
  color: #a5b4fc;
}

.sa-file-thumb-container {
  width: 100%;
  height: 72px;
  overflow: hidden;
  border-radius: 6px;
  margin-bottom: 0.4rem;
  background: #1e293b;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(148, 163, 184, 0.1);
}
.sa-file-thumb { width: 100%; height: 100%; object-fit: cover; }

/* ─── Loading / Empty ───────────────────────────────────────── */
.sa-loading-placeholder {
  padding: 2rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
}
.sa-empty-state {
  text-align: center;
  padding: 3rem;
  color: #475569;
}
.empty-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; }

/* ─── Context Menu ──────────────────────────────────────────── */
.sa-context-menu {
  position: fixed;
  z-index: 9999;
  background: #1e293b;
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  min-width: 190px;
  overflow: hidden;
}
.sa-ctx-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.65rem 1rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  color: #cbd5e1;
  transition: background 0.15s;
  border-bottom: 1px solid rgba(148, 163, 184, 0.06);
}
.sa-ctx-item:last-child { border-bottom: none; }
.sa-ctx-item:hover {
  background: rgba(99, 102, 241, 0.12);
  color: #f1f5f9;
}

/* ─── Preview Modal ─────────────────────────────────────────── */
.sa-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}
.sa-modal-content {
  background: #1e293b;
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 16px;
  padding: 1.5rem;
  width: 90%;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  color: #f1f5f9;
}
.sa-modal-content h3 { color: #f1f5f9; }

/* ─── Search & Toolbar Overrides ────────────────────────────── */
.sa-input {
  background: #0f172a;
  border: 1.5px solid rgba(148, 163, 184, 0.2);
  border-radius: 10px;
  padding: 0.6rem 1rem;
  color: #f1f5f9;
  font-size: 0.875rem;
  font-family: inherit;
  transition: all 0.2s;
  box-sizing: border-box;
}
.sa-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}
.sa-input::placeholder { color: #475569; }

/* ─── Buttons ────────────────────────────────────────────────── */
.sa-btn {
  padding: 0.55rem 1.1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(148, 163, 184, 0.08);
  color: #94a3b8;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.2s;
  white-space: nowrap;
}
.sa-btn:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.4);
  color: #818cf8;
}
.sa-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.sa-btn-primary {
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border-color: transparent;
  color: white;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
}
.sa-btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #818cf8, #6366f1);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
  color: white;
  transform: translateY(-1px);
}

.sa-btn-sm { padding: 0.35rem 0.75rem; font-size: 0.78rem; border-radius: 6px; }

/* ─── List View ─────────────────────────────────────────────── */
.sa-explorer-list .sa-file-item {
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  text-align: left;
  min-height: auto;
  padding: 0.55rem 0.75rem;
}
.sa-explorer-list .sa-file-icon { font-size: 1.5rem; margin: 0; flex-shrink: 0; }
.sa-explorer-list .sa-file-name { -webkit-line-clamp: 1; flex: 1; font-size: 0.85rem; }
.sa-explorer-list .sa-file-thumb-container { width: 42px; height: 42px; min-width: 42px; margin: 0; }
.sa-explorer-list .sa-dl-btn { width: auto; margin: 0; }

/* ─── View Toggle Inline Styles Override ────────────────────── */
/* (buttons handled via sa-btn + sa-btn-sm already) */
</style>
