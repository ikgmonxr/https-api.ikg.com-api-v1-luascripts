const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
app.set('trust proxy', 1);

const PANEL_PASSWORD = "CambiaEstaContraseña123!";
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || "https://discord.com/api/webhooks/1536109822188191746/n-sh2GrGqp1zCTVBoYPzVacaRaCoAsXPyvj4zhVorTGbloeqwu5dSIOuK9SQhf4wCIiv";
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

mongoose.connect(process.env.MONGO_URI || "mongodb+srv://yarishdz2_db_user:7cp3VZH9aXK77wX@ikgmxer.8tj7kfa.mongodb.net/hubsilent?appName=ikgmxer")
    .then(() => console.log("🔥 Ikgonavi Hub Pro activo"))
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
                embeds: [{
                    title,
                    description,
                    color,
                    timestamp: new Date().toISOString(),
                    footer: { text: "Ikgonavi Hub Pro • Logs" }
                }]
            })
        });
    } catch (err) {
        console.error("Error Discord:", err.message);
    }
}

function obfuscate(rawCode) {
    const encoded = Buffer.from(rawCode, 'utf8').toString('base64');
    const r = () => crypto.randomBytes(3).toString('hex');
    let junk = "";
    for (let i = 0; i < 25; i++) {
        junk += `local _${r()} = "${crypto.randomBytes(5).toString('hex')}"\n`;
    }
    return `-- [IKGONAVI HUB PRO]
${junk}
local data = "${encoded}"
local function decode(data)
    if base64_decode then return base64_decode(data) end
    if crypt and crypt.base64 and crypt.base64.decode then return crypt.base64.decode(data) end
    if syn and syn.crypt and syn.crypt.base64 and syn.crypt.base64.decode then return syn.crypt.base64.decode(data) end
    local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    data = string.gsub(data, '[^'..b..'=]', '')
    return (data:gsub('.', function(x)
        if (x == '=') then return '' end
        local r, f = '', (b:find(x) - 1)
        for i = 6, 1, -1 do r = r .. (f % 2^i - f % 2^(i-1) > 0 and '1' or '0') end
        return r
    end):gsub('%d%d%d?%d?%d?%d?%d?%d?', function(x)
        if (#x ~= 8) then return '' end
        local c = 0
        for i = 1, 8 do c = c + (x:sub(i, i) == '1' and 2^(8-i) or 0) end
        return string.char(c)
    end))
end
assert(loadstring(decode(data)))()
`.trim();
}

function requireAuth(req, res, next) {
    if ((req.headers['x-panel-password'] || '') !== PANEL_PASSWORD) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    next();
}

app.get('/api/scripts', requireAuth, async (req, res) => {
    try {
        const scripts = await ScriptModel.find({}, { rawCode: 0 });
        res.json(scripts);
    } catch {
        res.status(500).json({ error: 'Error' });
    }
});

app.post('/api/script', requireAuth, async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!code) return res.status(400).json({ error: 'Falta el código' });
        const obfuscated = obfuscate(code);
        const newScript = new ScriptModel({
            name: name || 'Sin nombre',
            code: obfuscated,
            rawCode: code
        });
        await newScript.save();
        sendDiscordLog("📜 Script Creado", `Se creó el script: **${name || 'Sin nombre'}**`, 0x10B981);
        res.json({ id: newScript.id });
    } catch {
        res.status(500).json({ error: 'Error al guardar' });
    }
});

app.get('/api/script/:id/raw', requireAuth, async (req, res) => {
    try {
        const script = await ScriptModel.findOne({ id: req.params.id });
        if (!script) return res.status(404).json({ error: 'No encontrado' });
        res.json(script);
    } catch {
        res.status(500).json({ error: 'Error' });
    }
});

app.put('/api/script/:id', requireAuth, async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!code) return res.status(400).json({ error: 'Falta el código' });
        const obfuscated = obfuscate(code);
        const script = await ScriptModel.findOneAndUpdate(
            { id: req.params.id },
            { name: name || 'Sin nombre', code: obfuscated, rawCode: code },
            { new: true }
        );
        if (!script) return res.status(404).json({ error: 'No encontrado' });
        sendDiscordLog("🔄 Script actualizado", `El script **${script.name}** fue actualizado.`, 0xF59E0B);
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Error' });
    }
});

