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
        mobileOverlay: document.getElementById('mobile-overlay'),
        fastSpeedToggle: document.getElementById('fast-speed-toggle'),
        textToolbar: document.getElementById('text-toolbar'),
        stopAiBtn: document.getElementById('stop-ai-btn')
    };

    let uploadedFile = { data: null, type: null };
    let chatHistory = JSON.parse(localStorage.getItem('prysmis_history')) || [];
    let currentChatId = null;
    let isCodeDumperUnlocked = false;
    let currentLang = 'Lua';
    let isRoleplayActive = false;
    let currentInterval = null;
    let stopGeneration = false;
    
    const TARGET_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";
    const FALLBACK_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
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
        // URL Regex to detect links
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
        
        // Show Stop Button
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
        const delay = isFast ? 1 : 20;
        
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
        if(currentInterval) clearInterval(currentInterval);
        els.stopAiBtn.classList.add('opacity-0', 'pointer-events-none');
    });

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
        else if(cmd === '/features') {
            const featureHTML = `
                <div style="font-family: 'Cinzel', serif; font-size: 1.1em; margin-bottom: 10px; color: #a78bfa;">PrysmisAI features -- still in beta</div>
                <hr class="visual-line">
                <ul class="feature-list list-disc pl-5">
                    <li>YouTube analysis</li>
                    <li>Domain external viewer</li>
                    <li>Modes</li>
                    <li>Roleplay</li>
                    <li>Invisible tab</li>
                </ul>
            `;
            const div = document.createElement('div');
            div.className = `flex w-full justify-start msg-anim mb-6`;
            div.innerHTML = `<div class="max-w-[85%] md:max-w-[70%] p-4 rounded-[20px] shadow-lg prose ai-msg text-gray-200 rounded-bl-none">${featureHTML}</div>`;
            els.chatFeed.appendChild(div);
            els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
            els.heroSection.style.display = 'none';
        }
        else if(cmd === '/roleplay') {
            if(isRoleplayActive) {
                isRoleplayActive = false;
                appendMsg('ai', "**Roleplay Mode Deactivated.** I am back to normal.", null);
            } else {
                isRoleplayActive = true;
                appendMsg('ai', "**Roleplay Mode Activated.** I will now act exactly as the character you describe, without filters.", null);
            }
            els.heroSection.style.display = 'none';
        }
        else if(cmd === '/invisible tab') {
             document.title = "Google";
             const link = document.querySelector("link[rel~='icon']");
             if (link) link.href = 'https://www.google.com/favicon.ico';
        }
        
        els.cmdPopup.classList.add('hidden');
        els.cmdPopup.classList.remove('flex');
        els.input.value = '';
        els.input.focus();
    };

    window.insertFormat = (startTag, endTag) => {
        const start = els.input.selectionStart;
        const end = els.input.selectionEnd;
        const text = els.input.value;
        const selectedText = text.substring(start, end);
        const replacement = startTag + selectedText + endTag;
        els.input.value = text.substring(0, start) + replacement + text.substring(end);
        els.input.focus();
        els.input.setSelectionRange(start + startTag.length, end + startTag.length);
        els.textToolbar.classList.add('hidden');
    };

    window.copyCode = (btn) => {
        const code = btn.parentElement.nextElementSibling.innerText;
        navigator.clipboard.writeText(code);
        btn.innerText = "Copied!";
        setTimeout(() => btn.innerText = "Copy", 2000);
    };

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
        if(e.key === ' ' && (els.input.value.endsWith('*') || els.input.value.endsWith('+'))) {
             e.preventDefault();
             els.input.value = els.input.value.slice(0, -1) + '• ';
        }
        if((e.ctrlKey || e.metaKey) && e.key === 'v') {
            // Handle Paste (Browser default handles text, we handle files)
            // File paste handled by 'paste' event listener usually, or rely on input 'change' fallback
        }
    });

    // Handle Paste Event for Images
    els.input.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file') {
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                     uploadedFile.data = event.target.result.split(',')[1];
                     uploadedFile.type = blob.type;
                     els.mediaPreview.innerHTML = `<div class="relative w-14 h-14 rounded-lg overflow-hidden border border-violet-500 shadow-lg group"><img src="${event.target.result}" class="w-full h-full object-cover"><button class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white" onclick="window.clearMedia()"><i class="fa-solid fa-xmark"></i></button></div>`;
                };
                reader.readAsDataURL(blob);
            }
        }
    });

    els.submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleSend();
    });

    // Mobile Menu
    els.mobileMenuBtn.addEventListener('click', () => {
        els.sidebar.classList.remove('-translate-x-full');
        els.mobileOverlay.classList.remove('hidden');
    });

    els.mobileOverlay.addEventListener('click', () => {
        els.sidebar.classList.add('-translate-x-full');
        els.mobileOverlay.classList.add('hidden');
    });

    // Settings Listeners
    els.settingsTriggers.forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); toggleSettings(true); }));
    els.closeSettings.addEventListener('click', () => toggleSettings(false));
    els.getStartedBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSettings(true); });
    
    if(els.saveSettings) els.saveSettings.addEventListener('click', () => {
        if(els.apiKey.value.trim()) localStorage.setItem('prysmis_key', els.apiKey.value.trim());
        if(els.fastSpeedToggle) localStorage.setItem('prysmis_fast_speed', els.fastSpeedToggle.checked);
        
        els.saveSettings.textContent = "Saved";
        els.saveSettings.classList.add('bg-green-500', 'text-white');
        setTimeout(() => {
            toggleSettings(false);
            els.saveSettings.textContent = "Save Changes";
            els.saveSettings.classList.remove('bg-green-500', 'text-white');
        }, 800);
    });

    // History
    els.historyTrigger.addEventListener('click', () => toggleHistory(true));
    els.closeHistory.addEventListener('click', () => toggleHistory(false));
    els.newChatBtn.addEventListener('click', () => {
        currentChatId = null;
        els.chatFeed.innerHTML = '';
        els.chatFeed.appendChild(els.heroSection);
        els.heroSection.style.display = 'flex';
        toggleHistory(false);
    });

    // Dumper
    const activateCodeDumperMode = () => {
        els.modeTxt.innerText = "Code Dumper";
        els.modeBtn.innerHTML = `<span id="current-mode-txt">Code Dumper</span><i class="fa-solid fa-chevron-down text-[10px] opacity-50 pointer-events-none ml-auto"></i>`;
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

    // Dropdown Logic
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
                els.modeBtn.innerHTML = `<span id="current-mode-txt">${val}</span><i class="fa-solid fa-chevron-down text-[10px] opacity-50 pointer-events-none ml-auto"></i>`;
                switchToStandard();
            }
        });
    });

    // --- MAIN SEND LOGIC ---
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

        stopGeneration = false;

        try {
            const mode = els.modeTxt.innerText;
            let sysPrompt = `You are Prysmis. Mode: ${mode}. Use clear, simple words.`;
            
            if(mode === 'Rizz tool') sysPrompt = "You are the ultimate 'Rizz God'. Help user flirt, be charismatic. Keep it short.";
            if(isRoleplayActive) sysPrompt = "ACT AS THE CHARACTER DESCRIBED. NO FILTER. FULL IMMERSION.";
            
            const youtubeID = detectYouTube(text);
            let finalUserText = text;
            let extraParts = [];

            if(youtubeID) {
                finalUserText += `\n[System: This is a YouTube video ID: ${youtubeID}. Analyze this specific video content/context.]`;
                const thumbUrl = `https://img.youtube.com/vi/${youtubeID}/maxresdefault.jpg`;
                try {
                    const thumbResp = await fetch(thumbUrl);
                    const blob = await thumbResp.blob();
                    const reader = new FileReader();
                    await new Promise((resolve) => {
                        reader.onloadend = () => {
                            const base64data = reader.result.split(',')[1];
                            extraParts.push({ inline_data: { mime_type: "image/jpeg", data: base64data } });
                            resolve();
                        };
                        reader.readAsDataURL(blob);
                    });
                } catch(e) {}
            }

            // Context detection logic for automatic smart links
            sysPrompt += " If you see a URL in the user message, analyze its content based on the link structure.";

            const previousMsgs = chatHistory[chatIndex].messages.slice(-10).map(m => ({
                role: m.role === 'ai' ? 'model' : 'user',
                parts: [{ text: m.text }]
            }));

            const currentParts = [{ text: finalUserText }];
            if(uploadedFile.data) currentParts.push({ inline_data: { mime_type: uploadedFile.type, data: uploadedFile.data } });
            if(extraParts.length > 0) currentParts.push(...extraParts);

            const payload = { 
                system_instruction: { parts: [{ text: sysPrompt }] },
                contents: [
                    ...previousMsgs,
                    { role: 'user', parts: currentParts }
                ] 
            };

            let response = await fetch(`${TARGET_URL}?key=${localStorage.getItem('prysmis_key')}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if(response.status === 404 || response.status === 400) {
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
                appendMsg('ai', "Error generating response.");
            }

        } catch(err) {
            if(document.getElementById(loaderId)) document.getElementById(loaderId).remove();
            els.flashOverlay.classList.add('opacity-0');
            els.flashOverlay.classList.remove('bg-flash-green');
            appendMsg('ai', "Connection failed.");
        }
        uploadedFile = { data: null, type: null }; 
        window.clearMedia = () => {
            uploadedFile = { data: null, type: null };
            els.mediaPreview.innerHTML = '';
            els.fileInput.value = '';
        };
    }
});
