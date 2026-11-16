// Saves a consistent copy of the database and the photos into ./backups. Keeps the newest BACKUP_KEEP (default 14). Run it daily from a scheduler.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const dir = process.env.BACKUP_DIR || './backups', keep = +process.env.BACKUP_KEEP || 14, ts = new Date().toISOString().replace(/[:.]/g, '-');
fs.mkdirSync(dir, { recursive: true });
if (process.env.DATABASE_URL) {
  const out = path.join(dir, `shopnex-${ts}.dump`), r = spawnSync('pg_dump', [process.env.DATABASE_URL, '-Fc', '-f', out], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('pg_dump failed or is not installed. Install the PostgreSQL client tools, or use your host\'s own backups.'); process.exit(1); }
  console.log('Saved', out);
} else {
  const { DatabaseSync } = await import('node:sqlite'), out = path.join(dir, `shopnex-${ts}.db`), d = new DatabaseSync(process.env.DB_FILE || './shopnex.db');
  d.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`); d.close(); console.log('Saved', out);
}
const up = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (fs.existsSync(up)) { fs.cpSync(up, path.join(dir, `uploads-${ts}`), { recursive: true }); console.log('Copied photos'); }
for (const prefix of ['shopnex-', 'uploads-']) for (const f of fs.readdirSync(dir).filter(x => x.startsWith(prefix)).sort().slice(0, -keep)) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
