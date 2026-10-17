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
    const path = new URL(r.url || url).pathname;
    const data = path.startsWith('/agents/') ? parseAgent($, html, url) : path.includes('/homedetails/') || path.includes('/listing/') ? parseListing($, html, url) : null;
    if (!data) return res.status(400).json({ error: 'That link is not an agent page or a listing page.' });
    res.setHeader('Cache-Control', 's-maxage=600');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Could not reach compass.com. Try again or fill the fields by hand.' });
  }
}
