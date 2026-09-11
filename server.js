/* WAYWEALTH — The E-Commerce Venture Studio
   Backend: Express + node:sqlite (built-in) + JWT auth
   Serves public frontend + admin + API
*/
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cron = require('node-cron');
const { DatabaseSync } = require('node:sqlite');
const pgBackup = require('./lib/pgBackup');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'waywealth_dev_secret_change_in_prod_32chars';
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@waywealth.studio';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

// ── DB Setup ───────────────────────────────────────────────────────
const dbPath = path.join(__dirname, 'data.db');
const db = new DatabaseSync(dbPath);
db.exec(`PRAGMA journal_mode = WAL`);

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS content (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      section TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      caption TEXT,
      category TEXT,
      alt_text TEXT,
      "order" INTEGER DEFAULT 0,
      published INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS team (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT,
      credibility_note TEXT,
      photo_url TEXT,
      social_url TEXT,
      "order" INTEGER DEFAULT 0,
      published INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      issuer TEXT,
      description TEXT,
      image_url TEXT NOT NULL,
      category TEXT,
      "order" INTEGER DEFAULT 0,
      published INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS process_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      step_num INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      "order" INTEGER DEFAULT 0,
      published INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS pricing_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price TEXT NOT NULL,
      price_suffix TEXT,
      description TEXT,
      features TEXT,
      cta_label TEXT,
      cta_link TEXT,
      featured INTEGER DEFAULT 0,
      "order" INTEGER DEFAULT 0,
      published INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      "order" INTEGER DEFAULT 0,
      published INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS sections (
      key TEXT PRIMARY KEY,
      visible INTEGER DEFAULT 1,
      "order" INTEGER DEFAULT 0,
      animation_enabled INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      storeName TEXT,
      investmentRange TEXT,
      storeStatus TEXT,
      wasScammed TEXT,
      scamDetails TEXT,
      whatsapp TEXT NOT NULL,
      email TEXT NOT NULL,
      preferredContactTime TEXT,
      source TEXT,
      trafficPlan TEXT,
      consent INTEGER DEFAULT 0,
      submittedAt TEXT DEFAULT (datetime('now')),
      pageUrl TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      honeypot TEXT,
      webhook_status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      pipeline_stage TEXT DEFAULT 'new',
      ip TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      element_id TEXT,
      session_id TEXT,
      page_url TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      timestamp TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      mfa_secret TEXT,
      last_login TEXT
    );
    CREATE TABLE IF NOT EXISTS stats_cache (
      metric TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      computed_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      ip TEXT,
      success INTEGER,
      timestamp TEXT DEFAULT (datetime('now'))
    );
  `);

  const existingAdmin = db.prepare('SELECT id FROM admin_users WHERE email = ?').get(ADMIN_EMAIL);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    db.prepare('INSERT INTO admin_users (email, password_hash) VALUES (?, ?)').run(ADMIN_EMAIL, hash);
    console.log(`[DB] Seeded admin: ${ADMIN_EMAIL}`);
  } else if (process.env.ADMIN_PASSWORD) {
    // Allow .env to reset password — only you know it
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    db.prepare('UPDATE admin_users SET password_hash = ? WHERE email = ?').run(hash, ADMIN_EMAIL);
    console.log(`[DB] Admin password synced from .env for ${ADMIN_EMAIL}`);
  }

  // ── Content: seed + migrate (INSERT OR IGNORE for every key so existing DB also gets new keys) ──
  const allContentDefaults = [
    ['site_title', 'WAYWEALTH — The E-Commerce Venture Studio', 'meta'],
    ['site_description', 'We don\'t just build stores — we engineer high-converting storefronts backed by real, current sales proof.', 'meta'],
    ['site_logo', '', 'meta'],
    ['site_favicon', '', 'meta'],
    ['og_image', '', 'meta'],
    ['header_nav_showcase', 'Showcase', 'header'],
    ['header_nav_proof', 'Proof', 'header'],
    ['header_nav_process', 'Process', 'header'],
    ['header_nav_pricing', 'Pricing', 'header'],
    ['header_nav_faq', 'FAQ', 'header'],
    ['header_nav_certificates', 'Awards', 'header'],
    ['header_cta_book', 'Book / Apply', 'header'],
    ['header_cta_whatsapp', 'WhatsApp Us', 'header'],
    ['hero_badge', '● Only 7 launch slots left this month', 'hero'],
    ['hero_headline', 'We Build Stores That <em>Actually</em> Sell.', 'hero'],
    ['hero_subhead', 'The done-for-you E-Commerce Venture Studio for founders who want a high-trust, high-converting storefront — researched, built, and handed over with a 30-day scaling roadmap.', 'hero'],
    ['hero_cta_primary', 'Apply for Your Store Launch', 'hero'],
    ['hero_cta_secondary', 'WhatsApp Us', 'hero'],
    ['hero_cta_primary_link', '#apply', 'hero'],
    ['hero_trust_line', 'Trusted by 180+ founders • 4.9/5 average', 'hero'],
    ['hero_pop_notes', '+ $42.50 just now • Eco-Beauty\n+ $18.20 just now • Tech Gadgets\n+ $67.90 just now • Fitness Gear\n+ $29.40 just now • Luxury Accessories', 'hero'],
    ['hero_mockup_live', '● Store Dashboard — Live', 'hero'],
    ['hero_mockup_currency', '$ / USD', 'hero'],
    ['hero_mockup_rev_label', "Today's Revenue", 'hero'],
    ['hero_mockup_orders_label', 'Orders', 'hero'],
    ['social_proof_label', 'Backed by real numbers — not vanity metrics', 'social_proof'],
    ['portfolio_headline', 'Stores Built for Conversion', 'portfolio'],
    ['portfolio_subhead', 'Every store is mobile-first, trust-engineered, and built to lift AOV from day one.', 'portfolio'],
    ['proof_headline', 'Real Revenue. Real Stores. Real Proof.', 'proof'],
    ['proof_subhead', 'Dashboard screenshots and payout receipts from stores launched through WAYWEALTH. No stock photos.', 'proof'],
    ['experts_headline', 'Meet the Experts Behind Every Build', 'experts'],
    ['experts_subhead', 'Specialists in product research, conversion design, and fulfillment — one team, one outcome.', 'experts'],
    ['process_headline', 'The 4-Step Launch Engine', 'process'],
    ['process_subhead', 'From niche validation to handover — a proven system, not guesswork.', 'process'],
    ['certificates_headline', 'Certificates & Awards', 'certificates'],
    ['certificates_subhead', 'Recognized for excellence — verified badges, partnerships and industry awards that prove our track record.', 'certificates'],
    ['pricing_headline', 'Investment & Packages', 'pricing'],
    ['pricing_subhead', 'Transparent packages. Full ownership. No hidden royalties.', 'pricing'],
    ['testimonials_headline', 'What Founders Say', 'testimonials'],
    ['testimonials_subhead', 'Real founders, real results — no scripts, no actors.', 'testimonials'],
    ['faq_headline', 'Questions, Answered Honestly', 'faq'],
    ['faq_subhead', 'Everything you need to decide before you apply.', 'faq'],
    ['form_headline', 'Apply for Your Custom Store Launch', 'form'],
    ['form_subhead', 'Tell us about your goals so we can prepare the right plan before your call.', 'form'],
    ['form_label_name', 'Full Name *', 'form'],
    ['form_ph_name', 'e.g. Victory Owabor', 'form'],
    ['form_label_brand', 'Desired Brand / Niche Name *', 'form'],
    ['form_ph_brand', 'e.g. LUXEORA — luxury accessories', 'form'],
    ['form_label_investment', 'Investment Range *', 'form'],
    ['form_label_status', 'Current Status *', 'form'],
    ['form_opt_new', 'Brand new', 'form'],
    ['form_opt_existing', "Have a store that isn't converting", 'form'],
    ['form_label_scam', 'Previously lost money to a fake mentor/agency? *', 'form'],
    ['form_label_scam_details', 'What happened? (optional but helps us help you)', 'form'],
    ['form_ph_scam', 'Briefly — what was promised vs delivered?', 'form'],
    ['form_label_whatsapp', 'WhatsApp Number *', 'form'],
    ['form_ph_whatsapp', '+234 800 000 0000', 'form'],
    ['form_label_email', 'Business Email *', 'form'],
    ['form_ph_email', 'you@brand.com', 'form'],
    ['form_label_contact_time', 'Preferred Contact Time', 'form'],
    ['form_ph_contact_time', 'e.g. Weekdays 3–6pm WAT', 'form'],
    ['form_label_source', 'How did you hear about us?', 'form'],
    ['form_source_options', 'Instagram\nWhatsApp status\nTikTok\nReferral\nGoogle\nOther', 'form'],
    ['form_label_traffic', 'Primary traffic plan', 'form'],
    ['form_traffic_options', 'TikTok Ads\nMeta Ads\nGoogle SEO\nInfluencers\nUndecided', 'form'],
    ['form_label_consent', 'I agree to be contacted via WhatsApp/Email about my application. *', 'form'],
    ['form_btn_next', 'Continue →', 'form'],
    ['form_btn_back', '← Back', 'form'],
    ['form_btn_submit', 'Submit Application & Book Strategy Call', 'form'],
    ['form_success_title', '✅ Application received.', 'form'],
    ['form_success_text', "We'll reach out on WhatsApp shortly. Need us now? Message us directly:", 'form'],
    ['form_success_btn', 'Message on WhatsApp', 'form'],
    ['form_err_name', 'Enter your full name', 'form'],
    ['form_err_brand', 'Enter a brand or niche name', 'form'],
    ['form_err_budget', 'Pick an investment range', 'form'],
    ['form_err_status', 'Select your status', 'form'],
    ['form_err_scam', 'Please choose yes or no', 'form'],
    ['form_err_wa', 'Enter a valid WhatsApp number (10+ digits)', 'form'],
    ['form_err_email', 'Enter a valid email', 'form'],
    ['form_err_consent', 'Consent is required', 'form'],
    ['footer_link_whatsapp', 'WhatsApp', 'footer'],
    ['footer_link_booking', 'Book a Strategy Call', 'footer'],
    ['footer_tagline', 'The E-Commerce Venture Studio. We engineer high-converting storefronts.', 'footer'],
    ['footer_contact_heading', 'Contact', 'footer'],
    ['footer_legal_heading', 'Legal', 'footer'],
    ['footer_legal_privacy', 'Privacy Policy', 'footer'],
    ['footer_legal_terms', 'Terms', 'footer'],
    ['footer_legal_refund', 'Refund Policy', 'footer'],
    ['footer_copyright', '© 2026 WAYWEALTH Venture Studio. All rights reserved.', 'footer'],
    ['footer_built_for_trust', 'Built for trust. Verified numbers only.', 'footer'],
    ['footer_whatsapp', '2348000000000', 'footer'],
    ['footer_email', 'hello@waywealth.studio', 'footer'],
    ['footer_whatsapp_msg_nav', 'Hi WAYWEALTH, I came from your website header — I want to learn about the store launch.', 'footer'],
    ['footer_whatsapp_msg_hero', 'Hi WAYWEALTH, I saw your hero section — tell me about the venture studio slots.', 'footer'],
    ['footer_whatsapp_msg_footer', 'Hi WAYWEALTH, I have a question before applying.', 'footer'],
    ['booking_link', 'https://cal.com/waywealth/strategy-call', 'footer'],
    ['theme_canvas', '#FAF9F6', 'theme'],
    ['theme_ink', '#121212', 'theme'],
    ['theme_border', '#E5E5E5', 'theme'],
    ['theme_accent', '#0F9D58', 'theme'],
    ['theme_accent_secondary', '#C9A227', 'theme'],
  ];
  const insContent = db.prepare('INSERT OR IGNORE INTO content (key, value, section) VALUES (?, ?, ?)');
  for (const r of allContentDefaults) insContent.run(r[0], r[1], r[2]);
  // ── Migrate existing Naira to Dollars ($) ──
  try {
    const naira = String.fromCharCode(8358);
    db.prepare("UPDATE content SET value = replace(value, ?, '$') WHERE value LIKE '%' || ? || '%'").run(naira, naira);
    db.prepare("UPDATE media SET caption = replace(caption, ?, '$') WHERE caption LIKE '%' || ? || '%'").run(naira, naira);
    db.prepare("UPDATE pricing_plans SET price = replace(price, ?, '$') WHERE price LIKE '%' || ? || '%'").run(naira, naira);
    db.prepare("UPDATE stats_cache SET value = replace(value, ?, '$') WHERE value LIKE '%' || ? || '%'").run(naira, naira);
    // Normalize known pricing values
    try { db.prepare("UPDATE pricing_plans SET price='$450' WHERE price='$450k'").run(); } catch {}
    try { db.prepare("UPDATE pricing_plans SET price='$850' WHERE price='$850k'").run(); } catch {}
    try { db.prepare("UPDATE content SET value='$ / USD' WHERE key='hero_mockup_currency'").run(); } catch {}
    // Fix captions that still contain legacy Naira amounts
    try { db.prepare("UPDATE media SET caption = replace(caption, '$2.1M', '$2,100') WHERE caption LIKE '%$2.1M%'").run(); } catch {}
    try { db.prepare("UPDATE media SET caption = replace(caption, '$4.7M', '$4,700') WHERE caption LIKE '%$4.7M%'").run(); } catch {}
    try { db.prepare("UPDATE media SET caption = replace(caption, '$1.8M', '$1,800') WHERE caption LIKE '%$1.8M%'").run(); } catch {}
    try { db.prepare("UPDATE stats_cache SET value='$127K+' WHERE metric='total_sales' AND value LIKE '%127%'").run(); } catch {}
  } catch(e) { console.warn('currency migration warning', e.message); }

  // ── Sections: ensure every key exists ──
  const allSections = [
    ['header', 0, 1],
    ['hero', 1, 1],
    ['social_proof', 2, 1],
    ['portfolio', 3, 1],
    ['proof', 4, 1],
    ['experts', 5, 1],
    ['process', 6, 1],
    ['certificates', 7, 1],
    ['pricing', 8, 1],
    ['testimonials', 9, 1],
    ['faq', 10, 1],
    ['form', 11, 1],
    ['footer', 12, 1],
  ];
  const insSec = db.prepare('INSERT OR IGNORE INTO sections (key, visible, "order", animation_enabled) VALUES (?, ?, ?, 1)');
  for (const r of allSections) insSec.run(r[0], r[1], r[2]);

  const mediaCount = db.prepare('SELECT COUNT(*) as c FROM media').get().c;
  if (mediaCount === 0) {
    const media = [
      ['portfolio', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80', 'Luxury Accessories — $2,100 first-month revenue', 'Luxury Accessories', 'Luxury accessories storefront', 0, 1],
      ['portfolio', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80', 'Eco-Beauty — 3.2× ROAS on launch week', 'Eco-Beauty', 'Eco beauty brand', 1, 1],
      ['portfolio', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80', 'Tech Gadgets — 4.8★ from 320 reviews', 'Tech Gadgets', 'Tech gadgets store', 2, 1],
      ['portfolio', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8?w=800&q=80', 'Fitness Gear — 41% repeat purchase rate', 'Fitness Gear', 'Fitness gear store', 3, 1],
      ['sales_proof', 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80', 'Shopify payout — $4,700 in 30 days (Store #042)', 'Dashboard', 'Revenue dashboard screenshot', 0, 1],
      ['sales_proof', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80', 'Meta Ads ROAS 4.1× — Eco-Beauty launch', 'ROAS', 'Ads dashboard', 1, 1],
      ['testimonials', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80', '“WAYWEALTH rebuilt my dead store. We hit $1,800 in week two.” — Tola A., Lagos', 'Lagos', 'Tola A portrait', 0, 1],
      ['testimonials', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80', '“The 30-day roadmap alone was worth the fee.” — Amara K., Abuja', 'Abuja', 'Amara K portrait', 1, 1],
    ];
    const ms = db.prepare('INSERT INTO media (type, url, caption, category, alt_text, "order", published) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const r of media) ms.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6]);
  }

  const teamCount = db.prepare('SELECT COUNT(*) as c FROM team').get().c;
  if (teamCount === 0) {
    const team = [
      ['Victory Owabor', 'Founder & Venture Lead', 'Led 60+ store launches across 4 niches', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80', '', 0, 1],
      ['Sarah Chen', 'Head of Conversion Design', 'Ex-Shopify Plus, 120+ storefronts optimized', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80', '', 1, 1],
      ['David Okafor', 'Product Research Lead', 'Validated 400+ products, 3.4× avg. hit rate', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', '', 2, 1],
      ['Priya Patel', 'Fulfillment & Ops', 'Vetted 50+ suppliers, 5–7 day avg. delivery', 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&q=80', '', 3, 1],
    ];
    const ts = db.prepare('INSERT INTO team (name, role, credibility_note, photo_url, social_url, "order", published) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const r of team) ts.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6]);
  }

  const certCount = db.prepare('SELECT COUNT(*) as c FROM certificates').get().c;
  if (certCount === 0) {
    const certs = [
      ['Shopify Partner Certified', 'Shopify', 'Official Shopify Partner — verified store builds that meet Shopify quality standards.', 'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=600&q=80', 'Partnership', 0, 1],
      ['Meta Business Partner', 'Meta', 'Certified for high-performing commerce and ads execution on Meta platforms.', 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=600&q=80', 'Certification', 1, 1],
      ['E-Commerce Excellence Award 2024', 'Waywealth Studio', 'Awarded for outstanding conversion design across 100+ launches.', 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&q=80', 'Award', 2, 1],
    ];
    const cs = db.prepare('INSERT INTO certificates (title, issuer, description, image_url, category, "order", published) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const r of certs) cs.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6]);
  }

  const procCount = db.prepare('SELECT COUNT(*) as c FROM process_steps').get().c;
  if (procCount === 0) {
    const steps = [
      [1, 'Niche & Product Mining', 'Demand-validated research — we find products with proven purchase intent, not guesses.', '', 0, 1],
      [2, 'Store Architecture', 'High-trust, mobile-first storefront engineered for AOV and conversion.', '', 1, 1],
      [3, 'Fulfillment & Automation', 'Vetted suppliers, 5–7 day shipping, automated order flow — you never touch inventory.', '', 2, 1],
      [4, 'Handover & Scaling Roadmap', 'Full ownership transfer + a 30-day growth plan. Your store, your asset.', '', 3, 1],
    ];
    const ps = db.prepare('INSERT INTO process_steps (step_num, title, description, icon, "order", published) VALUES (?, ?, ?, ?, ?, ?)');
    for (const r of steps) ps.run(r[0], r[1], r[2], r[3], r[4], r[5]);
  }

  const pricingCount = db.prepare('SELECT COUNT(*) as c FROM pricing_plans').get().c;
  if (pricingCount === 0) {
    const plans = [
      ['Starter', '$450', 'one-time', 'For first-time founders testing the waters.', JSON.stringify(['1 validated product & niche report','High-converting single-product store','Supplier + fulfillment setup','7-day support after handover']), 'Apply — Starter', '#apply', 0, 0, 1],
      ['Scale', '$850', 'one-time', 'For founders ready to scale from day one.', JSON.stringify(['3 validated products + upsell funnels','Premium multi-product storefront','Ad creatives + email flows','30-day scaling roadmap + calls']), 'Apply — Scale', '#apply', 1, 1, 1],
      ['Elite Brand', 'Custom', 'quote', 'For founders building an 8-figure brand asset.', JSON.stringify(['Full brand identity + packaging','Custom dev + private suppliers','Influencer & paid-media launch','60-day hands-on growth support']), 'Request Quote', '#apply', 2, 0, 1],
    ];
    const pp = db.prepare('INSERT INTO pricing_plans (name, price, price_suffix, description, features, cta_label, cta_link, "order", featured, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const r of plans) pp.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9]);
  }

  const faqCount = db.prepare('SELECT COUNT(*) as c FROM faqs').get().c;
  if (faqCount === 0) {
    const faqs = [
      ['Do I own the store after handover?', 'Yes — 100%. Domain, Shopify account, supplier contacts, creatives, and all assets are transferred to you. No royalties, no lock-in.', 0, 1],
      ['How long until my store is live?', 'Average 7–12 days from kickoff. You’ll get a clear timeline on your strategy call — and we don’t launch until you approve the store.', 1, 1],
      ['I\'ve been scammed by a “mentor” before. How are you different?', 'We hear you — that’s why every proof element on this site is uploaded from real stores, and why we do an application call before taking payment. No hype, no rent-to-own “mentorship” — just a built store you own. Tell us what happened in the form and we’ll address it directly on the call.', 2, 1],
      ['What\'s your refund/support policy?', 'If we haven’t started build, full refund. Once build is underway, we offer revisions until you’re satisfied — and 30 days of post-launch support on the Scale plan.', 3, 1],
      ['Do you run ads for me?', 'We set up ad creatives, audiences, and the scaling roadmap. Ad spend is yours — we recommend starting budgets on the call so there are no surprises.', 4, 1],
    ];
    const fq = db.prepare('INSERT INTO faqs (question, answer, "order", published) VALUES (?, ?, ?, ?)');
    for (const r of faqs) fq.run(r[0], r[1], r[2], r[3]);
  }

  const sc = db.prepare('SELECT COUNT(*) as c FROM stats_cache').get().c;
  if (sc === 0) {
    const stats = [
      ['total_sales', '$127K+', '2026-09-01'],
      ['success_rate', '94%', '2026-09-01'],
      ['stores_delivered', '183', '2026-09-01'],
      ['avg_launch_days', '9 days', '2026-09-01'],
      ['slots_left', '7', '2026-09-01'],
    ];
    const ss = db.prepare('INSERT INTO stats_cache (metric, value, computed_at) VALUES (?, ?, ?)');
    for (const r of stats) ss.run(r[0], r[1], r[2]);
  }
}
initDB();

const publicDir = path.join(__dirname, 'public');
const uploadsDir = path.join(publicDir, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── Postgres auto-backup: restore on boot (fixes Render ephemeral disk) ──
(async () => {
  if (pgBackup.isEnabled()) {
    try {
      const r = await pgBackup.restoreIfEmpty(db, uploadsDir);
      console.log('[Backup] restore check:', JSON.stringify(r));
      // Take a fresh backup shortly after boot so Postgres always has latest seed
      setTimeout(() => pgBackup.backupNow(db, uploadsDir).catch((e) => console.error('[Backup] boot backup failed:', e.message)), 15000);
    } catch (e) {
      console.error('[Backup] restore failed:', e.message);
    }
    // Periodic auto-backup (default every 10 min)
    const everyMin = parseInt(process.env.BACKUP_INTERVAL_MIN || '10', 10);
    if (everyMin > 0) {
      cron.schedule(`*/${everyMin} * * * *`, async () => {
        try { await pgBackup.backupNow(db, uploadsDir); }
        catch (e) { console.error('[Backup] cron failed:', e.message); }
      });
      console.log(`[Backup] auto-backup every ${everyMin} min → Postgres`);
    }
    // Safety net: backup on graceful shutdown (Render sends SIGTERM on redeploy)
    const shutdownBackup = async () => {
      try { await pgBackup.backupNow(db, uploadsDir); console.log('[Backup] shutdown backup done'); }
      catch (e) { console.error('[Backup] shutdown backup failed:', e.message); }
    };
    process.on('SIGTERM', () => { shutdownBackup().finally(() => process.exit(0)); });
    process.on('SIGINT', () => { shutdownBackup().finally(() => process.exit(0)); });
  } else {
    console.log('[Backup] disabled — set DATABASE_URL to enable Postgres auto-backup');
  }
})();

// Helper: queue a debounced backup after any write (content/media/leads/etc.)
function queueBackup() { pgBackup.scheduleBackup(db, uploadsDir); }

// ── Express App ────────────────────────────────────────────────────
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check (required by Render healthCheckPath: /health)
app.get('/health', async (req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), backup: await pgBackup.getStatus().catch(() => ({ enabled: false })) });
});
// Auto-backup after any API write (debounced 30s → Postgres). Must sit BEFORE routes.
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    res.on('finish', () => { if (res.statusCode < 400) queueBackup(); });
  }
  next();
});
app.use(express.static(publicDir));
app.use('/uploads', express.static(uploadsDir));

// ── Multer ─────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpeg|png|webp|gif|avif|svg\+xml|x-icon|vnd\.microsoft\.icon)|video\/(mp4|webm|quicktime)/.test(file.mimetype) || /\.(svg|ico|png|jpg|jpeg|webp|gif|avif|mp4|webm|mov)$/i.test(file.originalname);
    cb(null, ok);
  }
});

function authMiddleware(req, res, next) {
  const token = req.cookies.ww_token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}

const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions, please try again later.' }
});
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: 'Too many login attempts — please wait 15 minutes or restart the server to reset' } });

// ── API: Content ──────────────────────────────────────────────────
app.get('/api/content', (req, res) => {
  const rows = db.prepare('SELECT key, value, section FROM content').all();
  if (req.query.raw === '1' || req.query.full === '1') return res.json(rows);
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});
app.get('/api/content/raw', (req, res) => {
  const rows = db.prepare('SELECT key, value, section FROM content').all();
  res.json(rows);
});
app.put('/api/content/:key', authMiddleware, (req, res) => {
  const { key } = req.params;
  const { value, section } = req.body;
  if (typeof value !== 'string') return res.status(400).json({ error: 'value required' });
  const exists = db.prepare('SELECT key FROM content WHERE key = ?').get(key);
  if (exists) db.prepare("UPDATE content SET value = ?, section = COALESCE(?, section), updated_at = datetime('now') WHERE key = ?").run(value, section || null, key);
  else db.prepare('INSERT INTO content (key, value, section) VALUES (?, ?, ?)').run(key, value, section || 'general');
  res.json({ ok: true, key, value });
});

// ── API: Media ────────────────────────────────────────────────────
app.get('/api/media', (req, res) => {
  const type = req.query.type;
  let rows;
  if (type) rows = db.prepare('SELECT * FROM media WHERE type = ? ORDER BY "order" ASC').all(type);
  else rows = db.prepare('SELECT * FROM media ORDER BY type, "order" ASC').all();
  const token = req.cookies.ww_token || (req.headers.authorization || '').replace('Bearer ', '');
  let isAdmin = false;
  if (token) { try { jwt.verify(token, JWT_SECRET); isAdmin = true; } catch {} }
  if (!isAdmin) rows = rows.filter(r => r.published === 1);
  res.json(rows);
});
app.post('/api/media', authMiddleware, upload.single('file'), (req, res) => {
  const { type, caption, category, alt_text, url: urlBody, order } = req.body;
  if (!type) return res.status(400).json({ error: 'type required' });
  let url = urlBody;
  if (req.file) url = '/uploads/' + req.file.filename;
  if (!url) return res.status(400).json({ error: 'file or url required' });
  const info = db.prepare('INSERT INTO media (type, url, caption, category, alt_text, "order", published) VALUES (?, ?, ?, ?, ?, ?, 1)').run(type, url, caption || '', category || '', alt_text || caption || '', parseInt(order) || 0);
  res.json({ ok: true, id: info.lastInsertRowid, url });
});
app.patch('/api/media/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  const allowed = ['caption', 'category', 'alt_text', 'url', 'order', 'published', 'type'];
  const sets = []; const vals = [];
  for (const k of allowed) if (k in req.body) { sets.push(`"${k}" = ?`); vals.push(k === 'published' ? (req.body[k] ? 1 : 0) : req.body[k]); }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
  vals.push(id);
  db.prepare(`UPDATE media SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});
