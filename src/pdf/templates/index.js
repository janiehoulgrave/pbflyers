import * as rateReduce from './rateReduce.jsx';
import { yupWeGotThat, askMeHow } from './belowMarket.jsx';
import { loanOptions, comparison } from './financing.jsx';
import { softHard, lowdown, buyNowSellLater, doctorLoans, noMI, softPull, condo } from './marketing.jsx';
import { costOfWaiting } from './costOfWaiting.jsx';

export const TEMPLATES = [
  comparison,
  loanOptions,
  rateReduce,
  lowdown,
  yupWeGotThat,
  askMeHow,
  costOfWaiting,
  softPull,
  softHard,
  noMI,
  doctorLoans,
  buyNowSellLater,
  condo,
];
export const byId = (id) => TEMPLATES.find((t) => t.meta.id === id);
