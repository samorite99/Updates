import { createHmac, randomBytes } from 'node:crypto';
// Authenticator-app codes (RFC 6238, SHA-1, 30 seconds, 6 digits), compatible with Google Authenticator, Microsoft Authenticator and Authy.
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const newSecret = () => { let bits = '', out = ''; for (const x of randomBytes(20)) bits += x.toString(2).padStart(8, '0'); for (let i = 0; i < bits.length; i += 5) out += A[parseInt(bits.slice(i, i + 5), 2)]; return out; };
const decode = s => { let bits = ''; for (const c of s) bits += A.indexOf(c).toString(2).padStart(5, '0'); const b = []; for (let i = 0; i + 8 <= bits.length; i += 8) b.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(b); };
export const totp = (secret, t = Date.now(), digits = 6) => {
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(t / 30000)));
  const h = createHmac('sha1', decode(secret)).update(c).digest(), o = h[19] & 15;
  return String((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 10 ** digits).padStart(digits, '0');
};
// Returns the matching 30-second step (allowing one step of clock drift), or null. A step at or below `last` is refused so a code cannot be reused.
export const checkTotp = (secret, code, t = Date.now(), last = -1) => {
  const c = String(code).trim(), now = Math.floor(t / 30000);
  for (const w of [-1, 0, 1]) if (now + w > last && totp(secret, (now + w) * 30000) === c) return now + w;
  return null;
};
