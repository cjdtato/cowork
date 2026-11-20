/* Shared by all pages: API helper (cookie session), theme, login/logout. */
const THEMES=['white','dark','midnight','graphite','ocean','forest','lavender','sunset','sand','pink','cepalco'];
function applyTheme(t){
  if(!THEMES.includes(t))t='white';
  [...document.body.classList].filter(c=>c.startsWith('th-')).forEach(c=>document.body.classList.remove(c));
  document.body.classList.add('th-'+t);
  document.querySelectorAll('[data-th]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.th===t)));
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content=getComputedStyle(document.body).getPropertyValue('--bg').trim()||m.content;
}
applyTheme(localStorage.getItem('stb_theme')||'white');
document.addEventListener('DOMContentLoaded',()=>applyTheme(localStorage.getItem('stb_theme')||'white'));

async function api(path,method='GET',body,server){   // server (optional) = act inside that server for this one call
  const h={'Content-Type':'application/json'},sv=server||localStorage.getItem('stb_sv');
  if(sv&&sv!=='cepalco'&&!/^\/api\/(login|logout|servers)/.test(path))h['X-Server']=sv;   // active server (default CEPALCO sends nothing)
  if(method!=='GET'&&/^\/api\/(admin\/)?servers/.test(path))sessionStorage.removeItem('stb_svl');   // any server change invalidates the cached list
  const r=await fetch(path,{method,headers:h,body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
  let d={};try{d=await r.json()}catch(e){}
  if(r.status===403&&/not a member of that server/i.test(d.error||'')){localStorage.removeItem('stb_sv');location.reload();throw new Error(d.error)}   // kicked / server deleted -> back to CEPALCO
  if(!r.ok){const e=new Error(d.error||('Server error '+r.status));e.status=r.status;throw e}
  return d;
}
const login=(u,p)=>{sessionStorage.removeItem('stb_svl');return api('/api/login','POST',{username:u,password:p}).then(d=>d.user)};
async function currentUser(){   // {user,board} or null. The first call on a page reuses the gate's request below.
  if(window.__authP&&Date.now()-window.__authT<5000)return window.__authP;   // the gate's /me answer is shared by every script on the page load (one request, not three)
  try{return await api('/api/me')}catch(e){return null}
}

/* ---- No peek at the app before login ----
   Every page except login.html stays blank (theme colour only) until the server confirms the session;
   if there is no session we go straight to the login page, so signed-out visitors never see app content. */
if(!/(^|\/)login(\.html)?$/.test(location.pathname)){
  const g=document.createElement('style');g.id='authGate';g.textContent='body>*{visibility:hidden!important}';document.head.append(g);
  window.__authT=Date.now();window.__authP=api('/api/me').catch(()=>null);
  window.__authP.then(me=>{
    if(!me)return location.replace('login.html');
    g.remove();
  });
}
async function logout(){
  // Only leave the page once the server confirms the session is gone; otherwise the login page would see the
  // still-valid cookie and sign you straight back in.
  sessionStorage.removeItem('stb_svl');
  try{await api('/api/logout','POST',{})}
  catch(e){alert('Could not log out ('+(e.message||'network error')+'). Please check your connection and try again.');return}
  location.replace('login.html');
}
// Back/forward cache: never show a signed-in page from memory after logging out.
addEventListener('pageshow',async e=>{
  if(!e.persisted||/login\.html$/.test(location.pathname))return;
  if(!(await api('/api/me').catch(()=>null)))location.replace('login.html');
});
