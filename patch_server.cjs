const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'backend/server.js');
let content = fs.readFileSync(file, 'utf8');

const oldIuranTrans = `    await pool.query(\`
      INSERT INTO keuangan_transaksi (posko_id, jenis, nominal, tanggal, keterangan, user_id)
      VALUES (?, 'pemasukan', ?, CURDATE(), ?, ?)
    \`, [req.user.posko_id, nominal_bayar, \`Iuran anggota: \${nama}\`, req.user.id]);`;

const newIuranTrans = `    const [existKat] = await pool.query('SELECT id FROM keuangan_kategori WHERE posko_id = ? AND nama_kategori = ?', [req.user.posko_id, 'Iuran Anggota']);
    let katId = null;
    if (existKat.length > 0) {
      katId = existKat[0].id;
    } else {
      const [insKat] = await pool.query('INSERT INTO keuangan_kategori (posko_id, nama_kategori, plafon_dana) VALUES (?, ?, 0)', [req.user.posko_id, 'Iuran Anggota']);
      katId = insKat.insertId;
    }
    
    await pool.query(\`
      INSERT INTO keuangan_transaksi (posko_id, jenis, kategori_id, nominal, tanggal, keterangan, user_id)
      VALUES (?, 'pemasukan', ?, ?, CURDATE(), ?, ?)
    \`, [req.user.posko_id, katId, nominal_bayar, \`\${nama} membayar iuran sebesar \${nominal_bayar} dari \${target}\`, req.user.id]);`;

content = content.replace(oldIuranTrans, newIuranTrans);

const oldPengajuanQuery = `      SELECT p.*, u.nama_lengkap, u.jabatan AS pengaju_jabatan, k.nama_kategori 
      FROM keuangan_pengajuan p
      JOIN users u ON p.user_id = u.id
      JOIN keuangan_kategori k ON p.kategori_id = k.id`;

const newPengajuanQuery = `      SELECT p.*, u.nama_lengkap, u.jabatan AS pengaju_jabatan, k.nama_kategori, 
        (SELECT GROUP_CONCAT(pg.nama_pic SEPARATOR ', ') 
         FROM pic_members pm 
         JOIN pic_groups pg ON pm.pic_group_id = pg.id 
         WHERE pm.user_id = p.user_id) AS divisi_pic
      FROM keuangan_pengajuan p
      JOIN users u ON p.user_id = u.id
      JOIN keuangan_kategori k ON p.kategori_id = k.id`;

content = content.replace(oldPengajuanQuery, newPengajuanQuery);

fs.writeFileSync(file, content);
console.log('Fixed both APIs');
