import { createHmac, timingSafeEqual } from 'node:crypto';
const KEY = process.env.PAYSTACK_SECRET_KEY || '';
// Safety rail: live keys are refused until you deliberately opt in (after CAC, legal review and security checks).
if (KEY.startsWith('sk_live') && process.env.ALLOW_LIVE !== '1') throw new Error('Live Paystack key refused. Use an sk_test key, or set ALLOW_LIVE=1 once launch checks are complete.');
export const mode = KEY ? 'paystack' : 'mock';
export async function init(tag, amount, metadata, email) {
  const reference = `nx_${tag}_${Date.now()}`;
  if (mode === 'mock') return { reference, url: null };
  const r = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, amount, reference, metadata, ...(process.env.PUBLIC_URL && { callback_url: process.env.PUBLIC_URL.replace(/\/$/, '') + '/' }) }) });
  const j = await r.json();
  if (!j.status) throw Object.assign(new Error('Payment provider refused: ' + j.message), { status: 502 });
  return { reference, url: j.data.authorization_url };
}
export function validSignature(raw, sig) {
  if (!KEY || !sig) return false;
  const a = Buffer.from(createHmac('sha512', KEY).update(raw).digest('hex')), b = Buffer.from(String(sig));
  return a.length === b.length && timingSafeEqual(a, b);
}
// Asks Paystack itself whether a payment really succeeded and for how much.
export async function verifyTransaction(reference) {
  if (mode === 'mock') throw Object.assign(new Error('Payment verification needs a Paystack key.'), { status: 404 });
  const r = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference), { headers: { Authorization: 'Bearer ' + KEY } }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok || !j.status || !j.data) throw Object.assign(new Error('Could not confirm the payment with Paystack. Try again shortly.'), { status: 502 });
  return { status: j.data.status, amount: j.data.amount, reference: j.data.reference, currency: j.data.currency, metadata: j.data.metadata || {} };
}
