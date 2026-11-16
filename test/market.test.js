import test from 'node:test';
import assert from 'node:assert/strict';
import { Escrow } from '../src/escrow.js';
import { Market } from '../src/market.js';
process.env.ADMIN_PHONE = '+2348000000001';
const mk = () => { const db = {}, esc = new Escrow(db); return { db, esc, m: new Market(db, esc) }; };
const login = (m, phone) => m.verifyOtp(phone, m.requestOtp(phone));
const approved = (m, phone = '+2348011111111') => { const a = login(m, process.env.ADMIN_PHONE), s = login(m, phone);
  m.apply(s.id, { shopName: 'Shop', bvnName: 'Ada Obi', bankAccountName: 'Obi Ada' }); m.reviewKyc(a.id, s.id, true); return { a, s }; };
const item = { name: 'Thing', category: 'Gadgets', price: 1000000 };

test('OTP: five wrong tries lock the code; only three requests per 10 minutes', () => {
  const { m } = mk(), ph = '+2348022222222'; m.requestOtp(ph);
  for (let i = 0; i < 5; i++) assert.throws(() => m.verifyOtp(ph, '000000'), /Wrong code/);
  assert.throws(() => m.verifyOtp(ph, '000000'), /Too many attempts/);
  m.requestOtp(ph); m.requestOtp(ph); assert.throws(() => m.requestOtp(ph), /Too many codes/);
});
test('the configured admin phone becomes admin; everyone else starts as buyer', () => {
  const { m } = mk(); assert.equal(login(m, process.env.ADMIN_PHONE).role, 'admin'); assert.equal(login(m, '+2348033333333').role, 'buyer');
});
test('KYC: unverified sellers cannot list; name mismatches are flagged; approval unlocks listing', () => {
  const { m } = mk(), a = login(m, process.env.ADMIN_PHONE), s = login(m, '+2348044444444');
  const k = m.apply(s.id, { shopName: 'Mike Stores', bvnName: 'Michael Ade', bankAccountName: 'Mike Ade' });
  assert.equal(k.nameMatch, false); assert.throws(() => m.addProduct(s.id, item), /not verified/);
  m.reviewKyc(a.id, s.id, true); assert.ok(m.addProduct(s.id, item).id);
  assert.throws(() => m.addProduct(s.id, { ...item, category: 'Cars' }), /valid category/);
});
test('plan limits, plan purchase from seller balance, and a balanced ledger', () => {
  const { m, esc } = mk(), { s } = approved(m);
  for (let i = 0; i < 20; i++) m.addProduct(s.id, item);
  assert.throws(() => m.addProduct(s.id, item), /allows 20/);
  assert.throws(() => m.buyPlan(s.id, 'Standard'), /too low/);
  esc.transfer('buyer-payment', 'seller:' + s.id, 600000, 'test credit'); m.buyPlan(s.id, 'Standard');
  assert.equal(esc.balance('platform'), 500000); assert.ok(m.addProduct(s.id, item)); assert.ok(esc.verify().balanced);
});
test('boosts and sponsored ordering use up views', () => {
  const { m, esc } = mk(), { s } = approved(m); m.addProduct(s.id, item);
  esc.transfer('buyer-payment', 'seller:' + s.id, 200000, 'credit'); m.buyBoost(s.id, 'mini');
  assert.equal(m.listProducts()[0].sponsored, true); assert.equal(esc.seller(s.id).boost, 4999);
});
test('coupon discounts the order; own products and bad coupons are refused', () => {
  const { m } = mk(), { a, s } = approved(m), b = login(m, '+2348055555555'), p = m.addProduct(s.id, item);
  m.createCoupon(a.id, 'nex10', 10); assert.equal(m.checkout(b.id, { productId: p.id, coupon: 'NEX10' }).price, 900000);
  assert.throws(() => m.checkout(b.id, { productId: p.id, coupon: 'NOPE' }), /not valid/); assert.throws(() => m.checkout(s.id, { productId: p.id }), /own product/);
});
test('rider accounts are separate and batch payouts clear balances, skip banned sellers, keep the ledger balanced', () => {
  const { m, esc } = mk(), { a, s } = approved(m), p = m.addProduct(s.id, item);
  const o = esc.createOrder({ buyer: 'b', seller: s.id, price: p.price }); esc.fund(o.id, 'r', o.price + o.fee); esc.dispatch(o.id, 'rider1'); esc.confirm(o.id, o.code);
  assert.equal(esc.balance('rider:rider1'), o.fee);
  esc.seller(s.id).status = 'banned'; assert.deepEqual(m.runPayouts(a.id).map(x => x.account), ['rider:rider1']);
  esc.seller(s.id).status = 'active'; const paid = m.runPayouts(a.id); assert.equal(paid[0].amount, 900000);
  assert.equal(Object.keys(m.db.payouts).length, 2); assert.equal(esc.balance('seller:' + s.id), 0); assert.equal(esc.balance('bank-out'), 900000 + o.fee); assert.ok(esc.verify().balanced);
});
test('settings are validated and change the commission on new releases', () => {
  const { m, esc } = mk(), { a, s } = approved(m);
  assert.throws(() => m.updateSettings(a.id, { commissionPct: 80 }), /0 to 50/); m.updateSettings(a.id, { commissionPct: 12 });
  const o = esc.createOrder({ buyer: 'b', seller: s.id, price: 1000000 }); esc.fund(o.id, 'r', o.price + o.fee); esc.dispatch(o.id, 'x'); esc.confirm(o.id, o.code);
  assert.equal(esc.balance('seller:' + s.id), 880000); assert.ok(m.db.audit.length > 0);
});

