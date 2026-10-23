// Fixes "Cannot read properties of undefined (reading 'join')" in Admin > Product logos.
// Cause: the old logo system (lib/brand-logos.js, needs Cloudinary) and the new one
// (lib/king-upgrade.js, stores logos in the database) both answer /api/admin/brand-logos,
// and the old one wins with the wrong data format.
// This switches the old one off so the new Product logos screen works.
//
// Run from the project root:   node fix-logo-clash.js
// Then:  git add -A && git commit -m "Fix product logos" && git push
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'lib', 'brand-logos.js');
if (!fs.existsSync(file)) { console.error('Cannot find lib/brand-logos.js - run this from the project root folder.'); process.exit(1); }
let src = fs.readFileSync(file, 'utf8');

const MARK = 'KSH-LOGO-CLASH-FIX';
if (src.includes(MARK)) { console.log('Already applied - nothing to do.'); process.exit(0); }

const find = "module.exports.register = function registerBrandLogos({ app, mongoose, adminAuth, cloudinary, cloudinaryConfigured }) {\n";
const first = src.indexOf(find);
if (first === -1 || src.indexOf(find, first + 1) !== -1) {
  console.error('Could not safely patch lib/brand-logos.js. No files were changed.');
  process.exit(1);
}
const repl = find +
  "  // " + MARK + ": logos are now handled by lib/king-upgrade.js. Registering the old\n" +
  "  // routes here made them clash with the new Product logos screen, so they are off.\n" +
  "  if (process.env.USE_LEGACY_BRAND_LOGOS !== 'true') return { brandLogoFor: async () => '' };\n";
src = src.slice(0, first) + repl + src.slice(first + find.length);

fs.writeFileSync(file + '.bak-before-logofix', fs.readFileSync(file));
fs.writeFileSync(file, src);
console.log('Done. Updated lib/brand-logos.js (backup: lib/brand-logos.js.bak-before-logofix)');
console.log('Next: git add -A && git commit -m "Fix product logos" && git push');