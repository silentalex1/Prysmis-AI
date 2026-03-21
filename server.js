const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { OpenAI } = require('openai');

const client = new OpenAI({
  baseURL: 'https://api.puter.com/puterai/openai/v1/',
  apiKey: process.env.PUTER_TOKEN
});

const DB_FILE = 'db.json';
const DB_BACKUP = 'db.backup.json';
const SALT = 'prysmis_v2_salt_9x2k';
const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000;
const MAX_CHATS_PER_USER = 100;
const MAX_PROJECTS = 500;

let db = { users: {}, projects: [], tokens: {}, meta: { version: 2, created: Date.now() } };
let saveScheduled = false;

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      db = {
        users: parsed.users || {},
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        tokens: parsed.tokens || {},
        meta: parsed.meta || { version: 2, created: Date.now() }
      };
      for (const u in db.users) {
        const user = db.users[u];
        if (!Array.isArray(user.chats)) user.chats = [];
        if (!user.created) user.created = Date.now();
        if (typeof user.hashed !== 'string') { delete db.users[u]; }
      }
      return;
    }
  } catch (e) {
    try {
      if (fs.existsSync(DB_BACKUP)) {
        const raw = fs.readFileSync(DB_BACKUP, 'utf8');
        const parsed = JSON.parse(raw);
        db = {
          users: parsed.users || {},
          projects: Array.isArray(parsed.projects) ? parsed.projects : [],
          tokens: parsed.tokens || {},
          meta: parsed.meta || { version: 2, created: Date.now() }
        };
        return;
      }
    } catch (e2) {}
  }
  db = { users: {}, projects: [], tokens: {}, meta: { version: 2, created: Date.now() } };
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
    } catch (e) {}
  });
}

loadDb();

function hashPassword(p) {
  return crypto.createHash('sha256').update(p + SALT).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(64).toString('hex');
}

function getTokenData(token) {
  if (!token || typeof token !== 'string' || token.length < 10) return null;
  const td = db.tokens[token];
  if (!td) return null;
  if (td.expires < Date.now()) {
    delete db.tokens[token];
    saveDb();
    return null;
  }
  return td;
}

function getToken(req, url) {
  const fromQuery = url.searchParams.get('token') || '';
  const fromHeader = req.headers['authorization'] || '';
  return (fromQuery || fromHeader).replace(/^Bearer\s+/i, '');
}

function pruneExpiredTokens() {
  const now = Date.now();
  let changed = false;
  for (const t in db.tokens) {
    if (db.tokens[t].expires < now) { delete db.tokens[t]; changed = true; }
  }
  if (changed) saveDb();
}

