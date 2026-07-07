export default (data) => `
    <p>Yth. Pimpinan <b>${data.instansi_tujuan || '.............'}</b><br />di Tempat</p>
    <p>Dengan hormat,</p>
    <p>Melalui surat ini, kami selaku perangkat atau panitia Kuliah Kerja Nyata (KKN) memberikan pengantar resmi kepada tim mahasiswa di bawah ini:</p>
    <div style="padding: 10px; margin-left: 20px; border-left: 3px solid #3b82f6; background: #eff6ff; margin-bottom: 15px;">
      ${data.daftar_anggota ? data.daftar_anggota.replace(/\\n/g, '<br/>') : '.............'}
    </div>
    <p>Untuk melaksanakan kegiatan kunjungan/survei lapangan ke instansi atau wilayah yang Bapak/Ibu pimpin, dengan tujuan spesifik: <b>${data.tujuan_survey || '.............'}</b>.</p>
    <p>Kami mohon kesediaan Bapak/Ibu untuk menerima mahasiswa kami dan memberikan arahan serta bimbingan selama mereka berada di lokasi.</p>
    <p>Demikian surat pengantar ini kami sampaikan, atas kesediaan dan kerjasama Bapak/Ibu kami ucapkan banyak terima kasih.</p>
`;
