const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
app.set('trust proxy', 1);

const PANEL_PASSWORD = process.env.PANEL_PASSWORD || "CambiaEstaContraseña123!";
const WEBHOOK_ADMIN = process.env.WEBHOOK_ADMIN || "https://discord.com/api/webhooks/1535754404202942595/6TCxhQkieK0HWzKRdJAcg8xYWSfJ1odjrympGYvuCjVpxeeyc5fDrOowIqEiEStcb8Tl";
const WEBHOOK_LOGGER = process.env.WEBHOOK_LOGGER || "https://discord.com/api/webhooks/1536889626701209682/lRvK__kPvssoBMsMHNAd9p2yp1gDsECy7wkqPRW3alI9ToPXlD9tfV-HuB77WWcT_d6H";
const PORT = process.env.PORT || 3000;
const TOKEN_TTL = 1000 * 60 * 60 * 6;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, message: { error: 'Demasiados intentos' } });
const scriptLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: '-- Rate limit' });

const sessions = new Map();
function createSession() {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + TOKEN_TTL);
    return token;
}
function isValidToken(token) {
    if (!token) return false;
    const exp = sessions.get(token);
    if (!exp || Date.now() > exp) { sessions.delete(token); return false; }
    return true;
}
function requireAuth(req, res, next) {
    if (!isValidToken(req.headers['x-panel-token'] || '')) return res.status(401).json({ error: 'No autorizado' });
    next();
}

mongoose.connect(process.env.MONGO_URI || "mongodb+srv://yarishdz2_db_user:7cp3VZH9aXK77wX@ikgmxer.8tj7kfa.mongodb.net/hubsilent?appName=ikgmxer")
    .then(() => console.log("🔥 Hub activo"))
    .catch(err => console.error("DB:", err.message));

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

async function sendLog(webhook, title, description, color) {
    if (!webhook) return;
    try {
        await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [{ title, description, color: color || 0x5865F2, timestamp: new Date().toISOString() }] })
        });
    } catch (e) {}
}

function obfuscate(rawCode) {
    const key = crypto.randomBytes(8);
    let buf = Buffer.from(rawCode, 'utf8');
    for (let i = 0; i < buf.length; i++) buf[i] ^= key[i % key.length];
    const b64 = buf.toString('base64');
    const chunks = [];
    for (let i = 0; i < b64.length; i += 40) chunks.push(b64.slice(i, i + 40));
    const r = () => '_' + crypto.randomBytes(3).toString('hex');
    let junk = '';
    for (let i = 0; i < 25; i++) junk += 'local ' + r() + '="' + crypto.randomBytes(6).toString('hex') + '"\n';

    return ('-- IKGONAVI\n' + junk +
'local K={' + Array.from(key).join(',') + '}\n' +
'local C={' + chunks.map(c => '"' + c + '"').join(',') + '}\n' +
'local D=table.concat(C)\n' +
'local function dec(data)\n' +
'if type(base64_decode)=="function" then return base64_decode(data) end\n' +
'if crypt and crypt.base64 and crypt.base64.decode then return crypt.base64.decode(data) end\n' +
'if syn and syn.crypt and syn.crypt.base64 and syn.crypt.base64.decode then return syn.crypt.base64.decode(data) end\n' +
'local b="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"\n' +
'data=string.gsub(data,"[^"..b.."=]","")\n' +
'return (data:gsub(".",function(x) if x=="=" then return "" end local r,f="",(b:find(x)-1) for i=6,1,-1 do r=r..(f%2^i-f%2^(i-1)>0 and "1" or "0") end return r end):gsub("%d%d%d?%d?%d?%d?%d?%d?",function(x) if #x~=8 then return "" end local c=0 for i=1,8 do c=c+(x:sub(i,i)=="1" and 2^(8-i) or 0) end return string.char(c) end))\n' +
'end\n' +
'local function bxor(a,b) local r=0 for i=0,7 do local x=a%2+b%2 if x==1 then r=r+2^i end a=math.floor(a/2) b=math.floor(b/2) end return r end\n' +
'local function xorstr(str,key) local out={} for i=1,#str do out[i]=string.char(bxor(string.byte(str,i),key[((i-1)%#key)+1])) end return table.concat(out) end\n' +
'local src=xorstr(dec(D),K)\n' +
'local fn=loadstring(src)\n' +
'if type(fn)=="function" then fn() else error("fail") end'
    );
}

