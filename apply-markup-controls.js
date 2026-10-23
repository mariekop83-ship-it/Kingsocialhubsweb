// Adds admin-controlled markups:
//   - Buy Number 1 (Grizzly) and Buy Number 3 (Nova): an extra flat NGN markup added on top of the profit ladder.
//   - Buy Number 2 (OTP Suite): already has a flat markup; it is now editable from the same new screen.
//   - Marketplace 2, 3 and 4: a default NGN markup that applies to every product whose price the admin
//     has NOT set by hand. Products with a custom price are never touched.
//
// Run from the project root:   node apply-markup-controls.js
// Then:  git add -A && git commit -m "Admin markup controls" && git push   (Render redeploys)
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MARK = 'KSH-MARKUP-CONTROLS';

function load(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { console.error('Cannot find ' + rel + ' - run this from the project root folder.'); process.exit(1); }
  return { rel, file, src: fs.readFileSync(file, 'utf8') };
}
function replaceOnce(f, find, repl, label) {
  const first = f.src.indexOf(find);
  if (first === -1 || f.src.indexOf(find, first + 1) !== -1) {
    console.error('Could not safely patch ' + f.rel + ' (' + label + '). No files were changed.');
    process.exit(1);
  }
  f.src = f.src.slice(0, first) + repl + f.src.slice(first + find.length);
}

const server = load('server.js');
const m2 = load('lib/market2.js');
const m3 = load('lib/market3.js');
const m4 = load('lib/market4.js');
const admin = load('public/admin.html');

if (server.src.includes(MARK)) { console.log('Already applied - nothing to do.'); process.exit(0); }

// ───────────────────────── server.js : Buy Number 1 and 3 ─────────────────────────
replaceOnce(server,
  "  server2Enabled: { type: Boolean, default: true },",
  "  // " + MARK + ": extra flat NGN markup the admin adds on top of the profit ladder.\n" +
  "  server1ExtraMarkupNgn: { type: Number, default: 0 },   // Buy Number 3 (Nova)\n" +
  "  server2ExtraMarkupNgn: { type: Number, default: 0 },   // Buy Number 1 (Grizzly)\n" +
  "  server2Enabled: { type: Boolean, default: true },",
  'schema');

replaceOnce(server,
  "  const raw = costNgn + profit;",
  "  const raw = costNgn + profit + Math.max(0, Number(cfg.server2ExtraMarkupNgn) || 0);",
  'Buy Number 1 price');

replaceOnce(server,
  "  // Developer-API buyers keep apiProfitPercent % of the normal profit (cheaper than the site price).",
  "  markup += Math.max(0, Number(cfg?.server1ExtraMarkupNgn) || 0);\n" +
  "  // Developer-API buyers keep apiProfitPercent % of the normal profit (cheaper than the site price).",
  'Buy Number 3 price');

replaceOnce(server,
  "apiProfitPercent: cfg.apiProfitPercent, highCostMarkupPercent",
  "apiProfitPercent: cfg.apiProfitPercent, server1ExtraMarkupNgn: cfg.server1ExtraMarkupNgn || 0, server2ExtraMarkupNgn: cfg.server2ExtraMarkupNgn || 0, highCostMarkupPercent",
  'server-config GET');

replaceOnce(server,
  " if (Number(b.apiProfitPercent) >= 0 && Number(b.apiProfitPercent) <= 100) cfg.apiProfitPercent = Number(b.apiProfitPercent);",
  " if (Number(b.apiProfitPercent) >= 0 && Number(b.apiProfitPercent) <= 100) cfg.apiProfitPercent = Number(b.apiProfitPercent);\n" +
  " for (const k of ['server1ExtraMarkupNgn', 'server2ExtraMarkupNgn']) {\n" +
  "   if (b[k] === undefined) continue;\n" +
  "   const n = Number(b[k]);\n" +
  "   if (!Number.isFinite(n) || n < 0 || n > 1000000) return res.status(400).json({ error: 'Markup must be a number from 0 up (in naira).' });\n" +
  "   cfg[k] = Math.round(n);\n" +
  " }",
  'server-config PUT');

