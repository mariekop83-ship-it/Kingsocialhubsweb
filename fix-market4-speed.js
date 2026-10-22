#!/usr/bin/env node
/*
 * fix-market4-speed.js
 * ---------------------------------------------------------------------------
 * Makes Marketplace 4 load instantly.
 *
 *  BEFORE: every customer visit could make the server download the provider's
 *          ENTIRE catalogue (hundreds of pages) -> website hangs.
 *  AFTER : the provider is only contacted by a background SYNC. The sync keeps
 *          ONLY the products you listed (Facebook, TikTok, Instagram, Discord,
 *          dating apps, Gemini, Hotmail, Yahoo, Twitter, Patreon, Google/Gmail/
 *          Google Voice, Telegram, Threads, VPN, texting numbers, AVI, trade ...)
 *          and saves them in MongoDB. Customers only read the saved copy.
 *
 *  The sync runs:
 *    - when you open "Logs 4 (Marketplace 4)" in the admin panel
 *    - when you tap "Refresh from API" in the admin panel
 *    - once after every server start / deploy (if the saved list is old or empty)
 *    - every 30 minutes in the background (change with MARKET4_SYNC_INTERVAL_MIN, 0 = off)
 *
 * Run from the project root (the folder that contains server.js):
 *      node fix-market4-speed.js
 * It makes backups (*.bak-speedfix) and refuses to touch anything if a
 * piece of the code is not where it expects it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const LIB = path.join(ROOT, 'lib', 'market4.js');
const ADMIN_JS = path.join(ROOT, 'public', 'js', 'admin-king.js');

function die(msg) { console.error('\n❌ ' + msg + '\nNothing was changed.\n'); process.exit(1); }
if (!fs.existsSync(LIB)) die('Cannot find lib/market4.js. Put this file in the project root (next to server.js) and run it there.');

let src = fs.readFileSync(LIB, 'utf8');
if (src.includes('Market4Product')) { console.log('✅ Already applied - nothing to do.'); process.exit(0); }

function swap(text, anchor, replacement, label) {
  const parts = text.split(anchor);
  if (parts.length !== 2) die('Could not find a unique spot for: ' + label + ' (found ' + (parts.length - 1) + ').');
  return parts[0] + replacement + parts[1];
}

// ───────────────────────────────────────────────────────────────────────────
// 1) Replace the catalogue section (fetch-everything-per-visitor) with:
//    saved product table + background sync + keyword filter
// ───────────────────────────────────────────────────────────────────────────
const START = '// ── Catalogue (categories + every product page)';
const END = '// ── Balance monitor + email';
const s = src.indexOf(START), e = src.indexOf(END);
if (s < 0 || e < 0 || e < s) die('Could not find the catalogue section in lib/market4.js.');
const lineStart = src.lastIndexOf('\n', s) + 1;
const lineEnd = src.lastIndexOf('\n', e) + 1;

const NEW_BLOCK = String.raw`  // ── Saved catalogue (MongoDB) + background sync ──────────────────────────
  // The provider is ONLY contacted by syncCatalogue(). Customers read the saved copy, so the page is instant.
  const productSchema = new mongoose.Schema({
    productId: { type: Number, unique: true, required: true },
    name: { type: String, default: '' },
    category: { type: String, default: 'Other' },
    categoryId: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    inStock: { type: Boolean, default: false },
    picture: { type: String, default: '' },
    syncedAt: { type: Date, default: Date.now }
  });
  const Market4Product = mongoose.models.Market4Product || mongoose.model('Market4Product', productSchema);

  // Only products whose name/category matches one of these are saved and sold.
  // Add more without editing code:  MARKET4_EXTRA_KEYWORDS=snapchat,whatsapp   (Render > Environment)
  // Turn the filter off completely:  MARKET4_SYNC_ALL=1
  const KEYWORD_RULES = [
    /facebook|\bfb\b|\bfbm\b|business manager|\bbm\b|ads manager|fan page/i,
    /instagram|\big\b|insta\b/i,
    /tiktok|tik tok|tik-tok/i,
    /discord/i,
    /dating|tinder|bumble|hinge|badoo|okcupid|grindr|meetme|happn|tantan|plenty of fish|\bpof\b|coffee meets bagel/i,
    /gemini/i,
    /hotmail|outlook/i,
    /yahoo/i,
    /twitter|x\.com|^x\b|\bx (account|acc)/i,
    /patreon/i,
    /google|gmail|gvoice/i,
    /telegram/i,
    /threads/i,
    /vpn/i,
    /textnow|text now|textfree|text free|talkatone|textplus|text plus|textme|texting|\btext\b|\bsms\b|\bnumbers?\b|\botp\b/i,
    /\bavi\b|friends/i,
    /\btrad(e|ing)\b/i
  ];
  const EXTRA_RULES = String(process.env.MARKET4_EXTRA_KEYWORDS || '').split(',')
    .map(function (x) { return x.trim(); }).filter(Boolean)
    .map(function (x) { return new RegExp(x.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&'), 'i'); });
  const ALLOW_ALL = String(process.env.MARKET4_SYNC_ALL || '') === '1';
  function matchesAllowed(name, category) {
    if (ALLOW_ALL) return true;
    const text = String(name || '') + ' | ' + String(category || '');
    return KEYWORD_RULES.some(function (r) { return r.test(text); }) || EXTRA_RULES.some(function (r) { return r.test(text); });
  }

  // Raw download from the provider. Used ONLY by syncCatalogue().
  let cache = { at: 0, categories: [], products: [] };
  async function loadCatalogue(force) {
    await getCfg();
    if (!force && Date.now() - cache.at < 60 * 1000 && cache.products.length) return cache;

    let categories = [];
    try {
      const c = await provider4('get', '/categories');
      categories = (Array.isArray(c && c.results) ? c.results : []).map(function (x) { return { id: Number(x.id), name: x.name }; });
    } catch (e) { if (e.status === 401 || e.status === 503) throw e; /* names are optional */ }

    const all = [];
    const seen = new Set();
    let total = Infinity;
    for (let page = 1; page <= 200 && all.length < total; page++) {
      const d = await provider4('get', '/products', { params: { page: page } });
      const rows = Array.isArray(d && d.results) ? d.results : [];
      if (Number.isFinite(Number(d && d.count))) total = Number(d.count);
      let added = 0;
      for (const p of rows) { if (!seen.has(p.id)) { seen.add(p.id); all.push(p); added++; } }
      if (!rows.length || !added) break;
    }
    cache = { at: Date.now(), categories: categories, products: all };
    return cache;
  }

  const syncState = { promise: null, initDone: false, hasData: false, lastOkAt: 0, lastAttemptAt: 0, lastError: '', lastReason: '', fetched: 0, kept: 0, removed: 0 };
  let memo = { at: 0, list: null };
  function invalidateMemo() { memo.at = 0; }

  async function syncCatalogue(reason) {
    if (syncState.promise) return syncState.promise;
    syncState.lastAttemptAt = Date.now();
    syncState.lastReason = reason || 'manual';
    syncState.promise = (async function () {
      try {
        const cat = await loadCatalogue(true);
        if (!cat.products.length) throw new Error('The provider returned no products - the saved list was kept.');
        const names = new Map(cat.categories.map(function (c) { return [Number(c.id), c.name]; }));
        const keep = [];
        for (const p of cat.products) {
          const category = names.get(Number(p.category_id)) || p.category_name || 'Other';
          const name = p.name || 'Account';
          if (matchesAllowed(name, category)) keep.push({ p: p, name: name, category: category });
        }
        syncState.fetched = cat.products.length;
        syncState.kept = keep.length;
        if (!keep.length) throw new Error('None of the ' + cat.products.length + ' provider products matched the allowed list - the saved list was kept.');

        const now = new Date();
        const ops = keep.map(function (k) {
          const stock = Math.max(0, Number(k.p.stock) || 0);
          return { updateOne: {
            filter: { productId: Number(k.p.id) },
            update: { $set: {
              name: k.name, category: k.category, categoryId: Number(k.p.category_id) || 0,
              cost: Number(k.p.price) || 0, stock: stock, inStock: k.p.in_stock !== false && stock > 0,
              picture: String(k.p.picture || k.p.image || k.p.image_url || '').trim(), syncedAt: now
            } },
            upsert: true
          } };
        });
        for (let i = 0; i < ops.length; i += 500) await Market4Product.bulkWrite(ops.slice(i, i + 500), { ordered: false });
        // Products the provider no longer lists, or that are not in your allowed list, are removed.
        const del = await Market4Product.deleteMany({ productId: { $nin: keep.map(function (k) { return Number(k.p.id); }) } });
        syncState.removed = (del && del.deletedCount) || 0;
        syncState.hasData = true; syncState.lastOkAt = Date.now(); syncState.lastError = '';
        invalidateMemo();
        console.log('[Market4] sync (' + syncState.lastReason + '): provider ' + syncState.fetched + ' products, saved ' + syncState.kept + ', removed ' + syncState.removed);
      } catch (err) {
        syncState.lastError = String((err && err.message) || err).slice(0, 300);
        console.error('[Market4] sync failed:', syncState.lastError);
        throw err;
      } finally {
        syncState.promise = null;
      }
    })();
    return syncState.promise;
  }

  // Start a background sync unless one is running, one just failed, or the saved list is fresh enough.
  function maybeSync(minAgeMs) {
    if (syncState.promise) return;
    const now = Date.now();
    if (now - syncState.lastAttemptAt < 60 * 1000) return;
    if (syncState.lastOkAt && now - syncState.lastOkAt < minAgeMs) return;
    syncCatalogue('auto').catch(function () {});
  }
  const withTimeout = function (p, ms) { return Promise.race([p, new Promise(function (r) { setTimeout(r, ms); })]); };

  (async function initSyncState() {
    try {
      const latest = await Market4Product.findOne({}).sort({ syncedAt: -1 }).select('syncedAt').lean();
      if (latest) { syncState.hasData = true; syncState.lastOkAt = new Date(latest.syncedAt).getTime(); }
    } catch (err) { /* ignore */ }
    syncState.initDone = true;
  })();
  const SYNC_EVERY_MIN = process.env.MARKET4_SYNC_INTERVAL_MIN === undefined ? 30 : Math.max(0, Number(process.env.MARKET4_SYNC_INTERVAL_MIN) || 0);
  setTimeout(function () {
    maybeSync(10 * 60 * 1000);                                   // after a deploy/restart: refresh if older than 10 min or empty
    if (SYNC_EVERY_MIN > 0) setInterval(function () { maybeSync(60 * 1000); }, SYNC_EVERY_MIN * 60 * 1000);
  }, 12000);

  // Reads ONLY the database (plus admin prices). bypass=true skips the 15-second memory copy.
  async function mergedProducts(bypass) {
    if (!bypass && memo.list && Date.now() - memo.at < 15 * 1000) return memo.list;
    const rows = await Market4Product.find({}).sort({ category: 1, name: 1 }).lean();
    const prices = await Market4Price.find({}).lean();
    const byId = new Map(prices.map(function (p) { return [Number(p.productId), p]; }));
    const defaultMarkup = Math.max(0, Number(process.env.MARKET4_DEFAULT_MARKUP_NGN || 300) || 0);
    const list = rows.map(function (p) {
      const o = byId.get(Number(p.productId)) || {};
      const cost = Number(p.cost) || 0;
      const sell = Number(o.sellPrice) > 0 ? Number(o.sellPrice) : (cost > 0 ? cost + defaultMarkup : 0);
      const category = p.category || 'Other';
      const name = p.name || 'Account';
      const stock = Math.max(0, Number(p.stock) || 0);
      return {
        id: Number(p.productId),
        name: name,
        customTitle: o.customTitle || '',
        description: (o.description || '').trim(),
        picture: resolveLogPicture(category, name, String(p.picture || '').trim(), o.picture),
        category: category,
        categoryId: Number(p.categoryId) || 0,
        cost: cost,
        sellPrice: sell,
        profit: sell ? sell - cost : 0,
        stock: stock,
        inStock: !!p.inStock && stock > 0,
        enabled: o.enabled !== false,
        priced: sell > 0
      };
    });
    memo = { at: Date.now(), list: list };
    return list;
  }

