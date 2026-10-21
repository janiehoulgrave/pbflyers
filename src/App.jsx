import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { TEMPLATES, byId } from './pdf/templates/index.js';
import { blankCol } from './pdf/templates/financing.jsx';
import { registerFonts, EditCtx, setMeasurer } from './pdf/common.jsx';
import { Field, PhotoControl, AprFields, LoanColumns, Label } from './components/Fields.jsx';
import Preview from './components/Preview.jsx';
import { proxied, cropToDataURL, circleDataURL, effectiveDpi, downscale } from './lib/images.js';
import { authEnabled, watchUser, signIn, logOut, isAllowed, whoIs } from './lib/firebase.js';
import { getStore } from './lib/projects.js';
import { pdfThumb } from './lib/thumb.js';
import { ordinal, num, todayISO, shortDate } from './lib/format.js';
import { BUYDOWNS } from './lib/calc.js';

const BASE = import.meta.env.BASE_URL;

registerFonts(BASE + 'fonts/');

// Canvas text measuring lets edited text shrink to fit its space on the flyer
const measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
const FONT_CSS = { CompassSans: 'CompassSans', CompassTab: 'CompassTab', Domaine: 'Domaine' };
const fontsReady =
  typeof document !== 'undefined' && document.fonts
    ? Promise.all(
        ['400 12px CompassSans', '500 12px CompassSans', '700 12px CompassSans', '400 12px CompassTab', '700 12px CompassTab', '400 12px Domaine'].map((f) =>
          document.fonts.load(f).catch(() => null)
        )
      ).then(() => {
        setMeasurer((text, font, size) => {
          measureCanvas.font = `${font.weight} ${size}px "${FONT_CSS[font.family] || 'CompassSans'}"`;
          return measureCanvas.measureText(text).width;
        });
        return true;
      })
    : Promise.resolve(false);

const ASSETS = {
  opWhite: BASE + 'brand/op-white.png',
  opBlack: BASE + 'brand/op-black.png',
  opDots: BASE + 'brand/op-dots.jpg',
  ehl: BASE + 'brand/ehl.png',
  sofa: BASE + 'brand/sofa.jpg',
  couple: BASE + 'brand/couple.jpg',
  phoneGuy: BASE + 'brand/phone-guy.jpg',
  doctor: BASE + 'brand/doctor.jpg',
  nomi: BASE + 'brand/nomi.jpg',
  softpull: BASE + 'brand/softpull.jpg',
  condo: BASE + 'brand/condo.jpg',
  rowhouses: BASE + 'brand/rowhouses.jpg',
  modernHome: BASE + 'brand/modern-home.jpg',
  meeting: BASE + 'brand/meeting.jpg',
  arcsGreen: BASE + 'brand/arcs-green.jpg',
  icon0: BASE + 'brand/icon-0.png',
  icon1: BASE + 'brand/icon-1.png',
  icon2: BASE + 'brand/icon-2.png',
};

// ---------- persistence ----------
const KEY = 'pbflyers:v1';
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
};
const save = (s) => {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {
    // too big (uploaded photos): keep everything except large images
    try {
      const slim = JSON.parse(JSON.stringify(s, (k, v) => (typeof v === 'string' && v.startsWith('data:') && v.length > 400000 ? undefined : v)));
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {}
  }
};

const emptyAgent = { name: '', title: '', brokerage: 'Compass Real Estate', phoneLabel: 'M', phone: '', email: '', photoSrc: null, photoCrop: { zoom: 1, x: 0, y: 0 }, url: '' };
const emptyListing = { url: '', street: '', city: '', state: '', zip: '', price: '', description: '', photos: [], photoSrc: null };

// ---------- auth gate ----------
export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => watchUser(setUser), []);
  if (!authEnabled) return <Studio />;
  if (user === undefined) return <div className="center">Loading…</div>;
  if (!user || !isAllowed(user)) {
    return (
      <div className="center gate">
        <img src={BASE + "brand/op-black.png"} alt="OriginPoint" width="180" />
        <h1>Flyer Studio</h1>
        {user && !isAllowed(user) ? <p className="warn-inline">{user.email} doesn't have access.</p> : <p>Sign in to make flyers.</p>}
        <button className="btn primary" onClick={() => (user ? logOut() : signIn())}>{user ? 'Use a different account' : 'Sign in with Google'}</button>
      </div>
    );
  }
  return <Studio user={user} />;
}

