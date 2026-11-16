// The visitor's address for rate limiting. Behind a proxy or host, set TRUST_PROXY to the number of proxies in front of the app (usually 1);
// otherwise a visitor could fake the header, and every visitor would look like the proxy.
export const clientIp = (req, trust = 0) => {
  const sock = req.socket?.remoteAddress || 'unknown'; if (!trust) return sock;
  const xs = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  return xs[xs.length - trust] || sock;
};
export function productionProblems(env) {
  const errors = [], warnings = [];
  if (!env.APP_SECRET || env.APP_SECRET.length < 32) errors.push('APP_SECRET must be a random string of at least 32 characters.');
  if (!/^https:\/\/[^/]+/.test(env.PUBLIC_URL || '')) errors.push('PUBLIC_URL must be your site address starting with https://');
  if (env.SKIP_VERIFY) errors.push('SKIP_VERIFY must not be set in production.');
  if (!env.PAYSTACK_SECRET_KEY) errors.push('PAYSTACK_SECRET_KEY is not set, so payments cannot work.');
  if (!env.TERMII_API_KEY) errors.push('TERMII_API_KEY is not set, so sign-up and admin codes cannot be sent.');
  if (!env.RESEND_API_KEY) warnings.push('RESEND_API_KEY is not set, so email verification codes cannot be sent.');
  if (!env.ADMIN_PHONE) warnings.push('ADMIN_PHONE is not set, so nobody can become the first admin.');
  if (!(parseInt(env.TRUST_PROXY, 10) > 0)) warnings.push('TRUST_PROXY is not set. Most hosts put a proxy in front of the app; set it to 1 or every visitor shares one sign-in limit.');
  if (!env.DATABASE_URL && !env.DB_FILE) warnings.push('Using the default ./shopnex.db. Make sure it is on a disk that survives restarts, and back it up.');
  return { errors, warnings };
}
