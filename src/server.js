import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Escrow, CFG, fail } from './escrow.js';
import { Market, PLANS, BOOSTS, CATEGORIES } from './market.js';
import { init, validSignature, mode, verifyTransaction } from './provider.js';
import { openStore } from './store.js';
import { settle } from './payments.js';
import { clientIp, productionProblems } from './config.js';
import { saveImage, removeImage } from './images.js';

const PROD = process.env.NODE_ENV === 'production', FILE = process.env.DATA_FILE || './data.json', TERMII = process.env.TERMII_API_KEY;
const SECRET = process.env.APP_SECRET || (PROD ? null : 'dev-secret');
const SKIP_VERIFY = !PROD && process.env.SKIP_VERIFY === '1', TRUST = Math.max(0, parseInt(process.env.TRUST_PROXY, 10) || 0);
if (PROD) { const { errors, warnings } = productionProblems(process.env); warnings.forEach(w => console.warn('WARNING:', w)); if (errors.length) { console.error('Cannot start in production:\n - ' + errors.join('\n - ')); process.exit(1); } }
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', ...(PROD && { 'Strict-Transport-Security': 'max-age=15552000; includeSubDomains' }) };
const store = await openStore(); // SQLite by default, Postgres when DATABASE_URL is set
const db = store.db, save = store.save;
console.log(`Database: ${store.kind}`);
const esc = new Escrow(db, save, { ...CFG, ...db.settings });
const sms = (to, text) => { // Termii adapter: untested against the live API
  if (!TERMII) { if (PROD) throw fail(503, 'SMS provider not configured.'); return console.log(`[sms mock] ${to}: ${text}`); }
  fetch('https://api.ng.termii.com/api/sms/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, from: process.env.TERMII_SENDER || 'ShopNex', sms: text, type: 'plain', channel: 'generic', api_key: TERMII }) }).catch(e => console.error('SMS failed:', e.message));
};
const mail = (to, subject, text) => { // Resend adapter: untested against the live API
  const k = process.env.RESEND_API_KEY;
  if (!k) { if (PROD) throw fail(503, 'Email provider not configured.'); return console.log(`[email mock] ${to}: ${subject}\n${text}`); }
  fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.MAIL_FROM || 'ShopNex <onboarding@resend.dev>', to, subject, text }) }).catch(e => console.error('Email failed:', e.message));
};
const market = new Market(db, esc, save, sms, mail);

const mac = b => createHmac('sha256', SECRET).update(b).digest('base64url');
const sign = p => { const b = Buffer.from(JSON.stringify(p)).toString('base64url'); return b + '.' + mac(b); };
const unsign = t => { const [b, s] = String(t).split('.'); if (!s) return null; const x = mac(b);
  if (x.length !== s.length || !timingSafeEqual(Buffer.from(x), Buffer.from(s))) return null;
  const p = JSON.parse(Buffer.from(b, 'base64url')); return p.exp > Date.now() ? p : null; };
const issue = user => ({ token: sign({ id: user.id, tv: user.tv || 0, exp: Date.now() + 864e5 }), user: market.publicUser(user) });
const read = req => new Promise((ok, no) => { let d = ''; req.on('data', c => { d += c; if (d.length > 1e6) { no(fail(413, 'Body too large.')); req.destroy(); } }); req.on('end', () => ok(d)); });
const hits = new Map(), limited = (k, max) => { const t = Date.now(), a = (hits.get(k) || []).filter(x => x > t - 6e4); a.push(t); hits.set(k, a); return a.length > max; };
setInterval(() => { const t = Date.now() - 6e4; for (const [k, a] of hits) if (!a.length || a[a.length - 1] < t) hits.delete(k); }, 6e4).unref();

