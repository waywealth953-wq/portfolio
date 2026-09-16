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
    watchReveals();
  }

  /* ── Reveal observer: motion.js tags late-rendered cards with .reveal
        AFTER main.js already ran its own observer pass — without watching
        them here, tagged cards stay at opacity:0 (invisible but clickable). ── */
  const revealObs = ('IntersectionObserver' in window && !reduceMotion) ? new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); e.target.classList.add('in3d'); revealObs.unobserve(e.target); } });
  }, { threshold: 0.12 }) : null;
  function watchReveals() {
    if (reduceMotion) { $$('.reveal:not(.in)').forEach(el => { el.classList.add('in'); el.classList.add('in3d'); }); return; }
    if (!revealObs) return;
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
      raf = requestAnimationFrame(frame);
    }
    function play() { if (!running) { running = true; frame(); } }
    function stop() { running = false; cancelAnimationFrame(raf); }
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

  /* ── Professional 3D slides: featured showcase (same portfolio data) ── */
  (function slides() {
    const shell = $('#featuredSlides'), track = $('#slideTrack');
    if (!shell || !track) return;
    const dots = $('#slideDots'), prev = $('#slidePrev'), next = $('#slideNext');
    let items = [], idx = 0, timer = 0;
    const AUTOPLAY_MS = 5500;
    function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
    function layout() {
      const slides = $$('.slide', track);
      if (!slides.length) return;
      const vp = $('#slideViewport');
      const gap = 18;
      const w = slides[0].getBoundingClientRect().width + gap;
      const center = vp.clientWidth / 2 - slides[0].getBoundingClientRect().width / 2;
      track.style.transform = `translateX(${(center - idx * w).toFixed(1)}px)`;
      slides.forEach((s, i) => {
        s.classList.remove('is-active', 'is-side', 'is-far', 'slide-before', 'slide-after');
        const d = Math.abs(i - idx);
        if (i === idx) s.classList.add('is-active');
        else if (d === 1) s.classList.add('is-side', i < idx ? 'slide-before' : 'slide-after');
        else s.classList.add('is-far');
        s.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
      });
      if (dots) [...dots.children].forEach((b, i) => {
        b.classList.toggle('active', i === idx);
        b.setAttribute('aria-selected', i === idx ? 'true' : 'false');
      });
    }
    function go(n) {
      if (!items.length) return;
      idx = (n + items.length) % items.length;
      layout();
      restart();
    }
    function restart() {
      clearInterval(timer);
      if (!reduceMotion && items.length > 1) timer = setInterval(() => go(idx + 1), AUTOPLAY_MS);
    }
    async function init() {
      try {
        const r = await fetch('/api/media?type=portfolio');
        items = (await r.json()).slice(0, 6);
      } catch { items = []; }
      if (items.length < 2) { shell.style.display = 'none'; return; }
      track.innerHTML = items.map(m => `
        <article class="slide" role="option" aria-label="${esc(m.caption || 'Featured store')}">
          <div class="slide-imgwrap"><img loading="lazy" src="${esc(m.url)}" alt="${esc(m.alt_text || m.caption || 'Featured store')}"><span class="tag">${esc(m.category || 'Featured')}</span></div>
          <div class="slide-body"><h3>${esc(m.caption || 'Featured store')}</h3><p>${esc(m.alt_text || '')}</p></div>
        </article>`).join('');
      if (dots) dots.innerHTML = items.map((_, i) =>
        `<button role="tab" aria-label="Go to slide ${i + 1}" aria-selected="${i === 0}"></button>`).join('');
      if (dots) [...dots.children].forEach((b, i) => b.onclick = () => go(i));
      if (prev) prev.onclick = () => go(idx - 1);
      if (next) next.onclick = () => go(idx + 1);
      document.addEventListener('keydown', e => {
        if (!shell.matches(':hover') && document.activeElement !== prev && document.activeElement !== next) return;
        if (e.key === 'ArrowLeft') go(idx - 1);
        if (e.key === 'ArrowRight') go(idx + 1);
      });
      let tx = 0;
      track.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
      track.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - tx;
        if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
      }, { passive: true });
      shell.addEventListener('mouseenter', () => clearInterval(timer));
      shell.addEventListener('mouseleave', restart);
      addEventListener('resize', layout);
      layout();
      setTimeout(layout, 600);
      restart();
    }
    init();
  })();

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

  stagger(); bindAllTilt(); watchReveals();
  // re-run after dynamic content arrives
  setTimeout(() => { stagger(); bindAllTilt(); watchReveals(); }, 1500);
  setTimeout(() => { stagger(); bindAllTilt(); watchReveals(); }, 3500);
})();
