/* WAYWEALTH — Modern motion layer v3: smooth, vibrant, 3D */
(function () {
  'use strict';
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

  stagger(); bindAllTilt();
  // re-run after dynamic content arrives
  setTimeout(() => { stagger(); bindAllTilt(); }, 1500);
  setTimeout(() => { stagger(); bindAllTilt(); }, 3500);
})();
