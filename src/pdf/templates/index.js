import * as rateReduce from './rateReduce.jsx';
import { yupWeGotThat, askMeHow } from './belowMarket.jsx';
import { loanOptions, comparison } from './financing.jsx';
import { softHard, lowdown, buyNowSellLater, buyBeforeSelling, doctorLoans, noMI, putMoneyBack, softPull, condo } from './marketing.jsx';
import { costOfWaiting } from './costOfWaiting.jsx';
import { rateImpactFlyer } from './rateImpact.jsx';
import { eventProducts } from './eventProducts.jsx';

export const TEMPLATES = [
  eventProducts,
  comparison,
  loanOptions,
  rateReduce,
  lowdown,
  yupWeGotThat,
  askMeHow,
  costOfWaiting,
  rateImpactFlyer,
  softPull,
  softHard,
  noMI,
  putMoneyBack,
  doctorLoans,
  buyNowSellLater,
  buyBeforeSelling,
  condo,
];
export const byId = (id) => TEMPLATES.find((t) => t.meta.id === id);
