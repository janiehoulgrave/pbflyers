import React from 'react';
import { Document, View, Text, Image } from '@react-pdf/renderer';
import { Sheet, Abs, BleedRect, OPLogo, ContactRow, LicenseFooter, Legal, Photo, T, Bullets, C, S, M, TRIM_W, CONTENT_W, BLEED, OP_RATIO } from '../common.jsx';

// Shared accents used across OriginPoint's program flyers
const BLUE = '#0064E5';
const BLUE_TINT = '#E5F1FF';
const BEIGE = '#FBF9F1';
const LIGHT = { fontFamily: 'CompassSans', fontWeight: 300 };
const MED = { fontFamily: 'CompassSans', fontWeight: 500 };

// Full-bleed photo across the top of the page (runs into the bleed on three sides)
const TopPhoto = ({ src, h }) => <Photo src={src} x={-BLEED} y={-BLEED} w={TRIM_W + BLEED * 2} h={h + BLEED} />;
const topAspect = (h) => (TRIM_W + BLEED * 2) / (h + BLEED);

const doc = (title, children) => (
  <Document title={title} author="OriginPoint" creator="pbflyers.janienation.com">
    {children}
  </Document>
);

// ---------------------------------------------------------------------------
// Soft Pull vs. Hard Pull (co-branded)
// ---------------------------------------------------------------------------
const SOFTHARD_LEGAL = [
  'Applicant subject to credit and underwriting approval. Not all applicants will be approved for financing. Receipt of application does not represent an approval for financing or interest rate guarantee.',
  'Refinancing your mortgage may increase costs over the term of your loan. Restrictions may apply, contact OriginPoint for current rates and for more information.',
  'The soft credit pull pre-approval option is available on conventional, government, and jumbo loans for purchase or refinance. No co-mortgagors are permitted at this time. This pre approval is an early assessment of borrowers’ qualifying information. A hard credit pull is required prior to a loan being submitted to underwriting and will impact borrower’s credit score. Borrowers already under contract will default to a hard credit pull when they apply for loan approval. Applicants are subject to credit and underwriting approval. Not all borrowers will be approved. restrictions apply. (20231010-2412164)',
];

export const softHard = {
  meta: {
    id: 'soft-vs-hard',
    name: 'Soft Pull vs. Hard Pull',
    category: 'Credit',
    description: 'Explains the Tri-Merge Soft Pull and why it protects the buyer’s credit score. Co-branded with an agent.',
    tags: ['soft pull', 'hard pull', 'credit', 'tri-merge', 'pre-approval', 'credit score', 'co-branded'],
    needsAgent: true,
    defaultAgentMode: 'compass',
  },
  defaults: {},
  fields: [],
  compute: () => null,
  Doc: ({ agent, assets, bleed }) => {
    const bandH = 436;
    return doc(
      'Soft Pull vs. Hard Pull',
      <Sheet bleed={bleed}>
        <BleedRect x={0} y={0} w={TRIM_W} h={bandH} color={C.green} sides={['left', 'right', 'top']} />
        <Abs x={-BLEED} y={-BLEED} w={TRIM_W + BLEED * 2} h={bandH + BLEED} style={{ overflow: 'hidden' }}>
          <Image src={assets.arcsGreen} style={{ width: (bandH + BLEED + 12) * (2272 / 1422), height: bandH + BLEED + 12, marginLeft: TRIM_W + BLEED * 2 - (bandH + BLEED + 12) * (2272 / 1422) }} />
        </Abs>
        <Abs x={M} y={40} w={150}>
          <OPLogo assets={assets} variant="white" width={140} />
        </Abs>
        <Abs x={M} y={116} w={340}>
          <T id="headline" style={{ ...S.serif, fontSize: 43, lineHeight: 1.08, color: '#FFFFFF' }} fit={{ w: 340, lines: 5 }}>
            {'Soft Pull vs.\nHard Pull:\nMake the Right\nChoice with\nOriginPoint'}
          </T>
        </Abs>
        <Abs x={M} y={bandH + 26} w={CONTENT_W}>
          <T id="body" style={{ ...S.sans, fontSize: 13.5, lineHeight: 1.45, color: C.ink }} fit={{ w: CONTENT_W, lines: 5 }}>
            Opt for peace of mind with our Tri-Merge Soft Pull, available within our digital mortgage. Unlike hard pulls, which can lower your credit score and stay on your report for up to two years, this comprehensive check gives you a full view from all three major bureaus—without any negative impact on your credit score.
          </T>
          <Legal paragraphs={SOFTHARD_LEGAL} size={6} style={{ marginTop: 18 }} maxH={70} />
        </Abs>
        <ContactRow assets={assets} agent={agent} />
        <LicenseFooter assets={assets} agent={agent} brand="compass" />
      </Sheet>
    );
  },
};

// ---------------------------------------------------------------------------
// Get the lowdown on mortgage buydowns (co-branded)
// ---------------------------------------------------------------------------
const LOWDOWN_LEGAL = [
  '(20230310-2001104) Applicant subject to credit and underwriting approval. Not all applicants will be approved for financing. Receipt of application does not represent an approval for financing or interest rate guarantee. Refinancing your mortgage may increase costs over the term of your loan. Restrictions may apply, contact OriginPoint for current rates and for more information.',
  'OriginPoint, LLC is a private corporation organized under the laws of the State of Delaware. It has no affiliation with the US Department of Housing and Urban Development, the US Department of Veterans Affairs, the Nevada Department of Veterans Services, the US Department of Agriculture or any other government agency. No compensation can be received for advising or assisting another person with a matter relating to veterans’ benefits except as authorized under Title 38 of the United States Code. The term "lender paid" means that the eligible borrower selects a higher interest rate on a mortgage loan in exchange for a lender credit. The lender credit is used to cover the cost of temporarily lowering the mortgage rate and will not exceed the cost required to achieve the selected rate. The lender-paid temporary rate buydown option is available on conforming 15 and 30 year fixed rate loans as well as FHA and VA 30 year fixed rate loans for the purchase of a primary residence. The 1.5/.5 buydown option is not available for VA loans. Property and loan type restrictions apply. Contact OriginPoint for more information. Rate Reduce option available from participating builders and sellers on select properties.',
];

