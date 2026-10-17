import React, { useEffect, useRef, useState } from 'react';
import { BUYDOWNS } from '../lib/calc.js';
import { fileToDataURL } from '../lib/images.js';
import { num } from '../lib/format.js';

export function Label({ children, help, required }) {
  return (
    <span className="lbl">
      {children}
      {required ? <em className="req">required</em> : null}
      {help ? <small>{help}</small> : null}
    </span>
  );
}

// Numeric input that lets people type freely ("1,200,000", "7.125") and stores a number
export function NumberInput({ value, onChange, prefix, suffix, step, placeholder }) {
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(fmt(value));
  }, [value]);
  function fmt(v) {
    if (v === '' || v == null) return '';
    const n = Number(v);
    if (!Number.isFinite(n)) return '';
    return prefix === '$' ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(n);
  }
  return (
    <span className="numwrap">
      {prefix ? <i>{prefix}</i> : null}
      <input
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        step={step}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(fmt(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          const raw = e.target.value.replace(/[^0-9.\-]/g, '');
          onChange(raw === '' ? '' : Number(raw));
        }}
      />
      {suffix ? <i>{suffix}</i> : null}
    </span>
  );
}

export function Field({ f, value, onChange, listing }) {
  const placeholder = f.fromListing && listing?.[f.fromListing] ? Number(listing[f.fromListing]).toLocaleString('en-US') : undefined;
  let input;
  switch (f.type) {
    case 'money':
      input = <NumberInput prefix="$" value={value} onChange={onChange} placeholder={placeholder ? placeholder + ' (from listing)' : undefined} />;
      break;
    case 'percent':
      input = <NumberInput suffix="%" value={value} onChange={onChange} step={f.step} />;
      break;
    case 'select':
      input = (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
      break;
    case 'date':
      input = <input type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'textarea':
      input = <textarea rows={f.rows || 4} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
      break;
    default:
      input = <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} />;
  }
  const warn = f.warnUnless != null && value !== '' && num(value) !== f.warnUnless;
  return (
    <label className="field">
      <Label help={f.help} required={f.required}>{f.label}</Label>
      {input}
      {warn ? <span className="warn-inline">The disclosure on this flyer says {f.warnUnless}%. Changing it makes the disclosure inaccurate.</span> : null}
    </label>
  );
}

