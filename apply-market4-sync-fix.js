// Fixes Marketplace 4 sync so it pulls EVERY product (Instagram, TikTok, etc.), not just the first page.
// Run from the project root:   node apply-market4-sync-fix.js
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'lib', 'market4.js');
if (!fs.existsSync(file)) { console.error('Cannot find lib/market4.js - run this from the project root folder.'); process.exit(1); }

let s = fs.readFileSync(file, 'utf8');
if (s.includes('Walk every page until the provider has nothing new')) { console.log('Already applied - nothing to do.'); process.exit(0); }

const startMarker = "      const d = await rawCall('get', '/catalog/logs', { timeout: opts.timeout });";
const endMarker = "      return { count: rows.length, results: rows };";
const a = s.indexOf(startMarker);
const b = a === -1 ? -1 : s.indexOf(endMarker, a);
if (a === -1 || b === -1) { console.error('Could not find the block to replace in lib/market4.js. No changes made.'); process.exit(1); }

const replacement = `      // NovaSolution pages its logs catalogue, so one request only returns the first batch (which is why
      // only Facebook showed up). Walk every page until the provider has nothing new to give.
      const unwrapPage = (d) => (d && d.data && typeof d.data === 'object' && !Array.isArray(d.data)) ? d.data : (d || {});
      const rowsOfPage = (d) => {
        const u = unwrapPage(d);
        if (Array.isArray(u.products)) return u.products;
        if (Array.isArray(u.items)) return u.items;
        if (Array.isArray(u.results)) return u.results;
        if (Array.isArray(d && d.data)) return d.data;
        if (Array.isArray(d)) return d;
        return [];
      };
      const fetchLogsPage = async (page, withPerPage) => {
        for (let attempt = 0; ; attempt++) {
          try { return await rawCall('get', '/catalog/logs', { timeout: opts.timeout, params: withPerPage ? { page, per_page: 100 } : { page } }); }
          catch (e) { if (e.status === 429 && attempt < 3) { await sleep(Math.min(30, 5 * (attempt + 1)) * 1000); continue; } throw e; }
        }
      };
      let rawRows = [];
      const catNames = new Set();
      const seenIds = new Set();
      let withPerPage = true;
      for (let pg = 1; pg <= 200; pg++) {
        let d;
        try { d = await fetchLogsPage(pg, withPerPage); }
        catch (e) {
          // Some providers reject per_page - retry the first page without it.
          if (withPerPage && pg === 1 && e.status >= 400 && e.status < 500 && ![401, 402, 403, 429].includes(e.status)) { withPerPage = false; d = await fetchLogsPage(pg, false); }
          else throw e;
        }
        const u = unwrapPage(d);
        (Array.isArray(u.categories) ? u.categories : []).forEach(c => { const n = String(c && c.name != null ? c.name : c).trim(); if (n) catNames.add(n); });
        const batch = rowsOfPage(d);
        let added = 0;
        for (const r of batch) {
          const id = r && r.id;
          if (id == null || seenIds.has(String(id))) continue;
          seenIds.add(String(id)); rawRows.push(r); added++;
        }
        const meta = u.pagination || (d && d.pagination) || u.meta || (d && d.meta) || {};
        const cur = Number(meta.current_page ?? meta.page), last = Number(meta.last_page ?? meta.total_pages ?? meta.pages);
        const flagged = !!(u.has_more || (d && d.has_more) || u.next_page || (d && d.next_page) || meta.has_more || u.next || (d && d.next));
        const byMeta = Number.isFinite(cur) && Number.isFinite(last) ? cur < last : null;
        // Stop when a page adds nothing new, or the provider says this was the last page.
        if (!added || !batch.length) break;
        if (byMeta === false) break;
        if (byMeta === null && !flagged && batch.length < 20) break;
      }
      const cats = [...catNames];
      const rows = rawRows.map(p => {
        const name = String(p.name || 'Account');
        const catField = (p.category && typeof p.category === 'object') ? p.category.name : p.category;
        const own = String(catField || p.category_name || p.platform || '').trim();
        const guess = cats.find(c => name.toLowerCase().includes(c.toLowerCase()));
        const minor = Number(p.price_minor);
        return { id: p.id, name, category_name: own || guess || 'Other', price: Number.isFinite(minor) ? minor / 100 : Number(p.price) || 0, stock: Number(p.stock) || 0, in_stock: (Number(p.stock) || 0) > 0, picture: p.picture || p.image || p.image_url || '' };
      });
`;

fs.copyFileSync(file, file + '.bak-before-sync-fix');
s = s.slice(0, a) + replacement + s.slice(b);
fs.writeFileSync(file, s, 'utf8');
console.log('Done. lib/market4.js updated (backup saved as lib/market4.js.bak-before-sync-fix).');