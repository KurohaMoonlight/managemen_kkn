import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function resetDatabase() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'manajemen_kkn',
    multipleStatements: true
  });

  const conn = await pool.getConnection();
  try {
    console.log('🗑️  Dropping all tables...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    const [tables] = await conn.query('SHOW TABLES');
    for (const row of tables) {
      const tableName = Object.values(row)[0];
      await conn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
      console.log(`   ✓ Dropped: ${tableName}`);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n📦 Creating new schema...');

    // 1. posko (must be first, others FK to it)
    await conn.query(`
      CREATE TABLE posko (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_posko VARCHAR(100) NOT NULL,
        deskripsi TEXT,
        lat DECIMAL(10, 8) DEFAULT 0,
        lng DECIMAL(11, 8) DEFAULT 0,
        radius INT DEFAULT 50,
        desa VARCHAR(255),
        alamat_lengkap TEXT,
        qr_secret VARCHAR(50),
        jam_masuk TIME DEFAULT '10:00:00',
        default_min_anggota INT DEFAULT 2,
        default_max_anggota INT DEFAULT NULL,
        iuran_interval VARCHAR(20) DEFAULT 'sekali',
        iuran_nominal_base DECIMAL(15,2) DEFAULT 0,
        iuran_last_accrued DATE DEFAULT NULL,
        gdrive_refresh_token VARCHAR(255) DEFAULT NULL,
        backup_interval_days INT DEFAULT 3,
        last_backup_date TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✓ Created: posko');

    // 2. users (role now includes superadmin, has posko_id)
    await conn.query(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nim VARCHAR(20) NOT NULL,
        password VARCHAR(255) NOT NULL,
        nama_lengkap VARCHAR(100) DEFAULT NULL,
        role ENUM('superadmin','admin','mahasiswa') NOT NULL DEFAULT 'mahasiswa',
        jabatan VARCHAR(50) DEFAULT 'Anggota',
        posko_id INT DEFAULT NULL,
        gdrive_refresh_token VARCHAR(255) DEFAULT NULL,
        last_login DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_nim (nim),
        FOREIGN KEY fk_user_posko (posko_id) REFERENCES posko(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✓ Created: users');

    // 3. periode_kkn
    await conn.query(`
      CREATE TABLE periode_kkn (
        id INT AUTO_INCREMENT PRIMARY KEY,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✓ Created: periode_kkn');

    // 4. absensi (has posko_id now)
    await conn.query(`
      CREATE TABLE absensi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        posko_id INT DEFAULT NULL,
        tanggal DATE NOT NULL,
        waktu TIME NOT NULL,
        status ENUM('hadir','telat','izin','sakit') DEFAULT 'hadir',
        alasan VARCHAR(255) DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY fk_absensi_posko (posko_id) REFERENCES posko(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✓ Created: absensi');

    // 5. arsip_folders (has posko_id)
    await conn.query(`
      CREATE TABLE arsip_folders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        parent_id INT DEFAULT NULL,
        nama_folder VARCHAR(255) NOT NULL,
        posko_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES arsip_folders(id) ON DELETE CASCADE,
        FOREIGN KEY fk_folder_posko (posko_id) REFERENCES posko(id) ON DELETE SET NULL,
        INDEX idx_posko_parent_nama (posko_id, parent_id, nama_folder)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✓ Created: arsip_folders');

    // 6. arsip_files
    await conn.query(`
      CREATE TABLE arsip_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        folder_id INT DEFAULT NULL,
        tipe_file VARCHAR(50) NOT NULL,
        nama_file VARCHAR(255) NOT NULL,
        url_file TEXT NOT NULL,
        thumbnail_url VARCHAR(255) DEFAULT NULL,
        posko_id INT DEFAULT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (folder_id) REFERENCES arsip_folders(id) ON DELETE CASCADE,
        FOREIGN KEY fk_file_posko (posko_id) REFERENCES posko(id) ON DELETE SET NULL,
        INDEX idx_posko_folder_uploaded (posko_id, folder_id, uploaded_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✓ Created: arsip_files');

    // 7. pic_groups (has posko_id)
    await conn.query(`
      CREATE TABLE pic_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_pic VARCHAR(255) NOT NULL,
        proker VARCHAR(255) NOT NULL,
        folder_id INT DEFAULT NULL,
        posko_id INT DEFAULT NULL,
        min_anggota INT DEFAULT NULL,
        max_anggota INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (folder_id) REFERENCES arsip_folders(id) ON DELETE SET NULL,
        FOREIGN KEY fk_pic_posko (posko_id) REFERENCES posko(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✓ Created: pic_groups');

    // 8. pic_members
    await conn.query(`
      CREATE TABLE pic_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pic_id INT NOT NULL,
        user_id INT NOT NULL,
        FOREIGN KEY (pic_id) REFERENCES pic_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✓ Created: pic_members');

    // 9. proker_tasks
    await conn.query(`
      CREATE TABLE proker_tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pic_id INT NOT NULL,
        judul VARCHAR(255) NOT NULL,
        deskripsi TEXT,
        status ENUM('todo','doing','done') DEFAULT 'todo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (pic_id) REFERENCES pic_groups(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✓ Created: proker_tasks');

    // 10. logbooks
    await conn.query(`
      CREATE TABLE logbooks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pic_id INT NOT NULL,
        user_id INT NOT NULL,
        tanggal DATE NULL,
        waktu_mulai TIME NULL,
        waktu_selesai TIME NULL,
        tempat VARCHAR(255) NULL,
        sasaran VARCHAR(255) NULL,
        deskripsi TEXT NOT NULL,
        folder_id_referensi INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pic_id) REFERENCES pic_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✓ Created: logbooks');

    // 11. keuangan_kategori
    await conn.query(`
      CREATE TABLE keuangan_kategori (
        id INT AUTO_INCREMENT PRIMARY KEY,
        posko_id INT NOT NULL,
        nama_kategori VARCHAR(255) NOT NULL,
        plafon_dana DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (posko_id) REFERENCES posko(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✓ Created: keuangan_kategori');

    // 12. keuangan_transaksi
    await conn.query(`
      CREATE TABLE keuangan_transaksi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        posko_id INT NOT NULL,
        kategori_id INT DEFAULT NULL,
        jenis ENUM('pemasukan','pengeluaran') NOT NULL,
        nominal DECIMAL(15,2) NOT NULL,
        tanggal DATE NOT NULL,
        keterangan TEXT NOT NULL,
        file_nota_id INT DEFAULT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (posko_id) REFERENCES posko(id) ON DELETE CASCADE,
        FOREIGN KEY (kategori_id) REFERENCES keuangan_kategori(id) ON DELETE SET NULL,
        FOREIGN KEY (file_nota_id) REFERENCES arsip_files(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✓ Created: keuangan_transaksi');

    // 13. keuangan_iuran
    await conn.query(`
      CREATE TABLE keuangan_iuran (
        id INT AUTO_INCREMENT PRIMARY KEY,
        posko_id INT NOT NULL,
        user_id INT NOT NULL,
        nominal_target DECIMAL(15,2) DEFAULT 0,
        nominal_terbayar DECIMAL(15,2) DEFAULT 0,
        status ENUM('belum','sebagian','lunas') DEFAULT 'belum',
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (posko_id) REFERENCES posko(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_posko_user (posko_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✓ Created: keuangan_iuran');

    // 14. keuangan_pengajuan
    await conn.query(`
      CREATE TABLE keuangan_pengajuan (
        id INT AUTO_INCREMENT PRIMARY KEY,
        posko_id INT NOT NULL,
        user_id INT NOT NULL,
        kategori_id INT NOT NULL,
        nominal DECIMAL(15,2) NOT NULL,
        keterangan TEXT NOT NULL,
        file_nota_url VARCHAR(255) DEFAULT NULL,
        status ENUM('pending','disetujui','ditolak') DEFAULT 'pending',
        catatan_bendahara TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (posko_id) REFERENCES posko(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (kategori_id) REFERENCES keuangan_kategori(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✓ Created: keuangan_pengajuan');

    // 15. surat_history
    await conn.query(`
      CREATE TABLE surat_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        posko_id INT NOT NULL,
        user_id INT NOT NULL,
        jenis_surat VARCHAR(100) NOT NULL,
        nama_surat VARCHAR(255) NULL,
        nomor_surat VARCHAR(100) NOT NULL,
        data_field JSON,
        status ENUM('draft', 'complete') DEFAULT 'draft',
        file_url VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (posko_id) REFERENCES posko(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✓ Created: surat_history');

    await conn.query(`
      CREATE TABLE buku_tamu (
        id INT AUTO_INCREMENT PRIMARY KEY,
        posko_id INT NOT NULL,
        tanggal DATE NOT NULL,
        nama_tamu VARCHAR(100) NOT NULL,
        alamat_jabatan VARCHAR(255) NOT NULL,
        keperluan TEXT NOT NULL,
        mhs_penyambut_id INT NULL,
        ttd_tamu_url VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (posko_id) REFERENCES posko(id) ON DELETE CASCADE,
        FOREIGN KEY (mhs_penyambut_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✓ Created: buku_tamu');

    // ─── SEED DATA ────────────────────────────────────────────
    console.log('\n🌱 Seeding default data...');
    const salt = await bcrypt.genSalt(10);

    // Superadmin account
    const superadminHash = await bcrypt.hash('superadmin123', salt);
    await conn.query(
      `INSERT INTO users (nim, password, nama_lengkap, role) VALUES ('superadmin', ?, 'Super Administrator', 'superadmin')`,
      [superadminHash]
    );
    console.log('   ✓ Superadmin created (nim: superadmin | password: superadmin123)');

    // Default KKN periode
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    const toSqlDate = (d) => d.toISOString().split('T')[0];
    await conn.query(
      'INSERT INTO periode_kkn (start_date, end_date) VALUES (?, ?)',
      [toSqlDate(start), toSqlDate(end)]
    );
    console.log('   ✓ Default KKN periode inserted');

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Database reset complete!

  SUPERADMIN LOGIN
  Username  : superadmin
  Password  : superadmin123
  URL       : http://localhost:5173/superadmin

  ⚠️  Harap ganti password setelah login pertama!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  } catch (error) {
    console.error('❌ Reset failed:', error);
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
}

resetDatabase().catch(console.error);