export const lowdown = {
  meta: {
    id: 'lowdown-buydowns',
    name: 'The Lowdown on Mortgage Buydowns',
    category: 'Buydowns',
    description: 'Explainer on how Rate Reduce temporary buydowns work, with program qualifications. Co-branded with an agent.',
    tags: ['buydown', 'rate reduce', 'temporary buydown', 'qualifications', 'explainer', 'co-branded', '1-0', '2-1', '3-2-1'],
    needsAgent: true,
    defaultAgentMode: 'compass',
  },
  defaults: {},
  fields: [],
  compute: () => null,
  Doc: ({ agent, assets, bleed }) => {
    const body = { ...S.sans, fontSize: 10, lineHeight: 1.42, color: C.ink };
    const head = { ...S.bold, fontSize: 10.5, color: C.ink, marginTop: 12, marginBottom: 4 };
    const LEFT_W = 342;
    const BOX_X = M + LEFT_W + 20;
    const BOX_W = TRIM_W - M - BOX_X;
    return doc(
      'The Lowdown on Mortgage Buydowns',
      <Sheet bleed={bleed}>
        <BleedRect x={0} y={0} w={TRIM_W} h={170} color={BLUE_TINT} sides={['left', 'right', 'top']} />
        <Abs x={M} y={36} w={150}>
          <OPLogo assets={assets} variant="black" width={130} />
        </Abs>
        <Abs x={M} y={84} w={CONTENT_W}>
          <T id="headline" style={{ ...S.serif, fontSize: 29, lineHeight: 1.1, color: C.ink }} fit={{ w: CONTENT_W, lines: 1 }}>Get the lowdown on mortgage buydowns</T>
          <T id="sub" style={{ ...S.sans, fontSize: 18, color: '#2A2D30', marginTop: 8 }} fit={{ w: CONTENT_W, lines: 1 }}>See how to reduce a mortgage rate for up to 3 years</T>
        </Abs>

        <Abs x={M} y={192} w={LEFT_W}>
          <T id="intro" style={body} fit={{ w: LEFT_W, lines: 3 }}>
            What if there was a way to lower your rate for you to the first three years of your mortgage? That’s just what a mortgage buydown—particularly our Rate Reduce buydown program—does.
          </T>
          <T id="defHead" style={head}>Buydown Defnition:</T>
          <T id="def" style={body} fit={{ w: LEFT_W, lines: 9 }}>
            {'The seller, builder or lender fund the cost to temporary reduce the mortgage rate at closing via a sellers concession. For Jumbo loans, it is seller-paid. For conforming loans, either the seller or lender pay. The party then creates an escrow account... from which funds are disbursed to pay for the difference in rate, thus lowering the borrower’s monthly payment for this initial period.\nDuring the buydown period. those funds will be applied towards the monthly payment, effectively covering the difference in the cost between the note rate and the buydown rate.'}
          </T>
          <T id="basicsHead" style={head}>Buydown Basics</T>
          <Bullets
            id="basics"
            style={body}
            gap={3}
            items={[
              'A buydown temporarily reduces your rates through a builder or lender concession at closing. Basically, they’ll pay to lower your rates.',
              'At the end of the buydown period, your rate will return to the original rate.',
              'If you sell your home or refinance before the end of the buydown period. the remaining funds are applied towards principal reduction.',
            ]}
          />
        </Abs>

        <Abs x={BOX_X} y={192} w={BOX_W} style={{ backgroundColor: '#EEF0F1', borderRadius: 4, padding: 14 }}>
          <T id="qualHead" style={{ ...S.bold, fontSize: 11, color: C.ink, marginBottom: 8 }}>Qualifications</T>
          <Bullets
            id="qual"
            style={{ ...S.sans, fontSize: 9.5, lineHeight: 1.35, color: C.ink }}
            gap={5}
            items={[
              'FNMA / FHLMC conforming and High Balance',
              'FHA and VA 30-Year Fixed/Zero Down For Heroes (High Balance Ineligible)',
              '30-year fixed rate only',
              'Loan-To-Value up to 90%',
              'Purchase only (New Construction & Existing Homes)',
              'Primary residence only',
              'Must qualify at the full note rate',
              'Eligible property types: Single Family Residence, Planned Unit Development (PUD), Condo, 2-4 units',
            ]}
          />
        </Abs>

        <Abs x={M} y={500} w={CONTENT_W}>
          <T id="cta" style={{ ...S.bold, fontSize: 10.5, lineHeight: 1.4, color: C.ink }} fit={{ w: CONTENT_W, lines: 2 }}>
            {'With OriginPoint’s Rate Reduce, you can experience a rate reduction for 1,2 or 3 years!\nJust contact me and we can run the numbers to see what option works best for you.'}
          </T>
          <Legal paragraphs={LOWDOWN_LEGAL} size={5.5} style={{ marginTop: 12 }} maxH={74} />
        </Abs>
        <ContactRow assets={assets} agent={agent} />
        <LicenseFooter assets={assets} agent={agent} brand="compass" />
      </Sheet>
    );
  },
};

