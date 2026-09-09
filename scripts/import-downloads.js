/* One-time import: copies Downloads folders into public/uploads + replaces DB content.
   Run: node scripts/import-downloads.js
   Safe to re-run (idempotent — clears target types first). */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DL = 'C:\\Users\\USER\\Downloads';
const UPLOADS = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

function copyFile(srcName, folder, destName) {
  const src = path.join(DL, folder, srcName);
  const dest = path.join(UPLOADS, destName);
  if (!fs.existsSync(src)) { console.warn('MISSING:', src); return null; }
  fs.copyFileSync(src, dest);
  const kb = Math.round(fs.statSync(dest).size / 1024);
  console.log(`copied ${destName} (${kb} KB)`);
  return '/uploads/' + destName;
}

const db = new DatabaseSync(path.join(__dirname, '..', 'data.db'));

// ── 1. Stores Built for Conversion → media(portfolio) ──
const stores = [
  ['file_000000000a4481f5b04a6bd79d877337.png', 'store-luxe-accessories.png', 'LUXEORA — Luxury Accessories · mobile-first, trust-engineered storefront', 'Luxury Accessories', 'Luxury accessories storefront built for conversion'],
  ['file_00000000aa9c82438362c29da10d5f66.png', 'store-eco-beauty.png', 'Eco-Beauty — 3.2× ROAS on launch week', 'Eco-Beauty', 'Eco beauty brand store'],
  ['file_00000000abfc81f491c88f9993b1b316.png', 'store-tech-gadgets.png', 'Tech Gadgets — 4.8★ from 320+ verified reviews', 'Tech Gadgets', 'Tech gadgets store'],
  ['file_00000000b68c81f486c7f2042e5db1fb.png', 'store-fitness-gear.png', 'Fitness Gear — 41% repeat purchase rate', 'Fitness Gear', 'Fitness gear store'],
  ['file_00000000b8cc81f58a5dc58c7e288e61.png', 'store-fashion-essentials.png', 'Fashion Essentials — high-AOV bundles & upsell funnels', 'Fashion', 'Fashion essentials store'],
  ['file_00000000d5f881f4839e41a95e343c53.png', 'store-home-living.png', 'Home & Living — product pages engineered for trust', 'Home & Living', 'Home and living store'],
];
db.exec(`DELETE FROM media WHERE type = 'portfolio'`);
const insMedia = db.prepare(`INSERT INTO media (type, url, caption, category, alt_text, "order", published) VALUES (?, ?, ?, ?, ?, ?, 1)`);
stores.forEach((s, i) => {
  const url = copyFile(s[0], 'Stores Built for Conversion', s[1]);
  if (url) insMedia.run('portfolio', url, s[2], s[3], s[4], i);
});

// ── 2. Real Revenue. Real Stores. Real Proof → media(sales_proof) ──
const proofs = [
  ['images.jfif', 'proof-dashboard-1.jpg', 'Store dashboard — verified revenue screenshot', 'Dashboard', 'Revenue dashboard screenshot'],
  ['WhatsApp Image 2026-08-27 at 1.20.43 PM.jpeg', 'proof-payout-1.jpg', 'Payout receipt — Store #042, settled to founder account', 'Payout', 'Payout receipt screenshot'],
  ['WhatsApp Image 2026-09-09 at 10.33.53 PM.jpeg', 'proof-roas-1.jpg', 'Ad account — 4.1× ROAS on launch campaign', 'ROAS', 'Ads dashboard screenshot'],
];
db.exec(`DELETE FROM media WHERE type = 'sales_proof'`);
proofs.forEach((s, i) => {
  const url = copyFile(s[0], 'Real Revenue. Real Stores. Real Proof', s[1]);
  if (url) insMedia.run('sales_proof', url, s[2], s[3], s[4], i);
});

// ── 3. What Founders Say (videos, playable) → media(testimonials) ──
const vids = [
  ['0826(2).mp4', 'founder-review-1.mp4', 'Video review — founder walks through launch results and first-month sales', 'Video Review', 'Founder video testimonial 1'],
  ['VID-20260805-WA0002.mp4', 'founder-review-2.mp4', 'Video review — from application to live store in 12 days', 'Video Review', 'Founder video testimonial 2'],
  ['VID-20260812-WA0001.mp4', 'founder-review-3.mp4', 'Video review — why this founder trusts WAYWEALTH with their brand', 'Video Review', 'Founder video testimonial 3'],
];
db.exec(`DELETE FROM media WHERE type = 'testimonials'`);
vids.forEach((s, i) => {
  const url = copyFile(s[0], 'What Founders Say', s[1]);
  if (url) insMedia.run('testimonials', url, s[2], s[3], s[4], i);
});

