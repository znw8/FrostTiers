(()=>{
const $=s=>document.querySelector(s);
const TI=["HT1","LT1","HT2","LT2","HT3","LT3","HT4","LT4","HT5","LT5"];
const MODES=[["vanilla","Vanilla"],["uhc","UHC"],["pot","Pot"],["nethop","NethOP"],["smp","SMP"],["sword","Sword"],["axe","Axe"],["mace","Mace"]];
const REG=[["NA","North America"],["EU","Europe"],["AS","Asia"],["OC","Oceania"],["SA","South America"],["AF","Africa"]];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const opts=(a,sel)=>a.map(([v,l])=>`<option value="${v}"${v===sel?" selected":""}>${l}</option>`).join("");
let me=null;
async function api(u,m="GET",b){
 const r=await fetch(u,{method:m,headers:b?{"content-type":"application/json"}:{},body:b?JSON.stringify(b):undefined});
 const j=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(j.error||"Something went wrong.");return j}

document.body.insertAdjacentHTML("beforeend",'<dialog id="dlg"><button class="dx" aria-label="Close">×</button><div id="dc"></div></dialog>');
const dlg=$("#dlg"),dc=$("#dc");
$(".dx").onclick=()=>dlg.close();
dlg.addEventListener("click",e=>{if(e.target===dlg)dlg.close()});
const open=html=>{dc.innerHTML=html;if(!dlg.open)dlg.showModal();$("#dr")&&document.body.classList.remove("open")};
const msg=(t,bad)=>{const m=$("#msg");if(m){m.textContent=t;m.className=bad?"bad":"ok"}};

function menu(){
 const n=$(".dr nav");n.querySelectorAll(".acct").forEach(x=>x.remove());
 const l=(a,t)=>`<a class="acct" href="#" data-a="${a}">${t}</a>`;
 n.insertAdjacentHTML("beforeend",
  (me?(me.role!=="user"?l("test","Submit a test"):"")+(me.role==="admin"?l("admin","Admin panel"):"")+l("out","Log out (@"+esc(me.username)+")"):l("login","Log in / Sign up")));
}
$(".dr").addEventListener("click",e=>{const a=e.target.closest("[data-a]");if(!a)return;e.preventDefault();({login:()=>auth("login"),test:testView,admin:adminView,out:async()=>{await api("/api/logout","POST");me=null;menu();document.body.classList.remove("open")}})[a.dataset.a]()});

function auth(mode){
 const reg=mode==="register";
 open(`<h2>${reg?"Create account":"Log in"}</h2><form id="f"><label>Username<input name="username" autocomplete="username" required minlength="3" maxlength="20"></label><label>Password<input name="password" type="password" autocomplete="${reg?"new-password":"current-password"}" required minlength="${reg?8:1}"></label><button class="go">${reg?"Sign up":"Log in"}</button><div id="msg"></div></form><p class="sw">${reg?"Have an account?":"New here?"} <a href="#" id="sw">${reg?"Log in":"Create an account"}</a></p>`);
 $("#sw").onclick=e=>{e.preventDefault();auth(reg?"login":"register")};
 $("#f").onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));
  try{me=(await api(reg?"/api/register":"/api/login","POST",d)).user;menu();dlg.close()}catch(x){msg(x.message,1)}}}

function testView(){
 open(`<h2>Submit a test result</h2><form id="f"><label>Minecraft username<input name="player" required pattern="[A-Za-z0-9_]{3,16}" maxlength="16"></label><label>Region<select name="region">${opts(REG)}</select></label><label>Gamemode<select name="mode">${opts(MODES)}</select></label><label>Tier earned<select name="tier">${TI.map(t=>`<option>${t}</option>`).join("")}</select></label><button class="go">Submit result</button><div id="msg"></div></form><h3>Recent tests</h3><div id="hist" class="list">Loading...</div>`);
 hist();
 $("#f").onsubmit=async e=>{e.preventDefault();
  try{const r=await api("/api/tests","POST",Object.fromEntries(new FormData(e.target)));
   msg(r.webhook?"Saved and posted to #results.":"Saved, but the Discord post failed. Check the webhook.",!r.webhook);
   e.target.player.value="";window.loadPlayers&&window.loadPlayers();hist()}catch(x){msg(x.message,1)}}}
async function hist(){try{const t=await api("/api/tests");$("#hist").innerHTML=t.length?t.map(x=>`<div class="row"><span><b>${esc(x.player)}</b> ${esc(x.mode)} ${x.tier}</span><small>@${esc(x.by)}</small></div>`).join(""):"No tests yet."}catch{}}

async function adminView(){
 open('<h2>Admin panel</h2><div class="list">Loading...</div>');
 try{const us=await api("/api/users");
 open(`<h2>Admin panel</h2><h3>Add account</h3><form id="f" class="inl"><input name="username" placeholder="Username" required minlength="3" maxlength="20" aria-label="Username"><input name="password" type="password" placeholder="Password (8+)" required minlength="8" aria-label="Password"><select name="role" aria-label="Role">${opts([["tester","Tester"],["user","User"],["admin","Admin"]])}</select><button class="go">Create</button></form><div id="msg"></div><h3>Accounts (${us.length})</h3><div class="list">${us.map(u=>`<div class="row"><span><b>@${esc(u.username)}</b></span><span><select data-r="${u.id}" aria-label="Role for ${esc(u.username)}">${opts([["user","User"],["tester","Tester"],["admin","Admin"]],u.role)}</select> <button class="del" data-d="${u.id}" aria-label="Delete ${esc(u.username)}">Delete</button></span></div>`).join("")}</div>`);
 $("#f").onsubmit=async e=>{e.preventDefault();try{await api("/api/users","POST",Object.fromEntries(new FormData(e.target)));adminView()}catch(x){msg(x.message,1)}};
 dc.onchange=async e=>{const id=e.target.dataset.r;if(!id)return;try{await api("/api/users/"+id,"PATCH",{role:e.target.value});msg("Role updated.")}catch(x){msg(x.message,1);adminView()}};
 dc.onclick=async e=>{const id=e.target.dataset.d;if(!id||!confirm("Delete this account?"))return;try{await api("/api/users/"+id,"DELETE");adminView()}catch(x){msg(x.message,1)}};
 }catch(x){open("<h2>Admin panel</h2><p>"+esc(x.message)+"</p>")}}

api("/api/me").then(r=>{me=r.user;menu()}).catch(menu);
})();
