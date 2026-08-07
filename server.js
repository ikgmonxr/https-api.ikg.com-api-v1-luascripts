const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: '🚫 Demasiadas peticiones. Tranquilo.',
});
app.use('/api/', limiter);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🔥 Servidor Cyberpunk Pro Anti-Dump [Nivel Máximo] Activo"))
    .catch((err) => console.error("❌ Error DB:", err));

const scriptSchema = new mongoose.Schema({
    id: { type: String, default: () => crypto.randomBytes(16).toString('hex') },
    name: String,
    code: String,
    createdAt: { type: Date, default: Date.now }
});

const ScriptModel = mongoose.model('HubScript', scriptSchema);

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ikgonavi Hub | Secure Control Center</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
                body { font-family: 'Plus Jakarta Sans', sans-serif; background: #090a0f; color: #f3f4f6; }
                .glass { background: rgba(18, 20, 32, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08); }
                .glow { box-shadow: 0 0 25px -5px rgba(88, 101, 242, 0.3); }
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: #090a0f; }
                ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }
            </style>
        </head>
        <body class="min-h-screen flex flex-col items-center p-4 md:p-8">
            <header class="w-full max-w-4xl flex justify-between items-center mb-8 glass p-5 rounded-2xl glow">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-xl text-white">⚡</div>
                    <div>
                        <h1 class="font-bold text-lg text-white">Ikgonavi Hub Pro</h1>
                        <p class="text-xs text-indigo-400">Sistema Anti-Dump Extremo Activo</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="wipeAllDatabase()" class="text-xs bg-red-950/80 hover:bg-red-900 text-red-300 px-3 py-2 rounded-xl border border-red-800/50 font-semibold transition">🗑️ Borrar Todo</button>
                    <div class="text-xs bg-indigo-950/80 text-indigo-300 px-3 py-2 rounded-xl border border-indigo-800/50 font-mono">
                        Status: <span class="text-emerald-400 font-bold">Blindado</span>
                    </div>
                </div>
            </header>

            <main class="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Columna Izquierda: Crear / Editar -->
                <div class="md:col-span-1 glass p-6 rounded-2xl flex flex-col gap-4 h-fit">
                    <h2 id="panelTitle" class="font-bold text-base text-indigo-300">Nuevo Script</h2>
                    
                    <div class="flex flex-col gap-3">
                        <input type="text" id="scriptName" placeholder="Nombre del Script (Ej. Silent Aim)" class="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500">
                        <textarea id="scriptCode" placeholder="Pega tu código Lua aquí..." class="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-indigo-300 font-mono h-48 resize-none outline-none focus:border-indigo-500"></textarea>
                        <button id="actionBtn" onclick="saveScript()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl text-sm transition shadow-lg shadow-indigo-600/20">Generar Loadstring</button>
                        <button id="cancelBtn" onclick="resetForm()" class="hidden bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-2 rounded-xl text-xs transition">Cancelar Edición</button>
                    </div>

                    <div class="mt-2">
                        <label class="text-xs text-zinc-400 mb-1 block">Loadstring Directo:</label>
                        <input type="text" id="resultOutput" readonly placeholder="Aparecerá aquí..." class="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-emerald-400 font-mono outline-none w-full">
                    </div>
                </div>

                <!-- Columna Derecha: Lista de Scripts -->
                <div class="md:col-span-2 glass p-6 rounded-2xl flex flex-col gap-4">
                    <div class="flex justify-between items-center">
                        <h3 class="font-bold text-base text-white">Scripts Registrados</h3>
                        <span id="counterBadge" class="text-xs bg-indigo-950 text-indigo-300 px-3 py-1 rounded-full border border-indigo-800">0 scripts</span>
                    </div>

                    <div id="scriptListContainer" class="flex flex-col gap-3 max-h-[460px] overflow-y-auto pr-1">
                        <p class="text-zinc-500 text-xs text-center py-10">Cargando scripts...</p>
                    </div>
                </div>
            </main>

            <script>
                let editingId = null;
                window.onload = loadScripts;

                async function loadScripts() {
                    const container = document.getElementById('scriptListContainer');
                    
                    localStorage.removeItem('my_hubsilent_scripts'); // Limpiar cache local obsoleta

                    let dbScripts = [];
                    try {
                        const res = await fetch('/api/scripts');
                        dbScripts = await res.json();
                    } catch(e) {}

                    document.getElementById('counterBadge').innerText = dbScripts.length + ' scripts';
                    
                    if(dbScripts.length === 0) {
                        container.innerHTML = '<p class="text-zinc-500 text-xs text-center py-10">No hay scripts creados. ¡Empieza desde cero!</p>';
                        return;
                    }

                    container.innerHTML = '';
                    dbScripts.forEach(s => {
                        const loadstring = \`loadstring(game:HttpGet("\${window.location.origin}/api/script/\${s.id}"))()\`;
                        const card = document.createElement('div');
                        card.className = "bg-zinc-900/80 border border-zinc-800/80 p-4 rounded-xl flex flex-col gap-2";
                        card.innerHTML = \`
                            <div class="flex justify-between items-center">
                                <span class="font-bold text-sm text-indigo-300">\${s.name || 'Script Sin Nombre'}</span>
                                <div class="flex gap-2">
                                    <button onclick="startEdit('\${s.id}', \\\`\${encodeURIComponent(s.code || '')}\\\`, \\\`\${s.name || ''}\\\`)" class="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-indigo-300 px-2.5 py-1 rounded-lg">Editar</button>
                                    <span class="text-[10px] text-zinc-500 font-mono self-center">ID: \${s.id}</span>
                                </div>
                            </div>
                            <div class="flex gap-2 mt-1">
                                <input type="text" readonly value='\${loadstring}' class="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-400 font-mono w-full outline-none">
                                <button onclick="navigator.clipboard.writeText(\\\`\${loadstring}\\\`); alert('¡Copiado!');" class="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-xs font-semibold">Copiar</button>
                            </div>
                        \`;
                        container.appendChild(card);
                    });
                }

                async function saveScript() {
                    const name = document.getElementById('scriptName').value;
                    const code = document.getElementById('scriptCode').value;
                    if(!code) return alert('¡Pega el código primero!');

                    const btn = document.getElementById('actionBtn');
                    btn.innerText = 'Guardando...';
                    btn.disabled = true;

                    if(editingId) {
                        try {
                            const res = await fetch('/api/script/' + editingId, {
                                method: 'PUT',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ name, code })
                            });
                            const data = await res.json();
                            if(data.success) {
                                alert('¡Script actualizado con éxito!');
                                resetForm();
                                loadScripts();
                            } else {
                                alert('Error al actualizar.');
                            }
                        } catch(e) { alert('Error de conexión.'); }
                    } else {
                        try {
                            const res = await fetch('/api/script', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ name, code })
                            });
                            const data = await res.json();
                            if(data.id) {
                                const loadstring = \`loadstring(game:HttpGet("\${window.location.origin}/api/script/\${data.id}"))()\`;
                                document.getElementById('resultOutput').value = loadstring;
                                document.getElementById('scriptCode').value = '';
                                document.getElementById('scriptName').value = '';
                                loadScripts();
                                alert('¡Loadstring generado con éxito!');
                            }
                        } catch(e) { alert('Error de conexión.'); }
                    }
                    btn.innerText = 'Generar Loadstring';
                    btn.disabled = false;
                }

                async function wipeAllDatabase() {
                    if(!confirm('⚠️ ¿ESTÁS SEGURO? Esto borrará ABSOLUTAMENTE TODOS tus scripts de la base de datos para empezar desde cero.')) return;
                    try {
                        const res = await fetch('/api/scripts/wipe', { method: 'DELETE' });
                        const data = await res.json();
                        if(data.success) {
                            alert('🗑️ Base de datos limpiada por completo.');
                            resetForm();
                            loadScripts();
                        } else {
                            alert('Error al vaciar la base de datos.');
                        }
                    } catch(e) { alert('Error de conexión.'); }
                }

                function startEdit(id, encodedCode, name) {
                    editingId = id;
                    document.getElementById('scriptCode').value = decodeURIComponent(encodedCode);
                    document.getElementById('scriptName').value = name === 'null' ? '' : name;
                    document.getElementById('panelTitle').innerText = 'Editar Script';
                    document.getElementById('actionBtn').innerText = 'Guardar Cambios';
                    document.getElementById('cancelBtn').classList.remove('hidden');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }

                function resetForm() {
                    editingId = null;
                    document.getElementById('scriptCode').value = '';
                    document.getElementById('scriptName').value = '';
                    document.getElementById('resultOutput').value = '';
                    document.getElementById('panelTitle').innerText = 'Nuevo Script';
                    document.getElementById('actionBtn').innerText = 'Generar Loadstring';
                    document.getElementById('cancelBtn').classList.add('hidden');
                }
            </script>
        </body>
        </html>
    `);
});

