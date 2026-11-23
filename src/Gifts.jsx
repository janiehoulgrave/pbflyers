import React, { useEffect, useState } from 'react';
import { getGiftStore, checkLink } from './lib/gifts.js';
import { applyCheck, shownPrice, needsAttention, money, shortDay, retailerFromUrl } from './lib/giftPrice.js';
import { fileToDataURL } from './lib/images.js';

const SORTS = {
  new: { label: 'Newest', fn: (a, b) => (b.createdAt || 0) - (a.createdAt || 0) },
  low: { label: 'Price, low to high', fn: (a, b) => (shownPrice(a).price ?? Infinity) - (shownPrice(b).price ?? Infinity) },
  high: { label: 'Price, high to low', fn: (a, b) => (shownPrice(b).price ?? -1) - (shownPrice(a).price ?? -1) },
  shop: { label: 'Retailer', fn: (a, b) => (a.retailer || '').localeCompare(b.retailer || '') || (a.name || '').localeCompare(b.name || '') },
};

const STATUS_WORDS = {
  blocked: 'The site blocked the price check',
  'no-price': 'The page doesn’t list a price the check can read',
  gone: 'The product page is gone',
  error: 'The price check couldn’t reach the site',
};

export default function GiftCenter({ who, admin }) {
  const [store, setStore] = useState(null);
  const [gifts, setGifts] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('new');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [editing, setEditing] = useState(null); // null | 'new' | gift
  const [checking, setChecking] = useState({});

  useEffect(() => {
    let unsub = () => {};
    getGiftStore()
      .then((st) => {
        setStore(st);
        unsub = st.subscribe(setGifts, (e) => setErr(e?.code === 'permission-denied' ? 'permission' : 'other'));
      })
      .catch(() => setErr('other'));
    return () => unsub();
  }, []);

  const visible = (gifts || []).filter((g) => admin || !g.hidden);
  const flagged = admin ? visible.filter((g) => needsAttention(g)) : [];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = visible
    .filter((g) => !onlyFlagged || needsAttention(g))
    .filter((g) => words.every((w) => [g.name, g.retailer].join(' ').toLowerCase().includes(w)))
    .sort(SORTS[sort].fn);

  const recheck = async (g) => {
    setChecking((c) => ({ ...c, [g.id]: true }));
    try {
      const r = await checkLink(g.link);
      await store.update(g.id, applyCheck(g, r));
    } finally {
      setChecking((c) => ({ ...c, [g.id]: false }));
    }
  };

  return (
    <main className="gallery gifts">
      <div className="gallery-head">
        <h1>Gift Center</h1>
        <p className="gifts-intro">Thank-you gifts for clients, ready to order. Prices are checked every morning.</p>
        <div className="gifts-tools">
          <div className="search">
            <input placeholder="Search gifts or retailers…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <label className="gifts-sort">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {Object.entries(SORTS).map(([k, s]) => (
                <option key={k} value={k}>{s.label}</option>
              ))}
            </select>
          </label>
          {admin ? <button className="btn primary" onClick={() => setEditing('new')}>Add gift</button> : null}
        </div>
      </div>

      {err ? (
        <p className="warn-box">
          {err === 'permission'
            ? 'The Gift Center isn’t switched on yet. The Firestore rule for pbflyers_gifts needs to be added (see README, “Gift Center”).'
            : 'Couldn’t reach the gift list. Check the connection and refresh.'}
        </p>
      ) : null}

      {flagged.length ? (
        <p className="warn-box gifts-flag">
          {flagged.length === 1 ? '1 price' : `${flagged.length} prices`} couldn’t be checked automatically. The last known price is still shown.{' '}
          <button className="linkbtn" onClick={() => setOnlyFlagged(!onlyFlagged)}>{onlyFlagged ? 'Show all gifts' : 'Show only these'}</button>
        </p>
      ) : null}

      {gifts === null && !err ? <p className="lib-empty">Loading gifts…</p> : null}
      {gifts && visible.length === 0 ? (
        <p className="lib-empty">{admin ? 'No gifts yet. Add one with a product link and a photo.' : 'Gifts will appear here soon.'}</p>
      ) : null}
      {gifts && visible.length > 0 && list.length === 0 ? <p className="lib-empty">No gifts match.</p> : null}

      <div className="cards gift-cards">
        {list.map((g) => (
          <GiftCard
            key={g.id}
            g={g}
            store={store}
            admin={admin}
            checking={!!checking[g.id]}
            onEdit={() => setEditing(g)}
            onCheck={() => recheck(g)}
            onHide={() => store.update(g.id, { hidden: !g.hidden }, who)}
          />
        ))}
      </div>

      {editing && admin ? (
        <GiftForm
          gift={editing === 'new' ? null : editing}
          store={store}
          who={who}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </main>
  );
}

function GiftImage({ src, store, alt }) {
  const [url, setUrl] = useState(src && !src.startsWith('img:') ? src : null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
    if (!src) return setUrl(null);
    if (!src.startsWith('img:')) return setUrl(src);
    let live = true;
    setUrl(null);
    store?.getImage(src.slice(4)).then((d) => live && setUrl(d));
    return () => { live = false; };
  }, [src, store]);
  if (!url || broken) return <div className="gift-noimg">{src && !broken ? '' : 'No photo'}</div>;
  return <img src={url} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
}

