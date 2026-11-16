// ShopNex web app: buyer, seller, rider and admin portals. Talks only to the backend API on the same origin.
// Screens follow the ShopNex design system (see style.css).
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const N = k => (k < 0 ? '-' : '') + '₦' + Math.abs(Math.round(k / 100)).toLocaleString('en-NG');
const EMO = { Wears: '👗', Gadgets: '📱', Jewellery: '💎', 'Home Appliances': '🍳', 'Food Stuffs': '🌾', Services: '🧹' };
const ICON = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h3l2.6 11.5a2 2 0 0 0 2 1.5h7.4a2 2 0 0 0 2-1.5L21 7H6"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  shield: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  out: '<path d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M17 4.5a3.5 3.5 0 0 1 0 7M22 20c0-2.5-1.5-4-4-5"/>',
  store: '<path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9h16"/>',
  msg: '<path d="M4 5h16v11H9l-5 4z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  pin: '<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
};
const ic = (n, s = 20) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none">${ICON[n] || ''}</svg>`;
const LOGO = `<span class="logo"><svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none"><path d="M8 9V7a4 4 0 0 1 8 0v2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="4" y="9" width="16" height="12" rx="3" fill="currentColor"/><circle cx="12" cy="14" r="1.6" fill="#fff"/><path d="M12 15v3" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg><span>ShopNex</span></span>`;
const ini = s => { s = String(s || '?').trim(); if (/^[+\d]/.test(s)) return s.slice(-2); return (s.split(/\s+/).map(w => w.replace(/[^A-Za-z0-9]/g, '')[0] || '').join('').slice(0, 2) || '?').toUpperCase(); };
const pic = p => p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : `<span class="em" aria-hidden="true">${EMO[p.category] || '🛍️'}</span><span>${esc(p.category || '')}</span>`;
const thumb = p => p.image ? `<img class="ph" src="${esc(p.image)}" alt="${esc(p.name)}">` : `<span class="ph">${EMO[p.category] || '🛍️'}</span>`;
const STATUS = { AWAITING_PAYMENT: ['Awaiting payment', 't-w'], FUNDED: ['Paid, waiting for dispatch', 't-i'], OUT_FOR_DELIVERY: ['Out for delivery', 't-w'], RELEASED: ['Delivered', 't-s'], DISPUTED: ['Under review', 't-d'], REFUNDED: ['Refunded', 't-n'] };
const load = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const S = { token: localStorage.getItem('nx_token'), user: null, view: 'home', cat: '', q: '', products: [], cats: [], cur: null, rv: null, d: {}, notes: [], mock: false, auth: 'login', form: {}, phone: '', hint: '', cart: load('nx_cart', []), seen: +localStorage.getItem('nx_seen') || 0 };
const STAFF = (typeof location !== 'undefined' ? location.pathname || '' : '').replace(/\/+$/, '') === '/admin';
const DEF = { buyer: 'home', seller: 's_over', rider: 'r_del', admin: 'a_dash' };
const NAVS = {
  buyer: [['home', 'Shop'], ['orders', 'Orders'], ['apply', 'Sell on ShopNex'], ['help', 'Help']],
  seller: [['s_over', 'Overview', 'grid'], ['s_ord', 'Orders', 'box'], ['s_prod', 'Products', 'tag'], ['s_plan', 'Plans and boosts', 'wallet']],
  rider: [['r_del', 'Deliveries', 'truck'], ['notes', 'Alerts', 'bell'], ['account', 'Account', 'user']],
  admin: [['a_dash', 'Dashboard', 'grid'], ['a_vend', 'Seller review', 'store'], ['a_disp', 'Disputes', 'alert'], ['a_fin', 'Payouts and ledger', 'wallet'], ['a_cmp', 'Complaints', 'msg'], ['a_ord', 'Orders', 'box'], ['a_prod', 'Products', 'tag'], ['a_users', 'Users and riders', 'users'], ['a_cpn', 'Coupons', 'tag'], ['a_set', 'Fees and rules', 'gear'], ['a_log', 'Audit log', 'list']],
};
const GENERAL = [['account', 'Account', 'user'], ['notes', 'Notifications', 'bell'], ['help', 'Help', 'help']];
const TITLES = { home: 'Shop', cart: 'Your cart', review: 'Review your order', orders: 'Your orders', notes: 'Notifications', help: 'Help and feedback', apply: 'Sell on ShopNex', account: 'Account' };
const SRC = { orders: [['x', '/me/orders']], notes: [['x', '/me/notifications']], s_over: [['x', '/seller/dashboard']], s_prod: [['x', '/seller/products']], s_ord: [['x', '/seller/dashboard'], ['r', '/riders']], s_plan: [['x', '/seller/dashboard'], ['pl', '/plans']],
  r_del: [['x', '/rider/orders']], a_dash: [['x', '/admin/summary']], a_vend: [['k', '/admin/kyc'], ['s', '/admin/sellers']], a_users: [['x', '/admin/users']], a_prod: [['x', '/admin/products']], a_ord: [['x', '/admin/orders'], ['r', '/riders']],
  a_disp: [['x', '/admin/orders']], a_fin: [['x', '/admin/summary'], ['l', '/admin/ledger'], ['p', '/admin/payouts']], a_cpn: [['x', '/admin/coupons']], a_cmp: [['x', '/admin/complaints']], a_set: [['x', '/admin/settings']], a_log: [['x', '/admin/audit']], account: [['x', '/me']] };

async function api(m, p, b) {
  const r = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json', ...(S.token && { Authorization: 'Bearer ' + S.token }) }, body: b ? JSON.stringify(b) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token && !p.startsWith('/auth')) { logout(); throw new Error('Please sign in again.'); }
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.');
  return j;
}
function toast(t) { const e = $('#toast'); e.textContent = t; e.className = 's'; clearTimeout(toast.t); toast.t = setTimeout(() => (e.className = ''), 3600); }
function logout() { localStorage.removeItem('nx_token'); Object.assign(S, { token: null, user: null, auth: 'login', form: {}, hint: '' }); render(); }
const loadProducts = async () => { const q = new URLSearchParams(); if (S.cat) q.set('category', S.cat); if (S.q) q.set('q', S.q); S.products = await api('GET', '/products?' + q); };
const unread = () => S.notes.filter(n => n.at > S.seen).length;
async function go(v) {
  S.view = v; const src = SRC[v];
  if (src) { const r = await Promise.all(src.map(([, p]) => api('GET', p))); S.d = {}; src.forEach(([k], i) => (S.d[k] = r[i])); }
  if (v === 'account') S.user = S.d.x;
  if (v === 'notes') { S.notes = S.d.x; S.seen = Date.now(); localStorage.setItem('nx_seen', S.seen); }
  render(); scrollTop();
}
const scrollTop = () => { try { window.scrollTo(0, 0); } catch { /* not in a browser */ } };
const P = async (path, b, msg) => { await api('POST', path, b); if (msg) toast(msg); await go(S.view); };

