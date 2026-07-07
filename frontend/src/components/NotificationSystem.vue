<template>
  <!-- ─── TOAST STACK ─────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="[
            'toast--' + toast.type,
            { 'toast--hiding': !toast.visible, 'toast--rich': toast.type === 'loading' || toast.title }
          ]"
        >
          <!-- Loading / rich toast -->
          <template v-if="toast.type === 'loading'">
            <div class="toast-loader" aria-hidden="true">
              <div class="toast-spinner-ring"></div>
              <span class="toast-spinner-icon">☁️</span>
            </div>
            <div class="toast-content">
              <strong class="toast-title">{{ toast.title || 'Memproses...' }}</strong>
              <p class="toast-message">{{ toast.message }}</p>
              <p v-if="toast.subtitle" class="toast-subtitle">{{ toast.subtitle }}</p>
              <div class="toast-progress-track">
                <div class="toast-progress-bar"></div>
              </div>
            </div>
          </template>

          <!-- Standard toast -->
          <template v-else>
            <span class="toast-icon">{{ icons[toast.type] || 'ℹ️' }}</span>
            <div class="toast-content toast-content--inline">
              <strong v-if="toast.title" class="toast-title toast-title--inline">{{ toast.title }}</strong>
              <span class="toast-message">{{ toast.message }}</span>
            </div>
            <button class="toast-close" @click="dismissToast(toast.id)" aria-label="Tutup">✕</button>
          </template>
        </div>
      </TransitionGroup>
    </div>

    <!-- ─── CONFIRM MODAL ────────────────────────────────────────────────── -->
    <Transition name="modal-fade">
      <div v-if="confirmState.visible" class="modal-backdrop" @click.self="handleCancel">
        <div class="confirm-modal" :class="'confirm-modal--' + confirmState.type">
          <div class="confirm-icon-wrap">
            <div class="confirm-icon" :class="'icon-' + confirmState.type">
              {{ confirmIcons[confirmState.type] }}
            </div>
          </div>
          <h3 class="confirm-title">{{ confirmState.title }}</h3>
          <p class="confirm-message">{{ confirmState.message }}</p>
          <div class="confirm-actions">
            <button class="confirm-btn confirm-btn--cancel" @click="handleCancel">
              {{ confirmState.cancelText }}
            </button>
            <button
              class="confirm-btn"
              :class="'confirm-btn--' + confirmState.type"
              @click="handleConfirm"
            >
              {{ confirmState.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ─── PROMPT MODAL ──────────────────────────────────────────────────── -->
    <Transition name="modal-fade">
      <div v-if="promptState.visible" class="modal-backdrop" @click.self="handlePromptCancel">
        <div class="prompt-modal">
          <div class="prompt-icon-wrap">
            <div class="prompt-icon">✏️</div>
          </div>
          <h3 class="confirm-title">{{ promptState.title }}</h3>
          <p v-if="promptState.message" class="confirm-message prompt-message">{{ promptState.message }}</p>
          <input
            v-model="promptState.value"
            :type="promptState.inputType"
            class="prompt-input"
            :placeholder="promptState.placeholder"
            autofocus
            @keydown.enter="handlePromptConfirm"
            @keydown.escape="handlePromptCancel"
          />
          <div class="confirm-actions">
            <button class="confirm-btn confirm-btn--cancel" @click="handlePromptCancel">
              {{ promptState.cancelText }}
            </button>
            <button class="confirm-btn confirm-btn--info" @click="handlePromptConfirm">
              {{ promptState.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useToast, useConfirm, usePrompt } from '../composables/useNotification.js';

const { toasts } = useToast();
const { confirmState, handleConfirm, handleCancel } = useConfirm();
const { promptState, handlePromptConfirm, handlePromptCancel } = usePrompt();

const icons = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
};

const confirmIcons = {
  danger: '🗑️',
  warning: '⚠️',
  info: 'ℹ️',
};

const dismissToast = (id) => {
  const toast = toasts.value.find(t => t.id === id);
  if (toast) toast.visible = false;
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }, 400);
};
</script>

<style scoped>
/* ─── TOAST ─────────────────────────────────────────────────────────────────── */
.toast-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  pointer-events: none;
  max-width: 400px;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 0.9rem 1.1rem;
  border-radius: 16px;
  font-size: 0.88rem;
  font-weight: 500;
  pointer-events: all;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.22);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: white;
  max-width: 400px;
  line-height: 1.45;
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.toast--rich {
  align-items: center;
  padding: 1.1rem 1.25rem;
}

