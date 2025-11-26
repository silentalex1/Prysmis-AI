let currentMode = "AI Assistant";
let historyData = JSON.parse(localStorage.getItem('prysmis_history')) || [];
let apiKey = localStorage.getItem('prysmis_key') || '';
let fastSpeed = localStorage.getItem('prysmis_speed') === 'true';
let conversationContext = [];
let abortController = null;
let currentFile = null;

const promptInput = document.getElementById('prompt-input');
const chatFeed = document.getElementById('chat-feed');
const submitBtn = document.getElementById('submit-btn');
const stopBtn = document.getElementById('stop-ai-btn');
const heroSection = document.getElementById('hero-section');
const modeBtn = document.getElementById('mode-btn');
const modeDropdown = document.getElementById('mode-dropdown');
const cmdPopup = document.getElementById('cmd-popup');
const fileInput = document.getElementById('file-input');
const mediaPreview = document.getElementById('media-preview');

window.toggleSettings = function() {
    const overlay = document.getElementById('settings-overlay');
    const box = document.getElementById('settings-box');
    
    if (overlay.classList.contains('hidden')) {
        overlay.classList.remove('hidden', 'pointer-events-none');
        overlay.classList.add('flex');
        document.getElementById('api-key-field').value = apiKey;
        document.getElementById('fast-speed-toggle').checked = fastSpeed;
        setTimeout(() => {
            overlay.classList.remove('opacity-0');
            box.classList.remove('scale-95');
            box.classList.add('scale-100');
        }, 10);
    } else {
        overlay.classList.add('opacity-0');
        box.classList.remove('scale-100');
        box.classList.add('scale-95');
        setTimeout(() => {
            overlay.classList.add('hidden', 'pointer-events-none');
            overlay.classList.remove('flex');
        }, 300);
    }
}

window.toggleHistory = function() {
    const modal = document.getElementById('history-modal');
    const container = modal.querySelector('div');
    
    if (modal.classList.contains('hidden')) {
        loadHistoryToSidebar();
        modal.classList.remove('hidden', 'pointer-events-none');
        modal.classList.add('flex');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            container.classList.remove('scale-95');
            container.classList.add('scale-100');
        }, 10);
    } else {
        modal.classList.add('opacity-0');
        container.classList.remove('scale-100');
        container.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden', 'pointer-events-none');
            modal.classList.remove('flex');
        }, 300);
    }
}

window.setInput = function(text) {
    promptInput.value = text;
    promptInput.focus();
}

window.insertFormat = function(start, end) {
    const s = promptInput.selectionStart;
    const e = promptInput.selectionEnd;
    const val = promptInput.value;
    promptInput.value = val.substring(0, s) + start + val.substring(s, e) + end + val.substring(e);
    promptInput.selectionStart = promptInput.selectionEnd = s + start.length;
    promptInput.focus();
}

