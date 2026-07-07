export default (data) => `
    <p>Yang bertanda tangan di bawah ini selaku Koordinator Desa (Kordes) Kuliah Kerja Nyata (KKN), memberikan mandat atau tugas resmi kepada:</p>
    <table style="margin-left: 20px; margin-bottom: 10px;">
      <tr><td style="width: 120px;">Nama Anggota</td><td>: <b>${data.nama_anggota || '.............'}</b></td></tr>
      <tr><td>NIM</td><td>: ${data.nim || '.............'}</td></tr>
    </table>
    <p>Untuk melaksanakan tugas spesifik berupa: <b>${data.tugas_spesifik || '.............'}</b>.</p>
    <p>Tugas ini wajib dilaksanakan dengan penuh tanggung jawab pada:</p>
    <table style="margin-left: 20px; margin-bottom: 10px;">
      <tr><td style="width: 120px;">Tanggal</td><td>: ${data.tanggal || '.............'}</td></tr>
      <tr><td>Waktu</td><td>: ${data.waktu || '.............'}</td></tr>
    </table>
    <p>Surat tugas ini dibuat untuk dapat dipergunakan sebagaimana mestinya dan agar yang bersangkutan dapat berkoordinasi dengan pihak-pihak terkait dalam pelaksanaan tugasnya.</p>
`;
