import { createRouter, createWebHistory } from 'vue-router';
import Login from '../views/Login.vue';
import AdminDashboard from '../views/AdminDashboard.vue';
import MahasiswaDashboard from '../views/MahasiswaDashboard.vue';
import SuperadminDashboard from '../views/SuperadminDashboard.vue';
import BendaharaDashboard from '../views/BendaharaDashboard.vue';
import BlockedPosko from '../views/BlockedPosko.vue';
import PddDashboard from '../views/PddDashboard.vue';
import Maintenance from '../views/Maintenance.vue';

import SuratGenerator from '../components/SuratGenerator.vue';

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/maintenance',
    name: 'Maintenance',
    component: Maintenance
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/blocked',
    name: 'BlockedPosko',
    component: BlockedPosko,
    meta: { requiresAuth: true }
  },
  {
    path: '/superadmin',
    name: 'SuperadminDashboard',
    component: SuperadminDashboard,
    meta: { requiresAuth: true, role: 'superadmin' }
  },
  {
    path: '/admin',
    name: 'AdminDashboard',
    component: AdminDashboard,
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/mahasiswa',
    name: 'MahasiswaDashboard',
    component: MahasiswaDashboard,
    meta: { requiresAuth: true, role: ['mahasiswa', 'admin'] }
  },
  {
    path: '/pdd',
    name: 'PddDashboard',
    component: PddDashboard,
    meta: { requiresAuth: true, role: ['mahasiswa', 'admin'] }
  },
  {
    path: '/bendahara',
    name: 'BendaharaDashboard',
    component: BendaharaDashboard,
    meta: { requiresAuth: true, role: ['mahasiswa', 'admin'] }
  },
  {
    path: '/surat-generator',
    name: 'SuratGenerator',
    component: SuratGenerator,
    meta: { requiresAuth: true, role: ['mahasiswa', 'admin', 'superadmin'] }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Navigation Guard
router.beforeEach(async (to, from, next) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isSuperadmin = user && user.role === 'superadmin';

  // 1. Cek Maintenance Mode
  try {
    const res = await fetch('/api/maintenance');
    const data = await res.json();
    if (data.is_maintenance) {
      if (isSuperadmin) {
        if (to.path === '/maintenance') return next('/');
      } else {
        if (to.path !== '/maintenance') return next('/maintenance');
      }
    } else {
      if (to.path === '/maintenance') return next('/');
    }
  } catch (error) {
    console.error('Gagal mengecek status maintenance', error);
  }

  // 2. Lanjut ke pengecekan otentikasi

  const roleToPath = {
    superadmin: '/superadmin',
    admin: '/admin',
    mahasiswa: '/mahasiswa'
  };

  if (to.meta.requiresAuth && !token) {
    next('/login');
  } else if (to.meta.requiresAuth) {
    // If user is not superadmin and has no posko, redirect to blocked
    if (user?.role !== 'superadmin' && (user?.posko_id === null || user?.posko_id === undefined) && to.path !== '/blocked') {
      return next('/blocked');
    }
    
    // If user has posko but trying to access blocked page, send them to their dashboard
    if (to.path === '/blocked' && user?.posko_id !== null && user?.posko_id !== undefined) {
      return next(roleToPath[user?.role] || '/login');
    }

    if (to.meta.role) {
      const roles = Array.isArray(to.meta.role) ? to.meta.role : [to.meta.role];
      if (!roles.includes(user?.role)) {
        next(roleToPath[user?.role] || '/login');
      } else {
        next();
      }
    } else {
      next(); // Blocked page doesn't have role requirement
    }
  } else if (to.path === '/login' && token && user?.role) {
    next(roleToPath[user.role] || '/login');
  } else {
    next();
  }
});

export default router;
