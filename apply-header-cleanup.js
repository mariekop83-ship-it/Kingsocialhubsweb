#!/usr/bin/env node
/**
 * King Social Hub — clean top header + stop the hamburger menu flashing open on page load
 *
 * Run from the repo root (the folder that contains server.js and public/):
 *     node apply-header-cleanup.js
 *
 * Why the top bar was crowded
 *   The rules that hide the top links / balance / bell / theme / WhatsApp live in
 *   css/app-shell.css, but the inner pages (settings, marketplace, tools, numbers,
 *   giveaways, groups, DMs ...) never load that file, so the full desktop bar showed.
 *   This script adds one small stylesheet that every page loads in <head>.
 *
 * Result on every page: hamburger + logo + site name only.
 *   (Profile, deposit, notifications, support etc. are all inside the hamburger menu.
 *    The footer card and the guest Login button are untouched.)
 *
 * Why the hamburger opened while loading
 *   The menu drawer is created by JavaScript and animated with a CSS transition, and a
 *   drawer left "open" could be restored by the browser (back/forward cache) or slide
 *   across while the next page loads. The drawer is now fully hidden unless it is
 *   really open, has no animation during page load, and is force-closed on page show /
 *   page leave.
 *
 * Safe to run more than once. Only touches files under public/.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PUB = path.join(ROOT, 'public');
const VERSION = '20261022b';

if (!fs.existsSync(path.join(PUB, 'js', 'app-shell.js')) || !fs.existsSync(path.join(ROOT, 'server.js'))) {
  console.error('ERROR: run this from the repo root (the folder containing server.js and public/).');
  process.exit(1);
}

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');
const rel = (p) => path.relative(ROOT, p);
const done = [];
const skipped = [];

/* ───────────────────────── CSS ───────────────────────── */
const CSS = `/* King Social Hub — minimal top bar (hamburger + logo + name) and flash-free menu drawer */

/* 1. Top bar: remove nav links, balance, theme toggle, WhatsApp, bell, avatar */
html body .navbar .nav-center,
html body #navCenter,
html body .navbar .nav-balance-btn,
html body .navbar .nav-user-area,
html body .navbar .theme-toggle-wrap,
html body .navbar .notif-wrap,
html body .navbar .nav-wa-btn,
html body .navbar .nav-avatar-wrap,
html body .navbar #navAvatarWrap { display: none !important; }

html body .navbar .nav-inner { display: flex; align-items: center; gap: 10px; }
html body .navbar #kshMenuTrigger { order: 0; flex: 0 0 auto; }
html body .navbar .nav-brand { order: 1; flex: 1 1 auto; min-width: 0; }
html body .navbar .nav-right { order: 2; flex: 0 0 auto; margin-left: auto; display: flex; align-items: center; }
/* guests keep a compact Login button */
html body .navbar .nav-guest { display: flex; gap: 6px; }
html body .navbar .nav-guest .btn-nav-reg { display: none; }

/* 2. Menu drawer: invisible unless open; no animation while the page is still loading */
.ksh-drawer:not(.open) {
  visibility: hidden;
  transform: translateX(-105%);
  transition: transform .25s ease, visibility 0s linear .25s;
}
.ksh-drawer.open { visibility: visible; transition: transform .25s ease, visibility 0s; }
.ksh-menu-backdrop:not(.open) { opacity: 0; visibility: hidden; pointer-events: none; }
html:not(.ksh-ready) .ksh-drawer,
html:not(.ksh-ready) .ksh-menu-backdrop { transition: none !important; }
/* while navigating away the drawer disappears instantly instead of sliding across the loader */
html.ksh-leaving .ksh-drawer,
html.ksh-leaving .ksh-menu-backdrop { display: none !important; }
`;

