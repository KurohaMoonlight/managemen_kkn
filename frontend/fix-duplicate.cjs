const fs = require('fs');
const file = 'c:/Apache24/htdocs/sistem_management_kkn/frontend/src/views/MahasiswaDashboard.vue';
let content = fs.readFileSync(file, 'utf8');

// Rename the first handleFileSelect (which belongs to File Explorer)
let matchIndex = content.indexOf('const handleFileSelect');
if (matchIndex !== -1) {
  content = content.substring(0, matchIndex) + 'const handleExplorerFileSelect' + content.substring(matchIndex + 22);
}

// Rename in the HTML for fileUploadInput
content = content.replace(/ref="fileUploadInput"([^>]*?)@change="handleFileSelect"/g, 'ref="fileUploadInput"$1@change="handleExplorerFileSelect"');
content = content.replace(/@change="handleFileSelect"([^>]*?)ref="fileUploadInput"/g, '@change="handleExplorerFileSelect"$1ref="fileUploadInput"');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed duplicate function name!');
