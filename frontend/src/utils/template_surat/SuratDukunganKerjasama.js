export default (data) => `
    <p>Yth. Pengurus <b>${data.nama_organisasi || '.............'}</b><br />di Tempat</p>
    <p>Dengan hormat,</p>
    <p>Dalam rangka merealisasikan program kerja Kuliah Kerja Nyata (KKN) yang bermanfaat bagi masyarakat, kami mahasiswa KKN melihat potensi besar dari <b>${data.nama_organisasi || '.............'}</b> sebagai mitra strategis.</p>
    <p>Oleh karena itu, kami bermaksud memohon dukungan dan menawarkan bentuk kerja sama berupa <b>${data.bentuk_kerjasama || '.............'}</b>. Adapun tujuan utama dari kolaborasi ini adalah <b>${data.tujuan || '.............'}</b>.</p>
    <p>Kami percaya bahwa dengan sinergi antara mahasiswa dan organisasi masyarakat, kita dapat mewujudkan kegiatan yang positif dan berdampak luas. Demikian surat permohonan kerja sama ini kami sampaikan, besar harapan kami untuk dapat berdiskusi lebih lanjut. Terima kasih.</p>
`;
