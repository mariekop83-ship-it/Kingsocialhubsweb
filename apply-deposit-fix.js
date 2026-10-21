/*
  King Social Hub - deposit page header fix
  Run from the project root (the folder that has server.js):
      node apply-deposit-fix.js

  What it does:
   1. Removes the long Numbers / Boost / Giveaways / Groups / DMs pills
      (a script was forcing the hidden desktop menu to show on phones).
   2. Moves the green "Back" bar from the very top of the screen to
      just under the header (after the hamburger / King Social Hub bar).
  Safe to run twice - it skips anything already applied.
*/
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const p = (...a) => path.join(root, ...a);

if (!fs.existsSync(p('public', 'index.html')) || !fs.existsSync(p('public', 'js', 'back-button.js'))) {
  console.error('ERROR: run this from the project root (the folder that contains server.js and public/).');
  process.exit(1);
}

let changed = 0;
function edit(file, fn, label) {
  const fp = p(...file);
  const before = fs.readFileSync(fp, 'utf8');
  const after = fn(before);
  if (after === null) { console.log('  skipped (already applied): ' + label); return; }
  if (after === false) { console.error('  FAILED: could not find the spot to edit in ' + file.join('/') + ' (' + label + ')'); process.exitCode = 1; return; }
  fs.writeFileSync(fp, after);
  changed++;
  console.log('  done: ' + label);
}

/* 1. New CSS file ---------------------------------------------------- */
const css = `/* King Social Hub - header fix: no desktop nav pills inside the app, Back bar sits under the header */
html body .navbar .nav-center,
html body #navCenter,
html body.app-shell .nav-center { display: none !important; }

/* Back bar now sits under the header instead of above it */
html body #kslBackBar {
  position: relative !important;
  top: auto !important;
  z-index: 1 !important;
  padding: 10px 14px 0 !important;
  background: transparent !important;
  border-bottom: 0 !important;
}
html body #kslBackBar button { padding: 7px 14px !important; font-size: 13px !important; }
`;
const cssPath = p('public', 'css', 'ksh-header-fix.css');
if (fs.readFileSync && fs.existsSync(cssPath) && fs.readFileSync(cssPath, 'utf8') === css) {
  console.log('  skipped (already applied): css file');
} else {
  fs.writeFileSync(cssPath, css);
  changed++;
  console.log('  done: created public/css/ksh-header-fix.css');
}

/* 2. Link the CSS in index.html (last, so it wins) --------------------- */
edit(['public', 'index.html'], (s) => {
  if (s.includes('ksh-header-fix.css')) return null;
  const anchor = '<link rel="stylesheet" href="/css/king-home-refresh.css?v=1">';
  if (!s.includes(anchor)) return false;
  return s.replace(anchor, anchor + '\n<link rel="stylesheet" href="/css/ksh-header-fix.css?v=1">');
}, 'linked ksh-header-fix.css in public/index.html');

/* 3. Back bar goes under the header -------------------------------- */
edit(['public', 'js', 'back-button.js'], (s) => {
  if (s.includes('ksh-after-navbar')) return null;
  const oldInsert = 'document.body.insertBefore(bar, document.body.firstChild);';
  if (!s.includes(oldInsert)) return false;
  const newInsert =
    '/* ksh-after-navbar */ var nav = document.querySelector(\'.navbar\');\n' +
    '    if (nav && nav.parentNode) nav.parentNode.insertBefore(bar, nav.nextSibling);\n' +
    '    else document.body.insertBefore(bar, document.body.firstChild);';
  return s.replace(oldInsert, newInsert);
}, 'Back bar now mounts under the header in public/js/back-button.js');

/* 3b. Stop king-brand.js from forcing the desktop menu visible ------- */
edit(['public', 'js', 'king-brand.js'], (s) => {
  if (s.includes('ksh-skip-navcenter')) return null;
  const old = 'var p=w.parentElement;\n    p.style.setProperty(\'display\',\'flex\',\'important\');';
  if (!s.includes(old)) return false;
  return s.replace(old, 'var p=w.parentElement;\n    /* ksh-skip-navcenter */ if(p.id===\'navCenter\'||(p.classList&&p.classList.contains(\'nav-center\')))return;\n    p.style.setProperty(\'display\',\'flex\',\'important\');');
}, 'king-brand.js no longer shows the desktop menu pills');

edit(['public', 'index.html'], (s) => {
  if (s.includes('/js/king-brand.js?v=2')) return null;
  const old = '/js/king-brand.js?v=1';
  if (!s.includes(old)) return false;
  return s.replace(old, '/js/king-brand.js?v=2');
}, 'cache version bumped for king-brand.js in public/index.html');

/* 4. Bust the browser cache for back-button.js ----------------------- */
edit(['public', 'script.js'], (s) => {
  if (s.includes("/js/back-button.js?v=3")) return null;
  const old = "/js/back-button.js?v=1";
  if (!s.includes(old)) return false;
  return s.replace(old, "/js/back-button.js?v=3");
}, 'cache version bumped in public/script.js');

console.log(changed ? '\nAll set. Now commit and push (see steps).' : '\nNothing to change - fix was already applied.');