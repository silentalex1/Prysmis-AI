const http = require('http');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const client = new OpenAI({
  baseURL: 'https://api.puter.com/puterai/openai/v1/',
  apiKey: process.env.PUTER_TOKEN
});

let db = { users: {}, sessions: {} };
if (fs.existsSync('db.json')) {
  db = JSON.parse(fs.readFileSync('db.json'));
}

function saveDb() {
  fs.writeFileSync('db.json', JSON.stringify(db));
}

const models = [
  "anthropic/claude-opus-4-6",
  "anthropic/claude-sonnet-4-6",
  "anthropic/claude-opus-4-5",
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-haiku-4-5",
  "openai/gpt-5.4",
  "openai/gpt-5.2",
  "openai/o3",
  "openai/o4-mini",
  "openai/o1",
  "google/gemini-3.2-pro",
  "google/gemini-3.1-pro",
  "google/gemini-2.5-pro",
  "x-ai/grok-4",
  "x-ai/grok-4-reasoning",
  "deepseek/deepseek-r1",
  "deepseek/deepseek-v3",
  "meta-llama/llama-4-maverick",
  "meta-llama/llama-4",
  "mistral/mistral-large",
  "minimax/minimax-m2.7",
  "qwen/qwen-3-coder",
  "qwen/qwen-3"
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
        db.users[username] = { password, created: Date.now() };
        db.sessions[username] = { model: 'anthropic/claude-sonnet-4-6', connected: false };
        saveDb();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
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
    const user = url.searchParams.get('user');
    if (!user || !db.sessions[user]) {
      res.writeHead(401);
      res.end(JSON.stringify({ status: 'disconnected' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: db.sessions[user].connected ? 'connected' : 'disconnected',
      model: db.sessions[user].model
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
