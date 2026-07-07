import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kkn_db',
});

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log('Starting surat_history database migration...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS surat_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        posko_id INT NOT NULL,
        user_id INT NOT NULL,
        jenis_surat VARCHAR(100) NOT NULL,
        nama_surat VARCHAR(255) NULL,
        nomor_surat VARCHAR(100) NOT NULL,
        data_field JSON,
        status ENUM('draft', 'complete') DEFAULT 'draft',
        file_url VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (posko_id) REFERENCES posko(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log(' ✓ Table surat_history checked/created.');
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    conn.release();
    pool.end();
  }
}

migrate();
