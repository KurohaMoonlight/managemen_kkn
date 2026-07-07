export default (data) => `
    <p>Yth. <b>${data.nama_penerima || '.............'}</b><br />${data.jabatan || '.............'}<br />di Tempat</p>
    <p>Dengan hormat,</p>
    <p>Sehubungan dengan pelaksanaan program kerja Kuliah Kerja Nyata (KKN), kami bermaksud mengundang Bapak/Ibu untuk hadir pada kegiatan <b>${data.acara || '.............'}</b> yang akan diselenggarakan pada:</p>
    <table style="margin-left: 20px; margin-bottom: 10px;">
      <tr><td style="width: 100px;">Tanggal</td><td>: ${data.tanggal || '.............'}</td></tr>
      <tr><td>Waktu</td><td>: ${data.waktu || '.............'}</td></tr>
      <tr><td>Tempat</td><td>: ${data.tempat || '.............'}</td></tr>
    </table>
    <p>Kehadiran dan partisipasi Bapak/Ibu sangat berarti bagi kesuksesan kegiatan kami. Demikian surat undangan ini kami sampaikan. Atas perhatian dan kesediaannya, kami ucapkan terima kasih.</p>
`;
