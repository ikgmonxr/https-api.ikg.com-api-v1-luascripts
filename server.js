const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
app.set('trust proxy', 1);

// ====================== CONFIGURACIÓN ======================
const PANEL_PASSWORD = "CambiaEstaContraseña123!"; // ← CAMBIA ESTA CONTRASEÑA
const PORT = process.env.PORT || 3000;

// ====================== SEGURIDAD ======================
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(cors({ origin: false }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    message: '🚫 Demasiadas peticiones.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

const scriptLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 8,
    message: '-- Rate limit exceeded',
});

// ====================== BASE DE DATOS ======================
mongoose.connect(process.env.MONGO_URI || "mongodb+srv://yarishdz2_db_user:7cp3VZH9aXK77wX@ikgmxer.8tj7kfa.mongodb.net/hubsilent?appName=ikgmxer")
    .then(() => console.log("🔥 Ikgonavi Hub Pro - Blindado Activo"))
    .catch((err) => console.error("❌ Error DB:", err));

const scriptSchema = new mongoose.Schema({
    id: { type: String, default: () => crypto.randomBytes(16).toString('hex') },
    name: String,
    code: String,
    createdAt: { type: Date, default: Date.now }
});

const ScriptModel = mongoose.model('HubScript', scriptSchema);

// ====================== OFUSCADOR ======================
function strongObfuscate(rawCode) {
    const encoded = Buffer.from(rawCode, 'utf8').toString('base64');
    const v = () => '_' + crypto.randomBytes(4).toString('hex');

    const vars = {
        data: v(),
        decode: v(),
        result: v(),
        temp1: v(),
        temp2: v(),
        junk1: v(),
        junk2: v()
    };

    let junk = "";
    for (let i = 0; i < 40; i++) {
        junk += `local ${v()} = "${crypto.randomBytes(8).toString('hex')}"\n`;
    }

    return `
-- [IKGONAVI HUB PRO - STRONG PROTECTION]
${junk}

local ${vars.data} = "${encoded}"

local function ${vars.decode}(data)
    if type(base64_decode) == "function" then return base64_decode(data) end
    if crypt and crypt.base64 and crypt.base64.decode then return crypt.base64.decode(data) end
    if syn and syn.crypt and syn.crypt.base64 and syn.crypt.base64.decode then return syn.crypt.base64.decode(data) end
    if fluxus and fluxus.crypt and fluxus.crypt.base64decode then return fluxus.crypt.base64decode(data) end

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

local ${vars.result} = ${vars.decode}(${vars.data})
local ${vars.temp1}, ${vars.temp2} = pcall(loadstring, ${vars.result})
if ${vars.temp1} and ${vars.temp2} then
    ${vars.temp2}()
else
    error("Failed to load protected script")
end
`.trim();
}

// ====================== AUTH ======================
function requirePanelAuth(req, res, next) {
    const password = req.headers['x-panel-password'] || req.body?.password;
    if (password !== PANEL_PASSWORD) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    next();
}

// ====================== RUTAS ======================

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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #090a0f; color: #f3f4f6; }
        .glass { background: rgba(18, 20, 32, 0.75); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.08); }
        .glow { box-shadow: 0 0 25px -5px rgba(88, 101, 242, 0.35); }
    </style>