// Photo picker with zoom and position
export function PhotoControl({ label, preview, crop = {}, onCrop, onUpload, onReset, hasCustom, choices, onChoose, onForget, selected, resetLabel, dpi, round }) {
  const fileRef = useRef();
  const set = (k, v) => onCrop({ ...crop, [k]: v });
  return (
    <div className="field photo-ctl">
      <Label>{label}</Label>
      <div className="photo-row">
        <div className={'photo-thumb' + (round ? ' round' : '')}>{preview ? <img src={preview} alt="" /> : <span>No photo</span>}</div>
        <div className="photo-btns">
          <button type="button" className="btn small" onClick={() => fileRef.current.click()}>Upload photo</button>
          {hasCustom ? <button type="button" className="btn small ghost" onClick={onReset}>{resetLabel || 'Use default'}</button> : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(await fileToDataURL(file));
              e.target.value = '';
            }}
          />
          {dpi != null && dpi < 150 ? <span className="warn-inline">Low resolution for print ({dpi} dpi). A larger photo will look sharper.</span> : null}
        </div>
      </div>
      {choices && choices.length > 1 ? (
        <>
          <span className="choices-lbl">Or pick a photo</span>
          <div className="choices">
            {choices.map((c, i) => (
              <div key={i} className={'choice' + (c.src === selected ? ' on' : '')}>
                <button type="button" onClick={() => onChoose(c)} title={c.kind === 'library' ? 'One of your uploads' : c.kind === 'stock' ? 'Original flyer photo' : `Listing photo ${i + 1}`}>
                  <img src={c.thumb} alt="" loading="lazy" />
                </button>
                {c.kind === 'library' && onForget ? (
                  <button type="button" className="forget" title="Remove from my photos" onClick={() => onForget(c)}>×</button>
                ) : null}
                {c.kind === 'stock' ? <span className="tag">Original</span> : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
      {preview ? (
        <div className="sliders">
          <label>Zoom<input type="range" min="1" max="3" step="0.01" value={crop.zoom || 1} onChange={(e) => set('zoom', Number(e.target.value))} /></label>
          <label>Left / right<input type="range" min="-1" max="1" step="0.01" value={crop.x || 0} onChange={(e) => set('x', Number(e.target.value))} /></label>
          <label>Up / down<input type="range" min="-1" max="1" step="0.01" value={crop.y || 0} onChange={(e) => set('y', Number(e.target.value))} /></label>
        </div>
      ) : null}
    </div>
  );
}

// APR inputs for the comparison flyer, one per visible column
export function AprFields({ data, onChange, columns }) {
  return (
    <div className="field">
      <Label required help="From the loan system for each scenario">APR by column</Label>
      <div className="grid2">
        {columns.map((c) => (
          <label key={c.key} className="mini">
            <span>{c.label}</span>
            <NumberInput suffix="%" value={data.aprs?.[c.key] ?? ''} onChange={(v) => onChange({ ...data.aprs, [c.key]: v })} />
          </label>
        ))}
      </div>
    </div>
  );
}

const PROGRAMS = [
  { value: 'fixed', label: 'Fixed rate' },
  { value: 'arm', label: 'ARM' },
  { value: 'va', label: 'VA' },
];

export function LoanColumns({ value = [], onChange, newColumn }) {
  const [open, setOpen] = useState(0);
  const upd = (i, k, v) => onChange(value.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  return (
    <div className="loancols">
      {value.map((c, i) => (
        <div key={i} className={'loancol' + (open === i ? ' open' : '')}>
          <button type="button" className="loancol-head" onClick={() => setOpen(open === i ? -1 : i)}>
            <b>{i + 1}. {c.title || 'Untitled'}</b>
            <span>{c.programLabel}, {num(c.downPct)}% down · {c.rate === '' ? '—' : num(c.rate) + '%'}</span>
          </button>
          {open === i ? (
            <div className="loancol-body">
              <div className="grid2">
                <label className="mini"><span>Title</span><input value={c.title} onChange={(e) => upd(i, 'title', e.target.value)} /></label>
                <label className="mini"><span>Program</span>
                  <select value={c.program} onChange={(e) => upd(i, 'program', e.target.value)}>
                    {PROGRAMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </label>
                <label className="mini"><span>Loan type label</span><input value={c.programLabel} onChange={(e) => upd(i, 'programLabel', e.target.value)} placeholder="NonConforming" /></label>
                <label className="mini"><span>Term (months)</span><NumberInput value={c.termMonths} onChange={(v) => upd(i, 'termMonths', v)} /></label>
                <label className="mini"><span>Down payment</span><NumberInput suffix="%" value={c.downPct} onChange={(v) => upd(i, 'downPct', v)} /></label>
                <label className="mini"><span>Rate</span><NumberInput suffix="%" value={c.rate} onChange={(v) => upd(i, 'rate', v)} /></label>
                <label className="mini"><span>APR <em className="req">required</em></span><NumberInput suffix="%" value={c.apr} onChange={(v) => upd(i, 'apr', v)} /></label>
                {c.program !== 'va' ? (
                  <label className="mini"><span>Discount points</span><NumberInput value={c.points} onChange={(v) => upd(i, 'points', v)} /></label>
                ) : (
                  <label className="mini"><span>VA funding fee financed</span><NumberInput suffix="%" value={c.vaFeePct} onChange={(v) => upd(i, 'vaFeePct', v)} /></label>
                )}
                {c.program === 'arm' ? (
                  <>
                    <label className="mini"><span>Fixed period (years)</span><NumberInput value={c.fixedYears} onChange={(v) => upd(i, 'fixedYears', v)} /></label>
                    <label className="mini"><span>Margin</span><NumberInput suffix="%" value={c.margin} onChange={(v) => upd(i, 'margin', v)} /></label>
                    <label className="mini"><span>SOFR index</span><input value={c.index} onChange={(e) => upd(i, 'index', e.target.value)} /></label>
                    <label className="mini"><span>First / annual / lifetime caps</span>
                      <span className="caps">
                        <NumberInput value={c.capFirst} onChange={(v) => upd(i, 'capFirst', v)} />
                        <NumberInput value={c.capAnnual} onChange={(v) => upd(i, 'capAnnual', v)} />
                        <NumberInput value={c.capLife} onChange={(v) => upd(i, 'capLife', v)} />
                      </span>
                    </label>
                  </>
                ) : null}
              </div>
              <div className="row-actions">
                {i > 0 ? <button type="button" className="btn small ghost" onClick={() => { const v = [...value]; [v[i - 1], v[i]] = [v[i], v[i - 1]]; onChange(v); setOpen(i - 1); }}>Move left</button> : null}
                {value.length > 1 ? <button type="button" className="btn small ghost danger" onClick={() => { onChange(value.filter((_, j) => j !== i)); setOpen(-1); }}>Remove</button> : null}
              </div>
              {c.program === 'va' ? <p className="note">The approved footnote says the sample payment does not include the VA funding fee. Set the financed fee to 0 to match that wording.</p> : null}
            </div>
          ) : null}
        </div>
      ))}
      {value.length < 4 ? (
        <button type="button" className="btn small" onClick={() => { onChange([...value, newColumn()]); setOpen(value.length); }}>Add a loan program</button>
      ) : null}
    </div>
  );
}

export const buydownOptions = Object.keys(BUYDOWNS);
