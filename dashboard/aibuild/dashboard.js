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

function fmtText(text) {
  return text
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
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
    body.innerHTML = fmtText(content);
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
    body: JSON.stringify({ messages: currentMessages, temperature: 0.7, max_tokens: 2048 })
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
    }
  }).catch(function() {});
}

function updateChat() {
  if (!activeChatId) return;
  fetch('/chats/' + activeChatId + '?token=' + encodeURIComponent(storedToken), {
    method: 'DELETE'
  }).then(function() {
    var title = currentMessages[0]
      ? currentMessages[0].content.substring(0, 38) + (currentMessages[0].content.length > 38 ? '...' : '')
      : 'Untitled';
    return fetch('/chats?token=' + encodeURIComponent(storedToken), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title, messages: currentMessages })
    });
  }).then(function(r) {
    return r.json();
  }).then(function(data) {
    if (data.success && data.chat) {
      activeChatId = data.chat.id;
      loadChatHistory();
    }
  }).catch(function() {});
}

function loadChatHistory() {
  fetch('/chats?token=' + encodeURIComponent(storedToken))
    .then(function(r) { return r.json(); })
    .then(function(chats) {
      chatHistoryEl.innerHTML = '';
      if (!Array.isArray(chats)) return;
      chats.forEach(function(chat) {
        renderHistoryItem(chat);
      });
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
    delBtn.addEventListener('click', function() {
      deleteProject(p.id, card);
    });
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
