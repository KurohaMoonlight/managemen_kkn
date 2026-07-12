/**
 * fileHelpers.js
 * Fungsi-fungsi utility murni (pure) yang digunakan bersama oleh
 * AdminExplorer dan SuperAdminExplorer.
 */

/**
 * Mengembalikan emoji icon berdasarkan tipe MIME dan nama file.
 * @param {string} tipe - Tipe MIME file (e.g. 'application/pdf')
 * @param {string} [nama=''] - Nama file (e.g. 'laporan.docx')
 * @returns {string} Emoji icon
 */
export function getFileIcon(tipe, nama = '') {
  if (tipe === 'link') return '🔗';
  const n = nama.toLowerCase();
  if (n.endsWith('.zip') || n.endsWith('.rar') || n.endsWith('.7z')) return '📦';
  if (n.endsWith('.pdf') || (tipe && tipe.includes('pdf'))) return '📕';
  if (n.endsWith('.doc') || n.endsWith('.docx') || (tipe && tipe.includes('word'))) return '📘';
  if (
    n.endsWith('.xls') ||
    n.endsWith('.xlsx') ||
    (tipe && (tipe.includes('excel') || tipe.includes('spreadsheet')))
  )
    return '📗';
  if (n.endsWith('.ppt') || n.endsWith('.pptx') || (tipe && tipe.includes('presentation'))) return '📙';
  if (tipe && tipe.includes('image')) return '🖼️';
  if (tipe && tipe.includes('video')) return '🎬';
  return '📄';
}

/**
 * Men-download sebuah URL sebagai file ke perangkat pengguna.
 * Mengganti pola berulang: fetch → blob → createElement → click → revoke.
 * @param {string} fileUrl - URL file yang akan diunduh
 * @param {string} filename - Nama file yang akan disimpan
 * @throws {Error} Jika fetch gagal
 */
export async function downloadBlob(fileUrl, filename) {
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error('Gagal mengunduh file.');
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(link);
}
