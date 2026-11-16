// Fills an empty database with demo sellers, products, a rider and a coupon. Demo accounts get the password below. Never run in production.
import { Escrow } from '../src/escrow.js';
import { Market } from '../src/market.js';
import { openStore } from '../src/store.js';
if (process.env.NODE_ENV === 'production') { console.log('Refusing to create demo accounts in production.'); process.exit(1); }
process.env.ADMIN_PHONE ||= '+2348000000001';
const store = await openStore(), db = store.db, esc = new Escrow(db, store.save), m = new Market(db, esc, store.save), PW = 'Demo@1234';
const DEMO = new Set([process.env.ADMIN_PHONE, '+2348100000001', '+2348100000002', '+2348100000003', '+2348100000004', '+2348200000001']);
const login = p => m.verifyOtp(p, m.requestOtp(p)), admin = Object.values(db.users).find(u => u.phone === process.env.ADMIN_PHONE) || login(process.env.ADMIN_PHONE);
const finish = async () => { for (const u of Object.values(db.users)) if (DEMO.has(u.phone)) { if (!u.passwordHash) await m.setPassword(u.id, PW); u.name ||= u.role === 'admin' ? 'ShopNex Admin' : u.role === 'rider' ? 'Demo Rider' : u.role === 'seller' ? esc.seller(u.id).shopName : 'Demo User'; } store.save(); await store.flush(); await store.close(); };
if (Object.keys(db.products).length) { await finish(); console.log('Already seeded. Demo accounts log in with password ' + PW); process.exit(0); }
const shops = [
  ['+2348100000001', 'Zara Styles', 'Premium Gold', [['Ankara two-piece set', 'Wears', 18500], ['Leather sneakers', 'Wears', 24000]]],
  ['+2348100000002', 'GadgetHub NG', 'Premium', [['Wireless earbuds', 'Gadgets', 22000], ['Smartphone 128GB', 'Gadgets', 50000]]],
  ['+2348100000003', 'Lagos Gold Co', 'Standard', [['Gold-plated chain', 'Jewellery', 31000], ['Pearl earring set', 'Jewellery', 12500]]],
  ['+2348100000004', 'HomeEase & Pantry', 'Basic', [['Air fryer 5L', 'Home Appliances', 45000], ['Ofada rice, 50kg', 'Food Stuffs', 68000], ['Deep home cleaning', 'Services', 15000]]]];
for (const [phone, shop, plan, items] of shops) {
  const u = login(phone); m.apply(u.id, { shopName: shop, bvnName: 'Demo Owner', bankAccountName: 'Owner Demo' }); m.reviewKyc(admin.id, u.id, true);
  Object.assign(esc.seller(u.id), { plan, premium: /^Premium/.test(plan) }); for (const [name, category, naira] of items) m.addProduct(u.id, { name, category, price: naira * 100 });
}
m.setUser(admin.id, login('+2348200000001').id, { role: 'rider' }); m.createCoupon(admin.id, 'NEX10', 10);
const n = Object.keys(db.products).length; await finish();
console.log(`Seeded ${n} products. Demo logins (password ${PW}): admin ${process.env.ADMIN_PHONE}, sellers +2348100000001 to 04, rider +2348200000001. Coupon: NEX10.`);
