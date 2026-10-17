import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { TEMPLATES, byId } from './pdf/templates/index.js';
import { blankCol } from './pdf/templates/financing.jsx';
import { registerFonts, EditCtx, setMeasurer } from './pdf/common.jsx';
import { Field, PhotoControl, AprFields, LoanColumns, Label } from './components/Fields.jsx';
import Preview from './components/Preview.jsx';
import { proxied, cropToDataURL, circleDataURL, effectiveDpi, downscale } from './lib/images.js';
import { authEnabled, watchUser, signIn, logOut, isAllowed } from './lib/firebase.js';
import { ordinal, num, todayISO } from './lib/format.js';
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
  const [view, setView] = useState(initial.templateId ? 'editor' : 'gallery');
  const [templateId, setTemplateId] = useState(initial.templateId || null);
  const [agent, setAgent] = useState({ ...emptyAgent, ...initial.agent });
  const [listing, setListing] = useState({ ...emptyListing, ...initial.listing });
  const [dataById, setDataById] = useState(initial.dataById || {});
  const [recentAgents, setRecentAgents] = useState(initial.recentAgents || []);
  const [bleed, setBleed] = useState(initial.bleed ?? true);
  const [library, setLibrary] = useState(initial.library || []); // photos Pegah uploaded, reusable on any flyer
  const [lender, setLender] = useState({ photoSrc: null, photoCrop: { zoom: 1, x: 0, y: 0 }, ...initial.lender });
  const addToLibrary = (src) => setLibrary((l) => [src, ...l.filter((x) => x !== src)].slice(0, 8));

  useEffect(() => {
    // The rates-effective date is never carried over to a new session: it must be entered fresh.
    const noDates = Object.fromEntries(Object.entries(dataById).map(([k, v]) => [k, { ...v, date: '' }]));
    save({ templateId: view === 'editor' ? templateId : null, agent, listing, dataById: noDates, recentAgents, bleed, library, lender });
  }, [view, templateId, agent, listing, dataById, recentAgents, bleed, library, lender]);

  const editorData = useMemo(
    () => {
      if (!templateId || !byId(templateId)) return null;
      const d = { ...byId(templateId).defaults, ...dataById[templateId] };
      // rates-effective date starts as today each session (never carried over from a past day)
      if ('date' in d && !d.date) d.date = todayISO();
      return d;
    },
    [templateId, dataById]
  );

  const open = (id) => {
    setTemplateId(id);
    setView('editor');
    window.scrollTo(0, 0);
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
      {view === 'gallery' || !templateId ? (
        <Gallery onOpen={open} />
      ) : (
        <Editor
          key={templateId}
          template={byId(templateId)}
          data={editorData}
          setData={(d) => setDataById((m) => ({ ...m, [templateId]: d }))}
          agent={agent}
          setAgent={setAgent}
          listing={listing}
          setListing={setListing}
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
function Gallery({ onOpen }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const cats = ['All', ...new Set(TEMPLATES.map((t) => t.meta.category))];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = TEMPLATES.filter((t) => {
    if (cat !== 'All' && t.meta.category !== cat) return false;
    const hay = [t.meta.name, t.meta.description, t.meta.category, ...t.meta.tags].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  return (
    <main className="gallery">
      <div className="gallery-head">
        <h1>Choose a flyer</h1>
        <div className="search">
          <input autoFocus placeholder="Search flyers: buydown, listing, VA, 2-1…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips">
          {cats.map((c) => (
            <button key={c} className={'chip' + (c === cat ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      </div>
      <div className="cards">
        {list.map((t) => (
          <button key={t.meta.id} className="card" onClick={() => onOpen(t.meta.id)}>
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

function Editor({ template, data, setData, agent: agentRaw, setAgent: setAgentRaw, listing, setListing, recentAgents, setRecentAgents, bleed, setBleed, library, addToLibrary, setLibrary, lender, setLender }) {
  const { meta } = template;
  const pf = photoFieldOf(template);
  const set = (k, v) => setData({ ...data, [k]: v });

  // Who's on the flyer is remembered per flyer (consumer flyers start as "Just Pegah"); agent details are shared.
  const mode = data.agentMode || meta.defaultAgentMode || agentRaw.mode || 'compass';
  const agent = useMemo(() => ({ ...agentRaw, mode }), [agentRaw, mode]);
  const setAgent = (next) => {
    const { mode: m, ...rest } = next;
    if (m && m !== mode) setData({ ...data, agentMode: m });
    setAgentRaw({ ...rest, mode: m || mode });
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
  const rawInputs = useMemo(
    () => ({ data, agent, listing, bleed, pegahCircle, agentCircle, photoCrop, editMode, fontsOk }),
    [data, agent, listing, bleed, pegahCircle, agentCircle, photoCrop, editMode, fontsOk]
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
          data={{ ...inp.data, photoCrop: inp.photoCrop }}
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
    if (agent.name && agent.mode !== 'none') {
      const keep = { ...agent, photoSrc: agent.photoSrc && agent.photoSrc.length < 400000 ? agent.photoSrc : agent.photoSrc?.startsWith('/api/') ? agent.photoSrc : null };
      setRecentAgents([keep, ...recentAgents.filter((r) => r.name !== agent.name)].slice(0, 12));
    }
  };

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

        {meta.needsListing ? <ListingSection listing={listing} setListing={setListing} onPulled={() => setData({ ...data, price: '', photo: { zoom: 1, x: 0, y: 0 } })} /> : null}

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
                        setListing({ ...listing, photoSrc: c.src });
                        set('photo', { zoom: 1, x: 0, y: 0 });
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

        {meta.needsAgent ? (
          <AgentSection agent={agent} setAgent={setAgent} agentCircle={agentCircle} recentAgents={recentAgents} setRecentAgents={setRecentAgents} />
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

function ListingSection({ listing, setListing, onPulled }) {
  const s = (k, v) => setListing({ ...listing, [k]: v });
  return (
    <Section title="Listing">
      <LinkPull
        kind="listing"
        value={listing.url}
        placeholder="Paste a compass.com listing link"
        onPull={(j) => {
          setListing({ ...emptyListing, ...j, price: j.price || '', photoSrc: j.photos?.[0] ? proxied(j.photos[0]) : null });
          onPulled();
        }}
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
    </Section>
  );
}

function AgentSection({ agent, setAgent, agentCircle, recentAgents, setRecentAgents }) {
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
              if (r) setAgent({ ...emptyAgent, ...r, mode: r.mode || mode });
            }}
          >
            <option value="">Choose a recent agent…</option>
            {recentAgents.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
        </label>
      ) : null}
      {mode === 'compass' ? (
      <LinkPull
        kind="agent"
        value={agent.url}
        placeholder="Paste a compass.com agent profile link"
        onPull={(j) => setAgent({ ...emptyAgent, ...agent, ...j, brokerage: agent.brokerage || 'Compass Real Estate', photoSrc: j.photo ? proxied(j.photo) : agent.photoSrc, photoCrop: { zoom: 1, x: 0, y: 0 } })}
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
        <button type="button" className="btn small ghost" onClick={() => setAgent({ ...emptyAgent, mode })}>Clear agent</button>
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