test('cart checkout: one payment funds orders from several sellers; duplicates ignored; wrong amount refused', () => {
  const { m, esc } = mk(), { s: s1 } = approved(m, '+2348011111111'), { s: s2 } = approved(m, '+2348012222222'), b = login(m, '+2348055555555');
  const p1 = m.addProduct(s1.id, item), p2 = m.addProduct(s2.id, item), { group, orders } = m.checkoutCart(b.id, { items: [p1.id, p2.id] });
  const total = orders.reduce((a, o) => a + o.price + o.fee, 0);
  assert.throws(() => esc.fundGroup(group, 'g1', total - 1), /does not match/);
  esc.fundGroup(group, 'g1', total); esc.fundGroup(group, 'g1', total);
  assert.equal(esc.balance('escrow'), total); assert.ok(orders.every(o => o.status === 'FUNDED')); assert.ok(esc.verify().balanced);
  assert.throws(() => m.checkoutCart(b.id, { items: [p1.id, 'nope'] }), /no longer available/);
});
import { normPhone, TERMS_VERSION } from '../src/market.js';
import { totp } from '../src/totp.js';
test('phone numbers are normalised to +234 format', () => {
  assert.equal(normPhone('08012345678'), '+2348012345678'); assert.equal(normPhone('2348012345678'), '+2348012345678');
  assert.equal(normPhone('+234 801 234 5678'), '+2348012345678'); assert.equal(normPhone('12'), null);
});
test('signup verifies the phone, applies seller details, blocks duplicates and weak passwords', async () => {
  const { m } = mk();
  await assert.rejects(m.signup({ acceptTerms: true, name: 'Ada Obi', phone: '08012345678', password: 'short' }), /at least 8/);
  const code = await m.signup({ acceptTerms: true, name: 'Ada Obi', phone: '08012345678', password: 'Secret123', role: 'seller', shopName: 'Ada Shop', bvnName: 'Ada Obi', bankAccountName: 'Obi Ada' });
  await assert.rejects(m.login('08012345678', 'Secret123'), /Verify your phone/); await assert.rejects(m.login('+2348099999999', 'Secret123'), /Wrong phone, email or password/);
  const u = m.completeSignup('+2348012345678', code); assert.equal(u.role, 'seller'); assert.equal(m.db.kyc[u.id].status, 'PENDING');
  await assert.rejects(m.signup({ acceptTerms: true, name: 'Other One', phone: '+2348012345678', password: 'Secret123' }), /already exists/);
  assert.equal((await m.login('+2348012345678', 'Secret123')).id, u.id); const pub = m.publicUser(u); assert.ok(!('passwordHash' in pub) && !('intent' in pub));
});
test('five wrong passwords lock the account; a code resets the password', async () => {
  const { m } = mk(), code = await m.signup({ acceptTerms: true, name: 'Tunde Bello', phone: '+2348022222222', password: 'Secret123' }), u = m.completeSignup('+2348022222222', code);
  for (let i = 0; i < 5; i++) await assert.rejects(m.login('+2348022222222', 'wrong1234'), /Wrong phone, email or password/);
  await assert.rejects(m.login('+2348022222222', 'Secret123'), /Too many wrong attempts/);
  await assert.rejects(m.reset('+2348022222222', m.forgot('+2348022222222'), 'weak'), /at least 8/);
  await m.reset('+2348022222222', m.forgot('+2348022222222'), 'Newpass456'); assert.equal((await m.login('+2348022222222', 'Newpass456')).id, u.id); assert.equal(m.forgot('+2348077777777'), null);
});
test('rider signups wait for admin approval', async () => {
  const { m } = mk(), a = login(m, process.env.ADMIN_PHONE), code = await m.signup({ acceptTerms: true, name: 'Chidi Okoro', phone: '+2348033333333', password: 'Secret123', role: 'rider', vehicle: 'Bike LAG-1' });
  const u = m.completeSignup('+2348033333333', code); assert.equal(u.status, 'pending'); await assert.rejects(m.login('+2348033333333', 'Secret123'), /awaiting approval/);
  m.setUser(a.id, u.id, { status: 'active' }); assert.equal((await m.login('+2348033333333', 'Secret123')).role, 'rider');
});

