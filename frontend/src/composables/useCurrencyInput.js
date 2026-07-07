/** Format angka untuk tampilan di input form (contoh: Rp 1.500.000) */
export const formatCurrencyInput = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  const digits = String(val).replace(/\D/g, '');
  if (!digits) return '';
  return `Rp ${Number(digits).toLocaleString('id-ID')}`;
};

/** Ambil nilai numerik mentah dari input yang diformat */
export const parseCurrencyInput = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  return val.toString().replace(/\D/g, '');
};

/** Format angka untuk tampilan read-only (tabel, label, dll.) */
export const formatRupiah = (angka) => {
  const num = Number(String(angka ?? '').replace(/\D/g, '') || 0);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
};

export const useCurrencyInput = () => ({
  formatCurrencyInput,
  parseCurrencyInput,
  formatRupiah,
});