app.delete('/api/media/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM media WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── API: Team ─────────────────────────────────────────────────────
app.get('/api/team', (req, res) => {
  let rows = db.prepare('SELECT * FROM team ORDER BY "order" ASC').all();
  const token = req.cookies.ww_token || (req.headers.authorization || '').replace('Bearer ', '');
  let isAdmin = false;
  if (token) { try { jwt.verify(token, JWT_SECRET); isAdmin = true; } catch {} }
  if (!isAdmin) rows = rows.filter(r => r.published === 1);
  res.json(rows);
});
app.post('/api/team', authMiddleware, upload.single('file'), (req, res) => {
  const { name, role, credibility_note, social_url, order, photo_url: photoUrlBody } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  let photo_url = photoUrlBody || '';
  if (req.file) photo_url = '/uploads/' + req.file.filename;
  const info = db.prepare('INSERT INTO team (name, role, credibility_note, photo_url, social_url, "order", published) VALUES (?, ?, ?, ?, ?, ?, 1)').run(name, role || '', credibility_note || '', photo_url, social_url || '', parseInt(order) || 0);
  res.json({ ok: true, id: info.lastInsertRowid, photo_url });
});
app.patch('/api/team/:id', authMiddleware, (req, res) => {
  const allowed = ['name', 'role', 'credibility_note', 'photo_url', 'social_url', 'order', 'published'];
  const sets = []; const vals = [];
  for (const k of allowed) if (k in req.body) { sets.push(`"${k}" = ?`); vals.push(k === 'published' ? (req.body[k] ? 1 : 0) : req.body[k]); }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
  vals.push(req.params.id);
  db.prepare(`UPDATE team SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});
app.delete('/api/team/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM team WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── API: Certificates (Image Upload + CRUD) ────────────────────────
app.get('/api/certificates', (req, res) => {
  let rows = db.prepare('SELECT * FROM certificates ORDER BY "order" ASC').all();
  const token = req.cookies.ww_token || (req.headers.authorization || '').replace('Bearer ', '');
  let isAdmin = false;
  if (token) { try { jwt.verify(token, JWT_SECRET); isAdmin = true; } catch {} }
  if (!isAdmin) rows = rows.filter(r => r.published === 1);
  res.json(rows);
});
app.post('/api/certificates', authMiddleware, upload.single('file'), (req, res) => {
  const { title, issuer, description, category, order, image_url: bodyUrl } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  let image_url = bodyUrl || '';
  if (req.file) image_url = '/uploads/' + req.file.filename;
  if (!image_url) return res.status(400).json({ error: 'file or image_url required' });
  const info = db.prepare('INSERT INTO certificates (title, issuer, description, image_url, category, "order", published) VALUES (?, ?, ?, ?, ?, ?, 1)').run(title, issuer||'', description||'', image_url, category||'', parseInt(order)||0);
  res.json({ ok: true, id: info.lastInsertRowid, image_url });
});
app.patch('/api/certificates/:id', authMiddleware, (req, res) => {
  const allowed = ['title','issuer','description','image_url','category','order','published'];
  const sets=[]; const vals=[];
  for(const k of allowed) if(k in req.body){ sets.push(`"${k}" = ?`); vals.push(k==='published' ? (req.body[k]?1:0) : req.body[k]); }
  if(!sets.length) return res.status(400).json({error:'nothing to update'});
  vals.push(req.params.id);
  db.prepare(`UPDATE certificates SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ok:true});
});
app.delete('/api/certificates/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM certificates WHERE id = ?').run(req.params.id);
  res.json({ok:true});
});

