import React from 'react';
import { Document, View, Text, Image } from '@react-pdf/renderer';
import { Sheet, Abs, BleedRect, OPLogo, ContactRow, LicenseFooter, Legal, T, C, S, M, TRIM_W, CONTENT_W } from '../common.jsx';

const BLUE = '#2769FC';
const GREEN_TINT = '#EEF3F1';
const BEIGE = '#F5F2EA';
const LIGHT = { fontFamily: 'CompassSans', fontWeight: 300 };

export const PEGAH_PAGE = 'https://www.originpoint.com/loan-officers/pegah-bozorgnia-910362';

const PRODUCTS = [
  ['Buy Now, Sell Later', 'Use the equity in your current home toward your next one, before it sells.'],
  ['DSCR Loans for Investors', 'Qualify based on the property’s rental income instead of personal income.'],
  ['No Tax Returns Required', 'Loan options that don’t require tax returns to qualify.'],
  ['Bank Statement Programs', 'Qualify with business or personal bank statements.'],
  ['Non-Warrantable Condos', 'Financing for condos that fall outside standard agency guidelines.'],
  ['HELOC / HELOAN', 'Tap your home’s equity with a line of credit or a fixed home equity loan.'],
];

export const LEGAL = [
  'Applicant subject to credit and underwriting approval. Not all applicants will be approved for financing. Receipt of application does not represent an approval for financing or interest rate guarantee. Restrictions may apply, contact OriginPoint for current rates and for more information.',
  'Buy Now, Sell Later is a brokered product and is not offered by OriginPoint.',
];

