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

let db = { users: {}, projects: [], tokens: {} };

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = {
        users: parsed.users || {},
        projects: parsed.projects || [],
        tokens: parsed.tokens || {}
      };
    }
  } catch (e) {
    db = { users: {}, projects: [], tokens: {} };
  }
}

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

loadDb();

function hashPassword(p) {
  return crypto.createHash('sha256').update(p + 'prysmis_salt_2025').digest('hex');
}

function generateToken() {
  return crypto.randomBytes(48).toString('hex');
}

function getTokenData(token) {
  if (!token) return null;
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
  return url.searchParams.get('token') || req.headers['authorization'] || '';
}

setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const t in db.tokens) {
    if (db.tokens[t].expires < now) { delete db.tokens[t]; changed = true; }
  }
  if (changed) saveDb();
}, 60 * 60 * 1000);

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const models = [
  "anthropic/claude-opus-4-6","anthropic/claude-sonnet-4-6","anthropic/claude-opus-4-5",
  "anthropic/claude-sonnet-4-5","anthropic/claude-haiku-4-5","openai/gpt-5.4",
  "openai/gpt-5.4-mini","openai/gpt-5.4-nano","openai/o3","openai/o4-mini","openai/o1",
  "openai/gpt-4o","google/gemini-3.2-pro","google/gemini-3.1-pro","google/gemini-2.5-pro",
  "google/gemini-1.5-pro","x-ai/grok-4","x-ai/grok-4-reasoning","x-ai/grok-4-fast",
  "deepseek/deepseek-r1","deepseek/deepseek-v3","deepseek/deepseek-coder",
  "meta-llama/llama-4-maverick","meta-llama/llama-4","meta-llama/llama-3.3",
  "mistral/mistral-large","mistral/mistral-large-2","minimax/minimax-m2.7",
  "qwen/qwen-3-coder","qwen/qwen-3","qwen/qwen-2.5","byte-dance/seed-1.5"
];

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' });
    res.end();
    return;
  }

  if (req.method === 'POST' && pathname === '/account') {
    try {
      const { username, password } = await readBody(req);
      if (!username || !password) return sendJson(res, 400, { error: 'Missing username or password' });
      if (username.length < 3 || username.length > 24) return sendJson(res, 400, { error: 'Username must be 3-24 characters' });
      if (!/^[a-zA-Z0-9_]+$/.test(username)) return sendJson(res, 400, { error: 'Username: letters, numbers, underscores only' });
      if (password.length < 6) return sendJson(res, 400, { error: 'Password must be at least 6 characters' });
      if (db.users[username]) return sendJson(res, 409, { error: 'Username already taken' });
      const token = generateToken();
      db.users[username] = { hashed: hashPassword(password), created: Date.now(), chats: [] };
      db.tokens[token] = { username, expires: Date.now() + 30 * 24 * 60 * 60 * 1000 };
      saveDb();
      sendJson(res, 200, { success: true, token, username });
    } catch (e) { sendJson(res, 400, { error: 'Invalid request' }); }
    return;
  }

  if (req.method === 'POST' && pathname === '/login') {
    try {
      const { username, password } = await readBody(req);
      if (!username || !password) return sendJson(res, 400, { error: 'Missing username or password' });
      const user = db.users[username];
      if (!user) return sendJson(res, 401, { error: 'Username not found' });
      if (user.hashed !== hashPassword(password)) return sendJson(res, 401, { error: 'Incorrect password' });
      const token = generateToken();
      db.tokens[token] = { username, expires: Date.now() + 30 * 24 * 60 * 60 * 1000 };
      saveDb();
      sendJson(res, 200, { success: true, token, username });
    } catch (e) { sendJson(res, 400, { error: 'Invalid request' }); }
    return;
  }

  if (req.method === 'GET' && pathname === '/stats') {
    sendJson(res, 200, {
      users: Object.keys(db.users).length,
      active: Math.max(Object.values(db.tokens).filter(t => t.expires > Date.now()).length, 1),
      projects: db.projects.length
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/projects') {
    sendJson(res, 200, db.projects);
    return;
  }

  if (req.method === 'POST' && pathname === '/projects') {
    try {
      const td = getTokenData(getToken(req, url));
      if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
      const { title, link, about } = await readBody(req);
      if (!title || !link || !about) return sendJson(res, 400, { error: 'Missing fields' });
      if (title.length > 80) return sendJson(res, 400, { error: 'Title too long' });
      if (about.length > 500) return sendJson(res, 400, { error: 'Description too long' });
      const project = { id: crypto.randomBytes(8).toString('hex'), title, link, about, author: td.username, created: Date.now() };
      db.projects.unshift(project);
      saveDb();
      sendJson(res, 200, { success: true, project });
    } catch (e) { sendJson(res, 400, { error: 'Invalid request' }); }
    return;
  }

  if (req.method === 'DELETE' && pathname.startsWith('/projects/')) {
    try {
      const id = pathname.replace('/projects/', '');
      const td = getTokenData(getToken(req, url));
      if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
      const idx = db.projects.findIndex(p => p.id === id);
      if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
      if (db.projects[idx].author !== td.username) return sendJson(res, 403, { error: 'Not your project' });
      db.projects.splice(idx, 1);
      saveDb();
      sendJson(res, 200, { success: true });
    } catch (e) { sendJson(res, 400, { error: 'Invalid request' }); }
    return;
  }

  if (req.method === 'GET' && pathname === '/chats') {
    const td = getTokenData(getToken(req, url));
    if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
    const user = db.users[td.username];
    sendJson(res, 200, (user && user.chats) ? user.chats : []);
    return;
  }

  if (req.method === 'POST' && pathname === '/chats') {
    try {
      const td = getTokenData(getToken(req, url));
      if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
      const { title, messages } = await readBody(req);
      if (!title || !messages) return sendJson(res, 400, { error: 'Missing fields' });
      const user = db.users[td.username];
      if (!user) return sendJson(res, 404, { error: 'User not found' });
      if (!user.chats) user.chats = [];
      const chat = { id: crypto.randomBytes(8).toString('hex'), title: title.substring(0, 40), messages, created: Date.now() };
      user.chats.unshift(chat);
      if (user.chats.length > 50) user.chats = user.chats.slice(0, 50);
      saveDb();
      sendJson(res, 200, { success: true, chat });
    } catch (e) { sendJson(res, 400, { error: 'Invalid request' }); }
    return;
  }

  if (req.method === 'DELETE' && pathname.startsWith('/chats/')) {
    try {
      const id = pathname.replace('/chats/', '');
      const td = getTokenData(getToken(req, url));
      if (!td) return sendJson(res, 401, { error: 'Not authenticated' });
      const user = db.users[td.username];
      if (!user || !user.chats) return sendJson(res, 404, { error: 'Not found' });
      const idx = user.chats.findIndex(c => c.id === id);
      if (idx === -1) return sendJson(res, 404, { error: 'Chat not found' });
      user.chats.splice(idx, 1);
      saveDb();
      sendJson(res, 200, { success: true });
    } catch (e) { sendJson(res, 400, { error: 'Invalid request' }); }
    return;
  }

  if (req.method === 'POST' && (pathname === '/v1/chat/completions' || pathname === '/chat/completions')) {
    try {
      const data = await readBody(req);
      const model = url.searchParams.get('model') || data.model || 'anthropic/claude-sonnet-4-6';
      const completion = await client.chat.completions.create({
        model, messages: data.messages || [], stream: false,
        temperature: data.temperature, max_tokens: data.max_tokens
      });
      sendJson(res, 200, completion);
    } catch (e) { sendJson(res, 500, { error: e.message }); }
    return;
  }

  if (req.method === 'GET') {
    let filePath = '.' + (pathname === '/' ? '/index.html' : pathname);
    if (filePath.endsWith('/')) filePath += 'index.html';
    const ext = path.extname(filePath);
    const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' }[ext] || 'text/plain';
    fs.readFile(filePath, (err, fileData) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': mime });
      res.end(fileData);
    });
    return;
  }

  res.writeHead(404);
  res.end();
}).listen(process.env.PORT || 3000, '0.0.0.0');
