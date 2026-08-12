const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const app = express();
app.set('trust proxy', 1);

const PANEL_PASSWORD = process.env.PANEL_PASSWORD || "CambiaEstaContraseñaMuySegura123!";
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || "https://discord.com/api/webhooks/1536109822188191746/n-sh2GrGqp1zCTVBoYPzVacaRaCoAsXPyvj4zhVorTGbloeqwu5dSIOuK9SQhf4wCIiv";
const PORT = process.env.PORT || 3000;
const TOKEN_TTL = 1000 * 60 * 60 * 6;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, message: { error: 'Demasiados intentos' } });
const scriptLimiter = rateLimit({ windowMs: 60 * 1000, max: 15, message: '-- Rate limit' });

const sessions = new Map();

function createSession() {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + TOKEN_TTL);
    return token;
}

function isValidToken(token) {
    if (!token) return false;
    const exp = sessions.get(token);
    if (!exp) return false;
    if (Date.now() > exp) {
        sessions.delete(token);
        return false;
    }
    return true;
}

function requireAuth(req, res, next) {
    const token = req.headers['x-panel-token'] || '';
    if (!isValidToken(token)) return res.status(401).json({ error: 'No autorizado' });
    next();
}

mongoose.connect(process.env.MONGO_URI || "mongodb+srv://yarishdz2_db_user:7cp3VZH9aXK77wX@ikgmxer.8tj7kfa.mongodb.net/hubsilent?appName=ikgmxer")
    .then(() => console.log("🔥 Ikgonavi Hub Pro - MAX Security"))
    .catch(err => console.error("DB Error:", err));

const ScriptModel = mongoose.model('HubScript', new mongoose.Schema({
    id: { type: String, default: () => crypto.randomBytes(16).toString('hex') },
    name: String,
    code: String,
    executions: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
}));

const ExecutionModel = mongoose.model('HubExecution', new mongoose.Schema({
    scriptId: String,
    scriptName: String,
    ip: String,
    userAgent: String,
    createdAt: { type: Date, default: Date.now }
}));

async function sendDiscordLog(title, description, color = 0x5865F2) {
    try {
        await fetch(DISCORD_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{ title, description, color, timestamp: new Date().toISOString(), footer: { text: "Ikgonavi Hub Pro" } }]
            })
        });
    } catch (e) {}
}

