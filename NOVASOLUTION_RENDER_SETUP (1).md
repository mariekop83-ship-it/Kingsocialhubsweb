# NovaSolution + Render setup

## Active NovaSolution integrations

NovaSolution is active for **Buy Number 3** and **SMM Boosting 2**. It is separate from OTP Suite, which remains the active provider for **Buy Number 2**. Grizzly SMS remains Buy Number 1. These provider assignments match `README.md` and the integration modules mounted by `server.js`.

## Render environment

Create a Node Web Service with build command `npm install` and start command `npm start`. Set `NOVA_API_KEY` in Render Dashboard → Environment and, if needed, set `NOVA_BASE_URL`. The default base URL is `https://www.novasolution.ng/api/v1`. Keep credentials server-side; do not commit `.env` or provider keys.

## NovaSolution catalogue use

- **Buy Number 3** uses the NovaSolution number catalogue and order flow.
- **SMM Boosting 2** uses the NovaSolution SMM catalogue and order flow.

These are separate catalogues. Configure and test the relevant service in the admin panel. NovaSolution availability depends on a valid API key, supplier account permissions, service availability, and provider balance.

## Admin and verification

Use Admin → Numbers to configure and check the NovaSolution number integration, and Admin → Boosting 2 to sync the SMM catalogue and configure customer pricing. Provider keys remain server-side and must never be exposed in customer-facing pages.

A local syntax check does not verify live provider operations. A real purchase, status/SMS polling, or cancellation test requires valid NovaSolution credentials and an adequately funded provider account. Do not claim live verification until those tests pass.

## Credential safety

Do not commit `.env` or provider keys. Configure production secrets in Render Environment. If any real credentials were previously committed or shared, rotate them before deployment.
