export default (data) => `
    <p>Yth. Pengelola <b>${data.nama_tempat || '.............'}</b><br />di Tempat</p>
    <p>Dengan hormat,</p>
    <p>Sehubungan dengan kelancaran pelaksanaan program Kuliah Kerja Nyata (KKN), kami mahasiswa KKN bermaksud memohon izin untuk meminjam tempat <b>${data.nama_tempat || '.............'}</b>.</p>
    <p>Tempat tersebut akan kami gunakan untuk keperluan <b>${data.keperluan || '.............'}</b>, yang pelaksanaannya dijadwalkan pada:</p>
    <table style="margin-left: 20px; margin-bottom: 10px;">
      <tr><td style="width: 100px;">Tanggal</td><td>: ${data.tanggal || '.............'}</td></tr>
      <tr><td>Waktu</td><td>: ${data.waktu || '.............'}</td></tr>
    </table>
    <p>Kami berkomitmen untuk menjaga kebersihan dan ketertiban tempat selama kegiatan berlangsung. Demikian surat permohonan ini kami sampaikan, atas izin yang diberikan kami ucapkan terima kasih.</p>
`;
