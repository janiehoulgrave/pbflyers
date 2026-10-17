import React from 'react';
import { Document, View, Text } from '@react-pdf/renderer';
import { Sheet, Abs, BleedRect, CobrandBar, ContactRow, LicenseFooter, Photo, T, C, S, M, TRIM_W, CONTENT_W, CONTACT_Y } from '../common.jsx';
import { loanOption, comparisonScenario, BUYDOWNS } from '../../lib/calc.js';
import { money0, money2, pct, pct3, shortDate, shortMoney, headlineSize, num, ordinal } from '../../lib/format.js';

const LISTING_TAGS = ['listing', 'property', 'financing solutions', 'open house', 'co-branded'];

function AddressBlock({ listing, y = 54, width = 255, showCity = true, children }) {
  const street = (listing?.street || 'Property Address').toUpperCase();
  const size = headlineSize(street, 36);
  return (
    <Abs x={M} y={y} w={width}>
      <T id="eyebrow" style={{ ...S.bold, fontSize: 10, letterSpacing: 1.3, color: '#000', marginBottom: 12 }} fit={{ w: width, lines: 1 }}>FINANCING SOLUTIONS</T>
      <T id="address" style={{ ...S.serif, fontSize: size, lineHeight: 1.12, color: '#000' }} fit={{ w: width, lines: 2 }}>{street}</T>
      {showCity && listing?.city ? (
        <T id="city" style={{ ...S.sans, fontSize: 10, letterSpacing: 1, color: '#000', marginTop: 8 }} fit={{ w: width, lines: 1 }}>{listing.city.toUpperCase()}</T>
      ) : null}
      {children}
    </Abs>
  );
}

// ---------------------------------------------------------------------------
// Loan Options flyer (four loan programs side by side)
// ---------------------------------------------------------------------------
const TAIL = (date) =>
  `All of the above scenarios are subject to underwriting guidelines and applicant’s credit profile. Actual payment, taxes, insurance or assessments may vary. Advertised rates and APR effective as of ${shortDate(date)} and are subject to change without notice. Mortgage Insurance Premium (MIP) is required for all FHA loans and Private Mortgage Insurance (PMI) is required for all conventional loans where the LTV is greater than 80%. Actual payment obligation will be greater. Not all applicants will be approved. Applicant’s interest rate and APR will depend upon the specific characteristics of applicant’s loan transaction, credit profile and other criteria. Contact OriginPoint for more information and up to date rates. Some of the products featured are only available for first time home buyers. Other products listed may be available to you if you are not a first time home buyer. Please speak with a OriginPoint loan originator.`;

export function loanFootnote(c, r, date) {
  if (c.program === 'va') return `Sample payment does not include VA funding fee (max VA funding fee of 3.3%). ${TAIL(date)}`;
  const pts = num(c.points) > 0;
  if (c.program === 'arm') {
    const fm = r.arm.fixedMonths;
    return `${num(c.fixedYears) || 7} Year ARM interest rate and monthly principal and interest (P&I) payment subject to increase after initial 5 year period. Monthly payments 1 – ${fm}: ${money2(r.payment)} with a rate of ${pct3(c.rate)}/${pct3(c.apr)} APR${pts ? `, with ${num(c.points)} discount points (discount point fee ${money2(r.pointsFee)} to be charged at closing)` : ''}. Monthly payments ${fm + 1} - ${r.arm.lastPayment}: ${money0(r.arm.adjPayment)} with a rate of ${pct3(r.arm.adjRate)}/${pct3(c.apr)} APR. First rate adjustment cap: ${num(c.capFirst)}%; subsequent annual caps: ${num(c.capAnnual)}%; lifetime adjustment cap: ${num(c.capLife)}%. Interest rate and payments after initial period are based on a margin of ${num(c.margin)}% and a current SOFR Index of ${c.index}. ${TAIL(date)}`;
  }
  return `${pts ? `Sample monthly Principal and Interest (P&I) payment includes ${num(c.points)} discount points (discount point fee ${money0(r.pointsFee)} to be charged at closing). ` : ''}${TAIL(date)}`;
}

export const blankCol = (o) => ({
  title: '30 Year Fixed', termMonths: 360, program: 'fixed', programLabel: 'NonConforming', downPct: 20,
  rate: '', apr: '', points: 0, vaFeePct: 2.15, fixedYears: 7, margin: 3, index: '', capFirst: 5, capAnnual: 6, capLife: 5,
  ...o,
});

