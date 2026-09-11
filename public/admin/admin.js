/* Admin JS v2 — Everything Editable */
let token = localStorage.getItem('ww_token') || '';
const $ = s => document.querySelector(s), $$ = s=>[...document.querySelectorAll(s)];
function authHeaders(extra={}){ return token ? {...extra, Authorization:'Bearer '+token} : extra; }

// Check auth
async function checkAuth(){
  if(!token){ showLogin(); return; }
  const r = await fetch('/api/auth/me',{headers:authHeaders()});
  if(!r.ok){ showLogin(); return; }
  const j = await r.json();
  $('#adminEmail').textContent = j.email||'';
  showApp();
}
function showLogin(){ $('#loginView').classList.remove('hidden'); $('#appView').classList.add('hidden'); }
function showApp(){ $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden'); loadAll(); }

$('#loginForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = {email: fd.get('email'), password: fd.get('password')};
  const r = await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j = await r.json();
  if(!r.ok){ $('#loginErr').textContent = j.error||'Login failed'; $('#loginErr').classList.remove('hidden'); return; }
  token = j.token; localStorage.setItem('ww_token', token);
  checkAuth();
});
$('#logoutBtn').onclick = async()=>{ await fetch('/api/auth/logout',{method:'POST'}); localStorage.removeItem('ww_token'); token=''; showLogin(); };
const restoreBtn=$('#restoreBackupBtn');
if(restoreBtn) restoreBtn.onclick = async()=>{
  if(!(await confirmModal('Restore from Postgres backup?','This overwrites everything on this server (text, images, videos, team, pricing) with the saved backup. Use it when the site shows stale content after a deploy.','Restore now'))) return;
  restoreBtn.disabled=true; restoreBtn.textContent='Restoring… (takes ~2 min for videos)';
  try{
    const r=await fetch('/api/backup/restore',{method:'POST',headers:authHeaders()});
    const j=await r.json();
    if(!r.ok) throw new Error(j.error||'Restore failed');
    alert(`Restored ${j.tables||0} rows and ${j.files||0} files. Reload the live site to verify.`);
    loadAll();
  }catch(e){ alert(e.message); }
  restoreBtn.disabled=false; restoreBtn.textContent='Restore from Postgres backup';
};

