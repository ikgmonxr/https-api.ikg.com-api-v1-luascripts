const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
app.set('trust proxy', 1);

// ====================== CONFIGURACIÓN ======================
const PANEL_PASSWORD = "CambiaЭтаContraseña123!"; // ← CAMBIA ESTA
// La webhook se protege mediante variable de entorno (o usa la tuya por defecto si no está definida)
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || "https://discord.com/api/webhooks/1536109822188191746/n-sh2GrGqp1zCTVBoYPzVacaRaCoAsXPyvj4zhVorTGbloeqwu5dSIOuK9SQhf4wCIiv";
const PORT = process.env.PORT || 3000;

// ====================== SEGURIDAD ======================
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// ====================== BASE DE DATOS ======================
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

// ====================== DISCORD LOGGER ======================
async function sendDiscordLog(title, description, color = 0x5865F2) {
    try {
        await fetch(DISCORD_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: title,
                    description: description,
                    color: color,
                    timestamp: new Date().toISOString(),
                    footer: { text: "Ikgonavi Hub Pro • Logs" }
                }]
            })
        });
    } catch (err) {
        console.error("Error Discord:", err.message);
    }
}

// ====================== OFUSCADOR ======================
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

// ====================== RUTAS API ======================

app.get('/api/scripts', requireAuth, async (req, res) => {
    try {
        const scripts = await ScriptModel.find({}, { rawCode: 0 });
        res.json(scripts);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener scripts' });
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
        sendDiscordLog("📜 Script Creado", `Se ha creado y ofuscado el script: **${name || 'Sin nombre'}**`, 0x10B981);
        res.json({ id: newScript.id });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar script' });
    }
});

