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
        dumperAdviceArea: document.getElementById('dumper-advice-area'),
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
    
    const TARGET_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";
    const BOT_API_URL = "/verify-key"; 

    const loadKey = () => {
        const key = localStorage.getItem('prysmis_key');
        if(key && els.apiKey) els.apiKey.value = key;
    };
    loadKey();

    setInterval(() => {
        if(els.terminalTime) els.terminalTime.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
    }, 1000);

    const logTerminal = (msg) => { if(els.terminalLog) els.terminalLog.textContent = msg; };

    const toggleMobileMenu = () => {
        if(els.sidebar.classList.contains('-translate-x-full')) {
            els.sidebar.classList.remove('-translate-x-full');
            els.mobileOverlay.classList.remove('hidden');
        } else {
            els.sidebar.classList.add('-translate-x-full');
            els.mobileOverlay.classList.add('hidden');
        }
    };

    if(els.mobileMenuBtn) els.mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    if(els.mobileOverlay) els.mobileOverlay.addEventListener('click', toggleMobileMenu);

    const switchToStandard = () => {
        els.standardUI.classList.remove('hidden');
        els.codeDumperUI.classList.add('hidden');
        els.modeTxt.innerText = "AI Assistant";
    };

    if(els.homeBtn) els.homeBtn.addEventListener('click', switchToStandard);

    const toggleSettings = (show) => {
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
    };

    if(els.settingsTriggers) els.settingsTriggers.forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); toggleSettings(true); }));
    if(els.closeSettings) els.closeSettings.addEventListener('click', () => toggleSettings(false));
    if(els.getStartedBtn) els.getStartedBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSettings(true); });
    
    if(els.saveSettings) els.saveSettings.addEventListener('click', () => {
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

    const toggleDumperKey = (show) => {
        if(show) {
            els.dumperKeyModal.classList.remove('hidden');
            requestAnimationFrame(() => els.dumperKeyModal.classList.remove('opacity-0'));
        } else {
            els.dumperKeyModal.classList.add('opacity-0');
            setTimeout(() => els.dumperKeyModal.classList.add('hidden'), 300);
        }
    };

    const activateCodeDumperMode = () => {
        els.modeTxt.innerText = "Code Dumper";
        els.standardUI.classList.add('hidden');
        els.codeDumperUI.classList.remove('hidden');
        els.dumperUploadState.classList.remove('hidden');
        els.dumperEditorView.classList.add('hidden');
        logTerminal("Obliterator initialized.");
    };

    if(els.closeDumperKey) els.closeDumperKey.addEventListener('click', () => toggleDumperKey(false));
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
                toggleDumperKey(false);
                activateCodeDumperMode();
                els.verifyKeyBtn.textContent = "Verify Key Access";
                els.dumperKeyInput.value = "";
            } else {
                alert(res.reason || "Invalid Key");
                els.verifyKeyBtn.textContent = "Verify Key Access";
            }
        } catch(e) {
            alert("Connection failed.");
            els.verifyKeyBtn.textContent = "Verify Key Access";
        }
    });

    const setLanguage = (lang, btns) => {
        currentLang = lang;
        if(btns) {
            btns.forEach(b => {
                if(b.getAttribute('data-lang') === lang) {
                    b.classList.add('bg-emerald-500', 'text-black');
                    b.classList.remove('text-gray-400', 'bg-white/5');
                } else {
                    b.classList.remove('bg-emerald-500', 'text-black');
                    b.classList.add('text-gray-400', 'bg-white/5');
                }
            });
        }
    };

    if(els.dumperUploadZone) {
        const langBtns = els.dumperUploadZone.querySelectorAll('.lang-chip');
        langBtns.forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            setLanguage(btn.getAttribute('data-lang'), langBtns);
        }));

        els.dumperUploadZone.addEventListener('click', () => els.dumperFileInput.click());
        els.dumperFileInput.addEventListener('change', (e) => {
            if(e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    els.dumperInputArea.value = ev.target.result;
                    els.dumperUploadState.classList.add('hidden');
                    els.dumperEditorView.classList.remove('hidden');
                    logTerminal(`Loaded ${e.target.files[0].name} (${currentLang})`);
                };
                reader.readAsText(e.target.files[0]);
            }
        });
    }

    if(els.dumperSkipBtn) els.dumperSkipBtn.addEventListener('click', () => {
        els.dumperUploadState.classList.add('hidden');
        els.dumperEditorView.classList.remove('hidden');
    });

    const processCode = async (action) => {
        const code = els.dumperInputArea.value;
        if(!code) return;
        if(!localStorage.getItem('prysmis_key')) return toggleSettings(true);

        els.dumperOutputArea.value = "Processing...";
        els.dumperAdviceArea.innerHTML = "Analyzing structure...";
        logTerminal(`Running ${action} on ${currentLang}...`);

        try {
            let prompt;
            if(action === 'Obfuscate') {
                prompt = `Task: Highly Obfuscate this ${currentLang} code. Use control flow flattening, dead code injection, variable renaming to random strings, and string encryption. Make it readable only to the machine. Return ONLY the raw code.\n\nCode:\n${code}`;
            } else {
                prompt = `Task: Deobfuscate this ${currentLang} code. Rename variables to meaningful names based on logic. Remove dead code. Simplify control flow. Return ONLY the clean, raw code.\n\nCode:\n${code}`;
            }

            const payload = { contents: [{ parts: [{ text: prompt }] }] };
            let response = await fetch(`${TARGET_URL}?key=${localStorage.getItem('prysmis_key')}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if(data.candidates) {
                const txt = data.candidates[0].content.parts[0].text;
                const cleanTxt = txt.replace(/```[a-z]*\n/g, '').replace(/```/g, '');
                els.dumperOutputArea.value = cleanTxt; 
                els.dumperAdviceArea.innerHTML = "Operation successful. Review the output for changes.";
                logTerminal(`${action} complete.`);
            }
        } catch(e) {
            logTerminal("Error processing.");
            els.dumperOutputArea.value = "Error.";
        }
    };

    if(els.btnObfuscate) els.btnObfuscate.addEventListener('click', () => processCode('Obfuscate'));
    if(els.btnDeobfuscate) els.btnDeobfuscate.addEventListener('click', () => processCode('Deobfuscate'));

    const toggleDropdown = (e) => {
        e.stopPropagation();
        if(els.modeDrop.classList.contains('hidden')) {
            els.modeDrop.classList.remove('hidden');
            els.modeDrop.classList.add('flex');
        } else {
            els.modeDrop.classList.add('hidden');
            els.modeDrop.classList.remove('flex');
        }
    };

    if(els.modeBtn) els.modeBtn.addEventListener('click', toggleDropdown);
    document.addEventListener('click', (e) => {
        if(els.modeDrop && !els.modeDrop.classList.contains('hidden') && !els.modeBtn.contains(e.target)) {
            els.modeDrop.classList.add('hidden');
            els.modeDrop.classList.remove('flex');
        }
    });

    els.modeItems.forEach(item => {
        item.addEventListener('click', () => {
            const val = item.getAttribute('data-val');
            if(val === 'Code Dumper') {
                if(!isCodeDumperUnlocked) toggleDumperKey(true);
                else activateCodeDumperMode();
            } else {
                els.modeTxt.innerText = val;
                switchToStandard();
            }
        });
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
    });

    els.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            uploadedFile.data = ev.target.result.split(',')[1];
            uploadedFile.type = file.type;
            els.mediaPreview.innerHTML = `<div class="relative w-14 h-14 rounded-lg overflow-hidden border border-violet-500 shadow-lg group"><img src="${ev.target.result}" class="w-full h-full object-cover"><button class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white" onclick="clearMedia()"><i class="fa-solid fa-xmark"></i></button></div>`;
        };
        reader.readAsDataURL(file);
    });

    window.clearMedia = () => {
        uploadedFile = { data: null, type: null };
        els.mediaPreview.innerHTML = '';
        els.fileInput.value = '';
    };

    window.runCmd = (cmd) => {
        if(cmd === '/clear') startNewChat();
        else if(cmd === '/roleplay') appendMsg('ai', "Roleplay active. Who should I be?", null, false);
        else if(cmd === '/features') appendMsg('ai', "**Features:**\n- Smart Modes\n- Code Dumper (Obfuscator)\n- Rizz Tool", null, false);
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

    window.setInput = (txt) => {
        els.input.value = txt;
        els.input.focus();
    };

    window.copyCode = (btn) => {
        const code = btn.parentElement.nextElementSibling.innerText;
        navigator.clipboard.writeText(code);
        btn.innerText = "Copied!";
        setTimeout(() => btn.innerText = "Copy", 2000);
    };

    els.submitBtn.addEventListener('click', handleSend);

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
        appendMsg('user', text, uploadedFile.data ? `data:${uploadedFile.type};base64,${uploadedFile.data}` : null, false);
        
        els.input.value = '';
        els.input.style.height = 'auto';
        els.cmdPopup.classList.add('hidden');
        clearMedia();
        
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
            let sysPrompt = `You are Prysmis. Mode: ${mode}.`;
            if(mode === 'Rizz tool') sysPrompt = "You are the ultimate 'Rizz God'. Help user flirt, be charismatic and cool.";

            const payload = { contents: [{ parts: [{ text: sysPrompt + "\nUser: " + text }] }] };
            if(uploadedFile.data) payload.contents[0].parts.push({ inline_data: { mime_type: uploadedFile.type, data: uploadedFile.data } });

            let response = await fetch(`${TARGET_URL}?key=${localStorage.getItem('prysmis_key')}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

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
                appendMsg('ai', "Error generating response.", null, false);
            }

        } catch(err) {
            document.getElementById(loaderId)?.remove();
            els.flashOverlay.classList.add('opacity-0');
            els.flashOverlay.classList.remove('bg-flash-green');
            appendMsg('ai', "Connection failed.", null, false);
        }
    }

    function appendMsg(role, text, img, save) {
        const div = document.createElement('div');
        div.className = `flex w-full ${role === 'user' ? 'justify-end' : 'justify-start'} msg-anim mb-6`;
        let content = text.replace(/\n/g, '<br>');
        if(img) content = `<img src="${img}" class="max-w-[200px] rounded-lg mb-2 border border-white/20">` + content;
        div.innerHTML = `<div class="max-w-[85%] md:max-w-[70%] p-4 rounded-[20px] shadow-lg prose ${role === 'user' ? 'user-msg text-white rounded-br-none' : 'ai-msg text-gray-200 rounded-bl-none'}">${content}</div>`;
        els.chatFeed.appendChild(div);
        els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
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
        }, 5);
    }

    function parseMD(text) {
        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');

        html = html.replace(/```(\w+)?<br>([\s\S]*?)```/g, (match, lang, code) => {
            const cleanCode = code.replace(/<br>/g, '\n');
            return `<div class="code-block"><div class="code-header"><span>${lang || 'code'}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><pre><code class="language-${lang}">${cleanCode}</code></pre></div>`;
        });
        
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        return html;
    }
});
