// King Social Hub update: no bottom bar, dashboard marketplace preview, menu scroll lock, small loader (~3s)
const fs = require('fs'), path = require('path');
const P = f => path.join('public', f);
const rd = f => fs.readFileSync(P(f), 'utf8');
const wr = (f, s) => fs.writeFileSync(P(f), s);
let ok = true;
function must(cond, msg) { if (!cond) { ok = false; console.log('FAILED: ' + msg); } else console.log('ok: ' + msg); }


// 0) Earlier fixes, safe to repeat: menu stuck open, black background, no moving background words
let pt = rd('css/page-transitions.css');
const ptOld = 'html.ksh-transition-ready body > :not(#ksh-page-transition):not(script):not(style) {';
if (pt.includes(ptOld)) { pt = pt.replace(ptOld, 'html.ksh-transition-ready body > :not(#ksh-page-transition):not(script):not(style):not(.ksh-drawer):not(.ksh-menu-backdrop) {'); wr('css/page-transitions.css', pt); }
must(rd('css/page-transitions.css').includes('not(.ksh-drawer)'), 'menu no longer stuck open');
let kc = rd('css/king-brand.css');
if (!kc.includes('Pure black website background')) {
  kc += '\n/* Pure black website background */\nhtml,body{background:#000!important}\nbody::before{background-image:none!important;background:#000!important}\n:root,html[data-theme]{--bg:#000}\n#kb-drift{display:none!important}\n';
  wr('css/king-brand.css', kc);
}
must(rd('css/king-brand.css').includes('Pure black website background'), 'black background + no moving words');

// 1) Loader logo without the "D"
wr('img/king-loader.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#39ff14"/><stop offset="1" stop-color="#16a34a"/></linearGradient></defs><rect width="128" height="128" rx="64" fill="#050806"/><circle cx="64" cy="64" r="56" fill="none" stroke="url(#g)" stroke-width="4"/><path d="M31 43l13 8 10-17 10 15 12-15 8 17 13-8-4 23H35z" fill="url(#g)" transform="translate(0 14)"/></svg>\n');
must(true, 'loader logo created');

