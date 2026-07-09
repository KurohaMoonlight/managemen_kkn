import { google } from 'googleapis';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';
import * as pdfGen from './pdfGenerator.mjs';
import * as excelGen from './excelGenerator.mjs';
import {
  fetchPeriodeKkn,
  fetchPoskoMeta,
  fetchRekapAbsensi,
  fetchRekapLogbook,
  fetchBukuTamu,
  fetchKeuanganLPJ,
  getWeeklyChunksFromPeriod,
  filterAbsensiForChunk,
  fetchRekapLampiran,
} from './backupDataHelpers.mjs';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

/** Prevent duplicate concurrent backups per posko */
const backupLocks = new Set();
let cronRegistered = false;

export const setupBackupService = (app, pool, UPLOADS_DIR, authenticateToken, requireAdminOrAbove) => {

  pdfGen.setUploadsDir(UPLOADS_DIR);

  const getOauth2Client = () => {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  };

  const getDriveClient = (refreshToken) => {
    const oauth2Client = getOauth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: 'v3', auth: oauth2Client });
  };

  const ensureDriveFolder = async (drive, folderName) => {
    try {
      const searchRes = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
        spaces: 'drive',
      });
      if (searchRes.data.files?.length > 0) {
        return searchRes.data.files[0].id;
      }
      const folderRes = await drive.files.create({
        requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id',
      });
      return folderRes.data.id;
    } catch (folderErr) {
      console.error('Gagal membuat/mencari folder di GDrive:', folderErr.message);
      return null;
    }
  };

  const buildBackupZip = async (posko_id, isFailsafe = false) => {
    const [poskoData] = await pool.query('SELECT nama_posko FROM posko WHERE id = ?', [posko_id]);
    const poskoName = poskoData[0]?.nama_posko || `Posko_${posko_id}`;

    const [users] = await pool.query('SELECT * FROM users WHERE posko_id = ?', [posko_id]);
    const [arsipFolders] = await pool.query('SELECT * FROM arsip_folders WHERE posko_id = ?', [posko_id]);
    const [arsipFiles] = await pool.query('SELECT * FROM arsip_files WHERE posko_id = ?', [posko_id]);
    const [keuanganPengajuan] = await pool.query('SELECT * FROM keuangan_pengajuan WHERE posko_id = ?', [posko_id]);

    const dbDump = { users, arsipFolders, arsipFiles, keuanganPengajuan };

    const folderMap = {};
    arsipFolders.forEach(f => { folderMap[f.id] = f; });

    const getFolderPath = (folderId) => {
      if (!folderId) return 'Lain-Lain';
      const parts = [];
      let curr = folderMap[folderId];
      while (curr) {
        parts.unshift(curr.nama_folder.replace(/[/\\?%*:|"<>]/g, '-'));
        curr = folderMap[curr.parent_id];
      }
      return parts.join('/');
    };

    const archive = new archiver.ZipArchive({ zlib: { level: 1 } });
    const tempZipPath = path.join(os.tmpdir(), `kkn_backup_${posko_id}_${Date.now()}.zip`);
    const output = fs.createWriteStream(tempZipPath);

    const zipDone = new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('[Backup] File tidak ditemukan, dilewati:', err.path);
        } else {
          reject(err);
        }
      });
    });

    archive.pipe(output);
    archive.append(JSON.stringify(dbDump, null, 2), { name: 'Data Master/database_dump_mentah.json' });

    const tPdf = Date.now();
    await pdfGen.beginPdfSession();
    let meta = null;
    try {
      const periode = await fetchPeriodeKkn(pool);
      meta = await fetchPoskoMeta(pool, posko_id);
      const startDate = periode?.start_date;
      const endDate = periode?.end_date;

      if (!startDate || !endDate) {
        console.warn(`[Backup] Periode KKN belum diset untuk posko ${posko_id}, PDF absensi/logbook dilewati.`);
      } else {
        const weekChunks = getWeeklyChunksFromPeriod(startDate, endDate);
        const fullRekap = await fetchRekapAbsensi(pool, posko_id, startDate, endDate);

        for (let w = 0; w < weekChunks.length; w++) {
          console.log(`[Backup] PDF absensi minggu ${w + 1}/${weekChunks.length}...`);
          const weekRekap = filterAbsensiForChunk(fullRekap, weekChunks[w]);
          const weekPdf = await pdfGen.generateAbsensiWeeklyPDF(weekRekap, meta, weekChunks[w]);
          const weekNum = String(w + 1).padStart(2, '0');
          archive.append(weekPdf, { name: `Absensi/Per_Minggu/Absensi_Minggu_${weekNum}.pdf` });
        }

        console.log('[Backup] PDF absensi seluruh periode...');
        const fullAbsensiPdf = await pdfGen.generateAbsensiFullPeriodPDF(fullRekap, meta, weekChunks);
        archive.append(fullAbsensiPdf, { name: 'Absensi/Cetakan_Absensi_Seluruh_Periode.pdf' });

        console.log('[Backup] Excel absensi...');
        const absensiExcelBuf = await excelGen.generateAbsensiExcel(fullRekap, meta.nama_posko);
        archive.append(absensiExcelBuf, { name: 'Absensi/Rekap_Absensi_Lengkap.xlsx' });

        console.log('[Backup] PDF logbook...');
        const logbooks = await fetchRekapLogbook(pool, posko_id, startDate, endDate);
        const logbookPdf = await pdfGen.generateLogbookPDF(logbooks);
        archive.append(logbookPdf, { name: 'Logbook/Cetakan_Logbook_Seluruh_Periode.pdf' });

        console.log('[Backup] PDF Lampiran 9 (Rekapitulasi Keaktifan)...');
        const rekapLampiran = await fetchRekapLampiran(pool, posko_id);
        const lampiran9Pdf = await pdfGen.generateLampiran9PDF(rekapLampiran);
        archive.append(lampiran9Pdf, { name: 'Absensi/Cetakan_Lampiran_9_Rekapitulasi_Keaktifan.pdf' });
      }

      if (!meta) meta = await fetchPoskoMeta(pool, posko_id);

      console.log('[Backup] PDF buku tamu...');
      const bukuTamu = await fetchBukuTamu(pool, posko_id);
      const bukuTamuPdf = await pdfGen.generateBukuTamuPDF(bukuTamu, {
        desa: meta?.desa || meta?.nama_posko || '',
        kecamatan: meta?.kecamatan || '........................',
        kabupaten: meta?.kabupaten || '........................',
      });
      archive.append(bukuTamuPdf, { name: 'Buku Tamu/Cetakan_Buku_Tamu.pdf' });

      console.log('[Backup] PDF LPJ kas...');
      const transaksi = await fetchKeuanganLPJ(pool, posko_id);
      const lpjPdf = await pdfGen.generateLPJPDF(transaksi, meta?.nama_posko || poskoName);
      archive.append(lpjPdf, { name: 'Keuangan/Cetakan_LPJ_Kas.pdf' });
    } catch (pdfErr) {
      console.error('Error generating PDF for backup:', pdfErr);
      throw pdfErr;
    } finally {
      await pdfGen.endPdfSession();
    }
    console.log(`[Backup] Semua PDF selesai (${((Date.now() - tPdf) / 1000).toFixed(1)}s)`);

    const bukuTamuFiles = await fetchBukuTamu(pool, posko_id);
    bukuTamuFiles.forEach(t => {
      if (t.ttd_tamu_url) {
        const realPath = pdfGen.resolveUploadPath(t.ttd_tamu_url);
        if (realPath && fs.existsSync(realPath) && fs.lstatSync(realPath).isFile()) {
          const relName = t.ttd_tamu_url.replace(/^\/?uploads\/?/i, '').replace(/\\/g, '/');
          archive.file(realPath, { name: `Buku Tamu/Tanda_Tangan/${relName}`, store: true });
        }
      }
    });

    keuanganPengajuan.forEach(k => {
      if (k.file_nota_url) {
        const realPath = path.join(UPLOADS_DIR, path.basename(k.file_nota_url));
        if (fs.existsSync(realPath) && fs.lstatSync(realPath).isFile()) {
          archive.file(realPath, { name: `Keuangan/Nota/${path.basename(k.file_nota_url)}`, store: true });
        }
      }
    });

    arsipFiles.forEach(f => {
      if (f.url_file && f.tipe_file !== 'link') {
        const realPath = path.join(UPLOADS_DIR, path.basename(f.url_file));
        if (fs.existsSync(realPath) && fs.lstatSync(realPath).isFile()) {
          archive.file(realPath, { name: `${getFolderPath(f.folder_id)}/${f.nama_file}`, store: true });
        }
      }
    });

    console.log('[Backup] Mengompresi arsip ke disk...');
    const tZip = Date.now();
    await archive.finalize();
    await zipDone;
    const zipSize = fs.statSync(tempZipPath).size;
    console.log(`[Backup] ZIP selesai ${(zipSize / 1024 / 1024).toFixed(1)} MB (${((Date.now() - tZip) / 1000).toFixed(1)}s)`);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const prefix = isFailsafe ? '[DELETED]_Failsafe_' : 'Backup_';
    const fileName = `${prefix}${poskoName.replace(/ /g, '_')}_${dateStr}_${timeStr}.zip`;
    const folderName = `Arsip_Sistem_KKN_${poskoName.replace(/ /g, '_')}`;

    return { tempZipPath, fileName, folderName, poskoName, zipSize };
  };

  const uploadZipToDrive = async (refreshToken, { tempZipPath, fileName, folderName, zipSize }) => {
    const drive = getDriveClient(refreshToken);
    const folderId = await ensureDriveFolder(drive, folderName);

    console.log(`[Backup] Mengunggah ke Drive (${(zipSize / 1024 / 1024).toFixed(1)} MB)...`);
    const requestBody = { name: fileName, mimeType: 'application/zip' };
    if (folderId) requestBody.parents = [folderId];

    const tUpload = Date.now();
    const driveRes = await drive.files.create({
      requestBody,
      media: { mimeType: 'application/zip', body: fs.createReadStream(tempZipPath) },
    });
    console.log(`[Backup] Upload selesai (${((Date.now() - tUpload) / 1000).toFixed(1)}s)`);
    return driveRes.data;
  };

  const collectFailsafeTargets = async (posko_id) => {
    const targets = [];
    const seen = new Set();

    const addTarget = (token, label) => {
      if (!token || seen.has(token)) return;
      seen.add(token);
      targets.push({ token, label });
    };

    const [poskoRows] = await pool.query(
      'SELECT gdrive_refresh_token, nama_posko FROM posko WHERE id = ?',
      [posko_id]
    );
    addTarget(poskoRows[0]?.gdrive_refresh_token, 'Google Drive Admin/Kordes (Posko)');

    const [adminRows] = await pool.query(
      `SELECT gdrive_refresh_token, role, nama_lengkap FROM users
       WHERE posko_id = ? AND role IN ('admin', 'kordes') AND gdrive_refresh_token IS NOT NULL`,
      [posko_id]
    );
    for (const u of adminRows) {
      addTarget(u.gdrive_refresh_token, `Google Drive ${u.role} (${u.nama_lengkap})`);
    }

    const [saRows] = await pool.query(
      `SELECT gdrive_refresh_token, nama_lengkap FROM users
       WHERE role = 'superadmin' AND gdrive_refresh_token IS NOT NULL`
    );
    for (const u of saRows) {
      addTarget(u.gdrive_refresh_token, `Google Drive Superadmin (${u.nama_lengkap})`);
    }

    return { targets, poskoName: poskoRows[0]?.nama_posko || `Posko_${posko_id}` };
  };

  const runBackupForPosko = async (posko_id, refreshToken, isFailsafe = false) => {
    if (backupLocks.has(posko_id)) {
      throw new Error('Backup untuk posko ini sedang berjalan. Tunggu hingga selesai.');
    }
    backupLocks.add(posko_id);
    console.log(`[Backup] Mulai posko ${posko_id} (failsafe=${isFailsafe})`);

    let zipMeta = null;
    try {
      zipMeta = await buildBackupZip(posko_id, isFailsafe);
      const driveRes = await uploadZipToDrive(refreshToken, zipMeta);
      await pool.query('UPDATE posko SET last_backup_date = NOW() WHERE id = ?', [posko_id]);
      console.log(`[Backup] Selesai posko ${posko_id} → ${zipMeta.fileName} (id: ${driveRes.id})`);
      return driveRes;
    } finally {
      if (zipMeta?.tempZipPath) {
        try { fs.unlinkSync(zipMeta.tempZipPath); } catch (_) { /* ignore */ }
      }
      backupLocks.delete(posko_id);
    }
  };

  /** Failsafe: bangun ZIP sekali, unggah ke semua GDrive yang terhubung (posko + superadmin) */
  const runFailsafeBackupForPosko = async (posko_id) => {
    if (backupLocks.has(posko_id)) {
      throw new Error('Backup/failsafe untuk posko ini sedang berjalan.');
    }
    backupLocks.add(posko_id);

    const report = { uploaded: [], failed: [], skipped: [] };
    let zipMeta = null;

    try {
      const { targets, poskoName } = await collectFailsafeTargets(posko_id);

      if (targets.length === 0) {
        report.skipped.push({
          reason: 'Tidak ada Google Drive terhubung (Admin/Kordes Posko maupun Superadmin).',
        });
        console.warn(`[Failsafe] Posko ${posko_id} (${poskoName}): tidak ada tujuan GDrive, dilewati.`);
        return report;
      }

      console.log(`[Failsafe] Posko ${posko_id} (${poskoName}): arsip → ${targets.length} tujuan`);
      zipMeta = await buildBackupZip(posko_id, true);

      for (const { token, label } of targets) {
        try {
          console.log(`[Failsafe] Mengunggah ke ${label}...`);
          const driveRes = await uploadZipToDrive(token, zipMeta);
          report.uploaded.push({ label, fileId: driveRes.id, fileName: zipMeta.fileName });
          console.log(`[Failsafe] ✅ ${label} → ${driveRes.id}`);
        } catch (err) {
          console.error(`[Failsafe] ❌ ${label}:`, err.message);
          report.failed.push({ label, error: err.message });
        }
      }

      if (report.uploaded.length > 0) {
        await pool.query('UPDATE posko SET last_backup_date = NOW() WHERE id = ?', [posko_id]);
      }

      return report;
    } finally {
      if (zipMeta?.tempZipPath) {
        try { fs.unlinkSync(zipMeta.tempZipPath); } catch (_) { /* ignore */ }
      }
      backupLocks.delete(posko_id);
    }
  };

  // Expose to app for failsafe deletion usage
  app.locals.runBackupForPosko = runBackupForPosko;
  app.locals.runFailsafeBackupForPosko = runFailsafeBackupForPosko;

  // 1. Dapatkan link login Google (untuk ditekan oleh Admin atau Superadmin)
  app.get('/api/google/auth', authenticateToken, requireAdminOrAbove, (req, res) => {
    const oauth2Client = getOauth2Client();
    const frontendUrl = req.headers.referer ? new URL(req.headers.referer).origin : 'http://localhost:5173';

    const state = JSON.stringify({
      posko_id: req.user.posko_id,
      role: req.user.role,
      user_id: req.user.id,
      origin: frontendUrl,
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      prompt: 'consent',
      state: Buffer.from(state).toString('base64'),
    });
    res.json({ url: authUrl });
  });

  // 2. Callback (Balikan dari Google) untuk menyimpan Refresh Token
  app.get('/api/google/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('Kode atau State tidak valid.');

    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      const posko_id = decodedState.posko_id;
      const role = decodedState.role;
      const user_id = decodedState.user_id;

      const oauth2Client = getOauth2Client();
      const { tokens } = await oauth2Client.getToken(code);

      if (tokens.refresh_token) {
        if (role === 'superadmin') {
          await pool.query('UPDATE users SET gdrive_refresh_token = ? WHERE id = ?', [tokens.refresh_token, user_id]);
        } else if (posko_id) {
          await pool.query('UPDATE posko SET gdrive_refresh_token = ? WHERE id = ?', [tokens.refresh_token, posko_id]);
          if (user_id) {
            await pool.query('UPDATE users SET gdrive_refresh_token = ? WHERE id = ?', [tokens.refresh_token, user_id]);
          }
        }
      }

      const frontendUrl = decodedState.origin || 'http://localhost:5173';
      const redirectPath = role === 'superadmin' ? '/superadmin' : '/admin';
      res.redirect(`${frontendUrl}${redirectPath}?gdrive=success`);
    } catch (error) {
      console.error('Error in Google Callback:', error);
      res.status(500).send('Gagal menautkan Google Drive.');
    }
  });

  // 3. Status Terkoneksi GDrive
  app.get('/api/backup/status', authenticateToken, requireAdminOrAbove, async (req, res) => {
    try {
      if (req.user.role === 'superadmin') {
        const [rows] = await pool.query('SELECT gdrive_refresh_token FROM users WHERE id = ?', [req.user.id]);
        res.json({ connected: !!rows[0]?.gdrive_refresh_token });
      } else {
        const [rows] = await pool.query(
          'SELECT gdrive_refresh_token, backup_interval_days, last_backup_date FROM posko WHERE id = ?',
          [req.user.posko_id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Posko tidak ditemukan' });

        res.json({
          connected: !!rows[0].gdrive_refresh_token,
          interval: rows[0].backup_interval_days,
          lastBackup: rows[0].last_backup_date,
        });
      }
    } catch (e) {
      res.status(500).json({ message: 'Gagal memuat status backup.' });
    }
  });

  // 4. Update Interval Backup
  app.put('/api/backup/settings', authenticateToken, requireAdminOrAbove, async (req, res) => {
    try {
      const { interval } = req.body;
      await pool.query('UPDATE posko SET backup_interval_days = ? WHERE id = ?', [interval, req.user.posko_id]);
      res.json({ message: 'Jadwal backup diperbarui.' });
    } catch (e) {
      res.status(500).json({ message: 'Gagal menyimpan pengaturan.' });
    }
  });

  // 6. Tombol Manual Backup
  app.get('/api/backup/running', authenticateToken, requireAdminOrAbove, (req, res) => {
    res.json({ running: backupLocks.has(req.user.posko_id) });
  });

  app.post('/api/backup/manual', authenticateToken, requireAdminOrAbove, async (req, res) => {
    const poskoId = req.user.posko_id;
    if (backupLocks.has(poskoId)) {
      return res.status(429).json({ message: 'Backup masih berjalan. Mohon tunggu hingga selesai.' });
    }
    try {
      const [rows] = await pool.query('SELECT gdrive_refresh_token FROM posko WHERE id = ?', [poskoId]);
      const token = rows[0]?.gdrive_refresh_token;

      if (!token) return res.status(400).json({ message: 'Google Drive belum terhubung.' });

      await runBackupForPosko(poskoId, token);
      res.json({ message: 'Backup manual berhasil diselesaikan & diunggah ke Google Drive!' });
    } catch (e) {
      console.error('Backup Error:', e);
      const status = e.message?.includes('sedang berjalan') ? 429 : 500;
      res.status(status).json({ message: e.message || 'Gagal melakukan backup manual.' });
    }
  });

  // 7. CRONJOB Otomatis Setiap Tengah Malam (00:00)
  if (!cronRegistered) {
    cronRegistered = true;
    cron.schedule('0 0 * * *', async () => {
      console.log('⏰ Menjalankan Cronjob Backup Harian...');
      try {
        const [poskos] = await pool.query(`
          SELECT id, gdrive_refresh_token
          FROM posko
          WHERE gdrive_refresh_token IS NOT NULL
            AND (last_backup_date IS NULL OR DATEDIFF(NOW(), last_backup_date) >= backup_interval_days)
        `);

        for (const p of poskos) {
          try {
            await runBackupForPosko(p.id, p.gdrive_refresh_token);
            console.log(`✅ [CRON] Backup sukses untuk Posko ID: ${p.id}`);
          } catch (err) {
            console.error(`❌ [CRON] Gagal backup Posko ID: ${p.id}`, err.message);
          }
        }
      } catch (e) {
        console.error('CRON Database Error:', e);
      }
    });
  }
};