// Tab nav
$$('.snav button').forEach(b=> b.onclick=()=>{
  $$('.snav button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  $$('.tab').forEach(t=>t.classList.remove('active')); $('#tab-'+b.dataset.tab).classList.add('active');
});
$$('[data-goto]').forEach(b=> b.onclick=()=>{ const t=b.dataset.goto; const btn=$(`.snav button[data-tab="${t}"]`); if(btn) btn.click(); });

// ── Popup modal editor (every Edit button opens this — no prompt() dialogs) ──
function closeModal(){ const m=$('#wwModal'); if(m) m.remove(); document.removeEventListener('keydown', escClose); }
function escClose(e){ if(e.key==='Escape') closeModal(); }
// In-website confirm popup (replaces native confirm() for deletes)
function confirmModal(title, message, confirmLabel){
  return new Promise(resolve=>{
    closeModal();
    const back=document.createElement('div');
    back.className='modal-backdrop'; back.id='wwModal';
    back.addEventListener('click', e=>{ if(e.target===back){ closeModal(); resolve(false); } });
    const card=document.createElement('div'); card.className='modal-card'; card.style.maxWidth='420px';
    const head=document.createElement('div'); head.className='modal-head';
    const h3=document.createElement('h3'); h3.textContent=title; head.appendChild(h3);
    const x=document.createElement('button'); x.type='button'; x.className='modal-x'; x.textContent='×';
    x.onclick=()=>{ closeModal(); resolve(false); };
    head.appendChild(x); card.appendChild(head);
    const body=document.createElement('div'); body.className='modal-body';
    const p=document.createElement('p'); p.className='muted'; p.style.fontSize='13px'; p.textContent=message; body.appendChild(p);
    const acts=document.createElement('div'); acts.className='modal-actions';
    const cancel=document.createElement('button'); cancel.type='button'; cancel.className='btn btn-ghost btn-sm'; cancel.textContent='Cancel';
    cancel.onclick=()=>{ closeModal(); resolve(false); };
    const ok=document.createElement('button'); ok.type='button'; ok.className='btn btn-primary btn-sm'; ok.textContent=confirmLabel||'Delete'; ok.style.background='#ef4444';
    ok.onclick=()=>{ closeModal(); resolve(true); };
    acts.appendChild(cancel); acts.appendChild(ok); body.appendChild(acts);
    card.appendChild(body); back.appendChild(card); document.body.appendChild(back);
    const off=e=>{ if(e.key==='Escape'){ document.removeEventListener('keydown', off); resolve(false); } };
    document.addEventListener('keydown', off);
    setTimeout(()=>cancel.focus(),60);
  });
}
/*
  openModal({ title, subtitle, previewUrl, fields, submitLabel, onSubmit })
  field = { key, label, type:'text'|'textarea'|'number'|'select'|'checkbox'|'url', value, placeholder, options:[{value,label}], rows, half:true }
*/
function openModal(opts){
  closeModal();
  const back=document.createElement('div');
  back.className='modal-backdrop'; back.id='wwModal';
  back.addEventListener('click', e=>{ if(e.target===back) closeModal(); });
  const card=document.createElement('div'); card.className='modal-card';
  const head=document.createElement('div'); head.className='modal-head';
  const ht=document.createElement('div');
  const h3=document.createElement('h3'); h3.textContent=opts.title||'Edit'; ht.appendChild(h3);
  if(opts.subtitle){ const p=document.createElement('p'); p.className='muted'; p.style.fontSize='12px'; p.textContent=opts.subtitle; ht.appendChild(p); }
  const x=document.createElement('button'); x.type='button'; x.className='modal-x'; x.textContent='×'; x.title='Close'; x.onclick=closeModal;
  head.appendChild(ht); head.appendChild(x); card.appendChild(head);
  if(opts.previewUrl){
    const pv=document.createElement('div'); pv.className='modal-preview';
    const isVid=/\.(mp4|webm|mov)(\?|$)/i.test(opts.previewUrl);
    if(isVid){ const v=document.createElement('video'); v.src=opts.previewUrl; v.controls=true; v.preload='metadata'; pv.appendChild(v); }
    else { const im=document.createElement('img'); im.src=opts.previewUrl; im.alt=''; pv.appendChild(im); }
    card.appendChild(pv);
  }
  const form=document.createElement('form'); form.className='modal-body';
  const inputs={};
  let row=null;
  (opts.fields||[]).forEach(f=>{
    if(f.type==='checkbox'){
      const lab=document.createElement('label'); lab.className='modal-check';
      const inp=document.createElement('input'); inp.type='checkbox'; inp.checked=!!f.value;
      const sp=document.createElement('span'); sp.textContent=f.label;
      lab.appendChild(inp); lab.appendChild(sp); form.appendChild(lab);
      inputs[f.key]=inp; row=null; return;
    }
    const lab=document.createElement('label'); lab.className='modal-field';
    const sp=document.createElement('span'); sp.textContent=f.label; lab.appendChild(sp);
    let inp;
    if(f.type==='textarea'){ inp=document.createElement('textarea'); inp.rows=f.rows||3; inp.value=f.value??''; }
    else if(f.type==='select'){
      inp=document.createElement('select');
      (f.options||[]).forEach(o=>{ const op=document.createElement('option'); op.value=o.value; op.textContent=o.label; inp.appendChild(op); });
      inp.value=f.value??'';
    }
    else { inp=document.createElement('input'); inp.type=f.type==='number'?'number':(f.type||'text'); inp.value=f.value??''; if(f.placeholder) inp.placeholder=f.placeholder; }
    if(f.required) inp.required=true;
    lab.appendChild(inp); inputs[f.key]=inp;
    if(f.half){
      if(!row){ row=document.createElement('div'); row.className='modal-field-row'; form.appendChild(row); }
      row.appendChild(lab);
      if(row.children.length>=2) row=null;
    } else { form.appendChild(lab); row=null; }
  });
  const err=document.createElement('div'); err.className='modal-err'; form.appendChild(err);
  const acts=document.createElement('div'); acts.className='modal-actions';
  const cancel=document.createElement('button'); cancel.type='button'; cancel.className='btn btn-ghost btn-sm'; cancel.textContent='Cancel'; cancel.onclick=closeModal;
  const save=document.createElement('button'); save.type='submit'; save.className='btn btn-primary btn-sm'; save.textContent=opts.submitLabel||'Save changes';
  acts.appendChild(cancel); acts.appendChild(save); form.appendChild(acts);
  form.addEventListener('submit', async e=>{
    e.preventDefault(); err.textContent=''; save.disabled=true; save.textContent='Saving…';
    try{
      const values={};
      for(const [k,inp] of Object.entries(inputs)) values[k]= inp.type==='checkbox' ? inp.checked : inp.value;
      await opts.onSubmit(values);
      closeModal();
    }catch(ex){ err.textContent=ex.message||'Save failed'; save.disabled=false; save.textContent=opts.submitLabel||'Save changes'; }
  });
  card.appendChild(form); back.appendChild(card); document.body.appendChild(back);
  document.addEventListener('keydown', escClose);
  const first=form.querySelector('input,textarea,select'); if(first) setTimeout(()=>first.focus(),60);
}

// Loaders
async function loadAll(){
  loadContent(); loadMediaTab(); loadTeam(); loadSections(); loadTheme(); loadLeads(); loadAnalytics(); loadKPIs();
  loadCertificates(); loadProcess(); loadPricing(); loadFaqs(); loadBranding();
}

// ── Content editor grouped by section (dynamic from /api/content/raw) ──
async function loadContent(){
  const r = await fetch('/api/content/raw');
  const rows = await r.json();
  const groups={};
  rows.forEach(row=>{
    const sec=row.section||'general';
    if(!groups[sec]) groups[sec]=[];
    groups[sec].push(row);
  });
  const order = ['meta','header','hero','social_proof','portfolio','proof','experts','process','certificates','pricing','testimonials','faq','form','footer','theme','general'];
  const sortedSecs = Object.keys(groups).sort((a,b)=>{
    const ia=order.indexOf(a), ib=order.indexOf(b);
    if(ia===-1 && ib===-1) return a.localeCompare(b);
    if(ia===-1) return 1; if(ib===-1) return -1;
    return ia-ib;
  });
  const container = $('#contentEditor');
  // build search
  container.innerHTML = `<input id="contentSearch" placeholder="Filter keys… (e.g. hero, pricing)" style="width:100%;margin-bottom:12px;padding:8px 10px;border:1px solid var(--border);border-radius:8px">` + sortedSecs.map(sec=>{
    const keys=groups[sec];
    return `<div class="card" style="padding:14px;margin-top:12px" data-section="${sec}">
      <h3 style="text-transform:capitalize;display:flex;justify-content:space-between;align-items:center">${sec.replace('_',' ')} <span class="muted" style="font-size:11px">${keys.length} fields</span></h3>
      ${keys.map(row=>{
        const isLong = row.value.length>80 || row.key.includes('headline') || row.key.includes('subhead') || row.key.includes('description');
        if(isLong){
          return `<label style="margin-top:10px">${row.key}<textarea data-key="${row.key}" rows="2">${(row.value||'').replace(/</g,'&lt;')}</textarea></label>`;
        } else {
          return `<label style="margin-top:10px">${row.key}<input data-key="${row.key}" value="${(row.value||'').replace(/"/g,'&quot;')}"></label>`;
        }
      }).join('')}
      <button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="saveSection('${sec}')">Save ${sec}</button>
    </div>`;
  }).join('') + `<div class="card" style="padding:14px;margin-top:12px"><h3>Add new content key</h3><p class="muted">Create any new editable field — appears instantly on frontend via /api/content.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px"><label>Key (unique, snake_case)<input id="newContentKey" placeholder="e.g. hero_badge"></label><label>Section<input id="newContentSec" placeholder="e.g. hero"></label></div><label style="margin-top:8px">Value<textarea id="newContentVal" placeholder="Text / HTML"></textarea></label><button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="addContentKey()">Add Key</button></div>`;
  // filter
  const search=$('#contentSearch');
  if(search) search.addEventListener('input', e=>{
    const q=e.target.value.toLowerCase();
    container.querySelectorAll('[data-section]').forEach(card=>{
      const sec=card.dataset.section;
      const visible = q==='' || sec.includes(q) || [...card.querySelectorAll('[data-key]')].some(i=> i.dataset.key.toLowerCase().includes(q));
      card.style.display = visible ? '' : 'none';
    });
  });
}
window.saveSection = async (sec)=>{
  const card = document.querySelector(`[data-section="${sec}"]`);
  if(!card) return alert('Section not found');
  const inputs = [...card.querySelectorAll('[data-key]')];
  const jobs = inputs.map(i=> fetch('/api/content/'+encodeURIComponent(i.dataset.key),{method:'PUT',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({value:i.value})}));
  const res = await Promise.all(jobs);
  const ok = res.every(r=>r.ok);
  alert(ok ? 'Saved '+sec : 'Some saves failed');
};
window.addContentKey = async ()=>{
  const key=$('#newContentKey').value.trim();
  const sec=$('#newContentSec').value.trim()||'general';
  const val=$('#newContentVal').value;
  if(!key) return alert('Key required');
  const r=await fetch('/api/content/'+encodeURIComponent(key),{method:'PUT',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({value:val, section: sec})});
  if(r.ok){ alert('Created '+key); loadContent(); } else { const j=await r.json(); alert(j.error||'Failed'); }
};

