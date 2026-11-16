import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
// All money is whole kobo. Every ledger movement has two equal and opposite entries.
export const CFG = { rate: 0.10, premiumRate: 0.05, fee: 200000, penalty: 500000, maxAttempts: 5, ttlMs: 7 * 864e5, freezeBelow: 60, banBelow: 40 };
export const fail = (status, message) => Object.assign(new Error(message), { status });

export class Escrow {
  constructor(db = {}, save = () => {}, cfg = CFG) {
    this.db = db; this.save = save; this.cfg = cfg;
    for (const k of ['orders', 'sellers', 'refs']) db[k] ??= {};
    db.ledger ??= [];
  }
  seller(id) { return (this.db.sellers[id] ??= { id, trust: 80, status: 'active', premium: false }); }
  get(id) { const o = this.db.orders[id]; if (!o) throw fail(404, 'Order not found.'); return o; }
  #need(o, ...s) { if (!s.includes(o.status)) throw fail(409, `Order is ${o.status}; this action needs ${s.join(' or ')}.`); }
  #move(o, from, to, amount, memo = '') {
    if (!amount) return;
    for (const [account, a] of [[from, -amount], [to, amount]])
      this.db.ledger.push({ id: randomUUID(), order: o.id, account, amount: a, memo, at: Date.now() });
  }
  #penalise(s, pts) {
    s.trust = Math.max(0, s.trust - pts);
    if (s.trust < this.cfg.banBelow) s.status = 'banned';
    else if (s.trust < this.cfg.freezeBelow) s.status = 'suspended';
  }
  createOrder({ buyer, seller, price }) {
    if (!Number.isInteger(price) || price <= 0) throw fail(400, 'Price must be a positive whole number of kobo.');
    if (this.seller(seller).status !== 'active') throw fail(409, 'This seller cannot take orders right now.');
    const id = randomUUID().slice(0, 8);
    const o = { id, buyer, seller, price, fee: this.cfg.fee, status: 'AWAITING_PAYMENT', code: String(randomInt(1000, 10000)), attempts: 0, createdAt: Date.now() };
    this.db.orders[id] = o; this.save(); return o;
  }
  fund(id, ref, paid) {
    const o = this.get(id);
    if (this.db.refs[ref]) return o; // same payment reported twice: ignore
    this.#need(o, 'AWAITING_PAYMENT');
    if (paid !== o.price + o.fee) throw fail(422, 'Amount paid does not match the order total.');
    this.db.refs[ref] = id; o.ref = ref; o.status = 'FUNDED';
    this.#move(o, 'buyer-payment', 'escrow', paid, 'Payment ' + ref);
    this.save(); return o;
  }
  fundGroup(group, ref, paid) { // one payment covering several orders (multi-item cart)
    const os = Object.values(this.db.orders).filter(o => o.group === group);
    if (!os.length) throw fail(404, 'Order group not found.');
    if (this.db.refs[ref]) return os;
    const todo = os.filter(o => o.status === 'AWAITING_PAYMENT');
    if (!todo.length) throw fail(409, 'These orders are already paid.');
    if (paid !== todo.reduce((a, o) => a + o.price + o.fee, 0)) throw fail(422, 'Amount paid does not match the order total.');
    for (const o of todo) this.fund(o.id, `${ref}:${o.id}`, o.price + o.fee);
    this.db.refs[ref] = group; this.save(); return os;
  }
  dispatch(id, rider) { const o = this.get(id); this.#need(o, 'FUNDED'); o.rider = rider; o.status = 'OUT_FOR_DELIVERY'; o.expiresAt = Date.now() + this.cfg.ttlMs; this.save(); return o; }
  confirm(id, code) {
    const o = this.get(id); this.#need(o, 'OUT_FOR_DELIVERY');
    if (Date.now() > o.expiresAt) throw fail(410, 'This delivery code has expired. Contact support.');
    if (o.attempts >= this.cfg.maxAttempts) throw fail(423, 'Too many wrong codes. Order locked for admin review.');
    o.attempts++;
    const a = Buffer.from(String(code ?? '')), b = Buffer.from(o.code);
    if (a.length !== b.length || !timingSafeEqual(a, b)) { this.save(); throw fail(401, `Wrong code. ${this.cfg.maxAttempts - o.attempts} tries left.`); }
    return this.#release(o);
  }
  #release(o) {
    const s = this.seller(o.seller), cut = Math.round(o.price * (s.premium ? this.cfg.premiumRate : this.cfg.rate));
    this.#move(o, 'escrow', 'seller:' + o.seller, o.price - cut, 'Sale');
    this.#move(o, 'escrow', 'platform', cut, 'Commission');
    this.#move(o, 'escrow', 'rider:' + (o.rider || 'unassigned'), o.fee, 'Delivery fee');
    o.status = 'RELEASED'; s.trust = Math.min(100, s.trust + 1);
    this.save(); return o;
  }
  #refundKeepFee(o, note) { // item fine: buyer gets the price back, delivery fee stays with the rider, seller pays the return trip
    this.#move(o, 'escrow', 'buyer-refund', o.price, 'Refund');
    this.#move(o, 'escrow', 'rider:' + (o.rider || 'unassigned'), o.fee, 'Delivery fee');
    this.#move(o, 'seller:' + o.seller, 'rider:' + (o.rider || 'unassigned'), o.fee, 'Return trip');
    o.status = 'REFUNDED'; o.note = note;
    this.save(); return o;
  }
  reject(id, reason) {
    const o = this.get(id); this.#need(o, 'OUT_FOR_DELIVERY');
    if (reason === 'fine') return this.#refundKeepFee(o, 'Rejected, item fine');
    if (reason !== 'damaged') throw fail(400, "Reason must be 'fine' or 'damaged'.");
    o.status = 'DISPUTED'; o.reason = reason; this.save(); return o; // funds stay frozen in escrow
  }
  rule(id, ruling) {
    const o = this.get(id); this.#need(o, 'DISPUTED');
    if (ruling === 'seller') return this.#release(o);
    if (ruling === 'split') return this.#refundKeepFee(o, 'Split ruling');
    if (ruling !== 'buyer') throw fail(400, "Ruling must be 'buyer', 'seller' or 'split'.");
    this.#move(o, 'escrow', 'buyer-refund', o.price + o.fee, 'Full refund');
    this.#move(o, 'seller:' + o.seller, 'rider:' + (o.rider || 'unassigned'), o.fee * 2, 'Round trip');
    this.#move(o, 'seller:' + o.seller, 'platform', this.cfg.penalty, 'Dispute fee');
    o.status = 'REFUNDED'; o.note = 'Ruled for buyer';
    this.#penalise(this.seller(o.seller), 20);
    this.save(); return o;
  }
  transfer(from, to, amount, memo, ref = 'ops') { // non-order money movement (plans, boosts, payouts)
    if (!Number.isInteger(amount) || amount <= 0) throw fail(400, 'Amount must be a positive whole number of kobo.');
    for (const [account, a] of [[from, -amount], [to, amount]]) this.db.ledger.push({ id: randomUUID(), order: ref, account, amount: a, memo, at: Date.now() });
    this.save();
  }
  balances() { const m = {}; for (const e of this.db.ledger) m[e.account] = (m[e.account] || 0) + e.amount; return m; }
  balance(acct) { return this.db.ledger.filter(e => e.account === acct).reduce((s, e) => s + e.amount, 0); }
  verify() { // the ledger must net to zero overall and per order
    const per = {}; let all = 0;
    for (const e of this.db.ledger) { per[e.order] = (per[e.order] || 0) + e.amount; all += e.amount; }
    return { balanced: all === 0 && Object.values(per).every(v => v === 0), entries: this.db.ledger.length };
  }
  summary() {
    return { escrowHeld: this.balance('escrow'), commission: this.balance('platform'), orders: Object.keys(this.db.orders).length,
      disputes: Object.values(this.db.orders).filter(o => o.status === 'DISPUTED').length, ...this.verify() };
  }
  view(o, showCode = false) { const { code, ...rest } = o; return showCode ? o : rest; }
}