app.delete('/api/script/:id', requireAuth, async (req, res) => {
    try {
        const script = await ScriptModel.findOneAndDelete({ id: req.params.id });
        if (script) sendDiscordLog("🗑️ Script Borrado", `Se eliminó: **${script.name}**`, 0xEF4444);
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Error' });
    }
});

app.get('/api/script/:id', async (req, res) => {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const isBrowser = /mozilla|chrome|firefox|safari|edg|opera|brave|msie|trident/i.test(ua) && 
                      !/roblox|synapse|script-ware|krnl|fluxus|solara|wave|electron|delta|executor/i.test(ua);

    if (isBrowser) {
        return res.status(403).send(`
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Endpoint Protegido • Ikgonavi Hub</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
body{font-family:'Inter',sans-serif;background:#0a0a0f}
</style>
</head>
<body class="min-h-screen text-white flex items-center justify-center p-6">
<div class="max-w-5xl w-full grid md:grid-cols-2 gap-8">
<div class="bg-[#11111b] border border-white/5 rounded-3xl p-10">
<div class="flex items-center gap-2 text-xs text-red-400 mb-6">
<span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
ACCESO INTERCEPTADO POR WAF
</div>
<h1 class="text-4xl font-bold leading-tight mb-4">
Este endpoint<br>
<span class="text-indigo-400">no es para navegadores</span><br>
está protegido.
</h1>
<p class="text-zinc-400 text-sm leading-relaxed mb-8">
Has llegado a una ruta reservada para <span class="text-white">ejecución interna de Roblox</span>. 
Nuestro sistema de protección bloqueó la vista web para evitar abusos y scraping.
</p>
<div class="space-y-3 mb-10">
<div class="flex items-center justify-between bg-zinc-900/60 border border-white/5 rounded-xl px-5 py-3.5">
<div class="flex items-center gap-3"><span>🤖</span><div><div class="text-sm font-medium">Solo Roblox</div><div class="text-xs text-zinc-500">HttpGet / loadstring únicamente</div></div></div>
<span class="text-emerald-400">🔒</span>
</div>
<div class="flex items-center justify-between bg-zinc-900/60 border border-white/5 rounded-xl px-5 py-3.5">
<div class="flex items-center gap-3"><span>&lt;/&gt;</span><div><div class="text-sm font-medium">Sin acceso directo</div><div class="text-xs text-zinc-500">User-Agent web denegado</div></div></div>
<span class="text-red-400">✕</span>
</div>
<div class="flex items-center justify-between bg-zinc-900/60 border border-white/5 rounded-xl px-5 py-3.5">
<div class="flex items-center gap-3"><span>⚡</span><div><div class="text-sm font-medium">Protegido & logueado</div><div class="text-xs text-zinc-500">Request registrada + IP</div></div></div>
<span class="text-emerald-400">✓</span>
</div>
</div>
<a href="/" class="bg-white text-black px-6 py-3 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition">← Volver al inicio</a>
</div>
<div class="bg-[#11111b] border border-white/5 rounded-3xl p-8 flex flex-col">
<div class="flex justify-between items-center mb-8">
<div class="flex items-center gap-2 text-xs text-emerald-400"><span class="w-2 h-2 bg-emerald-500 rounded-full"></span>Fingerprint OK</div>
<div class="text-xs text-red-400 bg-red-950/40 px-3 py-1 rounded-full">Bot blocked</div>
</div>
<div class="flex-1 flex items-center justify-center">
<div class="relative">
<div class="w-32 h-32 rounded-full border-2 border-indigo-500/30 flex items-center justify-center">
<div class="w-20 h-20 rounded-full border border-indigo-500/50 flex items-center justify-center bg-indigo-500/10">
<svg class="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
</div>
</div>
<div class="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-xs px-3 py-1 rounded-full font-medium">403 Forbidden</div>
</div>
</div>
<div class="mt-8 bg-black/40 rounded-2xl p-5 font-mono text-xs">
<div class="flex items-center gap-2 mb-3 text-zinc-500">
<span class="w-2 h-2 bg-red-500 rounded-full"></span>
<span class="w-2 h-2 bg-yellow-500 rounded-full"></span>
<span class="w-2 h-2 bg-emerald-500 rounded-full"></span>
<span class="ml-2">protection.log</span>
<span class="ml-auto text-emerald-400 text-[10px]">LIVE</span>
</div>
<div class="space-y-1.5 text-zinc-400">
<div><span class="text-red-400">BLOCK</span> UA: ${ua.slice(0,40)}...</div>
<div><span class="text-yellow-400">DETECT</span> Path: /api/script/**</div>
<div><span class="text-blue-400">REDIR</span> → /protection</div>
<div><span class="text-zinc-500">INFO</span> Trace ID: ${crypto.randomBytes(6).toString('hex')}</div>
</div>
</div>
</div>
</div>
<div class="fixed bottom-6 left-1/2 -translate-x-1/2 text-xs text-zinc-600">Ikgonavi Hub Pro • Protected Endpoint</div>
</body>
</html>`);
    }

    try {
        const script = await ScriptModel.findOne({ id: req.params.id });
        if (!script) return res.status(404).send('-- Script no encontrado');

        script.executions += 1;
        await script.save();

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'] || 'Desconocido';

        await ExecutionModel.create({
            scriptId: script.id,
            scriptName: script.name,
            ip,
            userAgent
        });

        sendDiscordLog("📜 Script Ejecutado", `**Nombre:** ${script.name}\n**ID:** \`${script.id}\`\n**Ejecuciones:** ${script.executions}\n**IP:** \`${ip}\``, 0x57F287);

        res.type('text/plain').send(script.code);
    } catch {
        res.status(500).send('-- Error interno');
    }
});

