// Client-side photo prep: crop to the exact box on the flyer so the PDF is sharp and never stretched.

export const proxied = (url) => (url && /^https?:\/\//.test(url) && /compass\.com/.test(url) ? `/api/img?url=${encodeURIComponent(url)}` : url);

const cache = new Map();
export function loadImage(src) {
  if (!src) return Promise.reject(new Error('no image'));
  if (cache.has(src)) return cache.get(src);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      cache.delete(src);
      reject(new Error('Could not load image'));
    };
    img.src = src;
  });
  cache.set(src, p);
  return p;
}

export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// crop = { zoom: 1..3, x: -1..1, y: -1..1 } (x/y pan within the spare room)
function sourceRect(img, aspect, crop = {}) {
  const zoom = Math.max(1, crop.zoom || 1);
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  let sw, sh;
  if (iw / ih > aspect) {
    sh = ih / zoom;
    sw = sh * aspect;
  } else {
    sw = iw / zoom;
    sh = sw / aspect;
  }
  const sx = ((iw - sw) / 2) * (1 + (crop.x || 0));
  const sy = ((ih - sh) / 2) * (1 + (crop.y || 0));
  return { sx, sy, sw, sh };
}

export async function cropToDataURL(src, aspect, crop, maxW = 2000) {
  const img = await loadImage(src);
  const { sx, sy, sw, sh } = sourceRect(img, aspect, crop);
  const w = Math.min(maxW, Math.round(sw));
  const h = Math.round(w / aspect);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.9);
}

export async function circleDataURL(src, crop, size = 600) {
  const img = await loadImage(src);
  const { sx, sy, sw, sh } = sourceRect(img, 1, crop);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  g.closePath();
  g.clip();
  g.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
  return c.toDataURL('image/png');
}

// Low-res source quality check: returns effective DPI at the printed size (points)
export async function effectiveDpi(src, aspect, crop, widthPt) {
  try {
    const img = await loadImage(src);
    const { sw } = sourceRect(img, aspect, crop);
    return Math.round(sw / (widthPt / 72));
  } catch {
    return null;
  }
}

// Shrink an uploaded photo so it stays sharp in print but small enough to save in the browser
export async function downscale(src, max = 2000, quality = 0.86) {
  const img = await loadImage(src);
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * s);
  const h = Math.round(img.naturalHeight * s);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/jpeg', quality);
}
