import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function setupDatabase() {
  const dbName = process.env.DB_NAME || 'sistem_management_kkn';
  console.log(`Menghubungkan ke MySQL dengan user: ${process.env.DB_USER}...`);
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });
    
    console.log(`Membuat database '${dbName}' jika belum ada...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    console.log(`Database '${dbName}' berhasil disiapkan.`);
    
    await connection.end();
    
    console.log(`\nSekarang Anda dapat menjalankan:`);
    console.log(`node reset_db.mjs`);
    console.log(`Untuk membuat tabel-tabel di dalamnya.`);
  } catch (error) {
    console.error('Gagal menghubungkan ke database atau membuat database:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n❌ AKSES DITOLAK: Pastikan Anda telah mengisi DB_PASSWORD di file backend/.env dengan benar.');
    }
  }
}

setupDatabase();
