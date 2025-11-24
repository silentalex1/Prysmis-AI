
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
        editorLangToggle: document.getElementById('editor-lang-toggle'),
        
        getStartedBtn: document.getElementById('get-started-btn'),
        mobileMenuBtn: document.getElementById('mobile-menu-btn'),
        homeBtn: document.getElementById('home-btn'),
        sidebar: document.querySelector('aside')
    };

    let uploadedFile = { data: null, type: null };
    let chatHistory = JSON.parse(localStorage.getItem('prysmis_history')) || [];
    let currentChatId = null;
    let isCodeDumperUnlocked = false;
    let currentLang = 'Lua';
    
    const TARGET_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";
    const FALLBACK_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";
    const BOT_API_URL = "/verify-key"; 

    const loadKey = () => {
        const key = localStorage.getItem('prysmis_key');
        if(key && els.apiKey) els.apiKey.value = key;
    };
    loadKey();

    setInterval(() => {
        if(els.terminalTime) els.terminalTime.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
    }, 1000);

    const logTerminal = (msg) => {
        if(els.terminalLog) els.terminalLog.textContent = msg;
    };

    const switchToStandard = () => {
        els.standardUI.classList.remove('hidden');
        els.codeDumperUI.classList.add('hidden');
        els.modeTxt.innerText = "AI Assistant";
    };

    if(els.homeBtn) els.homeBtn.addEventListener('click', switchToStandard);

    const renderHistory = () => {
        if(!els.historyList) return;
        els.historyList.innerHTML = '';
        const query = els.searchInput ? els.searchInput.value.toLowerCase() : '';
        
        const filtered = chatHistory.filter(c => c.title.toLowerCase().includes(query));
        
        filtered.forEach(chat => {
            const div = document.createElement('div');
            div.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
            div.innerHTML = `<div class="font-medium text-white text-sm mb-1 truncate">${chat.title}</div><div class="text-[10px] text-gray-500 font-mono">${new Date(chat.id).toLocaleDateString()}</div>`;
            div.onclick = () => {
                loadChat(chat.id);
                toggleHistory(false);
            };
            els.historyList.appendChild(div);
        });
    };

    const saveChatToStorage = () => {
        localStorage.setItem('prysmis_history', JSON.stringify(chatHistory));
        renderHistory();
    };

    const startNewChat = () => {
        currentChatId = null;
        els.chatFeed.innerHTML = '';
        els.chatFeed.appendChild(els.heroSection);
        els.heroSection.style.display = 'flex';
        toggleHistory(false);
        switchToStandard();
    };

    const loadChat = (id) => {
        const chat = chatHistory.find(c => c.id === id);
        if(!chat) return;
        currentChatId = id;
        els.heroSection.style.display = 'none';
        els.chatFeed.innerHTML = '';
        chat.messages.forEach(msg => {
            appendMsg(msg.role, msg.text, msg.img, false);
        });
        renderHistory();
        switchToStandard();
    };

    const toggleHistory = (show) => {
        if(show) {
            els.historyModal.classList.remove('hidden');
            requestAnimationFrame(() => els.historyModal.classList.remove('opacity-0'));
            renderHistory();
            if(els.searchInput) els.searchInput.focus();
        } else {
            els.historyModal.classList.add('opacity-0');
            setTimeout(() => els.historyModal.classList.add('hidden'), 300);
        }
    };

    if(els.historyTrigger) els.historyTrigger.addEventListener('click', () => toggleHistory(true));
    if(els.closeHistory) els.closeHistory.addEventListener('click', () => toggleHistory(false));
    if(els.searchInput) els.searchInput.addEventListener('input', renderHistory);
    if(els.newChatBtn) els.newChatBtn.addEventListener('click', startNewChat);

    document.addEventListener('keydown', (e) => {
        if(e.shiftKey && e.key.toLowerCase() === 'i') {
            e.preventDefault();
            toggleHistory(true);
        }
        if(e.key === 'Escape') {
            toggleHistory(false);
            toggleSettings(false);
            toggleDumperKey(false);
        }
    });

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
    if(els.getStartedBtn) els.getStartedBtn.addEventListener('click', () => toggleSettings(true));
    
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

    if(els.editorLangToggle) {
        const editorBtns = els.editorLangToggle.querySelectorAll('button');
        editorBtns.forEach(btn => btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            editorBtns.forEach(b => {
                if(b.getAttribute('data-lang') === lang) {
                    b.classList.add('bg-emerald-500', 'text-black');
                    b.classList.remove('text-gray-400');
                } else {
                    b.classList.remove('bg-emerald-500', 'text-black');
                    b.classList.add('text-gray-400');
                }
            });
            currentLang = lang;
            logTerminal(`Language switched to ${currentLang}`);
        }));
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

            if(response.status === 404) response = await fetch(`${FALLBACK_URL}?key=${localStorage.getItem('prysmis_key')}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await respo
