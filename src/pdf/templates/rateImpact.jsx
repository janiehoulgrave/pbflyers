import React from 'react';
import { Document, View, Text } from '@react-pdf/renderer';
import { Sheet, Abs, OPLogo, ContactRow, LicenseFooter, Legal, T, C, S, M, CONTENT_W, TRIM_W } from '../common.jsx';
import { pmt } from '../../lib/calc.js';
import { money0, num } from '../../lib/format.js';

const GREEN_TINT = '#EEF3F1';
const BEIGE = '#F5F2EA';
const MED = { fontFamily: 'CompassSans', fontWeight: 500 };

const pctLabel = (v) => `${Math.round(num(v) * 1000) / 1000}%`;

// Loan amounts from low to high in even steps (max 9 rows so the page never overflows)
export function loanRows(d) {
  const lo = num(d.low);
  const hi = num(d.high);
  const step = num(d.step) || 100000;
  const rows = [];
  if (!lo || !hi || hi < lo) return rows;
  for (let a = lo; a <= hi + 0.5 && rows.length < 9; a += step) rows.push(a);
  return rows;
}

// Payments and differences are rounded independently (as the disclosure says)
export function rateImpact(d) {
  const term = (num(d.termYears) || 30) * 12;
  const rows = loanRows(d).map((amount) => {
    const a = pmt(amount, num(d.rateLow), term);
    const b = pmt(amount, num(d.rateHigh), term);
    return { amount, low: Math.round(a), high: Math.round(b), diff: Math.round(b - a) };
  });
  const focus = rows.find((r) => r.amount === num(d.focus)) || rows[rows.length - 1] || null;
  return { rows, focus };
}

export const LEGAL = [
  'Illustrative calculations only; hypothetical rates are not offers. Payments and differences are independently rounded; displayed subtraction may differ by $1. P&I excludes taxes, insurance, mortgage insurance and HOA dues. Actual total monthly payments will be higher when these costs apply.',
  'Applicant subject to credit and underwriting approval. Not all applicants will be approved for financing. Receipt of application does not represent an approval for financing or interest rate guarantee. Restrictions may apply, contact OriginPoint for current rates and for more information.',
];

