# Searchable Server / Country / Service Selectors

The NovaSolution Buy Number 3 page and OTP Suite Buy Number 2 page now use a shared mobile-first bottom-sheet chooser for their existing server, country, and service dropdowns.

## Customer experience
- Tapping a selector opens a card from the bottom of the screen (centered dialog on larger screens).
- Each chooser has a search field and filters the available options as the customer types.
- Country options display a country flag emoji when an ISO country code or known country name is available; otherwise a globe icon is used.
- Server and service choices have their own icons.
- Tapping an option sets the original select value, dispatches the normal change/input events, updates the visible selected card, and closes the sheet with a downward animation.
- The original selects remain in the DOM and continue to drive the existing provider/API logic; no API routes or purchase logic were changed.
- On pages with dependent selections, the existing change handlers continue to load dependent options.

## Files
- `public/css/king-select-sheet.css`
- `public/js/king-select-sheet.js`
- `public/buy-number-nova.html`
- `public/buy-number-otp.html`

Country flag rendering relies on country codes supplied by the catalogue where available, plus a broad country-name fallback map. If the provider sends neither a recognized ISO code nor a recognized country name, the chooser shows a globe icon rather than a potentially incorrect flag.
