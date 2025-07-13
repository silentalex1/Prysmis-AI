const generateKeyBtn = document.getElementById('generateKeyBtn');
const keyOutput = document.getElementById('keyOutput');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveStatus = document.getElementById('saveStatus');

generateKeyBtn.onclick = async () => {
  const res = await fetch('/api/pyrsmis/key/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  keyOutput.textContent = data.key || 'Failed to generate key';
};

saveKeyBtn.onclick = async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    saveStatus.textContent = 'Please enter a key';
    return;
  }
  const sessionId = localStorage.getItem('pyrSession') || crypto.randomUUID();
  localStorage.setItem('pyrSession', sessionId);
  const res = await fetch('/api/pyrsmis/key/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, sessionId })
  });
  const data = await res.json();
  saveStatus.textContent = data.success ? 'Key saved successfully' : 'Failed to save key';
  if (data.success) apiKeyInput.value = '';
};
