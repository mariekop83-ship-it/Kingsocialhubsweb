// Fixes "Marketplace 4 shows nothing to customers".
// Cause: /marketplace4 was never registered in public/script.js, so the page never ran initMarket4()
// and never requested the products you priced in the admin panel.
// Run from the project root:   node apply-market4-customer-fix.js
const fs = require('fs');
const path = require('path');

let changed = 0, problems = 0;

function patch(file, edits) {
  if (!fs.existsSync(file)) return;               // e.g. dist/ may not exist
  let s = fs.readFileSync(file, 'utf8');
  const orig = s;
  for (const e of edits) {
    if (s.includes(e.done)) continue;             // already applied
    if (!s.includes(e.find)) { console.error(`  ! ${file}: could not find "${e.label}"`); problems++; continue; }
    s = s.replace(e.find, e.replace);
  }
  if (s !== orig) {
    fs.copyFileSync(file, file + '.bak-before-m4-fix');
    fs.writeFileSync(file, s, 'utf8');
    console.log('  updated ' + file);
    changed++;
  } else {
    console.log('  no change needed: ' + file);
  }
}

for (const dir of ['public', 'dist']) {
  patch(path.join(__dirname, dir, 'script.js'), [
    { label: 'route list', find: "market3: '/marketplace3',", replace: "market3: '/marketplace3', market4: '/marketplace4',", done: "market4: '/marketplace4'" },
    { label: 'page container mapping', find: "(p === 'market2' || p === 'market3') ? 'market' : p", replace: "(p === 'market2' || p === 'market3' || p === 'market4') ? 'market' : p", done: "p === 'market4') ? 'market'" },
    { label: 'login-required list', find: "'market2','market3','tools'", replace: "'market2','market3','market4','tools'", done: "'market3','market4'" },
    { label: 'page loader', find: "market3:      () => window.initMarket3?.(),", replace: "market3:      () => window.initMarket3?.(),\n    market4:      () => window.initMarket4?.(),", done: "window.initMarket4?.()" },
  ]);
  // Force browsers to fetch the fixed scripts on the Marketplace 4 page.
  if (dir === 'public') patch(path.join(__dirname, dir, 'marketplace4.html'), [
    { label: 'script.js version', find: '/script.js?v=20260910a', replace: '/script.js?v=20261022m4', done: '/script.js?v=20261022m4' },
    { label: 'market4.js version', find: '/market4.js?v=1', replace: '/market4.js?v=2', done: '/market4.js?v=2' },
  ]);
}

if (!fs.existsSync(path.join(__dirname, 'public', 'script.js'))) { console.error('Run this from the project root folder (where server.js is).'); process.exit(1); }
console.log(problems ? `\nFinished with ${problems} problem(s) - see messages above.` : (changed ? '\nDone.' : '\nAlready applied - nothing to do.'));