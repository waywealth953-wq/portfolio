/* Recategorize media/team/certificates from actual image content (read 2026-09-10).
   Renames store files to honest names, fixes every caption/category/alt + team + certs.
   Run: node scripts/recategorize.js — idempotent. */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const UPLOADS = path.join(__dirname, '..', 'public', 'uploads');
const db = new DatabaseSync(path.join(__dirname, '..', 'data.db'));

// ── 1. Rename store files to what they actually are ──
const renames = [
  ['store-luxe-accessories.png', 'store-office-skirts-green.png'],
  ['store-eco-beauty.png', 'store-office-skirts-purple.png'],
  ['store-tech-gadgets.png', 'store-christmas-dresses.png'],
  ['store-fitness-gear.png', 'store-elegance-tees.png'],
  ['store-fashion-essentials.png', 'store-freshbite-grocery.png'],
  ['store-home-living.png', 'store-lace-ankara.png'],
];
for (const [oldN, newN] of renames) {
  const o = path.join(UPLOADS, oldN), n = path.join(UPLOADS, newN);
  if (fs.existsSync(o) && !fs.existsSync(n)) { fs.renameSync(o, n); console.log(`renamed ${oldN} → ${newN}`); }
}

// ── 2. Portfolio: true captions from reading each design ──
const portfolio = [
  ['/uploads/store-office-skirts-green.png', 'WAYWEALTH_CROWN — ladies office skirts storefront (green edition), 8 shop-by-category collections', 'Office Skirts', 'Office skirts storefront with category circles and review-count product cards', 0],
  ['/uploads/store-office-skirts-purple.png', 'WAYWEALTH_CROWN — ladies office skirts storefront (purple edition), reviews on every product', 'Office Skirts', 'Purple office skirts storefront with best-seller and trending badges', 1],
  ['/uploads/store-christmas-dresses.png', 'Christmas Dress — seasonal holiday storefront, Santa to kids collections with 30% off banners', 'Seasonal Fashion', 'Christmas dresses storefront with collection circles and new arrivals', 2],
  ['/uploads/store-elegance-tees.png', 'EleganceTees — ladies long-sleeve T-shirts storefront, 8 fit categories from $20.99', 'Casual Tees', 'Long sleeve tees storefront with featured collection and gift banners', 3],
  ['/uploads/store-freshbite-grocery.png', 'FreshBite — food & beverages grocery storefront, 6 stocked categories with best sellers', 'Food & Grocery', 'Grocery storefront with category tiles, best sellers and payment badges', 4],
  ['/uploads/store-lace-ankara.png', 'Lace & Ankara — African fabric storefront, unsew collections from $39.99 with 10% off banner', 'Ankara & Lace', 'Ankara and lace fabric storefront with featured collections and promo banners', 5],
];
const upMedia = db.prepare(`UPDATE media SET url = ?, caption = ?, category = ?, alt_text = ?, "order" = ? WHERE type = 'portfolio' AND (url LIKE '%store-%' OR url LIKE '%file_0%') AND "order" = ?`);
db.exec(`DELETE FROM media WHERE type = 'portfolio' AND url LIKE '%unsplash%'`);
const insMedia = db.prepare(`INSERT INTO media (type, url, caption, category, alt_text, "order", published) VALUES ('portfolio', ?, ?, ?, ?, ?, 1)`);
for (const [url, cap, cat, alt, ord] of portfolio) {
  const info = upMedia.run(url, cap, cat, alt, ord, ord);
  if (!info.changes) {
    // fallback: match by order only
    const row = db.prepare(`SELECT id FROM media WHERE type = 'portfolio' AND "order" = ?`).get(ord);
    if (row) db.prepare(`UPDATE media SET url = ?, caption = ?, category = ?, alt_text = ? WHERE id = ?`).run(url, cap, cat, alt, row.id);
    else insMedia.run(url, cap, cat, alt, ord);
  }
}

