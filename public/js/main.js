/* WAYWEALTH — Frontend Logic v2 */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);

// Analytics beacon
function track(event_type, element_id) {
  const utm = Object.fromEntries(new URLSearchParams(location.search));
  const body = JSON.stringify({ event_type, element_id, session_id: sessionId, page_url: location.href, utm_source: utm.utm_source||'', utm_medium: utm.utm_medium||'', utm_campaign: utm.utm_campaign||'' });
  try { navigator.sendBeacon('/api/events', new Blob([body], {type:'application/json'})); } catch { fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body}); }
}
track('pageview','landing');

// Header glass on scroll
addEventListener('scroll', () => $('#header').classList.toggle('scrolled', scrollY > 40), {passive:true});
// Mobile toggle
$('#mobileToggle').onclick = () => $('#nav').classList.toggle('open');

// Reveal on scroll
const io = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting) e.target.classList.add('in'); }), {threshold:.15});
$$('.reveal').forEach(el => io.observe(el));
function observeNew(container){ container.querySelectorAll('.reveal').forEach(el=> io.observe(el)); }

// FAQ accordion delegated
function bindFaq(){
  $$('.faq-item').forEach(item => {
    const btn = item.querySelector('.faq-q');
    if(!btn || btn._bound) return;
    btn._bound=true;
    btn.addEventListener('click', () => item.classList.toggle('open'));
    btn.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') { e.preventDefault(); item.classList.toggle('open'); }});
  });
}

// CTA tracking
$$('[data-track]').forEach(a => a.addEventListener('click', () => track('cta_click', a.dataset.track)));

// Lightbox
const lb = $('#lightbox'), lbImg = $('#lbImg');
$('#lbClose').onclick = () => lb.classList.remove('open');
lb.onclick = e => { if(e.target===lb) lb.classList.remove('open'); };
addEventListener('keydown', e => { if(e.key==='Escape') lb.classList.remove('open'); });
function openLb(src, alt){ lbImg.src=src; lbImg.alt=alt||''; lb.classList.add('open'); track('gallery_open', src); }