app.post('/api/login', loginLimiter, (req, res) => {
    const password = (req.body || {}).password;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?';
    if (!password || password !== PANEL_PASSWORD) {
        sendLog(WEBHOOK_ADMIN, 'Login fallido', 'IP: ' + ip, 0xEF4444);
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    const token = createSession();
    sendLog(WEBHOOK_ADMIN, 'Login OK', 'IP: ' + ip, 0x10B981);
    res.json({ token });
});

app.post('/api/logout', requireAuth, (req, res) => {
    sessions.delete(req.headers['x-panel-token']);
    res.json({ success: true });
});

app.get('/api/scripts', requireAuth, async (req, res) => {
    try { res.json(await ScriptModel.find({}).sort({ createdAt: -1 })); }
    catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/script', requireAuth, async (req, res) => {
    try {
        const name = (req.body || {}).name;
        const code = (req.body || {}).code;
        if (!code) return res.status(400).json({ error: 'Falta codigo' });
        const doc = new ScriptModel({ name: name || 'Sin nombre', code: obfuscate(code) });
        await doc.save();
        sendLog(WEBHOOK_ADMIN, 'Script creado', '**' + doc.name + '**\nID: `' + doc.id + '`', 0x10B981);
        res.json({ id: doc.id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error' });
    }
});

app.put('/api/script/:id', requireAuth, async (req, res) => {
    try {
        const name = (req.body || {}).name;
        const code = (req.body || {}).code;
        if (!code) return res.status(400).json({ error: 'Falta codigo' });
        const s = await ScriptModel.findOneAndUpdate(
            { id: req.params.id },
            { name: name || 'Sin nombre', code: obfuscate(code) },
            { new: true }
        );
        if (!s) return res.status(404).json({ error: 'No encontrado' });
        sendLog(WEBHOOK_ADMIN, 'Script editado', '**' + s.name + '**\nID: `' + s.id + '`', 0xF59E0B);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/script/:id', requireAuth, async (req, res) => {
    try {
        const s = await ScriptModel.findOneAndDelete({ id: req.params.id });
        if (s) sendLog(WEBHOOK_ADMIN, 'Script borrado', '**' + s.name + '**', 0xEF4444);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/script/:id', scriptLimiter, async (req, res) => {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const accept = (req.headers['accept'] || '').toLowerCase();
    const isBrowser = accept.includes('text/html') &&
        /mozilla|chrome|firefox|safari|edg|opera|brave/i.test(ua) &&
        !/roblox|synapse|krnl|fluxus|solara|wave|electron|delta|executor|inet/i.test(ua);

    if (isBrowser) {
        return res.status(403).type('text/html').send('<!DOCTYPE html><html><body style="background:#0a0a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="text-align:center"><h1>Endpoint protegido</h1><p>Solo para Roblox</p><a href="/" style="color:#818cf8">Volver</a></div></body></html>');
    }

    try {
        const script = await ScriptModel.findOne({ id: req.params.id });
        if (!script) return res.status(404).type('text/plain').send('-- No encontrado');
        script.executions += 1;
        await script.save();
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?';
        const userAgent = req.headers['user-agent'] || 'Desconocido';
        await ExecutionModel.create({ scriptId: script.id, scriptName: script.name, ip, userAgent });
        sendLog(WEBHOOK_LOGGER, 'Script ejecutado', '**' + script.name + '**\nExec: ' + script.executions + '\nIP: `' + ip + '`\nUA: `' + userAgent.slice(0, 60) + '`', 0x57F287);
        res.type('text/plain').send(script.code);
    } catch (e) {
        console.error(e);
        res.status(500).type('text/plain').send('-- Error');
    }
});

app.get('/api/executions', requireAuth, async (req, res) => {
    try { res.json(await ExecutionModel.find().sort({ createdAt: -1 }).limit(100)); }
    catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/executions', requireAuth, async (req, res) => {
    try { await ExecutionModel.deleteMany({}); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ikgonavi Hub</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>body{font-family:system-ui,sans-serif;background:#0b0c10;color:#e2e8f0}.glass{background:rgba(17,19,28,.9);border:1px solid rgba(255,255,255,.06)}.sidebar-btn:hover{background:rgba(99,102,241,.12)}.sidebar-btn.active{background:rgba(99,102,241,.22);color:#a5b4fc}</style>
</head><body class="min-h-screen">
<div id="loginScreen" class="min-h-screen flex items-center justify-center p-4">
<div class="glass w-full max-w-md p-10 rounded-3xl">
<div class="text-center mb-8"><div class="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">⚡</div>
<h1 class="text-2xl font-bold">Ikgonavi Hub</h1><p class="text-indigo-400 text-sm mt-1">Panel seguro</p></div>
<input type="password" id="passInput" placeholder="Contraseña" autocomplete="off" class="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-5 py-4 mb-4 outline-none">
<button onclick="login()" class="w-full bg-indigo-600 py-4 rounded-2xl font-semibold">Entrar</button>
<p id="loginError" class="text-red-400 text-sm text-center mt-4 hidden">Contraseña incorrecta</p>
</div></div>
<div id="dashboard" class="hidden min-h-screen"><div class="flex">
<aside class="w-64 glass min-h-screen p-5 fixed left-0 top-0 flex flex-col">
<div class="font-bold mb-8 px-2">⚡ Ikgonavi Hub</div>
<nav class="flex flex-col gap-1 flex-1">
<button onclick="showPage('obfuscator')" id="nav-obfuscator" class="sidebar-btn active text-left px-4 py-3 rounded-xl text-sm">Ofuscador</button>
<button onclick="showPage('scripts')" id="nav-scripts" class="sidebar-btn text-left px-4 py-3 rounded-xl text-sm text-zinc-400">Scripts</button>
<button onclick="showPage('executions')" id="nav-executions" class="sidebar-btn text-left px-4 py-3 rounded-xl text-sm text-zinc-400">Ejecuciones</button>
<button onclick="showPage('logs')" id="nav-logs" class="sidebar-btn text-left px-4 py-3 rounded-xl text-sm text-zinc-400">Quien Ejecuta</button>
<button onclick="showPage('edit')" id="nav-edit" class="sidebar-btn text-left px-4 py-3 rounded-xl text-sm text-zinc-400">Editar</button>
</nav>
<button onclick="logout()" class="text-left px-4 py-3 rounded-xl text-xs text-red-400">Salir</button>
</aside>
<main class="ml-64 flex-1 p-8">
<div id="page-obfuscator" class="page">
<h2 class="text-2xl font-bold mb-6">Ofuscador</h2>
<div class="glass rounded-2xl p-6 max-w-2xl">
<input id="scriptName" placeholder="Nombre" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 mb-3">
<textarea id="scriptCode" placeholder="Codigo Lua..." class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 h-48 font-mono text-sm mb-3 resize-none"></textarea>
<button id="saveBtn" onclick="saveScript()" class="w-full bg-indigo-600 py-3 rounded-xl font-semibold">Ofuscar y Guardar</button>
<textarea id="resultOutput" readonly class="w-full mt-4 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 h-20 font-mono text-xs text-emerald-400 resize-none"></textarea>
</div></div>
<div id="page-scripts" class="page hidden">
<div class="flex justify-between mb-6"><h2 class="text-2xl font-bold">Scripts</h2><span id="scriptCount" class="text-indigo-300 text-sm">0</span></div>
<div id="scriptsList" class="grid gap-4"></div>
</div>
<div id="page-executions" class="page hidden">
<h2 class="text-2xl font-bold mb-6">Ejecuciones</h2>
<div class="grid grid-cols-3 gap-4 mb-6">
<div class="glass rounded-xl p-5"><div class="text-zinc-400 text-sm">Scripts</div><div id="statTotal" class="text-2xl font-bold">0</div></div>
<div class="glass rounded-xl p-5"><div class="text-zinc-400 text-sm">Total</div><div id="statExecutions" class="text-2xl font-bold text-emerald-400">0</div></div>
<div class="glass rounded-xl p-5"><div class="text-zinc-400 text-sm">Top</div><div id="statTop" class="text-lg font-bold text-indigo-300 truncate">-</div></div>
</div>
<div class="glass rounded-xl overflow-hidden"><table class="w-full text-sm"><thead><tr class="text-zinc-500 text-left"><th class="px-5 py-3">#</th><th class="px-5 py-3">Script</th><th class="px-5 py-3">Exec</th></tr></thead><tbody id="executionsTable"></tbody></table></div>
</div>
<div id="page-logs" class="page hidden">
<div class="flex justify-between mb-6"><h2 class="text-2xl font-bold">Quien Ejecuta</h2>
<button onclick="clearLogs()" class="text-sm text-red-400 bg-red-950/40 px-4 py-2 rounded-xl">Limpiar</button></div>
<div class="glass rounded-xl overflow-hidden max-h-96 overflow-y-auto"><table class="w-full text-sm"><thead class="sticky top-0 bg-zinc-900"><tr class="text-zinc-500 text-left"><th class="px-5 py-3">Fecha</th><th class="px-5 py-3">Script</th><th class="px-5 py-3">IP</th></tr></thead><tbody id="logsTable"></tbody></table></div>
</div>
<div id="page-edit" class="page hidden">
<h2 class="text-2xl font-bold mb-6">Editar</h2>
<div class="glass rounded-2xl p-6 max-w-2xl">
<select id="editSelect" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 mb-3"><option value="">-- Elige --</option></select>
<input id="editName" placeholder="Nombre" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 mb-3">
<textarea id="editCode" placeholder="Codigo nuevo..." class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 h-48 font-mono text-sm mb-3 resize-none"></textarea>
<button id="editBtn" onclick="updateScript()" class="w-full bg-indigo-600 py-3 rounded-xl font-semibold">Guardar</button>
</div></div>
</main></div></div>
<script>
let token='',allScripts=[];
function authHeaders(){return{'x-panel-token':token,'Content-Type':'application/json'};}
function login(){
const p=document.getElementById('passInput').value;if(!p)return alert('Escribe contraseña');
fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:p})})
.then(r=>r.json().then(d=>({ok:r.ok,d}))).then(({ok,d})=>{
if(!ok){document.getElementById('loginError').classList.remove('hidden');return;}
token=d.token;document.getElementById('loginScreen').classList.add('hidden');
document.getElementById('dashboard').classList.remove('hidden');document.getElementById('passInput').value='';loadScripts();
}).catch(()=>alert('Error'));
}
function logout(){token='';location.reload();}
document.getElementById('passInput').addEventListener('keypress',e=>{if(e.key==='Enter')login();});
function showPage(p){
document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));
document.getElementById('page-'+p).classList.remove('hidden');
document.querySelectorAll('.sidebar-btn').forEach(b=>{b.classList.remove('active');b.classList.add('text-zinc-400');});
const a=document.getElementById('nav-'+p);if(a){a.classList.add('active');a.classList.remove('text-zinc-400');}
if(['scripts','edit','executions'].includes(p))loadScripts();if(p==='logs')loadLogs();
}
function esc(t){const d=document.createElement('div');d.textContent=t||'';return d.innerHTML;}
async function loadScripts(){
try{
const r=await fetch('/api/scripts',{headers:authHeaders()});if(r.status===401)return logout();
allScripts=await r.json();document.getElementById('scriptCount').innerText=allScripts.length+' scripts';
document.getElementById('scriptsList').innerHTML=allScripts.map(s=>{
const ls='loadstring(game:HttpGet("'+location.origin+'/api/script/'+s.id+'"))()';
return '<div class="glass rounded-xl p-5"><div class="flex justify-between mb-2"><div><div class="font-semibold text-indigo-300">'+esc(s.name)+'</div><div class="text-xs text-zinc-500">'+(s.executions||0)+' exec</div></div><button onclick="deleteScript(\\''+s.id+'\\')" class="text-xs text-red-400">Borrar</button></div><textarea readonly class="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs font-mono h-14 resize-none">'+ls+'</textarea><button onclick="navigator.clipboard.writeText(\\''+ls+'\\')" class="mt-2 w-full bg-indigo-600 py-2 rounded-lg text-sm">Copiar</button></div>';
}).join('')||'<p class="text-zinc-500 text-center py-12">No hay scripts</p>';
updateStats();
document.getElementById('editSelect').innerHTML='<option value="">-- Elige --</option>'+allScripts.map(s=>'<option value="'+s.id+'">'+esc(s.name)+'</option>').join('');
}catch(e){}
}
function updateStats(){
const total=allScripts.reduce((a,s)=>a+(s.executions||0),0);
const top=[...allScripts].sort((a,b)=>(b.executions||0)-(a.executions||0))[0];
document.getElementById('statTotal').innerText=allScripts.length;
document.getElementById('statExecutions').innerText=total;
document.getElementById('statTop').innerText=top?(top.name||'-'):'-';
document.getElementById('executionsTable').innerHTML=[...allScripts].sort((a,b)=>(b.executions||0)-(a.executions||0)).map((s,i)=>'<tr class="border-t border-white/5"><td class="px-5 py-3">'+(i+1)+'</td><td class="px-5 py-3 text-indigo-300">'+esc(s.name)+'</td><td class="px-5 py-3 text-emerald-400 font-bold">'+(s.executions||0)+'</td></tr>').join('');
}
async function loadLogs(){
const r=await fetch('/api/executions',{headers:authHeaders()});if(r.status===401)return logout();
const logs=await r.json();
document.getElementById('logsTable').innerHTML=logs.map(l=>{
const d=new Date(l.createdAt).toLocaleString('es-ES');
return '<tr class="border-t border-white/5"><td class="px-5 py-2 text-zinc-400 text-xs">'+d+'</td><td class="px-5 py-2 text-indigo-300">'+esc(l.scriptName)+'</td><td class="px-5 py-2 font-mono text-emerald-400 text-xs">'+(l.ip||'?')+'</td></tr>';
}).join('')||'<tr><td colspan="3" class="px-5 py-12 text-center text-zinc-500">Sin datos</td></tr>';
}
async function clearLogs(){if(!confirm('Borrar logs?'))return;await fetch('/api/executions',{method:'DELETE',headers:authHeaders()});loadLogs();}
async function saveScript(){
const name=document.getElementById('scriptName').value.trim();
const code=document.getElementById('scriptCode').value;if(!code)return alert('Pega codigo');
const btn=document.getElementById('saveBtn');btn.innerText='Ofuscando...';btn.disabled=true;
try{
const r=await fetch('/api/script',{method:'POST',headers:authHeaders(),body:JSON.stringify({name,code})});
const d=await r.json();
if(d.id){
document.getElementById('resultOutput').value='loadstring(game:HttpGet("'+location.origin+'/api/script/'+d.id+'"))()';
document.getElementById('scriptCode').value='';document.getElementById('scriptName').value='';
btn.innerText='Listo!';setTimeout(()=>{btn.innerText='Ofuscar y Guardar';btn.disabled=false;},1200);loadScripts();
}else{alert(d.error||'Error');btn.disabled=false;btn.innerText='Ofuscar y Guardar';}
}catch(e){alert('Error');btn.disabled=false;btn.innerText='Ofuscar y Guardar';}
}
async function updateScript(){
const id=document.getElementById('editSelect').value;
const name=document.getElementById('editName').value.trim();
const code=document.getElementById('editCode').value;if(!id||!code)return alert('Completa campos');
const btn=document.getElementById('editBtn');btn.innerText='Guardando...';btn.disabled=true;
const r=await fetch('/api/script/'+id,{method:'PUT',headers:authHeaders(),body:JSON.stringify({name,code})});
const d=await r.json();
if(d.success){btn.innerText='OK';setTimeout(()=>{btn.innerText='Guardar';btn.disabled=false;},1200);document.getElementById('editCode').value='';loadScripts();}
else{alert('Error');btn.disabled=false;btn.innerText='Guardar';}
}
async function deleteScript(id){if(!confirm('Borrar?'))return;await fetch('/api/script/'+id,{method:'DELETE',headers:authHeaders()});loadScripts();}
</script></body></html>`);
});

app.listen(PORT, () => console.log('Hub en puerto', PORT));
