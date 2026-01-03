const loginBtn = document.getElementById('login-btn');
const authPage = document.getElementById('auth-page');
const chatPage = document.getElementById('chat-page');
const chatViewport = document.getElementById('chat-viewport');
const userInput = document.getElementById('user-input');
const chatMessages = document.getElementById('chat-messages');
const imagePreview = document.getElementById('image-preview-container');
const historyList = document.getElementById('history-list');

loginBtn.addEventListener('click', async () => {
    const user = await puter.auth.signIn();
    if (user) {
        window.history.pushState({}, '', '/aichat');
        authPage.style.opacity = '0';
        authPage.style.transition = '0.5s';
        setTimeout(() => {
            authPage.classList.add('hidden');
            chatPage.classList.remove('hidden');
        }, 500);
    }
});

userInput.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    for (let item of items) {
        if (item.type.indexOf("image") !== -1) {
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => {
                imagePreview.classList.remove('hidden');
                imagePreview.innerHTML = `<img src="${event.target.result}" class="preview-img">`;
            };
            reader.readAsDataURL(blob);
        }
    }
});

userInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && userInput.value.trim() !== "") {
        const val = userInput.value;
        userInput.value = "";
        imagePreview.classList.add('hidden');
        imagePreview.innerHTML = "";
        
        chatViewport.classList.add('zoom-active');
        appendMsg('user', val);
        addHistoryItem(val);

        try {
            const resp = await puter.ai.chat(val, { model: 'gemini-3' });
            renderAI(resp.toString());
        } catch (err) {
            renderAI("System Failure: Re-authentication required.");
        }
    }
});

function appendMsg(role, text) {
    const div = document.createElement('div');
    div.className = 'message';
    div.innerHTML = `<div class="${role}-label">${role}</div><div style="color: #bbb; line-height: 1.6;">${text}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addHistoryItem(text) {
    const item = document.createElement('div');
    item.style = "padding:12px; font-size:0.8rem; color:#555; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:0.3s; border-radius:8px;";
    item.onmouseover = () => item.style.color = "#fff";
    item.onmouseout = () => item.style.color = "#555";
    item.textContent = text;
    historyList.prepend(item);
}

async function renderAI(text) {
    const div = document.createElement('div');
    div.className = 'message';
    div.innerHTML = `<div class="ai-label">PrysmisAI</div><div class="content" style="position:relative;"></div>`;
    chatMessages.appendChild(div);
    
    const target = div.querySelector('.content');
    const words = text.split(' ');
    
    for(let i=0; i<words.length; i++) {
        const span = document.createElement('span');
        span.className = 'word';
        span.style.animationDelay = `${i * 0.03}s`;
        span.textContent = words[i] + ' ';
        target.appendChild(span);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    setTimeout(() => {
        const line = document.createElement('div');
        line.className = 'neural-line scan-active';
        target.appendChild(line);
        
        target.classList.add('glow-text');
        
        setTimeout(() => {
            target.classList.remove('glow-text');
            chatViewport.classList.remove('zoom-active');
        }, 1200);
    }, words.length * 30 + 300);
}
