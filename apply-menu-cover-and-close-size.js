#!/usr/bin/env node
/**
 * King Social Hub — (1) hamburger menu covers the Back button, (2) normal-size X close buttons
 *
 * Run from the repo root (the folder that contains server.js and public/):
 *     node apply-menu-cover-and-close-size.js
 *
 * 1. The Back bar (#kslBackBar) sits at z-index 9990 but the menu drawer was only 999,
 *    so Back showed on top of the open menu. The drawer + dim backdrop now sit above it.
 * 2. Close (X) buttons: the box was big (32-36px) with a tiny X inside. They now use a
 *    compact 30px round button with a normal 18px X, the same on every popup, modal,
 *    sheet and menu. Check marks / tick icons are not touched.
 *
 * Safe to run more than once. Only touches files under public/.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PUB = path.join(ROOT, 'public');
const VERSION = '20261022c';

if (!fs.existsSync(path.join(PUB, 'css')) || !fs.existsSync(path.join(ROOT, 'server.js'))) {
  console.error('ERROR: run this from the repo root (the folder containing server.js and public/).');
  process.exit(1);
}

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');

const CSS = `/* King Social Hub — menu above the Back bar + normal-size close (X) buttons */

/* 1. Hamburger menu + dim backdrop always cover the Back bar (z-index 9990) */
.ksh-menu-backdrop { z-index: 10005 !important; }
.ksh-drawer { z-index: 10010 !important; }

/* 2. Close buttons: compact round box, normal-size X */
.modal-x,
.ksh-drawer-close,
.ks-sheet-close,
.gmt-close,
.drawer-close,
.adm-drawer-close,
.kp-x,
.gw-win-close {
  width: 30px !important;
  height: 30px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  padding: 0 !important;
  border-radius: 50% !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 18px !important;
  line-height: 1 !important;
}
.modal-x svg, .modal-x .icon,
.ksh-drawer-close svg, .ks-sheet-close svg, .gmt-close svg,
.drawer-close svg, .adm-drawer-close svg, .kp-x svg, .gw-win-close svg {
  width: 18px !important;
  height: 18px !important;
  flex: 0 0 auto;
}
/* bare X buttons (no box) */
.rs-x, .kui-x { font-size: 18px !important; line-height: 1 !important; }
`;

write(path.join(PUB, 'css', 'ksh-ui-fixes.css'), CSS);
console.log('\nDone:\n  ✔ wrote public/css/ksh-ui-fixes.css');

const tag = '<link rel="stylesheet" href="/css/ksh-ui-fixes.css?v=' + VERSION + '">';
let n = 0;
for (const name of fs.readdirSync(PUB).sort()) {
  if (!/\.html$/i.test(name)) continue; // skips .bak files
  const file = path.join(PUB, name);
  const before = read(file);
  if (!before.includes('</head>')) continue;
  const after = before
    .replace(/<link rel="stylesheet" href="\/css\/ksh-ui-fixes\.css[^>]*>\s*/g, '')
    .replace('</head>', tag + '\n</head>');
  if (after !== before) {
    write(file, after);
    n++;
  }
}
console.log('  ✔ linked ksh-ui-fixes.css in ' + n + ' page(s)');
console.log('\nNext: git add -A && git commit -m "Menu covers back button + normal-size X buttons" && git push');