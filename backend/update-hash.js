import pool from './db.js';
import bcrypt from 'bcrypt';

async function updateHash() {
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);
    console.log('New hash for password123:', hash);
    
    await pool.query('UPDATE users SET password = ?', [hash]);
    console.log('Successfully updated all users with the new password hash.');
    
  } catch (err) {
    console.error('DB Error:', err.message);
  } finally {
    process.exit();
  }
}

updateHash();
