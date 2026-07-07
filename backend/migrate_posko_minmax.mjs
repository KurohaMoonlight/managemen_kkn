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

    // Add default_min_anggota to posko
    try {
      await conn.query(`ALTER TABLE posko ADD COLUMN default_min_anggota INT DEFAULT 2`);
      console.log('✓ Added column default_min_anggota to posko');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ Column default_min_anggota already exists, skipping...');
      } else {
        throw e;
      }
    }

    // Add default_max_anggota to posko
    try {
      await conn.query(`ALTER TABLE posko ADD COLUMN default_max_anggota INT DEFAULT NULL`);
      console.log('✓ Added column default_max_anggota to posko');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ Column default_max_anggota already exists, skipping...');
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
