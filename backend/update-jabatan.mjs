import pool from './db.js';

async function migrate() {
  try {
    console.log('Adding jabatan column to users table...');
    await pool.query('ALTER TABLE users ADD COLUMN jabatan VARCHAR(50) DEFAULT "Anggota"');
    console.log('Migration successful!');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Column jabatan already exists. Skipping.');
    } else {
      console.error('Migration failed:', error);
    }
  } finally {
    process.exit(0);
  }
}

migrate();