// ---------------------------------------------------------------------------
// Buy Now, Sell Later (co-branded)
// ---------------------------------------------------------------------------
const BNSL_LEGAL = [
  'This is a brokered product and is not offered by OriginPoint.',
  '*Applicant subjects to credit and underwriting approval. Not all applicants will be approved for financing. Receipt of application does not represent an approval for financing or interest rate guarantee. Restrictions may apply.',
  '**OriginPoint cannot guarantee that an applicant will be approved or that a closing can occur within a specific timeframe. All dates are estimates and will vary based on all involved parties level of participation at any stage of the local process. Contact OriginPoint for more information.',
];
const BNSL_PHOTO_H = 272;

export const buyNowSellLater = {
  meta: {
    id: 'buy-now-sell-later',
    name: 'Buy Now, Sell Later',
    category: 'Programs',
    description: 'Departing Residence Program: use equity from the current home toward the next one before it sells. Co-branded with an agent.',
    tags: ['departing residence', 'buy before you sell', 'bridge', 'equity', 'non-contingent', 'heloc', 'move up', 'co-branded'],
    needsAgent: true,
    defaultAgentMode: 'compass',
  },
  defaults: { photo: null },
  fields: [{ section: 'Photo', items: [{ key: 'photo', label: 'Header photo', type: 'photo', aspect: topAspect(BNSL_PHOTO_H), fallback: 'rowhouses' }] }],
  compute: () => null,
  Doc: ({ data, agent, assets, bleed }) => {
    const body = { ...S.sans, fontSize: 10, lineHeight: 1.4, color: C.ink };
    const LEFT_W = 290;
    const RX = M + LEFT_W + 26;
    const RW = TRIM_W - M - RX;
    return doc(
      'Buy Now, Sell Later',
      <Sheet bleed={bleed}>
        <TopPhoto src={data.photoCrop || assets.rowhouses} h={BNSL_PHOTO_H} />
        <Abs x={M} y={30} w={CONTENT_W}>
          <T id="headline" style={{ ...S.serif, fontSize: 40, color: '#000' }} fit={{ w: CONTENT_W, lines: 1 }}>Buy Now, Sell Later</T>
        </Abs>
        <Abs x={M} y={BNSL_PHOTO_H + 22} w={LEFT_W}>
          <T id="p1" style={body}>The Departing Residence Program benefits homebuyers by allowing them to take advantage of the equity from their departing residence toward the down payment of a new home purchase.</T>
          <T id="p2" style={{ ...body, marginTop: 9 }}>The real value of this program is that the current primary residence doesn’t need to be sold prior to the new purchase closing and selling stock in a down market can be avoided. With a listing agreement, we do not count your current house payment in your debt to income ratio allowing you to qualify for a larger mortgage prior to selling.</T>
          <T id="p3" style={{ ...body, marginTop: 9 }}>The Departing Residence Program is perfect for helping families transition to a new home without the added stress and drama of having to prepare the current primary for sale or rent while they’re still living in the home.</T>
        </Abs>
        <Abs x={RX} y={BNSL_PHOTO_H + 22} w={RW}>
          <T id="featuresHead" style={{ ...S.bold, fontSize: 11, color: C.ink, marginBottom: 8 }}>Program features include:</T>
          <Bullets
            id="features"
            style={{ ...body, lineHeight: 1.35 }}
            gap={6}
            items={[
              'Increased purchasing power*',
              'Can combine with a Home Equity Line of Credit for down payment',
              'Preserves stock portfolio',
              'Able to make a non-contingent offer*',
              'Loans up to $3 million',
              'Close on a new purchase in 15-days or less**',
              'Buy now sell later',
            ]}
          />
        </Abs>
        <Abs x={M} y={540} w={CONTENT_W}>
          <T id="cta" style={{ ...S.bold, fontSize: 13.5, lineHeight: 1.3, color: C.ink }} fit={{ w: CONTENT_W, lines: 2 }}>
            {'We can help you get the home of your dreams in this competitive market.\nReach out to us today.'}
          </T>
          <Legal paragraphs={BNSL_LEGAL} size={6} style={{ marginTop: 10 }} maxH={40} />
        </Abs>
        <ContactRow assets={assets} agent={agent} />
        <LicenseFooter assets={assets} agent={agent} brand="lockup" />
      </Sheet>
    );
  },
};

// ---------------------------------------------------------------------------
// Buy Now, Sell Later: "Yes, you may be able to buy a home before selling" (consumer)
// ---------------------------------------------------------------------------
const BNSL2_LEGAL = [
  'This is a brokered product and is not offered by OriginPoint.',
  'Applicant subject to credit and underwriting approval. Not all applicants will be approved for financing. Receipt of application does not represent an approval for financing or interest rate guarantee. Restrictions may apply. OriginPoint cannot guarantee that an applicant will be approved or that a closing can occur within a specific timeframe. All dates are estimates and will vary based on all involved parties level of participation at any stage of the loan process. Contact OriginPoint for more information',
];
const BNSL2_PHOTO_H = 246;