// ── Media (portfolio / sales_proof / testimonials) ──
let currentMtype='portfolio';
$$('.mini').forEach(b=> b.onclick=()=>{
  $$('.mini').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  currentMtype=b.dataset.mtype; $('#mtypeLabel').textContent=currentMtype; loadMediaTab();
});
function loadMediaTab(){ renderMedia(currentMtype); }
async function renderMedia(type){
  const r = await fetch('/api/media?type='+type, {headers:authHeaders()});
  const items = await r.json();
  const isVideo = u => /\.(mp4|webm|mov)(\?|$)/i.test(u||'');
  $('#mediaGrid').innerHTML = items.map(m=>`
    <div class="card item-card">
      ${isVideo(m.url) ? `<video src="${m.url}" controls preload="metadata" style="width:120px;border-radius:8px;background:#000"></video>` : `<img src="${m.url}" alt="">`}
      <div style="flex:1;min-width:0">
        <strong style="font-size:13px">${m.caption||'(no caption)'}</strong>
        <p class="muted">${m.category||''} • ${isVideo(m.url)?'Video': 'Image'} • ${m.published?'Published':'Draft'} • order ${m.order}</p>
        <p class="muted" style="font-size:11px;word-break:break-all">${m.url}</p>
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="editMedia(${m.id}, '${type}')">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="togglePublish(${m.id}, ${m.published?0:1})">${m.published?'Unpublish':'Publish'}</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteMedia(${m.id})" style="color:#ef4444">Delete</button>
        </div>
      </div>
    </div>
  `).join('') || '<p class="muted">No items.</p>';
}
window.editMedia = async (id, type)=>{
  const r = await fetch('/api/media?type='+type, {headers:authHeaders()});
  const items = await r.json();
  const m = items.find(x=>x.id===id);
  if(!m) return alert('Item not found');
  openModal({
    title:'Edit media item', subtitle:(m.type||'')+' • '+(m.url||''), previewUrl:m.url,
    fields:[
      {key:'caption', label:'Caption / Quote', type:'textarea', value:m.caption||'', rows:2},
      {key:'category', label:'Category / Tag', value:m.category||'', half:true},
      {key:'alt_text', label:'Alt text (SEO)', value:m.alt_text||'', half:true},
      {key:'url', label:'Replace file URL (leave blank to keep current file)', type:'url', value:'', placeholder:m.url||''},
      {key:'type', label:'Section', type:'select', value:m.type||type, options:[
        {value:'portfolio', label:'Portfolio — Stores Built for Conversion'},
        {value:'sales_proof', label:'Sales Proof — Real Revenue'},
        {value:'testimonials', label:'Testimonials — What Founders Say'},
      ], half:true},
      {key:'order', label:'Order (0 = first)', type:'number', value:m.order??0, half:true},
      {key:'published', label:'Published — visible on live site', type:'checkbox', value:!!m.published},
    ],
    onSubmit: async v=>{
      const payload={ caption:v.caption, category:v.category, alt_text:v.alt_text, type:v.type, order:parseInt(v.order)||0, published:v.published?1:0 };
      if(v.url.trim()) payload.url=v.url.trim();
      const u=await fetch('/api/media/'+id,{method:'PATCH',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify(payload)});
      if(!u.ok){ const j=await u.json().catch(()=>({})); throw new Error(j.error||'Save failed'); }
      renderMedia(currentMtype);
    }
  });
};
window.togglePublish=async(id, pub)=>{ await fetch('/api/media/'+id,{method:'PATCH',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({published:pub})}); renderMedia(currentMtype); };
window.deleteMedia=async(id)=>{ if(!(await confirmModal('Delete media item?','This removes it from the live site immediately. You can re-upload it anytime.','Delete'))) return; await fetch('/api/media/'+id,{method:'DELETE',headers:authHeaders()}); renderMedia(currentMtype); };

