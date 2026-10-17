import React, { createContext, useContext } from 'react';
import { Page, View, Text, Image, Svg, Path, Rect, Font, StyleSheet, Link } from '@react-pdf/renderer';

// ---------- editable text ----------
// Every piece of flyer text goes through <T id>. The app can override any of it (emergency edits),
// and in edit mode each one is wrapped in a link so the preview can make it clickable.
export const EditCtx = createContext({ overrides: {}, edit: false, registry: null });
export const EDIT_PREFIX = 'https://edit.pbflyers/';

// Text measuring is provided by the browser app (canvas). Without it, text keeps its design size.
let measurer = null;
export const setMeasurer = (fn) => (measurer = fn);

function countLines(text, font, size, width, letterSpacing = 0) {
  let lines = 0;
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines += 1; continue; }
    let cur = '';
    lines += 1;
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      const wpx = measurer(t, font, size) + letterSpacing * t.length;
      if (wpx > width && cur) { lines += 1; cur = w; } else cur = t;
    }
  }
  return lines;
}

const fontOf = (st) => ({ family: st.fontFamily || 'CompassSans', weight: st.fontWeight || 400 });

// Largest size (down to 45% of design) at which the text fits the box
export function fitSize(texts, st, { w, lines, h }) {
  const size = st.fontSize || 10;
  if (!measurer || !w) return size;
  const font = fontOf(st);
  const lh = st.lineHeight || 1.2;
  const list = Array.isArray(texts) ? texts : [texts];
  const fits = (sz) => {
    let total = 0;
    for (const t of list) {
      const n = countLines(t, font, sz, w * 0.985, st.letterSpacing || 0);
      if (lines && n > lines) return false;
      total += n;
    }
    return !h || total * sz * lh <= h;
  };
  if (fits(size)) return size;
  let lo = size * 0.45, hi = size;
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
  return Math.floor(lo * 20) / 20;
}

const flat = (children) =>
  React.Children.toArray(children).filter((c) => typeof c === 'string' || typeof c === 'number').join('');

export function useText(id, def) {
  const { overrides } = useContext(EditCtx);
  return overrides && overrides[id] != null ? overrides[id] : def;
}

// Words wrapped in <b>…</b> print bold (strong sets the bold style)
function renderRich(text, strong) {
  if (!text || text.indexOf('<b>') < 0) return text;
  return text.split(/<b>|<\/b>/).map((seg, i) => (i % 2 ? <Text key={i} style={strong}>{seg}</Text> : seg));
}
const DEFAULT_STRONG = { fontFamily: 'CompassSans', fontWeight: 700 };

export function T({ id, style = {}, fit, after, children, label, strong = DEFAULT_STRONG, ...rest }) {
  const { overrides, edit, registry } = useContext(EditCtx);
  const st = Array.isArray(style) ? Object.assign({}, ...style) : style;
  const def = flat(children);
  const text = overrides && overrides[id] != null ? overrides[id] : def;
  if (registry && id) registry[id] = { def, label: label || null, legal: id.startsWith('legal') };
  const finalStyle = fit ? { ...st, fontSize: fitSize(String(text).replace(/<\/?b>/g, ''), st, fit) } : st;
  const body = renderRich(text, strong);
  if (edit && id) {
    return (
      <Text style={finalStyle} {...rest}>
        <Link src={EDIT_PREFIX + encodeURIComponent(id)} style={{ color: finalStyle.color || '#000', textDecoration: 'none' }}>
          {text ? body : ' '}
        </Link>
        {after}
      </Text>
    );
  }
  return (
    <Text style={finalStyle} {...rest}>
      {body}
      {after}
    </Text>
  );
}

// Bulleted list; each item is editable on its own
export function Bullets({ id, items, style, bullet = '•', gap = 4, indent = 11, bulletStyle, fit, strong }) {
  return (
    <View>
      {items.map((it, i) => {
        const sub = typeof it === 'object' && it.sub;
        const text = typeof it === 'object' ? it.text : it;
        return (
          <View key={i} style={{ flexDirection: 'row', marginBottom: i < items.length - 1 ? gap : 0, paddingLeft: sub ? indent + 2 : 0 }}>
            <Text style={{ ...style, width: indent, ...bulletStyle }}>{bullet}</Text>
            <View style={{ flex: 1 }}>
              <T id={`${id}.${i}`} style={style} fit={fit} strong={strong}>{text}</T>
            </View>
          </View>
        );
      })}
    </View>
  );
}


// ---------- page geometry ----------
export const TRIM_W = 612; // 8.5in
export const TRIM_H = 792; // 11in
export const BLEED = 9; // 0.125in
export const M = 36; // 0.5in margin
export const CONTENT_W = TRIM_W - M * 2;

