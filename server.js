const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
app.set('trust proxy', 1);

// ====================== CONFIGURACIÓN ======================
const PANEL_PASSWORD = "CambiaEstaContraseña123!"; // ← CAMBIA ESTA
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
        sendDiscordLog("🔄 Script actualizado", `El script **${script.name}** (\`${script.id}\`) ha sido modificado y re-ofuscado correctamente.`, 0xF59E0B);
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

// ====================== RUTA DEL SCRIPT (CON PROTECCIÓN) ======================
app.get('/api/script/:id', async (req, res) => {
    const ua = (req.headers['user-agent'] || '').toLowerCase();

    // Detectar navegadores
    const isBrowser = /mozilla|chrome|firefox|safari|edg|opera|brave|msie|trident/i.test(ua) && 
                      !/roblox|synapse|script-ware|krnl|fluxus|solara|wave|electron|delta|executor/i.test(ua);

    if (isBrowser) {
        // Página de protección bonita
        return res.status(403