$('#mediaForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  fd.set('type', currentMtype);
  $('#uploadProgress').classList.remove('hidden');
  const fileInput = e.target.querySelector('input[type="file"]');
  if(fileInput.files[0]){
    const f = fileInput.files[0];
    const url = URL.createObjectURL(f);
    const prev = $('#mediaPreview');
    prev.classList.remove('hidden');
    const img = prev.querySelector('img'), vid = prev.querySelector('video');
    if(f.type.startsWith('video')){ if(img) img.style.display='none'; if(vid){ vid.src=url; vid.style.display='block'; } }
    else { if(vid) vid.style.display='none'; if(img){ img.src=url; img.style.display='block'; } }
  } else if(fd.get('url')){
    $('#mediaPreview img').src = fd.get('url'); $('#mediaPreview').classList.remove('hidden');
  }
  const r = await fetch('/api/media',{method:'POST',headers:authHeaders(),body: fd});
  $('#uploadProgress').classList.add('hidden');
  if(!r.ok){ const j=await r.json(); alert(j.error||'Upload failed'); return; }
  e.target.reset(); $('#mediaPreview').classList.add('hidden');
  renderMedia(currentMtype);
});

// ── Certificates ──
async function loadCertificates(){
  const r=await fetch('/api/certificates',{headers:authHeaders()});
  const items=await r.json();
  $('#certGrid').innerHTML = items.map(c=>`
    <div class="card item-card">
      <img src="${c.image_url}" alt="">
      <div style="flex:1;min-width:0">
        <strong>${c.title}</strong><p class="muted">${c.issuer||''} • ${c.category||''} • ${c.published?'Published':'Draft'} • order ${c.order}</p>
        <p class="muted" style="font-size:11px">${c.description||''}</p>
        <p class="muted" style="font-size:11px;word-break:break-all">${c.image_url}</p>
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="editCert(${c.id})">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleCert(${c.id}, ${c.published?0:1})">${c.published?'Unpublish':'Publish'}</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteCert(${c.id})" style="color:#ef4444">Delete</button>
        </div>
      </div>
    </div>
  `).join('') || '<p class="muted">No certificates yet — upload one above.</p>';
}
window.editCert=async(id)=>{
  const r=await fetch('/api/certificates',{headers:authHeaders()});
  const items=await r.json();
  const c=items.find(x=>x.id===id);
  if(!c) return alert('Certificate not found');
  openModal({
    title:'Edit certificate / award', previewUrl:c.image_url,
    fields:[
      {key:'title', label:'Title *', value:c.title||'', required:true},
      {key:'issuer', label:'Issuer', value:c.issuer||'', placeholder:'e.g. Shopify, Inc.', half:true},
      {key:'category', label:'Category / Badge', value:c.category||'', placeholder:'e.g. Partnership, Award', half:true},
      {key:'description', label:'Description', type:'textarea', value:c.description||'', rows:3},
      {key:'image_url', label:'Replace image URL (leave blank to keep current image)', type:'url', value:'', placeholder:c.image_url||''},
      {key:'order', label:'Order (0 = first)', type:'number', value:c.order??0, half:true},
      {key:'published', label:'Published — visible on live site', type:'checkbox', value:!!c.published},
    ],
    onSubmit: async v=>{
      const payload={ title:v.title, issuer:v.issuer, description:v.description, category:v.category, order:parseInt(v.order)||0, published:v.published?1:0 };
      if(v.image_url.trim()) payload.image_url=v.image_url.trim();
      const u=await fetch('/api/certificates/'+id,{method:'PATCH',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify(payload)});
      if(!u.ok){ const j=await u.json().catch(()=>({})); throw new Error(j.error||'Save failed'); }
      loadCertificates();
    }
  });
};
window.toggleCert=async(id,pub)=>{ await fetch('/api/certificates/'+id,{method:'PATCH',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({published:pub})}); loadCertificates(); };
window.deleteCert=async(id)=>{ if(!(await confirmModal('Delete certificate?','This award will disappear from the homepage.','Delete'))) return; await fetch('/api/certificates/'+id,{method:'DELETE',headers:authHeaders()}); loadCertificates(); };
const certForm=$('#certForm');
if(certForm){
  certForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    // preview
    const file=e.target.querySelector('input[type="file"]').files[0];
    if(file){
      const reader=new FileReader();
      reader.onload=ev=>{ $('#certPreview img').src=ev.target.result; $('#certPreview').classList.remove('hidden'); };
      reader.readAsDataURL(file);
    } else if(fd.get('image_url')){
      $('#certPreview img').src=fd.get('image_url'); $('#certPreview').classList.remove('hidden');
    }
    const r=await fetch('/api/certificates',{method:'POST',headers:authHeaders(),body:fd});
    if(!r.ok){ const j=await r.json(); alert(j.error||'Upload failed'); return; }
    e.target.reset(); $('#certPreview').classList.add('hidden'); loadCertificates();
  });
}