/* ───────────────────────── JS GUARD ───────────────────────── */
const JS = `/* King Social Hub — menu guard: the hamburger drawer must never be open while a page loads/leaves */
(function () {
  'use strict';
  var de = document.documentElement;

  function closeMenuProperly() {
    // Use the real close button first so app-shell.js resets its own scroll-lock state.
    var closeBtn = document.querySelector('#kshDrawer .ksh-drawer-close');
    var drawer = document.getElementById('kshDrawer');
    if (closeBtn && drawer && drawer.classList.contains('open')) { try { closeBtn.click(); } catch (e) {} }
  }

  function reset() {
    closeMenuProperly();
    var d = document.getElementById('kshDrawer');
    var b = document.getElementById('kshMenuBackdrop');
    var t = document.getElementById('kshMenuTrigger');
    if (d) d.classList.remove('open');
    if (b) b.classList.remove('open');
    if (t) t.setAttribute('aria-expanded', 'false');
    if (document.body) {
      document.body.classList.remove('ksh-menu-open');
      var s = document.body.style;
      if (s.position === 'fixed') { s.position = ''; s.top = ''; s.left = ''; s.right = ''; s.width = ''; }
    }
    de.classList.remove('ksh-locked', 'ksh-leaving');
  }

  function ready() { requestAnimationFrame(function () { de.classList.add('ksh-ready'); }); }

  document.addEventListener('DOMContentLoaded', function () { reset(); setTimeout(ready, 60); });
  window.addEventListener('load', function () { reset(); ready(); });
  // Back/forward cache restore: page comes back exactly as it was left (possibly with the menu open).
  window.addEventListener('pageshow', function () { reset(); ready(); });
  window.addEventListener('pagehide', function () { de.classList.add('ksh-leaving'); });

  // Tapping a menu link: hide the drawer instantly (no slide) while the next page loads.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('#kshDrawer a[href]') : null;
    if (!a) return;
    de.classList.add('ksh-leaving');
    // If the link did not actually leave the page (same-page link, new tab), undo.
    setTimeout(function () { de.classList.remove('ksh-leaving'); }, 1800);
  }, true);
})();
`;

/* ───────────────────────── WRITE ASSETS ───────────────────────── */
write(path.join(PUB, 'css', 'ksh-header-clean.css'), CSS);
done.push('wrote public/css/ksh-header-clean.css');
write(path.join(PUB, 'js', 'ksh-menu-guard.js'), JS);
done.push('wrote public/js/ksh-menu-guard.js');

/* ───────────────────────── LINK INTO PAGES ───────────────────────── */
const cssTag = '<link rel="stylesheet" href="/css/ksh-header-clean.css?v=' + VERSION + '">';
const jsTag = '<script src="/js/ksh-menu-guard.js?v=' + VERSION + '" defer></script>';
let patched = 0;
const touched = [];

for (const name of fs.readdirSync(PUB).sort()) {
  if (!/\.html$/i.test(name)) continue; // skips .bak files
  const file = path.join(PUB, name);
  let html = read(file);
  const usesShell = html.includes('class="navbar"') || html.includes('app-shell.js');
  if (!usesShell) continue;
  if (!html.includes('</head>')) continue;

  // Replace any previous version of our tags, or add them just before </head> so they load last.
  html = html
    .replace(/<link rel="stylesheet" href="\/css\/ksh-header-clean\.css[^>]*>\s*/g, '')
    .replace(/<script src="\/js\/ksh-menu-guard\.js[^>]*><\/script>\s*/g, '');
  html = html.replace('</head>', cssTag + '\n' + jsTag + '\n</head>');

  if (html !== read(file)) {
    write(file, html);
    patched++;
    touched.push(name);
  }
}
done.push('linked header-clean css + menu guard in ' + patched + ' page(s): ' + touched.join(', '));

/* ───────────────────────── SUMMARY ───────────────────────── */
console.log('\nDone:');
done.forEach((d) => console.log('  ✔ ' + d));
if (skipped.length) {
  console.log('Skipped:');
  skipped.forEach((s) => console.log('  - ' + s));
}
console.log('\nNext: git add -A && git commit -m "Minimal top bar + stop hamburger flash on load" && git push');