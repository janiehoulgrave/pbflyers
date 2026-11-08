// Pulls agent contact info or listing details from a public compass.com page.
// GET /api/compass?url=https://www.compass.com/agents/... or /homedetails/...
import * as cheerio from 'cheerio';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

function allowed(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && (url.hostname === 'compass.com' || url.hostname.endsWith('.compass.com'));
  } catch {
    return false;
  }
}

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const abs = (src) => (!src ? null : src.startsWith('//') ? 'https:' + src : src.startsWith('/') ? 'https://www.compass.com' + src : src);

// Walk every JSON blob in the page looking for keys we care about
function jsonBlobs($) {
  const out = [];
  $('script').each((_, el) => {
    const t = $(el).html() || '';
    if ($(el).attr('type') === 'application/ld+json') {
      try { out.push(JSON.parse(t)); } catch {}
      return;
    }
    const m = t.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (m && m[1].length < 5_000_000) {
      try { out.push(JSON.parse(m[1])); } catch {}
    }
    if ($(el).attr('id') === '__NEXT_DATA__') {
      try { out.push(JSON.parse(t)); } catch {}
    }
  });
  return out;
}

function findKeys(obj, keys, found = {}, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 14) return found;
  for (const [k, v] of Object.entries(obj)) {
    if (keys.includes(k) && v != null && found[k] === undefined && typeof v !== 'object') found[k] = v;
    if (keys.includes(k) && v && typeof v === 'object' && found[k] === undefined) found[k] = v;
    if (typeof v === 'object') findKeys(v, keys, found, depth + 1);
  }
  return found;
}

function longestString(obj, key, best = '', depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 14) return best;
  for (const [k, v] of Object.entries(obj)) {
    if (k === key && typeof v === 'string' && v.length > best.length) best = v;
    if (typeof v === 'object') best = longestString(v, key, best, depth + 1);
  }
  return best;
}

// Listing pages sit behind a bot check, so the address can be read from the link itself:
// /homedetails/2304-Fairview-Ter-Alexandria-VA-22303/1U8TAI_pid/  or  /listing/6007-34th-Pl-NW-Washington-DC-20015/123/
const SUFFIX = new Set('st street ave av avenue rd road dr drive ln lane ct court pl place ter terrace way blvd boulevard cir circle pkwy parkway hwy highway trl trail sq square row run loop pike xing aly alley walk path pt point cv cove grv grove hl hill hts heights mews plz plaza crk creek cres crescent lndg landing gtwy rdg ridge vw view knl knoll bnd bend psge'.split(' '));
const DIR = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);
const UNIT = new Set(['unit', 'apt', 'ste', 'suite', '#', 'no']);
const cap = (w) => (DIR.has(w.toLowerCase()) ? w.toUpperCase() : /^\d/.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1));
export function addressFromUrl(u) {
  try {
    const parts = new URL(u).pathname.split('/').filter(Boolean);
    const i = parts.findIndex((p) => p === 'homedetails' || p === 'listing');
    const slug = decodeURIComponent(parts[i + 1] || '');
    const t = slug.split('-').filter(Boolean);
    if (t.length < 3) return null;
    let zip = '';
    let state = '';
    if (/^\d{5}$/.test(t[t.length - 1])) zip = t.pop();
    if (/^[A-Za-z]{2}$/.test(t[t.length - 1])) state = t.pop().toUpperCase();
    // the street ends at the last street type (plus a direction and a unit), the city is what follows
    let end = -1;
    for (let k = t.length - 2; k >= 1; k--) if (SUFFIX.has(t[k].toLowerCase())) { end = k; break; }
    if (end === -1) end = Math.max(0, t.length - 2);
    if (t[end + 1] && DIR.has(t[end + 1].toLowerCase()) && end + 2 < t.length) end++;
    if (t[end + 1] && UNIT.has(t[end + 1].toLowerCase()) && end + 3 < t.length) end += 2;
    const street = t.slice(0, end + 1).map(cap).join(' ').replace(/\b(Unit|Apt|Ste|Suite) /, '$1 ');
    const city = t.slice(end + 1).map(cap).join(' ');
    if (!street || !city) return null;
    return { street, city, state, zip };
  } catch {
    return null;
  }
}