app.get('/api/script/:id/raw', requireAuth, async (req, res) => {
    try {
        const script = await ScriptModel.findOne({ id: req.params.id });
        if (!script) return res.status(404).json({ error: 'No encontrado' });
        res.json(script);
    } catch (err) {
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

        await sendDiscordLog("🔄 Script actualizado !", `El script **${script.name}** (\`${script.id}\`) ha sido modificado y re-ofuscado correctamente.`, 0xF59E0B);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

app.delete('/api/script/:id', requireAuth, async (req, res) => {
    try {
        const script = await ScriptModel.findOneAndDelete({ id: req.params.id });
        if (script) {
            sendDiscordLog("🗑️ Script Borrado", `Se eliminó el script: **${script.name}**`, 0xEF4444);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error al borrar' });
    }
});

app.get('/api/script/:id', async (req, res) => {
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

        res.send(script.code);
    } catch (err) {
        res.status(500).send('-- Error interno');
    }
});

app.get('/api/executions', requireAuth, async (req, res) => {
    try {
        const logs = await ExecutionModel.find().sort({ createdAt: -1 }).limit(100);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Error' });
    }
});

app.delete('/api/executions', requireAuth, async (req, res) => {
    try {
        await ExecutionModel.deleteMany({});
        res.json({ success: true });
    } catch (err) {
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
    } catch (err) {
        res.status(500).json({ error: 'Error' });
    }
});

app.post('/api/test-webhook', requireAuth, async (req, res) => {
    await sendDiscordLog("🔔 Prueba de Webhook", "¡El sistema de notificaciones de Ikgonavi Hub Pro funciona correctamente!", 0x3B82F6);
    res.json({ success: true });
});

// ====================== PANEL HTML ======================
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
body { font-family: 'Inter', sans-serif; background: #0b0c10; color: #e2e8f0; }
.glass { background: rgba(17, 19, 28, 0.85); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.06); }
.sidebar-btn { transition: all 0.2s; }
.sidebar-btn:hover { background: rgba(99, 102, 241, 0.1); }
.sidebar-btn.active { background: rgba(99, 102, 241, 0.2); color: #a5b4fc; }
.bar-fill { transition: width 0.8s ease; }
</style>
</head>
<body class="min-h-screen">

<!-- LOGIN -->
<div id="loginScreen" class="min-h-screen flex items-center justify-center p-4">
<div class="glass w-full max-w-md p-10 rounded-3xl shadow-2xl">
<div class="text-center mb-10">
<div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5 shadow-lg shadow-indigo-500/30">⚡</div>
<h1 class="text-2xl font-bold tracking-tight">Ikgonavi Hub Pro</h1>
<p class="text-indigo-400 text-sm mt-2">Panel de Control Avanzado</p>
</div>
<input type="password" id="passInput" placeholder="Contraseña del panel" class="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-2xl px-5 py-4 mb-5 outline-none focus:border-indigo-500 transition">
<button onclick="login()" class="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 py-4 rounded-2xl font-semibold transition shadow-lg shadow-indigo-600/20">Entrar al Panel</button>
<p id="loginError" class="text-red-400 text-sm text-center mt-5 hidden">Contraseña incorrecta</p>
</div>
</div>

<!-- DASHBOARD -->
<div id="dashboard" class="hidden min-h-screen">
<div class="flex">
<aside class="w-72 glass min-h-screen p-6 flex flex-col fixed left-0 top-0 border-r border-white/5">
<div class="flex items-center gap-3 mb-12 px-2">
<div class="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-indigo-500/20">⚡</div>
<div>
<div class="font-bold text-sm tracking-tight">Ikgonavi Hub</div>
<div class="text-xs text-indigo-400">Pro Panel</div>
</div>
</div>

<nav class="flex flex-col gap-1.5 flex-1">
<button onclick="showPage('obfuscator')" id="nav-obfuscator" class="sidebar-btn active flex items-center gap-3 px-4 py-3.5 rounded-xl text-left text-sm font-medium">
<span class="text-lg">🔒</span> Ofuscador
</button>
<button onclick="showPage('scripts')" id="nav-scripts" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-left text-sm font-medium text-zinc-400">
<span class="text-lg">📜</span> Scripts
</button>
<button onclick="showPage('executions')" id="nav-executions" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-left text-sm font-medium text-zinc-400">
<span class="text-lg">📊</span> Ejecuciones
</button>
<button onclick="showPage('executors')" id="nav-executors" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-left text-sm font-medium text-zinc-400">
<span class="text-lg">🤖</span> Execs Ranking
</button>
<button onclick="showPage('logs')" id="nav-logs" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-left text-sm font-medium text-zinc-400">
<span class="text-lg">👁️</span> Quién Ejecuta
</button>
<button onclick="showPage('edit')" id="nav-edit" class="sidebar-btn flex items-center gap-3 px-4 py-3.5 rounded-xl text-left text-sm font-medium text-zinc-400">
<span class="text-lg">✏️</span> Editar Scripts
</button>
</nav>

<div class="pt-4 border-t border-white/5 mt-auto flex flex-col gap-2">
<button onclick="testWebhook()" class="flex items-center gap-3 px-4 py-3 rounded-xl text-xs text-indigo-300 bg-indigo-950/30 hover:bg-indigo-900/40 transition">
<span>🔔</span> Test Webhook Discord
</button>
<button onclick="logout()" class="flex items-center gap-3 px-4 py-3 rounded-xl text-xs text-red-400 hover:bg-red-950/30 transition">
<span>🚪</span> Cerrar Sesión
</button>
</div>
</aside>

<main class="ml-72 flex-1 p-10">

<!-- OFUSCADOR -->
<div id="page-obfuscator" class="page">
<div class="mb-10">
<h2 class="text-3xl font-bold tracking-tight">Ofuscador</h2>
<p class="text-zinc-400 mt-1">Pega tu código Lua y ofúscalo automáticamente</p>
</div>
<div class="glass rounded-3xl p-8 max-w-3xl">
<div class="mb-6">
<label class="text-sm text-zinc-400 mb-2 block font-medium">Nombre del Script</label>
<input id="scriptName" type="text" placeholder="Ej: Silent Aim, ESP..." class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500 transition">
</div>
<div class="mb-6">
<div class="flex justify-between items-center mb-2">
<label class="text-sm text-zinc-400 font-medium">Código Lua</label>
<button onclick="pasteCode()" class="text-xs text-indigo-400 hover:text-indigo-300 font-medium">📋 Pegar</button>
</div>
<textarea id="scriptCode" placeholder="Pega aquí tu código..." class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-4 h-64 font-mono text-sm outline-none focus:border-indigo-500 transition resize-none"></textarea>
</div>
<button id="saveBtn" onclick="saveScript()" class="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 py-4 rounded-2xl font-semibold transition shadow-lg shadow-indigo-600/20">🔒 Ofuscar y Guardar</button>
<div class="mt-8">
<div class="flex justify-between items-center mb-2">
<label class="text-sm text-zinc-400 font-medium">Loadstring generado</label>
<button onclick="copyResult()" class="text-xs text-indigo-400 hover:text-indigo-300 font-medium">Copiar</button>
</div>
<textarea id="resultOutput" readonly placeholder="El loadstring aparecerá aquí..." class="w-full bg-zinc-950/80 border border-zinc-800/50 rounded-2xl px-5 py-4 h-24 font-mono text-xs text-emerald-400 outline-none resize-none"></textarea>
</div>
</div>
</div>

<!-- SCRIPTS -->
<div id="page-scripts" class="page hidden">
<div class="flex justify-between items-end mb-10">
<div>
<h2 class="text-3xl font-bold tracking-tight">Scripts</h2>
<p class="text-zinc-400 mt-1">Todos tus scripts ofuscados</p>
</div>
<div class="flex gap-4 items-center">
<input type="text" id="scriptSearch" oninput="filterScripts()" placeholder="🔍 Buscar script..." class="bg-zinc-900/60 border border-zinc-700/40 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500 transition">
<span id="scriptCount" class="bg-indigo-950/60 text-indigo-300 text-sm px-5 py-2 rounded-full border border-indigo-800/40 font-medium">0 scripts</span>
</div>
</div>
<div id="scriptsList" class="grid gap-5"><p class="text-zinc-500 text-center py-20">Cargando...</p></div>
</div>

<!-- EJECUCIONES -->
<div id="page-executions" class="page hidden">
<div class="flex justify-between items-end mb-10">
<div>
<h2 class="text-3xl font-bold tracking-tight">📊 Ejecuciones de Scripts</h2>
<p class="text-zinc-400 mt-1">Estadísticas y ranking de tus scripts</p>
</div>
<button onclick="loadScripts()" class="text-sm bg-zinc-800/80 hover:bg-zinc-700 px-5 py-2.5 rounded-xl font-medium transition">🔄 Actualizar</button>
</div>

<div id="statsCards" class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
<div class="glass rounded-2xl p-6">
<div class="text-zinc-400 text-sm font-medium mb-1">Total de Scripts</div>
<div id="statTotal" class="text-3xl font-bold">0</div>
</div>
<div class="glass rounded-2xl p-6">
<div class="text-zinc-400 text-sm font-medium mb-1">Ejecuciones Totales</div>
<div id="statExecutions" class="text-3xl font-bold text-emerald-400">0</div>
</div>
<div class="glass rounded-2xl p-6">
<div class="text-zinc-400 text-sm font-medium mb-1">Más Popular</div>
<div id="statTop" class="text-xl font-bold text-indigo-300 truncate">—</div>
</div>
</div>

<div class="glass rounded-3xl overflow-hidden">
<div class="px-6 py-5 border-b border-white/5">
<h3 class="font-semibold text-lg">Ranking de Scripts</h3>
</div>
<div class="overflow-x-auto">
<table class="w-full">
<thead>
<tr class="text-left text-xs text-zinc-500 uppercase tracking-wider">
<th class="px-6 py-4 font-medium">#</th>
<th class="px-6 py-4 font-medium">Script</th>
<th class="px-6 py-4 font-medium">Ejecuciones</th>
<th class="px-6 py-4 font-medium w-1/3">Progreso</th>
</tr>
</thead>
<tbody id="executionsTable">
<tr><td colspan="4" class="px-6 py-16 text-center text-zinc-500">Cargando...</td></tr>
</tbody>
</table>
</div>
</div>
</div>

<!-- EXECUTORS RANKINGS -->
<div id="page-executors" class="page hidden">
<div class="flex justify-between items-end mb-10">
<div>
<h2 class="text-3xl font-bold tracking-tight">🤖 Ejecutores más Usados</h2>
<p class="text-zinc-400 mt-1">Ranking y versiones de los ejecutores de Roblox detectados</p>
</div>
<button onclick="loadExecutorStats()" class="text-sm bg-zinc-800/80 hover:bg-zinc-700 px-5 py-2.5 rounded-xl font-medium transition">🔄 Actualizar</button>
</div>

<div class="glass rounded-3xl overflow-hidden">
<div class="px-6 py-5 border-b border-white/5 flex justify-between items-center">
<h3 class="font-semibold text-lg">Ranking de Execs & Versiones</h3>
<span id="execsCount" class="text-sm text-zinc-400">0 ejecutores únicos</span>
</div>
<div class="overflow-x-auto">
<table class="w-full">
<thead>
<tr class="text-left text-xs text-zinc-500 uppercase tracking-wider">
<th class="px-6 py-4 font-medium">#</th>
<th class="px-6 py-4 font-medium">Ejecutor</th>
<th class="px-6 py-4 font-medium">Versión Detectada</th>
<th class="px-6 py-4 font-medium">Total Usos</th>
<th class="px-6 py-4 font-medium w-1/4">Popularidad</th>
</tr>
</thead>
<tbody id="executorsTable">
<tr><td colspan="5" class="px-6 py-16 text-center text-zinc-500">Cargando estadísticas...</td></tr>
</tbody>
</table>
</div>
</div>
</div>

<!-- QUIÉN EJECUTA -->
<div id="page-logs" class="page hidden">
<div class="flex justify-between items-end mb-10">
<div>
<h2 class="text-3xl font-bold tracking-tight">👁️ Quién Ejecuta</h2>
<p class="text-zinc-400 mt-1">Historial detallado de las personas que usan tus scripts</p>
</div>
<div class="flex gap-3">
<button onclick="loadLogs()" class="text-sm bg-zinc-800/80 hover:bg-zinc-700 px-5 py-2.5 rounded-xl font-medium transition">🔄 Actualizar</button>
<button onclick="clearLogs()" class="text-sm bg-red-950/50 hover:bg-red-900/50 text-red-300 px-5 py-2.5 rounded-xl font-medium transition">🗑️ Limpiar Historial</button>
</div>
</div>

<div class="glass rounded-3xl overflow-hidden">
<div class="px-6 py-5 border-b border-white/5 flex justify-between items-center">
<h3 class="font-semibold text-lg">Últimas Ejecuciones</h3>
<span id="logsCount" class="text-sm text-zinc-400">0 registros</span>
</div>
<div class="overflow-x-auto max-h-[600px] overflow-y-auto">
<table class="w-full">
<thead class="sticky top-0 bg-[#11131c]">
<tr class="text-left text-xs text-zinc-500 uppercase tracking-wider">
<th class="px-6 py-4 font-medium">Fecha</th>
<th class="px-6 py-4 font-medium">Script</th>
<th class="px-6 py-4 font-medium">IP</th>
<th class="px-6 py-4 font-medium">User-Agent / Executor</th>
</tr>
</thead>
<tbody id="logsTable">
<tr><td colspan="4" class="px-6 py-16 text-center text-zinc-500">Cargando historial...</td></tr>
</tbody>
</table>
</div>
</div>
</div>

<!-- EDITAR -->
<div id="page-edit" class="page hidden">
<div class="mb-10">
<h2 class="text-3xl font-bold tracking-tight">Editar Scripts</h2>
<p class="text-zinc-400 mt-1">Selecciona un script para ver su código actual y reemplazarlo</p>
</div>
<div class="glass rounded-3xl p-8 max-w-3xl">
<div class="mb-6">
<label class="text-sm text-zinc-400 mb-2 block font-medium">Seleccionar Script</label>
<select id="editSelect" onchange="loadEditScript()" class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500 transition">
<option value="">-- Elige un script --</option>
</select>
</div>
<div class="mb-6">
<label class="text-sm text-zinc-400 mb-2 block font-medium">Nuevo Nombre</label>
<input id="editName" type="text" class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500 transition">
</div>
<div class="mb-6">
<label class="text-sm text-zinc-400 mb-2 block font-medium">Código Lua Actual / Nuevo</label>
<textarea id="editCode" placeholder="Selecciona un script arriba para cargar su código..." class="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-2xl px-5 py-4 h-64 font-mono text-sm outline-none focus:border-indigo-500 transition resize-none"></textarea>
</div>
<button id="editBtn" onclick="updateScript()" class="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 py-4 rounded-2xl font-semibold transition shadow-lg shadow-indigo-600/20">💾 Guardar y Re-ofuscar</button>
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
        if (r.status === 401) {
            document.getElementById('loginError').classList.remove('hidden');
            return;
        }
        panelPass = pass;
        localStorage.setItem('ikg_pass', pass);
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        loadScripts();
    });
}

function logout() {
    localStorage.removeItem('ikg_pass');
    location.reload();
}

function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-' + page).classList.remove('hidden');

    document.querySelectorAll('.sidebar-btn').forEach(b => {
        b.classList.remove('active');
        b.classList.add('text-zinc-400');
    });
    const active = document.getElementById('nav-' + page);
    if (active) {
        active.classList.add('active');
        active.classList.remove('text-zinc-400');
    }

    if (page === 'scripts' || page === 'edit' || page === 'executions') loadScripts();
    if (page === 'logs') loadLogs();
    if (page === 'executors') loadExecutorStats();
}

