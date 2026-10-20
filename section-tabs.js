/* King Social Hub service shortcuts: active service + the matching history pages. */
(function () {
  'use strict';
  var path = location.pathname.replace(/\/$/, '') || '/';
  var groups = {
    numbers: {
      pages: ['/buy-number-grizzly', '/buy-number-otp', '/buy-number-nova', '/buy-number', '/number-history'],
      tabs: [
        ['📱 Buy Number 1', '/buy-number-grizzly', ['/buy-number-grizzly']],
        ['🔐 Buy Number 2', '/buy-number-otp', ['/buy-number-otp']],
        ['🌐 Buy Number 3', '/buy-number-nova', ['/buy-number-nova']],
        ['⚡ Active Numbers', '#activeNumbersCard', ['/buy-number-grizzly', '/buy-number-otp', '/buy-number-nova']],
        ['💬 SMS History', '/number-history', ['/number-history']]
      ]
    },
    boost: {
      pages: ['/boost1', '/boost2', '/boost', '/boost-services', '/boost-history', '/boost-all-services'],
      tabs: [
        ['🚀 Boost 1', '/boost1', ['/boost1', '/boost', '/boost-services', '/boost-all-services']],
        ['📈 Boost 2', '/boost2', ['/boost2']],
        ['🟢 New Order', '/boost1', ['/boost1', '/boost2', '/boost']],
        ['📋 Active / Past Orders', '/boost-history', ['/boost-history']],
        ['🧾 My Purchases', '/purchases', []]
      ]
    },
    logs: {
      pages: ['/marketplace', '/marketplace2', '/marketplace3', '/marketplace4', '/purchases'],
      tabs: [
        ['🛍️ Marketplace 1', '/marketplace', ['/marketplace']],
        ['🛍️ Marketplace 2', '/marketplace2', ['/marketplace2']],
        ['🛍️ Marketplace 3', '/marketplace3', ['/marketplace3']],
        ['🛍️ Marketplace 4', '/marketplace4', ['/marketplace4']],
        ['📦 Marketplace History', '/purchases', ['/purchases']]
      ]
    }
  };
  var group = Object.keys(groups).map(function (key) {
    return groups[key].pages.indexOf(path) !== -1 ? groups[key] : null;
  }).filter(Boolean)[0];
  if (!group) return;

  function render() {
    if (document.querySelector('.ksh-service-tabs')) return;
    var heading = document.querySelector('h1');
    var host = heading && heading.parentElement;
    if (!heading || !host) return;
    var nav = document.createElement('nav');
    nav.className = 'ksh-service-tabs';
    nav.setAttribute('aria-label', 'Service pages and history');
    nav.innerHTML = group.tabs.map(function (tab) {
      var href = tab[1];
      var isActive = tab[2].indexOf(path) !== -1;
      if (href.charAt(0) === '#') {
        if (path === '/buy-number') href = '/buy-number-grizzly#activeNumbersCard';
        else if (path === '/buy-number-otp' || path === '/buy-number-nova') href = '#orders';
        else href = path + href;
      }
      return '<a class="ksh-service-tab' + (isActive ? ' is-active' : '') + '" href="' + href + '">' + tab[0] + '</a>';
    }).join('');
    heading.parentNode.insertBefore(nav, heading);
    // Make the active order/number panel reachable by the shortcut on each provider page.
    if (path === '/buy-number-grizzly') {
      var active = document.getElementById('activeNumbersCard');
      if (active) active.id = 'activeNumbersCard';
    }
    if (path === '/buy-number-otp' || path === '/buy-number-nova') {
      var orders = document.getElementById('orders');
      if (orders && !orders.id) orders.id = 'orders';
    }
  }
  var style = document.createElement('style');
  style.textContent = '.ksh-service-tabs{display:flex;gap:8px;overflow-x:auto;overscroll-behavior-x:contain;padding:10px 0 14px;margin:0 0 12px;border-bottom:1px solid var(--border2,rgba(255,255,255,.12));scrollbar-width:thin;-webkit-overflow-scrolling:touch}.ksh-service-tab{display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;text-decoration:none!important;border:1px solid var(--border2,rgba(255,255,255,.16));border-radius:999px;padding:10px 14px;font-size:12px;font-weight:800;color:var(--text,#e8edf4)!important;background:var(--card,#151922);transition:transform .15s,border-color .15s,background .15s}.ksh-service-tab:hover{transform:translateY(-1px);border-color:#28b463}.ksh-service-tab.is-active{background:#16a34a;color:#fff!important;border-color:#16a34a;box-shadow:0 5px 18px rgba(22,163,74,.2)}@media(max-width:600px){.ksh-service-tabs{margin-left:-2px;margin-right:-2px;padding-bottom:12px}.ksh-service-tab{padding:9px 12px;font-size:11px}}';
  document.head.appendChild(style);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
})();