export const buyBeforeSelling = {
  meta: {
    id: 'buy-before-selling',
    name: 'Buy Before You Sell',
    category: 'Programs',
    description: '“Yes, you may be able to buy a home before selling your current home.” Departing Residence Program for buyers.',
    tags: ['buy now sell later', 'departing residence', 'buy before you sell', 'bridge', 'equity', 'non-contingent', 'heloc', 'move up', 'consumer'],
    needsAgent: true,
    defaultAgentMode: 'compass',
  },
  defaults: { photo: null },
  fields: [{ section: 'Photo', items: [{ key: 'photo', label: 'Header photo', type: 'photo', aspect: topAspect(BNSL2_PHOTO_H), fallback: 'modernHome' }] }],
  compute: () => null,
  Doc: ({ data, agent, assets, bleed }) => {
    const body = { ...S.sans, fontSize: 10, lineHeight: 1.38, color: C.ink };
    const bullets = [
      'Increased purchasing power*',
      'Can combine with a Home Equity Line of Credit for down payment',
      'Preserves stock portfolio',
      'Able to make a non-contingent offer*',
      'Loans up to $3 million',
      'Close on a new purchase in 15-days or less**',
      'Buy now sell later',
    ];
    return doc(
      'Buy Before You Sell',
      <Sheet bleed={bleed}>
        <TopPhoto src={data.photoCrop || assets.modernHome} h={BNSL2_PHOTO_H} />
        {/* soft shade behind the headline so white type stays readable on any photo */}
        {Array.from({ length: 12 }, (_, i) => (
          <Abs key={i} x={-BLEED} y={110 + i * 8} w={TRIM_W + BLEED * 2} h={BNSL2_PHOTO_H - 110 - i * 8} style={{ backgroundColor: '#000000', opacity: 0.025 }} />
        ))}
        <Abs x={M} y={30} w={160}>
          <OPLogo assets={assets} variant="white" width={150} />
        </Abs>
        <Abs x={M} y={156} w={CONTENT_W}>
          <T id="headline" style={{ ...S.serif, fontSize: 30, lineHeight: 1.12, color: '#FFFFFF' }} fit={{ w: CONTENT_W, lines: 2 }}>
            {'YES, you may be able to buy a\nhome before selling your current home'}
          </T>
        </Abs>
        <Abs x={M} y={BNSL2_PHOTO_H + 14} w={CONTENT_W}>
          <T id="title" style={{ ...S.serif, fontSize: 25, color: C.ink }} fit={{ w: CONTENT_W, lines: 1 }}>Buy Now, Sell Later...</T>
          <T id="p1" style={{ ...body, marginTop: 8 }} fit={{ w: CONTENT_W, lines: 2 }}>The Departing Residence Program benefits homebuyers by allowing them to take advantage of the equity from their departing residence toward the down payment of a new home purchase.</T>
          <T id="p2" style={{ ...body, marginTop: 8 }} fit={{ w: CONTENT_W, lines: 4 }}>The real value of this program is that the current primary residence doesn’t need to be sold prior to the new purchase closing. The selling of stocks in a down market can be avoided and will not result in capital gains taxes. With a listing agreement, we do not count your current house payment (we count as $0), in your debt to income ratio allowing you to qualify for a larger mortgage prior to selling, which makes qualifying easier!</T>
          <T id="p3" style={{ ...body, marginTop: 8 }} fit={{ w: CONTENT_W, lines: 2 }}>The Departing Residence Program is perfect for helping families transition to a new home without the added stress and drama of having to prepare the current primary for sale or rent while they’re still living in the home.</T>
          <T id="benefitsHead" style={{ ...S.bold, fontSize: 9, letterSpacing: 1.6, color: C.ink, marginTop: 11, marginBottom: 5 }}>PROGRAM BENEFITS</T>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: 312 }}>
              <Bullets id="benefitsA" style={body} gap={2} items={bullets.slice(0, 4)} />
            </View>
            <View style={{ flex: 1 }}>
              <Bullets id="benefitsB" style={body} gap={2} items={bullets.slice(4)} />
            </View>
          </View>
          <T id="close1" style={{ ...body, marginTop: 8 }} fit={{ w: CONTENT_W, lines: 1 }}>We have several investors for this program so it is important that we talk to make sure we select the best option for you.</T>
          <T id="close2" style={{ ...S.bold, fontSize: 10.5, color: C.ink, marginTop: 6 }} fit={{ w: CONTENT_W, lines: 1 }}>We can help you get the home of your dreams in this competitive market. Reach out today.</T>
          <Legal paragraphs={BNSL2_LEGAL} size={5.5} style={{ marginTop: 8 }} maxH={22} />
        </Abs>
        <ContactRow assets={assets} agent={agent} />
        <LicenseFooter assets={assets} agent={agent} brand="compass" />
      </Sheet>
    );
  },
};

// ---------------------------------------------------------------------------
// Doctor Loans (consumer)
// ---------------------------------------------------------------------------
const DOCTOR_LEGAL = [
  'For more information about this or any of our loan offerings for medical professionals, please speak with a Guaranteed Rate loan officer.',
  '*This program is not available for Chiropractors.',
  'Applicant subject to credit and underwriting approval. Not all applicants will be approved for financing. Receipt of application does not represent an approval for financing or interest rate guarantee.',
  'Refinancing your mortgage may increase costs over the term of your loan. Restrictions may apply, contact OriginPoint for current rates and for more information. (0126-4490631)',
];
const DOC_PHOTO = { x: M, y: 74, w: CONTENT_W, h: 172 };