export const eventProducts = {
  meta: {
    id: 'portfolio-event',
    name: 'Loans for Every Story (Event Flyer)',
    category: 'Programs',
    description: 'Event handout with Pegah’s portfolio products, a QR code to her OriginPoint page, and a strong call to action.',
    tags: ['event', 'qr code', 'portfolio', 'non-qm', 'dscr', 'investor', 'bank statement', 'no tax returns', 'self-employed', 'non-warrantable condo', 'heloc', 'heloan', 'buy now sell later'],
    needsAgent: true,
    defaultAgentMode: 'none',
    qrField: 'qrUrl',
  },
  defaults: {
    qrUrl: PEGAH_PAGE,
    qrLabel: 'OriginPoint.com/PegahBozorgnia',
  },
  fields: [
    {
      section: 'QR code',
      items: [
        { key: 'qrUrl', label: 'QR code link', type: 'text', help: 'Where the QR code takes people. Defaults to Pegah’s OriginPoint page.' },
        { key: 'qrLabel', label: 'Link shown under the QR code', type: 'text' },
      ],
    },
  ],
  compute: () => null,
  Doc: function EventDoc({ data, agent, assets, bleed }) {
    const d = { ...eventProducts.defaults, ...data };
    const HEAD_H = 212;
    const cardW = (CONTENT_W - 12) / 2;
    const cardH = 58;
    return (
      <Document title="Loans for Every Story" author="OriginPoint" creator="pbflyers.janienation.com">
        <Sheet bleed={bleed}>
          <BleedRect x={0} y={0} w={TRIM_W} h={HEAD_H} color={C.green} sides={['left', 'right', 'top']} />
          <Abs x={M} y={34} w={160}>
            <OPLogo assets={assets} variant="white" width={140} />
          </Abs>
          <Abs x={M} y={88} w={CONTENT_W}>
            <T id="eyebrow" style={{ ...S.bold, fontSize: 9, letterSpacing: 1.8, color: '#CFE0DA' }}>BEYOND THE TRADITIONAL MORTGAGE</T>
            <T id="headline" style={{ ...S.serif, fontSize: 34, lineHeight: 1.08, color: '#FFFFFF', marginTop: 8 }} fit={{ w: CONTENT_W, lines: 2 }}>
              {'Every buyer has a story.\nWe have a loan for it.'}
            </T>
            <T id="sub" style={{ ...LIGHT, fontSize: 12.5, color: '#FFFFFF', marginTop: 10 }} fit={{ w: CONTENT_W, lines: 1 }}>
              Flexible financing for self-employed borrowers, investors, move-up buyers and more.
            </T>
          </Abs>

          {/* Product cards */}
          <Abs x={M} y={HEAD_H + 18} w={CONTENT_W} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {PRODUCTS.map(([title, text], i) => (
              <View
                key={i}
                style={{
                  width: cardW,
                  height: cardH,
                  marginBottom: i < 4 ? 10 : 0,
                  backgroundColor: GREEN_TINT,
                  borderRadius: 4,
                  paddingVertical: 10,
                  paddingHorizontal: 13,
                  flexDirection: 'row',
                }}
              >
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: BLUE, marginTop: 4, marginRight: 9 }} />
                <View style={{ flex: 1 }}>
                  <T id={`p${i}.title`} style={{ ...S.bold, fontSize: 12, color: C.ink }} fit={{ w: cardW - 42, lines: 1 }}>{title}</T>
                  <T id={`p${i}.text`} style={{ ...S.sans, fontSize: 9.8, lineHeight: 1.35, color: '#2E3336', marginTop: 3 }} fit={{ w: cardW - 42, lines: 2 }}>{text}</T>
                </View>
              </View>
            ))}
          </Abs>

          {/* And more */}
          <Abs x={M} y={HEAD_H + 18 + cardH * 3 + 20 + 10} w={CONTENT_W} style={{ backgroundColor: BEIGE, borderRadius: 4, paddingVertical: 9, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...S.serif, fontSize: 18, color: C.green, marginRight: 10 }}>+</Text>
            <T id="more" style={{ ...S.serif, fontSize: 14.5, color: C.ink }} fit={{ w: CONTENT_W - 50, lines: 1 }}>And more options for those who don’t fit traditional mortgage guidelines.</T>
          </Abs>

          {/* CTA, QR and disclosure flow together so nothing overlaps */}
          <Abs x={M} y={HEAD_H + 18 + cardH * 3 + 20 + 10 + 32 + 14} w={CONTENT_W}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, paddingRight: 20 }}>
              <T id="cta" style={{ ...S.serif, fontSize: 25, lineHeight: 1.1, color: C.ink }} fit={{ w: 400, lines: 2 }}>{'Don’t fit the mold?\nLet’s build your path home.'}</T>
              <T id="cta.sub" style={{ ...S.sans, fontSize: 10.5, lineHeight: 1.4, color: '#2E3336', marginTop: 7 }} fit={{ w: 400, lines: 2 }}>
                Scan the code to see my options and reach me directly, or say hello today. Let’s find the loan that fits your life.
              </T>
            </View>
            <View style={{ alignItems: 'center', width: 112 }}>
              {d.qrCode ? (
                <View style={{ padding: 4, borderWidth: 1, borderColor: C.green, borderRadius: 3, backgroundColor: '#FFFFFF' }}>
                  <Image src={d.qrCode} style={{ width: 52, height: 52 }} />
                </View>
              ) : (
                <View style={{ width: 62, height: 62, backgroundColor: '#E4E7EA', borderRadius: 3 }} />
              )}
              <T id="qr.cta" style={{ ...S.bold, fontSize: 7.5, letterSpacing: 1, color: C.green, marginTop: 4 }}>SCAN TO CONNECT</T>
              <T id="qr.label" style={{ ...S.sans, fontSize: 7, color: '#2E3336', marginTop: 1 }} fit={{ w: 112, lines: 1 }}>{d.qrLabel}</T>
            </View>
          </View>
            <Legal paragraphs={LEGAL} size={5.5} maxH={22} style={{ marginTop: 10 }} />
          </Abs>
          <ContactRow assets={assets} agent={agent} />
          <LicenseFooter assets={assets} agent={agent} brand="compass" />
        </Sheet>
      </Document>
    );
  },
};
