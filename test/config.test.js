import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, productionProblems } from '../src/config.js';
const req = (xff, addr = '10.0.0.1') => ({ socket: { remoteAddress: addr }, headers: xff ? { 'x-forwarded-for': xff } : {} });
test('client address: forwarded headers are ignored unless a proxy is trusted, and fakes are skipped', () => {
  assert.equal(clientIp(req('1.2.3.4')), '10.0.0.1');
  assert.equal(clientIp(req('1.2.3.4'), 1), '1.2.3.4'); assert.equal(clientIp(req('9.9.9.9, 1.2.3.4'), 1), '1.2.3.4');
  assert.equal(clientIp(req('1.2.3.4, 5.6.7.8'), 2), '1.2.3.4'); assert.equal(clientIp(req(null), 1), '10.0.0.1');
});
test('production start-up checks list what is missing', () => {
  assert.ok(productionProblems({}).errors.length >= 4);
  const good = { APP_SECRET: 'x'.repeat(32), PUBLIC_URL: 'https://shopnex.example', PAYSTACK_SECRET_KEY: 'sk_live_x', TERMII_API_KEY: 'k', RESEND_API_KEY: 'k', ADMIN_PHONE: '+2348000000001', TRUST_PROXY: '1', DB_FILE: '/data/shopnex.db' };
  const ok = productionProblems(good); assert.deepEqual(ok.errors, []); assert.deepEqual(ok.warnings, []);
  assert.match(productionProblems({ ...good, SKIP_VERIFY: '1' }).errors.join(), /SKIP_VERIFY/); assert.match(productionProblems({ ...good, PUBLIC_URL: 'http://x.com' }).errors.join(), /https/);
  assert.match(productionProblems({ ...good, TRUST_PROXY: '' }).warnings.join(), /TRUST_PROXY/);
});
