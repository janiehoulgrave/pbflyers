import React from 'react';
import { Document, View, Text, Svg, Path, Line, Circle } from '@react-pdf/renderer';
import { Sheet, Abs, OPLogo, ContactRow, LicenseFooter, Legal, T, C, S, M, TRIM_W, CONTENT_W } from '../common.jsx';
import { pmt, round2 } from '../../lib/calc.js';
import { money0, longDate, num } from '../../lib/format.js';

const UP = '#1E8A5A';
const DOWN = '#C2353F';
const TINT = '#EEF3F1';
const YELLOW = '#F7E14A';
const LINE = '#3B5953';
const AREA = '#E2ECE8';
const MED = { fontFamily: 'CompassSans', fontWeight: 500 };

const SCENARIOS = [
  { key: 'now', label: 'Today', short: 'Now', months: 0 },
  { key: 'm6', label: 'Waiting 6 months', short: '6m', months: 6 },
  { key: 'y1', label: 'Waiting 1 year', short: '1y', months: 12 },
  { key: 'y2', label: 'Waiting 2 years', short: '2y', months: 24 },
];

const pctLabel = (v) => {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return `${s}%`;
};
const rateLabel = (v) => `${String(Math.round(num(v) * 1000) / 1000)}%`;
const aprLabel = (v) => (v === '' || v == null ? '' : `${(Math.round(num(v) * 1000) / 1000).toFixed(3)}%`);
const signed = (v) => (v < 0 ? `-${money0(-v)}` : money0(v));

// Same math as the original flyer: appreciation compounds once per full year; payment is P&I plus
// property tax (yearly % of value) and a flat monthly amount for insurance and other costs.
export function computeWaiting(d) {
  const price = num(d.price);
  const down = num(d.downPct) / 100;
  const closing = num(d.closingCost);
  const cols = SCENARIOS.map((s, i) => {
    const years = Math.floor(s.months / 12);
    const value = price * Math.pow(1 + num(d.apprPct) / 100, years);
    const loan = value * (1 - down);
    const rate = num(d[`rate${i}`]);
    const piRaw = pmt(loan, rate, 360);
    const monthly = piRaw + (value * num(d.taxPct)) / 100 / 12 + num(d.otherMonthly);
    return {
      ...s,
      value,
      apprPct: (value / price - 1) * 100,
      loan,
      down: value - loan,
      rate,
      apr: d[`apr${i}`],
      annualPI: Math.round(piRaw * 12),
      monthlyPI: Math.round(piRaw),
      monthly: Math.round(monthly),
      annual: Math.round(monthly * 12),
      closing,
      cash: value - loan + closing,
    };
  });
  const first = cols[0];
  const last = cols[cols.length - 1];
  const gain = last.value - first.value;
  const monthlyDiff = first.monthly - last.monthly;
  const cumulative = monthlyDiff * last.months;
  const refi = num(d.refiCost);
  return { cols, gain, gainPct: last.apprPct, monthlyDiff, cumulative, refi, benefit: gain - cumulative - refi };
}

export const PAGE1_LEGAL = (date) => [
  `Current as of ${longDate(date)}.`,
  'All information provided in this publication is for informational and educational purposes only, and in no way is any of the content contained herein to be construed as financial, investment, or legal advice or instruction. OriginPoint does not guarantee the quality, accuracy, completeness or timelines of the information in this publication. While efforts are made to verify the information provided, the information should not be assumed to be error free. Some information in the publication may have been provided by third parties and has not necessarily been verified by OriginPoint. OriginPoint its affiliates and subsidiaries do not assume any liability for the information contained herein, be it direct, indirect, consequential, special, or exemplary, or other damages whatsoever and howsoever caused, arising out of or in connection with the use of this publication or in reliance on the information, including any personal or pecuniary loss, whether the action is in contract, tort (including negligence) or other tortious action. OriginPoint LLC; NMLS #2185899; 1800 W Larchmont Ave Suite 305, Chicago, IL 60613; 773-897-6587. For licensing information visit nmlsconsumeraccess.org. Equal Housing Lender. Conditions may apply. • CA: Licensed by the Department of Financial Protection and Innovation under the California Residential Mortgage Lending Act • CO: Regulated by the Division of Real Estate • GA: Residential Mortgage Licensee #2185899 • NH: Licensed by the New Hampshire Banking Department, Lic #24533-MB • NJ: Licensed by the N.J. Department of Banking and Insurance • PA: Licensed by the Pennsylvania Department of Banking and Securities • WA: Consumer Loan Company License CL-366423.',
  'This document should not be construed as investment or mortgage advice or a commitment to lend. Your results may vary. There are no guarantees, promises, representations and/or assurances concerning the level of accuracy you may experience. For actual and current terms and rate information, please contact your lender directly. Monthly expenses may or may not include condominium or HOA fees, if applicable; your payment may be greater. Sources: MBS Highway, FRED, US Census, BLS, JBRC, NAR. MLS Data provided by Listing Booster.',
];

