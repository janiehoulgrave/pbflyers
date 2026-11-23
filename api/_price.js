// Reads a product's name, price, image and retailer from the page's own product data
// (schema.org JSON-LD, then product/og meta tags, then microdata). No paid services.
// Shared by /api/product (filling the Add gift form) and scripts/check-prices.mjs (the daily check).
import * as cheerio from 'cheerio';
import { retailerFromUrl } from '../src/lib/giftPrice.js';

export { retailerFromUrl };

export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

export function safeUrl(u) {
  try {
    const url = new URL(String(u || '').trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const h = url.hostname.toLowerCase();
    // never fetch local or private network addresses
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^\[/.test(h)) return null;
    if (/^(\d+\.){3}\d+$/.test(h)) {
      const [a, b] = h.split('.').map(Number);
      if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.replace(/[^0-9.,]/g, '');
  if (!s) return null;
  // "1.250,00" (European) vs "1,250.00"
  if (/,\d{2}$/.test(s) && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d+,\d{2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const typesOf = (n) => asArray(n && n['@type']).map((t) => String(t).toLowerCase());
const text = (v) => {
  if (v == null) return '';
  if (typeof v === 'string') return v.replace(/\s+/g, ' ').trim();
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === 'object') return text(v.name || v['@value'] || '');
  return String(v);
};
const imageOf = (v) => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return imageOf(v[0]);
  if (typeof v === 'object') return v.url || v.contentUrl || v['@id'] || '';
  return '';
};
const sameUrl = (a, b) => {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.hostname === y.hostname && x.pathname.replace(/\/$/, '') === y.pathname.replace(/\/$/, '') && (!x.search || x.search === y.search);
  } catch {
    return false;
  }
};

// Every JSON-LD node on the page, with @graph and nested arrays flattened
function ldNodes($) {
  const out = [];
  const walk = (n, depth = 0) => {
    if (!n || typeof n !== 'object' || depth > 6) return;
    if (Array.isArray(n)) return n.forEach((x) => walk(x, depth + 1));
    out.push(n);
    if (n['@graph']) walk(n['@graph'], depth + 1);
    if (n.mainEntity) walk(n.mainEntity, depth + 1);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = ($(el).html() || '').trim().replace(/^<!--|-->$/g, '');
    try {
      walk(JSON.parse(raw));
    } catch {
      // some sites put several objects or stray commas in one tag; try to rescue the first object
      try { walk(JSON.parse(raw.replace(/,\s*([}\]])/g, '$1'))); } catch {}
    }
  });
  return out;
}

// Prices from a product's offers: [{ price, currency, url }]
function offerPrices(product) {
  const out = [];
  const visit = (o, depth = 0) => {
    if (!o || typeof o !== 'object' || depth > 4) return;
    if (Array.isArray(o)) return o.forEach((x) => visit(x, depth + 1));
    const currency = o.priceCurrency || o.priceSpecification?.priceCurrency || null;
    const cands = [o.price, o.lowPrice, ...asArray(o.priceSpecification).map((p) => p && p.price)];
    const price = cands.map(toNumber).find((n) => n != null);
    if (price != null) out.push({ price, currency, url: o.url || null, high: toNumber(o.highPrice) });
    if (o.offers) visit(o.offers, depth + 1);
  };
  visit(product.offers);
  // ProductGroup: prices live on the variants
  asArray(product.hasVariant).forEach((v) => v && visit(v.offers));
  return out;
}

export function parseProduct(html, pageUrl = '') {
  const $ = cheerio.load(html || '');
  const meta = (...names) => {
    for (const n of names) {
      const v = $(`meta[property="${n}"]`).attr('content') || $(`meta[name="${n}"]`).attr('content') || $(`meta[itemprop="${n}"]`).attr('content');
      if (v && v.trim()) return v.trim();
    }
    return '';
  };

  const nodes = ldNodes($);
  const products = nodes.filter((n) => typesOf(n).some((t) => t === 'product' || t === 'productgroup' || t === 'individualproduct'));
  // a product with prices first, the page's own product first
  const ranked = products
    .map((p) => ({ p, offers: offerPrices(p) }))
    .sort((a, b) => (b.offers.length > 0) - (a.offers.length > 0) || (sameUrl(b.p.url, pageUrl) - sameUrl(a.p.url, pageUrl)));
  const best = ranked[0];

  let price = null;
  let currency = null;
  let source = '';
  if (best && best.offers.length) {
    const mine = best.offers.find((o) => o.url && sameUrl(o.url, pageUrl));
    const pick = mine || best.offers.reduce((m, o) => (o.price < m.price ? o : m), best.offers[0]);
    price = pick.price;
    currency = pick.currency;
    source = 'product data';
  }
  if (price == null) {
    price = toNumber(meta('product:price:amount', 'og:price:amount', 'twitter:data1'));
    currency = meta('product:price:currency', 'og:price:currency') || currency;
    if (price != null) source = 'page tags';
  }
  if (price == null) {
    const el = $('[itemprop="price"]').first();
    price = toNumber(el.attr('content') || el.text());
    currency = $('[itemprop="priceCurrency"]').first().attr('content') || currency;
    if (price != null) source = 'page markup';
  }

  const p = best?.p || {};
  const name = text(p.name) || meta('og:title', 'twitter:title') || text($('title').first().text());
  const image = imageOf(p.image) || meta('og:image', 'og:image:secure_url', 'twitter:image');
  const retailer =
    retailerFromUrl(pageUrl) || meta('og:site_name') || text(p.offers && asArray(p.offers)[0]?.seller) || text(p.brand) || '';

  let abs = image;
  try { if (image) abs = new URL(image, pageUrl || undefined).toString(); } catch {}

  return { name: name.slice(0, 200), price, currency: currency || (price != null ? 'USD' : null), image: abs || '', retailer, source };
}

// Signs that a bot wall answered instead of the product page
const BLOCK_MARKS = [
  /access denied/i,
  /px-captcha|perimeterx/i,
  /_incapsula_resource|incapsula incident/i,
  /cf-chl-|challenge-platform|attention required! \| cloudflare/i,
  /pardon our interruption/i,
  /are you a robot|verify you are human|unusual traffic/i,
  /akamai.*reference #|reference #\d+\.\w+/i,
];

export async function fetchProduct(rawUrl, { timeoutMs = 20000 } = {}) {
  const url = safeUrl(rawUrl);
  if (!url) return { status: 'error', message: 'That doesn’t look like a web link.' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });
    const html = await r.text();
    if ([401, 403, 429, 503].includes(r.status)) return { status: 'blocked', message: `The site turned the check away (${r.status}).` };
    if (r.status === 404 || r.status === 410) return { status: 'gone', message: 'The page is gone. The item may be discontinued.' };
    if (!r.ok) return { status: 'error', message: `The site answered with an error (${r.status}).` };
    const found = parseProduct(html, r.url || url);
    if (found.price == null) {
      const short = html.length < 20000;
      if (short && BLOCK_MARKS.some((re) => re.test(html))) return { status: 'blocked', message: 'The site showed a bot check instead of the product.', ...found };
      return { status: 'no-price', message: 'The page loaded, but it doesn’t list a price in its product data.', ...found };
    }
    return { status: 'ok', message: '', ...found };
  } catch (e) {
    const timedOut = e && e.name === 'AbortError';
    return { status: timedOut ? 'blocked' : 'error', message: timedOut ? 'The site didn’t answer in time.' : 'Couldn’t reach the site.' };
  } finally {
    clearTimeout(timer);
  }
}
