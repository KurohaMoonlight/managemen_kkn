const fs = require('fs');
const file = 'frontend/src/views/BendaharaDashboard.vue';
let lines = fs.readFileSync(file, 'utf8').split('\n');
let newLines = [];
for(let line of lines) {
    if (line.includes('const iuranTarget = ref(0);')) {
        newLines.push(line);
        newLines.push("const iuranInterval = ref('sekali');");
        continue;
    }
    if (line.includes('{{ u.status.toUpperCase() }}')) {
        newLines.push(line.replace("{{ u.status.toUpperCase() }}", "{{ (u.status || 'belum').toUpperCase() }}"));
        continue;
    }
    newLines.push(line);
}
fs.writeFileSync(file, newLines.join('\n'));
console.log('Fixed undefined vars!');
