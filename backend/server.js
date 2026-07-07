import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { google } from 'googleapis';
import cron from 'node-cron';
import { setupBackupService } from './backupService.mjs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const archiver = require('archiver');
const AdmZip = require('adm-zip');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'rahasia_negara_kkn_2026';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── DIRECTORIES ───────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const thumbDir = path.join(__dirname, 'uploads', 'thumbnails');
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

// ─── MULTER ────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});

const fileFilter = (req, file, cb) => {
  // Blokir ekstensi berbahaya (RCE Prevention)
  const forbiddenExts = /\.(php|php3|php4|php5|phtml|exe|sh|bat|cmd|js|vbs|msi)$/i;
  if (forbiddenExts.test(file.originalname)) {
    return cb(new Error('Ekstensi file ini berbahaya dan diblokir sistem!'), false);
  }
  
  // Izinkan unggahan yang aman
  cb(null, true); 
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // Batas 50MB per file
});

// ─── IMAGE COMPRESSION MIDDLEWARE ──────────────────────────────────────────────
const compressImages = async (req, res, next) => {
  try {
    const files = [];
    if (req.file) files.push(req.file);
    if (req.files && Array.isArray(req.files)) files.push(...req.files);
    
    for (const file of files) {
      if (file.mimetype && file.mimetype.startsWith('image/')) {
        const buffer = await sharp(file.path)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80, force: false })
          .png({ quality: 80, force: false })
          .webp({ quality: 80, force: false })
          .toBuffer();
        fs.writeFileSync(file.path, buffer);
        file.size = buffer.length;
      }
    }
    next();
  } catch (err) {
    console.error('Image compression failed:', err);
    next(); // Lanjut meskipun kompresi gagal
  }
};

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Sesi anda telah habis. Silakan login kembali.' });
  jwt.verify(token, JWT_SECRET, async (err, decodedUser) => {
    if (err) return res.status(403).json({ message: 'Token tidak valid' });
    
    try {
      const [rows] = await pool.query('SELECT id, role, posko_id FROM users WHERE id = ?', [decodedUser.id]);
      if (rows.length === 0) {
        return res.status(401).json({ message: 'Sesi tidak valid (Akun telah dihapus atau reset). Silakan login kembali.' });
      }

      const dbUser = rows[0];
      req.user = {
        ...decodedUser,
        role: dbUser.role,
        posko_id: dbUser.posko_id
      };
      
      if (req.user.role !== 'superadmin' && !req.user.posko_id) {
        return res.status(403).json({ message: 'Akses terblokir. Akun Anda tidak memiliki posko.' });
      }
      
      next();
    } catch (dbErr) {
      console.error('Auth DB Error:', dbErr);
      return res.status(500).json({ message: 'Kesalahan server saat memverifikasi sesi.' });
    }
  });
};

const requireSuperadmin = (req, res, next) => {
  if (req.user?.role !== 'superadmin') return res.status(403).json({ message: 'Akses ditolak. Hanya Superadmin.' });
  next();
};

const requireAdminOrAbove = (req, res, next) => {
  if (!['admin', 'superadmin'].includes(req.user?.role)) return res.status(403).json({ message: 'Akses ditolak.' });
  next();
};

