# Deploy WayWealth FREE — GitHub + Render + Cloudflare

Your domain is already on Cloudflare — perfect. This stack deploys your **full Node+SQLite site** free (no credit card needed for Render free tier). Takes ~10 mins.

> **Important SQLite warning (free tier):** Render free web services use **ephemeral disk** — `data/waywealth.db` and `public/uploads` will reset on each deploy/restart. For a real business, add a free Postgres or Turso later (steps at bottom). For now your site will work, but back up leads via Admin → Export CSV.

---

### STEP 1 — Push to GitHub (no git installed? use web UI)

**Option A — GitHub Web UI (easiest, no install):**
1. Go to https://github.com/new → Repository name `waywealth` → **Create repository** (Public, don't add README)
2. On the new repo page click **uploading an existing file** → drag ALL files from `C:\Users\USER\Documents\AI PORTFOLIO` (including `server.js`, `package.json`, `render.yaml`, `public/`, `admin/`) → **Commit directly**
   - Do NOT upload `node_modules/` or `data/waywealth.db` (they are ignored by `.gitignore`)

**Option B — If you install Git later:**
```bash
cd "C:\Users\USER\Documents\AI PORTFOLIO"
git init
git add .
git commit -m "WayWealth initial"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/waywealth.git
git push -u origin main
```
Install Git: https://git-scm.com/download/win → winget: `winget install --id Git.Git -e`

---

### STEP 2 — Deploy on Render (free)

1. Go to https://dashboard.render.com → **Sign up with GitHub**
2. Click **New + → Web Service** → **Connect** your `waywealth` repo (authorize Render)
3. Render auto-detects `render.yaml` — verify:
   - **Name:** waywealth
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. Click **Advanced → Add Environment Variable:**
   - Key: `JWT_SECRET` Value: paste a long random string (e.g. generate at https://generate-secret.vercel.app/32) — **SAVE this**
   - Key: `NODE_ENV` Value: `production`
5. Click **Create Web Service** → wait 2-4 mins. When live you get URL like `https://waywealth.onrender.com`
6. Test: open `https://waywealth.onrender.com/health` → `{"ok":true}`
      `https://waywealth.onrender.com/admin` → login `admin` / `WayWealth2024!`

Render free sleeps after 15 min inactivity (wakes in ~30s) — that's normal.

---

### STEP 3 — Connect your Cloudflare domain (free)

**In Render:**
1. Dashboard → your service → **Settings → Custom Domain → Add Custom Domain**
2. Enter `waywealth.com` (or `www.waywealth.com`) → Render shows required DNS record, e.g. `CNAME www → waywealth.onrender.com` or `A` record.

**In Cloudflare:**
1. https://dash.cloudflare.com → select your domain → **DNS → Records → Add record**
   - If Render gave CNAME: Type `CNAME` | Name `www` | Target `waywealth.onrender.com` | **Proxy OFF (grey cloud ☁️)** first — verify it works, then you can turn proxy ON (orange ☁️) if you want Cloudflare speed.
   - If apex `waywealth.com`: Type `CNAME` | Name `@` | Target `waywealth.onrender.com` (Cloudflare allows CNAME flattening) — or use Render's `A` if provided.
2. **SSL/TLS → Overview → Set to `Full`** (not Flexible). Render already provides HTTPS.
3. Wait 2-10 mins → Cloudflare shows record → back in Render click **Verify**. Render auto-issues Let's Encrypt cert (5-10 mins, may need to wait).

Test: `https://www.waywealth.com` → your site with styles. Admin at `https://www.waywealth.com/admin`

**Optional Cloudflare speed:**
- SSL/TLS → Edge Certificates → **Always Use HTTPS: ON**
- Speed → Optimization → **Auto Minify: JS/CSS**

---

### Free persistence fix (recommended after launch)

SQLite will wipe on Render free. Two free upgrades:

**A) Add Render Postgres (free tier 90 days then may expire, or use Neon free forever):**
- Render → New + → PostgreSQL (free) → swap `sqlite3` for `pg` in `server.js` (ask me to convert for you).
**B) Use Turso (SQLite cloud, free forever, drop-in):**
- https://turso.tech → create DB → I can migrate `waywealth.db` to Turso libsql in 5 mins.

For now, **export leads weekly:** Admin → Leads → Export CSV.

---

### Checklist

- [ ] GitHub repo created and files pushed
- [ ] Render web service live (`/health` OK)
- [ ] Custom domain added in Render and DNS added in Cloudflare
- [ ] Cloudflare SSL = Full, Verify in Render → Certificate Issued
- [ ] Change admin password: Admin → Settings → Change Password
- [ ] Update WhatsApp number & Calendly link: Admin → Content Editor

Need me to do the Postgres/Turso migration now? Tell me your Render URL and I’ll patch `server.js` for persistent DB.