</head>
<body class="min-h-screen flex flex-col items-center p-4 md:p-8">

    <div id="loginScreen" class="w-full max-w-md glass p-8 rounded-2xl glow mt-20">
        <h1 class="text-xl font-bold text-center mb-2">⚡ Ikgonavi Hub Pro</h1>
        <p class="text-center text-indigo-400 text-sm mb-6">Panel Blindado</p>
        <input type="password" id="panelPassword" placeholder="Contraseña del panel" 
               class="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm mb-4 outline-none focus:border-indigo-500">
        <button onclick="login()" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl">
            Entrar
        </button>
        <p id="loginError" class="text-red-400 text-xs text-center mt-3 hidden">Contraseña incorrecta</p>
    </div>

    <div id="mainPanel" class="hidden w-full max-w-5xl">
        <header class="w-full flex justify-between items-center mb-8 glass p-5 rounded-2xl glow">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-xl">⚡</div>
                <div>
                    <h1 class="font-bold text-lg">Ikgonavi Hub Pro</h1>
                    <p class="text-xs text-indigo-400">Protección Avanzada</p>
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="wipeAll()" class="text-xs bg-red-950/80 hover:bg-red-900 text-red-300 px-3 py-2 rounded-xl border border-red-800/50">🗑️ Borrar Todo</button>
                <button onclick="logout()" class="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-xl">Salir</button>
            </div>
        </header>

        <main class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="md:col-span-1 glass p-6 rounded-2xl flex flex-col gap-4 h-fit">
                <h2 id="panelTitle" class="font-bold text-base text-indigo-300">Nuevo Script</h2>
                <input type="text" id="scriptName" placeholder="Nombre del Script" class="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm outline-none focus:border-indigo-500">
                <div class="flex justify-between items-center">
                    <label class="text-[11px] text-zinc-400">Código Lua:</label>
                    <button onclick="pasteLargeCode()" class="text-[11px] bg-indigo-950 hover:bg-indigo-900 text-indigo-300 px-2.5 py-1 rounded-lg">📋 Pegar</button>
                </div>
                <textarea id="scriptCode" spellcheck="false" placeholder="Pega tu código aquí..." class="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-indigo-300 font-mono h-52 resize-none outline-none focus:border-indigo-500"></textarea>
                <button id="actionBtn" onclick="saveScript()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl text-sm">Ofuscar y Guardar</button>
                <button id="cancelBtn" onclick="resetForm()" class="hidden bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-2 rounded-xl text-xs">Cancelar</button>
                <div class="mt-3">
                    <div class="flex justify-between items-center mb-1">
                        <label class="text-xs text-zinc-400">Loadstring:</label>
                        <button onclick="copyResult()" class="text-[10px] text-indigo-400">Copiar</button>
                    </div>
                    <textarea id="resultOutput" readonly placeholder="Aparecerá aquí..." class="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-emerald-400 font-mono h-20 resize-none w-full"></textarea>
                </div>
            </div>

            <div class="md:col-span-2 glass p-6 rounded-2xl flex flex-col gap-4">
                <div class="flex justify-between items-center">
                    <h3 class="font-bold text-base">Scripts Protegidos</h3>
                    <span id="counterBadge" class="text-xs bg-indigo-950 text-indigo-300 px-3 py-1 rounded-full border border-indigo-800">0</span>
                </div>
                <div id="scriptListContainer" class="flex flex-col gap-3 max-h-[520px] overflow-y-auto pr-1">
                    <p class="text-zinc-500 text-xs text-center py-10">Cargando...</p>
                </div>
            </div>
        </main>
    </div>

