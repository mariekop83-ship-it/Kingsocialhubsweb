#!/usr/bin/env node
/**
 * King Social Hub — wallet card redesign + broken loader fix
 *
 * Run from the repo root (the folder that contains server.js and public/):
 *     node apply-wallet-loader-fix.js
 *
 * What it does
 *  1. Wallet card (public/dashboard.html): replaces the old gradient "balance card"
 *     with a new layout: a bank-card style wallet (chip + contactless icon) with a
 *     separate action dock underneath (Add Money / History / Referrals).
 *     Same green brand colours, same element ids, so the existing JS keeps working.
 *  2. Loader (public/js/king-brand.js): the "broken King Social Hub" is the owner
 *     logo <img> (alt="King Social Hub") failing to load, e.g. an uploaded logo that
 *     was wiped by Render's ephemeral disk. The logo is now preloaded first and only
 *     applied if it really loads; any image that still breaks inside the loader is
 *     removed, and the loader no longer renders the crown / name / "Loading…" text.
 *  3. Cache busting: bumps ?v= on king-brand.js / king-brand.css in every public page.
 *
 * Safe to run more than once. It only edits files under public/.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PUB = path.join(ROOT, 'public');
const VERSION = '20261022';

if (!fs.existsSync(path.join(PUB, 'dashboard.html')) || !fs.existsSync(path.join(ROOT, 'server.js'))) {
  console.error('ERROR: run this from the repo root (the folder containing server.js and public/).');
  process.exit(1);
}

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');
const rel = (p) => path.relative(ROOT, p);
const done = [];
const skipped = [];

/* ───────────────────────── 1. NEW WALLET CARD ───────────────────────── */

const WALLET_CSS = `/* King Social Hub — dashboard wallet card (card + action dock layout) */
.kw-wallet{margin:14px 16px 0;position:relative}
.kw-card{position:relative;overflow:hidden;border-radius:22px;padding:18px 20px 16px;color:#fff;
  background:linear-gradient(135deg,#15803d 0%,#16a34a 52%,#22c55e 100%);
  box-shadow:0 12px 30px rgba(22,163,74,.34),inset 0 1px 0 rgba(255,255,255,.28);
  aspect-ratio:1.72/1;min-height:178px;display:flex;flex-direction:column;justify-content:space-between}
.kw-card::before{content:"";position:absolute;inset:0;pointer-events:none;
  background:
    repeating-linear-gradient(115deg,rgba(255,255,255,.07) 0 2px,transparent 2px 14px),
    radial-gradient(120% 90% at 100% 0%,rgba(255,255,255,.22),transparent 55%)}
.kw-card::after{content:"";position:absolute;right:-46px;bottom:-62px;width:190px;height:190px;border-radius:50%;
  border:26px solid rgba(255,255,255,.09);pointer-events:none}
.kw-top,.kw-mid,.kw-foot{position:relative;z-index:1}
.kw-top{display:flex;align-items:center;justify-content:space-between}
.kw-brand{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.95}
.kw-brand svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.kw-nfc{width:24px;height:24px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;opacity:.9}
.kw-mid{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.kw-chip{width:42px;height:32px;border-radius:7px;flex-shrink:0;
  background:linear-gradient(135deg,#d9f99d,#86efac 45%,#bbf7d0);
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.14);position:relative;overflow:hidden}
.kw-chip::before,.kw-chip::after{content:"";position:absolute;background:rgba(21,128,61,.45)}
.kw-chip::before{left:0;right:0;top:50%;height:1px}
.kw-chip::after{top:0;bottom:0;left:38%;width:1px;box-shadow:12px 0 0 rgba(21,128,61,.45)}
.kw-amt-wrap{min-width:0;text-align:right;flex:1}
.kw-label{font-size:11.5px;font-weight:700;opacity:.85;letter-spacing:.05em;text-transform:uppercase;margin-bottom:2px}
.kw-amount{display:flex;align-items:baseline;justify-content:flex-end;gap:4px;font-size:34px;font-weight:900;letter-spacing:-.6px;line-height:1.05;white-space:nowrap}
.kw-amount .kw-cur{font-size:20px;font-weight:700;opacity:.85}
.kw-amount .bal-hidden{letter-spacing:4px;font-size:28px}
.kw-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;font-weight:700}
.kw-sub{opacity:.9;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kw-eye{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.25);border-radius:999px;
  padding:5px 12px;cursor:pointer;color:#fff;display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700}
.kw-eye svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.kw-dock{display:grid;grid-template-columns:1.15fr 1fr 1.25fr;gap:8px;margin-top:10px}
.kw-dock a{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:3px;
  padding:11px 12px;border-radius:16px;font-size:12.5px;font-weight:800;color:var(--text,#15151f);
  background:var(--white,#fff);border:1px solid var(--border,#e2e2ec);box-shadow:var(--shadow,0 1px 4px rgba(0,0,0,.08));
  transition:transform .15s ease,box-shadow .15s ease;min-width:0}
.kw-dock a:active{transform:scale(.97)}
.kw-dock a svg{width:18px;height:18px;stroke:#16a34a;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.kw-dock a b{font-size:11.5px;font-weight:800;color:#16a34a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.kw-dock a span{white-space:nowrap}
.kw-dock .kw-primary{background:#16a34a;border-color:#16a34a;color:#fff;box-shadow:0 8px 18px rgba(22,163,74,.32)}
.kw-dock .kw-primary .kw-plus{width:22px;height:22px;border-radius:50%;background:#fff;color:#16a34a;
  display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:900;line-height:1}
html[data-theme="dark"] .kw-dock a:not(.kw-primary){background:#0f1511;border-color:rgba(255,255,255,.1);color:#ecfdf3}
@media (max-width:360px){
  .kw-amount{font-size:28px}.kw-amount .kw-cur{font-size:17px}
  .kw-dock a{padding:10px 9px;font-size:11.5px}
}
`;

