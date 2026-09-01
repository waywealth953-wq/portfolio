# WayWealth — Dropshipping Store Launch Website

Two connected parts: **Public Frontend** (light-mode SaaS landing) + **Admin Backend** (private dashboard).

## Quick Start
```bash
npm install
npm start
# http://localhost:3000  (public site)
# http://localhost:3000/admin  (admin dashboard)
# Default login: admin / WayWealth2024!
```

## Project Structure
```
server.js              — Express + SQLite backend (all APIs, auth, uploads)
public/
  index.html           — Public landing (all sections, lightbox, form)
  css/style.css        — Stripe/Linear-style design system (CSS variables for theming)
  js/app.js            — Dynamic content loading, galleries, form, tracking
  uploads/             — User-uploaded images (portfolio, proof, logo, favicon)
admin/
  index.html           — Admin SPA (analytics, content editor, media, leads, faqs)
data/
  waywealth.db         — SQLite database (auto-created)
```

## Features Implemented
- **Frontend**: Navbar, Hero, Stats strip, Portfolio gallery, Sales proof gallery, How It Works, Pricing, Testimonials, FAQ accordion, Lead form + WhatsApp CTAs, Footer. All rendered from DB via `/api/content`.
- **Lead Form**: All spec fields (name, storeName, budget, storeStatus, wasScammed, scamDetails conditional, whatsapp, email, contactTime, source, consent, honeypot), client validation, success state with WhatsApp deep link, POST to `/api/leads`.
- **WhatsApp & Booking**: Every CTA uses `https://wa.me/<number>?text=<msg>` from DB; booking link editable (Calendly/Cal.com or fallback to form anchor). Tracked separately via `cta_click` events.
- **Admin**: JWT auth, content editor (all text, links, colors, fonts, logo/favicon upload with CSS custom properties), media manager (portfolio/sales), testimonials, FAQs, leads table (filter/search/status + CSV export), analytics (views, unique visitors, CTR by placement, funnel, traffic source, daily charts).
- **Security**: Helmet, rate limiting (form + login), bcrypt password hashing, JWT 12h expiry, honeypot, input sanitization via `textContent` escaping, auth-gated admin routes.

## Data Model
`content` (key/value), `media` (type/url/caption/order), `leads`, `events` (page_view/cta_click/form_start/form_submit), `admin_users`, `testimonials`, `faqs`.

## Environment
Set `PORT` and `JWT_SECRET` env vars in production. Change default password immediately via Admin → Settings.
