const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/views/BendaharaDashboard.vue');
let content = fs.readFileSync(file, 'utf8');

const targetStr = `<td style="font-weight: 500;">{{ p.nama_lengkap }}</td>`;
const replaceStr = `<td style="font-weight: 500;">
                    {{ p.nama_lengkap }}
                    <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal; margin-top: 2px;">
                      {{ p.divisi_pic ? 'Divisi: ' + p.divisi_pic : p.pengaju_jabatan }}
                    </div>
                  </td>`;

content = content.replace(targetStr, replaceStr);

fs.writeFileSync(file, content);
console.log('Patched Pengajuan Table');