window.runCmd = function(cmd) {
    if(cmd === '/clear') {
        chatFeed.innerHTML = '';
        chatFeed.appendChild(heroSection);
        heroSection.classList.remove('hidden');
        conversationContext = [];
        showNotification('Chat cleared', 'success');
    } else if (cmd === '/roleplay') {
        conversationContext.push({role: "user", parts: [{text: "System: Enter roleplay mode. Stay in character."}]});
        showNotification('Roleplay mode active', 'info');
    } else if (cmd === '/discord-invite') {
        window.open('https://discord.gg/', '_blank');
    } else {
        promptInput.value = cmd + ' ';
    }
    document.getElementById('cmd-popup').classList.add('hidden');
    document.getElementById('cmd-popup').classList.remove('flex');
    promptInput.focus();
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("[Sidebar Script Loaded]");
    
    const settingsBtn = document.getElementById('settings-trigger');
    const historyBtn = document.getElementById('history-trigger');
    const closeSettings = document.getElementById('close-settings');
    const saveSettings = document.getElementById('save-settings-btn');
    const closeHistory = document.getElementById('close-history');
    const newChatBtn = document.getElementById('new-chat-btn');
    const quickNewChat = document.getElementById('quick-new-chat-btn');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const mobileOverlay = document.getElementById('mobile-overlay');

    if(settingsBtn) settingsBtn.onclick = window.toggleSettings;
    if(historyBtn) historyBtn.onclick = window.toggleHistory;
    if(closeSettings) closeSettings.onclick = window.toggleSettings;
    
    if(saveSettings) {
        saveSettings.onclick = () => {
            apiKey = document.getElementById('api-key-field').value;
            fastSpeed = document.getElementById('fast-speed-toggle').checked;
            localStorage.setItem('prysmis_key', apiKey);
            localStorage.setItem('prysmis_speed', fastSpeed);
            showNotification('Settings Saved', 'success');
            window.toggleSettings();
        };
    }

    if(closeHistory) closeHistory.onclick = window.toggleHistory;
    
    if(newChatBtn) {
        newChatBtn.onclick = () => {
            window.toggleHistory();
            startNewChat();
        };
    }
    
    if(quickNewChat) quickNewChat.onclick = startNewChat;

    mobileMenuBtn.onclick = () => {
        sidebar.classList.toggle('-translate-x-full');
        mobileOverlay.classList.toggle('hidden');
    };

    mobileOverlay.onclick = () => {
        sidebar.classList.add('-translate-x-full');
        mobileOverlay.classList.add('hidden');
    };

    modeBtn.onclick = (e) => {
        e.stopPropagation();
        modeDropdown.classList.toggle('hidden');
        modeDropdown.classList.toggle('flex');
    };

    document.querySelectorAll('.mode-item').forEach(item => {
        item.onclick = () => {
            const val = item.getAttribute('data-val');
            document.getElementById('current-mode-txt').innerText = val;
            currentMode = val;
            modeDropdown.classList.add('hidden');
            modeDropdown.classList.remove('flex');
            
            if(val === 'Code Dumper') {
                document.getElementById('code-dumper-key-modal').classList.remove('hidden');
                document.getElementById('code-dumper-key-modal').classList.add('flex');
                setTimeout(() => {
                    document.getElementById('code-dumper-key-modal').classList.remove('opacity-0');
                    document.getElementById('code-dumper-key-modal').querySelector('div').classList.remove('scale-95');
                    document.getElementById('code-dumper-key-modal').querySelector('div').classList.add('scale-100');
                }, 10);
            } else {
                document.getElementById('standard-ui').classList.remove('hidden');
                document.getElementById('code-dumper-ui').classList.add('hidden');
            }
        };
    });

    document.addEventListener('click', (e) => {
        if (!modeBtn.contains(e.target) && !modeDropdown.contains(e.target)) {
            modeDropdown.classList.add('hidden');
            modeDropdown.classList.remove('flex');
        }
    });

    promptInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        
        if (this.value.startsWith('/')) {
            cmdPopup.classList.remove('hidden');
            cmdPopup.classList.add('flex');
        } else {
            cmdPopup.classList.add('hidden');
            cmdPopup.classList.remove('flex');
        }
    });

    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    });

    submitBtn.onclick = handleSubmit;
    
    stopBtn.onclick = () => {
        if (abortController) {
            abortController.abort();
            abortController = null;
            stopBtn.classList.add('opacity-0', 'pointer-events-none');
            showNotification('Generation Stopped', 'error');
        }
    };

    fileInput.addEventListener('change', handleFileSelect);
    
    document.body.addEventListener('dragover', (e) => {
        e.preventDefault();
        document.getElementById('drop-overlay').classList.remove('hidden');
        setTimeout(() => document.getElementById('drop-overlay').classList.remove('opacity-0'), 10);
    });

    document.body.addEventListener('dragleave', (e) => {
        if(e.clientX === 0 && e.clientY === 0) {
            document.getElementById('drop-overlay').classList.add('opacity-0');
            setTimeout(() => document.getElementById('drop-overlay').classList.add('hidden'), 300);
        }
    });

    document.body.addEventListener('drop', (e) => {
        e.preventDefault();
        document.getElementById('drop-overlay').classList.add('opacity-0');
        setTimeout(() => document.getElementById('drop-overlay').classList.add('hidden'), 300);
        
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });

    setupDumperLogic();
});

