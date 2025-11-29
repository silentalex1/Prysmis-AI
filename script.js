window.setInput = function(txt) {
    const input = document.getElementById('prompt-input');
    if(input) { input.value = txt; input.focus(); }
};

window.runCmd = function(cmd) {
    const event = new CustomEvent('runCmdGlobal', { detail: cmd });
    document.dispatchEvent(event);
};

window.insertFormat = function(s, e) {
    const event = new CustomEvent('insertFormatGlobal', { detail: {start: s, end: e} });
    document.dispatchEvent(event);
};

window.copyCode = function(btn) {
    const code = btn.parentElement.nextElementSibling.innerText;
    navigator.clipboard.writeText(code);
    const original = btn.innerText;
    btn.innerText = "Copied!";
    setTimeout(() => btn.innerText = original, 2000);
};

window.clearMedia = function() {
    const event = new CustomEvent('clearMediaGlobal');
    document.dispatchEvent(event);
};

window.setMode = function(mode) {
    const event = new CustomEvent('setModeGlobal', { detail: mode });
    document.dispatchEvent(event);
};

window.chipAction = function(mode, text) {
    window.setMode(mode);
    setTimeout(() => {
        window.setInput(text);
    }, 50);
};

function deob(code, isLua = false) {
    let out = code;
    try {
        for (let i = 0; i < 99; i++) {
            let old = out;
            out = out.replace(/\\x([0-9a-f]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
            out = out.replace(/\\u([0-9a-f]{4})/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
            out = out.replace(/0x([a-f0-9]+)/gi, (m, h) => parseInt(h, 16).toString())
            out = out.replace(/!0/g, "true").replace(/!1/g, "false").replace(/!!\[\]/g, "true")
            
            if (!isLua) {
                out = out.replace(/\b_0x[a-f0-9]{4,8}\b/g, (m) => { try { return typeof window[m] !== 'undefined' ? window[m] : m } catch(e){return m} })
                out = out.replace(/eval\s*\(\s*function\s*\([^\)]*\)\s*\{([^}]*)\}\s*\(\s*['"][^'"]*['"]\s*(?:,\s*\d+\s*){3}/s, (m, body) => "/*eval*/(" + body.replace(/^return/, "") + ")")
                out = out.replace(/\bfunction\s*\([^)]*\)\s*\{\s*return\s*[^}]*\}\s*\(\s*\)\s*;?/g, "")
                out = out.replace(/;\s*;+/g, ";").replace(/,\s*,+/g, ",")
                out = out.replace(/if\s*\(\s*true\s*\)\s*\{([^}]+)\}\s*else\s*\{[^}]*\}/g, "$1")
                out = out.replace(/if\s*\(\s*false\s*\)\s*\{[^}]*\}\s*else\s*\{([^}]+)\}/g, "$1")
            } else {
                out = out.replace(/loadstring\s*\(\s*game\s*:\s*HttpGet\s*\([^)]+\)\s*\)\s*\(\s*\)/g, "")
                out = out.replace(/--\[\[[\s\S]*?--\]\]/g, "")
                out = out.replace(/load%s*%(%s*"\s*\\(\d+%s*\\%d+%s*)*"\s*%)%/g,(m,s)=>{let bytes=s.match(/\d+/g);return new Function('return "'+bytes.map(b=>String.fromCharCode(b)).join("")+'"')()})
            }
            if (out === old) break;
        }
    } catch(e) {
        return code; 
    }
    return out.replace(/;\s*;/g, ";").replace(/,\s*,/g, ",").replace(/\s+/g, " ").trim();
}

