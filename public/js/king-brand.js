/* KING SOCIAL HUB background selection and light-touch brand consistency. */
(function(){
  function pick(){
    var p=(location.pathname||'/').toLowerCase();
    if(p==='/' || p.endsWith('/index.html') || p==='/login' || p==='/register') return 'kb-bg-wave';
    if(/buy-number|number-history|virtual-account|deposit|wallet|transactions|purchases|referral|settings/.test(p)) return 'kb-bg-phone';
    if(/boost|marketplace|tools|game|groups|giveaway|data-bill/.test(p)) return 'kb-bg-speed';
    return 'kb-bg-wave';
  }
  function apply(){
    try{
      var b=document.body; if(!b) return;
      b.classList.remove('kb-bg-hero','kb-bg-phone','kb-bg-speed','kb-bg-social','kb-bg-wave');
      b.classList.add(pick());
    }catch(e){}
  }
  try {
    apply();
    // The main app switches pages without reloading, so re-pick the artwork on every navigation.
    ['pushState','replaceState'].forEach(function(fn){
      var orig=history[fn];
      history[fn]=function(){ var r=orig.apply(this,arguments); setTimeout(apply,0); return r; };
    });
    window.addEventListener('popstate',apply);
    // Keep existing application logic intact; update only document branding.
          } catch(e) {}
})();

/* Moving "King Social Hub" name behind the whole site + appear animation for feature cards. */
(function(){
  'use strict';
  function buildDrift(){
    try{
      if(document.getElementById('kb-drift')||!document.body) return;
      var wrap=document.createElement('div'); wrap.id='kb-drift'; wrap.setAttribute('aria-hidden','true');
      var small=window.innerWidth<700, rows=small?9:11, h=window.innerHeight||800;
      for(var i=0;i<rows;i++){
        var row=document.createElement('div');
        row.className='kb-row'+(i%3===0?' kb-fill':'')+(i%2?' kb-pink':'');
        var size=small?(34+(i%3)*10):(54+(i%3)*16);
        row.style.fontSize=size+'px';
        row.style.top=Math.round((i/rows)*h-size*0.2)+'px';
        row.style.setProperty('--kb-dur',(46+(i*7)%34)+'s');
        row.style.setProperty('--kb-dir',i%2?'reverse':'normal');
        var html='';
        for(var k=0;k<24;k++) html+='<span>King Social Hub</span>';   // list is longer than 2 screens; it slides by half its width
        row.innerHTML=html; wrap.appendChild(row);
      }
      var spots=small?3:5;
      for(var j=0;j<spots;j++){
        var f=document.createElement('div'); f.className='kb-float'; f.textContent='King Social Hub';
        f.style.left=(6+(j*83)%80)+'%'; f.style.top=(10+(j*37)%75)+'%';
        f.style.fontSize=(small?20:30)+(j%3)*6+'px';
        f.style.setProperty('--kb-dur',(12+j*3)+'s'); f.style.setProperty('--kb-del',(-j*2.3)+'s');
        f.style.setProperty('--kb-rot',((j%2)?8:-8)+'deg'); wrap.appendChild(f);
      }
      document.body.appendChild(wrap);
    }catch(e){}
  }
  var CARD_SEL='.why-card,.kls-what-card,.rs-item,.kls-step';
  function setupReveal(){
    try{
      if(!('IntersectionObserver' in window)) return;
      var io=new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          if(en.isIntersecting){ en.target.classList.add('kb-in'); io.unobserve(en.target); }
        });
      },{threshold:0.12,rootMargin:'0px 0px -6% 0px'});
      function scan(){
        var groups=new Map();
        document.querySelectorAll(CARD_SEL).forEach(function(c){
          if(c.dataset.kbSeen) return; c.dataset.kbSeen='1';
          var p=c.parentElement, idx=groups.get(p)||0; groups.set(p,idx+1);
          c.classList.add('kb-reveal');
          if(idx%3===0) c.classList.add('kb-from-left'); else if(idx%3===2) c.classList.add('kb-from-right');
          c.style.setProperty('--kb-d',Math.min(idx*0.09,0.6)+'s');
          io.observe(c);
        });
      }
      scan();
      // pages are swapped without reloading, so look again after navigation
      ['pushState','popstate'].forEach(function(n){ if(n==='popstate') window.addEventListener(n,function(){setTimeout(scan,300);}); else{ var o=history[n]; history[n]=function(){var r=o.apply(this,arguments); setTimeout(scan,300); return r;}; }});
      // safety net: never leave a card invisible
      setTimeout(function(){ document.querySelectorAll('.kb-reveal:not(.kb-in)').forEach(function(c){ var r=c.getBoundingClientRect(); if(r.top<window.innerHeight&&r.bottom>0) c.classList.add('kb-in'); }); },2500);
    }catch(e){}
  }
  function init(){ buildDrift(); setupReveal(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();



/* King crown + logo loader: visible while a page loads and while we leave for the next one. */
(function(){
  'use strict';
  var t0=Date.now(), el=null;
  function make(){
    if(el||!document.body) return el;
    el=document.createElement('div'); el.id='kb-loader'; el.setAttribute('aria-hidden','true');
    el.innerHTML='<div class="kb-crown">\uD83D\uDC51</div><div class="kb-logo"></div><div class="kb-name">King Social Hub</div><div class="kb-sub">Loading\u2026</div>';
    document.body.appendChild(el); return el;
  }
  function show(){ var e=make(); if(e) e.classList.remove('kb-hide'); }
  function hide(){ var e=make(); if(!e) return; var wait=Math.max(0,3000-(Date.now()-t0)); setTimeout(function(){ e.classList.add('kb-hide'); },wait); }
  make();                                              // up immediately on first paint of the new page
  if(document.readyState==='complete') hide(); else window.addEventListener('load',hide);
  setTimeout(hide,6000);                               // never trap the visitor if something is slow
  window.addEventListener('pageshow',function(ev){ if(ev.persisted){ t0=0; hide(); } });
  window.addEventListener('beforeunload',show);        // leaving: show it until the next page enters
  document.addEventListener('click',function(ev){      // same-site links
    var a=ev.target.closest&&ev.target.closest('a[href]'); if(!a||ev.defaultPrevented||ev.metaKey||ev.ctrlKey||ev.shiftKey) return;
    if(a.target==='_blank'||a.hasAttribute('download')) return;
    var h=a.getAttribute('href'); if(!h||h.charAt(0)==='#'||/^(mailto|tel|javascript):/i.test(h)) return;
    try{ var u=new URL(a.href,location.href); if(u.origin===location.origin && (u.pathname!==location.pathname||u.search!==location.search)){ show(); setTimeout(function(){ if(document.visibilityState==='visible') hide(); },5000); } }catch(e){}
  },true);
})();
