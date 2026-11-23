// npm test  (checks the price reader against the shapes retailers use)
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProduct, toNumber, safeUrl } from '../api/_price.js';
import { applyCheck, shownPrice, needsAttention } from '../src/lib/giftPrice.js';

const ld = (o) => `<html><head><script type="application/ld+json">${JSON.stringify(o)}</script></head><body></body></html>`;

test('plain Product with one Offer', () => {
  const r = parseProduct(ld({ '@context': 'https://schema.org', '@type': 'Product', name: 'Bone Cuff', image: ['https://img/x.jpg'], offers: { '@type': 'Offer', price: '1,250.00', priceCurrency: 'USD' } }), 'https://www.tiffany.com/jewelry/p/bone-cuff');
  assert.equal(r.price, 1250);
  assert.equal(r.name, 'Bone Cuff');
  assert.equal(r.retailer, 'Tiffany & Co.');
  assert.equal(r.image, 'https://img/x.jpg');
});

test('@graph with AggregateOffer and Offer list picks the lowest', () => {
  const html = ld({ '@graph': [{ '@type': 'WebPage' }, { '@type': ['Product'], name: 'Vase', offers: [{ '@type': 'Offer', price: 89.95 }, { '@type': 'Offer', price: 79.95 }] }] });
  assert.equal(parseProduct(html, 'https://www.crateandbarrel.com/vase/s1').price, 79.95);
  const agg = ld({ '@type': 'Product', name: 'Set', offers: { '@type': 'AggregateOffer', lowPrice: '45', highPrice: '90' } });
  assert.equal(parseProduct(agg, 'https://x.com/').price, 45);
});

test('ProductGroup variants and priceSpecification', () => {
  const html = ld({ '@type': 'ProductGroup', name: 'Candle', hasVariant: [{ '@type': 'Product', offers: { '@type': 'Offer', priceSpecification: { price: 72, priceCurrency: 'USD' } } }] });
  assert.equal(parseProduct(html, 'https://www.maisonbergere.com/p').price, 72);
});

test('offer matching the page url wins', () => {
  const html = ld({ '@type': 'Product', name: 'Throw', offers: [{ price: 50, url: 'https://s.com/throw?color=red' }, { price: 120, url: 'https://s.com/throw?color=blue' }] });
  assert.equal(parseProduct(html, 'https://s.com/throw?color=blue').price, 120);
});

test('meta tag and microdata fallbacks', () => {
  const meta = '<meta property="og:title" content="Tray"><meta property="product:price:amount" content="64.00"><meta property="og:site_name" content="Some Shop"><meta property="og:image" content="/i.jpg">';
  const r = parseProduct(meta, 'https://someshop.com/tray');
  assert.equal(r.price, 64);
  assert.equal(r.retailer, 'Some Shop');
  assert.equal(r.image, 'https://someshop.com/i.jpg');
  assert.equal(parseProduct('<span itemprop="price" content="19.5">$19.50</span>', 'https://a.com').price, 19.5);
});

test('no price found', () => {
  assert.equal(parseProduct('<html><title>Hi</title></html>', 'https://a.com').price, null);
});

test('number and url helpers', () => {
  assert.equal(toNumber('$2,400'), 2400);
  assert.equal(toNumber('1.250,00 €'), 1250);
  assert.equal(toNumber('0'), null);
  assert.equal(safeUrl('http://127.0.0.1/x'), null);
  assert.equal(safeUrl('ftp://a.com'), null);
  assert.ok(safeUrl('https://www.tiffany.com/a'));
});

test('applyCheck keeps the last price when blocked, records changes when ok', () => {
  const g = { price: 100, priceAt: 1, priceHistory: [{ at: 1, price: 100 }] };
  const blocked = applyCheck(g, { status: 'blocked', message: 'no' }, 5);
  assert.equal(blocked.price, undefined);
  assert.equal(blocked.checkStatus, 'blocked');
  assert.equal(needsAttention({ ...g, ...blocked }, 5), true);
  assert.equal(needsAttention({ ...g, ...blocked, manualPrice: 95 }, 5), false);
  const ok = applyCheck(g, { status: 'ok', price: 90 }, 6);
  assert.equal(ok.price, 90);
  assert.equal(ok.previousPrice, 100);
  assert.equal(ok.priceHistory.length, 2);
  assert.deepEqual(shownPrice({ price: 90, manualPrice: 95 }), { price: 95, manual: true });
});