export const PAGE2_LEGAL = (r, d) => [
  `Loan and monthly payment buying scenarios used for informational purposes only and may not be specific to your situation. Rates expressed may not be available at this time. This document should not be construed as investment or mortgage advice or a commitment to lend. Your results may vary. There are no guarantees, promises, representations and/or assurances concerning the level of accuracy you may experience. For actual and current terms and rate information, please contact your lender directly. *APR of ${aprLabel(r.cols[0].apr)} assumes a ${rateLabel(r.cols[0].rate)} simple fixed interest rate assuming ${money0(num(d.closingCost))} in fees included in APR. Monthly principal and interest payment based on a fully amortizing fixed interest loan of ${money0(r.cols[0].loan)} with 360 monthly payments at the assumed simple interest rate (Current as of ${longDate(d.date)}). Monthly expenses may or may not include condominium or HOA fees, if applicable; your payment may be greater.`,
];

const R = (n) => (i) => `${n}${i}`;

export const costOfWaiting = {
  meta: {
    id: 'cost-of-waiting',
    name: 'Cost of Waiting',
    category: 'Calculators',
    description: 'Two-page comparison of buying now vs waiting 2 years: appreciation, payment difference and loan details, calculated for you.',
    tags: ['cost of waiting', 'buy now', 'wait', 'appreciation', 'rates', 'refinance', 'calculator', 'consumer', 'two page'],
    needsAgent: true,
    defaultAgentMode: 'compass',
    pages: 2,
  },
  defaults: {
    price: 1500000,
    downPct: 20,
    closingCost: 45000,
    refiCost: 8000,
    apprPct: 2,
    rate0: '', rate1: '', rate2: '', rate3: '',
    apr0: '', apr1: '', apr2: '', apr3: '',
    taxPct: 0.95061,
    otherMonthly: 251,
    date: '',
  },
  fields: [
    {
      section: 'Home and loan',
      items: [
        { key: 'price', label: 'Home price today', type: 'money' },
        { key: 'downPct', label: 'Down payment', type: 'percent' },
        { key: 'closingCost', label: 'Closing costs', type: 'money' },
        { key: 'refiCost', label: 'Cost to refinance later', type: 'money', help: 'Subtracted from the benefit of buying now' },
        { key: 'apprPct', label: 'Home price growth per year', type: 'percent', step: 0.01 },
        { key: 'date', label: 'Rates current as of', type: 'date', required: true },
      ],
    },
    {
      section: 'Rates',
      note: 'Interest rate and APR for each timeline. Today’s rate is what the buyer gets now; the others are the expected rates if they wait.',
      items: SCENARIOS.flatMap((s, i) => [
        { key: `rate${i}`, label: `${s.label}: interest rate`, type: 'percent', step: 0.001, required: true },
        { key: `apr${i}`, label: `${s.label}: APR`, type: 'percent', step: 0.001, required: true },
      ]),
    },
    {
      section: 'Monthly cost assumptions',
      collapsed: true,
      note: 'These reproduce the current approved flyer exactly. Total monthly expenses = principal & interest + property tax + the flat monthly amount.',
      items: [
        { key: 'taxPct', label: 'Property tax (yearly % of value)', type: 'percent', step: 0.00001 },
        { key: 'otherMonthly', label: 'Insurance and other costs (monthly)', type: 'money' },
      ],
    },
  ],
  compute: computeWaiting,
  Doc: function CostOfWaitingDoc({ data, agent, assets, bleed }) {
    const d = { ...costOfWaiting.defaults, ...data };
    const r = computeWaiting(d);
    const yrs = r.cols[r.cols.length - 1].months / 12;
    return (
      <Document title="Cost of Waiting" author="OriginPoint" creator="pbflyers.janienation.com">
        <Sheet bleed={bleed}>
          <Abs x={M} y={32} w={150}>
            <OPLogo assets={assets} variant="black" width={120} />
          </Abs>
          <Abs x={M} y={66} w={CONTENT_W}>
            <T id="title" style={{ ...S.serif, fontSize: 30, color: C.ink }} fit={{ w: CONTENT_W, lines: 1 }}>{`Buying Now vs Waiting ${yrs} Years`}</T>
          </Abs>
          <Summary r={r} />
          <Abs x={M} y={262} w={CONTENT_W} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <ChartCard
              id="apprChart"
              title="Appreciation Gain"
              lines={[
                [`Property value in ${yrs} years: `, money0(r.cols[r.cols.length - 1].value), C.ink],
                ['Based on ', `+${pctLabel(r.gainPct)}`, UP, ' cumulative appreciation'],
              ]}
              values={r.cols.map((c) => c.value)}
              labels={r.cols.map((c) => c.short)}
              startLabel={money0(r.cols[0].value)}
              endLabel={money0(r.cols[r.cols.length - 1].value)}
              endSub={`+${money0(r.gain)}`}
              endSubColor={UP}
            />
            <ChartCard
              id="payChart"
              title="Payment Difference"
              lines={[
                ['Monthly: ', signed(-r.monthlyDiff), DOWN],
                [`Cumulative (${yrs} years): `, signed(-r.cumulative), DOWN],
              ]}
              values={r.cols.map((c) => c.monthly)}
              labels={r.cols.map((c) => c.short)}
              startLabel={money0(r.cols[0].monthly)}
              endLabel={money0(r.cols[r.cols.length - 1].monthly)}
              endSub={signed(-r.monthlyDiff)}
              endSubColor={DOWN}
            />
          </Abs>
          <Abs x={M} y={526} w={CONTENT_W}>
            <Legal id="legal.p1" paragraphs={PAGE1_LEGAL(d.date)} size={4.6} maxH={88} />
          </Abs>
          <ContactRow assets={assets} agent={agent} />
          <LicenseFooter assets={assets} agent={agent} brand="compass" />
        </Sheet>
        <Sheet bleed={bleed}>
          <Abs x={M} y={32} w={150}>
            <OPLogo assets={assets} variant="black" width={120} />
          </Abs>
          <Abs x={M} y={64} w={CONTENT_W}>
            <T id="p2.title" style={{ ...S.serif, fontSize: 30, color: C.ink }} fit={{ w: CONTENT_W, lines: 1 }}>Property & Loan Details</T>
            <T id="p2.sub" style={{ ...S.sans, fontSize: 10.5, color: '#3A3F43', marginTop: 4 }} fit={{ w: CONTENT_W, lines: 1 }}>See how waiting to buy affects a property's value and the loan for it.</T>
          </Abs>
          <DetailsTable r={r} />
          <Abs x={M} y={580} w={CONTENT_W}>
            <Legal id="legal.p2" paragraphs={PAGE2_LEGAL(r, d)} size={5.5} maxH={40} />
          </Abs>
          <ContactRow assets={assets} agent={agent} />
          <LicenseFooter assets={assets} agent={agent} brand="compass" />
        </Sheet>
      </Document>
    );
  },
};