// ───────────────────────── Marketplaces 2, 3, 4 ─────────────────────────
const CFG_FIELD = "    alertEmail: { type: String, default: '' },\n";
const CFG_FIELD_NEW = CFG_FIELD + "    defaultMarkupNgn: { type: Number, default: null },   // " + MARK + ": null = use the built-in default\n";
const PUT_ANCHOR = "    if (typeof b.alertEmail === 'string') c.alertEmail = b.alertEmail.trim().slice(0, 200);\n";
const PUT_NEW = PUT_ANCHOR +
  "    if (b.defaultMarkupNgn !== undefined) {\n" +
  "      if (b.defaultMarkupNgn === null || b.defaultMarkupNgn === '') c.defaultMarkupNgn = null;\n" +
  "      else {\n" +
  "        const n = Number(b.defaultMarkupNgn);\n" +
  "        if (!Number.isFinite(n) || n < 0 || n > 1000000) return res.status(400).json({ error: 'Default markup must be \u20a60 or more.' });\n" +
  "        c.defaultMarkupNgn = Math.round(n);\n" +
  "      }\n" +
  "    }\n";
const DEFAULT_EXPR = (envName) =>
  "(mkCfg.defaultMarkupNgn !== null && mkCfg.defaultMarkupNgn !== undefined && Number(mkCfg.defaultMarkupNgn) >= 0) " +
  "? Number(mkCfg.defaultMarkupNgn) : Math.max(0, Number(process.env." + envName + " || 300) || 0)";

function patchMarket(f, model, envName, mapStyle) {
  replaceOnce(f, CFG_FIELD, CFG_FIELD_NEW, 'config schema');
  replaceOnce(f, PUT_ANCHOR, PUT_NEW, 'config save');
  replaceOnce(f,
    "const prices = await " + model + ".find({}).lean();",
    "const prices = await " + model + ".find({}).lean();\n    const mkCfg = await getCfg();   // " + MARK,
    'load config in mergedProducts');
  const line = "const defaultMarkup = Math.max(0, Number(process.env." + envName + " || 300) || 0);";
  replaceOnce(f, line, "const defaultMarkup = " + DEFAULT_EXPR(envName) + ";", 'default markup');
}
patchMarket(m2, 'Market2Price', 'RAKIB_DEFAULT_MARKUP_NGN');
patchMarket(m3, 'Market3Price', 'SUJAN_DEFAULT_MARKUP_NGN');
patchMarket(m4, 'Market4Price', 'MARKET4_DEFAULT_MARKUP_NGN');

// Marketplace 4 keeps a 15-second copy of its product list; clear it when the markup changes.
replaceOnce(m4,
  "    await c.save();\n    await getCfg();\n    res.json({ ok: true, apiKeyConfigured: !!apiKey(), baseUrl: baseUrl() });",
  "    await c.save();\n    invalidateMemo();\n    await getCfg();\n    res.json({ ok: true, apiKeyConfigured: !!apiKey(), baseUrl: baseUrl() });",
  'market 4 cache clear');

// ───────────────────────── admin.html ─────────────────────────
replaceOnce(admin,
  "  { group:'Marketplace settings', owner:true, items:[\n",
  "  { group:'Marketplace settings', owner:true, items:[\n" +
  "    { tab:'markups', icon:'i-banknote', label:'Markups (numbers & marketplaces)', owner:true, keywords:'markup profit price buy number 1 2 3 marketplace 2 3 4 default extra' },\n",
  'sidebar item');

replaceOnce(admin,
  "  if(name==='n3adm')        { n3Load(); }",
  "  if(name==='n3adm')        { n3Load(); }\n  if(name==='markups'&&window.kshMkLoad) kshMkLoad();",
  'tab loader');

