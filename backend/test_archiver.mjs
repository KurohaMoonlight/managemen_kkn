import { generateAbsensiPDF } from './pdfGenerator.mjs';
import { generateAbsensiExcel } from './excelGenerator.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
const fs = require('fs');

const runTest = async () => {
  try {
    const rekapData = {
      mahasiswa: [{id: 1, nim: '123', nama_lengkap: 'Test'}],
      absensi: [{user_id: 1, tanggal: '2026-07-05T00:00:00Z', status: 'hadir'}]
    };
    
    const absensiPdfBuf = await generateAbsensiPDF(rekapData, 'Test Posko');
    const absensiExcelBuf = await generateAbsensiExcel(rekapData, 'Test Posko');
    
    console.log('PDF buf type:', typeof absensiPdfBuf, Buffer.isBuffer(absensiPdfBuf));
    console.log('Excel buf type:', typeof absensiExcelBuf, Buffer.isBuffer(absensiExcelBuf));

    const archive = new archiver.ZipArchive();
    const output = fs.createWriteStream('test.zip');
    archive.pipe(output);

    archive.append(absensiPdfBuf, { name: 'pdf.pdf' });
    archive.append(absensiExcelBuf, { name: 'excel.xlsx' });

    await archive.finalize();
    console.log('ZIP finalized successfully');
  } catch (err) {
    console.error('FAILED:', err);
  }
};

runTest();
