// FrostTiers server. No dependencies. Run: node server.js
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,DBF=path.join(__dirname,'data.json'),PUB=fs.existsSync(path.join(__dirname,'public'))?path.join(__dirname,'public'):__dirname,FILES=new Set(['index.html','app.js','extra.css','logo.jpg']);
let cfg={};try{cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'config.json'),'utf8'))}catch{}
const HOOK=process.env.DISCORD_WEBHOOK_URL??cfg.discordWebhook??'';
let db={users:[],sessions:{},players:{},tests:[]};
try{db=Object.assign(db,JSON.parse(fs.readFileSync(DBF,'utf8')))}catch{}
const save=()=>{fs.writeFileSync(DBF+'.tmp',JSON.stringify(db));fs.renameSync(DBF+'.tmp',DBF)};

const MODES={vanilla:'Vanilla',uhc:'UHC',pot:'Pot',nethop:'NethOP',smp:'SMP',sword:'Sword',axe:'Axe',mace:'Mace'};
const TI=['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5'],PTS=[60,45,30,20,10,6,4,2,1,0];
const REG={NA:'North America',EU:'Europe',AS:'Asia',OC:'Oceania',SA:'South America',AF:'Africa'};
const full=i=>(i%2?'Low':'High')+' Tier '+(Math.floor(i/2)+1);
const title=p=>p>=400?'Combat Grandmaster':p>=250?'Combat Master':p>=100?'Combat Ace':p>=50?'Combat Cadet':p>=10?'Combat Novice':'Combat Rookie';
const NAME=/^[A-Za-z0-9_]{3,16}$/;

const hashPw=(pw,salt=crypto.randomBytes(16).toString('hex'))=>({salt,hash:crypto.scryptSync(pw,salt,64).toString('hex')});
const okPw=(pw,u)=>{const a=Buffer.from(crypto.scryptSync(pw,u.salt,64).toString('hex')),b=Buffer.from(u.hash);return a.length===b.length&&crypto.timingSafeEqual(a,b)};
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const cookies=r=>Object.fromEntries((r.headers.cookie||'').split(';').map(c=>c.trim().split('=')).filter(c=>c[0]));
const userOf=r=>{const t=cookies(r).sid,s=t&&db.sessions[sha(t)];if(!s||s.exp<Date.now())return null;return db.users.find(u=>u.id===s.uid)||null};
const pub=u=>({id:u.id,username:u.username,role:u.role,created:u.created});

const hits=new Map();
const limited=(ip)=>{const n=Date.now(),h=(hits.get(ip)||[]).filter(t=>n-t<600000);h.push(n);hits.set(ip,h);return h.length>15};

function send(res,code,obj,extra={}){res.writeHead(code,{'content-type':'application/json','cache-control':'no-store',...extra});res.end(JSON.stringify(obj))}
const body=r=>new Promise((ok,no)=>{let s='';r.on('data',c=>{s+=c;if(s.length>20000){no(new Error('Too large'));r.destroy()}});r.on('end',()=>{try{ok(JSON.parse(s||'{}'))}catch{no(new Error('Invalid JSON'))}})});

function startSession(req,res,u){
  const t=crypto.randomBytes(32).toString('hex');
  db.sessions[sha(t)]={uid:u.id,exp:Date.now()+30*864e5};save();
  const sec=req.headers['x-forwarded-proto']==='https'?'; Secure':'';
  return {'set-cookie':`sid=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${30*86400}${sec}`};
}

async function postHook(t,by){
  if(!HOOK)return false;
  const ds=new Date(t.at).toLocaleString('en-US',{month:'numeric',day:'numeric',year:'2-digit',hour:'numeric',minute:'2-digit',timeZone:'UTC'});
  const embed={title:`${t.player} \u2014 Test Results`,color:0xC0392B,
    thumbnail:{url:`https://mc-heads.net/avatar/${t.player}/128`},
    fields:[['Tester','@'+by],['Gamemode',MODES[t.mode]],['Region',REG[t.region]],['Username',t.player],['Previous Rank',t.previous],['Rank Earned',full(TI.indexOf(t.tier))]].map(([name,value])=>({name,value})),
    footer:{text:`Test ID: ${t.id} | ${ds}`}};
  try{const r=await fetch(HOOK,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({embeds:[embed]})});return r.ok}catch{return false}
}

const need=(u,...roles)=>u&&roles.includes(u.role);