const PANEL = `<div id="tab-markups" class="tab-panel"><!-- ${MARK} -->
  <div class="sec">
    <div class="sec-title">Buy Number markups</div>
    <div class="info-box">Extra naira added to the price of every number on that server, on top of the normal profit ladder. Use 0 for no extra markup.</div>
    <div class="form-row">
      <div class="fg"><label>Buy Number 1 &mdash; extra markup (&#8358;)</label><input type="number" id="mkBn1" min="0" step="1" placeholder="0"/></div>
      <div class="fg"><label>&nbsp;</label><button class="btn-primary" type="button" onclick="kshMkSave('bn1')" style="width:100%">Save</button></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Buy Number 2 &mdash; markup (&#8358;)</label><input type="number" id="mkBn2" min="0" step="1" placeholder="300"/></div>
      <div class="fg"><label>&nbsp;</label><button class="btn-primary" type="button" onclick="kshMkSave('bn2')" style="width:100%">Save</button></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Buy Number 3 &mdash; extra markup (&#8358;)</label><input type="number" id="mkBn3" min="0" step="1" placeholder="0"/></div>
      <div class="fg"><label>&nbsp;</label><button class="btn-primary" type="button" onclick="kshMkSave('bn3')" style="width:100%">Save</button></div>
    </div>
  </div>
  <div class="sec">
    <div class="sec-title">Marketplace default markups</div>
    <div class="info-box">Naira added to the supplier cost of every product whose price you have <b>not</b> set yourself. Products with a custom price keep that price. Leave a box empty to use the built-in default (&#8358;300).</div>
    <div class="form-row">
      <div class="fg"><label>Marketplace 2 &mdash; default markup (&#8358;)</label><input type="number" id="mkM2" min="0" step="1" placeholder="300"/></div>
      <div class="fg"><label>&nbsp;</label><button class="btn-primary" type="button" onclick="kshMkSave('m2')" style="width:100%">Save</button></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Marketplace 3 &mdash; default markup (&#8358;)</label><input type="number" id="mkM3" min="0" step="1" placeholder="300"/></div>
      <div class="fg"><label>&nbsp;</label><button class="btn-primary" type="button" onclick="kshMkSave('m3')" style="width:100%">Save</button></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Marketplace 4 &mdash; default markup (&#8358;)</label><input type="number" id="mkM4" min="0" step="1" placeholder="300"/></div>
      <div class="fg"><label>&nbsp;</label><button class="btn-primary" type="button" onclick="kshMkSave('m4')" style="width:100%">Save</button></div>
    </div>
    <div id="mkMsg" class="muted" style="margin-top:8px"></div>
  </div>
</div>
<script>
(function(){
  function el(id){return document.getElementById(id);}
  function setVal(id,v){var e=el(id);if(e)e.value=(v===null||v===undefined)?'':v;}
  function say(t){var m=el('mkMsg');if(m)m.textContent=t;}
  window.kshMkLoad=async function(){
    say('');
    try{var n=await aFetch('/api/admin/numbers/server-config');setVal('mkBn1',n.server2ExtraMarkupNgn||0);setVal('mkBn3',n.server1ExtraMarkupNgn||0);}catch(e){say('Could not load Buy Number markups: '+e.message);}
    try{var o=await aFetch('/api/admin/otp-suite/status');setVal('mkBn2',o.markupNgn);}catch(e){}
    for(var i=2;i<=4;i++){
      try{var c=await aFetch('/api/admin/market'+i+'/config');setVal('mkM'+i,c.defaultMarkupNgn);}catch(e){}
    }
  };
  window.kshMkSave=async function(which){
    var map={
      bn1:['mkBn1','/api/admin/numbers/server-config','server2ExtraMarkupNgn','Buy Number 1'],
      bn2:['mkBn2','/api/admin/otp-suite/config','markupNgn','Buy Number 2'],
      bn3:['mkBn3','/api/admin/numbers/server-config','server1ExtraMarkupNgn','Buy Number 3'],
      m2:['mkM2','/api/admin/market2/config','defaultMarkupNgn','Marketplace 2'],
      m3:['mkM3','/api/admin/market3/config','defaultMarkupNgn','Marketplace 3'],
      m4:['mkM4','/api/admin/market4/config','defaultMarkupNgn','Marketplace 4']
    }[which];
    if(!map)return;
    var raw=el(map[0]).value.trim();
    var isMarket=which.charAt(0)==='m';
    var val;
    if(raw===''){ if(isMarket){val=null;} else {val=0;} }
    else{val=Number(raw);if(!Number.isFinite(val)||val<0){say('Enter a number that is 0 or more.');return;}}
    var body={};body[map[2]]=val;
    try{
      await aFetch(map[1],'PUT',body);
      say(map[3]+' markup saved.');
      kshMkLoad();
    }catch(e){say('Could not save '+map[3]+': '+e.message);}
  };
})();
</script>
`;
replaceOnce(admin, '<div id="tab-otp2" class="tab-panel">', PANEL + '<div id="tab-otp2" class="tab-panel">', 'new tab panel');

// ───────────────────────── write everything ─────────────────────────
for (const f of [server, m2, m3, m4, admin]) {
  fs.writeFileSync(f.file + '.bak-before-markup', fs.readFileSync(f.file));
  fs.writeFileSync(f.file, f.src);
}
// The marker also has to be in server.js so a second run is a no-op.
console.log('Done. Updated: server.js, lib/market2.js, lib/market3.js, lib/market4.js, public/admin.html');
console.log('Backups were saved next to each file as *.bak-before-markup');
console.log('Next: git add -A && git commit -m "Admin markup controls" && git push');