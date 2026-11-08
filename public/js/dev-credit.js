/* Site credits and owner contact strip */
(function () {
  'use strict';
  if (window.__klsDevCredit) return;
  window.__klsDevCredit = true;
  var OWNER_TELEGRAM = 'https://t.me/kingsocialhub';
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
          'Want to buy this website? <a href=\"' + OWNER_TELEGRAM + '\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"kls-devbar-cta\">Contact the admin / owner on Telegram</a>' +
        '</div>' +
      '</div>';
    bar.style.paddingRight = '84px';
    document.body.appendChild(bar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
