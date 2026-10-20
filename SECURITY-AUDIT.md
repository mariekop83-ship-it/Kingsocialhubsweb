# Security audit (static code review — not a penetration test)

## Fixed in this ZIP
0. NovaSolution Boosting 2: ambiguous provider outcomes (timeout, dropped connection, HTTP 5xx) no longer trigger an automatic wallet refund. Orders are persisted before debit/provider submission, sent with a stable Idempotency-Key, and marked for reconciliation while funds remain on hold. Definite provider rejections use a state-claimed refund path; a later transaction-log failure cannot trigger a second refund.
1. Flutterwave webhook accepted forged requests when FLW_SECRET_HASH was unset (free wallet funding). Now rejected unless the hash is set and matches (constant-time).
2. Deposit verification failed OPEN ("trusting the webhook" if Flutterwave API was unreachable). Now fails closed; payment-link and bank-transfer webhooks are also confirmed with Flutterwave (ref, amount, currency). Cross-channel double-credit guard added.
3. Race conditions (free purchases / negative balance): website buy, buy-multi, API v1 buy and buy-multi, and Server-2 numbers used check-then-debit or read-modify-write. Now one atomic conditional debit; atomic stock claim (no overselling, no double buy).
4. Master admin passcode was embedded in WhatsApp "quick-action" GET links (also logged). Link removed, route disabled (410).
5. Receipt approval could double-credit; now an atomic claim, validated action, atomic $inc.
6. Referral commission, weekly reward and referral bonuses used read-modify-write balance saves; now atomic $inc.
7. Admin passcode compared in constant time; failed admin attempts rate-limited (40 / 15 min / IP).
8. X-Forwarded-For was trusted for the 5-accounts-per-person limit (spoofable); now uses proxy-aware req.ip.
9. Google sign-in now requires a verified email. Narration-based VA matching no longer builds a regex from untrusted text.
10. Hard-coded Grizzly API key removed from code. ROTATE THAT KEY — it is in your repo history.
11. Server refuses to start without JWT_SECRET; warns on weak secrets / missing FLW_SECRET_HASH.

## Still recommended (not changed)
- Rotate: GRIZZLY_API_KEY, and ADMIN_PASSCODE if it was ever sent via WhatsApp links.
- Number cancel vs. status-poll race can refund a number whose code was just delivered.
- Nova Boosting 2 still needs staging tests for timeout/5xx, duplicate-click, refund-failure and provider reconciliation paths before live use; static syntax checks do not prove these financial paths in production.
- Game scores are client-reported (leaderboard cheating); validate server-side if prizes depend on it.
- Uploaded deliverable files / receipts are served from public/ (unguessable names but not access-controlled); use Cloudinary private/authenticated delivery or an authenticated download route.
- apiSecret stored in plaintext (hash it). Email change needs password/email confirmation.
- CSP is disabled; CORS is open (acceptable for token auth, tighten if you can).
- lib/server.js, lib/server2.js and root lib__*.js / public__*.js are unused old copies — delete them.
- Test on staging with real Flutterwave/Paystack test webhooks before going live.