setInterval(pruneExpiredTokens, 60 * 60 * 1000);

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 512 * 1024) { reject(new Error('Body too large')); return; }
      body += chunk;
    });
    req.on('end', () => {
      if (!body.trim()) { resolve({}); return; }
      try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function validateUsername(u) {
  if (typeof u !== 'string') return 'Username must be a string';
  const t = u.trim();
  if (t.length < 3) return 'Username must be at least 3 characters';
  if (t.length > 24) return 'Username must be 24 characters or less';
  if (!/^[a-zA-Z0-9_]+$/.test(t)) return 'Username can only contain letters, numbers, and underscores';
  return null;
}

function validatePassword(p) {
  if (typeof p !== 'string') return 'Password must be a string';
  if (p.length < 6) return 'Password must be at least 6 characters';
  if (p.length > 128) return 'Password is too long';
  return null;
}

const models = [
  'anthropic/claude-opus-4-6',
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-opus-4-5',
  'anthropic/claude-sonnet-4-5',
  'anthropic/claude-haiku-4-5',
  'openai/gpt-5.4',
  'openai/gpt-5.4-mini',
  'openai/gpt-5.4-nano',
  'openai/o3',
  'openai/o4-mini',
  'openai/o1',
  'openai/gpt-4o',
  'google/gemini-3.2-pro',
  'google/gemini-3.1-pro',
  'google/gemini-2.5-pro',
  'google/gemini-1.5-pro',
  'x-ai/grok-4',
  'x-ai/grok-4-reasoning',
  'x-ai/grok-4-fast',
  'deepseek/deepseek-r1',
  'deepseek/deepseek-v3',
  'deepseek/deepseek-coder',
  'meta-llama/llama-4-maverick',
  'meta-llama/llama-4',
  'meta-llama/llama-3.3',
  'mistral/mistral-large',
  'mistral/mistral-large-2',
  'minimax/minimax-m2.7',
  'qwen/qwen-3-coder',
  'qwen/qwen-3',
  'qwen/qwen-2.5',
  'byte-dance/seed-1.5'
];

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch (e) {
    res.writeHead(400);
    res.end();
    return;
  }
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && pathname === '/account') {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: 'Invalid request body' }); }
    const { username, password } = body;
    const uErr = validateUsername(username);
    if (uErr) return sendJson(res, 400, { error: uErr });
    const pErr = validatePassword(password);
    if (pErr) return sendJson(res, 400, { error: pErr });
    const uname = username.trim();
    if (db.users[uname]) return sendJson(res, 409, { error: 'Account is already created' });
    const token = generateToken();
    const now = Date.now();
    db.users[uname] = {
      hashed: hashPassword(password),
      created: now,
      lastLogin: now,
      chats: [],
      loginCount: 1
    };
    db.tokens[token] = { username: uname, expires: now + TOKEN_TTL, created: now };
    saveDb();
    return sendJson(res, 200, { success: true, token, username: uname });
  }

  if (req.method === 'POST' && pathname === '/login') {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: 'Invalid request body' }); }
    const { username, password } = body;
    if (!username || typeof username !== 'string') return sendJson(res, 400, { error: 'Username is required' });
    if (!password || typeof password !== 'string') return sendJson(res, 400, { error: 'Password is required' });
    const uname = username.trim();
    const user = db.users[uname];
    if (!user) return sendJson(res, 401, { error: 'No account found with that username' });
    if (user.hashed !== hashPassword(password)) return sendJson(res, 401, { error: 'Incorrect password' });
    const token = generateToken();
    const now = Date.now();
    db.tokens[token] = { username: uname, expires: now + TOKEN_TTL, created: now };
    user.lastLogin = now;
    user.loginCount = (user.loginCount || 0) + 1;
    saveDb();
    return sendJson(res, 200, { success: true, token, username: uname });
  }

  if (req.method === 'GET' && pathname === '/me') {
    const td = getTokenData(getToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    return sendJson(res, 200, {
      username: td.username,
      created: user.created,
      lastLogin: user.lastLogin,
      chatCount: (user.chats || []).length,
      loginCount: user.loginCount || 1
    });
  }

  if (req.method === 'POST' && pathname === '/logout') {
    const token = getToken(req, url);
    if (token && db.tokens[token]) {
      delete db.tokens[token];
      saveDb();
    }
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'GET' && pathname === '/status') {
    const user = url.searchParams.get('user') || '';
    const pluginToken = url.searchParams.get('pluginToken') || '';
    let status = 'disconnected';
    let model = 'anthropic/claude-opus-4-6';
    let username = user || 'unknown';
    if (pluginToken) {
      for (const uname in db.users) {
        const u = db.users[uname];
        if (u.pluginToken && u.pluginToken === pluginToken) {
          status = u.pluginConnected ? 'connected' : 'disconnected';
          model = u.pluginModel || 'anthropic/claude-opus-4-6';
          username = uname;
          break;
        }
      }
    }
    return sendJson(res, 200, { status, model, user: username });
  }

  if (req.method === 'POST' && pathname === '/plugin/connect') {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: 'Invalid request body' }); }
    const td = getTokenData(getToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    const pluginToken = crypto.randomBytes(24).toString('hex');
    user.pluginToken = pluginToken;
    user.pluginConnected = true;
    user.pluginModel = body.model || 'anthropic/claude-opus-4-6';
    user.pluginConnectedAt = Date.now();
    saveDb();
    return sendJson(res, 200, { success: true, pluginToken, username: td.username, model: user.pluginModel });
  }

  if (req.method === 'POST' && pathname === '/auth-token/generate') {
    const td = getTokenData(getToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    const now = Date.now();
    if (user.authToken && user.authTokenCreated && (now - user.authTokenCreated) < 24 * 60 * 60 * 1000) {
      const remaining = Math.ceil((user.authTokenCreated + 24 * 60 * 60 * 1000 - now) / 3600000);
      return sendJson(res, 429, { error: 'You can generate a new token in ' + remaining + ' hour' + (remaining === 1 ? '' : 's') });
    }
    const seg1 = crypto.randomBytes(4).toString('hex');
    const seg2 = crypto.randomBytes(4).toString('hex');
    const seg3 = crypto.randomBytes(4).toString('hex');
    const authToken = seg1 + '-' + seg2 + '-' + seg3;
    user.authToken = authToken;
    user.authTokenCreated = now;
    saveDb();
    return sendJson(res, 200, { success: true, authToken: authToken, url: 'prysmisai.wtf/token/' + authToken });
  }

  if (req.method === 'GET' && pathname === '/auth-token') {
    const td = getTokenData(getToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    const now = Date.now();
    const canGenerate = !user.authTokenCreated || (now - user.authTokenCreated) >= 24 * 60 * 60 * 1000;
    return sendJson(res, 200, {
      authToken: user.authToken || null,
      authTokenCreated: user.authTokenCreated || null,
      canGenerate: canGenerate,
      url: user.authToken ? 'prysmisai.wtf/token/' + user.authToken : null
    });
  }

  if (req.method === 'POST' && pathname === '/plugin/update-model') {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: 'Invalid request body' }); }
    const td = getTokenData(getToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    if (!body.model || typeof body.model !== 'string') return sendJson(res, 400, { error: 'model required' });
    user.pluginModel = body.model;
    saveDb();
    return sendJson(res, 200, { success: true, model: user.pluginModel });
  }

  if (req.method === 'POST' && pathname === '/plugin/disconnect') {
    const td = getTokenData(getToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (user) {
      user.pluginConnected = false;
      saveDb();
    }
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'POST' && pathname === '/plugin/verify') {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: 'Invalid request body' }); }
    const { pluginToken } = body;
    if (!pluginToken) return sendJson(res, 400, { error: 'pluginToken required' });
    for (const uname in db.users) {
      const u = db.users[uname];
      if (u.pluginToken === pluginToken) {
        u.pluginConnected = true;
        u.pluginLastPing = Date.now();
        saveDb();
        return sendJson(res, 200, { success: true, username: uname, model: u.pluginModel || 'anthropic/claude-opus-4-6', connected: true });
      }
    }
    return sendJson(res, 401, { error: 'Invalid plugin token' });
  }

  if (req.method === 'POST' && pathname === '/plugin/ping') {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: 'Invalid request body' }); }
    const { pluginToken } = body;
    if (!pluginToken) return sendJson(res, 400, { error: 'pluginToken required' });
    for (const uname in db.users) {
      const u = db.users[uname];
      if (u.pluginToken === pluginToken) {
        u.pluginLastPing = Date.now();
        u.pluginConnected = true;
        saveDb();
        return sendJson(res, 200, { ok: true, model: u.pluginModel || 'anthropic/claude-opus-4-6', user: uname });
      }
    }
    return sendJson(res, 401, { error: 'Invalid plugin token' });
  }

  if (req.method === 'GET' && pathname === '/stats') {
    const now = Date.now();
    const activeTokens = Object.values(db.tokens).filter(t => t.expires > now).length;
    return sendJson(res, 200, {
      users: Object.keys(db.users).length,
      active: Math.max(activeTokens, 1),
      projects: db.projects.length
    });
  }

  if (req.method === 'GET' && pathname === '/models') {
    return sendJson(res, 200, models);
  }

  if (req.method === 'GET' && pathname === '/projects') {
    return sendJson(res, 200, db.projects);
  }

  if (req.method === 'POST' && pathname === '/projects') {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: 'Invalid request body' }); }
    const td = getTokenData(getToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'You must be logged in to post a project' });
    const { title, link, about } = body;
    if (!title || typeof title !== 'string' || !title.trim()) return sendJson(res, 400, { error: 'Title is required' });
    if (!link || typeof link !== 'string' || !link.trim()) return sendJson(res, 400, { error: 'Roblox link is required' });
    if (!about || typeof about !== 'string' || !about.trim()) return sendJson(res, 400, { error: 'Description is required' });
    if (title.trim().length > 80) return sendJson(res, 400, { error: 'Title must be 80 characters or less' });
    if (about.trim().length > 500) return sendJson(res, 400, { error: 'Description must be 500 characters or less' });
    if (link.trim().length > 300) return sendJson(res, 400, { error: 'Link is too long' });
    if (db.projects.length >= MAX_PROJECTS) {
      db.projects = db.projects.slice(0, MAX_PROJECTS - 1);
    }
    const project = {
      id: crypto.randomBytes(10).toString('hex'),
      title: title.trim(),
      link: link.trim(),
      about: about.trim(),
      author: td.username,
      created: Date.now()
    };
    db.projects.unshift(project);
    saveDb();
    return sendJson(res, 200, { success: true, project });
  }

  if (req.method === 'DELETE' && pathname.startsWith('/projects/')) {
    const id = pathname.slice('/projects/'.length);
    if (!id) return sendJson(res, 400, { error: 'Missing project id' });
    const td = getTokenData(getToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const idx = db.projects.findIndex(p => p.id === id);
    if (idx === -1) return sendJson(res, 404, { error: 'Project not found' });
    if (db.projects[idx].author !== td.username) return sendJson(res, 403, { error: 'You can only delete your own projects' });
    db.projects.splice(idx, 1);
    saveDb();
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'GET' && pathname === '/chats') {
    const td = getTokenData(getToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    return sendJson(res, 200, Array.isArray(user.chats) ? user.chats : []);
  }

  if (req.method === 'POST' && pathname === '/chats') {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: 'Invalid request body' }); }
    const td = getTokenData(getToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    const { title, messages } = body;
    if (!title || typeof title !== 'string') return sendJson(res, 400, { error: 'Title is required' });
    if (!Array.isArray(messages) || messages.length === 0) return sendJson(res, 400, { error: 'Messages are required' });
    if (!Array.isArray(user.chats)) user.chats = [];
    const chat = {
      id: crypto.randomBytes(10).toString('hex'),
      title: title.substring(0, 40),
      messages: messages.slice(0, 200),
      created: Date.now(),
      updated: Date.now()
    };
    user.chats.unshift(chat);
    if (user.chats.length > MAX_CHATS_PER_USER) {
      user.chats = user.chats.slice(0, MAX_CHATS_PER_USER);
    }
    saveDb();
    return sendJson(res, 200, { success: true, chat });
  }

  if (req.method === 'PUT' && pathname.startsWith('/chats/')) {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: 'Invalid request body' }); }
    const id = pathname.slice('/chats/'.length);
    if (!id) return sendJson(res, 400, { error: 'Missing chat id' });
    const td = getTokenData(getToken(req, url));
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

  if (req.method === 'DELETE' && pathname.startsWith('/chats/')) {
    const id = pathname.slice('/chats/'.length);
    if (!id) return sendJson(res, 400, { error: 'Missing chat id' });
    const td = getTokenData(getToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    if (!user || !Array.isArray(user.chats)) return sendJson(res, 404, { error: 'User not found' });
    const idx = user.chats.findIndex(c => c.id === id);
    if (idx === -1) return sendJson(res, 404, { error: 'Chat not found' });
    user.chats.splice(idx, 1);
    saveDb();
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'POST' && (pathname === '/v1/chat/completions' || pathname === '/chat/completions')) {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: 'Invalid request body' }); }
    const modelParam = url.searchParams.get('model') || body.model || 'anthropic/claude-sonnet-4-6';
    try {
      const completion = await client.chat.completions.create({
        model: modelParam,
        messages: Array.isArray(body.messages) ? body.messages : [],
        stream: false,
        temperature: typeof body.temperature === 'number' ? body.temperature : 0.7,
        max_tokens: typeof body.max_tokens === 'number' ? body.max_tokens : 4096
      });
      return sendJson(res, 200, completion);
    } catch (e) {
      return sendJson(res, 500, { error: e.message || 'AI request failed' });
    }
  }

  if (req.method === 'GET') {
    let filePath = '.' + (pathname === '/' ? '/index.html' : pathname);
    if (filePath.endsWith('/')) filePath += 'index.html';
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.ico': 'image/x-icon',
      '.svg': 'image/svg+xml'
    };
    const mime = mimeMap[ext] || 'text/plain';
    fs.readFile(filePath, (err, fileData) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': mime });
      res.end(fileData);
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') process.exit(1);
});

server.listen(process.env.PORT || 3000, '0.0.0.0');
