const overlay = document.getElementById('onboarding-overlay');
const iKnowBtn = document.getElementById('btn-i-know');
const checkbox = document.getElementById('dont-show-again');
const sidebar = document.getElementById('app-sidebar');
const modeToggle = document.getElementById('mode-toggle');
const heroTitle = document.getElementById('hero-title');
const presetGrid = document.getElementById('preset-grid');
const saveBar = document.getElementById('settings-save-bar');
const nameInput = document.getElementById('name-input');
const userInput = document.getElementById('user-input');
const inputContainer = document.getElementById('input-container');
const inputStack = document.getElementById('input-stack-container');
const chatFlow = document.getElementById('chat-flow');
const modelSelect = document.getElementById('model-select');
const historyList = document.getElementById('chat-history');
const pfpPreview = document.getElementById('pfp-preview');
const sidePfp = document.getElementById('sidebar-pfp-small');
const sideNameLabel = document.getElementById('sidebar-name-label');
const newChatBtn = document.getElementById('new-chat-btn');

let isChatMode = false;
let userDisplayName = "Guest";
let hasUnsavedChanges = false;
let pendingPfp = null;
let currentChatId = Date.now();
let chatHistory = [];
let attachedImages = [];

if (localStorage.getItem('prysmis_hide_intro')) {
    overlay.style.display = 'none';
}

checkbox.addEventListener('change', () => {
    iKnowBtn.disabled = !checkbox.checked;
    if (checkbox.checked) iKnowBtn.classList.add('btn-blue');
    else iKnowBtn.classList.remove('btn-blue');
});

iKnowBtn.addEventListener('click', () => {
    if (checkbox.checked) localStorage.setItem('prysmis_hide_intro', 'true');
    overlay.style.display = 'none';
});

document.getElementById('btn-install').addEventListener('click', () => {
    window.open('https://www.roblox.com/library/create', '_blank');
    overlay.style.display = 'none';
});

document.getElementById('toggle-sidebar').addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
});

modeToggle.addEventListener('click', () => {
    isChatMode = !isChatMode;
    if (isChatMode) {
        modeToggle.innerText = 'Switch to Game Maker';
        heroTitle.innerText = 'Ask PrysmisAI anything..';
        presetGrid.style.display = 'none';
        userInput.placeholder = 'Chat with AI normally...';
    } else {
        modeToggle.innerText = 'Switch to Chat';
        heroTitle.innerText = 'What are we building today?';
        presetGrid.style.display = 'flex';
        userInput.placeholder = 'Ask PrysmiAI to make anything for your game..';
    }
});

userInput.addEventListener('focus', () => {
    inputStack.style.width = '850px';
});

userInput.addEventListener('blur', () => {
    if (!userInput.value.trim()) {
        inputStack.style.width = '600px';
    }
});

newChatBtn.addEventListener('click', () => {
    startNewChat();
});

function startNewChat() {
    chatFlow.innerHTML = `
        <div class="hero-section" id="hero-presets">
            <h1 id="hero-title">${isChatMode ? 'Ask PrysmisAI anything..' : 'What are we building today?'}</h1>
            <div class="preset-grid" id="preset-grid" style="display: ${isChatMode ? 'none' : 'flex'}">
                <div class="preset-item" data-prompt="create a horror game that does" onclick="handlePresetClick(this)">create a horror game that does</div>
                <div class="preset-item" data-prompt="make me a good map that is" onclick="handlePresetClick(this)">make me a good map that is</div>
                <div class="preset-item" data-prompt="create me a complex game that is about" onclick="handlePresetClick(this)">create me a complex game that is about</div>
            </div>
        </div>`;
    currentChatId = Date.now();
    userInput.value = '';
    userInput.style.height = '24px';
    inputStack.style.width = '600px';
    attachedImages = [];
    clearImagePreview();
    
    // Add preset functionality
    document.querySelectorAll('.preset-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
            item.style.background = '#252528';
            item.style.color = 'white';
            item.style.borderColor = '#555';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.background = '#1e1e20';
            item.style.color = '#888';
            item.style.borderColor = 'var(--border)';
        });
        
        item.addEventListener('click', () => {
            const text = item.dataset.prompt.trim();
            userInput.value = text;
            userInput.focus();
        });
    });
}

// Image paste functionality
function createImagePreview() {
    let previewContainer = document.getElementById('image-preview-container');
    if (!previewContainer) {
        previewContainer = document.createElement('div');
        previewContainer.id = 'image-preview-container';
        previewContainer.style.cssText = `
            display: flex;
            gap: 10px;
            padding: 10px;
            background: var(--bg-input);
            border: 1px solid var(--border);
            border-radius: 12px;
            margin-bottom: 10px;
            min-height: 80px;
            align-items: center;
            flex-wrap: wrap;
        `;
        inputStack.insertBefore(previewContainer, inputStack.firstChild);
    }
    return previewContainer;
}

