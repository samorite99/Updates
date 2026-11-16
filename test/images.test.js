import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { saveImage } from '../src/images.js';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nx-'));
test('a real PNG is stored under a random name', () => { const n = saveImage('data:image/png;base64,' + PNG, dir); assert.match(n, /^[a-f0-9-]+\.png$/); assert.ok(fs.existsSync(path.join(dir, n))); });
test('wrong types, fake files and oversize uploads are refused', () => {
  assert.throws(() => saveImage('data:image/gif;base64,' + PNG, dir), /JPEG, PNG or WebP/);
  assert.throws(() => saveImage('data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64'), dir), /not a valid image/);
  assert.throws(() => saveImage('data:image/jpeg;base64,' + 'A'.repeat(900000), dir), /too large/);
  assert.throws(() => saveImage('', dir), /JPEG, PNG or WebP/);
});