test('TOTP matches the RFC 6238 test vector', () => { assert.equal(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59000, 8), '94287082'); });
test('terms must be accepted and the acceptance is recorded', async () => {
  const { m } = mk(); await assert.rejects(m.signup({ name: 'Ada Obi', phone: '08011112222', password: 'Secret123', acceptTerms: false }), /Terms/);
  const c = await m.signup({ acceptTerms: true, name: 'Ada Obi', phone: '08011112222', password: 'Secret123' }); assert.equal(m.completeSignup('+2348011112222', c).terms.version, TERMS_VERSION);
});
test('email logins need a verified email, verified by a code', async () => {
  const { m } = mk(), c = await m.signup({ acceptTerms: true, name: 'Ada Obi', phone: '+2348011110000', email: 'Ada@Example.com', password: 'Secret123' }), u = m.completeSignup('+2348011110000', c);
  await assert.rejects(m.login('ada@example.com', 'Secret123'), /Wrong phone, email or password/);
  const ec = m.sendEmailCode(u.id); assert.throws(() => m.verifyEmail(u.id, '000000'), /Wrong code/); assert.equal(m.verifyEmail(u.id, ec).emailVerified, true);
  assert.equal((await m.login('ADA@example.com', 'Secret123')).id, u.id);
  await assert.rejects(m.signup({ acceptTerms: true, name: 'Other Person', phone: '+2348011110001', email: 'ada@example.com', password: 'Secret123' }), /email already exists/);
});
test('changing a password needs the current one and ends other sessions', async () => {
  const { m } = mk(), c = await m.signup({ acceptTerms: true, name: 'Ada Obi', phone: '+2348011110002', password: 'Secret123' }), u = m.completeSignup('+2348011110002', c);
  await assert.rejects(m.changePassword(u.id, 'wrong1234', 'Newpass456'), /current password is wrong/); await assert.rejects(m.changePassword(u.id, 'Secret123', 'Secret123'), /different/);
  await m.changePassword(u.id, 'Secret123', 'Newpass456'); assert.equal(u.tv, 1); await assert.rejects(m.login('+2348011110002', 'Secret123'), /Wrong phone/);
  assert.equal((await m.login('+2348011110002', 'Newpass456')).id, u.id); m.signOutEverywhere(u.id); assert.equal(u.tv, 2);
});
test('admins need a second step: a texted code, then an authenticator app with one-time recovery codes', async () => {
  const { m } = mk(), ph = process.env.ADMIN_PHONE, c = await m.signup({ acceptTerms: true, name: 'Root Admin', phone: ph, password: 'Secret123' }), a = m.completeSignup(ph, c);
  assert.equal(a.role, 'admin'); await assert.rejects(async () => m.verifyOtp(ph, m.requestOtp(ph)), /password and a second step/);
  let ch = m.startTwoFactor(await m.login(ph, 'Secret123')); assert.equal(ch.method, 'sms'); assert.throws(() => m.finishTwoFactor(a, '000000'), /Wrong code/); m.finishTwoFactor(a, ch.devCode);
  const s = m.twoFactorSetup(a.id); assert.throws(() => m.twoFactorEnable(a.id, '000000'), /wrong/); const { recovery } = m.twoFactorEnable(a.id, totp(s.secret)); assert.equal(recovery.length, 8); assert.equal(m.publicUser(a).twoFactor, true);
  assert.equal(m.startTwoFactor(await m.login(ph, 'Secret123')).method, 'totp');
  assert.throws(() => m.finishTwoFactor(a, totp(s.secret)), /Wrong code/); m.finishTwoFactor(a, totp(s.secret, Date.now() + 30000));
  m.finishTwoFactor(a, recovery[0]); assert.throws(() => m.finishTwoFactor(a, recovery[0]), /Wrong code/);
  await assert.rejects(m.twoFactorDisable(a.id, 'wrong1234'), /password is wrong/); await m.twoFactorDisable(a.id, 'Secret123'); assert.equal(m.publicUser(a).twoFactor, false);
});
