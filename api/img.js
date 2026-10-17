// Image proxy: fetches a compass.com photo and returns a print-ready JPEG
// (the PDF engine can't read .webp, and the browser can't read cross-site pixels).
import sharp from 'sharp';

function allowed(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && (url.hostname === 'compass.com' || url.hostname.endsWith('.compass.com'));
  } catch {
    return false;
  }
}

async function get(u) {
  const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/avif,image/webp,image/*' } });
  if (!r.ok) throw new Error(String(r.status));
  return Buffer.from(await r.arrayBuffer());
}

export default async function handler(req, res) {
  const url = String(req.query.url || '');
  if (!allowed(url)) return res.status(400).send('Only compass.com images');
  try {
    let buf;
    try {
      buf = await get(url);
    } catch (e) {
      // origin.webp not available for every photo; fall back to the large jpg rendition
      if (/\/origin\.webp$/.test(url)) buf = await get(url.replace(/origin\.webp$/, '1500x1000.jpg'));
      else throw e;
    }
    const max = Math.min(2400, Math.max(120, Number(req.query.w) || 2400));
    const out = await sharp(buf).rotate().resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=86400');
    return res.status(200).send(out);
  } catch {
    return res.status(502).send('Could not load image');
  }
}
