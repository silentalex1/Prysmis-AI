const express = require('express');
const path = require('path');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

const studioSessions = new Map();
const studioFiles = new Map();
const pendingCommands = new Map();
const adminCodes = new Map();

let ollamaModel = null;

async function getModel() {
  if (ollamaModel) return ollamaModel;
  const { ChatOllama } = await import('@langchain/ollama');
  ollamaModel = new ChatOllama({
    baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2-vision',
    streaming: true,
    temperature: 0.7,
    numCtx: 8192,
  });
  return ollamaModel;
}

app.use('/aichat', express.static(path.join(__dirname, 'aichat')));
app.use('/auth', express.static(path.join(__dirname, 'auth')));
app.use('/API', express.static(path.join(__dirname, 'API')));
app.use(express.static(path.join(__dirname)));

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/aichat', function(req, res) {
  res.sendFile(path.join(__dirname, 'aichat', 'index.html'));
});

app.get('/auth', function(req, res) {
  res.sendFile(path.join(__dirname, 'auth', 'index.html'));
});

app.get('/API', function(req, res) {
  res.sendFile(path.join(__dirname, 'API', 'index.html'));
});

app.post('/api/chat', async function(req, res) {
  const { messages, system } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const { HumanMessage, AIMessage, SystemMessage } = await import('@langchain/core/messages');
    const model = await getModel();

    const langchainMessages = [];
    if (system) langchainMessages.push(new SystemMessage(system));

    for (const msg of messages) {
      if (msg.role === 'user') {
        if (Array.isArray(msg.content)) {
          const textParts = msg.content.filter(p => p.type === 'text').map(p => p.text).join('\n');
          const imgParts = msg.content.filter(p => p.type === 'image');
          if (imgParts.length > 0) {
            langchainMessages.push(new HumanMessage({
              content: [
                ...imgParts.map(p => ({
                  type: 'image_url',
                  image_url: { url: 'data:' + p.source.media_type + ';base64,' + p.source.data }
                })),
                { type: 'text', text: textParts || 'Analyze this image.' }
              ]
            }));
          } else {
            langchainMessages.push(new HumanMessage(textParts));
          }
        } else {
          langchainMessages.push(new HumanMessage(msg.content));
        }
      } else if (msg.role === 'assistant') {
        langchainMessages.push(new AIMessage(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)));
      }
    }

    const stream = await model.stream(langchainMessages);
    for await (const chunk of stream) {
      const text = typeof chunk.content === 'string' ? chunk.content : '';
      if (text) res.write('data: ' + JSON.stringify({ text }) + '\n\n');
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write('data: ' + JSON.stringify({ error: err.message || 'Ollama error' }) + '\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

app.get('/api/bot/stats', function(req, res) {
  const botSecret = req.headers['x-bot-secret'];
  if (!botSecret || botSecret !== process.env.BOT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.json({
    status: 'online',
    port: PORT,
    activeSessions: studioSessions.size,
    connectedPlugins: Array.from(studioSessions.values()).filter(s => s.pluginConnected).length,
    uptime: process.uptime()
  });
});

app.post('/api/bot/setadmin', function(req, res) {
  const botSecret = req.headers['x-bot-secret'];
  if (!botSecret || botSecret !== process.env.BOT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { username, code } = req.body;
  if (!username || !code) return res.status(400).json({ error: 'Missing username or code' });

  adminCodes.set(code, {
    username: username.toLowerCase(),
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000
  });

  return res.json({ success: true });
});

app.post('/api/bot/verify', function(req, res) {
  const { code, username } = req.body;
  if (!code || !username) return res.status(400).json({ error: 'Missing code or username' });

  const entry = adminCodes.get(code);
  if (!entry) return res.status(404).json({ error: 'Invalid code' });
  if (Date.now() > entry.expiresAt) {
    adminCodes.delete(code);
    return res.status(410).json({ error: 'Code expired' });
  }
  if (entry.username !== username.toLowerCase()) {
    return res.status(403).json({ error: 'Code does not match this username' });
  }

  adminCodes.delete(code);

  const users = getUsers();
  if (!users[username.toLowerCase()]) {
    return res.status(404).json({ error: 'User not found on site' });
  }
  users[username.toLowerCase()].role = 'admin';
  saveUsers(users);

  return res.json({ success: true, username: username });
});

app.post('/api/bot/run', function(req, res) {
  const botSecret = req.headers['x-bot-secret'];
  if (!botSecret || botSecret !== process.env.BOT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'Missing command' });

  const { exec } = require('child_process');
  exec(command, { timeout: 15000 }, function(err, stdout, stderr) {
    return res.json({
      success: !err,
      stdout: stdout || '',
      stderr: stderr || '',
      error: err ? err.message : null
    });
  });
});

const fs = require('fs');
const USERS_FILE = path.join(__dirname, 'users.json');

function getUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return {};
  } catch(e) { return {}; }
}

function saveUsers(users) {
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); } catch(e) {}
}

