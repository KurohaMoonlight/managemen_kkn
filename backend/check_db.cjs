const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/Apache24/htdocs/sistem_management_kkn/backend/database.sqlite');
db.all("SELECT name, sql FROM sqlite_master WHERE type='table' AND name LIKE '%surat%'", [], (err, rows) => {
  if (err) console.error(err);
  else if (rows.length === 0) console.log('Tabel surat tidak ditemukan.');
  else rows.forEach(r => console.log(r.sql));
});