// ── Team ──
async function loadTeam(){
  const r = await fetch('/api/team',{headers:authHeaders()});
  const items = await r.json();
  $('#teamGrid').innerHTML = items.map(t=>`
    <div class="card item-card">
      <img src="${t.photo_url}" alt="" style="border-radius:50%">
      <div style="flex:1;min-width:0">
        <strong>${t.name}</strong><p class="muted">${t.role||''} — ${t.credibility_note||''}</p>
        <p class="muted">${t.published?'Published':'Draft'} • order ${t.order}</p>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="btn btn-ghost btn-sm" onclick="editTeam(${t.id})">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleTeamPub(${t.id}, ${t.published?0:1})">${t.published?'Unpublish':'Publish'}</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteTeam(${t.id})" style="color:#ef4444">Delete</button>
        </div>
      </div>
    </div>
  `).join('') || '<p class="muted">No experts yet.</p>';
}
window.editTeam=async(id)=>{
  const r=await fetch('/api/team',{headers:authHeaders()});
  const items=await r.json();
  const t=items.find(x=>x.id===id);
  if(!t) return alert('Expert not found');
  openModal({
    title:'Edit expert', previewUrl:t.photo_url,
    fields:[
      {key:'name', label:'Name *', value:t.name||'', required:true, half:true},
      {key:'role', label:'Role / Title', value:t.role||'', placeholder:'e.g. Head of Conversion', half:true},
      {key:'credibility_note', label:'Credibility note', type:'textarea', value:t.credibility_note||'', rows:2, placeholder:'e.g. Led 40+ store launches'},
      {key:'photo_url', label:'Replace photo URL (leave blank to keep current photo)', type:'url', value:'', placeholder:t.photo_url||''},
      {key:'social_url', label:'Social / LinkedIn URL', type:'url', value:t.social_url||''},
      {key:'order', label:'Order (0 = first)', type:'number', value:t.order??0, half:true},
      {key:'published', label:'Published — visible on live site', type:'checkbox', value:!!t.published},
    ],
    onSubmit: async v=>{
      const payload={ name:v.name, role:v.role, credibility_note:v.credibility_note, social_url:v.social_url, order:parseInt(v.order)||0, published:v.published?1:0 };
      if(v.photo_url.trim()) payload.photo_url=v.photo_url.trim();
      const u=await fetch('/api/team/'+id,{method:'PATCH',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify(payload)});
      if(!u.ok){ const j=await u.json().catch(()=>({})); throw new Error(j.error||'Save failed'); }
      loadTeam();
    }
  });
};
window.toggleTeamPub=async(id,pub)=>{ await fetch('/api/team/'+id,{method:'PATCH',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({published:pub})}); loadTeam(); };
window.deleteTeam=async(id)=>{ if(!(await confirmModal('Delete expert?','This profile will disappear from the homepage.','Delete'))) return; await fetch('/api/team/'+id,{method:'DELETE',headers:authHeaders()}); loadTeam(); };
$('#teamForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const fd=new FormData(e.target);
  const r=await fetch('/api/team',{method:'POST',headers:authHeaders(),body:fd});
  if(!r.ok){ const j=await r.json(); alert(j.error||'Failed'); return; }
  e.target.reset(); loadTeam();
});

// ── Process Steps ──
async function loadProcess(){
  const r=await fetch('/api/process-steps',{headers:authHeaders()});
  const items=await r.json();
  $('#processList').innerHTML = items.map(s=>`
    <div class="card item-card">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800">${s.step_num}</div>
      <div style="flex:1;min-width:0">
        <strong>${s.title}</strong><p class="muted">${s.description||''}</p>
        <p class="muted">${s.published?'Published':'Draft'} • order ${s.order}</p>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="btn btn-ghost btn-sm" onclick="editProcess(${s.id})">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleProcess(${s.id}, ${s.published?0:1})">${s.published?'Unpublish':'Publish'}</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteProcess(${s.id})" style="color:#ef4444">Delete</button>
        </div>
      </div>
    </div>
  `).join('') || '<p class="muted">No steps.</p>';
}
window.editProcess=async(id)=>{
  const r=await fetch('/api/process-steps',{headers:authHeaders()});
  const items=await r.json();
  const s=items.find(x=>x.id===id);
  if(!s) return alert('Step not found');
  openModal({
    title:'Edit process step',
    fields:[
      {key:'step_num', label:'Step number', type:'number', value:s.step_num??1, half:true},
      {key:'order', label:'Order (0 = first)', type:'number', value:s.order??0, half:true},
      {key:'title', label:'Title *', value:s.title||'', required:true},
      {key:'description', label:'Description', type:'textarea', value:s.description||'', rows:3},
      {key:'published', label:'Published — visible on live site', type:'checkbox', value:!!s.published},
    ],
    onSubmit: async v=>{
      const payload={ step_num:parseInt(v.step_num)||1, title:v.title, description:v.description, order:parseInt(v.order)||0, published:v.published?1:0 };
      const u=await fetch('/api/process-steps/'+id,{method:'PATCH',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify(payload)});
      if(!u.ok){ const j=await u.json().catch(()=>({})); throw new Error(j.error||'Save failed'); }
      loadProcess();
    }
  });
};
window.toggleProcess=async(id,pub)=>{ await fetch('/api/process-steps/'+id,{method:'PATCH',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({published:pub})}); loadProcess(); };
window.deleteProcess=async(id)=>{ if(!(await confirmModal('Delete step?','This step will disappear from the process section.','Delete'))) return; await fetch('/api/process-steps/'+id,{method:'DELETE',headers:authHeaders()}); loadProcess(); };
$('#processForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const fd=new FormData(e.target);
  const body={step_num: parseInt(fd.get('step_num'))||1, title: fd.get('title'), description: fd.get('description')||'', order: parseInt(fd.get('order'))||0};
  const r=await fetch('/api/process-steps',{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify(body)});
  if(!r.ok){ const j=await r.json(); alert(j.error||'Failed'); return; }
  e.target.reset(); loadProcess();
});

