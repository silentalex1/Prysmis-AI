const chatArea = document.getElementById('chatArea');
const input = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const modelSelect = document.getElementById('modelSelect');
const presets = document.getElementById('presets');
const projectsList = document.getElementById('projectsList');
const modal = document.getElementById('addGameModal');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistory = document.getElementById('chatHistory');

let currentChat = [];

function formatText(text) {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function addMessage(content, isUser) {
    const msg = document.createElement('div');
    msg.className = isUser ? 'user-msg' : 'ai-msg';
    
    if (!isUser) {
        const tag = document.createElement('span');
        tag.className = 'ai-tag';
        tag.textContent = 'PrysmisAI';
        msg.appendChild(tag);
        
        const textNode = document.createElement('div');
        textNode.innerHTML = formatText(content);
        msg.appendChild(textNode);
    } else {
        msg.textContent = content;
    }
    
    chatArea.appendChild(msg);
    chatArea.scrollTop = chatArea.scrollHeight;
    if (isUser) currentChat.push(content);
}

function showThinking() {
    const loader = document.createElement('div');
    loader.id = 'ai-thinking';
    loader.className = 'thinking-anim';
    loader.innerHTML = `
        <div class="thinking-text">PrysmisAI is thinking...</div>
        <div class="thinking-bar"></div>
    `;
    chatArea.appendChild(loader);
    chatArea.scrollTop = chatArea.scrollHeight;
}

function removeThinking() {
    const loader = document.getElementById('ai-thinking');
    if (loader) loader.remove();
}

sendBtn.onclick = async () => {
    const text = input.value.trim();
    if (!text) return;
    
    addMessage(text, true);
    input.value = '';
    presets.style.display = 'none';
    
    showThinking();
    
    try {
        const res = await fetch(`/v1/chat/completions?model=${encodeURIComponent(modelSelect.value.toLowerCase().replace(/\s+/g, '-'))}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: text }],
                temperature: 0.7,
                max_tokens: 2048
            })
        });
        
        const data = await res.json();
        removeThinking();
        const reply = data.choices?.[0]?.message?.content || 'No response';
        addMessage(reply, false);
    } catch (e) {
        removeThinking();
        addMessage('System Error: ' + e.message, false);
    }
};

newChatBtn.onclick = () => {
    if (currentChat.length > 0) {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.textContent = currentChat[0].substring(0, 25) + '...';
        chatHistory.prepend(item);
    }
    chatArea.innerHTML = '';
    chatArea.appendChild(presets);
    presets.style.display = 'block';
    currentChat = [];
    input.value = '';
};

input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
});

function usePreset(i) {
    const texts = [
        "Create me a map that is ",
        "Make me a character that animates ",
        "Make me an advanced loading startup screen that does "
    ];
    input.value = texts[i];
    input.focus();
}

function toggleExplorer() {
    document.getElementById('explorer').classList.toggle('open');
}

function showTab(tab) {
    document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.viewport').forEach(c => c.style.display = 'none');
    event.target.classList.add('active');
    document.getElementById(tab + 'Tab').style.display = 'flex';
}

function openModal() { modal.style.display = 'flex'; }
function closeModal() { modal.style.display = 'none'; }