// ─── DATABASE INIT ─────────────────────────────────────────────────────────────
const initializeDb = async () => {
  try {
    // Create posko table (new)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS posko (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_posko VARCHAR(100) NOT NULL,
        deskripsi TEXT,
        lat DECIMAL(10, 8) DEFAULT 0,
        lng DECIMAL(11, 8) DEFAULT 0,
        radius INT DEFAULT 50,
        qr_secret VARCHAR(100) DEFAULT 'KKN_POSKO_2026',
        jam_masuk TIME DEFAULT '10:00:00',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create users with new schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nim VARCHAR(20) NOT NULL,
        password VARCHAR(255) NOT NULL,
        nama_lengkap VARCHAR(100) DEFAULT NULL,
        role ENUM('superadmin','admin','mahasiswa') NOT NULL DEFAULT 'mahasiswa',
        jabatan VARCHAR(50) DEFAULT 'Anggota',
        posko_id INT DEFAULT NULL,
        last_login DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_nim (nim),
        FOREIGN KEY fk_user_posko (posko_id) REFERENCES posko(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Migration: add posko_id to users if missing
    try {
      await pool.query('ALTER TABLE users ADD COLUMN posko_id INT DEFAULT NULL AFTER jabatan');
      await pool.query('ALTER TABLE users ADD CONSTRAINT fk_user_posko FOREIGN KEY (posko_id) REFERENCES posko(id) ON DELETE SET NULL');
    } catch(e) { /* column already exists */ }

    // Migration: modify role enum to include superadmin
    try {
      await pool.query(`ALTER TABLE users MODIFY COLUMN role ENUM('superadmin','admin','mahasiswa') NOT NULL DEFAULT 'mahasiswa'`);
    } catch(e) { /* already has superadmin */ }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS periode_kkn (
        id INT AUTO_INCREMENT PRIMARY KEY,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS absensi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        posko_id INT DEFAULT NULL,
        tanggal DATE NOT NULL,
        waktu TIME NOT NULL,
        status ENUM('hadir','telat','izin','sakit') DEFAULT 'hadir',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY fk_absensi_posko (posko_id) REFERENCES posko(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Migration: add posko_id to absensi if missing
    try {
      await pool.query('ALTER TABLE absensi ADD COLUMN posko_id INT DEFAULT NULL AFTER user_id');
      await pool.query('ALTER TABLE absensi ADD CONSTRAINT fk_absensi_posko FOREIGN KEY (posko_id) REFERENCES posko(id) ON DELETE SET NULL');
    } catch(e) { /* already exists */ }

    // Migration: add alasan to absensi if missing
    try {
      await pool.query('ALTER TABLE absensi ADD COLUMN alasan TEXT DEFAULT NULL AFTER status');
    } catch(e) { /* already exists */ }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS arsip_folders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        parent_id INT DEFAULT NULL,
        nama_folder VARCHAR(255) NOT NULL,
        posko_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES arsip_folders(id) ON DELETE CASCADE,
        FOREIGN KEY fk_folder_posko (posko_id) REFERENCES posko(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS arsip_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        folder_id INT DEFAULT NULL,
        tipe_file VARCHAR(50) NOT NULL,
        nama_file VARCHAR(255) NOT NULL,
        url_file VARCHAR(255) NOT NULL,
        thumbnail_url VARCHAR(255) DEFAULT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (folder_id) REFERENCES arsip_folders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    try { await pool.query('ALTER TABLE arsip_files ADD COLUMN thumbnail_url VARCHAR(255) DEFAULT NULL'); } catch(e) {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pic_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_pic VARCHAR(255) NOT NULL,
        proker VARCHAR(255) NOT NULL,
        folder_id INT DEFAULT NULL,
        posko_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (folder_id) REFERENCES arsip_folders(id) ON DELETE SET NULL,
        FOREIGN KEY fk_pic_posko (posko_id) REFERENCES posko(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pic_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pic_id INT NOT NULL,
        user_id INT NOT NULL,
        FOREIGN KEY (pic_id) REFERENCES pic_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS proker_tasks (
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS logbooks (
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS keuangan_kategori (
        id INT AUTO_INCREMENT PRIMARY KEY,
        posko_id INT NOT NULL,
        nama_kategori VARCHAR(255) NOT NULL,
        plafon_dana DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (posko_id) REFERENCES posko(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS keuangan_transaksi (
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS surat_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        posko_id INT NOT NULL,
        user_id INT NOT NULL,
        jenis_surat VARCHAR(255) NOT NULL,
        nama_surat VARCHAR(255) NOT NULL,
        nomor_surat VARCHAR(100) DEFAULT '-',
        data_field JSON,
        status ENUM('draft','selesai') DEFAULT 'draft',
        file_url VARCHAR(500) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (posko_id) REFERENCES posko(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Indexes for performance
    try { await pool.query('CREATE INDEX idx_folder_parent ON arsip_folders(parent_id)'); } catch(e) {}
    try { await pool.query('CREATE INDEX idx_file_folder ON arsip_files(folder_id)'); } catch(e) {}
    try { await pool.query('CREATE INDEX idx_absensi_tanggal ON absensi(tanggal)'); } catch(e) {}
    try { await pool.query('CREATE INDEX idx_surat_posko ON surat_history(posko_id)'); } catch(e) {}

    // Migration: add expired_at to arsip_folders for expired folder system
    try { await pool.query('ALTER TABLE arsip_folders ADD COLUMN expired_at DATETIME DEFAULT NULL'); } catch(e) { /* already exists */ }

    // Migration: Google Drive backup columns
    try { await pool.query('ALTER TABLE posko ADD COLUMN gdrive_refresh_token VARCHAR(255) DEFAULT NULL'); } catch(e) { /* already exists */ }
    try { await pool.query('ALTER TABLE posko ADD COLUMN backup_interval_days INT DEFAULT 3'); } catch(e) { /* already exists */ }
    try { await pool.query('ALTER TABLE posko ADD COLUMN last_backup_date TIMESTAMP NULL DEFAULT NULL'); } catch(e) { /* already exists */ }
    try { await pool.query('ALTER TABLE users ADD COLUMN gdrive_refresh_token VARCHAR(255) DEFAULT NULL'); } catch(e) { /* already exists */ }
    try { await pool.query('ALTER TABLE arsip_files ADD COLUMN posko_id INT DEFAULT NULL'); } catch(e) { /* already exists */ }

    // Migration: posko extended columns
    try { await pool.query('ALTER TABLE posko ADD COLUMN desa VARCHAR(255) DEFAULT NULL'); } catch(e) { /* already exists */ }
    try { await pool.query('ALTER TABLE posko ADD COLUMN alamat_lengkap TEXT DEFAULT NULL'); } catch(e) { /* already exists */ }
    try { await pool.query('ALTER TABLE posko ADD COLUMN default_min_anggota INT DEFAULT 2'); } catch(e) { /* already exists */ }
    try { await pool.query('ALTER TABLE posko ADD COLUMN default_max_anggota INT DEFAULT NULL'); } catch(e) { /* already exists */ }

    // Migration: pic_groups min/max anggota
    try { await pool.query('ALTER TABLE pic_groups ADD COLUMN min_anggota INT DEFAULT NULL'); } catch(e) { /* already exists */ }
    try { await pool.query('ALTER TABLE pic_groups ADD COLUMN max_anggota INT DEFAULT NULL'); } catch(e) { /* already exists */ }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS keuangan_iuran (
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS keuangan_pengajuan (
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS buku_tamu (
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

    // Seed superadmin if not exists
    const [saRows] = await pool.query(`SELECT id FROM users WHERE role = 'superadmin' LIMIT 1`);
    if (saRows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('superadmin123', salt);
      await pool.query(
        `INSERT INTO users (nim, password, nama_lengkap, role) VALUES ('superadmin', ?, 'Super Administrator', 'superadmin')`,
        [hash]
      );
      console.log('✅ Default superadmin created (nim: superadmin, password: superadmin123)');
    }

    // Seed default KKN periode
    const [periodeRows] = await pool.query('SELECT * FROM periode_kkn LIMIT 1');
    if (periodeRows.length === 0) {
      const start = new Date(); start.setDate(1);
      const end = new Date(start); end.setMonth(start.getMonth() + 2); end.setDate(0);
      const toSqlDate = (d) => d.toISOString().split('T')[0];
      await pool.query('INSERT INTO periode_kkn (start_date, end_date) VALUES (?, ?)', [toSqlDate(start), toSqlDate(end)]);
    }

  } catch (error) {
    console.error('DB Initialization Error:', error);
  }
};
initializeDb();

// ─── EXPIRED FOLDER CLEANUP ────────────────────────────────────────────────────
const purgeExpiredFolders = async () => {
  try {
    const [expired] = await pool.query(
      'SELECT id FROM arsip_folders WHERE expired_at IS NOT NULL AND expired_at <= NOW()'
    );
    if (expired.length > 0) {
      const ids = expired.map(f => f.id);
      // Get all files in those folders (including subfolders via cascade)
      const [files] = await pool.query(
        `SELECT af.url_file FROM arsip_files af WHERE af.folder_id IN (${ids.join(',')})`
      );
      // Delete physical files
      for (const file of files) {
        const filePath = path.join(__dirname, file.url_file.replace('/uploads/', 'uploads/'));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      // Delete folders (cascade deletes subfolders and files records)
      await pool.query(`DELETE FROM arsip_folders WHERE id IN (${ids.join(',')})`);
      console.log(`🗑️  Purged ${expired.length} expired folder(s).`);
    }
  } catch (e) {
    console.error('Expired folder cleanup error:', e);
  }
};
// Run cleanup on startup and every hour
purgeExpiredFolders();
setInterval(purgeExpiredFolders, 60 * 60 * 1000);

// ─── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'active', timestamp: new Date().toISOString(), uptime: Math.round(process.uptime()) });
});

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { nim, password } = req.body;
  if (!nim || !password) return res.status(400).json({ message: 'NIM dan Password harus diisi.' });

  try {
    const [rows] = await pool.query(`
      SELECT u.*, p.nama_posko 
      FROM users u 
      LEFT JOIN posko p ON u.posko_id = p.id 
      WHERE u.nim = ?
    `, [nim]);

    if (rows.length === 0) return res.status(401).json({ message: 'NIM atau password salah.' });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'NIM atau password salah.' });

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = jwt.sign(
      {
        id: user.id,
        nim: user.nim,
        role: user.role,
        jabatan: user.jabatan,
        nama_lengkap: user.nama_lengkap,
        posko_id: user.posko_id,
        nama_posko: user.nama_posko || null
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login berhasil',
      token,
      user: {
        id: user.id,
        nim: user.nim,
        nama_lengkap: user.nama_lengkap,
        role: user.role,
        jabatan: user.jabatan,
        posko_id: user.posko_id,
        nama_posko: user.nama_posko || null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan internal server.' });
  }
});

// ─── VERIFY PASSWORD ───────────────────────────────────────────────────────────
app.post('/api/verify-password', async (req, res) => {
  const { id, password } = req.body;
  if (!id || !password) return res.status(400).json({ message: 'ID dan Password diperlukan.' });
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.' });
    const isMatch = await bcrypt.compare(password, rows[0].password);
    if (!isMatch) return res.status(401).json({ message: 'Password salah.' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Terjadi kesalahan internal server.' });
  }
});

// ─── RESOLVE SHORT LINK ────────────────────────────────────────────────────────
app.post('/api/resolve-link', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ message: 'URL dibutuhkan' });
  try {
    const followRedirects = (urlToFollow, maxRedirects = 10) => {
      return new Promise((resolve, reject) => {
        const protocol = urlToFollow.startsWith('https') ? https : http;
        protocol.get(urlToFollow, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
          if ([301,302,307,308].includes(response.statusCode) && response.headers.location) {
            if (maxRedirects === 0) return reject(new Error('Too many redirects'));
            const nextUrl = response.headers.location.startsWith('http') ? response.headers.location : new URL(response.headers.location, urlToFollow).href;
            resolve(followRedirects(nextUrl, maxRedirects - 1));
          } else { resolve(urlToFollow); }
          response.resume();
        }).on('error', reject);
      });
    };
    const finalUrl = await followRedirects(url);
    res.json({ longUrl: finalUrl });
  } catch (error) {
    res.status(500).json({ message: 'Gagal resolve link.', longUrl: url });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ─── SUPERADMIN APIs ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// GET global stats
app.get('/api/superadmin/stats', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const [[{ totalPosko }]] = await pool.query('SELECT COUNT(*) as totalPosko FROM posko');
    const [[{ totalAdmin }]] = await pool.query(`SELECT COUNT(*) as totalAdmin FROM users WHERE role = 'admin'`);
    const [[{ totalMahasiswa }]] = await pool.query(`SELECT COUNT(*) as totalMahasiswa FROM users WHERE role = 'mahasiswa'`);
    const today = new Date().toISOString().split('T')[0];
    const [[{ hadirHariIni }]] = await pool.query(`SELECT COUNT(*) as hadirHariIni FROM absensi WHERE tanggal = ? AND status IN ('hadir','telat')`, [today]);

    const [poskoStats] = await pool.query(`
      SELECT p.id, p.nama_posko,
        (SELECT COUNT(*) FROM users WHERE posko_id = p.id AND role = 'mahasiswa') as jumlah_mahasiswa,
        (SELECT COUNT(*) FROM absensi WHERE posko_id = p.id AND tanggal = ?) as hadir_hari_ini
      FROM posko p
    `, [today]);

    res.json({ totalPosko, totalAdmin, totalMahasiswa, hadirHariIni, poskoStats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil statistik.' });
  }
});

// ─── Superadmin: POSKO CRUD ────────────────────────────────────────────────────

// GET all posko
app.get('/api/superadmin/posko', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM users WHERE posko_id = p.id AND role = 'mahasiswa') as jumlah_mahasiswa,
        (SELECT COUNT(*) FROM users WHERE posko_id = p.id AND role = 'admin') as jumlah_admin
      FROM posko p ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data posko.' });
  }
});

// POST create posko
app.post('/api/superadmin/posko', authenticateToken, requireSuperadmin, async (req, res) => {
  const { nama_posko, deskripsi, lat, lng, radius, qr_secret, jam_masuk } = req.body;
  if (!nama_posko) return res.status(400).json({ message: 'Nama posko wajib diisi.' });

  const generateKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = 'KKN_';
    for (let i = 0; i < 8; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
    return key;
  };

  try {
    const secret = qr_secret || generateKey();
    const [result] = await pool.query(
      `INSERT INTO posko (nama_posko, deskripsi, lat, lng, radius, qr_secret, jam_masuk) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nama_posko, deskripsi || '', lat || 0, lng || 0, radius || 50, secret, jam_masuk || '10:00:00']
    );
    const [newPosko] = await pool.query('SELECT * FROM posko WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: newPosko[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal membuat posko.' });
  }
});

// PUT update posko
app.put('/api/superadmin/posko/:id', authenticateToken, requireSuperadmin, async (req, res) => {
  const { nama_posko, deskripsi, lat, lng, radius, qr_secret, jam_masuk } = req.body;
  if (!nama_posko) return res.status(400).json({ message: 'Nama posko wajib diisi.' });
  try {
    await pool.query(
      `UPDATE posko SET nama_posko=?, deskripsi=?, lat=?, lng=?, radius=?, qr_secret=?, jam_masuk=? WHERE id=?`,
      [nama_posko, deskripsi || '', lat || 0, lng || 0, radius || 50, qr_secret, jam_masuk || '10:00:00', req.params.id]
    );
    const [updated] = await pool.query('SELECT * FROM posko WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengupdate posko.' });
  }
});

// DELETE posko
app.delete('/api/superadmin/posko/:id', authenticateToken, requireSuperadmin, async (req, res) => {
  const posko_id = req.params.id;
  try {
    const [poskoCheck] = await pool.query('SELECT id, nama_posko FROM posko WHERE id = ?', [posko_id]);
    if (poskoCheck.length === 0) {
      return res.status(404).json({ message: 'Posko tidak ditemukan.' });
    }

    // 1. Failsafe Backup ke semua GDrive terhubung (Posko Admin/Kordes + Superadmin)
    let failsafe = { uploaded: [], failed: [], skipped: [] };
    if (req.app.locals.runFailsafeBackupForPosko) {
      try {
        console.log(`[Failsafe] Memulai backup sebelum hapus posko ${posko_id} (${poskoCheck[0].nama_posko})`);
        failsafe = await req.app.locals.runFailsafeBackupForPosko(posko_id);
        console.log(`[Failsafe] Selesai: ${failsafe.uploaded.length} sukses, ${failsafe.failed.length} gagal, ${failsafe.skipped.length} dilewati`);
      } catch (err) {
        console.error('[Failsafe] Error kritis:', err.message);
        failsafe.failed.push({ label: 'Failsafe Backup', error: err.message });
      }
    } else {
      failsafe.skipped.push({ reason: 'Layanan backup belum diinisialisasi.' });
    }

    // 2. Pembersihan Hardisk (Hard-delete fisik file)
    const [arsip] = await pool.query('SELECT url_file FROM arsip_files WHERE posko_id = ?', [posko_id]);
    const [surat] = await pool.query('SELECT file_url FROM surat_history WHERE posko_id = ?', [posko_id]);
    
    const unlinkSafe = (file_name) => {
      if (!file_name || typeof file_name !== 'string') return;
      const fullPath = path.join(uploadDir, path.basename(file_name));
      if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) {
        fs.unlinkSync(fullPath);
      }
    };

    arsip.forEach(f => unlinkSafe(f.url_file));
    surat.forEach(s => unlinkSafe(s.file_url));

    // 3. Bersihkan semua data anggota posko sebelum dihapus
    // Hapus absensi semua anggota di posko ini
    await pool.query('DELETE FROM absensi WHERE posko_id = ?', [posko_id]);

    // Hapus pic_groups posko ini → otomatis CASCADE ke pic_members, proker_tasks, logbooks
    await pool.query('DELETE FROM pic_groups WHERE posko_id = ?', [posko_id]);

    // Unassign Users & Hapus DB
    await pool.query('UPDATE users SET posko_id = NULL WHERE posko_id = ?', [posko_id]);
    await pool.query('DELETE FROM posko WHERE id = ?', [posko_id]);

    const uploadedCount = failsafe.uploaded.length;
    const failedCount = failsafe.failed.length;
    let message = 'Posko berhasil dihapus dan data telah Clean Sweep.';
    if (uploadedCount > 0) {
      message += ` Failsafe backup terkirim ke ${uploadedCount} Google Drive.`;
    } else if (failedCount > 0) {
      message += ' Failsafe backup gagal — periksa log server.';
    } else if (failsafe.skipped.length > 0) {
      message += ' Tidak ada Google Drive terhubung untuk failsafe backup.';
    }

    res.json({ success: true, message, failsafe });
  } catch (error) {
    console.error('Error Hapus Posko:', error);
    res.status(500).json({ message: 'Gagal menghapus posko: ' + error.message });
  }
});

// ─── Superadmin: USER CRUD ─────────────────────────────────────────────────────

// GET all users (superadmin)
app.get('/api/superadmin/users', authenticateToken, requireSuperadmin, async (req, res) => {
  const { search, role, posko_id } = req.query;
  try {
    let query = `
      SELECT u.id, u.nim, u.nama_lengkap, u.role, u.jabatan, u.posko_id, u.last_login, u.created_at,
             p.nama_posko
      FROM users u
      LEFT JOIN posko p ON u.posko_id = p.id
      WHERE u.role != 'superadmin'
    `;
    const params = [];
    if (search) {
      query += ' AND (u.nim LIKE ? OR u.nama_lengkap LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (role) { query += ' AND u.role = ?'; params.push(role); }
    if (posko_id) { query += ' AND u.posko_id = ?'; params.push(posko_id); }
    query += ' ORDER BY u.created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil data pengguna.' });
  }
});

// POST create user (superadmin)
app.post('/api/superadmin/users', authenticateToken, requireSuperadmin, async (req, res) => {
  const { nim, nama_lengkap, role, jabatan, posko_id, password } = req.body;
  if (!nim || !nama_lengkap || !role) return res.status(400).json({ message: 'NIM, Nama, dan Role wajib diisi.' });
  if (role !== 'superadmin' && !posko_id) return res.status(400).json({ message: 'Posko wajib dipilih untuk Admin dan Mahasiswa.' });

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE nim = ?', [nim]);
    if (existing.length > 0) return res.status(400).json({ message: 'NIM sudah terdaftar.' });

    const salt = await bcrypt.genSalt(10);
    const initPassword = password && password.trim() !== '' ? password : nim;
    const hashedPassword = await bcrypt.hash(initPassword, salt);
    const userJabatan = jabatan || (role === 'admin' ? 'Admin Posko' : 'Anggota');
    const userPoskoId = posko_id || null;

    const [result] = await pool.query(
      'INSERT INTO users (nim, password, nama_lengkap, role, jabatan, posko_id) VALUES (?, ?, ?, ?, ?, ?)',
      [nim, hashedPassword, nama_lengkap, role, userJabatan, userPoskoId]
    );

    const [newUser] = await pool.query(`
      SELECT u.id, u.nim, u.nama_lengkap, u.role, u.jabatan, u.posko_id, p.nama_posko
      FROM users u LEFT JOIN posko p ON u.posko_id = p.id WHERE u.id = ?
    `, [result.insertId]);

    res.status(201).json({ success: true, message: 'Pengguna berhasil dibuat.', data: newUser[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal membuat pengguna.' });
  }
});

// PUT update user (superadmin)
app.put('/api/superadmin/users/:id', authenticateToken, requireSuperadmin, async (req, res) => {
  const { nama_lengkap, role, jabatan, posko_id, password } = req.body;
  if (!nama_lengkap || !role) return res.status(400).json({ message: 'Nama dan Role wajib diisi.' });

  try {
    const userJabatan = jabatan || 'Anggota';
    const userPoskoId = posko_id || null;

    let query = 'UPDATE users SET nama_lengkap=?, role=?, jabatan=?, posko_id=? WHERE id=?';
    let params = [nama_lengkap, role, userJabatan, userPoskoId, req.params.id];

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password, salt);
      query = 'UPDATE users SET nama_lengkap=?, role=?, jabatan=?, posko_id=?, password=? WHERE id=?';
      params = [nama_lengkap, role, userJabatan, userPoskoId, hashed, req.params.id];
    }

    await pool.query(query, params);
    res.json({ success: true, message: 'Pengguna berhasil diperbarui.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengupdate pengguna.' });
  }
});

// DELETE user (superadmin)
app.delete('/api/superadmin/users/:id', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT role FROM users WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.' });
    if (rows[0].role === 'superadmin') return res.status(403).json({ message: 'Tidak bisa menghapus superadmin.' });
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Pengguna berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus pengguna.' });
  }
});

// GET global attendance report (superadmin)
app.get('/api/superadmin/absensi', authenticateToken, requireSuperadmin, async (req, res) => {
  const { tanggal, posko_id } = req.query;
  if (!tanggal) return res.status(400).json({ message: 'Tanggal dibutuhkan.' });
  try {
    let query = `
      SELECT a.id, a.tanggal, a.waktu, a.status, u.nim, u.nama_lengkap, p.nama_posko
      FROM absensi a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN posko p ON a.posko_id = p.id
      WHERE a.tanggal = ?
    `;
    const params = [tanggal];
    if (posko_id) { query += ' AND a.posko_id = ?'; params.push(posko_id); }
    query += ' ORDER BY p.nama_posko, a.waktu ASC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data absensi global.' });
  }
});

// GET superadmin profile (for self-update password)
app.get('/api/superadmin/profile', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, nim, nama_lengkap, role, last_login FROM users WHERE id = ?', [req.user.id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil profil.' });
  }
});

// PUT superadmin update own password
app.put('/api/superadmin/profile/password', authenticateToken, requireSuperadmin, async (req, res) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) return res.status(400).json({ message: 'Password lama dan baru wajib diisi.' });
  try {
    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(old_password, rows[0].password);
    if (!isMatch) return res.status(401).json({ message: 'Password lama salah.' });
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(new_password, salt);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ success: true, message: 'Password berhasil diperbarui.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengubah password.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ─── ADMIN POSKO APIs ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// GET posko settings (scoped to admin's posko)
app.get('/api/posko', authenticateToken, requireAdminOrAbove, async (req, res) => {
  try {
    const poskoId = req.user.posko_id;
    if (!poskoId) return res.status(404).json({ message: 'Admin tidak terikat ke posko manapun.' });
    const [rows] = await pool.query('SELECT * FROM posko WHERE id = ?', [poskoId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Data posko tidak ditemukan.' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil pengaturan posko.' });
  }
});

// POST update posko settings (scoped to admin's posko, with password verify)
app.post('/api/posko', authenticateToken, requireAdminOrAbove, async (req, res) => {
  const { adminId, password, lat, lng, radius, jam_masuk } = req.body;
  if (!adminId || !password || lat == null || lng == null || radius == null) {
    return res.status(400).json({ message: 'Data tidak lengkap.' });
  }
  try {
    const [users] = await pool.query(`SELECT * FROM users WHERE id = ? AND role IN ('admin','superadmin')`, [adminId]);
    if (users.length === 0) return res.status(404).json({ message: 'Admin tidak ditemukan.' });
    const isMatch = await bcrypt.compare(password, users[0].password);
    if (!isMatch) return res.status(401).json({ message: 'Password salah.' });

    const poskoId = req.user.posko_id;
    if (!poskoId) return res.status(400).json({ message: 'Admin tidak terikat ke posko.' });

    await pool.query(
      'UPDATE posko SET lat=?, lng=?, radius=?, jam_masuk=? WHERE id=?',
      [lat, lng, radius, jam_masuk || '10:00:00', poskoId]
    );
    const [updated] = await pool.query('SELECT * FROM posko WHERE id = ?', [poskoId]);
    res.json({ success: true, message: 'Pengaturan posko berhasil disimpan.', data: updated[0] });
  } catch (err) {
    console.error('COMPRESS ERROR:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
});

// GET QR secret for admin's posko
app.get('/api/posko/qr', authenticateToken, requireAdminOrAbove, async (req, res) => {
  try {
    const poskoId = req.user.posko_id;
    if (!poskoId) return res.status(400).json({ message: 'Admin tidak terikat ke posko.' });
    const [rows] = await pool.query('SELECT qr_secret FROM posko WHERE id = ?', [poskoId]);
    res.json({ qr_secret: rows.length > 0 ? rows[0].qr_secret : 'KKN_POSKO_2026' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil QR Secret.' });
  }
});

// POST update QR secret for admin's posko
app.post('/api/posko/qr', authenticateToken, requireAdminOrAbove, async (req, res) => {
  const { qr_secret } = req.body;
  if (!qr_secret) return res.status(400).json({ message: 'Secret tidak boleh kosong.' });
  try {
    const poskoId = req.user.posko_id;
    if (!poskoId) return res.status(400).json({ message: 'Admin tidak terikat ke posko.' });
    await pool.query('UPDATE posko SET qr_secret = ? WHERE id = ?', [qr_secret, poskoId]);
    res.json({ success: true, qr_secret });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengupdate QR Secret.' });
  }
});

// ─── PERIODE KKN ───────────────────────────────────────────────────────────────
app.get('/api/periode', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM periode_kkn ORDER BY id DESC LIMIT 1');
    res.json(rows.length > 0 ? rows[0] : null);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil periode KKN.' });
  }
});

app.post('/api/periode', authenticateToken, requireAdminOrAbove, async (req, res) => {
  const { adminId, password, start_date, end_date } = req.body;
  if (!adminId || !password || !start_date || !end_date) return res.status(400).json({ message: 'Data tidak lengkap.' });
  try {
    const [users] = await pool.query(`SELECT * FROM users WHERE id = ? AND role IN ('admin','superadmin')`, [adminId]);
    if (users.length === 0) return res.status(404).json({ message: 'Admin tidak ditemukan.' });
    const isMatch = await bcrypt.compare(password, users[0].password);
    if (!isMatch) return res.status(401).json({ message: 'Password salah.' });

    const [rows] = await pool.query('SELECT id FROM periode_kkn LIMIT 1');
    if (rows.length > 0) {
      await pool.query('UPDATE periode_kkn SET start_date=?, end_date=? WHERE id=?', [start_date, end_date, rows[0].id]);
    } else {
      await pool.query('INSERT INTO periode_kkn (start_date, end_date) VALUES (?, ?)', [start_date, end_date]);
    }
    const [updated] = await pool.query('SELECT * FROM periode_kkn ORDER BY id DESC LIMIT 1');
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// ─── USER MANAGEMENT (Admin sees only their posko) ─────────────────────────────
app.get('/api/users', authenticateToken, requireAdminOrAbove, async (req, res) => {
  const { search } = req.query;
  try {
    let query = `SELECT u.id, u.nim, u.nama_lengkap, u.role, u.jabatan, u.last_login, u.created_at, p.nama_posko
                 FROM users u LEFT JOIN posko p ON u.posko_id = p.id
                 WHERE u.role != 'superadmin'`;
    const params = [];

    // Admin only sees their own posko's mahasiswa
    if (req.user.role === 'admin' && req.user.posko_id) {
      query += ' AND u.posko_id = ?';
      params.push(req.user.posko_id);
    }

    if (search) {
      query += ' AND (u.nim LIKE ? OR u.nama_lengkap LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY u.created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Terjadi kesalahan internal server.' });
  }
});

// POST create mahasiswa (admin)
// Helper: auto-create folder 'PDD' di posko jika belum ada
const ensurePddFolder = async (poskoId) => {
  if (!poskoId) return;
  const [existing] = await pool.query(
    `SELECT id FROM arsip_folders WHERE LOWER(nama_folder) = 'pdd' AND posko_id = ? AND parent_id IS NULL LIMIT 1`,
    [poskoId]
  );
  if (existing.length === 0) {
    await pool.query(
      'INSERT INTO arsip_folders (nama_folder, parent_id, posko_id) VALUES (?, NULL, ?)',
      ['PDD', poskoId]
    );
    console.log(`[Auto] Folder PDD dibuat untuk posko_id=${poskoId}`);
  }
};

app.post('/api/users', authenticateToken, requireAdminOrAbove, async (req, res) => {
  const { nim, nama_lengkap, role, jabatan, password } = req.body;
  if (!nim || !nama_lengkap) return res.status(400).json({ message: 'NIM dan Nama wajib diisi.' });
  if (role !== 'mahasiswa') return res.status(403).json({ message: 'Admin hanya dapat membuat akun mahasiswa.' });

  try {
    const poskoId = req.user.posko_id;
    if (!poskoId) return res.status(400).json({ message: 'Admin tidak terikat ke posko manapun.' });

    const [existing] = await pool.query('SELECT id FROM users WHERE nim = ?', [nim]);
    if (existing.length > 0) return res.status(400).json({ message: 'NIM sudah terdaftar.' });

    const salt = await bcrypt.genSalt(10);
    const initPassword = password && password.trim() !== '' ? password : nim;
    const hashedPassword = await bcrypt.hash(initPassword, salt);
    const userJabatan = jabatan || 'Anggota';

    await pool.query(
      'INSERT INTO users (nim, password, nama_lengkap, role, jabatan, posko_id) VALUES (?, ?, ?, ?, ?, ?)',
      [nim, hashedPassword, nama_lengkap, 'mahasiswa', userJabatan, poskoId]
    );

    // Auto-create folder PDD jika jabatan PDD
    if (userJabatan === 'PDD') {
      await ensurePddFolder(poskoId);
    }

    res.status(201).json({ success: true, message: 'Mahasiswa berhasil ditambahkan.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal membuat pengguna.' });
  }
});

// PUT update mahasiswa (admin)
app.put('/api/users/:id', authenticateToken, requireAdminOrAbove, async (req, res) => {
  const { nama_lengkap, jabatan, password } = req.body;
  if (!nama_lengkap) return res.status(400).json({ message: 'Nama wajib diisi.' });

  try {
    const poskoId = req.user.posko_id;
    if (!poskoId) return res.status(400).json({ message: 'Admin tidak terikat ke posko manapun.' });

    const [rows] = await pool.query('SELECT role, posko_id FROM users WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.' });
    if (rows[0].posko_id !== poskoId) return res.status(403).json({ message: 'Tidak dapat mengedit mahasiswa dari posko lain.' });
    if (rows[0].role !== 'mahasiswa') return res.status(403).json({ message: 'Admin hanya dapat mengedit akun mahasiswa.' });

    const userJabatan = jabatan || 'Anggota';
    let query = 'UPDATE users SET nama_lengkap=?, jabatan=? WHERE id=? AND posko_id=?';
    let params = [nama_lengkap, userJabatan, req.params.id, poskoId];

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password, salt);
      query = 'UPDATE users SET nama_lengkap=?, jabatan=?, password=? WHERE id=? AND posko_id=?';
      params = [nama_lengkap, userJabatan, hashed, req.params.id, poskoId];
    }

    await pool.query(query, params);

    // Auto-create folder PDD jika jabatan diset ke PDD
    if (userJabatan === 'PDD') {
      await ensurePddFolder(poskoId);
    }

    res.json({ success: true, message: 'Mahasiswa berhasil diperbarui.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengupdate pengguna.' });
  }
});

// ─── ABSENSI (Admin sees only their posko) ─────────────────────────────────────
app.get('/api/absensi', authenticateToken, requireAdminOrAbove, async (req, res) => {
  const { tanggal } = req.query;
  if (!tanggal) return res.status(400).json({ message: 'Tanggal dibutuhkan.' });
  try {
    let query = `
      SELECT a.id, a.tanggal, a.waktu, a.status, a.alasan, a.user_id, u.nim, u.nama_lengkap
      FROM absensi a JOIN users u ON a.user_id = u.id
      WHERE a.tanggal = ?
    `;
    const params = [tanggal];

    if (req.user.role === 'admin' && req.user.posko_id) {
      query += ' AND a.posko_id = ?';
      params.push(req.user.posko_id);
    }
    query += ' ORDER BY a.waktu ASC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data absensi.' });
  }
});

// POST manual absensi
app.post('/api/absensi', authenticateToken, requireAdminOrAbove, async (req, res) => {
  const { user_id, tanggal, waktu, status, alasan } = req.body;
  if (!user_id || !tanggal || !waktu || !status) return res.status(400).json({ message: 'Data tidak lengkap.' });
  try {
    const poskoId = req.user.posko_id || null;
    const alasanText = status === 'izin' || status === 'sakit' ? (alasan || null) : null;
    const [existing] = await pool.query('SELECT id FROM absensi WHERE user_id = ? AND tanggal = ?', [user_id, tanggal]);
    if (existing.length > 0) {
      await pool.query('UPDATE absensi SET waktu=?, status=?, alasan=? WHERE id=?', [waktu, status, alasanText, existing[0].id]);
    } else {
      await pool.query('INSERT INTO absensi (user_id, posko_id, tanggal, waktu, status, alasan) VALUES (?, ?, ?, ?, ?, ?)', [user_id, poskoId, tanggal, waktu, status, alasanText]);
    }
    res.json({ success: true, message: 'Presensi berhasil dicatat.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal memperbarui absensi.' });
  }
});

// ─── MAHASISWA ABSENSI SELF-SERVICE ────────────────────────────────────────────
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ─── MAHASISWA PROFILE & SECURITY ─────────────────────────────────────────────
app.get('/api/mahasiswa/profile/security', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT nim, password FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.' });
    const { nim, password } = rows[0];
    const isDefaultPassword = await bcrypt.compare(nim, password);
    res.json({ isDefaultPassword, nim });
  } catch (error) {
    console.error('Security check error:', error);
    res.status(500).json({ message: 'Gagal memeriksa keamanan akun.' });
  }
});

app.put('/api/mahasiswa/profile/password', authenticateToken, async (req, res) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) {
    return res.status(400).json({ message: 'Password lama dan baru wajib diisi.' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ message: 'Password baru minimal 6 karakter.' });
  }
  try {
    const [rows] = await pool.query('SELECT nim, password FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.' });

    const { nim, password } = rows[0];
    const isMatch = await bcrypt.compare(old_password, password);
    if (!isMatch) return res.status(401).json({ message: 'Password lama salah.' });

    if (new_password === nim) {
      return res.status(400).json({ message: 'Password baru tidak boleh sama dengan NIM Anda.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(new_password, salt);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ success: true, message: 'Password berhasil diperbarui!' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Gagal mengubah password.' });
  }
});

app.get('/api/mahasiswa/absensi/status', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await pool.query('SELECT * FROM absensi WHERE user_id = ? AND tanggal = ?', [req.user.id, today]);
    res.json({ hasCheckedInToday: rows.length > 0, data: rows[0] || null });
  } catch (error) {
    res.status(500).json({ message: 'Terjadi kesalahan saat memuat status absen.' });
  }
});

app.post('/api/mahasiswa/absensi/scan', authenticateToken, async (req, res) => {
  const { qr_data, lat, lng } = req.body;
  if (!qr_data || lat === undefined || lng === undefined) {
    return res.status(400).json({ message: 'Data tidak lengkap (QR atau Lokasi tidak ditemukan).' });
  }

  try {
    // Get mahasiswa's assigned posko
    const poskoId = req.user.posko_id;
    if (!poskoId) {
      return res.status(400).json({ message: 'Anda belum ditugaskan ke posko manapun. Hubungi Admin.' });
    }

    const [poskoRows] = await pool.query('SELECT * FROM posko WHERE id = ?', [poskoId]);
    if (poskoRows.length === 0) {
      return res.status(500).json({ message: 'Data posko tidak ditemukan.' });
    }
    const posko = poskoRows[0];

    // 1. Validasi QR Secret
    if (qr_data !== posko.qr_secret) {
      return res.status(400).json({ message: `QR Code tidak valid! Pastikan Anda scan QR dari Posko ${posko.nama_posko}.` });
    }

    // 2. Cek sudah absen hari ini
    const today = new Date().toISOString().split('T')[0];
    const [existing] = await pool.query('SELECT id FROM absensi WHERE user_id = ? AND tanggal = ?', [req.user.id, today]);
    if (existing.length > 0) return res.status(400).json({ message: 'Anda sudah absen hari ini.' });

    // 3. Geofencing
    const distance = getDistanceFromLatLonInM(lat, lng, parseFloat(posko.lat), parseFloat(posko.lng));
    if (distance > posko.radius) {
      return res.status(400).json({
        message: `Gagal! Anda berada di luar jangkauan Posko ${posko.nama_posko}. (Jarak: ${Math.round(distance)}m, Maks: ${posko.radius}m)`
      });
    }

    // 4. Hitung status telat
    const wibOffset = 7 * 60;
    const now = new Date();
    const wibNow = new Date(now.getTime() + (wibOffset + now.getTimezoneOffset()) * 60000);
    const waktu = wibNow.toTimeString().split(' ')[0];

    const jamMasukStr = posko.jam_masuk || '10:00:00';
    const [limitH, limitM] = jamMasukStr.split(':').map(Number);
    const [scanH, scanM] = waktu.split(':').map(Number);
    const status = (scanH * 60 + scanM) <= (limitH * 60 + limitM) ? 'hadir' : 'telat';

    // 5. Insert absensi
    await pool.query(
      'INSERT INTO absensi (user_id, posko_id, tanggal, waktu, status) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, poskoId, today, waktu, status]
    );

    const message = status === 'hadir'
      ? `✅ Presensi berhasil di Posko ${posko.nama_posko}! Tepat waktu. (${waktu.substring(0,5)})`
      : `⚠️ Presensi tercatat di Posko ${posko.nama_posko}, tapi Anda terlambat. (${waktu.substring(0,5)}, batas ${jamMasukStr.substring(0,5)})`;

    res.json({ success: true, status, message });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan internal saat memproses presensi.' });
  }
});

// ─── MAHASISWA: Proker & Logbook ───────────────────────────────────────────────
app.get('/api/mahasiswa/proker', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT pg.id, pg.nama_pic, pg.proker, pg.folder_id, pg.min_anggota, pg.max_anggota,
             p.default_min_anggota, p.default_max_anggota
      FROM pic_groups pg 
      JOIN pic_members pm ON pg.id = pm.pic_id
      LEFT JOIN posko p ON pg.posko_id = p.id
      WHERE pm.user_id = ? LIMIT 1
    `, [req.user.id]);

    if (rows.length === 0) return res.json({ proker: null });
    const proker = rows[0];
    proker.min_anggota = proker.min_anggota ?? proker.default_min_anggota ?? 2;
    proker.max_anggota = proker.max_anggota ?? proker.default_max_anggota ?? null;

    const [members] = await pool.query(`
      SELECT u.id, u.nama_lengkap, u.nim FROM users u
      JOIN pic_members pm ON u.id = pm.user_id WHERE pm.pic_id = ?
    `, [proker.id]);

    proker.members = members;
    res.json({ proker });
  } catch (error) {
    res.status(500).json({ message: 'Error loading proker info.' });
  }
});

app.get('/api/mahasiswa/proker/tasks', authenticateToken, async (req, res) => {
  const { pic_id } = req.query;
  try {
    const [tasks] = await pool.query('SELECT * FROM proker_tasks WHERE pic_id = ? ORDER BY created_at DESC', [pic_id]);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error loading tasks.' });
  }
});

app.post('/api/mahasiswa/proker/tasks', authenticateToken, async (req, res) => {
  const { pic_id, judul, deskripsi } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO proker_tasks (pic_id, judul, deskripsi) VALUES (?, ?, ?)', [pic_id, judul, deskripsi]);
    const [newTask] = await pool.query('SELECT * FROM proker_tasks WHERE id = ?', [result.insertId]);
    res.json(newTask[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error creating task.' });
  }
});

app.put('/api/mahasiswa/proker/tasks/:id', authenticateToken, async (req, res) => {
  const { status } = req.body;
  try {
    await pool.query('UPDATE proker_tasks SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error updating task.' });
  }
});

app.get('/api/mahasiswa/logbook', authenticateToken, async (req, res) => {
  const { pic_id } = req.query;
  try {
    const [logbooks] = await pool.query(`
      SELECT l.*, u.nama_lengkap as pembuat, f.nama_folder
      FROM logbooks l JOIN users u ON l.user_id = u.id
      LEFT JOIN arsip_folders f ON l.folder_id_referensi = f.id
      WHERE l.pic_id = ? ORDER BY l.created_at DESC
    `, [pic_id]);

    for (let log of logbooks) {
      if (log.folder_id_referensi) {
        const [photos] = await pool.query('SELECT id, url_file as file_path, nama_file FROM arsip_files WHERE folder_id = ?', [log.folder_id_referensi]);
        log.photos = photos;
      } else {
        log.photos = [];
      }
    }
    res.json(logbooks);
  } catch (error) {
    res.status(500).json({ message: 'Error loading logbooks.' });
  }
});

app.post('/api/mahasiswa/logbook', authenticateToken, upload.array('photos', 10), compressImages, async (req, res) => {
  const { pic_id, deskripsi, tanggal, waktu_mulai, waktu_selesai, tempat, sasaran } = req.body;
  const files = req.files;
  if (!pic_id || !deskripsi) return res.status(400).json({ message: 'Deskripsi dan referensi proker harus diisi.' });

  try {
    const [proker] = await pool.query('SELECT folder_id, proker FROM pic_groups WHERE id = ?', [pic_id]);
    let prokerFolderId = proker[0]?.folder_id;

    if (!prokerFolderId) {
      const [fRes] = await pool.query('INSERT INTO arsip_folders (nama_folder, parent_id, posko_id) VALUES (?, NULL, ?)', [`Proker - ${proker[0].proker}`, req.user.posko_id]);
      prokerFolderId = fRes.insertId;
      await pool.query('UPDATE pic_groups SET folder_id = ? WHERE id = ?', [prokerFolderId, pic_id]);
    }

    let logbookFolderId;
    const [logbookFolders] = await pool.query('SELECT id FROM arsip_folders WHERE parent_id = ? AND nama_folder = "Logbook"', [prokerFolderId]);
    if (logbookFolders.length > 0) {
      logbookFolderId = logbookFolders[0].id;
    } else {
      const [fRes2] = await pool.query('INSERT INTO arsip_folders (nama_folder, parent_id, posko_id) VALUES (?, ?, ?)', ['Logbook', prokerFolderId, req.user.posko_id]);
      logbookFolderId = fRes2.insertId;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA');
    let dateFolderId;
    const [dateFolders] = await pool.query('SELECT id FROM arsip_folders WHERE parent_id = ? AND nama_folder = ?', [logbookFolderId, dateStr]);
    if (dateFolders.length > 0) {
      dateFolderId = dateFolders[0].id;
    } else {
      const [fRes3] = await pool.query('INSERT INTO arsip_folders (nama_folder, parent_id, posko_id) VALUES (?, ?, ?)', [dateStr, logbookFolderId, req.user.posko_id]);
      dateFolderId = fRes3.insertId;
    }

    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    const specificFolderName = `${timeStr} - ${req.user.nama_lengkap || 'Mahasiswa'}`;
    const [fRes4] = await pool.query('INSERT INTO arsip_folders (nama_folder, parent_id, posko_id) VALUES (?, ?, ?)', [specificFolderName, dateFolderId, req.user.posko_id]);
    const finalFolderId = fRes4.insertId;

    await pool.query('INSERT INTO logbooks (pic_id, user_id, tanggal, waktu_mulai, waktu_selesai, tempat, sasaran, deskripsi, folder_id_referensi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [pic_id, req.user.id, tanggal || null, waktu_mulai || null, waktu_selesai || null, tempat || null, sasaran || null, deskripsi, finalFolderId]);

    if (files && files.length > 0) {
      for (let file of files) {
        const filePath = '/uploads/' + file.filename;
        await pool.query('INSERT INTO arsip_files (folder_id, nama_file, url_file, tipe_file, posko_id) VALUES (?, ?, ?, ?, ?)',
          [finalFolderId, file.originalname, filePath, file.mimetype, req.user.posko_id]);
      }
    }
    res.json({ success: true, message: 'Logbook berhasil disimpan!' });
  } catch (error) {
    console.error('Logbook submit error:', error);
    res.status(500).json({ message: 'Gagal menyimpan logbook.' });
  }
});

// ─── FILE EXPLORER ─────────────────────────────────────────────────────────────
app.get('/api/arsip/directory', authenticateToken, async (req, res) => {
  const parentId = req.query.parentId || null;
  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const poskoId = req.user.role === 'superadmin' ? (req.query.posko_id || null) : req.user.posko_id;

  try {
    let foldersPromise, filesPromise, countPromise;
    
    const poskoCondition = poskoId ? 'posko_id = ?' : 'posko_id IS NULL';
    const poskoParam = poskoId ? [poskoId] : [];

    if (search) {
      foldersPromise = pool.query(`SELECT * FROM arsip_folders WHERE nama_folder LIKE ? AND ${poskoCondition} ORDER BY nama_folder ASC`, [`%${search}%`, ...poskoParam]);
      filesPromise = pool.query(`SELECT * FROM arsip_files WHERE nama_file LIKE ? AND ${poskoCondition} ORDER BY uploaded_at DESC LIMIT ? OFFSET ?`, [`%${search}%`, ...poskoParam, limit, offset]);
      countPromise = pool.query(`SELECT COUNT(*) as count FROM arsip_files WHERE nama_file LIKE ? AND ${poskoCondition}`, [`%${search}%`, ...poskoParam]);
    } else if (parentId) {
      foldersPromise = pool.query(`SELECT * FROM arsip_folders WHERE parent_id = ? AND ${poskoCondition} ORDER BY nama_folder ASC`, [parentId, ...poskoParam]);
      filesPromise = pool.query(`SELECT * FROM arsip_files WHERE folder_id = ? AND ${poskoCondition} ORDER BY uploaded_at DESC LIMIT ? OFFSET ?`, [parentId, ...poskoParam, limit, offset]);
      countPromise = pool.query(`SELECT COUNT(*) as count FROM arsip_files WHERE folder_id = ? AND ${poskoCondition}`, [parentId, ...poskoParam]);
    } else {
      foldersPromise = pool.query(`SELECT * FROM arsip_folders WHERE parent_id IS NULL AND ${poskoCondition} ORDER BY nama_folder ASC`, [...poskoParam]);
      filesPromise = pool.query(`SELECT * FROM arsip_files WHERE folder_id IS NULL AND ${poskoCondition} ORDER BY uploaded_at DESC LIMIT ? OFFSET ?`, [...poskoParam, limit, offset]);
      countPromise = pool.query(`SELECT COUNT(*) as count FROM arsip_files WHERE folder_id IS NULL AND ${poskoCondition}`, [...poskoParam]);
    }

    const [[folders], [files], [[{ count: totalFilesCount }]]] = await Promise.all([foldersPromise, filesPromise, countPromise]);

    res.json({ folders, files, totalFiles: totalFilesCount, page, limit, hasMore: offset + files.length < totalFilesCount });
  } catch (error) {
    console.error('Directory fetch error:', error);
    res.status(500).json({ message: 'Gagal memuat direktori.' });
  }
});

app.post('/api/arsip/folders', authenticateToken, async (req, res) => {
  const { nama_folder, parent_id } = req.body;
  const pId = parent_id || null;
  const poskoId = req.user.role === 'superadmin' ? (req.body.posko_id || null) : req.user.posko_id;

  if (!nama_folder) return res.status(400).json({ message: 'Nama folder harus diisi.' });
  try {
    const poskoCondition = poskoId ? 'posko_id = ?' : 'posko_id IS NULL';
    const poskoParam = poskoId ? [poskoId] : [];

    const query = pId === null
      ? `SELECT id FROM arsip_folders WHERE nama_folder = ? AND parent_id IS NULL AND ${poskoCondition}`
      : `SELECT id FROM arsip_folders WHERE nama_folder = ? AND parent_id = ? AND ${poskoCondition}`;
    
    const params = pId === null ? [nama_folder, ...poskoParam] : [nama_folder, pId, ...poskoParam];
    const [existing] = await pool.query(query, params);
    
    if (existing.length > 0) return res.status(400).json({ message: 'Folder dengan nama ini sudah ada.' });
    
    const [result] = await pool.query('INSERT INTO arsip_folders (nama_folder, parent_id, posko_id) VALUES (?, ?, ?)', [nama_folder, pId, poskoId]);
    res.json({ success: true, id: result.insertId, nama_folder });
  } catch (error) {
    console.error('Folder create error:', error);
    res.status(500).json({ message: 'Gagal membuat folder.' });
  }
});

app.put('/api/arsip/rename', authenticateToken, async (req, res) => {
  const { id, type, newName } = req.body;
  if (!id || !type || !newName) return res.status(400).json({ message: 'Data tidak lengkap.' });
  const poskoId = req.user.role === 'superadmin' ? null : req.user.posko_id;
  const poskoCondition = poskoId ? 'posko_id = ?' : 'posko_id IS NULL';
  const poskoParam = poskoId ? [poskoId] : [];

  try {
    if (type === 'folder') {
      await pool.query(`UPDATE arsip_folders SET nama_folder = ? WHERE id = ? AND ${poskoCondition}`, [newName, id, ...poskoParam]);
    } else {
      await pool.query(`UPDATE arsip_files SET nama_file = ? WHERE id = ? AND ${poskoCondition}`, [newName, id, ...poskoParam]);
    }
    res.json({ success: true, message: 'Berhasil mengganti nama.' });
  } catch (error) {
    console.error('Rename error:', error);
    res.status(500).json({ message: 'Gagal mengganti nama.' });
  }
});

app.put('/api/arsip/folders/:id', authenticateToken, async (req, res) => {
  const { nama_folder, parent_id } = req.body;
  const pId = parent_id || null;
  const poskoId = req.user.role === 'superadmin' ? null : req.user.posko_id;

  if (!nama_folder) return res.status(400).json({ message: 'Nama folder baru harus diisi.' });
  try {
    const poskoCondition = poskoId ? 'posko_id = ?' : '1=1'; // If superadmin, allow anywhere or we should enforce posko scope strictly. Let's strictly scope if admin.
    const poskoParam = poskoId ? [poskoId] : [];

    const query = pId === null
      ? `SELECT id FROM arsip_folders WHERE nama_folder = ? AND parent_id IS NULL AND id != ? AND ${poskoCondition}`
      : `SELECT id FROM arsip_folders WHERE nama_folder = ? AND parent_id = ? AND id != ? AND ${poskoCondition}`;
    
    const params = pId === null ? [nama_folder, req.params.id, ...poskoParam] : [nama_folder, pId, req.params.id, ...poskoParam];
    const [existing] = await pool.query(query, params);
    
    if (existing.length > 0) return res.status(400).json({ message: 'Folder dengan nama ini sudah ada.' });
    
    await pool.query(`UPDATE arsip_folders SET nama_folder = ? WHERE id = ? AND ${poskoCondition}`, [nama_folder, req.params.id, ...poskoParam]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengubah nama folder.' });
  }
});

// MULTI-DELETE
app.delete('/api/arsip/files/multi-delete', authenticateToken, async (req, res) => {
  try {
    const { file_ids, folder_ids } = req.body; // Expects arrays
    const poskoId = req.user.role === 'superadmin' ? null : req.user.posko_id;
    const poskoCondition = poskoId ? ' AND posko_id = ?' : '';
    
    // 1. Hapus Files
    if (file_ids && file_ids.length > 0) {
      const placeholders = file_ids.map(() => '?').join(',');
      const params = poskoId ? [...file_ids, poskoId] : file_ids;
      
      const [files] = await pool.query(`SELECT url_file, thumbnail_url FROM arsip_files WHERE id IN (${placeholders})${poskoCondition}`, params);
      for (const file of files) {
        if (file.url_file) {
          const fullPath = path.join(uploadDir, path.basename(file.url_file));
          if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) fs.unlinkSync(fullPath);
        }
        if (file.thumbnail_url) {
          const thumbPath = path.join(uploadDir, 'thumbnails', path.basename(file.thumbnail_url));
          if (fs.existsSync(thumbPath) && fs.lstatSync(thumbPath).isFile()) fs.unlinkSync(thumbPath);
        }
      }
      await pool.query(`DELETE FROM arsip_files WHERE id IN (${placeholders})${poskoCondition}`, params);
    }

    // 2. Hapus Folders (tidak rekursif untuk saat ini, asumsikan kosong atau hapus folder di database saja)
    if (folder_ids && folder_ids.length > 0) {
      const placeholders = folder_ids.map(() => '?').join(',');
      const params = poskoId ? [...folder_ids, poskoId] : folder_ids;
      await pool.query(`DELETE FROM arsip_folders WHERE id IN (${placeholders})${poskoCondition}`, params);
    }
    
    res.json({ success: true, message: 'Item terpilih berhasil dihapus.' });
  } catch (error) {
    console.error('Multi Delete Error:', error);
    res.status(500).json({ message: 'Gagal menghapus item.' });
  }
});


app.delete('/api/arsip/folders/:id', authenticateToken, async (req, res) => {
  try {
    const poskoId = req.user.role === 'superadmin' ? null : req.user.posko_id;
    const poskoCondition = poskoId ? ' AND posko_id = ?' : '';
    const params = poskoId ? [req.params.id, poskoId] : [req.params.id];
    
    const [result] = await pool.query(`DELETE FROM arsip_folders WHERE id = ?${poskoCondition}`, params);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Folder tidak ditemukan atau akses ditolak.' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus folder.' });
  }
});

app.delete('/api/arsip/files/:id', authenticateToken, async (req, res) => {
  try {
    const poskoId = req.user.role === 'superadmin' ? null : req.user.posko_id;
    const poskoCondition = poskoId ? ' AND posko_id = ?' : '';
    const params = poskoId ? [req.params.id, poskoId] : [req.params.id];

    const [result] = await pool.query(`DELETE FROM arsip_files WHERE id = ?${poskoCondition}`, params);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'File tidak ditemukan atau akses ditolak.' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus file.' });
  }
});

const copyFolderRecursive = async (connection, sourceFolderId, targetParentId, newFolderName = null) => {
  const [folders] = await connection.query('SELECT * FROM arsip_folders WHERE id = ?', [sourceFolderId]);
  if (folders.length === 0) return;
  const folder = folders[0];
  
  const name = newFolderName || folder.nama_folder;
  const [res] = await connection.query('INSERT INTO arsip_folders (nama_folder, parent_id, posko_id) VALUES (?, ?, ?)', [name, targetParentId, folder.posko_id]);
  const newFolderId = res.insertId;
  
  const [files] = await connection.query('SELECT * FROM arsip_files WHERE folder_id = ?', [sourceFolderId]);
  for (const file of files) {
    await connection.query('INSERT INTO arsip_files (folder_id, tipe_file, nama_file, url_file, posko_id) VALUES (?, ?, ?, ?, ?)', [newFolderId, file.tipe_file, file.nama_file, file.url_file, file.posko_id]);
  }
  
  const [subFolders] = await connection.query('SELECT * FROM arsip_folders WHERE parent_id = ?', [sourceFolderId]);
  for (const sub of subFolders) {
    await copyFolderRecursive(connection, sub.id, newFolderId);
  }
};

app.post('/api/arsip/paste', authenticateToken, async (req, res) => {
  const { type, action, id, target_folder_id } = req.body;
  const tFolder = target_folder_id || null;
  const poskoId = req.user.role === 'superadmin' ? null : req.user.posko_id;
  const poskoCondition = poskoId ? ' AND posko_id = ?' : '';
  const poskoParam = poskoId ? [poskoId] : [];

  try {
    if (type === 'file') {
      if (action === 'cut') {
        await pool.query(`UPDATE arsip_files SET folder_id = ? WHERE id = ?${poskoCondition}`, [tFolder, id, ...poskoParam]);
      } else if (action === 'copy') {
        const [rows] = await pool.query(`SELECT * FROM arsip_files WHERE id = ?${poskoCondition}`, [id, ...poskoParam]);
        if (rows.length > 0) {
          const file = rows[0];
          await pool.query('INSERT INTO arsip_files (folder_id, tipe_file, nama_file, url_file, posko_id) VALUES (?, ?, ?, ?, ?)', [tFolder, file.tipe_file, file.nama_file, file.url_file, file.posko_id]);
        }
      }
    } else if (type === 'folder') {
      if (action === 'cut') {
        await pool.query(`UPDATE arsip_folders SET parent_id = ? WHERE id = ?${poskoCondition}`, [tFolder, id, ...poskoParam]);
      } else if (action === 'copy') {
        const [rows] = await pool.query(`SELECT * FROM arsip_folders WHERE id = ?${poskoCondition}`, [id, ...poskoParam]);
        if (rows.length > 0) {
          const connection = await pool.getConnection();
          try {
            await connection.beginTransaction();
            await copyFolderRecursive(connection, id, tFolder, rows[0].nama_folder + ' (Copy)');
            await connection.commit();
          } catch (e) {
            await connection.rollback();
            throw e;
          } finally {
            connection.release();
          }
        }
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Gagal melakukan Paste.' });
  }
});

app.get('/api/arsip/download-posko/:poskoId', authenticateToken, async (req, res) => {
  try {
    const poskoId = req.params.poskoId;
    if (req.user.role !== 'superadmin' && req.user.posko_id != poskoId) {
      return res.status(403).json({ message: 'Akses ditolak.' });
    }

    const [poskoInfo] = await pool.query('SELECT nama_posko FROM posko WHERE id = ?', [poskoId]);
    const poskoName = poskoInfo.length > 0 ? poskoInfo[0].nama_posko.replace(/\s+/g, '_') : 'Posko';
    
    const dateStr = new Date().toISOString().split('T')[0];
    const zipName = `Arsip_${poskoName}_${dateStr}.zip`;

    const [allFolders] = await pool.query('SELECT id, parent_id, nama_folder FROM arsip_folders WHERE posko_id = ?', [poskoId]);
    const [files] = await pool.query('SELECT folder_id, nama_file, url_file FROM arsip_files WHERE posko_id = ?', [poskoId]);
    
    if (files.length === 0) {
      return res.status(404).json({ message: 'Tidak ada file untuk diunduh.' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('error', function(err) { throw err; });
    archive.pipe(res);

    const folderMap = new Map();
    allFolders.forEach(folder => {
      folderMap.set(folder.id, folder);
    });

    function getFolderPath(folderId) {
      if (!folderId) return '';
      const folder = folderMap.get(folderId);
      if (!folder) return '';
      const parentPath = getFolderPath(folder.parent_id);
      return parentPath ? parentPath + '/' + folder.nama_folder : folder.nama_folder;
    }

    const nameSet = new Set();
    files.forEach(file => {
      if (file.url_file) {
        const filePath = path.join(__dirname, file.url_file);
        if (fs.existsSync(filePath)) {
          const folderPath = getFolderPath(file.folder_id);
          
          let finalName = file.nama_file;
          let counter = 1;
          let archivePath = folderPath ? `${folderPath}/${finalName}` : finalName;
          
          while(nameSet.has(archivePath)) {
             const ext = path.extname(file.nama_file);
             const base = path.basename(file.nama_file, ext);
             finalName = `${base}_${counter}${ext}`;
             archivePath = folderPath ? `${folderPath}/${finalName}` : finalName;
             counter++;
          }
          nameSet.add(archivePath);
          archive.file(filePath, { name: archivePath });
        }
      }
    });

    await archive.finalize();
  } catch (error) {
    console.error("Error creating zip:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Gagal membuat file ZIP' });
    }
  }
});


// HELPER: Generate Unique Filename
const getUniqueFileName = async (originalName, folderId, poskoId) => {
  let name = originalName;
  let counter = 1;
  const extMatch = originalName.match(/(.*)(\.[^.]+)$/);
  const base = extMatch ? extMatch[1] : originalName;
  const ext = extMatch ? extMatch[2] : '';

  while (true) {
    const query = folderId 
      ? 'SELECT id FROM arsip_files WHERE nama_file = ? AND folder_id = ? AND posko_id = ?'
      : 'SELECT id FROM arsip_files WHERE nama_file = ? AND folder_id IS NULL AND posko_id = ?';
    const params = folderId ? [name, folderId, poskoId] : [name, poskoId];
    
    const [rows] = await pool.query(query, params);
    if (rows.length === 0) break;
    
    name = `${base}(${counter})${ext}`;
    counter++;
  }
  return name;
};

app.post('/api/arsip/upload', authenticateToken, upload.single('file'), compressImages, async (req, res) => {
  let folder_id = req.body.folder_id;
  if (folder_id === 'null' || folder_id === '' || !folder_id) folder_id = null;
  else folder_id = parseInt(folder_id, 10);
  const poskoId = req.user.role === 'superadmin' ? (req.body.posko_id || null) : req.user.posko_id;

  if (!req.file) return res.status(400).json({ message: 'File kosong.' });

  const mimetype = req.file.mimetype;
  let tipe_file = 'document';
  if (mimetype.startsWith('image/')) tipe_file = 'image';
  else if (mimetype.startsWith('video/')) tipe_file = 'video';
  else if (mimetype === 'application/pdf') tipe_file = 'pdf';

  const url_file = `/uploads/${req.file.filename}`;
  let nama_file = req.file.originalname;
  if (req.body.custom_name && req.body.custom_name.trim() !== '') {
    nama_file = req.body.custom_name.trim();
    const ext = path.extname(req.file.originalname);
    if (!nama_file.endsWith(ext) && ext) {
      nama_file += ext;
    }
  }
  let thumbnail_url = null;

  if (tipe_file === 'image') {
    try {
      const thumbFilename = `thumb_${req.file.filename}`;
      const thumbPath = path.join(thumbDir, thumbFilename);
      await sharp(req.file.path).resize(240, 200, { fit: 'cover', position: 'center' }).jpeg({ quality: 80 }).toFile(thumbPath);
      thumbnail_url = `/uploads/thumbnails/${thumbFilename}`;
    } catch (thumbErr) {
      console.error('Thumbnail generation failed:', thumbErr.message);
    }
  }

  try {
    await pool.query('INSERT INTO arsip_files (folder_id, tipe_file, nama_file, url_file, thumbnail_url, posko_id) VALUES (?, ?, ?, ?, ?, ?)',
      [folder_id, tipe_file, nama_file, url_file, thumbnail_url, poskoId]);
    res.json({ success: true, message: 'File berhasil diunggah.' });
  } catch (error) {
    console.error('Upload DB Error:', error);
    res.status(500).json({ message: 'Gagal menyimpan file ke database.' });
  }
});

// MULTI-UPLOAD
app.post('/api/arsip/upload/multi', authenticateToken, upload.array('files', 100), compressImages, async (req, res) => {
  let folder_id = req.body.folder_id;
  if (folder_id === 'null' || folder_id === '' || !folder_id) folder_id = null;
  else folder_id = parseInt(folder_id, 10);
  const poskoId = req.user.role === 'superadmin' ? (req.body.posko_id || null) : req.user.posko_id;

  if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'Tidak ada file yang diunggah.' });

  try {
    for (const file of req.files) {
      const mimetype = file.mimetype;
      let tipe_file = 'document';
      if (mimetype.startsWith('image/')) tipe_file = 'image';
      else if (mimetype.startsWith('video/')) tipe_file = 'video';
      else if (mimetype === 'application/pdf') tipe_file = 'pdf';

      const url_file = `/uploads/${file.filename}`;
      let nama_file = file.originalname;
      if (req.body.custom_name && req.files.length === 1) {
        // preserve the extension
        const ext = path.extname(file.originalname);
        nama_file = req.body.custom_name.endsWith(ext) ? req.body.custom_name : req.body.custom_name + ext;
      }
      let thumbnail_url = null;

      if (tipe_file === 'image') {
        try {
          const thumbFilename = `thumb_${file.filename}`;
          const thumbPath = path.join(thumbDir, thumbFilename);
          await sharp(file.path).resize(240, 200, { fit: 'cover', position: 'center' }).jpeg({ quality: 80 }).toFile(thumbPath);
          thumbnail_url = `/uploads/thumbnails/${thumbFilename}`;
        } catch (thumbErr) {
          console.error('Thumbnail generation failed for', file.originalname, thumbErr.message);
        }
      }

      await pool.query('INSERT INTO arsip_files (folder_id, tipe_file, nama_file, url_file, thumbnail_url, posko_id) VALUES (?, ?, ?, ?, ?, ?)',
        [folder_id, tipe_file, nama_file, url_file, thumbnail_url, poskoId]);
    }
    res.json({ success: true, message: `${req.files.length} File berhasil diunggah.` });
  } catch (error) {
    console.error('Multi Upload DB Error:', error);
    res.status(500).json({ message: 'Gagal menyimpan file ke database.' });
  }
});

// COMPRESS MANUAL
app.post('/api/arsip/compress', authenticateToken, async (req, res) => {
  try {
    const { file_ids, folder_id, zip_name } = req.body;
    const poskoId = req.user.role === 'superadmin' ? null : req.user.posko_id;
    const poskoCondition = poskoId ? ' AND posko_id = ?' : '';
    
    if (!file_ids || file_ids.length === 0) return res.status(400).json({ message: 'Tidak ada file yang dipilih.' });

    const placeholders = file_ids.map(() => '?').join(',');
    const params = poskoId ? [...file_ids, poskoId] : file_ids;
    const [files] = await pool.query(`SELECT nama_file, url_file FROM arsip_files WHERE id IN (${placeholders})${poskoCondition}`, params);

    const safeZipName = (zip_name || 'arsip_compressed').replace(/\.zip$/i, '') + '.zip';
    const uniqueZipName = Date.now() + '-' + safeZipName;
    const zipPath = path.join(uploadDir, uniqueZipName);
    const output = fs.createWriteStream(zipPath);
    // Fix: gunakan archiver('zip', options) bukan new archiver.ZipArchive(...)
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Wrap dalam Promise agar bisa await dan response dikirim setelah selesai
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);
      archive.pipe(output);

      files.forEach(f => {
        if (f.url_file) {
          const fullPath = path.join(uploadDir, path.basename(f.url_file));
          if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) {
            archive.file(fullPath, { name: f.nama_file });
          }
        }
      });
      archive.finalize();
    });

    // Simpan ke DB setelah archive selesai
    const url_file = `/uploads/${uniqueZipName}`;
    await pool.query('INSERT INTO arsip_files (folder_id, tipe_file, nama_file, url_file, posko_id) VALUES (?, ?, ?, ?, ?)',
      [folder_id || null, 'document', safeZipName, url_file, req.user.posko_id || null]);
    res.json({ success: true, message: 'File berhasil dikompresi.' });
  } catch (error) {
    console.error('Compress Error:', error);
    res.status(500).json({ message: 'Gagal melakukan kompresi.', error: error.message || String(error) });
  }
});


// EXTRACT MANUAL
app.post('/api/arsip/extract', authenticateToken, async (req, res) => {
  try {
    const { file_id, extract_mode, new_folder_name } = req.body;
    const poskoId = req.user.role === 'superadmin' ? null : req.user.posko_id;
    const poskoCondition = poskoId ? ' AND posko_id = ?' : '';
    
    const [files] = await pool.query(`SELECT * FROM arsip_files WHERE id = ?${poskoCondition}`, poskoId ? [file_id, poskoId] : [file_id]);
    if (files.length === 0) return res.status(404).json({ message: 'File ZIP tidak ditemukan.' });
    
    const file = files[0];
    if (!file.url_file || !file.nama_file.toLowerCase().endsWith('.zip')) {
      return res.status(400).json({ message: 'File tidak valid atau bukan ZIP.' });
    }

    const zipPath = path.join(uploadDir, path.basename(file.url_file));
    if (!fs.existsSync(zipPath)) return res.status(404).json({ message: 'File fisik ZIP hilang dari peladen.' });

    let targetFolderId = file.folder_id;
    if (extract_mode === 'new_folder') {
      const folderName = new_folder_name || file.nama_file.replace('.zip', '');
      const [insertRes] = await pool.query('INSERT INTO arsip_folders (nama_folder, parent_id, posko_id) VALUES (?, ?, ?)',
        [folderName, file.folder_id, req.user.posko_id || null]);
      targetFolderId = insertRes.insertId;
    }

    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();

    for (const zipEntry of zipEntries) {
      if (zipEntry.isDirectory) continue;
      
      const originalName = zipEntry.name;
      // Filter out mac os hidden files
      if (originalName.startsWith('._') || originalName === '.DS_Store') continue;

      const buffer = zipEntry.getData();
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(originalName);
      const savePath = path.join(uploadDir, uniqueName);
      fs.writeFileSync(savePath, buffer);

      const url_file = `/uploads/${uniqueName}`;
      
      let tipe_file = 'document';
      const ext = path.extname(originalName).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) tipe_file = 'image';
      else if (['.mp4', '.avi', '.mov'].includes(ext)) tipe_file = 'video';
      else if (ext === '.pdf') tipe_file = 'pdf';

      let thumbnail_url = null;
      if (tipe_file === 'image') {
        try {
          const thumbFilename = `thumb_${uniqueName}`;
          const thumbPath = path.join(thumbDir, thumbFilename);
          await sharp(savePath).resize(240, 200, { fit: 'cover', position: 'center' }).jpeg({ quality: 80 }).toFile(thumbPath);
          thumbnail_url = `/uploads/thumbnails/${thumbFilename}`;
        } catch (e) {
           console.error('Thumb extraction err', e);
        }
      }

      await pool.query('INSERT INTO arsip_files (folder_id, tipe_file, nama_file, url_file, thumbnail_url, posko_id) VALUES (?, ?, ?, ?, ?, ?)',
        [targetFolderId, tipe_file, originalName, url_file, thumbnail_url, req.user.posko_id || null]);
    }
    
    res.json({ success: true, message: 'Berhasil mengekstrak file.' });
  } catch (error) {
    console.error('Extract Error:', error);
    res.status(500).json({ message: 'Gagal mengekstrak ZIP: ' + error.message });
  }
});

app.post('/api/arsip/link', authenticateToken, async (req, res) => {
  let folder_id = req.body.folder_id;
  if (folder_id === 'null' || folder_id === '' || !folder_id) folder_id = null;
  else folder_id = parseInt(folder_id, 10);
  
  const poskoId = req.user.role === 'superadmin' ? (req.body.posko_id || null) : req.user.posko_id;
  const { nama_file, url_file } = req.body;

  if (!nama_file || !url_file) {
    return res.status(400).json({ message: 'Keterangan dan URL Tautan wajib diisi.' });
  }

  try {
    await pool.query('INSERT INTO arsip_files (folder_id, tipe_file, nama_file, url_file, posko_id) VALUES (?, ?, ?, ?, ?)',
      [folder_id, 'link', nama_file, url_file, poskoId]);
    res.json({ success: true, message: 'Tautan berhasil disimpan.' });
  } catch (error) {
    console.error('Save Link DB Error:', error);
    res.status(500).json({ message: 'Gagal menyimpan tautan ke database.' });
  }
});

// ─── DOWNLOAD SINGLE FOLDER AS ZIP ────────────────────────────────────────────
app.get('/api/arsip/download-folder/:folderId', authenticateToken, requireAdminOrAbove, async (req, res) => {
  const folderId = req.params.folderId;
  try {
    const [folderRows] = await pool.query('SELECT * FROM arsip_folders WHERE id = ?', [folderId]);
    if (folderRows.length === 0) return res.status(404).json({ message: 'Folder tidak ditemukan.' });
    const folder = folderRows[0];

    const [files] = await pool.query('SELECT * FROM arsip_files WHERE folder_id = ?', [folderId]);

    if (files.length === 0) {
      return res.status(404).json({ message: 'Folder ini kosong, tidak ada file untuk diunduh.' });
    }

    const zipName = `${folder.nama_folder.replace(/[\\/:*?"<>|⚠️\[\]]/g, '').trim()}_${Date.now()}.zip`;
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
    res.setHeader('Content-Type', 'application/zip');

    const { ZipArchive } = await import('archiver');
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('error', (err) => { throw err; });
    archive.pipe(res);

    for (const file of files) {
      const filePath = path.join(__dirname, file.url_file.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: file.nama_file });
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error('Download folder ZIP error:', error);
    if (!res.headersSent) res.status(500).json({ message: 'Gagal membuat file ZIP.' });
  }
});

// ─── PIC GROUPS ────────────────────────────────────────────────────────────────
app.get('/api/users/mahasiswa', authenticateToken, requireAdminOrAbove, async (req, res) => {
  try {
    let query = 'SELECT id, nim, nama_lengkap FROM users WHERE role = "mahasiswa"';
    const params = [];
    if (req.user.role === 'admin' && req.user.posko_id) {
      query += ' AND posko_id = ?';
      params.push(req.user.posko_id);
    }
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data mahasiswa.' });
  }
});

app.get('/api/pic', authenticateToken, requireAdminOrAbove, async (req, res) => {
  try {
    let query = 'SELECT pg.*, p.default_min_anggota, p.default_max_anggota FROM pic_groups pg LEFT JOIN posko p ON pg.posko_id = p.id';
    const params = [];
    if (req.user.role === 'admin' && req.user.posko_id) {
      query += ' WHERE pg.posko_id = ?';
      params.push(req.user.posko_id);
    }
    query += ' ORDER BY pg.created_at DESC';
    const [groups] = await pool.query(query, params);

    const [members] = await pool.query(`
      SELECT pm.pic_id, pm.user_id, u.nama_lengkap FROM pic_members pm JOIN users u ON pm.user_id = u.id
    `);

    const result = groups.map(group => ({
      ...group,
      min_anggota: group.min_anggota ?? group.default_min_anggota ?? 2,
      max_anggota: group.max_anggota ?? group.default_max_anggota ?? null,
      members: members.filter(m => m.pic_id === group.id).map(m => m.nama_lengkap),
      member_ids: members.filter(m => m.pic_id === group.id).map(m => m.user_id)
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data PIC.' });
  }
});

app.put('/api/pic/:id', authenticateToken, requireAdminOrAbove, async (req, res) => {
  const { nama_pic, proker, mahasiswa_ids } = req.body;
  const picId = req.params.id;
  if (!nama_pic || !proker || !mahasiswa_ids || mahasiswa_ids.length === 0) {
    return res.status(400).json({ message: 'Data PIC tidak valid (Pilih minimal 1 mahasiswa).' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get current PIC to find folder_id
    const [picRows] = await connection.query('SELECT * FROM pic_groups WHERE id = ?', [picId]);
    if (picRows.length === 0) return res.status(404).json({ message: 'PIC tidak ditemukan.' });
    const pic = picRows[0];

    // Update pic_groups
    await connection.query('UPDATE pic_groups SET nama_pic = ?, proker = ? WHERE id = ?', [nama_pic, proker, picId]);

    // Update folder name if folder exists
    if (pic.folder_id) {
      const newFolderName = `${nama_pic} [${proker}]`;
      await connection.query('UPDATE arsip_folders SET nama_folder = ? WHERE id = ?', [newFolderName, pic.folder_id]);
    }

    // Replace members
    await connection.query('DELETE FROM pic_members WHERE pic_id = ?', [picId]);
    for (const userId of mahasiswa_ids) {
      await connection.query('INSERT INTO pic_members (pic_id, user_id) VALUES (?, ?)', [picId, userId]);
    }

    await connection.commit();
    res.json({ success: true, message: 'Kelompok PIC berhasil diperbarui.' });
  } catch (error) {
    await connection.rollback();
    console.error('PIC update error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat memperbarui PIC.' });
  } finally {
    connection.release();
  }
});

// --- UPDATE SETTINGS PIC (MIN/MAX) ---
app.put('/api/pic/:id/settings', authenticateToken, requireAdminOrAbove, async (req, res) => {
  const { min_anggota, max_anggota } = req.body;
  const picId = req.params.id;
  
  try {
    const min = parseInt(min_anggota) || 2;
    const max = max_anggota ? parseInt(max_anggota) : null;
    
    // Pastikan milik posko yang sama (jika admin)
    let query = 'UPDATE pic_groups SET min_anggota = ?, max_anggota = ? WHERE id = ?';
    let params = [min, max, picId];
    
    if (req.user.role === 'admin' && req.user.posko_id) {
      query += ' AND posko_id = ?';
      params.push(req.user.posko_id);
    }
    
    const [result] = await pool.query(query, params);
    if (result.affectedRows === 0) {
       return res.status(404).json({ message: 'PIC tidak ditemukan atau bukan milik posko Anda.' });
    }
    
    res.json({ success: true, message: 'Pengaturan batas anggota berhasil disimpan.' });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat menyimpan pengaturan.' });
  }
});

// --- UPDATE SETTINGS GLOBAL POSKO ---
app.put('/api/admin/posko/settings', authenticateToken, requireAdminOrAbove, async (req, res) => {
  const { default_min_anggota, default_max_anggota } = req.body;
  if (req.user.role !== 'admin' || !req.user.posko_id) {
    return res.status(403).json({ message: 'Hanya admin posko yang dapat mengubah pengaturan ini.' });
  }
  
  try {
    const min = parseInt(default_min_anggota) || 2;
    const max = default_max_anggota ? parseInt(default_max_anggota) : null;
    
    await pool.query('UPDATE posko SET default_min_anggota = ?, default_max_anggota = ? WHERE id = ?', 
      [min, max, req.user.posko_id]);
      
    res.json({ success: true, message: 'Pengaturan batas Global Posko berhasil disimpan.' });
  } catch (error) {
    console.error('Posko settings update error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat menyimpan pengaturan posko.' });
  }
});

app.delete('/api/pic/:id', authenticateToken, requireAdminOrAbove, async (req, res) => {
  const picId = req.params.id;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get PIC and its folder
    const [picRows] = await connection.query('SELECT * FROM pic_groups WHERE id = ?', [picId]);
    if (picRows.length === 0) return res.status(404).json({ message: 'PIC tidak ditemukan.' });
    const pic = picRows[0];

    // Soft-delete the folder: mark as expired in 24 hours and rename
    if (pic.folder_id) {
      const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam dari sekarang
      const expiredName = `⚠️ [EXPIRED] ${pic.nama_pic} [${pic.proker}]`;
      await connection.query(
        'UPDATE arsip_folders SET nama_folder = ?, expired_at = ? WHERE id = ?',
        [expiredName, expiredAt, pic.folder_id]
      );
    }

    // Delete PIC (cascades to pic_members, proker_tasks, logbooks)
    await connection.query('DELETE FROM pic_groups WHERE id = ?', [picId]);

    await connection.commit();
    res.json({ success: true, message: 'Kelompok PIC dihapus. Folder arsip masih tersedia selama 24 jam.' });
  } catch (error) {
    await connection.rollback();
    console.error('PIC delete error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat menghapus PIC.' });
  } finally {
    connection.release();
  }
});

app.post('/api/pic', authenticateToken, requireAdminOrAbove, async (req, res) => {
  const { nama_pic, proker, mahasiswa_ids } = req.body;
  if (!nama_pic || !proker || !mahasiswa_ids || mahasiswa_ids.length === 0) {
    return res.status(400).json({ message: 'Data PIC tidak valid (Pilih minimal 1 mahasiswa).' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const poskoId = req.user.posko_id || null;
    const folderName = `${nama_pic} [${proker}]`;
    const [folderResult] = await connection.query('INSERT INTO arsip_folders (nama_folder, parent_id, posko_id) VALUES (?, NULL, ?)', [folderName, poskoId]);
    const folderId = folderResult.insertId;
    const [picResult] = await connection.query('INSERT INTO pic_groups (nama_pic, proker, folder_id, posko_id, min_anggota, max_anggota) VALUES (?, ?, ?, ?, NULL, NULL)', [nama_pic, proker, folderId, poskoId]);
    const picId = picResult.insertId;
    for (const userId of mahasiswa_ids) {
      await connection.query('INSERT INTO pic_members (pic_id, user_id) VALUES (?, ?)', [picId, userId]);
    }
    await connection.commit();
    res.json({ success: true, message: 'Kelompok PIC berhasil dibuat.' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: 'Terjadi kesalahan sistem.' });
  } finally {
    connection.release();
  }
});

// ─── BENDAHARA (KEUANGAN) ──────────────────────────────────────────────────────

app.get('/api/bendahara/kategori', authenticateToken, async (req, res) => {
  try {
    const [kategori] = await pool.query('SELECT * FROM keuangan_kategori WHERE posko_id = ? ORDER BY id ASC', [req.user.posko_id]);
    res.json(kategori);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil kategori.' });
  }
});

app.post('/api/bendahara/kategori', authenticateToken, async (req, res) => {
  if (req.user.jabatan !== 'Bendahara' && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { nama_kategori, plafon_dana } = req.body;
  if (!nama_kategori) return res.status(400).json({ message: 'Nama Kategori harus diisi' });
  try {
    await pool.query('INSERT INTO keuangan_kategori (posko_id, nama_kategori, plafon_dana) VALUES (?, ?, ?)', [req.user.posko_id, nama_kategori, plafon_dana || 0]);
    res.json({ success: true, message: 'Kategori berhasil ditambahkan.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menambah kategori.' });
  }
});

app.put('/api/bendahara/kategori/:id', authenticateToken, async (req, res) => {
  if (req.user.jabatan !== 'Bendahara' && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { nama_kategori, plafon_dana } = req.body;
  try {
    await pool.query('UPDATE keuangan_kategori SET nama_kategori = ?, plafon_dana = ? WHERE id = ? AND posko_id = ?', [nama_kategori, plafon_dana, req.params.id, req.user.posko_id]);
    res.json({ success: true, message: 'Kategori berhasil diubah.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengubah kategori.' });
  }
});

app.delete('/api/bendahara/kategori/:id', authenticateToken, async (req, res) => {
  if (req.user.jabatan !== 'Bendahara' && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  try {
    await pool.query('DELETE FROM keuangan_kategori WHERE id = ? AND posko_id = ?', [req.params.id, req.user.posko_id]);
    res.json({ success: true, message: 'Kategori berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus kategori.' });
  }
});

app.get('/api/bendahara/transaksi', authenticateToken, async (req, res) => {
  try {
    const [transaksi] = await pool.query(`
      SELECT t.*, k.nama_kategori, f.url_file as nota_url 
      FROM keuangan_transaksi t
      LEFT JOIN keuangan_kategori k ON t.kategori_id = k.id
      LEFT JOIN arsip_files f ON t.file_nota_id = f.id
      WHERE t.posko_id = ?
      ORDER BY t.tanggal DESC, t.id DESC
    `, [req.user.posko_id]);
    res.json(transaksi);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil transaksi.' });
  }
});

app.post('/api/bendahara/transaksi', authenticateToken, upload.single('nota'), compressImages, async (req, res) => {
  if (req.user.jabatan !== 'Bendahara' && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { kategori_id, jenis, nominal, tanggal, keterangan } = req.body;
  const file = req.file;

  if (!jenis || !nominal || !tanggal || !keterangan) {
    return res.status(400).json({ message: 'Mohon lengkapi form transaksi.' });
  }

  try {
    let fileId = null;
    
    // Handle File Upload
    if (file) {
      // Create or get Keuangan Root Folder
      let keuanganFolderId;
      const [keuanganFolders] = await pool.query('SELECT id FROM arsip_folders WHERE parent_id IS NULL AND nama_folder = "Keuangan" AND posko_id = ?', [req.user.posko_id]);
      if (keuanganFolders.length > 0) {
        keuanganFolderId = keuanganFolders[0].id;
      } else {
        const [fRes] = await pool.query('INSERT INTO arsip_folders (nama_folder, parent_id, posko_id) VALUES (?, NULL, ?)', ['Keuangan', req.user.posko_id]);
        keuanganFolderId = fRes.insertId;
      }

      // Create Date Folder
      let dateFolderId;
      const [dateFolders] = await pool.query('SELECT id FROM arsip_folders WHERE parent_id = ? AND nama_folder = ? AND posko_id = ?', [keuanganFolderId, tanggal, req.user.posko_id]);
      if (dateFolders.length > 0) {
        dateFolderId = dateFolders[0].id;
      } else {
        const [fRes2] = await pool.query('INSERT INTO arsip_folders (nama_folder, parent_id, posko_id) VALUES (?, ?, ?)', [tanggal, keuanganFolderId, req.user.posko_id]);
        dateFolderId = fRes2.insertId;
      }

      const filePath = '/uploads/' + file.filename;
      const [fRes3] = await pool.query('INSERT INTO arsip_files (folder_id, nama_file, url_file, tipe_file, posko_id) VALUES (?, ?, ?, ?, ?)',
        [dateFolderId, file.originalname, filePath, file.mimetype, req.user.posko_id]);
      fileId = fRes3.insertId;
    }

    await pool.query(
      'INSERT INTO keuangan_transaksi (posko_id, kategori_id, jenis, nominal, tanggal, keterangan, file_nota_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.posko_id, kategori_id || null, jenis, nominal, tanggal, keterangan, fileId, req.user.id]
    );

    res.json({ success: true, message: 'Transaksi berhasil dicatat.' });
  } catch (error) {
    console.error('Transaksi error:', error);
    res.status(500).json({ message: 'Gagal mencatat transaksi.' });
  }
});

app.delete('/api/bendahara/transaksi/:id', authenticateToken, async (req, res) => {
  if (req.user.jabatan !== 'Bendahara' && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  try {
    await pool.query('DELETE FROM keuangan_transaksi WHERE id = ? AND posko_id = ?', [req.params.id, req.user.posko_id]);
    res.json({ success: true, message: 'Transaksi berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus transaksi.' });
  }
});

app.get('/api/bendahara/keuangan-folder', authenticateToken, async (req, res) => {
  try {
    let keuanganFolderId;
    const [folders] = await pool.query('SELECT id FROM arsip_folders WHERE parent_id IS NULL AND nama_folder = "Keuangan" AND posko_id = ?', [req.user.posko_id]);
    if (folders.length > 0) {
      keuanganFolderId = folders[0].id;
    } else {
      const [fRes] = await pool.query('INSERT INTO arsip_folders (nama_folder, parent_id, posko_id) VALUES (?, NULL, ?)', ['Keuangan', req.user.posko_id]);
      keuanganFolderId = fRes.insertId;
    }
    res.json({ id: keuanganFolderId });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memuat folder keuangan.' });
  }
});

app.get('/api/bendahara/summary', authenticateToken, async (req, res) => {
  try {
    const [masukRes] = await pool.query('SELECT SUM(nominal) as total FROM keuangan_transaksi WHERE jenis="pemasukan" AND posko_id=?', [req.user.posko_id]);
    const [keluarRes] = await pool.query('SELECT SUM(nominal) as total FROM keuangan_transaksi WHERE jenis="pengeluaran" AND posko_id=?', [req.user.posko_id]);
    
    const totalPemasukan = masukRes[0].total || 0;
    const totalPengeluaran = keluarRes[0].total || 0;
    const saldo = totalPemasukan - totalPengeluaran;

    // Get per category for pengeluaran
    const [kategoriRes] = await pool.query(`
      SELECT k.id, k.nama_kategori, k.plafon_dana, SUM(t.nominal) as total_pengeluaran
      FROM keuangan_kategori k
      LEFT JOIN keuangan_transaksi t ON k.id = t.kategori_id AND t.jenis = 'pengeluaran'
      WHERE k.posko_id = ?
      GROUP BY k.id
    `, [req.user.posko_id]);

    res.json({
      saldo,
      totalPemasukan,
      totalPengeluaran,
      kategori: kategoriRes
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memuat ringkasan keuangan.' });
  }
});

// ─── FITUR IURAN ANGGOTA ────────────────────────────────────────────────────────
app.get('/api/bendahara/iuran', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id as user_id, u.nim, u.nama_lengkap, u.jabatan,
             COALESCE(i.nominal_target, 0) as nominal_target,
             COALESCE(i.nominal_terbayar, 0) as nominal_terbayar,
             COALESCE(i.status, 'belum') as status
      FROM users u
      LEFT JOIN keuangan_iuran i ON u.id = i.user_id AND i.posko_id = ?
      WHERE u.posko_id = ? AND u.role != 'superadmin'
      ORDER BY u.nama_lengkap ASC
    `, [req.user.posko_id, req.user.posko_id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data iuran.' });
  }
});

app.post('/api/bendahara/iuran/target', authenticateToken, async (req, res) => {
  if (req.user.jabatan !== 'Bendahara' && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  try {
    const { nominal_target } = req.body;
    const [users] = await pool.query('SELECT id FROM users WHERE posko_id = ? AND role != "superadmin"', [req.user.posko_id]);
    
    for (const u of users) {
      await pool.query(`
        INSERT INTO keuangan_iuran (posko_id, user_id, nominal_target)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE nominal_target = ?
      `, [req.user.posko_id, u.id, nominal_target, nominal_target]);
    }
    res.json({ success: true, message: 'Target iuran berhasil diperbarui.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui target iuran.' });
  }
});

app.post('/api/bendahara/iuran/bayar', authenticateToken, async (req, res) => {
  if (req.user.jabatan !== 'Bendahara' && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { user_id, nominal_bayar } = req.body;
  try {
    const [rows] = await pool.query('SELECT nominal_target, nominal_terbayar FROM keuangan_iuran WHERE posko_id = ? AND user_id = ?', [req.user.posko_id, user_id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Data iuran tidak ditemukan. Set target dulu.' });
    
    const target = Number(rows[0].nominal_target);
    const newTerbayar = Number(rows[0].nominal_terbayar) + Number(nominal_bayar);
    let status = 'belum';
    if (newTerbayar > 0) status = 'sebagian';
    if (newTerbayar >= target && target > 0) status = 'lunas';
    
    await pool.query(`
      UPDATE keuangan_iuran 
      SET nominal_terbayar = ?, status = ? 
      WHERE posko_id = ? AND user_id = ?
    `, [newTerbayar, status, req.user.posko_id, user_id]);
    
    const [uRows] = await pool.query('SELECT nama_lengkap FROM users WHERE id = ?', [user_id]);
    const nama = uRows[0]?.nama_lengkap || 'Anggota';
    
    await pool.query(`
      INSERT INTO keuangan_transaksi (posko_id, jenis, nominal, tanggal, keterangan, user_id)
      VALUES (?, 'pemasukan', ?, CURDATE(), ?, ?)
    `, [req.user.posko_id, nominal_bayar, `Iuran anggota: ${nama}`, req.user.id]);
    
    res.json({ success: true, message: 'Pembayaran berhasil dicatat.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mencatat pembayaran iuran.' });
  }
});

// ─── FITUR PENGAJUAN REIMBURSEMENT ──────────────────────────────────────────────
app.get('/api/bendahara/pengajuan', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT p.*, u.nama_lengkap, u.jabatan AS pengaju_jabatan, k.nama_kategori 
      FROM keuangan_pengajuan p
      JOIN users u ON p.user_id = u.id
      JOIN keuangan_kategori k ON p.kategori_id = k.id
      WHERE p.posko_id = ?
    `;
    const params = [req.user.posko_id];
    if (req.user.jabatan !== 'Bendahara' && req.user.role !== 'admin') {
      query += ` AND p.user_id = ?`;
      params.push(req.user.id);
    }
    query += ' ORDER BY p.created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data pengajuan.' });
  }
});

app.post('/api/bendahara/pengajuan', authenticateToken, upload.single('nota'), compressImages, async (req, res) => {
  const { kategori_id, nominal, keterangan } = req.body;
  let file_nota_url = null;
  if (req.file) {
    file_nota_url = `/uploads/${req.file.filename}`;
  }
  try {
    await pool.query(`
      INSERT INTO keuangan_pengajuan (posko_id, user_id, kategori_id, nominal, keterangan, file_nota_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [req.user.posko_id, req.user.id, kategori_id, nominal, keterangan, file_nota_url]);
    res.json({ success: true, message: 'Pengajuan berhasil dikirim.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengirim pengajuan.' });
  }
});

app.put('/api/bendahara/pengajuan/:id/status', authenticateToken, async (req, res) => {
  if (req.user.jabatan !== 'Bendahara' && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { status, catatan_bendahara } = req.body;
  try {
    await pool.query(`
      UPDATE keuangan_pengajuan 
      SET status = ?, catatan_bendahara = ?
      WHERE id = ? AND posko_id = ?
    `, [status, catatan_bendahara || null, req.params.id, req.user.posko_id]);
    
    if (status === 'disetujui') {
      const [rows] = await pool.query('SELECT * FROM keuangan_pengajuan WHERE id = ?', [req.params.id]);
      if (rows.length > 0) {
        const p = rows[0];
        let fileNotaId = null;
        if (p.file_nota_url) {
           const [fRes] = await pool.query(`
              INSERT INTO arsip_files (folder_id, tipe_file, nama_file, url_file, posko_id) 
              VALUES (NULL, 'image', ?, ?, ?)
           `, [`Nota_Reimburse_${p.id}.jpg`, p.file_nota_url, p.posko_id]);
           fileNotaId = fRes.insertId;
        }
        await pool.query(`
          INSERT INTO keuangan_transaksi (posko_id, kategori_id, jenis, nominal, tanggal, keterangan, file_nota_id, user_id)
          VALUES (?, ?, 'pengeluaran', ?, CURDATE(), ?, ?, ?)
        `, [p.posko_id, p.kategori_id, p.nominal, `Reimbursement: ${p.keterangan}`, fileNotaId, req.user.id]);
      }
    }
    res.json({ success: true, message: 'Status pengajuan diperbarui.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui status pengajuan.' });
  }
});

// ─── FITUR GALERI PDD ───────────────────────────────────────────────────────────
// Mencari folder bernama 'PDD' di posko user, lalu return semua file image/video di dalamnya
app.get('/api/arsip/pdd-gallery', authenticateToken, async (req, res) => {
  try {
    const poskoId = req.user.posko_id;
    if (!poskoId) return res.status(403).json({ message: 'Tidak terhubung ke posko.' });

    // Cari folder bernama 'PDD' (case-insensitive) di posko ini
    const [folders] = await pool.query(
      `SELECT id FROM arsip_folders WHERE LOWER(nama_folder) = 'pdd' AND posko_id = ? AND parent_id IS NULL LIMIT 1`,
      [poskoId]
    );

    if (folders.length === 0) {
      return res.json({ folder_exists: false, files: [] });
    }

    const pddFolderId = folders[0].id;

    // Ambil semua file image/video di folder PDD
    const [files] = await pool.query(
      `SELECT id, nama_file, url_file, thumbnail_url, tipe_file, uploaded_at 
       FROM arsip_files 
       WHERE folder_id = ? AND posko_id = ? AND tipe_file IN ('image', 'video')
       ORDER BY uploaded_at DESC`,
      [pddFolderId, poskoId]
    );

    res.json({ folder_exists: true, folder_id: pddFolderId, files });
  } catch (error) {
    console.error('PDD Gallery Error:', error);
    res.status(500).json({ message: 'Gagal mengambil galeri PDD.' });
  }
});

// ─── FITUR GENERATOR SURAT (SEKRETARIS) ─────────────────────────────────────────
app.get('/api/sekretaris/surat', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT s.*, u.nama_lengkap 
      FROM surat_history s
      JOIN users u ON s.user_id = u.id
      WHERE s.posko_id = ?
    `;
    const params = [req.user.posko_id];
    
    // Mahasiswa biasa hanya bisa melihat surat yang sudah complete
    if (req.user.jabatan?.toLowerCase() !== 'sekretaris' && req.user.role !== 'admin') {
      query += ` AND s.status = 'complete'`;
    }
    
    query += ` ORDER BY s.created_at DESC`;
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil riwayat surat.' });
  }
});

app.post('/api/sekretaris/surat', authenticateToken, async (req, res) => {
  if (req.user.jabatan !== 'Sekretaris' && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { jenis_surat, nama_surat, data_field, status } = req.body;
  
  try {
    const [countRes] = await pool.query('SELECT COUNT(*) as total FROM surat_history WHERE posko_id = ?', [req.user.posko_id]);
    const nextNumber = countRes[0].total + 1;
    const paddedNumber = String(nextNumber).padStart(3, '0');
    
    const months = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    const romanMonth = months[new Date().getMonth()];
    
    // Nomor KKN Format: 001/KKN-[posko]/[bulan romawi]/2026
    const nomorSurat = `${paddedNumber}/KKN-${req.user.posko_id}/${romanMonth}/2026`;
    
    const [result] = await pool.query(`
      INSERT INTO surat_history (posko_id, user_id, jenis_surat, nama_surat, nomor_surat, data_field, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [req.user.posko_id, req.user.id, jenis_surat, nama_surat || jenis_surat, nomorSurat, JSON.stringify(data_field || {}), status || 'draft']);
    
    res.json({ success: true, message: 'Draf surat berhasil dibuat.', id: result.insertId, nomor_surat: nomorSurat });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal membuat draf surat.' });
  }
});

app.put('/api/sekretaris/surat/:id', authenticateToken, async (req, res) => {
  if (req.user.jabatan !== 'Sekretaris' && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { nama_surat, data_field, status } = req.body;
  try {
    await pool.query(`
      UPDATE surat_history 
      SET nama_surat = ?, data_field = ?, status = ?
      WHERE id = ? AND posko_id = ?
    `, [nama_surat, JSON.stringify(data_field), status, req.params.id, req.user.posko_id]);
    res.json({ success: true, message: 'Surat berhasil diperbarui.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui surat.' });
  }
});

app.delete('/api/sekretaris/surat/:id', authenticateToken, async (req, res) => {
  if (req.user.jabatan !== 'Sekretaris' && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  try {
    await pool.query('DELETE FROM surat_history WHERE id = ? AND posko_id = ?', [req.params.id, req.user.posko_id]);
    res.json({ success: true, message: 'Surat berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus surat.' });
  }
});

// ─── GLOBAL ERROR HANDLER ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Ukuran file terlalu besar! (Maks 15MB)' });
    }
    return res.status(400).json({ message: err.message });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
});

// ─── START SERVER ──────────────────────────────────────────────────────────────
// 🚀 INIT BACKUP SERVICE 🚀
setupBackupService(app, pool, uploadDir, authenticateToken, requireAdminOrAbove);


// ==========================================
// ARSIP SURAT RESMI ROUTES
// ==========================================

// 1. GET ALL SURAT FOR POSKO
app.get('/api/surat', authenticateToken, async (req, res) => {
  try {
    let poskoId;
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      poskoId = req.query.posko_id || req.user.posko_id;
    } else {
      poskoId = req.user.posko_id;
    }
    if (!poskoId) {
      return res.status(400).json({ success: false, message: 'Posko ID tidak ditemukan' });
    }
    const [rows] = await pool.query(
      'SELECT s.*, u.nama_lengkap as pembuat FROM surat_history s LEFT JOIN users u ON s.user_id = u.id WHERE s.posko_id = ? ORDER BY s.created_at DESC',
      [poskoId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Fetch Surat Error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
});

// 1b. GET SINGLE SURAT BY ID
app.get('/api/surat/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT s.*, u.nama_lengkap as pembuat FROM surat_history s LEFT JOIN users u ON s.user_id = u.id WHERE s.id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Surat tidak ditemukan' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
});

// 2. CREATE NEW SURAT (DRAFT OR FINAL)
app.post('/api/surat', authenticateToken, async (req, res) => {
  try {
    const { jenis_surat, nama_surat, nomor_surat, data_field, status } = req.body;
    const posko_id = req.user.posko_id;
    const user_id = req.user.id;
    if (!posko_id) {
      return res.status(400).json({ success: false, message: 'Anda tidak memiliki akses posko' });
    }
    const [result] = await pool.query(
      'INSERT INTO surat_history (posko_id, user_id, jenis_surat, nama_surat, nomor_surat, data_field, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [posko_id, user_id, jenis_surat, nama_surat || jenis_surat, nomor_surat || '-', JSON.stringify(data_field || {}), status || 'draft']
    );
    res.json({ success: true, message: 'Surat berhasil disimpan', id: result.insertId });
  } catch (error) {
    console.error('Create Surat Error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
});

// 3. UPDATE SURAT
app.put('/api/surat/:id', authenticateToken, async (req, res) => {
  try {
    const { jenis_surat, nama_surat, nomor_surat, data_field, status, file_url } = req.body;
    await pool.query(
      'UPDATE surat_history SET jenis_surat = ?, nama_surat = ?, nomor_surat = ?, data_field = ?, status = ?, file_url = ? WHERE id = ?',
      [jenis_surat, nama_surat || jenis_surat, nomor_surat || '-', JSON.stringify(data_field || {}), status || 'draft', file_url || null, req.params.id]
    );
    res.json({ success: true, message: 'Surat berhasil diperbarui' });
  } catch (error) {
    console.error('Update Surat Error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
});

// 4. DELETE SURAT
app.delete('/api/surat/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM surat_history WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Surat berhasil dihapus' });
  } catch (error) {
    console.error('Delete Surat Error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
});

// ─── REKAP ABSENSI POSKO (CETAK PDF) ──────────────────────────────────────────
app.get('/api/posko/:id/rekap-logbook', authenticateToken, async (req, res) => {
  try {
    const posko_id = req.params.id;
    const { start_date, end_date } = req.query;
    
    // Get posko info
    const [posko] = await pool.query('SELECT nama_posko FROM posko WHERE id = ?', [posko_id]);
    const [dpl] = await pool.query("SELECT nama_lengkap, nim as nidn FROM users WHERE posko_id = ? AND role = 'dpl' LIMIT 1", [posko_id]);
    const [kordes] = await pool.query("SELECT nama_lengkap, nim FROM users WHERE posko_id = ? AND (role = 'admin' OR jabatan = 'Kordes' OR jabatan = 'Ketua') ORDER BY role ASC LIMIT 1", [posko_id]);
    
    // Get logbooks
    let logQuery = `
      SELECT l.id, DATE_FORMAT(l.tanggal, '%Y-%m-%d') as tanggal, l.waktu_mulai, l.waktu_selesai, l.tempat, l.sasaran, l.deskripsi,
             p.proker, p.nama_pic, u.nama_lengkap as pembuat,
             (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', af.id, 'nama_file', af.nama_file, 'file_path', af.url_file)) 
              FROM arsip_files af WHERE af.folder_id = l.folder_id_referensi) as photos
      FROM logbooks l
      JOIN pic_groups p ON l.pic_id = p.id
      JOIN users u ON l.user_id = u.id
      WHERE u.posko_id = ?
    `;
    let queryParams = [posko_id];
    
    if (start_date && end_date) {
      logQuery += " AND l.tanggal >= ? AND l.tanggal <= ?";
      queryParams.push(start_date, end_date);
    }
    
    logQuery += " ORDER BY l.tanggal ASC, l.waktu_mulai ASC, l.created_at ASC";
    const [logbooks] = await pool.query(logQuery, queryParams);
    
    res.json({
      posko: posko[0] || {},
      dpl: dpl[0] || {},
      kordes: kordes[0] || {},
      logbooks: logbooks
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.get('/api/posko/:id/rekap-absensi', authenticateToken, async (req, res) => {
  try {
    const posko_id = req.params.id;
    const { start_date, end_date } = req.query;
    
    const [posko] = await pool.query('SELECT nama_posko FROM posko WHERE id = ?', [posko_id]);
    // DPL biasanya belum ada di role system, jadi query ini biarkan fleksibel atau kosong
    const [dpl] = await pool.query("SELECT nama_lengkap, nim as nidn FROM users WHERE posko_id = ? AND role = 'dpl' LIMIT 1", [posko_id]);
    // Kordes adalah Admin atau Mahasiswa dengan jabatan Kordes
    const [kordes] = await pool.query("SELECT nama_lengkap, nim FROM users WHERE posko_id = ? AND (role = 'admin' OR jabatan = 'Kordes' OR jabatan = 'Ketua') ORDER BY role ASC LIMIT 1", [posko_id]);
    const [mahasiswa] = await pool.query("SELECT id, nim, nama_lengkap FROM users WHERE posko_id = ? AND (role = 'mahasiswa' OR role = 'admin') ORDER BY role DESC, nama_lengkap ASC", [posko_id]);
    
    let absensiQuery = "SELECT user_id, DATE_FORMAT(tanggal, '%Y-%m-%d') as tanggal, status, alasan FROM absensi WHERE user_id IN (SELECT id FROM users WHERE posko_id = ? AND (role = 'mahasiswa' OR role = 'admin'))";
    let queryParams = [posko_id];
    
    if (start_date && end_date) {
      absensiQuery += " AND tanggal >= ? AND tanggal <= ?";
      queryParams.push(start_date, end_date);
    }
    
    const [absensi] = await pool.query(absensiQuery, queryParams);
    
    res.json({
      success: true,
      data: {
        posko: posko[0] || null,
        dpl: dpl[0] || null,
        kordes: kordes[0] || null,
        mahasiswa: mahasiswa,
        absensi: absensi
      }
    });
  } catch (error) {
    console.error('Rekap Absensi Error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
});

// ==========================================
// 10. BUKU TAMU API (ADMIN)
// ==========================================

// Get daftar buku tamu untuk posko yang sedang login
app.get('/api/admin/buku-tamu', authenticateToken, async (req, res) => {
  try {
    const posko_id = req.user.posko_id;
    if (!posko_id) return res.status(403).json({ message: 'Anda tidak tergabung dalam posko manapun' });

    const [tamu] = await pool.query(`
      SELECT b.*, u.nama_lengkap as nama_penyambut
      FROM buku_tamu b
      LEFT JOIN users u ON b.mhs_penyambut_id = u.id
      WHERE b.posko_id = ?
      ORDER BY b.created_at DESC
    `, [posko_id]);

    res.json(tamu);
  } catch (error) {
    console.error('Buku Tamu Error:', error);
    res.status(500).json({ message: 'Gagal mengambil data buku tamu' });
  }
});

// Create entri buku tamu baru
app.post('/api/admin/buku-tamu', authenticateToken, async (req, res) => {
  try {
    const posko_id = req.user.posko_id;
    if (!posko_id) return res.status(403).json({ message: 'Anda tidak tergabung dalam posko manapun' });

    const { tanggal, nama_tamu, alamat_jabatan, keperluan, mhs_penyambut_id, signature_base64 } = req.body;
    
    if (!tanggal || !nama_tamu || !alamat_jabatan || !keperluan || !signature_base64) {
      return res.status(400).json({ message: 'Form tidak lengkap' });
    }

    // Process base64 image
    const matches = signature_base64.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ message: 'Format tanda tangan tidak valid' });
    }
    
    const extension = matches[1];
    const imageData = Buffer.from(matches[2], 'base64');
    const fileName = `ttd_tamu_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
    
    // Ensure buku_tamu dir exists
    const ttdDir = path.join(__dirname, 'uploads', 'buku_tamu');
    if (!fs.existsSync(ttdDir)) {
      fs.mkdirSync(ttdDir, { recursive: true });
    }
    
    const filePath = path.join(ttdDir, fileName);
    fs.writeFileSync(filePath, imageData);
    const dbPath = `/uploads/buku_tamu/${fileName}`;

    await pool.query(
      'INSERT INTO buku_tamu (posko_id, tanggal, nama_tamu, alamat_jabatan, keperluan, mhs_penyambut_id, ttd_tamu_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [posko_id, tanggal, nama_tamu, alamat_jabatan, keperluan, mhs_penyambut_id || null, dbPath]
    );

    res.json({ message: 'Buku Tamu berhasil disimpan' });
  } catch (error) {
    console.error('Buku Tamu Create Error:', error);
    res.status(500).json({ message: 'Gagal menyimpan buku tamu' });
  }
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Express server running on port ${PORT}`);
  console.log(`🔐 Superadmin URL: http://localhost:5173/superadmin`);
  console.log(`=========================================`);
});

