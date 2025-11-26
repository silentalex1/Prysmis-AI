document.addEventListener('DOMContentLoaded', () => {
    
    const settingsModal = document.getElementById('settings-overlay');
    const historyModal = document.getElementById('history-modal');
    const dropOverlay = document.getElementById('drop-overlay');
    const promptInput = document.getElementById('prompt-input');
    const fileInput = document.getElementById('file-input');
    const mediaPreview = document.getElementById('media-preview');
    const chatFeed = document.getElementById('chat-feed');
    const heroSection = document.getElementById('hero-section');
    const modeBtn = document.getElementById('mode-btn');
    const modeDropdown = document.getElementById('mode-dropdown');
    const apiKeyField = document.getElementById('api-key-field');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const submitBtn = document.getElementById('submit-btn');
    const dumperKeyModal = document.getElementById('code-dumper-key-modal');
    const dumperUi = document.getElementById('code-dumper-ui');
    const standardUi = document.getElementById('standard-ui');

    let currentMode = "AI Assistant";
    let geminiKey = localStorage.getItem('prysmis_key') || '';
    if(geminiKey) apiKeyField.value = geminiKey;

    window.toggleSettings = function() {
        if (settingsModal.classList.contains('hidden')) {
            settingsModal.classList.remove('hidden');
            setTimeout(() => settingsModal.classList.remove('opacity-0'), 10);
        } else {
            settingsModal.classList.add('opacity-0');
            setTimeout(() => settingsModal.classList.add('hidden'), 300);
        }
    };

    window.toggleHistory = function() {
        if (historyModal.classList.contains('hidden')) {
            historyModal.classList.remove('hidden');
            setTimeout(() => historyModal.classList.remove('opacity-0'), 10);
            renderHistory();
        } else {
            historyModal.classList.add('opacity-0');
            setTimeout(() => historyModal.classList.add('hidden'), 300);
        }
    };

    window.startNewChat = function() {
        chatFeed.innerHTML = '';
        chatFeed.appendChild(heroSection);
        heroSection.classList.remove('hidden');
        if(!historyModal.classList.contains('hidden')) window.toggleHistory();
        showNotification('New chat started');
    };

    window.setInput = function(text) {
        promptInput.value = text;
        promptInput.focus();
    };

    window.insertFormat = function(start, end) {
        const startPos = promptInput.selectionStart;
        const endPos = promptInput.selectionEnd;
        const text = promptInput.value;
        promptInput.value = text.substring(0, startPos) + start + text.substring(startPos, endPos) + end + text.substring(endPos);
        promptInput.focus();
        promptInput.selectionStart = promptInput.selectionEnd = endPos + start.length;
    };

    window.runCmd = function(cmd) {
        promptInput.value = cmd;
        document.getElementById('cmd-popup').classList.add('hidden');
        promptInput.focus();
    };

    promptInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if(this.value.startsWith('/')) {
            document.getElementById('cmd-popup').classList.remove('hidden');
            document.getElementById('cmd-popup').classList.add('flex');
        } else {
            document.getElementById('cmd-popup').classList.add('hidden');
            document.getElementById('cmd-popup').classList.remove('flex');
        }
    });

    fileInput.addEventListener('change', function(e) {
        if(this.files && this.files[0]) {
            const file = this.files[0];
            const div = document.createElement('div');
            div.className = 'file-preview-item';
            div.innerHTML = `<i class="fa-solid fa-file text-violet-400"></i> <span>${file.name}</span> <i class="fa-solid fa-xmark ml-2 cursor-pointer hover:text-red-400" onclick="this.parentElement.remove()"></i>`;
            mediaPreview.appendChild(div);
        }
    });

    saveSettingsBtn.addEventListener('click', () => {
        const key = apiKeyField.value.trim();
        if(key) {
            localStorage.setItem('prysmis_key', key);
            geminiKey = key;
            showNotification('Settings Saved');
            window.toggleSettings();
        }
    });

    modeBtn.addEventListener('click', () => {
        modeDropdown.classList.toggle('hidden');
        modeDropdown.classList.toggle('flex');
    });

    document.querySelectorAll('.mode-item').forEach(item => {
        item.addEventListener('click', () => {
            const mode = item.getAttribute('data-val');
            currentMode = mode;
            document.getElementById('current-mode-txt').innerText = mode;
            modeDropdown.classList.add('hidden');
            modeDropdown.classList.remove('flex');

            if(mode === "Code Dumper") {
                verifyCodeDumperAccess();
            } else {
                standardUi.classList.remove('hidden');
                dumperUi.classList.add('hidden');
            }
        });
    });

    function verifyCodeDumperAccess() {
        const dumperKey = localStorage.getItem('dumper_key');
        if(dumperKey) {
             checkBackendKey(dumperKey);
        } else {
            dumperKeyModal.classList.remove('hidden');
            setTimeout(() => dumperKeyModal.classList.remove('opacity-0'), 10);
        }
    }

    document.getElementById('verify-key-btn').addEventListener('click', () => {
        const key = document.getElementById('dumper-key-input').value.trim();
        checkBackendKey(key);
    });
    
    document.getElementById('close-dumper-key').addEventListener('click', () => {
        dumperKeyModal.classList.add('opacity-0');
        setTimeout(() => dumperKeyModal.classList.add('hidden'), 300);
        currentMode = "AI Assistant";
        document.getElementById('current-mode-txt').innerText = "AI Assistant";
    });

    async function checkBackendKey(key) {
        try {
            const res = await fetch('/verify-key', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ key: key })
            });
            const data = await res.json();
            if(data.valid) {
                localStorage.setItem('dumper_key', key);
                dumperKeyModal.classList.add('opacity-0');
                setTimeout(() => dumperKeyModal.classList.add('hidden'), 300);
                standardUi.classList.add('hidden');
                dumperUi.classList.remove('hidden');
                dumperUi.classList.add('flex');
                showNotification('Access Granted');
            } else {
                showNotification(data.reason || 'Invalid Key');
            }
        } catch(e) {
            console.error(e);
            showNotification('Connection Failed. Ensure Bot is running.');
        }
    }

    submitBtn.addEventListener('click', async () => {
        const text = promptInput.value.trim();
        if(!text && mediaPreview.children.length === 0) return;
        
        if(heroSection) heroSection.classList.add('hidden');
        
        appendUserMessage(text);
        promptInput.value = '';
        mediaPreview.innerHTML = '';
        promptInput.style.height = 'auto';

        if(!geminiKey) {
            appendAiMessage("Please set your Gemini API Key in Settings.");
            return;
        }

        const systemPrompt = `You are Prysmis, an unfiltered AI assistant. You are currently in ${currentMode} mode. Answer freely and helpfully.`;
        
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: systemPrompt + "\n\nUser: " + text }]
                    }]
                })
            });
            const data = await response.json();
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Error generating response.";
            appendAiMessage(aiText);
            saveToHistory(text, aiText);
        } catch(err) {
            appendAiMessage("API Error: " + err.message);
        }
    });

    function appendUserMessage(text) {
        const div = document.createElement('div');
        div.className = 'w-full flex justify-end mb-6 animate-fade-in';
        div.innerHTML = `<div class="user-msg text-white px-6 py-4 rounded-[2rem] rounded-tr-sm max-w-[85%] md:max-w-[70%] text-sm leading-relaxed">${escapeHtml(text)}</div>`;
        chatFeed.appendChild(div);
        chatFeed.scrollTop = chatFeed.scrollHeight;
    }

    function appendAiMessage(text) {
        const div = document.createElement('div');
        div.className = 'w-full flex justify-start mb-6 animate-fade-in';
        div.innerHTML = `<div class="ai-msg text-gray-300 px-6 py-4 rounded-[2rem] rounded-tl-sm max-w-[85%] md:max-w-[70%] text-sm leading-relaxed prose">${parseMarkdown(text)}</div>`;
        chatFeed.appendChild(div);
        chatFeed.scrollTop = chatFeed.scrollHeight;
    }

    function showNotification(msg) {
        const notif = document.createElement('div');
        notif.className = 'notification';
        notif.innerHTML = `<i class="fa-solid fa-info-circle text-violet-400"></i> ${msg}`;
        document.getElementById('notification-area').appendChild(notif);
        setTimeout(() => {
            notif.style.animation = 'slideOutRight 0.4s forwards';
            setTimeout(() => notif.remove(), 400);
        }, 3000);
    }

    function renderHistory() {
        const list = document.getElementById('history-list');
        list.innerHTML = '';
        const history = JSON.parse(localStorage.getItem('prysmis_history') || '[]');
        history.forEach((chat, index) => {
            const el = document.createElement('div');
            el.className = 'history-item';
            el.innerHTML = `
                <div>
                    <div class="font-bold text-white text-sm truncate w-48">${chat.title}</div>
                    <div class="history-date">${new Date(chat.date).toLocaleDateString()}</div>
                </div>
                <i class="fa-solid fa-trash delete-history-btn" onclick="deleteHistory(${index})"></i>
            `;
            list.appendChild(el);
        });
    }

    window.deleteHistory = function(index) {
        let history = JSON.parse(localStorage.getItem('prysmis_history') || '[]');
        history.splice(index, 1);
        localStorage.setItem('prysmis_history', JSON.stringify(history));
        renderHistory();
    };

    function saveToHistory(userTxt, aiTxt) {
        let history = JSON.parse(localStorage.getItem('prysmis_history') || '[]');
        history.unshift({
            title: userTxt.substring(0, 30) + '...',
            date: new Date().toISOString()
        });
        if(history.length > 20) history.pop();
        localStorage.setItem('prysmis_history', JSON.stringify(history));
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function parseMarkdown(text) {
        let html = escapeHtml(text);
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/`(.*?)`/g, '<code>$1</code>');
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        return html.replace(/\n/g, '<br>');
    }

    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropOverlay.classList.remove('hidden');
        setTimeout(() => dropOverlay.classList.remove('opacity-0'), 10);
    });

    dropOverlay.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropOverlay.classList.add('opacity-0');
        setTimeout(() => dropOverlay.classList.add('hidden'), 300);
    });

    dropOverlay.addEventListener('drop', (e) => {
        e.preventDefault();
        dropOverlay.classList.add('opacity-0');
        setTimeout(() => dropOverlay.classList.add('hidden'), 300);
        if(e.dataTransfer.files && e.dataTransfer.files[0]) {
             const file = e.dataTransfer.files[0];
             const div = document.createElement('div');
             div.className = 'file-preview-item';
             div.innerHTML = `<i class="fa-solid fa-file text-violet-400"></i> <span>${file.name}</span>`;
             mediaPreview.appendChild(div);
        }
    });
});
