// Turns one price check into the fields saved on a gift.
// Used by the app ("Check price now", new gifts) and by the daily job, so both record prices the same way.

// Friendly names for the retailers Janie uses most; anything else falls back to the page's site name
const RETAILERS = [
  ['tiffany.', 'Tiffany & Co.'],
  ['crateandbarrel.', 'Crate & Barrel'],
  ['maisonbergere', 'Maison Bergère'],
  ['williams-sonoma.', 'Williams Sonoma'],
  ['potterybarn.', 'Pottery Barn'],
  ['cb2.', 'CB2'],
  ['neimanmarcus.', 'Neiman Marcus'],
  ['nordstrom.', 'Nordstrom'],
  ['saksfifthavenue.', 'Saks Fifth Avenue'],
  ['bloomingdales.', 'Bloomingdale’s'],
  ['mackenzie-childs.', 'MacKenzie-Childs'],
  ['diptyqueparis.', 'Diptyque'],
  ['jomalone.', 'Jo Malone London'],
  ['anthropologie.', 'Anthropologie'],
  ['amazon.', 'Amazon'],
];

export function retailerFromUrl(u) {
  try {
    const host = new URL(u).hostname.replace(/^www\./, '');
    const hit = RETAILERS.find(([k]) => host.includes(k));
    return hit ? hit[1] : '';
  } catch {
    return '';
  }
}

export function applyCheck(gift, result, now = Date.now()) {
  const patch = {
    checkedAt: now,
    checkStatus: result.status || 'error',
    checkMessage: result.message || '',
  };
  if (result.status === 'ok' && result.price != null) {
    patch.price = result.price;
    patch.currency = result.currency || 'USD';
    patch.priceAt = now;
    if (gift.price != null && gift.price !== result.price) {
      patch.previousPrice = gift.price;
      patch.priceChangedAt = now;
    }
    const hist = Array.isArray(gift.priceHistory) ? gift.priceHistory : [];
    const last = hist[hist.length - 1];
    if (!last || last.price !== result.price) patch.priceHistory = [...hist, { at: now, price: result.price }].slice(-60);
  }
  return patch;
}

// What the card shows: a hand-set price wins until it is cleared
export function shownPrice(g) {
  if (g.manualPrice != null && g.manualPrice !== '') return { price: Number(g.manualPrice), manual: true };
  if (g.price != null) return { price: Number(g.price), manual: false };
  return { price: null, manual: false };
}

// The check worked today (or the price was set by hand), so nothing needs flagging
export function needsAttention(g, now = Date.now()) {
  if (g.manualPrice != null && g.manualPrice !== '') return false;
  if (!g.checkedAt) return false; // brand new, first check pending
  if (g.checkStatus !== 'ok') return true;
  // the daily job hasn't reached it for a few days
  return now - g.checkedAt > 3 * 86400000;
}

export const money = (n, currency = 'USD') =>
  n == null
    ? ''
    : n.toLocaleString('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

export function shortDay(t, now = Date.now()) {
  if (!t) return '';
  const d = new Date(t);
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return 'today';
  const y = new Date(now - 86400000);
  if (d.toDateString() === y.toDateString()) return 'yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
}
