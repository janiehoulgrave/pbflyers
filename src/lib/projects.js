// Shared flyer library.
// Live site: Firestore in the PB dashboard project, so Pegah and Janie see the same saved flyers.
// Preview/testing (no sign-in): falls back to this browser's storage with the same API.
import { authEnabled, app } from './firebase.js';
import { downscale } from './images.js';

const PROJECTS = 'pbflyers_projects';
const IMAGES = 'pbflyers_images';
const BIG = 2000; // data URLs longer than this are stored as separate image docs

// ---------- helpers ----------
async function sha1(str) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function mapStrings(obj, fn) {
  if (Array.isArray(obj)) return Promise.all(obj.map((v) => mapStrings(v, fn)));
  if (obj && typeof obj === 'object') {
    return Promise.all(Object.entries(obj).map(async ([k, v]) => [k, await mapStrings(v, fn)])).then(Object.fromEntries);
  }
  return typeof obj === 'string' ? fn(obj) : Promise.resolve(obj);
}

// Firestore can't store undefined values
const clean = (o) => JSON.parse(JSON.stringify(o ?? null));

// ---------- Firestore store ----------
async function firestoreStore() {
  const fs = await import('firebase/firestore');
  const db = fs.getFirestore(app);
  const imgCache = new Map();

  async function putImage(dataUrl) {
    let src = dataUrl;
    // keep each image comfortably under Firestore's 1MB document limit
    for (const [max, q] of [[1800, 0.85], [1400, 0.8], [1000, 0.75]]) {
      if (src.length < 900000) break;
      src = await downscale(dataUrl, max, q);
    }
    const id = await sha1(src);
    if (!imgCache.has(id)) {
      await fs.setDoc(fs.doc(db, IMAGES, id), { data: src }, { merge: true });
      imgCache.set(id, src);
    }
    return 'img:' + id;
  }
  async function getImage(id) {
    if (imgCache.has(id)) return imgCache.get(id);
    const snap = await fs.getDoc(fs.doc(db, IMAGES, id));
    const src = snap.exists() ? snap.data().data : null;
    imgCache.set(id, src);
    return src;
  }

  return {
    shared: true,
    subscribe(onList, onError) {
      const q = fs.query(fs.collection(db, PROJECTS), fs.orderBy('updatedAt', 'desc'), fs.limit(300));
      return fs.onSnapshot(
        q,
        (snap) => onList(snap.docs.map((d) => ({ id: d.id, ...d.data(), data: undefined }))),
        (err) => onError?.(err)
      );
    },
    async save(p, who) {
      const data = await mapStrings(p.data, (s) => (s.startsWith('data:image') && s.length > BIG ? putImage(s) : s));
      const now = Date.now();
      const body = clean({ name: p.name, templateId: p.templateId, data, thumb: p.thumb || null, updatedAt: now, updatedBy: who });
      if (p.id) {
        // updateDoc replaces each field whole, so removed edits don't linger inside 'data'
        await fs.updateDoc(fs.doc(db, PROJECTS, p.id), body);
        return p.id;
      }
      const ref = await fs.addDoc(fs.collection(db, PROJECTS), { ...body, createdAt: now, createdBy: who });
      return ref.id;
    },
    async load(id) {
      const snap = await fs.getDoc(fs.doc(db, PROJECTS, id));
      if (!snap.exists()) return null;
      const p = { id, ...snap.data() };
      p.data = await mapStrings(p.data || {}, (s) => (s.startsWith('img:') ? getImage(s.slice(4)) : s));
      return p;
    },
    remove: (id) => fs.deleteDoc(fs.doc(db, PROJECTS, id)),
  };
}

// ---------- local fallback ----------
function localStore() {
  const KEY = 'pbflyers:projects';
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  };
  const listeners = new Set();
  const write = (list) => {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
    const meta = list.map((p) => ({ ...p, data: undefined })).sort((a, b) => b.updatedAt - a.updatedAt);
    listeners.forEach((l) => l(meta));
  };
  return {
    shared: false,
    subscribe(onList) {
      listeners.add(onList);
      onList(read().map((p) => ({ ...p, data: undefined })).sort((a, b) => b.updatedAt - a.updatedAt));
      return () => listeners.delete(onList);
    },
    async save(p, who) {
      const list = read();
      const now = Date.now();
      const id = p.id || 'local-' + now.toString(36);
      const prev = list.find((x) => x.id === id);
      const next = { ...prev, id, name: p.name, templateId: p.templateId, data: p.data, thumb: p.thumb, updatedAt: now, updatedBy: who, createdAt: prev?.createdAt || now, createdBy: prev?.createdBy || who };
      write([next, ...list.filter((x) => x.id !== id)]);
      return id;
    },
    async load(id) {
      return read().find((x) => x.id === id) || null;
    },
    async remove(id) {
      write(read().filter((x) => x.id !== id));
    },
  };
}

let storePromise = null;
export function getStore() {
  if (!storePromise) storePromise = authEnabled ? firestoreStore() : Promise.resolve(localStore());
  return storePromise;
}
