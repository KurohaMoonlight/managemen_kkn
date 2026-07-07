<script setup>
import { ref, onMounted, watch } from 'vue';

const props = defineProps({
  token: { type: String, required: true },
  prokerData: { type: Object, required: true }
});

const tasks = ref([]);
const newTaskTitle = ref('');
const isSubmittingTask = ref(false);

const fetchTasks = async () => {
  if (!props.prokerData?.id) return;
  try {
    const res = await fetch(`/api/mahasiswa/proker/tasks?pic_id=${props.prokerData.id}`, {
      headers: { 'Authorization': `Bearer ${props.token}` }
    });
    tasks.value = await res.json();
  } catch (err) {}
};

watch(() => props.prokerData, () => {
  fetchTasks();
});

onMounted(() => {
  fetchTasks();
});

const createTask = async () => {
  if (!newTaskTitle.value.trim() || !props.prokerData) return;
  isSubmittingTask.value = true;
  try {
    const res = await fetch('/api/mahasiswa/proker/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${props.token}`
      },
      body: JSON.stringify({ pic_id: props.prokerData.id, judul: newTaskTitle.value, deskripsi: '' })
    });
    const task = await res.json();
    tasks.value.unshift(task);
    newTaskTitle.value = '';
  } catch (err) {}
  isSubmittingTask.value = false;
};

const updateTaskStatus = async (task, newStatus) => {
  const oldStatus = task.status;
  task.status = newStatus; // optimistic update
  try {
    await fetch(`/api/mahasiswa/proker/tasks/${task.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${props.token}`
      },
      body: JSON.stringify({ status: newStatus })
    });
  } catch (err) {
    task.status = oldStatus; // revert
  }
};
</script>

<template>
  <div class="status-card kanban-card">
    <h2 style="text-align: left; border-bottom: 2px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1rem; color: var(--text-main);">
      📋 Proker: {{ prokerData.proker }}
      <span style="font-size: 0.9rem; font-weight: normal; color: var(--text-muted);">(PIC: {{ prokerData.nama_pic }})</span>
    </h2>
    
    <div class="proker-members" v-if="prokerData.members && prokerData.members.length > 0" style="margin-bottom: 1.5rem; text-align: left;">
      <h4 style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: var(--text-muted);">Anggota Kelompok:</h4>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        <span v-for="member in prokerData.members" :key="member.id" style="background: #f1f5f9; padding: 0.3rem 0.6rem; border-radius: 20px; font-size: 0.85rem; color: #475569; border: 1px solid #cbd5e1;">
          👤 {{ member.nama_lengkap }} ({{ member.nim }})
        </span>
      </div>
    </div>
    
    <div class="kanban-add" style="display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap;">
      <input type="text" v-model="newTaskTitle" placeholder="Tambah tugas baru..." @keyup.enter="createTask" class="form-input" style="flex:1; min-width: 200px; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--border-color);" />
      <button class="btn-scan" style="padding: 0.75rem 1.5rem; margin-top:0;" @click="createTask" :disabled="isSubmittingTask">Tambah</button>
    </div>

    <div class="kanban-board-wrapper" style="overflow-x: auto; padding-bottom: 1rem; margin-top: 1rem; width: 100%;">
      <div class="kanban-board">
        <div class="kanban-col" style="background: #f8fafc; border-radius: 12px; padding: 1rem; border: 1px solid var(--border-color);">
          <h3 style="margin: 0 0 1rem; color: #64748b; font-size: 1rem;">To Do</h3>
        <div v-for="task in tasks.filter(t => t.status === 'todo')" :key="task.id" class="kanban-item" style="background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 0.75rem;">
          <p style="margin: 0 0 0.75rem; font-size: 0.95rem; color: #334155;">{{ task.judul }}</p>
          <div class="kanban-actions" style="display: flex; justify-content: flex-end;">
            <button @click="updateTaskStatus(task, 'doing')" style="background: var(--color-primary); color: white; border: none; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">Mulai 🚀</button>
          </div>
        </div>
      </div>
      <div class="kanban-col" style="background: #f8fafc; border-radius: 12px; padding: 1rem; border: 1px solid var(--border-color);">
        <h3 style="margin: 0 0 1rem; color: #3b82f6; font-size: 1rem;">Doing</h3>
        <div v-for="task in tasks.filter(t => t.status === 'doing')" :key="task.id" class="kanban-item" style="background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border-left: 3px solid #3b82f6; margin-bottom: 0.75rem;">
          <p style="margin: 0 0 0.75rem; font-size: 0.95rem; color: #334155;">{{ task.judul }}</p>
          <div class="kanban-actions" style="display: flex; justify-content: space-between;">
            <button @click="updateTaskStatus(task, 'todo')" style="background: transparent; color: #64748b; border: 1px solid #cbd5e1; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">Batal</button>
            <button @click="updateTaskStatus(task, 'done')" style="background: #10b981; color: white; border: none; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">Selesai ✅</button>
          </div>
        </div>
      </div>
      <div class="kanban-col" style="background: #f8fafc; border-radius: 12px; padding: 1rem; border: 1px solid var(--border-color);">
        <h3 style="margin: 0 0 1rem; color: #10b981; font-size: 1rem;">Done</h3>
        <div v-for="task in tasks.filter(t => t.status === 'done')" :key="task.id" class="kanban-item" style="background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border-left: 3px solid #10b981; margin-bottom: 0.75rem; opacity: 0.7;">
          <p style="margin: 0; font-size: 0.95rem; color: #64748b; text-decoration: line-through;">{{ task.judul }}</p>
        </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-card {
  background: white;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  width: 100%;
  max-width: 100%;
  padding: 2rem;
  box-sizing: border-box;
  min-width: 0;
}
@media (max-width: 768px) {
  .status-card {
    padding: 1rem;
  }
}
.btn-scan {
  background: var(--color-primary);
  color: white;
  border: none;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-scan:hover { background: #3b82f6; }
.btn-scan:disabled { background: #94a3b8; cursor: not-allowed; }

.kanban-board {
  display: grid;
  grid-template-columns: repeat(3, minmax(250px, 1fr));
  gap: 1rem;
  text-align: left;
}

@media (max-width: 768px) {
  .kanban-board {
    display: flex;
    flex-direction: column;
  }
}
</style>
