export default (data) => `
    <p>Yth. <b>${data.nama_narasumber || '.............'}</b><br />${data.instansi || '.............'}<br />di Tempat</p>
    <p>Dengan hormat,</p>
    <p>Dalam rangka pelaksanaan program kerja Kuliah Kerja Nyata (KKN), kami berencana mengadakan kegiatan penyuluhan/pelatihan bagi warga desa setempat.</p>
    <p>Oleh karena itu, kami memohon kesediaan Bapak/Ibu untuk menjadi narasumber dengan membawakan topik <b>"${data.topik_materi || '.............'}"</b> pada kegiatan yang akan dilaksanakan pada:</p>
    <table style="margin-left: 20px; margin-bottom: 10px;">
      <tr><td style="width: 100px;">Tanggal</td><td>: ${data.tanggal || '.............'}</td></tr>
      <tr><td>Waktu</td><td>: ${data.waktu || '.............'}</td></tr>
    </table>
    <p>Mengingat pentingnya materi tersebut, kami sangat mengharapkan kesediaan Bapak/Ibu. Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.</p>
`;
