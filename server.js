const http = require('http');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const client = new OpenAI({
  baseURL: 'https://api.puter.com/puterai/openai/v1/',
  apiKey: process.env.PUTER_TOKEN
});

let db = { users: {}, sessions: {}, tokens: {} };
if (fs.existsSync('db.json')) db = JSON.parse(fs.readFileSync('db.json'));

function saveDb() {
  fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
}

const models = [
  "anthropic/claude-opus-4-6",
  "anthropic/claude-sonnet-4-6",
  "anthropic/claude-opus-4-5",
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-haiku-4-5",
  "openai/gpt-5.4",
  "openai/gpt-5.4-mini",
  "openai/gpt-5.4-nano",
  "openai/o3",
  "openai/o4-mini",
  "openai/o1",
  "openai/gpt-4o",
  "google/gemini-3.2-pro",
  "google/gemini-3.1-pro",
  "google/gemini-2.5-pro",
  "google/gemini-1.5-pro",
  "x-ai/grok-4",
  "x-ai/grok-4-reasoning",
  "x-ai/grok-4-fast",
  "deepseek/deepseek-r1",
  "deepseek/deepseek-v3",
  "deepseek/deepseek-coder",
  "meta-llama/llama-4-maverick",
  "meta-llama/llama-4",
  "meta-llama/llama-3.3",
  "mistral/mistral-large",
  "mistral/mistral-large-2",
  "minimax/minimax-m2.7",
  "qwen/qwen-3-coder",
  "qwen/qwen-3",
  "qwen/qwen-2.5",
  "byte-dance/seed-1.5"
];

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === 'POST' && pathname === '/account') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        if (!username || !password) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing username or password' }));
          return;
        }
        if (db.users[username]) {
          res.writeHead(409);
          res.end(JSON.stringify({ error: 'Username already exists' }));
          return;
        }
        const token = Buffer.from(`${username}:${password}:${Date.now()}`).toString('base64');
        db.users[username] = { password, token, created: Date.now() };
        db.sessions[username] = { model: 'anthropic/claude-sonnet-4-6', connected: false, lastActive: Date.now() };
        db.tokens[token] = { username, expires: Date.now() + 30*24*60*60*1000 };
        saveDb();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, token }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/login') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        if (db.users[username] && db.users[username].password === password) {
          const token = db.users[username].token;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, token }));
        } else {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Invalid credentials' }));
        }
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(models));
    return;
  }

  if (req.method === 'GET' && pathname === '/status') {
    const token = url.searchParams.get('token');
    if (!token || !db.tokens[token] || db.tokens[token].expires < Date.now()) {
      res.writeHead(401);
      res.end(JSON.stringify({ status: 'disconnected' }));
      return;
    }
    const username = db.tokens[token].username;
    if (!db.sessions[username]) {
      res.writeHead(404);
      res.end(JSON.stringify({ status: 'disconnected' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: db.sessions[username].connected ? 'connected' : 'disconnected',
      model: db.sessions[username].model
    }));
    return;
  }

  if (req.method === 'POST' && (pathname === '/v1/chat/completions' || pathname === '/chat/completions')) {
    const modelFromQuery = url.searchParams.get('model');
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const model = modelFromQuery || data.model || 'anthropic/claude-sonnet-4-6';

        const completion = await client.chat.completions.create({
          model,
          messages: data.messages || [],
          stream: data.stream || false,
          temperature: data.temperature,
          max_tokens: data.max_tokens
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(completion));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && !pathname.startsWith('/v1/') && !pathname.startsWith('/chat/')) {
    let filePath = '.' + (pathname === '/' ? '/index.html' : pathname);
    const ext = path.extname(filePath);
    const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }[ext] || 'text/plain';
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
    return;
  }

  res.writeHead(404);
  res.end();
}).listen(process.env.PORT || 3000, '0.0.0.0');