async function api(req,res,url){
  const m=req.method,p=url.pathname,u=userOf(req);
  if(m!=='GET'&&!(req.headers['content-type']||'').includes('application/json'))return send(res,415,{error:'JSON required'});
  const b=m==='GET'?{}:await body(req);
  const ip=req.socket.remoteAddress;

  if(p==='/api/players'&&m==='GET'){
    const list=Object.values(db.players).map(pl=>{const pts=Object.values(pl.tiers).reduce((a,i)=>a+PTS[i],0);return{n:pl.name,r:pl.region,tiers:pl.tiers,pts,t:title(pts)}}).sort((a,c)=>c.pts-a.pts);
    return send(res,200,list);
  }
  if(p==='/api/me'&&m==='GET')return send(res,200,{user:u?pub(u):null});
  if(p==='/api/register'&&m==='POST'){
    if(limited(ip))return send(res,429,{error:'Too many attempts. Try again later.'});
    const name=String(b.username||'').trim(),pw=String(b.password||'');
    if(!/^[A-Za-z0-9_]{3,20}$/.test(name))return send(res,400,{error:'Username must be 3-20 letters, numbers or underscores.'});
    if(pw.length<8)return send(res,400,{error:'Password must be at least 8 characters.'});
    if(db.users.some(x=>x.username.toLowerCase()===name.toLowerCase()))return send(res,409,{error:'That username is taken.'});
    const nu={id:crypto.randomBytes(8).toString('hex'),username:name,...hashPw(pw),role:db.users.length?'user':'admin',created:Date.now()};
    db.users.push(nu);save();
    return send(res,200,{user:pub(nu)},startSession(req,res,nu));
  }
  if(p==='/api/login'&&m==='POST'){
    if(limited(ip))return send(res,429,{error:'Too many attempts. Try again later.'});
    const x=db.users.find(v=>v.username.toLowerCase()===String(b.username||'').toLowerCase());
    if(!x||!okPw(String(b.password||''),x))return send(res,401,{error:'Wrong username or password.'});
    return send(res,200,{user:pub(x)},startSession(req,res,x));
  }
  if(p==='/api/logout'&&m==='POST'){const t=cookies(req).sid;if(t){delete db.sessions[sha(t)];save()}return send(res,200,{ok:true},{'set-cookie':'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'})}

  if(p==='/api/tests'&&m==='GET'){if(!need(u,'tester','admin'))return send(res,403,{error:'Not allowed.'});return send(res,200,db.tests.slice(-30).reverse())}
  if(p==='/api/tests'&&m==='POST'){
    if(!need(u,'tester','admin'))return send(res,403,{error:'Only testers can submit results.'});
    const player=String(b.player||'').trim(),region=b.region,mode=b.mode,ti=TI.indexOf(b.tier);
    if(!NAME.test(player))return send(res,400,{error:'Enter a valid Minecraft username.'});
    if(!REG[region]||!MODES[mode]||ti<0)return send(res,400,{error:'Pick a region, gamemode and tier.'});
    const k=player.toLowerCase(),pl=db.players[k]||(db.players[k]={name:player,region,tiers:{}});
    const prev=pl.tiers[mode]==null?'Unranked':full(pl.tiers[mode]);
    pl.name=player;pl.region=region;pl.tiers[mode]=ti;
    const t={id:crypto.randomBytes(12).toString('hex'),player,region,mode,tier:TI[ti],previous:prev,by:u.username,at:Date.now()};
    db.tests.push(t);if(db.tests.length>500)db.tests.shift();save();
    return send(res,200,{ok:true,id:t.id,webhook:await postHook(t,u.username)});
  }

  if(p.startsWith('/api/users')){
    if(!need(u,'admin'))return send(res,403,{error:'Admins only.'});
    const id=p.split('/')[3];
    if(!id&&m==='GET')return send(res,200,db.users.map(pub));
    if(!id&&m==='POST'){
      const name=String(b.username||'').trim(),pw=String(b.password||'');
      if(!/^[A-Za-z0-9_]{3,20}$/.test(name)||pw.length<8||!['user','tester','admin'].includes(b.role))return send(res,400,{error:'Need a valid username, an 8+ character password and a role.'});
      if(db.users.some(x=>x.username.toLowerCase()===name.toLowerCase()))return send(res,409,{error:'That username is taken.'});
      const nu={id:crypto.randomBytes(8).toString('hex'),username:name,...hashPw(pw),role:b.role,created:Date.now()};
      db.users.push(nu);save();return send(res,200,{user:pub(nu)});
    }
    const t=db.users.find(x=>x.id===id);if(!t)return send(res,404,{error:'User not found.'});
    const admins=db.users.filter(x=>x.role==='admin').length;
    if(m==='PATCH'){
      if(!['user','tester','admin'].includes(b.role))return send(res,400,{error:'Bad role.'});
      if(t.role==='admin'&&b.role!=='admin'&&admins<2)return send(res,400,{error:'There must always be one admin.'});
      t.role=b.role;save();return send(res,200,{user:pub(t)});
    }
    if(m==='DELETE'){
      if(t.role==='admin'&&admins<2)return send(res,400,{error:'There must always be one admin.'});
      db.users=db.users.filter(x=>x.id!==id);for(const [k,s] of Object.entries(db.sessions))if(s.uid===id)delete db.sessions[k];
      save();return send(res,200,{ok:true});
    }
  }
  send(res,404,{error:'Not found'});
}

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','same-origin');
  res.setHeader('content-security-policy',"default-src 'self'; img-src 'self' https://mc-heads.net data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'");
  const url=new URL(req.url,'http://x');
  try{
    if(url.pathname.startsWith('/api/'))return await api(req,res,url);
    const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
    let f=FILES.has(name)&&path.join(PUB,name);
    if(f&&name==='logo.jpg'&&!fs.existsSync(f))f=path.join(PUB,'logo.jpeg');
    if(!f||!fs.existsSync(f)){res.writeHead(404);return res.end('Not found')}
    res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);
  }catch(e){if(!res.headersSent)send(res,400,{error:e.message||'Bad request'});else res.end()}
});
server.listen(PORT,()=>console.log('FrostTiers running on port '+PORT+(HOOK?'':' (no Discord webhook set)')));
