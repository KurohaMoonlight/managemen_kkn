<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  options: { type: Array, default: () => [] },
  modelValue: { type: [String, Number], default: '' },
  manualValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Cari atau ketik kategori baru...' },
  labelKey: { type: String, default: 'nama_kategori' },
  valueKey: { type: String, default: 'id' },
  required: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'update:manualValue', 'change']);

const rootRef = ref(null);
const search = ref('');
const isOpen = ref(false);
const highlightedIndex = ref(0);

const selectedOption = computed(() =>
  props.options.find(o => String(o[props.valueKey]) === String(props.modelValue))
);

const displayLabel = computed(() => {
  if (selectedOption.value) return selectedOption.value[props.labelKey];
  if (props.manualValue) return props.manualValue;
  return '';
});

watch(() => props.modelValue, () => syncSearchFromValue());
watch(() => props.manualValue, () => syncSearchFromValue());

const syncSearchFromValue = () => {
  if (selectedOption.value) {
    search.value = selectedOption.value[props.labelKey];
  } else if (props.manualValue) {
    search.value = props.manualValue;
  }
};

onMounted(() => syncSearchFromValue());

const normalizedSearch = computed(() => search.value.trim().toLowerCase());

const filteredOptions = computed(() => {
  if (!normalizedSearch.value) return props.options;
  return props.options.filter(o =>
    o[props.labelKey].toLowerCase().includes(normalizedSearch.value)
  );
});

const exactMatch = computed(() =>
  props.options.find(o => o[props.labelKey].toLowerCase() === normalizedSearch.value)
);

const showCreateNew = computed(() =>
  normalizedSearch.value.length > 0 && !exactMatch.value
);

const allItems = computed(() => {
  const items = filteredOptions.value.map(o => ({ type: 'existing', data: o }));
  if (showCreateNew.value) {
    items.push({ type: 'new', data: { label: search.value.trim() } });
  }
  return items;
});

const openDropdown = () => {
  isOpen.value = true;
  highlightedIndex.value = 0;
};

const closeDropdown = () => {
  isOpen.value = false;
};

const selectExisting = (option) => {
  emit('update:modelValue', option[props.valueKey]);
  emit('update:manualValue', '');
  search.value = option[props.labelKey];
  emit('change', { type: 'existing', option });
  closeDropdown();
};

const selectNew = () => {
  const name = search.value.trim();
  if (!name) return;
  emit('update:modelValue', '');
  emit('update:manualValue', name);
  emit('change', { type: 'new', name });
  closeDropdown();
};

const onInput = (e) => {
  search.value = e.target.value;
  emit('update:modelValue', '');
  emit('update:manualValue', search.value.trim());
  openDropdown();
};

const onFocus = () => {
  openDropdown();
};

const onKeydown = (e) => {
  if (!isOpen.value && (e.key === 'ArrowDown' || e.key === 'Enter')) {
    openDropdown();
    return;
  }
  if (!isOpen.value) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, allItems.value.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const item = allItems.value[highlightedIndex.value];
    if (item?.type === 'existing') selectExisting(item.data);
    else if (item?.type === 'new') selectNew();
    else if (showCreateNew.value) selectNew();
    else if (exactMatch.value) selectExisting(exactMatch.value);
  } else if (e.key === 'Escape') {
    closeDropdown();
  }
};

const onClickOutside = (e) => {
  if (rootRef.value && !rootRef.value.contains(e.target)) {
    if (exactMatch.value) {
      selectExisting(exactMatch.value);
    } else if (search.value.trim() && !props.modelValue) {
      emit('update:manualValue', search.value.trim());
    }
    closeDropdown();
  }
};

onMounted(() => document.addEventListener('click', onClickOutside));
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside));

const isNewCategory = computed(() => !!props.manualValue && !props.modelValue);
</script>

