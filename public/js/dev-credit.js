/* Site credits and owner contact strip */
(function () {
  'use strict';
  if (window.__klsDevCredit) return;
  window.__klsDevCredit = true;
  var OWNER_TELEGRAM = '@kingsocialhub';
  function mount() {
    if (document.querySelector('.kls-devbar')) return;
    var bar = document.createElement('div');
    bar.className = 'kls-devbar';
    bar.innerHTML =
      '<div class="kls-devbar-inner">' +
        '<div class="kls-devbar-main">' +
          '<span class="kls-devbar-dot" aria-hidden="true"></span>' +
          '<span class="kls-devbar-txt">Designed and engineered by developer <strong>Marvel</strong></span>' +
        '</div>' +
        '<div class="kls-devbar-buy">' +
          'Want to buy this website? Contact the admin / owner on <span class=\"kls-devbar-tg\" style=\"font-weight:700;text-decoration:none;cursor:default;color:inherit\">Telegram: ' + OWNER_TELEGRAM + '</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
