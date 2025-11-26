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
        modeIcon: document.getElementById('current-mode-icon'),
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
        stopAiBtn: document.getElementById('stop-ai-btn'),
        closeDumperUIBtn: document.getElementById('close-dumper-ui-btn'),
        notificationArea: document.getElementById('notification-area')
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
            appendMsg(msg.role, msg.text, msg.img, false, msg.editCount);
        });
        renderHistory();
        switchToStandard();
    }

    function appendMsg(role, text, img, save = true, editCount = 0) {
        const div = document.createElement('div');
        div.className = `flex w-full ${role === 'user' ? 'justify-end' : 'justify-start'} msg-anim mb-6`;
        
        let editLabel = "";
        if (editCount > 0) editLabel = `<div class="edited-tag">(edited x${editCount})</div>`;

        let content = parseMD(text);
        
        // Scan Analysis Visualization
        if (text.includes('[SCAN_START]')) {
            content = `
                <div class="scan-container">
                    <div class="scan-line"></div>
                    <div class="scan-header">
                        <span>FILE ANALYSIS</span>
                        <span class="scan-percent">0%</span>
                    </div>
                    <div class="scan-result font-mono text-xs text-gray-400">Scanning...</div>
                </div>
            `;
            setTimeout(() => animateScan(div.querySelector('.scan-container'), text), 100);
        } else if (img) {
             content = `<img src="${img}" class="max-w-[200px] rounded-lg mb-2 border border-white/20">` + content;
        }

        div.innerHTML = `<div class="max-w-[85%] md:max-w-[70%] p-4 rounded-[20px] shadow-lg prose ${role === 'user' ? 'user-msg text-white rounded-br-none cursor-pointer' : 'ai-msg text-gray-200 rounded-bl-none'}">${editLabel}${content}</div>`;
        
        if(role === 'user') {
            div.addEventListener('dblclick', () => enableEdit(div, text, editCount));
        }

        els.chatFeed.appendChild(div);
        els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
        return div;
    }

    function animateScan(container, fullText) {
        const percentEl = container.querySelector('.scan-percent');
        const resultEl = container.querySelector('.scan-result');
        let p = 0;
        const int = setInterval(() => {
            p += 2;
            percentEl.innerText = p + "%";
            if (p >= 100) {
                clearInterval(int);
                container.querySelector('.scan-line').style.display = 'none';
                // Parse actual AI result from text
                const cleanText = fullText.replace('[SCAN_START]', '');
                const safe = cleanText.toLowerCase().includes('safe') || !cleanText.toLowerCase().includes('harm');
                resultEl.innerHTML = safe ? `<span class="safe-badge">SAFE 100%</span><br>${cleanText}` : `<span class="harm-badge">HARMFUL</span><br>${cleanText}`;
            }
        }, 30);
    }

    function enableEdit(div, oldText, count) {
        const bubble = div.querySelector('div');
        const input = document.createElement('textarea');
        input.className = 'edit-mode';
        input.value = oldText;
        
        const saveBtn = document.createElement('button');
        saveBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        saveBtn.className = 'ml-2 text-green-400 text-xl';
        
        bubble.innerHTML = '';
        bubble.appendChild(input);
        div.appendChild(saveBtn);

        saveBtn.onclick = () => {
            const newText = input.value;
            // Find index in history
            const chat = chatHistory.find(c => c.id === currentChatId);
            const msgIndex = chat.messages.findIndex(m => m.text === oldText && m.role === 'user');
            
            if (msgIndex !== -1) {
                // Update message
                chat.messages[msgIndex].text = newText;
                chat.messages[msgIndex].editCount = (count || 0) + 1;
                // Remove all messages AFTER this one
                chat.messages = chat.messages.slice(0, msgIndex + 1);
                saveChatToStorage();
                // Reload chat and re-send last message
                loadChat(currentChatId);
                // Hack to resend without adding to history duplicate immediately (loadChat handles render)
                // actually we need to re-trigger AI generation for the edited message
                // remove the last user message from DOM to avoid duplication since handleSend adds it
                els.chatFeed.lastElementChild.remove(); 
                els.input.value = newText;
                handleSend(true); // Pass flag to say "Edit Mode"
            }
        };
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
        
        // Custom tags for Scan Analysis
        html = html.replace(/\[green\](.*?)\[\/green\]/g, '<span class="safe-badge">$1</span>');
        html = html.replace(/\[red\](.*?)\[\/red\]/g, '<span class="harm-badge">$1</span>');

        return html;
    }

    function showNotification(msg) {
        const notif = document.createElement('div');
        notif.className = 'notification';
        notif.innerHTML = `<i class="fa-solid fa-bell"></i> ${msg}`;
        els.notificationArea.appendChild(notif);
        requestAnimationFrame(() => notif.classList.add('show'));
        setTimeout(() => {
            notif.classList.remove('show');
            setTimeout(() => notif.remove(), 500);
        }, 3000);
    }

    function detectContext(text) {
        const lower = text.toLowerCase();
        const map = {
            'Coding': /(code|function|var|python|js|html|css|error|debug)/,
            'Math': /(solve|equation|calculate|math|algebra|geometry)/,
            'Physics': /(force|energy|velocity|quantum|physics|gravity)/,
            'Biology': /(cell|dna|organism|bio|plants|animals)/,
            'Chemistry': /(reaction|chemical|element|atom|molecule)/
        };

        for (const [mode, regex] of Object.entries(map)) {
            if (regex.test(lower)) {
                changeModeUI(mode);
                break;
            }
        }
    }

    function changeModeUI(modeName) {
        els.modeTxt.innerText = modeName;
        // Map icons
        const iconMap = {
            'Coding': 'fa-code', 'Math': 'fa-calculator', 'Physics': 'fa-atom',
            'Biology': 'fa-dna', 'Chemistry': 'fa-flask', 'AI Assistant': 'fa-sparkles'
        };
        const iconClass = iconMap[modeName] || 'fa-sparkles';
        els.modeIcon.innerHTML = `<i class="fa-solid ${iconClass} text-violet-400"></i>`;
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
                bubble.innerHTML = parseMD(text); // Render full HTML at end
                els.stopAiBtn.classList.add('opacity-0', 'pointer-events-none');
                return;
            }
            currentText += chars[i];
            // Simple render during stream, full parse at end to avoid broken HTML tags
            bubble.innerText = currentText; 
            els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
            i++;
        }, delay);
    }

    if(els.stopAiBtn) els.stopAiBtn.addEventListener('click', () => {
        stopGeneration = true;
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
        changeModeUI("AI Assistant");
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
                    <li>Scan analysis: say "Analyze this file"</li>
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
                appendMsg('ai', "**Roleplay Mode Deactivated.**", null);
            } else {
                isRoleplayActive = true;
                appendMsg('ai', "**Roleplay Mode Activated.** Unfiltered Persona Active.", null);
            }
            els.heroSection.style.display = 'none';
        }
        else if(cmd === '/discord-invite') {
             navigator.clipboard.writeText("https://discord.gg/eKC5CgEZbT");
             showNotification("Discord link copied to clipboard!");
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
        
        detectContext(els.input.value);

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
        // Auto Bullet Points
        if(e.key === ' ' && (els.input.value.endsWith('*') || els.input.value.endsWith('+'))) {
             e.preventDefault();
             els.input.value = els.input.value.slice(0, -1) + '• ';
        }
        // Paste Images
        if((e.ctrlKey || e.metaKey) && e.key === 'v') {
             // Let default paste happen for text, paste event listener handles files
        }
    });

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
        changeModeUI("Code Dumper");
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

    if(els.closeDumperUIBtn) els.closeDumperUIBtn.addEventListener('click', () => {
         switchToStandard();
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
                changeModeUI(val);
                switchToStandard();
            }
        });
    });

    async function handleSend(isEdit = false) {
        const text = els.input.value.trim();
        if(!text && !uploadedFile.data) return;

        if(!localStorage.getItem('prysmis_key')) return toggleSettings(true);

        // Scan Analysis Check
        let isScan = false;
        if (uploadedFile.data && (text.toLowerCase().includes('analyze this file') || text.toLowerCase().includes('scan') || text.toLowerCase().includes('analysis'))) {
             isScan = true;
        }

        if(!currentChatId) {
            currentChatId = Date.now();
            chatHistory.unshift({ id: currentChatId, title: text.substring(0, 30) || "New Chat", messages: [] });
        }

        const chatIndex = chatHistory.findIndex(c => c.id === currentChatId);
        // If not edit mode, push user message
        if(!isEdit) {
            chatHistory[chatIndex].messages.push({ role: 'user', text: text, img: uploadedFile.data ? `data:${uploadedFile.type};base64,${uploadedFile.data}` : null });
        }
        saveChatToStorage();

        els.heroSection.style.display = 'none';
        if(!isEdit) {
             appendMsg('user', text, uploadedFile.data ? `data:${uploadedFile.type};base64,${uploadedFile.data}` : null);
        }
        
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
            let sysPrompt = `You are Prysmis. Mode: ${mode}. Use simple words. Highlight bold words in purple. `;
            
            if(mode === 'Rizz tool') sysPrompt += "You are the Rizz God. Unfiltered.";
            if(isRoleplayActive) sysPrompt = "Unfiltered Roleplay. Act exactly as character.";
            if(isScan) sysPrompt = "Analyze this file content. If safe, say [green]SAFE[/green]. If dangerous, say [red]HARMFUL[/red]. Provide detection details.";

            const youtubeID = detectYouTube(text);
            let finalUserText = text;
            let extraParts = [];

            if(youtubeID) {
                finalUserText += `\n[System: This is a YouTube video ID: ${youtubeID}. Analyze its context/topic.]`;
            }

            if(isScan) {
                 // Add trigger for visual effect
                 finalUserText = "[SCAN_START] " + finalUserText;
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
                ],
                safety_settings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
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
                if(isScan) appendMsg('ai', `[SCAN_START]${aiText}`);
                else streamResponse(aiText);
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
