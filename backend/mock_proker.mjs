import mysql from 'mysql2/promise';

async function mockData() {
  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: '121204', database: 'manajemen_kkn' });
  try {
    const [[user]] = await pool.query("SELECT id FROM users WHERE nim='1234567890'");
    if (user) {
      await pool.query("INSERT IGNORE INTO absensi (user_id, tanggal, waktu, status) VALUES (?, CURDATE(), '08:00:00', 'hadir')", [user.id]);
      
      const [pic] = await pool.query("SELECT id FROM pic_groups WHERE proker='Pembuatan Website Desa'");
      let picId;
      if (pic.length === 0) {
        const [res] = await pool.query("INSERT INTO pic_groups (nama_pic, proker) VALUES ('Kelompok 1', 'Pembuatan Website Desa')");
        picId = res.insertId;
      } else {
        picId = pic[0].id;
      }
      
      await pool.query("INSERT IGNORE INTO pic_members (pic_id, user_id) VALUES (?, ?)", [picId, user.id]);
      console.log('Mock data added for user 1234567890');
    }
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
mockData();