// ---------- brand colors (sampled from the approved flyers) ----------
export const C = {
  green: '#3B5953',
  ink: '#101010',
  text: '#3B3B3B',
  tableInk: '#24272A',
  tableGray: '#5C5F63',
  rule: '#C9CBCE',
  headGray: '#F2F3F4',
  rowGray: '#EEF1F2',
  yellow: '#F7E14A',
  border: '#D8DCDD',
  muted: '#808080',
  legal: '#24272A',
  skyBlue: '#E7F0F9',
  colTint: '#EEF4FA',
};

// ---------- fonts ----------
let fontsRegistered = false;
export function registerFonts(base) {
  if (fontsRegistered) return;
  fontsRegistered = true;
  Font.register({
    family: 'CompassSans',
    fonts: [
      { src: base + 'CompassSans-Light.ttf', fontWeight: 300 },
      { src: base + 'CompassSans-Regular.ttf', fontWeight: 400 },
      { src: base + 'CompassSans-Italic.ttf', fontWeight: 400, fontStyle: 'italic' },
      { src: base + 'CompassSans-Medium.ttf', fontWeight: 500 },
      { src: base + 'CompassSans-Bold.ttf', fontWeight: 700 },
    ],
  });
  // Compass Sans with tabular (equal-width) digits so numbers line up in tables
  Font.register({
    family: 'CompassTab',
    fonts: [
      { src: base + 'CompassSansTab-Regular.ttf', fontWeight: 400 },
      { src: base + 'CompassSansTab-Medium.ttf', fontWeight: 500 },
      { src: base + 'CompassSansTab-Bold.ttf', fontWeight: 700 },
    ],
  });
  Font.register({
    family: 'Domaine',
    fonts: [
      { src: base + 'DomaineDisplay-Regular.ttf', fontWeight: 400 },
      { src: base + 'DomaineDisplay-Italic.ttf', fontWeight: 400, fontStyle: 'italic' },
    ],
  });
  // Never split words with hyphens in legal or headline copy
  Font.registerHyphenationCallback((word) => [word]);
}

export const S = StyleSheet.create({
  sans: { fontFamily: 'CompassSans', fontWeight: 400 },
  bold: { fontFamily: 'CompassSans', fontWeight: 700 },
  medium: { fontFamily: 'CompassSans', fontWeight: 500 },
  serif: { fontFamily: 'Domaine', fontWeight: 400 },
  tab: { fontFamily: 'CompassTab', fontWeight: 400 },
  tabBold: { fontFamily: 'CompassTab', fontWeight: 700 },
});

// Every flyer puts the contact row in the same place, with a hairline above it
export const CONTACT_Y = 646;

// Sheet: a letter page with optional print bleed. Children are laid out in trim coordinates.
export function Sheet({ bleed, children }) {
  const b = bleed ? BLEED : 0;
  return (
    <Page size={[TRIM_W + b * 2, TRIM_H + b * 2]} style={{ backgroundColor: '#FFFFFF', ...S.sans }}>
      <View style={{ position: 'absolute', top: b, left: b, width: TRIM_W, height: TRIM_H }}>{children}</View>
    </Page>
  );
}

// Absolute box helper in trim coordinates
export const Abs = ({ x, y, w, h, style, children, ...rest }) => (
  <View style={{ position: 'absolute', left: x, top: y, width: w, height: h, ...style }} {...rest}>
    {children}
  </View>
);

// Background that runs into the bleed on the given sides
export function BleedRect({ x, y, w, h, color, sides = [] }) {
  const e = BLEED + 2;
  const L = sides.includes('left') ? e : 0;
  const R = sides.includes('right') ? e : 0;
  const T = sides.includes('top') ? e : 0;
  return <Abs x={x - L} y={y - T} w={w + L + R} h={h + T} style={{ backgroundColor: color }} />;
}