const WALLET_HTML = `<!-- BALANCE CARD (wallet) -->
  <section class="kw-wallet" aria-label="Wallet balance">
    <div class="kw-card">
      <div class="kw-top">
        <span class="kw-brand"><svg><use href="#i-wallet"/></svg> King Wallet</span>
        <svg class="kw-nfc" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 8.5a5 5 0 010 7"/><path d="M12 6a8.5 8.5 0 010 12"/><path d="M15.5 3.5a12 12 0 010 17"/></svg>
      </div>
      <div class="kw-mid">
        <div class="kw-chip" aria-hidden="true"></div>
        <div class="kw-amt-wrap">
          <div class="kw-label">Available Balance</div>
          <div class="kw-amount"><span class="kw-cur">₦</span><span id="dshBal">0.00</span></div>
        </div>
      </div>
      <div class="kw-foot">
        <span class="kw-sub" id="dshBalSub">Wallet ready</span>
        <button class="kw-eye" id="dshEyeBtn" type="button" aria-label="Toggle balance visibility">
          <svg id="dshEyeIcon"><use href="#i-eye"/></svg> Balance
        </button>
      </div>
    </div>
    <div class="kw-dock">
      <a class="kw-primary" href="/deposit"><span class="kw-plus">+</span><span>Add Money</span></a>
      <a href="/transactions"><svg><use href="#i-history"/></svg><span>History</span></a>
      <a href="/referrals"><svg><use href="#i-link"/></svg><span>Referrals</span><b id="dshRef">₦0.00</b></a>
    </div>
  </section>

`;

