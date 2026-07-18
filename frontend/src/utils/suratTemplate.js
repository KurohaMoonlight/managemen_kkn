import SuratIzin from './template_surat/SuratIzin';
import SuratUndangan from './template_surat/SuratUndangan';
import SuratPermohonanNarasumber from './template_surat/SuratPermohonanNarasumber';
import SuratPeminjamanTempat from './template_surat/SuratPeminjamanTempat';
import SuratPeminjamanAlat from './template_surat/SuratPeminjamanAlat';
import SuratDukunganKerjasama from './template_surat/SuratDukunganKerjasama';
import SuratTugasInternal from './template_surat/SuratTugasInternal';
import SuratKeteranganKeikutsertaan from './template_surat/SuratKeteranganKeikutsertaan';
import SuratPermohonanData from './template_surat/SuratPermohonanData';
import SuratBeritaAcara from './template_surat/SuratBeritaAcara';
import SuratPengantar from './template_surat/SuratPengantar';
import SuratSponsorship from './template_surat/SuratSponsorship';

export const getSuratPreviewHtml = (s, userValue) => {
  if (!s || !s.jenis_surat) {
    return `<div style="padding: 40px; text-align: center; color: #94a3b8; font-style: italic; border: 2px dashed #cbd5e1;">Pilih template surat terlebih dahulu di menu sebelumnya.</div>`;
  }

  const data = s.data_field || {};
  let content = `<div style="padding: 40px; font-family: 'Times New Roman', Times, serif; color: black; line-height: 1.5; font-size: 14px;">`;
  
  const universitas = data.universitas || 'UNIVERSITAS X';
  const desa = data.nama_desa || 'DESA CONTOH';
  const kecamatan = data.nama_kecamatan || 'KEC. CONTOH';
  const alamat = data.alamat_sekretariat || 'Jl. Raya Desa Contoh No. 123, Kab. Contoh, Prov. Contoh';
  const logoKiri = data.logo_kiri || '';
  const logoKanan = data.logo_kanan || '';
  
  const widthKiri = data.logo_kiri_width || 70;
  const heightKiri = data.logo_kiri_height || 70;
  const widthKanan = data.logo_kanan_width || 70;
  const heightKanan = data.logo_kanan_height || 70;

  const getAbsoluteUrl = (url) => url && !url.startsWith('http') && !url.startsWith('data:') ? window.location.origin + url : url;
  const absLogoKiri = getAbsoluteUrl(logoKiri);
  const absLogoKanan = getAbsoluteUrl(logoKanan);

  const logoKiriHtml = logoKiri
    ? `<img src="${absLogoKiri}" crossorigin="anonymous" style="width: ${widthKiri}px; height: ${heightKiri}px; object-fit: contain; display: block;" />`
    : `<div style="width: ${widthKiri}px; height: ${heightKiri}px;"></div>`;

  const logoKananHtml = logoKanan
    ? `<img src="${absLogoKanan}" crossorigin="anonymous" style="width: ${widthKanan}px; height: ${heightKanan}px; object-fit: contain; display: block;" />`
    : `<div style="width: ${widthKanan}px; height: ${heightKanan}px;"></div>`;

  content += `
    <div style="border-bottom: 3px solid black; padding-bottom: 10px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
      <div style="flex-shrink: 0;">${logoKiriHtml}</div>
      <div style="text-align: center; flex: 1;">
        <h2 style="margin: 0; font-size: 18px; font-weight: bold; text-transform: uppercase;">KULIAH KERJA NYATA (KKN) ${universitas}</h2>
        <h3 style="margin: 0; font-size: 16px; text-transform: uppercase;">POSKO ${userValue?.posko_id || ''} - DESA ${desa} KEC. ${kecamatan}</h3>
        <p style="margin: 5px 0 0; font-size: 12px;">Sekretariat: ${alamat}</p>
      </div>
      <div style="flex-shrink: 0;">${logoKananHtml}</div>
    </div>
  `;

  const d = new Date();
  const dateStr = `${d.getDate()} ${["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"][d.getMonth()]} ${d.getFullYear()}`;
  
  content += `
    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
      <div>
        <div>Nomor : ${s.nomor_surat || '___/KKN-.../2026'}</div>
        <div>Hal&nbsp;&nbsp;&nbsp;&nbsp;: <b>${s.jenis_surat || '...'}</b></div>
      </div>
      <div>
        Desa ${desa}, ${dateStr}
      </div>
    </div>
  `;

  content += `<div style="text-align: justify; margin-bottom: 30px;">`;
  
  let bodyContent = '';
  switch(s.jenis_surat) {
    case 'Surat Permohonan Izin Kegiatan': bodyContent = SuratIzin(data); break;
    case 'Surat Undangan': bodyContent = SuratUndangan(data); break;
    case 'Surat Permohonan Narasumber': bodyContent = SuratPermohonanNarasumber(data); break;
    case 'Surat Peminjaman Tempat': bodyContent = SuratPeminjamanTempat(data); break;
    case 'Surat Peminjaman Peralatan': bodyContent = SuratPeminjamanAlat(data); break;
    case 'Surat Dukungan / Kerja Sama': bodyContent = SuratDukunganKerjasama(data); break;
    case 'Surat Tugas Internal': bodyContent = SuratTugasInternal(data); break;
    case 'Surat Keterangan Keikutsertaan': bodyContent = SuratKeteranganKeikutsertaan(data); break;
    case 'Surat Permohonan Data': bodyContent = SuratPermohonanData(data); break;
    case 'Surat Berita Acara': bodyContent = SuratBeritaAcara(data); break;
    case 'Surat Pengantar': bodyContent = SuratPengantar(data); break;
    case 'Surat Permohonan Sponsorship': bodyContent = SuratSponsorship(data); break;
    default: 
      bodyContent = `<p style="color: red;">Error: Template untuk jenis surat "${s.jenis_surat}" belum dikonfigurasi.</p>`;
  }
  content += bodyContent;
  
  content += `</div>`;

  let signaturesHtml = '';
  if (Array.isArray(data.signatures) && data.signatures.length > 0) {
    const justify = data.signatures.length === 1 ? 'flex-end' : (data.signatures.length === 2 ? 'space-between' : 'space-around');
    signaturesHtml = `
      <div style="display: flex; justify-content: ${justify}; margin-top: 80px; flex-wrap: wrap; gap: 40px;">
        ${data.signatures.map(sig => `
          <div style="text-align: center; flex: 1; min-width: 200px; max-width: 300px;">
            <p style="margin-bottom: 60px;">${sig.jabatan || '...'}</p>
            <p style="text-decoration: underline; font-weight: bold; margin: 0;">${sig.nama || '......................'}</p>
            <p style="margin: 0;">${sig.id || '................'}</p>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    // Fallback for old templates without dynamic signatures
    signaturesHtml = `
      <div style="display: flex; justify-content: space-between; margin-top: 80px;">
        <div style="text-align: center;">
          <p style="margin-bottom: 60px;">Sekretaris KKN</p>
          <p style="text-decoration: underline; font-weight: bold; margin: 0;">${userValue?.jabatan === 'Sekretaris' ? userValue.nama_lengkap : '......................'}</p>
          <p style="margin: 0;">NIM. ${userValue?.jabatan === 'Sekretaris' ? userValue.nim : '................'}</p>
        </div>
        <div style="text-align: center;">
          <p style="margin-bottom: 60px;">Koordinator Desa (Kordes)</p>
          <p style="text-decoration: underline; font-weight: bold; margin: 0;">${userValue?.jabatan === 'Kordes' ? userValue.nama_lengkap : '......................'}</p>
          <p style="margin: 0;">NIM. ${userValue?.jabatan === 'Kordes' ? userValue.nim : '................'}</p>
        </div>
      </div>
    `;
  }
  content += signaturesHtml;
  content += `</div>`;
  return content;
};
