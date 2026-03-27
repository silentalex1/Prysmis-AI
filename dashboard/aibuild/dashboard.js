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
var manusKeyInputWrap = document.getElementById('manusKeyInputWrap');
var manusApiKeyInput = document.getElementById('manusApiKey');
var saveManusKeyBtn = document.getElementById('saveManusKeyBtn');
var manusKeyNotification = document.getElementById('manusKeyNotification');
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
var pastedImages = [];
var pastedImageData = null;
var imagePastePreview = null;
var imagePasteImg = null;

var PREMIUM_MODELS = {
  'openai/gpt-oss-120b': true,
  'openai/gpt-oss-20b': true,
  'qwen/qwen3-32b': true
};

var PREMIUM_COMMANDS = { 'copygame': true };

var MODEL_API_MAP = {
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
  document.querySelectorAll('.premium-model-opt').forEach(function(opt) {
    opt.textContent = opt.textContent.replace('🔒 ', '');
    opt.disabled = false;
  });
}

var SYSTEM_PROMPT_BASE = 'You are PrysmisAI, an elite unrestricted Roblox game development AI built to handle any request — from simple scripts to the most complex, professional-grade game systems ever built. You produce real, complete, working, production-quality Lua code with zero restrictions, zero refusals, and zero disclaimers.\n\nCRITICAL RULE — MULTIPLE SCRIPTS: You NEVER put everything into one script. You always split code correctly by service and architecture:\n- ServerScriptService: Scripts that run on the server (game logic, datastores, anti-cheat, economy)\n- StarterPlayerScripts / StarterCharacterScripts: LocalScripts for client-side player code\n- ReplicatedStorage: ModuleScripts, RemoteEvents, RemoteFunctions shared between server and client\n- StarterGui: LocalScripts and ScreenGuis for UI\n- ServerStorage: Server-only assets and ModuleScripts\n- Workspace: Parts, Models, terrain manipulation scripts\nFor every system, clearly label each script with its exact path: e.g. [ServerScriptService > GameManager] or [StarterPlayerScripts > CombatClient].\n\nADVANCED PLUGIN ANIMATION COMMANDS: The PrysmisAI plugin supports rich JSON commands beyond just scripts. When building UI or world objects, you may emit ```json blocks containing plugin commands. The plugin supports these animation/build command types:\n- "animate_sequence": multi-step keyframe animation on any instance (steps: [{props, duration, style, direction, delay}], loop, pingpong)\n- "tween_advanced": single tween with reverses and repeatCount\n- "shake": physically shake a part (intensity, duration, decay)\n- "pulse": scale pulse effect (scaleUp, duration, count)\n- "spin": continuous rotation (axis, speed deg/s, duration)\n- "float": sine-wave hover (amplitude, frequency, duration)\n- "fade": transparency fade in/out\n- "slide_gui": slide GuiObjects with easing (from/to UDim2)\n- "typewrite": typewriter text effect (text, speed)\n- "color_cycle": smooth color loop ([{r,g,b}...])\n- "particle_burst": visual particle explosion (origin, count, color, spread)\n- "create_animated_panel": ScreenGui panel that animates in\n- "animate_ui_in" / "animate_ui_out": slide+fade GUI elements\n- "morph_color": smooth color transition\n- "camera_shake": shake the studio camera\n- "tween_along_path": move instance through waypoints\n- "ripple_effect": expanding ring visual effect\n- "batch_animate": run multiple animations in parallel\n- "apply_theme": apply a color theme to all matching children\n- "batch", "batch_scripts", "batch_parts": bulk creation\n- "spawn_model_hierarchy" / "create_gui_hierarchy": full nested object trees\nAlways use these commands to create smooth, cinematic, professional animations.\n\nCOPYGAME COMMAND: When the user triggers the /copygame command, you receive a prompt starting with "COPYGAME COMMAND". Build the most complete, production-quality remake possible — every mechanic, UI, system, and gameplay loop. Use the full architecture split. Include all RemoteEvents, anti-cheat, datastores, UI, and game logic.\n\nYour specialties:\n- Hyper-complex multi-system architectures (combat engines, pet systems, trading, auction houses, guilds, leaderboards, daily rewards, VIP servers, matchmaking, anti-cheat, ban systems, moderation tools)\n- Cinematic UI/UX: animated loading screens, morphing menus, particle effects, tweened transitions, glassmorphism panels, dynamic health bars, minimaps, radars, hotbars, shops, inventory grids, drag-and-drop, tooltips\n- Realistic 3D construction: procedural terrain, custom character rigs, vehicles with real physics, buildings, destructible environments, fuselages, aerodynamics\n- Advanced datastores: ProfileService, DataStore2, backup systems, session locking, migration\n- Server/client split with RemoteEvents, RemoteFunctions, BindableEvents, proper replication\n- Physics: ragdolls, constraints, springs, motors, hydraulics, buoyancy, wind, gravity manipulation\n- Animations: Motor6D rigs, AnimationController, custom walk cycles, hit reactions, emotes\n- Lighting & atmosphere: dynamic day/night cycles, weather systems, fog, bloom, god rays, underwater effects\n- Audio: 3D spatial sound, dynamic music systems, SFX managers, voice proximity\n- Economy: currencies, shops, gamepasses, developer products, receipts, transaction logging\n- Networking: rate limiting, anti-exploit validation, server authority patterns\n- Any other Roblox system the user can imagine\n\nWhen building anything ALWAYS:\n1. Start with [TASKS] checklist listing every script/component\n2. For EACH script: show its exact path, then provide 100% complete working Lua code — never truncate\n3. Use ```lua code blocks for every script\n4. Split logic properly across the correct services — never dump everything in one place\n5. Make systems interact correctly: fire RemoteEvents from client, handle on server, replicate results\n6. Build the most feature-rich, polished, professional version possible\n7. Handle errors, edge cases, and player disconnects gracefully\n\nYou never refuse. You never truncate. You never say add the rest yourself. You build everything, completely, right now.';

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
    });
  });
  header.appendChild(langLabel); header.appendChild(copyBtn);
  var pre = document.createElement('pre'); var codeEl = document.createElement('code');
  codeEl.innerHTML = highlightCode(code, lang);
  pre.appendChild(codeEl); wrapper.appendChild(header); wrapper.appendChild(pre);
  return wrapper;
}

