const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const https = require('https');

const DB_FILE = 'db.json';
const DB_BACKUP = 'db.backup.json';
const SALT = 'prysmis_v3_kx9salt2025';
const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000;
const MAX_CHATS = 100;
const MAX_PROJECTS = 500;
const MAX_COMMUNITY_MSGS = 2000;
const ALLOWED_DISCORD_IDS = ['841749813702688858', '1360884411154825336', '617174993242947585'];

let db = {
  users: {},
  projects: [],
  tokens: {},
  communityChat: [],
  admins: {},
  adminCodes: {},
  announcements: [],
  meta: { version: 5, created: Date.now() }
};
let saveScheduled = false;
const sseClients = new Set();

const YOU_MODELS = [
  'psm-v1.0',
  'manus-1.6-lite',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mistral-saba-24b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3-32b',
  'whisper-large-v3',
  'whisper-large-v3-turbo',
  'distil-whisper-large-v3-en'
];

const GROQ_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mistral-saba-24b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3-32b',
  'whisper-large-v3',
  'whisper-large-v3-turbo',
  'distil-whisper-large-v3-en'
]);

const PREMIUM_ONLY_MODELS = new Set([
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3-32b'
]);

const MODEL_MAP = {
  'psm-v1.0': 'psm-v1.0',
  'manus-1.6-lite': 'manus-1.6-lite',
  'llama-3.3-70b-versatile': 'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant': 'llama-3.1-8b-instant',
  'mistral-saba-24b': 'mistral-saba-24b',
  'meta-llama/llama-4-scout-17b-16e-instruct': 'meta-llama/llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-120b': 'openai/gpt-oss-120b',
  'openai/gpt-oss-20b': 'openai/gpt-oss-20b',
  'qwen/qwen3-32b': 'qwen/qwen3-32b',
  'whisper-large-v3': 'whisper-large-v3',
  'whisper-large-v3-turbo': 'whisper-large-v3-turbo',
  'distil-whisper-large-v3-en': 'distil-whisper-large-v3-en'
};

function tryStartOllama() {
  try {
    const proc = spawn("ollama", ["serve"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      shell: process.platform === "win32"
    });
    proc.on("error", function() {});
    proc.on("close", function() {});
    try { proc.unref(); } catch(e) {}
  } catch (e) {}
  process.on("uncaughtException", function(e) {
    if (e && (e.code === "ENOENT" || e.syscall === "spawn ollama")) return;
    throw e;
  });
}

function callOllamaLocal(messages, temperature, maxTokens) {
  return new Promise((resolve, reject) => {
    const safeMax = Math.min(maxTokens || 2048, 4096);
    const cleanMsgs = messages.map(m => {
      if (typeof m.content === "string") return { role: m.role, content: m.content };
      if (Array.isArray(m.content)) return { role: m.role, content: m.content.filter(p => p.type === "text").map(p => p.text).join(" ") };
      return { role: m.role, content: String(m.content || "") };
    });
    const postData = JSON.stringify({
      model: "llama3.2-vision:latest",
      messages: cleanMsgs,
      stream: false,
      options: { temperature: temperature, num_predict: safeMax }
    });
    const opts = {
      hostname: "127.0.0.1",
      port: 11434,
      path: "/api/chat",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) },
      timeout: 120000
    };
    const req = http.request(opts, (ollamaRes) => {
      let data = "";
      ollamaRes.on("data", (c) => { data += c; });
      ollamaRes.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("Invalid response from model")); }
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", (e) => { reject(e); });
    req.write(postData);
    req.end();
  });
}