export const loanOptions = {
  meta: {
    id: 'loan-options',
    name: 'Financing Solutions: Loan Options',
    category: 'Listing',
    description: 'A listing with up to four loan programs side by side: rate, APR, payment and down payment.',
    tags: [...LISTING_TAGS, 'loan options', 'va', 'jumbo', 'arm', 'fixed', 'rates'],
    needsListing: true,
    needsAgent: true,
  },
  defaults: {
    price: '',
    tih: 800,
    date: '',
    columns: [
      blankCol({ title: '30 Year Fixed', program: 'va', programLabel: 'VA', downPct: 0 }),
      blankCol({ title: 'Jumbo 7 Year ARM', program: 'arm', downPct: 20, margin: 3 }),
      blankCol({ title: 'Jumbo 7 Year ARM', program: 'arm', downPct: 35, margin: 2.25 }),
      blankCol({ title: '30 Year Fixed', program: 'fixed', downPct: 25 }),
    ],
    photo: null,
  },
  fields: [
    {
      section: 'Pricing',
      items: [
        { key: 'price', label: 'List price', type: 'money', fromListing: 'price', required: true },
        { key: 'tih', label: 'Tax, insurance & HOA (monthly)', type: 'money' },
        { key: 'date', label: 'Rates effective as of', type: 'date', required: true },
      ],
    },
    { section: 'Loan programs', items: [{ key: 'columns', type: 'loanColumns', max: 4 }] },
    { section: 'Photo', items: [{ key: 'photo', label: 'Listing photo', type: 'photo', aspect: 306 / 228, fromListing: true }] },
  ],
  compute: (d) => {
    const price = num(d.price);
    return (d.columns || []).map((c) => loanOption({ ...c, rate: num(c.rate), apr: num(c.apr) }, price));
  },
  Doc: function LoanOptionsDoc({ data, agent, listing, assets, bleed }) {
    const d = { ...loanOptions.defaults, ...data };
    const price = num(d.price || listing?.price);
    const cols = (d.columns || []).filter(Boolean).slice(0, 4);
    const results = cols.map((c) => loanOption({ ...c, rate: num(c.rate), apr: num(c.apr) }, price));
    const n = Math.max(cols.length, 1);
    const GAP = 14;
    const colW = (CONTENT_W - GAP * (n - 1)) / n;
    const photoX = 306;
    const photoW = TRIM_W - photoX;
    const sup = (k) => <Text style={{ fontSize: 6, verticalAlign: 'super' }}>{k + 1}</Text>;
    const row = (label, value, k, supIdx) => (
      <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4.4 }}>
        <T id={`${k}.label`} style={{ fontSize: 8, color: C.muted }}>{label}</T>
        <T id={`${k}.value`} style={{ ...S.tab, fontSize: 8, color: C.muted }} after={supIdx != null ? sup(supIdx) : null}>{value}</T>
      </View>
    );
    return (
      <Document title={`Financing Solutions - ${listing?.street || ''}`} author="OriginPoint" creator="pbflyers.janienation.com">
        <Sheet bleed={bleed}>
          <CobrandBar assets={assets} agent={agent} />
          <AddressBlock listing={listing} y={54} width={252}>
            <T id="description" style={{ fontSize: 11, lineHeight: 1.18, color: '#000', marginTop: 14 }} fit={{ w: 252, h: 120 }} maxLines={10} textOverflow="ellipsis">
              {d.description ?? listing?.description ?? ''}
            </T>
          </AddressBlock>
          <Photo src={d.photoCrop} x={photoX} y={50} w={photoW + 12} h={228} />
          <BleedRect x={photoX} y={278} w={photoW} h={27} color={C.green} sides={['right']} />
          <Abs x={photoX + 10} y={285} w={photoW - 20}>
            <T id="listedAt" style={{ fontSize: 12, color: '#FFF' }} fit={{ w: photoW - 20, lines: 1 }}>{`Listed at ${price ? money0(price) : ''}`}</T>
          </Abs>

          <Abs x={M} y={352} w={CONTENT_W} style={{ flexDirection: 'row' }}>
            {cols.map((c, i) => {
              const r = results[i];
              return (
                <View key={i} style={{ width: colW, marginRight: i < n - 1 ? GAP : 0 }}>
                  <T id={`col${i}.title`} style={{ fontSize: 13, color: '#000', marginBottom: 5 }} fit={{ w: colW, lines: 1 }}>{c.title}</T>
                  <T id={`col${i}.term`} style={{ fontSize: 10, color: C.muted, lineHeight: 1.3 }} after={sup(i)}>{`(${num(c.termMonths)} months)`}</T>
                  <T id={`col${i}.program`} style={{ fontSize: 10, color: C.muted, lineHeight: 1.3 }} fit={{ w: colW, lines: 1 }}>{`${c.programLabel}, ${num(c.downPct)}% Down`}</T>
                  <View style={{ borderBottomWidth: 0.8, borderBottomColor: C.muted, marginTop: 9, marginBottom: 10 }} />
                  {row('Rate', pct(c.rate), `col${i}.rate`)}
                  {row('APR', c.apr === '' ? '' : pct(c.apr), `col${i}.apr`, i)}
                  {row('Mortgage Payment', money2(r.payment), `col${i}.payment`)}
                  {row('Tax, Insurance & HOA', money0(d.tih), `col${i}.tih`)}
                  {row('Total Monthly', money2(r.payment + num(d.tih)), `col${i}.total`)}
                  {row('Down Payment', money2(r.down), `col${i}.down`)}
                  <T id={`legal.footnote${i}`} label="Disclosure" style={{ fontSize: 4, lineHeight: 1.2, color: C.muted, marginTop: 8 }} fit={{ w: colW, h: 118 }}>
                    {`${i + 1}) ${loanFootnote({ ...c, rate: num(c.rate), apr: num(c.apr) }, r, d.date)}`}
                  </T>
                </View>
              );
            })}
          </Abs>
          <ContactRow assets={assets} agent={agent} />
          <LicenseFooter assets={assets} y={736} />
        </Sheet>
      </Document>
    );
  },
};