<template>
  <div ref="rootRef" class="searchable-select">
    <div class="searchable-input-wrap" :class="{ open: isOpen, 'is-new': isNewCategory }">
      <span class="search-icon">🔍</span>
      <input
        type="text"
        class="searchable-input"
        :value="search"
        :placeholder="placeholder"
        :required="required && !modelValue && !manualValue"
        autocomplete="off"
        @input="onInput"
        @focus="onFocus"
        @keydown="onKeydown"
      />
      <span v-if="isNewCategory" class="new-badge">Baru</span>
      <button type="button" class="toggle-btn" @click="isOpen ? closeDropdown() : openDropdown()" tabindex="-1">
        {{ isOpen ? '▲' : '▼' }}
      </button>
    </div>

    <div v-if="isOpen" class="searchable-dropdown">
      <div v-if="allItems.length === 0" class="dropdown-empty">
        Ketik nama kategori untuk menambahkan RAB baru
      </div>
      <button
        v-for="(item, idx) in allItems"
        :key="item.type === 'existing' ? item.data[valueKey] : 'new-' + item.data.label"
        type="button"
        class="dropdown-item"
        :class="{ highlighted: idx === highlightedIndex, 'dropdown-item--new': item.type === 'new' }"
        @mousedown.prevent
        @click="item.type === 'existing' ? selectExisting(item.data) : selectNew()"
      >
        <template v-if="item.type === 'existing'">
          <span class="item-label">{{ item.data[labelKey] }}</span>
          <span v-if="item.data.plafon_dana != null" class="item-meta">
            Plafon: Rp {{ Number(item.data.plafon_dana).toLocaleString('id-ID') }}
          </span>
        </template>
        <template v-else>
          <span class="item-label">➕ Buat kategori baru: <strong>{{ item.data.label }}</strong></span>
        </template>
      </button>
    </div>

    <p v-if="isNewCategory" class="hint-new">
      Kategori "<strong>{{ manualValue }}</strong>" akan dibuat otomatis sebagai pos RAB baru.
    </p>
    <p v-else-if="selectedOption" class="hint-existing">
      Menggunakan kategori RAB yang sudah ada.
    </p>
  </div>
</template>

<style scoped>
.searchable-select {
  position: relative;
  width: 100%;
}

.searchable-input-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: white;
  padding: 0 0.75rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.searchable-input-wrap.open,
.searchable-input-wrap:focus-within {
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.searchable-input-wrap.is-new {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.search-icon {
  font-size: 0.9rem;
  opacity: 0.5;
  flex-shrink: 0;
}

.searchable-input {
  flex: 1;
  border: none;
  outline: none;
  padding: 0.7rem 0;
  font-size: 0.95rem;
  background: transparent;
  min-width: 0;
}

.new-badge {
  font-size: 0.7rem;
  font-weight: 700;
  background: #d1fae5;
  color: #059669;
  padding: 0.15rem 0.5rem;
  border-radius: 99px;
  flex-shrink: 0;
}

.toggle-btn {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 0.7rem;
  padding: 0.25rem;
  flex-shrink: 0;
}

.searchable-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  max-height: 220px;
  overflow-y: auto;
  z-index: 100;
}

.dropdown-empty {
  padding: 1rem;
  color: #9ca3af;
  font-size: 0.85rem;
  text-align: center;
}

.dropdown-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  width: 100%;
  padding: 0.65rem 1rem;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.dropdown-item:hover,
.dropdown-item.highlighted {
  background: #f1f5f9;
}

.dropdown-item--new {
  border-top: 1px dashed #e5e7eb;
  color: #059669;
}

.item-label {
  font-size: 0.9rem;
  color: #1e293b;
}

.item-meta {
  font-size: 0.75rem;
  color: #94a3b8;
}

.hint-new,
.hint-existing {
  margin: 0.4rem 0 0;
  font-size: 0.78rem;
  color: #64748b;
}

.hint-new strong {
  color: #059669;
}
</style>