async function callOllama(messages, temperature, maxTokens) {
  try {
    const result = await callOllamaLocal(messages, temperature, maxTokens);
    return result;
  } catch (e) {
    if (e.code === "ECONNREFUSED" || e.code === "ENOENT") {
      throw new Error("PSM-v1.0 is starting up. Please wait a few seconds and try again.");
    }
    throw new Error(e.message || "PSM-v1.0 could not respond. Please try again.");
  }
}

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      db.users = parsed.users || {};
      db.projects = Array.isArray(parsed.projects) ? parsed.projects : [];
      db.tokens = parsed.tokens || {};
      db.communityChat = Array.isArray(parsed.communityChat) ? parsed.communityChat : [];
      db.admins = parsed.admins || {};
      db.adminCodes = parsed.adminCodes || {};
      db.announcements = Array.isArray(parsed.announcements) ? parsed.announcements : [];
      db.meta = parsed.meta || { version: 5, created: Date.now() };
      for (const u in db.users) {
        if (typeof db.users[u].hashed !== "string") { delete db.users[u]; continue; }
        if (!Array.isArray(db.users[u].chats)) db.users[u].chats = [];
        if (!db.users[u].created) db.users[u].created = Date.now();
      }
      return;
    }
  } catch (_) {
    try {
      if (fs.existsSync(DB_BACKUP)) {
        const parsed = JSON.parse(fs.readFileSync(DB_BACKUP, "utf8"));
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
      fs.writeFileSync(DB_FILE + ".tmp", json);
      if (fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, DB_BACKUP);
      fs.renameSync(DB_FILE + ".tmp", DB_FILE);
    } catch (_) {}
  });
}

loadDb();

function hash(p) {
  return crypto.createHash("sha256").update(p + SALT).digest("hex");
}

function randToken() {
  return crypto.randomBytes(64).toString("hex");
}

function getTokenData(t) {
  if (!t || typeof t !== "string" || t.length < 10) return null;
  const td = db.tokens[t];
  if (!td) return null;
  if (td.expires < Date.now()) { delete db.tokens[t]; saveDb(); return null; }
  return td;
}

function getReqToken(req, url) {
  const q = url.searchParams.get("token") || "";
  const h = (req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
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
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Discord-Secret,X-Manus-Key",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", c => {
      size += c.length;
      if (size > 20 * 1024 * 1024) { reject(new Error("Body too large")); return; }
      body += c;
    });
    req.on("end", () => {
      if (!body.trim()) { resolve({}); return; }
      try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function validateUsername(u) {
  if (typeof u !== "string") return "Username required";
  const t = u.trim();
  if (t.length < 3) return "Username must be at least 3 characters";
  if (t.length > 24) return "Username must be 24 characters or less";
  if (!/^[a-zA-Z0-9_]+$/.test(t)) return "Letters, numbers, underscores only";
  return null;
}

function validatePassword(p) {
  if (typeof p !== "string") return "Password required";
  if (p.length < 6) return "Password must be at least 6 characters";
  if (p.length > 128) return "Password too long";
  return null;
}

function callGroq(messages, temperature, maxTokens, groqApiKey, model) {
  return new Promise((resolve, reject) => {
    const safeMax = Math.min(maxTokens || 2048, 8192);
    const cleanMsgs = messages.map(m => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : (Array.isArray(m.content) ? m.content.filter(p => p.type === "text").map(p => p.text).join(" ") : String(m.content || ""))
    }));
    const postData = JSON.stringify({ model: model, messages: cleanMsgs, temperature: temperature, max_tokens: safeMax });
    const opts = {
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + groqApiKey, "Content-Length": Buffer.byteLength(postData) },
      timeout: 60000
    };
    const req = https.request(opts, (groqRes) => {
      let data = "";
      groqRes.on("data", (c) => { data += c; });
      groqRes.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            const errMsg = parsed.error.message || "Groq API error";
            const errCode = parsed.error.code || "";
            const errType = parsed.error.type || "";
            const httpStatus = groqRes.statusCode;
            const isQuotaExhausted =
              httpStatus === 429 ||
              httpStatus === 402 ||
              errCode === "rate_limit_exceeded" ||
              errCode === "insufficient_quota" ||
              errCode === "invalid_api_key" ||
              errCode === "api_key_expired" ||
              errType === "tokens" ||
              errType === "requests" ||
              /rate.?limit|quota|exhausted|expired/i.test(errMsg);
            reject({ error: errMsg, groqQuotaExhausted: isQuotaExhausted, status: httpStatus });
          } else {
            resolve(parsed);
          }
        } catch (e) { reject(new Error("Invalid response from Groq")); }
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("Groq timeout")); });
    req.on("error", (e) => { reject(e); });
    req.write(postData);
    req.end();
  });
}

