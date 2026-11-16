import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail } from './escrow.js';
export const MAX_BYTES = 600 * 1024;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TYPES = { jpeg: ['jpg', b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff], png: ['png', b => b.subarray(0, 8).equals(PNG)], webp: ['webp', b => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP'] };
// Accepts a data URL, checks the real file signature (not just the label), and stores it under a random name.
export function saveImage(dataUrl, dir) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw fail(400, 'Upload a JPEG, PNG or WebP image.');
  const buf = Buffer.from(m[2], 'base64'), [ext, valid] = TYPES[m[1]];
  if (buf.length > MAX_BYTES) throw fail(413, 'That image is too large. Use one under 600 KB.');
  if (!valid(buf)) throw fail(400, 'That file is not a valid image.');
  fs.mkdirSync(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`; fs.writeFileSync(path.join(dir, name), buf); return name;
}
export function removeImage(dir, url) { const f = /^\/uploads\/([a-f0-9-]+\.(jpg|png|webp))$/.exec(url || ''); if (f) fs.rm(path.join(dir, f[1]), { force: true }, () => {}); }