app.get('/api/scripts', async (req, res) => {
    try {
        const scripts = await ScriptModel.find().sort({ createdAt: -1 });
        res.json(scripts);
    } catch(e) { res.json([]); }
});

// Ruta para borrar TODOS los scripts (Empezar desde cero)
app.delete('/api/scripts/wipe', async (req, res) => {
    try {
        await ScriptModel.deleteMany({});
        res.json({ success: true, message: 'Todos los scripts han sido eliminados correctamente.' });
    } catch (error) {
        res.status(500).json({ error: 'Error interno al limpiar la base de datos' });
    }
});

app.post('/api/script', async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!code) return res.status(400).json({ error: 'Falta el código' });
        const newScript = new ScriptModel({ name: name || 'Script Sin Nombre', code });
        await newScript.save();
        res.json({ id: newScript.id });
    } catch (error) {
        res.status(500).json({ error: 'Error interno' });
    }
});

app.put('/api/script/:id', async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!code) return res.status(400).json({ error: 'Falta el código' });
        const updated = await ScriptModel.findOneAndUpdate(
            { id: req.params.id }, 
            { name: name || 'Script Sin Nombre', code }, 
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: 'No encontrado' });
        res.json({ success: true, id: updated.id });
    } catch (error) {
        res.status(500).json({ error: 'Error interno' });
    }
});