// 2) CSS
let css = rd('css/king-brand.css');
if (!css.includes('KSH-UPDATE-2')) {
  css += `
/* KSH-UPDATE-2 */
html body .app-tabbar,html body .dsh-bottom-nav,html body .bottom-tabbar{display:none!important}
:root{--app-nav-h:0px}
body.app-shell{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 12px)!important}
.dashboard-body{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 12px)!important}
.dsh-shell{padding-bottom:16px!important}
html,body{overscroll-behavior-y:none}
#ksh-page-transition{display:none!important}
.ksh-drawer{overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.ksh-menu-backdrop{touch-action:none}
html.ksh-locked{overflow:hidden!important}
#kb-loader{background:#000!important;gap:0!important}
#kb-loader .kb-crown,#kb-loader .kb-name,#kb-loader .kb-sub{display:none!important}
#kb-loader .kb-logo{width:54px!important;height:54px!important;border-radius:50%!important;border:0!important;background:url('/img/king-loader.svg') center/cover no-repeat!important;box-shadow:0 0 18px rgba(34,197,94,.4)!important}
#kb-loader .kb-logo::after{inset:-7px!important;border-radius:50%!important;border-width:2px!important}
.dbfl-overlay{background:#000!important;gap:0!important}
.dbfl-brand::before{display:none!important}
.dbfl-brand{width:54px!important;height:54px!important}
.dbfl-crown-svg{width:48px!important;height:48px!important;border-radius:50%!important;border:0!important;background:url('/img/king-loader.svg') center/cover no-repeat!important}
.dbfl-text{display:none!important}
.dbfl-ring{border-width:2px!important}
/* dashboard marketplace preview + chooser */
.ksh-seeall{background:none;border:0;color:var(--gold,#16a34a);font:700 13px inherit;cursor:pointer;padding:4px 2px}
.ksh-mk-list{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 14px 14px}
.ksh-mk-item{display:block;text-decoration:none;color:inherit;border:1px solid var(--border,#252535);border-radius:12px;overflow:hidden;background:rgba(255,255,255,.03)}
.ksh-mk-item img{display:block;width:100%;height:84px;object-fit:cover;background:#0a0a0a}
.ksh-mk-ph{height:84px;display:flex;align-items:center;justify-content:center;font-size:28px;background:#0a0a0a}
.ksh-mk-item b{display:block;padding:8px 10px 2px;font-size:13px;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ksh-mk-item span{display:block;padding:0 10px 10px;font-size:12px;color:var(--gold,#16a34a);font-weight:800}
.ksh-mk-empty{grid-column:1/-1;padding:14px 4px;font-size:13px;opacity:.7;text-align:center}
.ksh-sheet-bd{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9998;opacity:0;visibility:hidden;transition:opacity .2s,visibility .2s}
.ksh-sheet-bd.open{opacity:1;visibility:visible}
.ksh-sheet{position:fixed;left:50%;bottom:0;width:100%;max-width:480px;transform:translate(-50%,105%);transition:transform .25s ease;z-index:9999;background:#0d0d0d;border:1px solid #252535;border-bottom:0;border-radius:18px 18px 0 0;padding:16px 16px calc(18px + env(safe-area-inset-bottom,0px))}
.ksh-sheet.open{transform:translate(-50%,0)}
.ksh-sheet-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;color:#eeeef5}
.ksh-sheet-head button{width:34px;height:34px;border-radius:10px;border:1px solid #2e2e42;background:#131320;color:#eeeef5;font-size:20px;cursor:pointer}
.ksh-sheet a{display:flex;align-items:center;justify-content:space-between;padding:14px 12px;margin:6px 0;border:1px solid #252535;border-radius:12px;background:#131320;color:#eeeef5;text-decoration:none;font-weight:700;font-size:14px}
`;
  wr('css/king-brand.css', css);
}
must(rd('css/king-brand.css').includes('KSH-UPDATE-2'), 'styles added');

// 3) Loader length (~3 seconds)
let kb = rd('js/king-brand.js');
if (kb.includes('550-(Date.now()-t0)')) { kb = kb.replace('550-(Date.now()-t0)', '3000-(Date.now()-t0)'); wr('js/king-brand.js', kb); }
must(rd('js/king-brand.js').includes('3000-(Date.now()-t0)'), 'page loader about 3 seconds');
let sc = rd('script.js');
const dbOld = "    dbflBusy = false;\n  }, 700);";
if (sc.includes(dbOld)) { sc = sc.replace(dbOld, "    dbflBusy = false;\n  }, 3000);"); wr('script.js', sc); }
must(rd('script.js').includes("dbflBusy = false;\n  }, 3000);"), 'in-app loader about 3 seconds');

// 4) Menu: lock the page behind it while open
let sh = rd('js/app-shell.js');
if (!sh.includes('kshLock')) {
  const a = "function closeMenu(){ drawer.classList.remove('open');";
  const b = "function openMenu(){ drawer.classList.add('open');";
  if (sh.includes(a) && sh.includes(b)) {
    sh = sh.replace(a, "var kshY=0,kshLocked=false; function kshLock(){ if(kshLocked)return; kshLocked=true; kshY=window.pageYOffset||0; var s=document.body.style; s.position='fixed'; s.top=(-kshY)+'px'; s.left='0'; s.right='0'; s.width='100%'; document.documentElement.classList.add('ksh-locked'); } function kshUnlock(){ if(!kshLocked)return; kshLocked=false; var s=document.body.style; s.position=''; s.top=''; s.left=''; s.right=''; s.width=''; document.documentElement.classList.remove('ksh-locked'); var de=document.documentElement,sb=de.style.scrollBehavior; de.style.scrollBehavior='auto'; window.scrollTo(0,kshY); de.style.scrollBehavior=sb; } function closeMenu(){ kshUnlock(); drawer.classList.remove('open');");
    sh = sh.replace(b, "function openMenu(){ kshLock(); drawer.classList.add('open');");
    wr('js/app-shell.js', sh);
  }
}
must(rd('js/app-shell.js').includes('kshLock()'), 'menu locks the page behind it');