<script>
    let editingId = null;
    let panelPass = localStorage.getItem('ikgonavi_pass') || '';

    if (panelPass) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainPanel').classList.remove('hidden');
        loadScripts();
    }

    function login() {
        const pass = document.getElementById('panelPassword').value;
        if (!pass) return;
        fetch('/api/scripts', { headers: { 'x-panel-password': pass } })
        .then(r => {
            if (r.status === 401) {
                document.getElementById('loginError').classList.remove('hidden');
                return;
            }
            panelPass = pass;
            localStorage.setItem('ikgonavi_pass', pass);
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('mainPanel').classList.remove('hidden');
            loadScripts();
        }).catch(() => document.getElementById('loginError').classList.remove('hidden'));
    }

    function logout() {
        localStorage.removeItem('ikgonavi_pass');
        location.reload();
    }

    async function loadScripts() {
        const container = document.getElementById('scriptListContainer');
        try {
            const res = await fetch('/api/scripts', { headers: { 'x-panel-password': panelPass } });
            if (res.status === 401) return logout();
            const scripts = await res.json();
            document.getElementById('counterBadge').innerText = scripts.length + ' scripts';
            if (scripts.length === 0) {
                container.innerHTML = '<p class="text-zinc-500 text-xs text-center py-10">No hay scripts aún</p>';
                return;
            }
            container.innerHTML = '';
            scripts.forEach(s => {
                const loadstring = \`loadstring(game:HttpGet("\${location.origin}/api/script/\${s.id}"))()\`;
                const card = document.createElement('div');
                card.className = "bg-zinc-900/80 border border-zinc-800/80 p-4 rounded-xl";
                card.innerHTML = \`
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-bold text-sm text-indigo-300">\${escapeHtml(s.name || 'Sin nombre')}</span>
                        <div class="flex gap-2">
                            <button onclick="startEdit('\${s.id}', '\${escapeHtml(s.name || '')}')" class="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-indigo-300 px-2.5 py-1 rounded-lg">Editar</button>
                            <button onclick="deleteScript('\${s.id}')" class="text-[11px] bg-red-950/60 hover:bg-red-900 text-red-300 px-2.5 py-1 rounded-lg">Borrar</button>
                        </div>
                    </div>
                    <textarea readonly class="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-400 font-mono h-14 w-full resize-none">\${loadstring}</textarea>
                    <button onclick="navigator.clipboard.writeText(\\\`\${loadstring}\\\`); alert('Copiado')" class="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold w-full">Copiar Loadstring</button>
                \`;
                container.appendChild(card);
            });
        } catch (e) {
            container.innerHTML = '<p class="text-red-400 text-xs text-center py-10">Error de conexión</p>';
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function pasteLargeCode() {
        try {
            const text = await navigator.clipboard.readText();
            if (text) document.getElementById('scriptCode').value = text;
        } catch {
            alert('Haz clic en el textarea y presiona Ctrl+V');
        }
    }

    function copyResult() {
        const val = document.getElementById('resultOutput').value;
        if (!val) return alert('No hay loadstring generado');
        navigator.clipboard.writeText(val);
        alert('¡Copiado!');
    }

    async function saveScript() {
        const name = document.getElementById('scriptName').value.trim();
        const code = document.getElementById('scriptCode').value;
        if (!code) return alert('Pega el código primero');

        const btn = document.getElementById('actionBtn');
        btn.disabled = true;
        btn.innerText = 'Ofuscando...';

        try {
            const url = editingId ? '/api/script/' + editingId : '/api/script';
            const method = editingId ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'x-panel-password': panelPass },
                body: JSON.stringify({ name, code })
            });
            const data = await res.json();
            if (res.ok && (data.id || data.success)) {
                const id = data.id || editingId;
                document.getElementById('resultOutput').value = \`loadstring(game:HttpGet("\${location.origin}/api/script/\${id}"))()\`;
                alert('¡Script ofuscado y guardado!');
                resetForm();
                loadScripts();
            } else {
                alert(data.error || 'Error al guardar');
            }
        } catch {
            alert('Error de conexión');
        }
        btn.disabled = false;
        btn.innerText = 'Ofuscar y Guardar';
    }

    function startEdit(id, name) {
        editingId = id;
        document.getElementById('scriptName').value = name === 'null' ? '' : name;
        document.getElementById('scriptCode').value = '';
        document.getElementById('panelTitle').innerText = 'Editar Script';
        document.getElementById('actionBtn').innerText = 'Guardar Cambios';
        document.getElementById('cancelBtn').classList.remove('hidden');
        document.getElementById('resultOutput').value = \`loadstring(game:HttpGet("\${location.origin}/api/script/\${id}"))()\`;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function resetForm() {
        editingId = null;
        document.getElementById('scriptName').value = '';
        document.getElementById('scriptCode').value = '';
        document.getElementById('resultOutput').value = '';
        document.getElementById('panelTitle').innerText = 'Nuevo Script';
        document.getElementById('actionBtn').innerText = 'Ofuscar y Guardar';
        document.getElementById('cancelBtn').classList.add('hidden');
    }

    async function deleteScript(id) {
        if (!confirm('¿Borrar este script?')) return;
        try {
            const res = await fetch('/api/script/' + id, {
                method: 'DELETE',
                headers: { 'x-panel-password': panelPass }
            });
            if (res.ok) loadScripts();
            else alert('Error al borrar');
        } catch {
            alert('Error de conexión');
        }
    }

    async function wipeAll() {
        if (!confirm('⚠️ ¿Borrar TODOS los scripts?')) return;
        try {
            const res = await fetch('/api/scripts/wipe', {
                method: 'DELETE',
                headers: { 'x-panel-password': panelPass }
            });
            if (res.ok) {
                alert('Base de datos limpiada');
                loadScripts();
            }
        } catch {
            alert('Error de conexión');
        }
    }

    document.getElementById('panelPassword')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') login();
    });
</script>
</body>
</html>
    `);
});

// ====================== API ======================

app.get('/api/scripts', requirePanelAuth, async (req, res) => {
    try {
        const scripts = await ScriptModel.find({}, { code: 0 }).sort({ createdAt: -1 });
        res.json(scripts);
    } catch {
        res.json([]);
    }
});

app.post('/api/script', requirePanelAuth, async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!code) return res.status(400).json({ error: 'Falta el código' });
        const protectedCode = strongObfuscate(code);
        const newScript = new ScriptModel({
            name: name || 'Script Sin Nombre',
            code: protectedCode
        });
        await newScript.save();
        res.json({ id: newScript.id });
    } catch (error) {
        res.status(500).json({ error: 'Error interno' });
    }
});

