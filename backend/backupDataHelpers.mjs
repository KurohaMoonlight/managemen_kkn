/** Shared data fetchers for backup PDF generation (mirrors rekap API queries) */

export async function fetchPeriodeKkn(pool) {
  const [rows] = await pool.query('SELECT start_date, end_date FROM periode_kkn ORDER BY id DESC LIMIT 1');
  if (rows.length === 0) return null;
  const start = toYMD(rows[0].start_date);
  const end = toYMD(rows[0].end_date);
  return { start_date: start, end_date: end };
}

export async function fetchPoskoMeta(pool, posko_id) {
  const [poskoRows] = await pool.query('SELECT * FROM posko WHERE id = ?', [posko_id]);
  const posko = poskoRows[0] || {};
  const [dpl] = await pool.query(
    "SELECT nama_lengkap, nim as nidn FROM users WHERE posko_id = ? AND role = 'dpl' LIMIT 1",
    [posko_id]
  );
  const [kordes] = await pool.query(
    "SELECT nama_lengkap, nim FROM users WHERE posko_id = ? AND (role = 'admin' OR jabatan = 'Kordes' OR jabatan = 'Ketua') ORDER BY role ASC LIMIT 1",
    [posko_id]
  );
  return {
    nama_posko: posko.nama_posko || `Posko_${posko_id}`,
    desa: posko.desa || '',
    kecamatan: '',
    kabupaten: '',
    kecamatanKabupaten: '',
    dplNama: dpl[0]?.nama_lengkap || '',
    dplNidn: dpl[0]?.nidn || '',
    kordesNama: kordes[0]?.nama_lengkap || '',
    kordesNim: kordes[0]?.nim || '',
  };
}

export async function fetchRekapAbsensi(pool, posko_id, start_date, end_date) {
  const [mahasiswa] = await pool.query(
    "SELECT id, nim, nama_lengkap FROM users WHERE posko_id = ? AND (role = 'mahasiswa' OR role = 'admin') ORDER BY role DESC, nama_lengkap ASC",
    [posko_id]
  );
  let absensiQuery =
    "SELECT user_id, DATE_FORMAT(tanggal, '%Y-%m-%d') as tanggal, status, alasan as keterangan FROM absensi WHERE user_id IN (SELECT id FROM users WHERE posko_id = ? AND (role = 'mahasiswa' OR role = 'admin'))";
  const params = [posko_id];
  if (start_date && end_date) {
    absensiQuery += ' AND tanggal >= ? AND tanggal <= ?';
    params.push(start_date, end_date);
  }
  const [absensi] = await pool.query(absensiQuery, params);
  return { mahasiswa, absensi };
}

export async function fetchRekapLogbook(pool, posko_id, start_date, end_date) {
  let logQuery = `
    SELECT l.id, l.folder_id_referensi,
           DATE_FORMAT(l.tanggal, '%Y-%m-%d') as tanggal, l.waktu_mulai, l.waktu_selesai, l.tempat, l.sasaran, l.deskripsi,
           p.proker, p.nama_pic, u.nama_lengkap as pembuat
    FROM logbooks l
    JOIN pic_groups p ON l.pic_id = p.id
    JOIN users u ON l.user_id = u.id
    WHERE u.posko_id = ?
  `;
  const params = [posko_id];
  if (start_date && end_date) {
    logQuery += ' AND l.tanggal >= ? AND l.tanggal <= ?';
    params.push(start_date, end_date);
  }
  logQuery += ' ORDER BY l.tanggal ASC, l.waktu_mulai ASC, l.created_at ASC';
  const [logbooks] = await pool.query(logQuery, params);

  for (const log of logbooks) {
    if (log.folder_id_referensi) {
      const [photos] = await pool.query(
        `SELECT id, url_file, nama_file, tipe_file FROM arsip_files
         WHERE folder_id = ?
         AND (tipe_file LIKE 'image/%' OR tipe_file IN ('image/jpeg','image/png','image/gif','image/webp'))
         ORDER BY uploaded_at ASC`,
        [log.folder_id_referensi]
      );
      log.photos = photos.length > 0 ? photos : await fallbackPhotos(pool, log.folder_id_referensi);
    } else {
      log.photos = [];
    }
  }
  return logbooks;
}

async function fallbackPhotos(pool, folderId) {
  const [photos] = await pool.query(
    'SELECT id, url_file, nama_file, tipe_file FROM arsip_files WHERE folder_id = ? ORDER BY uploaded_at ASC LIMIT 5',
    [folderId]
  );
  return photos.filter((p) => {
    const ext = (p.url_file || '').toLowerCase();
    return /\.(jpe?g|png|gif|webp)$/i.test(ext) || (p.tipe_file || '').startsWith('image/');
  });
}

export async function fetchBukuTamu(pool, posko_id) {
  const [rows] = await pool.query(`
    SELECT b.*, u.nama_lengkap as nama_penyambut
    FROM buku_tamu b
    LEFT JOIN users u ON b.mhs_penyambut_id = u.id
    WHERE b.posko_id = ?
    ORDER BY b.tanggal ASC, b.created_at ASC
  `, [posko_id]);
  return rows;
}

export async function fetchKeuanganLPJ(pool, posko_id) {
  const [rows] = await pool.query(`
    SELECT kt.*, kk.nama_kategori
    FROM keuangan_transaksi kt
    LEFT JOIN keuangan_kategori kk ON kt.kategori_id = kk.id
    WHERE kt.posko_id = ?
    ORDER BY kt.tanggal ASC, kt.created_at ASC
  `, [posko_id]);
  return rows;
}

/** Split KKN period into weekly chunks (7 days each, last week may be shorter) */
export function getWeeklyChunksFromPeriod(start_date, end_date) {
  const start = parseYMD(start_date);
  const end = parseYMD(end_date);
  const chunks = [];
  let current = new Date(start);
  while (current <= end) {
    const chunk = [];
    for (let i = 0; i < 7; i++) {
      if (current > end) break;
      chunk.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    if (chunk.length > 0) chunks.push(chunk);
  }
  return chunks;
}

export function filterAbsensiForChunk(rekap, chunk) {
  if (!chunk.length) return rekap;
  const start = toYMD(chunk[0]);
  const end = toYMD(chunk[chunk.length - 1]);
  return {
    mahasiswa: rekap.mahasiswa,
    absensi: rekap.absensi.filter((a) => a.tanggal >= start && a.tanggal <= end),
  };
}

export function parseYMD(dateInput) {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
  const str = String(dateInput).split('T')[0];
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toYMD(dateInput) {
  const d = parseYMD(dateInput);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