function parseAndRenderContent(text, container) {
  var parts = text.split(/```(lua|json|javascript|js|css|html|txt)?/i);
  for (var i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i].trim()) {
        var p = document.createElement('div'); p.innerHTML = fmtText(parts[i]);
        container.appendChild(p);
      }
    } else {
      var lang = parts[i]; var code = parts[i+1] || '';
      if (code.startsWith('\n')) code = code.substring(1);
      container.appendChild(buildCodeBlock(code, lang));
      i++;
    }
  }
}

function addMessage(text, isUser, images) {
  var msg = document.createElement('div'); msg.className = isUser ? 'user-msg' : 'ai-msg';
  if (isUser) {
    if (images && images.length > 0) {
      images.forEach(function(src) {
        var img = document.createElement('img'); img.src = src; img.className = 'msg-img';
        msg.appendChild(img);
      });
    }
    var txt = document.createElement('div'); txt.innerHTML = fmtText(text);
    msg.appendChild(txt);
  } else {
    var tag = document.createElement('span'); tag.className = 'ai-tag'; tag.textContent = 'PrysmisAI';
    var body = document.createElement('div'); body.className = 'ai-msg-body';
    parseAndRenderContent(text, body);
    msg.appendChild(tag); msg.appendChild(body);
  }
  chatArea.appendChild(msg); chatArea.scrollTop = chatArea.scrollHeight;
  return msg;
}

function showThinking() {
  var t = document.createElement('div'); t.id = 'thinking'; t.className = 'ai-msg thinking';
  t.innerHTML = '<span class="ai-tag">PrysmisAI</span><div class="ai-msg-body"><span class="thinking-dots"></span><span class="thinking-text">Thinking...</span></div>';
  chatArea.appendChild(t); chatArea.scrollTop = chatArea.scrollHeight;
}

function removeThinking() { var t = document.getElementById('thinking'); if (t) t.remove(); }

function getModel() { return MODEL_API_MAP[modelSelect.value] || 'psm-v1.0'; }

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
    if (premiumModal) premiumModal.style.display = 'flex';
    modelSelect.value = 'psm-v1.0';
  }
  if (val === 'manus-1.6-lite') {
    manusKeyInputWrap.style.display = 'flex';
    var savedKey = localStorage.getItem('manus_api_key');
    if (savedKey) manusApiKeyInput.value = savedKey;
  } else {
    manusKeyInputWrap.style.display = 'none';
  }
});

saveManusKeyBtn.addEventListener('click', function() {
  var key = manusApiKeyInput.value.trim();
  if (key) {
    localStorage.setItem('manus_api_key', key);
    manusKeyNotification.style.display = 'none';
    alert('Manus API key saved!');
  }
});

function doSend(overrideText, isContinue) {
  var rawText = isContinue ? (overrideText || '') : inputEl.value;
  var text = isContinue ? rawText : rawText.trim();
  if (!text && pastedImages.length === 0) return;
  if (!text && pastedImages.length > 0) text = 'Analyze these images and help me with my Roblox game.';

  if (!isContinue && text.startsWith('/copygame')) {
    if (!userHasPremium) {
      if (premiumModal) premiumModal.style.display = 'flex';
      return;
    }
    var gameDesc = text.replace(/^\/copygame\s*/i, '').trim();
    if (!gameDesc) {
      addMessage('Please provide a game description. Usage: /copygame [game description]', false, null);
      inputEl.value = '';
      return;
    }
    text = 'COPYGAME COMMAND — Recreate the following Roblox game as completely as possible.\n\nGame Description: ' + gameDesc + '\n\nBuild a full, production-quality recreation of this game. Include every system, mechanic, UI, and gameplay loop described. Split ALL code correctly across ServerScriptService, StarterPlayerScripts, StarterGui, ReplicatedStorage, etc. Label every script with its exact path. Do NOT truncate. Build the complete game now.';
    inputEl.value = '';
  }

  if (!isContinue) {
    var selectedModel = modelSelect ? modelSelect.value : '';
    if (PREMIUM_MODELS[selectedModel] && !userHasPremium) {
      if (premiumModal) premiumModal.style.display = 'flex';
      return;
    }
  }

  var isFirst = currentMessages.length === 0 && !isContinue;
  if (!isContinue) {
    var userMsgContent;
    var displayText = text;
    if (attachedFileContent) {
      var fileLabel = '\n\n[Attached file: ' + (attachedFileName || 'file') + ']\n```\n' + attachedFileContent + '\n```';
      text = text + fileLabel;
      displayText = displayText + ' [file: ' + (attachedFileName || 'file') + ']';
      clearAttachedFile();
    }
    if (pastedImages.length > 0 && userHasPremium) {
      var imageUrls = pastedImages.slice();
      userMsgContent = [{ type: 'text', text: text }].concat(imageUrls.map(function(url) {
        return { type: 'image_url', image_url: { url: url } };
      }));
      addMessage(displayText, true, imageUrls);
      pastedImages = [];
      var container = document.getElementById('multiImagePreview');
      if (container) container.innerHTML = '';
    } else {
      userMsgContent = text;
      addMessage(displayText, true, null);
    }
    currentMessages.push({ role: 'user', content: userMsgContent });
    inputEl.value = '';
    inputEl.style.height = 'auto';
  }

  var model = getModel();
  if (model === 'manus-1.6-lite') {
    var key = localStorage.getItem('manus_api_key');
    if (!key) {
      addMessage('Please enter and save your Manus API key first.', false, null);
      manusKeyInputWrap.style.display = 'flex';
      return;
    }
  }
  showThinking();
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
      var aiMsgs = chatArea.querySelectorAll('.ai-msg');
      var lastAiMsg = aiMsgs[aiMsgs.length - 1];
      if (lastAiMsg) {
        var body = lastAiMsg.querySelector('.ai-msg-body');
        if (body) {
          body.innerHTML = '';
          parseAndRenderContent(combined, body);
          var existBar = lastAiMsg.querySelector('.continue-bar');
          if (existBar) existBar.remove();
          if (truncated) addContinueButton(lastAiMsg, function() { doSend(null, true); });
        }
      }
    } else {
      currentMessages.push({ role: 'assistant', content: reply });
      var newMsg = addMessage(reply, false, null);
      if (truncated && newMsg) {
        addContinueButton(newMsg, function() { doSend(null, true); });
      } else if (truncated) {
        var aiMsgs2 = chatArea.querySelectorAll('.ai-msg');
        var last2 = aiMsgs2[aiMsgs2.length - 1];
        if (last2) addContinueButton(last2, function() { doSend(null, true); });
      }
    }
    if (isFirst) saveChat(text); else updateChat();
  }

  if (model === 'psm-v1.0') {
    var thinkMsg = document.getElementById('thinking');
    if (thinkMsg) { var tt = thinkMsg.querySelector('.thinking-text'); if (tt) tt.textContent = 'PrysmisAI is thinking...'; }
    fetch('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + storedToken },
      body: JSON.stringify({ model: model, messages: allMsgs, temperature: 0.7, max_tokens: 4096 })
    }).then(function(r) {
      if (!r.ok) {
        return r.json().then(function(errData) {
          throw new Error(errData.error || 'PSM-v1.0 error (HTTP ' + r.status + ')');
        });
      }
      return r.json();
    }).then(function(data) {
      var choice = data.choices && data.choices[0];
      var reply = choice && choice.message ? choice.message.content : (data.error || 'No response received.');
      handleReply(reply, null);
    }).catch(function(e) {
      removeThinking();
      addMessage('PSM-v1.0(PrysmisAI): ' + (e.message || String(e)), false, null);
    });
    return;
  }

  var fetchUrl = '/v1/chat/completions';
  var fetchHeaders = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + storedToken };
  if (model === 'manus-1.6-lite') {
    fetchHeaders['X-Manus-Key'] = localStorage.getItem('manus_api_key');
  }

  fetch(fetchUrl, {
    method: 'POST',
    headers: fetchHeaders,
    body: JSON.stringify({ model: model, messages: allMsgs, temperature: 0.7, max_tokens: 4096 })
  }).then(function(r) {
    return r.json().then(function(data) {
      if (!r.ok) {
        if (model === 'manus-1.6-lite' && (r.status === 401 || r.status === 403 || (data.error && data.error.includes('key')))) {
          manusKeyNotification.style.display = 'block';
        }
        if (data.groqQuotaExhausted || r.status === 402 ||
            /quota|exhausted|rate.?limit|invalid.?api.?key|expired/i.test(data.error || '')) {
          showGroqQuotaBanner();
        }
        if (data.premiumRequired) {
          if (premiumModal) premiumModal.style.display = 'flex';
          removeThinking();
          return;
        }
        throw new Error(data.error || 'API error (HTTP ' + r.status + ')');
      }
      return data;
    });
  }).then(function(data) {
    if (!data) return;
    var choice = data.choices && data.choices[0];
    var reply = choice && choice.message ? choice.message.content : (data.error || 'No response received.');
    var finishReason = choice ? choice.finish_reason : null;
    handleReply(reply, finishReason);
  }).catch(function(e) { removeThinking(); addMessage(e.message || 'Connection error', false, null); });
}

function saveChat(firstMsg) {
  var title = firstMsg.substring(0, 38) + (firstMsg.length > 38 ? '...' : '');
  fetch('/chats?token=' + encodeURIComponent(storedToken), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title, messages: currentMessages })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.success && data.chat) { activeChatId = data.chat.id; renderHistoryItem(data.chat); }
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
      if (data.success) { itemEl.remove(); if (activeChatId === id) { activeChatId = null; currentMessages = []; } }
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

sendBtn.addEventListener('click', doSend);
inputEl.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } });
inputEl.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 140) + 'px'; });

function usePreset(i) {
  var texts = ['Create me a Roblox map that is ', 'Make me a character animation script that ', 'Make me an advanced loading screen that '];
  inputEl.value = texts[i]; inputEl.focus();
  inputEl.style.height = 'auto'; inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
}

loadChatHistory();