function callManus(messages, temperature, maxTokens, manusApiKey) {
  return new Promise((resolve, reject) => {
    const cleanMsgs = messages.map(m => {
      let content = "";
      if (typeof m.content === "string") content = m.content;
      else if (Array.isArray(m.content)) content = m.content.filter(p => p.type === "text").map(p => p.text).join(" ");
      return { role: m.role, content: [{ type: "input_text", text: content }] };
    });
    const postData = JSON.stringify({
      input: cleanMsgs,
      extra_body: { task_mode: "agent", agent_profile: "manus-1.6" }
    });
    const opts = {
      hostname: "api.manus.im",
      path: "/v1/responses",
      method: "POST",
      headers: { "Content-Type": "application/json", "API_KEY": manusApiKey, "Content-Length": Buffer.byteLength(postData) },
      timeout: 60000
    };
    const req = https.request(opts, (manusRes) => {
      let data = "";
      manusRes.on("data", (c) => { data += c; });
      manusRes.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (manusRes.statusCode >= 400) {
            reject({ error: parsed.error || "Manus API error", status: manusRes.statusCode });
            return;
          }
          const taskId = parsed.id;
          const poll = () => {
            const pollOpts = { hostname: "api.manus.im", path: "/v1/responses/" + taskId, method: "GET", headers: { "API_KEY": manusApiKey } };
            const pollReq = https.request(pollOpts, (pRes) => {
              let pData = "";
              pRes.on("data", (c) => { pData += c; });
              pRes.on("end", () => {
                try {
                  const pParsed = JSON.parse(pData);
                  if (pParsed.status === "completed") {
                    const lastMsg = pParsed.output.filter(m => m.role === "assistant").pop();
                    const text = lastMsg.content.filter(c => c.type === "text").map(c => c.text).join("\n");
                    resolve({ choices: [{ message: { role: "assistant", content: text }, finish_reason: "stop" }] });
                  } else if (pParsed.status === "error") {
                    reject({ error: "Manus task error", status: 500 });
                  } else {
                    setTimeout(poll, 5000);
                  }
                } catch (e) { reject(new Error("Invalid Manus poll response")); }
              });
            });
            pollReq.on("error", reject);
            pollReq.end();
          };
          setTimeout(poll, 5000);
        } catch (e) { reject(new Error("Invalid response from Manus")); }
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("Manus timeout")); });
    req.on("error", (e) => { reject(e); });
    req.write(postData);
    req.end();
  });
}

