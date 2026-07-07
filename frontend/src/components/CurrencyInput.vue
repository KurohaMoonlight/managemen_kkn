<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import {
  formatCurrencyInput,
  countDigitsBefore,
  cursorPosFromDigitIndex,
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
});

const emit = defineEmits(['update:modelValue', 'keydown']);

const inputRef = ref(null);
const isFocused = ref(false);
const displayValue = ref('');

const toFormatted = (val) => formatCurrencyInput(normalizeCurrencyDigits(val, props.maxDigits));

const syncFromModel = () => {
  if (isFocused.value) return;
  displayValue.value = toFormatted(props.modelValue);
};

watch(() => props.modelValue, syncFromModel, { immediate: true });

const onFocus = () => {
  isFocused.value = true;
  displayValue.value = toFormatted(props.modelValue);
};

const onInput = (e) => {
  const el = e.target;
  const cursorPos = el.selectionStart ?? 0;
  const digitsBeforeCursor = countDigitsBefore(el.value, cursorPos);

  const digits = normalizeCurrencyDigits(el.value, props.maxDigits);
  const formatted = formatCurrencyInput(digits);

  displayValue.value = formatted;
  emit('update:modelValue', digits);

  nextTick(() => {
    if (!inputRef.value) return;
    const newPos = cursorPosFromDigitIndex(formatted, Math.min(digitsBeforeCursor, digits.length));
    inputRef.value.setSelectionRange(newPos, newPos);
  });
};

const onBlur = () => {
  isFocused.value = false;
  const digits = normalizeCurrencyDigits(displayValue.value, props.maxDigits);
  displayValue.value = formatCurrencyInput(digits);
  emit('update:modelValue', digits);
};

onMounted(() => {
  if (props.autofocus) {
    nextTick(() => inputRef.value?.focus());
  }
});
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
      @focus="onFocus"
      @input="onInput"
      @blur="onBlur"
      @keydown="$emit('keydown', $event)"
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
  font-variant-numeric: tabular-nums;
}
</style>