// ---- design-system building blocks ----
const B = (t, act, id = '', c = '') => {
  const k = c.split(' '), v = k.includes('r') ? 'dan' : k.includes('g') ? 'sec' : k.includes('o') ? 'gho' : 'pri';
  const z = k.includes('lg') ? ' lg' : k.includes('md') ? ' md' : '', f = k.includes('full') ? ' full' : '';
  return `<button class="btn ${v}${z}${f}" data-act="${act}" data-id="${esc(id)}">${t}</button>`;
};
const K = (l, v, sub = '', fill = false) => `<div class="kpi${fill ? ' fill' : ''}"><span class="kl">${l}</span><div class="kv">${v}</div>${sub ? `<div class="ks">${sub}</div>` : ''}</div>`;
const tag = (t, tone = 't-n') => `<span class="st ${tone}">${t}</span>`;
const st = o => { const s = STATUS[o.status] || [o.status, 't-n']; return tag(esc(s[0]), s[1]); };
const notice = (tone, title, text = '') => `<div class="notice t-${tone}">${ic(tone === 'd' || tone === 'w' ? 'alert' : tone === 's' ? 'check' : 'info')}<div>${title ? `<b>${title}</b>` : ''}${text}</div></div>`;
const tbl = (h, rows, cols) => {
  const g = cols || h.map((x, i) => (i === 0 ? 'minmax(0,1.3fr)' : x === '' ? 'minmax(110px,auto)' : 'minmax(0,1fr)')).join(' ');
  return `<div class="tbox"><div class="th" style="grid-template-columns:${g}">${h.map(x => `<span>${x}</span>`).join('')}</div>${rows.map(r => `<div class="tr" style="grid-template-columns:${g}">${r.map((c, i) => `<div${i === 0 ? ' class="b"' : ''}>${c}</div>`).join('')}</div>`).join('') || `<div class="tr mut">Nothing here yet.</div>`}</div>`;
};
const head = (title, sub = '', actions = '') => `<div class="row sp" style="flex-wrap:wrap"><div><h1 class="h1" style="font-size:32px;line-height:38px">${title}</h1>${sub ? `<p class="mut" style="font-size:15px;line-height:22px;margin-top:4px">${sub}</p>` : ''}</div>${actions ? `<div class="row" style="flex-wrap:wrap">${actions}</div>` : ''}</div>`;
const sect = (title, inner, right = '') => `<section class="col"><div class="row sp"><h2 class="h2">${title}</h2>${right}</div>${inner}</section>`;
const when = t => new Date(t).toLocaleString();
const ridOpts = r => `<option value="">Choose rider</option>` + (r || []).map(x => `<option value="${esc(x.id)}">${esc(x.phone)}</option>`).join('');
const dispatchCell = (o, r) => o.status === 'FUNDED' ? `<div class="row" style="flex-wrap:wrap;gap:8px"><select class="inp sm" style="width:auto;min-width:130px" id="rd-${esc(o.id)}" aria-label="Rider">${ridOpts(r)}</select>${B('Dispatch', 'dispatch', o.id)}</div>` : '';
const card = p => `<button class="pc" data-act="open" data-id="${esc(p.id)}"><div class="well">${p.sponsored ? '<span class="flag">Sponsored</span>' : ''}${pic(p)}</div><div class="pb"><span style="min-height:40px">${esc(p.name)}</span><span class="row mut" style="gap:4px;font-size:13px"><span style="color:var(--brand)">${ic('shield', 14)}</span>${esc(p.shop)} · trust ${esc(p.trust)}</span><span class="price">${N(p.price)}</span></div></button>`;
const fl = (id, label, type = 'text', extra = '', help = '') => `<div class="fld" style="flex:none"><label for="${id}">${label}</label><input id="${id}" class="inp" type="${type}" ${extra}>${help ? `<small>${help}</small>` : ''}</div>`;
const applyForm = () => `${head('Sell on ShopNex', 'Your BVN name must match your bank account name. ShopNex reviews every application before you can list products.')}
  ${notice('i', 'Use a separate phone number', 'Selling uses a seller account, so keep this number for shopping and apply with another one.')}
  <div class="card col" style="max-width:560px;gap:16px">${fl('shp', 'Shop name')}${fl('bvn', 'Name on your BVN')}${fl('bnk', 'Bank account name')}<div>${B('Submit application', 'apply', '', 'md')}</div></div>`;