// ---------- logos ----------
export function CompassLogo({ width = 95, color = '#FFFFFF' }) {
  const vw = 863.19;
  const vh = 115.75;
  return (
    <Svg viewBox={`0 0 ${vw} ${vh}`} style={{ width, height: (width * vh) / vw }}>
      <Path fill={color} d="M188.12,15.77A42.11,42.11,0,1,1,146,57.88a42.16,42.16,0,0,1,42.11-42.11m0-15.77A57.880,57.880,0,1,0,246,57.88,57.88,57.88,0,0,0,188.12,0Z" />
      <Path fill={color} d="M403,3.42a1.56,1.56,0,0,0-1.32.74L342.05,84.74,282.43,4.16a1.58,1.58,0,0,0-1.330-.74A1.56,1.56,0,0,0,279.52,5V112.34h15.76V48.93l45.85,61.5a1.21,1.21,0,0,0,.92.44h0a1.24,1.24,0,0,0,.93-.44l45.84-61.5v63.41h15.77V5A1.57,1.57,0,0,0,403,3.42Z" />
      <Path fill={color} d="M501,3.42H448.5V112.34h15.77v-39H501a34.94,34.94,0,1,0,0-69.87Zm0,54.11H464.27V19.18H501a19.18,19.18,0,1,1,0,38.35Z" />
      <Path fill={color} d="M91.17,83.61a42.11,42.11,0,1,1,0-51.47L102.49,21a57.880,57.880,0,1,0,0,73.73Z" />
      <Path fill={color} d="M717.14,114.27c-18.24,0-31-10.09-38.45-18.55L689.8,84.87c2.79,3.61,12.14,14,27.34,14,14.2,0,24.12-7.150,24.12-17.38,0-8.76-6-14.64-18.21-18l-13.28-3c-28.42-7-28.42-24-28.42-29.58,0-17.59,14.21-29.41,35.35-29.41,13.88,0,25.7,5.28,36.12,16.15L741.7,28.49c-2.85-3-12.19-11.61-25-11.61-12.45,0-19.59,5.11-19.59,14,0,2.66,1,11.53,14,14.32l12.09,2.72C745.32,53.12,757,64.73,757,81.49,757,100.18,739.88,114.27,717.14,114.27Z" />
      <Path fill={color} d="M823.3,114.27c-18.23,0-31-10.09-38.45-18.55L796,84.87c2.79,3.61,12.14,14,27.33,14,14.21,0,24.13-7.150,24.13-17.38,0-8.76-6-14.64-18.21-18l-13.29-3c-28.42-7-28.42-24-28.42-29.58,0-17.59,14.21-29.410,35.36-29.410,13.88,0,25.69,5.28,36.11,16.15L847.87,28.49c-2.85-3-12.2-11.61-25-11.61-12.45,0-19.59,5.11-19.59,14,0,2.66,1,11.53,14,14.32l12.08,2.72c22.14,5.19,33.85,16.8,33.85,33.56C863.19,100.18,846,114.27,823.3,114.27Z" />
      <Rect fill={color} x="160.85" y="49.99" width="54.53" height="15.77" transform="translate(14.17 149.97) rotate(-45)" />
      <Path fill={color} d="M601.66,3.36a1.59,1.59,0,0,0-2.88,0l-57.48,109h17.83l14.72-27.92h52.74l14.72,27.92h17.84ZM582.17,68.65l18.050-34.24,18.06,34.24Z" />
    </Svg>
  );
}

// OriginPoint logo pngs: op-white 1079x208, op-black same, op-dots 1464x298
export const OP_RATIO = 208 / 1079;
export const OP_DOTS_RATIO = 298 / 1464;
export const OPLogo = ({ assets, variant = 'black', width = 120 }) => {
  const src = variant === 'white' ? assets.opWhite : variant === 'dots' ? assets.opDots : assets.opBlack;
  const r = variant === 'dots' ? OP_DOTS_RATIO : OP_RATIO;
  return <Image src={src} style={{ width, height: width * r }} />;
};

// Green OriginPoint + Compass header bar used on Financing Solutions flyers
// agent.mode: 'compass' (default) | 'other' (non-Compass agent) | 'none' (OriginPoint only)
export const agentMode = (agent) => agent?.mode || 'compass';

export function CobrandBar({ assets, agent }) {
  const showCompass = agentMode(agent) === 'compass';
  const h = 33;
  return (
    <>
      <BleedRect x={0} y={0} w={TRIM_W} h={h} color={C.green} sides={['left', 'right', 'top']} />
      <Abs x={M} y={(h - 101 * OP_RATIO) / 2 + 1} w={101}>
        <OPLogo assets={assets} variant="white" width={101} />
      </Abs>
      {showCompass ? (
        <Abs x={TRIM_W - M - 95} y={(h - 95 * (115.75 / 863.19)) / 2}>
          <CompassLogo width={95} />
        </Abs>
      ) : null}
    </>
  );
}

// ---------- lender (fixed) ----------
export const LENDER = {
  name: 'Pegah Bozorgnia',
  title: 'VP of Mortgage Lending',
  nmls: 'OriginPoint NMLS ID 910362',
  phone: '301.471.8487',
  email: 'pegah@originpoint.com',
};

// Licensing footer: required on every flyer (editable only through emergency edits)
export const LICENSE_TEXT =
  'Pegah Bozorgnia NMLS #910362. DC - MLO910362, FL - LO61164, MD - 910362, PA - 61040, VA - MLO-29343VA | OriginPoint LLC; NMLS #2185899; 1800 W Larchmont Ave Suite 305, Chicago, IL 60613; 773-897-6587. For licensing information, visit nmlsconsumeraccess.org. Equal Housing Lender. Conditions may apply. Operating in the state of California as OriginPoint Mortgage LLC in lieu of the legal name OriginPoint LLC.';