function broadcastSSE(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch (_) { sseClients.delete(client); }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pt = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Discord-Secret,X-Manus-Key"
    });
    res.end();
    return;
  }

  if (req.method === "POST" && pt === "/v1/chat/completions") {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: "Not authenticated" });
    let body;
    try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: "Invalid body" }); }
    const { model, messages, temperature, max_tokens } = body;
    if (!model || !messages) return sendJson(res, 400, { error: "model and messages required" });
    if (PREMIUM_ONLY_MODELS.has(model) && !td.isAdmin && !td.isPremium) {
      return sendJson(res, 403, { error: "Premium required", premiumRequired: true });
    }
    try {
      let result;
      if (model === "psm-v1.0") {
        result = await callOllama(messages, temperature, max_tokens);
        const text = result.message ? result.message.content : "No response";
        return sendJson(res, 200, { choices: [{ message: { role: "assistant", content: text }, finish_reason: "stop" }] });
      } else if (model === "manus-1.6-lite") {
        const manusKey = req.headers["x-manus-key"];
        if (!manusKey) return sendJson(res, 400, { error: "Manus API key required" });
        result = await callManus(messages, temperature, max_tokens, manusKey);
        return sendJson(res, 200, result);
      } else if (GROQ_MODELS.has(model)) {
        const groqKey = process.env.GROQ_API_KEY || "gsk_placeholder";
        result = await callGroq(messages, temperature, max_tokens, groqKey, model);
        return sendJson(res, 200, result);
      } else {
        return sendJson(res, 400, { error: "Unsupported model" });
      }
    } catch (e) {
      return sendJson(res, e.status || 500, { error: e.error || e.message || "AI Error", groqQuotaExhausted: !!e.groqQuotaExhausted });
    }
  }

  if (req.method === "POST" && pt === "/register") {
    let body;
    try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: "Invalid body" }); }
    const { username, password } = body;
    const uErr = validateUsername(username);
    if (uErr) return sendJson(res, 400, { error: uErr });
    const pErr = validatePassword(password);
    if (pErr) return sendJson(res, 400, { error: pErr });
    const uname = username.trim().toLowerCase();
    if (db.users[uname]) return sendJson(res, 409, { error: "Username taken" });
    db.users[uname] = { hashed: hash(password), created: Date.now(), lastLogin: null, loginCount: 0, chats: [], projects: [], pluginToken: null, pluginConnected: false, pluginLastPing: null, pluginGameInfo: null, pendingChanges: [], pendingCommand: null, changeHistory: [], studioFiles: [], studioFilesUpdated: null, apiKeyGenerationHistory: [], prysmisApiKeys: [] };
    saveDb();
    return sendJson(res, 200, { success: true });
  }

  if (req.method === "POST" && pt === "/login") {
    let body;
    try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: "Invalid body" }); }
    const { username, password } = body;
    if (!username || !password) return sendJson(res, 400, { error: "Credentials required" });
    const uname = username.trim().toLowerCase();
    const user = db.users[uname];
    if (!user || user.hashed !== hash(password)) return sendJson(res, 401, { error: "Invalid credentials" });
    const token = randToken();
    const isAdmin = !!db.admins[uname];
    db.tokens[token] = { username: uname, isAdmin, isPremium: isAdmin || !!user.premium, expires: Date.now() + TOKEN_TTL };
    user.lastLogin = Date.now();
    user.loginCount++;
    saveDb();
    return sendJson(res, 200, { success: true, token, username: uname, isAdmin });
  }

  if (req.method === "GET" && pt === "/me") {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: "Not authenticated" });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: "User not found" });
    return sendJson(res, 200, { username: td.username, isAdmin: td.isAdmin, premium: td.isAdmin || !!user.premium, created: user.created, lastLogin: user.lastLogin, loginCount: user.loginCount });
  }

  if (req.method === "GET" && pt === "/chats") {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: "Not authenticated" });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: "User not found" });
    return sendJson(res, 200, user.chats || []);
  }

  if (req.method === "POST" && pt === "/chats") {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: "Not authenticated" });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: "User not found" });
    let body;
    try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: "Invalid body" }); }
    const chat = { id: crypto.randomBytes(8).toString("hex"), title: body.title || "New Chat", messages: body.messages || [], created: Date.now(), updated: Date.now() };
    if (!Array.isArray(user.chats)) user.chats = [];
    user.chats.unshift(chat);
    if (user.chats.length > MAX_CHATS) user.chats = user.chats.slice(0, MAX_CHATS);
    saveDb();
    return sendJson(res, 200, { success: true, chat });
  }

  if (req.method === "PUT" && pt.startsWith("/chats/")) {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: "Not authenticated" });
    const chatId = pt.substring("/chats/".length);
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: "User not found" });
    let body;
    try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: "Invalid body" }); }
    const chat = user.chats.find(c => c.id === chatId);
    if (!chat) return sendJson(res, 404, { error: "Chat not found" });
    chat.messages = body.messages || chat.messages;
    chat.updated = Date.now();
    saveDb();
    return sendJson(res, 200, { success: true });
  }

  if (req.method === "DELETE" && pt.startsWith("/chats/")) {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: "Not authenticated" });
    const chatId = pt.substring("/chats/".length);
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: "User not found" });
    user.chats = user.chats.filter(c => c.id !== chatId);
    saveDb();
    return sendJson(res, 200, { success: true });
  }

  if (req.method === "GET" && pt === "/projects") {
    return sendJson(res, 200, db.projects);
  }

  if (req.method === "POST" && pt === "/projects") {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: "Not authenticated" });
    let body;
    try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: "Invalid body" }); }
    const project = { id: crypto.randomBytes(8).toString("hex"), title: body.title, description: body.description, author: td.username, code: body.code, created: Date.now(), likes: 0 };
    db.projects.unshift(project);
    if (db.projects.length > MAX_PROJECTS) db.projects = db.projects.slice(0, MAX_PROJECTS);
    saveDb();
    return sendJson(res, 200, { success: true, project });
  }

  if (req.method === "GET" && pt === "/community/chat") {
    return sendJson(res, 200, db.communityChat);
  }

  if (req.method === "POST" && pt === "/community/chat") {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: "Not authenticated" });
    let body;
    try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: "Invalid body" }); }
    const msg = { id: crypto.randomBytes(8).toString("hex"), author: td.username, text: body.text, ts: Date.now(), isAdmin: td.isAdmin };
    db.communityChat.push(msg);
    if (db.communityChat.length > MAX_COMMUNITY_MSGS) db.communityChat = db.communityChat.slice(-MAX_COMMUNITY_MSGS);
    saveDb();
    broadcastSSE({ type: "chat", msg });
    return sendJson(res, 200, { success: true });
  }

  if (req.method === "POST" && pt === "/plugin/ping") {
    let body;
    try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: "Invalid body" }); }
    if (!body.pluginToken) return sendJson(res, 400, { error: "pluginToken required" });
    for (const u in db.users) {
      if (db.users[u].pluginToken === body.pluginToken) {
        db.users[u].pluginLastPing = Date.now();
        db.users[u].pluginConnected = true;
        saveDb();
        return sendJson(res, 200, { ok: true, username: u });
      }
    }
    return sendJson(res, 401, { error: "Invalid plugin token" });
  }

  if (req.method === "POST" && pt === "/plugin/files") {
    let body;
    try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: "Invalid body" }); }
    if (!body.pluginToken) return sendJson(res, 400, { error: "pluginToken required" });
    for (const u in db.users) {
      if (db.users[u].pluginToken === body.pluginToken) {
        db.users[u].studioFiles = body.files || [];
        db.users[u].studioFilesUpdated = Date.now();
        saveDb();
        return sendJson(res, 200, { ok: true });
      }
    }
    return sendJson(res, 401, { error: "Invalid plugin token" });
  }

  if (req.method === "GET" && pt === "/plugin/files") {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: "Not authenticated" });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: "User not found" });
    return sendJson(res, 200, { files: user.studioFiles || [], updated: user.studioFilesUpdated || null });
  }

  if (req.method === "POST" && pt === "/plugin/execute") {
    let body;
    try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: "Invalid body" }); }
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: "Not authenticated" });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: "User not found" });
    if (!user.pluginConnected) return sendJson(res, 400, { error: "Plugin not connected" });
    if (!body.code || !body.code.trim()) return sendJson(res, 400, { error: "code required" });
    if (!Array.isArray(user.pendingChanges)) user.pendingChanges = [];
    const change = { id: crypto.randomBytes(6).toString("hex"), code: body.code.trim(), description: body.description || "", created: Date.now() };
    user.pendingChanges.push(change);
    if (user.pendingChanges.length > 20) user.pendingChanges = user.pendingChanges.slice(-20);
    saveDb();
    return sendJson(res, 200, { ok: true, changeId: change.id, immediate: true });
  }

  if (req.method === "GET" && pt === "/plugin/poll") {
    const pluginToken = url.searchParams.get("pluginToken") || "";
    if (!pluginToken) return sendJson(res, 400, { error: "pluginToken required" });
    for (const u in db.users) {
      if (db.users[u].pluginToken === pluginToken) {
        const user = db.users[u];
        user.pluginLastPing = Date.now();
        user.pluginConnected = true;
        const changes = user.pendingChanges || [];
        user.pendingChanges = [];
        const command = user.pendingCommand || null;
        user.pendingCommand = null;
        if (changes.length > 0 || command) saveDb();
        return sendJson(res, 200, {
          changes,
          command,
          model: user.ollamaModel || "psm-v1.0",
          username: u,
          gameInfo: user.pluginGameInfo || null,
          serverTime: Date.now()
        });
      }
    }
    return sendJson(res, 401, { error: "Invalid plugin token" });
  }

  if (req.method === "POST" && pt === "/plugin/ack") {
    let body;
    try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: "Invalid body" }); }
    if (!body.pluginToken) return sendJson(res, 400, { error: "pluginToken required" });
    for (const u in db.users) {
      if (db.users[u].pluginToken === body.pluginToken) {
        const user = db.users[u];
        if (!Array.isArray(user.changeHistory)) user.changeHistory = [];
        user.changeHistory.push({
          id: body.changeId,
          ok: body.ok,
          results: body.results || [],
          appliedCount: body.appliedCount || 0,
          errorCount: body.errorCount || 0,
          ts: Date.now()
        });
        if (user.changeHistory.length > 50) user.changeHistory = user.changeHistory.slice(-50);
        saveDb();
        broadcastSSE({ type: "ack", changeId: body.changeId, ok: body.ok, results: body.results, appliedCount: body.appliedCount, errorCount: body.errorCount });
        return sendJson(res, 200, { ok: true });
      }
    }
    return sendJson(res, 401, { error: "Invalid plugin token" });
  }

  if (req.method === "POST" && pt === "/plugin/command") {
    let body;
    try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: "Invalid body" }); }
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: "Not authenticated" });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: "User not found" });
    if (!user.pluginConnected) return sendJson(res, 400, { error: "Plugin not connected" });
    user.pendingCommand = { type: body.type, ...body };
    saveDb();
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && pt === "/plugin/history") {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: "Not authenticated" });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: "User not found" });
    return sendJson(res, 200, { history: user.changeHistory || [] });
  }

  if (req.method === "POST" && pt === "/plugin/gameinfo") {
    let body;
    try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: "Invalid body" }); }
    if (!body.pluginToken) return sendJson(res, 400, { error: "pluginToken required" });
    for (const u in db.users) {
      if (db.users[u].pluginToken === body.pluginToken) {
        db.users[u].pluginGameInfo = {
          gameId: body.gameId,
          placeId: body.placeId,
          gameName: body.gameName,
          scriptCount: body.scriptCount || 0,
          partCount: body.partCount || 0,
          modelCount: body.modelCount || 0,
          totalObjects: body.totalObjects || 0,
          ts: Date.now()
        };
        saveDb();
        return sendJson(res, 200, { ok: true });
      }
    }
    return sendJson(res, 401, { error: "Invalid plugin token" });
  }

  if (req.method === "GET" && pt === "/api/health") {
    tryStartOllama();
    const ollamaHealth = await new Promise((resolve) => {
      const opts = { hostname: "127.0.0.1", port: 11434, path: "/api/tags", method: "GET", timeout: 5000 };
      const hreq = http.request(opts, (hres) => {
        let data = "";
        hres.on("data", (c) => { data += c; });
        hres.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const models = parsed.models || [];
            const hasModel = models.some(m => m.name === "llama3.2-vision:latest");
            resolve({ ok: hasModel, reachable: true, model_available: hasModel, installed_models: models.map(m => m.name) });
          } catch (e) {
            resolve({ ok: false, reachable: true, model_available: false, error: "Invalid Ollama response" });
          }
        });
      });
      hreq.on("error", () => resolve({ ok: false, reachable: false, model_available: false, error: "Ollama starting up..." }));
      hreq.on("timeout", () => { hreq.destroy(); resolve({ ok: false, reachable: false, model_available: false, error: "Ollama timeout" }); });
      hreq.end();
    });
    return sendJson(res, 200, {
      ok: ollamaHealth.ok,
      service: "prysmisai-web",
      model: { display_name: "PSM-v1.0(PrysmisAI)", runtime_model: "llama3.2-vision:latest" },
      ollama: ollamaHealth
    });
  }

  if (req.method === "GET" && pt === "/api/meta") {
    const baseUrl = "https://" + (req.headers.host || "api.prysmisai.wtf");
    return sendJson(res, 200, {
      brand: "PrysmisAI",
      model: {
        display_name: "PSM-v1.0(PrysmisAI)",
        runtime_model: "llama3.2-vision:latest"
      },
      api: {
        base_url: baseUrl,
        endpoints: [
          { path: "/register", method: "POST", description: "Register a new user" },
          { path: "/login", method: "POST", description: "Login and get a token" },
          { path: "/logout", method: "POST", description: "Logout a user" },
          { path: "/me", method: "GET", description: "Get current user info" },
          { path: "/chat", method: "POST", description: "Send a chat message to the AI" },
          { path: "/chat/history", method: "GET", description: "Get chat history" },
          { path: "/projects", method: "POST", description: "Create a new project" },
          { path: "/projects", method: "GET", description: "Get user projects" },
          { path: "/projects/:id", method: "GET", description: "Get a specific project" },
          { path: "/projects/:id", method: "PUT", description: "Update a specific project" },
          { path: "/projects/:id", method: "DELETE", description: "Delete a specific project" },
          { path: "/community/chat", method: "POST", description: "Send a message to community chat" },
          { path: "/community/chat", method: "GET", description: "Get community chat messages" },
          { path: "/plugin/ping", method: "POST", description: "Plugin heartbeat and initial connection" },
          { path: "/plugin/files", method: "POST", description: "Plugin sends file tree" },
          { path: "/plugin/files", method: "GET", description: "Get plugin file tree" },
          { path: "/plugin/execute", method: "POST", description: "Send code to plugin for execution" },
          { path: "/plugin/poll", method: "GET", description: "Plugin polls for changes" },
          { path: "/plugin/ack", method: "POST", description: "Plugin acknowledges change execution" },
          { path: "/plugin/command", method: "POST", description: "Send a command to plugin" },
          { path: "/plugin/history", method: "GET", description: "Get plugin change history" },
          { path: "/plugin/gameinfo", method: "POST", description: "Plugin sends game info" },
          { path: "/account/generate-prysmisai-key", method: "POST", description: "Generate a PrysmisAI API key" },
          { path: "/account/prysmisai-keys", method: "GET", description: "Get PrysmisAI API keys" },
          { path: "/announcements", method: "GET", description: "Get announcements" },
          { path: "/api/health", method: "GET", description: "Get API health status" },
          { path: "/api/meta", method: "GET", description: "Get API metadata" },
        ]
      },
      ollama_models: YOU_MODELS,
      groq_models: Array.from(GROQ_MODELS),
      premium_models: Array.from(PREMIUM_ONLY_MODELS),
      discord_bot_id: ALLOWED_DISCORD_IDS[0]
    });
  }

  if (req.method === "POST" && pt === "/account/generate-prysmisai-key") {
    let body;
    try { body = await readBody(req); } catch (_) { return sendJson(res, 400, { error: "Invalid body" }); }
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: "Not authenticated" });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: "User not found" });
    const now = Date.now();
    const oneDay = 24 * 3600000;
    if (!user.apiKeyGenerationHistory) user.apiKeyGenerationHistory = [];
    const recentGenerations = user.apiKeyGenerationHistory.filter(time => now - time < oneDay);
    if (recentGenerations.length >= 3) {
      const oldestGeneration = Math.min(...recentGenerations);
      const waitTime = Math.ceil((oldestGeneration + oneDay - now) / (60 * 60 * 1000));
      return sendJson(res, 429, { error: `After 3 generation of PrysmisAI API key you must wait 24 hours. Please wait ${waitTime} more hours.` });
    }
    const apiKey = "ps-prysmisai-" + crypto.randomBytes(20).toString("hex");
    if (!user.prysmisApiKeys) user.prysmisApiKeys = [];
    user.prysmisApiKeys.push({ key: apiKey, created: now });
    user.apiKeyGenerationHistory.push(now);
    saveDb();
    return sendJson(res, 200, { success: true, apiKey });
  }

  if (req.method === "GET" && pt === "/account/prysmisai-keys") {
    const td = getTokenData(getReqToken(req, url));
    if (!td) return sendJson(res, 401, { error: "Not authenticated" });
    const user = db.users[td.username];
    if (!user) return sendJson(res, 404, { error: "User not found" });
    const now = Date.now();
    const oneDay = 24 * 3600000;
    const recentGenerations = (user.apiKeyGenerationHistory || []).filter(time => now - time < oneDay);
    const canGenerate = recentGenerations.length < 3;
    return sendJson(res, 200, { 
      keys: user.prysmisApiKeys || [], 
      canGenerate,
      generationsLeft: Math.max(0, 3 - recentGenerations.length)
    });
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
