# Airtime, Data & Cable TV (VTUGATE)

Replaces the old Referrals section. Page: `/vtu` (old `/referrals`, `/airtime`, `/data`, `/cable` redirect there).

## Render
Set ONE environment variable: `VTUGATE_API_KEY` (use your TEST key first, then the live key).
Optional first-run defaults: `VTU_MARKUP_PERCENT` (3), `VTU_AIRTIME_MARKUP_PERCENT` (0).

## Admin panel -> "Airtime & Data (VTU)"
- Your VTUGATE wallet balance
- ON/OFF switch + maintenance message
- Markup % for data, cable and airtime; min/max airtime
- Fixed price per data/cable plan (never below your cost)
- Orders: those held for review can be marked delivered or refunded

## Safety
Prices come from VTUGATE's catalogue on the server. Wallet is debited first; a definite
failure refunds automatically; an unknown result is held for review (no blind refund).
Sandbox: a phone/smartcard number ending 1111 simulates failure.
