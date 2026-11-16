import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Escrow } from '../src/escrow.js';
const P = 5000000;
const fresh = () => { const e = new Escrow({}); return { e, o: e.createOrder({ buyer: 'b1', seller: 's1', price: P }) }; };
const out = () => { const { e, o } = fresh(); e.fund(o.id, 'r1', o.price + o.fee); e.dispatch(o.id); return { e, o }; };

test('payment locks money in escrow and the ledger balances', () => {
  const { e, o } = fresh(); e.fund(o.id, 'r1', o.price + o.fee);
  assert.equal(e.balance('escrow'), o.price + o.fee); assert.ok(e.verify().balanced);
});
test('wrong amount is rejected and duplicate payment reports are ignored', () => {
  const { e, o } = fresh();
  assert.throws(() => e.fund(o.id, 'r1', 1), /does not match/);
  e.fund(o.id, 'r1', o.price + o.fee); e.fund(o.id, 'r1', o.price + o.fee);
  assert.equal(e.balance('escrow'), o.price + o.fee);
});
test('correct code pays the seller minus commission and empties escrow', () => {
  const { e, o } = out(); e.confirm(o.id, o.code);
  assert.equal(e.balance('seller:s1'), P * 0.9); assert.equal(e.balance('platform'), P * 0.1);
  assert.equal(e.balance('rider:unassigned'), o.fee); assert.equal(e.balance('escrow'), 0);
  assert.equal(e.seller('s1').trust, 81); assert.ok(e.verify().balanced);
});
test('five wrong codes lock the order even if the right code follows', () => {
  const { e, o } = out(); const wrong = o.code === '0000' ? '1111' : '0000';
  for (let i = 0; i < 5; i++) assert.throws(() => e.confirm(o.id, wrong), /Wrong code/);
  assert.throws(() => e.confirm(o.id, o.code), /locked/); assert.equal(e.balance('seller:s1'), 0);
});
test('rejected but fine: buyer refunded the price, rider keeps the fee', () => {
  const { e, o } = out(); e.reject(o.id, 'fine');
  assert.equal(e.balance('buyer-refund'), P); assert.equal(e.balance('escrow'), 0);
  assert.equal(e.balance('seller:s1'), -o.fee); assert.ok(e.verify().balanced);
});
test('damaged freezes funds; buyer ruling refunds in full and penalises the seller', () => {
  const { e, o } = out(); e.seller('s1').trust = 70; e.reject(o.id, 'damaged');
  assert.equal(e.balance('escrow'), o.price + o.fee); assert.throws(() => e.confirm(o.id, o.code), /DISPUTED/);
  e.rule(o.id, 'buyer');
  assert.equal(e.balance('buyer-refund'), o.price + o.fee); assert.equal(e.balance('seller:s1'), -(o.fee * 2 + 500000));
  assert.equal(e.seller('s1').trust, 50); assert.equal(e.seller('s1').status, 'suspended'); assert.ok(e.verify().balanced);
  assert.throws(() => e.createOrder({ buyer: 'b', seller: 's1', price: P }), /cannot take orders/);
});
test('seller ruling releases payment, rulings only work on disputes', () => {
  const { e, o } = out(); assert.throws(() => e.rule(o.id, 'buyer'), /needs DISPUTED/);
  e.reject(o.id, 'damaged'); e.rule(o.id, 'seller'); assert.equal(e.balance('seller:s1'), P * 0.9); assert.ok(e.verify().balanced);
});
test('webhook signatures: valid accepted, forged rejected', async () => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_abc';
  const { validSignature } = await import('../src/provider.js'); const raw = '{"event":"charge.success"}';
  assert.ok(validSignature(raw, createHmac('sha512', 'sk_test_abc').update(raw).digest('hex')));
  assert.ok(!validSignature(raw, '00'));
});
