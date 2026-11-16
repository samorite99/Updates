import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
// The app keeps its working data in memory and saves every change to a real database, in one transaction per request.
// Drivers: SQLite (built into Node 22.13+, the default) or Postgres (set DATABASE_URL). Only changed records are written.
export const KEYED = ['users', 'products', 'orders', 'sellers', 'kyc', 'coupons', 'complaints', 'payouts', 'otps', 'emailCodes', 'refs', 'settings'];
export const LISTS = { ledger: 'asc', outbox: 'asc', audit: 'desc' }; // audit is held newest first in memory
const tbl = c => c.toLowerCase(), isEmpty = l => KEYED.every(c => !(l.keyed[c] || []).length);

export async function createStore(driver, seed) {
  await driver.init();
  const loaded = await driver.load(), db = {}, snap = {}, persisted = new WeakSet();
  let seq = 0, dirty = false, chain = Promise.resolve(), imported = 0;
  for (const c of KEYED) { db[c] = {}; snap[c] = new Map(); for (const r of loaded.keyed[c] || []) { db[c][r.id] = r.data; snap[c].set(r.id, JSON.stringify(r.data)); } }
  for (const c of Object.keys(LISTS)) { const rows = loaded.lists[c] || []; db[c] = rows.map(r => r.data); for (const r of rows) { persisted.add(r.data); seq = Math.max(seq, r.seq); } if (LISTS[c] === 'desc') db[c].reverse(); }
  if (seed && isEmpty(loaded)) { // first start on an empty database: bring in an older data.json
    for (const c of KEYED) if (seed[c] && typeof seed[c] === 'object') { Object.assign(db[c], seed[c]); imported += Object.keys(seed[c]).length; }
    for (const c of Object.keys(LISTS)) if (Array.isArray(seed[c])) { db[c].push(...seed[c]); imported += seed[c].length; }
    dirty = true;
  }
  const save = () => { dirty = true; };
  const doFlush = async () => {
    if (!dirty) return; dirty = false;
    const changes = [], snapUpdates = [], fresh = []; let s = seq;
    for (const c of KEYED) {
      const seen = new Set();
      for (const [id, v] of Object.entries(db[c])) { seen.add(id); const json = JSON.stringify(v); if (snap[c].get(id) !== json) { changes.push({ coll: c, id, json }); snapUpdates.push([c, id, json]); } }
      for (const id of snap[c].keys()) if (!seen.has(id)) { changes.push({ coll: c, id }); snapUpdates.push([c, id, null]); }
    }
    for (const c of Object.keys(LISTS)) for (const el of (LISTS[c] === 'desc' ? [...db[c]].reverse() : db[c])) if (!persisted.has(el)) { changes.push({ coll: c, id: randomUUID(), json: JSON.stringify(el), seq: ++s }); fresh.push(el); }
    if (!changes.length) return;
    try { await driver.apply(changes); } catch (e) { dirty = true; throw e; } // keep the changes pending so the next flush retries them
    seq = s; for (const [c, id, json] of snapUpdates) json === null ? snap[c].delete(id) : snap[c].set(id, json); for (const el of fresh) persisted.add(el);
  };
  const flush = () => { const run = chain.catch(() => {}).then(doFlush); chain = run; return run; };
  if (imported) await flush();
  return { db, save, flush, imported, kind: driver.kind, close: () => driver.close() };
}

