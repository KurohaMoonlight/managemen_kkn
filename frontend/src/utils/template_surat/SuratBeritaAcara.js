export default (data) => `
    <h3 style="text-align: center; margin-bottom: 20px;">BERITA ACARA</h3>
    <p>Pada hari ini, tanggal <b>${data.tanggal || '.............'}</b>, telah disepakati dan dilaksanakan suatu ketetapan oleh kedua belah pihak di bawah ini:</p>
    <table style="margin-left: 20px; margin-bottom: 10px;">
      <tr><td style="width: 100px;">Pihak Pertama</td><td>: <b>${data.pihak_pertama || '.............'}</b></td></tr>
      <tr><td>Pihak Kedua</td><td>: <b>${data.pihak_kedua || '.............'}</b></td></tr>
    </table>
    <p>Kedua belah pihak menyatakan dengan sebenar-benarnya kesepakatan atau serah terima mengenai:</p>
    <div style="padding: 15px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px; margin: 15px 0; font-style: italic;">
      ${data.isi_berita_acara ? data.isi_berita_acara.replace(/\\n/g, '<br/>') : '.............'}
    </div>
    <p>Demikian Berita Acara ini dibuat dan disahkan oleh kedua belah pihak dalam keadaan sadar dan tanpa paksaan dari pihak manapun.</p>
`;
