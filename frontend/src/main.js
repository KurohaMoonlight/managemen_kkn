import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
  const response = await originalFetch(...args);
  
  // Jika token invalid/expired (401 atau 403) pada API terproteksi, otomatis tendang ke login
  if ((response.status === 401 || response.status === 403) && url.includes('/api/') && !url.includes('/api/login') && !url.includes('/api/verify-password')) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
  
  return response;
};

const app = createApp(App)
app.use(router)
app.component('QuillEditor', QuillEditor)
app.mount('#app')
