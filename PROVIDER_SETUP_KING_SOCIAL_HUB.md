# King Social Hub — provider setup

This package keeps the existing UI/CSS layout while configuring the requested provider map.

- Buy Number 1: Grizzly SMS (existing server2 Grizzly flow is used in the dedicated page).
- Buy Number 2: OTP Suite (`OTP_SUITE_BASE_URL`, `OTP_SUITE_API_KEY`).
- Buy Number 3: NovaSolution (`NOVA_API_KEY`, `NOVA_BASE_URL`).
- Boosting 1: Really Simple Social (`BOOST_API_KEY`, existing configuration).
- Boosting 2: NovaSolution (`NOVA_API_KEY`, `NOVA_BASE_URL`).
- Marketplace 1: admin-managed inventory (existing).
- Marketplace 2: RakibSocials (`RAKIB_BASE_URL`, `RAKIB_API_KEY`).
- Marketplace 3: Lucylynxsocials (`LUCYLYNX_BASE_URL`, `LUCYLYNX_API_KEY`).

## Required deployment environment
Set `MONGODB_URI`, `JWT_SECRET` (32+ random characters), `ADMIN_PASSCODE`, and the payment provider settings already documented in the existing README/setup docs. Add provider API keys in the hosting environment; do not place real API keys in public files or commit them.

## OTP Suite notes
The server routes use `X-API-KEY` server-side. The customer's purchase is debited from the site wallet before provider purchase. Definite provider failures are refunded; ambiguous timeouts are held for review to avoid duplicate purchases. SMS polling and cancellation are customer-authenticated. Cancellation credits the customer only after OTP Suite confirms cancellation/refund.

## NovaSolution notes
NovaSolution is active for Buy Number 3 and Boosting 2. It is separate from OTP Suite, which remains active for Buy Number 2. Configure `NOVA_API_KEY` and, optionally, `NOVA_BASE_URL` in Render Environment. The default base URL is `https://www.novasolution.ng/api/v1`.

## Marketplace 3 notes
Lucylynxsocials uses `Authorization: Bearer <API_KEY>`, and product keys are stored immediately from the one-time `/buy` response. Catalogue and provider balance are server-side.

## Important
Provider integrations require valid credentials and live testing before launch. A provider can reject requests if account access is not enabled or its supplier wallet is low. Do not use the service to buy or distribute accounts/credentials without proper authorisation.