function saveChatToStorage(chatHistory) {
    try {
        const historyToSave = chatHistory.map(chat => ({
            id: chat.id,
            title: chat.title,
            messages: chat.messages.map(msg => ({
                role: msg.role,
                text: msg.text,
                img: msg.img && msg.img.length > 5000 ? null : msg.img 
            }))
        }));
        localStorage.setItem('prysmis_history', JSON.stringify(historyToSave));
    } catch (e) {
        console.warn("Local storage full or error saving chat.", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const els = {
        input: document.getElementById('prompt-input'),
        submitBtn: document.getElementById('submit-btn'),
        chatFeed: document.getElementById('chat-feed'),
        heroSection: document.getElementById('hero-section'),
        flashOverlay: document.getElementById('flash-overlay'),
        historyModal: document.getElementById('history-modal'),
        historyList: document.getElementById('history-list'),
        searchInput: document.getElementById('search-input'),
        dumperKeyModal: document.getElementById('code-dumper-key-modal'),
        dumperKeyInput: document.getElementById('dumper-key-input'),
        verifyKeyBtn: document.getElementById('verify-key-btn'),
        codingWorkspace: document.getElementById('coding-workspace-ui'),
        imageGenUI: document.getElementById('image-gen-ui'),
        standardUI: document.getElementById('standard-ui'),
        modeTxt: document.getElementById('current-mode-txt'),
        modeBtn: document.getElementById('mode-btn'),
        modeDrop: document.getElementById('mode-dropdown'),
        modeIcon: document.getElementById('mode-icon'),
        settingsOverlay: document.getElementById('settings-overlay'),
        settingsBox: document.getElementById('settings-box'),
        apiKey: document.getElementById('api-key-field'),
        saveSettings: document.getElementById('save-settings-btn'),
        fastSpeedToggle: document.getElementById('fast-speed-toggle'),
        cmdPopup: document.getElementById('cmd-popup'),
        textToolbar: document.getElementById('text-toolbar'),
        mediaPreview: document.getElementById('media-preview'),
        fileInput: document.getElementById('file-input'),
        stopAiBtn: document.getElementById('stop-ai-btn'),
        continueBtn: document.getElementById('continue-btn'),
        notificationArea: document.getElementById('notification-area'),
        mobileMenuBtn: document.getElementById('mobile-menu-btn'),
        mobileOverlay: document.getElementById('mobile-overlay'),
        sidebar: document.getElementById('sidebar'),
        dropOverlay: document.getElementById('drop-overlay'),
        themeSelector: document.getElementById('theme-selector'),
        
        wsEditor: document.getElementById('ws-editor'),
        wsIframe: document.getElementById('ws-iframe'),
        wsRawOutput: document.getElementById('ws-raw-output'),
        wsPlaceholder: document.getElementById('ws-placeholder'),
        wsTerminal: document.getElementById('ws-terminal'),
        wsRunBtn: document.getElementById('ws-run-btn'),
        wsObfBtn: document.getElementById('ws-obf-btn'),
        wsDeobfBtn: document.getElementById('ws-deobf-btn'),
        wsResizer: document.getElementById('ws-resizer'),
        wsTerminalContainer: document.getElementById('ws-terminal-container'),
        
        imgPrompt: document.getElementById('image-prompt'),
        imgGenBtn: document.getElementById('generate-img-btn'),
        generatedImage: document.getElementById('generated-image'),
        imagePlaceholder: document.getElementById('image-placeholder'),
        downloadBtn: document.getElementById('download-btn'),
        
        settingsTriggers: [document.getElementById('settings-trigger')],
        closeSettings: document.getElementById('close-settings'),
        historyTrigger: document.getElementById('history-trigger'),
        closeHistory: document.getElementById('close-history'),
        newChatBtn: document.getElementById('new-chat-btn'),
        quickNewChatBtn: document.getElementById('quick-new-chat-btn'),
        closeDumperKey: document.getElementById('close-dumper-key'),
        getStartedBtn: document.getElementById('get-started-btn'),
        homeBtn: document.getElementById('home-btn')
    };

    let chatHistory = JSON.parse(localStorage.getItem('prysmis_history')) || [];
    let currentChatId = null;
    let uploadedFile = { data: null, type: null };
    let isCodeDumperUnlocked = false;
    let isRoleplayActive = false;
    let stopGeneration = false;
    let abortController = null;
    let currentInterval = null;
    let dragCounter = 0;

    const API_MODELS = [
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro-latest",
        "gemini-1.0-pro"
    ];

    const loadKey = () => {
        const key = localStorage.getItem('prysmis_key');
        if(key && els.apiKey) els.apiKey.value = key;
        const fastSpeed = localStorage.getItem('prysmis_fast_speed');
        if(fastSpeed === 'true' && els.fastSpeedToggle) els.fastSpeedToggle.checked = true;
        const theme = localStorage.getItem('prysmis_theme') || 'theme-midnight';
        document.body.className = `bg-main text-white h-screen w-screen overflow-hidden flex font-sans selection:bg-accent selection:text-white ${theme}`;
        if(els.themeSelector) els.themeSelector.value = theme;
    };
    loadKey();

    renderHistory();

    document.addEventListener('runCmdGlobal', (e) => executeCommand(e.detail));
    document.addEventListener('insertFormatGlobal', (e) => insertFormatInternal(e.detail.start, e.detail.end));
    document.addEventListener('clearMediaGlobal', () => clearMediaInternal());
    document.addEventListener('setModeGlobal', (e) => changeMode(e.detail));

    function changeMode(val) {
        updateDropdownUI(val);
        
        if(val === 'Coding') {
            activateCodingWorkspace();
        } else if(val === 'Code Dumper') {
            if(!isCodeDumperUnlocked) toggleDumperKey(true);
            else activateDumper();
        } else if (val === 'Image Generation') {
            activateImageGen();
        } else {
            switchToStandard();
        }
        toggleDropdown(false);
    }

    function updateDropdownUI(val) {
        const items = Array.from(els.modeDrop.children);
        const item = items.find(i => i.dataset.val === val);
        let iconClass = 'fa-sparkles';
        if (item) iconClass = item.dataset.icon || 'fa-sparkles';
        
        els.modeIcon.innerHTML = `<i class="fa-solid ${iconClass} text-accent"></i>`;
        els.modeTxt.innerText = val;
    }

    els.modeDrop.querySelectorAll('.mode-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            changeMode(item.dataset.val);
        });
    });

    function toggleDropdown(force) {
        if (force === false) {
            els.modeDrop.classList.add('hidden');
            els.modeDrop.classList.remove('flex');
        } else {
            els.modeDrop.classList.toggle('hidden');
            els.modeDrop.classList.toggle('flex');
        }
    }

    els.modeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
    });

    document.addEventListener('click', (e) => {
        if(!els.modeBtn.contains(e.target)) toggleDropdown(false);
    });

    function executeCommand(cmd) {
        if(cmd === '/clear') {
            currentChatId = null;
            els.chatFeed.innerHTML = '';
            els.chatFeed.appendChild(els.heroSection);
            els.heroSection.style.display = 'flex';
        }
        else if(cmd === '/features') {
            const featureHTML = `<div style="font-family: 'Cinzel', serif; font-size: 1.1em; margin-bottom: 10px; color: var(--accent);">PrysmisAI features</div><hr class="visual-line"><ul class="feature-list list-disc pl-5"><li>Scan Analysis: Say "Analysis or scan this file and ___"</li><li>YouTube analysis</li><li>Domain external viewer</li><li>Modes</li><li>Roleplay</li><li>Invisible tab</li></ul>`;
            const div = document.createElement('div');
            div.className = `flex w-full justify-start msg-anim mb-6`;
            div.innerHTML = `<div class="max-w-[85%] md:max-w-[70%] p-4 rounded-[20px] shadow-lg prose ai-msg rounded-bl-none">${featureHTML}</div>`;
            els.chatFeed.appendChild(div);
            els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
            els.heroSection.style.display = 'none';
        } else if(cmd === '/roleplay') {
            isRoleplayActive = !isRoleplayActive;
            const status = isRoleplayActive ? "Activated" : "Deactivated";
            const boldText = "**Roleplay mode " + status + ".**";
            appendMsg('ai', `${boldText} ${isRoleplayActive ? "What do you want me to be?" : "Back to normal."}`, null);
            els.heroSection.style.display = 'none';
        } else if(cmd === '/discord-invite') {
            navigator.clipboard.writeText("https://discord.gg/eKC5CgEZbT");
            showNotification("Discord server link copied onto your clipboard!");
        } else if(cmd === '/invisible tab') {
            document.title = "Google";
            const link = document.querySelector("link[rel~='icon']");
            if (link) link.href = 'https://www.google.com/favicon.ico';
        }
        els.cmdPopup.classList.add('hidden');
        els.cmdPopup.classList.remove('flex');
        els.input.value = '';
        els.input.focus();
    }

    function insertFormatInternal(s, e) {
        const start = els.input.selectionStart;
        const end = els.input.selectionEnd;
        const txt = els.input.value;
        els.input.value = txt.substring(0, start) + s + txt.substring(start, end) + e + txt.substring(end);
        els.input.focus();
    }

    function clearMediaInternal() {
        uploadedFile = { data: null, type: null };
        els.mediaPreview.innerHTML = '';
        els.fileInput.value = '';
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

    els.settingsTriggers.forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); toggleSettings(true); }));
    els.closeSettings.addEventListener('click', () => toggleSettings(false));
    els.getStartedBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSettings(true); });
    
    els.saveSettings.addEventListener('click', () => {
        if(els.apiKey.value.trim()) localStorage.setItem('prysmis_key', els.apiKey.value.trim());
        if(els.fastSpeedToggle) localStorage.setItem('prysmis_fast_speed', els.fastSpeedToggle.checked);
        if(els.themeSelector) {
            localStorage.setItem('prysmis_theme', els.themeSelector.value);
            document.body.className = `bg-main text-white h-screen w-screen overflow-hidden flex font-sans selection:bg-violet-500 selection:text-white ${els.themeSelector.value}`;
        }
        els.saveSettings.textContent = "Saved";
        els.saveSettings.classList.add('bg-green-500', 'text-white');
        setTimeout(() => {
            toggleSettings(false);
            els.saveSettings.textContent = "Save Changes";
            els.saveSettings.classList.remove('bg-green-500', 'text-white');
        }, 800);
    });

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

    els.historyTrigger.addEventListener('click', () => toggleHistory(true));
    els.closeHistory.addEventListener('click', () => toggleHistory(false));

    function renderHistory() {
        els.historyList.innerHTML = '';
        chatHistory.forEach(chat => {
            const div = document.createElement('div');
            div.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
            div.innerHTML = `
                <div class="flex-1 overflow-hidden">
                    <div class="font-bold text-white text-sm mb-1 truncate">${chat.title}</div>
                    <div class="history-date">${new Date(chat.id).toLocaleDateString()}</div>
                </div>
                <button class="delete-history-btn"><i class="fa-solid fa-trash"></i></button>
            `;
            div.onclick = () => {
                loadChat(chat.id);
                toggleHistory(false);
            };
            div.querySelector('.delete-history-btn').onclick = (e) => {
                e.stopPropagation();
                if(confirm("Delete?")) {
                    chatHistory = chatHistory.filter(c => c.id !== chat.id);
                    if(currentChatId === chat.id) startNewChat();
                    saveChatToStorage(chatHistory);
                }
            };
            els.historyList.appendChild(div);
        });
    }

    function loadChat(id) {
        const chat = chatHistory.find(c => c.id === id);
        if(!chat) return;
        currentChatId = id;
        els.chatFeed.innerHTML = '';
        els.heroSection.style.display = 'none';
        chat.messages.forEach(msg => appendMsg(msg.role, msg.text, msg.img));
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

    if(els.homeBtn) els.homeBtn.addEventListener('click', startNewChat);
    if(els.newChatBtn) els.newChatBtn.addEventListener('click', startNewChat);
    if(els.quickNewChatBtn) els.quickNewChatBtn.addEventListener('click', startNewChat);

    function toggleDumperKey(show) {
        if(show) {
            els.dumperKeyModal.classList.remove('hidden');
            requestAnimationFrame(() => els.dumperKeyModal.classList.remove('opacity-0'));
        } else {
            els.dumperKeyModal.classList.add('opacity-0');
            setTimeout(() => els.dumperKeyModal.classList.add('hidden'), 300);
        }
    }

    function activateCodingWorkspace() {
        updateDropdownUI("Coding");
        els.standardUI.classList.add('hidden');
        els.imageGenUI.classList.add('hidden');
        els.codingWorkspace.classList.remove('hidden');
    }

    function activateImageGen() {
        updateDropdownUI("Image Generation");
        els.standardUI.classList.add('hidden');
        els.codingWorkspace.classList.add('hidden');
        els.imageGenUI.classList.remove('hidden');
        els.imageGenUI.classList.add('flex');
    }

    function activateDumper() {
        updateDropdownUI("Code Dumper");
        switchToStandard(); 
    }

    function switchToStandard() {
        els.standardUI.classList.remove('hidden');
        els.codingWorkspace.classList.add('hidden');
        els.imageGenUI.classList.add('hidden');
        els.imageGenUI.classList.remove('flex');
    }

    els.closeDumperKey.addEventListener('click', () => toggleDumperKey(false));
    
    if(els.verifyKeyBtn) els.verifyKeyBtn.addEventListener('click', () => {
        const key = els.dumperKeyInput.value.trim();
        if(!key) return;
        isCodeDumperUnlocked = true;
        toggleDumperKey(false);
        activateDumper();
        els.dumperKeyInput.value = "";
    });

    let isResizing = false;
    els.wsResizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'row-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const containerRect = document.getElementById('ws-right-panel').getBoundingClientRect();
        const newHeight = containerRect.bottom - e.clientY;
        if (newHeight > 50 && newHeight < containerRect.height - 50) {
            els.wsTerminalContainer.style.height = `${newHeight}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
        }
    });

    els.mobileMenuBtn.addEventListener('click', () => {
        const isHidden = els.sidebar.classList.contains('-translate-x-full');
        if(isHidden) {
            els.sidebar.classList.remove('-translate-x-full');
            els.mobileOverlay.classList.remove('hidden');
        } else {
            els.sidebar.classList.add('-translate-x-full');
            els.mobileOverlay.classList.add('hidden');
        }
    });

    els.mobileOverlay.addEventListener('click', () => {
        els.sidebar.classList.add('-translate-x-full');
        els.mobileOverlay.classList.add('hidden');
    });

    els.input.addEventListener('input', (e) => {
        els.input.style.height = 'auto';
        els.input.style.height = els.input.scrollHeight + 'px';
        
        const val = e.target.value.toLowerCase();
        if(val.includes('deobfuscate') || val.includes('code') || val.includes('obfuscate') || val.includes('script')) {
            if(els.modeTxt.innerText !== 'Coding') {
                activateCodingWorkspace();
                updateDropdownUI("Coding");
            }
        }
        
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
             e.preventDefault(); els.input.value = els.input.value.slice(0, -1) + '• ';
        }
    });

    els.submitBtn.addEventListener('click', (e) => { e.preventDefault(); handleSend(); });
    els.continueBtn.addEventListener('click', (e) => { e.preventDefault(); handleSend(false, "Continue exactly where you left off from the previous message."); });

    els.fileInput.addEventListener('change', (e) => {
        if(e.target.files[0]) handleFileSelect(e.target.files[0]);
    });

    function handleFileSelect(file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const content = ev.target.result;
            
            if (els.modeTxt.innerText === 'Coding') {
                els.wsEditor.value = content;
                logToTerminal(`Loaded file: ${file.name}`);
            } else {
                uploadedFile = { data: content.split(',')[1], type: file.type, name: file.name };
                let previewContent = file.type.startsWith('image') 
                    ? `<img src="${content}" class="w-full h-full object-cover">`
                    : `<div class="flex items-center justify-center h-full bg-white/10 text-xs p-2 text-center">${file.name}</div>`;
                els.mediaPreview.innerHTML = `<div class="relative w-14 h-14 rounded-lg overflow-hidden border border-accent/20 shadow-lg group">${previewContent}<button class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white" onclick="window.clearMedia()"><i class="fa-solid fa-xmark"></i></button></div>`;
            }
        };
        if(els.modeTxt.innerText === 'Coding' || file.type.includes('text') || file.name.endsWith('.js') || file.name.endsWith('.lua') || file.name.endsWith('.py') || file.name.endsWith('.txt')) {
            reader.readAsText(file);
        } else {
            reader.readAsDataURL(file);
        }
    }

    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        els.dropOverlay.classList.remove('hidden');
        els.dropOverlay.classList.add('flex');
        els.dropOverlay.classList.remove('opacity-0');
    });

    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) {
            els.dropOverlay.classList.add('opacity-0');
            setTimeout(() => {
                if (dragCounter === 0) {
                    els.dropOverlay.classList.add('hidden');
                }
            }, 300);
        }
    });

    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        els.dropOverlay.classList.add('opacity-0');
        setTimeout(() => els.dropOverlay.classList.add('hidden'), 300);
        if(e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
    });

    els.input.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file') {
                handleFileSelect(item.getAsFile());
            }
        }
    });

    document.addEventListener('selectionchange', () => {
        if (document.activeElement === els.input && els.input.selectionStart !== els.input.selectionEnd) {
            els.textToolbar.classList.remove('hidden');
        } else {
            els.textToolbar.classList.add('hidden');
        }
    });

    function showNotification(msg) {
        const notif = document.createElement('div');
        notif.className = 'notification';
        notif.innerHTML = `<i class="fa-brands fa-discord text-accent text-lg"></i> ${msg}`;
        els.notificationArea.appendChild(notif);
        setTimeout(() => {
            notif.style.animation = 'slideOutRight 0.3s forwards';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    async function handleSend(isEdit = false, overrideText = null) {
        const text = overrideText || els.input.value.trim();
        if(!text && !uploadedFile.data) return;

        if(!localStorage.getItem('prysmis_key')) return toggleSettings(true);
        
        els.continueBtn.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');

        if(!currentChatId) {
            currentChatId = Date.now();
            chatHistory.unshift({ id: currentChatId, title: text.substring(0, 30) || "New Chat", messages: [] });
        }

        const chatIndex = chatHistory.findIndex(c => c.id === currentChatId);
        chatHistory[chatIndex].messages.push({ role: 'user', text: text, img: uploadedFile.data ? `data:${uploadedFile.type};base64,${uploadedFile.data}` : null });
        saveChatToStorage(chatHistory);

        els.heroSection.style.display = 'none';
        appendMsg('user', text, uploadedFile.data ? `data:${uploadedFile.type};base64,${uploadedFile.data}` : null);
        
        if (!overrideText) els.input.value = '';
        els.input.style.height = 'auto';
        els.cmdPopup.classList.add('hidden');
        
        els.flashOverlay.classList.remove('opacity-0');
        els.flashOverlay.classList.add('bg-flash-green');
        
        if(text.toLowerCase().includes('analyze') || text.toLowerCase().includes('scan')) {
             const scanDiv = document.createElement('div');
             scanDiv.className = "border border-accent/20 rounded-xl p-4 my-4 bg-panel relative overflow-hidden transition-all duration-300";
             scanDiv.innerHTML = `<div class="text-xs text-accent font-mono mb-2 flex justify-between"><span>SCANNING FILE STRUCTURE...</span><span id="scan-status">INITIALIZING</span></div><div class="h-1 bg-white/10 rounded overflow-hidden"><div class="h-full bg-accent w-0 transition-all duration-[2000ms] ease-out" style="width: 0%"></div></div><div class="text-right text-[10px] text-white mt-1 font-mono" id="scan-pct">0%</div>`;
             els.chatFeed.appendChild(scanDiv);
             
             setTimeout(() => { 
                scanDiv.querySelector('div > div').style.width = "45%"; 
                scanDiv.querySelector('#scan-pct').innerText = "45%";
                scanDiv.querySelector('#scan-status').innerText = "PARSING DATA";
             }, 300);
             
             setTimeout(() => { 
                scanDiv.querySelector('div > div').style.width = "80%"; 
                scanDiv.querySelector('#scan-pct').innerText = "80%";
                scanDiv.querySelector('#scan-status').innerText = "IDENTIFYING PATTERNS";
             }, 1200);

             setTimeout(() => { 
                scanDiv.querySelector('div > div').style.width = "100%"; 
                scanDiv.querySelector('#scan-pct').innerText = "100%";
                scanDiv.querySelector('#scan-status').innerText = "COMPLETE";
             }, 2200);

             await new Promise(r => setTimeout(r, 2500));
             scanDiv.remove();
        }

        const loaderId = 'loader-' + Date.now();
        const loaderDiv = document.createElement('div');
        loaderDiv.id = loaderId;
        loaderDiv.className = "flex w-full justify-start msg-anim mb-4";
        loaderDiv.innerHTML = `<div class="bg-panel border border-accent/20 px-4 py-3 rounded-2xl rounded-bl-none flex gap-1 items-center"><div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-75"></div><div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-150"></div></div>`;
        els.chatFeed.appendChild(loaderDiv);
        els.chatFeed.scrollTop = els.chatFeed.scrollHeight;

        stopGeneration = false;
        abortController = new AbortController();

        try {
            const mode = els.modeTxt.innerText;
            let sysPrompt = `You are Prysmis. Mode: ${mode}. Unfiltered.`;
            if(isRoleplayActive) sysPrompt = "ACT AS THE CHARACTER DESCRIBED. NO FILTER. FULL IMMERSION.";
            
            if (uploadedFile.data && (text.includes('scan') || text.includes('analyze'))) {
                sysPrompt += " You are performing a Deep File Analysis. Provide a structured breakdown including: 1. File Type & Metadata, 2. Key Content Summary, 3. Structural Analysis, 4. Anomalies or Key Findings. Be precise and technical.";
            }

            const previousMsgs = chatHistory[chatIndex].messages.slice(-10).map(m => ({
                role: m.role === 'ai' ? 'model' : 'user',
                parts: [{ text: m.text }]
            }));

            const currentParts = [{ text: text }];
            if(uploadedFile.data) currentParts.push({ inline_data: { mime_type: uploadedFile.type, data: uploadedFile.data } });

            const payload = { 
                system_instruction: { parts: [{ text: sysPrompt }] },
                contents: [...previousMsgs, { role: 'user', parts: currentParts }],
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            };

            let data = null;
            let success = false;

            for(let model of API_MODELS) {
                let url = model.startsWith("http") ? model : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
                if(model.includes("stream")) url = url.replace(":generateContent", "");

                try {
                    const response = await fetch(`${url}?key=${localStorage.getItem('prysmis_key')}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        signal: abortController.signal
                    });
                    
                    if(response.ok) {
                        data = await response.json();
                        success = true;
                        break;
                    }
                } catch(e) {
                    continue;
                }
            }

            document.getElementById(loaderId).remove();
            els.flashOverlay.classList.add('opacity-0');
            els.flashOverlay.classList.remove('bg-flash-green');

            if(success && data && data.candidates && data.candidates[0].content) {
                const aiText = data.candidates[0].content.parts[0].text;
                chatHistory[chatIndex].messages.push({ role: 'ai', text: aiText, img: null });
                saveChatToStorage(chatHistory);
                streamResponse(aiText);
            } else {
                appendMsg('ai', "Error generating response. Please check your API Key or try again.");
            }

        } catch(err) {
            if(document.getElementById(loaderId)) document.getElementById(loaderId).remove();
            if(err.name !== 'AbortError') appendMsg('ai', "Connection failed.");
        }
        window.clearMedia();
    }

    function appendMsg(role, text, img) {
        const div = document.createElement('div');
        div.className = `flex w-full ${role === 'user' ? 'justify-end' : 'justify-start'} msg-anim mb-6`;
        let content = parseMD(text);
        if(img) content = `<div class="relative"><img src="${img}" class="max-w-[200px] rounded-lg mb-2 border border-accent/20"></div>` + content;
        div.innerHTML = `<div class="max-w-[85%] md:max-w-[70%] p-4 rounded-[20px] shadow-lg prose ${role === 'user' ? 'user-msg text-white rounded-br-none cursor-pointer' : 'ai-msg text-gray-200 rounded-bl-none'}">${content}</div>`;
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
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
        html = html.replace(/```(\w+)?<br>([\s\S]*?)```/g, (match, lang, code) => {
            const cleanCode = code.replace(/<br>/g, '\n');
            return `<div class="code-block"><div class="code-header"><span>${lang || 'code'}</span><button class="copy-btn" onclick="window.copyCode(this)">Copy</button></div><pre><code class="language-${lang}">${cleanCode}</code></pre></div>`;
        });
        return html;
    }

    function streamResponse(text) {
        if(stopGeneration) return;
        if(els.stopAiBtn) els.stopAiBtn.classList.remove('opacity-0', 'pointer-events-none');
        
        const div = document.createElement('div');
        div.className = `flex w-full justify-start msg-anim mb-6`;
        const bubble = document.createElement('div');
        bubble.className = "max-w-[90%] md:max-w-[75%] p-5 rounded-[20px] rounded-bl-none shadow-lg prose ai-msg text-gray-200";
        div.appendChild(bubble);
        els.chatFeed.appendChild(div);

        const chars = text.split('');
        let i = 0;
        let currentText = "";
        
        const isFast = (els.fastSpeedToggle && els.fastSpeedToggle.checked);
        const delay = isFast ? 1 : 15;
        
        if (isFast) {
            bubble.innerHTML = parseMD(text);
            els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
            if(els.stopAiBtn) els.stopAiBtn.classList.add('opacity-0', 'pointer-events-none');
            showContinueButton();
            return;
        }
        
        currentInterval = setInterval(() => {
            if(stopGeneration || i >= chars.length) {
                clearInterval(currentInterval);
                bubble.innerHTML = parseMD(text);
                if(els.stopAiBtn) els.stopAiBtn.classList.add('opacity-0', 'pointer-events-none');
                showContinueButton();
                return;
            }
            currentText += chars[i];
            bubble.innerHTML = parseMD(currentText);
            els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
            i++;
        }, delay);
    }

    function showContinueButton() {
        if(els.continueBtn) {
            els.continueBtn.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
        }
    }
    
    function logToTerminal(msg, type='info') {
        const line = document.createElement('div');
        const arrow = type === 'error' ? '<span class="text-red-500">➜</span>' : '<span class="text-green-500">➜</span>';
        const color = type === 'error' ? 'text-red-400' : 'text-gray-400';
        line.innerHTML = `${arrow} <span class="text-cyan-400">~</span> <span class="${color}">${msg}</span>`;
        els.wsTerminal.appendChild(line);
        els.wsTerminalContainer.scrollTop = els.wsTerminalContainer.scrollHeight;
    }

    els.wsRunBtn.addEventListener('click', async () => {
        const code = els.wsEditor.value;
        if(!code.trim()) return;
        
        logToTerminal("Running code...");
        els.wsPlaceholder.classList.add('hidden');
        
        if(code.trim().startsWith('<html') || code.includes('document.') || code.includes('window.')) {
            els.wsIframe.classList.remove('hidden');
            els.wsRawOutput.classList.add('hidden');
            const blob = new Blob([code], {type: 'text/html'});
            els.wsIframe.src = URL.createObjectURL(blob);
            logToTerminal("Executed web view.");
        } else {
            els.wsIframe.classList.add('hidden');
            els.wsRawOutput.classList.remove('hidden');
            els.wsRawOutput.innerText = "Simulating execution environment...\n";
            
            let data = null;
            let success = false;

            for(let model of API_MODELS) {
                let url = model.startsWith("http") ? model : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
                if(model.includes("stream")) url = url.replace(":generateContent", "");

                try {
                    const response = await fetch(`${url}?key=${localStorage.getItem('prysmis_key')}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: "Act as a code runner/compiler terminal. Execute this code strictly. Return ONLY the output or errors. No explanations. Code:\n" + code }] }]
                        })
                    });
                    
                    if(response.ok) {
                        data = await response.json();
                        success = true;
                        break;
                    }
                } catch(e) { continue; }
            }

            if(success && data && data.candidates && data.candidates[0].content) {
                 const out = data.candidates[0].content.parts[0].text;
                 els.wsRawOutput.innerText = out;
                 logToTerminal("Execution complete.");
            } else {
                logToTerminal("Execution failed.", 'error');
            }
        }
    });

    els.wsObfBtn.addEventListener('click', async () => {
        const code = els.wsEditor.value;
        if(!code.trim()) return;
        logToTerminal("Obfuscating...");
        
        let data = null;
        let success = false;

        for(let model of API_MODELS) {
            let url = model.startsWith("http") ? model : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
            if(model.includes("stream")) url = url.replace(":generateContent", "");

            try {
                const response = await fetch(`${url}?key=${localStorage.getItem('prysmis_key')}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: "Obfuscate this code heavily. Return ONLY the code, no markdown. Code:\n" + code }] }]
                    })
                });
                if(response.ok) {
                    data = await response.json();
                    success = true;
                    break;
                }
            } catch(e) { continue; }
        }

        if(success && data.candidates && data.candidates[0].content) {
             let res = data.candidates[0].content.parts[0].text.replace(/```\w*/g, '').replace(/```/g, '').trim();
             els.wsEditor.value = res;
             logToTerminal("Obfuscation complete.");
             showNotification("Code Obfuscated!");
        } else {
            logToTerminal("Obfuscation failed.", 'error');
        }
    });

    els.wsDeobfBtn.addEventListener('click', async () => {
        const code = els.wsEditor.value;
        if(!code.trim()) return;
        
        logToTerminal("Deobfuscating (Local)...");
        
        const isLua = code.includes('local ') || code.includes('function') || code.includes('end');
        const localResult = deob(code, isLua);
        
        if (localResult && localResult !== code && localResult.length < code.length) {
             els.wsEditor.value = localResult;
             logToTerminal("Deobfuscation complete (Local).");
             showNotification("Code Deobfuscated!");
             return;
        }

        logToTerminal("Local engine insufficient. Using AI Analysis...");
        
        let data = null;
        let success = false;

        for(let model of API_MODELS) {
            let url = model.startsWith("http") ? model : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
            if(model.includes("stream")) url = url.replace(":generateContent", "");

            try {
                const response = await fetch(`${url}?key=${localStorage.getItem('prysmis_key')}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: "You are an expert Reverse Engineer. Deobfuscate this code. Rename variables to readable English, fix indentation, remove junk code. Return ONLY the clean code, no markdown block. Code:\n" + code }] }]
                    })
                });
                if(response.ok) {
                    data = await response.json();
                    success = true;
                    break;
                }
            } catch(e) { continue; }
        }

        if(success && data.candidates && data.candidates[0].content) {
             let resCode = data.candidates[0].content.parts[0].text;
             resCode = resCode.replace(/```\w*/g, '').replace(/```/g, '').trim();
             els.wsEditor.value = resCode;
             logToTerminal("Deobfuscation complete (AI).");
             showNotification("Code Deobfuscated!");
        } else {
            logToTerminal("Deobfuscation failed.", 'error');
        }
    });

    els.imgGenBtn.addEventListener('click', () => {
        const prompt = els.imgPrompt.value.trim();
        if(!prompt) return;
        
        els.generatedImage.classList.add('hidden');
        els.imagePlaceholder.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-4xl text-accent mb-4 block"></i><span class="text-xs font-mono">GENERATING...</span>';
        
        let enhancedPrompt = `masterpiece, best quality, 8k, highly detailed, ${prompt}`;
        if(prompt.toLowerCase().includes('anime') || prompt.toLowerCase().includes('waifu') || prompt.toLowerCase().includes('character')) {
            enhancedPrompt = `masterpiece, best quality, anime style, highly detailed, ${prompt}`;
        }

        const encodedPrompt = encodeURIComponent(enhancedPrompt);
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&private=true&enhance=true`;
        
        const img = new Image();
        img.onload = () => {
            els.generatedImage.src = url;
            els.generatedImage.classList.remove('hidden');
            els.imagePlaceholder.classList.add('hidden');
            els.downloadBtn.href = url;
            els.downloadBtn.classList.remove('hidden');
        };
        img.src = url;
    });
});