function handleFileSelect(e) {
    handleFiles(e.target.files);
}

function handleFiles(files) {
    const file = files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        showNotification('File too large (Max 10MB)', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        currentFile = {
            data: e.target.result.split(',')[1],
            mime: file.type
        };

        mediaPreview.innerHTML = '';
        const previewItem = document.createElement('div');
        previewItem.className = 'relative group';
        
        let content = '';
        if (file.type.startsWith('image/')) {
            content = `<img src="${e.target.result}" class="h-20 w-20 object-cover rounded-xl border border-white/20">`;
        } else if (file.type.startsWith('video/')) {
            content = `<video src="${e.target.result}" class="h-20 w-20 object-cover rounded-xl border border-white/20"></video>`;
        } else {
            content = `<div class="h-20 w-20 flex items-center justify-center bg-white/10 rounded-xl border border-white/20"><i class="fa-solid fa-file text-2xl"></i></div>`;
        }

        previewItem.innerHTML = `
            ${content}
            <button onclick="clearFile()" class="absolute -top-2 -right-2 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center text-[10px] cursor-pointer hover:scale-110 transition"><i class="fa-solid fa-xmark"></i></button>
        `;
        mediaPreview.appendChild(previewItem);
    };
    reader.readAsDataURL(file);
}

window.clearFile = function() {
    currentFile = null;
    mediaPreview.innerHTML = '';
    fileInput.value = '';
}

function startNewChat() {
    chatFeed.innerHTML = '';
    chatFeed.appendChild(heroSection);
    heroSection.classList.remove('hidden');
    conversationContext = [];
    currentFile = null;
    mediaPreview.innerHTML = '';
    promptInput.style.height = 'auto';
    promptInput.focus();
}

async function handleSubmit() {
    const text = promptInput.value.trim();
    if ((!text && !currentFile) || !apiKey) {
        if (!apiKey) {
            showNotification('Please set API Key in Settings', 'error');
            window.toggleSettings();
        }
        return;
    }

    promptInput.value = '';
    promptInput.style.height = 'auto';
    heroSection.classList.add('hidden');
    stopBtn.classList.remove('opacity-0', 'pointer-events-none');
    
    appendUserMessage(text, currentFile);
    
    const parts = [];
    if (text) parts.push({text: text});
    if (currentFile) {
        parts.push({
            inline_data: {
                mime_type: currentFile.mime,
                data: currentFile.data
            }
        });
        clearFile();
    }

    conversationContext.push({
        role: "user",
        parts: parts
    });

    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.className = 'flex gap-4 max-w-4xl mx-auto w-full msg-anim ai-msg p-6 rounded-2xl relative';
    aiMsgDiv.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg mt-1">
            <i class="fa-solid fa-sparkles text-[10px] text-white"></i>
        </div>
        <div class="flex-1 min-w-0">
            <div class="text-[11px] font-bold text-violet-400 mb-1 tracking-widest uppercase">Prysmis AI</div>
            <div class="prose text-[15px] leading-relaxed text-gray-300 content-area"><span class="animate-pulse">Thinking...</span></div>
        </div>
    `;
    chatFeed.appendChild(aiMsgDiv);
    chatFeed.scrollTop = chatFeed.scrollHeight;

    try {
        abortController = new AbortController();
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            signal: abortController.signal,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                contents: conversationContext,
                generationConfig: {
                    temperature: 0.9,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });

        if (!response.ok) throw new Error('API Error');

        const data = await response.json();
        const aiText = data.candidates[0].content.parts[0].text;
        
        conversationContext.push({
            role: "model",
            parts: [{text: aiText}]
        });

        const contentArea = aiMsgDiv.querySelector('.content-area');
        contentArea.innerHTML = parseMarkdown(aiText);
        
        saveToHistory(text || "Media Upload", aiText);

    } catch (error) {
        if (error.name !== 'AbortError') {
            aiMsgDiv.querySelector('.content-area').innerHTML = `<span class="text-red-400">Error: ${error.message}</span>`;
        }
    } finally {
        stopBtn.classList.add('opacity-0', 'pointer-events-none');
        abortController = null;
        chatFeed.scrollTop = chatFeed.scrollHeight;
    }
}

function appendUserMessage(text, file) {
    const div = document.createElement('div');
    div.className = 'flex gap-4 max-w-4xl mx-auto w-full msg-anim justify-end';
    
    let mediaHtml = '';
    if(file) {
        if(file.mime.startsWith('image')) {
            mediaHtml = `<img src="data:${file.mime};base64,${file.data}" class="max-w-[200px] rounded-lg mb-2 block border border-white/20">`;
        } else {
             mediaHtml = `<div class="bg-white/10 p-2 rounded mb-2 text-xs"><i class="fa-solid fa-file"></i> Attached File</div>`;
        }
    }

    div.innerHTML = `
        <div class="flex-1 min-w-0 text-right">
            <div class="inline-block text-left max-w-[85%] user-msg rounded-2xl rounded-tr-sm p-4 text-white">
                ${mediaHtml}
                <p class="whitespace-pre-wrap text-[15px]">${escapeHtml(text)}</p>
            </div>
        </div>
        <div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-1">
            <i class="fa-solid fa-user text-[10px]"></i>
        </div>
    `;
    chatFeed.appendChild(div);
}

function parseMarkdown(text) {
    let html = text
        .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold text-white mt-4 mb-2">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold text-white mt-5 mb-3">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold text-white mt-6 mb-4">$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/~~( নম.*?)~~/g, '<del>$1</del>')
        .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 rounded text-purple-300">$1</code>')
        .replace(/\n/g, '<br>');

    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<div class="code-block">
            <div class="code-header">
                <span>${lang || 'text'}</span>
                <button class="copy-btn" onclick="copyCode(this)"><i class="fa-regular fa-copy"></i> Copy</button>
            </div>
            <pre class="custom-scrollbar"><code class="language-${lang}">${code}</code></pre>
        </div>`;
    });

    return html;
}

