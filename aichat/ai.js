(function () {

  var BASE_URL = 'http://prysmisai.wtf';
  var apiKey = '';
  var history = [];
  var generating = false;
  var pendingImages = [];
  var currentCode = '';
  var pluginConnected = false;
  var commMessages = [];
  var games = [];
  var lastAiBubble = null;
  var lastAiText = '';
  var canContinue = false;
  var studioFiles = null;
  var studioToken = '';
  var studioStatusPoll = null;

  var SYSTEM_PROMPT_BASE = 'You are PrysmisAI, the ultimate Roblox game building and scripting assistant. You have deep expertise in: Lua/Luau scripting, Roblox Studio APIs, game design patterns, complex anti-cheat systems, DataStore v2, RemoteEvents/Functions, BindableEvents, OOP in Lua, metatables, coroutines, module systems, VFX with ParticleEmitters/Beams/Trails/Attachments, complex UI/ScreenGui/TweenService animations, terrain generation, procedural building, loading screens, cutscene systems, camera manipulation, Physics/BodyMovers, Humanoid/Character control, NPC AI, pathfinding, ragdoll systems, weapon systems, round systems, matchmaking, leaderboards, badges, game passes, proximity prompts, collision groups, raycasting, hit detection, replication boundaries, and all Roblox services. When writing code: always write it FULLY and COMPLETELY, never truncate or add placeholder comments like "-- add your code here". Use ```lua for all Lua/Roblox scripts. Think through architecture before writing. Provide clean, production-ready code. For complex requests break it into logical modules but write each one completely. When fixing bugs explain the root cause in one sentence then provide the full corrected code.';

  var SYSTEM_PROMPT_STUDIO = '\n\nThe user has connected their Roblox Studio plugin and shared their workspace files. You have full awareness of their game structure. When they ask you to create, modify, add, or change things in their game, you can issue commands by including a JSON command block in your response using this exact format:\n\n```command\n{"action":"create_script","name":"AntiCheat","scriptType":"Script","parent":"ServerScriptService","source":"-- full script here"}\n```\n\nAvailable actions:\n- create_part: {action, name, size:[x,y,z], position:[x,y,z], anchored:bool, color:"BrickColor name", material:"Grass"}\n- create_script: {action, name, scriptType:"Script|LocalScript|ModuleScript", parent:"ServiceName", source:"full lua code"}\n- create_model: {action, name, parent:"ServiceName"}\n- delete_instance: {action, path:"Workspace.ModelName.PartName"}\n- modify_property: {action, path:"Workspace.Part", property:"Anchored", value:true}\n- create_gui: {action, name, parent:"StarterGui", children:[{className, properties:{}, children:[]}]}\n- create_terrain: {action, center:[x,y,z], size:[x,y,z], material:"Grass"}\n- batch: {action:"batch", commands:[...array of commands...]}\n\nAlways issue the command block when the user asks you to create or modify something in their game. You can issue multiple command blocks for complex builds. Write the full source code in create_script commands — never truncate.';

  var CHECKLIST_TRIGGERS = [
    { pattern: /\b(script|scripts|scripting|luau?)\b/i, label: 'Scripting the logic' },
    { pattern: /\b(fix|fixing|debug|error|bug|issue)\b/i, label: 'Diagnosing the error' },
    { pattern: /\b(vfx|effect|particle|beam|trail|spark)\b/i, label: 'Building VFX' },
    { pattern: /\b(ui|gui|frame|button|screen|interface)\b/i, label: 'Designing the UI' },
    { pattern: /\b(map|terrain|build|model|world|environment)\b/i, label: 'Building the map' },
    { pattern: /\b(datastore|save|load|data|persist)\b/i, label: 'Setting up DataStore' },
    { pattern: /\b(remote|event|function|fire|replicate)\b/i, label: 'Wiring Remote Events' },
    { pattern: /\b(animat|tween|lerp|transition)\b/i, label: 'Adding animations' },
    { pattern: /\b(anti.?cheat|exploit|detect|sanity)\b/i, label: 'Building anti-cheat' },
    { pattern: /\b(loading|screen|spawn|cinematic)\b/i, label: 'Creating loading screen' },
    { pattern: /\b(game|round|match|system|mechanic)\b/i, label: 'Designing game system' },
    { pattern: /\b(code|write|create|make|generate|build)\b/i, label: 'Writing the code' },
    { pattern: /\b(explain|how|what|why|analyze)\b/i, label: 'Analyzing your request' }
  ];

  function getSession() {
    try { return JSON.parse(localStorage.getItem('prysmis_session') || 'null'); } catch(e) { return null; }
  }

  function loadKey() { return localStorage.getItem('prysmis_apikey') || ''; }
  function storeKey(k) { localStorage.setItem('prysmis_apikey', k); }

  function getStoredToken() {
    return localStorage.getItem('prysmis_studio_token') || '';
  }

  function generateToken() {
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var result = '';
    for (var i = 0; i < 26; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return result;
  }

  function getCommMessages() {
    try { return JSON.parse(localStorage.getItem('prysmis_comm_msgs') || '[]'); } catch(e) { return []; }
  }

  function saveCommMessages(msgs) { localStorage.setItem('prysmis_comm_msgs', JSON.stringify(msgs.slice(-200))); }

  function getGames() {
    try { return JSON.parse(localStorage.getItem('prysmis_games') || '[]'); } catch(e) { return []; }
  }

  function saveGames(g) { localStorage.setItem('prysmis_games', JSON.stringify(g)); }

  function getPfp() { return localStorage.getItem('prysmis_pfp') || ''; }
  function savePfp(d) { localStorage.setItem('prysmis_pfp', d); }

  function getSystemPrompt() {
    var prompt = SYSTEM_PROMPT_BASE;
    if (studioFiles && studioToken) {
      prompt += SYSTEM_PROMPT_STUDIO;
      var summary = buildFilesSummary(studioFiles);
      if (summary) {
        prompt += '\n\nCurrent studio workspace structure:\n' + summary;
      }
    }
    return prompt;
  }

  function buildFilesSummary(files) {
    var lines = [];
    function walk(node, depth) {
      if (!node) return;
      var indent = '  '.repeat(depth);
      var info = indent + node.className + ' "' + node.name + '"';
      if (node.properties) {
        var props = [];
        if (node.properties.Source) props.push('has_source(' + node.properties.Source.length + ' chars)');
        if (node.properties.Size) props.push('Size=' + node.properties.Size);
        if (node.properties.Position) props.push('Pos=' + node.properties.Position);
        if (node.properties.Disabled) props.push('Disabled=' + node.properties.Disabled);
        if (props.length) info += ' [' + props.join(', ') + ']';
      }
      lines.push(info);
      if (node.children && node.children.length > 0 && depth < 5) {
        node.children.forEach(function(c) { walk(c, depth + 1); });
      }
    }
    Object.keys(files).forEach(function(svcName) {
      walk(files[svcName], 0);
    });
    return lines.slice(0, 400).join('\n');
  }

  function showPremiumModal() {
    document.getElementById('premium-modal').style.display = 'flex';
  }

  window.closePremiumModal = function () {
    document.getElementById('premium-modal').style.display = 'none';
  };

  window.closePremiumIfBg = function (e) {
    if (e.target === document.getElementById('premium-modal')) closePremiumModal();
  };

  window.toggleStudioPanel = function () {
    var panel = document.getElementById('studio-panel');
    if (panel.classList.contains('closed')) {
      panel.classList.remove('closed');
    } else {
      panel.classList.add('closed');
    }
  };

  window.openPostGame = function () {
    document.getElementById('pg-name').value = '';
    document.getElementById('pg-desc').value = '';
    document.getElementById('pg-link').value = '';
    var alertEl = document.getElementById('post-game-alert');
    alertEl.className = 'post-game-alert';
    alertEl.textContent = '';
    document.getElementById('post-game-modal').style.display = 'flex';
  };

  window.closePostGame = function () {
    document.getElementById('post-game-modal').style.display = 'none';
  };

  window.closePostGameIfBg = function (e) {
    if (e.target === document.getElementById('post-game-modal')) closePostGame();
  };

  window.submitGame = function () {
    var name = document.getElementById('pg-name').value.trim();
    var desc = document.getElementById('pg-desc').value.trim();
    var link = document.getElementById('pg-link').value.trim();
    var alertEl = document.getElementById('post-game-alert');
    alertEl.className = 'post-game-alert';
    alertEl.textContent = '';

    if (!name) { alertEl.className = 'post-game-alert show'; alertEl.textContent = 'Please enter a game name.'; return; }
    if (!desc) { alertEl.className = 'post-game-alert show'; alertEl.textContent = 'Please describe your game.'; return; }
    if (!link) { alertEl.className = 'post-game-alert show'; alertEl.textContent = 'Please enter a game link.'; return; }

    var session = getSession();
    var game = { id: Date.now(), name: name, desc: desc, link: link, postedBy: session ? session.username : 'Guest' };
    games.push(game);
    saveGames(games);
    renderGames();
    closePostGame();
  };

  function renderGames() {
    var grid = document.getElementById('games-grid');
    var noGames = document.getElementById('no-games');
    var existing = grid.querySelectorAll('.game-card');
    existing.forEach(function(c) { grid.removeChild(c); });

    if (games.length === 0) {
      if (noGames) noGames.style.display = '';
      return;
    }
    if (noGames) noGames.style.display = 'none';

    var session = getSession();
    games.forEach(function(g) {
      var card = document.createElement('div');
      card.className = 'game-card';

      var title = document.createElement('div');
      title.className = 'game-card-title';
      title.textContent = g.name;

      var link = document.createElement('a');
      link.className = 'game-card-link';
      link.href = g.link;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = g.link;

      var desc = document.createElement('div');
      desc.className = 'game-card-desc';
      desc.textContent = g.desc;

      var poster = document.createElement('div');
      poster.className = 'game-card-poster';
      poster.textContent = 'by ' + g.postedBy;

      card.appendChild(title);
      card.appendChild(link);
      card.appendChild(desc);
      card.appendChild(poster);

      if (session && (session.username === g.postedBy || session.role === 'admin')) {
        var delBtn = document.createElement('button');
        delBtn.className = 'game-card-delete';
        delBtn.textContent = 'Delete';
        delBtn.onclick = (function(gid) {
          return function() {
            games = games.filter(function(x) { return x.id !== gid; });
            saveGames(games);
            renderGames();
          };
        })(g.id);
        card.appendChild(delBtn);
      }

      grid.appendChild(card);
    });
  }

  function buildChecklistForPrompt(text) {
    var items = [];
    var used = {};
    CHECKLIST_TRIGGERS.forEach(function(t) {
      if (t.pattern.test(text) && !used[t.label]) {
        items.push(t.label);
        used[t.label] = true;
      }
    });
    if (items.length === 0) items.push('Processing your request');
    items.push('Writing response');
    return items;
  }

  function showChecklist(items) {
    var bar = document.getElementById('checklist-bar');
    var container = document.getElementById('checklist-items');
    bar.style.display = 'flex';
    container.innerHTML = '';
    items.forEach(function(label, i) {
      var item = document.createElement('div');
      item.className = 'checklist-item pending';
      item.id = 'cl-item-' + i;
      var dot = document.createElement('span');
      dot.className = 'cl-dot';
      var text = document.createElement('span');
      text.className = 'cl-text';
      text.textContent = label;
      item.appendChild(dot);
      item.appendChild(text);
      container.appendChild(item);
    });
  }

  function tickChecklist(index) {
    var item = document.getElementById('cl-item-' + index);
    if (item) {
      item.classList.remove('pending');
      item.classList.add('done');
    }
  }

  function hideChecklist() {
    var bar = document.getElementById('checklist-bar');
    bar.style.display = 'none';
    document.getElementById('checklist-items').innerHTML = '';
  }

  function runChecklistAnimation(items, callback) {
    var i = 0;
    function tick() {
      if (i < items.length) {
        tickChecklist(i);
        i++;
        var delay = i < items.length - 1 ? 380 + Math.random() * 280 : 200;
        setTimeout(tick, delay);
      } else {
        if (callback) callback();
      }
    }
    setTimeout(tick, 200);
  }

  async function dispatchCommandsFromResponse(responseText) {
    if (!studioToken || !pluginConnected) return;
    var cmdRegex = /```command\n([\s\S]*?)```/g;
    var match;
    while ((match = cmdRegex.exec(responseText)) !== null) {
      var rawJson = match[1].trim();
      try {
        var cmd = JSON.parse(rawJson);
        await fetch(BASE_URL + '/api/studio/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: studioToken, command: cmd })
        });
      } catch(e) {}
    }
  }

  async function registerTokenWithServer(token) {
    var session = getSession();
    var username = session ? session.username : 'User';
    try {
      await fetch(BASE_URL + '/api/studio/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token, username: username })
      });
    } catch(e) {}
  }

  async function checkStudioStatus() {
    var token = getStoredToken();
    if (!token) return;
    try {
      var resp = await fetch(BASE_URL + '/api/studio/status?token=' + token);
      if (resp.ok) {
        var data = await resp.json();
        if (data.connected && !pluginConnected) {
          pluginConnected = true;
          studioToken = token;
          updatePluginStatusUI(true);
          loadStudioFilesFromServer(token);
        } else if (!data.connected && pluginConnected) {
          pluginConnected = false;
          studioToken = '';
          updatePluginStatusUI(false);
        }
      }
    } catch(e) {}
  }

  async function loadStudioFilesFromServer(token) {
    try {
      var resp = await fetch(BASE_URL + '/api/studio/files?token=' + token);
      if (resp.ok) {
        var data = await resp.json();
        if (data.files) {
          studioFiles = data.files;
          updateStudioFilesUI(data.files);
        }
      }
    } catch(e) {}
  }

  function updatePluginStatusUI(isConnected) {
    var dot = document.getElementById('status-dot');
    var label = document.getElementById('status-label');
    var pluginEl = document.getElementById('plugin-connected');
    var connectBtn = document.getElementById('connect-plugin-btn');

    if (isConnected) {
      if (pluginEl) pluginEl.style.display = 'flex';
      if (connectBtn) connectBtn.textContent = 'Disconnect';
      var studioPanel = document.getElementById('studio-panel');
      if (studioPanel) {
        var ncBlock = studioPanel.querySelector('.studio-not-connected');
        if (ncBlock) ncBlock.style.display = 'none';
        var connBlock = studioPanel.querySelector('.studio-connected');
        if (connBlock) connBlock.style.display = 'flex';
      }
    } else {
      if (pluginEl) pluginEl.style.display = 'none';
      if (connectBtn) connectBtn.textContent = 'Connect plugin';
    }
  }

  function updateStudioFilesUI(files) {
    var body = document.querySelector('.studio-panel-body');
    if (!body) return;
    body.innerHTML = '';

    var connected = document.createElement('div');
    connected.className = 'studio-connected';
    connected.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:100%';

    var statusRow = document.createElement('div');
    statusRow.style.cssText = 'display:flex;align-items:center;gap:8px';
    var dot = document.createElement('div');
    dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#4caf7d;box-shadow:0 0 6px #4caf7d';
    var statusText = document.createElement('span');
    statusText.style.cssText = 'font-size:13px;color:#4caf7d;font-weight:500';
    statusText.textContent = 'Studio Connected';
    statusRow.appendChild(dot);
    statusRow.appendChild(statusText);

    var fileCount = document.createElement('div');
    fileCount.style.cssText = 'font-size:12px;color:#9e9890';
    fileCount.textContent = Object.keys(files).length + ' services loaded';

    var fileList = document.createElement('div');
    fileList.style.cssText = 'display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto';

    Object.keys(files).forEach(function(svcName) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;font-size:11.5px;color:#5e5a55;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04)';
      var name = document.createElement('span');
      name.style.color = '#9e9890';
      name.textContent = svcName;
      var count = document.createElement('span');
      count.textContent = (files[svcName].children ? files[svcName].children.length : 0) + ' children';
      row.appendChild(name);
      row.appendChild(count);
      fileList.appendChild(row);
    });

    connected.appendChild(statusRow);
    connected.appendChild(fileCount);
    connected.appendChild(fileList);
    body.appendChild(connected);
  }

  function init() {
    apiKey = loadKey();
    if (apiKey) {
      showApp();
    } else {
      document.getElementById('key-gate').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
    }

    var pfp = getPfp();
    if (pfp) {
      var img = document.getElementById('pfp-img');
      if (img) { img.src = pfp; img.style.display = 'block'; document.getElementById('pfp-placeholder').style.display = 'none'; }
    }

    var session = getSession();
    var unEl = document.getElementById('settings-username');
    if (unEl) unEl.textContent = session ? session.username : 'Not logged in';

    var keyInp = document.getElementById('settings-key-input');
    if (keyInp) keyInp.value = apiKey;

    var tokenEl = document.getElementById('studio-token-display');
    if (tokenEl) {
      var existing = getStoredToken();
      tokenEl.value = existing ? existing : '';
      tokenEl.placeholder = existing ? 'Token saved' : 'Click Generate to create a token';
    }

    document.addEventListener('paste', function(e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          showPremiumModal();
          return;
        }
      }
    });

    document.addEventListener('dragover', function(e) { e.preventDefault(); });
    document.addEventListener('drop', function(e) {
      e.preventDefault();
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) showPremiumModal();
    });

    commMessages = getCommMessages();
    renderCommMessages();
    games = getGames();
    renderGames();

    studioStatusPoll = setInterval(checkStudioStatus, 5000);
  }

  function showApp() {
    document.getElementById('key-gate').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    var keyInp = document.getElementById('settings-key-input');
    if (keyInp) keyInp.value = apiKey;
  }

  window.saveApiKey = function () {
    var val = document.getElementById('api-key-input').value.trim();
    var alertEl = document.getElementById('kg-alert');
    if (!val || !val.startsWith('sk-ant-')) {
      alertEl.textContent = 'Please enter a valid Claude API key starting with sk-ant-';
      alertEl.classList.add('show');
      return;
    }
    alertEl.classList.remove('show');
    apiKey = val;
    storeKey(val);
    showApp();
  };

  window.updateApiKey = function () {
    var val = document.getElementById('settings-key-input').value.trim();
    var st = document.getElementById('settings-key-status');
    if (!val || !val.startsWith('sk-ant-')) {
      st.textContent = 'Key must start with sk-ant-';
      st.style.color = '#e05555';
      return;
    }
    apiKey = val;
    storeKey(val);
    st.textContent = 'Key saved.';
    st.style.color = '#4caf7d';
    setTimeout(function() { st.textContent = ''; }, 2000);
  };

  window.newChat = function () {
    history = [];
    pendingImages = [];
    lastAiBubble = null;
    lastAiText = '';
    canContinue = false;
    document.getElementById('continue-btn').style.display = 'none';
    document.getElementById('messages').innerHTML = '';
    document.getElementById('image-preview-row').innerHTML = '';
    document.getElementById('welcome').style.display = '';
    hideChecklist();
    closeCodePanel();
  };

  window.switchMainTab = function (tab, btn) {
    document.querySelectorAll('.nav-tab').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(function(el) { el.classList.remove('active'); });
    var target = document.getElementById('tab-' + tab);
    if (target) target.classList.add('active');
  };

  window.switchStab = function (btn, panel) {
    document.querySelectorAll('.stab').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    document.querySelectorAll('.spanel').forEach(function(p) { p.classList.remove('active'); });
    var target = document.getElementById('spanel-' + panel);
    if (target) target.classList.add('active');
  };

  window.connectPlugin = function () {
    if (pluginConnected) {
      pluginConnected = false;
      studioToken = '';
      studioFiles = null;
      document.getElementById('connect-plugin-btn').textContent = 'Connect plugin';
      document.getElementById('plugin-connected').style.display = 'none';
    } else {
      document.getElementById('connect-plugin-btn').textContent = 'Disconnect';
      document.getElementById('plugin-connected').style.display = 'flex';
      pluginConnected = true;
    }
  };

  window.chipSend = function (text) {
    var input = document.getElementById('user-input');
    input.value = text;
    input.focus();
    autoGrow(input);
  };

  window.handleKey = function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!generating) sendMessage();
    }
  };

  window.autoGrow = function (el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  window.handleImageAttach = function (e) {
    var file = e.target.files[0];
    if (file) addImagePreview(file);
    e.target.value = '';
  };

  function addImagePreview(file) {
    var reader = new FileReader();
    reader.onload = function(ev) {
      var dataUrl = ev.target.result;
      pendingImages.push({ dataUrl: dataUrl, type: file.type });
      var row = document.getElementById('image-preview-row');
      var wrap = document.createElement('div');
      wrap.className = 'img-thumb-wrap';
      var idx = pendingImages.length - 1;
      wrap.dataset.idx = idx;
      var img = document.createElement('img');
      img.className = 'img-thumb';
      img.src = dataUrl;
      var rm = document.createElement('button');
      rm.className = 'img-thumb-remove';
      rm.textContent = 'x';
      rm.onclick = function() {
        pendingImages.splice(parseInt(wrap.dataset.idx), 1);
        row.removeChild(wrap);
        refreshThumbIndexes();
      };
      wrap.appendChild(img);
      wrap.appendChild(rm);
      row.appendChild(wrap);
    };
    reader.readAsDataURL(file);
  }

  function refreshThumbIndexes() {
    document.querySelectorAll('.img-thumb-wrap').forEach(function(w, i) { w.dataset.idx = i; });
  }

  window.handlePfpUpload = function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var dataUrl = ev.target.result;
      savePfp(dataUrl);
      var img = document.getElementById('pfp-img');
      img.src = dataUrl;
      img.style.display = 'block';
      document.getElementById('pfp-placeholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
  };

  window.toggleTokenVisibility = function () {
    var inp = document.getElementById('studio-token-display');
    var btn = document.getElementById('token-show-btn');
    if (inp.type === 'password') {
      inp.type = 'text';
      btn.textContent = 'Hide';
    } else {
      inp.type = 'password';
      btn.textContent = 'Show';
    }
  };

  window.copyStudioToken = function () {
    var token = getStoredToken();
    if (token) navigator.clipboard.writeText(token);
  };

  window.regenToken = async function () {
    var t = generateToken();
    localStorage.setItem('prysmis_studio_token', t);
    studioToken = t;
    var inp = document.getElementById('studio-token-display');
    if (inp) { inp.value = t; inp.type = 'text'; }
    var btn = document.getElementById('token-show-btn');
    if (btn) btn.textContent = 'Hide';
    await registerTokenWithServer(t);
    var st = document.getElementById('settings-key-status');
    if (st) { st.textContent = 'Token generated and registered.'; st.style.color = '#4caf7d'; setTimeout(function() { st.textContent = ''; }, 3000); }
  };

  window.continueResponse = async function () {
    if (generating || !apiKey) return;
    document.getElementById('continue-btn').style.display = 'none';
    canContinue = false;
    history.push({ role: 'user', content: 'Continue exactly where you left off. Do not repeat anything, just continue writing from where it was cut off.' });
    await runAiRequest(null, true);
  };

  window.sendMessage = async function () {
    if (generating || !apiKey) return;
    var input = document.getElementById('user-input');
    var text = input.value.trim();
    var images = pendingImages.slice();
    if (!text && images.length === 0) return;

    document.getElementById('welcome').style.display = 'none';
    document.getElementById('continue-btn').style.display = 'none';
    canContinue = false;

    input.value = '';
    input.style.height = 'auto';
    pendingImages = [];
    document.getElementById('image-preview-row').innerHTML = '';

    appendUserMsg(text, images);

    var msgContent = [];
    images.forEach(function(img) {
      var b64 = img.dataUrl.split(',')[1];
      msgContent.push({ type: 'image', source: { type: 'base64', media_type: img.type, data: b64 } });
    });
    if (text) msgContent.push({ type: 'text', text: text });

    history.push({ role: 'user', content: msgContent.length === 1 && msgContent[0].type === 'text' ? text : msgContent });

    var checkItems = buildChecklistForPrompt(text);
    showChecklist(checkItems);

    await runAiRequest(checkItems, false);
  };

  async function runAiRequest(checkItems, isContinue) {
    generating = true;
    setStatus('busy');
    document.getElementById('send-btn').disabled = true;

    var aiRowBubble;
    if (isContinue && lastAiBubble) {
      aiRowBubble = lastAiBubble;
    } else {
      aiRowBubble = appendAiMsg(null);
      lastAiBubble = aiRowBubble;
      lastAiText = '';
    }

    if (checkItems) {
      runChecklistAnimation(checkItems, null);
    }

    try {
      var response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'messages-2023-12-15'
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 8192,
          stream: true,
          system: getSystemPrompt(),
          messages: history.slice(-24).map(function(m) {
            return { role: m.role, content: m.content };
          })
        })
      });

      if (response.status === 401) {
        disableKey('Your API key is invalid. Please update it in Settings.');
        aiRowBubble.innerHTML = '<span style="color:#e05555">API key is invalid. Open Settings and enter a valid key.</span>';
        generating = false; setStatus('error'); document.getElementById('send-btn').disabled = false;
        hideChecklist();
        return;
      }
      if (response.status === 429) {
        disableKey('Your API key has run out of credits. Please check your Anthropic account.');
        aiRowBubble.innerHTML = '<span style="color:#e05555">Your API key ran out of credits. Please add credits to your Anthropic account, then update your key in Settings.</span>';
        generating = false; setStatus('error'); document.getElementById('send-btn').disabled = false;
        hideChecklist();
        return;
      }
      if (!response.ok) {
        var errData = await response.json();
        aiRowBubble.innerHTML = '<span style="color:#e05555">Error: ' + esc(errData.error && errData.error.message ? errData.error.message : 'Request failed.') + '</span>';
        generating = false; setStatus('ready'); document.getElementById('send-btn').disabled = false;
        hideChecklist();
        return;
      }

      var reader2 = response.body.getReader();
      var decoder = new TextDecoder();
      var streamedText = isContinue ? lastAiText : '';
      var buffer = '';
      var firstChunk = true;

      aiRowBubble.innerHTML = '<div class="thinking"><span></span><span></span><span></span></div>';

      while (true) {
        var readResult = await reader2.read();
        if (readResult.done) break;
        buffer += decoder.decode(readResult.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop();

        for (var li = 0; li < lines.length; li++) {
          var line = lines[li].trim();
          if (!line || !line.startsWith('data:')) continue;
          var dataStr = line.slice(5).trim();
          if (dataStr === '[DONE]') break;
          try {
            var parsed = JSON.parse(dataStr);
            if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.type === 'text_delta') {
              if (firstChunk) {
                firstChunk = false;
                if (checkItems) {
                  for (var ci = 0; ci < checkItems.length; ci++) tickChecklist(ci);
                }
              }
              streamedText += parsed.delta.text;
              aiRowBubble.innerHTML = renderMarkdown(streamedText, true);
              scrollBottom();
            }
          } catch(parseErr) {}
        }
      }

      lastAiText = streamedText;

      if (streamedText) {
        if (isContinue) {
          history[history.length - 2] = { role: 'assistant', content: streamedText };
          history.splice(history.length - 1, 1);
        } else {
          history.push({ role: 'assistant', content: streamedText });
        }
      }

      if (streamedText && (streamedText.split('```').length % 2 === 0)) {
        canContinue = true;
        document.getElementById('continue-btn').style.display = 'flex';
      } else {
        canContinue = false;
        document.getElementById('continue-btn').style.display = 'none';
      }

      var codeMatch = streamedText.match(/```(?:lua|luau)?\n?([\s\S]*?)```/);
      if (codeMatch) {
        currentCode = codeMatch[1].trim();
        var langMatch = streamedText.match(/```([\w]*)/);
        var lang = langMatch ? (langMatch[1] || 'lua') : 'lua';
        if (lang !== 'command') openCodePanel(currentCode, lang);
      }

      await dispatchCommandsFromResponse(streamedText);

      hideChecklist();

    } catch (err) {
      aiRowBubble.innerHTML = '<span style="color:#e05555">Error: ' + esc(err.message || 'Unknown error.') + '</span>';
      hideChecklist();
    }

    generating = false;
    setStatus('ready');
    document.getElementById('send-btn').disabled = false;
    document.getElementById('user-input').focus();
    scrollBottom();
  }

  function disableKey(msg) {
    apiKey = '';
    storeKey('');
    var st = document.getElementById('settings-key-status');
    if (st) { st.textContent = msg; st.style.color = '#e05555'; }
    var inp = document.getElementById('settings-key-input');
    if (inp) { inp.value = ''; }
    openSettings();
  }

  function appendUserMsg(text, images) {
    var msgs = document.getElementById('messages');
    var row = document.createElement('div');
    row.className = 'msg-row user';
    var av = document.createElement('div');
    av.className = 'msg-avatar';
    var pfp = getPfp();
    if (pfp) {
      var pimg = document.createElement('img');
      pimg.src = pfp;
      av.appendChild(pimg);
    } else {
      av.textContent = 'U';
    }
    var body = document.createElement('div');
    body.className = 'msg-body';
    var label = document.createElement('div');
    label.className = 'msg-label';
    var session = getSession();
    label.textContent = session ? session.username : 'You';
    body.appendChild(label);
    images.forEach(function(img) {
      var imgEl = document.createElement('img');
      imgEl.className = 'msg-image';
      imgEl.src = img.dataUrl;
      body.appendChild(imgEl);
    });
    if (text) {
      var t = document.createElement('div');
      t.className = 'msg-text';
      t.textContent = text;
      body.appendChild(t);
    }
    row.appendChild(av);
    row.appendChild(body);
    msgs.appendChild(row);
    scrollBottom();
  }

  function appendAiMsg(text) {
    var msgs = document.getElementById('messages');
    var row = document.createElement('div');
    row.className = 'msg-row ai';
    var av = document.createElement('div');
    av.className = 'msg-avatar ai-avatar';
    av.textContent = 'P';
    var body = document.createElement('div');
    body.className = 'msg-body';
    var label = document.createElement('div');
    label.className = 'msg-label';
    label.textContent = 'Prysmis';
    var bubble = document.createElement('div');
    bubble.className = 'msg-text ai-msg-text';
    if (text === null) {
      bubble.innerHTML = '<div class="thinking"><span></span><span></span><span></span></div>';
    } else {
      bubble.innerHTML = renderMarkdown(text, true);
    }
    body.appendChild(label);
    body.appendChild(bubble);
    row.appendChild(av);
    row.appendChild(body);
    msgs.appendChild(row);
    scrollBottom();
    return bubble;
  }

  function setStatus(state) {
    var dot = document.getElementById('status-dot');
    var label = document.getElementById('status-label');
    dot.className = 'status-dot' + (state !== 'ready' ? ' ' + state : '');
    label.textContent = state === 'busy' ? 'Thinking' : state === 'error' ? 'Error' : 'Ready';
  }

  function scrollBottom() {
    var area = document.getElementById('chat-area');
    if (area) area.scrollTop = area.scrollHeight;
  }

  function openCodePanel(code, lang) {
    document.getElementById('cp-code').textContent = code;
    document.getElementById('cp-title').textContent = (lang && lang !== 'code' ? lang : 'lua');
    document.getElementById('code-panel').classList.remove('closed');
  }

  window.closeCodePanel = function () {
    document.getElementById('code-panel').classList.add('closed');
  };

  window.copyCode = function () {
    var code = document.getElementById('cp-code').textContent;
    navigator.clipboard.writeText(code).then(function() {
      var btns = document.querySelectorAll('.cp-btn');
      if (btns[0]) {
        var orig = btns[0].textContent;
        btns[0].textContent = 'Copied!';
        setTimeout(function() { btns[0].textContent = orig; }, 1500);
      }
    });
  };

  window.fixCode = async function () {
    var code = document.getElementById('cp-code').textContent;
    if (!code || !apiKey) return;
    var input = document.getElementById('user-input');
    input.value = 'Fix any bugs or errors in this code and return the fully corrected code:\n\n```lua\n' + code + '\n```';
    autoGrow(input);
    await sendMessage();
  };

  window.openSettings = function () {
    var modal = document.getElementById('settings-modal');
    if (!modal) return;
    var inp = document.getElementById('settings-key-input');
    if (inp) inp.value = apiKey;
    var session = getSession();
    var el = document.getElementById('settings-username');
    if (el) el.textContent = session ? session.username : 'Not logged in';
    var tokenEl = document.getElementById('studio-token-display');
    if (tokenEl) {
      var existing = getStoredToken();
      tokenEl.value = existing || '';
      tokenEl.placeholder = existing ? '' : 'Click Generate to create a token';
    }
    modal.style.display = 'flex';
  };

  window.closeSettings = function () {
    var modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
  };

  window.closeSettingsIfBg = function (e) {
    if (e.target === document.getElementById('settings-modal')) closeSettings();
  };

  window.logout = function () {
    localStorage.removeItem('prysmis_session');
    window.location.href = '/auth';
  };

  window.commHandleKey = function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCommMessage();
    }
  };

  window.sendCommMessage = function () {
    var input = document.getElementById('comm-input');
    var text = input.value.trim();
    if (!text) return;
    var session = getSession();
    var username = session ? session.username : 'Guest';
    var role = session ? session.role : 'user';
    var now = new Date();
    var time = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
    var msg = { id: Date.now(), username: username, role: role, text: text, time: time };
    commMessages.push(msg);
    saveCommMessages(commMessages);
    renderCommMessages();
    input.value = '';
    input.style.height = 'auto';
    var area = document.getElementById('comm-messages');
    if (area) area.scrollTop = area.scrollHeight;
  };

  function renderCommMessages() {
    var area = document.getElementById('comm-messages');
    if (!area) return;
    area.innerHTML = '';
    var session = getSession();
    commMessages.forEach(function(msg) {
      var div = document.createElement('div');
      div.className = 'comm-msg';
      var header = document.createElement('div');
      header.className = 'comm-msg-header';
      var uname = document.createElement('span');
      uname.className = 'comm-msg-user';
      uname.textContent = msg.username;
      header.appendChild(uname);
      if (msg.role === 'admin') {
        var badge = document.createElement('span');
        badge.className = 'comm-msg-admin';
        badge.textContent = 'ADMIN';
        header.appendChild(badge);
      }
      var timeEl = document.createElement('span');
      timeEl.className = 'comm-msg-time';
      timeEl.textContent = msg.time;
      header.appendChild(timeEl);
      var textEl = document.createElement('div');
      textEl.className = 'comm-msg-text';
      textEl.textContent = msg.text;
      var actions = document.createElement('div');
      actions.className = 'comm-msg-actions';
      var replyBtn = document.createElement('button');
      replyBtn.className = 'comm-msg-btn';
      replyBtn.textContent = 'Reply';
      replyBtn.onclick = function() {
        var inp = document.getElementById('comm-input');
        inp.value = '@' + msg.username + ' ';
        inp.focus();
      };
      actions.appendChild(replyBtn);
      if (session && (session.username === msg.username || session.role === 'admin')) {
        var editBtn = document.createElement('button');
        editBtn.className = 'comm-msg-btn';
        editBtn.textContent = 'Edit';
        editBtn.onclick = function() {
          var newText = prompt('Edit message:', msg.text);
          if (newText && newText.trim()) {
            msg.text = newText.trim();
            saveCommMessages(commMessages);
            renderCommMessages();
          }
        };
        var delBtn = document.createElement('button');
        delBtn.className = 'comm-msg-btn';
        delBtn.textContent = 'Delete';
        delBtn.onclick = function() {
          commMessages = commMessages.filter(function(m) { return m.id !== msg.id; });
          saveCommMessages(commMessages);
          renderCommMessages();
        };
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
      }
      div.appendChild(header);
      div.appendChild(textEl);
      div.appendChild(actions);
      area.appendChild(div);
    });
  }

  window.openInPanel = function (btn) {
    var pre = btn.closest('pre');
    if (!pre) return;
    var code = pre.querySelector('code');
    if (code) {
      currentCode = code.textContent;
      openCodePanel(currentCode, 'lua');
    }
  };

  window.copyInlineCode = function (btn) {
    var pre = btn.closest('pre');
    if (!pre) return;
    var code = pre.querySelector('code');
    if (!code) return;
    navigator.clipboard.writeText(code.textContent).then(function() {
      var orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(function() { btn.textContent = orig; }, 1400);
    });
  };

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderMarkdown(text, addOpenBtn) {
    var t = esc(text);

    t = t.replace(/```command\n?([\s\S]*?)```/g, function(_, json) {
      var decoded = json.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
      return '<div class="command-block"><div class="command-block-header"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>Studio Command</span></div><pre class="command-json"><code>' + esc(decoded.trim()) + '</code></pre></div>';
    });

    t = t.replace(/```([\w]*)\n?([\s\S]*?)```/g, function(_, lang, code) {
      var decoded = code.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
      var langLabel = lang || 'lua';
      var openBtn = addOpenBtn ? '<button class="pre-open-btn" onclick="openInPanel(this)">Open in panel</button>' : '';
      var copyBtn = '<button class="pre-copy-btn" onclick="copyInlineCode(this)">Copy code</button>';
      var header = '<div class="code-block-header"><span class="code-block-lang">' + esc(langLabel) + '</span><div class="code-block-actions">' + copyBtn + openBtn + '</div></div>';
      return '<pre class="code-block">' + header + '<code>' + esc(decoded.trim()) + '</code></pre>';
    });

    t = t.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '<em>$1</em>');
    t = t.replace(/^### (.+)$/gm, '<p class="md-h3">$1</p>');
    t = t.replace(/^## (.+)$/gm, '<p class="md-h2">$1</p>');
    t = t.replace(/^# (.+)$/gm, '<p class="md-h1">$1</p>');
    t = t.replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>');
    t = t.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, '<ul>$&</ul>');
    t = t.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    t = t.replace(/\n\n/g, '</p><p>');
    t = t.replace(/\n/g, '<br>');
    return '<p>' + t + '</p>';
  }

  init();
})();