export const doctorLoans = {
  meta: {
    id: 'doctor-loans',
    name: 'Doctor Loans',
    category: 'Programs',
    description: 'OriginPoint’s physician program: high loan limits, low down payment, and who qualifies.',
    tags: ['doctor', 'physician', 'medical professional', 'dentist', 'veterinarian', 'jumbo', 'consumer'],
    needsAgent: true,
    defaultAgentMode: 'compass',
  },
  defaults: { photo: null },
  fields: [{ section: 'Photo', items: [{ key: 'photo', label: 'Main photo', type: 'photo', aspect: DOC_PHOTO.w / DOC_PHOTO.h, fallback: 'doctor' }] }],
  compute: () => null,
  Doc: ({ data, agent, assets, bleed }) => {
    const item = { ...LIGHT, fontSize: 10.5, lineHeight: 1.38, color: C.ink };
    const colW = (CONTENT_W - 44 - 25) / 2;
    return doc(
      'Doctor Loans',
      <Sheet bleed={bleed}>
        <Abs x={(TRIM_W - 150) / 2} y={30} w={150}>
          <OPLogo assets={assets} variant="black" width={150} />
        </Abs>
        <Photo src={data.photoCrop || assets.doctor} {...DOC_PHOTO} radius={4} />
        <Abs x={M} y={262} w={CONTENT_W} style={{ alignItems: 'center' }}>
          <T id="headline" style={{ ...S.serif, fontSize: 28, color: C.ink, textAlign: 'center' }} fit={{ w: CONTENT_W, lines: 1 }}>We make homebuying easy for doctors.</T>
          <T id="sub" style={{ ...LIGHT, fontSize: 13, color: C.ink, textAlign: 'center', marginTop: 6 }} fit={{ w: CONTENT_W, lines: 1 }}>OriginPoint’s doctor program is created specifically to meet the needs of physicians.</T>
        </Abs>
        <Abs x={M} y={326} w={CONTENT_W}>
        <View style={{ backgroundColor: BLUE_TINT, borderRadius: 4, paddingVertical: 18, paddingHorizontal: 22, flexDirection: 'row' }}>
          <View style={{ width: colW }}>
            <T id="leftHead" style={{ ...MED, fontSize: 11, color: C.ink, marginBottom: 10 }}>Program highlights:</T>
            <Bullets
              id="highlights"
              style={item}
              gap={6}
              bulletStyle={{ color: BLUE }}
              items={[
                'Loan amounts greater than conforming loan limits and up to $2M',
                'Minimum down payment options as low as 5%',
                'Options for fixed and adjustable-rate mortgage terms available',
                'Property types: 1-2 unit properties, non-warrantable condos',
              ]}
            />
          </View>
          <View style={{ width: 0.75, backgroundColor: '#9FB4CF', marginHorizontal: 12 }} />
          <View style={{ width: colW }}>
            <T id="rightHead" style={{ ...MED, fontSize: 11, color: C.ink, marginBottom: 10 }}>Do you qualify?</T>
            <Bullets
              id="qualify"
              style={item}
              gap={4}
              bulletStyle={{ color: BLUE }}
              items={[
                'Must be a licensed medical professional:',
                { sub: true, text: 'MD, DO, OD, DPM, CRNA' },
                { sub: true, text: 'Dentists: DDS, DMD' },
                { sub: true, text: 'Ophthalmologists' },
                { sub: true, text: 'Veterinarians: DVM, VMD' },
                { sub: true, text: 'Teaching Professionals: MD, DDS, DO' },
              ]}
            />
          </View>
        </View>
          <T id="cta" style={{ ...S.sans, fontSize: 16, color: BLUE, textAlign: 'center', marginTop: 20 }} fit={{ w: CONTENT_W, lines: 1 }}>Call today to explore your options.</T>
          <Legal paragraphs={DOCTOR_LEGAL} size={6} style={{ marginTop: 18 }} maxH={44} />
        </Abs>
        <ContactRow assets={assets} agent={agent} />
        <LicenseFooter assets={assets} agent={agent} brand="compass" />
      </Sheet>
    );
  },
};

// ---------------------------------------------------------------------------
// No Mortgage Insurance (consumer)
// ---------------------------------------------------------------------------
const NOMI_LEGAL = [
  '1- Savings, if any, vary based on the consumer’s credit profile, interest rate availability, and other factors. Contact OriginPoint for current rates. Restrictions apply.',
  'Eligible first time home buyers must make less than 80% of Area Median Income. Available for first lien conventional mortgages for purchase of 1-unit owner occupied primary residences including condos, and double-wide manufactured homes with additional requirements. Minimum down payment and FICO score requirements apply. Homeownership education may be required depending on transaction details.',
  'Applicants subject to credit and underwriting approval. Additional restrictions apply. (0526-5125452)',
];
const NOMI_PHOTO = { x: 330, y: 34, w: 246, h: 346 };

