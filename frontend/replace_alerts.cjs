const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/views/BendaharaDashboard.vue');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/import html2pdf from 'html2pdf\.js';/, "import html2pdf from 'html2pdf.js';\nimport { useToast } from '../composables/useNotification';");
content = content.replace(/const activeTab = ref\('dashboard'\);/, "const activeTab = ref('dashboard');\nconst toast = useToast();");

// Replace all alerts
// We will replace basic alerts with toast.info, and specific ones like "berhasil" with toast.success
content = content.replace(/alert\((.*?berhasil.*?)\)/gi, 'toast.success($1)');
content = content.replace(/alert\((.*?Gagal.*?)\)/gi, 'toast.error($1)');
content = content.replace(/alert\((.*?Terjadi kesalahan.*?)\)/gi, 'toast.error($1)');
content = content.replace(/alert\((.*?dihapus.*?)\)/gi, 'toast.info($1)');
content = content.replace(/alert\((.*?Nominal tidak valid.*?)\)/gi, 'toast.warning($1)');
content = content.replace(/alert\((.*?Tidak ada data.*?)\)/gi, 'toast.warning($1)');

// Any remaining alerts
content = content.replace(/alert\(/g, 'toast.info(');

fs.writeFileSync(file, content);
console.log('Replaced alerts with toasts');
