export default (data) => `
    <p>Yth. Pimpinan <b>${data.nama_perusahaan || '.............'}</b><br />di Tempat</p>
    <p>Dengan hormat,</p>
    <p>Sebagai bentuk dedikasi dan pengabdian kepada masyarakat, mahasiswa Kuliah Kerja Nyata (KKN) berencana menyelenggarakan sebuah kegiatan besar bertema <b>"${data.nama_kegiatan || '.............'}"</b> guna meningkatkan kesejahteraan dan produktivitas warga desa.</p>
    <p>Agar acara ini berjalan dengan lancar dan sukses, kami menyadari bahwa dukungan material maupun finansial sangat kami butuhkan. Oleh karena itu, kami mengajukan permohonan donasi atau <i>sponsorship</i> kepada perusahaan yang Bapak/Ibu pimpin.</p>
    <p>Bentuk <i>sponsorship</i> atau bantuan yang kami ajukan berupa <b>${data.bentuk_sponsorship || '.............'}</b>.</p>
    <p>Proposal teknis kegiatan dan rincian anggaran telah kami lampirkan bersama surat ini. Kami sangat berharap Bapak/Ibu bersedia menjadi donatur atau sponsor kegiatan kami. Atas perhatian, bantuan, dan dukungan Bapak/Ibu, kami ucapkan terima kasih.</p>
`;
