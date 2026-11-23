// Fills the Add gift form and powers "Check price now".
// GET /api/product?url=https://www.tiffany.com/...
import { fetchProduct } from './_price.js';

export default async function handler(req, res) {
  const url = String(req.query?.url || '');
  if (!url) return res.status(400).json({ status: 'error', message: 'Add a product link.' });
  const result = await fetchProduct(url);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(result);
}