function GiftCard({ g, store, admin, checking, onEdit, onCheck, onHide }) {
  const { price, manual } = shownPrice(g);
  const flag = needsAttention(g);
  let checked;
  if (manual) checked = admin ? `Price set by hand ${shortDay(g.manualAt)}` : `Price as of ${shortDay(g.manualAt)}`;
  else if (!g.checkedAt) checked = 'First price check runs tomorrow morning';
  else if (g.checkStatus === 'ok') checked = `Price checked ${shortDay(g.checkedAt)}`;
  else checked = g.priceAt ? `Price as of ${shortDay(g.priceAt)}` : '';
  const drop = !manual && g.previousPrice != null && g.price != null && g.price < g.previousPrice && Date.now() - (g.priceChangedAt || 0) < 14 * 86400000;
  const siteSays = manual && admin && g.price != null && g.checkStatus === 'ok' && Number(g.manualPrice) !== g.price;

  return (
    <article className={'card gift-card' + (g.hidden ? ' is-hidden' : '')}>
      <a className="gift-img" href={g.link} target="_blank" rel="noopener noreferrer" aria-label={`Open ${g.name} at ${g.retailer}`}>
        <GiftImage src={g.image} store={store} alt={g.name} />
        {g.hidden ? <span className="gift-hidden-tag">Hidden from Pegah</span> : null}
      </a>
      <div className="card-body">
        <p className="gift-retailer">{g.retailer}</p>
        <h3>{g.name || 'Untitled gift'}</h3>
        <p className="gift-price">
          {price != null ? money(price, g.currency) : <span className="gift-noprice">Price to come</span>}
          {drop ? <span className="gift-drop">Down from {money(g.previousPrice, g.currency)}</span> : null}
        </p>
        {checked ? <p className={'gift-checked' + (flag ? ' flag' : '')}>{checked}</p> : null}
        {admin && flag ? (
          <p className="gift-why">
            {STATUS_WORDS[g.checkStatus] || 'The price check hasn’t run in a few days'} ({shortDay(g.checkedAt)}). Set the price by hand from Edit.
          </p>
        ) : null}
        {siteSays ? <p className="gift-why">The site now shows {money(g.price, g.currency)}.</p> : null}
      </div>
      <div className="card-actions gift-actions">
        <a className="btn small primary" href={g.link} target="_blank" rel="noopener noreferrer">Buy{g.retailer ? ` at ${g.retailer}` : ''}</a>
        {admin ? (
          <>
            <button className="btn small ghost" onClick={onEdit}>Edit</button>
            <button className="btn small ghost" onClick={onCheck} disabled={checking}>{checking ? 'Checking…' : 'Check price'}</button>
            <button className="btn small ghost" onClick={onHide}>{g.hidden ? 'Show' : 'Hide'}</button>
          </>
        ) : null}
      </div>
    </article>
  );
}

const blankForm = { link: '', image: '', name: '', retailer: '', manualPrice: '', hidden: false };