function clearImagePreview() {
    const previewContainer = document.getElementById('image-preview-container');
    if (previewContainer) {
        previewContainer.innerHTML = '';
        previewContainer.style.display = 'none';
    }
}

function addImageToPreview(imageData, fileName) {
    const previewContainer = createImagePreview();
    previewContainer.style.display = 'flex';
    
    const imageWrapper = document.createElement('div');
    imageWrapper.style.cssText = `
        position: relative;
        display: inline-block;
    `;
    
    const img = document.createElement('img');
    img.src = imageData;
    img.style.cssText = `
        max-width: 100px;
        max-height: 60px;
        border-radius: 8px;
        object-fit: cover;
        border: 1px solid var(--border);
    `;
    
    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '×';
    removeBtn.style.cssText = `
        position: absolute;
        top: -8px;
        right: -8px;
        background: #ed4245;
        color: white;
        border: none;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    removeBtn.onclick = () => {
        const index = attachedImages.findIndex(img => img.data === imageData);
        if (index > -1) {
            attachedImages.splice(index, 1);
        }
        imageWrapper.remove();
        if (attachedImages.length === 0) {
            clearImagePreview();
        }
    };
    
    imageWrapper.appendChild(img);
    imageWrapper.appendChild(removeBtn);
    previewContainer.appendChild(imageWrapper);
    
    attachedImages.push({
        data: imageData,
        name: fileName || 'image'
    });
}

// Handle paste events
document.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    let foundImage = false;
    
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            foundImage = true;
            
            const blob = items[i].getAsFile();
            const reader = new FileReader();
            
            reader.onload = (event) => {
                addImageToPreview(event.target.result, 'pasted-image');
            };
            
            reader.readAsDataURL(blob);
            break;
        }
    }
});

// Handle drag and drop
userInput.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

userInput.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.indexOf('image') !== -1) {
            const reader = new FileReader();
            reader.onload = (event) => {
                addImageToPreview(event.target.result, file.name);
            };
            reader.readAsDataURL(file);
        }
    }
});

// ESC key handler
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const sets = document.getElementById('settings-overlay');
        if (sets.style.display === 'flex') attemptCloseSettings();
    }
});

document.getElementById('sign-in').addEventListener('click', async () => {
    try {
        const res = await puter.auth.signInWithPopup();
        userDisplayName = res.user.username;
        sideNameLabel.innerText = res.user.username;
        const loginBtn = document.getElementById('sign-in');
        loginBtn.style.display = 'none';
        showNotification('successfully logged in.');
    } catch (err) {
        showNotification('Failed to login', 'error');
    }
});

document.querySelector('.btn-connect-blue').addEventListener('click', () => {
    const connectBtn = document.querySelector('.btn-connect-blue');
    
    if (connectBtn.textContent === 'Connected') {
        connectBtn.textContent = 'Connect';
        connectBtn.style.background = 'var(--accent-blue)';
        showNotification('Disconnected from plugin', 'error');
    } else {
        connectBtn.textContent = 'Connected';
        connectBtn.style.background = '#27ae60';
        showNotification('game has been connected. Enjoy using PrysmiAI :)', 'success');
    }
});

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    const bgColor = type === 'error' ? '#ed4245' : '#2ecc71';
    notification.style.cssText = `
        position: fixed;
        top: 70px;
        left: 50%;
        transform: translateX(-50%);
        background: ${bgColor};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.9rem;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        opacity: 0;
        transition: all 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(-50%) translateY(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

userInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text && attachedImages.length === 0) return;

        const hero = document.getElementById('hero-presets');
        if (hero) hero.style.display = 'none';
        
        // Send message with images
        await sendMessageWithImages(text);
        
        userInput.value = '';
        userInput.style.height = '24px';
        clearImagePreview();
        attachedImages = [];

        const isGameMode = !isChatMode;
        if (!chatHistory.find(c => c.id === currentChatId)) {
            addToHistory(text, isGameMode);
        }
    }
});

async function sendMessageWithImages(text) {
    let messageContent = text;
    
    // Add images to message if any
    if (attachedImages.length > 0) {
        const imageHtml = attachedImages.map(img => 
            `<img src="${img.data}" style="max-width: 200px; max-height: 150px; border-radius: 8px; margin: 5px 0; display: block;" alt="${img.name}">`
        ).join('');
        
        renderMsg('user', text + (text ? '\n\n' : '') + imageHtml);
    } else {
        renderMsg('user', text);
    }

    const systemPrompt = isChatMode 
        ? `You are a professional AI. Chat naturally. The user's name is ${userDisplayName}.` 
        : `You are a Roblox Luau Expert. Provide clear explanations and code blocks for game making. The user's name is ${userDisplayName}.`;
    
    try {
        let aiRequest = text;
        if (attachedImages.length > 0) {
            aiRequest += '\n\n[User has attached ' + attachedImages.length + ' image(s). Please analyze any images provided.]';
        }
        
        const response = await puter.ai.chat(aiRequest, {
            model: modelSelect.value === 'claude-4-6-opus' ? 'claude-3-5-sonnet' : modelSelect.value,
            system_prompt: systemPrompt
        });
        renderMsg('ai', response.message.content);
    } catch (err) {
        console.error('AI Error:', err);
        renderMsg('ai', "Error: Ensure you are logged in to use PrysmisAI.");
    }
}

