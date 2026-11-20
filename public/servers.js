/* Discord-style server rail (left, hover to expand) + create/join/settings dialogs. Needs auth.js (api()). */
(function(){
const DEF='cepalco',KEY='stb_sv',cur=()=>localStorage.getItem(KEY)||DEF,ONX=/cross\.html$/.test(location.pathname);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ROLE={admin:'Head',host:'Supervisor',staff:'Staff'};
const css=`
#svRail{position:fixed;left:0;top:0;bottom:0;width:72px;z-index:60;display:flex;flex-direction:column;gap:4px;padding:12px 12px;background:var(--panel,#fff);color:var(--ink,#111);border-right:1px solid var(--bd,#ddd);box-shadow:var(--sh,none);overflow:hidden;transition:width .18s ease,box-shadow .18s}
#svRail:hover,#svRail:focus-within,#svRail.open{width:248px;box-shadow:6px 0 24px rgba(0,0,0,.14)}
#svRail .svl{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:4px;overflow:hidden auto;scrollbar-width:none;margin:0 -12px;padding:0 12px}
#svRail .svl::-webkit-scrollbar{display:none}
#svRail{font-family:Quicksand,system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
.th-cepalco #svRail{border-right-width:3px}
#svRail .svh{font:800 .65rem/1 Quicksand,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;opacity:.55;height:14px;line-height:14px;white-space:nowrap;padding-left:4px;overflow:hidden}
#svRail hr{border:0;border-top:1px solid var(--bd,#ddd);margin:6px 4px;flex:0 0 auto;width:calc(100% - 8px)}
.svi{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:48px;padding:2px;border:0;background:none;color:inherit;font:700 .9rem Quicksand,system-ui,sans-serif;text-align:left;cursor:pointer;border-radius:16px;border:1px solid transparent;transition:background-color .15s,border-color .15s,transform .12s;white-space:nowrap;flex:0 0 auto;text-decoration:none}
.svi:hover{background:var(--soft,rgba(127,127,127,.14));border-color:var(--bd,#ddd)}
.svi:active{transform:scale(.98)}
.svi:focus-visible{outline:2px solid var(--acc,#6366f1);outline-offset:1px}
.svi i,.svi .av{flex:0 0 42px;width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font:800 .95rem Fredoka,Quicksand,system-ui,sans-serif;font-style:normal;color:#fff;transition:border-radius .15s,transform .15s;overflow:hidden}
.svi i{position:relative}
.svi i img,#svDlg .lgp img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
#svDlg .lgp{position:relative;width:56px;height:56px;flex:0 0 56px!important;border-radius:14px;overflow:hidden;display:grid;place-items:center;color:#fff;font:800 1.05rem Fredoka,sans-serif}
.svi .av img{width:100%;height:100%;object-fit:cover;display:block}
.svi:hover i,.svi.on i,.svi:hover .av{border-radius:11px}
.svi:active i{transform:scale(.94)}
.svi.on{background:var(--pri,#6366f1);color:var(--pi,#fff);border-color:var(--pri,#6366f1);box-shadow:var(--sh,none)}
.svi.on small{opacity:.85}
.svi.on i{box-shadow:0 0 0 2px rgba(255,255,255,.55)}
.svi>span:not(.av){overflow:hidden;text-overflow:ellipsis;display:flex;flex-direction:column;min-width:0;line-height:1.2;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:500;font-size:.95rem}
.svi small{font:600 .7rem Quicksand,system-ui,sans-serif;opacity:.65;overflow:hidden;text-overflow:ellipsis}
.svi.add i,.svi.cfg i{background:var(--soft,rgba(127,127,127,.2));border:1px solid var(--bd,#ddd);color:inherit;font-size:1.2rem}
.svi.add:hover i{background:#16a34a;color:#fff}
.svi.out i{background:rgba(220,38,38,.12);color:#dc2626;font-size:1.05rem}
.svi.out:hover{background:rgba(220,38,38,.12)}
.svi.out:hover i{background:#dc2626;color:#fff}
.svi.me .av{background:var(--pri,#6366f1);color:var(--pi,#fff);font-family:Fredoka,sans-serif}
body.hasrail{padding-left:72px}
.svb{position:absolute;left:30px;top:0;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#dc2626;color:#fff;font:800 .65rem/18px system-ui,sans-serif;text-align:center;border:2px solid var(--panel,#fff);box-sizing:content-box}
.svb[hidden]{display:none}
.svi.fr.on i{background:var(--pri,#6366f1);color:var(--pi,#fff)}
#svTab{display:none}
@media(max-width:700px){
 body.hasrail{padding-left:0}
 #svRail{width:248px;transform:translateX(-100%);transition:transform .18s}
 #svRail.open{transform:none}
 #svTab{font-family:Quicksand,system-ui,sans-serif;display:grid;position:fixed;left:0;top:50%;z-index:59;width:26px;height:56px;place-items:center;border:1px solid var(--bd,#ddd);border-left:0;border-radius:0 12px 12px 0;background:var(--panel,#fff);color:var(--ink,#111);cursor:pointer;box-shadow:var(--sh,none)}
}
@media(prefers-reduced-motion:reduce){#svRail,.svi i{transition:none}}
#svDlg{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(15,23,42,.6)}
#svDlg[hidden]{display:none}
#svDlg .box{font-family:Quicksand,system-ui,sans-serif;box-shadow:var(--sh,none);width:min(420px,100%);max-height:90dvh;overflow:auto;padding:20px;border-radius:18px;background:var(--panel,#fff);color:var(--ink,#111);border:1px solid var(--bd,#ddd);display:flex;flex-direction:column;gap:10px}
#svDlg h3{margin:0;font:600 1.2rem Fredoka,Quicksand,sans-serif}.th-cepalco #svDlg .box{border-width:3px}#svDlg p,#svDlg label{margin:0;font-size:.82rem;opacity:.8}
#svDlg input{width:100%;min-height:var(--ctl,44px);padding:10px 12px;border-radius:var(--r,12px);border:1px solid var(--bd,#ccc);background:transparent;color:inherit;font:inherit}
#svDlg .r{display:flex;gap:8px;flex-wrap:wrap}#svDlg .r>*{flex:1 1 auto}
#svDlg .code{font:800 1.3rem Fredoka,ui-monospace,monospace;letter-spacing:.18em;text-align:center;padding:10px;border:1px dashed var(--bd,#999);border-radius:10px;user-select:all}
#svDlg .err{color:#dc2626;font-size:.8rem;min-height:1em}
#svDlg .danger{color:#dc2626}`;
const st=document.createElement('style');st.textContent=css;document.head.append(st);
let LIST=[],ME=null,SUPER=false;
const hue=id=>{let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))%360;return h};
const ini=n=>(String(n).match(/[A-Za-z0-9]/g)||['?']).slice(0,2).join('').toUpperCase();
const LOGO_DAYS=15,LOGO_MS=LOGO_DAYS*864e5;
const sbg=s=>s.id===DEF?'background:#000;color:#facc15':`background:hsl(${hue(s.id)} 55% 45%)`;
const sini=s=>s.id===DEF?'CE':esc(ini(s.name));
const limg=s=>s.logoAt?`<img src="/api/server-logo/${esc(s.id)}?v=${+s.logoAt}" alt="" width="96" height="96" decoding="async" onerror="this.remove()">`:'';   // versioned URL -> cached forever by the browser/CDN
const icon=s=>`<i style="${sbg(s)}">${sini(s)}${limg(s)}</i>`;
// shrink a picked photo to a 96x96 centre-cropped WebP (JPEG if WebP is unsupported), <= ~20 KB, before it is uploaded
async function shrink(file){
  const bmp=await createImageBitmap(file),S=96,c=document.createElement('canvas');c.width=c.height=S;
  const k=Math.min(bmp.width,bmp.height),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,S,S);x.drawImage(bmp,(bmp.width-k)/2,(bmp.height-k)/2,k,k,0,0,S,S);
  let type='image/webp',out=c.toDataURL(type,.8);if(!out.startsWith('data:image/webp')){type='image/jpeg';out=c.toDataURL(type,.8)}
  for(let q=.7;(out.length-23)*.75>20000&&q>.3;q-=.1)out=c.toDataURL(type,q);
  if((out.length-23)*.75>22000)throw new Error('That picture is too detailed. Try a simpler one.');
  return out;
}
function go(id){if(id===cur()&&!ONX)return;id===DEF?localStorage.removeItem(KEY):localStorage.setItem(KEY,id);ONX?location.assign('index.html'):location.reload()}
function dlg(html){let d=document.getElementById('svDlg');if(!d){d=document.createElement('div');d.id='svDlg';d.hidden=true;d.addEventListener('mousedown',e=>{if(e.target===d)d.hidden=true});document.body.append(d)}d.innerHTML='<div class="box">'+html+'</div>';d.hidden=false;return d}
const close=()=>{const d=document.getElementById('svDlg');if(d)d.hidden=true};
async function act(d,fn){const e=d.querySelector('.err');try{e.textContent='';await fn()}catch(x){e.textContent=x.message||'Something went wrong'}}
function addDlg(){
  const d=dlg(`<h3>Add a server</h3><p>Create your own, or join one with an invite code.</p>
  <input id="svN" placeholder="Server name" maxlength="30"><div class="r"><button class="btn pri" id="svC">＋ Create server</button></div>
  <p style="text-align:center">— or —</p>
  <input id="svJ" placeholder="Invite code (8 characters)" maxlength="12" autocapitalize="characters"><div class="r"><button class="btn" id="svJb">Join server</button></div>
  <div class="err"></div><div class="r"><button class="btn" id="svX">Close</button></div>`);
  d.querySelector('#svX').onclick=close;
  d.querySelector('#svC').onclick=()=>act(d,async()=>{const r=await api('/api/servers','POST',{name:d.querySelector('#svN').value});go(r.id)});
  d.querySelector('#svJb').onclick=()=>act(d,async()=>{const r=await api('/api/servers/join','POST',{code:d.querySelector('#svJ').value});go(r.id)});
}
function infoDlg(){
  const s=LIST.find(x=>x.id===cur())||LIST[0],isH=s.role==='admin',def=s.id===DEF;
  const d=dlg(`<h3>${esc(s.name)}</h3><p>Created by <b>${esc(s.createdBy)}</b> · ${s.members} member${s.members===1?'':'s'} · your position: <b>${ROLE[s.role]||s.role}</b></p>
  ${def?'<p>Positions (Head / Supervisor / Staff) and custom roles (e.g. COLLECTION, BILLING) belong to this server.</p>':''}
  ${s.code?`<label>Invite code (people join as Staff)</label><div class="code">${esc(s.code)}</div><div class="r"><button class="btn" id="svCp">Copy</button><button class="btn" id="svRs">New code</button></div>`:''}
  ${isH?`<label>Server logo <span style="opacity:.7">(one change every ${LOGO_DAYS} days)</span></label><div class="r" style="align-items:center;flex-wrap:nowrap"><span class="lgp" id="svLg" style="${sbg(s)}">${sini(s)}${limg(s)}</span><button class="btn" id="svLp" type="button">Choose image</button><button class="btn pri" id="svLs" type="button" disabled>Save logo</button></div><input type="file" id="svLf" accept="image/jpeg,image/png,image/webp" hidden><p id="svLn"></p>`:''}
  ${!def&&isH?`<label>Rename server</label><input id="svRn" value="${esc(s.name)}" maxlength="30"><div class="r"><button class="btn" id="svRb">Save name</button></div>`:''}
  ${isH?'<div class="r"><a class="btn" href="users.html">Manage people &amp; roles</a></div>':''}
  ${!def&&!s.owner&&!s.via?'<div class="r"><button class="btn danger" id="svL">Leave server</button></div>':''}
  ${!def&&(s.owner||SUPER)?'<div class="r"><button class="btn danger" id="svD">Delete server</button></div>':''}
  <div class="err"></div><div class="r"><button class="btn" id="svX">Close</button></div>`);
  const $=q=>d.querySelector(q);$('#svX').onclick=close;
  if($('#svLp')){
    const left=s.logoAt?s.logoAt+LOGO_MS-Date.now():0,locked=left>0;let pic=null;
    $('#svLn').textContent=locked?`🔒 Changed recently. You can change it again in ${Math.ceil(left/864e5)} day${Math.ceil(left/864e5)===1?'':'s'}.`:(s.logoAt?'You can change the logo now. After saving, it locks for 15 days.':'Add a logo. After saving, it can be changed once every 15 days.');
    $('#svLp').disabled=locked;
    $('#svLp').onclick=()=>$('#svLf').click();
    $('#svLf').onchange=e=>act(d,async()=>{const f=e.target.files[0];if(!f)return;if(!/^image\/(jpeg|png|webp)$/.test(f.type))throw new Error('Please choose a JPG, PNG or WebP image.');
      pic=await shrink(f);$('#svLg').innerHTML=`<img alt="" src="${pic}">`;$('#svLs').disabled=false});
    $('#svLs').onclick=()=>pic&&act(d,async()=>{$('#svLs').disabled=true;try{await api('/api/servers/'+s.id+'/logo','POST',{image:pic});location.reload()}catch(x){$('#svLs').disabled=false;throw x}});
  }
  if($('#svCp'))$('#svCp').onclick=()=>navigator.clipboard&&navigator.clipboard.writeText(s.code).then(()=>{$('#svCp').textContent='Copied ✓'});
  if($('#svRs'))$('#svRs').onclick=()=>act(d,async()=>{const r=await api('/api/servers/'+s.id+'/invite','POST',{});s.code=r.code;infoDlg()});
  if($('#svRb'))$('#svRb').onclick=()=>act(d,async()=>{await api('/api/servers/'+s.id,'PUT',{name:$('#svRn').value});location.reload()});
  if($('#svL'))$('#svL').onclick=()=>confirm('Leave "'+s.name+'"?')&&act(d,async()=>{await api('/api/servers/'+s.id+'/leave','POST',{});go(DEF)});
  if($('#svD'))$('#svD').onclick=()=>confirm('Delete "'+s.name+'" with its chat, roles and shared tasks? This cannot be undone.')&&act(d,async()=>{await api('/api/servers/'+s.id,'DELETE');go(DEF)});
}
function build(){
  const cs=LIST.find(x=>x.id===cur());if(!cs){localStorage.removeItem(KEY);if(cur()!==DEF)return location.reload()}
  document.body.classList.add('hasrail');
  const r=document.createElement('nav');r.id='svRail';r.setAttribute('aria-label','Servers');
  const nm=ME?(ME.name||ME.username):'Profile',av=ME&&ME.avatarAt?`<img alt="" src="/api/avatar?v=${ME.avatarAt}" onerror="this.remove()">`:'';
  r.innerHTML='<div class="svl"><div class="svh">Servers</div><button class="svi xs'+(ONX?' on':'')+'" id="svCross" title="Cross-server Calendar" aria-label="Cross-server Calendar"'+(ONX?' aria-current="page"':'')+'><i style="background:linear-gradient(135deg,#6366f1,#ec4899)">🗓</i><span>Cross-server Calendar<small>All servers · personal + shared</small></span></button><hr style="margin:2px 4px">'+LIST.map(s=>`<button class="svi${s.id===cur()&&!ONX?' on':''}" data-id="${esc(s.id)}" title="${esc(s.name)}" aria-label="${esc(s.name)}"${s.id===cur()?' aria-current="true"':''}>${icon(s)}<span>${esc(s.name)}<small>${esc(ROLE[s.role]||'')}</small></span></button>`).join('')
   +'<button class="svi add" id="svAdd" title="Create or join a server"><i>＋</i><span>Add a server</span></button></div>'
   +'<hr><button class="svi fr" id="svFr" title="Friends &amp; private messages" aria-label="Friends and private messages"><i>🧑‍🤝‍🧑</i><em class="svb" hidden></em><span>Friends<small>Private messages</small></span></button>'
   +(SUPER?'<button class="svi cfg" id="svAdm" title="Admin: all servers"><i>🛡</i><span>Admin<small>All servers · manage anything</small></span></button>':'')
   +'<button class="svi cfg" id="svCfg" title="Server info"><i>ⓘ</i><span>Server info</span></button>'
   +`<button class="svi me" id="svMe" title="My profile (all servers)"><span class="av">${av||esc(ini(nm))}</span><span>${esc(nm)}<small>My profile · all servers</small></span></button>`
   +'<button class="svi out" id="svOut" title="Log out"><i>⎋</i><span>Log out</span></button>';
  r.onclick=e=>{const b=e.target.closest('.svi');if(!b)return;if(b.id==='svCross')return ONX?r.classList.remove('open'):location.assign('cross.html');if(b.id==='svAdd')return addDlg();if(b.id==='svCfg')return infoDlg();if(b.id==='svAdm')return location.assign('admin-servers.html');if(b.id==='svFr'){r.classList.remove('open');return window.__cwF?window.__cwF.toggle():location.assign('index.html?friends=1')}if(b.id==='svOut')return logout();if(b.id==='svMe')return window.openProfile?window.openProfile():location.assign('index.html?profile=1');go(b.dataset.id)};
  document.body.append(r);if(window.__cwF)window.__cwF.badges();
  const t=document.createElement('button');t.id='svTab';t.textContent='☰';t.setAttribute('aria-label','Servers');t.onclick=e=>{e.stopPropagation();r.classList.toggle('open')};document.body.append(t);
  document.addEventListener('click',e=>{if(!r.contains(e.target))r.classList.remove('open')});
  if(cs&&cs.id!==DEF)document.title=cs.name+' · '+document.title;
  // Users page inside a user-made server: people are existing accounts (added by username), not new accounts
  if(cur()!==DEF&&/users\.html$/.test(location.pathname)){
    const hide=['#fn','#fp','#fa'];hide.forEach(q=>{const e=document.querySelector(q);if(e)(e.closest('label')||e).hidden=true});
    const h=document.querySelector('#ft');if(h)h.textContent='Add member (existing account)';
    const fu=document.querySelector('#fu');if(fu)fu.placeholder='Username of an existing account';
  }
}
async function init(){let r0;try{r0=await api('/api/servers');LIST=r0.servers;SUPER=!!r0.superAdmin}catch(e){return}
  if(SUPER&&cur()!==DEF&&!LIST.some(x=>x.id===cur())){try{const a=(await api('/api/admin/servers')).servers.find(x=>x.id===cur());if(a)LIST.push({id:a.id,name:a.name,owner:false,via:true,role:'admin',members:a.members.length,createdBy:a.owner,code:a.code,logoAt:a.logoAt})}catch(e){}}   // platform admin viewing a server he is not a member of
  try{ME=(await api('/api/me')).user}catch(e){}build()}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
window.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
})();
