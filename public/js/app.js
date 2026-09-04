const API = '';
let CONTENT = {};
let sessionId = localStorage.getItem('ww_sid') || (localStorage.setItem('ww_sid', crypto.randomUUID()), localStorage.getItem('ww_sid'));

function esc(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

async function fetchContent(){
  try{
    const r = await fetch('/api/content'); CONTENT = await r.json();
    applyContent();
  }catch(e){ console.error(e); }
}

function applyContent(){
  const g=(k,fallback)=> CONTENT[k] || fallback;
  const root=document.documentElement;
  if(CONTENT.color_primary) root.style.setProperty('--primary', CONTENT.color_primary);
  if(CONTENT.color_accent) root.style.setProperty('--accent', CONTENT.color_accent);
  if(CONTENT.color_background) root.style.setProperty('--bg', CONTENT.color_background);
  if(CONTENT.color_text) root.style.setProperty('--text', CONTENT.color_text);
  if(CONTENT.color_button) root.style.setProperty('--button', CONTENT.color_button);
  if(CONTENT.font_family) root.style.setProperty('--font', `'${CONTENT.font_family}', system-ui, sans-serif`);
  document.body.style.fontFamily = `var(--font)`;

  const set=(id,val)=>{ const el=document.getElementById(id); if(el && val) el.textContent=val; };
  set('logoText', g('site_name','WayWealth'));
  set('heroBadge', g('hero_badge',''));
  set('heroHeadline', g('hero_headline',''));
  set('heroSubheadline', g('hero_subheadline',''));
  const heroImg=document.getElementById('heroImage');
  if(CONTENT.hero_image) heroImg.src=CONTENT.hero_image;
  set('stat1v', g('proof_stat_1_value','')); set('stat1l', g('proof_stat_1_label',''));
  set('stat2v', g('proof_stat_2_value','')); set('stat2l', g('proof_stat_2_label',''));
  set('stat3v', g('proof_stat_3_value','')); set('stat3l', g('proof_stat_3_label',''));
  set('stat4v', g('proof_stat_4_value','')); set('stat4l', g('proof_stat_4_label',''));
  set('hiwTitle', g('hiw_title','')); set('hiwSubtitle', g('hiw_subtitle',''));
  set('hiw1t', g('hiw_step1_title','')); set('hiw1d', g('hiw_step1_desc',''));
  set('hiw2t', g('hiw_step2_title','')); set('hiw2d', g('hiw_step2_desc',''));
  set('hiw3t', g('hiw_step3_title','')); set('hiw3d', g('hiw_step3_desc',''));
  set('hiw4t', g('hiw_step4_title','')); set('hiw4d', g('hiw_step4_desc',''));
  set('pricingTitle', g('pricing_title','')); set('pricingSub', g('pricing_subtitle',''));
  // Pricing cards fully editable
  const setCard=(n)=>{
    const name=g(`pricing_card${n}_name`,'');
    const price=g(`pricing_card${n}_price`,'');
    const suffix=g(`pricing_card${n}_suffix`,'');
    const desc=g(`pricing_card${n}_desc`,'');
    const btn=g(`pricing_card${n}_btn`,'');
    const badge=g(`pricing_card${n}_badge`,'');
    const features=g(`pricing_card${n}_features`,'');
    if(name) set(`priceCard${n}Name`, name);
    if(price){
      const el=document.getElementById(`priceCard${n}Price`);
      if(el){ el.childNodes[0].textContent=price+' '; const s=document.getElementById(`priceCard${n}Suffix`); if(s) s.textContent=suffix; }
    } else if(suffix) { const s=document.getElementById(`priceCard${n}Suffix`); if(s) s.textContent=suffix; }
    if(desc) set(`priceCard${n}Desc`, desc);
    if(btn) set(`priceCard${n}Btn`, btn);
    const badgeEl=document.getElementById(`priceCard${n}Badge`);
    if(badgeEl){ if(badge){ badgeEl.textContent=badge; badgeEl.style.display=''; } else { badgeEl.style.display='none'; } }
    if(features){
      const ul=document.getElementById(`priceCard${n}Features`);
      if(ul){ const items=features.split('\n').filter(Boolean); ul.innerHTML=items.map(f=>`<li>${esc(f)}</li>`).join(''); }
    }
  };
  setCard(1); setCard(2); setCard(3);
  set('testiTitle', g('testimonials_title','')); set('testiSub', g('testimonials_subtitle',''));
  set('expertTitle', g('expert_title','')); set('expertSub', g('expert_subtitle',''));
  set('faqTitle', g('faq_title','')); set('faqSub', g('faq_subtitle',''));
  set('ctaTitle', g('cta_title','')); set('ctaSub', g('cta_subtitle',''));
  set('footerText', g('footer_text','')); set('footerCopy', g('footer_text',''));
  set('footerEmail', g('footer_email','')); set('footerAddr', g('footer_address',''));

  const banner=document.getElementById('urgencyBanner');
  if(CONTENT.banner_enabled==='true' && CONTENT.banner_text){ banner.textContent=CONTENT.banner_text; banner.classList.add('show'); } else if(banner){ banner.classList.remove('show'); }

  if(CONTENT.favicon_url){ document.getElementById('favicon').href=CONTENT.favicon_url; }
  if(CONTENT.logo_url){
    const logoMark=document.querySelector('.logo-mark');
    if(logoMark){ logoMark.innerHTML=`<img src="${esc(CONTENT.logo_url)}" style="width:100%;height:100%;object-fit:contain;border-radius:8px">`; }
  }
  const waNum = (CONTENT.whatsapp_number||'').replace(/\D/g,'');
  const waMsg = encodeURIComponent(CONTENT.whatsapp_message||'Hi, I want to start a dropshipping store!');
  const waLink = waNum ? `https://wa.me/${waNum}?text=${waMsg}` : '#';
  const bookLink = CONTENT.booking_link || '#leadForm';
  ['navWaBtn','heroWaBtn','sideWaBtn','footerWa','waFloat','successWaLink'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.href=waLink;
  });
  const isBookingEmbed = bookLink.includes('calendly.com') || bookLink.includes('cal.com') || bookLink.includes('calendly');
  ['navBookBtn','heroBookBtn','sideBookBtn'].forEach(id=>{
    const el=document.getElementById(id); if(el){
      if(isBookingEmbed){
        el.href='#';
        el.removeAttribute('target');
        el.addEventListener('click',(e)=>{
          e.preventDefault();
          track('cta_click',{ element_id: el.dataset.track || id});
          const wrap=document.getElementById('bookingEmbedWrap');
          const iframe=document.getElementById('bookingIframe');
          iframe.src=bookLink;
          wrap.style.display='block';
          wrap.scrollIntoView({behavior:'smooth'});
          track('booking_open',{ element_id: id});
        }, {once:false});
      } else if(bookLink.startsWith('http')) el.href=bookLink, el.target='_blank';
      else el.href=bookLink;
    }
  });
  if(CONTENT.pricing_show==='false') document.getElementById('pricing').style.display='none';
}

