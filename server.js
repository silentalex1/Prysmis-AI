const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

function tryStartOllama() {
  try {
    const proc = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      shell: process.platform === 'win32'
    });
    proc.on('error', function() {});
    proc.on('close', function() {});
    try { proc.unref(); } catch(e) {}
  } catch (e) {}
  process.on('uncaughtException', function(e) {
    if (e && (e.code === 'ENOENT' || e.syscall === 'spawn ollama')) return;
    throw e;
  });
}

function callOllamaLocal(messages, temperature, maxTokens) {
  return new Promise((resolve, reject) => {
    const safeMax = Math.min(maxTokens || 2048, 4096);
    const cleanMsgs = messages.map(m => {
      if (typeof m.content === 'string') return { role: m.role, content: m.content };
      if (Array.isArray(m.content)) return { role: m.role, content: m.content.filter(p => p.type === 'text').map(p => p.text).join(' ') };
      return { role: m.role, content: String(m.content || '') };
    });
    const postData = JSON.stringify({
      model: 'llama3.2-vision:latest',
      messages: cleanMsgs,
      stream: false,
      options: { temperature: temperature, num_predict: safeMax }
    });
    const opts = {
      hostname: '127.0.0.1',
      port: 11434,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
      timeout: 120000
    };
    const req = http.request(opts, (ollamaRes) => {
      let data = '';
      ollamaRes.on('data', (c) => { data += c; });
      ollamaRes.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid response from model')); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', (e) => { reject(e); });
    req.write(postData);
    req.end();
  });
}

async function callOllama(messages, temperature, maxTokens) {
  try {
    const result = await callOllamaLocal(messages, temperature, maxTokens);
    return result;
  } catch (e) {
    if (e.code === 'ECONNREFUSED' || e.code === 'ENOENT') {
      throw new Error('PSM-v1.0 is starting up. Please wait a few seconds and try again.');
    }
    throw new Error(e.message || 'PSM-v1.0 could not respond. Please try again.');
  }
}

const DB_FILE = 'db.json';
const DB_BACKUP = 'db.backup.json';
const SALT = 'prysmis_v3_kx9salt2025';
const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000;
const MAX_CHATS = 100;
const MAX_PROJECTS = 500;
const MAX_COMMUNITY_MSGS = 2000;
const ALLOWED_DISCORD_IDS = ['841749813702688858', '1360884411154825336', '617174993242947585'];

let db = {
  users: {},
  projects: [],
  tokens: {},
  communityChat: [],
  admins: {},
  adminCodes: {},
  announcements: [],
  meta: { version: 5, created: Date.now() }
};
let saveScheduled = false;
const sseClients = new Set();

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db.users = parsed.users || {};
      db.projects = Array.isArray(parsed.projects) ? parsed.projects : [];
      db.tokens = parsed.tokens || {};
      db.communityChat = Array.isArray(parsed.communityChat) ? parsed.communityChat : [];
      db.admins = parsed.admins || {};
      db.adminCodes = parsed.adminCodes || {};
      db.announcements = Array.isArray(parsed.announcements) ? parsed.announcements : [];
      db.meta = parsed.meta || { version: 5, created: Date.now() };
      for (const u in db.users) {
        if (typeof db.users[u].hashed !== 'string') { delete db.users[u]; continue; }
        if (!Array.isArray(db.users[u].chats)) db.users[u].chats = [];
        if (!db.users[u].created) db.users[u].created = Date.now();
      }
      return;
    }
  } catch (_) {
    try {
      if (fs.existsSync(DB_BACKUP)) {
        const parsed = JSON.parse(fs.readFileSync(DB_BACKUP, 'utf8'));
        db.users = parsed.users || {};
        db.projects = Array.isArray(parsed.projects) ? parsed.projects : [];
        db.tokens = parsed.tokens || {};
        db.communityChat = Array.isArray(parsed.communityChat) ? parsed.communityChat : [];
        db.admins = parsed.admins || {};
        db.adminCodes = parsed.adminCodes || {};
        return;
      }
    } catch (__) {}
  }
}

function saveDb() {
  if (saveScheduled) return;
  saveScheduled = true;
  setImmediate(() => {
    saveScheduled = false;
    try {
      const json = JSON.stringify(db, null, 2);
      fs.writeFileSync(DB_FILE + '.tmp', json);
      if (fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, DB_BACKUP);
      fs.renameSync(DB_FILE + '.tmp', DB_FILE);
    } catch (_) {}
  });
}

loadDb();

function hash(p) {
  return crypto.createHash('sha256').update(p + SALT).digest('hex');
}

function randToken() {
  return crypto.randomBytes(64).toString('hex');
}

function getTokenData(t) {
  if (!t || typeof t !== 'string' || t.length < 10) return null;
  const td = db.tokens[t];
  if (!td) return null;
  if (td.expires < Date.now()) { delete db.tokens[t]; saveDb(); return null; }
  return td;
}

function getReqToken(req, url) {
  const q = url.searchParams.get('token') || '';
  const h = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  return q || h;
}

setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const t in db.tokens) {
    if (db.tokens[t].expires < now) { delete db.tokens[t]; changed = true; }
  }
  if (changed) saveDb();
}, 3600000);

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Discord-Secret',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > 20 * 1024 * 1024) { reject(new Error('Body too large')); return; }
      body += c;
    });
    req.on('end', () => {
      if (!body.trim()) { resolve({}); return; }
      try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function validateUsername(u) {
  if (typeof u !== 'string') return 'Username required';
  const t = u.trim();
  if (t.length < 3) return 'Username must be at least 3 characters';
  if (t.length > 24) return 'Username must be 24 characters or less';
  if (!/^[a-zA-Z0-9_]+$/.test(t)) return 'Letters, numbers, underscores only';
  return null;
}

function validatePassword(p) {
  if (typeof p !== 'string') return 'Password required';
  if (p.length < 6) return 'Password must be at least 6 characters';
  if (p.length > 128) return 'Password too long';
  return null;
}

const YOU_MODELS = [
  'psm-v1.0',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'gemma-7b-it',
  'llama-3.2-1b-preview',
  'llama-3.2-3b-preview',
  'llama-3.2-11b-vision-preview',
  'llama-3.2-90b-vision-preview',
  'llama-3.3-70b-specdec',
  'llama-guard-3-8b',
  'llama3-groq-70b-8192-tool-use-preview',
  'llama3-groq-8b-8192-tool-use-preview',
  'deepseek-r1-distill-llama-70b',
  'qwen-qwq-32b',
  'mistral-saba-24b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct'
];

const GROQ_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'gemma-7b-it',
  'llama-3.2-1b-preview',
  'llama-3.2-3b-preview',
  'llama-3.2-11b-vision-preview',
  'llama-3.2-90b-vision-preview',
  'llama-3.3-70b-specdec',
  'llama-guard-3-8b',
  'llama3-groq-70b-8192-tool-use-preview',
  'llama3-groq-8b-8192-tool-use-preview',
  'deepseek-r1-distill-llama-70b',
  'qwen-qwq-32b',
  'mistral-saba-24b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'playai-tts',
  'playai-tts-arabic',
  'whisper-large-v3',
  'whisper-large-v3-turbo',
  'distil-whisper-large-v3-en'
]);

