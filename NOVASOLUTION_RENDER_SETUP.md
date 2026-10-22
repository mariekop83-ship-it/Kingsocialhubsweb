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

Use Admin → Numbers to enable Buy Number 3, check the NovaSolution balance/catalogue, and sync the saved number catalogues. In **Buy Number 3 Services & Customer Pricing**, choose a country and search by service, category, or ID to enable/disable a service, control its customer visibility, and set a country-specific NGN selling price. A blank override uses the existing profit ladder. Catalogue sync preserves these settings; failed or incomplete syncs keep the last saved catalogue.

In **Admin → Boost 2 services**, sync the separate SMM catalogue, then set each service to a provider-rate-plus-markup price or a specific selling price in NGN. Services can be disabled or hidden independently. The displayed provider rate is priced per its reported rate unit (defaulting to 1,000 when the catalogue omits that field). Customer orders appear in Boost History alongside Boosting 1. If a provider response is uncertain, the debit is held for reconciliation rather than automatically refunded; the customer is asked to check order history before retrying.

The owner can set the global logo in **Admin → Contact info & links → Site-wide brand logo**. Product-brand mappings are managed in the adjacent **Product brand logos** section; add a brand name, optional aliases, and image, then enable, disable, edit, replace, or delete the mapping. Matching is whole-word/phrase based, uses the most specific match, and overrides product imagery in Marketplace 1, 2, and 3 while leaving product prices and provider settings unchanged. PNG, JPEG, or WebP files up to 3 MB are supported. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in Render for persistent uploads; brand-logo uploads are disabled until Cloudinary is configured. Provider keys and Cloudinary secrets remain server-side and must never be exposed in customer-facing pages.

A local syntax check does not verify live provider operations. A real purchase, status/SMS polling, or cancellation test requires valid NovaSolution credentials and an adequately funded provider account. Do not claim live verification until those tests pass.

## Credential safety

Do not commit `.env` or provider keys. Configure production secrets in Render Environment. If any real credentials were previously committed or shared, rotate them before deployment.
