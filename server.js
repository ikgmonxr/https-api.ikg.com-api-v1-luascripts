function obfuscate(rawCode) {
    // Anti-tamper + tu código (se ofusca todo junto)
    const protected = `
local function __atk()
    local function die()
        while true do end
    end
    -- debug API
    if type(debug) == "table" then
        if type(debug.getinfo) == "function" or type(debug.getupvalue) == "function"
            or type(debug.getconstants) == "function" or type(debug.getproto) == "function"
            or type(debug.getstack) == "function" or type(debug.setupvalue) == "function" then
            die()
        end
    end
    -- dump helpers
    if type(getgc) == "function" or type(getreg) == "function" or type(getprotos) == "function"
        or type(getconstants) == "function" or type(getupvalues) == "function"
        or type(getinfo) == "function" or type(getloadedmodules) == "function" then
        die()
    end
    -- hook checks
    if type(hookfunction) == "function" or type(hookmetamethod) == "function"
        or type(replaceclosure) == "function" or type(newcclosure) == "function" then
        -- muchos executors los tienen; solo matamos si además hay debug/getgc
        if type(debug) == "table" and type(debug.getinfo) == "function" then die() end
        if type(getgc) == "function" then die() end
    end
    -- sandbox / fake env
    if type(game) ~= "userdata" and type(game) ~= "Instance" then die() end
    if typeof and typeof(game) == "table" then die() end
    local ok, plrs = pcall(function() return game:GetService("Players") end)
    if not ok or not plrs then die() end
end
__atk()

-- ===== TU SCRIPT =====
${rawCode}
`;

    const key = crypto.randomBytes(8);
    let buf = Buffer.from(protected, 'utf8');
    for (let i = 0; i < buf.length; i++) buf[i] ^= key[i % key.length];
    const b64 = buf.toString('base64');

    const chunks = [];
    for (let i = 0; i < b64.length; i += 40) chunks.push(b64.slice(i, i + 40));

    const r = () => '_' + crypto.randomBytes(3).toString('hex');
    let junk = '';
    for (let i = 0; i < 30; i++) {
        junk += 'local ' + r() + '="' + crypto.randomBytes(6).toString('hex') + '"\n';
    }

    return ('-- IKGONAVI PROTECTED\n' + junk +
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
'if type(fn)=="function" then fn() else error("protected") end'
    );
}
