import test from 'node:test';
import assert from 'node:assert/strict';
import { Escrow } from '../src/escrow.js';
import { settle } from '../src/payments.js';
const setup = () => {
  const esc = new Escrow({}), a = esc.createOrder({ buyer: 'b1', seller: 's1', price: 1000000 }), b = esc.createOrder({ buyer: 'b1', seller: 's2', price: 500000 });
  a.group = b.group = 'g1'; const total = a.price + a.fee + b.price + b.fee;
  return { esc, a, b, total, ok: (over = {}) => async () => ({ status: 'success', amount: total, reference: 'ref1', currency: 'NGN', metadata: { group: 'g1' }, ...over }) };
};
test('a confirmed payment funds every order in the cart, once', async () => {
  const { esc, a, b, ok } = setup(), r = await settle({ esc, verify: ok(), reference: 'ref1', owner: 'b1' });
  assert.equal(r.fresh.length, 2); assert.equal(a.status, 'FUNDED'); assert.equal(b.status, 'FUNDED'); assert.ok(esc.verify().balanced);
  const again = await settle({ esc, verify: ok(), reference: 'ref1', owner: 'b1' }); assert.equal(again.fresh.length, 0); assert.equal(esc.balance('escrow'), r.orders.reduce((x, o) => x + o.price + o.fee, 0));
});
test('unpaid, wrong-amount, wrong-currency and other-account payments are refused', async () => {
  const { esc, ok } = setup();
  await assert.rejects(settle({ esc, verify: ok({ status: 'abandoned' }), reference: 'r' }), /not successful/);
  await assert.rejects(settle({ esc, verify: ok({ amount: 1 }), reference: 'r' }), /does not match/);
  await assert.rejects(settle({ esc, verify: ok({ currency: 'USD' }), reference: 'r' }), /currency/);
  await assert.rejects(settle({ esc, verify: ok(), reference: 'r', owner: 'someone-else' }), /another account/);
  await assert.rejects(settle({ esc, verify: ok({ metadata: { group: 'nope' } }), reference: 'r' }), /No order matches/);
  assert.equal(esc.balance('escrow'), 0);
});
test('a single order payment works through its order id', async () => {
  const esc = new Escrow({}), o = esc.createOrder({ buyer: 'b1', seller: 's1', price: 700000 });
  const r = await settle({ esc, verify: async () => ({ status: 'success', amount: o.price + o.fee, reference: 'x1', currency: 'NGN', metadata: { orderId: o.id } }), reference: 'x1' });
  assert.equal(r.fresh.length, 1); assert.equal(o.status, 'FUNDED');
});
