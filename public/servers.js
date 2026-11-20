/* Discord-style server rail (left, hover to expand) + create/join/settings dialogs. Needs auth.js (api()). */
(function(){
const DEF='cepalco',KEY='stb_sv',cur=()=>localStorage.getItem(KEY)||DEF;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ROLE={admin:'Head',host:'Supervisor',staff:'Staff'};
const css=`
#svRail{position:fixed;left:0;top:0;bottom:0;width:64px;z-index:60;display:flex;flex-direction:column;gap:8px;padding:12px 10px;background:var(--panel,#fff);color:var(--ink,#111);border-right:1px solid var(--bd,#ddd);box-shadow:var(--sh,none);overflow:hidden auto;transition:width .18s ease;scrollbar-width:none}
#svRail:hover,#svRail.open{width:244px}
#svRail .svh{font:800 .66rem/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;opacity:.55;height:12px;white-space:nowrap;padding-left:4px}
.svi{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:44px;padding:0;border:0;background:none;color:inherit;font:600 .9rem system-ui,sans-serif;text-align:left;cursor:pointer;border-radius:14px;white-space:nowrap}
.svi:hover{background:rgba(127,127,127,.14)}
.svi i{flex:0 0 44px;height:44px;border-radius:22px;display:grid;place-items:center;font:800 .95rem system-ui,sans-serif;font-style:normal;color:#fff;transition:border-radius .15s}
.svi:hover i,.svi.on i{border-radius:14px}
.svi.on::before{content:"";position:absolute;left:-10px;top:10px;bottom:10px;width:4px;border-radius:0 4px 4px 0;background:var(--acc,#6366f1)}
.svi span{overflow:hidden;text-overflow:ellipsis;display:flex;flex-direction:column;min-width:0}
.svi small{font-weight:500;opacity:.6;font-size:.72rem}
.svi.add i,.svi.cfg i{background:rgba(127,127,127,.2);color:inherit;font-size:1.2rem}
#svRail .sp{flex:1}
body.hasrail{padding-left:64px}
#svTab{display:none}
@media(max-width:700px){
 body.hasrail{padding-left:0}
 #svRail{width:244px;transform:translateX(-100%);transition:transform .18s}
 #svRail.open{transform:none}
 #svTab{display:grid;position:fixed;left:0;top:50%;z-index:59;width:26px;height:56px;place-items:center;border:1px solid var(--bd,#ddd);border-left:0;border-radius:0 12px 12px 0;background:var(--panel,#fff);color:var(--ink,#111);cursor:pointer;box-shadow:var(--sh,none)}
}
#svDlg{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(15,23,42,.6)}
#svDlg[hidden]{display:none}
#svDlg .box{width:min(420px,100%);max-height:90dvh;overflow:auto;padding:18px;border-radius:18px;background:var(--panel,#fff);color:var(--ink,#111);border:1px solid var(--bd,#ddd);display:flex;flex-direction:column;gap:10px}
#svDlg h3{margin:0;font-size:1.05rem}#svDlg p,#svDlg label{margin:0;font-size:.82rem;opacity:.8}
#svDlg input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--bd,#ccc);background:transparent;color:inherit;font:inherit}
#svDlg .r{display:flex;gap:8px;flex-wrap:wrap}#svDlg .r>*{flex:1 1 auto}
#svDlg .code{font:800 1.3rem ui-monospace,monospace;letter-spacing:.18em;text-align:center;padding:10px;border:1px dashed var(--bd,#999);border-radius:10px;user-select:all}
#svDlg .err{color:#dc2626;font-size:.8rem;min-height:1em}
#svDlg .danger{color:#dc2626}`;
const st=document.createElement('style');st.textContent=css;document.head.append(st);
let LIST=[];
const hue=id=>{let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))%360;return h};
const ini=n=>(String(n).match(/[A-Za-z0-9]/g)||['?']).slice(0,2).join('').toUpperCase();
const icon=s=>s.id===DEF?'<i style="background:#000;color:#facc15">CE</i>':`<i style="background:hsl(${hue(s.id)} 55% 45%)">${esc(ini(s.name))}</i>`;
function go(id){if(id===cur())return;id===DEF?localStorage.removeItem(KEY):localStorage.setItem(KEY,id);location.reload()}
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
  ${!def&&isH?`<label>Rename server</label><input id="svRn" value="${esc(s.name)}" maxlength="30"><div class="r"><button class="btn" id="svRb">Save name</button></div>`:''}
  ${isH?'<div class="r"><a class="btn" href="users.html">Manage people &amp; roles</a></div>':''}
  ${!def&&!s.owner?'<div class="r"><button class="btn danger" id="svL">Leave server</button></div>':''}
  ${!def&&s.owner?'<div class="r"><button class="btn danger" id="svD">Delete server</button></div>':''}
  <div class="err"></div><div class="r"><button class="btn" id="svX">Close</button></div>`);
  const $=q=>d.querySelector(q);$('#svX').onclick=close;
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
  r.innerHTML='<div class="svh">Servers</div>'+LIST.map(s=>`<button class="svi${s.id===cur()?' on':''}" data-id="${esc(s.id)}" title="${esc(s.name)}">${icon(s)}<span>${esc(s.name)}<small>${esc(ROLE[s.role]||'')}</small></span></button>`).join('')
   +'<button class="svi add" id="svAdd" title="Create or join a server"><i>＋</i><span>Add a server</span></button><div class="sp"></div><button class="svi cfg" id="svCfg" title="Server info"><i>ⓘ</i><span>Server info</span></button>';
  r.onclick=e=>{const b=e.target.closest('.svi');if(!b)return;if(b.id==='svAdd')return addDlg();if(b.id==='svCfg')return infoDlg();go(b.dataset.id)};
  document.body.append(r);
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
async function init(){try{LIST=(await api('/api/servers')).servers}catch(e){return}build()}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
window.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
})();