window.copyCode = function(btn) {
    const code = btn.parentElement.nextElementSibling.innerText;
    navigator.clipboard.writeText(code);
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
    setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy', 2000);
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showNotification(msg, type) {
    const div = document.createElement('div');
    div.className = 'notification';
    const icon = type === 'success' ? 'fa-check-circle text-green-400' : 
                 type === 'error' ? 'fa-circle-exclamation text-red-400' : 'fa-info-circle text-blue-400';
    div.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
    document.getElementById('notification-area').appendChild(div);
    setTimeout(() => {
        div.style.animation = 'slideOutRight 0.4s forwards';
        setTimeout(() => div.remove(), 400);
    }, 3000);
}

function saveToHistory(title, response) {
    const id = Date.now();
    const date = new Date().toLocaleDateString();
    historyData.unshift({id, title: title.substring(0, 30) + '...', date, context: [...conversationContext]});
    if (historyData.length > 50) historyData.pop();
    localStorage.setItem('prysmis_history', JSON.stringify(historyData));
}

function loadHistoryToSidebar() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    
    const term = document.getElementById('search-input').value.toLowerCase();
    
    historyData.forEach(item => {
        if(term && !item.title.toLowerCase().includes(term)) return;
        
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div>
                <div class="font-bold text-gray-300 text-sm">${item.title}</div>
                <div class="history-date">${item.date}</div>
            </div>
            <button class="delete-history-btn" onclick="deleteHistory(${item.id}, event)"><i class="fa-solid fa-trash"></i></button>
        `;
        div.onclick = (e) => {
            if(!e.target.closest('.delete-history-btn')) loadChat(item.id);
        };
        list.appendChild(div);
    });
}

window.deleteHistory = function(id, e) {
    e.stopPropagation();
    historyData = historyData.filter(x => x.id !== id);
    localStorage.setItem('prysmis_history', JSON.stringify(historyData));
    loadHistoryToSidebar();
}

function loadChat(id) {
    const item = historyData.find(x => x.id === id);
    if (!item) return;
    conversationContext = [...item.context];
    window.toggleHistory();
    chatFeed.innerHTML = '';
    heroSection.classList.add('hidden');
    
    conversationContext.forEach(msg => {
        if(msg.role === 'user') {
            const txt = msg.parts.find(p => p.text)?.text || 'Media';
            appendUserMessage(txt, null);
        } else {
            const aiMsgDiv = document.createElement('div');
            aiMsgDiv.className = 'flex gap-4 max-w-4xl mx-auto w-full msg-anim ai-msg p-6 rounded-2xl relative mb-6';
            aiMsgDiv.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg mt-1">
                    <i class="fa-solid fa-sparkles text-[10px] text-white"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-[11px] font-bold text-violet-400 mb-1 tracking-widest uppercase">Prysmis AI</div>
                    <div class="prose text-[15px] leading-relaxed text-gray-300 content-area">${parseMarkdown(msg.parts[0].text)}</div>
                </div>
            `;
            chatFeed.appendChild(aiMsgDiv);
        }
    });
    chatFeed.scrollTop = chatFeed.scrollHeight;
}

