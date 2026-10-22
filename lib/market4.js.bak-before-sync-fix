// ── Marketplace 4 (the provider API) ────────────────────────────────────────
// Pulls every product from  and resells it.
// A product is only shown to customers once the admin sets a selling price.
// Admin can switch Marketplace 4 on/off; when it is off, customers see a
// maintenance screen and cannot buy.
//
// .env:
//   MARKET4_API_KEY=your_provider4socials_key
//   MARKET4_BASE_URL=   (optional, this is the default)
//   MARKET4_LOW_BALANCE_NGN=5000                        (optional, email alert level)
//   ADMIN_ALERT_EMAIL=you@example.com                  (where alerts are emailed)
//
// ── DELIVERY GUARANTEE ──────────────────────────────────────────────────────
// the provider returns the purchased keys exactly once, in the /buy response.
// This module is built so a customer can never be charged without receiving
// them:
//   1. An order record is written BEFORE the customer is charged, and carries a
//      client-supplied idempotency ref, so a double-tap or a retry after a
//      dropped connection returns the SAME order/keys instead of charging again.
//   2. The moment the supplier answers, the keys are saved to the order AND to
//      the customer's purchases (both with retries) before anything else runs.
//   3. If the supplier gives a definite error (out of stock, low supplier
//      balance, bad request…) the customer is refunded automatically.
//   4. If the outcome is UNKNOWN (timeout, network drop, supplier 5xx) the order
//      is held as "review" - the customer is NOT refunded blindly (the supplier
//      may have delivered) - and the admin is emailed. The admin panel can then
//      deliver the keys manually or refund.
//   5. A background reconciler re-syncs any delivered order whose keys did not
//      reach the customer's purchases, and flags orders stuck in "pending".
//   6. Keys are always returned in the buy response, and are also available to
//      the customer through GET /api/market4/orders.

const axios = require('axios');
const crypto = require('crypto');

let resolveLogPicture = () => '';
try { resolveLogPicture = require('./market2').resolveLogPicture || resolveLogPicture; } catch (e) { /* optional */ }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function withRetry(fn, tries = 3, delayMs = 250) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < tries - 1) await sleep(delayMs * (i + 1)); }
  }
  throw last;
}

