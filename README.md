# ShopNex (test-mode build)

Escrow marketplace: buyers, sellers, riders and admin, one app. Plain Node.js (22.13 or newer), no install step for the default setup. Money is whole kobo, and every movement is a balanced ledger pair.

## Run it on your computer
    npm run seed                                   # demo sellers, products, a rider, coupon NEX10 (first time only)
    $env:ADMIN_PHONE="+2348000000001"; npm start   # Windows PowerShell
    ADMIN_PHONE=+2348000000001 npm start           # Mac or Linux
Open http://localhost:3000. In test mode, codes appear on screen and checkout has a "Pay (test mode)" button. Leave the terminal open while you use the site.

## Demo accounts (after `npm run seed`, password `Demo@1234`)
| Role | Phone |
|---|---|
| Admin | +2348000000001 |
| Sellers | +2348100000001 to +2348100000004 |
| Rider | +2348200000001 |
Any other number can sign up as a buyer, seller or rider. One account has one role, so use a different phone to sell and to shop.

## The admin page
Open **/admin** (http://localhost:3000/admin, or `https://your-domain/admin`). It is the same app, and the account's role decides which portal opens.
- **First admin:** start the server with your own number as `ADMIN_PHONE`, then **Sign up** with exactly that number. It becomes admin after the phone code. Nobody else can become admin by signing up.
- **Log in** at /admin with the password, then a second code (texted to the phone). In **Account**, set up an authenticator app. After that every admin login needs the app code, or one of 8 one-time recovery codes. Keep those codes safe.
- **More admins:** an existing admin opens **Users** and changes the person's role to admin.
- **Locked out:** use a recovery code. With none left, stop the server and ask whoever runs it to remove the `totp` entry from your user record in the database, then log in and set it up again. Five wrong codes lock an account for 15 minutes.

## The look
The screens follow the ShopNex design (colours, type and components in `public/style.css`, which starts from the design's tokens). Buyer, seller, admin and rider portals share one set of components and adapt to phones, with a bottom tab bar for buyers and riders. It follows the device's light or dark setting. Fonts load from Google Fonts (allowed in the security policy in `src/server.js`); without them the app falls back to system fonts.

## What is in it
- **Accounts:** sign up as buyer, seller or rider (terms tick box required), phone code verification, password login, forgot password, email verification, change password, sign out of all devices, rider approval by admin, admin second step.
- **Buyers:** search, categories, sponsored items, cart with one payment, coupons, delivery codes, orders, notifications, help form, seller application.
- **Sellers:** KYC application, balance (withdrawable vs escrow), products with photos, orders and rider dispatch, plans and ad boosts.
- **Riders:** assigned deliveries, code confirmation, reject as fine or damaged.
- **Admin:** dashboard, vendors and KYC, users and roles, products, orders, disputes, finance and batch payouts, coupons, complaints, settings, audit log.
- **Escrow:** server-enforced states, code lockout, duplicate-payment protection, payments confirmed with Paystack before money is held, trust scores with automatic suspend and ban.
- **Pages:** /terms.html and /privacy.html are **drafts for a Nigerian lawyer to review** before launch.

## The database
All data is saved in a real database, in one transaction per request, and a reply is only sent after the save is committed.
- **Default: SQLite** (built into Node 22.13+), in the file `./shopnex.db` (change with `DB_FILE`). Good for one server with a disk that survives restarts.
- **Postgres:** set `DATABASE_URL`, run `npm install pg`, then `npm run db:check`. If your host needs SSL, also set `PGSSL=require`. *The Postgres driver is written to the same contract as the SQLite one but was not run against a live Postgres server when this was built, so run `db:check` before trusting it.*
- **One server at a time.** The app keeps its working data in memory, so two copies against one database would disagree. Postgres mode refuses to start a second copy.
- **Moving from older versions:** if `data.json` exists and the database is empty, its contents are imported once on first start. The file is left in place as a backup.
- **If a save ever fails,** the app replies with an error and restarts so memory matches the database. Run it under a supervisor (your host's restart policy, systemd, pm2).
- **Backups:** `npm run backup` saves a consistent copy of the database and the photos into `./backups` (newest 14 kept; `BACKUP_KEEP`). Run it daily from a scheduler, and copy the files off the server. Postgres mode uses `pg_dump`, or use your host's backups.

## Testing payments and other services
- `npm test` runs the money-rule, account, database and payment tests. With the server running and seeded, `npm run smoke` and `npm run ui-check` drive a full order through every portal. Start the server with `OTP_LIMIT=50 AUTH_RATE=100` for them, because they log in more often than the normal limits allow.
- **Paystack test mode:** set `PAYSTACK_SECRET_KEY=sk_test_...`. Buyers are sent to Paystack, then back to the site, which confirms the payment with Paystack. Set `PUBLIC_URL` to the address Paystack should return to. To test the webhook without a public address, start the server with `SKIP_VERIFY=1` (never allowed in production), create an order without paying, and run `PAYSTACK_SECRET_KEY=sk_test_... node scripts/fake-webhook.mjs <groupId>`. Add `--forge` to check a bad signature is refused.
- **SMS (Termii)** needs `TERMII_API_KEY` (and `TERMII_SENDER`). **Email (Resend)** needs `RESEND_API_KEY` (and `MAIL_FROM`). Both adapters are untested against the live services.
- **Photos:** stored in `./uploads` (change with `UPLOAD_DIR`). Keep that folder with the database and include it in backups.

## Going live
The server refuses to start with `NODE_ENV=production` unless the safety settings are in place.
| Setting | Meaning |
|---|---|
| `NODE_ENV=production` | Turns on the safety checks, HTTPS-only headers, and request logging |
| `APP_SECRET` | A random string of 32+ characters (signs login sessions) |
| `PUBLIC_URL` | Your site address, starting with `https://` |
| `PAYSTACK_SECRET_KEY` | Live key (`sk_live_...`) also needs `ALLOW_LIVE=1`, set only after the checks below |
| `TERMII_API_KEY`, `RESEND_API_KEY` | Real SMS and email (SMS is required, email is strongly advised) |
| `ADMIN_PHONE` | The number that becomes the first admin |
| `TRUST_PROXY` | Number of proxies in front of the app (usually `1`). Without it, every visitor shares one sign-in limit |
| `DATABASE_URL` or `DB_FILE` | Where data lives (see above) |
| `UPLOAD_DIR` | Where photos live (a disk that survives restarts) |
Also: serve the site over HTTPS (your host or a reverse proxy does this), set the Paystack webhook to `https://your-domain/webhooks/paystack`, and never run `npm run seed` in production.

**Before real money:** CAC registration and Paystack live approval, a lawyer's review of the Terms, Privacy Policy and the way customer funds are held, a test with small real payments (including a refund and a dispute), and a first launch with a few trusted sellers and an order cap.

## Not built yet
Automatic seller payouts (they are queued, then an admin marks them paid after the bank transfer), a real BVN/NIN verification provider (sellers currently type their own names), running more than one server copy, and a monitoring/alerting service (the app logs each request in production; connect those logs to one).
