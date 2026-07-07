import pool from './db.js';

async function migrate() {
  try {
    await pool.query('ALTER TABLE posko ADD COLUMN iuran_interval VARCHAR(20) DEFAULT "sekali"');
    console.log('Migration successful');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Column already exists');
    } else {
      console.error('Migration error:', err);
    }
  } finally {
    process.exit();
  }
}

migrate();
