// composables/useNotification.js
// Global notification system: Toast + Confirm dialog
import { ref, reactive } from 'vue';

// ─── TOAST ────────────────────────────────────────────────────────────────────
const toasts = ref([]);
let toastIdCounter = 0;

const removeToast = (id, delay = 400) => {
  const toast = toasts.value.find(t => t.id === id);
  if (toast) toast.visible = false;
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }, delay);
};

export const useToast = () => {
  const show = (messageOrOpts, type = 'info', duration = 3500) => {
    const id = ++toastIdCounter;
    const opts = typeof messageOrOpts === 'string'
      ? { message: messageOrOpts, type, duration }
      : { type, duration, ...messageOrOpts };

    toasts.value.push({
      id,
      message: opts.message || '',
      title: opts.title || '',
      subtitle: opts.subtitle || '',
      type: opts.type || type,
      visible: true,
      persistent: !!opts.persistent,
    });

    const dur = opts.duration ?? duration;
    if (dur > 0 && !opts.persistent) {
      setTimeout(() => removeToast(id), dur);
    }
    return id;
  };

  const loading = (messageOrOpts) => {
    const opts = typeof messageOrOpts === 'string'
      ? { message: messageOrOpts }
      : messageOrOpts;
    return show({
      ...opts,
      type: 'loading',
      duration: 0,
      persistent: true,
    });
  };

  const dismiss = (id) => {
    if (id) removeToast(id);
  };

  return {
    toasts,
    success: (msg, duration) => show(msg, 'success', duration),
    error:   (msg, duration) => show(msg, 'error', duration),
    info:    (msg, duration) => show(msg, 'info', duration),
    warning: (msg, duration) => show(msg, 'warning', duration),
    loading,
    dismiss,
  };
};

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────
const confirmState = reactive({
  visible: false,
  title: '',
  message: '',
  confirmText: 'Ya, Lanjutkan',
  cancelText: 'Batal',
  type: 'danger', // 'danger' | 'warning' | 'info'
  resolve: null,
});

export const useConfirm = () => {
  const confirm = ({ title, message, confirmText = 'Ya, Lanjutkan', cancelText = 'Batal', type = 'danger' }) => {
    return new Promise((resolve) => {
      confirmState.visible = true;
      confirmState.title = title;
      confirmState.message = message;
      confirmState.confirmText = confirmText;
      confirmState.cancelText = cancelText;
      confirmState.type = type;
      confirmState.resolve = resolve;
    });
  };

  const handleConfirm = () => {
    confirmState.visible = false;
    confirmState.resolve?.(true);
  };

  const handleCancel = () => {
    confirmState.visible = false;
    confirmState.resolve?.(false);
  };

  return { confirmState, confirm, handleConfirm, handleCancel };
};

// ─── PROMPT DIALOG ────────────────────────────────────────────────────────────
const promptState = reactive({
  visible: false,
  title: '',
  message: '',
  value: '',
  inputType: 'text',
  placeholder: '',
  confirmText: 'Simpan',
  cancelText: 'Batal',
  resolve: null,
});

export const usePrompt = () => {
  const prompt = ({
    title = 'Masukkan Data',
    message = '',
    defaultValue = '',
    inputType = 'text',
    placeholder = '',
    confirmText = 'Simpan',
    cancelText = 'Batal',
  } = {}) => {
    return new Promise((resolve) => {
      promptState.visible = true;
      promptState.title = title;
      promptState.message = message;
      promptState.value = defaultValue;
      promptState.inputType = inputType;
      promptState.placeholder = placeholder;
      promptState.confirmText = confirmText;
      promptState.cancelText = cancelText;
      promptState.resolve = resolve;
    });
  };

  const handlePromptConfirm = () => {
    const val = promptState.value;
    promptState.visible = false;
    promptState.resolve?.(val);
  };

  const handlePromptCancel = () => {
    promptState.visible = false;
    promptState.resolve?.(null);
  };

  return { promptState, prompt, handlePromptConfirm, handlePromptCancel };
};
