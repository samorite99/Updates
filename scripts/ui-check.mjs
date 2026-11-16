// Drives public/app.js with a fake DOM against a running, seeded server and opens every screen of every portal.
// Usage: npm run seed && OTP_LIMIT=50 AUTH_RATE=100 ADMIN_PHONE=+2348000000001 npm start, then PORT=3000 npm run ui-check
import { totp } from '../src/totp.js';
const BASE = 'http://localhost:' + (process.env.PORT || 3000), HTML = {}, VAL = {}, toasts = [], H = {}, store = new Map(), real = fetch;
const el = s => ({ get checked() { return !!VAL[s + ':checked']; }, get value() { return VAL[s] ?? ''; }, set innerHTML(h) { HTML[s] = h; }, get innerHTML() { return HTML[s] ?? ''; }, set textContent(t) { if (s === '#toast') toasts.push(t); }, set className(c) {}, scrollTo() {}, focus() {} });
globalThis.document = { querySelector: el, addEventListener: (t, f) => (H[t] = f) };
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.location = {}; globalThis.fetch = (u, o) => real(BASE + u, o);
await import('../public/app.js'); const wait = () => new Promise(r => setTimeout(r, 80));
const click = async (act, id = '') => { await H.click({ target: { closest: () => ({ dataset: { act, id } }) } }); await wait(); };
const bad = []; const check = n => { const h = HTML['#root'] || ''; if (!h || /undefined|NaN|\[object/.test(h) || (/^(signup|login|forgot)/.test(n) && /class="col aa"/.test(h))) bad.push(n); console.log((bad.includes(n) ? 'FAIL ' : 'ok   ') + n); };
const code6 = () => /code is (\d{6})/.exec(HTML['#root'])?.[1];
const signIn = async phone => { await click('amode', 'otp'); VAL['#op'] = phone; await click('otp'); VAL['#cd'] = code6(); await click('otpverify'); await wait(); };
const tour = async (views, name) => { for (const v of views) { await click('go', v); check(`${name}: ${v}`); } };
const ADMIN = process.env.ADMIN_PHONE || '+2348000000001';
const adminIn = async secret => { await click('amode', 'login'); VAL['#li'] = ADMIN; VAL['#lp'] = 'Demo@1234'; await click('login'); await wait(); VAL['#tf'] = secret ? totp(secret, Date.now() + 30000) : code6(); await click('twofa'); await wait(); };
const out = async () => { await click('logout'); };
await wait();
// buyer: cart, coupon, pay
await signIn('+2348300000009'); await tour(['home', 'cart', 'orders', 'notes', 'apply', 'account', 'help'], 'buyer'); await click('go', 'home');
const ids = [...new Set([...HTML['#root'].matchAll(/data-act="open" data-id="(\w+)"/g)].map(m => m[1]))];
for (const id of ids.slice(0, 2)) { await click('open', id); await click('addcart', id); } await click('go', 'cart'); VAL['#cpn'] = 'NEX10'; await click('review'); check('buyer: review');
const group = /data-act="pay" data-id="(g\w+)"/.exec(HTML['#root'])?.[1]; await click('pay', group); check('buyer: orders after pay');
const codes = [...HTML['#root'].matchAll(/class="codebox">(\d{4})/g)].map(m => m[1]), oids = [...HTML['#root'].matchAll(/class="mono">#(\w{8})</g)].map(m => m[1]); await out();
// seller: dispatch every paid order
for (const phone of ['+2348100000001', '+2348100000002', '+2348100000003', '+2348100000004']) {
  await signIn(phone); await tour(['s_over', 's_prod', 's_ord', 's_plan', 'notes', 'account'], 'seller');
  await click('go', 's_ord'); for (const id of oids) { const r = /option value="(u_\w+)"/.exec(HTML['#root'])?.[1]; if (HTML['#root'].includes(`rd-${id}`)) { VAL['#rd-' + id] = r; await click('dispatch', id); } } await out();
}
// rider: confirm one order, reject another as damaged
await signIn('+2348200000001'); await tour(['r_del', 'notes', 'account'], 'rider');
VAL['#c-' + oids[0]] = codes[0]; await click('confirm', oids[0]); if (oids[1]) await click('reject', oids[1] + '|damaged'); check('rider: after actions'); await out();
// admin: every screen, then rule the dispute and run payouts
await adminIn(); await tour(NAVS_ADMIN(), 'admin');
function NAVS_ADMIN() { return ['a_dash', 'a_vend', 'a_users', 'a_prod', 'a_ord', 'a_disp', 'a_fin', 'a_cpn', 'a_cmp', 'a_set', 'a_log', 'account']; }
if (oids[1]) { await click('go', 'a_disp'); await click('rule', oids[1] + '|buyer'); } await click('payrun'); VAL['#cc'] = 'SAVE5'; VAL['#cv'] = '5'; await click('go', 'a_cpn'); await click('cpnadd'); await click('go', 'a_fin'); check('admin: after payouts');
await out();
// sign up and password login for all three account types
const expectToast = re => { const k = toasts.findIndex(t => re.test(t)); if (k < 0) bad.push('missing message ' + re); else toasts.splice(k, 1); };
const signup = async (role, f) => { await click('amode', 'signup'); await click('srole', role); Object.assign(VAL, { '#tc:checked': true, '#pw': 'Secret123', '#pw2': 'Secret123', '#se': '', ...f }); await click('signup'); VAL['#cd'] = code6(); await click('verifysignup'); await wait(); };
const pwLogin = async (id, pw = 'Secret123') => { await click('amode', 'login'); VAL['#li'] = id; VAL['#lp'] = pw; await click('login'); await wait(); };
await signup('buyer', { '#sn': 'Test Buyer', '#sp': '08031112222', '#se': 'tb@example.com' }); check('signup: buyer lands in the app'); await out();
await pwLogin('08031112222'); await click('go', 'account'); await click('emailsend'); VAL['#ec'] = code6(); await click('emailverify'); if (!HTML['#root'].includes('Verified')) bad.push('email not verified'); check('account: email verified');
VAL['#cp'] = 'Secret123'; VAL['#np1'] = 'Changed456'; VAL['#np2'] = 'Changed456'; await click('chpw'); await out();
await pwLogin('tb@example.com', 'Changed456'); check('login: buyer by verified email after password change'); await out();
await pwLogin('08031112222', 'wrong12345'); expectToast(/Wrong phone, email or password/);
await signup('seller', { '#sn': 'New Seller', '#sp': '08031113333', '#ss': 'New Shop', '#sb': 'Ada Obi', '#sk': 'Obi Ada' }); check('signup: seller lands in the seller portal'); await out();
await signup('rider', { '#sn': 'New Rider', '#sp': '08031114444', '#sv': 'Bike LAG-123-XY' }); await out();
await pwLogin('08031114444'); expectToast(/awaiting approval/);
await adminIn(); await click('go', 'a_users'); const pend = /data-id="(u_\w+)\|active"/.exec(HTML['#root'])?.[1]; check('admin: users list shows the pending rider'); await click('usr', pend + '|active'); await out();
await pwLogin('08031114444'); check('login: approved rider'); await out();
await click('amode', 'forgot'); VAL['#fp'] = '08031112222'; await click('forgot'); VAL['#cd'] = code6(); VAL['#np'] = 'Newpass456'; await click('reset'); await pwLogin('08031112222', 'Newpass456'); check('forgot password: reset then login'); await out();
await adminIn(); await click('go', 'account'); await click('tfsetup'); const sec = /class="secret">([A-Z2-7]{32})/.exec(HTML['#root'])?.[1]; VAL['#tcode'] = totp(sec); await click('tfenable');
if ([...HTML['#root'].matchAll(/\b[0-9a-f]{4}-[0-9a-f]{4}\b/g)].length !== 8) bad.push('recovery codes not shown'); await out();
await adminIn(sec); check('admin: login with authenticator app'); await out();
const OK = /^(Added to cart|Payment received|Dispatched|Code accepted|Recorded|Ruling applied|Batch payout queued|Coupon created|Thank you|Application sent|Product listed|Plan updated|Boost added|Done|Seller updated|User updated|Product updated|Coupon deleted|Resolved|Marked paid|Settings saved|Role updated|Account created|Password saved|Verification code sent|Email verified|Email updated|Password changed|Signed out of other devices|Two-step login is on|Two-step login is off)/;
const errs = toasts.filter(t => t && !OK.test(t)); if (errs.length) console.log('Unexpected messages:', errs);
console.log(bad.length || errs.length ? `FAILED: ${bad.length} screens, ${errs.length} messages` : 'All screens rendered and all actions worked.'); process.exit(bad.length || errs.length ? 1 : 0);
