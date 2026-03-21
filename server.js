const http = require('http');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const client = new OpenAI({
  baseURL: 'https://api.puter.com/puterai/openai/v1/',
  apiKey: process.env.PUTER_TOKEN
});

const models = [
"anthropic/claude-opus-4-6","anthropic/claude-sonnet-4-6","anthropic/claude-opus-4-5","anthropic/claude-sonnet-4-5","anthropic/claude-haiku-4-5",
"openai/gpt-5.4","openai/gpt-5.4-mini","openai/gpt-5.4-nano","openai/gpt-5","openai/o3","openai/o4-mini","openai/o1","openai/gpt-4.1",
"google/gemini-3.1-pro","google/gemini-3.1-flash","google/gemini-3-pro","google/gemini-2.5-pro","google/gemini-2.5-flash",
"x-ai/grok-4","x-ai/grok-4.20-beta","x-ai/grok-4-fast","x-ai/grok-4.1","x-ai/grok-4-reasoning",
"deepseek/deepseek-r1","deepseek/deepseek-v3","deepseek/deepseek-coder","deepseek/deepseek-v3-0324",
"meta-llama/llama-4-maverick","meta-llama/llama-4","meta-llama/llama-3.3","meta-llama/llama-3.1",
"mistral/mistral-large","mistral/mistral-small","mistral/mistral-medium","mistral/mixtral-8x22b",
"minimax/minimax-m2.7","minimax/minimax-m2","qwen/qwen-3-coder","qwen/qwen-3","qwen/qwen-2.5",
"byte-dance/seed-1.5","byte-dance/seed-1","glm/glm-5","glm/glm-4.6","kling/kling-2"
];

http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(models));
    return;
  }
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
}).listen(process.env.PORT || 3000, '0.0.0.0');
