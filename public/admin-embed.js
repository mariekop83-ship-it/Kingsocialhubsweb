/* Runs first inside every embedded admin section.
   Goal: once the admin has unlocked the panel, NO section ever asks for the passcode again.
   - always sends the admin's current login with every /api/admin request
   - a section can never wipe the saved login
   - only shows "session ended" when the server really rejects the passcode;
     any other problem (server error, missing route, network) shows a normal error with Retry */
(function () {
  var KEY = 'ksl_admin_pass', KEY_STAFF = 'ksl_staff_token';
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  var origRemove = null;

  try { document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}

  /* make sure this frame can see the admin login (same tab storage; copy from parent as a fallback) */
  try {
    if (window.parent && window.parent !== window) {
      [KEY, KEY_STAFF].forEach(function (k) {
        try {
          if (!sessionStorage.getItem(k)) {
            var v = window.parent.sessionStorage.getItem(k);
            if (v) sessionStorage.setItem(k, v);
          }
        } catch (e) {}
      });
    }
  } catch (e) {}

  function cred() {
    var pass = '', staff = '';
    try { pass = sessionStorage.getItem(KEY) || ''; } catch (e) {}
    if (!pass) {
      try { var s = JSON.parse(sessionStorage.getItem(KEY_STAFF) || 'null'); staff = (s && s.token) || ''; } catch (e) {}
    }
    return { pass: pass, staff: staff };
  }

  /* never let a section delete the saved admin login */
  try {
    origRemove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (k) {
      if ((k === KEY || k === KEY_STAFF) && this === window.sessionStorage) return;
      return origRemove.apply(this, arguments);
    };
  } catch (e) {}

  /* always attach the live admin login to admin API calls */
  if (origFetch) {
    window.fetch = function (input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if (/\/api\/admin(\/|\?|$)/.test(url)) {
          var c = cred();
          init = init || {};
          var h = new Headers(init.headers || (typeof input !== 'string' && input && input.headers) || {});
          if (c.pass) h.set('x-admin-passcode', c.pass);
          else if (c.staff && !h.get('Authorization')) h.set('Authorization', 'Bearer ' + c.staff);
          init.headers = h;
        }
      } catch (e) {}
      return origFetch(input, init);
    };
  }

  function boxEl() {
    var box = document.getElementById('admExpired');
    if (!box) {
      box = document.createElement('div'); box.id = 'admExpired';
      box.innerHTML = '<b id="admExpiredTitle"></b><span id="admExpiredMsg"></span><br><button type="button" id="admExpiredBtn"></button>';
      document.body.insertBefore(box, document.body.firstChild);
    }
    return box;
  }
  function paint(kind, msg) {
    var box = boxEl();
    var title = document.getElementById('admExpiredTitle');
    var text = document.getElementById('admExpiredMsg');
    var btn = document.getElementById('admExpiredBtn');
    if (kind === 'expired') {
      title.textContent = 'Your admin session has ended';
      text.textContent = 'Please log in to the admin panel again.';
      btn.textContent = 'Log in again';
      btn.onclick = function () {
        try { origRemove.call(window.sessionStorage, KEY); origRemove.call(window.sessionStorage, KEY_STAFF); } catch (e) {}
        try { (window.parent && window.parent !== window ? window.parent : window).location.reload(); } catch (e) { location.reload(); }
      };
    } else {
      title.textContent = 'Could not load this section';
      text.textContent = msg ? String(msg) : 'Something went wrong. Your admin login is still active.';
      btn.textContent = 'Try again';
      btn.onclick = function () { location.reload(); };
    }
    box.style.display = 'block';
    var app = document.getElementById('app'); if (app) app.style.display = 'none';
  }

  /* called by the section pages whenever a load fails */
  window.__admExpired = function (msg) {
    var c = cred();
    if (!c.pass && !c.staff) return paint('expired');            // nothing saved at all
    if (!c.pass) return paint('error', msg);                      // staff login: never claim "expired" from here
    if (!origFetch) return paint('error', msg);
    origFetch('/api/admin/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: c.pass })
    }).then(function (r) {
      if (r.status === 403) paint('expired');                      // server really rejects the passcode
      else paint('error', msg);                                    // passcode is fine, so the problem is something else
    })
      .catch(function () { paint('error', msg); });
  };
})();
