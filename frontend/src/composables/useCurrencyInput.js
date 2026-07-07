/** Ambil hanya digit mentah dari nilai apa pun */
export const parseCurrencyInput = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  return String(val).replace(/\D/g, '');
};

/** Format angka untuk tampilan di input form (contoh: 120.000) — tanpa prefix Rp agar tidak membingungkan */
export const formatCurrencyInput = (val) => {
  const digits = parseCurrencyInput(val);
  if (!digits) return '';
  // Hindari Number() untuk string panjang; format manual per 3 digit
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

/** Format angka untuk tampilan read-only (tabel, label, dll.) */
export const formatRupiah = (angka) => {
  const digits = parseCurrencyInput(angka);
  if (!digits) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(0);
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(digits));
};

/** Konversi nilai form ke angka untuk API */
export const toCurrencyNumber = (val) => {
  const digits = parseCurrencyInput(val);
  return digits ? Number(digits) : 0;
};

export const useCurrencyInput = () => ({
  formatCurrencyInput,
  parseCurrencyInput,
  formatRupiah,
  toCurrencyNumber,
});
