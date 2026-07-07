const fs = require('fs');

const serverFile = 'c:/Apache24/htdocs/sistem_management_kkn/backend/server.js';
let content = fs.readFileSync(serverFile, 'utf8');

if (content.includes('/api/surat')) {
  console.log('Routes already injected!');
  process.exit(0);
}

const routesCode = `
// ==========================================
// ARSIP SURAT RESMI ROUTES
// ==========================================

// 1. GET ALL SURAT FOR POSKO
app.get('/api/surat', authenticateToken, async (req, res) => {
  try {
    let poskoId;
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      poskoId = req.query.posko_id || req.user.posko_id;
    } else {
      poskoId = req.user.posko_id;
    }
    
    if (!poskoId) {
      return res.status(400).json({ success: false, message: 'Posko ID tidak ditemukan' });
    }

    const [rows] = await db.query(
      'SELECT s.*, u.nama_lengkap as pembuat FROM surat_history s LEFT JOIN users u ON s.user_id = u.id WHERE s.posko_id = ? ORDER BY s.created_at DESC',
      [poskoId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Fetch Surat Error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
});

// 2. CREATE NEW SURAT (DRAFT OR FINAL)
app.post('/api/surat', authenticateToken, async (req, res) => {
  try {
    const { jenis_surat, nama_surat, nomor_surat, data_field, status } = req.body;
    const posko_id = req.user.posko_id;
    const user_id = req.user.id;

    if (!posko_id) {
      return res.status(400).json({ success: false, message: 'Anda tidak memiliki akses posko' });
    }

    const query = \`
      INSERT INTO surat_history (posko_id, user_id, jenis_surat, nama_surat, nomor_surat, data_field, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    \`;
    const [result] = await db.query(query, [
      posko_id, user_id, jenis_surat, 
      nama_surat || jenis_surat, 
      nomor_surat || '-', 
      JSON.stringify(data_field || {}), 
      status || 'draft'
    ]);

    res.json({ success: true, message: 'Surat berhasil disimpan', id: result.insertId });
  } catch (error) {
    console.error('Create Surat Error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
});

// 3. UPDATE SURAT (DRAFT TO COMPLETE)
app.put('/api/surat/:id', authenticateToken, async (req, res) => {
  try {
    const { jenis_surat, nama_surat, nomor_surat, data_field, status, file_url } = req.body;
    const id = req.params.id;

    // Optional check: Ensure user is authorized to edit this specific surat

    const query = \`
      UPDATE surat_history 
      SET jenis_surat = ?, nama_surat = ?, nomor_surat = ?, data_field = ?, status = ?, file_url = ?
      WHERE id = ?
    \`;
    await db.query(query, [
      jenis_surat, 
      nama_surat || jenis_surat, 
      nomor_surat || '-', 
      JSON.stringify(data_field || {}), 
      status || 'draft',
      file_url || null,
      id
    ]);

    res.json({ success: true, message: 'Surat berhasil diperbarui' });
  } catch (error) {
    console.error('Update Surat Error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
});

// 4. DELETE SURAT
app.delete('/api/surat/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    await db.query('DELETE FROM surat_history WHERE id = ?', [id]);
    res.json({ success: true, message: 'Surat berhasil dihapus' });
  } catch (error) {
    console.error('Delete Surat Error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
});

`;

const targetIndex = content.lastIndexOf('app.listen(');
if (targetIndex !== -1) {
  content = content.slice(0, targetIndex) + routesCode + content.slice(targetIndex);
  fs.writeFileSync(serverFile, content, 'utf8');
  console.log('Surat routes successfully injected into server.js!');
} else {
  console.log('Failed to find app.listen!');
}
