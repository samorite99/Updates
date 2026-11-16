import { fail } from './escrow.js';
// Money is only released to escrow after Paystack itself confirms the payment (never on the webhook's word alone).
export async function settle({ esc, verify, reference, owner }) {
  const v = await verify(String(reference || ''));
  if (v.status !== 'success') throw fail(409, 'The payment is not successful yet.');
  if (v.currency && v.currency !== 'NGN') throw fail(422, 'Unexpected currency.');
  const md = v.metadata || {}, orders = Object.values(esc.db.orders);
  const os = md.group ? orders.filter(o => o.group === md.group) : (md.orderId && esc.db.orders[md.orderId] ? [esc.db.orders[md.orderId]] : []);
  if (!os.length) throw fail(404, 'No order matches this payment.');
  if (owner && os.some(o => o.buyer !== owner)) throw fail(403, 'This payment belongs to another account.');
  const waiting = os.filter(o => o.status === 'AWAITING_PAYMENT').map(o => o.id);
  if (md.group) esc.fundGroup(md.group, v.reference, v.amount); else esc.fund(md.orderId, v.reference, v.amount);
  return { orders: os, fresh: os.filter(o => waiting.includes(o.id)) };
}
