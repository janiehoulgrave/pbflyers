// Gift Center items.
// Live site: Firestore collection pbflyers_gifts in the PB dashboard project (pegah-briefing), next to the flyers.
// Uploaded hero photos go in pbflyers_images, like flyer photos. Preview/testing (no sign-in): this browser's storage.
import { authEnabled, app } from './firebase.js';
import { downscale } from './images.js';

const GIFTS = 'pbflyers_gifts';
const IMAGES = 'pbflyers_images';

async function sha1(str) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const clean = (o) => JSON.parse(JSON.stringify(o ?? null));

// Gift photos only need to look sharp on a card, so keep them small
export const shrinkPhoto = (dataUrl) => downscale(dataUrl, 1400, 0.84);

async function firestoreStore() {
  const fs = await import('firebase/firestore');
  const db = fs.getFirestore(app);
  const imgCache = new Map();
  return {
    shared: true,
    subscribe(onList, onError) {
      const q = fs.query(fs.collection(db, GIFTS), fs.orderBy('createdAt', 'desc'));
      return fs.onSnapshot(q, (snap) => onList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => onError?.(e));
    },
    async add(g, who) {
      const now = Date.now();
      const ref = await fs.addDoc(fs.collection(db, GIFTS), clean({ ...g, createdAt: now, createdBy: who, updatedAt: now, updatedBy: who }));
      return ref.id;
    },
    update: (id, patch, who) => fs.updateDoc(fs.doc(db, GIFTS, id), clean({ ...patch, updatedAt: Date.now(), ...(who ? { updatedBy: who } : {}) })),
    remove: (id) => fs.deleteDoc(fs.doc(db, GIFTS, id)),
    async putImage(dataUrl) {
      const src = await shrinkPhoto(dataUrl);
      const id = await sha1(src);
      await fs.setDoc(fs.doc(db, IMAGES, id), { data: src }, { merge: true });
      imgCache.set(id, src);
      return 'img:' + id;
    },
    async getImage(id) {
      if (imgCache.has(id)) return imgCache.get(id);
      const p = fs.getDoc(fs.doc(db, IMAGES, id)).then((s) => (s.exists() ? s.data().data : null));
      imgCache.set(id, p);
      return p;
    },
  };
}

function localStore() {
  const KEY = 'pbflyers:gifts';
  const IKEY = 'pbflyers:gift-images';
  const read = (k = KEY) => {
    try { return JSON.parse(localStorage.getItem(k)) || (k === KEY ? [] : {}); } catch { return k === KEY ? [] : {}; }
  };
  const listeners = new Set();
  const write = (list) => {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
    const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
    listeners.forEach((l) => l(sorted));
  };
  return {
    shared: false,
    subscribe(onList) {
      listeners.add(onList);
      onList(read().sort((a, b) => b.createdAt - a.createdAt));
      return () => listeners.delete(onList);
    },
    async add(g, who) {
      const now = Date.now();
      const id = 'local-' + now.toString(36);
      write([{ ...clean(g), id, createdAt: now, createdBy: who, updatedAt: now, updatedBy: who }, ...read()]);
      return id;
    },
    async update(id, patch, who) {
      write(read().map((g) => (g.id === id ? { ...g, ...clean(patch), updatedAt: Date.now(), ...(who ? { updatedBy: who } : {}) } : g)));
    },
    async remove(id) {
      write(read().filter((g) => g.id !== id));
    },
    async putImage(dataUrl) {
      const src = await shrinkPhoto(dataUrl);
      const id = await sha1(src);
      const all = read(IKEY);
      all[id] = src;
      try { localStorage.setItem(IKEY, JSON.stringify(all)); } catch {}
      return 'img:' + id;
    },
    async getImage(id) {
      return read(IKEY)[id] || null;
    },
  };
}

let storePromise = null;
export function getGiftStore() {
  if (!storePromise) storePromise = authEnabled ? firestoreStore() : Promise.resolve(localStore());
  return storePromise;
}

// Asks the site for the product's details right away (the daily job does the same every morning)
export async function checkLink(url) {
  try {
    const r = await fetch('/api/product?url=' + encodeURIComponent(url));
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch {
    return { status: 'error', message: 'The price checker isn’t reachable right now.' };
  }
}
