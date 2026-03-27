var storedUser = localStorage.getItem("user");
var storedToken = localStorage.getItem("token");
var storedIsAdmin = localStorage.getItem("isAdmin") === "true";

if (!storedUser || !storedToken) {
  location.href = "/accountauth/index.html";
}

if (storedIsAdmin && window.location.pathname !== "/adminpanel") {
  fetch("/me", { headers: { "Authorization": "Bearer " + storedToken } })
    .then(function(r) { return r.json(); })
    .then(function(d) { if (d.isAdmin) location.href = "/adminpanel"; })
    .catch(function() {});
}

var chatArea = document.getElementById("chatArea");
var inputEl = document.getElementById("input");
var sendBtn = document.getElementById("sendBtn");
var modelSelect = document.getElementById("modelSelect");
var manusKeyInputWrap = document.getElementById("manusKeyInputWrap");
var manusApiKeyInput = document.getElementById("manusApiKey");
var saveManusKeyBtn = document.getElementById("saveManusKeyBtn");
var manusKeyNotification = document.getElementById("manusKeyNotification");
var userNameEl = document.getElementById("userName");

userNameEl.textContent = storedUser || "User";

var currentMessages = [];
var userHasPremium = localStorage.getItem("isPremium") === "true";

function getAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem("token");
  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }
  const manusKey = localStorage.getItem("manus_api_key");
  if (manusKey) {
    headers["X-Manus-Key"] = manusKey;
  }
  return headers;
}

fetch("/me", { headers: getAuthHeaders() })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.error) return;
    if (d.premium || d.isAdmin) {
      userHasPremium = true;
      localStorage.setItem("isPremium", "true");
      document.getElementById("checkpointRevertBtn").style.display = "flex";
      document.getElementById("viewStudioBtn").style.display = "flex";
      if (d.isAdmin) {
        document.getElementById("postAnnBtn").style.display = "inline-flex";
        document.getElementById("clearChatBtn").style.display = "inline-flex";
      }
    }
    if (d.username) userNameEl.textContent = d.username;
  }).catch(function() {});

function showTab(tabId, clickedBtn) {
  document.querySelectorAll(".viewport").forEach(function(tab) {
    tab.style.display = "none";
  });
  document.querySelectorAll(".tab-link").forEach(function(btn) {
    btn.classList.remove("active");
  });
  const selectedTab = document.getElementById(tabId + "Tab");
  if (selectedTab) {
    selectedTab.style.display = "flex";
  }
  if (clickedBtn) {
    clickedBtn.classList.add("active");
  }
  if (tabId === "projects") loadProjects();
  if (tabId === "commchat") loadCommChat();
  if (tabId === "announcements") loadAnnouncements();
}

document.querySelectorAll(".tab-link").forEach(function(btn) {
  btn.addEventListener("click", function() { showTab(btn.dataset.tab, btn); });
});

modelSelect.addEventListener("change", function() {
  manusKeyInputWrap.style.display = this.value === "manus-1.6-lite" ? "block" : "none";
  const opt = this.options[this.selectedIndex];
  if (opt.dataset.premium === "true" && !userHasPremium) {
    document.getElementById("premiumModal").style.display = "flex";
    this.value = "psm-v1.0";
  }
});

saveManusKeyBtn.addEventListener("click", function() {
  const key = manusApiKeyInput.value.trim();
  if (key) {
    localStorage.setItem("manus_api_key", key);
    manusKeyNotification.style.display = "none";
    alert("Manus API Key saved.");
  } else {
    alert("Please enter a valid Manus API key.");
  }
});

function doSend() {
  const text = inputEl.value.trim();
  if (!text) return;
  const model = modelSelect.value;
  currentMessages.push({ role: "user", content: text });
  inputEl.value = "";
  renderMessages();

  fetch("/v1/chat/completions", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ model: model, messages: currentMessages, temperature: 0.7, max_tokens: 4096 })
  })
  .then(function(res) {
    if (res.status === 401) {
      location.href = "/accountauth/index.html";
      return;
    }
    if (res.status === 400) {
        return res.json().then(err => {
            if (err.error === "Manus API key required") {
                manusKeyNotification.textContent = "Manus API key is required for this model.";
                manusKeyNotification.style.display = "block";
            }
            throw new Error(err.error);
        });
    }
    return res.json();
  })
  .then(function(data) {
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const aiMsg = data.choices[0].message.content;
      currentMessages.push({ role: "assistant", content: aiMsg });
      renderMessages();
    } else if (data.error) {
        if (data.error.includes("Manus API error")) {
            manusKeyNotification.textContent = "Manus API key has ended generate a new one.";
            manusKeyNotification.style.display = "block";
        }
    }
  })
  .catch(function(err) {
    console.error("Chat API error:", err);
  });
}

