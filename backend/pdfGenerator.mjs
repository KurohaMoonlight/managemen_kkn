import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

let UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export function setUploadsDir(dir) {
  UPLOADS_DIR = dir;
}

const pad = (n) => String(n).padStart(2, '0');

const parseYMD = (dateInput) => {
  if (!dateInput) return new Date();
  const str = String(dateInput).split('T')[0];
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const toLocalYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const formatDateWithDay = (dateStr) => {
  if (!dateStr) return '-';
  const d = parseYMD(dateStr);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const formatLogbookTanggal = (dateStr) => {
  if (!dateStr) return '-';
  const d = parseYMD(dateStr);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${days[d.getDay()]},<br>${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const hitungDurasi = (start, end) => {
  if (!start || !end) return '-';
  const d1 = new Date(`2000-01-01T${start}`);
  const d2 = new Date(`2000-01-01T${end}`);
  let diff = (d2 - d1) / 3600000;
  if (diff < 0) diff += 24;
  return diff.toFixed(1).replace('.0', '');
};

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
};

/** Resolve /uploads/... URL to absolute filesystem path */
export function resolveUploadPath(urlPath) {
  if (!urlPath) return null;
  const normalized = String(urlPath).replace(/\\/g, '/');
  const match = normalized.match(/^\/?uploads\/(.+)$/i);
  if (match) return path.join(UPLOADS_DIR, match[1]);
  return path.join(UPLOADS_DIR, path.basename(normalized));
}

const getBase64Image = (url_path) => {
  const realPath = resolveUploadPath(url_path);
  if (!realPath || !fs.existsSync(realPath) || !fs.lstatSync(realPath).isFile()) {
    return null;
  }
  const ext = path.extname(realPath).replace('.', '').toLowerCase() || 'png';
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  const b64 = fs.readFileSync(realPath).toString('base64');
  return `data:image/${mime};base64,${b64}`;
};

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const getAbsensiStatus = (userId, dateObj, absensiList) => {
  const tglStr = toLocalYMD(dateObj);
  const rec = absensiList.find((a) => a.user_id === userId && String(a.tanggal).startsWith(tglStr));
  if (!rec) return '';
  if (rec.status === 'hadir' || rec.status === 'telat') return '✅';
  if (rec.status === 'izin') return 'I';
  if (rec.status === 'sakit') return 'S';
  if (rec.status === 'alpha' || rec.status === 'alpa') return 'A';
  return rec.status;
};

const getAbsensiKeterangan = (userId, chunk, absensiList) => {
  const kets = [];
  for (const d of chunk) {
    const tglStr = toLocalYMD(d);
    const rec = absensiList.find((a) => a.user_id === userId && String(a.tanggal).startsWith(tglStr));
    if (rec && rec.status !== 'hadir' && rec.status !== 'telat') {
      let ketStr = `${d.getDate()}/${d.getMonth() + 1}: ${rec.status.toUpperCase()}`;
      const alasan = rec.alasan || rec.keterangan;
      if (alasan) ketStr += ` (${alasan})`;
      kets.push(ketStr);
    }
  }
  return kets.join(', ');
};

const buildAbsensiPageHtml = (rekapData, meta, chunk, pageIndex, totalPages, showWeekLabel) => {
  const { mahasiswa, absensi } = rekapData;
  const desa = meta.desa || '........................';
  const kecKab = meta.kecamatanKabupaten || '........................';
  const weekLabel = showWeekLabel && totalPages > 1 ? ` (Minggu ke-${pageIndex + 1})` : '';

  const rows = mahasiswa.map((mhs, index) => {
    const dayCells = chunk.map((d) =>
      `<td style="border: 1px solid black; padding: 6px; text-align: center;">${getAbsensiStatus(mhs.id, d, absensi)}</td>`
    ).join('');
    return `
      <tr>
        <td style="border: 1px solid black; padding: 6px; text-align: center;">${index + 1}</td>
        <td style="border: 1px solid black; padding: 6px; text-align: center;">${escapeHtml(mhs.nim)}</td>
        <td style="border: 1px solid black; padding: 6px;">${escapeHtml(mhs.nama_lengkap)}</td>
        ${dayCells}
        <td style="border: 1px solid black; padding: 6px; font-size: 10pt;">${escapeHtml(getAbsensiKeterangan(mhs.id, chunk, absensi))}</td>
      </tr>`;
  }).join('');

  const dayHeaders = chunk.map((d) =>
    `<th style="border: 1px solid black; padding: 8px; text-align: center; min-width: 30px;">Tgl<br>${d.getDate()}/${d.getMonth() + 1}</th>`
  ).join('');

  return `
    <div style="${pageIndex < totalPages - 1 ? 'page-break-after: always;' : ''}">
      <h3 style="color: #1e3a8a; text-align: left; font-size: 14pt; margin-bottom: 20px; font-weight: bold;">
        Lampiran 4. Daftar Hadir Harian Tim KKN${weekLabel}
      </h3>
      <h2 style="text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 30px;">DAFTAR HADIR HARIAN TIM KKN</h2>
      <table style="width: 100%; max-width: 600px; margin-bottom: 20px; border: none; font-size: 11pt;">
        <tr><td style="width: 100px; border: none; padding: 4px;">Desa</td>
            <td style="border: none; padding: 4px;">: ${escapeHtml(desa)} &nbsp;&nbsp;&nbsp; Kec./Kab. : ${escapeHtml(kecKab)} / ${escapeHtml(kecKab)}</td></tr>
        <tr><td style="border: none; padding: 4px;">Kordes</td>
            <td style="border: none; padding: 4px;">: ${escapeHtml(meta.kordesNama || '........................')} / NIM. ${escapeHtml(meta.kordesNim || '........')}</td></tr>
        <tr><td style="border: none; padding: 4px;">DPL</td>
            <td style="border: none; padding: 4px;">: ${escapeHtml(meta.dplNama || '........................')} / NIDN. ${escapeHtml(meta.dplNidn || '........')}</td></tr>
      </table>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 11pt;">
        <thead>
          <tr>
            <th style="border: 1px solid black; padding: 8px; text-align: center;">No</th>
            <th style="border: 1px solid black; padding: 8px; text-align: center;">NIM</th>
            <th style="border: 1px solid black; padding: 8px; text-align: center;">Nama</th>
            ${dayHeaders}
            <th style="border: 1px solid black; padding: 8px; text-align: center; width: 150px;">Keterangan</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="font-size: 11pt; line-height: 1.5;">
        <strong>Keterangan:</strong>
        <ol style="padding-left: 20px; margin-top: 5px;">
          <li>Daftar hadir dibuat perminggu (minggu ke-1, 2, 3, 4 setiap 7 hari, untuk minggu ke-5 dibuat sisa harinya sampai hari penarikan)</li>
          <li>Tanggal dimulai dari saat observasi lapangan sampai penarikan</li>
          <li>Kolom keterangan diisi alasan jika anggota tim ada ijin/tidak hadir di posko KKN dan telah mendapatkan ijin dari DPL, misalnya bekerja (untuk mahasiswa yang bekerja)</li>
          <li>Format daftar hadir dapat dibuat landscape</li>
        </ol>
      </div>
    </div>`;
};

const wrapHtml = (body, landscape = true) => `
  <!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: 'Times New Roman', Times, serif; color: black; background: white; margin: 0; padding: 20px; font-size: 11pt; }
    .pdf-html-content p { margin: 0 0 5px 0; }
    .pdf-html-content ul { margin: 0; padding-left: 15px; }
  </style></head><body>${body}</body></html>`;

/** Single week absensi PDF (format mingguan — landscape) */
export async function generateAbsensiWeeklyPDF(rekapData, meta, weekChunk) {
  const chunk = weekChunk.length ? weekChunk : [new Date()];
  const body = buildAbsensiPageHtml(rekapData, meta, chunk, 0, 1, false);
  return renderPDF(wrapHtml(body), true);
};

/** Full KKN period absensi — all weeks in one PDF (format seluruh — portrait) */
export async function generateAbsensiFullPeriodPDF(rekapData, meta, weekChunks) {
  const chunks = weekChunks.length ? weekChunks : [[]];
  const pages = chunks.map((chunk, idx) =>
    buildAbsensiPageHtml(rekapData, meta, chunk, idx, chunks.length, true)
  ).join('');
  return renderPDF(wrapHtml(pages), false);
};

/** Lampiran 8 — combined logbook (matches CetakLogbookModal) */
export async function generateLogbookPDF(logbooks) {
  const rows = (logbooks || []).map((log, index) => {
    let photoHtml = '';
    const photoList = log.photos || [];
    for (const photo of photoList) {
      const b64 = getBase64Image(photo.url_file || photo.file_path);
      if (b64) {
        photoHtml = `<img src="${b64}" style="max-width: 90px; max-height: 90px; object-fit: cover;" />`;
        break;
      }
    }
    const waktuMulai = log.waktu_mulai ? String(log.waktu_mulai).slice(0, 5) : '-';
    const waktuSelesai = log.waktu_selesai ? String(log.waktu_selesai).slice(0, 5) : '-';
    const durasi = log.waktu_mulai && log.waktu_selesai
      ? `<br><span>${hitungDurasi(log.waktu_mulai, log.waktu_selesai)} jam</span>` : '';

    return `
      <tr>
        <td style="border: 1px solid black; padding: 6px; text-align: center; vertical-align: top;">${index + 1}</td>
        <td style="border: 1px solid black; padding: 6px; vertical-align: top;">${formatLogbookTanggal(log.tanggal)}</td>
        <td style="border: 1px solid black; padding: 6px; vertical-align: top;">${waktuMulai} - ${waktuSelesai}${durasi}</td>
        <td style="border: 1px solid black; padding: 6px; vertical-align: top;"><div class="pdf-html-content">${log.deskripsi || '-'}</div></td>
        <td style="border: 1px solid black; padding: 6px; vertical-align: top;">${escapeHtml(log.tempat || '-')}</td>
        <td style="border: 1px solid black; padding: 6px; vertical-align: top;">
          <strong>PIC:</strong> ${escapeHtml(log.proker)} (${escapeHtml(log.nama_pic)})<br><br>
          <strong>Peserta:</strong> ${escapeHtml(log.sasaran || '-')}
        </td>
        <td style="border: 1px solid black; padding: 6px; text-align: center; vertical-align: top;">${photoHtml}</td>
      </tr>`;
  }).join('');

  const emptyRow = logbooks?.length
    ? ''
    : '<tr><td colspan="7" style="border: 1px solid black; padding: 15px; text-align: center; color: gray;">Belum ada logbook</td></tr>';

  const body = `
    <h3 style="color: #1e3a8a; text-align: left; font-size: 12pt; margin-bottom: 20px; font-weight: bold;">Lampiran 8. Logbook Kegiatan Harian</h3>
    <h2 style="text-align: center; font-size: 12pt; font-weight: bold; margin-bottom: 30px;">LOGBOOK KEGIATAN HARIAN</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 10pt;">
      <thead>
        <tr>
          <th style="border: 1px solid black; padding: 8px; text-align: center; width: 30px;">No</th>
          <th style="border: 1px solid black; padding: 8px; text-align: center; width: 100px;">Hari /<br>Tanggal</th>
          <th style="border: 1px solid black; padding: 8px; text-align: center; width: 100px;">Waktu &<br>Durasi<br>Kegiatan</th>
          <th style="border: 1px solid black; padding: 8px; text-align: center;">Kegiatan yang<br>Dilakukan</th>
          <th style="border: 1px solid black; padding: 8px; text-align: center; width: 120px;">Tempat</th>
          <th style="border: 1px solid black; padding: 8px; text-align: center; width: 150px;">Penanggung Jawab/PIC<br>dan sasaran/peserta</th>
          <th style="border: 1px solid black; padding: 8px; text-align: center; width: 110px;">Foto<br>Kegiatan</th>
        </tr>
      </thead>
      <tbody>${rows || emptyRow}</tbody>
    </table>
    <div style="font-size: 10pt; line-height: 1.5;">
      <strong>Keterangan:</strong>
      <ol style="padding-left: 20px; margin-top: 5px;">
        <li>Pengisian logbook dimulai dari orientasi dan observasi lapangan, penerjunan, sampai dengan penarikan</li>
        <li>Semua kegiatan yang dilakukan tim KKN dapat dicatat, mulai persiapan/penyiapan perlengkapan untuk kegiatan</li>
        <li>Dalam sehari dapat mencatat beberapa kegiatan</li>
        <li>Dalam waktu yang bersamaan memungkinkan ada 2 atau lebih kegiatan (ditulis semua) jika memang ada pembagian tugas</li>
      </ol>
    </div>`;

  return renderPDF(wrapHtml(body), true);
};

/** Lampiran 5 — buku tamu (matches BukuTamuAdmin print template) */
export async function generateBukuTamuPDF(tamuList, printConfig = {}) {
  const desa = printConfig.desa || '........................';
  const kecamatan = printConfig.kecamatan || '........................';
  const kabupaten = printConfig.kabupaten || '........................';
  const chunks = tamuList.length ? chunkArray(tamuList, 5) : [[]];

  const pages = chunks.map((chunk, pageIndex) => {
    const rows = chunk.map((t, idx) => {
      const ttdB64 = getBase64Image(t.ttd_tamu_url);
      const ttdHtml = ttdB64
        ? `<img src="${ttdB64}" style="max-height: 45px; max-width: 60px;" />`
        : '';
      return `
        <tr>
          <td style="border: 1px solid black; padding: 8px; text-align: center;">${pageIndex * 5 + idx + 1}</td>
          <td style="border: 1px solid black; padding: 8px; text-align: center;">${formatDateWithDay(t.tanggal)}</td>
          <td style="border: 1px solid black; padding: 8px;">${escapeHtml(t.nama_tamu)}</td>
          <td style="border: 1px solid black; padding: 8px;">${escapeHtml(t.alamat_jabatan)}</td>
          <td style="border: 1px solid black; padding: 8px;">${escapeHtml(t.keperluan)}</td>
          <td style="border: 1px solid black; padding: 8px; text-align: center;">${escapeHtml(t.nama_penyambut || '-')}</td>
          <td style="border: 1px solid black; padding: 2px; text-align: center; vertical-align: middle; height: 50px;">${ttdHtml}</td>
        </tr>`;
    }).join('');

    const emptyRow = chunk.length === 0
      ? '<tr><td colspan="7" style="border: 1px solid black; padding: 15px; text-align: center; color: gray;">Belum ada histori tamu</td></tr>'
      : '';

    const keterangan = pageIndex === chunks.length - 1 ? `
      <div style="margin-top: 30px; font-size: 10pt; line-height: 1.4;">
        <strong><u>Keterangan:</u></strong><br>
        1. Format daftar tamu dapat dibuat landscape<br>
        2. Kolom alamat/jabatan tamu silahkan diisi dengan alamat tamu dan jabatan di masyarakat jika mempunyai, misalnya: ketua RT 07 RW 03, Bayan, Bidan Desa, dan sebagainya<br>
        3. Keperluan diisi dengan keperluan dan penyelesaian/tanggapan dari tim KKN<br>
        4. Jika tim KKN mengadakan bimbingan belajar untuk anak sekolah, <strong>tidak perlu</strong> dimasukkan dalam daftar tamu
      </div>` : '';

    return `
      <div style="${pageIndex > 0 ? 'page-break-before: always; padding-top: 10mm;' : ''}">
        <h3 style="color: #1e3a8a; font-family: Arial, sans-serif; margin-bottom: 2rem;">Lampiran 5. Daftar Tamu</h3>
        <h2 style="text-align: center; margin-bottom: 5px; font-size: 16pt; font-weight: bold;">DAFTAR TAMU KKN</h2>
        <h3 style="text-align: center; margin-top: 0; margin-bottom: 20px; font-size: 14pt; font-weight: bold; text-transform: uppercase;">
          DESA ${escapeHtml(desa)} KECAMATAN ${escapeHtml(kecamatan)} KABUPATEN ${escapeHtml(kabupaten)}
        </h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11pt;">
          <thead>
            <tr>
              <th style="border: 1px solid black; padding: 10px 5px; width: 5%;">No</th>
              <th style="border: 1px solid black; padding: 10px 5px; width: 15%;">Hari, Tanggal</th>
              <th style="border: 1px solid black; padding: 10px 5px; width: 20%;">Nama Tamu</th>
              <th style="border: 1px solid black; padding: 10px 5px; width: 20%;">Alamat / Jabatan<br>Tamu</th>
              <th style="border: 1px solid black; padding: 10px 5px; width: 15%;">Keperluan</th>
              <th style="border: 1px solid black; padding: 10px 5px; width: 15%;">Mhs Yang<br>Menemui</th>
              <th style="border: 1px solid black; padding: 10px 5px; width: 10%;">TTD<br>Tamu</th>
            </tr>
          </thead>
          <tbody>${rows}${emptyRow}</tbody>
        </table>
        ${keterangan}
      </div>`;
  }).join('');

  return renderPDF(wrapHtml(pages), true);
};

/** LPJ Kas — matches BendaharaDashboard exportPDF (semua waktu) */
export async function generateLPJPDF(transaksiList, poskoName = '') {
  const formatRupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
  let masuk = 0;
  let keluar = 0;
  (transaksiList || []).forEach((t) => {
    if (t.jenis === 'pemasukan') masuk += Number(t.nominal);
    if (t.jenis === 'pengeluaran') keluar += Number(t.nominal);
  });
  const saldo = masuk - keluar;
  const today = new Date().toLocaleDateString('id-ID');

  const rows = (transaksiList || []).map((t) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 0.5rem;">${parseYMD(t.tanggal).toLocaleDateString('id-ID')}</td>
      <td style="padding: 0.5rem;">${escapeHtml(t.jenis)}</td>
      <td style="padding: 0.5rem;">${escapeHtml(t.nama_kategori || '-')}</td>
      <td style="padding: 0.5rem;">${escapeHtml(t.keterangan)}</td>
      <td style="padding: 0.5rem; text-align: right;">${t.jenis === 'pemasukan' ? formatRupiah(t.nominal) : '-'}</td>
      <td style="padding: 0.5rem; text-align: right;">${t.jenis === 'pengeluaran' ? formatRupiah(t.nominal) : '-'}</td>
    </tr>`).join('');

  const emptyRow = transaksiList?.length
    ? ''
    : '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">Tidak ada transaksi.</td></tr>';

  const body = `
    <h2 style="text-align: center; margin-bottom: 0.5rem; font-family: sans-serif;">Laporan Kas Posko KKN</h2>
    <p style="text-align: center; color: #666; margin-bottom: 1.5rem; font-family: sans-serif;">
      ${poskoName ? `Posko: ${escapeHtml(poskoName)} | ` : ''}Periode: Semua Waktu | Tanggal Unduh: ${today}
    </p>
    <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; font-family: sans-serif;">
      <thead>
        <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
          <th style="padding: 0.5rem; text-align: left;">Tanggal</th>
          <th style="padding: 0.5rem; text-align: left;">Jenis</th>
          <th style="padding: 0.5rem; text-align: left;">Kategori / RAB</th>
          <th style="padding: 0.5rem; text-align: left;">Keterangan</th>
          <th style="padding: 0.5rem; text-align: right;">Pemasukan</th>
          <th style="padding: 0.5rem; text-align: right;">Pengeluaran</th>
        </tr>
      </thead>
      <tbody>
        ${rows || emptyRow}
        <tr style="font-weight: bold; background: #f8fafc;">
          <td colspan="4" style="padding: 0.5rem; text-align: right;">TOTAL:</td>
          <td style="padding: 0.5rem; text-align: right; color: #10b981;">${formatRupiah(masuk)}</td>
          <td style="padding: 0.5rem; text-align: right; color: #ef4444;">${formatRupiah(keluar)}</td>
        </tr>
        <tr style="font-weight: bold; font-size: 1rem; background: #e0f2fe;">
          <td colspan="4" style="padding: 0.75rem; text-align: right;">SALDO AKHIR:</td>
          <td colspan="2" style="padding: 0.75rem; text-align: center; color: #0369a1;">${formatRupiah(saldo)}</td>
        </tr>
      </tbody>
    </table>`;

  return renderPDF(wrapHtml(body, false), true);
};

// Legacy alias kept for excel/test compatibility
export async function generateAbsensiPDF(rekapData, poskoName, meta = {}) {
  const weekChunks = rekapData._weekChunks || [[]];
  return generateAbsensiFullPeriodPDF(rekapData, { ...meta, desa: meta.desa || poskoName }, weekChunks);
};

export async function generateKeuanganPDF(transaksi, _iuran, _kategori, _users, poskoName) {
  return generateLPJPDF(transaksi, poskoName);
};

const getExecutablePath = () => {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Chrome/Chromium/Edge tidak ditemukan di sistem ini (Baik Windows maupun Linux). Pastikan browser terinstal.');
};

let sharedBrowser = null;
let sharedPage = null;
let pdfSessionDepth = 0;

/** @returns {boolean} */
const isBrowserAlive = (browser) => !!(browser && browser.connected);

/** Reuse one browser for batch PDF generation (backup). Call endPdfSession() in finally. */
export async function beginPdfSession() {
  if (isBrowserAlive(sharedBrowser)) {
    pdfSessionDepth++;
    return sharedBrowser;
  }
  if (sharedBrowser) {
    try { await sharedBrowser.close(); } catch (_) { /* ignore */ }
    sharedBrowser = null;
  }
  sharedBrowser = await puppeteer.launch({
    headless: 'new',
    executablePath: getExecutablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  sharedPage = await sharedBrowser.newPage();
  sharedPage.setDefaultTimeout(60000);
  pdfSessionDepth++;
  return sharedBrowser;
}

export async function endPdfSession() {
  pdfSessionDepth = Math.max(0, pdfSessionDepth - 1);
  if (pdfSessionDepth === 0) {
    if (sharedPage) {
      try { await sharedPage.close(); } catch (_) { /* ignore */ }
      sharedPage = null;
    }
    if (sharedBrowser) {
      try { await sharedBrowser.close(); } catch (_) { /* ignore */ }
      sharedBrowser = null;
    }
  }
}

const renderPDF = async (htmlContent, landscape = false) => {
  const inSession = pdfSessionDepth > 0;
  const ownsBrowser = !inSession;
  const browser = inSession
    ? sharedBrowser
    : await puppeteer.launch({
        headless: 'new',
        executablePath: getExecutablePath(),
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });

  if (!isBrowserAlive(browser)) {
    throw new Error('Browser PDF tidak tersedia.');
  }

  const page = inSession ? sharedPage : await browser.newPage();
  if (!inSession) page.setDefaultTimeout(60000);
  try {
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape,
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      timeout: 60000,
    });
    return Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
  } finally {
    if (!inSession) {
      await page.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }
};

export async function generateLampiran9PDF(rekapData) {
  const chunks = rekapData.length ? chunkArray(rekapData, 15) : [[]];

  const pages = chunks.map((chunk, pageIndex) => {
    const rows = chunk.map((mhs, idx) => `
      <tr>
        <td style="border: 1px solid black; padding: 8px; text-align: center; font-size: 11pt;">${pageIndex * 15 + idx + 1}</td>
        <td style="border: 1px solid black; padding: 8px; text-align: center; font-size: 11pt;">${mhs.nim}</td>
        <td style="border: 1px solid black; padding: 8px; font-size: 11pt;">${escapeHtml(mhs.nama)}</td>
        <td style="border: 1px solid black; padding: 8px; text-align: center; font-size: 11pt;">${mhs.total_jam}</td>
      </tr>
    `).join('');

    const emptyRow = chunk.length === 0
      ? '<tr><td colspan="4" style="border: 1px solid black; padding: 15px; text-align: center; color: gray;">Tidak ada data mahasiswa.</td></tr>'
      : '';

    return `
      <div style="${pageIndex > 0 ? 'page-break-before: always; padding-top: 10mm;' : ''}">
        <h3 style="color: #002060; font-family: 'Times New Roman', Times, serif; font-size: 14pt; margin-bottom: 20px; font-weight: bold;">Lampiran 9. Rekapitulasi Keaktifan Tiap Mahasiswa</h3>
        <h4 style="font-family: 'Times New Roman', Times, serif; font-size: 12pt; margin-bottom: 20px; font-weight: bold;">REKAPITULASI KEAKTIFAN MAHASISWA</h4>
        <table style="width: 100%; border-collapse: collapse; font-family: 'Times New Roman', Times, serif; margin-bottom: 30px;">
          <thead>
            <tr>
              <th style="border: 1px solid black; padding: 8px; text-align: center; font-weight: bold; font-size: 11pt; width: 10%;">No</th>
              <th style="border: 1px solid black; padding: 8px; text-align: center; font-weight: bold; font-size: 11pt; width: 20%;">NIM</th>
              <th style="border: 1px solid black; padding: 8px; text-align: center; font-weight: bold; font-size: 11pt; width: 45%;">Nama</th>
              <th style="border: 1px solid black; padding: 8px; text-align: center; font-weight: bold; font-size: 11pt; width: 25%;">Total Jam</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            ${emptyRow}
          </tbody>
        </table>
        ${pageIndex === chunks.length - 1 ? '<div style="font-family: \'Times New Roman\', Times, serif; font-size: 11pt;"><strong>Keterangan:</strong> total Jam dihitung dari logbook</div>' : ''}
      </div>`;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { margin: 10mm; }
          body { font-family: "Times New Roman", Times, serif; color: black; background: white; margin: 0; padding: 10mm; }
        </style>
      </head>
      <body>
        ${pages}
      </body>
    </html>
  `;
  return renderPDF(html, false);
}
