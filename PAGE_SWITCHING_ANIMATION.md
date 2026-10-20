# King Social Hub — Page Switching Animation

Applied to the existing HTML pages using shared assets:

- `public/css/page-transitions.css`
- `public/js/page-transitions.js`

### Behavior
- Short fade/slide entrance on page load.
- Branded translucent transition overlay when navigating to another same-origin page.
- Animated King Social Hub crown card and subtle loading dots.
- Handles normal internal links while preserving modifier-clicks, downloads, external links, `target` links, hash links, and links marked `data-no-transition` / `data-keep-page`.
- Resets on browser back/forward cache restores.
- Respects the operating system's reduced-motion preference.

The transition is visual only and does not change API calls, purchasing behavior, wallet logic, or navigation destinations.
