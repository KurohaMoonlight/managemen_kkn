<script setup>
import { ref, watch, computed, onMounted, nextTick } from 'vue';
import {
  formatCurrencyInput,
  formatRupiah,
  normalizeCurrencyDigits,
} from '../composables/useCurrencyInput.js';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  placeholder: { type: String, default: '0' },
  required: { type: Boolean, default: false },
  inputClass: { type: String, default: '' },
  inputStyle: { type: [String, Object], default: '' },
  maxDigits: { type: Number, default: 12 },
  autofocus: { type: Boolean, default: false },
  showHint: { type: Boolean, default: true },
});

const emit = defineEmits(['update:modelValue', 'keydown']);

const inputRef = ref(null);
const isFocused = ref(false);
const internalDigits = ref('');
const displayValue = ref('');

const livePreview = computed(() => {
  if (!internalDigits.value) return '';
  return formatRupiah(internalDigits.value);
});

const applyDigits = (raw) => {
  const digits = normalizeCurrencyDigits(raw, props.maxDigits);
  internalDigits.value = digits;
  displayValue.value = formatCurrencyInput(digits);
  emit('update:modelValue', digits);

  nextTick(() => {
    if (inputRef.value) {
      const pos = displayValue.value.length;
      inputRef.value.setSelectionRange(pos, pos);
    }
  });
};

const syncFromProps = () => {
  if (isFocused.value) return;
  const digits = normalizeCurrencyDigits(props.modelValue, props.maxDigits);
  internalDigits.value = digits;
  displayValue.value = formatCurrencyInput(digits);
};

watch(() => props.modelValue, syncFromProps, { immediate: true });

const isAllSelected = (el) =>
  el.selectionStart === 0 && el.selectionEnd === displayValue.value.length && displayValue.value.length > 0;

const onFocus = () => {
  isFocused.value = true;
  internalDigits.value = normalizeCurrencyDigits(props.modelValue, props.maxDigits);
  displayValue.value = formatCurrencyInput(internalDigits.value);
};

const onBlur = () => {
  isFocused.value = false;
  applyDigits(internalDigits.value);
};

const onKeyDown = (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const el = e.target;

  if (/^\d$/.test(e.key)) {
    e.preventDefault();
    const base = isAllSelected(el) ? '' : internalDigits.value;
    if (base.length >= props.maxDigits) return;
    applyDigits(base + e.key);
    return;
  }

  if (e.key === 'Backspace') {
    e.preventDefault();
    if (isAllSelected(el) || !internalDigits.value) {
      applyDigits('');
    } else {
      applyDigits(internalDigits.value.slice(0, -1));
    }
    return;
  }

  if (e.key === 'Delete') {
    e.preventDefault();
    if (isAllSelected(el)) {
      applyDigits('');
    } else {
      applyDigits(internalDigits.value.slice(0, -1));
    }
    return;
  }

  // Blokir karakter selain navigasi
  const allowed = ['Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', 'Escape'];
  if (e.key.length === 1 && !allowed.includes(e.key)) {
    e.preventDefault();
  }
};

const onPaste = (e) => {
  e.preventDefault();
  const pasted = e.clipboardData?.getData('text') || '';
  const el = e.target;
  const base = isAllSelected(el) ? '' : internalDigits.value;
  applyDigits(base + pasted);
};

// Cegah input langsung yang bisa mengacaukan format
const onBeforeInput = (e) => {
  if (e.inputType === 'insertFromPaste') return;
  e.preventDefault();
};

const handleKeyDown = (e) => {
  onKeyDown(e);
  emit('keydown', e);
};

onMounted(() => {
  if (props.autofocus) {
    nextTick(() => inputRef.value?.focus());
  }
});
</script>

<template>
  <div class="currency-field">
    <div class="currency-input-wrap">
      <span class="currency-prefix">Rp</span>
      <input
        ref="inputRef"
        type="text"
        inputmode="numeric"
        class="currency-input"
        :class="inputClass"
        :style="inputStyle"
        :value="displayValue"
        :placeholder="placeholder"
        :required="required && !modelValue"
        autocomplete="off"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="handleKeyDown"
        @paste="onPaste"
        @beforeinput="onBeforeInput"
      />
    </div>
    <p v-if="showHint && (isFocused || internalDigits)" class="currency-hint">
      <template v-if="internalDigits">= {{ livePreview }}</template>
      <template v-else>Ketik angka saja, contoh: 120000 untuk Rp 120.000</template>
    </p>
  </div>
</template>

<style scoped>
.currency-field {
  width: 100%;
}

.currency-input-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  padding: 0 0.75rem;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.currency-input-wrap:focus-within {
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.currency-prefix {
  font-size: 0.9rem;
  font-weight: 600;
  color: #64748b;
  flex-shrink: 0;
  user-select: none;
}

.currency-input {
  flex: 1;
  border: none;
  outline: none;
  padding: 0.7rem 0;
  font-size: 0.95rem;
  background: transparent;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}

.currency-hint {
  margin: 0.35rem 0 0;
  font-size: 0.78rem;
  color: #64748b;
  font-weight: 500;
}
</style>
