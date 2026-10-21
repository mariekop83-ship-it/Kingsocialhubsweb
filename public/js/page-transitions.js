/* King Social Hub page switching animation. Same-origin navigation only. */
(function () {
  'use strict';
  if (window.__kshPageTransitions) return;
  window.__kshPageTransitions = true;

  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}

  function setup() {
    if (!document.body) return;
    var overlay = document.getElementById('ksh-page-transition');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ksh-page-transition';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = '<div class="ksh-transition-card"><span class="ksh-transition-crown">♛</span><span class="ksh-transition-copy"><span>King Social Hub</span><small>Switching page</small></span><span class="ksh-transition-dots" aria-hidden="true"><i></i><i></i><i></i></span></div>';
      document.body.appendChild(overlay);
    }
    document.documentElement.classList.add('ksh-transition-ready');

    document.addEventListener('click', function (event) {
      if (reduceMotion || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (!link || link.hasAttribute('download') || link.target && link.target.toLowerCase() !== '_self' || link.hasAttribute('data-no-transition')) return;
      if (link.closest('#ksh-page-transition') || link.closest('[data-no-transition]')) return;
      var raw = link.getAttribute('href');
      if (!raw || raw.charAt(0) === '#' || /^(?:javascript:|mailto:|tel:|sms:|blob:|data:)/i.test(raw)) return;
      var destination;
      try { destination = new URL(raw, window.location.href); } catch (_) { return; }
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.hash) return;
      if (destination.pathname === window.location.pathname && destination.search === window.location.search && !destination.hash) return;
      // Let native buttons, SPA controls and links with explicit handlers keep their behavior.
      if (link.hasAttribute('data-keep-page') || link.getAttribute('role') === 'button') return;
      event.preventDefault();
      overlay.classList.add('is-active');
      document.documentElement.classList.add('ksh-transition-leaving');
      window.setTimeout(function () { window.location.assign(destination.href); }, 175);
    }, true);

    // Restore a clean state for back/forward cache restores and tab returns.
    window.addEventListener('pageshow', function () {
      overlay.classList.remove('is-active');
      document.documentElement.classList.remove('ksh-transition-leaving');
      document.documentElement.classList.add('ksh-transition-ready');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
