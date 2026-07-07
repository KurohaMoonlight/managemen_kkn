export default (data) => `
    <h3 style="text-align: center; margin-bottom: 20px;">SURAT KETERANGAN KEIKUTSERTAAN</h3>
    <p>Melalui surat ini, Panitia Kegiatan Kuliah Kerja Nyata (KKN) menerangkan dengan sesungguhnya bahwa:</p>
    <table style="margin-left: 20px; margin-bottom: 10px;">
      <tr><td style="width: 150px;">Nama Peserta/Warga</td><td>: <b>${data.nama_peserta || '.............'}</b></td></tr>
    </table>
    <p>Telah berpartisipasi aktif dan berperan sebagai <b>${data.peran || '.............'}</b> dalam pelaksanaan kegiatan <b>${data.nama_kegiatan || '.............'}</b> yang telah diselenggarakan pada tanggal <b>${data.tanggal || '.............'}</b>.</p>
    <p>Kami memberikan apresiasi yang setinggi-tingginya atas partisipasi dan antusiasme yang diberikan. Surat keterangan ini diterbitkan sebagai bukti fisik keikutsertaan yang bersangkutan.</p>
    <p>Demikian surat keterangan ini kami buat agar dapat dipergunakan sebagaimana mestinya.</p>
`;
