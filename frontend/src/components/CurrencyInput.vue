<script setup>
import { ref, watch, nextTick } from 'vue';
import { formatCurrencyInput, parseCurrencyInput } from '../composables/useCurrencyInput.js';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  placeholder: { type: String, default: '0' },
  required: { type: Boolean, default: false },
  inputClass: { type: String, default: '' },
  inputStyle: { type: [String, Object], default: '' },
  maxDigits: { type: Number, default: 12 },
});

const emit = defineEmits(['update:modelValue']);

const inputRef = ref(null);

const getDigits = () => {
  const raw = parseCurrencyInput(props.modelValue);
  if (!raw || raw === '0') return '';
  return raw;
};

const displayValue = ref(formatCurrencyInput(getDigits()));

watch(() => props.modelValue, (val) => {
  const digits = parseCurrencyInput(val);
  const normalized = !digits || digits === '0' ? '' : digits;
  displayValue.value = formatCurrencyInput(normalized);
});

const onInput = (e) => {
  const el = e.target;
  const cursorPos = el.selectionStart ?? 0;
  const oldValue = el.value;
  const oldLen = oldValue.length;

  let digits = parseCurrencyInput(el.value);
  if (digits.length > props.maxDigits) {
    digits = digits.slice(0, props.maxDigits);
  }

  const formatted = formatCurrencyInput(digits);
  displayValue.value = formatted;
  emit('update:modelValue', digits);

  nextTick(() => {
    if (!inputRef.value) return;
    // Hitung posisi kursor setelah reformat (tambah/kurang titik pemisah ribuan)
    const digitsBeforeCursor = parseCurrencyInput(oldValue.slice(0, cursorPos)).length;
    let newPos = 0;
    let digitCount = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (formatted[i] !== '.') digitCount++;
      if (digitCount >= digitsBeforeCursor) {
        newPos = i + 1;
        break;
      }
    }
    if (digitsBeforeCursor === 0) newPos = 0;
    if (digitsBeforeCursor >= digits.length) newPos = formatted.length;
    inputRef.value.setSelectionRange(newPos, newPos);
  });
};

const onBlur = () => {
  const digits = parseCurrencyInput(props.modelValue);
  displayValue.value = formatCurrencyInput(digits);
};
</script>

<template>
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
      @input="onInput"
      @blur="onBlur"
    />
  </div>
</template>

<style scoped>
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
}
</style>
