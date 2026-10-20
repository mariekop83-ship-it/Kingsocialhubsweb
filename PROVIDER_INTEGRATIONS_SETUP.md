# King Social Hub — provider integrations and purchase workflow

This build keeps provider calls on the Node/Express server. Do not place API keys in `public/`, HTML, browser JavaScript, screenshots, or customer-facing pages.

## Active provider map

- Buy Number 1: Grizzly SMS.
- Buy Number 2: OTP Suite.
- Buy Number 3: NovaSolution.
- Boosting 1: Really Simple Social.
- Boosting 2: NovaSolution.
- Marketplace 1: admin-managed inventory; Marketplace 2: RakibSocials; Marketplace 3: Lucylynxsocials. Marketplace 4 has no provider integration mounted in the reviewed `server.js`.

OTP Suite has **not** been removed: it remains the active Buy Number 2 provider. NovaSolution is separately active for Buy Number 3 and Boosting 2. This provider map matches `README.md`.

## What was completed in this build

- Fixed the Marketplace 1 status endpoint used by the storefront (`GET /api/market/status`). The Marketplace 1 on/off switch now persists in MongoDB through the existing Marketplace settings screen (`PUT /api/admin/market2/config`).
- Added an owner/admin-only provider readiness endpoint (`GET /api/admin/providers/status`) and a **Provider connections health** button on the admin dashboard. It reports ready/disabled/missing-key status without returning any secret values.
- Preserved and wired the existing provider modules and admin settings for OTP Suite, RakibSocials, Lucylynxsocials and Really Simple Social.
- Preserved the existing Grizzly SMS number purchase/status/cancellation flow and manual receipt approval / deposit reconciliation routes.
- The existing CSS and JavaScript assets are included in this ZIP; they are not empty placeholders. The only zero-byte files are `.gitkeep` directory markers used to keep upload folders in source control.

## Configure providers

### 1. Grizzly SMS — Buy Number 1

Set these in Render → your service → Environment:

- `GRIZZLY_API_KEY` — your real Grizzly API key
- `GRIZZLY_BASE_URL=https://api.grizzlysms.com/stubs/handler_api.php`

Then deploy/restart. In Admin → Number Server settings, ensure Server 2 / Grizzly is enabled. The provider must also have supplier balance and permission for the services you want to sell.

### 2. OTP Suite — Buy Number 2

Open Admin → **Buy Number 2 — OTP Suite pricing**. Set the official HTTPS API base URL, paste the API key, set the NGN markup, and save. The key is encrypted before it is stored in MongoDB. Use the admin balance button to verify connectivity. The service remains unavailable if the provider key is missing/invalid or the provider account is not authorised.

Environment fallback:

- `OTP_SUITE_BASE_URL=https://otpsuite.com/api/v1`
- `OTP_SUITE_API_KEY=...`
- `OTP_SUITE_MARKUP_NGN=300`

### 3. RakibSocials — Marketplace 2

Open Admin → Marketplace 2 (Rakib Socials). Enter the official base URL `https://rakibsocials.com/api/v1`, paste the API key, save, sync products, then set a customer selling price and enable each product. A product with no selling price stays hidden. The provider name/key is not shown to customers.

Environment fallback:

- `RAKIB_BASE_URL=https://rakibsocials.com/api/v1`
- `RAKIB_API_KEY=...`

### 4. Lucylynxsocials — Marketplace 3

Open Admin → Marketplace 3 (Lucylynxsocials). Enter `https://lucylynxsocials.com/api/v1`, paste the Bearer API key, save, sync products, then set a customer price and enable products. The key is encrypted in the database. Products with no selling price remain hidden.

Environment fallback:

- `LUCYLYNX_BASE_URL=https://lucylynxsocials.com/api/v1`
- `LUCYLYNX_API_KEY=...`

### 5. Really Simple Social — Boosting 1

Open Admin → Boost settings. Paste the API key, use `https://reallysimplesocial.com/api/v2`, save, sync services, configure the NGN pricing/profit tiers, and turn Boosting on. Services must be synced and priced/enabled before customers can order them.

Environment fallback:

- `BOOST_API_KEY=...`
- `BOOST_API_URL=https://reallysimplesocial.com/api/v2`

## Payments and approval

- Manual receipt approval is handled by the existing admin receipt queue. Only a receipt in `pending` state can be approved/rejected; the customer wallet is credited on approval.
- Payment link / virtual account / bank-transfer deposits use the existing provider verification and reconciliation routes. A gateway cannot be enabled successfully unless its server-side credentials are configured.
- Configure real payment credentials and webhook signing secrets in Render before accepting live payments. Never use test credentials for real customer deposits.

## Admin diagnostics

Open Admin → **Provider connections health**. For every integration:

- **READY** means a credential is configured and the feature switch is on; it does not guarantee the supplier is online or has balance.
- **DISABLED** means the feature switch is off.
- **MISSING KEY** means credentials need to be added in the admin settings or Render Environment.

After changing Render environment variables, redeploy/restart the service. After adding a key in the admin settings, use the relevant provider balance/sync action to verify it against the live supplier.

## Purchase safety

Marketplace and number purchase flows should only debit the customer wallet after validating the requested product/service and available balance. A confirmed supplier rejection should refund the debit. A timeout or uncertain provider response must be held for reconciliation rather than blindly refunded, because the supplier may have fulfilled the purchase despite a dropped response. Before launch, test each provider using a low-value authorised test purchase and verify both the customer ledger and supplier-side order history.
