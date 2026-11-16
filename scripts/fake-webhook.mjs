// Pretends to be Paystack: sends a correctly signed "charge.success" for an unpaid order or cart group.
// Start the server with SKIP_VERIFY=1 (test mode only) so it does not call Paystack to confirm the fake payment.
// Usage: PAYSTACK_SECRET_KEY=sk_test_... node scripts/fake-webhook.mjs <orderId-or-groupId> [--amount=<kobo>] [--forge]
import { createHmac } from 'node:crypto';
const args = process.argv.slice(2), id = args.find(a => !a.startsWith('--')), forge = args.includes('--forge'), key = process.env.PAYSTACK_SECRET_KEY, amt = args.find(a => a.startsWith('--amount='));
if (!id || !key) { console.log('Usage: PAYSTACK_SECRET_KEY=sk_test_... node scripts/fake-webhook.mjs <orderId-or-groupId> [--amount=<kobo>] [--forge]'); process.exit(1); }
let amount = amt ? +amt.slice(9) : 0;
if (!amount) { // work the total out from the local SQLite database
  try { const { DatabaseSync } = await import('node:sqlite'), d = new DatabaseSync(process.env.DB_FILE || './shopnex.db'); amount = d.prepare('SELECT data FROM orders').all().map(r => JSON.parse(r.data)).filter(o => (o.group === id || o.id === id) && o.status === 'AWAITING_PAYMENT').reduce((a, o) => a + o.price + o.fee, 0); d.close(); } catch {}
}
if (!amount) { console.log('Could not work out the amount. Add --amount=<kobo>: the checkout total in naira times 100.'); process.exit(1); }
const body = JSON.stringify({ event: 'charge.success', data: { reference: 'fake_' + id + '_' + Date.now(), amount, metadata: id[0] === 'g' ? { group: id } : { orderId: id } } });
const sig = forge ? 'forged' : createHmac('sha512', key).update(body).digest('hex');
const r = await fetch('http://localhost:' + (process.env.PORT || 3000) + '/webhooks/paystack', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sig }, body });
console.log(r.status, await r.text(), `(total ${amount / 100} naira)`);