export const noMI = {
  meta: {
    id: 'no-mi',
    name: 'No Mortgage Insurance',
    category: 'Programs',
    description: '“Forget mortgage insurance. Bring on the savings.” Low down payment with no MI for eligible first-time buyers.',
    tags: ['no mi', 'mortgage insurance', 'pmi', 'first time buyer', 'low down payment', '3% down', 'consumer'],
    needsAgent: true,
    defaultAgentMode: 'compass',
  },
  defaults: { photo: null },
  fields: [{ section: 'Photo', items: [{ key: 'photo', label: 'Main photo', type: 'photo', aspect: NOMI_PHOTO.w / NOMI_PHOTO.h, fallback: 'nomi' }] }],
  compute: () => null,
  Doc: ({ data, agent, assets, bleed }) => {
    const boxW = (CONTENT_W - 28) / 3;
    const boxText = { ...S.sans, fontSize: 12.5, lineHeight: 1.3, color: C.ink, textAlign: 'center' };
    const strong = { fontFamily: 'CompassSans', fontWeight: 700, color: BLUE };
    return doc(
      'No Mortgage Insurance',
      <Sheet bleed={bleed}>
        <BleedRect x={0} y={0} w={TRIM_W} h={414} color={BEIGE} sides={['left', 'right', 'top']} />
        <Abs x={M} y={40} w={160}>
          <OPLogo assets={assets} variant="black" width={150} />
        </Abs>
        <Abs x={M} y={120} w={280}>
          <T id="lead" style={{ ...LIGHT, fontSize: 26, lineHeight: 1.12, color: C.ink }} fit={{ w: 280, lines: 2 }}>{'Forget mortgage\ninsurance'}</T>
          <T id="headline" style={{ ...S.serif, fontSize: 44, color: C.ink, marginTop: 12 }} fit={{ w: 280, lines: 1 }}>Bring on</T>
          <View style={{ flexDirection: 'row', marginTop: 4 }}>
            <View style={{ backgroundColor: BLUE, paddingHorizontal: 9, paddingTop: 1, paddingBottom: 7 }}>
              <T id="headline2" style={{ ...S.serif, fontSize: 44, color: '#FFFFFF' }} fit={{ w: 262, lines: 1 }}>the savings.</T>
            </View>
          </View>
          <T id="sub" style={{ ...LIGHT, fontSize: 13, lineHeight: 1.35, color: C.ink, marginTop: 22 }} fit={{ w: 280, lines: 2 }}>Now, OriginPoint is helping homebuyers skip the mortgage insurance.</T>
        </Abs>
        <Photo src={data.photoCrop || assets.nomi} {...NOMI_PHOTO} radius={4} />
        <Abs x={M} y={440} w={CONTENT_W} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[
            '<b>Don’t pay more</b> for putting less than 20% down',
            'Save up to\n<b>$361/month*</b>',
            'Down payment options\n<b>as low as 3%</b>',
          ].map((t, i) => (
            <View key={i} style={{ width: boxW, height: 70, backgroundColor: BLUE_TINT, borderWidth: 1, borderColor: BLUE, borderRadius: 3, justifyContent: 'center', paddingHorizontal: 12 }}>
              <T id={`box${i}`} style={boxText} strong={strong} fit={{ w: boxW - 24, lines: 2 }}>{t}</T>
            </View>
          ))}
        </Abs>
        <Abs x={M} y={536} w={CONTENT_W}>
          <T id="cta" style={{ ...S.bold, fontSize: 14, color: C.ink }} fit={{ w: CONTENT_W, lines: 1 }}>Explore your options today.</T>
          <Legal paragraphs={NOMI_LEGAL} size={6} style={{ marginTop: 10 }} maxH={44} />
        </Abs>
        <ContactRow assets={assets} agent={agent} />
        <LicenseFooter assets={assets} agent={agent} brand="compass" />
      </Sheet>
    );
  },
};

// ---------------------------------------------------------------------------
// Put money back in your clients' pockets (agent-facing No MI)
// ---------------------------------------------------------------------------
const MEET_PHOTO = { x: 330, y: 34, w: 246, h: 324 };

export const putMoneyBack = {
  meta: {
    id: 'no-mi-agents',
    name: 'Put Money Back in Your Clients’ Pockets',
    category: 'Agent education',
    description: 'Agent-facing No MI flyer: buyers skip mortgage insurance with as little as 3% down.',
    tags: ['no mi', 'mortgage insurance', 'pmi', 'agent', 'first time buyer', 'low down payment', '3% down', 'co-branded'],
    needsAgent: true,
    defaultAgentMode: 'compass',
  },
  defaults: { photo: null },
  fields: [{ section: 'Photo', items: [{ key: 'photo', label: 'Main photo', type: 'photo', aspect: MEET_PHOTO.w / MEET_PHOTO.h, fallback: 'meeting' }] }],
  compute: () => null,
  Doc: ({ data, agent, assets, bleed }) => {
    const boxW = (CONTENT_W - 28) / 3;
    const boxText = { ...S.sans, fontSize: 12.5, lineHeight: 1.3, color: C.ink, textAlign: 'center' };
    const strong = { fontFamily: 'CompassSans', fontWeight: 700, color: BLUE };
    return doc(
      'Put Money Back in Your Clients’ Pockets',
      <Sheet bleed={bleed}>
        <BleedRect x={0} y={0} w={TRIM_W} h={404} color={BEIGE} sides={['left', 'right', 'top']} />
        <Abs x={M} y={40} w={160}>
          <OPLogo assets={assets} variant="black" width={150} />
        </Abs>
        <Abs x={M} y={90} w={280}>
          <T id="headline" style={{ ...S.serif, fontSize: 43, lineHeight: 1.04, color: C.ink }} fit={{ w: 280, lines: 3 }}>{'Put money\nback in your\nclients’'}</T>
          <View style={{ flexDirection: 'row', marginTop: 4 }}>
            <View style={{ backgroundColor: BLUE, paddingHorizontal: 9, paddingTop: 1, paddingBottom: 7 }}>
              <T id="headline2" style={{ ...S.serif, fontSize: 43, color: '#FFFFFF' }} fit={{ w: 262, lines: 1 }}>pockets.</T>
            </View>
          </View>
          <T id="sub" style={{ ...LIGHT, fontSize: 13, lineHeight: 1.38, color: C.ink, marginTop: 18 }} strong={strong} fit={{ w: 280, lines: 3 }}>
            {'OriginPoint is helping qualified buyers\nskip mortgage insurance with options\nas low as <b>3%\u00a0down</b>.'}
          </T>
        </Abs>
        <Photo src={data.photoCrop || assets.meeting} {...MEET_PHOTO} radius={4} />
        <Abs x={M} y={428} w={CONTENT_W} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[
            '<b>Buyers won’t pay more</b> for putting less than 20% down',
            'Waiving MI could save them up to <b>$361/month*</b>',
            'Down payment options\n<b>as low as 3%</b>',
          ].map((t, i) => (
            <View key={i} style={{ width: boxW, height: 70, backgroundColor: BLUE_TINT, borderWidth: 1, borderColor: BLUE, borderRadius: 3, justifyContent: 'center', paddingHorizontal: 12 }}>
              <T id={`box${i}`} style={boxText} strong={strong} fit={{ w: boxW - 24, lines: 2 }}>{t}</T>
            </View>
          ))}
        </Abs>
        <Abs x={M} y={526} w={CONTENT_W}>
          <T id="cta" style={{ ...S.bold, fontSize: 14, color: C.ink }} fit={{ w: CONTENT_W, lines: 1 }}>Reach out today.</T>
          <Legal paragraphs={NOMI_LEGAL} size={6} style={{ marginTop: 10 }} maxH={44} />
        </Abs>
        <ContactRow assets={assets} agent={agent} />
        <LicenseFooter assets={assets} agent={agent} brand="compass" />
      </Sheet>
    );
  },
};