function GiftForm({ gift, store, who, onClose }) {
  const [f, setF] = useState(() => (gift ? { ...blankForm, ...gift, manualPrice: gift.manualPrice ?? '' } : blankForm));
  const [check, setCheck] = useState(null); // last result from the link, for this form
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const linkChanged = !gift || f.link.trim() !== (gift.link || '');

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const fill = async (link = f.link) => {
    if (!link.trim()) return;
    setBusy('fill');
    setMsg('');
    const r = await checkLink(link.trim());
    setCheck({ ...r, link: link.trim() });
    setF((x) => ({
      ...x,
      name: x.name || r.name || '',
      retailer: x.retailer || r.retailer || '',
      image: x.image || r.image || '',
    }));
    setBusy('');
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('photo');
    try {
      const ref = await store.putImage(await fileToDataURL(file));
      setF((x) => ({ ...x, image: ref }));
    } catch {
      setMsg('That photo couldn’t be saved. Try a JPG or PNG.');
    }
    setBusy('');
  };

  const parsedManual = String(f.manualPrice).trim() === '' ? null : Number(String(f.manualPrice).replace(/[^0-9.]/g, ''));
  const manualBad = parsedManual != null && !(parsedManual > 0);
  const ready = f.link.trim() && f.name.trim() && f.retailer.trim() && !manualBad && !busy;

  const save = async () => {
    if (!ready) return;
    setBusy('save');
    setMsg('');
    try {
      const link = f.link.trim();
      const body = {
        link,
        image: f.image.trim(),
        name: f.name.trim(),
        retailer: f.retailer.trim(),
        hidden: !!f.hidden,
        manualPrice: parsedManual,
      };
      if (parsedManual !== (gift?.manualPrice ?? null)) body.manualAt = parsedManual == null ? null : Date.now();
      // a new link starts a fresh price record
      const base = linkChanged ? { price: null, previousPrice: null, priceChangedAt: null, priceAt: null, priceHistory: [], checkedAt: null, checkStatus: 'pending', checkMessage: '' } : {};
      const fresh = check && check.link === link ? applyCheck(linkChanged ? {} : gift, check) : null;
      const doc = { ...base, ...body, ...(fresh || {}) };
      let id = gift?.id;
      if (id) await store.update(id, doc, who);
      else id = await store.add(doc, who);
      onClose();
      // no reading from the link yet: check it now so the card has a price before tomorrow's run
      if (linkChanged && !fresh) {
        const r = await checkLink(link);
        await store.update(id, applyCheck({}, r));
      }
    } catch {
      setMsg('Couldn’t save. Check the connection and try again.');
      setBusy('');
    }
  };

  const remove = async () => {
    setBusy('save');
    try {
      await store.remove(gift.id);
      onClose();
    } catch {
      setMsg('Couldn’t delete. Try again.');
      setBusy('');
    }
  };

  const shownAuto = check && check.link === f.link.trim() ? check : linkChanged ? null : gift;

  return (
    <div className="sheet-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="sheet" role="dialog" aria-label={gift ? 'Edit gift' : 'Add gift'}>
        <div className="sheet-head">
          <h2>{gift ? 'Edit gift' : 'Add gift'}</h2>
          <button className="te-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="sheet-body">
          <label className="field">
            <span className="lbl">Product link</span>
            <div className="linkpull">
              <input
                type="url"
                placeholder="https://www.tiffany.com/…"
                value={f.link}
                onChange={(e) => {
                  const link = e.target.value;
                  setF((x) => ({ ...x, link, retailer: x.retailer || retailerFromUrl(link) }));
                }}
                onPaste={(e) => {
                  const t = e.clipboardData.getData('text');
                  if (t && !f.name) setTimeout(() => fill(t), 0);
                }}
              />
              <button className="btn" onClick={() => fill()} disabled={!f.link.trim() || !!busy}>{busy === 'fill' ? 'Reading…' : 'Fill in'}</button>
            </div>
          </label>
          {check && check.link === f.link.trim() ? (
            check.status === 'ok' ? (
              <p className="ok-inline">Found {money(check.price, check.currency)} on the page. The daily check will keep it current.</p>
            ) : (
              <p className="warn-inline">{check.message} Fill in the details below, and set the price by hand if needed.</p>
            )
          ) : null}

          <div className="field">
            <span className="lbl">Hero image</span>
            <div className="gift-photo">
              <div className="gift-photo-box"><GiftImage src={f.image} store={store} alt="" /></div>
              <div className="photo-btns">
                <label className="btn small">
                  {busy === 'photo' ? 'Saving…' : 'Upload photo'}
                  <input type="file" accept="image/*" hidden onChange={upload} />
                </label>
                {f.image ? <button className="btn small ghost danger" onClick={() => setF((x) => ({ ...x, image: '' }))}>Remove</button> : null}
              </div>
            </div>
            {!f.image.startsWith('img:') ? (
              <input placeholder="…or paste an image link" value={f.image} onChange={set('image')} />
            ) : null}
          </div>

          <label className="field">
            <span className="lbl">Name</span>
            <input value={f.name} onChange={set('name')} placeholder="Elsa Peretti Bone Cuff" />
          </label>
          <label className="field">
            <span className="lbl">Retailer</span>
            <input value={f.retailer} onChange={set('retailer')} placeholder="Tiffany & Co." />
          </label>

          <div className="field">
            <span className="lbl">
              Price
              <small>
                {shownAuto && shownAuto.price != null
                  ? `The daily check last read ${money(shownAuto.price, shownAuto.currency)}${shownAuto.priceAt ? ` (${shortDay(shownAuto.priceAt)})` : ''}. `
                  : 'The daily check fills this in. '}
                Set a price here only if the site blocks the check. It is shown until you clear it.
              </small>
            </span>
            <div className="numwrap">
              <i>$</i>
              <input inputMode="decimal" placeholder="Checked automatically" value={f.manualPrice} onChange={set('manualPrice')} />
              {String(f.manualPrice).trim() ? <button className="btn small ghost" onClick={() => setF((x) => ({ ...x, manualPrice: '' }))}>Clear</button> : null}
            </div>
            {manualBad ? <span className="warn-inline">Enter a price like 250 or 89.50.</span> : null}
          </div>

          <label className="toggle">
            <input type="checkbox" checked={!!f.hidden} onChange={set('hidden')} />
            Hide from Pegah
          </label>

          {msg ? <p className="warn-inline">{msg}</p> : null}
        </div>
        <div className="sheet-foot">
          {gift ? (
            confirmDel ? (
              <>
                <span className="del-q">Delete this gift?</span>
                <button className="btn small ghost danger" onClick={remove} disabled={!!busy}>Delete</button>
                <button className="btn small ghost" onClick={() => setConfirmDel(false)}>Cancel</button>
              </>
            ) : (
              <button className="btn small ghost danger" onClick={() => setConfirmDel(true)}>Delete</button>
            )
          ) : null}
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={!ready}>{busy === 'save' ? 'Saving…' : gift ? 'Save' : 'Add gift'}</button>
        </div>
      </aside>
    </div>
  );
}