function Studio({ user }) {
  const initial = useMemo(load, []);
  const who = whoIs(user || { email: 'janie' });
  // The flyer being worked on: { templateId, projectId, name, data, dirty }
  const [work, setWork] = useState(initial.work && byId(initial.work.templateId) ? initial.work : null);
  const [tab, setTab] = useState(initial.tab || 'new');
  const [view, setView] = useState(initial.view === 'editor' && initial.work ? 'editor' : 'gallery');
  // Each flyer keeps its own listing and agent (in its data); recents make it quick to reuse one
  const [recentListings, setRecentListings] = useState(
    initial.recentListings || (initial.listing?.street ? [{ ...emptyListing, ...initial.listing }] : [])
  );
  const addRecentListing = (l) => {
    if (!l?.street) return;
    setRecentListings((r) => [l, ...r.filter((x) => x.street !== l.street)].slice(0, 10));
  };
  const [recentAgents, setRecentAgents] = useState(() => {
    const r = initial.recentAgents || [];
    const old = initial.agent;
    return old?.name && !r.some((x) => x.name === old.name) ? [{ ...emptyAgent, ...old }, ...r] : r;
  });
  const [bleed, setBleed] = useState(initial.bleed ?? true);
  const [library, setLibrary] = useState(initial.library || []); // photos uploaded, reusable on any flyer
  const [lender, setLender] = useState({ photoSrc: null, photoCrop: { zoom: 1, x: 0, y: 0 }, ...initial.lender });
  const addToLibrary = (src) => setLibrary((l) => [src, ...l.filter((x) => x !== src)].slice(0, 8));

  // ---- shared library of saved flyers ----
  const [store, setStore] = useState(null);
  const [projects, setProjects] = useState(null);
  const [libError, setLibError] = useState('');
  useEffect(() => {
    let unsub = () => {};
    getStore()
      .then((st) => {
        setStore(st);
        unsub = st.subscribe(setProjects, (e) => setLibError(e?.code === 'permission-denied' ? 'permission' : 'other'));
      })
      .catch(() => setLibError('other'));
    return () => unsub();
  }, []);

  useEffect(() => {
    save({ view, tab, work, recentListings, recentAgents, bleed, library, lender });
  }, [view, tab, work, recentListings, recentAgents, bleed, library, lender]);

  const editorData = useMemo(() => {
    if (!work || !byId(work.templateId)) return null;
    const d = { ...byId(work.templateId).defaults, ...work.data };
    // a new flyer's rates-effective date starts as today
    if ('date' in d && !d.date) d.date = todayISO();
    return d;
  }, [work]);

  const startNew = (templateId) => {
    setWork({ templateId, projectId: null, name: '', data: {}, dirty: false, session: Date.now() });
    setView('editor');
    window.scrollTo(0, 0);
  };
  const [opening, setOpening] = useState('');
  const openProject = async (id, { copy } = {}) => {
    if (!store) return;
    setOpening(id);
    try {
      const p = await store.load(id);
      if (!p || !byId(p.templateId)) return;
      setWork({
        templateId: p.templateId,
        projectId: copy ? null : p.id,
        name: copy ? `Copy of ${p.name}` : p.name,
        data: p.data || {},
        dirty: !!copy,
        savedDate: p.data?.date || null,
        session: Date.now(),
      });
      setTab('recent');
      setView('editor');
      window.scrollTo(0, 0);
    } finally {
      setOpening('');
    }
  };
  const saveWork = async ({ name, thumb }) => {
    if (!store || !work) return null;
    const snapshot = work;
    const id = await store.save({ id: snapshot.projectId, templateId: snapshot.templateId, name, data: snapshot.data, thumb }, who);
    // only clear "dirty" if nothing changed while saving
    setWork((w) => (w && w.templateId === snapshot.templateId && w.session === snapshot.session ? { ...w, projectId: id, name, dirty: w.data === snapshot.data ? false : w.dirty } : w));
    return id;
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView('gallery')}>
          <img src={BASE + "brand/op-black.png"} alt="OriginPoint" />
          <span>Flyer Studio</span>
        </button>
        {view === 'editor' ? <button className="btn ghost small" onClick={() => setView('gallery')}>All flyers</button> : null}
        <div className="spacer" />
        {user ? <button className="btn ghost small" onClick={logOut} title={user.email}>Sign out</button> : null}
      </header>
      {view === 'gallery' || !work ? (
        <Gallery
          tab={tab}
          setTab={setTab}
          onNew={startNew}
          projects={projects}
          shared={store?.shared}
          libError={libError}
          opening={opening}
          onOpen={(id) => openProject(id)}
          onCopy={(id) => openProject(id, { copy: true })}
          onDelete={(id) => store?.remove(id)}
          draft={work && !work.projectId && work.dirty ? work : null}
          onResume={() => setView('editor')}
        />
      ) : (
        <Editor
          key={work.session || work.projectId || 'new-' + work.templateId}
          template={byId(work.templateId)}
          data={editorData}
          setData={(u) =>
            setWork((w) => {
              const cur = { ...byId(w.templateId).defaults, ...w.data };
              return { ...w, data: typeof u === 'function' ? u(cur) : u, dirty: true };
            })
          }
          project={work}
          onSave={saveWork}
          canSave={!!store}
          recentListings={recentListings}
          addRecentListing={addRecentListing}
          setRecentListings={setRecentListings}
          recentAgents={recentAgents}
          setRecentAgents={setRecentAgents}
          bleed={bleed}
          setBleed={setBleed}
          library={library}
          addToLibrary={addToLibrary}
          setLibrary={setLibrary}
          lender={lender}
          setLender={setLender}
        />
      )}
    </div>
  );
}

// ---------- gallery ----------
const fmtWhen = (t) => {
  if (!t) return '';
  const d = new Date(t);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return same ? `today, ${time}` : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + `, ${time}`;
};

