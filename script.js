document.addEventListener('DOMContentLoaded', () => {
    const els = {
        settingsTriggers: [document.getElementById('settings-trigger')],
        settingsOverlay: document.getElementById('settings-overlay'),
        settingsBox: document.getElementById('settings-box'),
        closeSettings: document.getElementById('close-settings'),
        saveSettings: document.getElementById('save-settings-btn'),
        apiKey: document.getElementById('api-key-field'),
        modeBtn: document.getElementById('mode-btn'),
        modeDrop: document.getElementById('mode-dropdown'),
        modeTxt: document.getElementById('current-mode-txt'),
        modeIcon: document.getElementById('mode-icon'),
        modeItems: document.querySelectorAll('.mode-item'),
        input: document.getElementById('prompt-input'),
        fileInput: document.getElementById('file-input'),
        mediaPreview: document.getElementById('media-preview'),
        cmdPopup: document.getElementById('cmd-popup'),
        submitBtn: document.getElementById('submit-btn'),
        chatFeed: document.getElementById('chat-feed'),
        heroSection: document.getElementById('hero-section'),
        flashOverlay: document.getElementById('flash-overlay'),
        historyModal: document.getElementById('history-modal'),
        historyTrigger: document.getElementById('history-trigger'),
        closeHistory: document.getElementById('close-history'),
        historyList: document.getElementById('history-list'),
        searchInput: document.getElementById('search-input'),
        newChatBtn: document.getElementById('new-chat-btn'),
        quickNewChatBtn: document.getElementById('quick-new-chat-btn'),
        dumperKeyModal: document.getElementById('code-dumper-key-modal'),
        closeDumperKey: document.getElementById('close-dumper-key'),
        dumperKeyInput: document.getElementById('dumper-key-input'),
        verifyKeyBtn: document.getElementById('verify-key-btn'),
        codeDumperUI: document.getElementById('code-dumper-ui'),
        standardUI: document.getElementById('standard-ui'),
        btnObfuscate: document.getElementById('btn-obfuscate'),
        btnDeobfuscate: document.getElementById('btn-deobfuscate'),
        terminalLog: document.getElementById('terminal-log'),
        terminalTime: document.getElementById('terminal-time'),
        getStartedBtn: document.getElementById('get-started-btn'),
        mobileMenuBtn: document.getElementById('mobile-menu-btn'),
        homeBtn: document.getElementById('home-btn'),
        sidebar: document.getElementById('sidebar'),
        mobileOverlay: document.getElementById('mobile-overlay'),
        fastSpeedToggle: document.getElementById('fast-speed-toggle'),
        textToolbar: document.getElementById('text-toolbar'),
        stopAiBtn: document.getElementById('stop-ai-btn'),
        notificationArea: document.getElementById('notification-area'),
        dumperUploadZone: document.getElementById('dumper-upload-zone'),
        dumperFileInput: document.getElementById('dumper-file-input'),
        dumperSkipBtn: document.getElementById('dumper-skip-btn'),
        dumperInputArea: document.getElementById('dumper-input-area'),
        dumperOutputArea: document.getElementById('dumper-output-area'),
        dumperAdviceArea: document.getElementById('dumper-advice-area'),
        dumperUploadState: document.getElementById('dumper-upload-state'),
        dumperEditorView: document.getElementById('dumper-editor-view'),
        dropOverlay: document.getElementById('drop-overlay')
    };

    let uploadedFile = { data: null, type: null, name: null };
    let chatHistory = JSON.parse(localStorage.getItem('prysmis_history')) || [];
    let currentChatId = null;
    let isCodeDumperUnlocked = false;
    let isRoleplayActive = false;
    let currentInterval = null;
    let stopGeneration = false;
    let abortController = null;
    
    const TARGET_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";
    const FALLBACK_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";
    const BOT_API_URL = "http://localhost:3000/verify-key";

    function loadKey() {
        const key = localStorage.getItem('prysmis_key');
        if(key && els.apiKey) els.apiKey.value = key;
        const fastSpeed = localStorage.getItem('prysmis_fast_speed');
        if(fastSpeed === 'true' && els.fastSpeedToggle) els.fastSpeedToggle.checked = true;
    }

    function saveChatToStorage() {
        localStorage.setItem('prysmis_history', JSON.stringify(chatHistory));
        renderHistory();
    }

    function renderHistory() {
        if(!els.historyList) return;
        els.historyList.innerHTML = '';
        const query = els.searchInput ? els.searchInput.value.toLowerCase() : '';
        const filtered = chatHistory.filter(c => c.title.toLowerCase().includes(query));
        
        filtered.forEach(chat => {
            const div = document.createElement('div');
            div.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
            div.innerHTML = `
                <div class="flex-1 overflow-hidden">
                    <div class="font-bold text-white text-sm mb-1 truncate">${chat.title}</div>
                    <div class="history-date">${new Date(chat.id).toLocaleDateString()}</div>
                </div>
                <button class="delete-history-btn"><i class="fa-solid fa-trash"></i></button>
            `;
            div.onclick = (e) => {
                loadChat(chat.id);
                toggleHistory(false);
                if(window.innerWidth < 768) toggleMobileMenu();
            };
            const delBtn = div.querySelector('.delete-history-btn');
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if(confirm("Delete this conversation?")) {
                    chatHistory = chatHistory.filter(c => c.id !== chat.id);
                    if(currentChatId === chat.id) startNewChat();
                    saveChatToStorage();
                }
            };
            els.historyList.appendChild(div);
        });
    }

    function loadChat(id) {
        const chat = chatHistory.find(c => c.id === id);
        if(!chat) return;
        currentChatId = id;
        els.heroSection.style.display = 'none';
        els.chatFeed.innerHTML = '';
        chat.messages.forEach((msg, index) => {
            appendMsg(msg.role, msg.text, msg.img, msg.edits, index);
        });
        renderHistory();
        switchToStandard();
    }

    function startNewChat() {
        currentChatId = null;
        els.chatFeed.innerHTML = '';
        els.chatFeed.appendChild(els.heroSection);
        els.heroSection.style.display = 'flex';
        toggleHistory(false);
        switchToStandard();
    }

    function appendMsg(role, text, img, edits = 0, index = -1) {
        const div = document.createElement('div');
        div.className = `flex w-full ${role === 'user' ? 'justify-end' : 'justify-start'} msg-anim mb-6 group relative`;
        
        let editLabel = edits > 0 ? `<span class="edited-label">edited x${edits}</span>` : '';
        let content = parseMD(text);
        if(img) content = `<div class="relative"><img src="${img}" class="max-w-[200px] rounded-lg mb-2 border border-white/20"></div>` + content;

        div.innerHTML = `
            <div class="flex flex-col ${role === 'user' ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[70%]">
                ${role === 'user' ? editLabel : ''}
                <div class="p-4 rounded-[20px] shadow-lg prose ${role === 'user' ? 'user-msg text-white rounded-br-none cursor-pointer' : 'ai-msg text-gray-200 rounded-bl-none'}">${content}</div>
            </div>
        `;
        
        if (role === 'user' && index !== -1) {
            div.querySelector('.user-msg').addEventListener('dblclick', () => handleEdit(index, text));
        }

        els.chatFeed.appendChild(div);
        els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
    }

    function handleEdit(index, oldText) {
        const newText = prompt("Edit your message:", oldText);
        if (newText !== null && newText !== oldText) {
            const chat = chatHistory.find(c => c.id === currentChatId);
            if (chat) {
                chat.messages[index].text = newText;
                chat.messages[index].edits = (chat.messages[index].edits || 0) + 1;
                if (chat.messages[index + 1] && chat.messages[index + 1].role === 'ai') {
                    chat.messages.splice(index + 1, 1);
                }
                chatHistory = chatHistory.filter(c => c.id !== currentChatId);
                chatHistory.unshift(chat); 
                saveChatToStorage();
                loadChat(currentChatId);
                const lastMsg = chat.messages[chat.messages.length - 1];
                if (lastMsg.role === 'user') {
                    handleSend(true); 
                }
            }
        }
    }

    function parseMD(text) {
        if (!text) return "";
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/~~(.*?)~~/g, '<del>$1</del>')
            .replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
            .replace(/\n/g, '<br>');

        html = html.replace(/```(\w+)?<br>([\s\S]*?)```/g, (match, lang, code) => {
            const cleanCode = code.replace(/<br>/g, '\n');
            return `<div class="code-block"><div class="code-header"><span>${lang || 'code'}</span><button class="copy-btn" onclick="window.copyCode(this)">Copy</button></div><pre><code class="language-${lang}">${cleanCode}</code></pre></div>`;
        });
        
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/^(\*|\+) (.*)/gm, '<ul><li>$2</li></ul>');
        return html;
    }

    function streamResponse(text) {
        if(stopGeneration) return;
        els.stopAiBtn.classList.remove('opacity-0', 'pointer-events-none');
        
        const div = document.createElement('div');
        div.className = `flex w-full justify-start msg-anim mb-6`;
        const bubble = document.createElement('div');
        bubble.className = "max-w-[90%] md:max-w-[75%] p-5 rounded-[20px] rounded-bl-none shadow-lg prose ai-msg text-gray-200";
        div.appendChild(bubble);
        els.chatFeed.appendChild(div);

        const chars = text.split('');
        let i = 0;
        let currentText = "";
        const isFast = els.fastSpeedToggle && els.fastSpeedToggle.checked;
        const delay = isFast ? 1 : 15;
        
        currentInterval = setInterval(() => {
            if(stopGeneration) {
                clearInterval(currentInterval);
                els.stopAiBtn.classList.add('opacity-0', 'pointer-events-none');
                stopGeneration = false;
                return;
            }
            if(i >= chars.length) {
                clearInterval(currentInterval);
                bubble.innerHTML = parseMD(text);
                els.stopAiBtn.classList.add('opacity-0', 'pointer-events-none');
                return;
            }
            currentText += chars[i];
            bubble.innerHTML = parseMD(currentText);
            els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
            i++;
        }, delay);
    }

    if(els.stopAiBtn) els.stopAiBtn.addEventListener('click', () => {
        stopGeneration = true;
        if(abortController) abortController.abort();
        if(currentInterval) clearInterval(currentInterval);
        els.stopAiBtn.classList.add('opacity-0', 'pointer-events-none');
    });

    function showNotification(msg) {
        const notif = document.createElement('div');
        notif.className = 'notification';
        notif.innerHTML = `<i class="fa-brands fa-discord text-[#5865F2] text-lg"></i> ${msg}`;
        els.notificationArea.appendChild(notif);
        setTimeout(() => {
            notif.style.animation = 'slideOutRight 0.3s forwards';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    function updateDropdownUI(val) {
        const iconMap = {
            'AI Assistant': 'fa-sparkles', 'Code Dumper': 'fa-terminal', 'Rizz tool': 'fa-heart',
            'Geometry': 'fa-shapes', 'English': 'fa-feather', 'Biology': 'fa-dna',
            'Physics': 'fa-atom', 'Chemistry': 'fa-flask', 'Coding': 'fa-code',
            'Debate': 'fa-gavel', 'Psychology': 'fa-brain', 'History': 'fa-landmark'
        };
        els.modeIcon.innerHTML = `<i class="fa-solid ${iconMap[val] || 'fa-sparkles'} text-violet-400"></i>`;
        els.modeTxt.innerText = val;
    }

    function toggleSettings(show) {
        if(show) {
            els.settingsOverlay.classList.remove('hidden');
            requestAnimationFrame(() => {
                els.settingsOverlay.classList.remove('opacity-0');
                els.settingsBox.classList.remove('scale-95');
                els.settingsBox.classList.add('scale-100');
            });
        } else {
            els.settingsOverlay.classList.add('opacity-0');
            els.settingsBox.classList.remove('scale-100');
            els.settingsBox.classList.add('scale-95');
            setTimeout(() => els.settingsOverlay.classList.add('hidden'), 300);
        }
    }

    function toggleHistory(show) {
        if(show) {
            els.historyModal.classList.remove('hidden');
            requestAnimationFrame(() => els.historyModal.classList.remove('opacity-0'));
            renderHistory();
        } else {
            els.historyModal.classList.add('opacity-0');
            setTimeout(() => els.historyModal.classList.add('hidden'), 300);
        }
    }

    function toggleDumperKey(show) {
        if(show) {
            els.dumperKeyModal.classList.remove('hidden');
            requestAnimationFrame(() => els.dumperKeyModal.classList.remove('opacity-0'));
        } else {
            els.dumperKeyModal.classList.add('opacity-0');
            setTimeout(() => els.dumperKeyModal.classList.add('hidden'), 300);
        }
    }

    function toggleMobileMenu() {
        if(els.sidebar.classList.contains('-translate-x-full')) {
            els.sidebar.classList.remove('-translate-x-full');
            els.mobileOverlay.classList.remove('hidden');
        } else {
            els.sidebar.classList.add('-translate-x-full');
            els.mobileOverlay.classList.add('hidden');
        }
    }

    function switchToStandard() {
        els.standardUI.classList.remove('hidden');
        els.codeDumperUI.classList.add('hidden');
        updateDropdownUI("AI Assistant");
    }

    function handleFileSelect(file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            uploadedFile = { data: ev.target.result.split(',')[1], type: file.type, name: file.name };
            let previewContent = file.type.startsWith('image') 
                ? `<img src="${ev.target.result}" class="w-full h-full object-cover">`
                : `<div class="flex items-center justify-center h-full bg-white/10 text-xs p-2 text-center">${file.name}</div>`;
                
            els.mediaPreview.innerHTML = `<div class="relative w-14 h-14 rounded-lg overflow-hidden border border-violet-500 shadow-lg group">${previewContent}<button class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white" onclick="window.clearMedia()"><i class="fa-solid fa-xmark"></i></button></div>`;
        };
        reader.readAsDataURL(file);
    }

    loadKey();
    renderHistory();

    window.setInput = (txt) => { els.input.value = txt; els.input.focus(); };

    window.runCmd = (cmd) => {
        if(cmd === '/clear') { startNewChat(); }
        else if(cmd === '/features') {
            const featureHTML = `<div style="font-family: 'Cinzel', serif; font-size: 1.1em; margin-bottom: 10px; color: #a78bfa;">PrysmisAI features -- still in beta</div><hr class="visual-line"><ul class="feature-list list-disc pl-5"><li>Scan Analysis: Say "Analysis or scan this file and ___"</li><li>YouTube analysis</li><li>Domain external viewer</li><li>Modes</li><li>Roleplay</li><li>Invisible tab</li></ul>`;
            const div = document.createElement('div');
            div.className = `flex w-full justify-start msg-anim mb-6`;
            div.innerHTML = `<div class="max-w-[85%] md:max-w-[70%] p-4 rounded-[20px] shadow-lg prose ai-msg text-gray-200 rounded-bl-none">${featureHTML}</div>`;
            els.chatFeed.appendChild(div);
            els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
            els.heroSection.style.display = 'none';
        } else if(cmd === '/roleplay') {
            isRoleplayActive = !isRoleplayActive;
            const status = isRoleplayActive ? "Activated" : "Deactivated";
            const boldText = `<strong style="color: #a78bfa;">Roleplay mode ${status}.</strong>`;
            appendMsg('ai', `${boldText} ${isRoleplayActive ? "What do you want me to be?" : "Back to normal."}`, null);
            els.heroSection.style.display = 'none';
        } else if(cmd === '/discord-invite') {
            navigator.clipboard.writeText("https://discord.gg/eKC5CgEZbT");
            showNotification("Discord server link copied onto your clipboard!");
        }
        els.cmdPopup.classList.add('hidden');
        els.cmdPopup.classList.remove('flex');
        els.input.value = '';
        els.input.focus();
    };

    window.insertFormat = (s, e) => {
        const start = els.input.selectionStart;
        const end = els.input.selectionEnd;
        const txt = els.input.value;
        els.input.value = txt.substring(0, start) + s + txt.substring(start, end) + e + txt.substring(end);
        els.input.focus();
        els.textToolbar.classList.add('hidden');
    };

    window.copyCode = (btn) => {
        navigator.clipboard.writeText(btn.parentElement.nextElementSibling.innerText);
        btn.innerText = "Copied!";
        setTimeout(() => btn.innerText = "Copy", 2000);
    };

    window.clearMedia = () => {
        uploadedFile = { data: null, type: null, name: null };
        els.mediaPreview.innerHTML = '';
        els.fileInput.value = '';
    };

    document.addEventListener('dragover', (e) => { e.preventDefault(); els.dropOverlay.classList.remove('hidden'); els.dropOverlay.classList.add('flex'); els.dropOverlay.classList.remove('opacity-0'); });
    els.dropOverlay.addEventListener('dragleave', (e) => { e.preventDefault(); els.dropOverlay.classList.add('opacity-0'); setTimeout(() => els.dropOverlay.classList.add('hidden'), 300); });
    els.dropOverlay.addEventListener('drop', (e) => {
        e.preventDefault();
        els.dropOverlay.classList.add('opacity-0');
        setTimeout(() => els.dropOverlay.classList.add('hidden'), 300);
        if(e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
    });

    els.input.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file') handleFileSelect(item.getAsFile());
        }
    });

    els.fileInput.addEventListener('change', (e) => { if(e.target.files[0]) handleFileSelect(e.target.files[0]); });

    document.addEventListener('selectionchange', () => {
        if (document.activeElement === els.input && els.input.selectionStart !== els.input.selectionEnd) {
            els.textToolbar.classList.remove('hidden');
        } else {
            els.textToolbar.classList.add('hidden');
        }
    });

    els.input.addEventListener('input', () => {
        els.input.style.height = 'auto';
        els.input.style.height = els.input.scrollHeight + 'px';
        if(els.input.value.trim().startsWith('/')) { els.cmdPopup.classList.remove('hidden'); els.cmdPopup.classList.add('flex'); } 
        else { els.cmdPopup.classList.add('hidden'); els.cmdPopup.classList.remove('flex'); }
    });

    els.input.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
        if(e.key === ' ' && (els.input.value.endsWith('*') || els.input.value.endsWith('+'))) {
             e.preventDefault(); els.input.value = els.input.value.slice(0, -1) + '• ';
        }
    });

    els.submitBtn.addEventListener('click', (e) => { e.preventDefault(); handleSend(); });
    
    if(els.quickNewChatBtn) els.quickNewChatBtn.addEventListener('click', startNewChat);
    els.newChatBtn.addEventListener('click', startNewChat);

    els.mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    els.mobileOverlay.addEventListener('click', toggleMobileMenu);

    els.historyTrigger.addEventListener('click', () => toggleHistory(true));
    els.closeHistory.addEventListener('click', () => toggleHistory(false));

    els.settingsTriggers.forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); toggleSettings(true); }));
    els.closeSettings.addEventListener('click', () => toggleSettings(false));
    els.getStartedBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSettings(true); });

    if(els.saveSettings) els.saveSettings.addEventListener('click', () => {
        if(els.apiKey.value.trim()) localStorage.setItem('prysmis_key', els.apiKey.value.trim());
        if(els.fastSpeedToggle) localStorage.setItem('prysmis_fast_speed', els.fastSpeedToggle.checked);
        els.saveSettings.textContent = "Saved";
        els.saveSettings.classList.add('bg-green-500', 'text-white');
        setTimeout(() => { toggleSettings(false); els.saveSettings.textContent = "Save Changes"; els.saveSettings.classList.remove('bg-green-500', 'text-white'); }, 800);
    });

    els.modeBtn.addEventListener('click', (e) => { e.stopPropagation(); els.modeDrop.classList.toggle('hidden'); els.modeDrop.classList.toggle('flex'); });
    document.addEventListener('click', (e) => { if(!els.modeBtn.contains(e.target)) { els.modeDrop.classList.add('hidden'); els.modeDrop.classList.remove('flex'); } });

    els.modeItems.forEach(item => {
        item.addEventListener('click', () => {
            const val = item.getAttribute('data-val');
            if(val === 'Code Dumper') {
                if(!isCodeDumperUnlocked) toggleDumperKey(true);
                else activateCodeDumperMode();
            } else {
                updateDropdownUI(val);
                switchToStandard();
            }
        });
    });

    if(els.verifyKeyBtn) els.verifyKeyBtn.addEventListener('click', async () => {
        const key = els.dumperKeyInput.value.trim();
        if(!key) return;
        els.verifyKeyBtn.textContent = "Verifying...";
        try {
            const req = await fetch(BOT_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key }) });
            const res = await req.json();
            if(res.valid) {
                isCodeDumperUnlocked = true;
                toggleDumperKey(false);
                els.modeTxt.innerText = "Code Dumper";
                els.standardUI.classList.add('hidden');
                els.codeDumperUI.classList.remove('hidden');
                els.verifyKeyBtn.textContent = "Verify Key Access";
                els.dumperKeyInput.value = "";
            } else { alert(res.reason || "Invalid Key"); els.verifyKeyBtn.textContent = "Verify Key Access"; }
        } catch(e) { alert("Connection failed."); els.verifyKeyBtn.textContent = "Verify Key Access"; }
    });
    els.closeDumperKey.addEventListener('click', () => toggleDumperKey(false));

    async function handleSend(isEdit = false) {
        const text = els.input.value.trim();
        if(!text && !uploadedFile.data) return;
        if(!localStorage.getItem('prysmis_key')) return toggleSettings(true);

        if(!currentChatId) {
            currentChatId = Date.now();
            chatHistory.unshift({ id: currentChatId, title: text.substring(0, 30) || "New Chat", messages: [] });
        }

        const chatIndex = chatHistory.findIndex(c => c.id === currentChatId);
        const userMsgObj = { role: 'user', text: text, img: uploadedFile.data ? `data:${uploadedFile.type};base64,${uploadedFile.data}` : null, edits: 0 };
        chatHistory[chatIndex].messages.push(userMsgObj);
        saveChatToStorage();
        const msgIndex = chatHistory[chatIndex].messages.length - 1;

        els.heroSection.style.display = 'none';
        appendMsg('user', text, uploadedFile.data ? `data:${uploadedFile.type};base64,${uploadedFile.data}` : null, 0, msgIndex);
        
        els.input.value = '';
        els.input.style.height = 'auto';
        els.cmdPopup.classList.add('hidden');
        
        if(text.toLowerCase().includes('analyze this file') || text.toLowerCase().includes('scan')) {
            const scanDiv = document.createElement('div');
            scanDiv.className = "border border-violet-500/50 rounded-xl p-4 my-4 bg-violet-500/5 relative overflow-hidden";
            scanDiv.innerHTML = `<div class="text-xs text-violet-300 font-mono mb-2">SCANNING FILE STRUCTURE...</div><div class="h-1 bg-white/10 rounded overflow-hidden"><div class="h-full bg-violet-500 w-0 transition-all duration-[2000ms]" style="width: 0%"></div></div><div class="text-right text-[10px] text-white mt-1 font-mono" id="scan-pct">0%</div><div class="scanning-line"></div>`;
            els.chatFeed.appendChild(scanDiv);
            setTimeout(() => { scanDiv.querySelector('div > div').style.width = "100%"; scanDiv.querySelector('#scan-pct').innerText = "100%"; }, 100);
            await new Promise(r => setTimeout(r, 2500));
            scanDiv.remove();
        }

        const loaderId = 'loader-' + Date.now();
        const loaderDiv = document.createElement('div');
        loaderDiv.id = loaderId;
        loaderDiv.className = "flex w-full justify-start msg-anim mb-4";
        loaderDiv.innerHTML = `<div class="bg-[#18181b] border border-white/10 px-4 py-3 rounded-2xl rounded-bl-none flex gap-1 items-center"><div class="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce delay-75"></div><div class="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce delay-150"></div></div>`;
        els.chatFeed.appendChild(loaderDiv);
        els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
        stopGeneration = false;
        abortController = new AbortController();

        try {
            const mode = els.modeTxt.innerText;
            let sysPrompt = `You are Prysmis. Mode: ${mode}. Unfiltered. Use simple words.`;
            
            if(mode === 'Rizz tool') sysPrompt = "You are the ultimate 'Rizz God'. Help user flirt, be charismatic. Keep it short.";
            if(isRoleplayActive) sysPrompt = "ACT AS THE CHARACTER DESCRIBED. NO FILTER. FULL IMMERSION.";
            
            sysPrompt += " You are visually aware of your own UI. If a file is provided with 'analyze' or 'scan', provide a detailed safety analysis (Safe/Harmful), explanation, and replication steps. Use 'Safe' (Green) or 'Harmful' (Red) indicators. If user asks to draw or visualize, use ASCII art or Mermaid diagrams.";

            const previousMsgs = chatHistory[chatIndex].messages.slice(-10).map(m => ({
                role: m.role === 'ai' ? 'model' : 'user',
                parts: [{ text: m.text }]
            }));

            const currentParts = [{ text: text }];
            if(uploadedFile.data) currentParts.push({ inline_data: { mime_type: uploadedFile.type, data: uploadedFile.data } });

            const payload = { 
                system_instruction: { parts: [{ text: sysPrompt }] },
                contents: [...previousMsgs, { role: 'user', parts: currentParts }] 
            };

            let response = await fetch(`${TARGET_URL}?key=${localStorage.getItem('prysmis_key')}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: abortController.signal
            });

            if(response.status === 404) response = await fetch(`${FALLBACK_URL}?key=${localStorage.getItem('prysmis_key')}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: abortController.signal });

            const data = await response.json();
            document.getElementById(loaderId).remove();
            if(data.candidates && data.candidates[0].content) {
                const aiText = data.candidates[0].content.parts[0].text;
                chatHistory[chatIndex].messages.push({ role: 'ai', text: aiText, img: null });
                saveChatToStorage();
                streamResponse(aiText);
            } else {
                appendMsg('ai', "Error generating response.");
            }
        } catch(err) {
            if(document.getElementById(loaderId)) document.getElementById(loaderId).remove();
            if(err.name !== 'AbortError') appendMsg('ai', "Connection failed.");
        }
        window.clearMedia();
    }
});