// ── 4. Meet the Experts → team (photos replaced, names/roles kept — editable in admin) ──
const experts = [
  ['WhatsApp Image 2026-09-01 at 10.52.54 PM.jpeg', 'expert-1.jpg'],
  ['WhatsApp Image 2026-09-01 at 11.08.34 PM.jpeg', 'expert-2.jpg'],
  ['WhatsApp Image 2026-09-01 at 11.08.36 PM.jpeg', 'expert-3.jpg'],
  ['WhatsApp Image 2026-09-01 at 11.11.01 PM.jpeg', 'expert-4.jpg'],
];
const teamSeed = [
  ['Victory Owabor', 'Founder & Venture Lead', 'Led 60+ store launches across 4 niches', '', 0],
  ['Sarah Chen', 'Head of Conversion Design', 'Ex-Shopify Plus, 120+ storefronts optimized', '', 1],
  ['David Okafor', 'Product Research Lead', 'Validated 400+ products, 3.4× avg. hit rate', '', 2],
  ['Priya Patel', 'Fulfillment & Ops', 'Vetted 50+ suppliers, 5–7 day avg. delivery', '', 3],
];
db.exec(`DELETE FROM team`);
const insTeam = db.prepare(`INSERT INTO team (name, role, credibility_note, photo_url, social_url, "order", published) VALUES (?, ?, ?, ?, '', ?, 1)`);
experts.forEach((e, i) => {
  const url = copyFile(e[0], 'Meet the Experts Behind Every Build', e[1]) || '';
  const t = teamSeed[i] || [`Expert ${i + 1}`, 'WAYWEALTH Specialist', '', '', i];
  insTeam.run(t[0], t[1], t[2], url, t[4]);
});

// ── 5. Certificates AND Awards → certificates ──
const certs = [
  ['WhatsApp Image 2026-09-08 at 10.46.15 PM.jpeg', 'cert-verified-launch-1.jpg', 'Verified Store Launch', 'WAYWEALTH Studio', 'Client store launched, verified live — full ownership handed over with 30-day scaling roadmap.', 'Verified Launch', 0],
  ['WhatsApp Image 2026-09-08 at 10.57.38 PM.jpeg', 'cert-excellence-award.jpg', 'E-Commerce Excellence Award', 'WAYWEALTH Studio', 'Recognized for high-converting storefront design across 100+ launches.', 'Award', 1],
];
db.exec(`DELETE FROM certificates`);
const insCert = db.prepare(`INSERT INTO certificates (title, issuer, description, image_url, category, "order", published) VALUES (?, ?, ?, ?, ?, ?, 1)`);
certs.forEach((c) => {
  const url = copyFile(c[0], 'Certificates AND Awards', c[1]);
  if (url) insCert.run(c[2], c[3], c[4], url, c[5], c[6]);
});

// ── 6. Logo → site_logo + site_favicon (editable anytime in Admin → Branding) ──
const logoUrl = copyFile('WhatsApp Image 2026-08-21 at 3.24.33 PM.jpeg', 'logo', 'logo.jpg');
if (logoUrl) {
  const up = db.prepare(`INSERT INTO content (key, value, section) VALUES (?, ?, 'meta') ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`);
  up.run('site_logo', logoUrl);
  up.run('site_favicon', logoUrl);
  console.log('logo + favicon set to', logoUrl);
}

// ── 7. Necessary section copy updates ──
const sectionCopy = [
  ['portfolio_headline', 'Stores Built for Conversion'],
  ['portfolio_subhead', 'Every store is mobile-first, trust-engineered, and built to lift AOV from day one.'],
  ['proof_headline', 'Real Revenue. Real Stores. Real Proof.'],
  ['proof_subhead', 'Dashboard screenshots, payout receipts and ad-account results from stores launched through WAYWEALTH. No stock photos.'],
  ['experts_headline', 'Meet the Experts Behind Every Build'],
  ['experts_subhead', 'Specialists in product research, conversion design, and fulfillment — one team, one outcome.'],
  ['certificates_headline', 'Certificates & Awards'],
  ['certificates_subhead', 'Verified launches and industry recognition — proof we deliver what we promise.'],
  ['testimonials_headline', 'What Founders Say'],
  ['testimonials_subhead', 'Unscripted video reviews from founders — tap play to watch their launch stories.'],
];
const upC = db.prepare(`INSERT INTO content (key, value, section) VALUES (?, ?, 'general') ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`);
for (const [k, v] of sectionCopy) upC.run(k, v);

console.log('\nIMPORT DONE. Counts:');
for (const t of ['media', 'team', 'certificates']) {
  console.log(' ', t, db.prepare(`SELECT COUNT(*) as c FROM "${t}"`).get().c);
}
db.close();