async function loadScripts() {
    try {
        const res = await fetch('/api/scripts', { headers: { 'x-panel-password': panelPass } });
        if (res.status === 401) return logout();
        allScripts = await res.json();

        renderScriptsList(allScripts);
        updateStatsAndRanking();

        const select = document.getElementById('editSelect');
        select.innerHTML = '<option value="">-- Elige un script --</option>' + 
            allScripts.map(s => '<option value="' + s.id + '">' + escapeHtml(s.name || 'Sin nombre') + ' (' + (s.executions||0) + ')</option>').join('');
    } catch {
        document.getElementById('scriptsList').innerHTML = '<p class="text-red-400 text-center py-20">Error al cargar</p>';
    }
}

function renderScriptsList(scripts) {
    document.getElementById('scriptCount').innerText = scripts.length + ' scripts';
    const list = document.getElementById('scriptsList');
    if (scripts.length === 0) {
        list.innerHTML = '<p class="text-zinc-500 text-center py-20">No hay scripts todavía</p>';
        return;
    }
    list.innerHTML = scripts.map(s => {
        const ls = \`loadstring(game:HttpGet("\${location.origin}/api/script/\${s.id}"))()\`;
        return \`
        <div class="glass rounded-2xl p-6 hover:border-indigo-500/20 transition">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <div class="font-semibold text-lg text-indigo-300">\${escapeHtml(s.name || 'Sin nombre')}</div>
                    <div class="text-xs text-zinc-500 mt-1.5">ID: \${s.id} • <span class="text-emerald-400">\${s.executions || 0} ejecuciones</span></div>
                </div>
                <button onclick="deleteScript('\${s.id}')" class="text-xs text-red-400 hover:text-red-300 px-3.5 py-1.5 rounded-xl bg-red-950/40 transition">Borrar</button>
            </div>
            <textarea readonly class="w-full bg-zinc-950/70 border border-zinc-800/50 rounded-xl p-3.5 text-xs font-mono text-zinc-400 h-16 resize-none">\${ls}</textarea>
            <button onclick="navigator.clipboard.writeText('\${ls}'); this.innerText='¡Copiado!'; setTimeout(()=>this.innerText='Copiar Loadstring',1500)" class="mt-4 w-full bg-indigo-600/90 hover:bg-indigo-500 py-2.5 rounded-xl text-sm font-medium transition">Copiar Loadstring</button>
        </div>\`;
    }).join('');
}

function filterScripts() {
    const q = document.getElementById('scriptSearch').value.toLowerCase();
    const filtered = allScripts.filter(s => (s.name || '').toLowerCase().includes(q) || s.id.includes(q));
    renderScriptsList(filtered);
}

function updateStatsAndRanking() {
    const totalExec = allScripts.reduce((sum, s) => sum + (s.executions || 0), 0);
    const maxExec = Math.max(...allScripts.map(s => s.executions || 0), 1);
    const topScript = allScripts.length ? [...allScripts].sort((a,b) => (b.executions||0)-(a.executions||0))[0] : null;

    document.getElementById('statTotal').innerText = allScripts.length;
    document.getElementById('statExecutions').innerText = totalExec.toLocaleString();
    document.getElementById('statTop').innerText = topScript ? (topScript.name || 'Sin nombre') : '—';

    const tbody = document.getElementById('executionsTable');
    if (allScripts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-16 text-center text-zinc-500">No hay scripts</td></tr>';
        return;
    }
    const sorted = [...allScripts].sort((a, b) => (b.executions || 0) - (a.executions || 0));
    tbody.innerHTML = sorted.map((s, i) => {
        const count = s.executions || 0;
        const percent = Math.round((count / maxExec) * 100);
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
        return \`
        <tr class="border-t border-white/5 hover:bg-white/[0.02]">
            <td class="px-6 py-5 text-lg">\${medal}</td>
            <td class="px-6 py-5">
                <div class="font-medium text-indigo-300">\${escapeHtml(s.name || 'Sin nombre')}</div>
                <div class="text-xs text-zinc-500 mt-0.5">\${s.id.slice(0,14)}...</div>
            </td>
            <td class="px-6 py-5"><span class="text-xl font-bold text-emerald-400">\${count}</span></td>
            <td class="px-6 py-5">
                <div class="w-full bg-zinc-800/60 rounded-full h-2.5 overflow-hidden">
                    <div class="bar-fill h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full" style="width:\${percent}%"></div>
                </div>
                <div class="text-xs text-zinc-500 mt-1.5">\${percent}%</div>
            </td>
        </tr>\`;
    }).join('');
}

async function loadExecutorStats() {
    try {
        const res = await fetch('/api/executor-stats', { headers: { 'x-panel-password': panelPass } });
        if (res.status === 401) return logout();
        const stats = await res.json();

        document.getElementById('execsCount').innerText = stats.length + ' ejecutores únicos';
        const tbody = document.getElementById('executorsTable');
        if (stats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-16 text-center text-zinc-500">No hay datos de ejecutores todavía</td></tr>';
            return;
        }

        const maxCount = Math.max(...stats.map(s => s.count), 1);
        tbody.innerHTML = stats.map((s, i) => {
            const percent = Math.round((s.count / maxCount) * 100);
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
            return \`
            <tr class="border-t border-white/5 hover:bg-white/[0.02]">
                <td class="px-6 py-5 text-lg">\${medal}</td>
                <td class="px-6 py-5 font-semibold text-indigo-300">\${escapeHtml(s.name)}</td>
                <td class="px-6 py-5"><span class="bg-zinc-800/80 px-3 py-1 rounded-lg text-xs font-mono text-emerald-400">\${escapeHtml(s.version)}</span></td>
                <td class="px-6 py-5 font-bold text-emerald-400">\${s.count}</td>
                <td class="px-6 py-5">
                    <div class="w-full bg-zinc-800/60 rounded-full h-2.5 overflow-hidden">
                        <div class="bar-fill h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full" style="width:\${percent}%"></div>
                    </div>
                    <div class="text-xs text-zinc-500 mt-1">\${percent}%</div>
                </td>
            </tr>\`;
        }).join('');
    } catch {
        document.getElementById('executorsTable').innerHTML = '<tr><td colspan="5" class="px-6 py-16 text-center text-red-400">Error al cargar estadísticas</td></tr>';
    }
}

async function loadLogs() {
    try {
        const res = await fetch('/api/executions', { headers: { 'x-panel-password': panelPass } });
        if (res.status === 401) return logout();
        const logs = await res.json();

        document.getElementById('logsCount').innerText = logs.length + ' registros';
        const tbody = document.getElementById('logsTable');
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-16 text-center text-zinc-500">Nadie ha ejecutado scripts todavía</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(log => {
            const date = new Date(log.createdAt).toLocaleString('es-ES', { 
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
            const ua = (log.userAgent || 'Desconocido').slice(0, 70);
            return \`
            <tr class="border-t border-white/5 hover:bg-white/[0.02]">
                <td class="px-6 py-4 text-sm text-zinc-400 whitespace-nowrap">\${date}</td>
                <td class="px-6 py-4">
                    <div class="font-medium text-indigo-300">\${escapeHtml(log.scriptName || 'Sin nombre')}</div>
                    <div class="text-xs text-zinc-500">\${log.scriptId?.slice(0,12) || ''}...</div>
                </td>
                <td class="px-6 py-4 font-mono text-sm text-emerald-400">\${log.ip || '???'}</td>
                <td class="px-6 py-4 text-xs text-zinc-400 max-w-xs truncate" title="\${escapeHtml(log.userAgent || '')}">\${escapeHtml(ua)}</td>
            </tr>\`;
        }).join('');
    } catch {
        document.getElementById('logsTable').innerHTML = '<tr><td colspan="4" class="px-6 py-16 text-center text-red-400">Error al cargar</td></tr>';
    }
}

async function clearLogs() {
    if (!confirm('¿Borrar TODO el historial de ejecuciones?')) return;
    await fetch('/api/executions', {
        method: 'DELETE',
        headers: { 'x-panel-password': panelPass }
    });
    loadLogs();
}

async function testWebhook() {
    try {
        const res = await fetch('/api/test-webhook', {
            method: 'POST',
            headers: { 'x-panel-password': panelPass }
        });
        const data = await res.json();
        if (data.success) alert('¡Mensaje de prueba enviado a Discord con éxito!');
        else alert('Error al enviar notificación');
    } catch {
        alert('Error de conexión');
    }
}

function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t || '';
    return d.innerHTML;
}

async function pasteCode() {
    try {
        const text = await navigator.clipboard.readText();
        if (text) document.getElementById('scriptCode').value = text;
    } catch {
        alert('Haz clic en el cuadro y presiona Ctrl+V');
    }
}

function copyResult() {
    const val = document.getElementById('resultOutput').value;
    if (!val) return alert('No hay loadstring');
    navigator.clipboard.writeText(val);
    alert('¡Copiado!');
}

async function saveScript() {
    const name = document.getElementById('scriptName').value.trim();
    const code = document.getElementById('scriptCode').value;
    if (!code) return alert('Pega el código primero');

    const btn = document.getElementById('saveBtn');
    btn.innerText = 'Ofuscando...';
    btn.disabled = true;

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
            setTimeout(() => {
                btn.innerText = '🔒 Ofuscar y Guardar';
                btn.disabled = false;
            }, 1800);
            loadScripts();
        } else {
            alert(data.error || 'Error');
            btn.innerText = '🔒 Ofuscar y Guardar';
            btn.disabled = false;
        }
    } catch {
        alert('Error de conexión');
        btn.innerText = '🔒 Ofuscar y Guardar';
        btn.disabled = false;
    }
}

async function loadEditScript() {
    const id = document.getElementById('editSelect').value;
    if (!id) {
        document.getElementById('editName').value = '';
        document.getElementById('editCode').value = '';
        return;
    }
    try {
        const res = await fetch('/api/script/' + id + '/raw', { headers: { 'x-panel-password': panelPass } });
        const script = await res.json();
        if (script) {
            document.getElementById('editName').value = script.name || '';
            document.getElementById('editCode').value = script.rawCode || '';
        }
    } catch {
        alert('Error al cargar script para editar');
    }
}

async function updateScript() {
    const id = document.getElementById('editSelect').value;
    const name = document.getElementById('editName').value.trim();
    const code = document.getElementById('editCode').value;
    if (!id) return alert('Selecciona un script');
    if (!code) return alert('Pega el nuevo código');

    const btn = document.getElementById('editBtn');
    btn.innerText = 'Actualizando...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/script/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-panel-password': panelPass },
            body: JSON.stringify({ name, code })
        });
        const data = await res.json();
        if (data.success) {
            btn.innerText = '¡Actualizado!';
            setTimeout(() => {
                btn.innerText = '💾 Guardar y Re-ofuscar';
                btn.disabled = false;
            }, 1500);
            loadScripts();
        } else {
            alert('Error al actualizar');
            btn.innerText = '💾 Guardar y Re-ofuscar';
            btn.disabled = false;
        }
    } catch {
        alert('Error de conexión');
        btn.innerText = '💾 Guardar y Re-ofuscar';
        btn.disabled = false;
    }
}

async function deleteScript(id) {
    if (!confirm('¿Borrar este script?')) return;
    await fetch('/api/script/' + id, {
        method: 'DELETE',
        headers: { 'x-panel-password': panelPass }
    });
    loadScripts();
}
</script>
</body>
</html>
    `);
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