document.getElementById('search-input').addEventListener('input', loadHistoryToSidebar);

function setupDumperLogic() {
    const modal = document.getElementById('code-dumper-key-modal');
    const input = document.getElementById('dumper-key-input');
    const btn = document.getElementById('verify-key-btn');
    const closeKey = document.getElementById('close-dumper-key');

    closeKey.onclick = () => {
        modal.classList.add('hidden');
        document.getElementById('standard-ui').classList.remove('hidden');
        document.getElementById('code-dumper-ui').classList.add('hidden');
        document.getElementById('current-mode-txt').innerText = "AI Assistant";
        currentMode = "AI Assistant";
    };

    btn.onclick = async () => {
        const key = input.value.trim();
        if(!key) return;

        try {
            const req = await fetch('/verify-key', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({key})
            });
            const res = await req.json();
            
            if(res.valid) {
                showNotification('Key Verified', 'success');
                modal.classList.add('hidden');
                document.getElementById('standard-ui').classList.add('hidden');
                document.getElementById('code-dumper-ui').classList.remove('hidden');
                document.getElementById('code-dumper-ui').classList.add('flex');
            } else {
                showNotification(res.reason || 'Invalid Key', 'error');
                input.classList.add('border-red-500');
                setTimeout(() => input.classList.remove('border-red-500'), 1000);
            }
        } catch (e) {
            console.error(e);
            showNotification('Server Connection Failed', 'error');
        }
    };

    const dropZone = document.getElementById('dumper-upload-zone');
    const dumperInput = document.getElementById('dumper-file-input');
    
    dropZone.onclick = () => dumperInput.click();
    dumperInput.onchange = (e) => {
        const f = e.target.files[0];
        if(f) {
            const r = new FileReader();
            r.onload = (ev) => {
                document.getElementById('dumper-upload-state').classList.add('hidden');
                document.getElementById('dumper-editor-view').classList.remove('hidden');
                document.getElementById('dumper-editor-view').classList.add('flex');
                document.getElementById('dumper-input-area').value = ev.target.result;
            };
            r.readAsText(f);
        }
    };

    document.getElementById('dumper-skip-btn').onclick = () => {
        document.getElementById('dumper-upload-state').classList.add('hidden');
        document.getElementById('dumper-editor-view').classList.remove('hidden');
        document.getElementById('dumper-editor-view').classList.add('flex');
    };
    
    document.querySelectorAll('.lang-chip').forEach(c => {
        c.onclick = () => {
            document.querySelectorAll('.lang-chip').forEach(b => b.classList.remove('active', 'bg-emerald-500/20', 'text-emerald-400'));
            c.classList.add('active', 'bg-emerald-500/20', 'text-emerald-400');
        };
    });

    document.getElementById('btn-obfuscate').onclick = () => {
        const code = document.getElementById('dumper-input-area').value;
        document.getElementById('dumper-output-area').value = "-- Obfuscated by Prysmis \n" + btoa(code).split('').reverse().join('');
        document.getElementById('terminal-log').innerText = "Obfuscation complete.";
    };
    
    document.getElementById('btn-deobfuscate').onclick = () => {
        showNotification('Deobfuscation AI not connected', 'info');
    };
}
