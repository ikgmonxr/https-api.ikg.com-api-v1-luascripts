const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
app.set('trust proxy', 1);

// ====================== CONFIGURACIÓN ======================
const PANEL_PASSWORD = "ikg"; // ← CAMBIA ESTA CONTRASEÑA
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

// ====================== OFUSCADOR FUERTE ======================
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
        junk2: v(),
        junk3: v(),
    };

    let junk = "";
    for (let i = 0; i < 50; i++) {
        const jName = v();
        const jVal = crypto.randomBytes(10).toString('hex');
        junk += `local ${jName} = "${jVal}"\n`;
    }

    const antiDump = `
local ${vars.junk1} = function() return true end
local ${vars.junk2} = setmetatable({}, {__index = function() return ${vars.junk1} end})
pcall(function()
    if getfenv then
        local e = getfenv(0)
        if type(e) == "table" and (e.script or e.debug) then end
    end
end)
`;

    return `
-- [IKGONAVI HUB PRO - STRONG PROTECTION]
${junk}
${antiDump}

local ${vars.data} = "${encoded}"

local function ${vars.decode}(data)
    if type(base64_decode) == "function" then return base64_decode(data) end
    if crypt and crypt.base64 and crypt.base64.decode then return crypt.base64.decode(data) end
    if syn and syn.crypt and syn.crypt.base64 and syn.crypt.base64.decode then return syn.crypt.base64.decode(data) end
    if fluxus and fluxus.crypt and fluxus.crypt.base64decode then return fluxus.crypt.base64decode(data) end

    local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    data = string.gsub(data, '[^'..b
