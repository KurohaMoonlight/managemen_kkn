export default (data) => `
    <p>Yth. Kepala Desa / Pihak Terkait<br />di Tempat</p>
    <p>Dengan hormat,</p>
    <p>Sehubungan dengan pelaksanaan program Kuliah Kerja Nyata (KKN), kami bermaksud memohon izin untuk melaksanakan kegiatan <b>${data.nama_kegiatan || '.............'}</b> yang bertujuan untuk memberdayakan dan membantu masyarakat desa.</p>
    <p>Kegiatan ini akan dilaksanakan pada:</p>
    <table style="margin-left: 20px; margin-bottom: 10px;">
      <tr><td style="width: 150px;">Tanggal</td><td>: ${data.tanggal || '.............'}</td></tr>
      <tr><td>Waktu</td><td>: ${data.waktu || '.............'}</td></tr>
      <tr><td>Lokasi</td><td>: ${data.lokasi || '.............'}</td></tr>
      <tr><td>Penanggung Jawab</td><td>: ${data.penanggung_jawab || '.............'}</td></tr>
    </table>
    <p>Daftar panitia yang bertugas: ${data.daftar_panitia || '.............'}</p>
    <p>Besar harapan kami agar Bapak/Ibu dapat memberikan izin atas pelaksanaan kegiatan ini. Demikian surat permohonan izin ini kami sampaikan, atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p>
`;
