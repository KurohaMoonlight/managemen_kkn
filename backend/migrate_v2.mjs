import mysql from 'mysql2/promise';

async function migrate() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '121204',
    database: 'manajemen_kkn'
  });

  try {
    console.log('Creating proker_tasks table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`proker_tasks\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`pic_id\` INT NOT NULL,
        \`judul\` VARCHAR(255) NOT NULL,
        \`deskripsi\` TEXT,
        \`status\` ENUM('todo', 'doing', 'done') DEFAULT 'todo',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (\`pic_id\`) REFERENCES \`pic_groups\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('Creating logbooks table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`logbooks\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`pic_id\` INT NOT NULL,
        \`user_id\` INT NOT NULL,
        \`tanggal\` DATE NULL,
        \`waktu_mulai\` TIME NULL,
        \`waktu_selesai\` TIME NULL,
        \`tempat\` VARCHAR(255) NULL,
        \`sasaran\` VARCHAR(255) NULL,
        \`deskripsi\` TEXT NOT NULL,
        \`folder_id_referensi\` INT DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`pic_id\`) REFERENCES \`pic_groups\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

migrate();