export const rateImpactFlyer = {
  meta: {
    id: 'rate-impact',
    name: 'How Much Does 1% Matter?',
    category: 'Agent education',
    description: 'Realtor-facing rate comparison: monthly P&I at two rates across a range of loan amounts, calculated for you.',
    tags: ['rate', 'interest rate', '1%', 'payment impact', 'comparison', 'buydown', 'seller credit', 'realtor', 'agent', 'calculator'],
    needsAgent: true,
    defaultAgentMode: 'compass',
  },
  defaults: {
    rateLow: 6.5,
    rateHigh: 7.5,
    low: 300000,
    high: 1000000,
    step: 100000,
    focus: 1000000,
    termYears: 30,
  },
  fields: [
    {
      section: 'Rates',
      items: [
        { key: 'rateLow', label: 'Lower interest rate', type: 'percent', step: 0.001 },
        { key: 'rateHigh', label: 'Higher interest rate', type: 'percent', step: 0.001 },
        { key: 'termYears', label: 'Term (years, fixed)', type: 'number' },
      ],
    },
    {
      section: 'Loan amounts',
      note: 'Rows run from the lowest to the highest amount in even steps (up to 9 rows).',
      items: [
        { key: 'low', label: 'Lowest loan amount', type: 'money' },
        { key: 'high', label: 'Highest loan amount', type: 'money' },
        { key: 'step', label: 'Step between rows', type: 'money' },
        { key: 'focus', label: 'Loan amount for “The Payment Impact” box', type: 'money', help: 'Also highlighted in the table. Must be one of the rows.' },
      ],
    },
  ],
  compute: rateImpact,
  Doc: function RateImpactDoc({ data, agent, assets, bleed }) {
    const d = { ...rateImpactFlyer.defaults, ...data };
    const { rows, focus } = rateImpact(d);
    const gap = Math.round((num(d.rateHigh) - num(d.rateLow)) * 1000) / 1000;
    const COLS = [170, 120, 120, 130]; // = 540
    const rowH = rows.length > 8 ? 18 : 20;
    const TABLE_Y = 232;
    const tableBottom = TABLE_Y + 21 + 22 + rows.length * rowH;
    const head = { ...S.bold, fontSize: 8.5, letterSpacing: 0.8, color: '#FFFFFF' };
    const cell = { ...S.tab, fontSize: 10.5, color: C.ink };
    return (
      <Document title="How Much Does 1% Matter?" author="OriginPoint" creator="pbflyers.janienation.com">
        <Sheet bleed={bleed}>
          <Abs x={M} y={32} w={150}>
            <OPLogo assets={assets} variant="black" width={130} />
          </Abs>

          <Abs x={M} y={78} w={CONTENT_W}>
            <T id="eyebrow" style={{ ...S.bold, fontSize: 9, letterSpacing: 1.6, color: C.green }}>REALTOR FINANCING INSIGHT</T>
            <T id="headline" style={{ ...S.serif, fontSize: 32, color: C.ink, marginTop: 6 }} fit={{ w: CONTENT_W, lines: 1 }}>{`How much does ${pctLabel(gap)} matter?`}</T>
            <T id="sub" style={{ ...S.sans, fontSize: 11.5, color: '#3A3F43', marginTop: 4 }} fit={{ w: CONTENT_W, lines: 1 }}>
              {`${pctLabel(d.rateLow)} vs. ${pctLabel(d.rateHigh)}  |  The same loan amount. Two different payments.`}
            </T>
          </Abs>

          {/* The payment impact */}
          <Abs x={M} y={155} w={CONTENT_W} style={{ backgroundColor: C.green, borderRadius: 4, paddingVertical: 9, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <T id="impact.label" style={{ ...S.bold, fontSize: 8.5, letterSpacing: 1.4, color: '#CFE0DA' }}>THE PAYMENT IMPACT</T>
              <T id="impact.value" style={{ ...S.serif, fontSize: 26, color: '#FFFFFF', marginTop: 2 }} fit={{ w: 300, lines: 1 }}>
                {focus ? `${money0(focus.diff)} more / month` : ''}
              </T>
            </View>
            <T id="impact.on" style={{ ...S.sans, fontSize: 12, color: '#FFFFFF', marginBottom: 5 }}>{focus ? `on a ${money0(focus.amount)} loan` : ''}</T>
          </Abs>

          {/* Table */}
          <Abs x={M} y={TABLE_Y} w={CONTENT_W}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
              <T id="table.title" style={{ ...S.bold, fontSize: 11.5, color: C.ink }}>MONTHLY PRINCIPAL & INTEREST</T>
              <T id="table.note" style={{ ...S.sans, fontSize: 8.5, color: '#5C5F63' }}>{`${num(d.termYears) || 30}-year fixed-rate example`}</T>
            </View>
            <View style={{ flexDirection: 'row', backgroundColor: C.green, paddingVertical: 7, borderTopLeftRadius: 3, borderTopRightRadius: 3 }}>
              <T id="th0" style={{ ...head, width: COLS[0], paddingLeft: 12 }}>LOAN AMOUNT</T>
              <T id="th1" style={{ ...head, width: COLS[1], textAlign: 'right' }}>{`AT ${pctLabel(d.rateLow)}`}</T>
              <T id="th2" style={{ ...head, width: COLS[2], textAlign: 'right' }}>{`AT ${pctLabel(d.rateHigh)}`}</T>
              <T id="th3" style={{ ...head, width: COLS[3], textAlign: 'right', paddingRight: 12 }}>DIFFERENCE / MO.</T>
            </View>
            {rows.map((r, i) => {
              const hi = focus && r.amount === focus.amount;
              return (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    height: rowH,
                    backgroundColor: hi ? '#E3ECE8' : i % 2 ? GREEN_TINT : '#FFFFFF',
                    borderLeftWidth: 3,
                    borderLeftColor: hi ? C.green : 'transparent',
                    borderBottomWidth: 0.5,
                    borderBottomColor: '#DCE3E0',
                  }}
                >
                  <T id={`r${i}.amount`} style={{ ...cell, ...(hi ? S.tabBold : {}), width: COLS[0] - 3, paddingLeft: 9 }}>{money0(r.amount)}</T>
                  <T id={`r${i}.low`} style={{ ...cell, width: COLS[1], textAlign: 'right' }}>{money0(r.low)}</T>
                  <T id={`r${i}.high`} style={{ ...cell, width: COLS[2], textAlign: 'right' }}>{money0(r.high)}</T>
                  <T id={`r${i}.diff`} style={{ ...S.tabBold, fontSize: 10.5, color: C.green, width: COLS[3], textAlign: 'right', paddingRight: 12 }}>{`+${money0(r.diff)}`}</T>
                </View>
              );
            })}
          </Abs>

          {/* Strategies */}
          <Abs x={M} y={tableBottom + 14} w={CONTENT_W}>
            <T id="strat.title" style={{ ...S.bold, fontSize: 11.5, color: C.ink, marginBottom: 7 }}>BUYERS NEED A STRATEGY, NOT JUST A RATE.</T>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {[
                ['01', 'EXPLORE SELLER CREDITS', 'Eligible seller contributions may help cover closing costs or a rate buydown. Compare the upfront cost and monthly benefit before choosing.', GREEN_TINT],
                ['02', 'REVISIT THE BUDGET', 'Review unused subscriptions, dining out, and other discretionary expenses. Keep the payment comfortable without sacrificing essential savings.', BEIGE],
              ].map(([n, title, text, bg], i) => (
                <View key={i} style={{ width: (CONTENT_W - 12) / 2, backgroundColor: bg, borderRadius: 4, padding: 11 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 }}>
                    <Text style={{ ...S.serif, fontSize: 13, color: C.green, marginRight: 8 }}>{n}</Text>
                    <T id={`strat${i}.title`} style={{ ...S.bold, fontSize: 9.5, letterSpacing: 0.6, color: C.ink }}>{title}</T>
                  </View>
                  <T id={`strat${i}.text`} style={{ ...S.sans, fontSize: 9.5, lineHeight: 1.38, color: C.ink }} fit={{ w: (CONTENT_W - 12) / 2 - 22, lines: 3 }}>{text}</T>
                </View>
              ))}
            </View>
            <View style={{ marginTop: 8, borderLeftWidth: 3, borderLeftColor: C.green, paddingLeft: 10, paddingVertical: 2 }}>
              <T id="cta.title" style={{ ...S.bold, fontSize: 10, color: C.ink }}>HAVE A BUYER CONCERNED ABOUT THEIR MONTHLY PAYMENT?</T>
              <T id="cta.text" style={{ ...S.sans, fontSize: 9.5, color: C.ink, marginTop: 2 }} fit={{ w: CONTENT_W - 13, lines: 1 }}>
                Send me the listing and what they're comfortable paying. I'd be happy to run the numbers and see what options are available.
              </T>
            </View>
            <Legal paragraphs={LEGAL} size={5.5} style={{ marginTop: 8 }} maxH={26} />
          </Abs>

          <ContactRow assets={assets} agent={agent} />
          <LicenseFooter assets={assets} agent={agent} brand="compass" />
        </Sheet>
      </Document>
    );
  },
};
