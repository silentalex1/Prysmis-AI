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
        dumperKeyModal: document.getElementById('code-dumper-key-modal'),
        closeDumperKey: document.getElementById('close-dumper-key'),
        dumperKeyInput: document.getElementById('dumper-key-input'),
        verifyKeyBtn: document.getElementById('verify-key-btn'),
        codeDumperUI: document.getElementById('code-dumper-ui'),
        standardUI: document.getElementById('standard-ui'),
        dumperUploadState: document.getElementById('dumper-upload-state'),
        dumperEditorView: document.getElementById('dumper-editor-view'),
        dumperUploadZone: document.getElementById('dumper-upload-zone'),
        dumperFileInput: document.getElementById('dumper-file-input'),
        dumperSkipBtn: document.getElementById('dumper-skip-btn'),
        dumperInputArea: document.getElementById('dumper-input-area'),
        dumperOutputArea: document.getElementById('dumper-output-area'),
        btnObfuscate: document.getElementById('btn-obfuscate'),
        btnDeobfuscate: document.getElementById('btn-deobfuscate'),
        terminalLog: document.getElementById('terminal-log'),
        terminalTime: document.getElementById('terminal-time'),
        getStartedBtn: document.getElementById('get-started-btn'),
        mobileMenuBtn: document.getElementById('mobile-menu-btn'),
        homeBtn: document.getElementById('home-btn'),
        sidebar: document.getElementById('sidebar'),
        mobileOverlay: document.getElementById('mobile-overlay')
    };

    let uploadedFile = { data: null, type: null };
    let chatHistory = JSON.parse(localStorage.getItem('prysmis_history')) || [];
    let currentChatId = null;
    let isCodeDumperUnlocked = false;
    let currentLang = 'Lua';
    
    // --- ENDPOINTS UPDATED ---
    // Primary: 2.5 Pro (As requested)
    const TARGET_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";
    // Fallback: 1.5 Flash (Most stable, fixes 404 issues)
    const FALLBACK_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
    const BOT_API_URL = "http://localhost:3000/verify-key";

    function loadKey() {
        const key = localStorage.getItem('prysmis_key');
        if(key && els.apiKey) els.apiKey.value = key;
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
            div.innerHTML = `<div class="font-bold text-white text-sm mb-1 truncate">${chat.title}</div><div class="text-[10px] text-gray-500 font-mono">${new Date(chat.id).toLocaleDateString()}</div>`;
            div.onclick = () => {
                loadChat(chat.id);
                toggleHistory(false);
                if(window.innerWidth < 768) toggleMobileMenu();
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
        chat.messages.forEach(msg => {
            appendMsg(msg.role, msg.text, msg.img);
        });
        renderHistory();
        switchToStandard();
    }

    function appendMsg(role, text, img) {
        const div = document.createElement('div');
        div.className = `flex w-full ${role === 'user' ? 'justify-end' : 'justify-start'} msg-anim mb-6`;
        let content = parseMD(text);
        if(img) content = `<img src="${img}" class="max-w-[200px] rounded-lg mb-2 border border-white/20">` + content;
        div.innerHTML = `<div class="max-w-[85%] md:max-w-[70%] p-4 rounded-[20px] shadow-lg prose ${role === 'user' ? 'user-msg text-white rounded-br-none' : 'ai-msg text-gray-200 rounded-bl-none'}">${content}</div>`;
        els.chatFeed.appendChild(div);
        els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
    }

    function parseMD(text) {
        if (!text) return "";
        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');

        html = html.replace(/```(\w+)?<br>([\s\S]*?)```/g, (match, lang, code) => {
            const cleanCode = code.replace(/<br>/g, '\n');
            return `<div class="code-block"><div class="code-header"><span>${lang || 'code'}</span><button class="copy-btn" onclick="window.copyCode(this)">Copy</button></div><pre><code class="language-${lang}">${cleanCode}</code></pre></div>`;
        });
        
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        return html;
    }

    function streamResponse(text) {
        const div = document.createElement('div');
        div.className = `flex w-full justify-start msg-anim mb-6`;
        const bubble = document.createElement('div');
        bubble.className = "max-w-[90%] md:max-w-[75%] p-5 rounded-[20px] rounded-bl-none shadow-lg prose ai-msg text-gray-200";
        div.appendChild(bubble);
        els.chatFeed.appendChild(div);

        const chars = text.split('');
        let i = 0;
        let currentText = "";
        
        const interval = setInterval(() => {
            if(i >= chars.length) {
                clearInterval(interval);
                bubble.innerHTML = parseMD(text);
                return;
            }
            currentText += chars[i];
            bubble.innerHTML = parseMD(currentText);
            els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
            i++;
        }, 1); 
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

    function switchToStandard() {
        els.standardUI.classList.remove('hidden');
        els.codeDumperUI.classList.add('hidden');
        els.modeTxt.innerText = "AI Assistant";
    }

    function detectYouTube(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    loadKey();
    renderHistory();

    window.setInput = (txt) => {
        els.input.value = txt;
        els.input.focus();
    };

    window.runCmd = (cmd) => {
        if(cmd === '/clear') {
            currentChatId = null;
            els.chatFeed.innerHTML = '';
            els.chatFeed.appendChild(els.heroSection);
            els.heroSection.style.display = 'flex';
        }
        else if(cmd === '/features') appendMsg('ai', "**Prysmis Features:**\n- **Roleplay Feature**: Unfiltered character immersion.\n- **Rizz Helper Feature**: Charisma and social dynamics assistant.\n- **Image Analysis Feature**: Vision capabilities for images.\n- **YouTube Analysis Feature**: Paste a link to analyze context.", null);
        
        els.cmdPopup.classList.add('hidden');
        els.cmdPopup.classList.remove('flex');
        els.input.value = '';
        els.input.focus();
    };

    window.copyCode = (btn) => {
        const code = btn.parentElement.nextElementSibling.innerText;
        navigator.clipboard.writeText(code);
        btn.innerText = "Copied!";
        setTimeout(() => btn.innerText = "Copy", 2000);
    };

    els.input.addEventListener('input', () => {
        els.input.style.height = 'auto';
        els.input.style.height = els.input.scrollHeight + 'px';
        if(els.input.value.trim().startsWith('/')) {
            els.cmdPopup.classList.remove('hidden');
            els.cmdPopup.classList.add('flex');
        } else {
            els.cmdPopup.classList.add('hidden');
            els.cmdPopup.classList.remove('flex');
        }
    });

    els.input.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    els.submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleSend();
    });

    els.mobileMenuBtn.addEventListener('click', () => {
        els.sidebar.classList.remove('-translate-x-full');
        els.mobileOverlay.classList.remove('hidden');
    });

    els.mobileOverlay.addEventListener('click', () => {
        els.sidebar.classList.add('-translate-x-full');
        els.mobileOverlay.classList.add('hidden');
    });

    els.settingsTriggers.forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); toggleSettings(true); }));
    els.closeSettings.addEventListener('click', () => toggleSettings(false));
    els.getStartedBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSettings(true); });
    
    els.saveSettings.addEventListener('click', () => {
        if(els.apiKey.value.trim()) {
            localStorage.setItem('prysmis_key', els.apiKey.value.trim());
            els.saveSettings.textContent = "Saved";
            els.saveSettings.classList.add('bg-green-500', 'text-white');
            setTimeout(() => {
                toggleSettings(false);
                els.saveSettings.textContent = "Save Changes";
                els.saveSettings.classList.remove('bg-green-500', 'text-white');
            }, 800);
        }
    });

    els.historyTrigger.addEventListener('click', () => toggleHistory(true));
    els.closeHistory.addEventListener('click', () => toggleHistory(false));
    els.newChatBtn.addEventListener('click', () => {
        currentChatId = null;
        els.chatFeed.innerHTML = '';
        els.chatFeed.appendChild(els.heroSection);
        els.heroSection.style.display = 'flex';
        toggleHistory(false);
    });

    const activateCodeDumperMode = () => {
        els.modeTxt.innerText = "Code Dumper";
        els.standardUI.classList.add('hidden');
        els.codeDumperUI.classList.remove('hidden');
    };

    if(els.verifyKeyBtn) els.verifyKeyBtn.addEventListener('click', async () => {
        const key = els.dumperKeyInput.value.trim();
        if(!key) return;
        els.verifyKeyBtn.textContent = "Verifying...";
        try {
            const req = await fetch(BOT_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: key })
            });
            const res = await req.json();
            if(res.valid) {
                isCodeDumperUnlocked = true;
                els.dumperKeyModal.classList.add('hidden');
                activateCodeDumperMode();
                els.verifyKeyBtn.textContent = "Verify Key Access";
                els.dumperKeyInput.value = "";
            } else {
                alert(res.reason || "Invalid Key");
                els.verifyKeyBtn.textContent = "Verify Key Access";
            }
        } catch(e) {
            alert("Connection failed. Run the bot.");
            els.verifyKeyBtn.textContent = "Verify Key Access";
        }
    });

    els.closeDumperKey.addEventListener('click', () => els.dumperKeyModal.classList.add('hidden'));

    els.modeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        els.modeDrop.classList.toggle('hidden');
        els.modeDrop.classList.toggle('flex');
    });

    document.addEventListener('click', (e) => {
        if(!els.modeBtn.contains(e.target)) {
            els.modeDrop.classList.add('hidden');
            els.modeDrop.classList.remove('flex');
        }
    });

    els.modeItems.forEach(item => {
        item.addEventListener('click', () => {
            const val = item.getAttribute('data-val');
            if(val === 'Code Dumper') {
                if(!isCodeDumperUnlocked) {
                    els.dumperKeyModal.classList.remove('hidden');
                    requestAnimationFrame(() => els.dumperKeyModal.classList.remove('opacity-0'));
                } else {
                    activateCodeDumperMode();
                }
            } else {
                els.modeTxt.innerText = val;
                switchToStandard();
            }
        });
    });

    async function handleSend() {
        const text = els.input.value.trim();
        if(!text && !uploadedFile.data) return;

        if(!localStorage.getItem('prysmis_key')) return toggleSettings(true);

        if(!currentChatId) {
            currentChatId = Date.now();
            chatHistory.unshift({ id: currentChatId, title: text.substring(0, 30) || "New Chat", messages: [] });
        }

        const chatIndex = chatHistory.findIndex(c => c.id === currentChatId);
        chatHistory[chatIndex].messages.push({ role: 'user', text: text, img: uploadedFile.data ? `data:${uploadedFile.type};base64,${uploadedFile.data}` : null });
        saveChatToStorage();

        els.heroSection.style.display = 'none';
        appendMsg('user', text, uploadedFile.data ? `data:${uploadedFile.type};base64,${uploadedFile.data}` : null);
        
        els.input.value = '';
        els.input.style.height = 'auto';
        els.cmdPopup.classList.add('hidden');
        
        els.flashOverlay.classList.remove('opacity-0');
        els.flashOverlay.classList.add('bg-flash-green');

        const loaderId = 'loader-' + Date.now();
        const loaderDiv = document.createElement('div');
        loaderDiv.id = loaderId;
        loaderDiv.className = "flex w-full justify-start msg-anim mb-4";
        loaderDiv.innerHTML = `<div class="bg-[#18181b] border border-white/10 px-4 py-3 rounded-2xl rounded-bl-none flex gap-1 items-center"><div class="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce delay-75"></div><div class="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce delay-150"></div></div>`;
        els.chatFeed.appendChild(loaderDiv);
        els.chatFeed.scrollTop = els.chatFeed.scrollHeight;

        try {
            const mode = els.modeTxt.innerText;
            let sysPrompt = `You are Prysmis. Mode: ${mode}. Use simple words.`;
            
            if(mode === 'Rizz tool') sysPrompt = "You are the ultimate 'Rizz God'. Help user flirt, be charismatic. Keep it short.";
            if(mode === 'Roleplay') sysPrompt = "Act exactly as the character described. Stay in character 100%.";
            
            const youtubeID = detectYouTube(text);
            let finalUserText = text;
            let extraParts = [];

            if(youtubeID) {
                finalUserText += `\n[System: This is a YouTube video ID: ${youtubeID}. Use your knowledge to analyze it.]`;
            }

            const previousMsgs = chatHistory[chatIndex].messages.slice(-10).map(m => ({
                role: m.role === 'ai' ? 'model' : 'user',
                parts: [{ text: m.text }]
            }));

            const currentParts = [{ text: finalUserText }];
            if(uploadedFile.data) currentParts.push({ inline_data: { mime_type: uploadedFile.type, data: uploadedFile.data } });

            const payload = { 
                system_instruction: { parts: [{ text: sysPrompt }] },
                contents: [
                    ...previousMsgs,
                    { role: 'user', parts: currentParts }
                ] 
            };

            // TRY GEMINI 2.5 PRO FIRST
            let response = await fetch(`${TARGET_URL}?key=${localStorage.getItem('prysmis_key')}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // IF 404 (Model not found) -> TRY GEMINI 1.5 FLASH
            if(response.status === 404 || response.status === 400) {
                console.warn("Gemini 2.5 not found, switching to 1.5 Flash");
                response = await fetch(`${FALLBACK_URL}?key=${localStorage.getItem('prysmis_key')}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const data = await response.json();
            document.getElementById(loaderId).remove();
            els.flashOverlay.classList.add('opacity-0');
            els.flashOverlay.classList.remove('bg-flash-green');

            if(data.candidates && data.candidates[0].content) {
                const aiText = data.candidates[0].content.parts[0].text;
                chatHistory[chatIndex].messages.push({ role: 'ai', text: aiText, img: null });
                saveChatToStorage();
                streamResponse(aiText);
            } else {
                const errMsg = data.error ? data.error.message : "Unknown error";
                appendMsg('ai', `Error: ${errMsg}`);
            }

        } catch(err) {
            if(document.getElementById(loaderId)) document.getElementById(loaderId).remove();
            els.flashOverlay.classList.add('opacity-0');
            els.flashOverlay.classList.remove('bg-flash-green');
            appendMsg('ai', "Connection failed. Check your API Key.");
        }
        uploadedFile = { data: null, type: null };
    }
});