function ultraObfuscate(rawCode) {
    const keys = [crypto.randomBytes(16), crypto.randomBytes(14), crypto.randomBytes(12), crypto.randomBytes(10)];
    let buf = Buffer.from(rawCode, 'utf8');
    for (const key of keys) {
        for (let i = 0; i < buf.length; i++) buf[i] ^= key[i % key.length];
    }
    const b64 = buf.toString('base64');
    const chunks = [];
    let pos = 0;
    while (pos < b64.length) {
        const size = 14 + Math.floor(Math.random() * 20);
        chunks.push(b64.slice(pos, pos + size));
        pos += size;
    }
    const r = () => '_' + crypto.randomBytes(5).toString('hex');
    const v = { k1: r(), k2: r(), k3: r(), k4: r(), ch: r(), d: r(), dec: r(), xor: r(), tmp: r(), a: r(), b: r(), loader: r() };

    let junk = '';
    for (let i = 0; i < 110; i++) junk += `local ${r()}="${crypto.randomBytes(11).toString('hex')}"\n`;
    for (let i = 0; i < 30; i++) junk += `local function ${r()}() return ${Math.floor(Math.random()*99999)} end\n`;

    return `-- [IKGONAVI HUB PRO - MAX v2]
${junk}
local ${v.k1}={${Array.from(keys[0]).join(',')}}
local ${v.k2}={${Array.from(keys[1]).join(',')}}
local ${v.k3}={${Array.from(keys[2]).join(',')}}
local ${v.k4}={${Array.from(keys[3]).join(',')}}
local ${v.ch}={${chunks.map(c=>`"${c}"`).join(',')}}
local ${v.d}=table.concat(${v.ch})
local function ${v.dec}(data)
if type(base64_decode)=="function" then return base64_decode(data) end
if crypt and crypt.base64 and crypt.base64.decode then return crypt.base64.decode(data) end
if syn and syn.crypt and syn.crypt.base64 and syn.crypt.base64.decode then return syn.crypt.base64.decode(data) end
if fluxus and fluxus.crypt and fluxus.crypt.base64decode then return fluxus.crypt.base64decode(data) end
local b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
data=string.gsub(data,'[^'..b..'=]','')
return (data:gsub('.',function(x) if x=='=' then return '' end local r,f='',(b:find(x)-1) for i=6,1,-1 do r=r..(f%2^i-f%2^(i-1)>0 and '1' or '0') end return r end):gsub('%d%d%d?%d?%d?%d?%d?%d?',function(x) if #x~=8 then return '' end local c=0 for i=1,8 do c=c+(x:sub(i,i)=='1' and 2^(8-i) or 0) end return string.char(c) end))
end
local function ${v.xor}(str,key) local out={} for i=1,#str do local byte=string.byte(str,i) local k=key[((i-1)%#key)+1] out[i]=string.char(bit32 and bit32.bxor(byte,k) or (byte~k)) end return table.concat(out) end
local ${v.tmp}=${v.dec}(${v.d})
${v.tmp}=${v.xor}(${v.tmp},${v.k4})
${v.tmp}=${v.xor}(${v.tmp},${v.k3})
${v.tmp}=${v.xor}(${v.tmp},${v.k2})
${v.tmp}=${v.xor}(${v.tmp},${v.k1})

local ${v.loader} = loadstring or load
if type(${v.loader}) ~= "function" then
    error("This executor does not support loadstring/load")
end

local ${v.a}, ${v.b} = pcall(${v.loader}, ${v.tmp})
if ${v.a} and type(${v.b}) == "function" then
    local ok, err = pcall(${v.b})
    if not ok then
        error(tostring(err) or "Runtime error")
    end
else
    error("Protected / Failed to load")
end
`.trim();
}