// Fetch content, stats, media, team
async function loadDynamic(){
  try{
    const [cRes, sRes, secRes] = await Promise.all([fetch('/api/content'), fetch('/api/stats'), fetch('/api/sections')]);
    const content = await cRes.json();
    const stats = await sRes.json();
    // Theme via CSS vars
    if(content.theme_canvas) document.documentElement.style.setProperty('--canvas', content.theme_canvas);
    if(content.theme_ink) document.documentElement.style.setProperty('--ink', content.theme_ink);
    if(content.theme_accent) document.documentElement.style.setProperty('--accent', content.theme_accent);
    if(content.theme_accent_secondary) document.documentElement.style.setProperty('--accent-2', content.theme_accent_secondary);
    // Helper set text if element exists
    const setT = (sel, val, isHtml)=>{ const el=$(sel); if(el && val) { if(isHtml) el.innerHTML=val; else el.textContent=val; } };
    // Hero
    if(content.hero_badge) setT('#badgeText', content.hero_badge);
    if(content.hero_headline) setT('#heroHeadline', content.hero_headline, true);
    if(content.hero_subhead) setT('#heroSub', content.hero_subhead);
    if(content.hero_cta_primary) { const a=document.querySelector('a[href="#apply"].btn-primary'); if(a) a.textContent=content.hero_cta_primary; const hp=$('#heroHeadline'); }
    if(content.hero_cta_primary_link){
      document.querySelectorAll('a[href="#apply"]').forEach(a=> a.href=content.hero_cta_primary_link);
    }
    if(content.hero_cta_secondary) setT('#waHero', content.hero_cta_secondary);
    if(content.hero_trust_line) setT('#heroTrustLine', content.hero_trust_line);
    if(content.hero_mockup_live) setT('#mockupLive', content.hero_mockup_live);
    if(content.hero_mockup_currency) setT('#mockupCurrency', content.hero_mockup_currency);
    if(content.hero_mockup_rev_label) setT('#mockupRevLabel', content.hero_mockup_rev_label);
    if(content.hero_mockup_orders_label) setT('#mockupOrdersLabel', content.hero_mockup_orders_label);
    // Header nav
    if(content.header_nav_showcase) setT('#navShowcase', content.header_nav_showcase);
    if(content.header_nav_proof) setT('#navProof', content.header_nav_proof);
    if(content.header_nav_process) setT('#navProcess', content.header_nav_process);
    if(content.header_nav_certificates) setT('#navCertificates', content.header_nav_certificates);
    if(content.header_nav_pricing) setT('#navPricing', content.header_nav_pricing);
    if(content.header_nav_faq) setT('#navFaq', content.header_nav_faq);
    if(content.header_cta_book) setT('#headerBookBtn', content.header_cta_book);
    if(content.header_cta_whatsapp){
      if($('#waNav')) $('#waNav').textContent = content.header_cta_whatsapp;
    }
    // Section headlines
    setT('#portfolioHead', content.portfolio_headline);
    setT('#portfolioSub', content.portfolio_subhead);
    setT('#proofHead', content.proof_headline);
    setT('#proofSub', content.proof_subhead);
    setT('#expertsHead', content.experts_headline);
    setT('#expertsSub', content.experts_subhead);
    setT('#processHead', content.process_headline);
    setT('#processSub', content.process_subhead);
    setT('#certificatesHead', content.certificates_headline);
    setT('#certificatesSub', content.certificates_subhead);
    setT('#pricingHead', content.pricing_headline);
    setT('#pricingSub', content.pricing_subhead);
    setT('#testimonialsHead', content.testimonials_headline);
    setT('#testimonialsSub', content.testimonials_subhead);
    setT('#faqHead', content.faq_headline);
    setT('#faqSub', content.faq_subhead);
    setT('#formHead', content.form_headline);
    setT('#formSub', content.form_subhead);
    setT('#footerTagline', content.footer_tagline);
    setT('#footerContactHead', content.footer_contact_heading);
    setT('#footerLegalHead', content.footer_legal_heading);
    setT('#footerPrivacy', content.footer_legal_privacy);
    setT('#footerTerms', content.footer_legal_terms);
    setT('#footerRefund', content.footer_legal_refund);
    setT('#footerCopyright', content.footer_copyright);
    setT('#footerTrust', content.footer_built_for_trust);
    // WhatsApp deep links per placement
    const waNum = (content.footer_whatsapp||'').replace(/\D/g,'');
    const waMsg = (k, fallback) => encodeURIComponent(content[k] || fallback);
    if(waNum){
      if($('#waNav')) $('#waNav').href = `https://wa.me/${waNum}?text=${waMsg('footer_whatsapp_msg_nav','Hi WAYWEALTH, I came from your website header.')}`;
      if($('#waHero')) $('#waHero').href = `https://wa.me/${waNum}?text=${waMsg('footer_whatsapp_msg_hero','Hi WAYWEALTH, tell me about the venture studio slots.')}`;
      if($('#footerWa')) $('#footerWa').href = `https://wa.me/${waNum}?text=${waMsg('footer_whatsapp_msg_footer','Hi WAYWEALTH, I have a question before applying.')}`;
      if($('#successWa')) $('#successWa').href = `https://wa.me/${waNum}?text=${encodeURIComponent('Hi WAYWEALTH, I just applied — when is my strategy call?')}`;
    }
    if(content.footer_email) { const fe=$('#footerEmail'); if(fe){ fe.textContent = content.footer_email; fe.href = 'mailto:'+content.footer_email; } }
    if(content.booking_link) { const bl=$('#bookingLink'); if(bl) bl.href = content.booking_link; }
    // Branding: logo & favicon (editable via admin)
    if(content.site_logo){
      const logoImg=$('#siteLogo'), logoText=$('#siteLogoText'), footLogo=$('#footerLogo'), footText=$('#footerLogoText');
      if(logoImg){ logoImg.src=content.site_logo; logoImg.style.display='inline-block'; if(logoText) logoText.style.display='none'; }
      if(footLogo){ footLogo.src=content.site_logo; footLogo.style.display='inline-block'; if(footText) footText.style.display='none'; }
    }
    if(content.site_favicon){
      const fav=$('#siteFavicon');
      if(fav){ fav.href=content.site_favicon; }
    }
    if(content.site_title){ document.title=content.site_title; const og=document.querySelector('meta[property="og:title"]'); if(og) og.content=content.site_title; }
    if(content.site_description){ const md=document.querySelector('meta[name="description"]'); if(md) md.content=content.site_description; const ogd=document.querySelector('meta[property="og:description"]'); if(ogd) ogd.content=content.site_description; }
    // Marquee stats (live, DB-driven)
    const marquee = $('#marquee');
    const items = [
      {label:'Total Client Sales', value: stats.total_sales||'—'},
      {label:'Launch Success Rate', value: stats.success_rate||'—'},
      {label:'Stores Delivered', value: stats.stores_delivered||'—'},
      {label:'Avg Launch Time', value: stats.avg_launch_days||'—'},
    ];
    if(marquee){
      const html = items.map(i=>`<div class="marquee-item"><strong class="count">${i.value}</strong><span>${i.label}</span></div>`).join('');
      marquee.innerHTML = html + html;
      const strip = $('#proofStrip');
      let counted=false;
      if(strip) new IntersectionObserver(es=>{
        if(es[0].isIntersecting && !counted){
          counted=true;
          $$('.count').forEach(el=>{
            const raw = el.textContent; const num = parseInt(raw.replace(/\D/g,'')); if(!num) return;
            let n=0; const step=Math.ceil(num/30);
            const t=setInterval(()=>{ n=Math.min(num,n+step); el.textContent=raw.replace(/[0-9,]+/, n.toLocaleString()); if(n>=num) clearInterval(t); },30);
          });
        }
      },{threshold:.3}).observe(strip);
    }
    // Section visibility/order/animation
    const sections = await secRes.json();
    sections.forEach(s=>{
      const el = document.getElementById(s.key) || document.getElementById(s.key+'Sec') || document.getElementById(s.key==='certificates'?'certificates':s.key);
      if(el && !s.visible) el.style.display='none';
      if(el && s.visible) el.style.display='';
      if(el && !s.animation_enabled) el.querySelectorAll('.reveal').forEach(r=>r.classList.add('in'));
    });
    // Handle header separately (sections key is header)
    const headerSec = sections.find(x=>x.key==='header');
    if(headerSec && !headerSec.visible) $('#header').style.display='none';
  }catch(e){ console.warn('dynamic load failed', e); }
}

