<script setup>
import { formatCurrencyInput, parseCurrencyInput } from '../composables/useCurrencyInput.js';

defineProps({
  modelValue: { type: [String, Number], default: '' },
  placeholder: { type: String, default: 'Rp 0' },
  required: { type: Boolean, default: false },
  inputClass: { type: String, default: '' },
  inputStyle: { type: [String, Object], default: '' },
});

const emit = defineEmits(['update:modelValue']);

const onInput = (e) => {
  emit('update:modelValue', parseCurrencyInput(e.target.value));
};
</script>

<template>
  <input
    type="text"
    inputmode="numeric"
    :value="formatCurrencyInput(modelValue)"
    :placeholder="placeholder"
    :required="required && !modelValue"
    :class="inputClass"
    :style="inputStyle"
    autocomplete="off"
    @input="onInput"
  />
</template>
