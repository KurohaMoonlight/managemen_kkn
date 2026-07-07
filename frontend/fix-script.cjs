const fs = require('fs');
const file = 'c:/Apache24/htdocs/sistem_management_kkn/frontend/rebuild-mhs-safe.cjs';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/let ctxHtml = getDivBlock\\('<!-- Custom Right Click Context Menu -->.*'\\)/g, "let ctxHtml = getDivBlock('<!-- Custom Right Click Context Menu -->')");
content = content.replace(/let fbHtml = getDivBlock\\('<!-- Clipboard Floating Indicator -->.*'\\)/g, "let fbHtml = getDivBlock('<!-- Clipboard Floating Indicator -->')");
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed');