function Summary({ r }) {
  const row = (id, label, value, color, last) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: last ? 0 : 0.75, borderBottomColor: '#D5DCDA' }}>
      <T id={`${id}.label`} style={{ ...MED, fontSize: 11.5, lineHeight: 1.3, color: C.ink, width: 250 }} fit={{ w: 250, lines: 2 }}>{label}</T>
      <T id={`${id}.value`} style={{ ...S.tabBold, fontSize: 12, color }}>{value}</T>
    </View>
  );
  return (
    <Abs x={M} y={116} w={CONTENT_W} style={{ flexDirection: 'row', borderWidth: 0.75, borderColor: '#D5DCDA', borderRadius: 4 }}>
      <View style={{ width: 180, backgroundColor: TINT, justifyContent: 'center', alignItems: 'center', paddingVertical: 18 }}>
        <T id="benefit.label" style={{ ...MED, fontSize: 12, color: C.ink }}>Benefit of Buying Now</T>
        <T id="benefit.value" style={{ ...S.serif, fontSize: 36, color: r.benefit >= 0 ? UP : DOWN, marginTop: 6 }} fit={{ w: 160, lines: 1 }}>{signed(r.benefit)}</T>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 18, paddingVertical: 4 }}>
        {row('sum.gain', `Appreciation Gain (+${pctLabel(r.gainPct)})`, money0(r.gain), UP)}
        {row('sum.pay', 'Cumulative monthly payment difference for buying now vs waiting', signed(-r.cumulative), DOWN)}
        {row('sum.refi', 'Cost of Refinance', signed(-r.refi), DOWN, true)}
      </View>
    </Abs>
  );
}

