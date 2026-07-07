export default (data) => `
    <p>Yth. Pihak Terkait<br />di Tempat</p>
    <p>Dengan hormat,</p>
    <p>Sehubungan dengan pelaksanaan kegiatan Kuliah Kerja Nyata (KKN), kami mahasiswa KKN bermaksud memohon bantuan peminjaman peralatan untuk mendukung kelancaran kegiatan kami.</p>
    <p>Adapun alat yang ingin kami pinjam berupa <b>${data.daftar_alat || '.............'}</b>.</p>
    <p>Peralatan tersebut akan kami pergunakan untuk keperluan <b>${data.keperluan || '.............'}</b> pada jadwal berikut:</p>
    <table style="margin-left: 20px; margin-bottom: 10px;">
      <tr><td style="width: 100px;">Tanggal</td><td>: ${data.tanggal || '.............'}</td></tr>
      <tr><td>Waktu</td><td>: ${data.waktu || '.............'}</td></tr>
    </table>
    <p>Kami bersedia bertanggung jawab atas keamanan dan keutuhan peralatan selama masa peminjaman. Demikian surat permohonan ini, atas bantuan Bapak/Ibu kami ucapkan terima kasih.</p>
`;