function addToHistory(text, isGameMode) {
    const chatObj = { id: currentChatId, title: text, isGame: isGameMode };
    chatHistory.unshift(chatObj);
    refreshHistoryUI();
}

function refreshHistoryUI() {
    historyList.innerHTML = '';
    chatHistory.forEach(chat => {
        const item = document.createElement('div');
        item.className = `sidebar-item ${chat.isGame ? 'game-mode' : ''}`;
        item.innerHTML = `
            <span class="item-text" id="title-${chat.id}">${chat.title}</span>
            <div class="actions">
                <span onclick="renameChat(${chat.id})">✎</span>
                <span onclick="deleteChat(${chat.id})">🗑</span>
            </div>
        `;
        item.onclick = (e) => {
            if (e.target.tagName !== 'SPAN') loadChat(chat.id);
        };
        historyList.appendChild(item);
    });
}

function renameChat(id) {
    const newTitle = prompt("Enter new name:");
    if (newTitle) {
        const chat = chatHistory.find(c => c.id === id);
        if (chat) {
            chat.title = newTitle;
            refreshHistoryUI();
        }
    }
}

// Handle preset item clicks
function handlePresetClick(element) {
    const prompt = element.getAttribute('data-prompt');
    const userInput = document.getElementById('user-input');
    userInput.value = prompt;
    userInput.focus();
    
    // Adjust textarea height
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
}

function deleteChat(id) {
    chatHistory = chatHistory.filter(c => c.id !== id);
    refreshHistoryUI();
    if (currentChatId === id) startNewChat();
}

function loadChat(id) {
    currentChatId = id;
    chatFlow.innerHTML = '<div style="color:#555; text-align:center; padding:50px;">Chat content would load here...</div>';
}

function renderMsg(role, content) {
    const div = document.createElement('div');
    div.className = `message ${role}-msg`;
    div.style.width = '100%';
    
    let html = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/```([\s\S]*?)```/g, (match, code) => {
            return `<code>${code.trim()}</code>`;
        });

    div.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:5px;">
            <div style="width:24px; height:24px; background:${role === 'user' ? '#7289da' : '#2ecc71'}; border-radius:6px;"></div>
            <span style="font-size:12px; color:#888; font-weight:800;">${role === 'user' ? 'YOU' : 'PRYSMISAI'}</span>
        </div>
        <div class="message-content" style="padding-left:34px; color:#e0e0e0;">${html}</div>
    `;
    
    chatFlow.appendChild(div);
    chatFlow.scrollTop = chatFlow.scrollHeight;
}

userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
});

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
            pendingPfp = e.target.result;
            pfpPreview.src = pendingPfp;
            showSettingsSave();
        };
        reader.readAsDataURL(file);
    }
}

function toggleSettings() {
    const sets = document.getElementById('settings-overlay');
    if (sets.style.display === 'flex') {
        attemptCloseSettings();
    } else {
        sets.style.display = 'flex';
        hideSettingsSave();
    }
}

function attemptCloseSettings() {
    if (hasUnsavedChanges) {
        saveBar.classList.add('flash-red');
        document.body.classList.add('shaking');
        setTimeout(() => {
            saveBar.classList.remove('flash-red');
            document.body.classList.remove('shaking');
        }, 600);
        return;
    }
    document.getElementById('settings-overlay').style.display = 'none';
}

function showSettingsSave() { 
    hasUnsavedChanges = true; 
    saveBar.classList.add('visible'); 
}

function hideSettingsSave() { 
    hasUnsavedChanges = false; 
    saveBar.classList.remove('visible'); 
    pendingPfp = null;
    nameInput.value = userDisplayName === "Guest" ? "" : userDisplayName;
}

function saveSettings() {
    userDisplayName = nameInput.value || userDisplayName;
    if (sideNameLabel) sideNameLabel.innerText = userDisplayName;
    if (pendingPfp && sidePfp) {
        sidePfp.src = pendingPfp;
    }
    hideSettingsSave();
    showNotification('Settings saved successfully');
    setTimeout(() => {
        document.getElementById('settings-overlay').style.display = 'none';
    }, 1500);
}