sendBtn.addEventListener("click", doSend);
inputEl.addEventListener("keydown", function(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    doSend();
  }
});

function renderMessages() {
  chatArea.innerHTML = "";
  if (currentMessages.length === 0) {
    chatArea.innerHTML = `<div id="presets" class="presets-wrap">
      <h1 class="intro">What are we building today?</h1>
      <p class="intro-sub">Describe your idea or pick a starting point below</p>
      <div class="preset-grid">
        <div class="preset-card" onclick="usePreset(0)">
          <span class="preset-label">Create Map</span>
          <p>Generate custom Roblox environments with terrain and props</p>
        </div>
        <div class="preset-card" onclick="usePreset(1)">
          <span class="preset-label">Animate Character</span>
          <p>Advanced movement rigs and animation scripts</p>
        </div>
        <div class="preset-card" onclick="usePreset(2)">
          <span class="preset-label">Loading Screen</span>
          <p>Build a polished UI startup flow for your game</p>
        </div>
      </div>
    </div>`;
    return;
  }
  currentMessages.forEach(function(msg) {
    const msgEl = document.createElement("div");
    msgEl.className = "message " + msg.role;
    msgEl.innerHTML = msg.content.replace(/\n/g, "<br>");
    chatArea.appendChild(msgEl);
  });
  chatArea.scrollTop = chatArea.scrollHeight;
}

function usePreset(idx) {
  const presets = [
    "Create a detailed Roblox map with a forest theme, including terrain and props.",
    "Generate an advanced character animation script for a Roblox character.",
    "Build a polished loading screen UI for a Roblox game."
  ];
  inputEl.value = presets[idx];
  doSend();
}

document.getElementById("logoutBtn").addEventListener("click", function() {
  fetch("/logout", { method: "POST", headers: getAuthHeaders() }).catch(() => {});
  localStorage.clear();
  location.href = "/accountauth/index.html";
});

document.getElementById("newChatBtn").addEventListener("click", function() {
  currentMessages = [];
  renderMessages();
});

document.getElementById("settingsBtn").addEventListener("click", function() {
  document.getElementById("settingsModal").style.display = "flex";
  document.getElementById("settingsUsernameInput").value = storedUser;
  loadApiKeys();
});

document.getElementById("settingsClose").addEventListener("click", () => document.getElementById("settingsModal").style.display = "none");
document.getElementById("settingsClose2").addEventListener("click", () => document.getElementById("settingsModal").style.display = "none");
document.getElementById("settingsCloseAI").addEventListener("click", () => document.getElementById("settingsModal").style.display = "none");

function switchSettingsTab(tab) {
  document.querySelectorAll(".settings-page").forEach(p => p.style.display = "none");
  document.querySelectorAll(".settings-nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("settingsPage" + tab.charAt(0).toUpperCase() + tab.slice(1)).style.display = "block";
  document.getElementById("settingsNav" + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add("active");
}

document.getElementById("settingsSaveBtn").addEventListener("click", function() {
  const newName = document.getElementById("settingsUsernameInput").value.trim();
  if (!newName) return;
  fetch("/me", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ username: newName })
  }).then(r => r.json()).then(d => {
    if (d.success) {
      localStorage.setItem("user", newName);
      storedUser = newName;
      userNameEl.textContent = newName;
      alert("Settings saved.");
    } else {
      alert(d.error || "Failed to save.");
    }
  });
});

document.getElementById("generateTokenBtn").addEventListener("click", function() {
  fetch("/account/generate-prysmisai-key", { method: "POST", headers: getAuthHeaders() })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        document.getElementById("tokenNotif").style.display = "flex";
        document.getElementById("tokenNotifInput").value = d.apiKey;
      } else {
        alert(d.error || "Failed to generate token.");
      }
    });
});

document.getElementById("tokenNotifClose").addEventListener("click", () => document.getElementById("tokenNotif").style.display = "none");
document.getElementById("tokenNotifCopy").addEventListener("click", function() {
  navigator.clipboard.writeText(document.getElementById("tokenNotifInput").value);
  this.textContent = "Copied!";
  setTimeout(() => this.textContent = "Copy Token", 2000);
});

document.getElementById("tokenNotifHide").addEventListener("click", function() {
  const input = document.getElementById("tokenNotifInput");
  if (input.type === "password") {
    input.type = "text";
    this.textContent = "Hide";
  } else {
    input.type = "password";
    this.textContent = "Show";
  }
});

document.getElementById("connectBtn").addEventListener("click", function() {
  switchSettingsTab("studio");
  document.getElementById("settingsModal").style.display = "flex";
});

