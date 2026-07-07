import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sistem_management_kkn'
};

async function migrate() {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    console.log('Connected to the database.');

    // Add min_anggota
    try {
      await conn.query(`ALTER TABLE pic_groups ADD COLUMN min_anggota INT DEFAULT 2`);
      console.log('✓ Added column min_anggota to pic_groups');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ Column min_anggota already exists, skipping...');
      } else {
        throw e;
      }
    }

    // Add max_anggota
    try {
      await conn.query(`ALTER TABLE pic_groups ADD COLUMN max_anggota INT DEFAULT NULL`);
      console.log('✓ Added column max_anggota to pic_groups');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ Column max_anggota already exists, skipping...');
      } else {
        throw e;
      }
    }

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    if (conn) await conn.end();
    process.exit();
  }
}

migrate();
