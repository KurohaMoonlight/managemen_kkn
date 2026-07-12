import { ref, computed } from 'vue';

/**
 * useBaseExplorer
 * Composable dasar yang berisi logika stateful yang digunakan bersama
 * antara useAdminExplorer dan useSuperAdminExplorer:
 *   - Virtual scrolling state & computed
 *   - Selection state (multi-select dengan Shift/Ctrl)
 *   - Context menu state
 *   - Preview modal state
 */
export function useBaseExplorer() {
  // ─── Virtual Scroll Constants ─────────────────────────────────────────────
  const ITEM_HEIGHT = 120;
  const COLS = 5;
  const VISIBLE_ROWS = 4;

  // ─── Virtual Scroll State ─────────────────────────────────────────────────
  const explorerScrollTop = ref(0);
  const folderFiles = ref([]);

  const visibleStartIndex = computed(() =>
    Math.max(0, Math.floor(explorerScrollTop.value / ITEM_HEIGHT) * COLS - COLS)
  );
  const visibleEndIndex = computed(() =>
    visibleStartIndex.value + (VISIBLE_ROWS + 2) * COLS
  );
  const virtualFiles = computed(() =>
    folderFiles.value.slice(visibleStartIndex.value, visibleEndIndex.value)
  );
  const spacerTop = computed(() =>
    Math.floor(visibleStartIndex.value / COLS) * ITEM_HEIGHT + 'px'
  );
  const spacerBottom = computed(() => {
    const totalRows = Math.ceil(folderFiles.value.length / COLS);
    const endRow = Math.ceil(visibleEndIndex.value / COLS);
    return Math.max(0, totalRows - endRow) * ITEM_HEIGHT + 'px';
  });

  // ─── Selection State ──────────────────────────────────────────────────────
  const selectedItems = ref(new Set());
  const lastSelectedId = ref(null);

  const isSelected = (type, id) => selectedItems.value.has(type + '-' + id);

  const clearSelection = () => {
    selectedItems.value.clear();
    lastSelectedId.value = null;
  };

  /**
   * Toggle seleksi item dengan dukungan Shift (range) dan Ctrl/Meta (multi).
   * @param {MouseEvent} e
   * @param {'file'|'folder'} type
   * @param {number|string} id
   * @param {Array} allFolders - Array folder saat ini (untuk kalkulasi range)
   */
  const toggleSelection = (e, type, id, allFolders = []) => {
    const key = type + '-' + id;
    if (e.shiftKey && lastSelectedId.value) {
      const allItems = [
        ...allFolders.map((f) => 'folder-' + f.id),
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

  // ─── Context Menu State ───────────────────────────────────────────────────
  const contextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    targetType: null,
    item: null,
  });

  const closeContextMenu = () => {
    contextMenu.value.visible = false;
  };

  // ─── Preview Modal State ──────────────────────────────────────────────────
  const previewFile = ref(null);
  const showPreviewModal = ref(false);

  return {
    // Virtual scroll
    ITEM_HEIGHT,
    COLS,
    VISIBLE_ROWS,
    explorerScrollTop,
    folderFiles,
    visibleStartIndex,
    visibleEndIndex,
    virtualFiles,
    spacerTop,
    spacerBottom,
    // Selection
    selectedItems,
    lastSelectedId,
    isSelected,
    clearSelection,
    toggleSelection,
    // Context menu
    contextMenu,
    closeContextMenu,
    // Preview
    previewFile,
    showPreviewModal,
  };
}
