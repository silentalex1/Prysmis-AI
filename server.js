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

let db = {
  users: {},
  projects: [],
  tokens: {},
  communityChat: [],
  meta: { version: 3, created: Date.now() }
};
let saveScheduled = false;

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db.users = parsed.users || {};
      db.projects = Array.isArray(parsed.projects) ? parsed.projects : [];
      db.tokens = parsed.tokens || {};
      db.communityChat = Array.isArray(parsed.communityChat) ? parsed.communityChat : [];
      db.meta = parsed.meta || { version: 3, created: Date.now() };
      for (const u in db.users) {
        if (typeof db.users[u].hashed !== 'string') { delete db.users[u]; continue; }
        if (!Array.isArray(db.users[u].chats)) db.users[u].chats = [];
        if (!db.users[u].created) db.users[u].created = Date.now();
      }
      return;
    }
  } catch (e) {
    try {
      if (fs.existsSync(DB_BACKUP)) {
        const parsed = JSON.parse(fs.readFileSync(DB_BACKUP, 'utf8'));
        db.users = parsed.users || {};
        db.projects = Array.isArray(parsed.projects) ? parsed.projects : [];
        db.tokens = parsed.tokens || {};
        db.communityChat = Array.isArray(parsed.communityChat) ? parsed.communityChat : [];
        return;
      }
    } catch (_) {}
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
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
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

const MODEL_MAP = {
  'claude opus 4.6': 'claude-opus-4-5',
  'gemini 3.2': 'google/gemini-1.5-pro',
  'chatgpt 5.2': 'gpt-4o',
  'anthropic/claude-opus-4-6': 'claude-opus-4-5',
  'anthropic/claude-sonnet-4-6': 'claude-sonnet-4-5',
  'anthropic/claude-opus-4-5': 'claude-opus-4-5',
  'anthropic/claude-sonnet-4-5': 'claude-sonnet-4-5',
  'anthropic/claude-haiku-4-5': 'claude-haiku-3-5',
  'openai/gpt-5.4': 'gpt-4o',
  'openai/gpt-5.4-mini': 'gpt-4o-mini',
  'openai/gpt-4o': 'gpt-4o',
  'openai/o3': 'o3-mini',
  'google/gemini-3.2-pro': 'google/gemini-1.5-pro',
  'google/gemini-2.5-pro': 'google/gemini-1.5-pro',
  'google/gemini-1.5-pro': 'google/gemini-1.5-pro'
};

function resolveModel(m) {
  if (!m) return 'claude-sonnet-4-5';
  const lower = m.toLowerCase().trim();
  if (MODEL_MAP[lower]) return MODEL_MAP[lower];
  if (MODEL_MAP[m]) return MODEL_MAP[m];
  if (m.includes('/')) {
    const short = m.split('/').pop();
    return short || 'claude-sonnet-4-5';
  }
  return m;
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
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    });
    res.end(); return;
  }

  if (req.method === 'POST' && pt === '/account') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const uErr = validateUsername(body.username);
    if (uErr) return sendJson(res, 400, { error: uErr });
    const pErr = validatePassword(body.password);
    if (pErr) return sendJson(res, 400, { error: pErr });
    const uname = body.username.trim();
    if (db.users[uname]) return sendJson(res, 409, { error: 'Account is already created' });
    const token = randToken();
    const now = Date.now();
    db.users[uname] = {
      hashed: hash(body.password),
      created: now,
      lastLogin: now,
      lastSeen: now,
      loginCount: 1,
      chats: [],
      pluginToken: null,
      pluginConnected: false,
      pluginModel: 'claude-sonnet-4-5',
      authToken: null,
      authTokenCreated: null
    };
    db.tokens[token] = { username: uname, expires: now + TOKEN_TTL, created: now, device: req.headers['user-agent'] || 'unknown' };
    saveDb();
    return sendJson(res, 200, { success: true, token, username: uname });
  }

  if (req.method === 'POST' && pt === '/login') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    if (!body.username || !body.password) return sendJson(res, 400, { error: 'Username and password required' });
    const uname = body.username.trim();
    const user = db.users[uname];
    if (!user) return sendJson(res, 401, { error: 'No account found with that username' });
    if (user.hashed !== hash(body.password)) return sendJson(res, 401, { error: 'Incorrect password' });
    const token = randToken();
    const now = Date.now();
    db.tokens[token] = { username: uname, expires: now + TOKEN_TTL, created: now, device: req.headers['user-agent'] || 'unknown' };
    user.lastLogin = now;
    user.lastSeen = now;
    user.loginCount = (user.loginCount || 0) + 1;
    saveDb();
    return sendJson(res, 200, { success: true, token, username: uname });
  }

  if (req.method === 'GET' && pt === '/me') {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    user.lastSeen = Date.now();
    return sendJson(res, 200, {
      username: td.username,
      created: user.created,
      lastLogin: user.lastLogin,
      chatCount: (user.chats || []).length,
      loginCount: user.loginCount || 1
    });
  }

  if (req.method === 'POST' && pt === '/logout') {
    const t = getReqToken(req, url);
    if (t && db.tokens[t]) { delete db.tokens[t]; saveDb(); }
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'GET' && pt === '/stats') {
    const now = Date.now();
    return sendJson(res, 200, {
      users: Object.keys(db.users).length,
      active: Math.max(Object.values(db.tokens).filter(t => t.expires > now).length, 1),
      projects: db.projects.length
    });
  }

  if (req.method === 'GET' && pt === '/status') {
    const pluginToken = url.searchParams.get('pluginToken') || '';
    let status = 'disconnected', model = 'claude-sonnet-4-5', username = 'unknown';
    if (pluginToken) {
      for (const u in db.users) {
        if (db.users[u].pluginToken === pluginToken) {
          status = db.users[u].pluginConnected ? 'connected' : 'disconnected';
          model = db.users[u].pluginModel || 'claude-sonnet-4-5';
          username = u; break;
        }
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
        db.users[u].pluginConnected = true;
        db.users[u].pluginLastPing = Date.now();
        saveDb();
        return sendJson(res, 200, { success: true, username: u, model: db.users[u].pluginModel || 'claude-sonnet-4-5', connected: true });
      }
    }
    return sendJson(res, 401, { error: 'Invalid plugin token' });
  }

  if (req.method === 'POST' && pt === '/plugin/ping') {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    if (!body.pluginToken) return sendJson(res, 400, { error: 'pluginToken required' });
    for (const u in db.users) {
      if (db.users[u].pluginToken === body.pluginToken) {
        db.users[u].pluginLastPing = Date.now();
        db.users[u].pluginConnected = true;
        saveDb();
        return sendJson(res, 200, { ok: true, model: db.users[u].pluginModel || 'claude-sonnet-4-5', user: u });
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
    user.authToken = authToken;
    user.authTokenCreated = now;
    saveDb();
    return sendJson(res, 200, { success: true, authToken, url: 'prysmisai.wtf/token/' + authToken });
  }

  if (req.method === 'GET' && pt === '/auth-token') {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    const now = Date.now();
    return sendJson(res, 200, {
      authToken: user.authToken || null,
      canGenerate: !user.authTokenCreated || (now - user.authTokenCreated) >= 24 * 3600000,
      url: user.authToken ? 'prysmisai.wtf/token/' + user.authToken : null
    });
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
    db.projects.unshift(project);
    saveDb();
    return sendJson(res, 200, { success: true, project });
  }

  if (req.method === 'DELETE' && pt.startsWith('/projects/')) {
    const id = pt.slice('/projects/'.length);
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const idx = db.projects.findIndex(p => p.id === id);
    if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
    if (db.projects[idx].author !== td.username) return sendJson(res, 403, { error: 'Not your project' });
    db.projects.splice(idx, 1);
    saveDb();
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
    const msg = {
      id: crypto.randomBytes(8).toString('hex'),
      author: td.username,
      text: body.text.trim(),
      replyTo: body.replyTo || null,
      created: Date.now(),
      edited: false
    };
    db.communityChat.push(msg);
    if (db.communityChat.length > MAX_COMMUNITY_MSGS) db.communityChat = db.communityChat.slice(-MAX_COMMUNITY_MSGS);
    saveDb();
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
    db.communityChat[idx].text = body.text.trim();
    db.communityChat[idx].edited = true;
    db.communityChat[idx].editedAt = Date.now();
    saveDb();
    return sendJson(res, 200, { success: true, msg: db.communityChat[idx] });
  }

  if (req.method === 'DELETE' && pt.startsWith('/community-chat/')) {
    const id = pt.slice('/community-chat/'.length);
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const idx = db.communityChat.findIndex(m => m.id === id);
    if (idx === -1) return sendJson(res, 404, { error: 'Message not found' });
    if (db.communityChat[idx].author !== td.username) return sendJson(res, 403, { error: 'Not your message' });
    db.communityChat.splice(idx, 1);
    saveDb();
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
    saveDb();
    return sendJson(res, 200, { success: true, chat });
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
    user.chats[idx].updated = Date.now();
    saveDb();
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
    user.chats.splice(idx, 1);
    saveDb();
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'POST' && (pt === '/v1/chat/completions' || pt === '/chat/completions')) {
    let body; try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: 'Invalid body' }); }
    const rawModel = body.model || url.searchParams.get('model') || 'claude-sonnet-4-5';
    const modelToUse = resolveModel(rawModel);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const validMessages = messages.filter(m => m && (m.role === 'user' || m.role === 'assistant' || m.role === 'system') && typeof m.content === 'string' && m.content.trim().length > 0);
    if (validMessages.length === 0) return sendJson(res, 400, { error: 'No valid messages provided' });
    try {
      const completion = await client.chat.completions.create({
        model: modelToUse,
        messages: validMessages,
        stream: false,
        temperature: typeof body.temperature === 'number' ? Math.min(Math.max(body.temperature, 0), 2) : 0.7,
        max_tokens: typeof body.max_tokens === 'number' ? Math.min(body.max_tokens, 8192) : 2048
      });
      return sendJson(res, 200, completion);
    } catch (e) {
      const errMsg = e.message || 'AI request failed';
      if (modelToUse !== 'claude-sonnet-4-5') {
        try {
          const fallback = await client.chat.completions.create({
            model: 'claude-sonnet-4-5',
            messages: validMessages,
            stream: false,
            temperature: 0.7,
            max_tokens: 2048
          });
          return sendJson(res, 200, fallback);
        } catch (e2) {
          return sendJson(res, 500, { error: e2.message || errMsg });
        }
      }
      return sendJson(res, 500, { error: errMsg });
    }
  }

  if (req.method === 'GET') {
    let filePath = '.' + (pt === '/' ? '/index.html' : pt);
    if (filePath.endsWith('/')) filePath += 'index.html';
    const ext = path.extname(filePath).toLowerCase();
    const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' }[ext] || 'text/plain';
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
    return;
  }

  res.writeHead(404); res.end();
});

server.on('error', e => { if (e.code === 'EADDRINUSE') process.exit(1); });
server.listen(process.env.PORT || 3000, '0.0.0.0');
