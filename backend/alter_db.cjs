const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kkn_management'
  });
  
  await conn.query('ALTER TABLE arsip_files MODIFY url_file TEXT NOT NULL');
  console.log('Successfully altered arsip_files.url_file to TEXT');
  process.exit(0);
}

main().catch(console.error);
