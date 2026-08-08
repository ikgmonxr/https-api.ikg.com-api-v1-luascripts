const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
app.set('trust proxy', 1);

const PANEL_PASSWORD = "CambiaEstaContraseña123!"; // ← CAMBIA ESTA CONTRASEÑA
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40 });
app.use('/api/', limiter);

mongoose.connect(process.env.MONGO_URI || "mongodb+srv://yarishdz2_db_user:7cp3VZH9aXK77wX@ikgmxer.8tj7kfa.mongodb.net/hubsilent?appName=ikgmxer")
    .then(async () => {
        console.log("🔥 Ikgonavi Hub Pro activo");
        try {
            // Elimina el índice conflictivo 'slug_1' si existe en la colección
            await mongoose.connection.collection('hubscripts').dropIndex('slug_1');
            console.log("🧹 Índice obsoleto 'slug_1' eliminado correctamente");
        } catch (e) {
            // Si el índice ya no existe, continúa sin problemas
        }
    })
    .catch(err => console.error("Error DB:", err));

const ScriptModel = mongoose.model('HubScript', new mongoose.Schema({
    id: { type: String, default: () => crypto.randomBytes(16).toString('hex') },
    name: String,
    code: String,
    createdAt: { type: Date, default: Date.now }
}));

function obfuscate(rawCode) {
    const encoded = Buffer.from(rawCode, 'utf8').toString('base64');
    const r = () => crypto.randomBytes(3).toString('hex');
    let junk = "";
    for (let i = 0; i < 30; i++) {
        junk += `local _${r()} = "${crypto.randomBytes(6).toString('hex')}"\n`;
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

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ikgonavi Hub Pro</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: #090a0f; }
    .glass { background: rgba(18,20,32,0.8); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.07); }
</style>
</head>
<body class="text-gray-100 min-h-screen">
<div id="loginScreen" class="min-h-screen flex items-center justify-center p-4">
    <div class="glass w-full max-w-md p-8 rounded-2xl">
        <div class="text-center mb-8">
            <div class="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">⚡</div>
            <h1 class="text-2xl font-bold">Ikgonavi Hub Pro</h1>
            <p class="text-indigo-400 text-sm mt-1">Panel de Control</p>
        </div>
        <input type="password" id="passInput" placeholder="Contraseña del panel" 
               class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 mb-4 outline-none focus:border-indigo-500">
        <button onclick="login()" class="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-semibold transition">
            Entrar al Panel
        </button>
        <p id="loginError" class="text-red-400 text-sm text-center mt-4 hidden">Contraseña incorrecta</p>
    </div>
</div>
<div id="dashboard" class="hidden min-h-screen">
    <div class="flex">
        <aside class="w-64 glass min-h-screen p-5 flex flex-col fixed left-0 top-0">
            <div class="flex items-center gap-3 mb-10 px-2">
                <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-bold">⚡</div>
                <div>
                    <div class="font-bold text-sm">Ikgonavi Hub</div>
                    <div class="text-xs text-indigo-400">Pro Panel</div>
                </div>
            </div>
            <nav class="flex flex-col gap-1 flex-1">
                <button onclick="showPage('obfuscator')" id="nav-obfuscator" class="nav-btn flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium bg-indigo-600/20 text-indigo-300">
                    <span>🔒</span> Ofuscador
                </button>
                <button onclick="showPage('scripts')" id="nav-scripts" class="nav-btn flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium text-zinc-400 hover:bg-zinc-800">
                    <span>📜</span> Scripts
                </button>
                <button onclick="showPage('edit')" id="nav-edit" class="nav-btn flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium text-zinc-400 hover:bg-zinc-800">
                    <span>✏️</span> Editar Scripts
                </button>
            </nav>
            <button onclick="logout()" class="mt-auto flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-950/40">
                <span>🚪</span> Cerrar Sesión
            </button>
        </aside>
        <main class="ml-64 flex-1 p-8">
            <div id="page-obfuscator" class="page">
                <h2 class="text-2xl font-bold mb-1">Ofuscador</h2>
                <p class="text-zinc-400 text-sm mb-8">Pega tu código Lua y ofúscalo automáticamente</p>
                <div class="glass rounded-2xl p-6 max-w-3xl">
                    <div class="mb-4">
                        <label class="text-sm text-zinc-400 mb-1 block">Nombre del Script</label>
                        <input id="scriptName" type="text" placeholder="Ej: Silent Aim, ESP, etc." 
                               class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500">
                    </div>
                    <div class="mb-4">
                        <div class="flex justify-between items-center mb-1">
                            <label class="text-sm text-zinc-400">Código Lua</label>
                            <button onclick="pasteCode()" class="text-xs text-indigo-400 hover:text-indigo-300">📋 Pegar del portapapeles</button>
                        </div>
                        <textarea id="scriptCode" placeholder="Pega aquí tu código..." 
                                  class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 h-56 font-mono text-sm outline-none focus:border-indigo-500 resize-none"></textarea>
                    </div>
                    <button id="saveBtn" onclick="saveScript()" 
                            class="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl font-semibold transition flex items-center justify-center gap-2">
                        🔒 Ofuscar y Guardar
                    </button>
                    <div class="mt-6">
                        <div class="flex justify-between items-center mb-1">
                            <label class="text-sm text-zinc-400">Loadstring generado</label>
                            <button onclick="copyResult()" class="text-xs text-indigo-400 hover:text-indigo-300">Copiar</button>
                        </div>
                        <textarea id="resultOutput" readonly placeholder="Aquí aparecerá el loadstring..." 
                                  class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 h-20 font-mono text-xs text-emerald-400 outline-none resize-none"></textarea>
                    </div>
                </div>
            </div>
            <div id="page-scripts" class="page hidden">
                <div class="flex justify-between items-center mb-8">
                    <div>
                        <h2 class="text-2xl font-bold">Scripts</h2>
                        <p class="text-zinc-400 text-sm">Todos tus scripts ofuscados</p>
                    </div>
                    <span id="scriptCount" class="bg-indigo-950 text-indigo-300 text-sm px-4 py-1.5 rounded-full border border-indigo-800">0 scripts</span>
                </div>
                <div id="scriptsList" class="grid gap-4">
                    <p class="text-zinc-500 text-center py-16">Cargando scripts...</p>
                </div>
            </div>
            <div id="page-edit" class="page hidden">
                <h2 class="text-2xl font-bold mb-1">Editar Scripts</h2>
                <p class="text-zinc-400 text-sm mb-8">Selecciona un script para reemplazar su código</p>
                <div class="glass rounded-2xl p-6 max-w-3xl">
                    <div class="mb-4">
                        <label class="text-sm text-zinc-400 mb-1 block">Seleccionar Script</label>
                        <select id="editSelect" onchange="loadEditScript()" 
                                class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500">
                            <option value="">-- Elige un script --</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label class="text-sm text-zinc-400 mb-1 block">Nuevo Nombre (opcional)</label>
                        <input id="editName" type="text" placeholder="Dejar vacío para no cambiar" 
                               class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500">
                    </div>
                    <div class="mb-4">
                        <label class="text-sm text-zinc-400 mb-1 block">Nuevo Código Lua</label>
                        <textarea id="editCode" placeholder="Pega el nuevo código aquí..." 
                                  class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 h-56 font-mono text-sm outline-none focus:border-indigo-500 resize-none"></textarea>
                    </div>
                    <button id="editBtn" onclick="updateScript()" 
                            class="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl font-semibold transition">
                        💾 Guardar Cambios
                    </button>
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
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('bg-indigo-600/20', 'text-indigo-300');
        b.classList.add('text-zinc-400');
    });
    const active = document.getElementById('nav-' + page);
    active.classList.add('bg-indigo-600/20', 'text-indigo-300');
    active.classList.remove('text-zinc-400');
    if (page === 'scripts' || page === 'edit') loadScripts();
}
async function loadScripts() {
    try {
        const res = await fetch('/api/scripts', { headers: { 'x-panel-password': panelPass } });
        if (res.status === 401) return logout();
        allScripts = await res.json();
        document.getElementById('scriptCount').innerText = allScripts.length + ' scripts';
        const list = document.getElementById('scriptsList');
        if (allScripts.length === 0) {
            list.innerHTML = '<p class="text-zinc-500 text-center py-16">No hay scripts todavía</p>';
        } else {
            list.innerHTML = allScripts.map(s => {
                const ls = \`loadstring(game:HttpGet("\${location.origin}/api/script/\${s.id}"))()\`;
                return \`
                <div class="glass rounded-xl p-5">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <div class="font-semibold text-indigo-300\">\${escapeHtml(s.name || 'Sin nombre')}</div>
                            <div class="text-xs text-zinc-500 mt-1">ID: \${s.id}</div>
                        </div>
                        <button onclick="deleteScript('\${s.id}')" class="text-xs text-red-400 hover:text-red-300 px-3 py-1 rounded-lg bg-red-950/40">Borrar</button>
                    </div>
                    <textarea readonly class="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-400 h-16 resize-none">\${ls}</textarea>
                    <button onclick="navigator.clipboard.writeText(\\\`\${ls}\\\`); this.innerText='¡Copiado!'; setTimeout(()=>this.innerText='Copiar Loadstring',1500)" 
                            class="mt-3 w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded-lg text-sm font-medium">
                        Copiar Loadstring
                    </button>
                </div>\`;
            }).join('');
        }
        const select = document.getElementById('editSelect');
        select.innerHTML = '<option value="">-- Elige un script --</option>' + 
            allScripts.map(s => \`<option value="\${s.id}">\${escapeHtml(s.name || 'Sin nombre')}</option>\`).join('');
    } catch {
        document.getElementById('scriptsList').innerHTML = '<p class="text-red-400 text-center py-16">Error al cargar</p>';
    }
}
function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}
async function pasteCode() {
    try {
        const text = await navigator.clipboard.readText();
        if (text) document.getElementById('scriptCode').value = text;
    } catch {
        alert('Haz clic en el cuadro de texto y presiona Ctrl + V');
    }
}
function copyResult() {
    const val = document.getElementById('resultOutput').value;
    if (!val) return alert('No hay loadstring generado');
    navigator.clipboard.writeText(val);
    alert('¡Loadstring copiado!');
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
            btn.classList.remove('bg-indigo-600');
            btn.classList.add('bg-emerald-600');
            setTimeout(() => {
                btn.innerText = '🔒 Ofuscar y Guardar';
                btn.disabled = false;
                btn.classList.remove('bg-emerald-600');
                btn.classList.add('bg-indigo-600');
            }, 1800);
            loadScripts();
        } else {
            alert(data.error || 'Error desconocido');
            btn.innerText = '🔒 Ofuscar y Guardar';
            btn.disabled = false;
        }
    } catch {
        alert('Error de conexión o servidor');
        btn.innerText = '🔒 Ofuscar y Guardar';
        btn.disabled = false;
    }
}
function loadEditScript() {
    const id = document.getElementById('editSelect').value;
    const script = allScripts.find(s => s.id === id);
    if (script) {
        document.getElementById('editName').value = script.name || '';
        document.getElementById('editCode').value = '';
    }
}
async function updateScript() {
    const id = document.getElementById('editSelect').value;
    const name = document.getElementById('editName').value.trim();
    const code = document.getElementById('editCode').value;
    if (!id) return alert('Selecciona un script');
    if (!code) return alert('Pega el nuevo código');
    const btn = document.getElementById('editBtn');
    btn.innerText = 'Guardando...';
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
            btn.classList.add('bg-emerald-600');
            setTimeout(() => {
                btn.innerText = '💾 Guardar Cambios';
                btn.disabled = false;
                btn.classList.remove('bg-emerald-600');
            }, 1500);
            document.getElementById('editCode').value = '';
            loadScripts();
        } else {
            alert(data.error || 'Error al actualizar');
            btn.innerText = '💾 Guardar Cambios';
            btn.disabled = false;
        }
    } catch {
        alert('Error de conexión');
        btn.innerText = '💾 Guardar Cambios';
        btn.disabled = false;
    }
}
async function deleteScript(id) {
    if (!confirm('¿Borrar este script permanentemente?')) return;
    await fetch('/api/script/' + id, {
        method: 'DELETE',
        headers: { 'x-panel-password': panelPass }
    });
    loadScripts();
}
document.getElementById('passInput')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') login();
});
</script>
</body>
</html>`);
});

// ========== API ==========
app.get('/api/scripts', requireAuth, async (req, res) => {
    try {
        const scripts = await ScriptModel.find({}, { code: 0 }).sort({ createdAt: -1 });
        res.json(scripts);
    } catch (err) {
        console.error("Error en GET /api/scripts:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/script', requireAuth, async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!code) return res.status(400).json({ error: 'Falta el código' });
        const protectedCode = obfuscate(code);
        const doc = new ScriptModel({ name: name || 'Sin nombre', code: protectedCode });
        await doc.save();
        res.json({ id: doc.id });
    } catch (err) {
        console.error("Error en POST /api/script:", err);
        res.status(500).json({ error: err.message || 'Error interno' });
    }
});

app.put('/api/script/:id', requireAuth, async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!code) return res.status(400).json({ error: 'Falta el código' });
        const protectedCode = obfuscate(code);
        const updated = await ScriptModel.findOneAndUpdate(
            { id: req.params.id },
            { name: name || 'Sin nombre', code: protectedCode },
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: 'No encontrado' });
        res.json({ success: true });
    } catch (err) {
        console.error("Error en PUT /api/script/:id:", err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/script/:id', requireAuth, async (req, res) => {
    try {
        await ScriptModel.findOneAndDelete({ id: req.params.id });
        res.json({ success: true });
    } catch (err) {
        console.error("Error en DELETE /api/script/:id:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/script/:id', async (req, res) => {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    if (/chrome|firefox|safari|edg|mozilla|bot|curl|python|axios|postman|wget|discord/i.test(ua) && !ua.includes('roblox')) {
        return res.status(403).send('-- ACCESO DENEGADO');
    }
    try {
        const script = await ScriptModel.findOne({ id: req.params.id });
        if (!script) return res.status(404).send('-- No encontrado');
        res.type('text/plain').send(script.code);
    } catch (err) {
        console.error("Error en GET /api/script/:id:", err);
        res.status(500).send('-- Error');
    }
});

app.listen(PORT, () => console.log("🛡️ Ikgonavi Hub Pro corriendo en puerto", PORT));