app.get('/api/executions', requireAuth, async (req, res) => {
    try {
        const logs = await ExecutionModel.find().sort({ createdAt: -1 }).limit(100);
        res.json(logs);
    } catch {
        res.status(500).json({ error: 'Error' });
    }
});

app.delete('/api/executions', requireAuth, async (req, res) => {
    try {
        await ExecutionModel.deleteMany({});
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Error' });
    }
});

app.get('/api/executor-stats', requireAuth, async (req, res) => {
    try {
        const logs = await ExecutionModel.find();
        const counts = {};
        logs.forEach(l => {
            const ua = l.userAgent || 'Desconocido';
            counts[ua] = (counts[ua] || 0) + 1;
        });
        const stats = Object.keys(counts).map(ua => ({
            name: ua.split('/')[0] || 'Desconocido',
            version: ua.includes('/') ? ua.split('/')[1] || 'v1.0' : 'N/A',
            count: counts[ua]
        })).sort((a, b) => b.count - a.count);
        res.json(stats);
    } catch {
        res.status(500).json({ error: 'Error' });
    }
});

app.post('/api/test-webhook', requireAuth, async (req, res) => {
    await sendDiscordLog("🔔 Prueba de Webhook", "¡El sistema funciona correctamente!", 0x3B82F6);
    res.json({ success: true });
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ikgonavi Hub Pro</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
body{font-family:'Inter',sans-serif;background:#0b0c10;color:#e2e8f0}
.glass{background:rgba(17,19,28,.85);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.06)}
.sidebar-btn{transition:all .2s}
.sidebar-btn:hover{background:rgba(99,102,241,.1)}
.sidebar-btn.active{background:rgba(99,102,241,.2);color:#a5b4fc}
.bar-fill{transition:width .8s ease}
</style>
</head>
<body class="min-h-screen">
<div id="loginScreen" class="min-h-screen flex items-center justify-center p-4">
<div class="glass w-full max-w-md p-10 rounded-3xl">
<div class="text-center mb-10">
<div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5">⚡</div>
<h1 class="text-2xl font-bold">Ikgonavi Hub Pro</h1>
<p class="text-indigo-400 text-sm mt-2">Panel de Control</p>
</div>
<input type="password" id="passInput" placeholder="Contraseña del panel" class="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-2xl px-5 py-4 mb-5 outline-none focus:border-indigo-500">
<button onclick="login()" class="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 py-4 rounded-2xl font-semibold">Entrar al Panel</button>
<p id="loginError" class="text-red-400 text-sm text-center mt-5 hidden">Contraseña incorrecta</p>
</div>
</div>

<div id="dashboard" class="hidden min-h-screen">
<div class="flex">
<aside class="w-72 glass min-h-screen p-6 flex flex-col fixed left-0 top-0">
<div class="flex items-center gap-3 mb-12 px-2">
<div class="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-xl">⚡</div>
<div><div class="font-bold text-sm">Ikgonavi Hub</div><div class="text-xs text-indigo-400">Pro Panel</div></div>
</div>
<nav class="flex flex-col gap-1.5 flex-1">
<button onclick="showPage('obfuscator')" id="nav-obfuscator" class="sidebar-btn active flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium"><span>🔒</span> Ofuscador</button>
<button onclick="showPage('scripts')" id="nav-scripts" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-400"><span>📜</span> Scripts</button>
<button onclick="showPage('executions')" id="nav-executions" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-400"><span>📊</span> Ejecuciones</button>
<button onclick="showPage('executors')" id="nav-executors" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-400"><span>🤖</span> Execs Ranking</button>
<button onclick="showPage('logs')" id="nav-logs" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-400"><span>👁️</span> Quién Ejecuta</button>
<button onclick="showPage('edit')" id="nav-edit" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-400"><span>✏️</span> Editar</button>
</nav>
<div class="pt-4 border-t border-white/5 mt-auto flex flex-col gap-2">
<button onclick="testWebhook()" class="flex items-center gap-3 px-4 py-3 rounded-xl text-xs text-indigo-300 bg-indigo-950/30">🔔 Test Webhook</button>
<button onclick="logout()" class="flex items-center gap-3 px-4 py-3 rounded-xl text-xs text-red-400">🚪 Cerrar Sesión</button>
</div>
</aside>

<main class="ml-72 flex-1 p-10">
<div id="page-obfuscator" class="page">
<div class="mb-10"><h2 class="text-3xl font-bold">Ofuscador</h2><p class="text-zinc-400 mt-1">Pega tu código y ofúscalo</p></div>
<div class="glass rounded-3xl p-8 max-w-3xl">
<div class="mb-6"><label class="text-sm text-zinc-400 mb-2 block">Nombre del Script</label>
<input id="scriptName" type="text" placeholder="Ej: Silent Aim" class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500"></div>
<div class="mb-6"><div class="flex justify-between mb-2"><label class="text-sm text-zinc-400">Código Lua</label>
<button onclick="pasteCode()" class="text-xs text-indigo-400">📋 Pegar</button></div>
<textarea id="scriptCode" placeholder="Pega tu código..." class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-4 h-64 font-mono text-sm outline-none focus:border-indigo-500 resize-none"></textarea></div>
<button id="saveBtn" onclick="saveScript()" class="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 py-4 rounded-2xl font-semibold">🔒 Ofuscar y Guardar</button>
<div class="mt-8"><div class="flex justify-between mb-2"><label class="text-sm text-zinc-400">Loadstring</label>
<button onclick="copyResult()" class="text-xs text-indigo-400">Copiar</button></div>
<textarea id="resultOutput" readonly placeholder="Aparecerá aquí..." class="w-full bg-zinc-950/80 border border-zinc-800/50 rounded-2xl px-5 py-4 h-24 font-mono text-xs text-emerald-400 outline-none resize-none"></textarea></div>
</div>
</div>

<div id="page-scripts" class="page hidden">
<div class="flex justify-between items-end mb-10">
<div><h2 class="text-3xl font-bold">Scripts</h2><p class="text-zinc-400 mt-1">Todos tus scripts</p></div>
<span id="scriptCount" class="bg-indigo-950/60 text-indigo-300 text-sm px-5 py-2 rounded-full">0 scripts</span>
</div>
<div id="scriptsList" class="grid gap-5"><p class="text-zinc-500 text-center py-20">Cargando...</p></div>
</div>

<div id="page-executions" class="page hidden">
<div class="flex justify-between items-end mb-10">
<div><h2 class="text-3xl font-bold">📊 Ejecuciones</h2><p class="text-zinc-400 mt-1">Ranking de uso</p></div>
<button onclick="loadScripts()" class="text-sm bg-zinc-800 px-5 py-2.5 rounded-xl">🔄 Actualizar</button>
</div>
<div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
<div class="glass rounded-2xl p-6"><div class="text-zinc-400 text-sm mb-1">Total Scripts</div><div id="statTotal" class="text-3xl font-bold">0</div></div>
<div class="glass rounded-2xl p-6"><div class="text-zinc-400 text-sm mb-1">Ejecuciones Totales</div><div id="statExecutions" class="text-3xl font-bold text-emerald-400">0</div></div>
<div class="glass rounded-2xl p-6"><div class="text-zinc-400 text-sm mb-1">Más Popular</div><div id="statTop" class="text-xl font-bold text-indigo-300 truncate">—</div></div>
</div>
<div class="glass rounded-3xl overflow-hidden">
<div class="px-6 py-5 border-b border-white/5"><h3 class="font-semibold">Ranking</h3></div>
<table class="w-full"><thead><tr class="text-left text-xs text-zinc-500 uppercase"><th class="px-6 py-4">#</th><th class="px-6 py-4">Script</th><th class="px-6 py-4">Ejecuciones</th><th class="px-6 py-4">Progreso</th></tr></thead>
<tbody id="executionsTable"><tr><td colspan="4" class="px-6 py-16 text-center text-zinc-500">Cargando...</td></tr></tbody></table>
</div>
</div>

<div id="page-executors" class="page hidden">
<div class="flex justify-between items-end mb-10">
<div><h2 class="text-3xl font-bold">🤖 Execs Ranking</h2><p class="text-zinc-400 mt-1">Ejecutores más usados</p></div>
<button onclick="loadExecutorStats()" class="text-sm bg-zinc-800 px-5 py-2.5 rounded-xl">🔄 Actualizar</button>
</div>
<div class="glass rounded-3xl overflow-hidden">
<div class="px-6 py-5 border-b border-white/5 flex justify-between"><h3 class="font-semibold">Ranking de Execs</h3><span id="execsCount" class="text-sm text-zinc-400">0</span></div>
<table class="w-full"><thead><tr class="text-left text-xs text-zinc-500 uppercase"><th class="px-6 py-4">#</th><th class="px-6 py-4">Ejecutor</th><th class="px-6 py-4">Versión</th><th class="px-6 py-4">Usos</th><th class="px-6 py-4">Popularidad</th></tr></thead>
<tbody id="executorsTable"><tr><td colspan="5" class="px-6 py-16 text-center text-zinc-500">Cargando...</td></tr></tbody></table>
</div>
</div>

<div id="page-logs" class="page hidden">
<div class="flex justify-between items-end mb-10">
<div><h2 class="text-3xl font-bold">👁️ Quién Ejecuta</h2><p class="text-zinc-400 mt-1">Historial de ejecuciones</p></div>
<div class="flex gap-3">
<button onclick="loadLogs()" class="text-sm bg-zinc-800 px-5 py-2.5 rounded-xl">🔄 Actualizar</button>
<button onclick="clearLogs()" class="text-sm bg-red-950/50 text-red-300 px-5 py-2.5 rounded-xl">🗑️ Limpiar</button>
</div>
</div>
<div class="glass rounded-3xl overflow-hidden">
<div class="px-6 py-5 border-b border-white/5 flex justify-between"><h3 class="font-semibold">Últimas Ejecuciones</h3><span id="logsCount" class="text-sm text-zinc-400">0</span></div>
<div class="overflow-x-auto max-h-[600px] overflow-y-auto">
<table class="w-full"><thead class="sticky top-0 bg-[#11131c]"><tr class="text-left text-xs text-zinc-500 uppercase"><th class="px-6 py-4">Fecha</th><th class="px-6 py-4">Script</th><th class="px-6 py-4">IP</th><th class="px-6 py-4">User-Agent</th></tr></thead>
<tbody id="logsTable"><tr><td colspan="4" class="px-6 py-16 text-center text-zinc-500">Cargando...</td></tr></tbody></table>
</div>
</div>
</div>

<div id="page-edit" class="page hidden">
<div class="mb-10"><h2 class="text-3xl font-bold">Editar Scripts</h2><p class="text-zinc-400 mt-1">Reemplaza el código de un script</p></div>
<div class="glass rounded-3xl p-8 max-w-3xl">
<div class="mb-6"><label class="text-sm text-zinc-400 mb-2 block">Seleccionar Script</label>
<select id="editSelect" onchange="loadEditScript()" class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500"><option value="">-- Elige un script --</option></select></div>
<div class="mb-6"><label class="text-sm text-zinc-400 mb-2 block">Nuevo Nombre</label>
<input id="editName" type="text" class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500"></div>
<div class="mb-6"><label class="text-sm text-zinc-400 mb-2 block">Nuevo Código</label>
<textarea id="editCode" class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-4 h-64 font-mono text-sm outline-none focus:border-indigo-500 resize-none"></textarea></div>
<button id="editBtn" onclick="updateScript()" class="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 py-4 rounded-2xl font-semibold">💾 Guardar y Re-ofuscar</button>
</div>
</div>
</main>
</div>
</div>

<script>
let panelPass = localStorage.getItem('ikg_pass') || '';
let allScripts = [];
if (panelPass) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    loadScripts();
}
function login() {
    const pass = document.getElementById('passInput').value;
    if (!pass) return;
    fetch('/api/scripts', { headers: { 'x-panel-password': pass } })
    .then(r => {
        if (r.status === 401) return document.getElementById('loginError').classList.remove('hidden');
        panelPass = pass;
        localStorage.setItem('ikg_pass', pass);
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        loadScripts();
    });
}
function logout() { localStorage.removeItem('ikg_pass'); location.reload(); }
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-' + page).classList.remove('hidden');
    document.querySelectorAll('.sidebar-btn').forEach(b => { b.classList.remove('active'); b.classList.add('text-zinc-400'); });
    const active = document.getElementById('nav-' + page);
    if (active) { active.classList.add('active'); active.classList.remove('text-zinc-400'); }
    if (['scripts','edit','executions'].includes(page)) loadScripts();
    if (page === 'logs') loadLogs();
    if (page === 'executors') loadExecutorStats();
}
async function loadScripts() {
    try {
        const res = await fetch('/api/scripts', { headers: { 'x-panel-password': panelPass } });
        if (res.status === 401) return logout();
        allScripts = await res.json();
        renderScriptsList(allScripts);
        updateStats();
        const select = document.getElementById('editSelect');
        select.innerHTML = '<option value="">-- Elige --</option>' + allScripts.map(s => \`<option value="\${s.id}">\${escapeHtml(s.name||'Sin nombre')} (\${s.executions||0})</option>\`).join('');
    } catch { document.getElementById('scriptsList').innerHTML = '<p class="text-red-400 text-center py-20">Error</p>'; }
}
function renderScriptsList(scripts) {
    document.getElementById('scriptCount').innerText = scripts.length + ' scripts';
    const list = document.getElementById('scriptsList');
    if (!scripts.length) return list.innerHTML = '<p class="text-zinc-500 text-center py-20">No hay scripts</p>';
    list.innerHTML = scripts.map(s => {
        const ls = \`loadstring(game:HttpGet("\${location.origin}/api/script/\${s.id}"))()\`;
        return \`<div class="glass rounded-2xl p-6">
            <div class="flex justify-between mb-4"><div><div class="font-semibold text-indigo-300">\${escapeHtml(s.name||'Sin nombre')}</div>
            <div class="text-xs text-zinc-500 mt-1">ID: \${s.id} • <span class="text-emerald-400">\${s.executions||0} exec</span></div></div>
            <button onclick="deleteScript('\${s.id}')" class="text-xs text-red-400 px-3 py-1 rounded-xl bg-red-950/40">Borrar</button></div>
            <textarea readonly class="w-full bg-zinc-950/70 border border-zinc-800/50 rounded-xl p-3 text-xs font-mono text-zinc-400 h-16 resize-none">\${ls}</textarea>
            <button onclick="navigator.clipboard.writeText('\${ls}');this.innerText='¡Copiado!';setTimeout(()=>this.innerText='Copiar',1500)" class="mt-3 w-full bg-indigo-600 py-2 rounded-xl text-sm">Copiar Loadstring</button>
        </div>\`;
    }).join('');
}
function updateStats() {
    const total = allScripts.reduce((s,x) => s + (x.executions||0), 0);
    const max = Math.max(...allScripts.map(s => s.executions||0), 1);
    const top = allScripts.length ? [...allScripts].sort((a,b)=>(b.executions||0)-(a.executions||0))[0] : null;
    document.getElementById('statTotal').innerText = allScripts.length;
    document.getElementById('statExecutions').innerText = total.toLocaleString();
    document.getElementById('statTop').innerText = top ? (top.name||'Sin nombre') : '—';
    const tbody = document.getElementById('executionsTable');
    if (!allScripts.length) return tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-16 text-center text-zinc-500">No hay datos</td></tr>';
    const sorted = [...allScripts].sort((a,b)=>(b.executions||0)-(a.executions||0));
    tbody.innerHTML = sorted.map((s,i) => {
        const c = s.executions||0, p = Math.round(c/max*100);
        const m = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1);
        return \`<tr class="border-t border-white/5"><td class="px-6 py-5">\${m}</td><td class="px-6 py-5"><div class="text-indigo-300">\${escapeHtml(s.name||'Sin nombre')}</div></td>
        <td class="px-6 py-5 text-emerald-400 font-bold">\${c}</td><td class="px-6 py-5"><div class="w-full bg-zinc-800 rounded-full h-2.5"><div class="bar-fill h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full" style="width:\${p}%"></div></div></td></tr>\`;
    }).join('');
}
async function loadExecutorStats() {
    try {
        const res = await fetch('/api/executor-stats', { headers: { 'x-panel-password': panelPass } });
        const stats = await res.json();
        document.getElementById('execsCount').innerText = stats.length + ' únicos';
        const tbody = document.getElementById('executorsTable');
        if (!stats.length) return tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-16 text-center text-zinc-500">Sin datos</td></tr>';
        const max = Math.max(...stats.map(s=>s.count),1);
        tbody.innerHTML = stats.map((s,i) => {
            const p = Math.round(s.count/max*100);
            const m = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1);
            return \`<tr class="border-t border-white/5"><td class="px-6 py-5">\${m}</td><td class="px-6 py-5 text-indigo-300 font-semibold">\${escapeHtml(s.name)}</td>
            <td class="px-6 py-5"><span class="bg-zinc-800 px-3 py-1 rounded text-xs text-emerald-400">\${escapeHtml(s.version)}</span></td>
            <td class="px-6 py-5 text-emerald-400 font-bold">\${s.count}</td><td class="px-6 py-5"><div class="w-full bg-zinc-800 rounded-full h-2.5"><div class="bar-fill h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full" style="width:\${p}%"></div></div></td></tr>\`;
        }).join('');
    } catch {}
}
async function loadLogs() {
    try {
        const res = await fetch('/api/executions', { headers: { 'x-panel-password': panelPass } });
        const logs = await res.json();
        document.getElementById('logsCount').innerText = logs.length + ' registros';
        const tbody = document.getElementById('logsTable');
        if (!logs.length) return tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-16 text-center text-zinc-500">Nadie ha ejecutado aún</td></tr>';
        tbody.innerHTML = logs.map(l => {
            const d = new Date(l.createdAt).toLocaleString('es-ES');
            return \`<tr class="border-t border-white/5"><td class="px-6 py-4 text-sm text-zinc-400">\${d}</td>
            <td class="px-6 py-4"><div class="text-indigo-300">\${escapeHtml(l.scriptName||'Sin nombre')}</div></td>
            <td class="px-6 py-4 font-mono text-emerald-400">\${l.ip||'???'}</td>
            <td class="px-6 py-4 text-xs text-zinc-400 truncate max-w-xs">\${escapeHtml((l.userAgent||'').slice(0,60))}</td></tr>\`;
        }).join('');
    } catch {}
}
async function clearLogs() {
    if (!confirm('¿Borrar todo el historial?')) return;
    await fetch('/api/executions', { method: 'DELETE', headers: { 'x-panel-password': panelPass } });
    loadLogs();
}
async function testWebhook() {
    const res = await fetch('/api/test-webhook', { method: 'POST', headers: { 'x-panel-password': panelPass } });
    const data = await res.json();
    alert(data.success ? '¡Enviado a Discord!' : 'Error');
}
function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t||''; return d.innerHTML; }
async function pasteCode() {
    try { const t = await navigator.clipboard.readText(); if (t) document.getElementById('scriptCode').value = t; }
    catch { alert('Ctrl+V en el cuadro'); }
}
function copyResult() {
    const v = document.getElementById('resultOutput').value;
    if (!v) return alert('No hay loadstring');
    navigator.clipboard.writeText(v); alert('¡Copiado!');
}
async function saveScript() {
    const name = document.getElementById('scriptName').value.trim();
    const code = document.getElementById('scriptCode').value;
    if (!code) return alert('Pega el código');
    const btn = document.getElementById('saveBtn');
    btn.innerText = 'Ofuscando...'; btn.disabled = true;
    try {
        const res = await fetch('/api/script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-panel-password': panelPass },
            body: JSON.stringify({ name, code })
        });
        const data = await res.json();
        if (data.id) {
            document.getElementById('resultOutput').value = \`loadstring(game:HttpGet("\${location.origin}/api/script/\${data.id}"))()\`;
            document.getElementById('scriptCode').value = '';
            document.getElementById('scriptName').value = '';
            btn.innerText = '¡Listo!';
            setTimeout(() => { btn.innerText = '🔒 Ofuscar y Guardar'; btn.disabled = false; }, 1500);
            loadScripts();
        } else { alert(data.error||'Error'); btn.innerText = '🔒 Ofuscar y Guardar'; btn.disabled = false; }
    } catch { alert('Error de conexión'); btn.innerText = '🔒 Ofuscar y Guardar'; btn.disabled = false; }
}
async function loadEditScript() {
    const id = document.getElementById('editSelect').value;
    if (!id) return;
    const res = await fetch('/api/script/' + id + '/raw', { headers: { 'x-panel-password': panelPass } });
    const s = await res.json();
    if (s) { document.getElementById('editName').value = s.name||''; document.getElementById('editCode').value = s.rawCode||''; }
}
async function updateScript() {
    const id = document.getElementById('editSelect').value;
    const name = document.getElementById('editName').value.trim();
    const code = document.getElementById('editCode').value;
    if (!id || !code) return alert('Completa los campos');
    const btn = document.getElementById('editBtn');
    btn.innerText = 'Guardando...'; btn.disabled = true;
    try {
        const res = await fetch('/api/script/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-panel-password': panelPass },
            body: JSON.stringify({ name, code })
        });
        const data = await res.json();
        if (data.success) {
            btn.innerText = '¡Actualizado!';
            setTimeout(() => { btn.innerText = '💾 Guardar y Re-ofuscar'; btn.disabled = false; }, 1500);
            loadScripts();
        } else { alert('Error'); btn.innerText = '💾 Guardar y Re-ofuscar'; btn.disabled = false; }
    } catch { alert('Error'); btn.innerText = '💾 Guardar y Re-ofuscar'; btn.disabled = false; }
}
async function deleteScript(id) {
    if (!confirm('¿Borrar este script?')) return;
    await fetch('/api/script/' + id, { method: 'DELETE', headers: { 'x-panel-password': panelPass } });
    loadScripts();
}
</script>
</body>
</html>`);
});

app.listen(PORT, () => console.log("🚀 Servidor en puerto", PORT));
