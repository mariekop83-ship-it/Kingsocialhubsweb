/* Full-screen three-dot loader for the Boost pages. */
(function () {
  if (window.KshBoostLoader) return;
  var css = '#ksh-boost-loader{position:fixed;inset:0;z-index:2147483000;background:#0b0d11;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;color:#cfe9da;font:800 15px system-ui,sans-serif}' +
    '#ksh-boost-loader.on{display:flex}' +
    '#ksh-boost-loader .bl-dots{display:inline-flex;gap:8px}' +
    '#ksh-boost-loader .bl-dots i{display:block;width:12px;height:12px;border-radius:50%;background:#22c55e;animation:kshBl 1.1s infinite ease-in-out both}' +
    '#ksh-boost-loader .bl-dots i:nth-child(2){animation-delay:.16s}#ksh-boost-loader .bl-dots i:nth-child(3){animation-delay:.32s}' +
    '@keyframes kshBl{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-9px);opacity:1}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var el = document.createElement('div');
  el.id = 'ksh-boost-loader'; el.className = 'on'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<span class="bl-dots"><i></i><i></i><i></i></span>';
  document.documentElement.appendChild(el);
  var timer = null;
  function show() {
    el.classList.add('on'); document.documentElement.style.overflow = 'hidden';
    clearTimeout(timer); timer = setTimeout(hide, 45000); // safety: never block the page forever
  }
  function hide() {
    clearTimeout(timer); el.classList.remove('on'); document.documentElement.style.overflow = '';
  }
  window.KshBoostLoader = { show: show, hide: hide };
  show();
})();