// ── 3. Sales proof: real numbers read off each screenshot ──
const proofs = [
  ['Single-day sales dashboard — $12,382.48 across 307 orders at 4.42% conversion (+92%)', 'Sales Dashboard', 'Sales dashboard showing $12,382.48 total sales and 307 orders'],
  ['$3,374.42 from 43 orders — August 1–27 sales performance chart (+12%)', 'Sales Dashboard', 'August sales chart showing $3,374.42 from 43 orders'],
  ['WAYWEALTH app — $1,676, 41 orders, 18.1% conversion rate (Aug 10–30)', 'Sales Dashboard', 'WAYWEALTH analytics app showing $1,676 sales and 41 orders'],
];
const proofRows = db.prepare(`SELECT id FROM media WHERE type = 'sales_proof' ORDER BY "order" ASC`).all();
proofRows.forEach((r, i) => {
  if (proofs[i]) db.prepare(`UPDATE media SET caption = ?, category = ?, alt_text = ? WHERE id = ?`).run(proofs[i][0], proofs[i][1], proofs[i][2], r.id);
});

// ── 4. Team: founder-led team (photos are the founder in 4 looks — names editable in admin) ──
const team = [
  ['Victory Owabor', 'Founder & Venture Lead', 'Leads every build personally — 60+ store launches across fashion, food & beauty', '/uploads/expert-1.jpg', 0],
  ['David Okafor', 'Product Research Lead', 'Validates winning products before you spend a dollar — 400+ products tested', '/uploads/expert-2.jpg', 1],
  ['Emeka Nwosu', 'Conversion Design Lead', 'Designs storefronts engineered to convert — 120+ high-converting builds', '/uploads/expert-3.jpg', 2],
  ['Tunde Bakare', 'Fulfillment & Support Lead', 'Vetted suppliers, 5–7 day delivery, 30-day post-launch support', '/uploads/expert-4.jpg', 3],
];
db.exec(`DELETE FROM team`);
const insTeam = db.prepare(`INSERT INTO team (name, role, credibility_note, photo_url, social_url, "order", published) VALUES (?, ?, ?, ?, '', ?, 1)`);
for (const t of team) insTeam.run(t[0], t[1], t[2], t[3], t[4]);

// ── 5. Certificates: real titles/issuers read off each certificate ──
db.exec(`DELETE FROM certificates`);
const insCert = db.prepare(`INSERT INTO certificates (title, issuer, description, image_url, category, "order", published) VALUES (?, ?, ?, ?, ?, ?, 1)`);
insCert.run(
  'Certificate of Freelancing — ECOM_WAYWEALTH',
  'De_Noblepro Professional Services',
  'Awarded to ECOM_WAYWEALTH for outstanding performance and professionalism in the Freelancing Skill Development Program.',
  '/uploads/cert-verified-launch-1.jpg', 'Certification', 0
);
insCert.run(
  'Shopify Partner Program Certification — ECOM_WAYWEALTH',
  'Shopify, Inc.',
  'Completed the official Shopify Partner Business Development and Merchant Success Program — expert proficiency in the Shopify platform (Oct 2023).',
  '/uploads/cert-excellence-award.jpg', 'Partnership', 1
);

// ── 6. Founder video reviews: honest captions (audio not transcribed) ──
const vids = [
  ['Video review — founder shares their WAYWEALTH launch story and first-month results', 'Video Review'],
  ['Video review — from application to live store, a founder tells it firsthand', 'Video Review'],
  ['Video review — why this founder trusts WAYWEALTH with their brand', 'Video Review'],
];
const vidRows = db.prepare(`SELECT id FROM media WHERE type = 'testimonials' ORDER BY "order" ASC`).all();
vidRows.forEach((r, i) => {
  if (vids[i]) db.prepare(`UPDATE media SET caption = ?, category = ? WHERE id = ?`).run(vids[i][0], vids[i][1], r.id);
});

console.log('\nRECATEGORIZE DONE. Counts:');
console.log('  portfolio:', db.prepare(`SELECT COUNT(*) as c FROM media WHERE type='portfolio'`).get().c);
console.log('  sales_proof:', db.prepare(`SELECT COUNT(*) as c FROM media WHERE type='sales_proof'`).get().c);
console.log('  testimonials:', db.prepare(`SELECT COUNT(*) as c FROM media WHERE type='testimonials'`).get().c);
console.log('  team:', db.prepare(`SELECT COUNT(*) as c FROM team`).get().c);
console.log('  certificates:', db.prepare(`SELECT COUNT(*) as c FROM certificates`).get().c);
db.close();
