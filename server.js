const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'waywealth-secret-change-me-2024';
const ADMIN_DEFAULT_USER = 'admin';
const ADMIN_DEFAULT_PASS = 'WayWealth2024!';

// Middleware
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check for Render
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// Ensure dirs
['public/uploads', 'data'].forEach(d => {
  const dir = path.join(__dirname, d);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// SQLite setup
const dbPath = path.join(__dirname, 'data', 'waywealth.db');
const db = new sqlite3.Database(dbPath);

function initDB() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS content (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      caption TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      storeName TEXT NOT NULL,
      budget TEXT NOT NULL,
      storeStatus TEXT NOT NULL,
      wasScammed TEXT NOT NULL,
      scamDetails TEXT,
      whatsapp TEXT NOT NULL,
      email TEXT NOT NULL,
      contactTime TEXT,
      source TEXT,
      consent INTEGER DEFAULT 1,
      status TEXT DEFAULT 'new',
      pageUrl TEXT,
      submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      element_id TEXT,
      page_url TEXT,
      session_id TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS testimonials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT,
      quote TEXT NOT NULL,
      photo TEXT,
      sort_order INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS faqs (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )`);

    // Seed admin
    db.get("SELECT id FROM admin_users WHERE username=?", [ADMIN_DEFAULT_USER], (err, row) => {
      if (!row) {
        const hash = bcrypt.hashSync(ADMIN_DEFAULT_PASS, 10);
        db.run("INSERT INTO admin_users (id,username,password_hash) VALUES (?,?,?)", [uuidv4(), ADMIN_DEFAULT_USER, hash]);
        console.log(`Default admin created: ${ADMIN_DEFAULT_USER} / ${ADMIN_DEFAULT_PASS}`);
      }
    });

    // Ensure new content keys exist (migration for existing DB)
    const ensureDefaults = {
      expert_title: "Meet the Expert Behind WayWealth",
      expert_subtitle: "Real experience, real results — building profitable stores for entrepreneurs across Africa and beyond.",
    };
    Object.entries(ensureDefaults).forEach(([k,v])=>{
      db.run("INSERT OR IGNORE INTO content (key,value) VALUES (?,?)", [k,v]);
    });
    // Seed default content if empty
    db.get("SELECT COUNT(*) as c FROM content", (err, row) => {
      if (row && row.c === 0) {
        const defaults = {
          // Brand
          site_name: "WayWealth",
          logo_url: "",
          favicon_url: "",
          whatsapp_number: "2348123456789",
          whatsapp_message: "Hi, I want to start a dropshipping store with WayWealth!",
          booking_link: "https://calendly.com/waywealth/intro",
          // Theme
          color_primary: "#0B1D3A",
          color_accent: "#0E9F6E",
          color_background: "#FFFFFF",
          color_text: "#1a2744",
          color_button: "#0E9F6E",
          font_family: "Inter",
          // Hero
          hero_headline: "Your Profitable Dropshipping Store — Built For You, Ready To Sell",
          hero_subheadline: "We design, build, and launch high-converting Shopify stores that look premium and sell from day one. No templates. No delays. Just results.",
          hero_cta_primary: "Book a Free Call",
          hero_cta_secondary: "Chat on WhatsApp",
          hero_image: "",
          hero_badge: "✓ Trusted by 200+ entrepreneurs",
          // Social proof
          proof_stat_1_value: "200+",
          proof_stat_1_label: "Stores Launched",
          proof_stat_2_value: "₦47M+",
          proof_stat_2_label: "Verified Client Sales",
          proof_stat_3_value: "98%",
          proof_stat_3_label: "Client Satisfaction",
          proof_stat_4_value: "7 Days",
          proof_stat_4_label: "Avg. Delivery Time",
          // How it works
          hiw_title: "How It Works",
          hiw_subtitle: "From idea to income in 4 simple steps",
          hiw_step1_title: "Consult",
          hiw_step1_desc: "We learn your niche, budget, and goals in a free strategy call.",
          hiw_step2_title: "Build",
          hiw_step2_desc: "Our team crafts your premium store — product research, design & copy included.",
          hiw_step3_title: "Launch",
          hiw_step3_desc: "We set up payments, shipping, and go live with your ready-to-sell store.",
          hiw_step4_title: "Support",
          hiw_step4_desc: "30 days of post-launch support, training, and growth guidance.",
          // Pricing
          pricing_title: "Simple, Transparent Pricing",
          pricing_subtitle: "Choose the package that fits your ambition",
          pricing_show: "true",
          // Urgency banner
          banner_enabled: "false",
          banner_text: "🔥 Limited slots this month — 3 spots left! Book now & get free product research.",
          // Footer
          footer_text: "© 2026 WayWealth. We build stores that sell. All rights reserved.",
          footer_email: "hello@waywealth.com",
          footer_address: "Lagos, Nigeria",
          // Testimonials / Client Reviews
          testimonials_title: "What Our Clients Say",
          testimonials_subtitle: "Real feedback from real store owners — pictures and videos",
          // Expert
          expert_title: "Meet the Expert Behind WayWealth",
          expert_subtitle: "Real experience, real results — building profitable stores for entrepreneurs across Africa and beyond.",
          // FAQ title
          faq_title: "Frequently Asked Questions",
          faq_subtitle: "Everything you need to know",
          // CTA section
          cta_title: "Ready to Launch Your Store?",
          cta_subtitle: "Fill the form below or chat with us directly. We respond within 24 hours.",
        };
        const stmt = db.prepare("INSERT INTO content (key,value) VALUES (?,?)");
        Object.entries(defaults).forEach(([k, v]) => stmt.run(k, v));
        stmt.finalize();
      }
    });

    // Seed FAQs
    db.get("SELECT COUNT(*) as c FROM faqs", (err, row) => {
      if (row && row.c === 0) {
        const faqs = [
          { q: "Is this a scam? How do I know you're legit?", a: "We understand the concern — many have been scammed before. That's why we show verified store screenshots, sales proof, and client testimonials. You own everything we build, and payment is milestone-based. No hidden fees." },
          { q: "How long does it take to build my store?", a: "Most stores are ready in 5–7 business days after the consultation. Complex custom builds may take up to 10 days. You'll get regular updates throughout." },
          { q: "Do I own the store after you build it?", a: "Absolutely. 100% ownership. Your Shopify account, your domain, your store — we just build it. You keep all revenue." },
          { q: "What if I already have a store?", a: "We can audit, redesign, and optimize your existing store for higher conversions. Select 'Already have a store' in the form and we'll tailor the approach." },
          { q: "Do you provide support after launch?", a: "Yes — 30 days of post-launch support including fixes, training videos, and growth tips. Extended support plans are available." },
          { q: "What's included in the price?", a: "Premium design, product research (for new stores), copywriting, payment setup, shipping config, mobile optimization, and launch checklist. Hosting/domain is separate via Shopify (~$39/mo)." },
        ];
        faqs.forEach(f => db.run("INSERT INTO faqs (id,question,answer,sort_order) VALUES (?,?,?,?)", [uuidv4(), f.q, f.a, Math.random()]));
      }
    });

    // Seed testimonials
    db.get("SELECT COUNT(*) as c FROM testimonials", (err, row) => {
      if (row && row.c === 0) {
        const t = [
          { name: "Chinedu O.", role: "Fashion Store Owner", quote: "WayWealth delivered in 6 days. My store made its first sale in 48 hours. The design is premium — customers trust it instantly." },
          { name: "Aisha B.", role: "Beauty Niche", quote: "I was scammed before. WayWealth was different — transparent, professional, and they actually over-delivered. My store looks like a $10k build." },
          { name: "Tunde K.", role: "Gadgets Store", quote: "Best investment. The team handled everything — I just watched my store go live. Support after launch was top-notch." },
        ];
        t.forEach(x => db.run("INSERT INTO testimonials (id,name,role,quote,sort_order) VALUES (?,?,?,?,?)", [uuidv4(), x.name, x.role, x.quote, Math.random()]));
      }
    });
  });
}
initDB();

// Helpers
function dbAll(sql, params = []) { return new Promise((res, rej) => db.all(sql, params, (e, rows) => e ? rej(e) : res(rows))); }
function dbGet(sql, params = []) { return new Promise((res, rej) => db.get(sql, params, (e, row) => e ? rej(e) : res(row))); }
function dbRun(sql, params = []) { return new Promise((res, rej) => db.run(sql, params, function (e) { e ? rej(e) : res(this); })); }

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
  // Also check cookie via parsing header
  let cookieToken = null;
  if (req.headers.cookie) {
    const m = req.headers.cookie.match(/token=([^;]+)/);
    if (m) cookieToken = decodeURIComponent(m[1]);
  }
  const t = token || cookieToken;
  if (!t) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(t, JWT_SECRET);
    req.user = payload;
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}

// Rate limiters
const formLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many submissions, try later' } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many login attempts' } });

// Multer for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const ALLOWED_TYPES = ['portfolio','sales','review_pic','review_video','expert','website'];
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const ok = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
  if (!ok) return cb(new Error('Only images and videos allowed'));
  cb(null, true);
}});
const uploadAny = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const ok = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
  if (!ok) return cb(new Error('Only images and videos allowed'));
  cb(null, true);
}});

// Static files — must be before API routes for correct MIME
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
// also serve admin explicitly for /admin and /admin/
app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// ============ API ROUTES ============

// Content - public read
app.get('/api/content', async (req, res) => {
  try {
    const rows = await dbAll("SELECT key,value FROM content");
    const obj = {};
    rows.forEach(r => obj[r.key] = r.value);
    res.json(obj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Content - admin update (auth)
app.put('/api/content', authMiddleware, async (req, res) => {
  try {
    const entries = req.body;
    for (const [k, v] of Object.entries(entries)) {
      await dbRun("INSERT INTO content (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=?, updated_at=CURRENT_TIMESTAMP", [k, String(v), String(v)]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Media
app.get('/api/media', async (req, res) => {
  const type = req.query.type;
  let sql = "SELECT * FROM media";
  let params = [];
  if (type) { sql += " WHERE type=?"; params.push(type); }
  sql += " ORDER BY sort_order ASC, created_at ASC";
  try { res.json(await dbAll(sql, params)); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/media', authMiddleware, uploadAny.single('file'), async (req, res) => {
  try {
    let { type, caption, url: bodyUrl } = req.body;
    type = (type || 'portfolio').trim();
    if (!ALLOWED_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid media type' });
    // Enforce exactly 4 for review_pic, review_video, expert
    const limitedTypes = ['review_pic','review_video','expert'];
    if (limitedTypes.includes(type)) {
      const cnt = await dbGet("SELECT COUNT(*) as c FROM media WHERE type=?", [type]);
      if ((cnt?.c || 0) >= 4) return res.status(400).json({ error: `${type} already has 4 items — delete one before adding` });
    }
    let url = '';
    let fieldName = req.file ? req.file.fieldName || 'file' : null;
    if (req.file) {
      url = '/uploads/' + req.file.filename;
    } else if (bodyUrl && bodyUrl.trim()) {
      // Allow embed link (youtube etc) or external image url
      url = bodyUrl.trim();
      // basic sanitization: must start with http or /
      if (!/^https?:\/\//.test(url) && !url.startsWith('/')) return res.status(400).json({ error: 'Invalid URL' });
    } else {
      return res.status(400).json({ error: 'No file or URL provided' });
    }
    const id = uuidv4();
    const maxRow = await dbGet("SELECT MAX(sort_order) as m FROM media WHERE type=?", [type]);
    const order = (maxRow?.m ?? 0) + 1;
    await dbRun("INSERT INTO media (id,type,url,caption,sort_order) VALUES (?,?,?,?,?)", [id, type, url, caption || '', order]);
    res.json({ id, url, caption, type });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Legacy upload with field name 'image' for backward compat
app.post('/api/media/legacy', authMiddleware, upload.single('image'), async (req, res) => {
  req.file = req.file;
  req.body.type = req.body.type || 'portfolio';
  return res.redirect(307, '/api/media');
});
app.delete('/api/media/:id', authMiddleware, async (req, res) => {
  try {
    const row = await dbGet("SELECT url FROM media WHERE id=?", [req.params.id]);
    if (row) {
      const fp = path.join(__dirname, 'public', row.url);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await dbRun("DELETE FROM media WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/media/reorder', authMiddleware, async (req, res) => {
  try {
    const { orderedIds } = req.body; // array of ids in new order
    for (let i = 0; i < orderedIds.length; i++) {
      await dbRun("UPDATE media SET sort_order=? WHERE id=?", [i, orderedIds[i]]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Testimonials
app.get('/api/testimonials', async (req, res) => {
  try { res.json(await dbAll("SELECT * FROM testimonials ORDER BY sort_order ASC")); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/testimonials', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    const { name, role, quote } = req.body;
    let photo = req.body.photo || '';
    if (req.file) photo = '/uploads/' + req.file.filename;
    const id = uuidv4();
    await dbRun("INSERT INTO testimonials (id,name,role,quote,photo,sort_order) VALUES (?,?,?,?,?,?)", [id, name, role, quote, photo, Date.now()]);
    res.json({ id, name, role, quote, photo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/testimonials/:id', authMiddleware, async (req, res) => {
  try {
    const { name, role, quote, photo } = req.body;
    await dbRun("UPDATE testimonials SET name=?,role=?,quote=?,photo=? WHERE id=?", [name, role, quote, photo, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/testimonials/:id', authMiddleware, async (req, res) => {
  try { await dbRun("DELETE FROM testimonials WHERE id=?", [req.params.id]); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// FAQs
app.get('/api/faqs', async (req, res) => {
  try { res.json(await dbAll("SELECT * FROM faqs ORDER BY sort_order ASC")); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/faqs', authMiddleware, async (req, res) => {
  try {
    const { question, answer } = req.body;
    const id = uuidv4();
    await dbRun("INSERT INTO faqs (id,question,answer,sort_order) VALUES (?,?,?,?)", [id, question, answer, Date.now()]);
    res.json({ id, question, answer });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/faqs/:id', authMiddleware, async (req, res) => {
  try { await dbRun("UPDATE faqs SET question=?,answer=? WHERE id=?", [req.body.question, req.body.answer, req.params.id]); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/faqs/:id', authMiddleware, async (req, res) => {
  try { await dbRun("DELETE FROM faqs WHERE id=?", [req.params.id]); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Leads
app.post('/api/leads', formLimiter, async (req, res) => {
  try {
    const { name, storeName, budget, storeStatus, wasScammed, scamDetails, whatsapp, email, contactTime, source, consent, pageUrl, honeypot } = req.body;
    if (honeypot) return res.json({ ok: true, message: 'Thanks!' }); // bot trap silent success
    if (!name || !storeName || !budget || !storeStatus || !wasScammed || !whatsapp || !email) return res.status(400).json({ error: 'Missing required fields' });
    if (!consent) return res.status(400).json({ error: 'Consent required' });
    // Basic validation
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) return res.status(400).json({ error: 'Invalid email' });
    if (whatsapp.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Invalid WhatsApp number' });

    const id = uuidv4();
    await dbRun(`INSERT INTO leads (id,name,storeName,budget,storeStatus,wasScammed,scamDetails,whatsapp,email,contactTime,source,consent,pageUrl,submittedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
      [id, name.trim(), storeName.trim(), budget, storeStatus, wasScammed, scamDetails || '', whatsapp.trim(), email.trim(), contactTime || '', source || '', consent ? 1 : 0, pageUrl || '']);
    // also log event
    await dbRun("INSERT INTO events (id,event_type,element_id,page_url,session_id) VALUES (?,?,?,?,?)", [uuidv4(), 'form_submit', 'lead_form', pageUrl || '', req.headers['x-session-id'] || '']);
    res.json({ ok: true, id, message: "Thanks! We'll reach out on WhatsApp within 24 hours" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/leads', authMiddleware, async (req, res) => {
  try { res.json(await dbAll("SELECT * FROM leads ORDER BY submittedAt DESC")); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/leads/:id/status', authMiddleware, async (req, res) => {
  try { await dbRun("UPDATE leads SET status=? WHERE id=?", [req.body.status, req.params.id]); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/leads/export', authMiddleware, async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM leads ORDER BY submittedAt DESC");
    let csv = 'Name,Store Name,Budget,Status,Scammed,Scam Details,WhatsApp,Email,Contact Time,Source,Lead Status,Submitted At\n';
    rows.forEach(r => {
      const esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
      csv += [esc(r.name), esc(r.storeName), esc(r.budget), esc(r.storeStatus), esc(r.wasScammed), esc(r.scamDetails), esc(r.whatsapp), esc(r.email), esc(r.contactTime), esc(r.source), esc(r.status), esc(r.submittedAt)].join(',') + '\n';
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="waywealth_leads.csv"');
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Events
app.post('/api/events', async (req, res) => {
  try {
    const { event_type, element_id, page_url, session_id, metadata } = req.body;
    if (!event_type) return res.status(400).json({ error: 'event_type required' });
    await dbRun("INSERT INTO events (id,event_type,element_id,page_url,session_id,metadata) VALUES (?,?,?,?,?,?)",
      [uuidv4(), event_type, element_id || '', page_url || '', session_id || '', metadata ? JSON.stringify(metadata) : '']);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/analytics', authMiddleware, async (req, res) => {
  try {
    const range = req.query.range || '30d';
    let days = 30;
    if (range === '7d') days = 7;
    if (range === '90d') days = 90;
    const totalViews = await dbGet("SELECT COUNT(*) as c FROM events WHERE event_type='page_view' AND created_at >= datetime('now', ?)", [`-${days} days`]);
    const uniqueVisitors = await dbGet("SELECT COUNT(DISTINCT session_id) as c FROM events WHERE event_type='page_view' AND created_at >= datetime('now', ?)", [`-${days} days`]);
    const ctaClicks = await dbAll("SELECT element_id, COUNT(*) as c FROM events WHERE event_type='cta_click' AND created_at >= datetime('now', ?) GROUP BY element_id", [`-${days} days`]);
    const formStarts = await dbGet("SELECT COUNT(*) as c FROM events WHERE event_type='form_start' AND created_at >= datetime('now', ?)", [`-${days} days`]);
    const formSubmits = await dbGet("SELECT COUNT(*) as c FROM events WHERE event_type='form_submit' AND created_at >= datetime('now', ?)", [`-${days} days`]);
    const leadsCount = await dbGet("SELECT COUNT(*) as c FROM leads WHERE submittedAt >= datetime('now', ?)", [`-${days} days`]);
    const trafficSource = await dbAll("SELECT source as label, COUNT(*) as c FROM leads WHERE submittedAt >= datetime('now', ?) GROUP BY source", [`-${days} days`]);
    const dailyViews = await dbAll("SELECT date(created_at) as date, COUNT(*) as c FROM events WHERE event_type='page_view' AND created_at >= datetime('now', ?) GROUP BY date(created_at) ORDER BY date ASC", [`-${days} days`]);
    const leadsDaily = await dbAll("SELECT date(submittedAt) as date, COUNT(*) as c FROM leads WHERE submittedAt >= datetime('now', ?) GROUP BY date(submittedAt) ORDER BY date ASC", [`-${days} days`]);
    res.json({ totalViews: totalViews.c, uniqueVisitors: uniqueVisitors.c, ctaClicks, formStarts: formStarts.c, formSubmits: formSubmits.c, leadsCount: leadsCount.c, trafficSource, dailyViews, leadsDaily });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Auth
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await dbGet("SELECT * FROM admin_users WHERE username=?", [username]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, username: user.username });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await dbGet("SELECT * FROM admin_users WHERE id=?", [req.user.id]);
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) return res.status(400).json({ error: 'Current password incorrect' });
    const hash = bcrypt.hashSync(newPassword, 10);
    await dbRun("UPDATE admin_users SET password_hash=? WHERE id=?", [hash, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/auth/me', authMiddleware, (req, res) => res.json({ user: req.user }));

// Website Image Manager: generic upload endpoint for hero etc (type=website) already handled via /api/media
// Logo/Favicon upload
app.post('/api/upload/logo', authMiddleware, uploadAny.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = '/uploads/' + req.file.filename;
  await dbRun("INSERT INTO content (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=?", ['logo_url', url, url]);
  res.json({ url });
});
app.post('/api/upload/favicon', authMiddleware, uploadAny.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = '/uploads/' + req.file.filename;
  await dbRun("INSERT INTO content (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=?", ['favicon_url', url, url]);
  res.json({ url });
});

app.listen(PORT, '0.0.0.0', () => console.log(`WayWealth running on http://localhost:${PORT} | Admin: http://localhost:${PORT}/admin`));
