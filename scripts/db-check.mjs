// Proves the configured database can save, reload and delete data. Run it once against Postgres (DATABASE_URL) before going live.
import { openStore } from '../src/store.js';
const key = '__dbcheck', val = String(Date.now()), fail = m => { console.error('FAILED: ' + m); process.exit(1); };
let s = await openStore(); console.log('Database type:', s.kind);
s.db.settings[key] = val; s.save(); await s.flush(); await s.close();
s = await openStore(); if (s.db.settings[key] !== val) fail('a saved value was not read back.');
delete s.db.settings[key]; s.save(); await s.flush(); await s.close();
s = await openStore(); if (key in s.db.settings) fail('a deleted value came back.'); await s.close();
console.log('OK: the database can save, reload and delete data.');