// 5) Dashboard: marketplace preview + See all chooser (replaces the four marketplace tiles)
let d = rd('dashboard.html');
if (!d.includes('id="kshMarket"')) {
  const anchor = '  <!-- FEATURES: 4-column grid right after the balance card -->';
  if (d.includes(anchor)) {
    const block = `  <section class="dsh-card" id="kshMarket">
    <div class="dsh-card-head"><span class="dsh-card-title">Marketplace</span><button type="button" class="ksh-seeall" id="kshSeeAll">See all &rsaquo;</button></div>
    <div class="ksh-mk-list" id="kshMkList"><div class="ksh-mk-empty">Loading&hellip;</div></div>
  </section>
  <div class="ksh-sheet-bd" id="kshSheetBd"></div>
  <div class="ksh-sheet" id="kshSheet" role="dialog" aria-label="Choose a marketplace">
    <div class="ksh-sheet-head"><b>Choose a marketplace</b><button type="button" id="kshSheetX" aria-label="Close">&times;</button></div>
    <a href="/marketplace2">Marketplace 2 <span>&rsaquo;</span></a>
    <a href="/marketplace3">Marketplace 3 <span>&rsaquo;</span></a>
    <a href="/marketplace4">Marketplace 4 <span>&rsaquo;</span></a>
  </div>
  <script>
  (function(){
    var sheet=document.getElementById('kshSheet'),bd=document.getElementById('kshSheetBd'),list=document.getElementById('kshMkList');
    function openS(){sheet.classList.add('open');bd.classList.add('open');}
    function closeS(){sheet.classList.remove('open');bd.classList.remove('open');}
    document.getElementById('kshSeeAll').addEventListener('click',openS);
    document.getElementById('kshSheetX').addEventListener('click',closeS);
    bd.addEventListener('click',closeS);
    function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
    var t=null; try{t=localStorage.getItem('ksl_token');}catch(e){}
    fetch('/api/logs?type=log',{headers:t?{Authorization:'Bearer '+t}:{}}).then(function(r){return r.ok?r.json():[];}).then(function(items){
      items=(Array.isArray(items)?items:[]).filter(function(i){return i&&!i.soldOut;}).slice(0,4);
      if(!items.length){list.innerHTML='<div class="ksh-mk-empty">No items yet. Tap See all to browse.</div>';return;}
      list.innerHTML=items.map(function(i){
        var p=(i.priceFrom!=null?i.priceFrom:i.price),pic=/^(https?:\\/\\/|\\/)/.test(i.picture||'')?i.picture:'';
        return '<a class="ksh-mk-item" href="/marketplace">'+(pic?'<img loading="lazy" alt="" src="'+esc(pic)+'">':'<div class="ksh-mk-ph">\\uD83D\\uDECD\\uFE0F</div>')+'<b>'+esc(i.title)+'</b><span>'+(p!=null?'\\u20A6'+Number(p).toLocaleString('en-NG'):'View')+'</span></a>';
      }).join('');
    }).catch(function(){list.innerHTML='<div class="ksh-mk-empty">Could not load items. Tap See all.</div>';});
  })();
  </script>

`;
    d = d.replace(anchor, block + anchor);
    // remove the four marketplace icon tiles from the services grid
    const tile = /      <a class="dsh-svc-item" href="\/marketplace[234]?"[^>]*>[\s\S]*?<\/a>\n/g;
    d = d.replace(tile, '');
    wr('dashboard.html', d);
  }
}
must(rd('dashboard.html').includes('id="kshMarket"'), 'dashboard marketplace preview + See all chooser');
process.exit(ok ? 0 : 1);

