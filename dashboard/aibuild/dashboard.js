var storedUser = localStorage.getItem('user');
var storedToken = localStorage.getItem('token');

if (!storedUser || !storedToken) {
  location.href = '/accountauth/index.html';
}

document.getElementById('userName').textContent = storedUser || 'User';

var chatArea = document.getElementById('chatArea');
var input = document.getElementById('input');
var sendBtn = document.getElementById('sendBtn');
var modelSelect = document.getElementById('modelSelect');
var presets = document.getElementById('presets');
var projectsList = document.getElementById('projectsList');
var modal = document.getElementById('addGameModal');
var postGameBtn = document.getElementById('postGameBtn');
var newChatBtn = document.getElementById('newChatBtn');
var chatHistory = document.getElementById('chatHistory');

var currentChat = [];

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatText(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

function addMessage(content, isUser) {
  var msg = document.createElement('div');
  msg.className = isUser ? 'user-msg' : 'ai-msg';
  if (!isUser) {
    var tag = document.createElement('span');
    tag.className = 'ai-tag';
    tag.textContent = 'PrysmisAI';
    msg.appendChild(tag);
    var textNode = document.createElement('div');
    textNode.innerHTML = formatText(content);
    msg.appendChild(textNode);
  } else {
    msg.textContent = content;
  }
  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
  if (isUser) currentChat.push(content);
}

function showThinking() {
  var loader = document.createElement('div');
  loader.id = 'ai-thinking';
  loader.className = 'thinking-anim';
  loader.innerHTML = '<div class="thinking-text">PrysmisAI is processing...</div><div class="thinking-bar"></div>';
  chatArea.appendChild(loader);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function removeThinking() {
  var loader = document.getElementById('ai-thinking');
  if (loader) loader.remove();
}

function getSelectedModel() {
  var val = modelSelect.value;
  var map = {
    'Claude Opus 4.6': 'anthropic/claude-opus-4-6',
    'Gemini 3.2': 'google/gemini-3.2-pro',
    'ChatGPT 5.2': 'openai/gpt-5.4'
  };
  return map[val] || 'anthropic/claude-sonnet-4-6';
}

sendBtn.onclick = function() {
  var text = input.value.trim();
  if (!text) return;
  addMessage(text, true);
  input.value = '';
  presets.style.display = 'none';
  showThinking();
  var model = getSelectedModel();
  fetch('/v1/chat/completions?model=' + encodeURIComponent(model), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: text }], temperature: 0.7, max_tokens: 2048 })
  }).then(function(res) {
    return res.json();
  }).then(function(data) {
    removeThinking();
    var reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ? data.choices[0].message.content : (data.error || 'No response');
    addMessage(reply, false);
  }).catch(function(e) {
    removeThinking();
    addMessage('System Error: ' + e.message, false);
  });
};

function loadProjects() {
  fetch('/projects').then(function(res) {
    return res.json();
  }).then(function(projects) {
    projectsList.innerHTML = '';
    projects.forEach(function(p) {
      renderProjectCard(p);
    });
  }).catch(function() {
    projectsList.innerHTML = '';
  });
}

function renderProjectCard(p) {
  var card = document.createElement('div');
  card.className = 'game-card';
  card.dataset.id = p.id;
  var deleteHtml = p.author === storedUser ? '<button class="delete-card-btn" onclick="deleteProject(\'' + p.id + '\', this)">Delete</button>' : '';
  card.innerHTML = '<h3>' + escapeHtml(p.title) + '</h3><p>' + escapeHtml(p.about) + '</p><a href="' + escapeHtml(p.link) + '" target="_blank">' + escapeHtml(p.link) + '</a>' + deleteHtml;
  projectsList.appendChild(card);
}

function deleteProject(id) {
  fetch('/projects/' + id + '?token=' + encodeURIComponent(storedToken), { method: 'DELETE' }).then(function(res) {
    return res.json();
  }).then(function(data) {
    if (data.success) {
      var card = projectsList.querySelector('[data-id="' + id + '"]');
      if (card) card.remove();
    } else {
      alert(data.error || 'Could not delete');
    }
  }).catch(function() {
    alert('Error deleting project');
  });
}

postGameBtn.onclick = function() {
  var title = document.getElementById('gameTitle').value.trim();
  var link = document.getElementById('gameLink').value.trim();
  var about = document.getElementById('gameAbout').value.trim();
  if (!title || !link || !about) return;
  fetch('/projects?token=' + encodeURIComponent(storedToken), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title, link: link, about: about })
  }).then(function(res) {
    return res.json();
  }).then(function(data) {
    if (data.success) {
      closeModal();
      document.getElementById('gameTitle').value = '';
      document.getElementById('gameLink').value = '';
      document.getElementById('gameAbout').value = '';
      loadProjects();
    } else {
      alert(data.error || 'Failed to post project');
    }
  }).catch(function() {
    alert('Error posting project');
  });
};

newChatBtn.onclick = function() {
  if (currentChat.length > 0) {
    var item = document.createElement('div');
    item.className = 'history-item';
    item.textContent = currentChat[0].substring(0, 25) + '...';
    chatHistory.prepend(item);
  }
  chatArea.innerHTML = '';
  chatArea.appendChild(presets);
  presets.style.display = 'block';
  currentChat = [];
  input.value = '';
};

input.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

function usePreset(i) {
  var texts = [
    'Create me a map that is ',
    'Make me a character that animates ',
    'Make me an advanced loading startup screen that does '
  ];
  input.value = texts[i];
  input.focus();
}

function toggleExplorer() {
  document.getElementById('explorer').classList.toggle('open');
}

function showTab(tab, e) {
  document.querySelectorAll('.tab-link').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.viewport').forEach(function(c) { c.style.display = 'none'; });
  if (e && e.currentTarget) {
    e.currentTarget.classList.add('active');
  } else {
    document.querySelectorAll('.tab-link').forEach(function(t) {
      if ((tab === 'chat' && t.textContent.trim() === 'AI Chat') || (tab === 'projects' && t.textContent.trim() === 'Community Projects')) {
        t.classList.add('active');
      }
    });
  }
  document.getElementById(tab + 'Tab').style.display = 'flex';
  if (tab === 'projects') loadProjects();
}

function openModal() { modal.style.display = 'flex'; }
function closeModal() { modal.style.display = 'none'; }
