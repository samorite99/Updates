import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore, sqliteDriver } from '../src/store.js';
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nx-db-')), 'test.db');
const spy = d => { const calls = []; return { ...d, calls, apply: c => { calls.push(c.length); return d.apply(c); } }; };

test('changes are saved and survive a restart, with list order kept', async () => {
  const f = tmp(); let s = await createStore(await sqliteDriver(f));
  s.db.users.u1 = { id: 'u1', phone: '+2348000000001', role: 'buyer' }; s.db.settings.rate = 0.12; s.db.refs.r1 = 'g1';
  s.db.ledger.push({ order: 'o1', account: 'escrow', amount: 100 }, { order: 'o1', account: 'buyer-payment', amount: -100 });
  s.db.audit.unshift({ action: 'first', at: 1 }); s.db.audit.unshift({ action: 'second', at: 2 });
  s.save(); await s.flush(); await s.flush(); await s.close();
  s = await createStore(await sqliteDriver(f));
  assert.equal(s.db.users.u1.phone, '+2348000000001'); assert.equal(s.db.settings.rate, 0.12); assert.equal(s.db.refs.r1, 'g1');
  assert.equal(s.db.ledger.length, 2); assert.deepEqual(s.db.audit.map(a => a.action), ['second', 'first']); await s.close();
});
test('only changed records are written, edits and deletes persist, and a repeat flush writes nothing', async () => {
  const f = tmp(), d = spy(await sqliteDriver(f)); let s = await createStore(d);
  s.db.users.a = { n: 1 }; s.db.users.b = { n: 2 }; s.db.coupons.X = { pct: 10 }; s.save(); await s.flush(); assert.deepEqual(d.calls, [3]);
  s.db.users.a.n = 5; delete s.db.coupons.X; s.save(); await s.flush(); assert.deepEqual(d.calls, [3, 2]);
  s.save(); await s.flush(); assert.deepEqual(d.calls, [3, 2]); await s.close();
  s = await createStore(await sqliteDriver(f)); assert.equal(s.db.users.a.n, 5); assert.equal(s.db.users.b.n, 2); assert.deepEqual(s.db.coupons, {}); await s.close();
});
test('a failed write keeps the changes pending and the next flush retries them', async () => {
  const f = tmp(), real = await sqliteDriver(f); let fail = true;
  const s = await createStore({ ...real, apply: c => { if (fail) { fail = false; throw new Error('disk full'); } return real.apply(c); } });
  s.db.users.a = { n: 1 }; s.db.ledger.push({ amount: 5 }); s.save(); await assert.rejects(s.flush(), /disk full/); await s.flush(); await s.close();
  const t = await createStore(await sqliteDriver(f)); assert.equal(t.db.users.a.n, 1); assert.equal(t.db.ledger.length, 1); await t.close();
});
test('an older data.json is imported once into an empty database, never twice', async () => {
  const f = tmp(), seed = { users: { u1: { id: 'u1' } }, orders: { o1: { id: 'o1', status: 'FUNDED' } }, ledger: [{ amount: 1 }, { amount: -1 }], audit: [{ action: 'newer' }, { action: 'older' }] };
  let s = await createStore(await sqliteDriver(f), seed); assert.equal(s.imported, 6); await s.close();
  s = await createStore(await sqliteDriver(f), { users: { zz: {} } }); assert.equal(s.imported, 0);
  assert.equal(s.db.orders.o1.status, 'FUNDED'); assert.equal(s.db.users.zz, undefined); assert.equal(s.db.ledger.length, 2); assert.deepEqual(s.db.audit.map(a => a.action), ['newer', 'older']); await s.close();
});
