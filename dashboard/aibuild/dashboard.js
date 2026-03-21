var storedUser = localStorage.getItem('user');
var storedToken = localStorage.getItem('token');

if (!storedUser || !storedToken) {
  location.href = '/accountauth/index.html';
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

var SYSTEM_PROMPT = 'You are PrysmisAI, an expert Roblox game development assistant. You specialize in Lua scripting, Roblox Studio, game mechanics, UI design, animations, maps, and all aspects of Roblox game creation. When a user asks you to build, create, or generate something for their Roblox game, always break your work down into a clear numbered checklist of steps using this exact format at the start of your response:\n\n[TASKS]\n1. Task one description\n2. Task two description\n3. Task three description\n[/TASKS]\n\nThen complete each task thoroughly. Always provide complete, working Lua code in fenced code blocks using ```lua syntax. Use **bold** to highlight important concepts and *italics* for technical terms. When explaining how to recreate a game or feature, give detailed step-by-step instructions. Be thorough, professional, and always write production-quality code. Never simulate or fake responses - always give real, working implementations.';

document.querySelectorAll('.tab-link').forEach(function(btn) {
  btn.addEventListener('click', function() {
    showTab(btn.dataset.tab, btn);
  });
});

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

var LUA_KW = ['local','function','end','if','then','else','elseif','for','do','while','repeat','until','return','true','false','nil','and','or','not','in','break'];
var JS_KW = ['var','let','const','function','return','if','else','for','while','do','new','this','true','false','null','undefined','class','extends','import','export','from','of','in','typeof','instanceof','break','continue','switch','case','default','try','catch','finally','throw','async','await','yield'];
var PY_KW = ['def','class','return','if','elif','else','for','while','import','from','as','with','pass','break','continue','True','False','None','and','or','not','in','is','lambda','global','nonlocal','try','except','finally','raise','assert','del','yield'];

function tokenizeLine(line, lang) {
  var result = '';
  var i = 0;
  var kw = lang === 'lua' ? LUA_KW : (lang === 'python' || lang === 'py' ? PY_KW : JS_KW);

  while (i < line.length) {
    if (line[i] === '-' && line[i+1] === '-' && (lang === 'lua')) {
      result += '<span class="tok-cmt">' + escHtml(line.slice(i)) + '</span>';
      break;
    }
    if ((line[i] === '/' && line[i+1] === '/') && lang !== 'lua' && lang !== 'python') {
      result += '<span class="tok-cmt">' + escHtml(line.slice(i)) + '</span>';
      break;
    }
    if (line[i] === '#' && (lang === 'python' || lang === 'py')) {
      result += '<span class="tok-cmt">' + escHtml(line.slice(i)) + '</span>';
      break;
    }
    if (line[i] === '"' || line[i] === "'") {
      var q = line[i];
      var j = i + 1;
      while (j < line.length && line[j] !== q) { if (line[j] === '\\') j++; j++; }
      result += '<span class="tok-str">' + escHtml(line.slice(i, j + 1)) + '</span>';
      i = j + 1;
      continue;
    }
    if (line[i] === '[' && line[i+1] === '[' && lang === 'lua') {
      var end = line.indexOf(']]', i + 2);
      if (end === -1) end = line.length - 2;
      result += '<span class="tok-str">' + escHtml(line.slice(i, end + 2)) + '</span>';
      i = end + 2;
      continue;
    }
    if (/[0-9]/.test(line[i]) && (i === 0 || /\W/.test(line[i-1]))) {
      var k = i;
      while (k < line.length && /[0-9._xXa-fA-F]/.test(line[k])) k++;
      result += '<span class="tok-num">' + escHtml(line.slice(i, k)) + '</span>';
      i = k;
      continue;
    }
    if (/[a-zA-Z_]/.test(line[i])) {
      var m = i;
      while (m < line.length && /[a-zA-Z0-9_]/.test(line[m])) m++;
      var word = line.slice(i, m);
      var after = line[m];
      if (kw.indexOf(word) !== -1) {
        result += '<span class="tok-kw">' + escHtml(word) + '</span>';
      } else if (after === '(') {
        result += '<span class="tok-fn">' + escHtml(word) + '</span>';
      } else {
        result += '<span class="tok-plain">' + escHtml(word) + '</span>';
      }
      i = m;
      continue;
    }
    result += escHtml(line[i]);
    i++;
  }
  return result;
}

function highlightCode(code, lang) {
  var lines = code.split('\n');
  return lines.map(function(line) {
    return tokenizeLine(line, (lang || '').toLowerCase());
  }).join('\n');
}

function buildCodeBlock(code, lang) {
  var wrapper = document.createElement('div');
  wrapper.className = 'code-block';

  var header = document.createElement('div');
  header.className = 'code-block-header';

  var langLabel = document.createElement('span');
  langLabel.className = 'code-lang';
  langLabel.textContent = lang || 'code';

  var copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.textContent = 'Copy code';

  copyBtn.addEventListener('click', function() {
    navigator.clipboard.writeText(code).then(function() {
      copyBtn.textContent = 'Copied';
      copyBtn.classList.add('copied');
      setTimeout(function() {
        copyBtn.textContent = 'Copy code';
        copyBtn.classList.remove('copied');
      }, 2000);
    }).catch(function() {
      var ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyBtn.textContent = 'Copied';
      copyBtn.classList.add('copied');
      setTimeout(function() {
        copyBtn.textContent = 'Copy code';
        copyBtn.classList.remove('copied');
      }, 2000);
    });
  });

  header.appendChild(langLabel);
  header.appendChild(copyBtn);

  var pre = document.createElement('pre');
  var codeEl = document.createElement('code');
  codeEl.innerHTML = highlightCode(code, lang);
  pre.appendChild(codeEl);

  wrapper.appendChild(header);
  wrapper.appendChild(pre);
  return wrapper;
}

function buildChecklistBlock(tasks) {
  var wrapper = document.createElement('div');
  wrapper.className = 'checklist-block';

  var header = document.createElement('div');
  header.className = 'checklist-header';

  var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'checklist-icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.style.color = '#4f8ef7';
  var polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', '9 11 12 14 22 4');
  var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11');
  icon.appendChild(polyline);
  icon.appendChild(path);

  var titleEl = document.createElement('span');
  titleEl.className = 'checklist-title';
  titleEl.textContent = 'Build Plan';

  var countEl = document.createElement('span');
  countEl.className = 'checklist-count';
  countEl.textContent = tasks.length;

  header.appendChild(icon);
  header.appendChild(titleEl);
  header.appendChild(countEl);

  var itemsContainer = document.createElement('div');
  itemsContainer.className = 'checklist-items';

  tasks.forEach(function(task, idx) {
    var item = document.createElement('div');
    item.className = 'checklist-item';
    item.dataset.idx = idx;

    var circle = document.createElement('div');
    circle.className = 'check-circle';

    var checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    checkSvg.setAttribute('width', '10');
    checkSvg.setAttribute('height', '10');
    checkSvg.setAttribute('viewBox', '0 0 24 24');
    checkSvg.setAttribute('fill', 'none');
    checkSvg.setAttribute('stroke', 'white');
    checkSvg.setAttribute('stroke-width', '3');
    checkSvg.setAttribute('stroke-linecap', 'round');
    checkSvg.setAttribute('stroke-linejoin', 'round');
    var pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    pl.setAttribute('points', '20 6 9 17 4 12');
    checkSvg.appendChild(pl);
    circle.appendChild(checkSvg);

    var label = document.createElement('span');
    label.className = 'check-label';
    label.textContent = task;

    item.appendChild(circle);
    item.appendChild(label);
    itemsContainer.appendChild(item);
  });

  wrapper.appendChild(header);
  wrapper.appendChild(itemsContainer);

  var items = itemsContainer.querySelectorAll('.checklist-item');
  var current = 0;

  function tickNext() {
    if (current >= items.length) return;
    var item = items[current];
    item.classList.add('active');
    item.querySelector('.check-circle').classList.add('active');

    var delay = 600 + Math.random() * 400;
    setTimeout(function() {
      item.classList.remove('active');
      item.classList.add('done');
      var circle = item.querySelector('.check-circle');
      circle.classList.remove('active');
      circle.classList.add('done');
      current++;
      if (current < items.length) {
        setTimeout(tickNext, 200);
      }
    }, delay);
  }

  setTimeout(tickNext, 300);

  return wrapper;
}

function parseAndRenderContent(rawText, container) {
  var taskMatch = rawText.match(/\[TASKS\]([\s\S]*?)\[\/TASKS\]/);
  var tasks = [];
  var bodyText = rawText;

  if (taskMatch) {
    var taskLines = taskMatch[1].trim().split('\n');
    tasks = taskLines.map(function(l) {
      return l.replace(/^\d+\.\s*/, '').trim();
    }).filter(function(l) { return l.length > 0; });
    bodyText = rawText.replace(/\[TASKS\][\s\S]*?\[\/TASKS\]/, '').trim();
  }

  if (tasks.length > 0) {
    container.appendChild(buildChecklistBlock(tasks));
  }

  var segments = bodyText.split(/(```[\s\S]*?```)/g);
  segments.forEach(function(seg) {
    var codeMatch = seg.match(/^```(\w*)\n?([\s\S]*?)```$/);
    if (codeMatch) {
      var lang = codeMatch[1] || 'lua';
      var code = codeMatch[2];
      container.appendChild(buildCodeBlock(code, lang));
    } else if (seg.trim().length > 0) {
      var textDiv = document.createElement('div');
      textDiv.innerHTML = renderInlineMarkdown(seg);
      container.appendChild(textDiv);
    }
  });
}

function renderInlineMarkdown(text) {
  var lines = text.split('\n');
  var html = '';
  var inList = false;

  lines.forEach(function(line) {
    var trimmed = line.trim();
    if (!trimmed) {
      if (inList) { html += '</ul>'; inList = false; }
      return;
    }
    var listMatch = trimmed.match(/^[-*]\s+(.+)/);
    var numMatch = trimmed.match(/^\d+\.\s+(.+)/);
    var h3 = trimmed.match(/^###\s+(.+)/);
    var h2 = trimmed.match(/^##\s+(.+)/);
    var h1 = trimmed.match(/^#\s+(.+)/);

    if (h1) {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<h1>' + inlineFormat(h1[1]) + '</h1>';
    } else if (h2) {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<h2>' + inlineFormat(h2[1]) + '</h2>';
    } else if (h3) {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<h3>' + inlineFormat(h3[1]) + '</h3>';
    } else if (listMatch) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += '<li>' + inlineFormat(listMatch[1]) + '</li>';
    } else if (numMatch) {
      if (!inList) { html += '<ol>'; inList = true; }
      html += '<li>' + inlineFormat(numMatch[1]) + '</li>';
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<p>' + inlineFormat(trimmed) + '</p>';
    }
  });

  if (inList) html += '</ul>';
  return html;
}

function inlineFormat(text) {
  return text
    .replace(/`([^`]+)`/g, '<span class="inline-code">$1</span>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function addMessage(content, isUser) {
  if (presetsEl) presetsEl.style.display = 'none';

  var msg = document.createElement('div');
  msg.className = isUser ? 'user-msg' : 'ai-msg';

  if (isUser) {
    msg.textContent = content;
  } else {
    var tag = document.createElement('span');
    tag.className = 'ai-tag';
    tag.textContent = 'PrysmisAI';

    var body = document.createElement('div');
    body.className = 'ai-msg-body';

    parseAndRenderContent(content, body);

    msg.appendChild(tag);
    msg.appendChild(body);
  }

  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function showThinking() {
  var el = document.createElement('div');
  el.id = 'thinking';
  el.className = 'thinking-anim';
  el.innerHTML = '<span class="thinking-text">PrysmisAI is thinking...</span><div class="thinking-bar"></div>';
  chatArea.appendChild(el);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function removeThinking() {
  var el = document.getElementById('thinking');
  if (el) el.remove();
}

function getModel() {
  var map = {
    'Claude Opus 4.6': 'anthropic/claude-opus-4-6',
    'Gemini 3.2': 'google/gemini-3.2-pro',
    'ChatGPT 5.2': 'openai/gpt-5.4'
  };
  return map[modelSelect.value] || 'anthropic/claude-sonnet-4-6';
}

function buildMessages() {
  var msgs = [{ role: 'system', content: SYSTEM_PROMPT }];
  currentMessages.forEach(function(m) { msgs.push(m); });
  return msgs;
}

function doSend() {
  var text = inputEl.value.trim();
  if (!text) return;

  var isFirst = currentMessages.length === 0;
  addMessage(text, true);
  currentMessages.push({ role: 'user', content: text });
  inputEl.value = '';
  inputEl.style.height = 'auto';
  showThinking();

  fetch('/v1/chat/completions?model=' + encodeURIComponent(getModel()), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: buildMessages(), temperature: 0.7, max_tokens: 4096 })
  }).then(function(r) {
    return r.json();
  }).then(function(data) {
    removeThinking();
    var reply = (data.choices && data.choices[0] && data.choices[0].message)
      ? data.choices[0].message.content
      : (data.error || 'No response received.');
    addMessage(reply, false);
    currentMessages.push({ role: 'assistant', content: reply });
    if (isFirst) {
      saveChat(text);
    } else {
      updateChat();
    }
  }).catch(function(e) {
    removeThinking();
    addMessage('Connection error: ' + e.message, false);
  });
}

function saveChat(firstMsg) {
  var title = firstMsg.substring(0, 38) + (firstMsg.length > 38 ? '...' : '');
  fetch('/chats?token=' + encodeURIComponent(storedToken), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title, messages: currentMessages })
  }).then(function(r) {
    return r.json();
  }).then(function(data) {
    if (data.success && data.chat) {
      activeChatId = data.chat.id;
      loadChatHistory();

var pluginConnected = false;
var pluginTokenStored = localStorage.getItem('pluginToken') || '';
var connectBtn = document.getElementById('connectBtn');
var statusDot = document.getElementById('statusDot');
var statusText = document.getElementById('statusText');

function getModelValue() {
  var map = {
    'Claude Opus 4.6': 'anthropic/claude-opus-4-6',
    'Gemini 3.2': 'google/gemini-3.2-pro',
    'ChatGPT 5.2': 'openai/gpt-5.4'
  };
  return map[modelSelect.value] || 'anthropic/claude-opus-4-6';
}

function setExplorerStatus(connected, model) {
  pluginConnected = connected;
  if (statusDot) {
    statusDot.className = 'dot ' + (connected ? 'green' : 'red');
  }
  if (statusText) {
    statusText.textContent = connected ? 'Connected' : 'Disconnected';
    statusText.style.color = connected ? '#10b981' : '#f43f5e';
  }
  if (connectBtn) {
    connectBtn.textContent = connected ? 'Plugin Connected' : 'Connect Plugin';
    connectBtn.style.opacity = connected ? '0.7' : '1';
  }
}

function connectPlugin() {
  if (pluginConnected) {
    fetch('/plugin/disconnect?token=' + encodeURIComponent(storedToken), { method: 'POST' })
      .then(function() {
        pluginTokenStored = '';
        localStorage.removeItem('pluginToken');
        setExplorerStatus(false, '');
        hidePluginTokenBox();
      }).catch(function() {});
    return;
  }

  var model = getModelValue();

  fetch('/plugin/connect?token=' + encodeURIComponent(storedToken), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model })
  }).then(function(r) {
    return r.json();
  }).then(function(data) {
    if (data.success && data.pluginToken) {
      pluginTokenStored = data.pluginToken;
      localStorage.setItem('pluginToken', data.pluginToken);
      setExplorerStatus(true, data.model);
      showPluginTokenBox(data.pluginToken);
    }
  }).catch(function() {});
}

function showPluginTokenBox(token) {
  var existing = document.getElementById('pluginTokenBox');
  if (existing) { existing.remove(); }
  var box = document.createElement('div');
  box.id = 'pluginTokenBox';
  box.style.cssText = 'position:absolute;bottom:3.5rem;left:50%;transform:translateX(-50%);width:240px;background:#0a0a14;border:1px solid rgba(79,142,247,0.3);border-radius:10px;padding:0.75rem;z-index:10;';
  var label = document.createElement('div');
  label.style.cssText = 'font-size:0.65rem;font-weight:700;color:#5a5a72;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.4rem;';
  label.textContent = 'Paste in Studio Plugin';
  var tokenEl = document.createElement('div');
  tokenEl.style.cssText = 'font-size:0.7rem;color:#93c5fd;font-family:monospace;word-break:break-all;margin-bottom:0.5rem;line-height:1.4;';
  tokenEl.textContent = token;
  var copyBtn = document.createElement('button');
  copyBtn.style.cssText = 'width:100%;padding:0.35rem;background:rgba(79,142,247,0.15);border:1px solid rgba(79,142,247,0.25);border-radius:6px;color:#4f8ef7;font-size:0.72rem;font-weight:700;cursor:pointer;';
  copyBtn.textContent = 'Copy Token';
  copyBtn.addEventListener('click', function() {
    navigator.clipboard.writeText(token).then(function() {
      copyBtn.textContent = 'Copied';
      setTimeout(function() { copyBtn.textContent = 'Copy Token'; }, 2000);
    }).catch(function() {
      var ta = document.createElement('textarea');
      ta.value = token;
      ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyBtn.textContent = 'Copied';
      setTimeout(function() { copyBtn.textContent = 'Copy Token'; }, 2000);
    });
  });
  box.appendChild(label);
  box.appendChild(tokenEl);
  box.appendChild(copyBtn);
  var explorerEl = document.getElementById('explorer');
  if (explorerEl) {
    explorerEl.style.position = 'relative';
    explorerEl.appendChild(box);
    if (!explorerEl.classList.contains('open')) {
      explorerEl.classList.add('open');
    }
  }
}

function hidePluginTokenBox() {
  var existing = document.getElementById('pluginTokenBox');
  if (existing) existing.remove();
}

if (connectBtn) {
  connectBtn.addEventListener('click', connectPlugin);
}

modelSelect.addEventListener('change', function() {
  if (pluginConnected && storedToken) {
    fetch('/plugin/update-model?token=' + encodeURIComponent(storedToken), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: getModelValue() })
    }).catch(function() {});
  }
});

if (pluginTokenStored) {
  fetch('/plugin/ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pluginToken: pluginTokenStored })
  }).then(function(r) {
    return r.json();
  }).then(function(data) {
    if (data.ok) {
      setExplorerStatus(true, data.model);
      showPluginTokenBox(pluginTokenStored);
    } else {
      localStorage.removeItem('pluginToken');
      pluginTokenStored = '';
    }
  }).catch(function() {
    localStorage.removeItem('pluginToken');
    pluginTokenStored = '';
  });
}
    }
  }).catch(function() {});
}

function updateChat() {
  if (!activeChatId) return;
  fetch('/chats/' + activeChatId + '?token=' + encodeURIComponent(storedToken), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: currentMessages })
  }).then(function(r) {
    return r.json();
  }).then(function(data) {
    if (!data.success) {
      saveChat(currentMessages[0] ? currentMessages[0].content : 'Chat');
    }
  }).catch(function() {});
}

function loadChatHistory() {
  fetch('/chats?token=' + encodeURIComponent(storedToken))
    .then(function(r) { return r.json(); })
    .then(function(chats) {
      chatHistoryEl.innerHTML = '';
      if (!Array.isArray(chats)) return;
      chats.forEach(function(chat) { renderHistoryItem(chat); });
    }).catch(function() {});
}

function renderHistoryItem(chat) {
  var item = document.createElement('div');
  item.className = 'history-item';
  item.dataset.id = chat.id;

  var textSpan = document.createElement('span');
  textSpan.className = 'history-item-text';
  textSpan.textContent = chat.title || 'Untitled chat';

  var delBtn = document.createElement('button');
  delBtn.className = 'history-del';
  delBtn.textContent = 'x';

  delBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    deleteChat(chat.id, item);
  });

  textSpan.addEventListener('click', function() {
    loadChat(chat);
  });

  item.appendChild(textSpan);
  item.appendChild(delBtn);
  chatHistoryEl.appendChild(item);
}

function loadChat(chat) {
  chatArea.innerHTML = '';
  currentMessages = [];
  activeChatId = chat.id;
  if (!chat.messages || chat.messages.length === 0) return;
  chat.messages.forEach(function(m) {
    addMessage(m.content, m.role === 'user');
    currentMessages.push(m);
  });
}

function deleteChat(id, itemEl) {
  fetch('/chats/' + id + '?token=' + encodeURIComponent(storedToken), { method: 'DELETE' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        itemEl.remove();
        if (activeChatId === id) {
          activeChatId = null;
          currentMessages = [];
          resetChatArea();
        }
      }
    }).catch(function() {});
}

function resetChatArea() {
  chatArea.innerHTML = '';
  if (presetsEl) {
    presetsEl.style.display = 'flex';
    presetsEl.style.flexDirection = 'column';
    chatArea.appendChild(presetsEl);
  }
}

newChatBtn.addEventListener('click', function() {
  activeChatId = null;
  currentMessages = [];
  chatArea.innerHTML = '';
  if (presetsEl) {
    presetsEl.style.display = 'flex';
    presetsEl.style.flexDirection = 'column';
    chatArea.appendChild(presetsEl);
  }
  inputEl.value = '';
  inputEl.style.height = 'auto';
});

sendBtn.addEventListener('click', doSend);

inputEl.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    doSend();
  }
});

inputEl.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 140) + 'px';
});

function usePreset(i) {
  var texts = [
    'Create me a Roblox map that is ',
    'Make me a character animation script that ',
    'Make me an advanced loading screen that '
  ];
  inputEl.value = texts[i];
  inputEl.focus();
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
}

function toggleExplorer() {
  document.getElementById('explorer').classList.toggle('open');
}

function showTab(tab, btnEl) {
  document.querySelectorAll('.tab-link').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.viewport').forEach(function(v) { v.style.display = 'none'; });
  if (btnEl) btnEl.classList.add('active');
  document.getElementById(tab + 'Tab').style.display = 'flex';
  if (tab === 'projects') loadProjects();
}

function loadProjects() {
  projectsList.innerHTML = '<div class="empty-state"><p>Loading projects...</p></div>';
  fetch('/projects')
    .then(function(r) { return r.json(); })
    .then(function(projects) {
      projectsList.innerHTML = '';
      if (!projects || projects.length === 0) {
        projectsList.innerHTML = '<div class="empty-state"><p>No projects yet. Be the first to share yours.</p></div>';
        return;
      }
      projects.forEach(function(p) { renderProjectCard(p); });
    }).catch(function() {
      projectsList.innerHTML = '<div class="empty-state"><p>Could not load projects.</p></div>';
    });
}

function renderProjectCard(p) {
  var card = document.createElement('div');
  card.className = 'game-card';
  card.dataset.id = p.id;

  var authorDiv = document.createElement('div');
  authorDiv.className = 'game-card-author';
  authorDiv.textContent = 'by ' + (p.author || 'unknown');

  var title = document.createElement('h3');
  title.textContent = p.title;

  var desc = document.createElement('p');
  desc.textContent = p.about;

  var footer = document.createElement('div');
  footer.className = 'game-card-footer';

  var link = document.createElement('a');
  link.href = p.link;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = p.link;

  footer.appendChild(link);

  if (p.author === storedUser) {
    var delBtn = document.createElement('button');
    delBtn.className = 'delete-card-btn';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', function() { deleteProject(p.id, card); });
    footer.appendChild(delBtn);
  }

  card.appendChild(authorDiv);
  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(footer);
  projectsList.appendChild(card);
}

function deleteProject(id, cardEl) {
  fetch('/projects/' + id + '?token=' + encodeURIComponent(storedToken), { method: 'DELETE' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        cardEl.style.opacity = '0';
        cardEl.style.transform = 'scale(0.95)';
        cardEl.style.transition = 'all 0.2s';
        setTimeout(function() { cardEl.remove(); }, 200);
      } else {
        alert(data.error || 'Could not delete');
      }
    }).catch(function() { alert('Error deleting project'); });
}

postGameBtn.addEventListener('click', function() {
  var title = document.getElementById('gameTitle').value.trim();
  var link = document.getElementById('gameLink').value.trim();
  var about = document.getElementById('gameAbout').value.trim();
  if (!title || !link || !about) return;

  postGameBtn.textContent = 'Publishing...';
  postGameBtn.disabled = true;

  fetch('/projects?token=' + encodeURIComponent(storedToken), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title, link: link, about: about })
  }).then(function(r) {
    return r.json();
  }).then(function(data) {
    postGameBtn.textContent = 'Publish Project';
    postGameBtn.disabled = false;
    if (data.success) {
      closeModal();
      document.getElementById('gameTitle').value = '';
      document.getElementById('gameLink').value = '';
      document.getElementById('gameAbout').value = '';
      loadProjects();
    } else {
      alert(data.error || 'Failed to post');
    }
  }).catch(function() {
    postGameBtn.textContent = 'Publish Project';
    postGameBtn.disabled = false;
    alert('Error posting project');
  });
});

function openModal() { modal.style.display = 'flex'; }
function closeModal() { modal.style.display = 'none'; }

modal.addEventListener('click', function(e) {
  if (e.target === modal) closeModal();
});

loadChatHistory();

var pluginConnected = false;
var pluginTokenStored = localStorage.getItem('pluginToken') || '';
var connectBtn = document.getElementById('connectBtn');
var statusDot = document.getElementById('statusDot');
var statusText = document.getElementById('statusText');

function getModelValue() {
  var map = {
    'Claude Opus 4.6': 'anthropic/claude-opus-4-6',
    'Gemini 3.2': 'google/gemini-3.2-pro',
    'ChatGPT 5.2': 'openai/gpt-5.4'
  };
  return map[modelSelect.value] || 'anthropic/claude-opus-4-6';
}

function setExplorerStatus(connected, model) {
  pluginConnected = connected;
  if (statusDot) {
    statusDot.className = 'dot ' + (connected ? 'green' : 'red');
  }
  if (statusText) {
    statusText.textContent = connected ? 'Connected' : 'Disconnected';
    statusText.style.color = connected ? '#10b981' : '#f43f5e';
  }
  if (connectBtn) {
    connectBtn.textContent = connected ? 'Plugin Connected' : 'Connect Plugin';
    connectBtn.style.opacity = connected ? '0.7' : '1';
  }
}

function connectPlugin() {
  if (pluginConnected) {
    fetch('/plugin/disconnect?token=' + encodeURIComponent(storedToken), { method: 'POST' })
      .then(function() {
        pluginTokenStored = '';
        localStorage.removeItem('pluginToken');
        setExplorerStatus(false, '');
        hidePluginTokenBox();
      }).catch(function() {});
    return;
  }

  var model = getModelValue();

  fetch('/plugin/connect?token=' + encodeURIComponent(storedToken), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model })
  }).then(function(r) {
    return r.json();
  }).then(function(data) {
    if (data.success && data.pluginToken) {
      pluginTokenStored = data.pluginToken;
      localStorage.setItem('pluginToken', data.pluginToken);
      setExplorerStatus(true, data.model);
      showPluginTokenBox(data.pluginToken);
    }
  }).catch(function() {});
}

function showPluginTokenBox(token) {
  var existing = document.getElementById('pluginTokenBox');
  if (existing) { existing.remove(); }
  var box = document.createElement('div');
  box.id = 'pluginTokenBox';
  box.style.cssText = 'position:absolute;bottom:3.5rem;left:50%;transform:translateX(-50%);width:240px;background:#0a0a14;border:1px solid rgba(79,142,247,0.3);border-radius:10px;padding:0.75rem;z-index:10;';
  var label = document.createElement('div');
  label.style.cssText = 'font-size:0.65rem;font-weight:700;color:#5a5a72;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.4rem;';
  label.textContent = 'Paste in Studio Plugin';
  var tokenEl = document.createElement('div');
  tokenEl.style.cssText = 'font-size:0.7rem;color:#93c5fd;font-family:monospace;word-break:break-all;margin-bottom:0.5rem;line-height:1.4;';
  tokenEl.textContent = token;
  var copyBtn = document.createElement('button');
  copyBtn.style.cssText = 'width:100%;padding:0.35rem;background:rgba(79,142,247,0.15);border:1px solid rgba(79,142,247,0.25);border-radius:6px;color:#4f8ef7;font-size:0.72rem;font-weight:700;cursor:pointer;';
  copyBtn.textContent = 'Copy Token';
  copyBtn.addEventListener('click', function() {
    navigator.clipboard.writeText(token).then(function() {
      copyBtn.textContent = 'Copied';
      setTimeout(function() { copyBtn.textContent = 'Copy Token'; }, 2000);
    }).catch(function() {
      var ta = document.createElement('textarea');
      ta.value = token;
      ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyBtn.textContent = 'Copied';
      setTimeout(function() { copyBtn.textContent = 'Copy Token'; }, 2000);
    });
  });
  box.appendChild(label);
  box.appendChild(tokenEl);
  box.appendChild(copyBtn);
  var explorerEl = document.getElementById('explorer');
  if (explorerEl) {
    explorerEl.style.position = 'relative';
    explorerEl.appendChild(box);
    if (!explorerEl.classList.contains('open')) {
      explorerEl.classList.add('open');
    }
  }
}

function hidePluginTokenBox() {
  var existing = document.getElementById('pluginTokenBox');
  if (existing) existing.remove();
}

if (connectBtn) {
  connectBtn.addEventListener('click', connectPlugin);
}

modelSelect.addEventListener('change', function() {
  if (pluginConnected && storedToken) {
    fetch('/plugin/update-model?token=' + encodeURIComponent(storedToken), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: getModelValue() })
    }).catch(function() {});
  }
});

if (pluginTokenStored) {
  fetch('/plugin/ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pluginToken: pluginTokenStored })
  }).then(function(r) {
    return r.json();
  }).then(function(data) {
    if (data.ok) {
      setExplorerStatus(true, data.model);
      showPluginTokenBox(pluginTokenStored);
    } else {
      localStorage.removeItem('pluginToken');
      pluginTokenStored = '';
    }
  }).catch(function() {
    localStorage.removeItem('pluginToken');
    pluginTokenStored = '';
  });
}
