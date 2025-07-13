const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatWindow = document.getElementById('chatWindow');
const saveKeyBtn = document.getElementById('saveKey');
const keyInput = document.getElementById('pyrsmisKey');
const consoleBtn = document.getElementById('consoleBtn');
consoleBtn.onclick = () => location.href = 'http://platform.localhost:3000/console.html';
let sessionId = localStorage.getItem('pyrSession') || crypto.randomUUID();
localStorage.setItem('pyrSession', sessionId);
keyInput.value = localStorage.getItem('pyrKey') || '';
saveKeyBtn.onclick = async () => {
  const key = keyInput.value.trim();
  if (!key) return;
  await fetch('/api/pyrsmis/key/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, sessionId })
  });
  localStorage.setItem('pyrKey', key);
  keyInput.value = key;
};
chatForm.onsubmit = async e => {
  e.preventDefault();
  const prompt = chatInput.value.trim();
  if (!prompt) return;
  appendMessage('user', prompt);
  chatInput.value = '';
  appendMessage('ai', 'Processing...');
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, sessionId })
  });
  const data = await res.json();
  updateLastMessage(data.response || 'Request failed');
};
function appendMessage(role, text) {
  const msg = document.createElement('div');
  msg.className = `message ${role}`;
  msg.textContent = text;
  chatWindow.appendChild(msg);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
function updateLastMessage(text) {
  const msgs = chatWindow.getElementsByClassName('message');
  msgs[msgs.length - 1].textContent = text;
  chatWindow.scrollTop = chatWindow.scrollHeight;
}