export async function sqliteDriver(file) {
  const emit = process.emitWarning; process.emitWarning = (w, ...a) => (/SQLite/.test(String(w?.message ?? w)) ? undefined : emit.call(process, w, ...a));
  let mod; try { mod = await import('node:sqlite'); } catch { throw new Error('This Node.js version has no built-in database. Install Node.js 22.13 or newer from nodejs.org, or set DATABASE_URL to use Postgres.'); } finally { process.emitWarning = emit; }
  const d = new mod.DatabaseSync(file); d.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;');
  return {
    kind: 'sqlite',
    init() { for (const c of KEYED) d.exec(`CREATE TABLE IF NOT EXISTS ${tbl(c)} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`); for (const c of Object.keys(LISTS)) d.exec(`CREATE TABLE IF NOT EXISTS ${c} (seq INTEGER PRIMARY KEY, id TEXT UNIQUE NOT NULL, data TEXT NOT NULL)`); },
    load() {
      const keyed = {}, lists = {};
      for (const c of KEYED) keyed[c] = d.prepare(`SELECT id, data FROM ${tbl(c)}`).all().map(r => ({ id: r.id, data: JSON.parse(r.data) }));
      for (const c of Object.keys(LISTS)) lists[c] = d.prepare(`SELECT seq, id, data FROM ${c} ORDER BY seq`).all().map(r => ({ id: r.id, seq: Number(r.seq), data: JSON.parse(r.data) }));
      return { keyed, lists };
    },
    apply(changes) {
      d.exec('BEGIN IMMEDIATE');
      try {
        for (const ch of changes) {
          const t = tbl(ch.coll);
          if (ch.seq !== undefined) d.prepare(`INSERT INTO ${t} (seq, id, data) VALUES (?, ?, ?)`).run(ch.seq, ch.id, ch.json);
          else if (ch.json === undefined) d.prepare(`DELETE FROM ${t} WHERE id = ?`).run(ch.id);
          else d.prepare(`INSERT INTO ${t} (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`).run(ch.id, ch.json);
        }
        d.exec('COMMIT');
      } catch (e) { d.exec('ROLLBACK'); throw e; }
    },
    close() { d.close(); },
  };
}

// Postgres driver: needs `npm install pg`. Written to the same two-method contract as the SQLite driver, but not run by the author against a live server: run `npm run db:check` against your database first.
export async function postgresDriver(url, env = process.env) {
  let pg; try { pg = (await import('pg')).default; } catch { throw new Error('DATABASE_URL is set but the "pg" package is not installed. Run: npm install pg'); }
  const pool = new pg.Pool({ connectionString: url, max: 5, ssl: env.PGSSL === 'require' ? { rejectUnauthorized: env.PGSSL_REJECT_UNAUTHORIZED !== '0' } : undefined });
  let lock;
  return {
    kind: 'postgres',
    async init() {
      lock = await pool.connect(); // one server at a time: the app keeps its working data in memory
      if (!(await lock.query('SELECT pg_try_advisory_lock(727001) AS ok')).rows[0].ok) throw new Error('Another ShopNex server is already using this database. Only one can run at a time.');
      for (const c of KEYED) await pool.query(`CREATE TABLE IF NOT EXISTS ${tbl(c)} (id TEXT PRIMARY KEY, data JSONB NOT NULL)`);
      for (const c of Object.keys(LISTS)) await pool.query(`CREATE TABLE IF NOT EXISTS ${c} (seq BIGINT PRIMARY KEY, id TEXT UNIQUE NOT NULL, data JSONB NOT NULL)`);
    },
    async load() {
      const keyed = {}, lists = {};
      for (const c of KEYED) keyed[c] = (await pool.query(`SELECT id, data FROM ${tbl(c)}`)).rows.map(r => ({ id: r.id, data: r.data }));
      for (const c of Object.keys(LISTS)) lists[c] = (await pool.query(`SELECT seq, id, data FROM ${c} ORDER BY seq`)).rows.map(r => ({ id: r.id, seq: Number(r.seq), data: r.data }));
      return { keyed, lists };
    },
    async apply(changes) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        for (const ch of changes) {
          const t = tbl(ch.coll);
          if (ch.seq !== undefined) await c.query(`INSERT INTO ${t} (seq, id, data) VALUES ($1, $2, $3::jsonb)`, [ch.seq, ch.id, ch.json]);
          else if (ch.json === undefined) await c.query(`DELETE FROM ${t} WHERE id = $1`, [ch.id]);
          else await c.query(`INSERT INTO ${t} (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`, [ch.id, ch.json]);
        }
        await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
    },
    async close() { try { await lock?.query('SELECT pg_advisory_unlock(727001)'); lock?.release(); } finally { await pool.end(); } },
  };
}

export async function openStore(env = process.env) {
  const file = env.DATA_FILE || './data.json'; let seed = null;
  if (fs.existsSync(file)) { try { seed = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { seed = null; } }
  const driver = env.DATABASE_URL ? await postgresDriver(env.DATABASE_URL, env) : await sqliteDriver(env.DB_FILE || './shopnex.db');
  const store = await createStore(driver, seed);
  if (store.imported) console.log(`Imported ${store.imported} records from ${file} into the database. The old file was left in place as a backup.`);
  return store;
}
