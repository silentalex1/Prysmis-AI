var storedUser = localStorage.getItem('user');
var storedToken = localStorage.getItem('token');
var storedIsAdmin = localStorage.getItem('isAdmin') === 'true';

if (!storedUser || !storedToken) {
  location.href = '/accountauth/index.html';
}

if (storedIsAdmin && window.location.pathname !== '/adminpanel') {
  fetch('/me?token=' + encodeURIComponent(storedToken))
    .then(function(r) { return r.json(); })
    .then(function(d) { if (d.isAdmin) location.href = '/adminpanel'; })
    .catch(function() {});
}

var chatArea = document.getElementById('chatArea');
var inputEl = document.getElementById('input');
var sendBtn = document.getElementById('sendBtn');
var modelSelect = document.getElementById('modelSelect');
var presetsEl = document.getElementById('presets');
var projectsList = document.getElementById('projectsList');
var modal = document.getElementById('addGameModal');
var postGameBtn = document.getElementById('postGameBtn');
var newChatBtn = document.getElementById('newChatBtn');
var chatHistoryEl = document.getElementById('chatHistory');
var userNameEl = document.getElementById('userName');

userNameEl.textContent = storedUser || 'User';

var currentMessages = [];
var activeChatId = null;
var userHasPremium = localStorage.getItem('isAdmin') === 'true';

var PREMIUM_MODELS = { 'claude-opus-4-5': true, 'gemini-3.1-pro-preview': true };

var MODEL_API_MAP = {
  'gpt-5.2': 'gpt-5.2',
  'claude-opus-4-5': 'claude-opus-4-5',
  'gemini-3.1-pro-preview': 'gemini-3.1-pro-preview',
  'claude-sonnet-4-5': 'claude-sonnet-4-5',
  'gpt-4o': 'gpt-4o'
};

fetch('/me?token=' + encodeURIComponent(storedToken))
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.premium || d.isAdmin) {
      userHasPremium = true;
      localStorage.setItem('isPremium', 'true');
      unlockPremiumOptions();
    }
    if (d.username) userNameEl.textContent = d.username;
  }).catch(function() {});

function unlockPremiumOptions() {
  var opts = document.querySelectorAll('#modelSelect option');
  opts.forEach(function(opt) {
    if (opt.value === 'claude-opus-4-5') opt.textContent = 'Claude Opus 4.5';
    if (opt.value === 'gemini-3.1-pro-preview') opt.textContent = 'Gemini 3.1 Pro';
  });
}

var SYSTEM_PROMPT_BASE = 'You are PrysmisAI, an expert Roblox game development assistant. You specialize in Lua scripting, Roblox Studio, game mechanics, UI design, animations, maps, and all aspects of Roblox game creation. When a user asks you to build, create, or generate something for their Roblox game, always break your work down into a clear numbered checklist of steps using this exact format at the start of your response:\n\n[TASKS]\n1. Task one description\n2. Task two description\n3. Task three description\n[/TASKS]\n\nThen complete each task thoroughly. Always provide complete, working Lua code in fenced code blocks using ```lua syntax. Use **bold** to highlight important concepts and *italics* for technical terms. When explaining how to recreate a game or feature, give detailed step-by-step instructions. Be thorough, professional, and always write production-quality code. Never simulate or fake responses - always give real, working implementations. When the user has studio files loaded, reference the actual file paths in your code suggestions so they match the real game structure.';

var SYSTEM_PROMPT = SYSTEM_PROMPT_BASE;
var studioFileContext = '';

function updateSystemPromptWithFiles(files) {
  if (!files || files.length === 0) { SYSTEM_PROMPT = SYSTEM_PROMPT_BASE; return; }
  var tree = files.slice(0, 80).map(function(f) {
    var indent = new Array((f.depth || 0) + 1).join('  ');
    return indent + f.name + ' (' + f.type + ')';
  }).join('\n');
  studioFileContext = tree;
  SYSTEM_PROMPT = SYSTEM_PROMPT_BASE + '\n\nThe user\'s current Roblox Studio workspace contains these files:\n```\n' + tree + '\n```\nUse this structure to give accurate file paths and service references in your code.';
}

