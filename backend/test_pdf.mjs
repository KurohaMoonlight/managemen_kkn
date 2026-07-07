import { generateAbsensiFullPeriodPDF, generateBukuTamuPDF, generateLogbookPDF, generateLPJPDF, setUploadsDir } from './pdfGenerator.mjs';
import { generateAbsensiExcel } from './excelGenerator.mjs';

const runTest = async () => {
  try {
    setUploadsDir('./uploads');
    const rekapData = {
      mahasiswa: [{ id: 1, nim: '123', nama_lengkap: 'Test' }],
      absensi: [{ user_id: 1, tanggal: '2026-07-05', status: 'hadir' }],
    };
    const meta = { desa: 'Test', kordesNama: 'K', kordesNim: '1', dplNama: 'D', dplNidn: '2' };
    const weekChunks = [[new Date(2026, 6, 5)]];

    console.log('Testing Absensi Weekly PDF...');
    await generateAbsensiFullPeriodPDF(rekapData, meta, weekChunks);
    console.log('Absensi PDF OK');

    console.log('Testing Absensi Excel...');
    await generateAbsensiExcel(rekapData, 'Test Posko');
    console.log('Absensi Excel OK');

    console.log('Testing Buku Tamu PDF...');
    await generateBukuTamuPDF(
      [{ tanggal: '2026-07-05', nama_tamu: 'T', alamat_jabatan: 'A', keperluan: 'K', nama_penyambut: 'M' }],
      { desa: 'Desa', kecamatan: 'Kec', kabupaten: 'Kab' }
    );
    console.log('Buku Tamu PDF OK');

    console.log('Testing Logbook PDF...');
    await generateLogbookPDF([]);
    console.log('Logbook PDF OK');

    console.log('Testing LPJ PDF...');
    await generateLPJPDF([], 'Test Posko');
    console.log('LPJ PDF OK');
  } catch (err) {
    console.error('FAILED:', err);
  }
};

runTest();
