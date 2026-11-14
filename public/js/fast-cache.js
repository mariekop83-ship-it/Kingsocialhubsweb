/* Instant-load helper: show the last known list from this browser immediately, then refresh in the background
   and only re-draw if something changed. Used by Buy Number 2/3, Temp Email and Rentals. */
(function(){
  var P='ksc1:';
  function read(u){try{var r=localStorage.getItem(P+u);return r?JSON.parse(r):null}catch(e){return null}}
  function write(u,d){try{localStorage.setItem(P+u,JSON.stringify(d))}catch(e){}}
  // kpeek: is there something we can show right now?
  window.kpeek=function(u){return read(u)!==null};
  // kswr(url, fetcher, render(data), onError(err)) — render runs once from cache (if any), then again only if fresh data differs.
  window.kswr=function(u,fetcher,render,onErr){
    var c=read(u),cs=c===null?null:JSON.stringify(c);
    if(c!==null){try{render(c)}catch(e){}}
    return Promise.resolve().then(function(){return fetcher(u)}).then(function(d){
      var ds=JSON.stringify(d);write(u,d);
      if(ds!==cs)render(d);
    }).catch(function(e){if(c===null&&onErr)onErr(e)});
  };
  // kset: replace a <select>'s options but keep what the customer already picked.
  window.kset=function(sel,html){var v=sel.value;sel.innerHTML=html;if(v){for(var i=0;i<sel.options.length;i++){if(sel.options[i].value===v){sel.value=v;break}}}};
})();