// ── Pricing ──
async function loadPricing(){
  const r=await fetch('/api/pricing-plans',{headers:authHeaders()});
  const items=await r.json();
  $('#pricingList').innerHTML = items.map(p=>{
    const feats = Array.isArray(p.features)? p.features : [];
    return `<div class="card item-card" style="align-items:flex-start">
      <div style="flex:1;min-width:0">
        <strong>${p.name} — ${p.price} <small>${p.price_suffix||''}</small> ${p.featured?'<span style="background:var(--accent);color:#fff;padding:2px 6px;border-radius:999px;font-size:10px">Featured</span>':''}</strong>
        <p class="muted">${p.description||''}</p>
        <p class="muted" style="font-size:11px">CTA: ${p.cta_label||''} → ${p.cta_link||''}</p>
        <ul style="font-size:11px;margin:6px 0 0 16px;color:var(--muted)">${feats.map(f=>`<li>${f}</li>`).join('')}</ul>
        <p class="muted">${p.published?'Published':'Draft'} • order ${p.order}</p>
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="editPricing(${p.id})">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="togglePricing(${p.id}, ${p.published?0:1})">${p.published?'Unpublish':'Publish'}</button>
          <button class="btn btn-ghost btn-sm" onclick="deletePricing(${p.id})" style="color:#ef4444">Delete</button>
        </div>
      </div>
    </div>`;
  }).join('') || '<p class="muted">No plans.</p>';
}
window.editPricing=async(id)=>{
  const r=await fetch('/api/pricing-plans',{headers:authHeaders()});
  const items=await r.json();
  const p=items.find(x=>x.id===id);
  if(!p) return alert('Plan not found');
  const feats = Array.isArray(p.features) ? p.features.join('\n') : (p.features||'');
  openModal({
    title:'Edit pricing plan',
    fields:[
      {key:'name', label:'Name *', value:p.name||'', required:true, half:true},
      {key:'price', label:'Price *', value:p.price||'', required:true, placeholder:'e.g. $450 or Custom', half:true},
      {key:'price_suffix', label:'Price suffix', value:p.price_suffix||'', placeholder:'e.g. one-time, quote', half:true},
      {key:'order', label:'Order (0 = first)', type:'number', value:p.order??0, half:true},
      {key:'description', label:'Description', type:'textarea', value:p.description||'', rows:2},
      {key:'features', label:'Features (one per line)', type:'textarea', value:feats, rows:5},
      {key:'cta_label', label:'CTA button label', value:p.cta_label||'', half:true},
      {key:'cta_link', label:'CTA link', value:p.cta_link||'#apply', half:true},
      {key:'featured', label:'Featured — highlighted as Most Popular', type:'checkbox', value:!!p.featured},
      {key:'published', label:'Published — visible on live site', type:'checkbox', value:!!p.published},
    ],
    onSubmit: async v=>{
      const payload={ name:v.name, price:v.price, price_suffix:v.price_suffix, description:v.description,
        features:v.features.split('\n').map(s=>s.trim()).filter(Boolean),
        cta_label:v.cta_label, cta_link:v.cta_link||'#apply', order:parseInt(v.order)||0,
        featured:v.featured?1:0, published:v.published?1:0 };
      const u=await fetch('/api/pricing-plans/'+id,{method:'PATCH',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify(payload)});
      if(!u.ok){ const j=await u.json().catch(()=>({})); throw new Error(j.error||'Save failed'); }
      loadPricing();
    }
  });
};
window.togglePricing=async(id,pub)=>{ await fetch('/api/pricing-plans/'+id,{method:'PATCH',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({published:pub})}); loadPricing(); };
window.deletePricing=async(id)=>{ if(!(await confirmModal('Delete pricing plan?','This plan and its checkout option will disappear from the site.','Delete'))) return; await fetch('/api/pricing-plans/'+id,{method:'DELETE',headers:authHeaders()}); loadPricing(); };
$('#pricingForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const fd=new FormData(e.target);
  const feats = (fd.get('features')||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const body={name:fd.get('name'), price:fd.get('price'), price_suffix:fd.get('price_suffix')||'', description:fd.get('description')||'', features: feats, cta_label:fd.get('cta_label')||'', cta_link:fd.get('cta_link')||'#apply', order: parseInt(fd.get('order'))||0, featured: fd.get('featured')?1:0};
  // checkbox not in FormData if unchecked? Use element
  body.featured = e.target.querySelector('input[name="featured"]').checked ? 1:0;
  const r=await fetch('/api/pricing-plans',{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify(body)});
  if(!r.ok){ const j=await r.json(); alert(j.error||'Failed'); return; }
  e.target.reset(); loadPricing();
});

// ── FAQs ──
async function loadFaqs(){
  const r=await fetch('/api/faqs',{headers:authHeaders()});
  const items=await r.json();
  $('#faqListAdmin').innerHTML = items.map(f=>`
    <div class="card" style="padding:12px;margin-top:8px">
      <strong>${f.question}</strong><p class="muted" style="margin-top:4px;font-size:12px">${f.answer}</p>
      <p class="muted">${f.published?'Published':'Draft'} • order ${f.order}</p>
      <div style="display:flex;gap:6px;margin-top:6px">
        <button class="btn btn-ghost btn-sm" onclick="editFaq(${f.id})">Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="toggleFaq(${f.id}, ${f.published?0:1})">${f.published?'Unpublish':'Publish'}</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteFaq(${f.id})" style="color:#ef4444">Delete</button>
      </div>
    </div>
  `).join('') || '<p class="muted">No FAQs.</p>';
}
window.editFaq=async(id)=>{
  const r=await fetch('/api/faqs',{headers:authHeaders()});
  const items=await r.json();
  const f=items.find(x=>x.id===id);
  if(!f) return alert('FAQ not found');
  openModal({
    title:'Edit FAQ',
    fields:[
      {key:'question', label:'Question *', type:'textarea', value:f.question||'', rows:2, required:true},
      {key:'answer', label:'Answer *', type:'textarea', value:f.answer||'', rows:4, required:true},
      {key:'order', label:'Order (0 = first)', type:'number', value:f.order??0, half:true},
      {key:'published', label:'Published — visible on live site', type:'checkbox', value:!!f.published},
    ],
    onSubmit: async v=>{
      const payload={ question:v.question, answer:v.answer, order:parseInt(v.order)||0, published:v.published?1:0 };
      const u=await fetch('/api/faqs/'+id,{method:'PATCH',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify(payload)});
      if(!u.ok){ const j=await u.json().catch(()=>({})); throw new Error(j.error||'Save failed'); }
      loadFaqs();
    }
  });
};
window.toggleFaq=async(id,pub)=>{ await fetch('/api/faqs/'+id,{method:'PATCH',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({published:pub})}); loadFaqs(); };
window.deleteFaq=async(id)=>{ if(!(await confirmModal('Delete FAQ?','This question will disappear from the homepage.','Delete'))) return; await fetch('/api/faqs/'+id,{method:'DELETE',headers:authHeaders()}); loadFaqs(); };
$('#faqForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const fd=new FormData(e.target);
  const body={question: fd.get('question'), answer: fd.get('answer'), order: parseInt(fd.get('order'))||0};
  const r=await fetch('/api/faqs',{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify(body)});
  if(!r.ok){ const j=await r.json(); alert(j.error||'Failed'); return; }
  e.target.reset(); loadFaqs();
});

