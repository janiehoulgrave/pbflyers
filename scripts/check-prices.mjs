// Daily gift price check. Runs on GitHub Actions (free), see .github/workflows/gift-prices.yml.
// Visits each gift's product page, reads the price from the page's own product data and saves it.
// If a site blocks the check, the last known price stays and the gift is flagged for a manual price.
//
// Needs the FIREBASE_SERVICE_ACCOUNT secret (the service account JSON for the pegah-briefing project).
// Run by hand: FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" node scripts/check-prices.mjs
import { fetchProduct } from '../api/_price.js';
import { applyCheck } from '../src/lib/giftPrice.js';

const COLLECTION = 'pbflyers_gifts';
const PAUSE_MS = 2500; // be polite: one page at a time

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.log('::warning::FIREBASE_SERVICE_ACCOUNT is not set yet, so prices were not checked. See the README, "Gift Center".');
  process.exit(0);
}

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');

let account;
try {
  account = JSON.parse(raw);
} catch {
  console.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON. Paste the whole key file as the secret value.');
  process.exit(1);
}
initializeApp({ credential: cert(account) });
const db = getFirestore();

const snap = await db.collection(COLLECTION).get();
const counts = {};
console.log(`Checking ${snap.size} gift${snap.size === 1 ? '' : 's'}…`);

for (const doc of snap.docs) {
  const g = doc.data();
  if (!g.link) continue;
  let result = await fetchProduct(g.link);
  // one retry after a pause for blocks and timeouts, which are often temporary
  if (result.status === 'blocked' || result.status === 'error') {
    await new Promise((r) => setTimeout(r, 8000));
    result = await fetchProduct(g.link);
  }
  const patch = applyCheck(g, result);
  await doc.ref.update(patch);
  counts[result.status] = (counts[result.status] || 0) + 1;
  const shown = result.status === 'ok' ? `$${result.price}` : result.message;
  console.log(`${result.status.padEnd(8)} ${g.name || doc.id}: ${shown}`);
  await new Promise((r) => setTimeout(r, PAUSE_MS));
}

console.log('Done:', Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing to check');