function Gallery({ tab, setTab, onNew, projects, shared, libError, opening, onOpen, onCopy, onDelete, draft, onResume }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [confirmDel, setConfirmDel] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const cats = ['All', ...new Set(TEMPLATES.map((t) => t.meta.category))];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = TEMPLATES.filter((t) => {
    if (cat !== 'All' && t.meta.category !== cat) return false;
    const hay = [t.meta.name, t.meta.description, t.meta.category, ...t.meta.tags].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const saved = (projects || []).filter((p) => {
    const t = byId(p.templateId);
    if (!t) return false;
    if (cat !== 'All' && t.meta.category !== cat) return false;
    const hay = [p.name, t.meta.name, p.updatedBy, p.createdBy].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const shown = showAll ? saved : saved.slice(0, 8);
  return (
    <main className="gallery">
      <div className="gallery-head">
        <h1>Flyer Studio</h1>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'new'} className={'tab' + (tab === 'new' ? ' on' : '')} onClick={() => setTab('new')}>New Flyer</button>
          <button role="tab" aria-selected={tab === 'recent'} className={'tab' + (tab === 'recent' ? ' on' : '')} onClick={() => setTab('recent')}>
            Recent Projects{projects && projects.length ? <span className="tab-count">{projects.length}</span> : null}
          </button>
        </div>
        <div className="search">
          <input autoFocus placeholder={tab === 'recent' ? 'Search projects: an address, agent, flyer name…' : 'Search flyers: buydown, VA, condo, event…'} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips">
          {cats.map((c) => (
            <button key={c} className={'chip' + (c === cat ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      </div>


      {tab === 'recent' ? (
      <section className="lib">
        {libError ? (
          <p className="warn-box">
            {libError === 'permission'
              ? 'The shared library is not switched on yet. The Firestore rules for the pbflyers collections need to be added (see README).'
              : 'Could not reach the shared library. Check the connection and refresh.'}
          </p>
        ) : null}
        {draft ? (
          <button className="draft-bar" onClick={onResume}>
            <b>Unsaved flyer in progress:</b> {byId(draft.templateId)?.meta.name}. <span>Continue editing</span>
          </button>
        ) : null}
        {projects === null && !libError ? <p className="lib-empty">Loading saved flyers…</p> : null}
        {projects && saved.length === 0 && !libError ? (
          <p className="lib-empty">{q || cat !== 'All' ? 'No projects match.' : 'No projects yet. Flyers you work on are saved here automatically.'}</p>
        ) : null}
        <div className="cards saved">
          {shown.map((p) => {
            const t = byId(p.templateId);
            return (
              <div key={p.id} className="card saved-card">
                <button className="card-open" onClick={() => onOpen(p.id)} disabled={!!opening}>
                  <div className="thumb">{p.thumb ? <img src={p.thumb} alt="" loading="lazy" /> : <img src={`${BASE}thumbs/${p.templateId}.png`} alt="" loading="lazy" />}</div>
                  <div className="card-body">
                    <span className="cat">{t.meta.name}</span>
                    <h3>{p.name || 'Untitled flyer'}</h3>
                    <p>Edited by {p.updatedBy || 'someone'} · {fmtWhen(p.updatedAt)}</p>
                  </div>
                </button>
                <div className="card-actions">
                  {opening === p.id ? <span className="lib-note">Opening…</span> : null}
                  {confirmDel === p.id ? (
                    <>
                      <span className="del-q">Delete for both of you?</span>
                      <button className="btn small ghost danger" onClick={() => { onDelete(p.id); setConfirmDel(null); }}>Delete</button>
                      <button className="btn small ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn small ghost" onClick={() => onCopy(p.id)}>Make a copy</button>
                      <button className="btn small ghost danger" onClick={() => setConfirmDel(p.id)}>Delete</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {saved.length > 8 ? (
          <button className="btn small ghost" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${saved.length}`}</button>
        ) : null}
      </section>
      ) : (
      <section className="lib">
      <div className="cards">
        {list.map((t) => (
          <button key={t.meta.id} className="card" onClick={() => onNew(t.meta.id)}>
            <div className="thumb"><img src={`${BASE}thumbs/${t.meta.id}.png`} alt="" loading="lazy" /></div>
            <div className="card-body">
              <span className="cat">{t.meta.category}{t.meta.needsListing ? ' · uses a listing link' : ''}</span>
              <h3>{t.meta.name}</h3>
              <p>{t.meta.description}</p>
            </div>
          </button>
        ))}
        {list.length === 0 ? <p className="empty">No flyers match “{q}”.</p> : null}
      </div>
      </section>
      )}
    </main>
  );
}

// ---------- editor ----------
function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function photoFieldOf(template) {
  for (const s of template.fields) for (const f of s.items) if (f.type === 'photo') return f;
  return null;
}

function Editor({ project, onSave, canSave, template, data, setData, recentListings, addRecentListing, setRecentListings, recentAgents, setRecentAgents, bleed, setBleed, library, addToLibrary, setLibrary, lender, setLender }) {
  const { meta } = template;
  const pf = photoFieldOf(template);
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }));
  const listing = useMemo(() => ({ ...emptyListing, ...data.listing }), [data.listing]);
  const setListing = (l) => setData((d) => ({ ...d, listing: l }));

  // The agent (and who's on the flyer) is remembered per flyer, so a new flyer starts blank.
  const mode = data.agentMode || meta.defaultAgentMode || 'compass';
  const agent = useMemo(() => ({ ...emptyAgent, ...data.agent, mode }), [data.agent, mode]);
  const setAgent = (next) => {
    const { mode: m, ...rest } = next;
    setData((d) => ({ ...d, agent: rest, agentMode: m || mode }));
  };
  const addRecentAgent = (a) => {
    if (!a?.name) return;
    // keep uploaded headshots only if small enough to store; pulled ones are just a link
    const photoSrc = a.photoSrc && (a.photoSrc.length < 400000 || a.photoSrc.startsWith('/api/')) ? a.photoSrc : null;
    setRecentAgents((r) => [{ ...a, photoSrc }, ...r.filter((x) => x.name !== a.name)].slice(0, 12));
  };

  // ---- derived images ----
  const [pegahCircle, setPegahCircle] = useState(null);
  const [agentCircle, setAgentCircle] = useState(null);
  const [photoCrop, setPhotoCrop] = useState(null);
  const [dpi, setDpi] = useState(null);
  useEffect(() => {
    let ok = true;
    circleDataURL(lender.photoSrc || BASE + 'brand/pegah.jpg', lender.photoCrop).then((u) => ok && setPegahCircle(u)).catch(() => {});
    return () => (ok = false);
  }, [lender.photoSrc, lender.photoCrop]);
  useEffect(() => {
    if (!agent.photoSrc) return setAgentCircle(null);
    let ok = true;
    circleDataURL(agent.photoSrc, agent.photoCrop).then((u) => ok && setAgentCircle(u)).catch(() => ok && setAgentCircle(null));
    return () => (ok = false);
  }, [agent.photoSrc, agent.photoCrop]);
  const photoSrc = pf ? data.photo?.src || (pf.fromListing ? listing.photoSrc : ASSETS[pf.fallback]) : null;
  const crop = data.photo || {};
  useEffect(() => {
    if (!pf || !photoSrc) return setPhotoCrop(null);
    let ok = true;
    cropToDataURL(photoSrc, pf.aspect, crop).then((u) => ok && setPhotoCrop(u)).catch(() => ok && setPhotoCrop(null));
    effectiveDpi(photoSrc, pf.aspect, crop, pf.aspect > 2 ? 540 : 300).then((d) => ok && setDpi(d));
    return () => (ok = false);
  }, [photoSrc, crop.zoom, crop.x, crop.y]); // eslint-disable-line

  // ---- render PDF (debounced) ----
  const [editMode, setEditMode] = useState(false);
  const [editing, setEditing] = useState(null); // { id, box }
  const [fontsOk, setFontsOk] = useState(false);
  useEffect(() => { fontsReady.then(() => setFontsOk(true)); }, []);
  const registry = useRef({});
  const overrides = data.overrides || {};
  // QR code (for flyers that have one), generated from the link field
  const [qrCode, setQrCode] = useState(null);
  const qrText = meta.qrField ? data[meta.qrField] : null;
  useEffect(() => {
    if (!qrText) return setQrCode(null);
    let ok = true;
    import('qrcode')
      .then((Q) => (Q.default || Q).toDataURL(String(qrText).trim(), { margin: 0, width: 600, errorCorrectionLevel: 'M', color: { dark: '#101010', light: '#FFFFFF' } }))
      .then((u) => ok && setQrCode(u))
      .catch(() => ok && setQrCode(null));
    return () => (ok = false);
  }, [qrText]);
  const rawInputs = useMemo(
    () => ({ data, agent, listing, bleed, pegahCircle, agentCircle, photoCrop, qrCode, editMode, fontsOk }),
    [data, agent, listing, bleed, pegahCircle, agentCircle, photoCrop, qrCode, editMode, fontsOk]
  );
  const inputs = useDebounced(rawInputs, 250);
  const [blob, setBlob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [renderError, setRenderError] = useState('');
  const seq = useRef(0);
  useEffect(() => {
    if (!inputs.pegahCircle) return;
    const n = ++seq.current;
    setBusy(true);
    const reg = {};
    buildBlob(inputs, inputs.editMode, reg)
      .then((b) => {
        if (n === seq.current) registry.current = reg;
        return b;
      })
      .then((b) => {
        if (n === seq.current) {
          setBlob(b);
          setRenderError('');
        }
      })
      .catch((e) => n === seq.current && setRenderError('Preview failed: ' + (e?.message || 'unknown error')))
      .finally(() => n === seq.current && setBusy(false));
  }, [inputs]); // eslint-disable-line

  function buildBlob(inp, edit, reg = null) {
    const doc = (
      <EditCtx.Provider value={{ overrides: inp.data.overrides || {}, edit, registry: reg }}>
        <template.Doc
          data={{ ...inp.data, photoCrop: inp.photoCrop, qrCode: inp.qrCode }}
          agent={{ ...inp.agent, photoCircle: inp.agentCircle }}
          listing={inp.listing}
          assets={{ ...ASSETS, pegahCircle: inp.pegahCircle }}
          bleed={inp.bleed}
        />
      </EditCtx.Provider>
    );
    return pdf(doc).toBlob();
  }

  const setOverride = (id, text) => {
    const next = { ...overrides };
    if (text == null) delete next[id];
    else next[id] = text;
    setData({ ...data, overrides: next });
  };

  const issues = validate(template, data, agent, listing);
  const editCount = Object.keys(overrides).length;
  if (editCount) issues.push({ text: `${editCount} manual text edit${editCount > 1 ? 's are' : ' is'} applied. Edited text no longer updates from the form.` });
  const blocking = issues.filter((i) => i.block);

  const download = async () => {
    if (!blob || blocking.length) return;
    // edit mode adds click targets to the preview; the download is always a clean copy
    const out = editMode ? await buildBlob(rawInputs, false) : blob;
    const base = [listing.street && meta.needsListing ? listing.street : null, meta.name.replace(/^Financing Solutions: /, ''), agent.mode === 'none' ? null : agent.name || null]
      .filter(Boolean)
      .join(' - ')
      .replace(/[^\w\s.-]+/g, '')
      .trim();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(out);
    a.download = `${base}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    if (meta.needsListing) addRecentListing(listing);
    if (agent.mode !== 'none') addRecentAgent(agent);
    // every download is kept in the shared library
    saveNow({ thumbBlob: out });
  };

  // ---- shared library: save, autosave ----
  const defaultName = [meta.needsListing && listing.street ? listing.street : null, meta.name.replace(/^Financing Solutions: /, ''), agent.mode !== 'none' && agent.name ? agent.name : null]
    .filter(Boolean)
    .join(' · ');
  const [name, setName] = useState(project?.name || '');
  const [saveState, setSaveState] = useState({ busy: false, err: '', at: null });
  const latest = useRef({});
  latest.current = { onSave, blob, name: name.trim() || defaultName, project };
  const saveNow = async ({ thumbBlob } = {}) => {
    const L = latest.current;
    if (!canSave || !L.onSave) return;
    setSaveState((st) => ({ ...st, busy: true, err: '' }));
    try {
      const b = thumbBlob || L.blob;
      const thumb = b ? await pdfThumb(b).catch(() => null) : null;
      await L.onSave({ name: L.name, thumb });
      setSaveState({ busy: false, err: '', at: Date.now() });
    } catch (e) {
      setSaveState({ busy: false, err: e?.code === 'permission-denied' ? 'The shared library is not switched on yet (Firestore rules).' : 'Could not save. Check the connection and try again.', at: null });
    }
  };
  // once a flyer is in the library, changes save themselves a moment after the preview updates
  useEffect(() => {
    if (!project?.projectId || !project.dirty || !blob || busy || saveState.busy) return;
    const t = setTimeout(() => saveNow(), 1200);
    return () => clearTimeout(t);
  }, [blob, busy, project?.projectId, project?.dirty]); // eslint-disable-line
  // leaving a changed flyer that was never saved puts it in the library, so nothing is lost
  useEffect(() => () => {
    const P = latest.current.project;
    if (P && !P.projectId && P.dirty && latest.current.blob) saveNow();
  }, []); // eslint-disable-line
  const today = todayISO();
  const staleDate = project?.projectId && 'date' in data && data.date && data.date !== today && project.savedDate === data.date;

  // buydown columns for the comparison flyer's APR fields
  const aprColumns = useMemo(() => {
    if (meta.id !== 'scenario-compare') return [];
    const cols = [{ key: 'list', label: 'Full price' }];
    if (num(data.priceReduction) > 0) cols.push({ key: 'reduction', label: 'Price reduction' });
    const bd = BUYDOWNS[data.type];
    if (bd) bd.periods.forEach((p, i) => cols.push({ key: 'bd' + i, label: `Buydown ${p.months > 12 ? 'years 1–3' : ordinal(i + 1) + ' year'}` }));
    return cols;
  }, [meta.id, data.priceReduction, data.type]);

  return (
    <main className="editor">
      <aside className="panel">
        <div className="panel-title">
          <span className="cat">{meta.category}</span>
          <h2>{meta.name}</h2>
        </div>

        <div className="savebox">
          <label className="field">
            <span className="lbl">Flyer name in the library</span>
            <input
              value={name}
              placeholder={defaultName}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => project?.projectId && (name.trim() || defaultName) !== project.name && saveNow()}
            />
          </label>
          <div className="save-row">
            <button type="button" className="btn small primary" disabled={!canSave || saveState.busy || !blob} onClick={() => saveNow()}>
              {project?.projectId ? 'Save now' : 'Save to library'}
            </button>
            <span className={'save-status' + (saveState.err ? ' err' : '')}>
              {saveState.err
                ? saveState.err
                : saveState.busy
                  ? 'Saving…'
                  : !canSave
                    ? 'Library unavailable'
                    : !project?.projectId
                      ? 'Not saved yet. It saves when you download or leave this flyer.'
                      : project.dirty
                        ? 'Unsaved changes, saving shortly…'
                        : 'Saved. Changes save automatically.'}
            </span>
          </div>
          {staleDate ? (
            <p className="warn-box small">
              This flyer’s rates are dated {shortDate(data.date)}. If you’re updating rates, change the date too.{' '}
              <button type="button" className="linkbtn" onClick={() => set('date', today)}>Set to today</button>
            </p>
          ) : null}
        </div>

        {/* On listing flyers the agent comes first: Pegah usually finds the listing from the agent's page */}
        {meta.needsAgent && meta.needsListing ? (
          <AgentSection agent={agent} setAgent={setAgent} agentCircle={agentCircle} recentAgents={recentAgents} setRecentAgents={setRecentAgents} onPulled={addRecentAgent} />
        ) : null}
        {meta.needsListing ? (
          <ListingSection
            listing={listing}
            recent={recentListings}
            onForget={(street) => setRecentListings((r) => r.filter((x) => x.street !== street))}
            onChange={setListing}
            onReplace={(l) => {
              // a different property: start its price and photo fresh
              setData((d) => ({ ...d, listing: l, price: '', photo: { zoom: 1, x: 0, y: 0 } }));
              addRecentListing(l);
            }}
          />
        ) : null}

        {template.fields.map((s) => (
          <Section key={s.section} title={s.section} collapsed={s.collapsed} note={s.note}>
            {s.items.map((f) => {
              if (f.type === 'photo') {
                const choices = [
                  ...(f.fromListing ? (listing.photos || []).map((u) => ({ src: proxied(u), thumb: `/api/img?w=240&url=${encodeURIComponent(u)}`, kind: 'listing' })) : []),
                  ...(f.fallback ? [{ src: ASSETS[f.fallback], thumb: ASSETS[f.fallback], kind: 'stock' }] : []),
                  ...library.map((u) => ({ src: u, thumb: u, kind: 'library' })),
                ];
                return (
                  <PhotoControl
                    key={f.key}
                    label={f.label}
                    preview={photoCrop}
                    crop={crop}
                    dpi={dpi}
                    onCrop={(c) => set('photo', { ...data.photo, ...c })}
                    onUpload={async (src) => {
                      const small = await downscale(src).catch(() => src);
                      addToLibrary(small);
                      set('photo', { src: small, zoom: 1, x: 0, y: 0 });
                    }}
                    hasCustom={!!data.photo?.src}
                    onReset={() => set('photo', { zoom: 1, x: 0, y: 0 })}
                    resetLabel={f.fromListing ? 'Use listing photo' : 'Use original photo'}
                    choices={choices}
                    selected={photoSrc}
                    onChoose={(c) => {
                      if (c.kind === 'listing') {
                        setData((d) => ({ ...d, listing: { ...listing, photoSrc: c.src }, photo: { zoom: 1, x: 0, y: 0 } }));
                      } else if (c.kind === 'stock') set('photo', { zoom: 1, x: 0, y: 0 });
                      else set('photo', { src: c.src, zoom: 1, x: 0, y: 0 });
                    }}
                    onForget={library.length ? (c) => setLibrary(library.filter((x) => x !== c.src)) : null}
                  />
                );
              }
              if (f.type === 'aprs') return <AprFields key="aprs" data={data} columns={aprColumns} onChange={(v) => set('aprs', v)} />;
              if (f.type === 'loanColumns') return <LoanColumns key="cols" value={data.columns} onChange={(v) => set('columns', v)} newColumn={() => blankCol({})} />;
              return <Field key={f.key} f={f} value={data[f.key]} listing={listing} onChange={(v) => set(f.key, v)} />;
            })}
          </Section>
        ))}

        {meta.needsAgent && !meta.needsListing ? (
          <AgentSection agent={agent} setAgent={setAgent} agentCircle={agentCircle} recentAgents={recentAgents} setRecentAgents={setRecentAgents} onPulled={addRecentAgent} />
        ) : null}

        <Section title="Pegah's headshot" collapsed>
          <PhotoControl
            round
            label="Headshot"
            preview={pegahCircle}
            crop={lender.photoCrop}
            onCrop={(c) => setLender({ ...lender, photoCrop: c })}
            onUpload={async (src) => setLender({ photoSrc: await downscale(src, 1200).catch(() => src), photoCrop: { zoom: 1, x: 0, y: 0 } })}
            hasCustom={!!lender.photoSrc}
            resetLabel="Use original headshot"
            onReset={() => setLender({ photoSrc: null, photoCrop: { zoom: 1, x: 0, y: 0 } })}
          />
          <p className="note">Changes here apply to every flyer.</p>
        </Section>

        <Section title="Locked disclosures" collapsed>
          <p className="note">
            The disclosures, licensing line and Equal Housing logo are built into every flyer and can't be edited here. Dates, rates and payment figures inside them fill in automatically from your entries.
          </p>
        </Section>
      </aside>

      <section className="stage">
        <div className="stage-bar">
          <label className="toggle" title="Adds the 1/8 inch bleed your printer needs. Turn off for email.">
            <input type="checkbox" checked={bleed} onChange={(e) => setBleed(e.target.checked)} />
            <span>Print bleed</span>
          </label>
          <div className="spacer" />
          <button className="btn primary" disabled={!blob || busy || blocking.length > 0} onClick={download}>
            {busy ? 'Updating…' : 'Download PDF'}
          </button>
        </div>
        {issues.length ? (
          <ul className="issues">
            {issues.map((i, k) => (
              <li key={k} className={i.block ? 'block' : ''}>{i.text}</li>
            ))}
          </ul>
        ) : null}
        <Preview
          blob={blob}
          busy={busy}
          error={renderError}
          editable={editMode && inputs.editMode}
          editedIds={Object.keys(overrides)}
          activeId={editing?.id}
          onPick={(id, box) => setEditing({ id, box })}
        >
          <button
            type="button"
            className={'pen' + (editMode ? ' on' : '')}
            onClick={() => { setEditMode(!editMode); setEditing(null); }}
            title={editMode ? 'Done editing text' : 'Edit any text on the flyer'}
            aria-pressed={editMode}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            <span>{editMode ? 'Done' : 'Edit text'}</span>
          </button>
          {editMode && !editing ? <div className="edit-tip">Hover over any text, then click to change it</div> : null}
          {editing ? (
            <TextEditor
              key={editing.id}
              id={editing.id}
              box={editing.box}
              info={registry.current[editing.id]}
              value={overrides[editing.id]}
              onSave={(t) => { setOverride(editing.id, t); setEditing(null); }}
              onReset={() => { setOverride(editing.id, null); setEditing(null); }}
              onClose={() => setEditing(null)}
            />
          ) : null}
        </Preview>
        {editCount ? (
          <div className="edits-bar">
            <span>{editCount} manual edit{editCount > 1 ? 's' : ''} on this flyer</span>
            <button type="button" className="btn small ghost" onClick={() => setData({ ...data, overrides: {} })}>Undo all edits</button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function TextEditor({ id, box, info, value, onSave, onReset, onClose }) {
  const original = info?.def ?? '';
  const [text, setText] = useState(value ?? original);
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const legal = info?.legal || id.startsWith('legal');
  const long = original.length > 120;
  // keep the editor inside the flyer: below the text, or above it near the bottom of the page
  const boxRef = useRef();
  const [pos, setPos] = useState({ top: box.top + box.h + 8, left: box.left, hidden: true });
  React.useLayoutEffect(() => {
    const el = boxRef.current;
    const paper = el?.parentElement;
    if (!el || !paper) return;
    const pw = paper.clientWidth;
    const ph = paper.clientHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.max(8, Math.min(box.left, pw - w - 8));
    let top = box.top + box.h + 8;
    if (top + h > ph - 8) top = Math.max(8, box.top - h - 8);
    setPos({ top, left, hidden: false });
  }, [box]);
  return (
    <div ref={boxRef} className="text-editor" style={{ top: pos.top, left: pos.left, visibility: pos.hidden ? 'hidden' : 'visible' }} role="dialog" aria-label="Edit text">
      <div className="te-head">
        <b>{legal ? 'Edit disclosure' : 'Edit text'}</b>
        <button type="button" className="te-x" onClick={onClose} aria-label="Close">×</button>
      </div>
      {legal ? <p className="te-warn">This is approved disclosure language. Only change it to match updated terms from compliance.</p> : null}
      <textarea
        ref={ref}
        rows={long ? 8 : 3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSave(text);
        }}
      />
      <p className="te-note">Text shrinks automatically if it gets longer than its space. Edited numbers stop updating from the form until you reset them.{original.includes('<b>') ? ' Text between <b> and </b> prints bold.' : ''}</p>
      <div className="te-actions">
        {value != null ? <button type="button" className="btn small ghost" onClick={onReset}>Reset to original</button> : null}
        <span className="spacer" />
        <button type="button" className="btn small ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn small primary" onClick={() => (text === original ? onReset() : onSave(text))}>Save</button>
      </div>
    </div>
  );
}

function Section({ title, children, collapsed, note }) {
  const [open, setOpen] = useState(!collapsed);
  return (
    <section className={'section' + (open ? ' open' : '')}>
      <button type="button" className="section-head" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <i>{open ? '–' : '+'}</i>
      </button>
      {open ? (
        <div className="section-body">
          {note ? <p className="note">{note}</p> : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}

async function pullCompass(url) {
  let r;
  try {
    r = await fetch(`/api/compass?url=${encodeURIComponent(url.trim())}`);
  } catch {
    throw new Error('Link pulling only works on the live site. Fill in the details by hand here.');
  }
  const j = await r.json().catch(() => null);
  if (!j) throw new Error('Link pulling only works on the live site. Fill in the details by hand here.');
  if (!r.ok) throw new Error(j.error || 'Could not pull that link');
  return j;
}

function LinkPull({ value, placeholder, onPull, kind }) {
  const [url, setUrl] = useState(value || '');
  const [state, setState] = useState({ busy: false, msg: '' });
  const go = async () => {
    if (!url.trim()) return;
    setState({ busy: true, msg: '' });
    try {
      const j = await pullCompass(url);
      if (j.type !== kind) throw new Error(kind === 'agent' ? 'That looks like a listing link. Paste the agent’s profile link here.' : 'That looks like an agent link. Paste the listing link here.');
      onPull(j);
      setState({ busy: false, msg: 'ok' });
    } catch (e) {
      setState({ busy: false, msg: e.message });
    }
  };
  return (
    <div className="field">
      <div className="linkpull">
        <input value={url} placeholder={placeholder} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
        <button type="button" className="btn small primary" disabled={state.busy} onClick={go}>{state.busy ? 'Pulling…' : 'Pull info'}</button>
      </div>
      {state.msg && state.msg !== 'ok' ? <span className="warn-inline">{state.msg}</span> : null}
      {state.msg === 'ok' ? <span className="ok-inline">Pulled. Check the details below.</span> : null}
    </div>
  );
}

function ListingSection({ listing, recent, onForget, onChange, onReplace }) {
  const s = (k, v) => onChange({ ...listing, [k]: v });
  const [pullKey, setPullKey] = useState(0);
  return (
    <Section title="Listing">
      {recent.length ? (
        <label className="field">
          <Label>Recent listings</Label>
          <select
            value=""
            onChange={(e) => {
              const r = recent.find((x) => x.street === e.target.value);
              if (r) {
                onReplace(r);
                setPullKey((k) => k + 1);
              }
            }}
          >
            <option value="">Choose a recent listing…</option>
            {recent.map((r) => (
              <option key={r.street} value={r.street}>{[r.street, r.city].filter(Boolean).join(', ')}</option>
            ))}
          </select>
        </label>
      ) : null}
      <LinkPull
        key={pullKey}
        kind="listing"
        value={listing.url}
        placeholder="Paste a compass.com listing link"
        onPull={(j) => onReplace({ ...emptyListing, ...j, price: j.price || '', photoSrc: j.photos?.[0] ? proxied(j.photos[0]) : null })}
      />
      <label className="field"><Label>Street address</Label><input value={listing.street} onChange={(e) => s('street', e.target.value)} /></label>
      <div className="grid3">
        <label className="field"><Label>City</Label><input value={listing.city} onChange={(e) => s('city', e.target.value)} /></label>
        <label className="field"><Label>State</Label><input value={listing.state} onChange={(e) => s('state', e.target.value)} /></label>
        <label className="field"><Label>ZIP</Label><input value={listing.zip} onChange={(e) => s('zip', e.target.value)} /></label>
      </div>
      <Field f={{ key: 'price', label: 'List price', type: 'money' }} value={listing.price} onChange={(v) => s('price', v)} />
      <label className="field">
        <Label help="Used on the Loan Options flyer">Description</Label>
        <textarea rows={5} value={listing.description} onChange={(e) => s('description', e.target.value)} />
      </label>
      <div className="row-actions">
        <button type="button" className="btn small ghost" onClick={() => { onReplace({ ...emptyListing }); setPullKey((k) => k + 1); }}>Clear listing</button>
        {listing.street && recent.some((r) => r.street === listing.street) ? (
          <button type="button" className="btn small ghost" onClick={() => onForget(listing.street)}>Remove from recents</button>
        ) : null}
      </div>
    </Section>
  );
}

function AgentSection({ agent, setAgent, agentCircle, recentAgents, setRecentAgents, onPulled }) {
  const [pullKey, setPullKey] = useState(0);
  const s = (k, v) => setAgent({ ...agent, [k]: v });
  const mode = agent.mode || 'compass';
  const setMode = (m) => {
    const next = { ...agent, mode: m };
    if (m === 'other' && agent.brokerage === 'Compass Real Estate') next.brokerage = '';
    if (m === 'compass' && !agent.brokerage) next.brokerage = 'Compass Real Estate';
    setAgent(next);
  };
  return (
    <Section title="Agent">
      <div className="segmented" role="radiogroup" aria-label="Who is on the flyer">
        {[
          ['compass', 'Compass agent'],
          ['other', 'Other agent'],
          ['none', 'Just Pegah'],
        ].map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={mode === v} className={mode === v ? 'on' : ''} onClick={() => setMode(v)}>{l}</button>
        ))}
      </div>
      <p className="note">
        {mode === 'compass' ? 'Shows the agent and the Compass logo.' : mode === 'other' ? 'Shows the agent with no Compass logo. Add their brokerage below.' : 'No agent and no Compass logo. Only Pegah and OriginPoint.'}
      </p>
      {mode === 'none' ? null : (<>
      {recentAgents.length ? (
        <label className="field">
          <Label>Recent agents</Label>
          <select
            value=""
            onChange={(e) => {
              const r = recentAgents.find((x) => x.name === e.target.value);
              if (r) {
                setAgent({ ...emptyAgent, ...r, mode: r.mode && r.mode !== 'none' ? r.mode : mode });
                setPullKey((k) => k + 1);
              }
            }}
          >
            <option value="">Choose a recent agent…</option>
            {recentAgents.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
        </label>
      ) : null}
      {mode === 'compass' ? (
      <LinkPull
        key={pullKey}
        kind="agent"
        value={agent.url}
        placeholder="Paste a compass.com agent profile link"
        onPull={(j) => {
          // a new agent: start from blank so nothing from the previous agent carries over
          const next = { ...emptyAgent, ...j, mode, brokerage: 'Compass Real Estate', photoSrc: j.photo ? proxied(j.photo) : null, photoCrop: { zoom: 1, x: 0, y: 0 } };
          setAgent(next);
          onPulled(next);
        }}
      />
      ) : null}
      <label className="field"><Label>Name</Label><input value={agent.name} onChange={(e) => s('name', e.target.value)} /></label>
      <label className="field"><Label>Title or team</Label><input value={agent.title} onChange={(e) => s('title', e.target.value)} /></label>
      <label className="field"><Label>Brokerage line</Label><input value={agent.brokerage} placeholder={mode === 'other' ? 'Their brokerage name' : ''} onChange={(e) => s('brokerage', e.target.value)} /></label>
      <div className="grid-phone">
        <label className="field"><Label>Phone</Label>
          <select value={agent.phoneLabel} onChange={(e) => s('phoneLabel', e.target.value)}>
            <option value="M">M</option><option value="O">O</option><option value="P">P</option>
          </select>
        </label>
        <label className="field"><Label>&nbsp;</Label><input value={agent.phone} onChange={(e) => s('phone', e.target.value)} placeholder="202.555.0100" /></label>
      </div>
      <label className="field"><Label>Email</Label><input value={agent.email} onChange={(e) => s('email', e.target.value)} /></label>
      <PhotoControl
        round
        label="Headshot"
        preview={agentCircle}
        crop={agent.photoCrop}
        onCrop={(c) => s('photoCrop', c)}
        onUpload={async (src) => setAgent({ ...agent, photoSrc: await downscale(src, 1200).catch(() => src), photoCrop: { zoom: 1, x: 0, y: 0 } })}
        hasCustom={!!agent.photoSrc}
        onReset={() => setAgent({ ...agent, photoSrc: null })}
      />
      <div className="row-actions">
        <button type="button" className="btn small ghost" onClick={() => { setAgent({ ...emptyAgent, mode }); setPullKey((k) => k + 1); }}>Clear agent</button>
        {recentAgents.some((r) => r.name === agent.name) ? (
          <button type="button" className="btn small ghost" onClick={() => setRecentAgents(recentAgents.filter((r) => r.name !== agent.name))}>Remove from recents</button>
        ) : null}
      </div>
      </>)}
    </Section>
  );
}

// ---------- checks before download ----------
function validate(t, d, agent, listing) {
  const out = [];
  const id = t.meta.id;
  const hasDate = t.fields.some((s) => s.items.some((f) => f.key === 'date'));
  if (hasDate && !d.date) out.push({ block: true, text: 'Add the “rates effective as of” date. It fills the date in the disclosure.' });
  if (id === 'ratereduce' && (d.rate === '' || d.apr === '' || d.apr == null)) out.push({ block: true, text: 'Add the interest rate and APR.' });
  if (id === 'ratereduce' && num(d.downPct) !== 20) out.push({ text: 'The disclosure assumes 20% down. Use 20% or check with compliance.' });
  if (id === 'scenario-compare') {
    if (!num(d.price || listing.price)) out.push({ block: true, text: 'Add a list price (or pull a listing).' });
    if (d.rate === '' || d.rate == null) out.push({ block: true, text: 'Add the interest rate.' });
    const keys = ['list'];
    if (num(d.priceReduction) > 0) keys.push('reduction');
    (BUYDOWNS[d.type]?.periods || []).forEach((_, i) => keys.push('bd' + i));
    if (keys.some((k) => d.aprs?.[k] === '' || d.aprs?.[k] == null)) out.push({ block: true, text: 'Add an APR for every column.' });
  }
  if (id === 'loan-options') {
    if (!num(d.price || listing.price)) out.push({ block: true, text: 'Add a list price (or pull a listing).' });
    (d.columns || []).forEach((c, i) => {
      if (c.rate === '' || c.apr === '' || c.rate == null || c.apr == null) out.push({ block: true, text: `Loan program ${i + 1}: add the rate and APR.` });
      if (c.program === 'arm' && !String(c.index || '').trim()) out.push({ block: true, text: `Loan program ${i + 1}: add the current SOFR index for the ARM disclosure.` });
    });
  }
  if (!['ratereduce', 'scenario-compare', 'loan-options'].includes(id)) {
    const missing = [];
    t.fields.forEach((sec) => sec.items.forEach((f) => {
      if (f.required && f.key !== 'date' && (d[f.key] === '' || d[f.key] == null)) missing.push(f.label);
    }));
    if (missing.length) out.push({ block: true, text: `Still needed: ${missing.join(', ')}.` });
  }
  if (t.meta.qrField && !/^https?:\/\/\S+\.\S+/.test(String(d[t.meta.qrField] || '').trim())) out.push({ block: true, text: 'Add a full QR code link starting with https://' });
  if (t.meta.needsListing) {
    if (!listing.street) out.push({ block: true, text: 'Add the property address (or pull a listing).' });
    if (!listing.photoSrc && !d.photo?.src) out.push({ text: 'No listing photo yet.' });
  }
  if (t.meta.needsAgent && agent.mode !== 'none') {
    if (!agent.name) out.push({ text: 'No agent added. The flyer will say “Agent Name”.' });
    else if (!agent.photoSrc) out.push({ text: 'No agent headshot yet.' });
  }
  return out;
}