// ── Branding ──
async function loadBranding(){
  try{
    const r=await fetch('/api/content');
    const c=await r.json();
    const logo=c.site_logo||'';
    const fav=c.site_favicon||'';
    const pl=document.getElementById('previewLogo');
    const pf=document.getElementById('previewFavicon');
    const logoWrap=document.getElementById('brandingLogoPreview');
    const favWrap=document.getElementById('brandingFaviconPreview');
    if(pl){
      if(logo){ pl.src=logo; pl.style.display='inline-block'; if(logoWrap) logoWrap.querySelector('p').style.display='none'; } else { pl.style.display='none'; if(logoWrap) logoWrap.querySelector('p').style.display=''; }
    }
    if(pf){
      if(fav){ pf.src=fav; pf.style.display='inline-block'; if(favWrap) favWrap.querySelector('p').style.display='none'; } else { pf.style.display='none'; if(favWrap) favWrap.querySelector('p').style.display=''; }
    }
    const bt=document.getElementById('brandTitle');
    const bd=document.getElementById('brandDesc');
    if(bt) bt.value=c.site_title||'';
    if(bd) bd.value=c.site_description||'';
  }catch(e){ console.warn('branding load failed',e); }
}
window.removeBranding = async (type)=>{
  const key = type==='logo' ? 'site_logo' : 'site_favicon';
  if(!(await confirmModal('Remove '+type+'?','The text logo will be shown instead. You can re-upload anytime.','Remove'))) return;
  await fetch('/api/content/'+key,{method:'PUT',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({value:''})});
  loadBranding();
};
window.saveBrandingMeta = async ()=>{
  const title=document.getElementById('brandTitle').value;
  const desc=document.getElementById('brandDesc').value;
  await fetch('/api/content/site_title',{method:'PUT',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({value:title})});
  await fetch('/api/content/site_description',{method:'PUT',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({value:desc})});
  alert('Branding saved');
};
// Bind logo/favicon forms after DOM ready
setTimeout(()=>{
  const lf=document.getElementById('logoForm');
  if(lf) lf.addEventListener('submit', async e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const r=await fetch('/api/branding/logo',{method:'POST',headers:authHeaders(),body:fd});
    if(!r.ok){ const j=await r.json(); alert(j.error||'Upload failed'); return; }
    const j=await r.json();
    document.getElementById('previewLogo').src=j.url; document.getElementById('previewLogo').style.display='inline-block';
    alert('Logo uploaded'); loadBranding();
    e.target.reset();
  });
  const ff=document.getElementById('faviconForm');
  if(ff) ff.addEventListener('submit', async e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const r=await fetch('/api/branding/favicon',{method:'POST',headers:authHeaders(),body:fd});
    if(!r.ok){ const j=await r.json(); alert(j.error||'Upload failed'); return; }
    alert('Favicon uploaded'); loadBranding();
    e.target.reset();
  });
},500);

// ── Sections
async function loadSections(){
  const r=await fetch('/api/sections');
  const items=await r.json();
  $('#sectionsList').innerHTML = items.map(s=>`
    <div class="card" style="padding:12px;display:flex;align-items:center;gap:12px;margin-top:8px" draggable="true" data-key="${s.key}">
      <span style="cursor:grab">☰</span>
      <strong style="flex:1;text-transform:capitalize">${s.key.replace('_',' ')}</strong>
      <label style="flex-direction:row;align-items:center;font-weight:500"><input type="checkbox" ${s.visible?'checked':''} onchange="toggleSec('${s.key}','visible',this.checked)"> Visible</label>
      <label style="flex-direction:row;align-items:center;font-weight:500"><input type="checkbox" ${s.animation_enabled?'checked':''} onchange="toggleSec('${s.key}','animation_enabled',this.checked)"> Animation</label>
    </div>
  `).join('');
  let dragKey=null;
  $('#sectionsList').querySelectorAll('[draggable]').forEach(el=>{
    el.addEventListener('dragstart',()=> dragKey=el.dataset.key);
    el.addEventListener('dragover', e=> e.preventDefault());
    el.addEventListener('drop', async e=>{
      e.preventDefault();
      const targetKey=el.dataset.key;
      if(!targetKey||!dragKey||targetKey===dragKey) return;
      const order = [...$('#sectionsList').children].map(c=>c.dataset.key);
      const from = order.indexOf(dragKey), to = order.indexOf(targetKey);
      order.splice(to,0, order.splice(from,1)[0]);
      await fetch('/api/sections',{method:'PUT',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({order})});
      loadSections();
    });
  });
}
window.toggleSec=async(key, field, val)=>{
  await fetch('/api/sections/'+key,{method:'PUT',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({[field]:val})});
};

// ── Theme
async function loadTheme(){
  const r=await fetch('/api/content');
  const c=await r.json();
  $('#th_canvas').value=c.theme_canvas||'#FAF9F6';
  $('#th_ink').value=c.theme_ink||'#121212';
  $('#th_border').value=c.theme_border||'#E5E5E5';
  $('#th_accent').value=c.theme_accent||'#0F9D58';
  $('#th_accent2').value=c.theme_accent_secondary||'#C9A227';
  updateThemePrev();
  const s=await (await fetch('/api/stats')).json();
  $('#statsEditor').innerHTML = Object.entries(s).map(([k,v])=>`
    <label>${k}<input data-stat="${k}" value="${v}"></label>
  `).join('') + `<button class="btn btn-primary btn-sm" onclick="saveStats()">Save Stats</button>`;
}
function updateThemePrev(){
  const cols = [$('#th_canvas').value, $('#th_ink').value, $('#th_accent').value, $('#th_accent2').value];
  const box=$('#themePrevBox');
  if(!box) return;
  box.querySelectorAll('i').forEach((el,i)=> el.style.background=cols[i]||'#eee');
}
['#th_canvas','#th_ink','#th_border','#th_accent','#th_accent2'].forEach(sel=> { const el=$(sel); if(el) el.addEventListener('input', updateThemePrev); });
const themeSave=$('#themeSave');
if(themeSave) themeSave.onclick=async()=>{
  const map={theme_canvas:$('#th_canvas').value, theme_ink:$('#th_ink').value, theme_border:$('#th_border').value, theme_accent:$('#th_accent').value, theme_accent_secondary:$('#th_accent2').value};
  for(const [k,v] of Object.entries(map)) await fetch('/api/content/'+k,{method:'PUT',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({value:v})});
  alert('Theme saved. Open live site to see preview.');
};
window.saveStats=async()=>{
  for(const inp of $$('#statsEditor input[data-stat]')){
    await fetch('/api/stats/'+inp.dataset.stat,{method:'PUT',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({value:inp.value})});
  }
  alert('Stats saved');
};