document.querySelectorAll('.tab-link').forEach(function(btn) {
  btn.addEventListener('click', function() { showTab(btn.dataset.tab, btn); });
});

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtText(text) {
  return text
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<span class="inline-code">$1</span>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

var LUA_KW = ['local','function','end','if','then','else','elseif','for','do','while','repeat','until','return','true','false','nil','and','or','not','in','break'];

function highlightCode(code, lang) {
  var kw = LUA_KW;
  return code.split('\n').map(function(line) {
    var r = '', i = 0;
    while (i < line.length) {
      if (line[i] === '-' && line[i+1] === '-') { r += '<span class="tok-cmt">' + escHtml(line.slice(i)) + '</span>'; break; }
      if (line[i] === '"' || line[i] === "'") {
        var q = line[i], j = i + 1;
        while (j < line.length && line[j] !== q) { if (line[j] === '\\') j++; j++; }
        r += '<span class="tok-str">' + escHtml(line.slice(i, j + 1)) + '</span>';
        i = j + 1; continue;
      }
      if (/[0-9]/.test(line[i]) && (i === 0 || /\W/.test(line[i-1]))) {
        var k = i; while (k < line.length && /[0-9._]/.test(line[k])) k++;
        r += '<span class="tok-num">' + escHtml(line.slice(i, k)) + '</span>'; i = k; continue;
      }
      if (/[a-zA-Z_]/.test(line[i])) {
        var m = i; while (m < line.length && /[a-zA-Z0-9_]/.test(line[m])) m++;
        var word = line.slice(i, m);
        if (kw.indexOf(word) !== -1) r += '<span class="tok-kw">' + word + '</span>';
        else if (line[m] === '(') r += '<span class="tok-fn">' + word + '</span>';
        else r += '<span class="tok-plain">' + word + '</span>';
        i = m; continue;
      }
      r += escHtml(line[i]); i++;
    }
    return r;
  }).join('\n');
}

function buildCodeBlock(code, lang) {
  var wrapper = document.createElement('div'); wrapper.className = 'code-block';
  var header = document.createElement('div'); header.className = 'code-block-header';
  var langLabel = document.createElement('span'); langLabel.className = 'code-lang'; langLabel.textContent = lang || 'code';
  var copyBtn = document.createElement('button'); copyBtn.className = 'copy-btn'; copyBtn.textContent = 'Copy code';
  copyBtn.addEventListener('click', function() {
    navigator.clipboard.writeText(code).then(function() {
      copyBtn.textContent = 'Copied'; copyBtn.classList.add('copied');
      setTimeout(function() { copyBtn.textContent = 'Copy code'; copyBtn.classList.remove('copied'); }, 2000);
    }).catch(function() {
      var ta = document.createElement('textarea'); ta.value = code; ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      copyBtn.textContent = 'Copied'; copyBtn.classList.add('copied');
      setTimeout(function() { copyBtn.textContent = 'Copy code'; copyBtn.classList.remove('copied'); }, 2000);
    });
  });
  header.appendChild(langLabel); header.appendChild(copyBtn);
  var pre = document.createElement('pre'); var codeEl = document.createElement('code');
  codeEl.innerHTML = highlightCode(code, lang); pre.appendChild(codeEl);
  wrapper.appendChild(header); wrapper.appendChild(pre); return wrapper;
}

function buildChecklistBlock(tasks) {
  var wrapper = document.createElement('div'); wrapper.className = 'checklist-block';
  var header = document.createElement('div'); header.className = 'checklist-header';
  header.innerHTML = '<span class="checklist-title">Build Plan</span><span class="checklist-count">' + tasks.length + '</span>';
  var items = document.createElement('div'); items.className = 'checklist-items';
  tasks.forEach(function(task) {
    var item = document.createElement('div'); item.className = 'checklist-item';
    item.innerHTML = '<div class="check-circle"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div><span class="check-label">' + escHtml(task) + '</span>';
    items.appendChild(item);
  });
  wrapper.appendChild(header); wrapper.appendChild(items);
  var els = items.querySelectorAll('.checklist-item'), cur = 0;
  function tick() {
    if (cur >= els.length) return;
    els[cur].classList.add('active'); els[cur].querySelector('.check-circle').classList.add('active');
    setTimeout(function() {
      els[cur].classList.remove('active'); els[cur].classList.add('done');
      els[cur].querySelector('.check-circle').classList.remove('active'); els[cur].querySelector('.check-circle').classList.add('done');
      cur++; if (cur < els.length) setTimeout(tick, 200);
    }, 700 + Math.random() * 300);
  }
  setTimeout(tick, 400); return wrapper;
}

function parseAndRenderContent(rawText, container) {
  var taskMatch = rawText.match(/\[TASKS\]([\s\S]*?)\[\/TASKS\]/);
  var tasks = [], bodyText = rawText;
  if (taskMatch) {
    tasks = taskMatch[1].trim().split('\n').map(function(l) { return l.replace(/^\d+\.\s*/, '').trim(); }).filter(Boolean);
    bodyText = rawText.replace(/\[TASKS\][\s\S]*?\[\/TASKS\]/, '').trim();
  }
  if (tasks.length > 0) container.appendChild(buildChecklistBlock(tasks));
  var segs = bodyText.split(/(```[\s\S]*?```)/g);
  segs.forEach(function(seg) {
    var cm = seg.match(/^```(\w*)\n?([\s\S]*?)```$/);
    if (cm) {
      var lang = cm[1] || 'lua';
      var code = cm[2];
      var codeEl = buildCodeBlock(code, lang);
      container.appendChild(codeEl);
      if (pluginConnected && (lang === 'lua' || lang === 'javascript' || lang === '')) {
        addChangeButtons(code, 'AI suggested change', container);
      }
    }
    else if (seg.trim()) { var d = document.createElement('div'); d.innerHTML = fmtText(seg); container.appendChild(d); }
  });
}

function addMessage(content, isUser) {
  if (presetsEl) presetsEl.style.display = 'none';
  var msg = document.createElement('div'); msg.className = isUser ? 'user-msg' : 'ai-msg';
  if (isUser) {
    msg.textContent = content;
  } else {
    var tag = document.createElement('span'); tag.className = 'ai-tag'; tag.textContent = 'PrysmisAI';
    var body = document.createElement('div'); body.className = 'ai-msg-body';
    parseAndRenderContent(content, body); msg.appendChild(tag); msg.appendChild(body);
  }
  chatArea.appendChild(msg); chatArea.scrollTop = chatArea.scrollHeight;
}

function showThinking() {
  var el = document.createElement('div'); el.id = 'thinking'; el.className = 'thinking-anim';
  el.innerHTML = '<span class="thinking-text">PrysmisAI is thinking...</span><div class="thinking-bar"></div>';
  chatArea.appendChild(el); chatArea.scrollTop = chatArea.scrollHeight;
}

function removeThinking() { var el = document.getElementById('thinking'); if (el) el.remove(); }

function getModel() { return MODEL_API_MAP[modelSelect.value] || 'gpt-5.2'; }

var premiumModal = document.getElementById('premiumModal');
var premiumModalClose = document.getElementById('premiumModalClose');
if (premiumModalClose) {
  premiumModalClose.addEventListener('click', function() { premiumModal.style.display = 'none'; });
}
if (premiumModal) {
  premiumModal.addEventListener('click', function(e) { if (e.target === premiumModal) premiumModal.style.display = 'none'; });
}

modelSelect.addEventListener('change', function() {
  var val = modelSelect.value;
  if (PREMIUM_MODELS[val] && !userHasPremium) {
    premiumModal.style.display = 'flex';
    modelSelect.value = 'gpt-5.2';
  }
});

function buildPuterMessages() {
  var msgs = [];
  msgs.push({ role: 'user', content: SYSTEM_PROMPT + '\n\nUser message: ' + (currentMessages.length > 0 ? currentMessages[currentMessages.length - 1].content : '') });
  return msgs;
}

function isTruncated(text) {
  var trimmed = text.trimEnd();
  var opens = (trimmed.match(/```/g) || []).length;
  if (opens % 2 !== 0) return true;
  var lastChars = trimmed.slice(-3);
  if (lastChars === '...' || trimmed.endsWith(',') || trimmed.endsWith('(') || trimmed.endsWith('=')) return true;
  var lines = trimmed.split('\n');
  var lastLine = lines[lines.length - 1].trim();
  if (lastLine === '' && lines.length > 1) lastLine = lines[lines.length - 2].trim();
  var incomplete = lastLine.endsWith(',') || lastLine.endsWith('(') || lastLine.endsWith('=') || lastLine.endsWith('+') || lastLine.endsWith('and') || lastLine.endsWith('or') || lastLine.endsWith('then') || lastLine.endsWith('do') || (lastLine.startsWith('local ') && !lastLine.includes('='));
  return incomplete;
}

function addContinueButton(msgEl, onContinue) {
  var existing = msgEl.querySelector('.continue-bar');
  if (existing) existing.remove();
  var bar = document.createElement('div');
  bar.className = 'continue-bar';
  var btn = document.createElement('button');
  btn.className = 'continue-btn';
  btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Continue';
  btn.addEventListener('click', function() {
    bar.remove();
    onContinue();
  });
  bar.appendChild(btn);
  msgEl.appendChild(bar);
}

function doSend(overrideText, isContinue) {
  var text = isContinue ? overrideText : inputEl.value.trim();
  if (!text) return;
  var isFirst = currentMessages.length === 0 && !isContinue;
  if (!isContinue) {
    addMessage(text, true);
    currentMessages.push({ role: 'user', content: text });
    inputEl.value = '';
    inputEl.style.height = 'auto';
  }
  showThinking();
  var model = getModel();
  var allMsgs = [{ role: 'system', content: SYSTEM_PROMPT }];
  currentMessages.forEach(function(m) { allMsgs.push(m); });
  if (isContinue) {
    allMsgs.push({ role: 'user', content: 'Continue from exactly where you left off. Do not repeat anything. Just continue the code or response seamlessly.' });
  }

  function handleReply(reply, finishReason) {
    removeThinking();
    if (!reply) reply = 'No response received.';
    var truncated = finishReason === 'length' || (!finishReason && isTruncated(reply));
    if (isContinue && currentMessages.length > 0 && currentMessages[currentMessages.length - 1].role === 'assistant') {
      var prev = currentMessages[currentMessages.length - 1].content;
      var combined = prev + reply;
      currentMessages[currentMessages.length - 1].content = combined;
      var lastMsg = chatArea.querySelector('.ai-msg:last-of-type');
      if (lastMsg) {
        var body = lastMsg.querySelector('.ai-msg-body');
        if (body) {
          body.innerHTML = '';
          parseAndRenderContent(combined, body);
          if (truncated) addContinueButton(lastMsg, function() { doSend(null, true); });
        }
      }
    } else {
      currentMessages.push({ role: 'assistant', content: reply });
      addMessage(reply, false);
      if (truncated) {
        var lastMsg = chatArea.querySelector('.ai-msg:last-of-type');
        if (lastMsg) addContinueButton(lastMsg, function() { doSend(null, true); });
      }
    }
    if (isFirst) saveChat(text); else updateChat();
  }

  if (typeof puter !== 'undefined' && puter.ai && puter.ai.chat) {
    puter.ai.chat(allMsgs, { model: model }).then(function(response) {
      var reply = '';
      var finishReason = null;
      if (response && response.message && response.message.content) {
        var c = response.message.content;
        if (Array.isArray(c)) { c.forEach(function(b) { if (b.text) reply += b.text; }); }
        else if (typeof c === 'string') { reply = c; }
      } else if (typeof response === 'string') {
        reply = response;
      }
      if (response && response.finish_reason) finishReason = response.finish_reason;
      handleReply(reply, finishReason);
    }).catch(function(e) {
      removeThinking();
      addMessage('AI error: ' + (e.message || String(e)), false);
    });
  } else {
    fetch('/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model, messages: allMsgs, temperature: 0.7, max_tokens: 4096 })
    }).then(function(r) { return r.json(); }).then(function(data) {
      var choice = data.choices && data.choices[0];
      var reply = choice && choice.message ? choice.message.content : (data.error || 'No response received.');
      var finishReason = choice ? choice.finish_reason : null;
      handleReply(reply, finishReason);
    }).catch(function(e) { removeThinking(); addMessage('Connection error: ' + e.message, false); });
  }
}

function saveChat(firstMsg) {
  var title = firstMsg.substring(0, 38) + (firstMsg.length > 38 ? '...' : '');
  fetch('/chats?token=' + encodeURIComponent(storedToken), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title, messages: currentMessages })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.success && data.chat) { activeChatId = data.chat.id; 
var settingsSaveBtn = document.getElementById('settingsSaveBtn');

settingsSaveBtn.addEventListener('click', function() {
  var usernameInput = document.getElementById('settingsUsernameInput');
  var errEl = document.getElementById('settingsUsernameErr');
  errEl.textContent = '';
  errEl.classList.remove('show');
  var newUsername = usernameInput.value.trim().toLowerCase();
  if (!newUsername) {
    errEl.textContent = 'Please enter a username';
    errEl.classList.add('show');
    return;
  }
  if (newUsername.length < 3) {
    errEl.textContent = 'Username must be at least 3 characters';
    errEl.classList.add('show');
    return;
  }
  if (newUsername.length > 24) {
    errEl.textContent = 'Username must be 24 characters or less';
    errEl.classList.add('show');
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
    errEl.textContent = 'Letters, numbers, and underscores only';
    errEl.classList.add('show');
    return;
  }
  if (newUsername === (storedUser || '').toLowerCase()) {
    errEl.textContent = 'That is already your username';
    errEl.classList.add('show');
    return;
  }
  settingsSaveBtn.disabled = true;
  settingsSaveBtn.textContent = 'Saving...';
  fetch('/account/change-username?token=' + encodeURIComponent(storedToken), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newUsername: newUsername })
  }).then(function(r) { return r.json(); }).then(function(data) {
    settingsSaveBtn.disabled = false;
    settingsSaveBtn.textContent = 'Save Settings';
    if (data.success) {
      storedUser = data.username;
      localStorage.setItem('user', data.username);
      userNameEl.textContent = data.username;
      usernameInput.value = data.username;
      settingsSaveBtn.textContent = 'Saved';
      setTimeout(function() { settingsSaveBtn.textContent = 'Save Settings'; }, 2000);
    } else {
      errEl.textContent = data.error || 'Failed to save';
      errEl.classList.add('show');
    }
  }).catch(function() {
    settingsSaveBtn.disabled = false;
    settingsSaveBtn.textContent = 'Save Settings';
    errEl.textContent = 'Network error. Please try again.';
    errEl.classList.add('show');
  });
});

loadChatHistory();

var imagePastePreview = document.getElementById('imagePastePreview');
var imagePasteImg = document.getElementById('imagePasteImg');
var imagePasteRemove = document.getElementById('imagePasteRemove');
var pastedImageData = null;

if (imagePasteRemove) {
  imagePasteRemove.addEventListener('click', function() {
    pastedImageData = null;
    imagePasteImg.src = '';
    imagePastePreview.classList.remove('show');
  });
}

document.addEventListener('paste', function(e) {
  if (document.getElementById('chatTab').style.display === 'none') return;
  var items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      if (!userHasPremium) {
        if (premiumModal) premiumModal.style.display = 'flex';
        return;
      }
      var file = items[i].getAsFile();
      var reader = new FileReader();
      reader.onload = function(ev) {
        pastedImageData = ev.target.result;
        imagePasteImg.src = pastedImageData;
        imagePastePreview.classList.add('show');
      };
      reader.readAsDataURL(file);
      return;
    }
  }
}); }
  }).catch(function() {});
}

function updateChat() {
  if (!activeChatId) return;
  fetch('/chats/' + activeChatId + '?token=' + encodeURIComponent(storedToken), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: currentMessages })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (!data.success) saveChat(currentMessages[0] ? currentMessages[0].content : 'Chat');
  }).catch(function() {});
}

function loadChatHistory() {
  fetch('/chats?token=' + encodeURIComponent(storedToken))
    .then(function(r) { return r.json(); }).then(function(chats) {
      chatHistoryEl.innerHTML = '';
      if (!Array.isArray(chats)) return;
      chats.forEach(function(chat) { renderHistoryItem(chat); });
    }).catch(function() {});
}

function renderHistoryItem(chat) {
  var item = document.createElement('div'); item.className = 'history-item'; item.dataset.id = chat.id;
  var textSpan = document.createElement('span'); textSpan.className = 'history-item-text'; textSpan.textContent = chat.title || 'Untitled chat';
  var delBtn = document.createElement('button'); delBtn.className = 'history-del'; delBtn.textContent = 'x';
  delBtn.addEventListener('click', function(e) { e.stopPropagation(); deleteChat(chat.id, item); });
  textSpan.addEventListener('click', function() { loadChat(chat); });
  item.appendChild(textSpan); item.appendChild(delBtn); chatHistoryEl.appendChild(item);
}

function loadChat(chat) {
  chatArea.innerHTML = ''; currentMessages = []; activeChatId = chat.id;
  if (!chat.messages || chat.messages.length === 0) return;
  chat.messages.forEach(function(m) { addMessage(m.content, m.role === 'user'); currentMessages.push(m); });
}

function deleteChat(id, itemEl) {
  fetch('/chats/' + id + '?token=' + encodeURIComponent(storedToken), { method: 'DELETE' })
    .then(function(r) { return r.json(); }).then(function(data) {
      if (data.success) { itemEl.remove(); if (activeChatId === id) { activeChatId = null; currentMessages = []; resetChatArea(); } }
    }).catch(function() {});
}

function resetChatArea() {
  chatArea.innerHTML = '';
  if (presetsEl) { presetsEl.style.display = 'flex'; presetsEl.style.flexDirection = 'column'; chatArea.appendChild(presetsEl); }
}

newChatBtn.addEventListener('click', function() {
  activeChatId = null; currentMessages = []; chatArea.innerHTML = '';
  if (presetsEl) { presetsEl.style.display = 'flex'; presetsEl.style.flexDirection = 'column'; chatArea.appendChild(presetsEl); }
  inputEl.value = ''; inputEl.style.height = 'auto';
});

sendBtn.addEventListener('click', doSend);
inputEl.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } });
inputEl.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 140) + 'px'; });

function usePreset(i) {
  var texts = ['Create me a Roblox map that is ', 'Make me a character animation script that ', 'Make me an advanced loading screen that '];
  inputEl.value = texts[i]; inputEl.focus();
  inputEl.style.height = 'auto'; inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
}

function toggleExplorer() { document.getElementById('explorer').classList.toggle('open'); }

function showTab(tab, btnEl) {
  document.querySelectorAll('.tab-link').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.viewport').forEach(function(v) { v.style.display = 'none'; });
  if (btnEl) btnEl.classList.add('active');
  document.getElementById(tab + 'Tab').style.display = 'flex';
  if (tab === 'projects') loadProjects();
  if (tab === 'commchat') initCommChat();
}

function loadProjects() {
  projectsList.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
  fetch('/projects').then(function(r) { return r.json(); }).then(function(projects) {
    projectsList.innerHTML = '';
    if (!projects || projects.length === 0) { projectsList.innerHTML = '<div class="empty-state"><p>No projects yet. Be the first to share yours.</p></div>'; return; }
    projects.forEach(function(p) { renderProjectCard(p); });
  }).catch(function() { projectsList.innerHTML = '<div class="empty-state"><p>Could not load projects.</p></div>'; });
}

function renderProjectCard(p) {
  var card = document.createElement('div'); card.className = 'game-card'; card.dataset.id = p.id;
  var authorDiv = document.createElement('div'); authorDiv.className = 'game-card-author'; authorDiv.textContent = 'by ' + (p.author || 'unknown');
  var title = document.createElement('h3'); title.textContent = p.title;
  var desc = document.createElement('p'); desc.textContent = p.about;
  var footer = document.createElement('div'); footer.className = 'game-card-footer';
  var link = document.createElement('a'); link.href = p.link; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = p.link;
  footer.appendChild(link);
  if (p.author === storedUser) {
    var delBtn = document.createElement('button'); delBtn.className = 'delete-card-btn'; delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', function() { deleteProject(p.id, card); }); footer.appendChild(delBtn);
  }
  card.appendChild(authorDiv); card.appendChild(title); card.appendChild(desc); card.appendChild(footer); projectsList.appendChild(card);
}

function deleteProject(id, cardEl) {
  fetch('/projects/' + id + '?token=' + encodeURIComponent(storedToken), { method: 'DELETE' })
    .then(function(r) { return r.json(); }).then(function(data) {
      if (data.success) { cardEl.style.opacity = '0'; cardEl.style.transform = 'scale(0.95)'; cardEl.style.transition = 'all 0.2s'; setTimeout(function() { cardEl.remove(); }, 200); }
    }).catch(function() {});
}

postGameBtn.addEventListener('click', function() {
  var title = document.getElementById('gameTitle').value.trim();
  var link = document.getElementById('gameLink').value.trim();
  var about = document.getElementById('gameAbout').value.trim();
  if (!title || !link || !about) return;
  postGameBtn.textContent = 'Publishing...'; postGameBtn.disabled = true;
  fetch('/projects?token=' + encodeURIComponent(storedToken), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title, link: link, about: about })
  }).then(function(r) { return r.json(); }).then(function(data) {
    postGameBtn.textContent = 'Publish Project'; postGameBtn.disabled = false;
    if (data.success) { closeModal(); document.getElementById('gameTitle').value = ''; document.getElementById('gameLink').value = ''; document.getElementById('gameAbout').value = ''; loadProjects(); }
  }).catch(function() { postGameBtn.textContent = 'Publish Project'; postGameBtn.disabled = false; });
});

function openModal() { modal.style.display = 'flex'; }
function closeModal() { modal.style.display = 'none'; }
modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });

var commchatReplyTo = null;
var editMsgId = null;
var commchatSSE = null;
var commchatMsgMap = {};
var commchatActive = false;

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

function sendDesktopNotification(author, text) {
  if (!commchatActive && 'Notification' in window && Notification.permission === 'granted') {
    var n = new Notification('PrysmisAI Community', { body: author + ': ' + text, icon: '/favicon.ico', tag: 'prysmis-chat' });
    setTimeout(function() { n.close(); }, 5000);
    n.onclick = function() { window.focus(); document.querySelector('[data-tab="commchat"]').click(); n.close(); };
  }
}

function initCommChat() {
  commchatActive = true;
  fetch('/community-chat').then(function(r) { return r.json(); }).then(function(msgs) {
    commchatMsgMap = {};
    if (Array.isArray(msgs)) msgs.forEach(function(m) { commchatMsgMap[m.id] = m; });
    renderAllCommChat(msgs);
  }).catch(function() {});
  if (commchatSSE) { commchatSSE.close(); }
  commchatSSE = new EventSource('/community-chat/stream');
  commchatSSE.onmessage = function(e) {
    try {
      var data = JSON.parse(e.data);
      if (data.type === 'new_message' && data.msg) {
        commchatMsgMap[data.msg.id] = data.msg;
        appendCommChatMsg(data.msg, true);
        if (data.msg.author !== storedUser) sendDesktopNotification(data.msg.author, data.msg.text);
      } else if (data.type === 'edit_message' && data.msg) {
        commchatMsgMap[data.msg.id] = data.msg;
        var el = document.querySelector('.commchat-msg[data-id="' + data.msg.id + '"]');
        if (el) {
          var textEl = el.querySelector('.commchat-text');
          if (textEl) textEl.textContent = data.msg.text;
          var timeEl = el.querySelector('.commchat-time');
          if (timeEl) timeEl.textContent = formatTime(data.msg.created) + ' (edited)';
        }
      } else if (data.type === 'delete_message' && data.id) {
        delete commchatMsgMap[data.id];
        var el = document.querySelector('.commchat-msg[data-id="' + data.id + '"]');
        if (el) { el.style.opacity = '0'; el.style.transform = 'scale(0.95)'; el.style.transition = 'all 0.25s'; setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 250); }
      }
    } catch (_) {}
  };
  commchatSSE.onerror = function() {
    setTimeout(function() { if (commchatActive) { commchatSSE.close(); initCommChatSSEOnly(); } }, 3000);
  };
}

function initCommChatSSEOnly() {
  commchatSSE = new EventSource('/community-chat/stream');
  commchatSSE.onmessage = function(e) {
    try {
      var data = JSON.parse(e.data);
      if (data.type === 'new_message' && data.msg) {
        commchatMsgMap[data.msg.id] = data.msg;
        appendCommChatMsg(data.msg, true);
        if (data.msg.author !== storedUser) sendDesktopNotification(data.msg.author, data.msg.text);
      } else if (data.type === 'edit_message' && data.msg) {
        commchatMsgMap[data.msg.id] = data.msg;
        var el = document.querySelector('.commchat-msg[data-id="' + data.msg.id + '"]');
        if (el) { var t = el.querySelector('.commchat-text'); if (t) t.textContent = data.msg.text; }
      } else if (data.type === 'delete_message' && data.id) {
        delete commchatMsgMap[data.id];
        var el = document.querySelector('.commchat-msg[data-id="' + data.id + '"]');
        if (el) { el.style.opacity = '0'; el.style.transition = 'opacity 0.25s'; setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 260); }
      }
    } catch (_) {}
  };
}

function renderAllCommChat(msgs) {
  var container = document.getElementById('commchatMessages');
  container.innerHTML = '';
  if (!msgs || msgs.length === 0) {
    container.innerHTML = '<div class="commchat-empty">No messages yet. Start the conversation.</div>';
    return;
  }
  msgs.forEach(function(m) { appendCommChatMsg(m, false); });
  container.scrollTop = container.scrollHeight;
}

function appendCommChatMsg(m, animate) {
  var container = document.getElementById('commchatMessages');
  var atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
  var empty = container.querySelector('.commchat-empty');
  if (empty) empty.remove();
  var wrap = buildCommChatMsgEl(m);
  if (animate) {
    wrap.style.opacity = '0'; wrap.style.transform = 'translateY(8px)';
    container.appendChild(wrap);
    requestAnimationFrame(function() {
      wrap.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
      wrap.style.opacity = '1'; wrap.style.transform = 'translateY(0)';
    });
  } else {
    container.appendChild(wrap);
  }
  if (atBottom || animate) container.scrollTop = container.scrollHeight;
}

var currentUserIsAdmin = localStorage.getItem('isAdmin') === 'true';

function buildCommChatMsgEl(m) {
  var wrap = document.createElement('div');
  wrap.className = 'commchat-msg' + (m.author === storedUser ? ' commchat-msg-own' : '');
  wrap.dataset.id = m.id;
  var inner = '';
  if (m.replyTo && commchatMsgMap[m.replyTo]) {
    var ref = commchatMsgMap[m.replyTo];
    inner += '<div class="commchat-reply-ref"><span class="commchat-reply-ref-author">' + escHtml(ref.author) + '</span><span class="commchat-reply-ref-text">' + escHtml(ref.text.substring(0, 60)) + (ref.text.length > 60 ? '...' : '') + '</span></div>';
  }
  var rankBadge = '';
  if (m.isAdmin || m.rank === 'admin') {
    rankBadge = '<span class="rank-badge rank-admin">admin</span>';
  } else if (m.rank === 'premium') {
    rankBadge = '<span class="rank-badge rank-premium">premium</span>';
  } else if (m.rank === 'early access') {
    rankBadge = '<span class="rank-badge rank-early">early access</span>';
  } else if (m.rank === 'chat mod') {
    rankBadge = '<span class="rank-badge rank-mod">mod</span>';
  } else if (m.rank === 'owner') {
    rankBadge = '<span class="rank-badge rank-owner">owner</span>';
  }
  inner += '<div class="commchat-msg-header"><span class="commchat-author">' + escHtml(m.author) + '</span>' + rankBadge + '<span class="commchat-time">' + formatTime(m.created) + (m.edited ? ' (edited)' : '') + '</span></div>';
  inner += '<div class="commchat-text">' + escHtml(m.text) + '</div>';
  inner += '<div class="commchat-actions">';
  inner += '<button class="commchat-action-btn" onclick="setReply(\'' + m.id + '\',\'' + escHtml(m.author) + '\',\'' + escHtml(m.text.substring(0, 40).replace(/'/g, "\\'")) + '\')">Reply</button>';
  if (m.author === storedUser) {
    inner += '<button class="commchat-action-btn commchat-edit-btn" onclick="openEditModal(\'' + m.id + '\',\'' + escHtml(m.text.replace(/'/g, "\\'")) + '\')">Edit</button>';
  }
  if (m.author === storedUser || currentUserIsAdmin) {
    inner += '<button class="commchat-action-btn commchat-del-btn" onclick="deleteCommMsg(\'' + m.id + '\')">Delete</button>';
  }
  inner += '</div>';
  wrap.innerHTML = inner;
  return wrap;
}

function formatTime(ts) {
  var d = new Date(ts), h = d.getHours(), mn = d.getMinutes();
  return (h < 10 ? '0' : '') + h + ':' + (mn < 10 ? '0' : '') + mn;
}

function setReply(id, author, previewText) {
  commchatReplyTo = id;
  document.getElementById('commchatReplyPreview').innerHTML = '<strong>' + escHtml(author) + '</strong> ' + escHtml(previewText);
  document.getElementById('commchatReplyBar').style.display = 'flex';
  document.getElementById('commchatInput').focus();
}

document.getElementById('commchatReplyCancel').addEventListener('click', function() {
  commchatReplyTo = null;
  document.getElementById('commchatReplyBar').style.display = 'none';
  document.getElementById('commchatReplyPreview').innerHTML = '';
});

function sendCommMsg() {
  var text = document.getElementById('commchatInput').value.trim(); if (!text) return;
  var payload = { text: text };
  if (commchatReplyTo) payload.replyTo = commchatReplyTo;
  document.getElementById('commchatInput').value = ''; document.getElementById('commchatInput').style.height = 'auto';
  commchatReplyTo = null; document.getElementById('commchatReplyBar').style.display = 'none';
  fetch('/community-chat?token=' + encodeURIComponent(storedToken), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  }).catch(function() {});
}

document.getElementById('commchatSend').addEventListener('click', sendCommMsg);
document.getElementById('commchatInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCommMsg(); }
});
document.getElementById('commchatInput').addEventListener('input', function() {
  this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

function openEditModal(id, currentText) {
  editMsgId = id;
  document.getElementById('editMsgText').value = currentText;
  document.getElementById('editMsgModal').style.display = 'flex';
  setTimeout(function() { document.getElementById('editMsgText').focus(); }, 50);
}

function closeEditModal() {
  editMsgId = null; document.getElementById('editMsgModal').style.display = 'none';
}

document.getElementById('editMsgSave').addEventListener('click', function() {
  if (!editMsgId) return;
  var text = document.getElementById('editMsgText').value.trim(); if (!text) return;
  fetch('/community-chat/' + editMsgId + '?token=' + encodeURIComponent(storedToken), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.success) closeEditModal();
  }).catch(function() {});
});

document.getElementById('editMsgModal').addEventListener('click', function(e) {
  if (e.target === document.getElementById('editMsgModal')) closeEditModal();
});

function deleteCommMsg(id) {
  fetch('/community-chat/' + id + '?token=' + encodeURIComponent(storedToken), { method: 'DELETE' }).catch(function() {});
}

document.addEventListener('visibilitychange', function() {
  commchatActive = !document.hidden && document.getElementById('commchatTab').style.display !== 'none';
});

document.getElementById('logoutBtn').addEventListener('click', function() {
  fetch('/logout?token=' + encodeURIComponent(storedToken), { method: 'POST' }).catch(function() {});
  if (commchatSSE) commchatSSE.close();
  localStorage.removeItem('user'); localStorage.removeItem('token'); localStorage.removeItem('pluginToken'); localStorage.removeItem('isAdmin');
  location.href = '/accountauth/index.html';
});

var generateTokenBtn = document.getElementById('generateTokenBtn');
var settingsBtn = document.getElementById('settingsBtn');
var settingsModal = document.getElementById('settingsModal');
var tokenNotif = document.getElementById('tokenNotif');
var tokenNotifInput = document.getElementById('tokenNotifInput');
var tokenNotifClose = document.getElementById('tokenNotifClose');
var tokenNotifHide = document.getElementById('tokenNotifHide');
var tokenNotifCopy = document.getElementById('tokenNotifCopy');
var settingsTokenInput = document.getElementById('settingsTokenInput');
var settingsShowToken = document.getElementById('settingsShowToken');
var settingsCopyToken = document.getElementById('settingsCopyToken');
var settingsClose = document.getElementById('settingsClose');
var settingsClose2 = document.getElementById('settingsClose2');
var currentAuthToken = '';
var tokenVisible = false;
var settingsTokenShown = false;

function showTokenNotif(tokenUrl) {
  tokenNotifInput.value = tokenUrl; tokenNotifInput.type = 'text'; tokenVisible = true; tokenNotifHide.textContent = 'Hide';
  tokenNotif.style.display = 'block';
}

tokenNotifClose.addEventListener('click', function() { tokenNotif.style.display = 'none'; });
tokenNotifHide.addEventListener('click', function() {
  if (tokenVisible) { tokenNotifInput.type = 'password'; tokenNotifHide.textContent = 'Show'; tokenVisible = false; }
  else { tokenNotifInput.type = 'text'; tokenNotifHide.textContent = 'Hide'; tokenVisible = true; }
});

function copyToClipboard(text, btn, label) {
  navigator.clipboard.writeText(text).then(function() {
    btn.textContent = 'Copied'; setTimeout(function() { btn.textContent = label; }, 2000);
  }).catch(function() {
    var ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    btn.textContent = 'Copied'; setTimeout(function() { btn.textContent = label; }, 2000);
  });
}

tokenNotifCopy.addEventListener('click', function() { copyToClipboard(tokenNotifInput.value, tokenNotifCopy, 'Copy Token'); });

generateTokenBtn.addEventListener('click', function() {
  generateTokenBtn.textContent = '...'; generateTokenBtn.disabled = true;
  fetch('/auth-token/generate?token=' + encodeURIComponent(storedToken), { method: 'POST' })
    .then(function(r) { return r.json(); }).then(function(data) {
      generateTokenBtn.textContent = 'Generate Token'; generateTokenBtn.disabled = false;
      if (data.success) { currentAuthToken = data.authToken; settingsTokenInput.value = data.authToken; showTokenNotif(data.url); }
      else { generateTokenBtn.textContent = data.error || 'Error'; setTimeout(function() { generateTokenBtn.textContent = 'Generate Token'; }, 3000); }
    }).catch(function() { generateTokenBtn.textContent = 'Generate Token'; generateTokenBtn.disabled = false; });
});

function loadExistingAuthToken() {
  fetch('/auth-token?token=' + encodeURIComponent(storedToken))
    .then(function(r) { return r.json(); }).then(function(data) {
      if (data.authToken) { currentAuthToken = data.authToken; settingsTokenInput.value = data.authToken; }
    }).catch(function() {});
}

settingsBtn.addEventListener('click', function() {
  loadExistingAuthToken();
  switchSettingsTab('account');
  var usernameInput = document.getElementById('settingsUsernameInput');
  if (usernameInput) usernameInput.value = storedUser || '';
  settingsModal.style.display = 'flex';
});
settingsClose.addEventListener('click', function() { settingsModal.style.display = 'none'; });
settingsClose2.addEventListener('click', function() { settingsModal.style.display = 'none'; });
settingsModal.addEventListener('click', function(e) { if (e.target === settingsModal) settingsModal.style.display = 'none'; });

settingsShowToken.addEventListener('click', function() {
  if (!currentAuthToken) return;
  if (settingsTokenShown) { settingsTokenInput.type = 'password'; settingsShowToken.textContent = 'Show Token'; settingsTokenShown = false; }
  else { settingsTokenInput.type = 'text'; settingsTokenInput.value = currentAuthToken; settingsShowToken.textContent = 'Hide Token'; settingsTokenShown = true; }
});

settingsCopyToken.addEventListener('click', function() { if (currentAuthToken) copyToClipboard(currentAuthToken, settingsCopyToken, 'Copy Token'); });

var settingsNavAccount = document.getElementById('settingsNavAccount');
var settingsNavStudio = document.getElementById('settingsNavStudio');
var settingsPageAccount = document.getElementById('settingsPageAccount');
var settingsPageStudio = document.getElementById('settingsPageStudio');

function switchSettingsTab(tab) {
  if (tab === 'account') {
    settingsPageAccount.style.display = 'block'; settingsPageStudio.style.display = 'none';
    settingsNavAccount.classList.add('active'); settingsNavStudio.classList.remove('active');
  } else {
    settingsPageAccount.style.display = 'none'; settingsPageStudio.style.display = 'block';
    settingsNavStudio.classList.add('active'); settingsNavAccount.classList.remove('active');
    loadStudioToken();
  }
}

var settingsStudioInput = document.getElementById('settingsStudioInput');
var settingsShowStudio = document.getElementById('settingsShowStudio');
var settingsCopyStudio = document.getElementById('settingsCopyStudio');
var studioTokenShown = false;
var currentStudioToken = '';

function loadStudioToken() {
  var t = localStorage.getItem('pluginToken') || '';
  currentStudioToken = t; settingsStudioInput.value = t || '';
  settingsStudioInput.placeholder = t ? 'Token loaded' : 'Click Connect Plugin in header to generate';
}

settingsShowStudio.addEventListener('click', function() {
  if (!currentStudioToken) return;
  if (studioTokenShown) { settingsStudioInput.type = 'password'; settingsShowStudio.textContent = 'Show Token'; studioTokenShown = false; }
  else { settingsStudioInput.type = 'text'; settingsStudioInput.value = currentStudioToken; settingsShowStudio.textContent = 'Hide Token'; studioTokenShown = true; }
});

settingsCopyStudio.addEventListener('click', function() { if (currentStudioToken) copyToClipboard(currentStudioToken, settingsCopyStudio, 'Copy Token'); });

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (settingsModal.style.display !== 'none') { settingsModal.style.display = 'none'; return; }
    if (tokenNotif.style.display !== 'none') { tokenNotif.style.display = 'none'; return; }
    if (document.getElementById('editMsgModal').style.display !== 'none') { closeEditModal(); return; }
  }
});

var pluginConnected = false;
var pluginTokenStored = localStorage.getItem('pluginToken') || '';
var connectBtn = document.getElementById('connectBtn');
var statusDot = document.getElementById('statusDot');
var statusText = document.getElementById('statusText');
var viewStudioBtn = document.getElementById('viewStudioBtn');
var studioFilesPanel = document.getElementById('studioFilesPanel');
var explorerDisconnected = document.getElementById('explorerDisconnected');
var studioFilesList = document.getElementById('studioFilesList');
var studioFilesVisible = false;

function getModelValue() { return MODEL_API_MAP[modelSelect.value] || 'gpt-5.2'; }

function setExplorerStatus(connected, model) {
  pluginConnected = connected;
  if (statusDot) statusDot.className = 'dot ' + (connected ? 'green' : 'red');
  if (statusText) { statusText.textContent = connected ? 'Connected' : 'Disconnected'; statusText.style.color = connected ? '#10b981' : '#f43f5e'; }
  if (connectBtn) { connectBtn.textContent = connected ? 'Plugin Connected' : 'Connect Plugin'; connectBtn.style.background = connected ? 'linear-gradient(135deg,#10b981,#059669)' : ''; }
  if (viewStudioBtn) viewStudioBtn.style.display = connected ? 'flex' : 'none';
  if (!connected) {
    studioFilesVisible = false;
    if (studioFilesPanel) studioFilesPanel.style.display = 'none';
    if (explorerDisconnected) explorerDisconnected.style.display = 'block';
  }
}

if (viewStudioBtn) {
  viewStudioBtn.addEventListener('click', function() {
    if (!pluginConnected) return;
    studioFilesVisible = !studioFilesVisible;
    if (studioFilesVisible) {
      studioFilesPanel.style.display = 'flex';
      if (explorerDisconnected) explorerDisconnected.style.display = 'none';
      var explorer = document.getElementById('explorer');
      if (explorer && !explorer.classList.contains('open')) explorer.classList.add('open');
      loadStudioFiles();
    } else {
      studioFilesPanel.style.display = 'none';
      if (explorerDisconnected) explorerDisconnected.style.display = 'block';
    }
  });
}

var TYPE_ICON = {
  'Script': 'S', 'LocalScript': 'L', 'ModuleScript': 'M',
  'Part': 'P', 'Model': 'M', 'Frame': 'F', 'ScreenGui': 'G',
  'RemoteEvent': 'E', 'RemoteFunction': 'F', 'Folder': 'D',
  'SpawnLocation': 'S', 'Camera': 'C', 'BasePart': 'P'
};
var TYPE_COLOR = {
  'Script': '#10b981', 'LocalScript': '#f59e0b', 'ModuleScript': '#8b5cf6',
  'Part': '#6b7280', 'Model': '#3b82f6', 'Folder': '#f59e0b'
};

function loadStudioFiles() {
  if (!studioFilesList) return;
  studioFilesList.innerHTML = '<div class="studio-loading">Loading files...</div>';
  fetch('/plugin/files?token=' + encodeURIComponent(storedToken))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var files = data.files || [];
      if (files.length === 0) {
        studioFilesList.innerHTML = '<div class="studio-empty">No files yet. Click "Send Files to Website" in the Studio plugin.</div>';
        return;
      }
      updateSystemPromptWithFiles(files);
      studioFilesList.innerHTML = '';
      files.forEach(function(f) {
        var depth = f.depth || 0;
        var item = document.createElement('div');
        item.className = 'studio-file-item';
        item.style.paddingLeft = (12 + depth * 14) + 'px';
        var icon = document.createElement('span');
        icon.className = 'studio-file-icon';
        var letter = TYPE_ICON[f.type] || f.type.charAt(0).toUpperCase();
        icon.textContent = letter;
        icon.style.background = 'rgba(79,142,247,0.1)';
        icon.style.borderColor = 'rgba(79,142,247,0.2)';
        icon.style.color = TYPE_COLOR[f.type] || '#93c5fd';
        var name = document.createElement('span');
        name.className = 'studio-file-name';
        name.textContent = f.name || 'Unknown';
        var typeTag = document.createElement('span');
        typeTag.className = 'studio-file-type';
        typeTag.textContent = f.type || '';
        item.appendChild(icon);
        var info = document.createElement('div');
        info.className = 'studio-file-info';
        info.appendChild(name);
        info.appendChild(typeTag);
        item.appendChild(info);
        studioFilesList.appendChild(item);
      });
    }).catch(function() {
      studioFilesList.innerHTML = '<div class="studio-empty">Could not load files.</div>';
    });
}

function sendChangeToPlugin(code, description) {
  return fetch('/plugin/execute?token=' + encodeURIComponent(storedToken), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code, description: description || '' })
  }).then(function(r) { return r.json(); });
}

function addChangeButtons(code, description, msgEl) {
  var existing = msgEl.querySelector('.change-btns');
  if (existing) existing.remove();
  var bar = document.createElement('div');
  bar.className = 'change-btns';
  var acceptBtn = document.createElement('button');
  acceptBtn.className = 'change-btn change-btn-accept';
  acceptBtn.textContent = 'Accept Change';
  var rejectBtn = document.createElement('button');
  rejectBtn.className = 'change-btn change-btn-reject';
  rejectBtn.textContent = 'Reject Change';
  var statusMsg = document.createElement('span');
  statusMsg.className = 'change-status';
  acceptBtn.addEventListener('click', function() {
    if (!pluginConnected) {
      statusMsg.textContent = 'Plugin not connected - open plugin in Studio first';
      statusMsg.style.color = '#f43f5e';
      return;
    }
    acceptBtn.textContent = 'Sending to Studio...';
    acceptBtn.disabled = true;
    rejectBtn.disabled = true;
    statusMsg.textContent = '';
    sendChangeToPlugin(code, description).then(function(data) {
      if (data.ok) {
        acceptBtn.textContent = 'Sent to Studio';
        acceptBtn.className = 'change-btn change-btn-applied';
        rejectBtn.style.display = 'none';
        statusMsg.textContent = 'Executing in Studio...';
        statusMsg.style.color = '#10b981';
        setTimeout(function() { statusMsg.textContent = 'Applied'; }, 1500);
      } else {
        acceptBtn.textContent = 'Accept Change';
        acceptBtn.disabled = false;
        rejectBtn.disabled = false;
        statusMsg.textContent = data.error || 'Failed to send';
        statusMsg.style.color = '#f43f5e';
      }
    }).catch(function() {
      acceptBtn.textContent = 'Accept Change';
      acceptBtn.disabled = false;
      rejectBtn.disabled = false;
      statusMsg.textContent = 'Network error - check connection';
      statusMsg.style.color = '#f43f5e';
    });
  });
  rejectBtn.addEventListener('click', function() {
    bar.style.opacity = '0';
    bar.style.transform = 'translateY(-4px)';
    bar.style.transition = 'all 0.2s';
    setTimeout(function() { bar.remove(); }, 200);
  });
  bar.appendChild(acceptBtn);
  bar.appendChild(rejectBtn);
  bar.appendChild(statusMsg);
  msgEl.appendChild(bar);
}

connectBtn.addEventListener('click', function() {
  if (pluginConnected) {
    fetch('/plugin/disconnect?token=' + encodeURIComponent(storedToken), { method: 'POST' })
      .then(function() { pluginTokenStored = ''; localStorage.removeItem('pluginToken'); setExplorerStatus(false, ''); }).catch(function() {});
    return;
  }
  fetch('/plugin/connect?token=' + encodeURIComponent(storedToken), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: getModelValue() })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.success && data.pluginToken) {
      pluginTokenStored = data.pluginToken; localStorage.setItem('pluginToken', data.pluginToken);
      setExplorerStatus(true, data.model);
    }
  }).catch(function() {});
});

modelSelect.addEventListener('change', function() {
  if (pluginConnected && storedToken) {
    fetch('/plugin/update-model?token=' + encodeURIComponent(storedToken), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: getModelValue() })
    }).catch(function() {});
  }
});

if (pluginTokenStored) {
  fetch('/plugin/ping', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pluginToken: pluginTokenStored })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.ok) { setExplorerStatus(true, data.model); }
    else { localStorage.removeItem('pluginToken'); pluginTokenStored = ''; }
  }).catch(function() { localStorage.removeItem('pluginToken'); pluginTokenStored = ''; });
}


var settingsSaveBtn = document.getElementById('settingsSaveBtn');

settingsSaveBtn.addEventListener('click', function() {
  var usernameInput = document.getElementById('settingsUsernameInput');
  var errEl = document.getElementById('settingsUsernameErr');
  errEl.textContent = '';
  errEl.classList.remove('show');
  var newUsername = usernameInput.value.trim().toLowerCase();
  if (!newUsername) {
    errEl.textContent = 'Please enter a username';
    errEl.classList.add('show');
    return;
  }
  if (newUsername.length < 3) {
    errEl.textContent = 'Username must be at least 3 characters';
    errEl.classList.add('show');
    return;
  }
  if (newUsername.length > 24) {
    errEl.textContent = 'Username must be 24 characters or less';
    errEl.classList.add('show');
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
    errEl.textContent = 'Letters, numbers, and underscores only';
    errEl.classList.add('show');
    return;
  }
  if (newUsername === (storedUser || '').toLowerCase()) {
    errEl.textContent = 'That is already your username';
    errEl.classList.add('show');
    return;
  }
  settingsSaveBtn.disabled = true;
  settingsSaveBtn.textContent = 'Saving...';
  fetch('/account/change-username?token=' + encodeURIComponent(storedToken), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newUsername: newUsername })
  }).then(function(r) { return r.json(); }).then(function(data) {
    settingsSaveBtn.disabled = false;
    settingsSaveBtn.textContent = 'Save Settings';
    if (data.success) {
      storedUser = data.username;
      localStorage.setItem('user', data.username);
      userNameEl.textContent = data.username;
      usernameInput.value = data.username;
      settingsSaveBtn.textContent = 'Saved';
      setTimeout(function() { settingsSaveBtn.textContent = 'Save Settings'; }, 2000);
    } else {
      errEl.textContent = data.error || 'Failed to save';
      errEl.classList.add('show');
    }
  }).catch(function() {
    settingsSaveBtn.disabled = false;
    settingsSaveBtn.textContent = 'Save Settings';
    errEl.textContent = 'Network error. Please try again.';
    errEl.classList.add('show');
  });
});

loadChatHistory();
