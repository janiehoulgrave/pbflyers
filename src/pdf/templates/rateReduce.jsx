import React from 'react';
import { Document, View, Text } from '@react-pdf/renderer';
import { Sheet, Abs, BleedRect, OPLogo, ContactRow, LicenseFooter, Legal, Photo, T, C, S, M, TRIM_W, CONTENT_W } from '../common.jsx';
import { rateReduceScenario, BUYDOWNS } from '../../lib/calc.js';
import { money0, pct, shortDate, num } from '../../lib/format.js';

// Approved disclosure (from the 2-1 and 3-2-1 RateReduce flyers). Only the effective date is filled in.
export const disclosure = (date) => [
  'Applicant subject to credit and underwriting approval. Not all applicants will be approved for financing. Receipt of application does not represent an approval for financing or interest rate guarantee. Refinancing your mortgage may increase costs over the term of your loan. Restrictions may apply, contact OriginPoint for current rates and for more information.',
  '1. Savings, if any, vary based on the consumer’s credit profile, interest rate availability, and other factors. Contact OriginPoint for current rates. Restrictions apply.',
  `2. Sample scenario assumes 20% down payment. Both temporary and permanent RateReduce options are available from participating builders and sellers on select properties. Buyer paid RateReduce options are also available for qualified borrowers on any approvable property per loan product restrictions. Advertised rates and APR effective as of ${shortDate(date)} and are subject to change without notice. Above scenario assumes a first lien position, primary residence in the state of IL and a 20% down payment amount. Subject to underwriting guidelines and applicant’s credit profile. Sample payment does not include taxes, insurance or assessments. Not all applicants will be approved. The actual interest rate, APR and payment may vary based on the specific terms of the loan selected, verification of information, your credit history, the location and type of property, and other factors as determined by Lender. Contact OriginPoint for more information and up to date rates. (1125-3937650)`,
  'Operating in the state of California as OriginPoint Mortgage LLC in lieu of the legal name OriginPoint LLC.',
];

export const meta = {
  id: 'ratereduce',
  name: 'RateReduce Temp Buydown',
  category: 'Buydowns',
  description: 'Compares no buydown, a price reduction, and a seller-paid temporary buydown, with the math done for you.',
  tags: ['buydown', 'temp buydown', '3-2-1', '2-1', '1-0', '1-1-1', '1.5-.5', 'seller concession', 'price reduction', 'ratereduce'],
  needsListing: false,
  needsAgent: true,
};

export const defaults = {
  type: '2-1',
  price: 749000,
  downPct: 20,
  rate: '',
  apr: '',
  reductionPct: 5,
  date: '',
  photo: null, // stock sofa unless replaced
};

export const fields = [
  {
    section: 'Scenario',
    items: [
      { key: 'type', label: 'Buydown type', type: 'select', options: Object.keys(BUYDOWNS).map((k) => ({ value: k, label: k + ' temp buydown' })) },
      { key: 'price', label: 'Asking price', type: 'money' },
      { key: 'reductionPct', label: 'Price reduction to compare', type: 'percent', help: 'Shown in the middle column' },
      { key: 'downPct', label: 'Down payment', type: 'percent', help: 'The approved disclosure assumes 20% down', warnUnless: 20 },
      { key: 'rate', label: 'Interest rate (note rate)', type: 'percent', step: 0.001, help: 'The loan’s actual interest rate. APR is separate because it also includes fees and points.' },
      { key: 'apr', label: 'APR', type: 'percent', step: 0.001, required: true },
      { key: 'date', label: 'Rates effective as of', type: 'date', required: true, help: 'Fills the date in the disclosure. Starts as today.' },
    ],
  },
  { section: 'Photo', items: [{ key: 'photo', label: 'Header photo', type: 'photo', aspect: 264 / 152, fallback: 'sofa' }] },
];

export function compute(d) {
  return rateReduceScenario({
    price: num(d.price), downPct: num(d.downPct), rate: num(d.rate), apr: num(d.apr),
    reductionPct: num(d.reductionPct), type: d.type,
  });
}

const COLS = [128, 128, 132, 152]; // label + 3 scenario columns = 540

// The buydown column (last) gets a soft tint so the seller's option stands out.
function Row({ id, label, cells, strong = [] }) {
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 0.7, borderBottomColor: C.rule }}>
      <View style={{ width: COLS[0], paddingLeft: 9, paddingVertical: 6.5, justifyContent: 'center' }}>
        <T id={`${id}.label`} style={{ fontSize: 9, color: C.tableInk, ...S.bold }} fit={{ w: COLS[0] - 12, lines: 2 }}>{label}</T>
      </View>
      {cells.map((c, i) => (
        <View key={i} style={{ width: COLS[i + 1], paddingRight: 8, paddingLeft: i === 2 ? 8 : 0, paddingVertical: 6.5, justifyContent: 'center', backgroundColor: i === 2 ? C.colTint : undefined }}>
          {(Array.isArray(c) ? c : [c]).map((t, k) => (
            <T key={k} id={`${id}.c${i}.${k}`} style={{ fontSize: 9, lineHeight: 1.27, ...(strong.includes(i) ? { ...S.tabBold, color: C.tableInk } : { ...S.tab, color: C.tableGray }) }} fit={{ w: COLS[i + 1] - (i === 2 ? 16 : 8), lines: Array.isArray(c) ? 2 : 3 }}>{t}</T>
          ))}
        </View>
      ))}
    </View>
  );
}