// ── API: Process Steps ────────────────────────────────────────────
app.get('/api/process-steps', (req, res) => {
  let rows = db.prepare('SELECT * FROM process_steps ORDER BY "order" ASC').all();
  const token = req.cookies.ww_token || (req.headers.authorization || '').replace('Bearer ', '');
  let isAdmin = false;
  if (token) { try { jwt.verify(token, JWT_SECRET); isAdmin = true; } catch {} }
  if (!isAdmin) rows = rows.filter(r => r.published === 1);
  res.json(rows);
});
app.post('/api/process-steps', authMiddleware, (req, res) => {
  const { step_num, title, description, icon, order } = req.body;
  if(!title) return res.status(400).json({error:'title required'});
  const info = db.prepare('INSERT INTO process_steps (step_num, title, description, icon, "order", published) VALUES (?, ?, ?, ?, ?, 1)').run(parseInt(step_num)||1, title, description||'', icon||'', parseInt(order)||0);
  res.json({ok:true, id: info.lastInsertRowid});
});
app.patch('/api/process-steps/:id', authMiddleware, (req, res) => {
  const allowed=['step_num','title','description','icon','order','published'];
  const sets=[]; const vals=[];
  for(const k of allowed) if(k in req.body){ sets.push(`"${k}" = ?`); vals.push(k==='published' ? (req.body[k]?1:0) : req.body[k]); }
  if(!sets.length) return res.status(400).json({error:'nothing to update'});
  vals.push(req.params.id);
  db.prepare(`UPDATE process_steps SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ok:true});
});
app.delete('/api/process-steps/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM process_steps WHERE id = ?').run(req.params.id);
  res.json({ok:true});
});

// ── API: Pricing Plans ────────────────────────────────────────────
app.get('/api/pricing-plans', (req, res) => {
  let rows = db.prepare('SELECT * FROM pricing_plans ORDER BY "order" ASC').all();
  const token = req.cookies.ww_token || (req.headers.authorization || '').replace('Bearer ', '');
  let isAdmin = false;
  if (token) { try { jwt.verify(token, JWT_SECRET); isAdmin = true; } catch {} }
  if (!isAdmin) rows = rows.filter(r => r.published === 1);
  // parse features JSON
  rows = rows.map(r=> ({...r, features: (()=>{ try{return JSON.parse(r.features||'[]')}catch{return r.features}} )() }));
  res.json(rows);
});
app.post('/api/pricing-plans', authMiddleware, (req, res) => {
  const { name, price, price_suffix, description, features, cta_label, cta_link, order, featured } = req.body;
  if(!name || !price) return res.status(400).json({error:'name and price required'});
  let feat = features;
  if(Array.isArray(feat)) feat = JSON.stringify(feat);
  if(typeof feat==='string' && !feat.trim().startsWith('[')) feat = JSON.stringify(feat.split('\n').map(s=>s.trim()).filter(Boolean));
  const info = db.prepare('INSERT INTO pricing_plans (name, price, price_suffix, description, features, cta_label, cta_link, "order", featured, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)').run(name, price, price_suffix||'', description||'', feat||'[]', cta_label||'', cta_link||'#apply', parseInt(order)||0, featured?1:0);
  res.json({ok:true, id: info.lastInsertRowid});
});
app.patch('/api/pricing-plans/:id', authMiddleware, (req, res) => {
  const allowed=['name','price','price_suffix','description','features','cta_label','cta_link','order','featured','published'];
  const sets=[]; const vals=[];
  for(const k of allowed) if(k in req.body){
    let v=req.body[k];
    if(k==='features' && Array.isArray(v)) v=JSON.stringify(v);
    if(k==='features' && typeof v==='string' && !v.trim().startsWith('[')) { try{ JSON.parse(v);}catch{ v=JSON.stringify(v.split('\n').map(s=>s.trim()).filter(Boolean)); } }
    sets.push(`"${k}" = ?`); vals.push((k==='published'||k==='featured') ? (v?1:0) : v);
  }
  if(!sets.length) return res.status(400).json({error:'nothing to update'});
  vals.push(req.params.id);
  db.prepare(`UPDATE pricing_plans SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ok:true});
});
app.delete('/api/pricing-plans/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM pricing_plans WHERE id = ?').run(req.params.id);
  res.json({ok:true});
});