document.getElementById("premiumModalClose").addEventListener("click", () => document.getElementById("premiumModal").style.display = "none");

function loadProjects() {
  fetch("/projects").then(r => r.json()).then(data => {
    const list = document.getElementById("projectsList");
    list.innerHTML = data.map(p => `
      <div class="project-card">
        <h3>${p.title}</h3>
        <p>${p.description}</p>
        <div class="project-meta">By ${p.author}</div>
      </div>
    `).join("");
  });
}

function openModal() { document.getElementById("addGameModal").style.display = "flex"; }
function closeModal() { document.getElementById("addGameModal").style.display = "none"; }

document.getElementById("postGameBtn").addEventListener("click", function() {
  const title = document.getElementById("gameTitle").value;
  const description = document.getElementById("gameAbout").value;
  fetch("/projects", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ title, description })
  }).then(r => r.json()).then(d => {
    if (d.success) {
      closeModal();
      loadProjects();
    }
  });
});

function loadCommChat() {
  fetch("/community/chat").then(r => r.json()).then(data => {
    const area = document.getElementById("commchatMessages");
    area.innerHTML = data.map(m => `
      <div class="comm-msg">
        <span class="comm-author">${m.author}${m.isAdmin ? ' (Admin)' : ''}:</span>
        <span class="comm-text">${m.text}</span>
      </div>
    `).join("");
    area.scrollTop = area.scrollHeight;
  });
}

document.getElementById("commchatSend").addEventListener("click", function() {
  const text = document.getElementById("commchatInput").value.trim();
  if (!text) return;
  fetch("/community/chat", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ text })
  }).then(() => {
    document.getElementById("commchatInput").value = "";
    loadCommChat();
  });
});

function loadAnnouncements() {
  fetch("/announcements").then(r => r.json()).then(data => {
    const list = document.getElementById("annList");
    list.innerHTML = data.map(a => `
      <div class="ann-card">
        <div class="ann-card-title">${a.title}</div>
        <div class="ann-card-desc">${a.description}</div>
        <div class="ann-card-date">${new Date(a.ts).toLocaleDateString()}</div>
      </div>
    `).join("");
  });
}

document.getElementById("postAnnBtn").addEventListener("click", () => document.getElementById("postAnnModal").style.display = "flex");
function closePostAnn() { document.getElementById("postAnnModal").style.display = "none"; }

document.getElementById("annSubmitBtn").addEventListener("click", function() {
  const title = document.getElementById("annTitleInput").value;
  const description = document.getElementById("annDescInput").value;
  fetch("/announcements", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ title, description })
  }).then(() => {
    closePostAnn();
    loadAnnouncements();
  });
});

function loadApiKeys() {
  fetch("/account/prysmisai-keys", { headers: getAuthHeaders() })
    .then(r => r.json())
    .then(d => {
      const stack = document.getElementById("settingsApiKeysStack");
      stack.innerHTML = d.keys.map(k => `
        <div class="api-key-item">
          <code>${k.key.substring(0, 8)}...</code>
          <span>${new Date(k.created).toLocaleDateString()}</span>
        </div>
      `).join("");
      document.getElementById("settingsApiCount").textContent = d.generationsLeft;
      document.getElementById("settingsApiCountHint").style.display = "block";
    });
}

document.getElementById("settingsGenerateApiBtn").addEventListener("click", function() {
  fetch("/account/generate-prysmisai-key", { method: "POST", headers: getAuthHeaders() })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        loadApiKeys();
        document.getElementById("settingsApiResult").style.display = "block";
        document.getElementById("settingsApiKeyDisplay").value = d.apiKey;
      } else {
        alert(d.error);
      }
    });
});

document.getElementById("settingsShowApiKey").addEventListener("click", function() {
  const input = document.getElementById("settingsApiKeyDisplay");
  input.type = input.type === "password" ? "text" : "password";
  this.textContent = input.type === "password" ? "Unhide" : "Hide";
});

document.getElementById("settingsCopyApiKey").addEventListener("click", function() {
  navigator.clipboard.writeText(document.getElementById("settingsApiKeyDisplay").value);
  this.textContent = "Copied";
  setTimeout(() => this.textContent = "Copy", 2000);
});

document.getElementById("attachBtn").addEventListener("click", () => document.getElementById("fileInput").click());

function toggleExplorer() {
  const exp = document.getElementById("explorer");
  exp.classList.toggle("open");
}

showTab("chat");
if (localStorage.getItem("manus_api_key")) {
  manusApiKeyInput.value = localStorage.getItem("manus_api_key");
}
manusKeyInputWrap.style.display = modelSelect.value === "manus-1.6-lite" ? "block" : "none";