// ---------------------------------------------------------------------------
// Soft-pull pre-approval (consumer)
// ---------------------------------------------------------------------------
const SOFTPULL_LEGAL = [
  'Applicant subject to credit and underwriting approval. Not all applicants will be approved for financing. Receipt of application does not represent an approval for financing or interest rate guarantee.',
  'Refinancing your mortgage may increase costs over the term of your loan. Restrictions may apply, contact OriginPoint for current rates and for more information.',
  'The soft credit pull pre-approval option is available on conventional, government, and jumbo loans for purchase or refinance. This pre approval is an early assessment of borrowers\' qualifying information. A hard credit pull is required prior to a loan being submitted to underwriting and will impact borrower\'s credit score. Borrowers already under contract will default to a hard credit pull when they apply for loan approval. Applicants are subject to credit and underwriting approval. Not all borrowers will be approved. Restrictions apply. (0526-4771551)',
];
const SP_PHOTO_H = 252;

export const softPull = {
  meta: {
    id: 'soft-pull-plan',
    name: 'Pre-Approval With No Credit Impact',
    category: 'Credit',
    description: '“Build a strong plan to get pre-approved.” Soft-pull credit review, AI credit tool and a clear plan.',
    tags: ['soft pull', 'pre-approval', 'credit', 'credit score', 'first time buyer', 'consumer', 'ai credit tool'],
    needsAgent: true,
    defaultAgentMode: 'compass',
  },
  defaults: { photo: null },
  fields: [{ section: 'Photo', items: [{ key: 'photo', label: 'Header photo', type: 'photo', aspect: topAspect(SP_PHOTO_H), fallback: 'softpull' }] }],
  compute: () => null,
  Doc: ({ data, agent, assets, bleed }) => {
    const colW = (CONTENT_W - 40) / 3;
    const steps = [
      ['Credit review', 'We’ll use a soft pull to review your current score with no impact on it'],
      ['AI credit tool', 'Our Loan Officer will walk you through your options'],
      ['Make a clear plan', 'We’ll help you put a plan in place to boost your score before you select a home'],
    ];
    return doc(
      'Pre-Approval With No Credit Impact',
      <Sheet bleed={bleed}>
        <TopPhoto src={data.photoCrop || assets.softpull} h={SP_PHOTO_H} />
        <Abs x={TRIM_W - M - 150} y={30} w={150}>
          <OPLogo assets={assets} variant="black" width={150} />
        </Abs>
        <Abs x={M} y={SP_PHOTO_H + 18} w={CONTENT_W}>
          <T id="headline" style={{ ...S.serif, fontSize: 29, lineHeight: 1.14, color: C.green }} fit={{ w: CONTENT_W, lines: 2 }}>
            {'Build a strong plan to get pre-approved.\nWith no credit impact.'}
          </T>
          <T id="sub" style={{ ...LIGHT, fontSize: 17, color: C.ink, marginTop: 14 }} fit={{ w: CONTENT_W, lines: 1 }}>Thinking about buying but worried about risking your credit score?</T>
          <T id="intro" style={{ ...LIGHT, fontSize: 10.5, lineHeight: 1.4, color: C.ink, marginTop: 8 }} fit={{ w: CONTENT_W, lines: 1 }}>With OriginPoint, we can get you started on a path toward your best rate, with minimum credit impact.</T>
          <T id="howHead" style={{ ...MED, fontSize: 10.5, color: C.ink }}>Here’s how:</T>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
            {steps.map(([title, text], i) => (
              <View key={i} style={{ width: colW }}>
                <Image src={assets[`icon${i}`]} style={{ width: 26, height: 26, marginBottom: 9 }} />
                <T id={`step${i}.title`} style={{ ...MED, fontSize: 11, color: C.ink, marginBottom: 2 }}>{title}</T>
                <T id={`step${i}.text`} style={{ ...LIGHT, fontSize: 10.5, lineHeight: 1.4, color: C.ink }} fit={{ w: colW, lines: 3 }}>{text}</T>
              </View>
            ))}
          </View>
          <T id="close" style={{ ...LIGHT, fontSize: 13, lineHeight: 1.4, color: C.ink, marginTop: 16 }} fit={{ w: CONTENT_W, lines: 2 }}>
            {'It’s a smart, credit-safe way to prepare so you can buy with confidence.\nAnd we’ll let you know if or when any hard credit pull is needed.'}
          </T>
          <Legal paragraphs={SOFTPULL_LEGAL} size={6} style={{ marginTop: 10 }} maxH={44} />
        </Abs>
        <ContactRow assets={assets} agent={agent} />
        <LicenseFooter assets={assets} agent={agent} brand="compass" />
      </Sheet>
    );
  },
};