async function loadGalleries(){
  try{
    const [portRes, proofRes, testRes, teamRes, certRes, procRes, pricingRes, faqRes] = await Promise.all([
      fetch('/api/media?type=portfolio'), fetch('/api/media?type=sales_proof'),
      fetch('/api/media?type=testimonials'), fetch('/api/team'),
      fetch('/api/certificates'), fetch('/api/process-steps'),
      fetch('/api/pricing-plans'), fetch('/api/faqs')
    ]);
    const portfolio = await portRes.json();
    const proof = await proofRes.json();
    const testimonials = await testRes.json();
    const team = await teamRes.json();
    const certificates = await certRes.json();
    const processSteps = await procRes.json();
    const pricingPlans = await pricingRes.json();
    const faqs = await faqRes.json();

    // Portfolio filters
    const cats = [...new Set(portfolio.map(m=>m.category).filter(Boolean))];
    const filterBar = $('#portfolioFilters');
    if(filterBar){
      filterBar.innerHTML = `<button class="chip active" data-cat="">All</button>` + cats.map(c=>`<button class="chip" data-cat="${c}">${c}</button>`).join('');
      const grid = $('#portfolioGrid');
      function renderPortfolio(cat=''){
        const items = cat ? portfolio.filter(m=>m.category===cat) : portfolio;
        grid.innerHTML = items.map(m=>`
          <div class="card">
            <div class="card-img"><img loading="lazy" src="${m.url}" alt="${(m.alt_text||m.caption||'').replace(/"/g,'&quot;')}"><span class="tag">${m.category||''}</span></div>
            <div class="card-body"><h3>${m.caption||''}</h3><p>${m.alt_text||''}</p></div>
          </div>`).join('') || `<p class="muted" style="grid-column:1/-1;text-align:center">No portfolio items yet.</p>`;
        grid.querySelectorAll('.card').forEach((card,i)=>{
          card.style.cursor='pointer';
          const idx = cat ? portfolio.findIndex(x=>x.id===items[i].id) : i;
          const src = items[i].url;
          card.onclick=()=> openLb(src, items[i].caption);
        });
      }
      renderPortfolio('');
      filterBar.querySelectorAll('.chip').forEach(ch=> ch.onclick=()=>{
        filterBar.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); ch.classList.add('active');
        renderPortfolio(ch.dataset.cat);
      });
    }

    // Proof
    const proofGrid=$('#proofGrid');
    if(proofGrid){
      proofGrid.innerHTML = proof.map(m=>`
        <div class="card"><div class="card-img"><img loading="lazy" src="${m.url}" alt="${(m.alt_text||'').replace(/"/g,'&quot;')}"></div>
        <div class="card-body"><p style="font-size:13px;font-weight:600">${m.caption||''}</p><p>${m.category||''}</p></div></div>`).join('') || `<p class="muted">No proof images yet — upload from admin.</p>`;
      proofGrid.querySelectorAll('.card').forEach((c,i)=> c.onclick=()=> openLb(proof[i].url, proof[i].caption));
    }

    // Testimonials (images + playable videos)
    const testGrid=$('#testimonialsGrid');
    if(testGrid){
      const isVideo = u => /\.(mp4|webm|mov)(\?|$)/i.test(u||'');
      testGrid.innerHTML = testimonials.map(m=>{
        if(isVideo(m.url)){
          return `<div class="card quote-card video-card"><video src="${m.url}" controls preload="metadata" playsinline style="width:100%;border-radius:10px;background:#000"></video>
          <p>“${(m.caption||'').replace(/^“|”$/g,'')}”</p>
          <div class="quote-foot"><div><strong>${m.category||'Verified Founder'}</strong><br><span>${m.alt_text||''}</span></div></div></div>`;
        }
        return `<div class="card quote-card"><p>“${(m.caption||'').replace(/^“|”$/g,'')}”</p>
        <div class="quote-foot"><img src="${m.url}" alt=""><div><strong>${m.category||''}</strong><br><span>${m.alt_text||''}</span></div></div></div>`;
      }).join('') || `<p class="muted">No testimonials yet.</p>`;
    }

    // Experts
    const expGrid=$('#expertsGrid');
    if(expGrid){
      expGrid.innerHTML = team.map(t=>`
        <div class="card expert-card"><img loading="lazy" src="${t.photo_url}" alt="${t.name}"><h3>${t.name}</h3><div class="role">${t.role||''}</div><div class="cred">${t.credibility_note||''}</div>${t.social_url?`<a href="${t.social_url}" target="_blank" rel="noopener" style="font-size:12px;color:var(--accent);margin-top:6px;display:inline-block">↗ Profile</a>`:''}</div>
      `).join('') || `<p class="muted" style="grid-column:1/-1;text-align:center">No experts yet — add from admin.</p>`;
    }

    // Process steps
    const procGrid=$('#processGrid');
    if(procGrid){
      procGrid.innerHTML = processSteps.map(st=>`
        <div class="step"><div class="step-num">${st.step_num || st.order+1}</div><h3>${st.title}</h3><p>${st.description||''}</p></div>
      `).join('') || `<p class="muted" style="grid-column:1/-1;text-align:center">No steps yet — add from admin.</p>`;
    }

    // Certificates
    const certGrid=$('#certificatesGrid');
    if(certGrid){
      certGrid.innerHTML = certificates.map(c=>`
        <div class="card cert-card" style="cursor:pointer">
          <div class="card-img"><img loading="lazy" src="${c.image_url}" alt="${(c.title||'').replace(/"/g,'&quot;')}"><span class="cert-badge">${c.category||c.issuer||'Verified'}</span></div>
          <div class="cert-body"><h3>${c.title||''}</h3>${c.issuer?`<div class="issuer">${c.issuer}</div>`:''}<p>${c.description||''}</p></div>
        </div>
      `).join('') || `<p class="muted" style="grid-column:1/-1;text-align:center">No certificates yet — upload from admin.</p>`;
      certGrid.querySelectorAll('.card').forEach((card,i)=> card.onclick=()=> openLb(certificates[i].image_url, certificates[i].title));
    }

    // Pricing
    const pricingGrid=$('#pricingGrid');
    if(pricingGrid){
      pricingGrid.innerHTML = pricingPlans.map(p=> {
        const feats = Array.isArray(p.features) ? p.features : (typeof p.features==='string'? (()=>{try{return JSON.parse(p.features)}catch{return []}})(): []);
        return `
        <div class="card price-card ${p.featured?'featured':''}">
          ${p.featured?'<div class="featured-badge">Most Popular</div>':''}
          <h3>${p.name}</h3><div class="price">${p.price} <small>${p.price_suffix||''}</small></div>
          <p class="muted" style="font-size:13px">${p.description||''}</p>
          <ul>${feats.map(f=>`<li>${f}</li>`).join('')}</ul>
          <a href="${p.cta_link||'#apply'}" class="btn ${p.featured?'btn-primary':'btn-ghost'}" style="width:100%;margin-top:12px" data-track="pricing_${p.name.toLowerCase()}">${p.cta_label||'Apply'}</a>
        </div>`;
      }).join('') || `<p class="muted" style="grid-column:1/-1;text-align:center">No pricing plans yet — add from admin.</p>`;
      // Sync lead form investmentRange radios with pricing plans (so pricing backend controls form)
      try {
        const rr = document.querySelector('.form-step[data-step="1"] .radio-row');
        if(rr && pricingPlans.length){
          rr.innerHTML = pricingPlans.map(pl=> `<label class="radio-pill"><input type="radio" name="investmentRange" value="${pl.name} (${pl.price}${pl.price_suffix? ' '+pl.price_suffix:''})" required> ${pl.name} (${pl.price})</label>`).join('') + `<label class="radio-pill"><input type="radio" name="investmentRange" value="Not sure yet"> Not sure yet</label>`;
        }
      } catch(e){ console.warn('pricing->form sync failed',e); }
    }

    // FAQs
    const faqList=$('#faqList');
    if(faqList){
      faqList.innerHTML = faqs.map(f=>`
        <div class="faq-item"><button class="faq-q">${f.question} <i>⌄</i></button><div class="faq-a"><p>${f.answer}</p></div></div>
      `).join('') || `<p class="muted" style="text-align:center">No FAQs yet.</p>`;
      bindFaq();
    }

    // re-observe
    document.querySelectorAll('.section').forEach(sec=> observeNew(sec));
  }catch(e){ console.warn('gallery load failed', e); }
}
loadDynamic(); loadGalleries();

