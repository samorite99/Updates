import { createHash, randomBytes, randomInt, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { fail } from './escrow.js';
import { checkTotp, newSecret } from './totp.js';
export const TERMS_VERSION = '2026-10';
export const PLANS = { Basic: { price: 0, limit: 20 }, Standard: { price: 500000, limit: 100 }, Premium: { price: 1500000, limit: Infinity }, 'Premium Gold': { price: 3500000, limit: Infinity } };
export const BOOSTS = { mini: { price: 200000, views: 5000 }, max: { price: 700000, views: 20000 } };
export const CATEGORIES = ['Wears', 'Gadgets', 'Jewellery', 'Home Appliances', 'Food Stuffs', 'Services'];
const ROLES = ['buyer', 'seller', 'rider', 'admin'], now = () => Date.now(), uid = p => p + randomUUID().slice(0, 8);
const hash = s => createHash('sha256').update(s).digest('hex');
const words = s => new Set(String(s).toLowerCase().split(/[^a-z]+/).filter(Boolean));
const sameName = (a, b) => { const x = words(a), y = words(b), [s, l] = x.size <= y.size ? [x, y] : [y, x]; return s.size > 0 && [...s].every(w => l.has(w)); };
const SET = { commissionPct: ['rate', 0, 50, x => x / 100], premiumCommissionPct: ['premiumRate', 0, 50, x => x / 100], fee: ['fee', 0, 1e7, x => x], penalty: ['penalty', 0, 1e8, x => x], freezeBelow: ['freezeBelow', 0, 100, x => x], banBelow: ['banBelow', 0, 100, x => x] };

export const normPhone = p => { let s = String(p || '').replace(/[\s()-]/g, ''); if (/^0\d{10}$/.test(s)) s = '+234' + s.slice(1); else if (/^234\d{10}$/.test(s)) s = '+' + s; return /^\+\d{10,15}$/.test(s) ? s : null; };
const scryptP = (pw, salt) => new Promise((ok, no) => scrypt(pw, salt, 64, (e, k) => (e ? no(e) : ok(k))));
const hashPw = async pw => { const salt = randomBytes(16); return `s1$${salt.toString('hex')}$${(await scryptP(pw, salt)).toString('hex')}`; };
const checkPw = async (pw, stored) => { const [v, salt, h] = String(stored || '').split('$'); if (v !== 's1' || !h) return false; const k = await scryptP(String(pw), Buffer.from(salt, 'hex')), b = Buffer.from(h, 'hex'); return k.length === b.length && timingSafeEqual(k, b); };
const checkPassword = (pw, phone) => {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 100 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw fail(400, 'Use a password of at least 8 characters with a letter and a number.');
  if (pw.replace(/\D/g, '') === String(phone).replace(/\D/g, '')) throw fail(400, 'Your password cannot be your phone number.');
};

export class Market {
  constructor(db, esc, save = () => {}, sms = () => {}, mail = () => {}) {
    Object.assign(this, { db, esc, save, sms, mail });
    for (const k of ['users', 'products', 'coupons', 'complaints', 'kyc', 'payouts', 'otps', 'settings', 'emailCodes']) db[k] ??= {};
    for (const k of ['audit', 'outbox']) db[k] ??= [];
  }
  audit(actor, action, detail = '') { this.db.audit.unshift({ actor, action, detail, at: now() }); this.save(); }
  notify(to, text) { this.db.outbox.push({ to, text, at: now() }); }
  user(id) { const u = this.db.users[id]; if (!u) throw fail(404, 'User not found.'); return u; }
  rider(id) { const u = this.db.users[id]; if (!u || u.role !== 'rider' || u.status !== 'active') throw fail(400, 'Choose an active rider.'); return u; }

  // --- phone OTP login ---
  requestOtp(phone) {
    phone = normPhone(phone); if (!phone) throw fail(400, 'Enter a valid phone number.');
    const o = (this.db.otps[phone] ??= { sent: [] }); o.sent = o.sent.filter(t => t > now() - 6e5);
    if (o.sent.length >= (+process.env.OTP_LIMIT || 3)) throw fail(429, 'Too many codes requested. Try again in 10 minutes.');
    const code = String(randomInt(100000, 1000000)); this.sms(phone, `Your ShopNex code is ${code}. It expires in 5 minutes.`);
    o.sent.push(now()); Object.assign(o, { hash: hash(code + phone), exp: now() + 3e5, tries: 0 }); this.save(); return code;
  }
  verifyOtp(phone, code) {
    phone = normPhone(phone) || phone; this.#checkOtp(phone, code);
    let u = Object.values(this.db.users).find(x => x.phone === phone);
    if (!u) { const id = uid('u_'); u = this.db.users[id] = { id, phone, name: '', role: normPhone(process.env.ADMIN_PHONE) === phone ? 'admin' : 'buyer', status: 'active', createdAt: now() }; }
    if (u.verified === false) this.#finish(u, phone);
    if (u.status === 'pending') throw fail(403, 'Your rider application is awaiting approval.');
    if (u.status !== 'active') throw fail(403, 'Your account is suspended.');
    if (u.role === 'admin' && u.passwordHash) throw fail(403, 'Admins log in with a password and a second step.');
    this.save(); return u;
  }

  #checkOtp(phone, code) {
    const o = this.db.otps[phone]; if (!o?.hash || now() > o.exp) throw fail(401, 'Code expired. Request a new one.');
    if (o.tries >= 5) throw fail(423, 'Too many attempts. Request a new code.');
    o.tries++; if (hash(String(code) + phone) !== o.hash) { this.save(); throw fail(401, 'Wrong code.'); }
    delete o.hash;
  }
  #finish(u, phone) { // a verified signup takes on the role it asked for
    const it = u.intent || {}; u.verified = true; delete u.intent;
    if (normPhone(process.env.ADMIN_PHONE) === phone) u.role = 'admin';
    else if (it.role === 'seller') this.apply(u.id, it);
    else if (it.role === 'rider') Object.assign(u, { role: 'rider', vehicle: it.vehicle, status: 'pending' });
    this.save(); return u;
  }
  publicUser(u) { const { passwordHash, fails, lockUntil, intent, totp, totpPending, tv, ...rest } = u; return { ...rest, twoFactor: !!totp?.on }; }

  // --- sign up, password login, reset ---
  async signup({ name, phone, email, password, role = 'buyer', shopName, bvnName, bankAccountName, vehicle, acceptTerms }) {
    phone = normPhone(phone); if (!phone) throw fail(400, 'Enter a valid phone number.');
    name = String(name || '').trim(); if (name.length < 2 || name.length > 80) throw fail(400, 'Enter your full name.');
    email = String(email || '').trim().toLowerCase(); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, 'Enter a valid email address.');
    if (!['buyer', 'seller', 'rider'].includes(role)) throw fail(400, 'Choose buyer, seller or rider.');
    if (role === 'seller' && !(shopName && bvnName && bankAccountName)) throw fail(400, 'Shop name, BVN name and bank account name are required for sellers.');
    if (role === 'rider' && !String(vehicle || '').trim()) throw fail(400, 'Enter your vehicle and plate number.');
    if (acceptTerms !== true) throw fail(400, 'You must accept the Terms of Service and Privacy Policy.');
    checkPassword(password, phone);
    const users = Object.values(this.db.users), same = users.find(x => x.phone === phone);
    if (same && same.verified !== false) throw fail(409, 'An account with this phone number already exists. Log in instead.');
    if (email && users.some(x => x.email === email && x.emailVerified && x !== same)) throw fail(409, 'An account with this email already exists.');
    const id = same?.id || uid('u_'), passwordHash = await hashPw(password);
    this.db.users[id] = { ...same, id, phone, name, email, passwordHash, role: 'buyer', status: 'active', verified: false, emailVerified: false, terms: { version: TERMS_VERSION, at: now() }, createdAt: same?.createdAt || now(), intent: { role, shopName, bvnName, bankAccountName, vehicle } };
    return this.requestOtp(phone);
  }
  completeSignup(phone, code) {
    phone = normPhone(phone) || phone; const u = Object.values(this.db.users).find(x => x.phone === phone && x.verified === false);
    this.#checkOtp(phone, code); if (!u) throw fail(404, 'No pending signup for this number.'); return this.#finish(u, phone);
  }
  async login(identifier, password) {
    const id = String(identifier || '').trim(), ph = normPhone(id), em = id.toLowerCase(), bad = fail(401, 'Wrong phone, email or password.');
    const u = Object.values(this.db.users).find(x => (ph && x.phone === ph) || (x.emailVerified && x.email === em));
    if (!u || !u.passwordHash) { await hashPw('timing'); throw bad; }
    if (u.lockUntil > now()) throw fail(429, 'Too many wrong attempts. Try again in a few minutes.');
    if (!(await checkPw(password, u.passwordHash))) { u.fails = (u.fails || 0) + 1; if (u.fails >= 5) { u.lockUntil = now() + 15 * 6e4; u.fails = 0; } this.save(); throw bad; }
    u.fails = 0;
    if (u.verified === false) throw fail(403, 'Verify your phone number first. Sign up again to get a new code.');
    if (u.status === 'pending') throw fail(403, 'Your rider application is awaiting approval.');
    if (u.status !== 'active') throw fail(403, 'Your account is suspended.');
    this.save(); return u;
  }
  forgot(phone) { phone = normPhone(phone); return phone && Object.values(this.db.users).some(x => x.phone === phone && x.verified !== false) ? this.requestOtp(phone) : null; }
  async reset(phone, code, password) {
    phone = normPhone(phone) || phone; const u = Object.values(this.db.users).find(x => x.phone === phone && x.verified !== false);
    checkPassword(password, phone); this.#checkOtp(phone, code); if (!u) throw fail(400, 'Reset failed. Request a new code.');
    u.passwordHash = await hashPw(password); u.fails = 0; u.tv = (u.tv || 0) + 1; delete u.lockUntil; this.save(); return { ok: true };
  }
  async setPassword(id, password) { const u = this.user(id); checkPassword(password, u.phone); u.passwordHash = await hashPw(password); this.save(); }

  // --- email, password changes, admin second step ---
  setEmail(id, email) {
    const u = this.user(id); email = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, 'Enter a valid email address.');
    u.email = email; u.emailVerified = false; delete this.db.emailCodes[id]; this.save(); return u;
  }
  sendEmailCode(id) {
    const u = this.user(id); if (!u.email) throw fail(400, 'Add an email address first.'); if (u.emailVerified) throw fail(409, 'Your email is already verified.');
    const e = (this.db.emailCodes[id] ??= { sent: [] }); e.sent = e.sent.filter(t => t > now() - 6e5); if (e.sent.length >= 3) throw fail(429, 'Too many codes requested. Try again in 10 minutes.');
    const code = String(randomInt(100000, 1000000)); this.mail(u.email, 'Your ShopNex email code', `Your ShopNex email verification code is ${code}. It expires in 10 minutes.`);
    e.sent.push(now()); Object.assign(e, { hash: hash(code + u.email), exp: now() + 6e5, tries: 0 }); this.save(); return code;
  }
  verifyEmail(id, code) {
    const u = this.user(id), e = this.db.emailCodes[id]; if (!e?.hash || now() > e.exp) throw fail(400, 'Code expired. Request a new one.');
    if (e.tries >= 5) throw fail(423, 'Too many attempts. Request a new code.');
    e.tries++; if (hash(String(code) + u.email) !== e.hash) { this.save(); throw fail(400, 'Wrong code.'); }
    delete e.hash; if (Object.values(this.db.users).some(x => x !== u && x.email === u.email && x.emailVerified)) throw fail(409, 'That email is already verified on another account.');
    u.emailVerified = true; this.save(); return this.publicUser(u);
  }
  #bump(u) { u.fails = (u.fails || 0) + 1; if (u.fails >= 5) { u.lockUntil = now() + 15 * 6e4; u.fails = 0; } this.save(); }
  async changePassword(id, current, next) {
    const u = this.user(id); if (u.lockUntil > now()) throw fail(429, 'Too many wrong attempts. Try again in a few minutes.');
    if (!u.passwordHash || !(await checkPw(current, u.passwordHash))) { this.#bump(u); throw fail(400, 'Your current password is wrong.'); }
    checkPassword(next, u.phone); if (current === next) throw fail(400, 'Choose a different password.');
    u.passwordHash = await hashPw(next); u.fails = 0; u.tv = (u.tv || 0) + 1; this.save(); return u; // tv ends every other session
  }
  signOutEverywhere(id) { const u = this.user(id); u.tv = (u.tv || 0) + 1; this.save(); return u; }
  startTwoFactor(u) { return u.totp?.on ? { method: 'totp' } : { method: 'sms', devCode: this.requestOtp(u.phone) }; }
  finishTwoFactor(u, code) {
    if (u.lockUntil > now()) throw fail(429, 'Too many wrong attempts. Try again in a few minutes.');
    const c = String(code || '').trim().toLowerCase(); let ok = false;
    if (u.totp?.on) {
      const r = u.totp.recovery.indexOf(hash(c));
      if (r >= 0) { u.totp.recovery.splice(r, 1); ok = true; } else { const step = checkTotp(u.totp.secret, c, now(), u.totp.last); if (step != null) { u.totp.last = step; ok = true; } }
    } else { this.#checkOtp(u.phone, c); ok = true; }
    if (!ok) { this.#bump(u); throw fail(401, 'Wrong code.'); }
    u.fails = 0; this.save(); return u;
  }
  twoFactorSetup(id) {
    const u = this.user(id); if (u.role !== 'admin') throw fail(403, 'Only admins can use this.'); if (u.totp?.on) throw fail(409, 'Two-step login is already on.');
    u.totpPending = newSecret(); this.save(); return { secret: u.totpPending, uri: `otpauth://totp/ShopNex:${encodeURIComponent(u.phone)}?secret=${u.totpPending}&issuer=ShopNex` };
  }
  twoFactorEnable(id, code) {
    const u = this.user(id); if (!u.totpPending) throw fail(400, 'Start the setup first.');
    const step = checkTotp(u.totpPending, code); if (step == null) throw fail(400, 'That code is wrong. Check your authenticator app and try again.');
    const recovery = Array.from({ length: 8 }, () => { const r = randomBytes(4).toString('hex'); return r.slice(0, 4) + '-' + r.slice(4); });
    u.totp = { on: true, secret: u.totpPending, last: step, recovery: recovery.map(hash) }; delete u.totpPending;
    this.audit(id, 'Two-step login turned on'); return { recovery };
  }
  async twoFactorDisable(id, password) {
    const u = this.user(id); if (!(await checkPw(password, u.passwordHash))) throw fail(400, 'Your password is wrong.');
    delete u.totp; delete u.totpPending; this.audit(id, 'Two-step login turned off'); return this.publicUser(u);
  }

  // --- sellers, KYC, products ---
  apply(id, { shopName, bvnName, bankAccountName }) { // the provider's BVN lookup supplies bvnName; the BVN itself is never stored
    const u = this.user(id); if (!['buyer', 'seller'].includes(u.role)) throw fail(409, 'This account type cannot sell.');
    if (!shopName || !bvnName || !bankAccountName) throw fail(400, 'Shop name, BVN name and bank account name are required.');
    Object.assign(this.esc.seller(id), { shopName, plan: this.esc.seller(id).plan || 'Basic', verified: false, boost: this.esc.seller(id).boost || 0 });
    u.role = 'seller'; this.db.kyc[id] = { uid: id, status: 'PENDING', nameMatch: sameName(bvnName, bankAccountName), bvnName, bankAccountName, at: now() };
    this.save(); return this.db.kyc[id];
  }
  reviewKyc(admin, id, approve) {
    const k = this.db.kyc[id]; if (!k) throw fail(404, 'No application found.');
    k.status = approve ? 'APPROVED' : 'REJECTED'; this.esc.seller(id).verified = approve;
    this.notify(id, approve ? 'Your seller account is verified.' : 'Your seller application was not approved.'); this.audit(admin, 'KYC ' + k.status, id); return k;
  }
  addProduct(id, { name, category, price, description = '' }) {
    const s = this.esc.seller(id);
    if (!s.verified) throw fail(403, 'Your seller account is not verified yet.');
    if (s.status !== 'active') throw fail(403, `Your store is ${s.status}.`);
    if (!name || !CATEGORIES.includes(category) || !Number.isInteger(price) || price <= 0) throw fail(400, 'A name, a valid category and a price in kobo are required.');
    const limit = PLANS[s.plan || 'Basic'].limit;
    if (Object.values(this.db.products).filter(p => p.seller === id).length >= limit) throw fail(402, `Your ${s.plan} plan allows ${limit} products. Upgrade to add more.`);
    const p = { id: uid('p'), seller: id, name, category, price, description, hidden: false, featured: false, createdAt: now() };
    this.db.products[p.id] = p; this.save(); return p;
  }
  listProducts({ category, q } = {}) {
    const t = (q || '').toLowerCase(), shown = new Set();
    const rows = Object.values(this.db.products).filter(p => { const s = this.esc.seller(p.seller); return !p.hidden && s.verified && s.status === 'active' && (!category || p.category === category) && p.name.toLowerCase().includes(t); })
      .map(p => { const s = this.esc.seller(p.seller); return { ...p, sponsored: p.featured || s.boost > 0 || !!s.premium, shop: s.shopName, trust: s.trust }; });
    for (const p of rows) { const s = this.esc.seller(p.seller); if (p.sponsored && s.boost > 0 && !shown.has(s.id)) { s.boost--; shown.add(s.id); } }
    if (shown.size) this.save();
    return rows.sort((a, b) => b.sponsored - a.sponsored);
  }
  setProduct(admin, id, { hidden, featured }) {
    const p = this.db.products[id]; if (!p) throw fail(404, 'Product not found.');
    if (hidden !== undefined) p.hidden = !!hidden; if (featured !== undefined) p.featured = !!featured;
    this.audit(admin, 'Product updated', `${id} hidden=${p.hidden} featured=${p.featured}`); return p;
  }
  setSeller(admin, id, { status, trust }) {
    const s = this.esc.seller(id);
    if (status !== undefined) { if (!['active', 'suspended', 'banned'].includes(status)) throw fail(400, 'Unknown status.'); s.status = status; }
    if (trust !== undefined) { if (!Number.isInteger(trust) || trust < 0 || trust > 100) throw fail(400, 'Trust must be 0 to 100.'); s.trust = trust; }
    this.audit(admin, 'Seller updated', `${id} status=${s.status} trust=${s.trust}`); return s;
  }

  // --- money products: plans, boosts, coupons ---
  #charge(id, amount, memo) {
    if (this.esc.balance('seller:' + id) < amount) throw fail(402, 'Your balance is too low for this purchase.');
    if (amount) this.esc.transfer('seller:' + id, 'platform', amount, memo);
  }
  buyPlan(id, plan) {
    if (!PLANS[plan]) throw fail(400, 'Unknown plan.'); const s = this.esc.seller(id);
    this.#charge(id, PLANS[plan].price, 'Plan ' + plan); s.plan = plan; s.premium = /^Premium/.test(plan); this.save(); return s;
  }
  buyBoost(id, pack) {
    if (!BOOSTS[pack]) throw fail(400, 'Unknown boost pack.'); const s = this.esc.seller(id);
    this.#charge(id, BOOSTS[pack].price, 'Boost ' + pack); s.boost = (s.boost || 0) + BOOSTS[pack].views; this.save(); return s;
  }
  createCoupon(admin, code, pct) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(code) || !(pct >= 1 && pct <= 90)) throw fail(400, 'Use a code of 3 to 20 letters or digits and a discount from 1 to 90.');
    this.db.coupons[code] = { code, pct }; this.audit(admin, 'Coupon created', code); return this.db.coupons[code];
  }
  deleteCoupon(admin, code) { delete this.db.coupons[code]; this.audit(admin, 'Coupon deleted', code); return { ok: true }; }
  checkout(buyer, { productId, coupon }) {
    const p = this.db.products[productId]; if (!p || p.hidden) throw fail(404, 'Product not found.');
    if (p.seller === buyer) throw fail(409, 'You cannot buy your own product.');
    let pct = 0; if (coupon) { const c = this.db.coupons[String(coupon).toUpperCase()]; if (!c) throw fail(400, 'Coupon not valid.'); pct = c.pct; }
    const o = this.esc.createOrder({ buyer, seller: p.seller, price: Math.round(p.price * (1 - pct / 100)) });
    Object.assign(o, { productId: p.id, name: p.name, coupon: pct ? coupon.toUpperCase() : undefined }); this.save(); return o;
  }

  checkoutCart(buyer, { items, coupon }) {
    if (!Array.isArray(items) || !items.length || items.length > 20) throw fail(400, 'Add 1 to 20 items.');
    for (const id of items) { const p = this.db.products[id]; if (!p || p.hidden || this.esc.seller(p.seller).status !== 'active') throw fail(404, 'A product in your cart is no longer available.'); if (p.seller === buyer) throw fail(409, 'You cannot buy your own product.'); }
    const group = uid('g'), orders = items.map(productId => Object.assign(this.checkout(buyer, { productId, coupon }), { group }));
    this.save(); return { group, orders };
  }

  // --- accounts, complaints, payouts, settings ---
  setUser(admin, id, { role, status }) {
    const u = this.user(id); if (id === admin) throw fail(409, 'You cannot change your own account.');
    if (role !== undefined) { if (!ROLES.includes(role)) throw fail(400, 'Unknown role.'); u.role = role; }
    if (status !== undefined) { if (!['active', 'suspended'].includes(status)) throw fail(400, 'Unknown status.'); u.status = status; }
    this.audit(admin, 'User updated', `${id} role=${u.role} status=${u.status}`); return this.publicUser(u);
  }
  addComplaint(id, text) { if (!text || text.length > 1000) throw fail(400, 'Write a message of up to 1,000 characters.'); const c = { id: uid('c'), from: id, text, open: true, at: now() }; this.db.complaints[c.id] = c; this.save(); return c; }
  resolveComplaint(admin, id) { const c = this.db.complaints[id]; if (!c) throw fail(404, 'Not found.'); c.open = false; this.audit(admin, 'Complaint resolved', id); return c; }
  runPayouts(admin) { // moves seller and rider balances out of the platform; the bank transfer itself is marked paid afterwards
    const made = [];
    for (const [acct, amt] of Object.entries(this.esc.balances())) {
      const [kind, owner] = acct.split(':'); if (!['seller', 'rider'].includes(kind) || owner === 'unassigned' || amt <= 0) continue;
      if (kind === 'seller' && this.esc.seller(owner).status === 'banned') continue; // held for review
      this.esc.transfer(acct, 'bank-out', amt, 'Batch payout', 'payout');
      const id = uid('po_'), p = (this.db.payouts[id] = { id, account: acct, amount: amt, status: 'PENDING_TRANSFER', at: now() }); made.push(p);
    }
    this.audit(admin, 'Batch payout', `${made.length} payouts`); return made;
  }
  markPaid(admin, id) { const p = this.db.payouts[id]; if (!p) throw fail(404, 'Payout not found.'); p.status = 'PAID'; this.audit(admin, 'Payout paid', id); return p; }
  getSettings() { const c = this.esc.cfg; return { commissionPct: c.rate * 100, premiumCommissionPct: c.premiumRate * 100, fee: c.fee, penalty: c.penalty, freezeBelow: c.freezeBelow, banBelow: c.banBelow }; }
  updateSettings(admin, b) {
    const ch = Object.entries(SET).filter(([k]) => b[k] !== undefined);
    for (const [k, [, lo, hi]] of ch) if (typeof b[k] !== 'number' || !(b[k] >= lo && b[k] <= hi)) throw fail(400, `${k} must be a number from ${lo} to ${hi}.`);
    for (const [k, [key, , , f]] of ch) this.esc.cfg[key] = this.db.settings[key] = f(b[k]);
    this.audit(admin, 'Settings changed', Object.keys(b).join(', ')); this.save(); return this.getSettings();
  }

  // --- dashboards ---
  sellerDash(id) {
    const s = this.esc.seller(id), os = Object.values(this.db.orders).filter(o => o.seller === id);
    return { kyc: this.db.kyc[id]?.status, shop: s.shopName, verified: s.verified, trust: s.trust, status: s.status, plan: s.plan || 'Basic', boostViews: s.boost || 0,
      available: this.esc.balance('seller:' + id), heldInEscrow: os.filter(o => ['FUNDED', 'OUT_FOR_DELIVERY', 'DISPUTED'].includes(o.status)).reduce((a, o) => a + o.price, 0),
      orders: os.map(o => this.esc.view(o)), ledger: this.db.ledger.filter(e => e.account === 'seller:' + id).slice(-50) };
  }
  summary() {
    const os = Object.values(this.db.orders).filter(o => o.status === 'RELEASED'), days = {};
    for (const o of os) { const d = new Date(o.createdAt).toISOString().slice(0, 10); days[d] = (days[d] || 0) + o.price; }
    return { ...this.esc.summary(), gmv: os.reduce((a, o) => a + o.price, 0), users: Object.keys(this.db.users).length,
      pendingKyc: Object.values(this.db.kyc).filter(k => k.status === 'PENDING').length, openComplaints: Object.values(this.db.complaints).filter(c => c.open).length, dailySales: days };
  }
}
