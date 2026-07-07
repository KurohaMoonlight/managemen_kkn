import ExcelJS from 'exceljs';

export const generateAbsensiExcel = async (rekapData, poskoName) => {
  const { mahasiswa, absensi } = rekapData;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Rekap Absensi');

  let startDate = new Date();
  let endDate = new Date();
  
  if (absensi.length > 0) {
    const sorted = [...absensi].sort((a,b) => new Date(a.tanggal) - new Date(b.tanggal));
    startDate = new Date(sorted[0].tanggal);
    endDate = new Date(sorted[sorted.length - 1].tanggal);
  }

  const allDates = [];
  let current = new Date(startDate);
  while (current <= endDate) {
    allDates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  // Set Title
  sheet.mergeCells('A1', 'E1');
  sheet.getCell('A1').value = `REKAP ABSENSI POSKO ${poskoName}`;
  sheet.getCell('A1').font = { size: 16, bold: true };
  sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
  
  sheet.addRow([]);

  // Generate Header Row
  const headerRow = ['No', 'NIM', 'Nama Lengkap'];
  allDates.forEach(d => {
    headerRow.push(`${d.getDate()}/${d.getMonth()+1}`);
  });
  
  const header = sheet.addRow(headerRow);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle', horizontal: 'center' };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' }
    };
  });

  // Adjust Column Widths
  sheet.getColumn(1).width = 5;
  sheet.getColumn(2).width = 15;
  sheet.getColumn(3).width = 30;
  for (let i = 4; i < 4 + allDates.length; i++) {
    sheet.getColumn(i).width = 8;
  }

  const toYMD = (d) => {
    if (!d) return '';
    const dateObj = new Date(d);
    if (isNaN(dateObj)) return String(d).split('T')[0];
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Populate Data
  mahasiswa.forEach((m, i) => {
    const rowData = [i + 1, m.nim, m.nama_lengkap];
    allDates.forEach(d => {
      const dStr = toYMD(d);
      const record = absensi.find(a => a.user_id === m.id && toYMD(a.tanggal) === dStr);
      let status = '-';
      if (record) {
        if (record.status === 'hadir') status = 'H';
        else if (record.status === 'izin') status = 'I';
        else if (record.status === 'sakit') status = 'S';
        else if (record.status === 'alpa') status = 'A';
      }
      rowData.push(status);
    });

    const row = sheet.addRow(rowData);
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
      
      if (colNumber > 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (cell.value === 'H') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
        else if (cell.value === 'I') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };
        else if (cell.value === 'S') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };
        else if (cell.value === 'A') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
      }
    });
  });

  sheet.addRow([]);
  sheet.addRow(['Keterangan:']);
  sheet.addRow(['H: Hadir', 'I: Izin', 'S: Sakit', 'A: Alpa']);
  
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
};
