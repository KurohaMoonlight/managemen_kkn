import pool from '../backend/db.js';

async function checkDb() {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    console.log('Users in database:', rows);
    
    // Also try to hash password123 and compare with the first user
    import bcrypt from 'bcrypt';
    const isMatch = await bcrypt.compare('password123', rows[0].password);
    console.log('Does password123 match hash?', isMatch);
    
  } catch (err) {
    console.error('DB Error:', err.message);
  } finally {
    process.exit();
  }
}

checkDb();