export function Doc({ data, agent, assets, bleed }) {
  const d = { ...defaults, ...data };
  const s = compute(d);
  const bd = s.buydown;
  const ratePair = `(${pct(s.rate)} / ${pct(s.apr)} APR)`;
  const typeLabel = BUYDOWNS[d.type].label;
  const stepLines = bd.steps.map((st) => `${money0(st.payment)} ${st.label}`);
  const after = bd.buydownMonths / 12 + 1;
  return (
    <Document title={`RateReduce ${typeLabel} Buydown`} author="OriginPoint" creator="pbflyers.janienation.com">
      <Sheet bleed={bleed}>
        <BleedRect x={0} y={0} w={TRIM_W} h={186} color={C.skyBlue} sides={['left', 'right', 'top']} />
        <Abs x={M} y={30} w={80}>
          <OPLogo assets={assets} variant="black" width={78} />
        </Abs>
        <Abs x={M} y={74} w={250}>
          <T id="headline" style={{ ...S.serif, fontSize: 23, lineHeight: 1.12, color: C.ink }} fit={{ w: 250, lines: 3 }}>
            {'See how RateReduce\nTemp benefits both\nthe seller and buyer'}
          </T>
        </Abs>
        <Photo src={d.photoCrop || assets.sofa} x={TRIM_W - M - 264} y={18} w={264} h={152} radius={4} />

        <Abs x={M} y={202} w={CONTENT_W}>
          <T id="intro.title" style={{ ...S.bold, fontSize: 14, color: C.text, marginBottom: 12 }} fit={{ w: CONTENT_W, lines: 1 }}>The breakdown of a win-win scenario</T>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: 252, marginRight: 24 }}>
              <T id="intro.buyerHead" style={{ ...S.bold, fontSize: 9.5, lineHeight: 1.4, color: C.text }} fit={{ w: 252, lines: 1 }}>Buyer advantage: See how much the buyer could save!</T>
              <T id="intro.buyerBody" style={{ ...S.medium, fontSize: 9.5, lineHeight: 1.4, color: C.text }} fit={{ w: 252, lines: 2 }}>Save monthly through a temporarily reduced interest rate via a seller concession.</T>
            </View>
            <View style={{ width: 264 }}>
              <T id="intro.sellerHead" style={{ ...S.bold, fontSize: 9.5, lineHeight: 1.4, color: C.text }} fit={{ w: 264, lines: 1 }}>Seller advantage: See how the seller could win</T>
              <T id="intro.sellerBody" style={{ ...S.medium, fontSize: 9.5, lineHeight: 1.4, color: C.text }} fit={{ w: 264, lines: 2 }}>Offers a rate buydown instead of lowering the price, retaining full asking price and potentially netting more.</T>
            </View>
          </View>
          <T id="intro.scenario" style={{ ...S.bold, fontSize: 9.5, color: C.text, marginTop: 14 }} fit={{ w: CONTENT_W, lines: 1 }}>
            {`Here's a sample scenario of price reduction and ${typeLabel} buydown:`}
          </T>
        </Abs>

        <Abs x={M} y={296} w={CONTENT_W}>
          <View style={{ flexDirection: 'row', backgroundColor: C.headGray, borderBottomWidth: 0.7, borderBottomColor: C.rule }}>
            <Text style={{ width: COLS[0] }} />
            {[
              ['No Buydown /', 'No Price Reduction'],
              [`${num(d.reductionPct)}% Price`, 'Reduction'],
              [`${typeLabel} Temp`, 'Buydown'],
            ].map((h, i) => (
              <View key={i} style={{ width: COLS[i + 1], paddingVertical: 6, paddingLeft: i === 2 ? 8 : 0, backgroundColor: i === 2 ? '#E3ECF6' : undefined }}>
                {h.map((t, k) => (
                  <T key={k} id={`table.head${i}.${k}`} style={{ ...S.bold, fontSize: 8, lineHeight: 1.25, color: C.tableInk }} fit={{ w: COLS[i + 1] - 16, lines: 1 }}>{t}</T>
                ))}
              </View>
            ))}
          </View>
          <Row id="table.price" label="Asking price" cells={[money0(s.price), `Reduced to ${money0(s.reducedPrice)}`, `Remains at ${money0(s.price)}`]} />
          <Row id="table.loan" label="Loan amount" cells={[money0(s.loanFull), money0(s.loanReduced), money0(s.loanFull)]} />
          <Row
            id="table.pi"
            label="Monthly P&I"
            cells={[`${money0(s.fullPI)} ${ratePair}`, `${money0(s.reducedPI)} ${ratePair}`, [...stepLines, `${money0(s.fullPI)} ${ratePair} remaining term`]]}
          />
          <Row id="table.cost" label="Buydown Cost" cells={['-', '-', money0(bd.totalSubsidy)]} strong={[2]} />
          <Row id="table.buyer" label="Buyer Impact" cells={['Receives market rate', `Monthly P&I reduced by ${money0(s.piReduction)}`, `${money0(bd.totalSubsidy)} Savings ${bd.def.savingsLabel}`]} strong={[2]} />
          <Row id="table.seller" label="Seller Impact" cells={['Sells home at asking price', `${money0(s.reduction)} reduction in asking price`, 'No price reduction. Seller pays for buydown']} />
          <Legal paragraphs={disclosure(d.date)} size={6} style={{ marginTop: 8 }} maxH={68} />
        </Abs>

        <ContactRow assets={assets} agent={agent} />
        <LicenseFooter assets={assets} y={736} />
      </Sheet>
    </Document>
  );
}
