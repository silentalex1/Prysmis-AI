document.addEventListener('DOMContentLoaded', () => {
  const chatArea = document.getElementById('chatArea');
  const input = document.getElementById('input');
  const sendBtn = document.getElementById('sendBtn');
  const modelSelect = document.getElementById('modelSelect');
  const connectBtn = document.getElementById('connectBtn');

  function addMessage(content, isUser) {
    const msg = document.createElement('div');
    msg.className = isUser ? 'user-msg' : 'ai-msg';
    msg.textContent = content;
    chatArea.appendChild(msg);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  addMessage('PrysmisAI online. Ready to build.', false);

  sendBtn.onclick = async () => {
    if (!input.value.trim()) return;
    const text = input.value.trim();
    addMessage(text, true);
    input.value = '';

    try {
      const res = await fetch(`/v1/chat/completions?model=${encodeURIComponent(modelSelect.value.toLowerCase().replace(/\s+/g, '-'))}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          messages: [{role:'user', content: text}],
          temperature: 0.7,
          max_tokens: 2048
        })
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || 'No response';
      addMessage(reply, false);
    } catch (e) {
      addMessage('Error: ' + e.message, false);
    }
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  connectBtn.onclick = () => {
    alert('Plugin connection coming soon. For now, use the chat directly.');
  };
});
