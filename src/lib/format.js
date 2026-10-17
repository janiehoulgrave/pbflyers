export const num = (v) => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export const money0 = (v) => '$' + Math.round(num(v)).toLocaleString('en-US');
export const money2 = (v) =>
  '$' + num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 6.49 -> "6.49%", 6.625 -> "6.625%", 7 -> "7.00%"
export const pct = (v, min = 2, max = 3) =>
  num(v).toLocaleString('en-US', { minimumFractionDigits: min, maximumFractionDigits: max }) + '%';
export const pct3 = (v) => pct(v, 3, 3);

// $1,200,000 -> "$1.2M", $50,000 -> "$50k", $22,375 -> "22K"
export function shortMoney(v, { dollar = true, kUpper = false } = {}) {
  const n = num(v);
  let s;
  if (n >= 1e6) s = (Math.round((n / 1e6) * 100) / 100).toString().replace(/\.0+$/, '') + 'M';
  else if (n >= 1e3) s = Math.round(n / 1e3) + (kUpper ? 'K' : 'k');
  else s = String(Math.round(n));
  return (dollar ? '$' : '') + s;
}

export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// "10/16/26"
export const shortDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
};

export const todayISO = () => {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const superscript = (n) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[n] || String(n);

// Pick a headline size so the address fits in two lines
export function headlineSize(text, base = 36) {
  const len = (text || '').length;
  if (len <= 18) return base;
  if (len <= 24) return base * 0.89;
  if (len <= 30) return base * 0.78;
  if (len <= 38) return base * 0.67;
  return base * 0.58;
}

// "01/14/2026"
export const longDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
};
