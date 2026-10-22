/**
 * apply-remove-footer-and-crowns.js
 *
 * Run from the project root:   node apply-remove-footer-and-crowns.js
 *
 * What it does (edits the ORIGINAL files in place, no duplicates):
 *  1. Removes the whole site footer from every page (logo/crown, "Verified Social
 *     Media Account Seller", Channel/Group/Contact/Terms links, visitors counter,
 *     "© King Social Hub. All rights reserved.").
 *  2. Removes every "KingBadBoi Log Sale" text (the line under "King Social Hub"
 *     in the header/settings, page titles, home text, receipt image text).
 *  3. Removes the leftover crowns: drawer menu 👑, marketplace "Admin" crown badge,
 *     promo-banner ♛.
 *
 * KEPT on purpose: the crown on the home page, the login and register pages, the
 * normal logo, and the loading effects.
 *
 * Safe to run more than once.
 */
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, 'public');
let changedFiles = 0;

function edit(file, fn) {
  const p = path.join(PUBLIC, file);
  if (!fs.existsSync(p)) return;
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after !== before) {
    fs.writeFileSync(p, after);
    changedFiles++;
    console.log('  updated', file);
  }
}

// ── 1 + 2: every real .html page (skip .bak backups) ──────────────────────────
for (const f of fs.readdirSync(PUBLIC).filter(n => n.endsWith('.html'))) {
  edit(f, s => s
    // whole footer block
    .replace(/[ \t]*<footer class="site-footer">[\s\S]*?<\/footer>\s*/g, '')
    // "KingBadBoi Log Sale" line under the brand name
    .replace(/[ \t]*<span class="brand-full">\s*KingBadBoi Log Sale\s*<\/span>\s*\n?/g, '')
    // titles / paragraph text
    .replace(/ — KingBadBoi Log Sale/g, ' — King Social Hub')
    .replace(/King Social Hub \(KingBadBoi Log Sale\)/g, 'King Social Hub')
    .replace(/KingBadBoi Log Sale/g, 'King Social Hub'));
}

// ── 2 + 3: scripts ────────────────────────────────────────────────────────────
edit('script.js', s => s
  .replace(/ King Social Hub · KingBadBoi Log Sale/g, ' King Social Hub')
  // crown on the marketplace "Admin" badge
  .replace(/<svg class="icon i-crown" aria-hidden="true"><use href="#i-crown"\/><\/svg> Admin <span class="m-verified">/g,
           'Admin <span class="m-verified">')
  // crown in the promo banner placeholder
  .replace(/<span class="kls-promo-crown" aria-hidden="true">♛<\/span>/g,
           '<span class="kls-promo-crown" aria-hidden="true">📢</span>'));

edit(path.join('js', 'app-shell.js'), s => s
  .replace(/<div class="ksh-drawer-brand">👑 King Social Hub<\/div>/g,
           '<div class="ksh-drawer-brand">King Social Hub</div>'));

console.log(changedFiles
  ? `\nDone. ${changedFiles} file(s) updated.`
  : '\nNothing to change (already applied).');