const PUB = path.resolve(import.meta.dirname, '../public'), MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const UPLOADS = path.resolve(process.env.UPLOAD_DIR || './uploads'), IMG = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
function serve(p, res) {
  if (p === '/admin' || p === '/admin/') p = '/'; // the admin page is the same app; its sign-in page lives at /admin
  const up = /^\/uploads\/([a-f0-9-]+\.(jpg|png|webp))$/.exec(p); // product photos
  if (up) { const f = path.join(UPLOADS, up[1]); if (!fs.existsSync(f)) return false; res.writeHead(200, { 'Content-Type': IMG[up[2]], ...SEC, 'Cache-Control': 'public, max-age=86400' }); fs.createReadStream(f).pipe(res); return true; } // the web app lives in /public; everything else is the JSON API
  const f = path.resolve(PUB, '.' + (p === '/' ? '/index.html' : p));
  if (!f.startsWith(PUB + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return false;
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', ...SEC, 'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'" });
  fs.createReadStream(f).pipe(res); return true;
}
const routes = [];
const route = (method, path, roles, fn) => routes.push({ method, roles, fn, re: new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[\\w+.-]+)') + '$') });
const ev = (o, t) => { market.notify(o.buyer, t); market.notify(o.seller, t); };
const view = (u, o) => { if (!(u.role === 'admin' || o.buyer === u.id || o.seller === u.id || o.rider === u.id)) throw fail(403, 'Not your order.'); return esc.view(o, o.buyer === u.id && o.status !== 'AWAITING_PAYMENT'); };
const mine = (u, id) => { const o = esc.get(id); if (o.rider !== u.id) throw fail(403, 'This delivery is assigned to another rider.'); return o; };
const adm = ['admin'];

// public
route('GET', '/health', null, () => ({ ok: true, provider: mode }));
route('GET', '/categories', null, () => CATEGORIES);
route('GET', '/plans', null, () => ({ plans: Object.fromEntries(Object.entries(PLANS).map(([k, v]) => [k, { price: v.price, limit: v.limit === Infinity ? null : v.limit }])), boosts: BOOSTS }));
route('GET', '/products', null, ({ q }) => market.listProducts({ category: q.get('category'), q: q.get('q') }));
route('GET', '/products/:id', null, ({ p }) => { const x = db.products[p.id]; if (!x || x.hidden) throw fail(404, 'Product not found.'); return x; });
route('POST', '/auth/signup', null, async ({ b }) => { const code = await market.signup(b); return { sent: true, ...(!PROD && !TERMII ? { devCode: code } : {}) }; });
route('POST', '/auth/signup/verify', null, ({ b }) => { const user = market.completeSignup(b.phone, b.code); return user.status === 'pending' ? { pending: true } : issue(user); });
route('POST', '/auth/login', null, async ({ b }) => {
  const user = await market.login(b.identifier, b.password); if (user.role !== 'admin') return issue(user);
  const t = market.startTwoFactor(user); // admins always need a second step
  return { twofa: true, method: t.method, challenge: sign({ id: user.id, kind: '2fa', exp: Date.now() + 3e5 }), ...(t.devCode && !PROD && !TERMII ? { devCode: t.devCode } : {}) };
});
route('POST', '/auth/2fa', null, ({ b }) => { const t = unsign(b.challenge); if (!t || t.kind !== '2fa') throw fail(401, 'Your login session expired. Log in again.'); return issue(market.finishTwoFactor(market.user(t.id), b.code)); });
route('POST', '/auth/forgot', null, ({ b }) => { const code = market.forgot(b.phone); return { sent: true, ...(!PROD && !TERMII && code ? { devCode: code } : {}) }; });
route('POST', '/auth/reset', null, async ({ b }) => market.reset(b.phone, b.code, b.password));
route('POST', '/auth/otp', null, ({ b }) => { const code = market.requestOtp(b.phone); return { sent: true, ...(!PROD && !TERMII ? { devCode: code } : {}) }; });
route('POST', '/auth/verify', null, ({ b }) => { const user = market.verifyOtp(b.phone, b.code); return issue(user); });
// any signed-in user
route('GET', '/me', [], ({ u }) => market.publicUser(u));
route('POST', '/me/email', [], ({ u, b }) => market.publicUser(market.setEmail(u.id, b.email)));
route('POST', '/me/email/send', [], ({ u }) => { const code = market.sendEmailCode(u.id); return { sent: true, ...(!PROD && !process.env.RESEND_API_KEY ? { devCode: code } : {}) }; });
route('POST', '/me/email/verify', [], ({ u, b }) => market.verifyEmail(u.id, b.code));
route('POST', '/me/password', [], async ({ u, b }) => issue(await market.changePassword(u.id, b.current, b.next)));
route('POST', '/me/signout-everywhere', [], ({ u }) => issue(market.signOutEverywhere(u.id)));
route('POST', '/me/2fa/setup', ['admin'], ({ u }) => market.twoFactorSetup(u.id));
route('POST', '/me/2fa/enable', ['admin'], ({ u, b }) => market.twoFactorEnable(u.id, b.code));
route('POST', '/me/2fa/disable', ['admin'], ({ u, b }) => market.twoFactorDisable(u.id, b.password));
route('GET', '/me/notifications', [], ({ u }) => db.outbox.filter(n => n.to === u.id).slice(-50));
route('POST', '/complaints', [], ({ u, b }) => market.addComplaint(u.id, b.text));
route('GET', '/orders/:id', [], ({ u, p }) => view(u, esc.get(p.id)));
// buyer
route('GET', '/me/orders', ['buyer'], ({ u }) => Object.values(db.orders).filter(o => o.buyer === u.id).map(o => view(u, o)));
route('POST', '/orders', ['buyer'], async ({ u, b }) => { const o = market.checkout(u.id, b); return { order: view(u, o), payment: await init(o.id, o.price + o.fee, { orderId: o.id }, b.email || 'buyer@example.com') }; });
route('POST', '/dev/pay/:id', ['buyer'], ({ u, p }) => { if (PROD || mode !== 'mock') throw fail(404, 'Not found.'); const o = esc.get(p.id); if (o.buyer !== u.id) throw fail(403, 'Not your order.'); esc.fund(o.id, 'mock_' + o.id, o.price + o.fee); ev(o, `Order #${o.id} is paid and held in escrow.`); return view(u, o); });
// seller
route('POST', '/seller/apply', ['buyer', 'seller'], ({ u, b }) => market.apply(u.id, b));
route('GET', '/seller/dashboard', ['seller'], ({ u }) => market.sellerDash(u.id));
route('POST', '/seller/products', ['seller'], ({ u, b }) => market.addProduct(u.id, b));
route('POST', '/seller/products/:id/image', ['seller'], ({ u, p, b }) => {
  const x = db.products[p.id]; if (!x || x.seller !== u.id) throw fail(404, 'Product not found.');
  const name = saveImage(b.image, UPLOADS); removeImage(UPLOADS, x.image); x.image = '/uploads/' + name; save(); return x;
});
route('POST', '/seller/plan', ['seller'], ({ u, b }) => market.buyPlan(u.id, b.plan));
route('POST', '/seller/boost', ['seller'], ({ u, b }) => market.buyBoost(u.id, b.pack));
route('POST', '/orders/:id/dispatch', ['seller', 'admin'], ({ u, p, b }) => { const o = esc.get(p.id); if (u.role === 'seller' && o.seller !== u.id) throw fail(403, 'Not your order.'); market.rider(b.riderId); esc.dispatch(o.id, b.riderId); ev(o, `Order #${o.id} is out for delivery.`); return view(u, o); });
// rider
route('GET', '/rider/orders', ['rider'], ({ u }) => Object.values(db.orders).filter(o => o.rider === u.id).map(o => view(u, o)));
route('POST', '/orders/:id/confirm', ['rider'], ({ u, p, b }) => { const o = mine(u, p.id); esc.confirm(o.id, b.code); ev(o, `Order #${o.id} delivered. Payment released.`); return view(u, o); });
route('POST', '/orders/:id/reject', ['rider'], ({ u, p, b }) => { const o = mine(u, p.id); esc.reject(o.id, b.reason); ev(o, `Order #${o.id} was rejected (${o.status}).`); return view(u, o); });
// cart, lists for portals
route('POST', '/checkout', ['buyer'], async ({ u, b }) => { const { group, orders } = market.checkoutCart(u.id, b), total = orders.reduce((a, o) => a + o.price + o.fee, 0); return { group, total, orders: orders.map(o => view(u, o)), payment: await init(group, total, { group }, b.email || 'buyer@example.com') }; });
route('POST', '/payments/verify', ['buyer'], async ({ u, b }) => { // called when the buyer returns from Paystack, in case the webhook is slow
  const { orders, fresh } = await settle({ esc, reference: b.reference, owner: u.id, verify: verifyTransaction });
  fresh.forEach(o => ev(o, `Order #${o.id} is paid and held in escrow.`)); return orders.map(o => view(u, o));
});
route('POST', '/dev/pay-group/:g', ['buyer'], ({ u, p }) => { if (PROD || mode !== 'mock') throw fail(404, 'Not found.'); const os = Object.values(db.orders).filter(o => o.group === p.g); if (!os.length || os.some(o => o.buyer !== u.id)) throw fail(403, 'Not your order.'); esc.fundGroup(p.g, 'mock_' + p.g, os.filter(o => o.status === 'AWAITING_PAYMENT').reduce((a, o) => a + o.price + o.fee, 0)); os.forEach(o => ev(o, `Order #${o.id} is paid and held in escrow.`)); return os.map(o => view(u, o)); });
route('GET', '/riders', ['seller', 'admin'], () => Object.values(db.users).filter(x => x.role === 'rider' && x.status === 'active').map(x => ({ id: x.id, phone: x.phone })));
route('GET', '/seller/products', ['seller'], ({ u }) => Object.values(db.products).filter(x => x.seller === u.id));
route('GET', '/admin/sellers', ['admin'], () => Object.values(db.sellers).map(s => ({ ...s, phone: db.users[s.id]?.phone, balance: esc.balance('seller:' + s.id) })));
route('GET', '/admin/products', ['admin'], () => Object.values(db.products).map(x => ({ ...x, shop: esc.seller(x.seller).shopName })));
// admin
route('POST', '/orders/:id/rule', adm, ({ u, p, b }) => { const o = esc.rule(p.id, b.ruling); market.audit(u.id, 'Dispute ruling: ' + b.ruling, o.id); ev(o, `Dispute on order #${o.id} was ruled for the ${b.ruling}.`); return view(u, o); });
route('GET', '/admin/summary', adm, () => market.summary());
route('GET', '/admin/ledger', adm, () => db.ledger.slice(-500));
route('GET', '/admin/orders', adm, () => Object.values(db.orders).map(o => esc.view(o)));
route('GET', '/admin/users', adm, () => Object.values(db.users).map(x => market.publicUser(x)));
route('GET', '/admin/kyc', adm, () => Object.values(db.kyc));
route('GET', '/admin/audit', adm, () => db.audit.slice(0, 200));
route('GET', '/admin/complaints', adm, () => Object.values(db.complaints));
route('GET', '/admin/coupons', adm, () => Object.values(db.coupons));
route('GET', '/admin/settings', adm, () => market.getSettings());
route('GET', '/admin/payouts', adm, () => Object.values(db.payouts));
route('POST', '/admin/kyc/:uid', adm, ({ u, p, b }) => market.reviewKyc(u.id, p.uid, !!b.approve));
route('POST', '/admin/users/:uid', adm, ({ u, p, b }) => market.setUser(u.id, p.uid, b));
route('POST', '/admin/sellers/:uid', adm, ({ u, p, b }) => market.setSeller(u.id, p.uid, b));
route('POST', '/admin/products/:id', adm, ({ u, p, b }) => market.setProduct(u.id, p.id, b));
route('POST', '/admin/coupons', adm, ({ u, b }) => market.createCoupon(u.id, b.code, b.pct));
route('DELETE', '/admin/coupons/:code', adm, ({ u, p }) => market.deleteCoupon(u.id, p.code));
route('POST', '/admin/complaints/:id/resolve', adm, ({ u, p }) => market.resolveComplaint(u.id, p.id));
route('POST', '/admin/settings', adm, ({ u, b }) => market.updateSettings(u.id, b));
route('POST', '/admin/payouts/run', adm, ({ u }) => market.runPayouts(u.id));
route('POST', '/admin/payouts/:id/paid', adm, ({ u, p }) => market.markPaid(u.id, p.id));

const server = http.createServer(async (req, res) => {
  const cors = process.env.ALLOWED_ORIGIN;
  const t0 = Date.now();
  const send = async (code, body) => { // the database write is committed before the reply goes out
    try { await store.flush(); } catch (e) { console.error('DATABASE WRITE FAILED:', e); code = 503; body = { error: 'We could not save that. Please try again.' }; setTimeout(() => process.exit(1), 300); } // restart so memory matches the database
    res.writeHead(code, { 'Content-Type': 'application/json', ...SEC, ...(cors && { 'Access-Control-Allow-Origin': cors, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS' }) });
    res.end(body === undefined ? '' : JSON.stringify(body));
    if (PROD) console.log(JSON.stringify({ t: new Date().toISOString(), m: req.method, p: req.url.split('?')[0], s: code, ms: Date.now() - t0 }));
  };
  try {
    const url = new URL(req.url, 'http://x'), p = url.pathname, m = req.method, ip = clientIp(req, TRUST);
    if (m === 'OPTIONS') return send(204);
    const lim = [limited('g' + ip, 300), p.startsWith('/auth/') && limited('a' + ip, +process.env.AUTH_RATE || 10)];
    if (lim.some(Boolean)) return send(429, { error: 'Too many requests. Slow down.' });
    const raw = await read(req);
    if (p === '/webhooks/paystack' && m === 'POST') {
      if (!validSignature(raw, req.headers['x-paystack-signature'])) return send(401, { error: 'Bad signature.' });
      const e = JSON.parse(raw);
      if (e.event === 'charge.success') try {
        const verify = SKIP_VERIFY ? async () => ({ status: 'success', amount: e.data.amount, reference: e.data.reference, currency: 'NGN', metadata: e.data.metadata }) : verifyTransaction;
        const { fresh } = await settle({ esc, verify, reference: e.data.reference }); fresh.forEach(o => ev(o, `Order #${o.id} is paid and held in escrow.`));
      } catch (x) { if (x.status !== 409) throw x; } // already paid or not final yet: answer 200 so Paystack stops retrying
      return send(200, { ok: true });
    }
    const r = routes.find(x => x.method === m && x.re.test(p));
    if (!r) { if (m === 'GET' && serve(p, res)) return; return send(404, { error: 'Not found.' }); }
    let u = null;
    if (r.roles) {
      const t = unsign((req.headers.authorization || '').replace('Bearer ', '')); u = t && !t.kind && (t.tv || 0) === (db.users[t.id]?.tv || 0) ? db.users[t.id] : null;
      if (!u) return send(401, { error: 'Sign in first.' });
      if (u.status !== 'active') return send(403, { error: 'Your account is suspended.' });
      if (r.roles.length && !r.roles.includes(u.role)) return send(403, { error: 'Not allowed for your role.' });
    }
    send(200, await r.fn({ u, b: raw ? JSON.parse(raw) : {}, p: p.match(r.re).groups || {}, q: url.searchParams }));
  } catch (e) { const known = e.status || e instanceof SyntaxError; send(e.status || (e instanceof SyntaxError ? 400 : 500), { error: known ? e.message : 'Something went wrong.' }); if (!known) console.error(e); }
}).listen(process.env.PORT || 3000, () => console.log(`ShopNex backend on :${process.env.PORT || 3000} (payments: ${mode}${SKIP_VERIFY ? ', payment verification OFF' : ''})`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { server.close(); try { await store.flush(); await store.close(); } catch (e) { console.error(e); } process.exit(0); });