// ---------------------------------------------------------------------------
// Scenario Comparison flyer (yellow table)
// ---------------------------------------------------------------------------
export const comparison = {
  meta: {
    id: 'scenario-compare',
    name: 'Financing Solutions: Price Reduction vs Buydown',
    category: 'Listing',
    description: 'Listing comparison of full price, a price reduction, and a seller-paid temp buydown with payment, tax benefit and cash savings.',
    tags: [...LISTING_TAGS, 'buydown', 'seller credit', 'price reduction', 'comparison', 'tax benefit', 'cash savings', '2-1'],
    needsListing: true,
    needsAgent: true,
  },
  defaults: {
    price: '',
    downPct: 20,
    rate: '',
    priceReduction: 50000,
    type: '2-1',
    aprs: { list: '', reduction: '', bd0: '', bd1: '', bd2: '' },
    taxRatePct: 0.9,
    insuranceMonthly: 180,
    bracketPct: 22,
    interestCap: 750000,
    saltDeduction: 10000,
    photo: null,
  },
  fields: [
    {
      section: 'Scenario',
      items: [
        { key: 'price', label: 'List price', type: 'money', fromListing: 'price', required: true },
        { key: 'priceReduction', label: 'Price reduction to compare', type: 'money', help: 'Set to 0 to hide that column' },
        { key: 'type', label: 'Seller buydown', type: 'select', options: [{ value: '', label: 'None' }, ...Object.keys(BUYDOWNS).map((k) => ({ value: k, label: k + ' temp buydown' }))] },
        { key: 'downPct', label: 'Down payment', type: 'percent' },
        { key: 'rate', label: 'Interest rate (note rate)', type: 'percent', step: 0.001, help: 'The loan’s actual interest rate. APR is separate because it also includes fees and points.' },
        { key: 'aprs', type: 'aprs' },
      ],
    },
    {
      section: 'Assumptions',
      collapsed: true,
      note: 'These match the numbers on the current approved flyer. Payment = P&I + property tax + insurance. Tax Benefit = bracket × (interest on the loan up to the cap + state and local taxes) ÷ 12.',
      items: [
        { key: 'taxRatePct', label: 'Property tax rate (yearly % of price)', type: 'percent', step: 0.01 },
        { key: 'insuranceMonthly', label: 'Homeowners insurance (monthly)', type: 'money' },
        { key: 'bracketPct', label: 'Federal tax bracket', type: 'percent' },
        { key: 'interestCap', label: 'Mortgage interest deduction cap', type: 'money' },
        { key: 'saltDeduction', label: 'State and local tax deduction', type: 'money', help: 'Federal cap changed in 2025; confirm with compliance' },
      ],
    },
    { section: 'Photo', items: [{ key: 'photo', label: 'Listing photo', type: 'photo', aspect: 204 / 136, fromListing: true }] },
  ],
  compute: (d) => comparisonScenario(compInput(d)),
  Doc: function ComparisonDoc({ data, agent, listing, assets, bleed }) {
    const d = { ...comparison.defaults, ...data };
    const res = comparisonScenario(compInput({ ...d, price: d.price || listing?.price }));
    const cols = res.cols;
    const credit = res.buydown ? shortMoney(res.buydown.totalSubsidy, { dollar: false, kUpper: true }) : '';
    const header = (c) => {
      if (c.kind === 'list') return `${shortMoney(c.purchase)} Listing`;
      if (c.kind === 'reduction') return `${shortMoney(num(d.priceReduction))} Price Reduction`;
      const st = c.step;
      const when = st.months > 12 ? 'YRS 1–3' : `${ordinal(c.stepIndex + 1)} YR`;
      return `${when} Temp Seller Buydown${c.stepIndex === 0 ? ` (${credit} Seller Credit)` : ''}`;
    };
    const aprFor = (c) => (c.kind === 'list' ? d.aprs.list : c.kind === 'reduction' ? d.aprs.reduction : d.aprs['bd' + c.stepIndex]);
    const LABEL_W = 108;
    const valW = (CONTENT_W - LABEL_W) / cols.length;
    const rows = [
      ['Purchase Price', (c) => money0(c.purchase), null, false],
      ['Down Payment', (c) => money0(c.down), null, true],
      ['Loan Amount', (c) => money0(c.loan), null, false],
      ['Interest Rate', (c) => pct3(c.rate), null, true],
      ['APR', (c) => '*' + (aprFor(c) === '' || aprFor(c) == null ? '' : pct3(aprFor(c))), null, false],
      ['Term (Months)', (c) => String(c.termMonths), null, true],
      ['Payment', (c) => '**' + money2(c.payment), 'yellow', false],
      ['Tax Benefit', (c) => money2(c.taxBenefit), null, true],
      ['Cash Savings', (c) => money2(c.cashSavings), null, false, true],
    ];
    const RH = 38;
    return (
      <Document title={`Financing Solutions - ${listing?.street || ''}`} author="OriginPoint" creator="pbflyers.janienation.com">
        <Sheet bleed={bleed}>
          <CobrandBar assets={assets} agent={agent} />
          <AddressBlock listing={listing} y={58} width={300} showCity={false} />
          <Photo src={d.photoCrop} x={TRIM_W - M - 204} y={58} w={204} h={136} />
          <Abs x={M} y={212} w={CONTENT_W} style={{ borderWidth: 1, borderColor: C.border }}>
            <View style={{ flexDirection: 'row', height: 54, backgroundColor: C.rowGray, alignItems: 'center' }}>
              <View style={{ width: LABEL_W }} />
              {cols.map((c, i) => (
                <T key={i} id={`head${i}`} style={{ ...S.bold, width: valW, fontSize: 9.5, lineHeight: 1.2, textAlign: 'center', paddingHorizontal: 6, color: '#1A1A1A' }} fit={{ w: valW - 12, lines: 3 }}>{header(c)}</T>
              ))}
            </View>
            {rows.map(([label, fn, hi, gray, strong], k) => (
              <View key={k} style={{ flexDirection: 'row', height: RH, backgroundColor: gray ? C.rowGray : '#FFF' }}>
                <View style={{ width: LABEL_W, justifyContent: 'center', paddingLeft: 9 }}>
                  <T id={`row${k}.label`} style={{ ...S.bold, fontSize: 10, color: '#1A1A1A' }} fit={{ w: LABEL_W - 12, lines: 2 }}>{label}</T>
                </View>
                {cols.map((c, i) => (
                  <View key={i} style={{ width: valW, justifyContent: 'center', backgroundColor: hi ? C.yellow : undefined }}>
                    <T id={`row${k}.c${i}`} style={{ ...(strong || hi ? S.tabBold : S.tab), fontSize: 11, textAlign: 'center', color: '#1A1A1A' }} fit={{ w: valW - 8, lines: 2 }}>{fn(c)}</T>
                  </View>
                ))}
              </View>
            ))}
          </Abs>
          <ContactRow assets={assets} agent={agent} />
          <LicenseFooter assets={assets} y={736} />
        </Sheet>
      </Document>
    );
  },
};

function compInput(d) {
  return {
    price: num(d.price), downPct: num(d.downPct), rate: num(d.rate), priceReduction: num(d.priceReduction), type: d.type,
    taxRatePct: num(d.taxRatePct), insuranceMonthly: num(d.insuranceMonthly), bracketPct: num(d.bracketPct),
    interestCap: num(d.interestCap), saltDeduction: num(d.saltDeduction),
  };
}