app.post('/api/auth/register', function(req, res) {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  const users = getUsers();
  if (users[username.toLowerCase()]) return res.status(409).json({ error: 'Username taken' });
  users[username.toLowerCase()] = { username, password, role: 'user', createdAt: Date.now() };
  saveUsers(users);
  return res.json({ success: true, username, role: 'user' });
});

app.post('/api/auth/login', function(req, res) {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  const users = getUsers();
  const user = users[username.toLowerCase()];
  if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
  return res.json({ success: true, username: user.username, role: user.role || 'user' });
});

app.post('/api/studio/connect', function(req, res) {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, error: 'No token provided' });
  const session = studioSessions.get(token);
  if (!session) return res.status(401).json({ success: false, error: 'Invalid token' });
  session.connectedAt = Date.now();
  session.pluginConnected = true;
  pendingCommands.set(token, []);
  return res.json({ success: true, username: session.username, model: process.env.OLLAMA_MODEL || 'llama3.2-vision' });
});

app.post('/api/studio/files', function(req, res) {
  const { token, files } = req.body;
  if (!token || !files) return res.status(400).json({ success: false, error: 'Missing token or files' });
  const session = studioSessions.get(token);
  if (!session) return res.status(401).json({ success: false, error: 'Invalid token' });
  studioFiles.set(token, { files, uploadedAt: Date.now() });
  return res.json({ success: true });
});

app.get('/api/studio/poll', function(req, res) {
  const token = req.query.token;
  if (!token) return res.status(400).json({ commands: [] });
  const session = studioSessions.get(token);
  if (!session) return res.status(401).json({ commands: [] });
  const cmds = pendingCommands.get(token) || [];
  pendingCommands.set(token, []);
  return res.json({ commands: cmds });
});

app.post('/api/studio/ack', function(req, res) {
  return res.json({ success: true });
});

app.post('/api/studio/command', function(req, res) {
  const { token, command } = req.body;
  if (!token || !command) return res.status(400).json({ success: false });
  const session = studioSessions.get(token);
  if (!session) return res.status(401).json({ success: false });
  const cmds = pendingCommands.get(token) || [];
  command.id = crypto.randomUUID();
  cmds.push(command);
  pendingCommands.set(token, cmds);
  return res.json({ success: true, commandId: command.id });
});

app.post('/api/studio/register-token', function(req, res) {
  const { token, username } = req.body;
  if (!token || !username) return res.status(400).json({ success: false });
  studioSessions.set(token, { username, createdAt: Date.now(), pluginConnected: false });
  return res.json({ success: true });
});

app.get('/api/studio/files', function(req, res) {
  const token = req.query.token;
  if (!token) return res.status(400).json({ success: false });
  const session = studioSessions.get(token);
  if (!session) return res.status(401).json({ success: false });
  const data = studioFiles.get(token);
  if (!data) return res.json({ success: true, files: null });
  return res.json({ success: true, files: data.files, uploadedAt: data.uploadedAt });
});

app.get('/api/studio/status', function(req, res) {
  const token = req.query.token;
  if (!token) return res.status(400).json({ connected: false });
  const session = studioSessions.get(token);
  if (!session) return res.status(401).json({ connected: false });
  return res.json({ connected: session.pluginConnected, username: session.username });
});

app.listen(PORT, function() {
  console.log('PrysmisAI running on http://localhost:' + PORT);
});
