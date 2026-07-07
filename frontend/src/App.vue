<script setup>
import NotificationSystem from './components/NotificationSystem.vue';
</script>

<template>
  <router-view />
  <NotificationSystem />
</template>

<style>
/* Global button styles that can be reused across views */
.btn {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1rem;
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: linear-gradient(135deg, var(--color-primary) 0%, #6B8078 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(129, 154, 145, 0.4);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(129, 154, 145, 0.6);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s infinite linear;
}
</style>
