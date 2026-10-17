import React from 'react';
import { Document, View, Text } from '@react-pdf/renderer';
import { Sheet, Abs, OPLogo, ContactRow, LicenseFooter, Legal, Photo, T, C, S, M, CONTENT_W } from '../common.jsx';

// Approved disclosure (identical on both "3% below market" flyers)
export const DISCLOSURE = [
  '*Participating builders and sellers may offer temporary or permanent rate buy down options on select properties.',
  'Applicant subject to credit and underwriting approval. Not all applicants will be approved for financing. Receipt of application does not represent an approval for financing or interest rate guarantee.',
  'Restrictions may apply, contact OriginPoint for current rates and for more information.',
  'Rate Reduce available from participating builders and sellers on select properties. The 1.5/.5 buydown option is not available for VA loans.',
  'Operating in the state of California as OriginPoint Mortgage LLC in lieu of the legal name OriginPoint LLC. (20231211-2528601)',
];

const PHOTO_W = CONTENT_W;
const PHOTO_H = 243;

function make({ id, name, headline, sub, ctaFirst, logo, stock, headSize }) {
  const meta = {
    id,
    name,
    category: 'Buydowns',
    description: `"${headline.join(' ')}" Agent co-branded buydown awareness flyer.`,
    tags: ['buydown', '3% below market', 'below market', 'rate buydown', 'awareness', 'first time buyer', 'homeownership'],
    needsListing: false,
    needsAgent: true,
  };
  const defaults = { photo: null };
  const fields = [{ section: 'Photo', items: [{ key: 'photo', label: 'Main photo', type: 'photo', aspect: PHOTO_W / PHOTO_H, fallback: stock }] }];

  function Doc({ data, agent, assets, bleed }) {
    const d = { ...defaults, ...data };
    const cta = 'Take the first step toward homeownership and contact me to learn more.';
    return (
      <Document title={name} author="OriginPoint" creator="pbflyers.janienation.com">
        <Sheet bleed={bleed}>
          <Abs x={M} y={34} w={200}>
            <OPLogo assets={assets} variant={logo} width={160} />
          </Abs>
          <Photo src={d.photoCrop || assets[stock]} x={M} y={84} w={PHOTO_W} h={PHOTO_H} />
          <Abs x={M} y={348} w={CONTENT_W}>
            <T id="headline" style={{ ...S.serif, fontSize: headSize, lineHeight: 1.12, color: C.ink, letterSpacing: -0.3 }} fit={{ w: CONTENT_W, lines: headline.length }}>
              {headline.join('\n')}
            </T>
            <T id="sub" style={{ ...S.sans, fontSize: 15, color: C.ink, marginTop: 20 }} fit={{ w: CONTENT_W, lines: 2 }}>{sub}</T>
            {ctaFirst ? <T id="cta" style={{ ...S.sans, fontSize: 15, color: C.ink, marginTop: 22 }} fit={{ w: CONTENT_W, lines: 2 }}>{cta}</T> : null}
            <Legal paragraphs={DISCLOSURE} size={6} style={{ marginTop: ctaFirst ? 12 : 14 }} maxH={60} />
            {!ctaFirst ? <T id="cta" style={{ ...S.sans, fontSize: 15, color: C.ink, marginTop: 26 }} fit={{ w: CONTENT_W, lines: 2 }}>{cta}</T> : null}
          </Abs>
          <ContactRow assets={assets} agent={agent} />
          <LicenseFooter assets={assets} y={736} />
        </Sheet>
      </Document>
    );
  }
  return { meta, defaults, fields, Doc, compute: () => null };
}

export const yupWeGotThat = make({
  id: 'below-market-yup',
  name: 'Mortgages at 3% Below Market',
  headline: ['Mortgages at 3% below market?', 'Yup, we’ve got that!'],
  headSize: 37,
  sub: 'Ask how a buydown program can make this happen.*',
  ctaFirst: true,
  logo: 'black',
  stock: 'couple',
});

export const askMeHow = make({
  id: 'below-market-ask',
  name: 'Want a Mortgage at 3% Below Market?',
  headline: ['Want a mortgage at 3% below market?', 'Ask me how!'],
  headSize: 31,
  sub: 'Learn how a buydown program can make this happen.*',
  ctaFirst: false,
  logo: 'black',
  stock: 'phoneGuy',
});
