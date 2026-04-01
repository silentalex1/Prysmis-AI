const express = require('express');
const path = require('path');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

const studioSessions = new Map();
const studioFiles = new Map();
const pendingCommands = new Map();

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

  const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2-vision';

  const ollamaMessages = [];

  if (system) {
    ollamaMessages.push({ role: 'system', content: system });
  }

  for (const msg of messages) {
    if (msg.role === 'user') {
      if (Array.isArray(msg.content)) {
        const textParts = msg.content.filter(p => p.type === 'text').map(p => p.text).join('\n');
        const imgParts = msg.content.filter(p => p.type === 'image');
        if (imgParts.length > 0) {
          ollamaMessages.push({
            role: 'user',
            content: textParts || 'Analyze this image.',
            images: imgParts.map(p => p.source.data)
          });
        } else {
          ollamaMessages.push({ role: 'user', content: textParts });
        }
      } else {
        ollamaMessages.push({ role: 'user', content: msg.content });
      }
    } else if (msg.role === 'assistant') {
      ollamaMessages.push({
        role: 'assistant',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      });
    }
  }

  try {
    const ollamaRes = await fetch(OLLAMA_HOST + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: ollamaMessages,
        stream: true,
        options: { temperature: 0.7, num_ctx: 8192 }
      })
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text();
      res.write('data: ' + JSON.stringify({ error: 'Ollama error: ' + errText }) + '\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message && parsed.message.content) {
            res.write('data: ' + JSON.stringify({ text: parsed.message.content }) + '\n\n');
          }
          if (parsed.done) {
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }
        } catch(e) {}
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write('data: ' + JSON.stringify({ error: 'Could not connect to Ollama. Make sure Ollama is running and OLLAMA_HOST is set correctly. ' + err.message }) + '\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

app.post('/api/studio/connect', function(req, res) {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, error: 'No token provided' });
  const session = studioSessions.get(token);
  if (!session) return res.status(401).json({ success: false, error: 'Invalid token' });
  session.connectedAt = Date.now();
  session.pluginConnected = true;
  pendingCommands.set(token, []);
  return res.json({ success: true, username: session.username, model: 'llama3.2-vision' });
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
