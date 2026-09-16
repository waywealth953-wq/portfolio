/* WAYWEALTH — Modern motion layer v3: smooth, vibrant, 3D */
(function () {
  'use strict';
  // Signal that motion is active — CSS only hides pre-reveal elements when
  // this class exists, so content can NEVER be stuck invisible (no-JS safe).
  document.documentElement.classList.add('motion-on');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => [...(c || document).querySelectorAll(s)];

  /* ── Scroll progress + back-to-top ── */
  const bar = $('#scrollProgress'), toTop = $('#toTop');
  function onScroll() {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    const p = max > 0 ? (h.scrollTop / max) * 100 : 0;
    if (bar) bar.style.width = p + '%';
    if (toTop) toTop.classList.toggle('show', h.scrollTop > 700);
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if (toTop) toTop.onclick = () => scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });

  /* ── Cursor glow follows mouse ── */
  const glow = $('#cursorGlow');
  if (glow && finePointer && !reduceMotion) {
    let x = -400, y = -400, tx = x, ty = y;
    addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function loop() {
      x += (tx - x) * 0.08; y += (ty - y) * 0.08;
      glow.style.left = x + 'px'; glow.style.top = y + 'px';
      requestAnimationFrame(loop);
    })();
  }

  /* ── Stagger delays for grids ── */
  function stagger() {
    $$('#portfolioGrid .card, #proofGrid .card, #certificatesGrid .card, #testimonialsGrid .card, #pricingGrid .price-card, #processGrid .step').forEach((el, i) => {
      el.classList.add('reveal');
      el.dataset.delay = String((i % 4) + 1);
    });
    watchReveals();
  }

  /* ── Reveal observer: motion.js tags late-rendered cards with .reveal
        AFTER main.js already ran its own observer pass — without watching
        them here, tagged cards stay at opacity:0 (invisible but clickable). ── */
  const revealObs = ('IntersectionObserver' in window && !reduceMotion) ? new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); e.target.classList.add('in3d'); revealObs.unobserve(e.target); } });
  }, { threshold: 0.12 }) : null;
  function watchReveals() {
    // No observer (old browser) or reduced motion: show everything immediately.
    if (reduceMotion || !revealObs) { $$('.reveal:not(.in)').forEach(el => { el.classList.add('in'); el.classList.add('in3d'); }); return; }
    $$('.reveal:not(.in)').forEach(el => {
      if (el._rob) return;
      el._rob = true;
      revealObs.observe(el);
    });
  }

  /* ── 3D tilt ── */
  function bindTilt(el) {
    if (el._tiltBound || !finePointer || reduceMotion) return;
    el._tiltBound = true;
    el.classList.add('tilt');
    // shine + cta affordance for gallery cards
    if (el.classList.contains('card') && !el.querySelector('.card-shine')) {
      const s = document.createElement('div'); s.className = 'card-shine'; el.appendChild(s);
      const cta = document.createElement('span'); cta.className = 'card-cta'; cta.textContent = '↗'; el.appendChild(cta);
    }
    const strength = el.id === 'heroMockup' ? 10 : 7;
    let raf = null;
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--mx', ((px + 0.5) * 100).toFixed(1) + '%');
      el.style.setProperty('--my', ((py + 0.5) * 100).toFixed(1) + '%');
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `rotateY(${px * strength * 2}deg) rotateX(${-py * strength * 2}deg) translateZ(6px)`;
      });
    });
    el.addEventListener('mouseleave', () => {
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = '';
    });
  }
  function bindAllTilt() {
    $$('[data-tilt]').forEach(bindTilt);
    $$('#portfolioGrid .card, #proofGrid .card, #certificatesGrid .card, #testimonialsGrid .card, .price-card, #processGrid .step, .expert-card').forEach(bindTilt);
  }

  /* Re-bind when dynamic galleries render */
  const mo = new MutationObserver(() => { stagger(); bindAllTilt(); });
  ['portfolioGrid', 'proofGrid', 'certificatesGrid', 'testimonialsGrid', 'pricingGrid', 'processGrid', 'expertsGrid'].forEach(id => {
    const el = document.getElementById(id);
    if (el) mo.observe(el, { childList: true });
  });

  /* ── Hero parallax on mouse ── */
  const hero = $('#heroSec'), mockup = $('#heroMockup');
  if (hero && finePointer && !reduceMotion) {
    hero.addEventListener('mousemove', e => {
      const r = hero.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      $$('.orb', hero).forEach((o, i) => {
        const f = (i + 1) * 14;
        o.style.translate = `${dx * f}px ${dy * f}px`;
      });
      $$('.float-chip').forEach((c, i) => {
        const f = (i + 1) * 10;
        c.style.translate = `${dx * f}px ${dy * f}px`;
      });
      if (mockup && !mockup.matches(':hover')) {
        mockup.style.transform = `rotateY(${dx * 10}deg) rotateX(${-dy * 10}deg)`;
      }
    });
    hero.addEventListener('mouseleave', () => {
      $$('.orb', hero).forEach(o => (o.style.translate = ''));
      if (mockup) mockup.style.transform = '';
    });
  }

  /* ── Magnetic buttons ── */
  if (finePointer && !reduceMotion) {
    $$('.btn-primary').forEach(btn => {
      btn.classList.add('btn-magnetic');
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        btn.style.transform = `translate(${dx * 0.08}px, ${dy * 0.12}px)`;
      });
      btn.addEventListener('mouseleave', () => (btn.style.transform = ''));
    });
  }

  /* ── Smooth anchor scrolling with header offset ── */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', id);
  });

  /* ── Hero particle canvas: floating 3D-ish network ── */
  (function particles() {
    const cv = $('#bgCanvas');
    if (!cv || reduceMotion) return;
    const ctx = cv.getContext('2d');
    let W, H, pts = [];
    function resize() {
      const r = cv.parentElement.getBoundingClientRect();
      W = cv.width = r.width; H = cv.height = r.height;
      const n = Math.min(70, Math.floor(W / 18));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        z: 0.3 + Math.random() * 0.7,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        hue: [152, 190, 265, 45][Math.floor(Math.random() * 4)]
      }));
    }
    resize(); addEventListener('resize', resize);
    let mx = -999, my = -999;
    cv.parentElement.addEventListener('mousemove', e => {
      const r = cv.getBoundingClientRect();
      mx = e.clientX - r.left; my = e.clientY - r.top;
    });
    (function draw() {
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.x += p.vx * p.z; p.y += p.vy * p.z;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy);
        if (d < 130) { p.x += (dx / d) * 0.7; p.y += (dy / d) * 0.7; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4 * p.z + 0.6, 0, 7);
        ctx.fillStyle = `hsla(${p.hue},70%,55%,${0.35 * p.z + 0.15})`;
        ctx.fill();
      }
      // links
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 110) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(124,58,237,${(1 - d / 110) * 0.14})`;
          ctx.lineWidth = 1; ctx.stroke();
        }
      }
      requestAnimationFrame(draw);
    })();
  })();

  /* ── Active nav link on scroll ── */
  (function spy() {
    const links = $$('#nav a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    const map = {};
    links.forEach(a => (map[a.getAttribute('href').slice(1)] = a));
    const obs = new IntersectionObserver(es => {
      es.forEach(e => {
        if (e.isIntersecting && map[e.target.id]) {
          links.forEach(a => a.classList.remove('active'));
          map[e.target.id].classList.add('active');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(map).forEach(id => { const s = document.getElementById(id); if (s) obs.observe(s); });
  })();

  /* ── Professional 3D background: perspective particle field ── */
  (function bg3d() {
    const cv = $('#bg3d');
    if (!cv || reduceMotion) return;
    const hero = $('#heroSec');
    const ctx = cv.getContext('2d');
    const COLORS = ['15,157,88', '124,58,237', '201,162,39', '6,182,212'];
    let W = 0, H = 0, cx = 0, cy = 0, tmx = 0, tmy = 0, mx = 0, my = 0;
    let pts = [], running = false, raf = 0;
    const N = 110, FOCAL = 320;
    function spawn(p) {
      p.x = (Math.random() - 0.5) * W * 1.6;
      p.y = (Math.random() - 0.5) * H * 1.6;
      p.z = Math.random() * FOCAL + 20;
      p.c = COLORS[(Math.random() * COLORS.length) | 0];
      p.r = 0.8 + Math.random() * 1.8;
      return p;
    }
    function resize() {
      const r = cv.parentElement.getBoundingClientRect();
      const dpr = Math.min(1.5, devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = Math.max(1, W * dpr); cv.height = Math.max(1, H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2; cy = H / 2;
      if (!pts.length) for (let i = 0; i < N; i++) pts.push(spawn({}));
    }
    function frame() {
      if (!running) return;
      mx += (tmx - mx) * 0.04; my += (tmy - my) * 0.04;
      ctx.clearRect(0, 0, W, H);
      const vx = cx + mx * 60, vy = cy + my * 40;
      for (const p of pts) {
        p.z -= 1.1;
        if (p.z < 8) spawn(p);
        const s = FOCAL / p.z;
        const x = vx + p.x * s * 0.28, y = vy + p.y * s * 0.28;
        if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
        const a = Math.min(0.55, (1 - p.z / (FOCAL + 20)) * 0.6 + 0.08);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.4, p.r * s * 0.5), 0, 7);
        ctx.fillStyle = `rgba(${p.c},${a.toFixed(3)})`;
        ctx.fill();
      }
      drawShape();
      raf = requestAnimationFrame(frame);
    }
    function play() { if (!running) { running = true; frame(); } }
    function stop() { running = false; cancelAnimationFrame(raf); }
    /* True-3D wireframe icosahedron: perspective-projected, depth-shaded */
    const PHI = (1 + Math.sqrt(5)) / 2;
    const V3 = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]];
    const E3 = [];
    for (let i = 0; i < V3.length; i++) for (let j = i + 1; j < V3.length; j++) {
      const dx = V3[i][0] - V3[j][0], dy = V3[i][1] - V3[j][1], dz = V3[i][2] - V3[j][2];
      if (Math.abs(Math.hypot(dx, dy, dz) - 2) < 0.01) E3.push([i, j]);
    }
    let shapeAng = 0;
    function drawShape() {
      if (W < 10) return;
      shapeAng += 0.0038;
      const narrow = W < 720;
      const ax = 0.55 + my * 0.9, ay = shapeAng + mx * 1.4;
      const cxA = Math.cos(ax), sxA = Math.sin(ax), cyA = Math.cos(ay), syA = Math.sin(ay);
      const R = Math.min(W, H) * 0.17;
      const ox = narrow ? W * 0.5 : W * 0.74, oy = H * 0.46;
      const DIST = 5, fade = narrow ? 0.45 : 0.8;
      const P = V3.map(v => {
        const x1 = v[0] * cyA + (v[1] * sxA + v[2] * cxA) * syA;
        const y1 = v[1] * cxA - v[2] * sxA;
        const z1 = -v[0] * syA + (v[1] * sxA + v[2] * cxA) * cyA;
        const s = DIST / (DIST + z1);
        return [ox + x1 * R * s, oy + y1 * R * s, s];
      });
      ctx.lineWidth = 1;
      for (const [a, b] of E3) {
        const s = (P[a][2] + P[b][2]) / 2;
        ctx.beginPath();
        ctx.moveTo(P[a][0], P[a][1]);
        ctx.lineTo(P[b][0], P[b][1]);
        ctx.strokeStyle = `rgba(15,157,88,${(0.34 * s * fade).toFixed(3)})`;
        ctx.stroke();
      }
      for (const p of P) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], Math.max(0.6, 1.7 * p[2] * 0.6), 0, 7);
        ctx.fillStyle = `rgba(201,162,39,${(0.5 * p[2] * fade).toFixed(3)})`;
        ctx.fill();
      }
    }
    resize();
    addEventListener('resize', resize);
    if (hero) {
      hero.addEventListener('mousemove', e => {
        const r = hero.getBoundingClientRect();
        tmx = (e.clientX - r.left) / r.width - 0.5;
        tmy = (e.clientY - r.top) / r.height - 0.5;
      }, { passive: true });
      hero.addEventListener('mouseleave', () => { tmx = 0; tmy = 0; });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(es => { es[0].isIntersecting ? play() : stop(); }).observe(hero);
      } else play();
    } else play();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (!hero || hero.getBoundingClientRect().bottom > 0) play();
    });
  })();

  /* Slider removed — previous grid + full preview popup only. */

  /* ── 3D entrances hero → footer: FAQ, footer blocks, anything late ── */
  const D3_SEL = '.faq-item:not(.d3),.footer-grid > div:not(.d3),.footer-bottom:not(.d3)';
  function tag3d(scope) {
    const root = scope || document;
    if (root.nodeType !== 1 && root !== document) return;
    const found = [];
    if (root !== document && root.matches) {
      try { if (root.matches('.faq-item,.footer-grid > div,.footer-bottom') && !root.classList.contains('d3')) found.push(root); } catch {}
    }
    root.querySelectorAll(D3_SEL).forEach(el => found.push(el));
    found.forEach((el, i) => {
      el.classList.add('reveal', 'd3');
      el.dataset.delay = String((i % 4) + 1);
    });
    if (found.length) watchReveals();
  }
  tag3d(document);
  new MutationObserver(es => {
    for (const e of es) for (const n of e.addedNodes) tag3d(n);
  }).observe(document.body, { childList: true, subtree: true });

  /* ── Page-wide depth glow with scroll parallax ── */
  (function pageDepth() {
    if (reduceMotion) return;
    const g = document.createElement('div');
    g.className = 'page-glow';
    g.setAttribute('aria-hidden', 'true');
    document.body.prepend(g);
    let tick = false;
    addEventListener('scroll', () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => {
        tick = false;
        g.style.transform = `translateY(${(scrollY * 0.08).toFixed(1)}px)`;
      });
    }, { passive: true });
  })();

  /* ── Magnetic 3D buttons: pulled toward the cursor ── */
  (function magnetic() {
    if (!finePointer || reduceMotion) return;
    $$('.btn').forEach(b => {
      let raf = 0;
      b.addEventListener('mousemove', e => {
        const r = b.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          b.style.transform = `translate(${(dx * 0.12).toFixed(1)}px,${(dy * 0.18).toFixed(1)}px)`;
          b.style.boxShadow = '0 10px 26px rgba(18,18,18,.20)';
        });
      });
      b.addEventListener('mouseleave', () => {
        cancelAnimationFrame(raf);
        b.style.transform = '';
        b.style.boxShadow = '';
      });
    });
  })();

  /* ── Layered hero parallax: each line floats at its own depth ── */
  (function heroDepth() {
    const hero = $('#heroSec');
    if (!hero || !finePointer || reduceMotion) return;
    const layers = $$('.hero-grid > div:first-child > *').map((el, i) => ({ el, d: (i + 1) * 7 }));
    if (!layers.length) return;
    let tx = 0, ty = 0, x = 0, y = 0, visible = false;
    hero.addEventListener('mousemove', e => {
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
    }, { passive: true });
    hero.addEventListener('mouseleave', () => { tx = 0; ty = 0; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(hero);
    } else visible = true;
    (function loop() {
      requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      x += (tx - x) * 0.07; y += (ty - y) * 0.07;
      if (Math.abs(x) < 0.0004 && Math.abs(y) < 0.0004 && tx === 0 && ty === 0) {
        layers.forEach(l => { if (l.el.style.transform) l.el.style.transform = ''; });
        return;
      }
      layers.forEach(l => {
        l.el.style.transform = `translate3d(${(x * l.d).toFixed(1)}px,${(y * l.d).toFixed(1)}px,0)`;
      });
    })();
  })();

  /* ── Easy navigation: progress bar, back-to-top, scrollspy (no content touched) ── */
  (function navAids() {
    const bar = $('#scrollProgress'), top = $('#toTop');
    function onScroll() {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      if (bar) bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
      if (top) top.classList.toggle('show', h.scrollTop > 700);
    }
    let tick = false;
    addEventListener('scroll', () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => { tick = false; onScroll(); });
    }, { passive: true });
    onScroll();
    if (top) top.addEventListener('click', () =>
      scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
    // Scrollspy: highlight the nav link for the section in view
    const links = $$('#nav a[href^="#"]');
    if (links.length && 'IntersectionObserver' in window) {
      const map = {};
      links.forEach(a => { map[a.getAttribute('href').slice(1)] = a; });
      const obs = new IntersectionObserver(es => {
        es.forEach(e => {
          if (e.isIntersecting && map[e.target.id]) {
            links.forEach(a => a.classList.remove('active'));
            map[e.target.id].classList.add('active');
          }
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      Object.keys(map).forEach(id => {
        const s = document.getElementById(id);
        if (s) obs.observe(s);
      });
    }
  })();

  stagger(); bindAllTilt(); watchReveals();
  // re-run after dynamic content arrives
  setTimeout(() => { stagger(); bindAllTilt(); watchReveals(); }, 1500);
  setTimeout(() => { stagger(); bindAllTilt(); watchReveals(); }, 3500);
})();

/* ── Full preview popup: one section → complete detail view ──
   main.js hands every gallery click here (window.WW_PREVIEW.open).
   Items + siblings come from the same /api/media data — no duplication. */
window.WW_PREVIEW = (function () {
  'use strict';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);
  let cache = null, list = [], idx = 0;

  async function all() {
    if (cache) return cache;
    try {
      const r = await fetch('/api/media');
      cache = await r.json();
    } catch { cache = []; }
    return cache;
  }
  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function render() {
    const m = list[idx];
    if (!m) return;
    const card = $('previewCard');
    $('previewImg').src = m.url;
    $('previewImg').alt = m.alt_text || m.caption || 'Preview';
    $('previewTag').textContent = m.category || 'Featured';
    $('previewTitle').textContent = m.caption || 'Untitled';
    $('previewDesc').textContent = m.alt_text || '';
    $('previewDesc').style.display = m.alt_text ? '' : 'none';
    $('previewCount').textContent = `${idx + 1} / ${list.length}`;
    const multi = list.length > 1;
    $('previewPrev').style.display = multi ? '' : 'none';
    $('previewNext').style.display = multi ? '' : 'none';
    if (!reduceMotion && card) {
      card.classList.remove('swap');
      void card.offsetWidth;
      card.classList.add('swap');
    }
    try { if (typeof track === 'function') track('gallery_open', m.url); } catch {}
  }
  function openModal() {
    const modal = $('previewModal');
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    const modal = $('previewModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  function go(n) {
    if (!list.length) return;
    idx = (n + list.length) % list.length;
    render();
  }
  async function open(src, alt) {
    const items = await all();
    const cur = items.find(m => m.url === src);
    list = cur ? items.filter(m => m.type === cur.type) : items.slice();
    idx = Math.max(0, list.findIndex(m => m.url === src));
    if (!list.length) { list = [{ url: src, caption: alt || '', category: '', alt_text: '' }]; idx = 0; }
    render();
    openModal();
  }
  function wire() {
    if ($('previewClose')) $('previewClose').onclick = close;
    if ($('previewBackdrop')) $('previewBackdrop').onclick = close;
    if ($('previewPrev')) $('previewPrev').onclick = e => { e.stopPropagation(); go(idx - 1); };
    if ($('previewNext')) $('previewNext').onclick = e => { e.stopPropagation(); go(idx + 1); };
    document.addEventListener('keydown', e => {
      const modal = $('previewModal');
      if (!modal || !modal.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') go(idx - 1);
      if (e.key === 'ArrowRight') go(idx + 1);
    });
    let tx = 0;
    const card = $('previewCard');
    if (card) {
      card.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
      card.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - tx;
        if (Math.abs(dx) > 48) go(idx + (dx < 0 ? 1 : -1));
      }, { passive: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
  return { open, close };
})();
