import pool from './db.js';
import bcrypt from 'bcrypt';

async function checkDb() {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    console.log('Users in database:', rows);
    
    if (rows.length > 0) {
      const isMatch = await bcrypt.compare('password123', rows[0].password);
      console.log('Does password123 match hash for user 1?', isMatch);
    }
  } catch (err) {
    console.error('DB Error:', err.message);
  } finally {
    process.exit();
  }
}

checkDb();
