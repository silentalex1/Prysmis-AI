document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');

  function renderHome() {
    root.innerHTML = `
      <header>
        <div class="logo">
          <span>PrysmisAI</span>
        </div>
        <nav>
          <button onclick="window.location.href='/accountauth.html'">Get Started</button>
        </nav>
      </header>
      <section class="landing">
        <h1>PrysmisAI</h1>
        <p>Build Roblox games instantly with Claude Opus 4.6 • Gemini 3.2 • GPT-5.2</p>
        <button class="cta" onclick="window.location.href='/accountauth.html'">Start Building Now</button>
      </section>
      <section class="stats">
        <div class="stat"><h2 id="users">0+</h2><p>Builders</p></div>
        <div class="stat"><h2 id="active">0</h2><p>Active Now</p></div>
        <div class="stat"><h2 id="projects">0+</h2><p>Games Built</p></div>
      </section>
    `;

    let stats = { users: 0, active: 0, projects: 0 };
    setInterval(() => {
      stats.users += Math.floor(Math.random() * 4) + 1;
      stats.active = Math.floor(Math.random() * 20) + 10;
      stats.projects += Math.floor(Math.random() * 6) + 2;
      document.getElementById('users').textContent = stats.users + '+';
      document.getElementById('active').textContent = stats.active;
      document.getElementById('projects').textContent = stats.projects + '+';
    }, 3500);
  }

  function renderAuth() {
    root.innerHTML = `
      <header>
        <div class="logo"><span>PrysmisAI</span></div>
      </header>
      <div style="min-height:calc(100vh - 4rem);display:flex;align-items:center;justify-content:center;padding:2rem;">
        <div style="width:100%;max-width:28rem;background:#0f0f1a;border:1px solid #ffffff10;padding:3rem;border-radius:1.5rem;">
          <h2 style="text-align:center;font-size:2.2rem;margin-bottom:2rem;background:linear-gradient(90deg,#60a5fa,#a78bfa);background-clip:text;-webkit-background-clip:text;color:transparent;">Create Account</h2>
          <input type="text" placeholder="Username" style="width:100%;padding:1rem;margin-bottom:1rem;background:#1a1a2e;border:1px solid #ffffff10;border-radius:1rem;color:white;outline:none;font-size:1.1rem;">
          <input type="password" placeholder="Password" style="width:100%;padding:1rem;margin-bottom:1.5rem;background:#1a1a2e;border:1px solid #ffffff10;border-radius:1rem;color:white;outline:none;font-size:1.1rem;">
          <button onclick="window.location.href='/dashboard.html'" style="width:100%;padding:1.2rem;background:linear-gradient(90deg,#3b82f6,#8b5cf6);border:none;border-radius:999px;color:white;font-weight:700;font-size:1.2rem;cursor:pointer;">Create Account</button>
        </div>
      </div>
    `;
  }

  function renderDashboard() {
    root.innerHTML = `
      <header>
        <div class="logo"><span>PrysmisAI Builder</span></div>
        <div style="display:flex;gap:1rem;align-items:center;">
          <select id="modelSelect" style="padding:.6rem 1rem;background:#1a1a2e;border:1px solid #ffffff10;border-radius:999px;color:white;outline:none;cursor:pointer;">
            <option>Claude Opus 4.6</option>
            <option>Gemini 3.2</option>
            <option>ChatGPT 5.2</option>
          </select>
          <button style="padding:.6rem 1.4rem;background:#3b82f6;border:none;border-radius:999px;color:white;font-weight:600;cursor:pointer;">Connect Plugin</button>
        </div>
      </header>
      <div style="flex:1;display:flex;">
        <aside style="width:20rem;background:#0a0a0f;border-right:1px solid #ffffff10;padding:2rem;overflow-y:auto;">
          <h3 style="font-size:.9rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin-bottom:1rem;">Project Explorer</h3>
          <div style="font-size:.95rem;color:#94a3b8;">
            <div style="padding:.8rem;border-radius:.8rem;margin-bottom:.5rem;cursor:pointer">Workspace</div>
            <div style="padding:.8rem;border-radius:.8rem;margin-bottom:.5rem;cursor:pointer">Starter Scripts</div>
            <div style="padding:.8rem;border-radius:.8rem;cursor:pointer">ReplicatedStorage</div>
          </div>
        </aside>
        <main style="flex:1;display:flex;flex-direction:column;">
          <div id="chatArea" style="flex:1;padding:2rem;overflow-y:auto;display:flex;flex-direction:column;gap:1.5rem;"></div>
          <div style="padding:1.5rem;border-top:1px solid #ffffff10;background:#0a0a0f80;backdrop-filter:blur(12px);">
            <div style="max-width:56rem;margin:0 auto;position:relative;">
              <textarea id="input" placeholder="Ask Claude Opus 4.6, Gemini 3.2, or GPT-5.2 to build..." rows="2" style="width:100%;padding:1.2rem 5rem 1.2rem 1.5rem;background:#111;border:1px solid #ffffff10;border-radius:1.2rem;color:white;resize:none;outline:none;font-size:1.1rem;"></textarea>
              <button id="sendBtn" style="position:absolute;right:1rem;bottom:1rem;padding:.8rem 1.6rem;background:#3b82f6;border:none;border-radius:999px;color:white;font-weight:600;cursor:pointer;">Send</button>
            </div>
          </div>
        </main>
      </div>
    `;

    const chatArea = document.getElementById('chatArea');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    const modelSelect = document.getElementById('modelSelect');

    function addMessage(content, isUser) {
      const msg = document.createElement('div');
      msg.style.alignSelf = isUser ? 'flex-end' : 'flex-start';
      msg.style.maxWidth = '70%';
      msg.style.padding = '1rem 1.5rem';
      msg.style.borderRadius = '1.2rem';
      msg.style.background = isUser ? '#2563eb' : '#1a1a2e';
      msg.style.border = isUser ? 'none' : '1px solid #ffffff10';
      msg.textContent = content;
      chatArea.appendChild(msg);
      chatArea.scrollTop = chatArea.scrollHeight;
    }

    addMessage('PrysmisAI online. Ready to build.', false);

    sendBtn.onclick = async () => {
      if (!input.value.trim()) return;
      const text = input.value.trim();
      addMessage(text, true);
      input.value = '';

      try {
        const res = await fetch(`/v1/chat/completions?model=${encodeURIComponent(modelSelect.value.toLowerCase().replace(/\s+/g, '-'))}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: text }],
            temperature: 0.7,
            max_tokens: 2048
          })
        });
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content || 'No response';
        addMessage(reply, false);
      } catch (e) {
        addMessage('Error: ' + e.message, false);
      }
    };

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });
  }

  if (window.location.pathname === '/accountauth.html') {
    renderAuth();
  } else if (window.location.pathname === '/dashboard.html') {
    renderDashboard();
  } else {
    renderHome();
  }
});