const CARD_W = (CONTENT_W - 16) / 2;
const CH = { w: CARD_W - 36, h: 132, top: 34, bottom: 18 };

function ChartCard({ id, title, lines, values, labels, startLabel, endLabel, endSub, endSubColor, endTag }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || max * 0.01) * 0.25;
  const lo = min - pad;
  const hi = max + pad;
  const W = CH.w;
  const H = CH.h;
  const plotH = H - CH.top - CH.bottom;
  const xs = values.map((_, i) => 8 + (i * (W - 16)) / (values.length - 1));
  const ys = values.map((v) => CH.top + plotH - ((v - lo) / (hi - lo)) * plotH);
  const line = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${ys[i].toFixed(2)}`).join(' ');
  const base = CH.top + plotH;
  const area = `${line} L${xs[xs.length - 1].toFixed(2)},${base} L${xs[0].toFixed(2)},${base} Z`;
  const last = xs.length - 1;
  const tag = (x, y, text, sub, subColor, align) => (
    <View style={{ position: 'absolute', left: align === 'right' ? x - 80 : x - 6, top: y - (sub ? 34 : 22), width: 86, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      <Text style={{ ...S.tabBold, fontSize: 8, color: C.ink, backgroundColor: '#FFFFFF', paddingHorizontal: 3, paddingVertical: 1.5, borderWidth: 0.6, borderColor: '#C9D2D0', borderRadius: 2 }}>{text}</Text>
      {sub ? <Text style={{ ...S.tabBold, fontSize: 8, color: subColor, marginTop: 2, paddingHorizontal: 3 }}>{sub}</Text> : null}
    </View>
  );
  return (
    <View style={{ width: CARD_W, borderWidth: 0.75, borderColor: '#D5DCDA', borderRadius: 4, padding: 18, paddingBottom: 12 }}>
      <T id={`${id}.title`} style={{ ...MED, fontSize: 13, color: C.ink, marginBottom: 6 }}>{title}</T>
      {lines.map(([a, b, color, c], i) => (
        <Text key={i} style={{ ...S.sans, fontSize: 9, lineHeight: 1.5, color: C.ink }}>
          {a}
          <Text style={{ ...S.tabBold, color }}>{b}</Text>
          {c || ''}
        </Text>
      ))}
      <View style={{ width: W, height: H, marginTop: 6, position: 'relative' }}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <Line x1={0} y1={base} x2={W} y2={base} stroke="#D5DCDA" strokeWidth={0.75} />
          <Path d={area} fill={AREA} />
          <Path d={line} stroke={LINE} strokeWidth={1.6} fill="none" />
          <Circle cx={xs[0]} cy={ys[0]} r={3.2} fill={LINE} />
          <Circle cx={xs[last]} cy={ys[last]} r={3.2} fill={C.ink} />
        </Svg>
        {tag(xs[0], ys[0], startLabel, null, null, 'left')}
        {tag(xs[last], ys[last], endLabel, endSub, endSubColor, 'right')}
        {endTag ? (
          <View style={{ position: 'absolute', left: xs[last] - 40, top: ys[last] + 8, width: 36, alignItems: 'flex-end' }}>
            <Text style={{ ...S.tabBold, fontSize: 7.5, color: UP }}>{endTag}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 0, marginTop: 3 }}>
        {labels.map((l, i) => (
          <Text key={i} style={{ ...S.sans, fontSize: 8, color: '#5C5F63', width: 24, textAlign: i === 0 ? 'left' : i === labels.length - 1 ? 'right' : 'center' }}>{l}</Text>
        ))}
      </View>
      <Text style={{ ...MED, fontSize: 8, color: '#5C5F63', textAlign: 'center', marginTop: 3 }}>Waiting Period</Text>
    </View>
  );
}

function DetailsTable({ r }) {
  const LABEL_W = 132;
  const colW = (CONTENT_W - LABEL_W) / r.cols.length;
  const rows = [
    ['Property Value', (c, i) => [money0(c.value), i > 1 ? { text: `+${pctLabel(c.apprPct)}`, color: UP } : null]],
    ['Loan Amount', (c) => [money0(c.loan)]],
    ['Term', () => ['30 Years']],
    ['Down Payment', (c) => [money0(c.down)]],
    ['Total Addl. Financing', () => ['$0']],
    ['Rate', (c) => [rateLabel(c.rate)], true],
    ['APR', (c) => [aprLabel(c.apr)]],
    ['Points', () => ['0']],
    ['Fixed/ARM', () => ['Conv. Fixed']],
    ['Mortgage Insurance', () => ['$0']],
    ['Annual Prin & Interest (Year 1)', (c) => [money0(c.annualPI)]],
    ['Monthly Prin & Interest (Year 1)', (c) => [money0(c.monthlyPI)], true],
    ['Total Monthly Expenses', (c) => [money0(c.monthly)]],
    ['Total Annual Expenses', (c) => [money0(c.annual)]],
    ['Prepaids & Escrows', () => ['$0']],
    ['Closing Cost', (c) => [money0(c.closing)]],
    ['Total Cash to Close', (c) => [money0(c.cash)], true, true],
  ];
  return (
    <Abs x={M} y={128} w={CONTENT_W} style={{ borderWidth: 0.75, borderColor: '#D5DCDA', borderRadius: 4 }}>
      <View style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 0.75, borderBottomColor: '#D5DCDA', backgroundColor: TINT }}>
        <View style={{ width: LABEL_W }} />
        {r.cols.map((c, i) => (
          <T key={i} id={`p2.head${i}`} style={{ ...S.bold, fontSize: 9, color: C.ink, width: colW, paddingLeft: 8 }}>{c.label === 'Today' ? 'Today' : c.label}</T>
        ))}
      </View>
      {rows.map(([label, fn, hi, bold], k) => (
        <View key={k} style={{ flexDirection: 'row', minHeight: 24.5, borderBottomWidth: k < rows.length - 1 ? 0.5 : 0, borderBottomColor: '#E1E6E4' }}>
          <View style={{ width: LABEL_W, justifyContent: 'center', paddingLeft: 10, paddingRight: 6 }}>
            <T id={`p2.r${k}.label`} style={{ ...(bold ? S.bold : MED), fontSize: 8.6, lineHeight: 1.25, color: C.ink }}>{label}</T>
          </View>
          {r.cols.map((c, i) => {
            const [main, extra] = fn(c, i);
            return (
              <View key={i} style={{ width: colW, justifyContent: 'center', paddingLeft: 8, backgroundColor: hi ? YELLOW : undefined }}>
                <T id={`p2.r${k}.c${i}`} style={{ ...(bold || hi ? S.tabBold : S.tab), fontSize: 9, color: C.ink }}>{main}</T>
                {extra ? <Text style={{ ...S.tabBold, fontSize: 8, color: extra.color, marginTop: 1 }}>{extra.text}</Text> : null}
              </View>
            );
          })}
        </View>
      ))}
    </Abs>
  );
}
