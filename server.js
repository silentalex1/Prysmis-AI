const http = require('http');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const client = new OpenAI({
  baseURL: 'https://api.puter.com/puterai/openai/v1/',
  apiKey: process.env.PUTER_TOKEN
});

http.createServer((req, res) => {
  if (req.method === 'GET' && !req.url.startsWith('/v1/')) {
    let filePath = '.' + (req.url === '/' ? '/index.html' : req.url);
    const ext = path.extname(filePath);
    const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }[ext] || 'text/plain';
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
    return;
  }
  if (req.method === 'POST' && req.url.startsWith('/v1/chat/completions')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const model = url.searchParams.get('model') || 'anthropic/claude-sonnet-4-6';
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
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
  res.writeHead(404);
  res.end();
}).listen(process.env.PORT || 3000);