const tl = o => {
  const steps = [['Payment held by ShopNex', 'Your money is safe until delivery'], ['Seller sends your order', 'A rider is assigned'], ['Rider enters your code', 'Only after you have checked the item'], ['Seller and rider are paid', 'Price minus commission, plus delivery fee']];
  const at = { AWAITING_PAYMENT: 0, FUNDED: 1, OUT_FOR_DELIVERY: 2, RELEASED: 4, DISPUTED: 2 }[o.status];
  if (at === undefined) return '';
  return `<ol class="tl">${steps.map(([a, b], i) => {
    const c = i < at ? 'done' : i === at ? (o.status === 'DISPUTED' ? 'bad' : 'cur') : 'todo';
    return `<li class="${c}"><span class="dot">${c === 'done' ? ic('check', 14) : ''}</span><span><b>${a}</b><small>${b}</small></span></li>`;
  }).join('')}</ol>`;
};
const VIEWS = {
  home() {
    const h = S.products.find(p => p.sponsored), showHero = h && !S.q && !S.cat;
    return `<section class="col" style="gap:16px"><label class="row" style="border:1px solid var(--line-strong);border-radius:12px;background:var(--surface);padding:0 14px;min-height:48px">${ic('search')}<input id="q" aria-label="Search products" placeholder="Search for phones, adire, rice…" value="${esc(S.q)}" style="flex:1;border:0;outline:0;background:transparent;font-size:16px;color:var(--ink);min-height:44px"></label>
      <div class="row" style="flex-wrap:wrap;gap:8px" role="group" aria-label="Categories"><button class="chip ${S.cat ? '' : 'on'}" data-act="cat" data-id="">All</button>${S.cats.map(c => `<button class="chip ${S.cat === c ? 'on' : ''}" data-act="cat" data-id="${esc(c)}">${esc(c)}</button>`).join('')}</div></section>
    ${showHero ? `<section class="panel wrap" style="padding:24px;gap:32px;align-items:center"><div class="well" style="position:relative;flex:1 1 260px;max-width:340px;border-radius:12px;overflow:hidden"><span class="flag">Sponsored</span>${pic(h)}</div><div class="col" style="flex:2 1 360px;gap:12px"><span class="ovl">Sponsored</span><h2 class="dl">${esc(h.name)}</h2><p class="row mut" style="gap:6px;font-size:15px"><span style="color:var(--brand)">${ic('shield', 16)}</span>${esc(h.shop)} · Trust score ${esc(h.trust)}</p><div class="pricel">${N(h.price)}</div><div class="row" style="flex-wrap:wrap;margin-top:8px">${B('View product', 'open', h.id, 'md')}</div></div></section>` : ''}
    ${S.products.length ? `<section class="col" style="gap:16px"><div class="row sp"><h2 class="h2">${S.q ? 'Results for “' + esc(S.q) + '”' : S.cat ? esc(S.cat) : 'All products'}</h2><span class="mut">${S.products.length} item${S.products.length === 1 ? '' : 's'}</span></div><div class="pg">${S.products.map(card).join('')}</div></section>`
      : `<div class="card col" style="align-items:center;text-align:center;padding:48px 16px"><span class="av">${ic('search')}</span><h2 class="h2">Nothing matches that search</h2><p class="mut">Try a shorter word or pick another category.</p>${B('Clear search', 'cat', '', 'g')}</div>`}
    <section class="panel col" style="padding:32px;gap:20px"><h2 class="h2">How ShopNex holds your money</h2><div class="wrap" style="gap:24px">
      <div class="col" style="flex:1 1 240px"><span class="av">${ic('lock')}</span><h3 class="h3">1. You pay, we hold it</h3><p class="mut" style="font-size:15px;line-height:22px">Your payment sits with ShopNex. The seller cannot touch it yet.</p></div>
      <div class="col" style="flex:1 1 240px"><span class="av">${ic('truck')}</span><h3 class="h3">2. The seller sends your order</h3><p class="mut" style="font-size:15px;line-height:22px">A rider is assigned and a 4-digit delivery code appears on your order page.</p></div>
      <div class="col" style="flex:1 1 240px"><span class="av" style="background:var(--success-soft);color:var(--success)">${ic('check')}</span><h3 class="h3">3. You check it, then give the code</h3><p class="mut" style="font-size:15px;line-height:22px">The seller and rider are paid only after the rider enters your code.</p></div></div></section>`;
  },
  product() {
    const p = S.cur; if (!p) return VIEWS.home();
    return `<nav class="row mut" style="gap:6px;font-size:14px;flex-wrap:wrap" aria-label="Breadcrumb"><button class="lnk" style="border:0;background:none;cursor:pointer;font:inherit" data-act="go" data-id="home">Shop</button>${ic('chev', 14)}<span>${esc(p.category)}</span>${ic('chev', 14)}<span>${esc(p.name)}</span></nav>
    <section class="wrap" style="gap:32px;align-items:flex-start"><div class="panel" style="flex:1 1 360px;padding:20px"><div class="well" style="position:relative;border-radius:12px;overflow:hidden">${pic(p)}</div></div>
      <div class="col" style="flex:1 1 380px;gap:16px"><h1 class="h1" style="font-size:32px;line-height:38px">${esc(p.name)}</h1><div class="pricel">${N(p.price)}</div>
        <div class="card row sp" style="flex-wrap:wrap;padding:16px"><div class="row"><span class="av">${ini(p.shop)}</span><div><div class="b" style="font-size:16px">${esc(p.shop)}</div><div class="row mut" style="gap:4px;font-size:13px"><span style="color:var(--brand)">${ic('shield', 14)}</span>Verified seller</div></div></div><div style="text-align:right"><div class="cap">Seller trust score</div><div class="h2 num">${esc(p.trust)} <span class="mut" style="font-size:14px;font-weight:500">/ 100</span></div></div></div>
        <p style="font-size:17px;line-height:26px">${esc(p.description) || 'Escrow-protected: the seller is paid only after you inspect the item and confirm with your 4-digit delivery code.'}</p>
        <div class="row" style="flex-wrap:wrap">${B(ic('cart') + 'Add to cart', 'addcart', p.id, 'g lg')}${B('Buy now', 'buynow', p.id, 'lg')}</div>
        ${notice('i', 'Your money stays with ShopNex', 'The seller is paid only after the rider enters your delivery code.')}</div></section>`;
  },
  cart() {
    if (!S.cart.length) return `<div class="card col" style="align-items:center;text-align:center;padding:48px 16px"><span class="av">${ic('cart')}</span><h2 class="h2">Your cart is empty</h2><p class="mut">Add something from the shop.</p>${B('Browse products', 'go', 'home', 'md')}</div>`;
    const total = S.cart.reduce((a, i) => a + i.price, 0);
    return `${head('Your cart', S.cart.length + ' item' + (S.cart.length === 1 ? '' : 's'))}
    <div class="wrap" style="align-items:flex-start"><div class="col" style="flex:2 1 420px">${S.cart.map(i => `<div class="card row" style="gap:16px;flex-wrap:wrap">${thumb(i)}<div style="flex:1 1 160px"><div class="b">${esc(i.name)}</div><div class="cap">${esc(i.category || '')}</div></div><span class="price">${N(i.price)}</span>${B('Remove', 'rmcart', i.id, 'g')}</div>`).join('')}</div>
      <div class="card col" style="flex:1 1 300px;gap:14px"><h2 class="h3">Summary</h2><div class="kv2"><span>Items</span><b class="num">${N(total)}</b></div><div class="kv2"><span class="mut">Delivery</span><span class="mut">Added at checkout</span></div>
        ${fl('cpn', 'Coupon code', 'text', 'placeholder="Optional"')}${B('Review order', 'review', '', 'lg full')}</div></div>`;
  },
  review() {
    const v = S.rv; if (!v) return VIEWS.home(); const items = v.orders.reduce((a, o) => a + o.price, 0), fee = v.orders.reduce((a, o) => a + o.fee, 0);
    return `${head('Review your order')}<div class="wrap" style="align-items:flex-start"><div class="card col" style="flex:2 1 420px">${v.orders.map(o => `<div class="kv2"><span>${esc(o.name)}</span><b class="num">${N(o.price)}</b></div>`).join('')}</div>
      <div class="card col" style="flex:1 1 300px;gap:12px"><h2 class="h3">Total</h2>${v.orders[0].coupon ? `<div>${tag('Coupon ' + esc(v.orders[0].coupon), 't-s')}</div>` : ''}<div class="kv2"><span>Items</span><span class="num">${N(items)}</span></div><div class="kv2"><span>Delivery</span><span class="num">${N(fee)}</span></div><div class="kv2"><b>Total</b><b class="pricel">${N(items + fee)}</b></div>
        ${B(v.payment.url ? 'Pay securely' : 'Pay (test mode)', 'pay', v.group, 'lg full')}${B('Cancel', 'go', 'cart', 'g full')}
        ${notice('i', 'Held in escrow', 'Each seller is paid only after you confirm delivery with that order’s code.')}</div></div>`;
  },
  orders() {
    const list = [...S.d.x].reverse();
    return `${head('Your orders', 'Share a delivery code only after you have inspected the item.', B('Refresh', 'go', 'orders', 'g'))}
    ${list.map(o => `<div class="card col" style="gap:14px"><div class="row sp" style="flex-wrap:wrap"><div><span class="mono">#${esc(o.id)}</span><div class="b" style="font-size:17px">${esc(o.name)}</div></div><div class="row">${st(o)}<span class="price">${N(o.price + o.fee)}</span></div></div>
      ${o.code && ['FUNDED', 'OUT_FOR_DELIVERY'].includes(o.status) ? `<div class="col" style="gap:6px"><span class="ovl">Your delivery code</span><div><span class="codebox">${esc(o.code)}</span></div><span class="cap">Give this code to the rider only after you have checked the item.</span></div>` : ''}
      ${tl(o)}
      ${o.status === 'AWAITING_PAYMENT' && S.mock ? `<div>${B('Pay (test mode)', 'pay', o.group || o.id, 'g')}</div>` : ''}
      ${o.note ? `<p class="mut">${esc(o.note)}</p>` : ''}${o.status === 'DISPUTED' ? notice('w', 'Your money is frozen', 'ShopNex is reviewing the rider’s report.') : ''}</div>`).join('') || `<div class="card col" style="align-items:center;text-align:center;padding:48px 16px"><span class="av">${ic('box')}</span><h2 class="h2">No orders yet</h2>${B('Start shopping', 'go', 'home', 'md')}</div>`}`;
  },
  notes() {
    const l = [...S.d.x].reverse();
    return `${head('Notifications')}${l.map(n => `<div class="card row" style="align-items:flex-start"><span class="av sm">${ic('bell', 16)}</span><div><div>${esc(n.text)}</div><div class="cap" style="margin-top:4px">${when(n.at)}</div></div></div>`).join('') || `<div class="card mut">Nothing yet.</div>`}`;
  },
  help() { return `${head('Help and feedback', 'Report a problem, a delivery issue, or suggest an improvement.')}<div class="card col" style="max-width:640px;gap:16px"><div class="fld" style="flex:none"><label for="cmp">Your message</label><textarea id="cmp" class="inp" rows="5" maxlength="1000"></textarea></div><div>${B('Send', 'complain', '', 'md')}</div></div>`; },
  apply: applyForm,
  account() {
    const u = S.user, pill = u.email ? (u.emailVerified ? tag('Verified', 't-s') : tag('Not verified', 't-w')) : '';
    return `${head('Account')}
    <div class="card col" style="gap:16px"><div class="row"><span class="av">${ini(u.name || u.phone)}</span><div><div class="b" style="font-size:17px">${esc(u.name || '—')}</div><div class="cap">${esc(u.phone)} · ${esc(u.role)}</div></div></div>
      <div class="row" style="flex-wrap:wrap"><span class="lab">Email</span>${u.email ? esc(u.email) + ' ' + pill : '<span class="mut">not added</span>'}</div>
      ${u.email && !u.emailVerified ? `<div class="row" style="flex-wrap:wrap">${B('Send verification code', 'emailsend', '', 'g')}</div>${S.emailHint ? notice('w', '', esc(S.emailHint)) : ''}<div class="row" style="flex-wrap:wrap"><input id="ec" class="inp" style="max-width:200px" inputmode="numeric" maxlength="6" placeholder="6-digit code" aria-label="Email code">${B('Verify email', 'emailverify')}</div>` : ''}
      <div class="row" style="flex-wrap:wrap"><input id="em" class="inp" style="max-width:320px" type="email" placeholder="${u.email ? 'New email address' : 'Email address'}" aria-label="Email address">${B(u.email ? 'Change email' : 'Add email', 'emailset', '', 'g')}</div></div>
    <div class="card col" style="gap:14px"><h2 class="h3">Password and sessions</h2><p class="mut" style="font-size:14px">Signed up with a code only? Sign out and use “Forgot password” to set your first password.</p>
      <div class="wrap">${fl('cp', 'Current password', 'password', 'autocomplete="current-password"')}${fl('np1', 'New password', 'password', 'autocomplete="new-password"')}${fl('np2', 'Confirm new password', 'password', 'autocomplete="new-password"')}</div>
      <div class="row" style="flex-wrap:wrap">${B('Change password', 'chpw')}${B('Sign out of all other devices', 'signall', '', 'g')}</div></div>
    ${u.role === 'admin' ? twoFactorCard(u) : ''}
    <div>${B(ic('out') + 'Sign out', 'logout', '', 'g md')}</div>`;
  },
  // ---- seller ----
  s_over() {
    const x = S.d.x; if (!x.kyc || x.kyc === 'REJECTED') return (x.kyc ? notice('d', 'Your last application was not approved', 'You can apply again.') : '') + applyForm();
    return `${head(esc(x.shop) + ' ' + (x.verified ? tag('Verified', 't-s') : tag('Application ' + esc(x.kyc.toLowerCase()), 't-w')), esc(x.plan) + ' plan', B(ic('plus') + 'Add product', 'go', 's_prod', 'md') + B('Change plan', 'go', 's_plan', 'g md'))}
    ${x.status !== 'active' ? notice('d', 'Your store is ' + esc(x.status), 'Contact support.') : ''}
    <div class="wrap">${K('Withdrawable', N(x.available), 'Leaves in the next batch payout', true)}${K('Held in escrow', N(x.heldInEscrow), 'Waiting for delivery')}${K('Trust score', esc(x.trust), 'Suspended or banned if it falls too low')}${K('Boost views left', esc(x.boostViews), 'Plan: ' + esc(x.plan))}</div>
    ${sect('Recent orders', tbl(['Order', 'Item', 'Status'], x.orders.slice(-5).reverse().map(o => ['#' + esc(o.id), esc(o.name), st(o)])), `<button class="lnk" style="border:0;background:none;cursor:pointer;font:inherit" data-act="go" data-id="s_ord">All orders</button>`)}
    ${sect('Ledger', tbl(['What', 'Amount'], x.ledger.slice(-10).reverse().map(e => [esc(e.memo), `<span class="num">${N(e.amount)}</span>`])))}`;
  },
  s_prod() {
    return `${head('Products', 'List something new, or add a photo to an existing product.')}
    <div class="card col" style="gap:14px"><h2 class="h3">List a product</h2><div class="wrap">${fl('pn', 'Product name')}<div class="fld" style="flex:1 1 220px"><label for="pc">Category</label><select id="pc" class="inp">${S.cats.map(c => `<option>${esc(c)}</option>`).join('')}</select></div>${fl('pp', 'Price (₦)', 'number', 'min="1"')}${fl('pd', 'Description (optional)')}<div class="fld"><label for="pi">Photo</label><input id="pi" class="inp" style="padding-top:9px" type="file" accept="image/jpeg,image/png,image/webp"></div></div><div>${B('List product', 'addprod', '', 'md')}</div></div>
    ${tbl(['Product', 'Category', 'Price', 'Visible', ''], S.d.x.map(p => [`<div class="row">${thumb(p)}<span>${esc(p.name)}</span></div>`, esc(p.category), `<span class="num">${N(p.price)}</span>`, p.hidden ? tag('Hidden by ShopNex', 't-d') : tag('Yes', 't-s'), B(p.image ? 'Change photo' : 'Add photo', 'photo', p.id, 'g')]), 'minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(130px,auto)')}`;
  },
  s_ord() { return `${head('Orders', 'Dispatch a paid order to a rider. The rider collects the delivery code from the buyer.')}${tbl(['Order', 'Item', 'Status', ''], S.d.x.orders.slice().reverse().map(o => ['#' + esc(o.id), esc(o.name), st(o), dispatchCell(o, S.d.r)]), 'minmax(0,.8fr) minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.6fr)')}`; },
  s_plan() {
    const x = S.d.x, pl = S.d.pl;
    return `${head('Plans and boosts', 'Paid from your withdrawable balance: <b>' + N(x.available) + '</b>. Current plan: ' + esc(x.plan) + '.')}
    ${sect('Plans', tbl(['Plan', 'Price per purchase', 'Product limit', ''], Object.entries(pl.plans).map(([k, v]) => [esc(k), `<span class="num">${N(v.price)}</span>`, v.limit ?? 'Unlimited', B('Choose', 'buyplan', k)])))}
    ${sect('Ad boosts', tbl(['Pack', 'Homepage views', 'Price', ''], Object.entries(pl.boosts).map(([k, v]) => [esc(k), v.views.toLocaleString(), `<span class="num">${N(v.price)}</span>`, B('Buy', 'buyboost', k)])))}`;
  },
  // ---- rider ----
  r_del() {
    const l = S.d.x.slice().reverse(), open = l.filter(o => o.status === 'OUT_FOR_DELIVERY').length;
    return `<h1 class="h1" style="font-size:28px;line-height:34px">Deliveries</h1>
    <div class="row sp"><h2 class="h2">Assigned to you</h2><span class="bdg" style="margin-left:0">${open}</span><span style="flex:1"></span>${B('Refresh', 'go', 'r_del', 'g')}</div>
    ${l.map(o => `<div class="card col" style="gap:12px;padding:16px"><div class="row sp"><span class="mono">#${esc(o.id)}</span>${st(o)}</div><div class="b" style="font-size:17px">${esc(o.name)}</div>
      ${o.status === 'OUT_FOR_DELIVERY' ? `<div class="fld" style="flex:none"><label for="c-${esc(o.id)}">Buyer’s 4-digit code</label><input id="c-${esc(o.id)}" class="inp" inputmode="numeric" maxlength="4" placeholder="0000" style="font-family:var(--font-mono);font-size:24px;letter-spacing:.3em;text-align:center"></div>${B('Confirm delivery', 'confirm', o.id, 'lg full')}<div class="row" style="flex-wrap:wrap">${B('Rejected: item fine', 'reject', o.id + '|fine', 'g')}${B('Rejected: damaged', 'reject', o.id + '|damaged', 'r')}</div>` : ''}</div>`).join('') || `<div class="card mut">No deliveries assigned to you yet.</div>`}
    <p class="cap" style="text-align:center">You see your fee only, never the item price.</p>`;
  },
  // ---- admin ----
  a_dash() {
    const x = S.d.x, days = Object.entries(x.dailySales).sort().slice(-14), mx = Math.max(...days.map(d => d[1]), 1);
    return `${head('Dashboard', 'How the marketplace is doing today.')}
    <div class="wrap">${K('Commission earned', N(x.commission), '', true)}${K('Sales value', N(x.gmv))}${K('Held in escrow', N(x.escrowHeld))}${K('Orders', x.orders)}${K('Users', x.users)}${K('Ledger', x.balanced ? 'Balanced' : 'NOT balanced', x.balanced ? 'Debits and credits net to ₦0' : 'Investigate now')}</div>
    <section class="card col"><h2 class="h2">Needs attention</h2><div class="row" style="flex-wrap:wrap">${B(x.pendingKyc + ' seller applications', 'go', 'a_vend', x.pendingKyc ? '' : 'g')}${B(x.disputes + ' open disputes', 'go', 'a_disp', x.disputes ? 'r' : 'g')}${B(x.openComplaints + ' open complaints', 'go', 'a_cmp', 'g')}</div></section>
    <section class="card col"><h2 class="h2">Delivered sales by day</h2><div class="bars">${days.map(d => `<i style="height:${Math.max(4, d[1] / mx * 130)}px" title="${esc(d[0])}: ${N(d[1])}"></i>`).join('') || '<span class="mut">No delivered orders yet.</span>'}</div></section>`;
  },
  a_vend() {
    const sh = Object.fromEntries(S.d.s.map(s => [s.id, s]));
    return `${head('Seller review', 'Approve seller applications and manage stores.')}
    ${sect('KYC applications', tbl(['Shop', 'BVN name', 'Bank name', 'Match', 'Status', ''], S.d.k.map(k => [esc(sh[k.uid]?.shopName), esc(k.bvnName), esc(k.bankAccountName), k.nameMatch ? tag('Yes', 't-s') : tag('Mismatch', 't-w'), esc(k.status), k.status === 'PENDING' ? `<div class="row" style="gap:8px">${B('Approve', 'kyc', k.uid + '|1')}${B('Reject', 'kyc', k.uid + '|0', 'r')}</div>` : '']), 'minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,.7fr) minmax(0,.8fr) minmax(170px,auto)'))}
    ${sect('Sellers', tbl(['Shop', 'Phone', 'Plan', 'Trust', 'Status', 'Balance', 'Actions'], S.d.s.map(s => [esc(s.shopName), esc(s.phone), esc(s.plan || 'Basic'), esc(s.trust), tag(esc(s.status), s.status === 'active' ? 't-s' : 't-d'), `<span class="num">${N(s.balance)}</span>`,
      `<div class="row" style="flex-wrap:wrap;gap:6px">${B(s.status === 'active' ? 'Suspend' : 'Reactivate', 'sel', `${s.id}|status|${s.status === 'active' ? 'suspended' : 'active'}`, 'g')}${B('Ban', 'sel', s.id + '|status|banned', 'r')}${B('Trust +10', 'sel', `${s.id}|trust|${Math.min(100, s.trust + 10)}`, 'g')}${B('Trust -10', 'sel', `${s.id}|trust|${Math.max(0, s.trust - 10)}`, 'g')}</div>`]), 'minmax(0,1fr) minmax(0,1fr) minmax(0,.7fr) minmax(0,.5fr) minmax(0,.7fr) minmax(0,.8fr) minmax(0,2fr)'))}`;
  },
  a_users() {
    return `${head('Users and riders', 'Approve riders, change roles, and suspend or reactivate accounts.')}
    ${tbl(['Name', 'Phone', 'Role', 'Status', 'Info', ''], S.d.x.map(u => [`<div class="row"><span class="av sm">${ini(u.name || u.phone)}</span><span>${esc(u.name || '—')}</span></div>`, `<span class="num mut">${esc(u.phone)}</span>`, `<select class="inp sm" data-chg="role" data-id="${esc(u.id)}" aria-label="Role">${['buyer', 'seller', 'rider', 'admin'].map(r => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select>`, tag(esc(u.status), u.status === 'active' ? 't-s' : u.status === 'pending' ? 't-w' : 't-d'), esc(u.vehicle || u.email || ''), u.id === S.user.id ? '' : B(u.status === 'active' ? 'Suspend' : u.status === 'pending' ? 'Approve' : 'Reactivate', 'usr', `${u.id}|${u.status === 'active' ? 'suspended' : 'active'}`, u.status === 'pending' ? '' : 'g')]), 'minmax(0,1.4fr) minmax(0,1.1fr) 130px minmax(0,.8fr) minmax(0,1fr) minmax(120px,auto)')}
    <p class="cap">One account has one role. Someone who shops and sells needs two phone numbers.</p>`;
  },
  a_prod() { return `${head('Products', 'Hide or feature items on the shop.')}${tbl(['Product', 'Shop', 'Price', 'Flags', ''], S.d.x.map(p => [`<div class="row">${thumb(p)}<span>${esc(p.name)}</span></div>`, esc(p.shop), `<span class="num">${N(p.price)}</span>`, (p.hidden ? tag('Hidden', 't-d') + ' ' : '') + (p.featured ? tag('Featured', 't-i') : ''), `<div class="row" style="gap:6px">${B(p.hidden ? 'Show' : 'Hide', 'prod', `${p.id}|hidden|${!p.hidden}`, 'g')}${B(p.featured ? 'Unfeature' : 'Feature', 'prod', `${p.id}|featured|${!p.featured}`, 'g')}</div>`]), 'minmax(0,1.6fr) minmax(0,1fr) minmax(0,.8fr) minmax(0,1fr) minmax(200px,auto)')}`; },
  a_ord() { return `${head('All orders')}${tbl(['Order', 'Item', 'Total', 'Status', ''], S.d.x.slice().reverse().map(o => ['#' + esc(o.id), esc(o.name), `<span class="num">${N(o.price + o.fee)}</span>`, st(o), dispatchCell(o, S.d.r)]), 'minmax(0,.7fr) minmax(0,1.3fr) minmax(0,.8fr) minmax(0,1.1fr) minmax(0,1.6fr)')}`; },
  a_disp() {
    const L = S.d.x.filter(o => o.status === 'DISPUTED');
    return `${head('Disputes', 'Funds only freeze after a rider reports a problem.')}${L.map(o => `<div class="card col"><div class="row sp" style="flex-wrap:wrap"><div><span class="mono">#${esc(o.id)}</span><div class="b" style="font-size:17px">${esc(o.name)}</div></div>${tag('Rider report: ' + esc(o.reason), 't-d')}</div><div class="row" style="flex-wrap:wrap">${B('Rule for buyer', 'rule', o.id + '|buyer')}${B('Split (item fine)', 'rule', o.id + '|split', 'g')}${B('Rule for seller', 'rule', o.id + '|seller', 'g')}</div>${notice('i', 'What each ruling does', 'Buyer: full refund, seller pays the round trip and dispute fee, trust -20. Split: buyer loses the delivery fee, seller pays the return trip. Seller: payout released.')}</div>`).join('') || `<div class="card col" style="align-items:center;text-align:center;padding:48px 16px"><span class="av" style="background:var(--success-soft);color:var(--success)">${ic('check')}</span><h2 class="h2">No open disputes</h2></div>`}`;
  },
  a_fin() {
    const x = S.d.x;
    return `${head('Payouts and ledger', '', B('Run batch payout now', 'payrun', '', 'md'))}
    <div class="wrap">${K('Commission earned', N(x.commission), '', true)}${K('Escrow held', N(x.escrowHeld))}${K('Sales value', N(x.gmv))}</div>
    ${sect('Payouts', tbl(['Account', 'Amount', 'Status', ''], S.d.p.slice().reverse().map(p => [esc(p.account), `<span class="num">${N(p.amount)}</span>`, tag(esc(p.status), p.status === 'PENDING_TRANSFER' ? 't-w' : 't-s'), p.status === 'PENDING_TRANSFER' ? B('Mark paid', 'paypaid', p.id) : ''])))}
    ${sect('Ledger (latest 100)', tbl(['Order', 'Account', 'What', 'Amount'], S.d.l.slice(-100).reverse().map(e => [esc(e.order), esc(e.account), esc(e.memo), `<span class="num">${N(e.amount)}</span>`])))}`;
  },
  a_cpn() { return `${head('Coupons')}<div class="card col" style="gap:14px"><h2 class="h3">New coupon</h2><div class="wrap">${fl('cc', 'Code', 'text', 'placeholder="CODE"')}${fl('cv', '% off', 'number', 'min="1" max="90"')}</div><div>${B('Create coupon', 'cpnadd', '', 'md')}</div></div>${tbl(['Code', 'Discount', ''], S.d.x.map(c => [`<span class="mono">${esc(c.code)}</span>`, c.pct + '%', B('Delete', 'cpndel', c.code, 'r')]))}`; },
  a_cmp() { return `${head('Complaints', 'Suggestions and problems sent in by users.')}${tbl(['Message', 'Received', ''], S.d.x.slice().reverse().map(c => [esc(c.text), when(c.at), c.open ? B('Mark resolved', 'cmpres', c.id) : tag('Resolved', 't-s')]), 'minmax(0,2fr) minmax(0,1fr) minmax(140px,auto)')}`; },
  a_set() {
    const x = S.d.x, f = (l, id, v) => fl(id, l, 'number', `step="any" value="${esc(v)}"`);
    return `${head('Fees and rules', 'New orders use the new values. Existing orders keep their delivery fee.')}<div class="card col" style="max-width:640px;gap:16px">${f('Commission, Basic and Standard (%)', 's1', +x.commissionPct.toFixed(2))}${f('Commission, Premium tiers (%)', 's2', +x.premiumCommissionPct.toFixed(2))}${f('Delivery fee per order (₦)', 's3', x.fee / 100)}${f('Seller dispute fee (₦)', 's4', x.penalty / 100)}${f('Suspend store below trust score', 's5', x.freezeBelow)}${f('Ban store below trust score', 's6', x.banBelow)}<div>${B('Save settings', 'setsave', '', 'md')}</div></div>`;
  },
  a_log() { return `${head('Audit log')}${tbl(['When', 'Action', 'Detail'], S.d.x.map(a => [when(a.at), esc(a.action), esc(a.detail)]), 'minmax(0,1fr) minmax(0,1fr) minmax(0,2fr)')}`; },
};
const adopt = j => { S.token = j.token; localStorage.setItem('nx_token', j.token); S.user = j.user; };
const twoFactorCard = u => `<div class="card col" style="gap:14px"><h2 class="h3">Two-step login (admins)</h2>${u.twoFactor
  ? `<div>${tag('On', 't-s')}</div><p>You need your authenticator app, or a recovery code, every time you log in.</p>${fl('tp', 'Your password', 'password', 'autocomplete="current-password"')}<div>${B('Turn off', 'tfdisable', '', 'r')}</div>`
  : S.tf ? `<p>Add this key to an authenticator app (Google Authenticator, Microsoft Authenticator or Authy), then type the 6-digit code it shows.</p><p class="secret">${esc(S.tf.secret)}</p><p class="cap">Or open this link on your phone: <a class="lnk" href="${esc(S.tf.uri)}">${esc(S.tf.uri)}</a></p>${fl('tcode', '6-digit code', 'text', 'inputmode="numeric" maxlength="6"')}<div>${B('Turn on', 'tfenable')}</div>`
  : `<p>Until you set up an authenticator app, a code is texted to your phone each time you log in.</p><div>${B('Set up authenticator app', 'tfsetup')}</div>`}
  ${S.recovery ? `${notice('w', 'Save these recovery codes now', 'Each works once if you lose your phone. They will not be shown again.')}<p class="secret">${S.recovery.map(esc).join('<br>')}</p>` : ''}</div>`;
const FORM_IDS = ['li', 'sn', 'sp', 'se', 'ss', 'sb', 'sk', 'sv', 'fp', 'op'];
const snap = () => { for (const id of FORM_IDS) { const e = $('#' + id); if (e) S.form[id] = e.value; } };
const fld = (id, label, type = 'text', extra = '', help = '') => fl(id, label, type, `value="${esc(S.form[id] || '')}" ${extra}`, help);
const tabs = m => `<div class="row" style="gap:8px"><button class="chip ${m === 'login' ? 'on' : ''}" data-act="amode" data-id="login">Sign in</button><button class="chip ${m === 'signup' ? 'on' : ''}" data-act="amode" data-id="signup">Sign up</button></div>`;
const ABOUT = { buyer: 'Shop and pay safely. Your money is held in escrow until you confirm delivery.', seller: 'Sell your products. ShopNex verifies your identity before you can list anything.', rider: 'Deliver orders. A ShopNex admin approves riders before they can sign in.' };
function authView() {
  const a = S.auth, hint = S.hint ? notice('w', '', esc(S.hint)) : '', code = fld('cd', '6-digit code', 'text', 'inputmode="numeric" maxlength="6" autocomplete="one-time-code"'); let body, title = STAFF ? 'Staff sign in' : 'Sign in', sub = '';
  if (a === 'login') { sub = STAFF ? 'Use your admin phone number and password. You will be asked for a second code.' : 'New to ShopNex? <button class="lnk" style="border:0;background:none;cursor:pointer;font:inherit" data-act="amode" data-id="signup">Create an account</button>';
    body = (STAFF ? '' : tabs('login')) + fld('li', 'Phone number or verified email', 'text', 'autocomplete="username" placeholder="+234 803 123 4567"') + fld('lp', 'Password', 'password', 'autocomplete="current-password"') + B('Sign in', 'login', '', 'lg full') + `<div class="row sp" style="flex-wrap:wrap"><button class="lnk" style="border:0;background:none;cursor:pointer;font:inherit" data-act="amode" data-id="forgot">Forgot password?</button><button class="lnk" style="border:0;background:none;cursor:pointer;font:inherit" data-act="amode" data-id="otp">Use a one-time code instead</button></div><p class="cap">Five wrong passwords lock the account for 15 minutes.</p>`; }
  else if (a === 'signup') { const r = S.form.role || 'buyer'; title = 'Create your account'; sub = 'Already have one? <button class="lnk" style="border:0;background:none;cursor:pointer;font:inherit" data-act="amode" data-id="login">Sign in</button>';
    body = tabs('signup') + `<div class="row" style="flex-wrap:wrap;gap:8px">${[['buyer', 'Buyer'], ['seller', 'Seller'], ['rider', 'Rider']].map(([k, l]) => `<button class="chip ${r === k ? 'on' : ''}" data-act="srole" data-id="${k}">${l}</button>`).join('')}</div><p class="mut">${ABOUT[r]}</p>`
    + fld('sn', 'Full name', 'text', 'autocomplete="name"') + fld('sp', 'Phone number', 'tel', 'autocomplete="tel" placeholder="08012345678"') + fld('se', 'Email (optional)', 'email', 'autocomplete="email"')
    + (r === 'seller' ? fld('ss', 'Shop name') + fld('sb', 'Name on your BVN') + fld('sk', 'Bank account name') : '') + (r === 'rider' ? fld('sv', 'Vehicle and plate number') : '')
    + fld('pw', 'Password', 'password', 'autocomplete="new-password"', 'At least 8 characters, with a letter and a number.') + fld('pw2', 'Confirm password', 'password', 'autocomplete="new-password"')
    + `<label class="cb"><input type="checkbox" id="tc"><span>I agree to the <a class="lnk" href="/terms.html" target="_blank" rel="noopener">Terms of Service</a> and <a class="lnk" href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>` + B('Create account', 'signup', '', 'lg full'); }
  else if (a === 'verify') { title = 'Verify your phone'; sub = `We sent a 6-digit code to ${esc(S.phone)}.`; body = hint + code + B('Verify and continue', 'verifysignup', '', 'lg full') + B('Back', 'amode', 'signup', 'g full'); }
  else if (a === 'forgot') { title = 'Reset your password'; sub = 'We will text a code to your phone.'; body = fld('fp', 'Phone number', 'tel') + B('Send code', 'forgot', '', 'lg full') + B('Back to sign in', 'amode', 'login', 'g full'); }
  else if (a === 'reset') { title = 'Choose a new password'; sub = `Code sent to ${esc(S.phone)}.`; body = hint + code + fld('np', 'New password', 'password', 'autocomplete="new-password"') + B('Save password', 'reset', '', 'lg full'); }
  else if (a === 'twofa') { title = 'Two-step verification'; sub = S.method === 'totp' ? 'Enter the 6-digit code from your authenticator app, or one of your recovery codes.' : 'We sent a 6-digit code to your phone.'; body = hint + fld('tf', 'Code', 'text', 'autocomplete="one-time-code" maxlength="12"') + B('Continue', 'twofa', '', 'lg full') + B('Back', 'amode', 'login', 'g full'); }
  else if (a === 'otp') { title = 'Sign in with a code'; body = fld('op', 'Phone number', 'tel') + B('Send code', 'otp', '', 'lg full') + B('Back to sign in', 'amode', 'login', 'g full'); }
  else { title = 'Enter your code'; sub = `Code sent to ${esc(S.phone)}.`; body = hint + code + B('Sign in', 'otpverify', '', 'lg full'); }
  const step = (c, a, b) => `<li class="${c}"><span class="dot">${c === 'done' ? ic('check', 14) : ''}</span><span><b>${a}</b><small>${b}</small></span></li>`;
  return `<div class="root" style="min-height:100vh;padding:16px;display:flex;flex-wrap:wrap;gap:16px;align-items:stretch"><main class="col" style="flex:1 1 420px;padding:32px 16px;justify-content:center;align-items:center"><div class="col" style="width:100%;max-width:440px;gap:20px">
    <div>${LOGO}</div><div><h1 class="h1" style="font-size:32px;line-height:38px">${title}${STAFF && a === 'login' ? ' ' + tag('Admin', 't-w') : ''}</h1>${sub ? `<p class="mut" style="font-size:15px;margin-top:4px">${sub}</p>` : ''}</div>${body}
    <p class="cap">By using ShopNex you agree to our <a class="lnk" href="/terms.html" target="_blank" rel="noopener">Terms</a> and <a class="lnk" href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</p></div></main>
    <aside class="col aa" style="flex:1 1 420px;background:var(--brand-soft);border-radius:20px;padding:48px;justify-content:center;gap:24px"><h2 class="dl" style="font-size:40px;line-height:44px;font-weight:800;max-width:460px">Shop with confidence. Sell with ease.</h2><p style="font-size:17px;line-height:26px;max-width:440px">We hold the buyer’s money until the rider enters the delivery code. Then the seller and the rider are paid.</p>
    <div class="card" style="max-width:440px"><ol class="tl">${step('done', 'Buyer pays', 'Money is held by ShopNex')}${step('done', 'Seller dispatches', 'The buyer gets a 4-digit delivery code')}${step('cur', 'Rider enters the code', 'Only after the buyer has checked the item')}${step('todo', 'Seller and rider are paid', 'Price minus commission, plus the delivery fee')}</ol></div></aside></div>`;
}
async function finishAuth(j) {
  if (STAFF && j.user && j.user.role !== 'admin') { toast('This is not an admin account. Use the main sign-in page.'); S.auth = 'login'; render(); return; }
  if (j.pending) { S.auth = 'login'; S.form = {}; toast('Account created. A ShopNex admin must approve your rider application before you can sign in.'); render(); return; }
  S.token = j.token; localStorage.setItem('nx_token', j.token); S.user = j.user; S.form = {}; await boot();
}
const navBtn = ([k, l, i], on, extra = '') => `<button class="ni ${on ? 'on' : ''}" data-act="go" data-id="${k}">${i ? ic(i) : ''}<span>${l}</span>${extra}</button>`;
const bdgN = n => (n ? `<span class="bdg">${n}</span>` : '');
const topIcons = u => `<div class="row"><button class="ib" data-act="go" data-id="notes" aria-label="Notifications">${ic('bell')}${unread() ? `<span class="bdg warn" style="position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;color:#fff">${unread()}</span>` : ''}</button><button class="row" style="gap:10px;border:0;background:none;cursor:pointer;font:inherit;color:inherit" data-act="go" data-id="account"><span class="av">${ini(u.name || u.phone)}</span><span class="col" style="gap:0;text-align:left"><span class="b" style="font-size:15px">${esc(u.name || u.phone)}</span><span class="cap">${esc(u.role[0].toUpperCase() + u.role.slice(1))}</span></span></button></div>`;
function render() {
  const u = S.user, R = $('#root'); if (!u) { R.innerHTML = authView(); return; }
  const v = S.view, main = (VIEWS[v] || VIEWS.help)(), pick = '<input id="pickimg" type="file" accept="image/jpeg,image/png,image/webp" hidden>';
  if (u.role === 'buyer') {
    const on = k => v === k || (k === 'home' && ['product', 'review'].includes(v)) || (k === 'orders' && v === 'orders');
    R.innerHTML = `<div class="root"><div class="page"><header class="hdr panel row sp" style="padding:12px 20px;flex-wrap:wrap"><div class="row" style="gap:24px;flex-wrap:wrap"><button style="border:0;background:none;cursor:pointer;padding:0" data-act="go" data-id="home" aria-label="ShopNex home">${LOGO}</button><nav class="row" style="gap:4px;flex-wrap:wrap" aria-label="Main">${NAVS.buyer.map(n => `<button class="ni ${on(n[0]) ? 'on' : ''}" style="min-height:40px;width:auto" data-act="go" data-id="${n[0]}">${n[1]}</button>`).join('')}</nav></div>
      <div class="row"><button class="ib" data-act="go" data-id="cart" aria-label="Cart, ${S.cart.length} items">${ic('cart')}${S.cart.length ? `<span class="bdg" style="position:absolute;top:-6px;right:-6px;min-width:20px;height:20px">${S.cart.length}</span>` : ''}</button>${topIcons(u)}</div></header>${main}</div>
      <nav class="bn" aria-label="Main">${[['home', 'Shop', 'bag'], ['cart', 'Cart', 'cart'], ['orders', 'Orders', 'box'], ['notes', 'Alerts', 'bell'], ['account', 'Account', 'user']].map(([k, l, i]) => `<button class="${v === k || (k === 'home' && ['product', 'review'].includes(v)) ? 'on' : ''}" data-act="go" data-id="${k}">${ic(i, 22)}${l}</button>`).join('')}</nav></div>`;
  } else if (u.role === 'rider') {
    R.innerHTML = `<div class="root rider"><header class="row sp" style="padding:16px 20px;background:var(--surface);border-bottom:1px solid var(--line)">${LOGO}<button class="av" style="border:0;cursor:pointer" data-act="go" data-id="account" aria-label="Account">${ini(u.name || u.phone)}</button></header><div class="col" style="padding:20px;gap:16px;padding-bottom:90px">${main}</div>
      <nav class="bn always" aria-label="Rider">${NAVS.rider.map(([k, l, i]) => `<button class="${v === k ? 'on' : ''}" data-act="go" data-id="${k}">${ic(i, 22)}${l}</button>`).join('')}</nav></div>`;
  } else {
    const items = NAVS[u.role] || [], gen = [...GENERAL];
    R.innerHTML = `<div class="root shellwrap"><div class="shell"><aside class="panel side"><div style="padding:4px 12px 16px">${LOGO}</div><div class="ovl" style="padding:8px 12px">Menu</div><nav class="col" style="gap:4px" aria-label="${u.role} menu">${items.map(n => navBtn(n, v === n[0])).join('')}</nav>
      <div class="ovl" style="padding:20px 12px 8px">General</div><nav class="col" style="gap:4px" aria-label="General">${gen.map(n => navBtn(n, v === n[0], n[0] === 'notes' ? bdgN(unread()) : '')).join('')}<button class="ni" data-act="logout">${ic('out')}<span>Sign out</span></button></nav>
      ${u.role === 'seller' ? `<div class="dark" style="margin-top:24px">${ic('wallet')}<div class="h3">Go Premium</div><p style="font-size:13px;line-height:18px">Pay a lower commission and list more products.</p>${B('See plans', 'go', 's_plan')}</div>` : ''}${u.role === 'admin' ? `<div class="dark" style="margin-top:24px">${ic('shield')}<div class="h3">Ledger</div><p style="font-size:13px;line-height:18px">Every order is a balanced pair of debits and credits.</p>${B('Open ledger', 'go', 'a_fin')}</div>` : ''}</aside>
      <main style="flex:999 1 560px;min-width:0;display:flex;flex-direction:column;gap:16px"><div class="panel row sp" style="padding:12px 16px;flex-wrap:wrap"><span class="b">${u.role === 'admin' ? 'ShopNex admin' : 'Seller portal'}</span>${topIcons(u)}</div><div class="stage">${main}</div></main>${u.role === 'seller' ? pick : ''}</div></div>`;
  }
  if (u.role === 'buyer' || u.role === 'seller') { /* photo picker is only needed by sellers */ }
}
try { const mq = matchMedia('(prefers-color-scheme: dark)'), applyTheme = () => { document.documentElement.dataset.theme = mq.matches ? 'dark' : 'light'; }; applyTheme(); mq.addEventListener?.('change', applyTheme); } catch { /* no theme support */ }
async function uploadImage(id, file) { // shrink to 800px JPEG in the browser, then send
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  const bmp = await createImageBitmap(file), k = Math.min(1, 800 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  await api('POST', `/seller/products/${id}/image`, { image: c.toDataURL('image/jpeg', 0.82) });
}
const saveCart = () => localStorage.setItem('nx_cart', JSON.stringify(S.cart));
const ACT = {
  amode(id) { snap(); S.auth = id; S.hint = ''; render(); },
  srole(id) { snap(); S.form.role = id; render(); },
  async login() {
    const j = await api('POST', '/auth/login', { identifier: $('#li').value.trim(), password: $('#lp').value });
    if (j.twofa) { Object.assign(S, { auth: 'twofa', challenge: j.challenge, method: j.method, hint: j.devCode ? 'Test mode: your code is ' + j.devCode : '' }); render(); return; }
    await finishAuth(j);
  },
  async twofa() { await finishAuth(await api('POST', '/auth/2fa', { challenge: S.challenge, code: $('#tf').value.trim() })); },
  async emailsend() { const j = await api('POST', '/me/email/send'); S.emailHint = j.devCode ? 'Test mode: your code is ' + j.devCode : ''; toast('Verification code sent'); render(); },
  async emailverify() { S.user = await api('POST', '/me/email/verify', { code: $('#ec').value.trim() }); S.emailHint = ''; toast('Email verified'); render(); },
  async emailset() { S.user = await api('POST', '/me/email', { email: $('#em').value.trim() }); S.emailHint = ''; toast('Email updated'); render(); },
  async chpw() { if ($('#np1').value !== $('#np2').value) throw new Error('The two new passwords do not match.'); adopt(await api('POST', '/me/password', { current: $('#cp').value, next: $('#np1').value })); toast('Password changed'); render(); },
  async signall() { adopt(await api('POST', '/me/signout-everywhere')); toast('Signed out of other devices'); render(); },
  async tfsetup() { S.tf = await api('POST', '/me/2fa/setup'); render(); },
  async tfenable() { const j = await api('POST', '/me/2fa/enable', { code: $('#tcode').value.trim() }); S.recovery = j.recovery; S.tf = null; S.user = await api('GET', '/me'); toast('Two-step login is on'); render(); },
  async tfdisable() { S.user = await api('POST', '/me/2fa/disable', { password: $('#tp').value }); S.recovery = null; toast('Two-step login is off'); render(); },
  async signup() {
    if ($('#pw').value !== $('#pw2').value) throw new Error('The two passwords do not match.'); snap(); const phone = $('#sp').value.trim();
    const j = await api('POST', '/auth/signup', { role: S.form.role || 'buyer', name: $('#sn').value.trim(), phone, email: $('#se').value.trim(), password: $('#pw').value, acceptTerms: $('#tc').checked, shopName: $('#ss')?.value.trim(), bvnName: $('#sb')?.value.trim(), bankAccountName: $('#sk')?.value.trim(), vehicle: $('#sv')?.value.trim() });
    Object.assign(S, { phone, auth: 'verify', hint: j.devCode ? 'Test mode: your code is ' + j.devCode : '' }); render();
  },
  async verifysignup() { await finishAuth(await api('POST', '/auth/signup/verify', { phone: S.phone, code: $('#cd').value.trim() })); },
  async forgot() { const phone = $('#fp').value.trim(), j = await api('POST', '/auth/forgot', { phone }); Object.assign(S, { phone, auth: 'reset', hint: j.devCode ? 'Test mode: your code is ' + j.devCode : '' }); render(); },
  async reset() { await api('POST', '/auth/reset', { phone: S.phone, code: $('#cd').value.trim(), password: $('#np').value }); S.auth = 'login'; S.hint = ''; toast('Password saved. Log in with your new password.'); render(); },
  async otp() { const phone = $('#op').value.trim(), j = await api('POST', '/auth/otp', { phone }); Object.assign(S, { phone, auth: 'otp2', hint: j.devCode ? 'Test mode: your code is ' + j.devCode : '' }); render(); },
  async otpverify() { await finishAuth(await api('POST', '/auth/verify', { phone: S.phone, code: $('#cd').value.trim() })); },
  logout, go: id => go(id),
  async cat(id) { S.cat = id; S.q = ''; await loadProducts(); render(); },
  async open(id) { S.cur = S.products.find(p => p.id === id); S.view = 'product'; render(); scrollTop(); },
  addcart(id) { const p = S.cur, i = S.cart.find(x => x.id === id); if (i) return toast('Already in your cart'); S.cart.push({ id, name: p.name, price: p.price, category: p.category, image: p.image }); saveCart(); toast('Added to cart'); render(); },
  buynow(id) { const p = S.cur; if (!S.cart.find(x => x.id === id)) { S.cart.push({ id, name: p.name, price: p.price, category: p.category, image: p.image }); saveCart(); } return go('cart'); },
  rmcart(id) { S.cart = S.cart.filter(i => i.id !== id); saveCart(); render(); },
  async review() { const coupon = $('#cpn').value.trim(); S.rv = await api('POST', '/checkout', { items: S.cart.map(i => i.id), coupon: coupon || undefined }); S.view = 'review'; render(); },
  async pay(group) { if (S.rv?.payment.url && S.rv.group === group) { location.href = S.rv.payment.url; return; } await api('POST', (group.startsWith('g') ? '/dev/pay-group/' : '/dev/pay/') + group); S.cart = []; saveCart(); toast('Payment received. Your delivery codes are on My orders.'); await go('orders'); },
  async complain() { await api('POST', '/complaints', { text: $('#cmp').value.trim() }); toast('Thank you. Your message was sent.'); await go(DEF[S.user.role]); },
  async apply() { await api('POST', '/seller/apply', { shopName: $('#shp').value.trim(), bvnName: $('#bvn').value.trim(), bankAccountName: $('#bnk').value.trim() }); S.user = await api('GET', '/me'); toast('Application sent for review.'); await go(DEF[S.user.role]); },
  async addprod() {
    const f = $('#pi').files?.[0], p = await api('POST', '/seller/products', { name: $('#pn').value.trim(), category: $('#pc').value, price: Math.round(+$('#pp').value * 100), description: $('#pd').value.trim() });
    try { if (f) await uploadImage(p.id, f); toast('Product listed'); } catch (x) { toast('Product listed, but the photo failed: ' + x.message); }
    await go(S.view);
  },
  photo(id) { S.photoFor = id; $('#pickimg').click(); },
  buyplan: id => P('/seller/plan', { plan: id }, 'Plan updated'), buyboost: id => P('/seller/boost', { pack: id }, 'Boost added'),
  async dispatch(id) { const r = $('#rd-' + id).value; if (!r) throw new Error('Choose a rider first.'); await P(`/orders/${id}/dispatch`, { riderId: r }, 'Dispatched'); },
  confirm: id => P(`/orders/${id}/confirm`, { code: $('#c-' + id).value.trim() }, 'Code accepted. Seller paid.'),
  reject(v) { const [id, reason] = v.split('|'); return P(`/orders/${id}/reject`, { reason }, 'Recorded'); },
  rule(v) { const [id, ruling] = v.split('|'); return P(`/orders/${id}/rule`, { ruling }, 'Ruling applied'); },
  kyc(v) { const [id, a] = v.split('|'); return P('/admin/kyc/' + id, { approve: a === '1' }, 'Done'); },
  sel(v) { const [id, k, val] = v.split('|'); return P('/admin/sellers/' + id, { [k]: k === 'trust' ? +val : val }, 'Seller updated'); },
  usr(v) { const [id, status] = v.split('|'); return P('/admin/users/' + id, { status }, 'User updated'); },
  prod(v) { const [id, k, val] = v.split('|'); return P('/admin/products/' + id, { [k]: val === 'true' }, 'Product updated'); },
  cpnadd: () => P('/admin/coupons', { code: $('#cc').value, pct: +$('#cv').value }, 'Coupon created'),
  async cpndel(code) { await api('DELETE', '/admin/coupons/' + code); toast('Coupon deleted'); await go('a_cpn'); },
  cmpres: id => P(`/admin/complaints/${id}/resolve`, {}, 'Resolved'),
  payrun: () => P('/admin/payouts/run', {}, 'Batch payout queued'), paypaid: id => P(`/admin/payouts/${id}/paid`, {}, 'Marked paid'),
  setsave: () => P('/admin/settings', { commissionPct: +$('#s1').value, premiumCommissionPct: +$('#s2').value, fee: Math.round($('#s3').value * 100), penalty: Math.round($('#s4').value * 100), freezeBelow: +$('#s5').value, banBelow: +$('#s6').value }, 'Settings saved'),
};
document.addEventListener('click', async e => { const el = e.target.closest('[data-act]'); if (!el) return; try { await ACT[el.dataset.act](el.dataset.id); } catch (x) { toast(x.message); } });
document.addEventListener('change', async e => {
  if (e.target.id === 'pickimg') { const f = e.target.files?.[0]; e.target.value = ''; if (f && S.photoFor) { try { await uploadImage(S.photoFor, f); toast('Photo saved'); await go(S.view); } catch (x) { toast(x.message); } } return; }
  const el = e.target.closest?.('[data-chg]'); if (!el) return; try { await P('/admin/users/' + el.dataset.id, { role: el.value }, 'Role updated'); } catch (x) { toast(x.message); } });
document.addEventListener('keydown', async e => { if (e.key === 'Enter' && e.target.id === 'q') { S.q = e.target.value.trim(); S.cat = ''; S.view = 'home'; try { await loadProducts(); render(); $('#q')?.focus(); } catch (x) { toast(x.message); } } });
async function boot() {
  const ref = new URLSearchParams(location.search || '').get('reference') || new URLSearchParams(location.search || '').get('trxref'); // returning from Paystack
  try {
    S.mock = (await api('GET', '/health')).provider === 'mock'; S.cats = await api('GET', '/categories');
    if (S.token && !S.user) S.user = await api('GET', '/me');
    if (S.user && ref) { history.replaceState(null, '', location.pathname); try { await api('POST', '/payments/verify', { reference: ref }); S.cart = []; saveCart(); toast('Payment received. Your delivery codes are on My orders.'); S.notes = await api('GET', '/me/notifications').catch(() => []); await go('orders'); return; } catch (x) { toast(x.message); } }
    if (S.user) { if (S.user.role === 'buyer') await loadProducts(); S.notes = await api('GET', '/me/notifications').catch(() => []); await go(DEF[S.user.role] || 'help'); return; }
  } catch (x) { if (S.token) { logout(); return; } toast(x.message); }
  render();
}
boot();