async function loadMedia(){
  try{
    const [portfolio, sales, reviewPics, reviewVideos, expertPics] = await Promise.all([
      fetch('/api/media?type=portfolio').then(r=>r.json()),
      fetch('/api/media?type=sales').then(r=>r.json()),
      fetch('/api/media?type=review_pic').then(r=>r.json()),
      fetch('/api/media?type=review_video').then(r=>r.json()),
      fetch('/api/media?type=expert').then(r=>r.json())
    ]);
    renderGallery('portfolioGrid', portfolio, 'No portfolio images yet');
    renderGallery('salesGrid', sales, 'No sales proof yet');
    renderReviewPics(reviewPics);
    renderReviewVideos(reviewVideos);
    renderExpert(expertPics);
  }catch(e){ console.error(e); }
}
function renderGallery(containerId, items, empty){
  const c=document.getElementById(containerId);
  if(!c) return;
  if(!items.length){ c.innerHTML=`<div style="color:var(--muted);font-size:14px;grid-column:1/-1;text-align:center;padding:24px;border:1px dashed var(--border);border-radius:12px">${empty} — add images in Admin → Media.</div>`; return; }
  c.innerHTML = items.map(m=>`
    <div class="g-card" data-url="${esc(m.url)}">
      <img src="${esc(m.url)}" alt="${esc(m.caption||'')}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x220?text=Image'">
      <div class="g-card-cap">${esc(m.caption||'Untitled')}</div>
    </div>
  `).join('');
  c.querySelectorAll('.g-card').forEach(card=>{
    card.addEventListener('click',()=>{
      const lb=document.getElementById('lightbox'), img=document.getElementById('lbImg');
      img.src=card.dataset.url; lb.classList.add('show');
      track('image_view',{ image:card.dataset.url });
    });
  });
}
function renderReviewPics(items){
  const c=document.getElementById('reviewsPicGrid');
  if(!c) return;
  if(!items.length){
    c.innerHTML = Array.from({length:4},(_,i)=>`<div class="review-empty">Slot ${i+1} — Add picture review in Admin → Reviews</div>`).join('');
    return;
  }
  const slots = [...items];
  while(slots.length<4) slots.push(null);
  c.innerHTML = slots.slice(0,4).map(m=>{
    if(!m) return `<div class="review-empty">Empty slot — add in Admin</div>`;
    return `<div class="review-pic-card" data-url="${esc(m.url)}"><img src="${esc(m.url)}" alt="${esc(m.caption||'')}" onerror="this.src='https://via.placeholder.com/400x400?text=Review'"><div class="cap">${esc(m.caption||'Client review')}</div></div>`;
  }).join('');
  c.querySelectorAll('.review-pic-card').forEach(card=>{
    card.addEventListener('click',()=>{
      const lb=document.getElementById('lightbox'), img=document.getElementById('lbImg');
      img.src=card.dataset.url; lb.classList.add('show');
      track('image_view',{ image:card.dataset.url, section:'review_pic'});
    });
  });
}
function isYouTube(url){
  return /youtu\.be|youtube\.com/.test(url);
}
function toYouTubeEmbed(url){
  try{
    let id='';
    if(url.includes('youtu.be/')) id=url.split('youtu.be/')[1].split(/[?&#]/)[0];
    else if(url.includes('v=')) id=new URL(url).searchParams.get('v');
    else if(url.includes('embed/')) return url;
    if(id) return `https://www.youtube.com/embed/${id}`;
  }catch{}
  return url;
}
function renderReviewVideos(items){
  const c=document.getElementById('reviewsVideoGrid');
  if(!c) return;
  if(!items.length){
    c.innerHTML = Array.from({length:4},(_,i)=>`<div class="review-empty">Slot ${i+1} — Add video review in Admin → Reviews</div>`).join('');
    return;
  }
  const slots=[...items];
  while(slots.length<4) slots.push(null);
  c.innerHTML = slots.slice(0,4).map(m=>{
    if(!m) return `<div class="review-empty">Empty slot — add in Admin</div>`;
    const url=m.url;
    const isYT = isYouTube(url);
    if(isYT){
      const embed=toYouTubeEmbed(url);
      return `<div class="review-video-card"><iframe src="${esc(embed)}" allowfullscreen loading="lazy" title="${esc(m.caption||'Video review')}"></iframe><div class="v-cap">${esc(m.caption||'Video review')}</div></div>`;
    } else if(/\.(mp4|webm|mov)(\?|$)/i.test(url) || url.startsWith('/uploads/')){
      return `<div class="review-video-card"><video src="${esc(url)}" controls preload="metadata"></video><div class="v-cap">${esc(m.caption||'Video review')}</div></div>`;
    } else {
      // generic embed or video url -> try iframe
      return `<div class="review-video-card"><iframe src="${esc(url)}" allowfullscreen loading="lazy" title="${esc(m.caption||'Video review')}"></iframe><div class="v-cap">${esc(m.caption||'Video review')}</div></div>`;
    }
  }).join('');
}
function renderExpert(items){
  const c=document.getElementById('expertGrid');
  if(!c) return;
  if(!items.length){
    c.innerHTML = Array.from({length:4},(_,i)=>`<div class="expert-card" style="display:grid;place-items:center;color:var(--muted);font-size:13px">Slot ${i+1} — Add expert picture in Admin → Expert</div>`).join('');
    return;
  }
  const slots=[...items];
  while(slots.length<4) slots.push(null);
  c.innerHTML = slots.slice(0,4).map(m=>{
    if(!m) return `<div class="expert-card" style="display:grid;place-items:center;color:var(--muted);font-size:13px">Empty slot — add in Admin</div>`;
    return `<div class="expert-card"><img src="${esc(m.url)}" alt="${esc(m.caption||'Expert')}" onerror="this.src='https://via.placeholder.com/600x450?text=Expert'"><div class="expert-overlay"><strong>${esc(m.caption||'WayWealth Expert')}</strong></div></div>`;
  }).join('');
}

async function loadTestimonials(){
  try{
    const data=await fetch('/api/testimonials').then(r=>r.json());
    const c=document.getElementById('testiGrid');
    if(!c) return;
    if(!data.length){ c.innerHTML=''; return; }
    c.innerHTML=data.map(t=>`
      <div class="testi-card">
        <div class="testi-quote">"${esc(t.quote)}"</div>
        <div class="testi-foot">
          <img src="${esc(t.photo||'https://i.pravatar.cc/100?img=12')}" onerror="this.src='https://i.pravatar.cc/100?img=12'">
          <div><div class="testi-name">${esc(t.name)}</div><div class="testi-role">${esc(t.role||'')}</div></div>
        </div>
      </div>
    `).join('');
  }catch{}
}
async function loadFaqs(){
  try{
    const data=await fetch('/api/faqs').then(r=>r.json());
    const c=document.getElementById('faqList');
    c.innerHTML=data.map(f=>`
      <div class="faq-item">
        <button class="faq-q"><span>${esc(f.question)}</span><span>+</span></button>
        <div class="faq-a">${esc(f.answer)}</div>
      </div>
    `).join('');
    c.querySelectorAll('.faq-q').forEach(btn=>{
      btn.addEventListener('click',()=> btn.parentElement.classList.toggle('open'));
    });
  }catch{}
}

function track(event_type, extra={}){
  const payload={ event_type, element_id: extra.element_id||extra.image||'', page_url: location.href, session_id: sessionId, metadata: extra };
  try{
    if(navigator.sendBeacon){
      navigator.sendBeacon('/api/events', new Blob([JSON.stringify(payload)],{type:'application/json'}));
    } else {
      fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    }
  }catch{}
}
function initTracking(){
  track('page_view');
  document.querySelectorAll('[data-track]').forEach(el=>{
    el.addEventListener('click',()=> track('cta_click',{ element_id: el.dataset.track }));
  });
  let formStarted=false;
  const form=document.getElementById('leadFormEl');
  if(form){
    form.addEventListener('focusin',()=>{ if(!formStarted){ formStarted=true; track('form_start',{element_id:'lead_form'}); }});
  }
}

function initForm(){
  document.querySelectorAll('input[name="wasScammed"]').forEach(r=> r.addEventListener('change',()=>{
    document.getElementById('scamDetailsGroup').style.display = document.getElementById('scamYes').checked ? 'block' : 'none';
  }));
  const form=document.getElementById('leadFormEl');
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    form.querySelectorAll('.error').forEach(el=>el.classList.remove('show'));
    form.querySelectorAll('.input-error').forEach(el=>el.classList.remove('input-error'));
    let valid=true;
    const val=(id)=> document.getElementById(id).value.trim();
    const show=(errId,inputId)=>{ document.getElementById(errId).classList.add('show'); if(inputId) document.getElementById(inputId)?.classList.add('input-error'); valid=false; };
    if(!val('f_name')) show('e_name','f_name');
    if(!val('f_storeName')) show('e_storeName','f_storeName');
    if(!val('f_budget')) show('e_budget','f_budget');
    const storeStatus=document.querySelector('input[name="storeStatus"]:checked');
    if(!storeStatus) show('e_storeStatus');
    const wasScammed=document.querySelector('input[name="wasScammed"]:checked');
    if(!wasScammed) show('e_wasScammed');
    const wa=val('f_whatsapp');
    if(!wa || wa.replace(/\D/g,'').length<10) show('e_whatsapp','f_whatsapp');
    const email=val('f_email');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) show('e_email','f_email');
    if(!document.getElementById('f_consent').checked) show('e_consent');
    if(!valid) return;
    const payload={
      name: val('f_name'),
      storeName: val('f_storeName'),
      budget: val('f_budget'),
      storeStatus: storeStatus.value,
      wasScammed: wasScammed.value,
      scamDetails: val('f_scamDetails'),
      whatsapp: wa,
      email: email,
      contactTime: val('f_contactTime'),
      source: val('f_source'),
      consent: true,
      pageUrl: location.href,
      honeypot: document.getElementById('honeypot').value
    };
    const btn=document.getElementById('submitBtn');
    btn.disabled=true; btn.textContent='Submitting...';
    try{
      const r=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json','X-Session-Id':sessionId},body:JSON.stringify(payload)});
      const j=await r.json();
      if(!r.ok) throw new Error(j.error||'Failed');
      document.getElementById('formSuccess').classList.add('show');
      track('form_submit',{element_id:'lead_form'});
      form.reset(); document.getElementById('scamDetailsGroup').style.display='none';
      toast('Lead submitted successfully!');
      const waNum=(CONTENT.whatsapp_number||'').replace(/\D/g,'');
      if(waNum) document.getElementById('successWaLink').href=`https://wa.me/${waNum}?text=${encodeURIComponent('Hi, I just submitted the form on WayWealth!')}`;
    }catch(err){
      toast(err.message||'Submission failed','error');
    }finally{ btn.disabled=false; btn.textContent="Submit — We'll Reach Out in 24h →"; }
  });
}

function toast(msg, type){
  const t=document.getElementById('toast');
  t.textContent=msg; t.style.background= type==='error' ? '#ef4444' : 'var(--primary)';
  t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000);
}

document.getElementById('lbClose').addEventListener('click',()=> document.getElementById('lightbox').classList.remove('show'));
document.getElementById('lightbox').addEventListener('click',(e)=>{ if(e.target.id==='lightbox') e.currentTarget.classList.remove('show'); });
document.getElementById('mobileToggle').addEventListener('click',()=>{
  document.getElementById('navbar').classList.toggle('nav-menu-open');
});

fetchContent();
loadMedia();
loadTestimonials();
loadFaqs();
initTracking();
initForm();