// Ruta Blindada Anti-Dump Mejorada
app.get('/api/script/:id', async (req, res) => {
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();

    // Filtros de seguridad estrictos contra navegadores comunes, bots de discord y scrapers avanzados
    const isBrowser = /chrome|firefox|safari|edg|opera|msie|trident|mozilla/i.test(userAgent) && !userAgent.includes('roblox');
    const isDiscordBot = userAgent.includes('discordbot') || userAgent.includes('discord');
    const isScraperTool = /python|axios|node-fetch|wget|postman|bot|crawler|spider|scraper|java|ruby|php|go-http-client/i.test(userAgent);

    if (isBrowser || isDiscordBot || isScraperTool) {
        return res.status(403).send('-- ACCESO DENEGADO: Sistema Anti-Dump Activo. Este script solo puede ejecutarse dentro de Roblox.');
    }

    try {
        const scriptData = await ScriptModel.findOne({ id: req.params.id });
        
        if (!scriptData) {
            return res.status(404).send('-- Script no encontrado o eliminado');
        }

        // Sistema anti-dump reforzado con relleno aleatorio masivo para romper analizadores estáticos
        let heavyJunkPadding = `-- [SECURED BY IKGONAVI EXTREME ANTI-DUMP]\n`;
        for (let i = 1; i <= 250; i++) {
            const randomVar = crypto.randomBytes(4).toString('hex');
            const randomVal = crypto.randomBytes(8).toString('hex');
            heavyJunkPadding += `-- Node_${i}: local _sys_sec_${randomVar} = "${randomVal}"\n`;
        }
        heavyJunkPadding += `\n-- [INICIO DEL NÚCLEO DE EJECUCIÓN]\n`;

        const finalProtectedCode = heavyJunkPadding + "\n" + scriptData.code;

        res.setHeader('Content-Type', 'text/plain');
        res.send(finalProtectedCode);
    } catch (error) {
        console.error("Error al obtener script:", error);
        res.status(500).send('-- Error interno del servidor');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🛡️ Panel Pro Blindado activo en el puerto ${PORT}`);
});