(function patchDashboard() {
  const cssFile = path.join(PUB, 'css', 'king-wallet-card.css');
  write(cssFile, WALLET_CSS);
  done.push('wrote ' + rel(cssFile));

  const file = path.join(PUB, 'dashboard.html');
  let html = read(file);

  if (html.includes('class="kw-wallet"')) {
    skipped.push(rel(file) + ' (wallet card already replaced)');
  } else {
    const start = html.indexOf('<!-- BALANCE CARD -->');
    const end = html.indexOf('<!-- FEATURES');
    if (start === -1 || end === -1 || end < start) {
      console.error('ERROR: could not find the balance card block in public/dashboard.html. Nothing changed there.');
      process.exit(1);
    }
    const old = html.slice(start, end);
    if (!old.includes('dsh-balance-card') || !old.includes('id="dshBal"')) {
      console.error('ERROR: balance card block looks different than expected. Aborting to avoid breaking the page.');
      process.exit(1);
    }
    html = html.slice(0, start) + WALLET_HTML + html.slice(end);
    done.push('replaced balance card markup in ' + rel(file));
  }

  if (!html.includes('/css/king-wallet-card.css')) {
    const anchor = html.match(/<link rel="stylesheet" href="\/css\/responsive-device-fit\.css[^>]*>/);
    const tag = '<link rel="stylesheet" href="/css/king-wallet-card.css?v=' + VERSION + '">';
    if (anchor) html = html.replace(anchor[0], anchor[0] + '\n' + tag);
    else html = html.replace('</head>', tag + '\n</head>');
    done.push('linked king-wallet-card.css in ' + rel(file));
  }
  write(file, html);
})();

/* ───────────────────────── 2. LOADER FIX ───────────────────────── */

(function patchBrandJs() {
  const file = path.join(PUB, 'js', 'king-brand.js');
  let js = read(file);
  let changed = false;

  // 2a. Only apply the owner logo if the image really loads (no more broken <img> + alt text).
  if (!js.includes('applyLogoNow')) {
    const re = /function applyLogo\(url\)\{\s*if\(!url\)return;/;
    if (!re.test(js)) {
      console.error('ERROR: applyLogo() not found in public/js/king-brand.js — file differs from expected.');
      process.exit(1);
    }
    js = js.replace(
      re,
      'function applyLogo(url){\n' +
        '    if(!url)return;\n' +
        '    /* KSH-LOADER-FIX: preload first; a missing/expired logo must never replace the built-in one */\n' +
        '    var probe=new Image();\n' +
        '    probe.onload=function(){ applyLogoNow(url); };\n' +
        '    probe.onerror=function(){};\n' +
        '    probe.src=url;\n' +
        '  }\n' +
        '  function applyLogoNow(url){\n' +
        '    if(!url)return;'
    );
    changed = true;
    done.push('logo is now preloaded before it is applied (king-brand.js)');
  }

  // 2b. Loader markup: logo only (crown / name / "Loading…" were already hidden by CSS).
  const loaderRe = /el\.innerHTML='<div class="kb-crown">[^']*<\/div><div class="kb-logo"><\/div>[^']*';/;
  if (loaderRe.test(js)) {
    js = js.replace(loaderRe, "el.innerHTML='<div class=\"kb-logo\"></div>';");
    changed = true;
    done.push('loader markup simplified to the logo only (king-brand.js)');
  }

  // 2c. Safety net: any image that still breaks inside a loader is removed, never shown.
  if (!js.includes('KSH-BROKEN-IMG-GUARD')) {
    js +=
      '\n\n/* KSH-BROKEN-IMG-GUARD: a broken logo image must never show (broken icon + "King Social Hub" alt text) */\n' +
      "document.addEventListener('error',function(e){\n" +
      '  var t=e.target;\n' +
      "  if(t&&t.tagName==='IMG'&&t.closest&&t.closest('#kb-loader,.dbfl-overlay,.kb-logo,.dbfl-crown-svg')){ try{ t.remove(); }catch(_){ t.style.display='none'; } }\n" +
      '},true);\n';
    changed = true;
    done.push('added broken-image guard (king-brand.js)');
  }

  if (changed) write(file, js);
  else skipped.push(rel(file) + ' (already patched)');
})();

(function patchBrandCss() {
  const file = path.join(PUB, 'css', 'king-brand.css');
  let css = read(file);
  if (css.includes('KSH-LOADER-FIX-CSS')) {
    skipped.push(rel(file) + ' (already patched)');
    return;
  }
  css +=
    '\n\n/* KSH-LOADER-FIX-CSS: loader shows only the round logo; any image inside it must fit the circle */\n' +
    '#kb-loader .kb-crown,#kb-loader .kb-name,#kb-loader .kb-sub{display:none!important}\n' +
    '#kb-loader .kb-logo img,.dbfl-crown-svg img{width:100%;height:100%;object-fit:cover;border-radius:50%;font-size:0;color:transparent}\n';
  write(file, css);
  done.push('loader CSS hardened (king-brand.css)');
})();

/* ───────────────────────── 3. CACHE BUSTING ───────────────────────── */

(function bumpVersions() {
  let n = 0;
  for (const name of fs.readdirSync(PUB)) {
    if (!/\.html$/i.test(name)) continue; // skips .bak files too
    const file = path.join(PUB, name);
    const before = read(file);
    const after = before.replace(/(king-brand\.(?:js|css))\?v=\d+/g, '$1?v=' + VERSION);
    if (after !== before) {
      write(file, after);
      n++;
    }
  }
  if (n) done.push('bumped king-brand cache version in ' + n + ' html page(s)');
  else skipped.push('cache version already up to date');
})();

/* ───────────────────────── SUMMARY ───────────────────────── */

console.log('\nDone:');
done.forEach((d) => console.log('  ✔ ' + d));
if (skipped.length) {
  console.log('Skipped:');
  skipped.forEach((s) => console.log('  - ' + s));
}
console.log('\nNext: git add -A && git commit -m "New wallet card design + fix broken loader logo" && git push');