// ── Leads
async function loadLeads(){
  const q = new URLSearchParams({limit:100});
  const search=$('#leadSearch').value.trim(); if(search) q.set('search',search);
  const stage=$('#leadStageFilter').value; if(stage) q.set('stage',stage);
  const r=await fetch('/api/leads?'+q,{headers:authHeaders()});
  if(!r.ok) return;
  const leads=await r.json();
  const stages=['new','contacted','scheduled','closed','archived'];
  const byStage={}; stages.forEach(s=>byStage[s]=[]);
  leads.forEach(l=> (byStage[l.pipeline_stage]||byStage['new']).push(l));
  $('#kanban').innerHTML = stages.map(s=>`
    <div class="kan-col"><div class="kan-head"><span>${s}</span><span>${byStage[s].length}</span></div>
    <div class="kan-body">${byStage[s].map(l=>`
      <div class="lead-mini">
        <strong>${l.name}</strong> ${l.wasScammed==='yes'?'<span class="badge high">High Empathy Needed</span>':''}
        <p>${l.storeName||''} • ${l.investmentRange||''}</p>
        <p>${l.email} • ${l.whatsapp}</p>
        <p class="muted">webhook: ${l.webhook_status} • ${new Date(l.created_at).toLocaleDateString()}</p>
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
          <select onchange="moveLead(${l.id}, this.value)" style="padding:4px 6px;font-size:11px;width:auto">
            ${stages.map(st=>`<option value="${st}" ${st===l.pipeline_stage?'selected':''}>${st}</option>`).join('')}
          </select>
          ${l.webhook_status!=='sent'?`<button class="btn btn-ghost btn-sm" onclick="resendLead(${l.id})">Resend</button>`:''}
        </div>
      </div>
    `).join('') || '<p class="muted" style="font-size:11px;text-align:center">—</p>'}</div></div>
  `).join('');
  $('#leadsList').innerHTML = '';
}
window.moveLead=async(id, stage)=>{ await fetch('/api/leads/'+id,{method:'PATCH',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({pipeline_stage:stage})}); loadLeads(); loadKPIs(); };
window.resendLead=async(id)=>{ const r=await fetch('/api/leads/'+id,{method:'PATCH',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({resendWebhook:true})}); const j=await r.json(); alert('Resend: '+j.webhook_status); loadLeads(); };
const leadSearch=$('#leadSearch');
if(leadSearch) leadSearch.addEventListener('input', debounce(loadLeads, 400));
const leadStageFilter=$('#leadStageFilter');
if(leadStageFilter) leadStageFilter.addEventListener('change', loadLeads);
const leadExport=$('#leadExport');
if(leadExport) leadExport.onclick=()=> window.location='/api/leads/export.csv';
function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

async function loadKPIs(){
  try{
    const r=await fetch('/api/analytics/summary',{headers:authHeaders()});
    if(!r.ok) return;
    const j=await r.json();
    $('#kpis').innerHTML = `
      <div class="card"><span>Total Views</span><strong>${j.totalViews||0}</strong></div>
      <div class="card"><span>Unique Visitors</span><strong>${j.uniqueSessions||0}</strong></div>
      <div class="card"><span>Total Leads</span><strong>${j.totalLeads||0}</strong></div>
      <div class="card"><span>Funnel: Start → Submit</span><strong>${j.funnel?.form_starts||0} → ${j.funnel?.form_submits||0}</strong></div>
    `;
  }catch{}
}
async function loadAnalytics(){
  const r=await fetch('/api/analytics/summary',{headers:authHeaders()});
  if(!r.ok){ $('#analyticsBox').innerHTML='<p class="muted">No data yet.</p>'; return; }
  const j=await r.json();
  $('#analyticsBox').innerHTML = `
    <div class="kpis" style="margin-bottom:12px">
      <div class="card"><span>Pageviews</span><strong>${j.totalViews}</strong></div>
      <div class="card"><span>Form Starts</span><strong>${j.funnel.form_starts}</strong></div>
      <div class="card"><span>Form Submits</span><strong>${j.funnel.form_submits}</strong></div>
      <div class="card"><span>Drop-off</span><strong>${j.funnel.form_starts? Math.round((1-j.funnel.form_submits/j.funnel.form_starts)*100)+'%':'—'}</strong></div>
    </div>
    <div class="card" style="padding:14px">
      <h3>CTA Click Breakdown</h3>
      <pre style="font-size:12px;white-space:pre-wrap;margin-top:8px">${JSON.stringify(j.ctaClicks,null,2)}</pre>
      <h3 style="margin-top:12px">Leads by Stage</h3>
      <pre style="font-size:12px;white-space:pre-wrap">${JSON.stringify(j.leadsByStage,null,2)}</pre>
      <h3 style="margin-top:12px">Leads per Day (14d)</h3>
      <pre style="font-size:12px;white-space:pre-wrap">${JSON.stringify(j.leadsPerDay,null,2)}</pre>
      <h3 style="margin-top:12px">Traffic Source (self-reported)</h3>
      <pre style="font-size:12px;white-space:pre-wrap">${JSON.stringify(j.traffic,null,2)}</pre>
      <h3 style="margin-top:12px">Recent Events</h3>
      <pre style="font-size:11px;white-space:pre-wrap;max-height:300px;overflow:auto">${JSON.stringify(j.recentEvents,null,2)}</pre>
    </div>
  `;
}

checkAuth();
