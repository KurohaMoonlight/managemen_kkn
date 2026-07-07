export default (data) => `
    <p>Yth. Pimpinan/Kepala <b>${data.instansi_tujuan || '.............'}</b><br />di Tempat</p>
    <p>Dengan hormat,</p>
    <p>Sehubungan dengan pelaksanaan program Kuliah Kerja Nyata (KKN), kami mahasiswa KKN membutuhkan beberapa data sekunder terkait kondisi demografi dan potensi wilayah untuk menunjang kelancaran program kerja kami.</p>
    <p>Melalui surat ini, kami memohon kesediaan Bapak/Ibu untuk dapat memberikan akses atau salinan <b>${data.jenis_data || '.............'}</b>.</p>
    <p>Adapun data tersebut akan kami pergunakan secara eksklusif untuk tujuan <b>${data.tujuan_penggunaan || '.............'}</b> dan tidak untuk disalahgunakan.</p>
    <p>Besar harapan kami agar permohonan ini dapat dipenuhi. Demikian surat permohonan data ini kami sampaikan, atas perhatian dan kerjasama Bapak/Ibu kami ucapkan terima kasih.</p>
`;