// brand: null | 'compass' (Compass logo at right, Compass-agent flyers only) | 'lockup' (OriginPoint | Compass)
export function LicenseFooter({ assets, y = 736, brand = null, agent }) {
  const compass = agentMode(agent) === 'compass';
  const showLockup = brand === 'lockup';
  const showCompass = brand === 'compass' && compass;
  const textW = showLockup ? CONTENT_W - (compass ? 190 : 104) : showCompass ? CONTENT_W - 104 : CONTENT_W;
  return (
    <>
      <Abs x={M} y={y} w={textW}>
        <Image src={assets.ehl} style={{ width: 40, height: 40 * (421 / 2000), marginBottom: 3 }} />
        <T id="legal.license" label="Licensing line" style={{ fontSize: 6, lineHeight: 1.2, color: '#000' }} fit={{ w: textW, h: 30 }}>{LICENSE_TEXT}</T>
      </Abs>
      {showCompass ? (
        <Abs x={TRIM_W - M - 86} y={y + 14} w={86}>
          <CompassLogo width={86} color="#000000" />
        </Abs>
      ) : null}
      {showLockup ? (
        <Abs x={TRIM_W - M - (compass ? 176 : 90)} y={y + 9} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <OPLogo assets={assets} variant="black" width={90} />
          {compass ? (
            <>
              <View style={{ width: 0.8, height: 22, backgroundColor: '#000', marginHorizontal: 10 }} />
              <CompassLogo width={66} color="#000000" />
            </>
          ) : null}
        </Abs>
      ) : null}
    </>
  );
}

// ---------- contact blocks ----------
const PHOTO = 75;
function Person({ photo, lines, prefix }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', width: CONTENT_W / 2 }}>
      {photo ? (
        <Image src={photo} style={{ width: PHOTO, height: PHOTO }} />
      ) : (
        <View style={{ width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2, backgroundColor: '#E4E7EA' }} />
      )}
      <View style={{ marginLeft: 12, flex: 1 }}>
        {lines.map((l, i) =>
          l ? (
            <T key={i} id={`${prefix}.${i}`} style={{ fontSize: 12, lineHeight: 1.19, color: '#000', ...(i === 0 ? S.bold : S.sans) }} fit={{ w: CONTENT_W / 2 - PHOTO - 18, lines: 1 }}>
              {l}
            </T>
          ) : null
        )}
      </View>
    </View>
  );
}

export function ContactRow({ assets, agent, y = CONTACT_Y }) {
  const a = agent || {};
  const solo = agentMode(a) === 'none';
  const agentLines = [
    a.name || 'Agent Name',
    a.title,
    agentMode(a) === 'compass' ? a.brokerage || 'Compass Real Estate' : a.brokerage,
    a.phone ? `${a.phoneLabel || 'M'}: ${a.phone}` : null,
    a.email,
  ];
  return (
    <>
    <Abs x={M} y={y - 13} w={CONTENT_W} h={0.6} style={{ backgroundColor: C.rule }} />
    <Abs x={M - 3} y={y} w={CONTENT_W + 6} style={{ flexDirection: 'row' }}>
      <Person
        photo={assets.pegahCircle}
        prefix="lender"
        lines={[LENDER.name, LENDER.title, LENDER.nmls, `M: ${LENDER.phone}`, LENDER.email]}
      />
      {solo ? null : (
        <Person photo={a.photoCircle} lines={agentLines} prefix="agent" />
      )}
    </Abs>
    </>
  );
}

// Legal paragraph block. Every paragraph is editable; the whole block shrinks together to fit maxH.
export function Legal({ id = 'legal.body', paragraphs, size = 6, color = C.legal, style, width = CONTENT_W, maxH }) {
  const { overrides } = useContext(EditCtx);
  const texts = paragraphs.map((p, i) => (overrides && overrides[`${id}.${i}`] != null ? overrides[`${id}.${i}`] : p));
  const base = { fontSize: size, lineHeight: 1.18, color };
  const sz = maxH ? fitSize(texts, base, { w: width, h: maxH }) : size;
  return (
    <View style={style}>
      {paragraphs.map((p, i) => (
        <T key={i} id={`${id}.${i}`} label="Disclosure" style={{ ...base, fontSize: sz }}>
          {p}
        </T>
      ))}
    </View>
  );
}

// Image that has already been cropped to the exact box aspect by the app
export const Photo = ({ src, x, y, w, h, radius = 0 }) =>
  src ? (
    <Abs x={x} y={y} w={w} h={h} style={{ borderRadius: radius, overflow: 'hidden' }}>
      <Image src={src} style={{ width: w, height: h, objectFit: 'cover' }} />
    </Abs>
  ) : (
    <Abs x={x} y={y} w={w} h={h} style={{ backgroundColor: '#E4E7EA', borderRadius: radius, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 10, color: '#8A9096' }}>Add a photo</Text>
    </Abs>
  );
