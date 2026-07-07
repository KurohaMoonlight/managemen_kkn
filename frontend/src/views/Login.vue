<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const nim = ref('');
const password = ref('');
const errorMsg = ref('');
const loading = ref(false);

const roleToPath = {
  superadmin: '/superadmin',
  admin: '/admin',
  mahasiswa: '/mahasiswa'
};

const handleLogin = async () => {
  loading.value = true;
  errorMsg.value = '';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nim: nim.value, password: password.value })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login gagal.');

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    window.location.href = roleToPath[data.user.role] || '/login';
  } catch (err) {
    errorMsg.value = err.message;
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="login-container">
    <div class="login-card animate-fade-in">
      <div class="login-header">
        <div class="logo-icon">🎓</div>
        <h2>Portal KKN</h2>
        <p>Silakan masuk ke akun Anda</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="nim">NIM / Username</label>
          <input type="text" id="nim" v-model="nim" required placeholder="Masukkan NIM Anda" autocomplete="username" />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" v-model="password" required placeholder="••••••••" autocomplete="current-password" />
        </div>

        <div v-if="errorMsg" class="error-message">
          {{ errorMsg }}
        </div>

        <button type="submit" class="btn btn-primary login-btn" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? 'Memproses...' : 'Masuk' }}
        </button>
      </form>

      <p class="footer-note">Sistem Manajemen KKN © 2026</p>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  background-color: #EEEFE0;
  background-image: radial-gradient(circle at top right, #D1D8BE 0%, transparent 40%),
                    radial-gradient(circle at bottom left, #A7C1A8 0%, transparent 40%);
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: 3rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  background: white;
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(129, 154, 145, 0.2);
  border: 1px solid rgba(167, 193, 168, 0.3);
}

.login-header { text-align: center; }

.logo-icon { font-size: 3.5rem; margin-bottom: 1rem; }

.login-header h2 {
  margin: 0 0 0.5rem;
  font-family: var(--font-display, sans-serif);
  font-size: 2rem;
  color: #202120;
  font-weight: 700;
}

.login-header p { margin: 0; color: #819A91; font-size: 1rem; }

.login-form { display: flex; flex-direction: column; gap: 1.5rem; }

.form-group { display: flex; flex-direction: column; gap: 0.5rem; }

.form-group label { font-size: 0.9rem; font-weight: 600; color: #202120; }

.form-group input {
  padding: 0.85rem 1rem;
  border-radius: 10px;
  border: 1.5px solid #D1D8BE;
  background: #fdfdfd;
  color: #202120;
  font-family: inherit;
  transition: all 0.3s ease;
  font-size: 1rem;
}

.form-group input:focus {
  outline: none;
  border-color: #819A91;
  box-shadow: 0 0 0 4px rgba(129, 154, 145, 0.15);
}

.error-message {
  padding: 0.85rem;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  font-size: 0.9rem;
  text-align: center;
  font-weight: 500;
}

.login-btn {
  width: 100%;
  justify-content: center;
  padding: 0.85rem;
  margin-top: 0.5rem;
  background: #819A91;
  color: white;
  border-radius: 10px;
  font-size: 1.1rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(129, 154, 145, 0.3);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.login-btn:hover:not(:disabled) {
  background: #6a8279;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(129, 154, 145, 0.4);
}

.login-btn:disabled { background: #A7C1A8; cursor: not-allowed; transform: none; }

.spinner {
  width: 18px; height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s infinite linear;
  display: inline-block;
}

.footer-note {
  text-align: center;
  font-size: 0.8rem;
  color: #aaa;
  margin: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
