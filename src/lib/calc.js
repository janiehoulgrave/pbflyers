// All mortgage math for the flyers. Mirrors Pegah's buydown spreadsheet:
// payments are rounded to cents before subtracting, subsidies are summed by year.

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Monthly principal & interest. ratePct is a percent (7.45 = 7.45%).
export function pmt(loan, ratePct, months = 360) {
  if (!loan || !months) return 0;
  const m = ratePct / 1200;
  if (m === 0) return loan / months;
  return (loan * m) / (1 - Math.pow(1 + m, -months));
}

// Remaining balance after n payments
export function balanceAfter(loan, ratePct, months, n) {
  const m = ratePct / 1200;
  const p = pmt(loan, ratePct, months);
  if (m === 0) return loan - p * n;
  return loan * Math.pow(1 + m, n) - (p * (Math.pow(1 + m, n) - 1)) / m;
}

// Buydown structures from the spreadsheet. cut = percentage points below note rate.
export const BUYDOWNS = {
  '3-2-1': {
    label: '3-2-1',
    periods: [
      { label: 'first year', yearsLabel: 'Year 1', months: 12, cut: 3 },
      { label: 'second year', yearsLabel: 'Year 2', months: 12, cut: 2 },
      { label: 'third year', yearsLabel: 'Year 3', months: 12, cut: 1 },
    ],
    savingsLabel: 'Years 1–3',
  },
  '2-1': {
    label: '2-1',
    periods: [
      { label: 'first year', yearsLabel: 'Year 1', months: 12, cut: 2 },
      { label: 'second year', yearsLabel: 'Year 2', months: 12, cut: 1 },
    ],
    savingsLabel: 'Years 1–2',
  },
  '1.5-.5': {
    label: '1.5-.5',
    periods: [
      { label: 'first year', yearsLabel: 'Year 1', months: 12, cut: 1.5 },
      { label: 'second year', yearsLabel: 'Year 2', months: 12, cut: 0.5 },
    ],
    savingsLabel: 'Years 1–2',
  },
  '1-1-1': {
    label: '1-1-1',
    periods: [{ label: 'years 1–3', yearsLabel: 'Years 1–3', months: 36, cut: 1 }],
    savingsLabel: 'Years 1–3',
  },
  '1-0': {
    label: '1-0',
    periods: [{ label: 'first year', yearsLabel: 'Year 1', months: 12, cut: 1 }],
    savingsLabel: 'Year 1',
  },
};

// Temp buydown on a loan: returns stepped payments and the total subsidy (seller cost)
export function tempBuydown({ loan, rate, type, termMonths = 360 }) {
  const def = BUYDOWNS[type];
  const full = round2(pmt(loan, rate, termMonths));
  const steps = def.periods.map((p) => {
    const effRate = round2(rate - p.cut) ; // stays a clean percent
    const payment = round2(pmt(loan, effRate, termMonths));
    const monthlySubsidy = round2(full - payment);
    return { ...p, rate: effRate, payment, monthlySubsidy, subsidy: round2(monthlySubsidy * p.months) };
  });
  const totalSubsidy = round2(steps.reduce((s, x) => s + x.subsidy, 0));
  const buydownMonths = def.periods.reduce((s, p) => s + p.months, 0);
  return { full, steps, totalSubsidy, buydownMonths, def };
}

// RateReduce flyer: no buydown vs price reduction vs temp buydown
export function rateReduceScenario({ price, downPct, rate, apr, reductionPct, type }) {
  const loanFull = price * (1 - downPct / 100);
  const reducedPrice = price * (1 - reductionPct / 100);
  const loanReduced = reducedPrice * (1 - downPct / 100);
  const bd = tempBuydown({ loan: loanFull, rate, type });
  const fullPI = round2(pmt(loanFull, rate));
  const reducedPI = round2(pmt(loanReduced, rate));
  return {
    price, reducedPrice, reduction: price - reducedPrice,
    loanFull, loanReduced, rate, apr,
    fullPI, reducedPI, piReduction: round2(fullPI - reducedPI),
    buydown: bd,
  };
}

// Financing Solutions comparison table (list price / price reduction / temp buydown years)
export function comparisonScenario(i) {
  const {
    price, downPct, rate, priceReduction, type,
    taxRatePct = 0.9, insuranceMonthly = 180, bracketPct = 22, interestCap = 750000, saltDeduction = 10000,
    termMonths = 360,
  } = i;
  const col = (purchase, r, extra = {}) => {
    const down = purchase * downPct / 100;
    const loan = purchase - down;
    const pi = round2(pmt(loan, r, termMonths));
    const payment = round2(pi + (purchase * taxRatePct / 100) / 12 + insuranceMonthly);
    const taxBenefit = round2((bracketPct / 100) * (Math.min(loan, interestCap) * r / 100 + saltDeduction) / 12);
    return { purchase, down, loan, rate: r, termMonths, pi, payment, taxBenefit, ...extra };
  };
  const base = col(price, rate, { kind: 'list' });
  const cols = [base];
  if (priceReduction > 0) cols.push(col(price - priceReduction, rate, { kind: 'reduction' }));
  const bd = type && BUYDOWNS[type] ? tempBuydown({ loan: base.loan, rate, type, termMonths }) : null;
  if (bd) bd.steps.forEach((s, k) => cols.push(col(price, s.rate, { kind: 'buydown', step: s, stepIndex: k })));
  cols.forEach((c) => { c.cashSavings = round2(base.payment - c.payment); });
  return { cols, buydown: bd };
}

// Loan options flyer column
export function loanOption(c, price) {
  const down = price * (c.downPct || 0) / 100;
  let loan = price - down;
  if (c.program === 'va' && c.vaFeePct) loan = loan * (1 + c.vaFeePct / 100);
  const months = c.termMonths || 360;
  const payment = round2(pmt(loan, c.rate, months));
  const total = round2(payment + (Number(c.tih) || 0));
  const pointsFee = round2(loan * (Number(c.points) || 0) / 100);
  let arm = null;
  if (c.program === 'arm') {
    const fixedMonths = (c.fixedYears || 7) * 12;
    const bal = balanceAfter(loan, c.rate, months, fixedMonths);
    const adjRate = Number(c.index || 0) + Number(c.margin || 0);
    const adjPayment = round2(pmt(bal, adjRate, months - fixedMonths));
    arm = { fixedMonths, adjRate, adjPayment, lastPayment: months - 1 };
  }
  return { down, loan, payment, total, pointsFee, arm };
}