function register(app, deps) {
  const { mongoose, User, Transaction, auth, anyAdminAuth, sendAdminEmail } = deps;

  let runtimeApiKey = '';
  let runtimeBaseUrl = '';
  const encryptionKey = () => crypto.createHash('sha256').update(String(process.env.JWT_SECRET || 'provider-config-key')).digest();
  function encryptSecret(value) { const iv=crypto.randomBytes(12); const cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv); const encrypted=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]); return 'v1:'+iv.toString('hex')+':'+cipher.getAuthTag().toString('hex')+':'+encrypted.toString('hex'); }
  function decryptSecret(value) { try { const p=String(value||'').split(':'); if(p.length!==4||p[0]!=='v1')return ''; const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(p[1],'hex')); decipher.setAuthTag(Buffer.from(p[2],'hex')); return Buffer.concat([decipher.update(Buffer.from(p[3],'hex')),decipher.final()]).toString('utf8'); } catch(e) { return ''; } }
  // Pasted keys often carry quotes, spaces, line breaks or a leading "Bearer " — all of which make a
  // perfectly good key come back as "invalid". Clean it the same way everywhere it is read or saved.
  const cleanKey = (v) => String(v || '').replace(/[\r\n\t]/g, '').trim().replace(/^["'`]+|["'`]+$/g, '').replace(/^bearer\s+/i, '').trim();
  const NOVA_DEFAULT_BASE = String(process.env.NOVA_BASE_URL || 'https://www.novasolution.ng/api/v1').replace(/\/+$/, '');
  const hostOf = (u) => { try { return new URL(u).host.toLowerCase(); } catch (e) { return ''; } };
  const rawBase = () => String(runtimeBaseUrl || process.env.MARKET4_BASE_URL || NOVA_DEFAULT_BASE || '').replace(/\/+$/, '');
  const baseUrl = () => rawBase();
  // The NovaSolution key (Boosting 2 / Buy Number 3) is only ever reused when Marketplace 4 points at
  // NovaSolution itself, so it can never be sent to a different provider's server.
  const isNovaBase = () => !!rawBase() && hostOf(rawBase()) === hostOf(NOVA_DEFAULT_BASE);
  const keySource = () => runtimeApiKey ? 'admin settings' : (process.env.MARKET4_API_KEY ? 'MARKET4_API_KEY (Render environment)' : ((isNovaBase() && process.env.NOVA_API_KEY) ? 'NOVA_API_KEY (Render environment)' : 'none'));
  const apiKey = () => cleanKey(runtimeApiKey || process.env.MARKET4_API_KEY || (isNovaBase() ? process.env.NOVA_API_KEY : ''));
  // Lets Boosting 2 reuse the key saved here when no NOVA_API_KEY is set in Render.
  app.locals.market4NovaKey = () => (isNovaBase() && runtimeApiKey) ? cleanKey(runtimeApiKey) : '';

  // ── Models ────────────────────────────────────────────────────────────────
  const cfgSchema = new mongoose.Schema({
    key: { type: String, default: 'main', unique: true },
    market4Enabled: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: 'This marketplace is under maintenance. Please check back shortly.' },
    apiKeyCipher: { type: String, default: '' },
    customBaseUrl: { type: String, default: '' },
    lowBalanceNgn: { type: Number, default: Number(process.env.MARKET4_LOW_BALANCE_NGN || 5000) },
    alertEmail: { type: String, default: '' },
    lastBalance: { type: Number, default: 0 },
    lastBalanceAt: { type: Date, default: null },
    lastBalanceError: { type: String, default: '' },
    lastAlertAt: { type: Date, default: null }
  });
  const Market4Config = mongoose.models.Market4Config || mongoose.model('Market4Config', cfgSchema);

  const priceSchema = new mongoose.Schema({
    productId: { type: Number, unique: true, required: true },
    sellPrice: { type: Number, default: 0 },   // 0 = hidden from users
    enabled: { type: Boolean, default: true },
    customTitle: { type: String, default: '' },
    description: { type: String, default: '' },
    picture: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
  });
  const Market4Price = mongoose.models.Market4Price || mongoose.model('Market4Price', priceSchema);

  const orderSchema = new mongoose.Schema({
    ref: { type: String, unique: true, required: true },            // idempotency key
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    userEmail: String,
    productId: Number,
    productName: String,
    title: String,
    quantity: Number,
    unitSell: Number,
    sellTotal: Number,
    costTotal: Number,
    profit: Number,
    status: { type: String, default: 'pending', index: true },     // pending | delivered | partial | review | failed | refunded
    debited: { type: Boolean, default: false },
    refunded: { type: Boolean, default: false },
    refundedAmount: { type: Number, default: 0 },
    supplierOrderId: String,
    keys: [String],
    deliverySynced: { type: Boolean, default: false },              // keys are in the customer's purchases
    txRecorded: { type: Boolean, default: false },
    note: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now }
  });
  const Market4Order = mongoose.models.Market4Order || mongoose.model('Market4Order', orderSchema);

  async function getCfg() {
    let c = await Market4Config.findOne({ key: 'main' });
    if (!c) c = await Market4Config.create({ key: 'main' });
    runtimeApiKey = c.apiKeyCipher ? decryptSecret(c.apiKeyCipher) : '';
    runtimeBaseUrl = c.customBaseUrl || '';
    return c;
  }

  // ── Supplier API client ───────────────────────────────────────────────────
  // err.status    HTTP status (0 when no response was received)
  // err.ambiguous true when we cannot tell whether the supplier processed the
  //               request (timeout / network error / 5xx). Never auto-refund these.
  async function rawCall(method, path, { params, data, timeout, headers: extra } = {}) {
    if (!apiKey() || !baseUrl()) {
      const e = new Error('Marketplace 4 is not available right now. Please check back soon.');
      e.status = 503; e.ambiguous = false; throw e;
    }
    try {
      const r = await axios({
        method, url: baseUrl() + path, params, data, timeout: timeout || 30000,
        headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(extra || {}) }
      });
      return r.data;
    } catch (err) {
      const status = err.response?.status || 0;
      const body = err.response?.data || {};
      const map = {
        401: `The provider rejected the API key (key from ${keySource()}, ends …${apiKey().slice(-4)}, sent to ${hostOf(baseUrl())}). Check that this key belongs to that provider and the API URL is its own.`, 402: 'Supplier wallet balance is too low.',
        404: 'Product not found.', 409: 'This product is out of stock.', 429: 'Too many requests - try again shortly.'
      };
      const e = new Error(status === 401 ? map[401] : ((body && (body.detail || body.message || body.error)) || map[status] || err.message || 'Supplier request failed'));
      e.status = status || 502;
      e.code = (body && body.error) || '';
      e.ambiguous = !status || status >= 500;
      throw e;
    }
  }

  // ── NovaSolution adapter ──────────────────────────────────────────────────
  // NovaSolution's logs API is different from the /categories + /products + /buy style, so when the API URL
  // is NovaSolution we translate its responses into the shape the rest of this file already understands:
  //   GET /catalog/logs  -> products (price_minor is kobo, so ÷100 to get ₦)
  //   POST /orders {type:'logs', product_id, quantity} + Idempotency-Key -> delivered items
  //   GET /balance       -> balance_ngn
  const novaItemsToKeys = (items) => {
    const out = [];
    const walk = (it) => {
      if (it == null) return;
      if (Array.isArray(it)) return it.forEach(walk);
      if (typeof it === 'object') {
        for (const k of ['credentials', 'keys', 'logs', 'accounts', 'details', 'items', 'delivery', 'deliveries']) { if (Array.isArray(it[k]) && it[k].length) return it[k].forEach(walk); }
      }
      out.push(it);
    };
    walk(items);
    return out;
  };
  async function provider4(method, path, opts = {}) {
    if (!isNovaBase()) return rawCall(method, path, opts);
    if (path === '/categories') return { count: 0, results: [] };
    if (path === '/products') {
      const page = Number(opts.params && opts.params.page) || 1;
      if (page > 1) return { count: 0, results: [] };
      const d = await rawCall('get', '/catalog/logs', { timeout: opts.timeout });
      const u = (d && d.data && typeof d.data === 'object' && !Array.isArray(d.data)) ? d.data : (d || {});
      const cats = (Array.isArray(u.categories) ? u.categories : []).map(c => String(c && c.name != null ? c.name : c)).filter(Boolean);
      const rows = (Array.isArray(u.products) ? u.products : []).map(p => {
        const name = String(p.name || 'Account');
        const own = String(p.category || p.category_name || (p.category && p.category.name) || '').trim();
        const guess = cats.find(c => name.toLowerCase().includes(c.toLowerCase()));
        const minor = Number(p.price_minor);
        return { id: p.id, name, category_name: own || guess || 'Other', price: Number.isFinite(minor) ? minor / 100 : Number(p.price) || 0, stock: Number(p.stock) || 0, in_stock: (Number(p.stock) || 0) > 0, picture: p.picture || p.image || p.image_url || '' };
      });
      return { count: rows.length, results: rows };
    }
    if (path === '/balance') {
      const d = await rawCall('get', '/balance', opts);
      return { balance: d && (d.balance_ngn ?? (Number(d.balance_minor) / 100)), currency: (d && d.currency) || 'NGN' };
    }
    if (path === '/buy') {
      const body = opts.data || {};
      const idem = String(opts.idem || ('m4-' + crypto.randomUUID()));
      const d = await rawCall('post', '/orders', { timeout: opts.timeout, headers: { 'Idempotency-Key': idem }, data: { type: 'logs', product_id: Number(body.product), quantity: Number(body.quantity) || 1 } });
      let order = d && d.order ? d.order : (d || {});
      let items = novaItemsToKeys([order.items, d && d.items]);
      // The order may be created first and filled a moment later - look it up once before giving up.
      if (!items.length && order.number) {
        try {
          await sleep(1500);
          const again = await rawCall('get', '/orders/' + encodeURIComponent(order.number), { timeout: 20000 });
          const o2 = again && again.order ? again.order : (again || {});
          items = novaItemsToKeys([o2.items]);
          order = { ...order, ...o2 };
        } catch (e) { /* the empty-keys path below holds the order for admin review */ }
      }
      const minor = Number(order.total_minor);
      return { order_id: order.number || '', charge: Number.isFinite(minor) ? minor / 100 : undefined, keys: items };
    }
    return rawCall(method, path, opts);
  }

  // ── Catalogue (categories + every product page), cached 60s ───────────────
  let cache = { at: 0, categories: [], products: [] };
  async function loadCatalogue(force) {
    await getCfg();
    if (!force && Date.now() - cache.at < 60 * 1000 && cache.products.length) return cache;

    let categories = [];
    try {
      const c = await provider4('get', '/categories');
      categories = (Array.isArray(c?.results) ? c.results : []).map(x => ({ id: Number(x.id), name: x.name }));
    } catch (e) { if (e.status === 401 || e.status === 503) throw e; /* names are optional */ }

    const all = [];
    const seen = new Set();
    let total = Infinity;
    for (let page = 1; page <= 100 && all.length < total; page++) {
      const d = await provider4('get', '/products', { params: { page } });
      const rows = Array.isArray(d?.results) ? d.results : [];
      if (Number.isFinite(Number(d?.count))) total = Number(d.count);
      let added = 0;
      for (const p of rows) { if (!seen.has(p.id)) { seen.add(p.id); all.push(p); added++; } }
      if (!rows.length || !added) break;
    }
    cache = { at: Date.now(), categories, products: all };
    return cache;
  }

  async function mergedProducts(force) {
    const { categories, products } = await loadCatalogue(force);
    const catName = new Map(categories.map(c => [Number(c.id), c.name]));
    const prices = await Market4Price.find({}).lean();
    const byId = new Map(prices.map(p => [Number(p.productId), p]));
    return products.map(p => {
      const o = byId.get(Number(p.id)) || {};
      const cost = Number(p.price) || 0;
      const defaultMarkup = Math.max(0, Number(process.env.MARKET4_DEFAULT_MARKUP_NGN || 300) || 0);
      const sell = Number(o.sellPrice) > 0 ? Number(o.sellPrice) : (cost > 0 ? cost + defaultMarkup : 0);
      const category = catName.get(Number(p.category_id)) || p.category_name || 'Other';
      const name = p.name || 'Account';
      const stock = Math.max(0, Number(p.stock) || 0);
      const apiPic = String(p.picture || p.image || p.image_url || '').trim();
      return {
        id: Number(p.id),
        name,
        customTitle: o.customTitle || '',
        description: (o.description || '').trim(),
        picture: resolveLogPicture(category, name, apiPic, o.picture),
        category,
        categoryId: Number(p.category_id),
        cost,
        sellPrice: sell,
        profit: sell ? sell - cost : 0,
        stock,
        inStock: p.in_stock !== false && stock > 0,
        enabled: o.enabled !== false,
        priced: sell > 0
      };
    });
  }

  // ── Balance monitor + email ───────────────────────────────────────────────
  async function alertAdmin(subject, text) {
    try {
      const cfg = await getCfg();
      await sendAdminEmail(cfg.alertEmail || process.env.ADMIN_ALERT_EMAIL, subject, text);
    } catch (e) { console.error('[Market4] admin alert failed:', e.message); }
  }

  async function checkBalance() {
    const cfg = await getCfg();
    try {
      const d = await provider4('get', '/balance');
      const bal = Number(d?.balance ?? d?.balance_ngn) || 0;
      cfg.lastBalance = bal; cfg.lastBalanceAt = new Date(); cfg.lastBalanceError = '';
      const low = Number(cfg.lowBalanceNgn) || 0;
      const cooledDown = !cfg.lastAlertAt || Date.now() - cfg.lastAlertAt.getTime() > 6 * 3600 * 1000;
      if (low > 0 && bal < low && cooledDown) {
        const r = await sendAdminEmail(cfg.alertEmail || process.env.ADMIN_ALERT_EMAIL,
          'Marketplace 4 supplier balance is low',
          `Your the provider wallet balance is ₦${bal.toLocaleString('en-NG')}, below your ₦${low.toLocaleString('en-NG')} warning level.\n\nTop up now or Marketplace 4 purchases will start failing.`);
        if (r?.sent) cfg.lastAlertAt = new Date();
      }
      await cfg.save();
      return { balance: bal, currency: d?.currency || 'NGN', threshold: low };
    } catch (e) {
      cfg.lastBalanceError = String(e.message).slice(0, 300); cfg.lastBalanceAt = new Date();
      await cfg.save().catch(() => {});
      throw e;
    }
  }
  setTimeout(() => {
    checkBalance().catch(() => {});
    setInterval(() => checkBalance().catch(() => {}), 15 * 60 * 1000);
  }, 25000);

  // ── Delivery helpers ──────────────────────────────────────────────────────
  // Normalise a supplier key entry to readable text (never "[object Object]").
  const toKeyText = (k) => {
    if (k == null) return '';
    if (typeof k === 'string') return k.trim();
    if (typeof k !== 'object') return String(k);
    const v = k.key ?? k.credential ?? k.details ?? k.detail ?? k.value ?? k.data ?? k.login ?? k.log ?? k.text ?? k.account ?? k.content;
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (Array.isArray(v)) return v.map(toKeyText).filter(Boolean).join('\n');
    const clean = Object.fromEntries(Object.entries(k).filter(([, x]) => x !== null && x !== undefined && x !== ''));
    try { return JSON.stringify(clean); } catch { return ''; }
  };

  // Put the keys into the customer's purchases + ledger. Idempotent: safe to
  // call any number of times for the same order (never duplicates).
  async function deliverToUser(orderId) {
    const o = await Market4Order.findById(orderId);
    if (!o || !o.keys || !o.keys.length || !['delivered', 'partial'].includes(o.status)) return false;
    if (!o.deliverySynced) {
      const paid = o.sellTotal;
      await User.updateOne(
        { _id: o.userId, 'purchaseDetails.logId': { $ne: o._id } },
        { $push: { purchaseDetails: {
          logId: o._id, logTitle: `[Marketplace 4] ${o.title}`, logType: 'log', source: 'market4',
          logDetails: o.keys.join('\n'), pricePaid: paid, purchasedAt: o.createdAt || new Date()
        } } });
      await Market4Order.updateOne({ _id: o._id }, { $set: { deliverySynced: true, updatedAt: new Date() } });
    }
    if (!o.txRecorded) {
      const claimed = await Market4Order.findOneAndUpdate({ _id: o._id, txRecorded: false }, { $set: { txRecorded: true } });
      if (claimed) {
        try {
          await Transaction.create({ userId: o.userId, type: 'purchase', amount: o.sellTotal, description: `Bought ${o.title} - Marketplace 4`, status: 'success' });
        } catch (e) {
          await Market4Order.updateOne({ _id: o._id }, { $set: { txRecorded: false } }).catch(() => {});
          console.error('[Market4] ledger entry failed (will retry):', e.message);
        }
      }
    }
    return true;
  }

  // Refund once and only once per order.
  async function refundOrder(orderId, amount, note, finalStatus) {
    const claimed = await Market4Order.findOneAndUpdate(
      { _id: orderId, refunded: false }, { $set: { refunded: true, updatedAt: new Date() } }, { new: true });
    if (!claimed) return false;
    try {
      await withRetry(() => User.updateOne({ _id: claimed.userId }, { $inc: { balance: amount } }), 4, 300);
    } catch (e) {
      await Market4Order.updateOne({ _id: orderId }, { $set: { refunded: false } }).catch(() => {});
      throw e;
    }
    const set = { refundedAmount: amount, updatedAt: new Date(), note: note || '' };
    if (finalStatus) set.status = finalStatus;
    await Market4Order.updateOne({ _id: orderId }, { $set: set });
    try { await Transaction.create({ userId: claimed.userId, type: 'refund', amount, description: `Refund - ${claimed.title} (Marketplace 4)`, status: 'success' }); } catch (e) { /* ledger is best-effort */ }
    return true;
  }

  const customerView = (o) => ({
    orderId: String(o._id), ref: o.ref, status: o.status, title: o.title, quantity: o.quantity,
    amountPaid: Math.max(0, (o.sellTotal || 0)), keys: o.keys || [], createdAt: o.createdAt
  });

  // ── Public ────────────────────────────────────────────────────────────────
  app.get('/api/market4/status', async (req, res) => {
    try { const c = await getCfg(); res.json({ market4Enabled: c.market4Enabled, maintenanceMessage: c.maintenanceMessage }); }
    catch (e) { res.json({ market4Enabled: true, maintenanceMessage: '' }); }
  });

  app.get('/api/market4/products', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const c = await getCfg();
      if (!c.market4Enabled) return res.status(503).json({ error: c.maintenanceMessage, maintenance: true });
      const list = (await mergedProducts(false))
        .filter(p => p.priced && p.enabled)
        .map(p => ({
          id: p.id, title: p.customTitle || p.name, description: p.description, picture: p.picture,
          category: p.category, price: p.sellPrice, stock: p.stock, inStock: p.inStock
        }));
      res.json(list);
    } catch (e) { res.status(e.status === 503 ? 503 : 502).json({ error: 'Could not load Marketplace 4 right now. Please try again.' }); }
  });

  // The customer's own Marketplace 4 orders (keys included) - a second place,
  // besides My Purchases, where credentials can always be recovered.
  app.get('/api/market4/orders', auth, async (req, res) => {
    try {
      const q = { userId: req.user._id };
      if (req.query.ref) q.ref = String(req.query.ref).slice(0, 80);
      const orders = await Market4Order.find(q).sort({ createdAt: -1 }).limit(req.query.ref ? 1 : 50).lean();
      res.json(orders.map(customerView));
    } catch (e) { res.status(500).json({ error: 'Could not load your orders.' }); }
  });

  app.post('/api/market4/buy', auth, async (req, res) => {
    let order = null;
    try {
      const c = await getCfg();
      if (!c.market4Enabled) return res.status(503).json({ error: c.maintenanceMessage, maintenance: true });
      const productId = parseInt(req.body?.productId, 10);
      const quantity = Math.max(1, Math.min(100, parseInt(req.body?.quantity, 10) || 1));
      if (!productId) return res.status(400).json({ error: 'Pick a product first.' });
      if (!apiKey()) return res.status(503).json({ error: 'Marketplace 4 is not available right now. Nothing was charged.' });
      const ref = String(req.body?.clientRef || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || crypto.randomUUID();

      // Idempotency: the same click/retry must never charge twice.
      const existing = await Market4Order.findOne({ ref });
      if (existing) {
        if (String(existing.userId) !== String(req.user._id)) return res.status(409).json({ error: 'Invalid request. Please refresh and try again.' });
        if (['delivered', 'partial'].includes(existing.status)) {
          deliverToUser(existing._id).catch(() => {});
          return res.json({ ok: true, repeated: true, ...customerView(existing), title: existing.title, balance: (await User.findById(req.user._id).select('balance'))?.balance });
        }
        if (existing.status === 'failed' || existing.status === 'refunded') return res.status(400).json({ error: existing.note || 'This order did not go through. Nothing was charged.' });
        return res.status(202).json({ ok: true, pending: true, orderId: String(existing._id), ref, message: 'Your order is still being processed. Your credentials will appear in My Purchases as soon as it completes.' });
      }

      const product = (await mergedProducts(true)).find(p => p.id === productId);
      if (!product || !product.priced || !product.enabled) return res.status(404).json({ error: 'This product is not available.' });
      if (!product.inStock || product.stock < quantity) return res.status(409).json({ error: `Only ${product.stock} left in stock.` });
      if (product.sellPrice <= product.cost) return res.status(400).json({ error: 'This product is temporarily unavailable.' });

      const title = `${product.customTitle || product.name}${quantity > 1 ? ` ×${quantity}` : ''}`;
      const total = product.sellPrice * quantity;

      // 1) Record the order BEFORE touching the customer's money.
      order = await Market4Order.create({
        ref, userId: req.user._id, userEmail: req.user.email, productId, productName: product.name, title,
        quantity, unitSell: product.sellPrice, sellTotal: total, costTotal: product.cost * quantity,
        profit: total - product.cost * quantity, status: 'pending'
      });

      // 2) Atomic debit so two taps can never double-spend.
      const user = await User.findOneAndUpdate(
        { _id: req.user._id, balance: { $gte: total } }, { $inc: { balance: -total } }, { new: true });
      if (!user) {
        await Market4Order.updateOne({ _id: order._id }, { $set: { status: 'failed', note: 'Insufficient balance', updatedAt: new Date() } });
        return res.status(400).json({ error: 'Insufficient balance. Please deposit funds.' });
      }
      await Market4Order.updateOne({ _id: order._id }, { $set: { debited: true } }).catch(() => {});

      // 3) Buy from the supplier.
      let bought;
      try {
        bought = await provider4('post', '/buy', { data: { product: productId, quantity }, timeout: 45000, idem: 'm4-' + String(order._id) });
      } catch (e) {
        if (!e.ambiguous) {
          // Definite failure: the supplier did not sell anything → full automatic refund.
          const msg = e.status === 402 ? 'This product is temporarily unavailable. Nothing was charged.' : 'We could not complete this purchase. Nothing was charged.';
          try { await refundOrder(order._id, total, msg, 'failed'); }
          catch (re) {
            await Market4Order.updateOne({ _id: order._id }, { $set: { status: 'review', note: 'Supplier rejected the order but the automatic refund failed - refund manually. ' + re.message, updatedAt: new Date() } }).catch(() => {});
            alertAdmin('Marketplace 4: refund failed - action needed', `Order ${order._id} for ${req.user.email} (${title}, ₦${total}) was rejected by the supplier but the automatic refund failed. Please refund it from Admin → Logs 3.`);
            return res.status(202).json({ ok: true, pending: true, orderId: String(order._id), ref, message: 'We could not complete your order. Your payment is safe and is being returned - contact support if your balance is not restored shortly.' });
          }
          if (e.status === 402 || e.status === 401) checkBalance().catch(() => {});
          cache.at = 0;
          return res.status(400).json({ error: msg });
        }
        // Unknown outcome: keep the money held, flag for review. Never refund blindly.
        await Market4Order.updateOne({ _id: order._id }, { $set: { status: 'review', note: 'Supplier did not answer clearly (' + e.message + '). Check the the provider order history, then deliver the keys or refund.', updatedAt: new Date() } }).catch(() => {});
        alertAdmin('Marketplace 4: order needs review', `Order ${order._id} for ${req.user.email} (${title}, ₦${total}) got no clear answer from the provider (${e.message}).\n\nThe customer has been charged. Open Admin → Logs 3 → "Needs attention" and either deliver the keys (from your the provider order history) or refund the customer.`);
        return res.status(202).json({ ok: true, pending: true, orderId: String(order._id), ref, message: 'Your payment was received and your order is being verified. Your credentials will appear in My Purchases shortly - please do not buy again. Contact support if you have not received them in 15 minutes.' });
      }

      // 4) The supplier sold it. Persist the keys IMMEDIATELY, before anything else.
      const keys = Array.isArray(bought?.keys) ? bought.keys.map(toKeyText).filter(Boolean) : [];
      const supplierCost = Number(bought?.charge);
      const costTotal = Number.isFinite(supplierCost) && supplierCost > 0 ? supplierCost : product.cost * quantity;

      if (!keys.length) {
        await Market4Order.updateOne({ _id: order._id }, { $set: { status: 'review', supplierOrderId: String(bought?.order_id || ''), costTotal, note: 'Supplier accepted the order but returned no keys. Retrieve them from your the provider order history and deliver them from the admin panel.', updatedAt: new Date() } }).catch(() => {});
        alertAdmin('Marketplace 4: supplier returned NO keys', `Order ${order._id} (supplier order ${bought?.order_id || 'unknown'}) for ${req.user.email} was accepted by the provider but no keys came back. Open Admin → Logs 3 → "Needs attention" to deliver them manually.`);
        return res.status(202).json({ ok: true, pending: true, orderId: String(order._id), ref, message: 'Your payment was received and your order is being finalised. Your credentials will appear in My Purchases shortly - please do not buy again.' });
      }

      const delivered = keys.length;
      const missing = Math.max(0, quantity - delivered);
      const sellTotal = order.unitSell * delivered;
      const patch = {
        status: missing ? 'partial' : 'delivered', keys, supplierOrderId: String(bought?.order_id || ''),
        sellTotal, costTotal, profit: sellTotal - costTotal, updatedAt: new Date(),
        note: missing ? `Supplier delivered ${delivered} of ${quantity} keys; the difference was refunded.` : ''
      };
      let savedToOrder = true;
      try { await withRetry(() => Market4Order.updateOne({ _id: order._id }, { $set: patch }), 4, 300); }
      catch (e) {
        savedToOrder = false;
        // Absolute last resort: the keys exist only in memory right now.
        console.error('[Market4] CRITICAL could not save keys to order', String(order._id), 'user', req.user.email, 'keys:', JSON.stringify(keys));
      }

      // 5) Deliver to the customer's purchases (retried; the reconciler covers any remaining failure).
      let synced = false;
      try {
        if (savedToOrder) { await withRetry(() => deliverToUser(order._id), 3, 300); synced = true; }
        else {
          await withRetry(() => User.updateOne({ _id: user._id }, { $push: { purchaseDetails: {
            logId: order._id, logTitle: `[Marketplace 4] ${title}`, logType: 'log', source: 'market4',
            logDetails: keys.join('\n'), pricePaid: sellTotal, purchasedAt: new Date() } } }), 3, 300);
          synced = true;
        }
      } catch (e) { console.error('[Market4] delivery sync pending - reconciler will retry:', e.message); }

      // Partial delivery: give back the money for the keys that were not delivered.
      if (missing) {
        try { await refundOrder(order._id, order.unitSell * missing, patch.note, 'partial'); } catch (e) { console.error('[Market4] partial refund failed:', e.message); }
        alertAdmin('Marketplace 4: partial delivery', `Order ${order._id} for ${req.user.email}: ordered ${quantity}, supplier delivered ${delivered}. The missing ${missing} were refunded automatically.`);
      }

      cache.at = 0;
      checkBalance().catch(() => {});
      const fresh = await User.findById(user._id).select('balance').lean().catch(() => null);
      res.json({ ok: true, title, quantity: delivered, amountPaid: sellTotal, keys, balance: fresh ? fresh.balance : user.balance, orderId: String(order._id), ref, partial: !!missing, saved: synced });
    } catch (e) {
      // Something unexpected. If the order exists and the money moved, it must not be lost.
      console.error('[Market4] buy error:', e);
      if (order && order._id) {
        try {
          const o = await Market4Order.findById(order._id);
          if (o && o.status === 'pending' && o.debited) {
            await Market4Order.updateOne({ _id: o._id }, { $set: { status: 'review', note: 'Unexpected server error during purchase: ' + e.message, updatedAt: new Date() } });
            alertAdmin('Marketplace 4: order needs review', `Order ${o._id} for ${o.userEmail} hit a server error after payment (${e.message}). Check Admin → Logs 3.`);
            return res.status(202).json({ ok: true, pending: true, orderId: String(o._id), ref: o.ref, message: 'Your order is being verified. Please do not buy again - your credentials will appear in My Purchases shortly.' });
          }
          if (o && o.status === 'delivered') {
            return res.json({ ok: true, ...customerView(o), title: o.title, quantity: o.quantity });
          }
        } catch (e2) { /* fall through */ }
      }
      res.status(500).json({ error: 'Purchase failed. If you were charged, your credentials will appear in My Purchases - otherwise nothing was taken.' });
    }
  });

  // ── Reconciler: never leave a paid order undelivered ──────────────────────
  async function reconcile() {
    try {
      const unsynced = await Market4Order.find({
        status: { $in: ['delivered', 'partial'] }, 'keys.0': { $exists: true },
        $or: [{ deliverySynced: false }, { txRecorded: false }]
      }).limit(50);
      for (const o of unsynced) { await deliverToUser(o._id).catch(e => console.error('[Market4] reconcile deliver failed:', e.message)); }

      const stale = await Market4Order.find({ status: 'pending', createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } }).limit(50);
      for (const o of stale) {
        const r = await Market4Order.updateOne({ _id: o._id, status: 'pending' }, { $set: { status: 'review', note: 'Order was interrupted (server restart or crash) - verify against the provider order history.', updatedAt: new Date() } });
        if (r.modifiedCount) alertAdmin('Marketplace 4: interrupted order', `Order ${o._id} for ${o.userEmail} (${o.title}) was interrupted. Open Admin → Logs 3 → "Needs attention".`);
      }
    } catch (e) { console.error('[Market4] reconcile error:', e.message); }
  }
  setTimeout(() => { reconcile(); setInterval(reconcile, 2 * 60 * 1000); }, 15000);
  setTimeout(() => { getCfg().catch(() => {}); setInterval(() => getCfg().catch(() => {}), 60 * 1000); }, 4000);

  // ── Admin ─────────────────────────────────────────────────────────────────
  app.get('/api/admin/market4/config', anyAdminAuth, async (req, res) => {
    const c = await getCfg();
    res.json({ ...c.toObject(), apiConnected: !!apiKey(), apiKeyConfigured: !!apiKey(), keySource: keySource(), keyLast4: apiKey().slice(-4), baseUrl: baseUrl(), apiKeyCipher: undefined });
  });
  app.put('/api/admin/market4/config', anyAdminAuth, async (req, res) => {
    const c = await getCfg(); const b = req.body || {};
    if (typeof b.market4Enabled === 'boolean') c.market4Enabled = b.market4Enabled;
    if (typeof b.maintenanceMessage === 'string') c.maintenanceMessage = b.maintenanceMessage.slice(0, 300);
    if (b.lowBalanceNgn !== undefined && Number(b.lowBalanceNgn) >= 0) c.lowBalanceNgn = Number(b.lowBalanceNgn);
    if (typeof b.alertEmail === 'string') c.alertEmail = b.alertEmail.trim().slice(0, 200);
    if (typeof b.apiKey === 'string' && b.apiKey.trim()) c.apiKeyCipher = encryptSecret(cleanKey(b.apiKey));
    if (typeof b.baseUrl === 'string' && b.baseUrl.trim()) {
      try { const u = new URL(b.baseUrl.trim()); if (u.protocol !== 'https:') return res.status(400).json({ error: 'Use an HTTPS provider API URL.' }); c.customBaseUrl = b.baseUrl.trim().replace(/\/+$/, ''); }
      catch(e) { return res.status(400).json({ error: 'Enter a valid HTTPS provider API URL.' }); }
    }
    await c.save();
    await getCfg();
    res.json({ ok: true, apiKeyConfigured: !!apiKey(), baseUrl: baseUrl() });
  });
  app.get('/api/admin/market4/products', anyAdminAuth, async (req, res) => {
    try { res.json(await mergedProducts(req.query.refresh === '1')); }
    catch (e) { res.status(e.status || 502).json({ error: e.message }); }
  });
  app.put('/api/admin/market4/products/:id', anyAdminAuth, async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    if (!productId) return res.status(400).json({ error: 'Bad product id' });
    const b = req.body || {}; const set = { updatedAt: new Date() };
    if (b.sellPrice !== undefined) {
      const n = Number(b.sellPrice);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'Price must be ₦0 or more (0 hides it).' });
      set.sellPrice = n;
    }
    if (typeof b.enabled === 'boolean') set.enabled = b.enabled;
    if (typeof b.customTitle === 'string') set.customTitle = b.customTitle.slice(0, 150);
    if (typeof b.description === 'string') set.description = b.description.slice(0, 1000);
    if (typeof b.picture === 'string') set.picture = b.picture.trim().slice(0, 1000);
    await Market4Price.updateOne({ productId }, { $set: set }, { upsert: true });
    res.json({ ok: true });
  });
  app.get('/api/admin/market4/balance', anyAdminAuth, async (req, res) => {
    try { res.json(await checkBalance()); } catch (e) { res.status(502).json({ error: e.message }); }
  });
  app.get('/api/admin/market4/orders', anyAdminAuth, async (req, res) => {
    const orders = await Market4Order.find({}).sort({ createdAt: -1 }).limit(200).select('-keys').lean();
    const attention = await Market4Order.find({ $or: [{ status: 'review' }, { status: 'pending', createdAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) } }, { status: { $in: ['delivered', 'partial'] }, deliverySynced: false }] })
      .sort({ createdAt: -1 }).limit(100).select('-keys').lean();
    const agg = await Market4Order.aggregate([
      { $match: { status: { $in: ['delivered', 'partial'] } } },
      { $group: { _id: null, sales: { $sum: '$sellTotal' }, cost: { $sum: '$costTotal' }, profit: { $sum: '$profit' }, count: { $sum: 1 } } }]);
    res.json({ orders, attention, totals: agg[0] || { sales: 0, cost: 0, profit: 0, count: 0 } });
  });
  app.get('/api/admin/market4/orders/:id/keys', anyAdminAuth, async (req, res) => {
    const o = await Market4Order.findById(req.params.id).lean().catch(() => null);
    if (!o) return res.status(404).json({ error: 'Order not found' });
    res.json({ keys: o.keys || [], status: o.status, userEmail: o.userEmail });
  });
  // Deliver keys by hand (e.g. copied from the the provider order history).
  app.post('/api/admin/market4/orders/:id/deliver', anyAdminAuth, async (req, res) => {
    try {
      const raw = Array.isArray(req.body?.keys) ? req.body.keys : String(req.body?.keys || '').split(/\r?\n/);
      const keys = raw.map(toKeyText).filter(Boolean);
      if (!keys.length) return res.status(400).json({ error: 'Paste at least one key (one per line).' });
      const o = await Market4Order.findById(req.params.id);
      if (!o) return res.status(404).json({ error: 'Order not found' });
      if (o.refunded) return res.status(400).json({ error: 'This order was already refunded.' });
      if (o.status === 'delivered' && o.deliverySynced) return res.status(400).json({ error: 'This order was already delivered.' });
      const costTotal = Number(req.body?.costTotal) > 0 ? Number(req.body.costTotal) : (o.costTotal || 0);
      await Market4Order.updateOne({ _id: o._id }, { $set: { status: 'delivered', keys, costTotal, profit: o.sellTotal - costTotal, note: 'Delivered manually by admin.', updatedAt: new Date() } });
      await deliverToUser(o._id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/admin/market4/orders/:id/refund', anyAdminAuth, async (req, res) => {
    try {
      const o = await Market4Order.findById(req.params.id);
      if (!o) return res.status(404).json({ error: 'Order not found' });
      if (o.status === 'delivered' && o.deliverySynced) return res.status(400).json({ error: 'The customer already received this order.' });
      if (!o.debited) return res.status(400).json({ error: 'This customer was never charged for this order.' });
      const ok = await refundOrder(o._id, o.sellTotal, 'Refunded by admin.', 'refunded');
      if (!ok) return res.status(400).json({ error: 'Already refunded.' });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/admin/market4/orders/:id/resync', anyAdminAuth, async (req, res) => {
    try { res.json({ ok: await deliverToUser(req.params.id) }); } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

module.exports = { register };