// ---------------------------------------------------------------------------
// Condo project eligibility updates (agent-facing)
// ---------------------------------------------------------------------------
const CONDO_LEGAL = [
  'Applicant subject to credit and underwriting approval. Not all applicants will be approved for financing. Receipt of application does not represent an approval for financing or interest rate guarantee.',
  'Refinancing your mortgage may increase costs over the term of your loan. Restrictions may apply, contact OriginPoint for current rates and for more information.',
  'For Broker-Dealer or Agent use only — Not for public dissemination. May not be distributed, reprinted or shown to the public in oral, written or electronic form as sales material. (0426-4897401)',
];
const CONDO_PHOTO_H = 186;

export const condo = {
  meta: {
    id: 'condo-updates',
    name: 'Condo Project Eligibility Updates',
    category: 'Agent education',
    description: 'For agents: how agency condo project rules and reserve requirements are changing, and when.',
    tags: ['condo', 'project eligibility', 'reserves', 'investor concentration', 'agent', 'guidelines', 'fannie', 'freddie'],
    needsAgent: true,
    defaultAgentMode: 'compass',
  },
  defaults: { photo: null },
  fields: [{ section: 'Photo', items: [{ key: 'photo', label: 'Header photo', type: 'photo', aspect: topAspect(CONDO_PHOTO_H), fallback: 'condo' }] }],
  compute: () => null,
  Doc: ({ data, agent, assets, bleed }) => {
    const cell = { ...LIGHT, fontSize: 10, lineHeight: 1.32, color: C.ink };
    const PAD = 12;
    const colW = (CONTENT_W - PAD * 2 - 16) / 2;
    const groups = [
      ['PREVIOUS', 'EFFECTIVE IMMEDIATELY', [
        ['Limited to 4 units for review waivers', 'Expanded to 10 units. Faster financing for small buildings'],
        ['50% investor concentration limit for established projects', 'Cap is <b>ELIMINATED.</b> Rental-heavy buildings now qualify'],
      ]],
      ['CURRENT', 'EFFECTIVE 8/3/26', [
        ['Review Process: 40% of deals used "Limited Review"', 'Full reviews will be mandatory for condo projects > 10 units. Full review is required for less than 10 units unless eligible for project review waiver'],
        ['Exceptions allowed to the budgeted reserve requirements when a reserve study supports an allocation <10%', 'Reserve study is required for projects allocating <10% and the budget must use the highest recommended reserve allocation'],
      ]],
      ['CURRENT', 'EFFECTIVE 1/04/27', [['Reserve Funding: 10% annual assessment allocation required', 'Reserves allocation increasing to 15%']]],
    ];
    return doc(
      'Condo Project Eligibility Updates',
      <Sheet bleed={bleed}>
        <TopPhoto src={data.photoCrop || assets.condo} h={CONDO_PHOTO_H} />
        <Abs x={M} y={34} w={160}>
          <OPLogo assets={assets} variant="white" width={150} />
        </Abs>
        <Abs x={M} y={88} w={330}>
          <T id="headline" style={{ ...S.serif, fontSize: 28, lineHeight: 1.1, color: '#FFFFFF' }} fit={{ w: 330, lines: 2 }}>{'Help your clients unlock\nmore condo inventory'}</T>
        </Abs>
        <Abs x={M} y={CONDO_PHOTO_H + 18} w={CONTENT_W}>
          <T id="title" style={{ ...MED, fontSize: 15, color: C.ink }} fit={{ w: CONTENT_W, lines: 1 }}>Navigating current agency pathways for project eligibility.</T>
          <T id="intro" style={{ ...LIGHT, fontSize: 11, lineHeight: 1.4, color: C.ink, marginTop: 7 }} fit={{ w: CONTENT_W, lines: 3 }}>
            Don't let new condo guidelines surprise you at the closing table. We’ve outlined the recent shifts in project eligibility and reserve requirements to help you anticipate these changes today to ensure condo and investor-heavy projects stay on track.
          </T>
          <View style={{ backgroundColor: BLUE_TINT, borderRadius: 4, paddingHorizontal: PAD, paddingTop: 6, paddingBottom: 6, marginTop: 14 }}>
            {groups.map(([l, r, rows], g) => (
              <View key={g}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#1A1A1A', paddingTop: g ? 8 : 4, paddingBottom: 4 }}>
                  <T id={`g${g}.left`} style={{ ...S.bold, fontSize: 9.5, letterSpacing: 0.4, color: BLUE, width: colW }}>{l}</T>
                  <T id={`g${g}.right`} style={{ ...S.bold, fontSize: 9.5, letterSpacing: 0.4, color: BLUE, width: colW }}>{r}</T>
                </View>
                {rows.map(([a, b], k) => (
                  <View
                    key={k}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 6,
                      borderBottomWidth: k < rows.length - 1 ? 0.75 : 0,
                      borderBottomColor: '#7E8A99',
                      borderBottomStyle: 'dotted',
                    }}
                  >
                    <T id={`g${g}.r${k}.a`} style={{ ...cell, width: colW }} fit={{ w: colW, lines: 3 }}>{a}</T>
                    <T id={`g${g}.r${k}.b`} style={{ ...cell, width: colW }} fit={{ w: colW, lines: 3 }} strong={{ fontFamily: 'CompassSans', fontWeight: 700 }}>{b}</T>
                  </View>
                ))}
              </View>
            ))}
          </View>
          <T id="cta" style={{ ...S.bold, fontSize: 11.5, color: C.ink, marginTop: 14 }} fit={{ w: CONTENT_W, lines: 1 }}>Let’s connect to discuss how these expanded pathways can unlock more inventory and help you close more deals.</T>
          <Legal paragraphs={CONDO_LEGAL} size={6} style={{ marginTop: 7 }} maxH={30} />
        </Abs>
        <ContactRow assets={assets} agent={agent} />
        <LicenseFooter assets={assets} agent={agent} brand="compass" />
      </Sheet>
    );
  },
};
