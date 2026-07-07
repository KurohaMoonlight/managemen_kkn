import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const checkDB = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kkn_management'
    });

    const [rows] = await connection.query("SHOW TABLES LIKE '%surat%'");
    if (rows.length === 0) {
      console.log('Tabel surat tidak ditemukan.');
    } else {
      console.log('Tabel ditemukan:', rows);
      for (let row of rows) {
        const tableName = Object.values(row)[0];
        const [columns] = await connection.query(`DESCRIBE ${tableName}`);
        console.log(`Struktur tabel ${tableName}:`, columns);
      }
    }
    await connection.end();
  } catch (error) {
    console.error('Error:', error);
  }
};

checkDB();