app.put('/api/script/:id', requirePanelAuth, async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!code) return res.status(400).json({ error: 'Falta el código' });
        const protectedCode = strongObfuscate(code);
        const updated = await ScriptModel.findOneAndUpdate(
            { id: req.params.id },
            { name: name || 'Script Sin Nombre', code: protectedCode },
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: 'No encontrado' });
        res.json({ success: true, id: updated.id });
    } catch (error) {
        res.status(500).json({ error: 'Error interno' });
    }
});

app.delete('/api/script/:id', requirePanelAuth, async (req, res) => {
    try {
        await ScriptModel.findOneAndDelete({ id: req.params.id });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Error interno' });
    }
});

app.delete('/api/scripts/wipe', requirePanelAuth, async (req, res) => {
    try {
        await ScriptModel.deleteMany({});
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Error interno' });
    }
});

// Endpoint público del script (protegido contra robos)
app.get('/api/script/:id', scriptLimiter, async (req, res) => {
    const ua = (req.headers['user-agent'] || '').toLowerCase();

    // Bloquear navegadores, bots, scrapers, etc.
    const isBrowser = /chrome|firefox|safari|edg|opera|msie|trident|mozilla|brave|vivaldi/i.test(ua) && !ua.includes('roblox');
    const isBot = /bot|crawler|spider|scraper|python|axios|node-fetch|wget|curl|postman|insomnia|java|ruby|php|go-http|discord/i.test(ua);

    if (isBrowser || isBot) {
        return res.status(403).send('-- ACCESO DENEGADO');
    }

    try {
        const scriptData = await ScriptModel.findOne({ id: req.params.id });
        if (!scriptData) {
            return res.status(404).send('-- Script no encontrado');
        }
        res.setHeader('Content-Type', 'text/plain');
        res.send(scriptData.code);
    } catch {
        res.status(500).send('-- Error interno');
    }
});

app.listen(PORT, () => {
    console.log(`🛡️ Ikgonavi Hub Pro activo en el puerto ${PORT}`);
});
