const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { OpenAI } = require('openai');

const client = new OpenAI({
  baseURL: 'https://api.puter.com/puterai/openai/v1/',
  apiKey: process.env.PUTER_TOKEN || 'dummy'
});

const DB_FILE = 'db.json';
const DB_BACKUP = 'db.backup.json';
const SALT = 'prysmis_v3_kx9salt2025';
const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000;
const MAX_CHATS = 100;
const MAX_PROJECTS = 500;
const MAX_COMMUNITY_MSGS = 2000;
const DISCORD_BOT_SECRET = process.env.DISCORD_BOT_SECRET || 'prysmis_discord_secret_2025';
const ALLOWED_DISCORD_IDS = ['841749813702688858', '1360884411154825336', '617174993242947585'];

let db = {
  users: {},
  projects: [],
  tokens: {},
  communityChat: [],
  admins: {},
  adminCodes: {},
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
      if (size > 1024 * 1024) { reject(new Error('Body too large')); return; }
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

const PUTER_MODELS = [
  'gpt-5.2',
  'gpt-4o',
  'gpt-4o-mini',
  'o3-mini',
  'claude-opus-4-5',
  'claude-sonnet-4-5',
  'claude-haiku-3-5',
  'gemini-3.1-pro-preview',
  'google/gemini-1.5-pro'
];

const MODEL_MAP = {
  'gpt-5.2': 'gpt-5.2',
  'chatgpt 5.2': 'gpt-5.2',
  'claude opus 4.6': 'claude-opus-4-5',
  'claude opus 4.5': 'claude-opus-4-5',
  'claude-opus-4-6': 'claude-opus-4-5',
  'claude-opus-4-5': 'claude-opus-4-5',
  'claude-sonnet-4-6': 'claude-sonnet-4-5',
  'claude-sonnet-4-5': 'claude-sonnet-4-5',
  'claude-haiku-4-5': 'claude-haiku-3-5',
  'claude-haiku-3-5': 'claude-haiku-3-5',
  'gemini-3.1-pro-preview': 'gemini-3.1-pro-preview',
  'gemini 3.1 pro': 'gemini-3.1-pro-preview',
  'anthropic/claude-opus-4-6': 'claude-opus-4-5',
  'anthropic/claude-opus-4-5': 'claude-opus-4-5',
  'anthropic/claude-sonnet-4-6': 'claude-sonnet-4-5',
  'anthropic/claude-sonnet-4-5': 'claude-sonnet-4-5',
  'anthropic/claude-haiku-4-5': 'claude-haiku-3-5',
  'openai/gpt-5.2': 'gpt-5.2',
  'openai/gpt-5.4': 'gpt-5.2',
  'openai/gpt-4o': 'gpt-4o',
  'openai/o3': 'o3-mini',
  'google/gemini-3.1-pro': 'gemini-3.1-pro-preview',
  'google/gemini-3.2-pro': 'gemini-3.1-pro-preview',
  'google/gemini-2.5-pro': 'gemini-3.1-pro-preview',
  'google/gemini-1.5-pro': 'google/gemini-1.5-pro',
  'deepseek/deepseek-r1': 'claude-sonnet-4-5',
  'deepseek/deepseek-v3': 'claude-sonnet-4-5',
  'x-ai/grok-4': 'gpt-5.2',
  'meta-llama/llama-4': 'claude-sonnet-4-5',
  'mistral/mistral-large': 'claude-sonnet-4-5'
};

function resolveModel(m) {
  if (!m || typeof m !== 'string') return 'gpt-5.2';
  const trimmed = m.trim();
  if (PUTER_MODELS.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (MODEL_MAP[lower]) return MODEL_MAP[lower];
  if (MODEL_MAP[trimmed]) return MODEL_MAP[trimmed];
  if (trimmed.includes('/')) {
    const short = trimmed.split('/').pop();
    if (short && PUTER_MODELS.includes(short)) return short;
  }
  return 'gpt-5.2';
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
    db.users[uname] = { hashed: hash(body.password), created: now, lastLogin: now, lastSeen: now, loginCount: 1, chats: [], pluginToken: null, pluginConnected: false, pluginModel: 'gpt-5.2', authToken: null, authTokenCreated: null };
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
    const secret = req.headers['x-discord-secret'] || '';
    if (secret !== DISCORD_BOT_SECRET) return sendJson(res, 403, { error: 'Forbidden' });
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
    const secret = req.headers['x-discord-secret'] || '';
    if (secret !== DISCORD_BOT_SECRET) return sendJson(res, 403, { error: 'Forbidden' });
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
    const secret = req.headers['x-discord-secret'] || '';
    if (secret !== DISCORD_BOT_SECRET) return sendJson(res, 403, { error: 'Forbidden' });
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
    const secret = req.headers['x-discord-secret'] || '';
    if (secret !== DISCORD_BOT_SECRET) return sendJson(res, 403, { error: 'Forbidden' });
    return sendJson(res, 200, { ok: true, status: 'connected', site: 'prysmisai.wtf', users: Object.keys(db.users).length, admins: Object.keys(db.admins).length });
  }

  if (req.method === 'POST' && pt === '/discord/connect') {
    const secret = req.headers['x-discord-secret'] || '';
    if (secret !== DISCORD_BOT_SECRET) return sendJson(res, 403, { error: 'Forbidden' });
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
    const secret = req.headers['x-discord-secret'] || '';
    if (secret !== DISCORD_BOT_SECRET) return sendJson(res, 403, { error: 'Forbidden' });
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
    const secret = req.headers['x-discord-secret'] || '';
    if (secret !== DISCORD_BOT_SECRET) return sendJson(res, 403, { error: 'Forbidden' });
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

  if (req.method === 'GET' && pt === '/discord/check-user') {
    const secret = req.headers['x-discord-secret'] || '';
    if (secret !== DISCORD_BOT_SECRET) return sendJson(res, 403, { error: 'Forbidden' });
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
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const rawToken = getReqToken(req, url);
    if (!db.tokens[rawToken] || !db.tokens[rawToken].isAdmin) return sendJson(res, 403, { error: 'Admin access required' });
    const { username, rank } = body;
    if (!username) return sendJson(res, 400, { error: 'username required' });
    const uname = username.trim().toLowerCase();
    if (!db.users[uname]) return sendJson(res, 404, { error: 'User not found' });
    const validRanks = ['early access', 'premium', 'chat mod', null, ''];
    if (!validRanks.includes(rank)) return sendJson(res, 400, { error: 'Invalid rank' });
    db.users[uname].rank = rank || null;
    if (rank === 'premium') db.users[uname].premium = true;
    saveDb();
    return sendJson(res, 200, { success: true, username: uname, rank: db.users[uname].rank });
  }

  if (req.method === 'POST' && pt === '/admin/set-premium') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const rawToken = getReqToken(req, url);
    if (!db.tokens[rawToken] || !db.tokens[rawToken].isAdmin) return sendJson(res, 403, { error: 'Admin access required' });
    const { username, premium } = body;
    if (!username) return sendJson(res, 400, { error: 'username required' });
    const uname = username.trim().toLowerCase();
    if (!db.users[uname]) return sendJson(res, 404, { error: 'User not found' });
    db.users[uname].premium = !!premium;
    saveDb();
    return sendJson(res, 200, { success: true, username: uname, premium: db.users[uname].premium });
  }

  if (req.method === 'POST' && pt === '/logout') {
    const t = getReqToken(req, url);
    if (t && db.tokens[t]) { delete db.tokens[t]; saveDb(); }
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'GET' && pt === '/stats') {
    const now = Date.now();
    return sendJson(res, 200, { users: Object.keys(db.users).length, active: Math.max(Object.values(db.tokens).filter(t => t.expires > now).length, 1), projects: db.projects.length });
  }

  if (req.method === 'GET' && pt === '/status') {
    const pluginToken = url.searchParams.get('pluginToken') || '';
    let status = 'disconnected', model = 'gpt-5.2', username = 'unknown';
    if (pluginToken) {
      for (const u in db.users) {
        if (db.users[u].pluginToken === pluginToken) { status = db.users[u].pluginConnected ? 'connected' : 'disconnected'; model = db.users[u].pluginModel || 'gpt-5.2'; username = u; break; }
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
        return sendJson(res, 200, { success: true, username: u, model: db.users[u].pluginModel || 'gpt-5.2', connected: true });
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
        return sendJson(res, 200, { ok: true, model: db.users[u].pluginModel || 'gpt-5.2', user: u });
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
    if (db.projects[idx].author !== td.username) return sendJson(res, 403, { error: 'Not your project' });
    db.projects.splice(idx, 1); saveDb();
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

  if (req.method === 'POST' && (pt === '/v1/chat/completions' || pt === '/chat/completions')) {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const rawModel = body.model || url.searchParams.get('model') || 'gpt-5.2';
    const modelToUse = resolveModel(rawModel);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const validMessages = messages.filter(m => m && typeof m === 'object' && (m.role === 'user' || m.role === 'assistant' || m.role === 'system') && typeof m.content === 'string' && m.content.trim().length > 0).map(m => ({ role: m.role, content: m.content.trim() }));
    const userOnly = validMessages.filter(m => m.role !== 'system');
    if (userOnly.length === 0) return sendJson(res, 400, { error: 'No valid messages provided' });
    const temp = typeof body.temperature === 'number' ? Math.min(Math.max(body.temperature, 0), 2) : 0.7;
    const maxTok = Math.min(typeof body.max_tokens === 'number' ? body.max_tokens : 2048, 4096);
    const tryCall = async (m, msgs) => client.chat.completions.create({ model: m, messages: msgs, stream: false, temperature: temp, max_tokens: maxTok });
    const fallbacks = ['gpt-5.2', 'gpt-4o', 'claude-sonnet-4-5', 'gpt-4o-mini'];
    const tryList = [modelToUse, ...fallbacks.filter(f => f !== modelToUse)];
    let lastErr = null;
    for (const m of tryList) {
      try { const r = await tryCall(m, validMessages); return sendJson(res, 200, r); } catch (e) { lastErr = e; }
      try { const r = await tryCall(m, userOnly); return sendJson(res, 200, r); } catch (e) { lastErr = e; }
    }
    return sendJson(res, 500, { error: lastErr ? (lastErr.message || 'AI request failed') : 'AI request failed' });
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
