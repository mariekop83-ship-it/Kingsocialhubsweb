// Boost 2 — second SMM provider (admin-configured). Credentials remain server-side (NOVA_API_KEY).
const axios = require('axios');
const crypto = require('crypto');
module.exports = function registerNovaBoost2({ app, mongoose, User, Transaction, auth, anyAdminAuth, novaGate }) {
  const base = () => String(process.env.NOVA_BASE_URL || 'https://www.novasolution.ng/api/v1').replace(/\/+$/, '');
  const key = () => String(process.env.NOVA_API_KEY || '').trim();
  const schema = new mongoose.Schema({ itemId: {type:Number,unique:true,index:true}, sellPrice:{type:Number,default:0}, markup:{type:Number,default:0}, mode:{type:String,enum:['specific','markup'],default:'markup'}, enabled:{type:Boolean,default:true}, updatedAt:{type:Date,default:Date.now} });
  const Price = mongoose.models.NovaBoost2Price || mongoose.model('NovaBoost2Price', schema);
  const ordersSchema = new mongoose.Schema({ userId:mongoose.Schema.Types.ObjectId, itemId:Number, itemName:String, quantity:Number, link:String, providerOrder:String, idempotencyKey:{type:String,index:true}, status:String, reviewNote:String, cost:Number, sellTotal:Number, createdAt:{type:Date,default:Date.now} });
  const Order = mongoose.models.NovaBoost2Order || mongoose.model('NovaBoost2Order', ordersSchema);
  async function api(method,path,data,params,extraHeaders={}) {
    if (!key()) { const e=new Error('Boost 2 is not set up yet. Please contact the administrator.'); e.status=503; throw e; }
    if (typeof novaGate === 'function') await novaGate();
    const r=await axios({method,url:base()+path,data,params,timeout:30000,headers:{Authorization:`Bearer ${key()}`,Accept:'application/json','Content-Type':'application/json',...(method==='post'?{'Idempotency-Key':crypto.randomUUID()}:{}),...(extraHeaders||{})}});
    return r.data;
  }
  const unwrap = d => (d && d.data && typeof d.data === 'object' && !Array.isArray(d.data)) ? d.data : (d || {});
  const rowsOf = d => { const u = unwrap(d); for (const k of ['services','items','products','results']) if (Array.isArray(u[k])) return u[k]; if (Array.isArray(d?.data)) return d.data; if (Array.isArray(d)) return d; return []; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Retries politely when the provider answers "too many requests".
  async function apiRetry(...args) {
    for (let attempt = 0; ; attempt++) {
      try { return await api(...args); }
      catch (e) { if (e.response && e.response.status === 429 && attempt < 3) { await sleep(Math.min(65, Number(e.response.headers?.['retry-after']) || 20) * 1000); continue; } throw e; }
    }
  }
  async function fetchPage(page, withPerPage) {
    return apiRetry('get','/catalog/smm',null, withPerPage ? {page,per_page:80} : {page});
  }
  async function fetchAllProducts() {
    const products=[]; let page=1, more=true, withPerPage=true;
    while(more && page<=100) {
      let d;
      try { d = await fetchPage(page, withPerPage); }
      catch(e) {
        if (withPerPage && page===1 && e.response && e.response.status>=400 && e.response.status<500 && ![401,403,429].includes(e.response.status)) { withPerPage=false; d = await fetchPage(page,false); }
        else throw e;
      }
      products.push(...rowsOf(d));
      const u = unwrap(d); more = !!(u.has_more || d?.has_more || u.next_page || d?.meta?.has_more); page++;
    }
    return products;
  }
  // The provider list is stored in our database. Customers never trigger a provider call just by
  // opening the page; it is re-pulled on admin sync, on a customer Refresh (30s cooldown), or when
  // nothing is stored yet. If a re-pull fails, the previously stored list stays available.
  const cacheSchema = new mongoose.Schema({ key:{type:String,unique:true}, products:{type:mongoose.Schema.Types.Mixed,default:[]}, syncedAt:Date, error:{type:String,default:''} },{minimize:false});
  const Cache = mongoose.models.NovaBoost2Cache || mongoose.model('NovaBoost2Cache', cacheSchema);
  let inflight = null;
  // In-memory copy so a customer request never waits on the database or the provider.
  let mem = null; const MEM_MS = 5 * 60 * 1000;
  async function loadProducts(refresh=false) {
    if (!refresh && mem && Date.now() - mem.at < MEM_MS) return mem.val;
    const val = await loadProductsDb(refresh);
    if (val && Array.isArray(val.products) && val.products.length) mem = { at: Date.now(), val };
    return val;
  }
  async function loadProductsDb(refresh=false) {
    const doc = await Cache.findOne({key:'smm'}).lean();
    const age = doc?.syncedAt ? Date.now()-new Date(doc.syncedAt).getTime() : Infinity;
    if (doc && Array.isArray(doc.products) && doc.products.length && !(refresh && age>30000)) return {products:doc.products, syncedAt:doc.syncedAt, stale:false};
    if (!inflight) inflight = fetchAllProducts().then(async products=>{ const syncedAt=new Date(); await Cache.updateOne({key:'smm'},{$set:{products,syncedAt,error:''}},{upsert:true}); return {products,syncedAt,stale:false}; }).finally(()=>{inflight=null;});
    try { return await inflight; }
    catch(e) {
      const st=e.response?.status, pm=e.response?.data?.message||e.response?.data?.error||e.message;
      console.error('[boost2] catalogue pull failed:',st,pm);
      if (doc && Array.isArray(doc.products) && doc.products.length) { Cache.updateOne({key:'smm'},{$set:{error:String(pm||'').slice(0,300)}}).catch(()=>{}); return {products:doc.products, syncedAt:doc.syncedAt, stale:true, error:pm}; }
      throw e;
    }
  }
  // Warm the list shortly after the server starts and keep it fresh in the background,
  // so the first customer to open Boost 2 sees services immediately.
  setTimeout(() => { loadProducts(false).catch(() => {}); }, 4000);
  setInterval(() => { loadProducts(true).catch(() => {}); }, 30 * 60 * 1000);
  const friendly = e => e.response?.status===429 ? 'The provider is limiting requests right now (60 per minute). Please wait a minute and try again. Your saved list is unaffected.' : String(e.response?.data?.message||e.message||'').replace(/nova\s*solution|novasolution|nova/ig,'the provider');
  async function catalogue(refresh=false) {
    const {products, syncedAt, stale} = await loadProducts(refresh);
    const prices=await Price.find({}).lean(); const pm=new Map(prices.map(p=>[Number(p.itemId),p]));
    const costOf = p => { const m=Number(p.price_minor); if (Number.isFinite(m)) return m/100; const x=Number(p.price ?? p.rate ?? p.cost); return Number.isFinite(x)?x:0; };
    const list = products.map(p=>{const cfg=pm.get(Number(p.id))||{};const cost=costOf(p);const sell=cfg.mode==='specific'?Number(cfg.sellPrice)||0:cost+(Number(cfg.markup)||0);return {id:Number(p.id),name:p.name||`Service ${p.id}`,category:p.category||'Social boosting',min:Number(p.min_qty ?? p.min)||1,max:Number(p.max_qty ?? p.max)||100000, cost,price:sell,enabled:cfg.enabled!==false,priced:sell>0};});
    list.syncedAt = syncedAt; list.stale = stale;
    return list;
  }
  app.get('/api/boost2/services',auth,async(req,res)=>{res.set('Cache-Control','no-store');if(!key())return res.json({enabled:false,services:[],message:'Boost 2 is not available yet. Please contact the administrator.'});try{const list=await catalogue(String(req.query.refresh||'')==='1');res.json({enabled:true,syncedAt:list.syncedAt,stale:!!list.stale,services:list.filter(x=>x.enabled&&x.priced)});}catch(e){const st=e.response?.status;const pm=e.response?.data?.message||e.response?.data?.error||e.message;console.error('[boost2] catalogue failed:',st,pm);res.status(502).json({error:'Could not load Boost 2 services right now. Please try again shortly.',detail:st===429?'The provider is busy (rate limit). Please try again in a minute.':(st?`Error ${st}: `:'')+String(pm||'').slice(0,160).replace(/nova\s*solution|novasolution|nova/ig,'the provider')});}});
  app.post('/api/boost2/orders',auth,async(req,res)=>{
    let order=null, user=null, charged=0, providerCallStarted=false, providerAccepted=false;
    try {
      const id=Number(req.body?.serviceId),qty=Number(req.body?.quantity),link=String(req.body?.link||'').trim();
      if(!Number.isInteger(id)||id<=0||!Number.isInteger(qty)||qty<1||!/^https?:\/\//i.test(link)) return res.status(400).json({error:'Choose a service, valid quantity, and public http(s) link.'});
      const s=(await catalogue(false)).find(x=>x.id===id&&x.enabled&&x.priced);
      if(!s) return res.status(404).json({error:'Service unavailable.'});
      if(qty<s.min||qty>s.max) return res.status(400).json({error:`Quantity must be between ${s.min} and ${s.max}.`});
      // Round the customer total and provider cost to currency precision before charging.
      const total=Math.round((s.price*qty/1000)*100)/100;
      if(!Number.isFinite(total)||total<=0||!Number.isFinite(s.cost)||s.cost<0) return res.status(400).json({error:'Invalid service price. No charge was made.'});
      // Persist an order record before debit/provider calls so an interrupted request can be reconciled.
      const idempotencyKey=crypto.randomUUID();
      order=await Order.create({userId:req.user._id,itemId:id,itemName:s.name,quantity:qty,link,providerOrder:'',idempotencyKey,status:'pending',cost:Math.round((s.cost*qty/1000)*100)/100,sellTotal:total});
      user=await User.findOneAndUpdate({_id:req.user._id,balance:{$gte:total}},{$inc:{balance:-total}},{new:true});
      if(!user){await Order.updateOne({_id:order._id},{$set:{status:'failed',reviewNote:'Insufficient balance; provider was not called.'}});return res.status(400).json({error:'Insufficient wallet balance.'});}
      charged=total;
      let d;
      providerCallStarted=true;
      try {
        d=await api('post','/orders',{type:'smm',item_id:id,quantity:qty,payload:{link}},undefined,{'Idempotency-Key':idempotencyKey});
        providerAccepted=true;
      } catch(e) {
        const status=Number(e.response?.status||e.status||0);
        // A timeout/network drop/5xx means Nova may already have created and charged the order.
        // Never refund automatically in this case; hold the debit and flag it for reconciliation.
        const ambiguous=!e.response || status===408 || status>=500;
        if(ambiguous){
          const note=`Provider outcome unclear (HTTP ${status||'no response'}): ${String(e.message||'unknown error').slice(0,220)}. Check NovaSolution orders using the same Idempotency-Key before refunding.`;
          await Order.updateOne({_id:order._id},{$set:{status:'review',reviewNote:note}}).catch(()=>{});
          console.error(`[BOOST2-REVIEW] order=${order._id} user=${user._id} amount=${total} idempotencyKey=${idempotencyKey} ${note}`);
          return res.status(202).json({ok:true,pending:true,orderId:String(order._id),message:'Your order is being verified because the provider did not confirm the result. Your balance is on hold; please do not order again yet.'});
        }
        // Definite provider rejection: refund exactly once using an atomic order-state claim.
        const claim=await Order.findOneAndUpdate({_id:order._id,status:'pending'},{$set:{status:'refunding',reviewNote:`Provider rejected order (HTTP ${status}).` }},{new:true});
        if(claim){
          try {
            await User.updateOne({_id:user._id},{$inc:{balance:total}});
          } catch(refundErr) {
            await Order.updateOne({_id:order._id},{$set:{status:'review',reviewNote:`Provider rejected order but wallet refund failed: ${String(refundErr.message||refundErr).slice(0,220)}`}}).catch(()=>{});
            console.error(`[BOOST2-REFUND-REVIEW] order=${order._id} user=${user._id} amount=${total}:`,refundErr.message);
            return res.status(202).json({ok:true,pending:true,orderId:String(order._id),message:'The provider rejected the order. Your refund is being processed; contact support if your balance is not restored shortly.'});
          }
          // Wallet credit succeeded. Mark refunded before the best-effort ledger entry, so a ledger outage cannot trigger a second refund.
          await Order.updateOne({_id:order._id,status:'refunding'},{$set:{status:'refunded',reviewNote:'Provider rejection confirmed; wallet refunded.'}});
          charged=0;
          await Transaction.create({userId:user._id,type:'refund',amount:total,description:`Boost 2 refund — ${s.name}`,status:'success'}).catch(logErr=>console.error('[BOOST2] refund ledger entry failed for order',String(order._id),logErr.message));
        }
        return res.status(400).json({error:'The provider rejected this order. Your wallet was refunded.'});
      }
      const root=unwrap(d); const ord=root.order||d.order||root;
      const providerOrder=String(ord.number||ord.order_number||ord.id||'');
      // Supplier accepted: mark this before any ancillary writes. Never refund due to a later DB/log error.
      await Order.updateOne({_id:order._id},{$set:{providerOrder,status:String(ord.status||'processing'),reviewNote:''}});
      try { await Transaction.create({userId:user._id,type:'purchase',amount:total,description:`Boost 2 — ${s.name}`,status:'success'}); }
      catch(logErr){ console.error(`[BOOST2-LEDGER-REVIEW] provider accepted order=${order._id} amount=${total}:`,logErr.message); }
      res.json({ok:true,order:providerOrder||null,status:ord.status||'processing',amountPaid:total,balance:user.balance});
    } catch(e) {
      // Crucial: once the provider request has started, the result may be ambiguous. Do not blindly refund.
      if(charged && user?._id && !providerCallStarted){
        try { await User.updateOne({_id:user._id},{$inc:{balance:charged}}); await Order.updateOne({_id:order?._id},{$set:{status:'refunded',reviewNote:'Local failure before provider call; automatic refund issued.'}}); charged=0; }
        catch(refundErr){ console.error('[BOOST2] pre-provider refund failed:',refundErr.message); }
      } else if(charged && order?._id && providerCallStarted) {
        await Order.updateOne({_id:order._id,status:'pending'},{$set:{status:'review',reviewNote:`Provider may have accepted the order; do not refund until reconciled. ${String(e.message||e).slice(0,200)}`}}).catch(()=>{});
      }
      console.error('[boost2] order handler error:',e.message);
      if(!res.headersSent) res.status(e.status||502).json({error:providerCallStarted?'Order status is being checked. Please do not retry yet.':'Boost order failed before submission; no provider order was placed.'});
    }
  });
  app.get('/api/admin/boost2/services',anyAdminAuth,async(req,res)=>{try{res.json(await catalogue(String(req.query.refresh||'')==='1'));}catch(e){res.status(502).json({error:'Could not load the service list: '+friendly(e)});}});
  app.post('/api/admin/boost2/sync',anyAdminAuth,async(req,res)=>{try{const list=await catalogue(true);res.json({ok:true,count:list.length,stale:!!list.stale,syncedAt:list.syncedAt,message:list.stale?'Provider could not be reached; the previously stored list was kept.':`Synced ${list.length} services.`});}catch(e){res.status(502).json({error:'Sync failed: '+friendly(e)});}});
  app.put('/api/admin/boost2/services/:id',anyAdminAuth,async(req,res)=>{const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)return res.status(400).json({error:'Invalid service ID'});const b=req.body||{},set={updatedAt:new Date()};if(b.mode!==undefined){if(!['specific','markup'].includes(b.mode))return res.status(400).json({error:'Mode must be specific or markup'});set.mode=b.mode;}for(const k of ['sellPrice','markup'])if(b[k]!==undefined){const n=Number(b[k]);if(!Number.isFinite(n)||n<0)return res.status(400).json({error:`${k} must be zero or greater`});set[k]=n;}if(typeof b.enabled==='boolean')set.enabled=b.enabled;await Price.updateOne({itemId:id},{$set:{itemId:id,...set}},{upsert:true});res.json({ok:true});});
};