const MODEL_MAP = {
  'psm-v1.0': 'psm-v1.0',
  'llama-3.3-70b-versatile': 'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant': 'llama-3.1-8b-instant',
  'llama3-70b-8192': 'llama3-70b-8192',
  'llama3-8b-8192': 'llama3-8b-8192',
  'mixtral-8x7b-32768': 'mixtral-8x7b-32768',
  'gemma2-9b-it': 'gemma2-9b-it',
  'gemma-7b-it': 'gemma-7b-it',
  'llama-3.2-1b-preview': 'llama-3.2-1b-preview',
  'llama-3.2-3b-preview': 'llama-3.2-3b-preview',
  'llama-3.2-11b-vision-preview': 'llama-3.2-11b-vision-preview',
  'llama-3.2-90b-vision-preview': 'llama-3.2-90b-vision-preview',
  'llama-3.3-70b-specdec': 'llama-3.3-70b-specdec',
  'llama-guard-3-8b': 'llama-guard-3-8b',
  'llama3-groq-70b-8192-tool-use-preview': 'llama3-groq-70b-8192-tool-use-preview',
  'llama3-groq-8b-8192-tool-use-preview': 'llama3-groq-8b-8192-tool-use-preview',
  'deepseek-r1-distill-llama-70b': 'deepseek-r1-distill-llama-70b',
  'qwen-qwq-32b': 'qwen-qwq-32b',
  'mistral-saba-24b': 'mistral-saba-24b',
  'meta-llama/llama-4-scout-17b-16e-instruct': 'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct': 'meta-llama/llama-4-maverick-17b-128e-instruct'
};

const https = require('https');

function callGroq(messages, temperature, maxTokens, groqApiKey, model) {
  return new Promise((resolve, reject) => {
    const safeMax = Math.min(maxTokens || 2048, 8192);
    const cleanMsgs = messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.filter(p => p.type === 'text').map(p => p.text).join(' ') : String(m.content || ''))
    }));
    const postData = JSON.stringify({ model: model, messages: cleanMsgs, temperature: temperature, max_tokens: safeMax });
    const opts = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + groqApiKey, 'Content-Length': Buffer.byteLength(postData) },
      timeout: 60000
    };
    const req = https.request(opts, (groqRes) => {
      let data = '';
      groqRes.on('data', (c) => { data += c; });
      groqRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) { reject(new Error(parsed.error.message || 'Groq API error')); return; }
          resolve(parsed);
        } catch (e) { reject(new Error('Invalid response from Groq')); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Groq request timeout')); });
    req.on('error', (e) => { reject(e); });
    req.write(postData);
    req.end();
  });
}

function getUserGroqKey(username) {
  const user = db.users[username] || {};
  return user.groqApiKey || null;
}