// Live ticks simulation
setInterval(()=>{
  const r = $('#tickRevenue'); const o = $('#tickOrders');
  if(r){ const base=847; const jitter=Math.floor(Math.random()*80); r.textContent='$'+(base+jitter).toLocaleString(); }
  if(o){ o.textContent = String(120 + Math.floor(Math.random()*18)); }
}, 3200);
const pops = ['+ $42.50 just now \u2022 Eco-Beauty','+ $18.20 just now \u2022 Tech Gadgets','+ $67.90 just now \u2022 Fitness Gear','+ $29.40 just now \u2022 Luxury Accessories'];
let pi=0; setInterval(()=>{ pi=(pi+1)%pops.length; const el=$('#earningPop'); if(el){ el.style.opacity=0; setTimeout(()=>{ el.textContent=pops[pi]; el.style.opacity=1; },300); } }, 4200);

// ── Multi-step Form ───────────────────────────────────────────────
let step = 1; const totalSteps = 3;
const form = $('#leadForm'), successBox = $('#formSuccess');
const nextBtn = $('#nextBtn'), prevBtn = $('#prevBtn'), submitBtn = $('#submitBtn');
function showStep(n){
  step=n;
  $$('.form-step').forEach(s=> s.classList.toggle('hidden', parseInt(s.dataset.step)!==n));
  const s1=$('#s1'),s2=$('#s2'),s3=$('#s3');
  if(s1) s1.classList.toggle('active', n>=1); if(s2) s2.classList.toggle('active', n>=2); if(s3) s3.classList.toggle('active', n>=3);
  if(prevBtn) prevBtn.classList.toggle('hidden', n===1);
  if(nextBtn) nextBtn.classList.toggle('hidden', n===totalSteps);
  if(submitBtn) submitBtn.classList.toggle('hidden', n!==totalSteps);
  if(n===1) track('form_start','application_form');
  if(n===2) track('form_step2','application_form');
}
function validateStep(n){
  let ok=true;
  const scope = $(`.form-step[data-step="${n}"]`);
  if(!scope) return true;
  scope.querySelectorAll('[required]').forEach(inp=>{
    const field = inp.closest('.field');
    let valid = true;
    if(inp.type==='checkbox') valid = inp.checked;
    else if(inp.type==='radio'){
      const group = scope.querySelectorAll(`input[name="${inp.name}"]`);
      valid = [...group].some(r=>r.checked);
      if(inp !== group[0]) return;
    } else if(inp.type==='email') valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value.trim());
    else valid = inp.value.trim().length > 0;
    if(inp.name==='whatsapp' && valid) valid = inp.value.replace(/\D/g,'').length >= 10;
    if(!valid){ field.classList.add('invalid'); ok=false; } else field.classList.remove('invalid');
  });
  return ok;
}
if(nextBtn) nextBtn.onclick = ()=>{
  if(!validateStep(step)) return;
  if(step < totalSteps) showStep(step+1);
};
if(prevBtn) prevBtn.onclick = ()=> { if(step>1) showStep(step-1); };
$$('input[name="wasScammed"]').forEach(r=> r.addEventListener('change', ()=>{
  const scamField=$('#scamField');
  if(!scamField) return;
  const yes = [...$$('input[name="wasScammed"]')].find(x=>x.checked)?.value==='yes';
  scamField.classList.toggle('hidden', !yes);
}));
if(form){
  form.addEventListener('input', e=>{
    const f = e.target.closest('.field'); if(f) f.classList.remove('invalid');
  });
  form.addEventListener('change', e=>{
    const f = e.target.closest('.field'); if(f) f.classList.remove('invalid');
  });
  form.addEventListener('submit', async e=>{
    e.preventDefault();
    if(!validateStep(3)) return;
    submitBtn.disabled=true; submitBtn.textContent='Submitting…';
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    const payload = {
      name: data.name?.trim(),
      storeName: data.storeName?.trim(),
      investmentRange: data.investmentRange,
      storeStatus: data.storeStatus,
      wasScammed: data.wasScammed,
      scamDetails: data.scamDetails||'',
      whatsapp: data.whatsapp?.trim(),
      email: data.email?.trim(),
      preferredContactTime: data.preferredContactTime||'',
      source: data.source||'',
      trafficPlan: data.trafficPlan||'',
      consent: !!data.consent,
      honeypot: data.honeypot||'',
      pageUrl: location.href,
      utm: Object.fromEntries(new URLSearchParams(location.search)),
      submittedAt: new Date().toISOString(),
      session_id: sessionId
    };
    try{
      const res = await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const j = await res.json();
      if(!res.ok) throw new Error(j.error||'Submit failed');
      track('form_submit','application_form');
      form.classList.add('hidden'); successBox.classList.remove('hidden');
      successBox.scrollIntoView({behavior:'smooth', block:'center'});
    }catch(err){
      alert(err.message||'Submission failed. Please try again or message us on WhatsApp.');
      submitBtn.disabled=false; submitBtn.textContent='Submit Application & Book Strategy Call';
    }
  });
}
showStep(1);

window.WW_TRACK = track;