.toast--success { background: linear-gradient(135deg, #10b981ee, #059669f5); }
.toast--error   { background: linear-gradient(135deg, #ef4444ee, #dc2626f5); }
.toast--info    { background: linear-gradient(135deg, #64748bee, #475569f5); }
.toast--warning { background: linear-gradient(135deg, #f59e0bee, #d97706f5); }

.toast--loading {
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 55%, #f1f5f9 100%);
  color: #0f172a;
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow:
    0 20px 50px rgba(15, 23, 42, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
  min-width: 320px;
}

.toast--hiding {
  opacity: 0;
  transform: translateX(24px) scale(0.96);
  pointer-events: none;
}

.toast-icon {
  font-size: 1.15rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-content--inline {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.toast-title {
  display: block;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-bottom: 0.25rem;
  color: inherit;
}

.toast--loading .toast-title {
  color: #0f172a;
}

.toast-title--inline {
  margin-bottom: 0;
  font-size: 0.88rem;
}

.toast-message {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 500;
  opacity: 0.95;
}

.toast--loading .toast-message {
  color: #475569;
  font-weight: 500;
}

.toast-subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.45;
}

.toast-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.15rem;
  line-height: 1;
  transition: color 0.2s, transform 0.2s;
  flex-shrink: 0;
  margin-top: 0.05rem;
}

.toast-close:hover {
  color: white;
  transform: scale(1.1);
}

/* Loading spinner */
.toast-loader {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.toast-spinner-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 3px solid #e2e8f0;
  border-top-color: #4285f4;
  border-right-color: #34a853;
  animation: toast-spin 0.9s linear infinite;
}

.toast-spinner-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
}

@keyframes toast-spin {
  to { transform: rotate(360deg); }
}

/* Indeterminate progress bar */
.toast-progress-track {
  margin-top: 0.75rem;
  height: 4px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
}

.toast-progress-bar {
  height: 100%;
  width: 40%;
  border-radius: 999px;
  background: linear-gradient(90deg, #4285f4, #34a853, #fbbc04, #4285f4);
  background-size: 200% 100%;
  animation: toast-progress 1.6s ease-in-out infinite;
}

@keyframes toast-progress {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(320%); }
}

/* TransitionGroup */
.toast-enter-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-leave-active { transition: all 0.32s ease; }
.toast-enter-from   { opacity: 0; transform: translateX(48px) scale(0.94); }
.toast-leave-to     { opacity: 0; transform: translateX(32px) scale(0.92); }

/* ─── CONFIRM MODAL ──────────────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  z-index: 99998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.confirm-modal {
  background: white;
  border-radius: 20px;
  padding: 2rem;
  max-width: 400px;
  width: 100%;
  text-align: center;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.25);
  border-top: 4px solid transparent;
}
.confirm-modal--danger  { border-top-color: #ef4444; }
.confirm-modal--warning { border-top-color: #f59e0b; }
.confirm-modal--info    { border-top-color: #6b8078; }

.confirm-icon-wrap { display: flex; justify-content: center; margin-bottom: 1rem; }
.confirm-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
}
.icon-danger  { background: #fee2e2; }
.icon-warning { background: #fef3c7; }
.icon-info    { background: #ede9fe; }

.confirm-title {
  margin: 0 0 0.5rem;
  font-size: 1.2rem;
  font-weight: 700;
  color: #111827;
}

.confirm-message {
  margin: 0 0 1.75rem;
  font-size: 0.9rem;
  color: #6b7280;
  line-height: 1.6;
}

.confirm-actions {
  display: flex;
  gap: 0.75rem;
}

.confirm-btn {
  flex: 1;
  padding: 0.7rem 1rem;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.confirm-btn--cancel {
  background: #f3f4f6;
  color: #374151;
}
.confirm-btn--cancel:hover { background: #e5e7eb; }

.confirm-btn--danger  { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; }
.confirm-btn--warning { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }
.confirm-btn--info    { background: linear-gradient(135deg, #6b8078, var(--color-primary)); color: white; }

.confirm-btn--danger:hover  { filter: brightness(1.08); transform: translateY(-1px); }
.confirm-btn--warning:hover { filter: brightness(1.08); transform: translateY(-1px); }
.confirm-btn--info:hover    { filter: brightness(1.08); transform: translateY(-1px); }

.modal-fade-enter-active { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-fade-leave-active { transition: all 0.2s ease; }
.modal-fade-enter-from { opacity: 0; }
.modal-fade-enter-from .confirm-modal { transform: scale(0.9) translateY(20px); }
.modal-fade-leave-to { opacity: 0; }
.modal-fade-leave-to .confirm-modal { transform: scale(0.95); }

/* ─── PROMPT MODAL ─────────────────────────────────────────────────────────── */
.prompt-modal {
  background: white;
  border-radius: 20px;
  padding: 2rem;
  max-width: 420px;
  width: 100%;
  text-align: center;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.25);
  border-top: 4px solid var(--color-primary, #6b8078);
}

.prompt-icon-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.prompt-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #ede9fe;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.prompt-message {
  white-space: pre-line;
  text-align: left;
  margin-bottom: 1rem !important;
}

.prompt-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  font-size: 1rem;
  margin-bottom: 1.5rem;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.prompt-input:focus {
  border-color: var(--color-primary, #6b8078);
  box-shadow: 0 0 0 3px rgba(107, 128, 120, 0.15);
}

@media (max-width: 480px) {
  .toast-container {
    left: 1rem;
    right: 1rem;
    bottom: 1rem;
    max-width: none;
  }
  .toast, .toast--loading {
    min-width: 0;
    max-width: none;
  }
}
</style>