`;

src = src.slice(0, lineStart) + NEW_BLOCK + src.slice(lineEnd);

// ───────────────────────────────────────────────────────────────────────────
// 2) Customer products route: if nothing is saved yet, start a background sync
// ───────────────────────────────────────────────────────────────────────────
src = swap(src,
  String.raw`  app.get('/api/market4/products', async (req, res) => {
    res.set('Cache-Control', 'no-store');`,
  String.raw`  app.get('/api/market4/products', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (syncState.initDone && !syncState.hasData) maybeSync(0);   // first ever deploy: fill the saved list`,
  'customer products route');

// ───────────────────────────────────────────────────────────────────────────
// 3) After a successful purchase: lower the saved stock instead of re-downloading
// ───────────────────────────────────────────────────────────────────────────
src = swap(src,
  String.raw`      cache.at = 0;
      checkBalance().catch(() => {});`,
  String.raw`      try {
        const sp = await Market4Product.findOne({ productId: productId });
        if (sp) { sp.stock = Math.max(0, (Number(sp.stock) || 0) - delivered); sp.inStock = sp.stock > 0; await sp.save(); }
      } catch (e) { /* stock is corrected by the next sync */ }
      invalidateMemo();
      checkBalance().catch(() => {});`,
  'stock update after purchase');

// Supplier definitely refused (e.g. out of stock): refresh the saved list in the background.
src = swap(src,
  String.raw`          cache.at = 0;
          return res.status(400).json({ error: msg });`,
  String.raw`          invalidateMemo();
          maybeSync(0);
          return res.status(400).json({ error: msg });`,
  'failed purchase handler');

// ───────────────────────────────────────────────────────────────────────────
// 4) Admin: opening Logs 4 triggers a background sync; products come from the DB
// ───────────────────────────────────────────────────────────────────────────
src = swap(src,
  String.raw`  app.get('/api/admin/market4/config', anyAdminAuth, async (req, res) => {
    const c = await getCfg();`,
  String.raw`  app.get('/api/admin/market4/config', anyAdminAuth, async (req, res) => {
    maybeSync(2 * 60 * 1000);   // admin opened Marketplace 4 -> refresh the saved list in the background
    const c = await getCfg();`,
  'admin config route');

src = swap(src,
  String.raw`  app.get('/api/admin/market4/products', anyAdminAuth, async (req, res) => {
    try { res.json(await mergedProducts(req.query.refresh === '1')); }
    catch (e) { res.status(e.status || 502).json({ error: e.message }); }
  });`,
  String.raw`  app.get('/api/admin/market4/products', anyAdminAuth, async (req, res) => {
    try {
      if (req.query.refresh === '1') {
        await withTimeout(syncCatalogue('admin-refresh'), 45000);       // throws if the provider fails
      } else if (!syncState.hasData) {
        await withTimeout(syncCatalogue('admin-first-load'), 45000);
      } else {
        maybeSync(2 * 60 * 1000);
      }
      res.json(await mergedProducts(true));
    } catch (e) { res.status(e.status || 502).json({ error: e.message }); }
  });
  app.post('/api/admin/market4/sync', anyAdminAuth, (req, res) => {
    syncCatalogue('admin-button').catch(() => {});
    res.json({ ok: true, started: true });
  });
  app.get('/api/admin/market4/sync-status', anyAdminAuth, async (req, res) => {
    const saved = await Market4Product.countDocuments({}).catch(() => 0);
    res.json({ running: !!syncState.promise, saved: saved, providerProducts: syncState.fetched, kept: syncState.kept, removed: syncState.removed,
      lastOkAt: syncState.lastOkAt ? new Date(syncState.lastOkAt).toISOString() : null, lastError: syncState.lastError, lastReason: syncState.lastReason });
  });`,
  'admin products route');

src = swap(src,
  String.raw`    await Market4Price.updateOne({ productId }, { $set: set }, { upsert: true });`,
  String.raw`    await Market4Price.updateOne({ productId }, { $set: set }, { upsert: true });
    invalidateMemo();`,
  'admin price save');

// ───────────────────────────────────────────────────────────────────────────
// 5) Admin page: if "Refresh from API" fails, still show the saved list
// ───────────────────────────────────────────────────────────────────────────
let adminSrc = null;
if (fs.existsSync(ADMIN_JS)) {
  adminSrc = fs.readFileSync(ADMIN_JS, 'utf8');
  const a = String.raw`try { m4List = await aFetch('/api/admin/market4/products'+(refresh?'?refresh=1':'')); m4Render(); }`;
  const b = String.raw`try { try { m4List = await aFetch('/api/admin/market4/products'+(refresh?'?refresh=1':'')); } catch(e1){ if(!refresh) throw e1; m4List = await aFetch('/api/admin/market4/products'); setTimeout(function(){ alert('Could not refresh from the provider: '+e1.message+'\nShowing the last saved list.'); },50); } m4Render(); }`;
  if (adminSrc.split(a).length === 2) adminSrc = adminSrc.split(a).join(b);
  else { console.warn('⚠️  Skipped the small admin-page tweak (code not found) - not required.'); adminSrc = null; }
}

// ───────────────────────────────────────────────────────────────────────────
// Write everything (backups first) and syntax-check the result
// ───────────────────────────────────────────────────────────────────────────
const tmp = path.join(ROOT, 'lib', '.market4.check.js');
fs.writeFileSync(tmp, src);
try { new (require('vm').Script)(fs.readFileSync(tmp, 'utf8'), { filename: 'market4.js' }); }
catch (err) { fs.unlinkSync(tmp); die('The patched file failed the syntax check: ' + err.message); }
fs.unlinkSync(tmp);

if (!fs.existsSync(LIB + '.bak-speedfix')) fs.copyFileSync(LIB, LIB + '.bak-speedfix');
fs.writeFileSync(LIB, src);
if (adminSrc) {
  if (!fs.existsSync(ADMIN_JS + '.bak-speedfix')) fs.copyFileSync(ADMIN_JS, ADMIN_JS + '.bak-speedfix');
  fs.writeFileSync(ADMIN_JS, adminSrc);
}

console.log('\n✅ Marketplace 4 speed fix applied.');
console.log('   - lib/market4.js           (saved product list + filtered background sync)');
if (adminSrc) console.log('   - public/js/admin-king.js  (small tweak)');
console.log('\nNext: git add -A && git commit -m "Marketplace 4 speed fix" && git push   -> Render redeploys.');
console.log('Then open Admin -> Logs 4 once so the first sync fills the database.\n');