function resolveModel(m) {
  if (!m || typeof m !== 'string') return 'psm-v1.0';
  const trimmed = m.trim();
  if (YOU_MODELS.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (MODEL_MAP[lower]) return MODEL_MAP[lower];
  if (MODEL_MAP[trimmed]) return MODEL_MAP[trimmed];
  if (trimmed.includes('/')) {
    const short = trimmed.split('/').pop();
    if (short && YOU_MODELS.includes(short)) return short;
  }
  return 'psm-v1.0';
}

function broadcastSSE(data) {
  const payload = 'data: ' + JSON.stringify(data) + '\n\n';
  sseClients.forEach(res => {
    try { res.write(payload); } catch (_) { sseClients.delete(res); }
  });
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch (_) {
    res.writeHead(400); res.end(); return;
  }
  const pt = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Discord-Secret'
    });
    res.end(); return;
  }

  if (req.method === 'GET' && pt === '/community-chat/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('data: {"type":"connected"}\n\n');
    sseClients.add(res);
    const hb = setInterval(() => {
      try { res.write(': ping\n\n'); } catch (_) { clearInterval(hb); sseClients.delete(res); }
    }, 20000);
    req.on('close', () => { clearInterval(hb); sseClients.delete(res); });
    return;
  }

  if (req.method === 'POST' && pt === '/account') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const uErr = validateUsername(body.username);
    if (uErr) return sendJson(res, 400, { error: uErr });
    const pErr = validatePassword(body.password);
    if (pErr) return sendJson(res, 400, { error: pErr });
    const uname = body.username.trim().toLowerCase();
    if (db.users[uname]) return sendJson(res, 409, { error: 'Account is already created' });
    const token = randToken();
    const now = Date.now();
    db.users[uname] = { hashed: hash(body.password), created: now, lastLogin: now, lastSeen: now, loginCount: 1, chats: [], pluginToken: null, pluginConnected: false, pluginModel: 'psm-v1.0', authToken: null, authTokenCreated: null };
    db.tokens[token] = { username: uname, expires: now + TOKEN_TTL, created: now };
    saveDb();
    return sendJson(res, 200, { success: true, token, username: uname });
  }

  if (req.method === 'POST' && pt === '/login') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    if (!body.username || !body.password) return sendJson(res, 400, { error: 'Username and password required' });
    const uname = body.username.trim().toLowerCase();
    const user = db.users[uname];
    if (!user) return sendJson(res, 401, { error: 'No account found with that username' });
    if (user.hashed !== hash(body.password)) return sendJson(res, 401, { error: 'Incorrect password' });
    const token = randToken();
    const now = Date.now();
    db.tokens[token] = { username: uname, expires: now + TOKEN_TTL, created: now };
    user.lastLogin = now; user.lastSeen = now;
    user.loginCount = (user.loginCount || 0) + 1;
    saveDb();
    return sendJson(res, 200, { success: true, token, username: uname });
  }

  if (req.method === 'POST' && pt === '/admin/create') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const { username, password, code } = body;
    if (!username || !password || !code) return sendJson(res, 400, { error: 'Username, password and code required' });
    const uname = username.trim().toLowerCase();
    const codeClean = code.trim();
    const pErr = validatePassword(password);
    if (pErr) return sendJson(res, 400, { error: pErr });
    if (!db.adminCodes[uname]) return sendJson(res, 401, { error: 'No code found for this username. Use /generatecode in Discord first.' });
    const codeData = db.adminCodes[uname];
    if (codeData.expires < Date.now()) { delete db.adminCodes[uname]; saveDb(); return sendJson(res, 401, { error: 'Code expired. Request a new one via Discord.' }); }
    if (codeData.code !== codeClean) return sendJson(res, 401, { error: 'Invalid code.' });
    if (!db.users[uname]) return sendJson(res, 404, { error: 'No website account found for this username.' });
    db.admins[uname] = { hashed: hash(password), linkedUsername: uname, grantedBy: codeData.grantedBy || 'discord', created: Date.now(), lastLogin: null, verified: true };
    delete db.adminCodes[uname];
    const token = randToken();
    const now = Date.now();
    db.tokens[token] = { username: uname, expires: now + TOKEN_TTL, created: now, isAdmin: true };
    saveDb();
    return sendJson(res, 200, { success: true, token, username: uname, isAdmin: true });
  }

  if (req.method === 'POST' && pt === '/admin/login') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    if (!body.username || !body.password) return sendJson(res, 400, { error: 'Username and password required' });
    const uname = body.username.trim().toLowerCase();
    const admin = db.admins[uname];
    if (!admin) return sendJson(res, 401, { error: 'No admin account found' });
    if (admin.hashed !== hash(body.password)) return sendJson(res, 401, { error: 'Incorrect password' });
    const token = randToken();
    const now = Date.now();
    db.tokens[token] = { username: uname, expires: now + TOKEN_TTL, created: now, isAdmin: true };
    admin.lastLogin = now;
    saveDb();
    return sendJson(res, 200, { success: true, token, username: uname, isAdmin: true });
  }

  if (req.method === 'POST' && pt === '/discord/generate-code') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const { discordUserId, username } = body;
    if (!ALLOWED_DISCORD_IDS.includes(discordUserId)) return sendJson(res, 403, { error: 'Discord user not authorized' });
    if (!username) return sendJson(res, 400, { error: 'username required' });
    const uname = username.trim().toLowerCase();
    if (!db.users[uname]) return sendJson(res, 404, { error: 'No website account for ' + uname + '. They must register first.' });
    const digits = '0123456789';
    const symbols = '!@-_=+?';
    const all = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const len = 6 + Math.floor(Math.random() * 3);
    let suffix = '';
    for (let i = 0; i < len; i++) {
      const pick = Math.floor(Math.random() * 3);
      if (pick === 0) suffix += digits[Math.floor(Math.random() * digits.length)];
      else if (pick === 1) suffix += symbols[Math.floor(Math.random() * symbols.length)];
      else suffix += all[Math.floor(Math.random() * all.length)];
    }
    const code = 'PrysmisAI_admin' + suffix;
    db.adminCodes[uname] = { code, grantedBy: discordUserId, created: Date.now(), expires: Date.now() + 30 * 60 * 1000 };
    saveDb();
    return sendJson(res, 200, { success: true, code, username: uname, expiresIn: '30 minutes' });
  }

  if (req.method === 'POST' && pt === '/discord/verify-code') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const { code, discordUserId } = body;
    if (!code) return sendJson(res, 400, { error: 'code required' });
    let foundUname = null;
    for (const u in db.adminCodes) {
      if (db.adminCodes[u].code === code.trim()) { foundUname = u; break; }
    }
    if (!foundUname) return sendJson(res, 404, { error: 'Invalid code' });
    const codeData = db.adminCodes[foundUname];
    if (codeData.expires < Date.now()) { delete db.adminCodes[foundUname]; saveDb(); return sendJson(res, 401, { error: 'Code expired' }); }
    return sendJson(res, 200, { success: true, username: foundUname });
  }

  if (req.method === 'POST' && pt === '/discord/savedata') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const { discordUserId } = body;
    if (!ALLOWED_DISCORD_IDS.includes(discordUserId)) return sendJson(res, 403, { error: 'Discord user not authorized' });
    try {
      const json = JSON.stringify(db, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.writeFileSync('db_backup_' + timestamp + '.json', json);
      return sendJson(res, 200, { success: true, message: 'Data saved', users: Object.keys(db.users).length, timestamp });
    } catch (e) {
      return sendJson(res, 500, { error: 'Failed to save: ' + e.message });
    }
  }

  if (req.method === 'GET' && pt === '/discord/ping') {
    return sendJson(res, 200, { ok: true, status: 'connected', site: 'prysmisai.wtf', users: Object.keys(db.users).length, admins: Object.keys(db.admins).length });
  }

  if (req.method === 'POST' && pt === '/discord/connect') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const { discordUserId, botTag } = body;
    if (!ALLOWED_DISCORD_IDS.includes(discordUserId)) return sendJson(res, 403, { error: 'Discord user not authorized' });
    db.meta.botConnected = true;
    db.meta.botConnectedAt = Date.now();
    db.meta.botTag = botTag || 'unknown';
    db.meta.botOperatorId = discordUserId;
    saveDb();
    return sendJson(res, 200, { ok: true, message: 'Bot connected to PrysmisAI', site: 'prysmisai.wtf' });
  }

  if (req.method === 'POST' && pt === '/discord/setadmin') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const { discordUserId, username, password } = body;
    if (!ALLOWED_DISCORD_IDS.includes(discordUserId)) return sendJson(res, 403, { error: 'Discord user not authorized' });
    if (!username || !password) return sendJson(res, 400, { error: 'username and password required' });
    const uname = username.trim().toLowerCase();
    if (!db.users[uname]) return sendJson(res, 404, { error: 'Username not found. User must register on the website first.' });
    db.admins[uname] = { hashed: hash(password), linkedUsername: uname, grantedBy: discordUserId, created: Date.now(), lastLogin: null };
    saveDb();
    return sendJson(res, 200, { success: true, message: 'Admin account created for ' + uname });
  }

  if (req.method === 'POST' && pt === '/discord/blacklist') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const { discordUserId, adminUsername } = body;
    if (!ALLOWED_DISCORD_IDS.includes(discordUserId)) return sendJson(res, 403, { error: 'Discord user not authorized' });
    if (!adminUsername) return sendJson(res, 400, { error: 'adminUsername required' });
    const uname = adminUsername.trim().toLowerCase();
    if (!db.admins[uname]) return sendJson(res, 404, { error: 'Admin account not found' });
    delete db.admins[uname];
    for (const t in db.tokens) { if (db.tokens[t].username === uname && db.tokens[t].isAdmin) delete db.tokens[t]; }
    saveDb();
    return sendJson(res, 200, { success: true, message: 'Admin account removed for ' + uname });
  }

  if (req.method === 'POST' && pt === '/discord/notify-ready') {
    db.meta.ollamaReady = true;
    db.meta.ollamaReadyAt = Date.now();
    saveDb();
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pt === '/discord/run-ollama') {
    const ollamaStatus = await new Promise((resolve) => {
      const checkReq = http.request({ hostname: '127.0.0.1', port: 11434, path: '/api/tags', method: 'GET', timeout: 4000 }, (r) => {
        let d = '';
        r.on('data', (c) => { d += c; });
        r.on('end', () => {
          try {
            const parsed = JSON.parse(d);
            const models = (parsed.models || []).map(m => m.name);
            const hasModel = models.some(m => m === 'llama3.2-vision:latest');
            resolve({ running: true, hasModel, models });
          } catch (e) { resolve({ running: true, hasModel: false, models: [] }); }
        });
      });
      checkReq.on('error', () => resolve({ running: false, hasModel: false, models: [] }));
      checkReq.on('timeout', () => { checkReq.destroy(); resolve({ running: false, hasModel: false, models: [] }); });
      checkReq.end();
    });
    if (ollamaStatus.running && ollamaStatus.hasModel) {
      return sendJson(res, 200, { success: true, message: 'PSM-v1.0 is running and ready.', model: 'llama3.2-vision:latest', status: 'ready' });
    }
    if (ollamaStatus.running && !ollamaStatus.hasModel) {
      return sendJson(res, 200, { success: false, message: 'Ollama is running but llama3.2-vision:latest is not installed. Run: ollama pull llama3.2-vision:latest', status: 'model_missing', installed: ollamaStatus.models });
    }
    try {
      const isWin = process.platform === 'win32';
      const ollamaProcess = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore', shell: isWin });
      ollamaProcess.on('error', function() {});
      try { ollamaProcess.unref(); } catch(e) {}
    } catch (spawnErr) {
      return sendJson(res, 500, { success: false, error: 'Ollama is not installed or not reachable on this server.', status: 'not_found' });
    }
    const waitReady = () => new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 30;
      const interval = setInterval(() => {
        attempts++;
        const chk = http.request({ hostname: '127.0.0.1', port: 11434, path: '/api/tags', method: 'GET', timeout: 2000 }, (r) => {
          let d = '';
          r.on('data', (c) => { d += c; });
          r.on('end', () => {
            try {
              const parsed = JSON.parse(d);
              const models = (parsed.models || []).map(m => m.name);
              const hasModel = models.some(m => m === 'llama3.2-vision:latest');
              if (hasModel) { clearInterval(interval); resolve({ ready: true }); }
              else if (attempts >= maxAttempts) { clearInterval(interval); resolve({ ready: false, reason: 'timeout' }); }
            } catch (e) {
              if (attempts >= maxAttempts) { clearInterval(interval); resolve({ ready: false, reason: 'timeout' }); }
            }
          });
        });
        chk.on('error', () => { if (attempts >= maxAttempts) { clearInterval(interval); resolve({ ready: false, reason: 'timeout' }); } });
        chk.on('timeout', () => { chk.destroy(); });
        chk.end();
      }, 2000);
    });
    const readyResult = await waitReady();
    if (readyResult.ready) {
      return sendJson(res, 200, { success: true, message: 'PSM-v1.0 is running and ready.', model: 'llama3.2-vision:latest', status: 'ready' });
    }
    return sendJson(res, 200, { success: false, message: 'Ollama started but model took too long to load. Try again in a moment.', status: 'starting' });
  }

  if (req.method === 'POST' && pt === '/discord/set-ollama-service') {
    try {
      const isWin = process.platform === 'win32';
      if (!isWin) {
        return sendJson(res, 400, { success: false, error: 'Windows service setup only works on Windows' });
      }
      
      const serviceName = 'OllamaPSM';
      const ollamaPath = 'ollama';
      
      const nssmPath = path.join(process.cwd(), 'nssm.exe');
      let useNssm = fs.existsSync(nssmPath);
      
      if (useNssm) {
        const nssmInstall = spawn(nssmPath, ['install', serviceName, ollamaPath, 'serve'], {
          windowsHide: true,
          stdio: 'pipe'
        });
        
        let output = '';
        nssmInstall.stdout.on('data', (d) => { output += d; });
        nssmInstall.stderr.on('data', (d) => { output += d; });
        
        nssmInstall.on('close', (code) => {
          if (code === 0) {
            spawn(nssmPath, ['set', serviceName, 'Description', 'Ollama AI Service for PrysmisAI'], { windowsHide: true });
            spawn(nssmPath, ['set', serviceName, 'Start', 'SERVICE_AUTO_START'], { windowsHide: true });
            spawn(nssmPath, ['start', serviceName], { windowsHide: true });
            return sendJson(res, 200, { 
              success: true, 
              message: 'Ollama service installed and started. It will auto-start on Windows boot.',
              service_name: serviceName,
              method: 'nssm'
            });
          } else {
            return sendJson(res, 500, { success: false, error: 'NSSM install failed: ' + output });
          }
        });
      } else {
        const psScript = `
          $serviceName = "${serviceName}"
          $binaryPath = "ollama serve"
          
          if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) {
            Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
            sc.exe delete $serviceName | Out-Null
            Start-Sleep -Seconds 2
          }
          
          sc.exe create $serviceName binPath= "cmd.exe /c start /min ollama serve" start= auto displayname= "Ollama PSM Service"
          sc.exe description $serviceName "Ollama AI Service for PrysmisAI - Auto-starts on boot"
          Start-Service -Name $serviceName -ErrorAction SilentlyContinue
          
          Write-Host "Service created successfully"
        `;
        
        const psPath = path.join(process.env.TEMP || '/tmp', 'ollama-service.ps1');
        fs.writeFileSync(psPath, psScript);
        
        const ps = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', psPath], {
          windowsHide: true,
          stdio: 'pipe'
        });
        
        let output = '';
        ps.stdout.on('data', (d) => { output += d; });
        ps.stderr.on('data', (d) => { output += d; });
        
        ps.on('close', (code) => {
          try { fs.unlinkSync(psPath); } catch (e) {}
          
          if (code === 0) {
            return sendJson(res, 200, { 
              success: true, 
              message: 'Ollama Windows service created and started. It will auto-start on every Windows boot.',
              service_name: serviceName,
              method: 'sc.exe'
            });
          } else {
            return sendJson(res, 500, { success: false, error: 'Service creation failed: ' + output });
          }
        });
      }
    } catch (error) {
      return sendJson(res, 500, { success: false, error: 'Failed to setup service: ' + error.message });
    }
  }

  if (req.method === 'GET' && pt === '/discord/check-user') {
    const username = url.searchParams.get('username');
    if (!username) return sendJson(res, 400, { error: 'username required' });
    const uname = username.trim().toLowerCase();
    return sendJson(res, 200, { exists: !!db.users[uname], isAdmin: !!db.admins[uname], username: uname });
  }

  if (req.method === 'GET' && pt === '/me') {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    user.lastSeen = Date.now();
    const isAdmin = !!db.admins[td.username];
    return sendJson(res, 200, { username: td.username, created: user.created, lastLogin: user.lastLogin, chatCount: (user.chats || []).length, loginCount: user.loginCount || 1, isAdmin, premium: isAdmin || !!user.premium, rank: user.rank || null });
  }

  if (req.method === 'POST' && pt === '/admin/set-rank') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const isDiscordReq = true;
    if (!isDiscordReq) {
      const td = getTokenData(getReqToken(req, url));
      if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
      const rawToken = getReqToken(req, url);
      if (!db.tokens[rawToken] || !db.tokens[rawToken].isAdmin) return sendJson(res, 403, { error: 'Admin access required' });
    }
    const { username, rank, discordUserId } = body;
    if (isDiscordReq && !ALLOWED_DISCORD_IDS.includes(discordUserId)) return sendJson(res, 403, { error: 'Discord user not authorized' });
    if (!username) return sendJson(res, 400, { error: 'username required' });
    const uname = username.trim().toLowerCase();
    if (!db.users[uname]) return sendJson(res, 404, { error: 'User not found' });
    const validRanks = ['early access', 'premium', 'chat mod', 'owner', null, ''];
    if (!validRanks.includes(rank)) return sendJson(res, 400, { error: 'Invalid rank' });
    db.users[uname].rank = rank || null;
    if (rank === 'premium') db.users[uname].premium = true;
    saveDb();
    return sendJson(res, 200, { success: true, username: uname, rank: db.users[uname].rank });
  }

  if (req.method === 'POST' && pt === '/admin/set-premium') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const isDiscordRequest = true;
    if (!isDiscordRequest) {
      const td = getTokenData(getReqToken(req, url));
      if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
      const rawToken = getReqToken(req, url);
      if (!db.tokens[rawToken] || !db.tokens[rawToken].isAdmin) return sendJson(res, 403, { error: 'Admin access required' });
    }
    const { username, premium, discordUserId } = body;
    if (isDiscordRequest && !ALLOWED_DISCORD_IDS.includes(discordUserId)) return sendJson(res, 403, { error: 'Discord user not authorized' });
    if (!username) return sendJson(res, 400, { error: 'username required' });
    const uname = username.trim().toLowerCase();
    if (!db.users[uname]) return sendJson(res, 404, { error: 'User not found' });
    db.users[uname].premium = !!premium;
    if (premium && !db.users[uname].rank) db.users[uname].rank = 'premium';
    saveDb();
    return sendJson(res, 200, { success: true, username: uname, premium: db.users[uname].premium });
  }

  if (req.method === 'POST' && pt === '/logout') {
    const t = getReqToken(req, url);
    if (t && db.tokens[t]) { delete db.tokens[t]; saveDb(); }
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'GET' && pt === '/announcements') {
    return sendJson(res, 200, Array.isArray(db.announcements) ? db.announcements : []);
  }

  if (req.method === 'POST' && pt === '/announcements') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    if (!db.admins[td.username]) return sendJson(res, 403, { error: 'Admin only' });
    const { title, description } = body;
    if (!title || !title.trim()) return sendJson(res, 400, { error: 'Title required' });
    if (!description || !description.trim()) return sendJson(res, 400, { error: 'Description required' });
    if (!Array.isArray(db.announcements)) db.announcements = [];
    const ann = { id: crypto.randomBytes(8).toString('hex'), title: title.trim(), description: description.trim(), author: td.username, created: Date.now() };
    db.announcements.unshift(ann);
    if (db.announcements.length > 100) db.announcements = db.announcements.slice(0, 100);
    saveDb();
    return sendJson(res, 200, { success: true, announcement: ann });
  }

  if (req.method === 'DELETE' && pt.startsWith('/announcements/')) {
    const annId = pt.slice('/announcements/'.length);
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    if (!db.admins[td.username]) return sendJson(res, 403, { error: 'Admin only' });
    if (!Array.isArray(db.announcements)) return sendJson(res, 404, { error: 'Not found' });
    const idx = db.announcements.findIndex(a => a.id === annId);
    if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
    db.announcements.splice(idx, 1);
    saveDb();
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'GET' && pt === '/stats') {
    const now = Date.now();
    return sendJson(res, 200, { users: Object.keys(db.users).length, active: Math.max(Object.values(db.tokens).filter(t => t.expires > now).length, 1), projects: db.projects.length });
  }

  if (req.method === 'GET' && pt === '/status') {
    const pluginToken = url.searchParams.get('pluginToken') || '';
    let status = 'disconnected', model = 'psm-v1.0', username = 'unknown';
    if (pluginToken) {
      for (const u in db.users) {
        if (db.users[u].pluginToken === pluginToken) { status = db.users[u].pluginConnected ? 'connected' : 'disconnected'; model = db.users[u].pluginModel || 'psm-v1.0'; username = u; break; }
      }
    }
    return sendJson(res, 200, { status, model, user: username });
  }

  if (req.method === 'POST' && pt === '/plugin/connect') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    const pluginToken = crypto.randomBytes(24).toString('hex');
    user.pluginToken = pluginToken;
    user.pluginConnected = true;
    user.pluginModel = resolveModel(body.model);
    user.pluginConnectedAt = Date.now();
    saveDb();
    return sendJson(res, 200, { success: true, pluginToken, username: td.username, model: user.pluginModel });
  }

  if (req.method === 'POST' && pt === '/plugin/disconnect') {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (user) { user.pluginConnected = false; saveDb(); }
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'POST' && pt === '/plugin/verify') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    if (!body.pluginToken) return sendJson(res, 400, { error: 'pluginToken required' });
    for (const u in db.users) {
      if (db.users[u].pluginToken === body.pluginToken) {
        db.users[u].pluginConnected = true; db.users[u].pluginLastPing = Date.now(); saveDb();
        return sendJson(res, 200, { success: true, username: u, model: db.users[u].pluginModel || 'psm-v1.0', connected: true });
      }
    }
    return sendJson(res, 401, { error: 'Invalid plugin token' });
  }

  if (req.method === 'POST' && pt === '/plugin/ping') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    if (!body.pluginToken) return sendJson(res, 400, { error: 'pluginToken required' });
    for (const u in db.users) {
      if (db.users[u].pluginToken === body.pluginToken) {
        db.users[u].pluginLastPing = Date.now(); db.users[u].pluginConnected = true; saveDb();
        return sendJson(res, 200, { ok: true, model: db.users[u].pluginModel || 'psm-v1.0', user: u });
      }
    }
    return sendJson(res, 401, { error: 'Invalid plugin token' });
  }

  if (req.method === 'POST' && pt === '/plugin/update-model') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    if (!body.model) return sendJson(res, 400, { error: 'model required' });
    user.pluginModel = resolveModel(body.model);
    saveDb();
    return sendJson(res, 200, { success: true, model: user.pluginModel });
  }

  if (req.method === 'POST' && pt === '/auth-token/generate') {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    const now = Date.now();
    if (user.authToken && user.authTokenCreated && (now - user.authTokenCreated) < 24 * 3600000) {
      const h = Math.ceil((user.authTokenCreated + 24 * 3600000 - now) / 3600000);
      return sendJson(res, 429, { error: 'You can generate a new token in ' + h + ' hour' + (h === 1 ? '' : 's') });
    }
    const authToken = crypto.randomBytes(4).toString('hex') + '-' + crypto.randomBytes(4).toString('hex') + '-' + crypto.randomBytes(4).toString('hex');
    user.authToken = authToken; user.authTokenCreated = now; saveDb();
    return sendJson(res, 200, { success: true, authToken, url: 'prysmisai.wtf/token/' + authToken });
  }

  if (req.method === 'GET' && pt === '/auth-token') {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    const now = Date.now();
    return sendJson(res, 200, { authToken: user.authToken || null, canGenerate: !user.authTokenCreated || (now - user.authTokenCreated) >= 24 * 3600000, url: user.authToken ? 'prysmisai.wtf/token/' + user.authToken : null });
  }

  if (req.method === 'GET' && pt === '/projects') {
    return sendJson(res, 200, db.projects);
  }

  if (req.method === 'POST' && pt === '/projects') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'You must be logged in to post a project' });
    const { title, link, about } = body;
    if (!title || !title.trim()) return sendJson(res, 400, { error: 'Title required' });
    if (!link || !link.trim()) return sendJson(res, 400, { error: 'Link required' });
    if (!about || !about.trim()) return sendJson(res, 400, { error: 'Description required' });
    if (title.trim().length > 80) return sendJson(res, 400, { error: 'Title too long' });
    if (about.trim().length > 500) return sendJson(res, 400, { error: 'Description too long' });
    if (db.projects.length >= MAX_PROJECTS) db.projects.pop();
    const project = { id: crypto.randomBytes(10).toString('hex'), title: title.trim(), link: link.trim(), about: about.trim(), author: td.username, created: Date.now() };
    db.projects.unshift(project); saveDb();
    return sendJson(res, 200, { success: true, project });
  }

  if (req.method === 'DELETE' && pt.startsWith('/projects/')) {
    const id = pt.slice('/projects/'.length);
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const idx = db.projects.findIndex(p => p.id === id);
    if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
    const isAdminUser = !!db.admins[td.username];
    if (db.projects[idx].author !== td.username && !isAdminUser) return sendJson(res, 403, { error: 'Not your project' });
    db.projects.splice(idx, 1); saveDb();
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'DELETE' && pt === '/community-chat') {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    if (!db.admins[td.username]) return sendJson(res, 403, { error: 'Admin only' });
    db.communityChat = [];
    saveDb();
    broadcastSSE({ type: 'clear_chat' });
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'GET' && pt === '/community-chat') {
    return sendJson(res, 200, db.communityChat.slice(-200));
  }

  if (req.method === 'POST' && pt === '/community-chat') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    if (!body.text || !body.text.trim()) return sendJson(res, 400, { error: 'Message required' });
    if (body.text.trim().length > 500) return sendJson(res, 400, { error: 'Message too long' });
    const isAdminSender = !!db.admins[td.username]; const senderUser = db.users[td.username] || {};
    const msg = { id: crypto.randomBytes(8).toString('hex'), author: td.username, isAdmin: isAdminSender, rank: isAdminSender ? 'admin' : (senderUser.rank || null), text: body.text.trim(), replyTo: body.replyTo || null, created: Date.now(), edited: false };
    db.communityChat.push(msg);
    if (db.communityChat.length > MAX_COMMUNITY_MSGS) db.communityChat = db.communityChat.slice(-MAX_COMMUNITY_MSGS);
    saveDb(); broadcastSSE({ type: 'new_message', msg });
    return sendJson(res, 200, { success: true, msg });
  }

  if (req.method === 'PUT' && pt.startsWith('/community-chat/')) {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const id = pt.slice('/community-chat/'.length);
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const idx = db.communityChat.findIndex(m => m.id === id);
    if (idx === -1) return sendJson(res, 404, { error: 'Message not found' });
    if (db.communityChat[idx].author !== td.username) return sendJson(res, 403, { error: 'Not your message' });
    if (!body.text || !body.text.trim()) return sendJson(res, 400, { error: 'Text required' });
    if (body.text.trim().length > 500) return sendJson(res, 400, { error: 'Message too long' });
    db.communityChat[idx].text = body.text.trim(); db.communityChat[idx].edited = true; db.communityChat[idx].editedAt = Date.now();
    saveDb(); broadcastSSE({ type: 'edit_message', msg: db.communityChat[idx] });
    return sendJson(res, 200, { success: true, msg: db.communityChat[idx] });
  }

  if (req.method === 'DELETE' && pt.startsWith('/community-chat/')) {
    const id = pt.slice('/community-chat/'.length);
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const idx = db.communityChat.findIndex(m => m.id === id);
    if (idx === -1) return sendJson(res, 404, { error: 'Message not found' });
    const isAdminUser = !!db.admins[td.username];
    if (db.communityChat[idx].author !== td.username && !isAdminUser) return sendJson(res, 403, { error: 'Not your message' });
    db.communityChat.splice(idx, 1); saveDb();
    broadcastSSE({ type: 'delete_message', id });
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'GET' && pt === '/chats') {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    return sendJson(res, 200, Array.isArray(user.chats) ? user.chats : []);
  }

  if (req.method === 'POST' && pt === '/chats') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    if (!body.title || !Array.isArray(body.messages) || body.messages.length === 0) return sendJson(res, 400, { error: 'title and messages required' });
    if (!Array.isArray(user.chats)) user.chats = [];
    const chat = { id: crypto.randomBytes(10).toString('hex'), title: body.title.substring(0, 40), messages: body.messages.slice(0, 200), created: Date.now(), updated: Date.now() };
    user.chats.unshift(chat);
    if (user.chats.length > MAX_CHATS) user.chats = user.chats.slice(0, MAX_CHATS);
    saveDb(); return sendJson(res, 200, { success: true, chat });
  }

  if (req.method === 'PUT' && pt.startsWith('/chats/')) {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const id = pt.slice('/chats/'.length);
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user || !Array.isArray(user.chats)) return sendJson(res, 404, { error: 'User not found' });
    const idx = user.chats.findIndex(c => c.id === id);
    if (idx === -1) return sendJson(res, 404, { error: 'Chat not found' });
    if (Array.isArray(body.messages)) user.chats[idx].messages = body.messages.slice(0, 200);
    if (typeof body.title === 'string') user.chats[idx].title = body.title.substring(0, 40);
    user.chats[idx].updated = Date.now(); saveDb();
    return sendJson(res, 200, { success: true, chat: user.chats[idx] });
  }

  if (req.method === 'DELETE' && pt.startsWith('/chats/')) {
    const id = pt.slice('/chats/'.length);
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user || !Array.isArray(user.chats)) return sendJson(res, 404, { error: 'User not found' });
    const idx = user.chats.findIndex(c => c.id === id);
    if (idx === -1) return sendJson(res, 404, { error: 'Chat not found' });
    user.chats.splice(idx, 1); saveDb();
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'POST' && pt === '/account/change-username') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const { newUsername } = body;
    const uErr = validateUsername(newUsername);
    if (uErr) return sendJson(res, 400, { error: uErr });
    const oldUname = td.username;
    const newUname = newUsername.trim().toLowerCase();
    if (oldUname === newUname) return sendJson(res, 400, { error: 'That is already your username' });
    if (db.users[newUname]) return sendJson(res, 409, { error: 'Username is already taken' });
    db.users[newUname] = db.users[oldUname];
    delete db.users[oldUname];
    for (const t in db.tokens) { if (db.tokens[t].username === oldUname) db.tokens[t].username = newUname; }
    db.communityChat.forEach(function(m) { if (m.author === oldUname) m.author = newUname; });
    db.projects.forEach(function(p) { if (p.author === oldUname) p.author = newUname; });
    if (db.admins[oldUname]) { db.admins[newUname] = db.admins[oldUname]; delete db.admins[oldUname]; }
    saveDb();
    return sendJson(res, 200, { success: true, username: newUname });
  }

  if (req.method === 'GET' && pt === '/adminpanel') {
    fs.readFile('./adminpanel/index.html', (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(data);
    }); return;
  }

  if (req.method === 'GET' && pt === '/admin/users') {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const rawToken = getReqToken(req, url);
    if (!db.tokens[rawToken] || !db.tokens[rawToken].isAdmin) return sendJson(res, 403, { error: 'Admin access required' });
    const users = Object.entries(db.users).map(([uname, u]) => ({ username: uname, created: u.created, lastLogin: u.lastLogin, chatCount: (u.chats || []).length, loginCount: u.loginCount || 1, isAdmin: !!db.admins[uname], premium: !!u.premium || !!db.admins[uname], rank: db.admins[uname] ? 'admin' : (u.rank || null) }));
    return sendJson(res, 200, { users, adminCount: Object.keys(db.admins).length });
  }

  if (req.method === 'DELETE' && pt.startsWith('/admin/users/')) {
    const uname = decodeURIComponent(pt.slice('/admin/users/'.length)).toLowerCase();
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const rawToken = getReqToken(req, url);
    if (!db.tokens[rawToken] || !db.tokens[rawToken].isAdmin) return sendJson(res, 403, { error: 'Admin access required' });
    if (!db.users[uname]) return sendJson(res, 404, { error: 'User not found' });
    if (db.admins[uname]) return sendJson(res, 403, { error: 'Cannot remove an admin. Blacklist them via Discord first.' });
    delete db.users[uname];
    for (const t in db.tokens) { if (db.tokens[t].username === uname) delete db.tokens[t]; }
    db.communityChat = db.communityChat.filter(m => m.author !== uname);
    db.projects = db.projects.filter(p => p.author !== uname);
    saveDb(); broadcastSSE({ type: 'user_removed', username: uname });
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'POST' && pt === '/plugin/files') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    if (!body.pluginToken) return sendJson(res, 400, { error: 'pluginToken required' });
    for (const u in db.users) {
      if (db.users[u].pluginToken === body.pluginToken) {
        db.users[u].studioFiles = Array.isArray(body.files) ? body.files : [];
        db.users[u].studioFilesUpdated = Date.now();
        saveDb();
        return sendJson(res, 200, { ok: true });
      }
    }
    return sendJson(res, 401, { error: 'Invalid plugin token' });
  }

  if (req.method === 'GET' && pt === '/plugin/files') {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    return sendJson(res, 200, { files: user.studioFiles || [], updated: user.studioFilesUpdated || null });
  }

  if (req.method === 'POST' && pt === '/plugin/execute') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    if (!user.pluginConnected) return sendJson(res, 400, { error: 'Plugin not connected' });
    if (!body.code || !body.code.trim()) return sendJson(res, 400, { error: 'code required' });
    if (!Array.isArray(user.pendingChanges)) user.pendingChanges = [];
    const change = { id: crypto.randomBytes(6).toString('hex'), code: body.code.trim(), description: body.description || '', created: Date.now() };
    user.pendingChanges.push(change);
    if (user.pendingChanges.length > 20) user.pendingChanges = user.pendingChanges.slice(-20);
    saveDb();
    return sendJson(res, 200, { ok: true, changeId: change.id });
  }

  if (req.method === 'GET' && pt === '/plugin/pending') {
    const pluginToken = url.searchParams.get('pluginToken') || '';
    if (!pluginToken) return sendJson(res, 400, { error: 'pluginToken required' });
    for (const u in db.users) {
      if (db.users[u].pluginToken === pluginToken) {
        const changes = db.users[u].pendingChanges || [];
        db.users[u].pendingChanges = [];
        if (changes.length > 0) saveDb();
        return sendJson(res, 200, { changes });
      }
    }
    return sendJson(res, 401, { error: 'Invalid plugin token' });
  }

  const host = (req.headers['host'] || '').split(':')[0];
  const isApiSubdomain = host === 'api.prysmisai.wtf';

  if (req.method === 'POST' && pt === '/account/generate-prysmisai-key') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    
    const now = Date.now();
    const oneDay = 24 * 3600000;
    
    if (!user.apiKeyGenerationHistory) user.apiKeyGenerationHistory = [];
    
    const recentGenerations = user.apiKeyGenerationHistory.filter(time => now - time < oneDay);
    
    if (recentGenerations.length >= 3) {
      const oldestGeneration = Math.min(...recentGenerations);
      const waitTime = Math.ceil((oldestGeneration + oneDay - now) / (60 * 60 * 1000));
      return sendJson(res, 429, { error: `After 3 generation of PrysmisAI API key you must wait 24 hours. Please wait ${waitTime} more hours.` });
    }
    
    const apiKey = 'ps-prysmisai-' + crypto.randomBytes(20).toString('hex');
    
    if (!user.prysmisApiKeys) user.prysmisApiKeys = [];
    user.prysmisApiKeys.push({ key: apiKey, created: now });
    user.apiKeyGenerationHistory.push(now);
    
    saveDb();
    return sendJson(res, 200, { success: true, apiKey });
  }

  if (req.method === 'GET' && pt === '/account/prysmisai-keys') {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    
    const now = Date.now();
    const oneDay = 24 * 3600000;
    const recentGenerations = (user.apiKeyGenerationHistory || []).filter(time => now - time < oneDay);
    const canGenerate = recentGenerations.length < 3;
    
    return sendJson(res, 200, { 
      keys: user.prysmisApiKeys || [], 
      canGenerate,
      generationsLeft: Math.max(0, 3 - recentGenerations.length)
    });
  }

  if (req.method === 'GET' && pt === '/api/health') {
    tryStartOllama();
    const ollamaHealth = await new Promise((resolve) => {
      const opts = { hostname: '127.0.0.1', port: 11434, path: '/api/tags', method: 'GET', timeout: 5000 };
      const hreq = http.request(opts, (hres) => {
        let data = '';
        hres.on('data', (c) => { data += c; });
        hres.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const models = parsed.models || [];
            const hasModel = models.some(m => m.name === 'llama3.2-vision:latest');
            resolve({ ok: hasModel, reachable: true, model_available: hasModel, installed_models: models.map(m => m.name) });
          } catch (e) {
            resolve({ ok: false, reachable: true, model_available: false, error: 'Invalid Ollama response' });
          }
        });
      });
      hreq.on('error', () => resolve({ ok: false, reachable: false, model_available: false, error: 'Ollama starting up...' }));
      hreq.on('timeout', () => { hreq.destroy(); resolve({ ok: false, reachable: false, model_available: false, error: 'Ollama timeout' }); });
      hreq.end();
    });
    return sendJson(res, 200, {
      ok: ollamaHealth.ok,
      service: 'prysmisai-web',
      model: { display_name: 'PSM-v1.0(PrysmisAI)', runtime_model: 'llama3.2-vision:latest' },
      ollama: ollamaHealth
    });
  }

  if (req.method === 'GET' && pt === '/api/meta') {
    const baseUrl = 'https://' + (req.headers['host'] || 'api.prysmisai.wtf');
    return sendJson(res, 200, {
      brand: 'PrysmisAI',
      model: {
        display_name: 'PSM-v1.0(PrysmisAI)',
        runtime_model: 'llama3.2-vision:latest'
      },
      api: {
        base_url: baseUrl,
        endpoint: '/api/v1/chat/completions',
        key_prefix: 'ps-prysmisai-',
        key_limit: 3,
        window_hours: 24,
        key_notice: 'After 3 generation of PrysmisAI API key you must wait 24 hours.'
      }
    });
  }

  if (req.method === 'GET' && pt === '/api/settings/groq-key') {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Unauthorized' });
    const user = db.users[td.username] || {};
    const key = user.groqApiKey || '';
    return sendJson(res, 200, { groqApiKey: key ? key.substring(0, 8) + '****' + key.slice(-4) : '', hasKey: !!key });
  }

  if (req.method === 'POST' && pt === '/api/settings/groq-key') {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Unauthorized' });
    let body;
    try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const key = typeof body.groqApiKey === 'string' ? body.groqApiKey.trim() : '';
    if (!db.users[td.username]) db.users[td.username] = {};
    db.users[td.username].groqApiKey = key;
    saveDb();
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'DELETE' && pt === '/api/settings/groq-key') {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Unauthorized' });
    if (db.users[td.username]) { db.users[td.username].groqApiKey = ''; saveDb(); }
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'GET' && pt === '/api/settings/api-keys') {
    const clientId = req.headers['x-prysmisai-client'] || 'local-user';
    const td = getTokenData(getReqToken(req, url));
    const effectiveClientId = td ? td.username : clientId;
    
    const now = Date.now();
    const oneDay = 24 * 3600000;
    const user = db.users[effectiveClientId] || {};
    const recentGenerations = (user.apiKeyGenerationHistory || []).filter(time => now - time < oneDay);
    const remaining = Math.max(0, 3 - recentGenerations.length);
    const nextGenerationAt = remaining === 0 && recentGenerations.length > 0 
      ? new Date(Math.min(...recentGenerations) + oneDay).toISOString()
      : null;
    
    return sendJson(res, 200, {
      label: 'PrysmisAI API Key',
      description: 'After 3 generation of PrysmisAI API key you must wait 24 hours.',
      status: {
        limit: 3,
        window_hours: 24,
        generated_in_window: recentGenerations.length,
        remaining: remaining,
        next_generation_at: nextGenerationAt
      },
      keys: (user.prysmisApiKeys || []).map(k => ({
        id: k.created,
        api_key: k.key,
        masked_key: k.key.substring(0, 18) + '****' + k.key.slice(-4),
        created_at: new Date(k.created).toISOString()
      }))
    });
  }

  if (req.method === 'POST' && pt === '/api/settings/api-keys/generate') {
    const clientId = req.headers['x-prysmisai-client'] || 'local-user';
    const td = getTokenData(getReqToken(req, url));
    const effectiveClientId = td ? td.username : clientId;
    
    const now = Date.now();
    const oneDay = 24 * 3600000;
    const user = db.users[effectiveClientId] || {};
    const recentGenerations = (user.apiKeyGenerationHistory || []).filter(time => now - time < oneDay);
    
    if (recentGenerations.length >= 3) {
      const oldestGeneration = Math.min(...recentGenerations);
      const retryAt = new Date(oldestGeneration + oneDay).toISOString();
      return sendJson(res, 429, {
        message: `API key generation limit reached. Try again after ${retryAt}.`,
        retry_at: retryAt
      });
    }
    
    const apiKey = 'ps-prysmisai-' + crypto.randomBytes(24).toString('hex');
    if (!user.prysmisApiKeys) user.prysmisApiKeys = [];
    if (!user.apiKeyGenerationHistory) user.apiKeyGenerationHistory = [];
    
    user.prysmisApiKeys.push({ key: apiKey, created: now });
    user.apiKeyGenerationHistory.push(now);
    db.users[effectiveClientId] = user;
    saveDb();
    
    const newRecentGenerations = user.apiKeyGenerationHistory.filter(time => now - time < oneDay);
    const newRemaining = Math.max(0, 3 - newRecentGenerations.length);
    const nextGenerationAt = newRemaining === 0 
      ? new Date(now + oneDay).toISOString()
      : null;
    
    return sendJson(res, 200, {
      key: {
        id: now,
        api_key: apiKey,
        masked_key: apiKey.substring(0, 18) + '****' + apiKey.slice(-4),
        created_at: new Date(now).toISOString()
      },
      status: {
        limit: 3,
        window_hours: 24,
        generated_in_window: newRecentGenerations.length,
        remaining: newRemaining,
        next_generation_at: nextGenerationAt
      }
    });
  }

  function authenticateApiKey(apiKey) {
    if (!apiKey || !apiKey.startsWith('ps-prysmisai-')) return false;
    for (const u in db.users) {
      const user = db.users[u];
      if (user.prysmisApiKeys && user.prysmisApiKeys.some(k => k.key === apiKey)) {
        return true;
      }
    }
    return false;
  }

  function validateRequestedModel(requestedModel) {
    const allowedModels = ['PSM-v1.0(PrysmisAI)', 'psm-v1.0', 'llama3.2-vision:latest'];
    if (!requestedModel) return 'psm-v1.0';
    if (allowedModels.includes(requestedModel)) return 'psm-v1.0';
    if (GROQ_MODELS.has(requestedModel)) return requestedModel;
    throw new Error(`Unsupported model '${requestedModel}'. Use PSM-v1.0(PrysmisAI) or a supported Groq model.`);
  }

  if (req.method === 'POST' && pt === '/api/v1/chat/completions') {
    let body;
    try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    
    const authHeader = req.headers['authorization'] || '';
    const apiKey = authHeader.replace(/^Bearer\s+/i, '');
    
    if (!apiKey || !authenticateApiKey(apiKey)) {
      return sendJson(res, 401, { error: 'Invalid PrysmisAI API key.' });
    }
    
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return sendJson(res, 400, { error: 'At least one message is required.' });
    }
    
    let modelToUse;
    try {
      modelToUse = validateRequestedModel(body.model);
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
    
    const messages = body.messages.map(m => ({
      role: m.role || 'user',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    }));
    
    const temperature = typeof body.temperature === 'number' ? Math.min(Math.max(body.temperature, 0), 2) : 0.2;
    const maxTokens = typeof body.max_tokens === 'number' ? body.max_tokens : 512;
    
    if (GROQ_MODELS.has(modelToUse)) {
      const prysmisUser = Object.keys(db.users).find(u => (db.users[u].prysmisApiKeys || []).some(k => k.key === apiKey));
      const groqKey = prysmisUser ? getUserGroqKey(prysmisUser) : null;
      if (!groqKey || !groqKey.startsWith('gsk_')) {
        return sendJson(res, 400, { error: 'Groq API key not set. Add your Groq API key in AI Settings.' });
      }
      try {
        const groqData = await callGroq(messages, temperature, maxTokens, groqKey, modelToUse);
        const choice = groqData.choices && groqData.choices[0];
        const reply = choice && choice.message && choice.message.content ? choice.message.content : '';
        return sendJson(res, 200, {
          id: groqData.id || 'psmchat-' + crypto.randomBytes(16).toString('hex'),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: modelToUse,
          choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: (choice && choice.finish_reason) || 'stop' }],
          usage: groqData.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        });
      } catch (error) {
        return sendJson(res, 503, { error: 'Groq error: ' + error.message });
      }
    }

    try {
      const ollamaData = await callOllama(messages, temperature, maxTokens);
      const reply = ollamaData.message && ollamaData.message.content ? ollamaData.message.content : '';
      const promptTokens = ollamaData.prompt_eval_count || messages.reduce((acc, m) => acc + (m.content || '').length / 4, 0);
      const completionTokens = ollamaData.eval_count || reply.length / 4;
      return sendJson(res, 200, {
        id: 'psmchat-' + crypto.randomBytes(16).toString('hex'),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'PSM-v1.0(PrysmisAI)',
        choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: ollamaData.done_reason || 'stop' }],
        usage: { prompt_tokens: Math.floor(promptTokens), completion_tokens: Math.floor(completionTokens), total_tokens: Math.floor(promptTokens + completionTokens) }
      });
    } catch (error) {
      return sendJson(res, 503, { error: 'PSM-v1.0(PrysmisAI): ' + error.message });
    }
  }

  if (req.method === 'POST' && (pt === '/v1/chat/completions' || pt === '/chat/completions' || (isApiSubdomain && pt === '/'))) {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const rawModel = body.model || url.searchParams.get('model') || 'psm-v1.0';
    const modelToUse = resolveModel(rawModel);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const cleanMessages = messages.filter(m => {
      if (!m || typeof m !== 'object') return false;
      if (!['user','assistant','system'].includes(m.role)) return false;
      if (typeof m.content === 'string') return m.content.trim().length > 0;
      if (Array.isArray(m.content)) return m.content.length > 0;
      return false;
    }).map(m => {
      if (typeof m.content === 'string') return { role: m.role, content: m.content.trim() };
      return { role: m.role, content: m.content };
    });
    if (cleanMessages.filter(m => m.role !== 'system').length === 0) return sendJson(res, 400, { error: 'No valid messages provided' });
    const temp = typeof body.temperature === 'number' ? Math.min(Math.max(body.temperature, 0), 2) : 0.7;
    const maxTok = typeof body.max_tokens === 'number' ? Math.min(body.max_tokens, 4096) : 2048;

    if (modelToUse === 'psm-v1.0') {
      try {
        const ollamaData = await callOllama(cleanMessages, temp, maxTok);
        const reply = ollamaData.message && ollamaData.message.content ? ollamaData.message.content : 'PSM-v1.0(PrysmisAI) could not generate a response.';
        const promptLen = cleanMessages.map(m => typeof m.content === 'string' ? m.content : m.content.map(c => c.type === 'text' ? c.text : '').join(' ')).join(' ').length;
        return sendJson(res, 200, {
          id: 'chatcmpl-' + crypto.randomBytes(8).toString('hex'),
          object: 'chat.completion',
          model: 'psm-v1.0',
          choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
          usage: { prompt_tokens: Math.floor(promptLen / 4), completion_tokens: Math.floor(reply.length / 4), total_tokens: Math.floor((promptLen + reply.length) / 4) }
        });
      } catch (error) {
        return sendJson(res, 500, { error: 'PSM-v1.0(PrysmisAI) error: ' + (error.message || 'Unknown error') });
      }
    }

    if (GROQ_MODELS.has(modelToUse)) {
      const td = getTokenData(getReqToken(req, url));
      const groqKey = td ? getUserGroqKey(td.username) : null;
      if (!groqKey || !groqKey.startsWith('gsk_')) {
        return sendJson(res, 400, { error: 'Groq API key not set. Add your Groq API key in AI Settings.' });
      }
      try {
        const groqData = await callGroq(cleanMessages, temp, maxTok, groqKey, modelToUse);
        const choice = groqData.choices && groqData.choices[0];
        const reply = choice && choice.message && choice.message.content ? choice.message.content : '';
        return sendJson(res, 200, {
          id: groqData.id || 'chatcmpl-' + crypto.randomBytes(8).toString('hex'),
          object: 'chat.completion',
          model: modelToUse,
          choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: (choice && choice.finish_reason) || 'stop' }],
          usage: groqData.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        });
      } catch (error) {
        return sendJson(res, 500, { error: 'Groq error: ' + (error.message || 'Unknown error') });
      }
    }

    return sendJson(res, 400, { error: 'Model not supported' });
  }

  if (req.method === 'GET' && (pt === '/APIDoc' || pt === '/APIDoc/' || pt === '/apidoc' || pt === '/apidoc/')) {
    fs.readFile('./apidoc/index.html', (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(data);
    }); return;
  }

  if (req.method === 'GET' && (pt.startsWith('/APIDoc/') || pt.startsWith('/apidoc/'))) {
    const filename = pt.split('/').pop();
    const ext = path.extname(filename).toLowerCase();
    const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8' }[ext] || 'text/plain';
    fs.readFile('./apidoc/' + filename, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': mime }); res.end(data);
    }); return;
  }

  if (req.method === 'GET') {
    let filePath = '.' + (pt === '/' ? '/index.html' : pt);
    if (filePath.endsWith('/')) filePath += 'index.html';
    const ext = path.extname(filePath).toLowerCase();
    const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' }[ext] || 'text/plain';
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': mime }); res.end(data);
    }); return;
  }

  res.writeHead(404); res.end();
});

server.on('error', e => { if (e.code === 'EADDRINUSE') process.exit(1); });
server.listen(process.env.PORT || 3000, '0.0.0.0');
