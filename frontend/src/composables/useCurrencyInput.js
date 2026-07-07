/** Ambil hanya digit mentah dari nilai apa pun */
export const parseCurrencyInput = (val) => {
  if (val === '' || val === null || val === undefined) return '';

  if (typeof val === 'number') {
    if (!Number.isFinite(val) || val < 0) return '';
    const n = Math.round(val);
    return n === 0 ? '' : String(n);
  }

  const str = String(val).trim();
  if (!str) return '';

  // Nilai desimal dari database/API (contoh: "120000.00") — jangan dianggap pemisah ribuan
  if (/^\d+\.\d{1,2}$/.test(str)) {
    const n = Math.round(Number(str));
    if (!Number.isFinite(n) || n < 0) return '';
    return n === 0 ? '' : String(n);
  }

  // Format input Indonesia (120.000) atau digit mentah dari form
  return str.replace(/\D/g, '');
};

/** Hitung jumlah digit sebelum posisi kursor */
export const countDigitsBefore = (str, cursorPos) => {
  return parseCurrencyInput(String(str).slice(0, cursorPos)).length;
};

/** Posisi kursor setelah digit ke-n pada string terformat */
export const cursorPosFromDigitIndex = (formatted, digitIndex) => {
  if (digitIndex <= 0) return 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] !== '.') count++;
    if (count >= digitIndex) return i + 1;
  }
  return formatted.length;
};

/** Normalisasi digit: buang leading zero, batasi panjang */
export const normalizeCurrencyDigits = (val, maxDigits = 12) => {
  const digits = parseCurrencyInput(val);
  if (!digits) return '';
  return digits.replace(/^0+/, '').slice(0, maxDigits);
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
  countDigitsBefore,
  cursorPosFromDigitIndex,
  normalizeCurrencyDigits,
});
