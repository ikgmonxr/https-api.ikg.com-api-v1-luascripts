const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');

const app = express();
app.set('trust proxy', 1);

const PANEL_PASSWORD = "CambiaEstaContraseña123!"; // ← CAMBIA ESTA CONTRASEÑA
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40 });
app.use('/api/', limiter);

mongoose.connect(process.env.MONGO_URI || "mongodb+srv://yarishdz2_db_user:7cp3VZH9aXK77wX@ikgmxer.8tj7kfa.mongodb.net/hubsilent?appName=ikgmxer")
    .then(() => console.log("🔥 Ikgonavi Hub Pro activo"))
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

// Servir la interfaz web desde un archivo externo
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
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
