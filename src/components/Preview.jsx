import React, { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Draws page 1 of the generated PDF, so the preview is exactly what downloads.
// Renders one at a time: a new render waits for the previous one to finish and clean up,
// so two documents never draw at once (overlapping renders garbled the text before).
let chain = Promise.resolve();

export default function Preview({ blob, busy, error, editable, onPick, editedIds = [], activeId, children }) {
  const wrapRef = useRef();
  const canvasRef = useRef();
  const [width, setWidth] = useState(600);
  const [hits, setHits] = useState([]);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!blob) return;
    let cancelled = false;
    const job = async () => {
      if (cancelled) return;
      const data = new Uint8Array(await blob.arrayBuffer());
      // disableFontFace draws glyphs directly, so fonts from one render can't leak into the next
      const loading = pdfjs.getDocument({ data, disableFontFace: true, isEvalSupported: false });
      const doc = await loading.promise;
      try {
        if (cancelled) return;
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const cssW = Math.min(width, 900);
        const scale = cssW / base.width;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const vp = page.getViewport({ scale: scale * dpr });
        const off = document.createElement('canvas');
        off.width = vp.width;
        off.height = vp.height;
        await page.render({ canvasContext: off.getContext('2d'), viewport: vp }).promise;
        let list = [];
        if (editable) {
          // each editable text was wrapped in a link; merge each one's pieces into a single box
          const css = page.getViewport({ scale });
          const byId = new Map();
          for (const a of await page.getAnnotations()) {
            const url = a.url || a.unsafeUrl || '';
            const at = url.indexOf('edit.pbflyers/');
            if (at < 0) continue;
            const id = decodeURIComponent(url.slice(at + 'edit.pbflyers/'.length));
            const [x1, y1, x2, y2] = css.convertToViewportRectangle(a.rect);
            const r = { l: Math.min(x1, x2), t: Math.min(y1, y2), r: Math.max(x1, x2), b: Math.max(y1, y2) };
            const prev = byId.get(id);
            byId.set(id, prev ? { l: Math.min(prev.l, r.l), t: Math.min(prev.t, r.t), r: Math.max(prev.r, r.r), b: Math.max(prev.b, r.b) } : r);
          }
          list = [...byId].map(([id, r]) => ({ id, left: r.l, top: r.t, w: r.r - r.l, h: r.b - r.t }));
          // smaller boxes on top so a cell inside a bigger block stays clickable
          list.sort((a, b) => b.w * b.h - a.w * a.h);
        }
        if (cancelled) return;
        const c = canvasRef.current;
        c.width = vp.width;
        c.height = vp.height;
        c.style.width = cssW + 'px';
        c.style.height = (cssW * base.height) / base.width + 'px';
        c.getContext('2d').drawImage(off, 0, 0);
        setHits(list);
      } finally {
        await doc.destroy().catch(() => {});
      }
    };
    chain = chain.then(job).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [blob, width, editable]);

  useEffect(() => {
    if (!editable) setHits([]);
  }, [editable]);

  return (
    <div className="preview-wrap" ref={wrapRef}>
      <div className={'paper' + (busy ? ' busy' : '') + (editable ? ' editing' : '')}>
        <canvas ref={canvasRef} />
        {editable
          ? hits.map((h) => (
              <button
                key={h.id}
                type="button"
                className={'edit-hit' + (editedIds.includes(h.id) ? ' edited' : '') + (activeId === h.id ? ' active' : '') + (hover === h.id ? ' hover' : '')}
                style={{ left: h.left - 3, top: h.top - 2, width: h.w + 6, height: h.h + 4 }}
                aria-label="Edit this text"
                onMouseEnter={() => setHover(h.id)}
                onMouseLeave={() => setHover((x) => (x === h.id ? null : x))}
                onClick={() => onPick(h.id, h)}
              />
            ))
          : null}
        {children}
        {!blob && !error ? <div className="paper-loading">Building preview…</div> : null}
      </div>
      {error ? <div className="preview-error">{error}</div> : null}
    </div>
  );
}