app.post('/api/login', loginLimiter, async (req, res) => {
    const { password } = req.body || {};
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (!password || password !== PANEL_PASSWORD) {
        sendDiscordLog("🚨 Login Fallido", `IP: \`${ip}\``, 0xEF4444);
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    const token = createSession();
    sendDiscordLog("✅ Login OK", `IP: \`${ip}\``, 0x10B981);
    res.json({ token });
});

app.post('/api/logout', requireAuth, (req, res) => {
    sessions.delete(req.headers['x-panel-token']);
    res.json({ success: true });
});

app.get('/api/scripts', requireAuth, async (req, res) => {
    try { res.json(await ScriptModel.find({}).sort({ createdAt: -1 })); }
    catch { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/script', requireAuth, async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!code) return res.status(400).json({ error: 'Falta código' });
        const doc = new ScriptModel({ name: name || 'Sin nombre', code: ultraObfuscate(code) });
        await doc.save();
        sendDiscordLog("📜 Script Creado", `**${doc.name}**`, 0x10B981);
        res.json({ id: doc.id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error' });
    }
});

app.put('/api/script/:id', requireAuth, async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!code) return res.status(400).json({ error: 'Falta código' });
        const s = await ScriptModel.findOneAndUpdate(
            { id: req.params.id },
            { name: name || 'Sin nombre', code: ultraObfuscate(code) },
            { new: true }
        );
        if (!s) return res.status(404).json({ error: 'No encontrado' });
        sendDiscordLog("🔄 Actualizado", `**${s.name}**`, 0xF59E0B);
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/script/:id', requireAuth, async (req, res) => {
    try {
        const s = await ScriptModel.findOneAndDelete({ id: req.params.id });
        if (s) sendDiscordLog("🗑️ Borrado", `**${s.name}**`, 0xEF4444);
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/script/:id', scriptLimiter, async (req, res) => {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const isBrowser = /mozilla|chrome|firefox|safari|edg|opera|brave|msie|trident/i.test(ua) &&
        !/roblox|synapse|script-ware|krnl|fluxus|solara|wave|electron|delta|executor/i.test(ua);
    if (isBrowser) {
        return res.status(403).send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Protegido</title><script src="https://cdn.tailwindcss.com"></script></head>
<body style="margin:0;background:#0a0a0f;color:#fff;font-family:Inter,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">
<div style="max-width:480px;background:#11111b;border:1px solid rgba(255,255,255,.06);border-radius:24px;padding:40px;text-align:center">
<div style="color:#f87171;font-size:12px;margin-bottom:16px">● ACCESO BLOQUEADO</div>
<h1 style="font-size:28px;margin:0 0 12px">Endpoint protegido</h1>
<p style="color:#a1a1aa;font-size:14px;margin:0 0 24px">Solo para ejecución en Roblox (loadstring / HttpGet)</p>
<a href="/" style="background:#fff;color:#000;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px">Volver</a>
</div></body></html>`);
    }
    try {
        const script = await ScriptModel.findOne({ id: req.params.id });
        if (!script) return res.status(404).send('-- No encontrado');
        script.executions += 1;
        await script.save();
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'] || 'Desconocido';
        await ExecutionModel.create({ scriptId: script.id, scriptName: script.name, ip, userAgent });
        sendDiscordLog("📜 Ejecutado", `**${script.name}**\nExec: ${script.executions}\nIP: \`${ip}\``, 0x57F287);
        res.type('text/plain').send(script.code);
    } catch {
        res.status(500).send('-- Error');
    }
});

app.get('/api/executions', requireAuth, async (req, res) => {
    try { res.json(await ExecutionModel.find().sort({ createdAt: -1 }).limit(100)); }
    catch { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/executions', requireAuth, async (req, res) => {
    try { await ExecutionModel.deleteMany({}); res.json({ success: true }); }
    catch { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/executor-stats', requireAuth, async (req, res) => {
    try {
        const logs = await ExecutionModel.find();
        const counts = {};
        logs.forEach(l => { const ua = l.userAgent || 'Desconocido'; counts[ua] = (counts[ua] || 0) + 1; });
        res.json(Object.keys(counts).map(ua => ({
            name: ua.split('/')[0] || 'Desconocido',
            version: ua.includes('/') ? ua.split('/')[1] || 'v1' : 'N/A',
            count: counts[ua]
        })).sort((a, b) => b.count - a.count));
    } catch { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/test-webhook', requireAuth, async (req, res) => {
    await sendDiscordLog("🔔 Test", "Sistema OK", 0x3B82F6);
    res.json({ success: true });
});

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ikgonavi Hub Pro</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
body{font-family:'Inter',sans-serif;background:#0b0c10;color:#e2e8f0}
.glass{background:rgba(17,19,28,.85);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.06)}
.sidebar-btn{transition:.2s}.sidebar-btn:hover{background:rgba(99,102,241,.1)}
.sidebar-btn.active{background:rgba(99,102,241,.2);color:#a5b4fc}
</style></head>
<body class="min-h-screen">
<div id="loginScreen" class="min-h-screen flex items-center justify-center p-4">
<div class="glass w-full max-w-md p-10 rounded-3xl">
<div class="text-center mb-10">
<div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5">⚡</div>
<h1 class="text-2xl font-bold">Ikgonavi Hub Pro</h1>
<p class="text-indigo-400 text-sm mt-2">MAX Security</p>
</div>
<input type="password" id="passInput" placeholder="Contraseña" autocomplete="off" class="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-2xl px-5 py-4 mb-5 outline-none focus:border-indigo-500">
<button onclick="login()" class="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 py-4 rounded-2xl font-semibold">Entrar</button>
<p id="loginError" class="text-red-400 text-sm text-center mt-5 hidden">Contraseña incorrecta</p>
</div></div>
<div id="dashboard" class="hidden min-h-screen"><div class="flex">
<aside class="w-72 glass min-h-screen p-6 flex flex-col fixed left-0 top-0">
<div class="flex items-center gap-3 mb-12 px-2">
<div class="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-xl">⚡</div>
<div><div class="font-bold text-sm">Ikgonavi Hub</div><div class="text-xs text-indigo-400">MAX Security</div></div>
</div>
<nav class="flex flex-col gap-1.5 flex-1">
<button onclick="showPage('obfuscator')" id="nav-obfuscator" class="sidebar-btn active flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium"><span>🔒</span> Ofuscador</button>
<button onclick="showPage('scripts')" id="nav-scripts" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-400"><span>📜</span> Scripts</button>
<button onclick="showPage('executions')" id="nav-executions" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-400"><span>📊</span> Ejecuciones</button>
<button onclick="showPage('logs')" id="nav-logs" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-400"><span>👁️</span> Quién Ejecuta</button>
<button onclick="showPage('edit')" id="nav-edit" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-400"><span>✏️</span> Editar</button>
</nav>
<div class="pt-4 border-t border-white/5 mt-auto">
<button onclick="logout()" class="flex items-center gap-3 px-4 py-3 rounded-xl text-xs text-red-400 w-full">🚪 Cerrar Sesión</button>
</div>
</aside>
<main class="ml-72 flex-1 p-10">
<div id="page-obfuscator" class="page">
<div class="mb-10"><h2 class="text-3xl font-bold">Ofuscador MAX</h2></div>
<div class="glass rounded-3xl p-8 max-w-3xl">
<input id="scriptName" type="text" placeholder="Nombre" class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-3.5 mb-4 outline-none focus:border-indigo-500">
<textarea id="scriptCode" placeholder="Código Lua..." class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-4 h-56 font-mono text-sm outline-none focus:border-indigo-500 resize-none mb-4"></textarea>
<button id="saveBtn" onclick="saveScript()" class="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 py-4 rounded-2xl font-semibold">🔒 Ofuscar y Guardar</button>
<textarea id="resultOutput" readonly class="w-full mt-6 bg-zinc-950/80 border border-zinc-800 rounded-2xl px-5 py-4 h-20 font-mono text-xs text-emerald-400 outline-none resize-none"></textarea>
</div></div>
<div id="page-scripts" class="page hidden">
<div class="flex justify-between mb-10"><h2 class="text-3xl font-bold">Scripts</h2><span id="scriptCount" class="text-indigo-300">0</span></div>
<div id="scriptsList" class="grid gap-5"></div>
</div>
<div id="page-executions" class="page hidden">
<div class="mb-10"><h2 class="text-3xl font-bold">📊 Ejecuciones</h2></div>
<div class="grid grid-cols-3 gap-5 mb-8">
<div class="glass rounded-2xl p-6"><div class="text-zinc-400 text-sm">Total</div><div id="statTotal" class="text-3xl font-bold">0</div></div>
<div class="glass rounded-2xl p-6"><div class="text-zinc-400 text-sm">Ejecuciones</div><div id="statExecutions" class="text-3xl font-bold text-emerald-400">0</div></div>
<div class="glass rounded-2xl p-6"><div class="text-zinc-400 text-sm">Top</div><div id="statTop" class="text-xl font-bold text-indigo-300 truncate">—</div></div>
</div>
<div class="glass rounded-3xl overflow-hidden"><table class="w-full"><thead><tr class="text-left text-xs text-zinc-500 uppercase"><th class="px-6 py-4">#</th><th class="px-6 py-4">Script</th><th class="px-6 py-4">Exec</th></tr></thead><tbody id="executionsTable"></tbody></table></div>
</div>
<div id="page-logs" class="page hidden">
<div class="flex justify-between mb-10"><h2 class="text-3xl font-bold">👁️ Quién Ejecuta</h2>
<button onclick="clearLogs()" class="text-sm bg-red-950/50 text-red-300 px-4 py-2 rounded-xl">🗑️ Limpiar</button></div>
<div class="glass rounded-3xl overflow-hidden max-h-[600px] overflow-y-auto"><table class="w-full"><thead class="sticky top-0 bg-[#11131c]"><tr class="text-left text-xs text-zinc-500 uppercase"><th class="px-6 py-4">Fecha</th><th class="px-6 py-4">Script</th><th class="px-6 py-4">IP</th><th class="px-6 py-4">UA</th></tr></thead><tbody id="logsTable"></tbody></table></div>
</div>
<div id="page-edit" class="page hidden">
<div class="mb-10"><h2 class="text-3xl font-bold">Editar</h2></div>
<div class="glass rounded-3xl p-8 max-w-3xl">
<select id="editSelect" class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-3.5 mb-4"><option value="">-- Elige --</option></select>
<input id="editName" placeholder="Nombre" class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-3.5 mb-4">
<textarea id="editCode" placeholder="Código nuevo..." class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-4 h-56 font-mono text-sm resize-none mb-4"></textarea>
<button id="editBtn" onclick="updateScript()" class="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 py-4 rounded-2xl font-semibold">💾 Guardar</button>
</div></div>
</main></div></div>
<script>
let token='', allScripts=[];
document.getElementById('loginScreen').classList.remove('hidden');
document.getElementById('dashboard').classList.add('hidden');
function authHeaders(){ return {'x-panel-token':token,'Content-Type':'application/json'}; }
function login(){
  const p=document.getElementById('passInput').value;
  if(!p) return alert('Escribe la contraseña');
  fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:p})})
  .then(r=>r.json().then(d=>({ok:r.ok,d})))
  .then(({ok,d})=>{
    if(!ok){ document.getElementById('loginError').classList.remove('hidden'); document.getElementById('passInput').value=''; return; }
    token=d.token;
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('passInput').value='';
    loadScripts();
  }).catch(()=>alert('Error'));
}
function logout(){ if(token) fetch('/api/logout',{method:'POST',headers:authHeaders()}); token=''; location.reload(); }
document.getElementById('passInput').addEventListener('keypress',e=>{ if(e.key==='Enter') login(); });
function showPage(p){
  document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));
  document.getElementById('page-'+p).classList.remove('hidden');
  document.querySelectorAll('.sidebar-btn').forEach(b=>{b.classList.remove('active');b.classList.add('text-zinc-400')});
  const a=document.getElementById('nav-'+p); if(a){a.classList.add('active');a.classList.remove('text-zinc-400')}
  if(['scripts','edit','executions'].includes(p)) loadScripts();
  if(p==='logs') loadLogs();
}
function esc(t){ const d=document.createElement('div'); d.textContent=t||''; return d.innerHTML; }
async function loadScripts(){
  try{
    const r=await fetch('/api/scripts',{headers:authHeaders()});
    if(r.status===401) return logout();
    allScripts=await r.json();
    document.getElementById('scriptCount').innerText=allScripts.length;
    document.getElementById('scriptsList').innerHTML=allScripts.map(s=>{
      const ls=\`loadstring(game:HttpGet("\${location.origin}/api/script/\${s.id}"))()\`;
      return \`<div class="glass rounded-2xl p-6"><div class="flex justify-between mb-3"><div><div class="font-semibold text-indigo-300">\${esc(s.name)}</div><div class="text-xs text-zinc-500">\${s.executions||0} exec</div></div>
      <button onclick="deleteScript('\${s.id}')" class="text-xs text-red-400 bg-red-950/40 px-3 py-1 rounded-xl">Borrar</button></div>
      <textarea readonly class="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono h-14 resize-none">\${ls}</textarea>
      <button onclick="navigator.clipboard.writeText('\${ls}')" class="mt-3 w-full bg-indigo-600 py-2 rounded-xl text-sm">Copiar</button></div>\`;
    }).join('')||'<p class="text-zinc-500 text-center py-16">No hay scripts</p>';
    updateStats();
    document.getElementById('editSelect').innerHTML='<option value="">-- Elige --</option>'+allScripts.map(s=>\`<option value="\${s.id}">\${esc(s.name)}</option>\`).join('');
  }catch{}
}
function updateStats(){
  const total=allScripts.reduce((a,s)=>a+(s.executions||0),0);
  const top=[...allScripts].sort((a,b)=>(b.executions||0)-(a.executions||0))[0];
  document.getElementById('statTotal').innerText=allScripts.length;
  document.getElementById('statExecutions').innerText=total;
  document.getElementById('statTop').innerText=top?(top.name||'—'):'—';
  document.getElementById('executionsTable').innerHTML=[...allScripts].sort((a,b)=>(b.executions||0)-(a.executions||0)).map((s,i)=>
    \`<tr class="border-t border-white/5"><td class="px-6 py-4">\${i+1}</td><td class="px-6 py-4 text-indigo-300">\${esc(s.name)}</td><td class="px-6 py-4 text-emerald-400 font-bold">\${s.executions||0}</td></tr>\`
  ).join('');
}
async function loadLogs(){
  const r=await fetch('/api/executions',{headers:authHeaders()});
  if(r.status===401) return logout();
  const logs=await r.json();
  document.getElementById('logsTable').innerHTML=logs.map(l=>{
    const d=new Date(l.createdAt).toLocaleString('es-ES');
    return \`<tr class="border-t border-white/5"><td class="px-6 py-3 text-sm text-zinc-400">\${d}</td><td class="px-6 py-3 text-indigo-300">\${esc(l.scriptName)}</td><td class="px-6 py-3 font-mono text-emerald-400 text-sm">\${l.ip||'?'}</td><td class="px-6 py-3 text-xs text-zinc-500">\${esc((l.userAgent||'').slice(0,40))}</td></tr>\`;
  }).join('')||'<tr><td colspan="4" class="px-6 py-16 text-center text-zinc-500">Sin datos</td></tr>';
}
async function clearLogs(){ if(!confirm('¿Borrar?'))return; await fetch('/api/executions',{method:'DELETE',headers:authHeaders()}); loadLogs(); }
async function saveScript(){
  const name=document.getElementById('scriptName').value.trim();
  const code=document.getElementById('scriptCode').value;
  if(!code) return alert('Pega código');
  const btn=document.getElementById('saveBtn'); btn.innerText='Ofuscando...'; btn.disabled=true;
  try{
    const r=await fetch('/api/script',{method:'POST',headers:authHeaders(),body:JSON.stringify({name,code})});
    const d=await r.json();
    if(d.id){
      document.getElementById('resultOutput').value=\`loadstring(game:HttpGet("\${location.origin}/api/script/\${d.id}"))()\`;
      document.getElementById('scriptCode').value=''; document.getElementById('scriptName').value='';
      btn.innerText='¡Listo!'; setTimeout(()=>{btn.innerText='🔒 Ofuscar y Guardar';btn.disabled=false},1500);
      loadScripts();
    } else { alert(d.error||'Error'); btn.disabled=false; btn.innerText='🔒 Ofuscar y Guardar'; }
  }catch{ alert('Error'); btn.disabled=false; btn.innerText='🔒 Ofuscar y Guardar'; }
}
async function updateScript(){
  const id=document.getElementById('editSelect').value;
  const name=document.getElementById('editName').value.trim();
  const code=document.getElementById('editCode').value;
  if(!id||!code) return alert('Completa');
  const btn=document.getElementById('editBtn'); btn.innerText='Guardando...'; btn.disabled=true;
  const r=await fetch('/api/script/'+id,{method:'PUT',headers:authHeaders(),body:JSON.stringify({name,code})});
  const d=await r.json();
  if(d.success){ btn.innerText='¡OK!'; setTimeout(()=>{btn.innerText='💾 Guardar';btn.disabled=false},1500); document.getElementById('editCode').value=''; loadScripts(); }
  else { alert('Error'); btn.disabled=false; btn.innerText='💾 Guardar'; }
}
async function deleteScript(id){ if(!confirm('¿Borrar?'))return; await fetch('/api/script/'+id,{method:'DELETE',headers:authHeaders()}); loadScripts(); }
</script></body></html>`);
});

app.listen(PORT, () => console.log("🚀 MAX Security en puerto", PORT));