// ── API: FAQs ─────────────────────────────────────────────────────
app.get('/api/faqs', (req, res) => {
  let rows = db.prepare('SELECT * FROM faqs ORDER BY "order" ASC').all();
  const token = req.cookies.ww_token || (req.headers.authorization || '').replace('Bearer ', '');
  let isAdmin = false;
  if (token) { try { jwt.verify(token, JWT_SECRET); isAdmin = true; } catch {} }
  if (!isAdmin) rows = rows.filter(r => r.published === 1);
  res.json(rows);
});
app.post('/api/faqs', authMiddleware, (req, res) => {
  const { question, answer, order } = req.body;
  if(!question || !answer) return res.status(400).json({error:'question and answer required'});
  const info = db.prepare('INSERT INTO faqs (question, answer, "order", published) VALUES (?, ?, ?, 1)').run(question, answer, parseInt(order)||0);
  res.json({ok:true, id: info.lastInsertRowid});
});
app.patch('/api/faqs/:id', authMiddleware, (req, res) => {
  const allowed=['question','answer','order','published'];
  const sets=[]; const vals=[];
  for(const k of allowed) if(k in req.body){ sets.push(`"${k}" = ?`); vals.push(k==='published' ? (req.body[k]?1:0) : req.body[k]); }
  if(!sets.length) return res.status(400).json({error:'nothing to update'});
  vals.push(req.params.id);
  db.prepare(`UPDATE faqs SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ok:true});
});
app.delete('/api/faqs/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM faqs WHERE id = ?').run(req.params.id);
  res.json({ok:true});
});

// ── API: Branding (logo & favicon upload) ─────────────────────────
app.post('/api/branding/logo', authMiddleware, upload.single('file'), (req, res) => {
  let url = req.body.url || req.body.image_url || '';
  if (req.file) url = '/uploads/' + req.file.filename;
  if (!url) return res.status(400).json({ error: 'file or url required' });
  db.prepare("INSERT INTO content (key, value, section) VALUES ('site_logo', ?, 'meta') ON CONFLICT(key) DO UPDATE SET value = excluded.value, section='meta', updated_at = datetime('now')").run(url);
  res.json({ ok: true, url });
});
app.post('/api/branding/favicon', authMiddleware, upload.single('file'), (req, res) => {
  let url = req.body.url || req.body.image_url || '';
  if (req.file) url = '/uploads/' + req.file.filename;
  if (!url) return res.status(400).json({ error: 'file or url required' });
  db.prepare("INSERT INTO content (key, value, section) VALUES ('site_favicon', ?, 'meta') ON CONFLICT(key) DO UPDATE SET value = excluded.value, section='meta', updated_at = datetime('now')").run(url);
  res.json({ ok: true, url });
});

// ── API: Sections ─────────────────────────────────────────────────
app.get('/api/sections', (req, res) => {
  const rows = db.prepare('SELECT * FROM sections ORDER BY "order" ASC').all();
  res.json(rows);
});
app.put('/api/sections/:key', authMiddleware, (req, res) => {
  const { visible, order, animation_enabled } = req.body;
  const sets = []; const vals = [];
  if (visible !== undefined) { sets.push('visible = ?'); vals.push(visible ? 1 : 0); }
  if (order !== undefined) { sets.push('"order" = ?'); vals.push(parseInt(order)); }
  if (animation_enabled !== undefined) { sets.push('animation_enabled = ?'); vals.push(animation_enabled ? 1 : 0); }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
  vals.push(req.params.key);
  db.prepare(`UPDATE sections SET ${sets.join(', ')} WHERE key = ?`).run(...vals);
  res.json({ ok: true });
});
app.put('/api/sections', authMiddleware, (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be array' });
  order.forEach((key, idx) => db.prepare('UPDATE sections SET "order" = ? WHERE key = ?').run(idx, key));
  res.json({ ok: true });
});

// ── API: Leads ────────────────────────────────────────────────────
async function deliverWebhook(lead) {
  if (!WEBHOOK_URL) return { status: 'no_webhook_configured' };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
      signal: ctrl.signal
    });
    clearTimeout(t);
    if (res.ok) return { status: 'sent' };
    return { status: 'failed', code: res.status };
  } catch (e) {
    return { status: 'failed', error: e.message };
  }
}

app.post('/api/leads', leadLimiter, async (req, res) => {
  const b = req.body;
  if (b.honeypot || b._honeypot) {
    return res.json({ ok: true, message: 'Application received' });
  }
  const errors = [];
  if (!b.name || String(b.name).trim().length < 2) errors.push('name required');
  if (!b.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) errors.push('valid email required');
  if (!b.whatsapp || String(b.whatsapp).replace(/\D/g, '').length < 10) errors.push('valid whatsapp required');
  if (!b.storeName) errors.push('storeName required');
  if (!b.investmentRange) errors.push('investmentRange required');
  if (!b.consent) errors.push('consent required');
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const lead = {
    name: String(b.name).trim(),
    storeName: String(b.storeName).trim(),
    investmentRange: String(b.investmentRange),
    storeStatus: b.storeStatus || '',
    wasScammed: b.wasScammed || 'no',
    scamDetails: b.scamDetails || '',
    whatsapp: String(b.whatsapp).trim(),
    email: String(b.email).trim().toLowerCase(),
    preferredContactTime: b.preferredContactTime || '',
    source: b.source || '',
    trafficPlan: b.trafficPlan || '',
    consent: b.consent ? 1 : 0,
    submittedAt: b.submittedAt || new Date().toISOString(),
    pageUrl: b.pageUrl || req.headers.referer || '',
    utm_source: (b.utm && b.utm.source) || b.utm_source || '',
    utm_medium: (b.utm && b.utm.medium) || b.utm_medium || '',
    utm_campaign: (b.utm && b.utm.campaign) || b.utm_campaign || '',
    honeypot: b.honeypot || '',
    ip: req.ip
  };
  if (lead.scamDetails.length > 2000) lead.scamDetails = lead.scamDetails.slice(0, 2000);

  const info = db.prepare(`
    INSERT INTO leads (name, storeName, investmentRange, storeStatus, wasScammed, scamDetails, whatsapp, email, preferredContactTime, source, trafficPlan, consent, submittedAt, pageUrl, utm_source, utm_medium, utm_campaign, honeypot, webhook_status, retry_count, pipeline_stage, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 'new', ?)
  `).run(lead.name, lead.storeName, lead.investmentRange, lead.storeStatus, lead.wasScammed, lead.scamDetails, lead.whatsapp, lead.email, lead.preferredContactTime, lead.source, lead.trafficPlan, lead.consent, lead.submittedAt, lead.pageUrl, lead.utm_source, lead.utm_medium, lead.utm_campaign, lead.honeypot, lead.ip);
  const id = info.lastInsertRowid;

  const payload = { id, ...lead, consent: !!lead.consent };
  const result = await deliverWebhook(payload);
  const webhook_status = result.status === 'sent' ? 'sent' : (WEBHOOK_URL ? 'failed' : 'no_webhook');
  db.prepare('UPDATE leads SET webhook_status = ?, retry_count = ? WHERE id = ?').run(webhook_status, webhook_status === 'failed' ? 1 : 0, id);

  db.prepare('INSERT INTO events (event_type, element_id, session_id) VALUES (?, ?, ?)').run('lead_submitted', 'application_form', b.session_id || '');

  res.json({ ok: true, id, webhook_status, message: 'Application received. We will reach out on WhatsApp shortly.' });
});

app.get('/api/leads', authMiddleware, (req, res) => {
  const { stage, search, limit = 100, offset = 0 } = req.query;
  let sql = 'SELECT * FROM leads';
  const where = []; const params = [];
  if (stage) { where.push('pipeline_stage = ?'); params.push(stage); }
  if (search) { where.push('(name LIKE ? OR email LIKE ? OR whatsapp LIKE ? OR storeName LIKE ?)'); const s = `%${search}%`; params.push(s, s, s, s); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

app.patch('/api/leads/:id', authMiddleware, async (req, res) => {
  const id = req.params.id;
  const { pipeline_stage, resendWebhook } = req.body;
  if (pipeline_stage) {
    db.prepare('UPDATE leads SET pipeline_stage = ? WHERE id = ?').run(pipeline_stage, id);
  }
  if (resendWebhook) {
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
    if (!lead) return res.status(404).json({ error: 'not found' });
    const result = await deliverWebhook(lead);
    const status = result.status === 'sent' ? 'sent' : 'failed';
    db.prepare('UPDATE leads SET webhook_status = ?, retry_count = retry_count + 1 WHERE id = ?').run(status, id);
    return res.json({ ok: true, webhook_status: status });
  }
  res.json({ ok: true });
});

app.get('/api/leads/export.csv', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  const headers = ['id','name','storeName','investmentRange','storeStatus','wasScammed','scamDetails','whatsapp','email','preferredContactTime','source','trafficPlan','consent','submittedAt','pageUrl','utm_source','utm_medium','utm_campaign','webhook_status','pipeline_stage','created_at'];
  let csv = headers.join(',') + '\n';
  for (const r of rows) {
    csv += headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',') + '\n';
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="waywealth-leads.csv"');
  res.send(csv);
});

// ── API: Events / Analytics ───────────────────────────────────────
app.post('/api/events', (req, res) => {
  const { event_type, element_id, session_id, page_url, utm_source, utm_medium, utm_campaign } = req.body;
  if (!event_type) return res.status(400).json({ error: 'event_type required' });
  db.prepare('INSERT INTO events (event_type, element_id, session_id, page_url, utm_source, utm_medium, utm_campaign) VALUES (?, ?, ?, ?, ?, ?, ?)').run(event_type, element_id || '', session_id || '', page_url || '', utm_source || '', utm_medium || '', utm_campaign || '');
  res.json({ ok: true });
});

app.get('/api/analytics/summary', authMiddleware, (req, res) => {
  const totalViews = db.prepare("SELECT COUNT(*) as c FROM events WHERE event_type = 'pageview'").get().c;
  const uniqueSessions = db.prepare("SELECT COUNT(DISTINCT session_id) as c FROM events WHERE session_id != ''").get().c;
  const totalLeads = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  const leadsByStage = db.prepare('SELECT pipeline_stage, COUNT(*) as c FROM leads GROUP BY pipeline_stage').all();
  const ctaClicks = db.prepare("SELECT element_id, COUNT(*) as c FROM events WHERE event_type = 'cta_click' GROUP BY element_id").all();
  const funnel = {
    pageviews: totalViews,
    form_starts: db.prepare("SELECT COUNT(*) as c FROM events WHERE event_type = 'form_start'").get().c,
    form_step2: db.prepare("SELECT COUNT(*) as c FROM events WHERE event_type = 'form_step2'").get().c,
    form_submits: totalLeads,
  };
  const traffic = db.prepare('SELECT source, COUNT(*) as c FROM leads GROUP BY source').all();
  const utmBreak = db.prepare('SELECT utm_source as src, COUNT(*) as c FROM leads GROUP BY utm_source').all();
  const recentEvents = db.prepare('SELECT * FROM events ORDER BY timestamp DESC LIMIT 50').all();
  const leadsPerDay = db.prepare("SELECT date(created_at) as d, COUNT(*) as c FROM leads GROUP BY date(created_at) ORDER BY d DESC LIMIT 14").all();
  res.json({ totalViews, uniqueSessions, totalLeads, leadsByStage, ctaClicks, funnel, traffic, utmBreak, recentEvents, leadsPerDay });
});

// ── API: Stats cache ──────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const rows = db.prepare('SELECT metric, value FROM stats_cache').all();
  const obj = {}; rows.forEach(r => obj[r.metric] = r.value);
  res.json(obj);
});
app.put('/api/stats/:metric', authMiddleware, (req, res) => {
  const { value } = req.body;
  if (typeof value !== 'string') return res.status(400).json({ error: 'value required' });
  db.prepare("INSERT INTO stats_cache (metric, value, computed_at) VALUES (?, ?, datetime('now')) ON CONFLICT(metric) DO UPDATE SET value = excluded.value, computed_at = datetime('now')").run(req.params.metric, value);
  res.json({ ok: true });
});

// ── Backup API (admin) ────────────────────────────────────────────
app.get('/api/backup/status', authMiddleware, async (req, res) => {
  res.json(await pgBackup.getStatus());
});
app.post('/api/backup/now', authMiddleware, async (req, res) => {
  try {
    const r = await pgBackup.backupNow(db, uploadsDir);
    res.json({ ok: true, ...r });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Auth ──────────────────────────────────────────────────────────
app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip;
  const user = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    db.prepare('INSERT INTO login_attempts (email, ip, success) VALUES (?, ?, 0)').run(email || '', ip);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  db.prepare('INSERT INTO login_attempts (email, ip, success) VALUES (?, ?, 1)').run(email, ip);
  db.prepare("UPDATE admin_users SET last_login = datetime('now') WHERE id = ?").run(user.id);
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('ww_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ ok: true, token, email: user.email });
});
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('ww_token');
  res.json({ ok: true });
});
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ email: req.user.email, id: req.user.id });
});

// ── Retry engine (cron) ───────────────────────────────────────────
cron.schedule('*/5 * * * *', async () => {
  if (!WEBHOOK_URL) return;
  const failing = db.prepare("SELECT * FROM leads WHERE webhook_status = 'failed' AND retry_count < 5 ORDER BY created_at ASC LIMIT 5").all();
  for (const lead of failing) {
    const result = await deliverWebhook(lead);
    const status = result.status === 'sent' ? 'sent' : (lead.retry_count + 1 >= 5 ? 'needs_manual_resend' : 'failed');
    db.prepare('UPDATE leads SET webhook_status = ?, retry_count = retry_count + 1 WHERE id = ?').run(status, lead.id);
    if (status === 'sent') console.log(`[Retry] Lead ${lead.id} delivered`);
  }
});

cron.schedule('0 2 * * *', () => {
  const totalLeads = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  const closed = db.prepare("SELECT COUNT(*) as c FROM leads WHERE pipeline_stage = 'closed'").get().c;
  const rate = totalLeads ? Math.round((closed / totalLeads) * 100) + '%' : '—';
  db.prepare("INSERT INTO stats_cache (metric, value, computed_at) VALUES ('success_rate', ?, datetime('now')) ON CONFLICT(metric) DO UPDATE SET value = excluded.value").run(rate);
  db.prepare("INSERT INTO stats_cache (metric, value, computed_at) VALUES ('stores_delivered', ?, datetime('now')) ON CONFLICT(metric) DO UPDATE SET value = excluded.value").run(String(closed || totalLeads));
  console.log('[Cron] stats_cache refreshed');
});

// ── Fallback: serve SPA ───────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin', 'index.html'));
});
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║  WAYWEALTH Venture Studio  v2.0         ║
  ║  → http://localhost:${PORT}               ║
  ║  → Admin http://localhost:${PORT}/admin   ║
  ║  → Admin ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}  ║
  ╚══════════════════════════════════════════╝
  `);
});