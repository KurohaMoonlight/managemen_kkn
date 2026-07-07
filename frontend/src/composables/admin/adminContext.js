import { ref } from 'vue';

export const adminToken = localStorage.getItem('token');
export const currentAdminUser = JSON.parse(localStorage.getItem('user') || '{}');

export const users = ref([]);
export const poskoData = ref({});

export async function fetchUsers(searchQuery = '') {
  const url = searchQuery
    ? `/api/users?search=${encodeURIComponent(searchQuery)}`
    : '/api/users';
  const res = await fetch(url, { headers: { Authorization: `Bearer ${adminToken}` } });
  if (res.ok) users.value = await res.json();
  return users.value;
}

export async function fetchPoskoSettings() {
  const res = await fetch('/api/posko', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (res.ok) {
    poskoData.value = await res.json();
    return poskoData.value;
  }
  return null;
}
