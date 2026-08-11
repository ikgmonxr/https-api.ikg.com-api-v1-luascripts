const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
app.set('trust proxy', 1);

const PANEL_PASSWORD = "CambiaEstaContraseña123!"; // ← CAMBIA ESTA
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || "https://discord.com/api/webhooks/1536109822188191746/n-sh2GrGqp1zCTVBoYPzVacaRaCoAsXPyvj4zhVorTGbloeqwu5dSIOuK9SQhf4wCIiv";
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 80 }));

mongoose.connect(process.env.MONGO_URI || "mongodb+srv://yarishdz2_db_user:7cp3VZH9aXK77wX@ikgmxer.8tj7kfa.mongodb.net/hubsilent?appName=ikgmxer")
    .then(() => console.log("🔥 Ikgonavi Hub Pro - ULTRA Protection"))
    .catch(err => console.error("Error DB:", err));

const ScriptModel = mongoose.model('HubScript', new mongoose.Schema({
    id: { type: String, default: () => crypto.randomBytes(16).toString('hex') },
    name: String,
    code: String,
    rawCode: String,
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

// ====================== OFUSCADOR ULTRA ======================
function ultraObfuscate(rawCode) {
    // Capa 1: XOR fuerte
    const key1 = crypto.randomBytes(16);
    let buf = Buffer.from(rawCode, 'utf8');
    for (let i = 0; i < buf.length; i++) buf[i] ^= key1[i % key1.length];

    // Capa 2: otro XOR
    const key2 = crypto.randomBytes(12);
    for (let i = 0; i < buf.length; i++) buf[i] ^= key2[i % key2.length];

    const b64 = buf.toString('base64');

    // Partir en muchos trozos pequeños
    const chunks = [];
    let pos = 0;
    while (pos < b64.length) {
        const size = 18 + Math.floor(Math.random() * 25);
        chunks.push(b64.slice(pos, pos + size));
        pos += size;
    }

    const r = () => '_' + crypto.randomBytes(5).toString('hex');
    const v = {
        k1: r(), k2: r(), ch: r(), d: r(),
        dec: r(), xor: r(), tmp: r(), res: r(),
        a: r(), b: r(), c: r(), f1: r(), f2: r()
    };

    // Generar muchísima basura
    let junk = '';
    for (let i = 0; i < 90; i++) {
        junk += `local ${r()} = "${crypto.randomBytes(12).toString('hex')}"\n`;
    }
    for (let i = 0; i < 25; i++) {
        junk += `local function ${r()}() return ${Math.floor(Math.random()*99999)} end\n`;
    }

    const k1lua = Array.from(key1).join(',');
    const k2lua = Array.from(key2).join(',');
    const chunksLua = chunks.map(c => `"${c}"`).join(',');

    return `-- [IKGONAVI HUB PRO - ULTRA]
${junk}
local ${v.k1} = {${k1lua}}
local ${v.k2} = {${k2lua}}
local ${v.ch} = {${chunksLua}}
local ${v.d} = table.concat(${v.ch})

local function ${v.dec}(data)
    if type(base64_decode) == "function" then return base64_decode(data) end
    if crypt and crypt.base64 and crypt.base64.decode then return crypt.base64.decode(data) end
    if syn and syn.crypt and syn.crypt.base64 and syn.crypt.base64.decode then return syn.crypt.base64.decode(data) end
    if fluxus and fluxus.crypt and fluxus.crypt.base64decode then return fluxus.crypt.base64decode(data) end
    local b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    data=string.gsub(data,'[^'..b..'=]','')
    return (data:gsub('.',function(x)
        if x=='=' then return '' end
        local r,f='',(b:find(x)-1)
        for i=6,1,-1 do r=r..(f%2^i-f%2^(i-1)>0 and '1' or '0') end
        return r
    end):gsub('%d%d%d?%d?%d?%d?%d?%d?',function(x)
        if #x~=8 then return '' end
        local c=0
        for i=1,8 do c=c+(x:sub(i,i)=='1' and 2^(8-i) or 0) end
        return string.char(c)
    end))
end

local function ${v.xor}(str, key)
    local out = {}
    for i = 1, #str do
        local byte = string.byte(str, i)
        local k = key[((i-1) % #key) + 1]
        out[i] = string.char(bit32 and bit32.bxor(byte, k) or (byte ~ k))
    end
    return table.concat(out)
end

-- anti tools
pcall(function()
    if getfenv then local e=getfenv(0) end
    if debug and debug.getinfo then end
end)

local ${v.tmp} = ${v.dec}(${v.d})
${v.tmp} = ${v.xor}(${v.tmp}, ${v.k2})
${v.tmp} = ${v.xor}(${v.tmp}, ${v.k1})

local ${v.a}, ${v.b} = pcall(loadstring, ${v.tmp})
if ${v.a} and type(${v.b}) == "function" then
    ${v.b}()
else
    error("Protected")
end
`.trim();
}

function requireAuth(req, res, next) {
    if ((req.headers['x-panel-password'] || '') !== PANEL_PASSWORD) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    next();
}

// ====================== RUTAS ======================
app.get('/api/scripts', requireAuth, async (req, res) => {
    try {
        res.json(await ScriptModel.find({}, { rawCode: 0 }));
    } catch { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/script', requireAuth, async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!code) return res.status(400).json({ error: 'Falta código' });
        const obfuscated = ultraObfuscate(code);
        const doc = new ScriptModel({ name: name || 'Sin nombre', code: obfuscated, rawCode: code });
        await doc.save();
        sendDiscordLog("📜 Script Creado", `**${doc.name}** (ULTRA)`, 0x10B981);
        res.json({ id: doc.id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error' });
    }
});

app.get('/api/script/:id/raw', requireAuth, async (req, res) => {
    try {
        const s = await ScriptModel.findOne({ id: req.params.id });
        if (!s) return res.status(404).json({ error: 'No encontrado' });
        res.json(s);
    } catch { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/script/:id', requireAuth, async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!code) return res.status(400).json({ error: 'Falta código' });
        const obfuscated = ultraObfuscate(code);
        const s = await ScriptModel.findOneAndUpdate(
            { id: req.params.id },
            { name: name || 'Sin nombre', code: obfuscated, rawCode: code },
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

app.get('/api/script/:id', async (req, res) => {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const isBrowser = /mozilla|chrome|firefox|safari|edg|opera|brave|msie|trident/i.test(ua) &&
                      !/roblox|synapse|script-ware|krnl|fluxus|solara|wave|electron|delta|executor/i.test(ua);

    if (isBrowser) {
        return res.status(403).send(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Endpoint Protegido</title><script src="https://cdn.tailwindcss.com"></script>
<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');body{font-family:'Inter',sans-serif;background:#0a0a0f}</style></head>
<body class="min-h-screen text-white flex items-center justify-center p-6">
<div class="max-w-5xl w-full grid md:grid-cols-2 gap-8">
<div class="bg-[#11111b] border border-white/5 rounded-3xl p-10">
<div class="flex items-center gap-2 text-xs text-red-400 mb-6"><span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>ACCESO INTERCEPTADO</div>
<h1 class="text-4xl font-bold leading-tight mb-4">Este endpoint<br><span class="text-indigo-400">no es para navegadores</span><br>está protegido.</h1>
<p class="text-zinc-400 text-sm mb-8">Ruta reservada para ejecución interna de Roblox. Protección activa.</p>
<div class="space-y-3 mb-8">
<div class="flex justify-between items-center bg-zinc-900/60 rounded-xl px-5 py-3.5"><div class="flex gap-3 items-center"><span>🤖</span><div><div class="text-sm font-medium">Solo Roblox</div><div class="text-xs text-zinc-500">loadstring / HttpGet</div></div></div><span class="text-emerald-400">🔒</span></div>
<div class="flex justify-between items-center bg-zinc-900/60 rounded-xl px-5 py-3.5"><div class="flex gap-3 items-center"><span>&lt;/&gt;</span><div><div class="text-sm font-medium">Sin acceso web</div><div class="text-xs text-zinc-500">User-Agent denegado</div></div></div><span class="text-red-400">✕</span></div>
<div class="flex justify-between items-center bg-zinc-900/60 rounded-xl px-5 py-3.5"><div class="flex gap-3 items-center"><span>⚡</span><div><div class="text-sm font-medium">Logueado</div><div class="text-xs text-zinc-500">IP registrada</div></div></div><span class="text-emerald-400">✓</span></div>
</div>
<a href="/" class="bg-white text-black px-6 py-3 rounded-xl text-sm font-semibold">← Volver</a>
</div>
<div class="bg-[#11111b] border border-white/5 rounded-3xl p-8 flex flex-col">
<div class="flex justify-between mb-8"><div class="text-xs text-emerald-400 flex items-center gap-2"><span class="w-2 h-2 bg-emerald-500 rounded-full"></span>Fingerprint OK</div><div class="text-xs text-red-400 bg-red-950/40 px-3 py-1 rounded-full">Bot blocked</div></div>
<div class="flex-1 flex items-center justify-center"><div class="relative"><div class="w-32 h-32 rounded-full border-2 border-indigo-500/30 flex items-center justify-center"><div class="w-20 h-20 rounded-full border border-indigo-500/50 bg-indigo-500/10 flex items-center justify-center"><svg class="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></div></div><div class="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-xs px-3 py-1 rounded-full">403 Forbidden</div></div></div>
<div class="mt-8 bg-black/40 rounded-2xl p-5 font-mono text-xs">
<div class="flex gap-2 mb-3 text-zinc-500"><span class="w-2 h-2 bg-red-500 rounded-full"></span><span class="w-2 h-2 bg-yellow-500 rounded-full"></span><span class="w-2 h-2 bg-emerald-500 rounded-full"></span><span class="ml-2">protection.log</span><span class="ml-auto text-emerald-400 text-[10px]">LIVE</span></div>
<div class="space-y-1 text-zinc-400">
<div><span class="text-red-400">BLOCK</span> UA: ${ua.slice(0,35)}...</div>
<div><span class="text-yellow-400">DETECT</span> /api/script/**</div>
<div><span class="text-blue-400">REDIR</span> → /protection</div>
<div><span class="text-zinc-500">TRACE</span> ${crypto.randomBytes(5).toString('hex')}</div>
</div></div></div></div>
<div class="fixed bottom-6 left-1/2 -translate-x-1/2 text-xs text-zinc-600">Ikgonavi Hub Pro • ULTRA Protection</div>
</body></html>`);
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

// ====================== PANEL ======================
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
.bar-fill{transition:width .8s}
</style></head>
<body class="min-h-screen">
<div id="loginScreen" class="min-h-screen flex items-center justify-center p-4">
<div class="glass w-full max-w-md p-10 rounded-3xl">
<div class="text-center mb-10">
<div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5">⚡</div>
<h1 class="text-2xl font-bold">Ikgonavi Hub Pro</h1>
<p class="text-indigo-400 text-sm mt-2">ULTRA Protection</p>
</div>
<input type="password" id="passInput" placeholder="Contraseña" class="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-2xl px-5 py-4 mb-5 outline-none focus:border-indigo-500">
<button onclick="login()" class="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 py-4 rounded-2xl font-semibold">Entrar</button>
<p id="loginError" class="text-red-400 text-sm text-center mt-5 hidden">Contraseña incorrecta</p>
</div></div>

<div id="dashboard" class="hidden min-h-screen"><div class="flex">
<aside class="w-72 glass min-h-screen p-6 flex flex-col fixed left-0 top-0">
<div class="flex items-center gap-3 mb-12 px-2">
<div class="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-xl">⚡</div>
<div><div class="font-bold text-sm">Ikgonavi Hub</div><div class="text-xs text-indigo-400">ULTRA</div></div>
</div>
<nav class="flex flex-col gap-1.5 flex-1">
<button onclick="showPage('obfuscator')" id="nav-obfuscator" class="sidebar-btn active flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium"><span>🔒</span> Ofuscador</button>
<button onclick="showPage('scripts')" id="nav-scripts" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-400"><span>📜</span> Scripts</button>
<button onclick="showPage('executions')" id="nav-executions" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-400"><span>📊</span> Ejecuciones</button>
<button onclick="showPage('executors')" id="nav-executors" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-400"><span>🤖</span> Execs</button>
<button onclick="showPage('logs')" id="nav-logs" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-400"><span>👁️</span> Quién Ejecuta</button>
<button onclick="showPage('edit')" id="nav-edit" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-400"><span>✏️</span> Editar</button>
</nav>
<div class="pt-4 border-t border-white/5 mt-auto flex flex-col gap-2">
<button onclick="testWebhook()" class="flex items-center gap-3 px-4 py-3 rounded-xl text-xs text-indigo-300 bg-indigo-950/30">🔔 Test Webhook</button>
<button onclick="logout()" class="flex items-center gap-3 px-4 py-3 rounded-xl text-xs text-red-400">🚪 Salir</button>
</div>
</aside>

<main class="ml-72 flex-1 p-10">
<div id="page-obfuscator" class="page">
<div class="mb-10"><h2 class="text-3xl font-bold">Ofuscador ULTRA</h2><p class="text-zinc-400 mt-1">Doble XOR + Chunks + 90+ junk + Anti-dump</p></div>
<div class="glass rounded-3xl p-8 max-w-3xl">
<div class="mb-6"><label class="text-sm text-zinc-400 mb-2 block">Nombre</label>
<input id="scriptName" type="text" placeholder="Ej: Silent Aim" class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500"></div>
<div class="mb-6"><div class="flex justify-between mb-2"><label class="text-sm text-zinc-400">Código Lua</label>
<button onclick="pasteCode()" class="text-xs text-indigo-400">📋 Pegar</button></div>
<textarea id="scriptCode" placeholder="Pega tu código..." class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-4 h-64 font-mono text-sm outline-none focus:border-indigo-500 resize-none"></textarea></div>
<button id="saveBtn" onclick="saveScript()" class="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 py-4 rounded-2xl font-semibold">🔒 Ofuscar ULTRA y Guardar</button>
<div class="mt-8"><div class="flex justify-between mb-2"><label class="text-sm text-zinc-400">Loadstring</label>
<button onclick="copyResult()" class="text-xs text-indigo-400">Copiar</button></div>
<textarea id="resultOutput" readonly class="w-full bg-zinc-950/80 border border-zinc-800/50 rounded-2xl px-5 py-4 h-24 font-mono text-xs text-emerald-400 outline-none resize-none"></textarea></div>
</div></div>

<div id="page-scripts" class="page hidden">
<div class="flex justify-between items-end mb-10"><div><h2 class="text-3xl font-bold">Scripts</h2></div>
<span id="scriptCount" class="bg-indigo-950/60 text-indigo-300 text-sm px-5 py-2 rounded-full">0</span></div>
<div id="scriptsList" class="grid gap-5"></div>
</div>

<div id="page-executions" class="page hidden">
<div class="flex justify-between items-end mb-10"><div><h2 class="text-3xl font-bold">📊 Ejecuciones</h2></div>
<button onclick="loadScripts()" class="text-sm bg-zinc-800 px-5 py-2.5 rounded-xl">🔄</button></div>
<div class="grid grid-cols-3 gap-5 mb-10">
<div class="glass rounded-2xl p-6"><div class="text-zinc-400 text-sm">Total</div><div id="statTotal" class="text-3xl font-bold">0</div></div>
<div class="glass rounded-2xl p-6"><div class="text-zinc-400 text-sm">Ejecuciones</div><div id="statExecutions" class="text-3xl font-bold text-emerald-400">0</div></div>
<div class="glass rounded-2xl p-6"><div class="text-zinc-400 text-sm">Top</div><div id="statTop" class="text-xl font-bold text-indigo-300 truncate">—</div></div>
</div>
<div class="glass rounded-3xl overflow-hidden"><table class="w-full">
<thead><tr class="text-left text-xs text-zinc-500 uppercase"><th class="px-6 py-4">#</th><th class="px-6 py-4">Script</th><th class="px-6 py-4">Exec</th><th class="px-6 py-4">Bar</th></tr></thead>
<tbody id="executionsTable"></tbody></table></div>
</div>

<div id="page-executors" class="page hidden">
<div class="flex justify-between items-end mb-10"><div><h2 class="text-3xl font-bold">🤖 Execs</h2></div>
<button onclick="loadExecutorStats()" class="text-sm bg-zinc-800 px-5 py-2.5 rounded-xl">🔄</button></div>
<div class="glass rounded-3xl overflow-hidden"><table class="w-full">
<thead><tr class="text-left text-xs text-zinc-500 uppercase"><th class="px-6 py-4">#</th><th class="px-6 py-4">Ejecutor</th><th class="px-6 py-4">Versión</th><th class="px-6 py-4">Usos</th></tr></thead>
<tbody id="executorsTable"></tbody></table></div>
</div>

<div id="page-logs" class="page hidden">
<div class="flex justify-between items-end mb-10"><div><h2 class="text-3xl font-bold">👁️ Quién Ejecuta</h2></div>
<div class="flex gap-3"><button onclick="loadLogs()" class="text-sm bg-zinc-800 px-5 py-2.5 rounded-xl">🔄</button>
<button onclick="clearLogs()" class="text-sm bg-red-950/50 text-red-300 px-5 py-2.5 rounded-xl">🗑️</button></div></div>
<div class="glass rounded-3xl overflow-hidden max-h-[600px] overflow-y-auto"><table class="w-full">
<thead class="sticky top-0 bg-[#11131c]"><tr class="text-left text-xs text-zinc-500 uppercase"><th class="px-6 py-4">Fecha</th><th class="px-6 py-4">Script</th><th class="px-6 py-4">IP</th><th class="px-6 py-4">UA</th></tr></thead>
<tbody id="logsTable"></tbody></table></div>
</div>

<div id="page-edit" class="page hidden">
<div class="mb-10"><h2 class="text-3xl font-bold">Editar</h2></div>
<div class="glass rounded-3xl p-8 max-w-3xl">
<div class="mb-6"><label class="text-sm text-zinc-400 mb-2 block">Script</label>
<select id="editSelect" onchange="loadEditScript()" class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-3.5"><option value="">-- Elige --</option></select></div>
<div class="mb-6"><label class="text-sm text-zinc-400 mb-2 block">Nombre</label>
<input id="editName" class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-3.5"></div>
<div class="mb-6"><label class="text-sm text-zinc-400 mb-2 block">Código</label>
<textarea id="editCode" class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-4 h-64 font-mono text-sm resize-none"></textarea></div>
<button id="editBtn" onclick="updateScript()" class="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 py-4 rounded-2xl font-semibold">💾 Guardar ULTRA</button>
</div></div>
</main></div></div>

<script>
let panelPass=localStorage.getItem('ikg_pass')||'',allScripts=[];
if(panelPass){document.getElementById('loginScreen').classList.add('hidden');document.getElementById('dashboard').classList.remove('hidden');loadScripts()}
function login(){const p=document.getElementById('passInput').value;if(!p)return;fetch('/api/scripts',{headers:{'x-panel-password':p}}).then(r=>{if(r.status===401)return document.getElementById('loginError').classList.remove('hidden');panelPass=p;localStorage.setItem('ikg_pass',p);document.getElementById('loginScreen').classList.add('hidden');document.getElementById('dashboard').classList.remove('hidden');loadScripts()})}
function logout(){localStorage.removeItem('ikg_pass');location.reload()}
function showPage(p){document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));document.getElementById('page-'+p).classList.remove('hidden');document.querySelectorAll('.sidebar-btn').forEach(b=>{b.classList.remove('active');b.classList.add('text-zinc-400')});const a=document.getElementById('nav-'+p);if(a){a.classList.add('active');a.classList.remove('text-zinc-400')}if(['scripts','edit','executions'].includes(p))loadScripts();if(p==='logs')loadLogs();if(p==='executors')loadExecutorStats()}
async function loadScripts(){try{const r=await fetch('/api/scripts',{headers:{'x-panel-password':panelPass}});if(r.status===401)return logout();allScripts=await r.json();document.getElementById('scriptCount').innerText=allScripts.length+' scripts';const list=document.getElementById('scriptsList');list.innerHTML=allScripts.map(s=>{const ls=\`loadstring(game:HttpGet("\${location.origin}/api/script/\${s.id}"))()\`;return \`<div class="glass rounded-2xl p-6"><div class="flex justify-between mb-3"><div><div class="font-semibold text-indigo-300">\${esc(s.name||'Sin nombre')}</div><div class="text-xs text-zinc-500">\${s.id.slice(0,12)}... • <span class="text-emerald-400">\${s.executions||0}</span></div></div><button onclick="deleteScript('\${s.id}')" class="text-xs text-red-400 bg-red-950/40 px-3 py-1 rounded-xl">Borrar</button></div><textarea readonly class="w-full bg-zinc-950/70 border border-zinc-800 rounded-xl p-3 text-xs font-mono h-14 resize-none">\${ls}</textarea><button onclick="navigator.clipboard.writeText('\${ls}');this.innerText='¡Copiado!'" class="mt-3 w-full bg-indigo-600 py-2 rounded-xl text-sm">Copiar</button></div>\`}).join('')||'<p class="text-zinc-500 text-center py-20">No hay scripts</p>';updateStats();document.getElementById('editSelect').innerHTML='<option value="">-- Elige --</option>'+allScripts.map(s=>\`<option value="\${s.id}">\${esc(s.name||'Sin nombre')}</option>\`).join('')}catch{}}
function updateStats(){const total=allScripts.reduce((a,s)=>a+(s.executions||0),0),max=Math.max(...allScripts.map(s=>s.executions||0),1),top=[...allScripts].sort((a,b)=>(b.executions||0)-(a.executions||0))[0];document.getElementById('statTotal').innerText=allScripts.length;document.getElementById('statExecutions').innerText=total;document.getElementById('statTop').innerText=top?(top.name||'—'):'—';document.getElementById('executionsTable').innerHTML=[...allScripts].sort((a,b)=>(b.executions||0)-(a.executions||0)).map((s,i)=>{const c=s.executions||0,p=Math.round(c/max*100),m=['🥇','🥈','🥉'][i]||(i+1);return \`<tr class="border-t border-white/5"><td class="px-6 py-4">\${m}</td><td class="px-6 py-4 text-indigo-300">\${esc(s.name||'Sin nombre')}</td><td class="px-6 py-4 text-emerald-400 font-bold">\${c}</td><td class="px-6 py-4"><div class="w-full bg-zinc-800 rounded-full h-2"><div class="bar-fill h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full" style="width:\${p}%"></div></div></td></tr>\`}).join('')}
async function loadExecutorStats(){const r=await fetch('/api/executor-stats',{headers:{'x-panel-password':panelPass}});const stats=await r.json();document.getElementById('executorsTable').innerHTML=stats.map((s,i)=>{const m=['🥇','🥈','🥉'][i]||(i+1);return \`<tr class="border-t border-white/5"><td class="px-6 py-4">\${m}</td><td class="px-6 py-4 text-indigo-300">\${esc(s.name)}</td><td class="px-6 py-4 text-emerald-400 text-xs">\${esc(s.version)}</td><td class="px-6 py-4 font-bold">\${s.count}</td></tr>\`}).join('')||'<tr><td colspan="4" class="px-6 py-16 text-center text-zinc-500">Sin datos</td></tr>'}
async function loadLogs(){const r=await fetch('/api/executions',{headers:{'x-panel-password':panelPass}});const logs=await r.json();document.getElementById('logsTable').innerHTML=logs.map(l=>{const d=new Date(l.createdAt).toLocaleString('es-ES');return \`<tr class="border-t border-white/5"><td class="px-6 py-3 text-sm text-zinc-400">\${d}</td><td class="px-6 py-3 text-indigo-300">\${esc(l.scriptName||'')}</td><td class="px-6 py-3 font-mono text-emerald-400 text-sm">\${l.ip||'?'}</td><td class="px-6 py-3 text-xs text-zinc-500 truncate max-w-xs">\${esc((l.userAgent||'').slice(0,50))}</td></tr>\`}).join('')||'<tr><td colspan="4" class="px-6 py-16 text-center text-zinc-500">Sin ejecuciones</td></tr>'}
async function clearLogs(){if(!confirm('¿Borrar historial?'))return;await fetch('/api/executions',{method:'DELETE',headers:{'x-panel-password':panelPass}});loadLogs()}
async function testWebhook(){await fetch('/api/test-webhook',{method:'POST',headers:{'x-panel-password':panelPass}});alert('Enviado')}
function esc(t){const d=document.createElement('div');d.textContent=t||'';return d.innerHTML}
async function pasteCode(){try{const t=await navigator.clipboard.readText();if(t)document.getElementById('scriptCode').value=t}catch{}}
function copyResult(){const v=document.getElementById('resultOutput').value;if(v){navigator.clipboard.writeText(v);alert('Copiado')}}
async function saveScript(){const name=document.getElementById('scriptName').value.trim(),code=document.getElementById('scriptCode').value;if(!code)return alert('Pega código');const btn=document.getElementById('saveBtn');btn.innerText='Ofuscando ULTRA...';btn.disabled=true;try{const r=await fetch('/api/script',{method:'POST',headers:{'Content-Type':'application/json','x-panel-password':panelPass},body:JSON.stringify({name,code})});const d=await r.json();if(d.id){document.getElementById('resultOutput').value=\`loadstring(game:HttpGet("\${location.origin}/api/script/\${d.id}"))()\`;document.getElementById('scriptCode').value='';document.getElementById('scriptName').value='';btn.innerText='¡Listo!';setTimeout(()=>{btn.innerText='🔒 Ofuscar ULTRA y Guardar';btn.disabled=false},1500);loadScripts()}else{alert(d.error||'Error');btn.disabled=false;btn.innerText='🔒 Ofuscar ULTRA y Guardar'}}catch{alert('Error');btn.disabled=false;btn.innerText='🔒 Ofuscar ULTRA y Guardar'}}
async function loadEditScript(){const id=document.getElementById('editSelect').value;if(!id)return;const r=await fetch('/api/script/'+id+'/raw',{headers:{'x-panel-password':panelPass}});const s=await r.json();if(s){document.getElementById('editName').value=s.name||'';document.getElementById('editCode').value=s.rawCode||''}}
async function updateScript(){const id=document.getElementById('editSelect').value,name=document.getElementById('editName').value.trim(),code=document.getElementById('editCode').value;if(!id||!code)return alert('Completa');const btn=document.getElementById('editBtn');btn.innerText='Guardando...';btn.disabled=true;const r=await fetch('/api/script/'+id,{method:'PUT',headers:{'Content-Type':'application/json','x-panel-password':panelPass},body:JSON.stringify({name,code})});const d=await r.json();if(d.success){btn.innerText='¡OK!';setTimeout(()=>{btn.innerText='💾 Guardar ULTRA';btn.disabled=false},1500);loadScripts()}else{alert('Error');btn.disabled=false;btn.innerText='💾 Guardar ULTRA'}}
async function deleteScript(id){if(!confirm('¿Borrar?'))return;await fetch('/api/script/'+id,{method:'DELETE',headers:{'x-panel-password':panelPass}});loadScripts()}
</script></body></html>`);
});

app.listen(PORT, () => console.log("🚀 ULTRA Protection en puerto", PORT));