function parseListing($, html, url) {
  const og = (p) => $(`meta[property="og:${p}"]`).attr('content') || $(`meta[name="og:${p}"]`).attr('content');
  const title = og('title') || $('title').text();
  // "2304 Fairview Ter, Alexandria, VA 22303 | MLS #VAFX2342894"
  const addr = clean(title.split('|')[0]);
  const m = addr.match(/^(.*?),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/);
  const metaDesc = og('description') || $('meta[name="description"]').attr('content') || '';
  const priceMatch = metaDesc.match(/\$([\d,]+)/) || html.match(/"(?:listPrice|price)"\s*:\s*"?(\d{5,9})/);
  const blobs = jsonBlobs($);
  let description = '';
  for (const b of blobs) {
    const s = longestString(b, 'description');
    if (s.length > description.length) description = s;
  }
  if (description.length < 80) {
    // fall back to the visible "Description" section
    $('h2,h3').each((_, el) => {
      if (/^description$/i.test(clean($(el).text())) && !description) {
        description = clean($(el).parent().text().replace(/^\s*Description/i, '').replace(/Continue Reading.*$/i, ''));
      }
    });
  }
  if (/is a .* listed for sale at/i.test(description)) description = '';
  description = clean(description.replace(/<[^>]+>/g, ' '));
  // photos: og:image first, then gallery images
  const photos = [];
  const push = (u) => {
    u = abs(u);
    if (u && /compass\.com\/m\//.test(u) && !photos.some((p) => p.split('/m/')[1]?.split('/')[0] === u.split('/m/')[1]?.split('/')[0])) photos.push(u);
  };
  $('img').each((_, el) => push($(el).attr('src') || $(el).attr('data-src')));
  const re = /https?:\/\/www\.compass\.com\/m\/[a-f0-9]{40,}\/[A-Za-z0-9x._-]+/g;
  for (const u of html.match(re) || []) push(u);
  const ogImg = abs(og('image'));
  const hero = (u) => (u ? u.replace(/\/[^/]+$/, '/origin.webp') : null);
  const ordered = [];
  if (ogImg) ordered.push(hero(ogImg));
  for (const p of photos) if (!ordered.includes(hero(p))) ordered.push(hero(p));
  return {
    type: 'listing',
    url,
    street: m ? clean(m[1]) : addr,
    city: m ? clean(m[2]) : '',
    state: m ? m[3] : '',
    zip: m && m[4] ? m[4] : '',
    price: priceMatch ? Number(String(priceMatch[1]).replace(/,/g, '')) : null,
    description,
    photos: ordered.slice(0, 12),
  };
}

function parseAgent($, html, url) {
  const titleTag = clean($('title').text()); // "Maryam Redjaee, Chevy Chase Real Estate Agent - Compass"
  let name = clean($('h1').first().text()) || clean(titleTag.split(',')[0].split(' - ')[0]);
  const blobs = jsonBlobs($);
  const found = {};
  for (const b of blobs) findKeys(b, ['displayName', 'jobTitle', 'title', 'email', 'phone', 'mobilePhone', 'cellPhone', 'officePhone', 'telephone', 'avatarUrl', 'profilePhoto', 'image', 'headshot', 'photoUrl'], found);
  const text = clean($('body').text());
  const email = (html.match(/mailto:([A-Za-z0-9._%+-]+@compass\.com)/i) || text.match(/([A-Za-z0-9._%+-]+@compass\.com)/i) || [])[1] || (typeof found.email === 'string' ? found.email : '');
  const mobile = (text.match(/M:\s*\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/) || []);
  const office = (text.match(/O:\s*\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/) || []);
  const fmt = (a) => (a && a[1] ? `${a[1]}.${a[2]}.${a[3]}` : '');
  // Title usually sits right after the name in the header ("Maryam RedjaeeRealtor®maryam@...")
  let title = '';
  const nameIdx = text.indexOf(name);
  if (nameIdx >= 0) {
    const after = text.slice(nameIdx + name.length, nameIdx + name.length + 120);
    const t = after.split(/[A-Za-z0-9._%+-]+@|M:|O:|Work with/)[0];
    if (t && t.length < 80) title = clean(t);
  }
  if (!title && typeof found.jobTitle === 'string') title = found.jobTitle;
  // headshot: an image labeled with the agent's name first, then the share image if it's a real photo
  let photo = '';
  const first = (name || '').toLowerCase().split(' ')[0];
  $('img').each((_, el) => {
    const alt = ($(el).attr('alt') || '').toLowerCase();
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (!photo && src && first && alt.includes(first)) photo = src;
  });
  const ogImg = $('meta[property="og:image"]').attr('content') || '';
  if (!photo && /\/m\//.test(ogImg)) photo = ogImg;
  if (!photo) for (const k of ['avatarUrl', 'profilePhoto', 'headshot', 'photoUrl', 'image']) if (typeof found[k] === 'string' && /^(https?:)?\/\//.test(found[k])) { photo = found[k]; break; }
  return {
    type: 'agent',
    url,
    name,
    title,
    email,
    phone: fmt(mobile) || fmt(office),
    phoneLabel: mobile[1] ? 'M' : office[1] ? 'O' : 'M',
    officePhone: fmt(office),
    photo: abs(photo) || null,
  };
}

export default async function handler(req, res) {
  const url = String(req.query.url || '').trim();
  if (!allowed(url)) return res.status(400).json({ error: 'Paste a compass.com agent or listing link.' });
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' }, redirect: 'follow' });
    if (!r.ok) return res.status(502).json({ error: `Compass returned ${r.status}. Try again or fill the fields by hand.` });
    const html = await r.text();
    const $ = cheerio.load(html);
    const blocked = r.status === 202 || /AwsWafIntegration|verify that you're not a robot/i.test(html.slice(0, 5000));
    if (blocked && /\/(homedetails|listing)\//.test(url)) {
      const a = addressFromUrl(url);
      if (!a) return res.status(502).json({ error: 'Compass didn’t share this listing’s details. Fill in the address by hand.' });
      res.setHeader('Cache-Control', 's-maxage=600');
      return res.status(200).json({ type: 'listing', url, ...a, price: null, description: '', photos: [], partial: true });
    }
    const path = new URL(r.url || url).pathname;
    const data = path.startsWith('/agents/') ? parseAgent($, html, url) : path.includes('/homedetails/') || path.includes('/listing/') ? parseListing($, html, url) : null;
    if (!data) return res.status(400).json({ error: 'That link is not an agent page or a listing page.' });
    res.setHeader('Cache-Control', 's-maxage=600');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Could not reach compass.com. Try again or fill the fields by hand.' });
  }
}
