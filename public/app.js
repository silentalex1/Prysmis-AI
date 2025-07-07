if (!localStorage.getItem('prysmisaiUser')) window.location.href = 'index.html'
const chatListEl = document.getElementById('chatList')
const messagesEl = document.getElementById('messages')
const messageInput = document.getElementById('messageInput')
const sendBtn = document.getElementById('sendBtn')
const aiSelect = document.getElementById('aiSelect')
const chatTitle = document.getElementById('chatTitle')
const newChatBtn = document.getElementById('newChatBtn')
const logoutBtn = document.getElementById('logoutBtn')
const chatgptKeyInput = document.getElementById('chatgptKey')
const saveSettingsBtn = document.getElementById('saveSettingsBtn')
let chats = JSON.parse(localStorage.getItem('prysmisaiChats') || '[]')
let currentChatId = null
let apis = JSON.parse(localStorage.getItem('prysmisaiAPIs') || '{}')
chatgptKeyInput.value = apis.chatgpt || ''
function saveChats() { localStorage.setItem('prysmisaiChats', JSON.stringify(chats)) }
function saveAPIs() { apis.chatgpt = chatgptKeyInput.value.trim(); localStorage.setItem('prysmisaiAPIs', JSON.stringify(apis)) }
function renderChatList() {
  chatListEl.innerHTML = ''
  chats.forEach((c,i) => {
    const li = document.createElement('li')
    li.textContent = c.title || 'Untitled Chat'
    if(i === currentChatId) li.classList.add('active')
    li.onclick = () => { currentChatId = i; renderChat(); renderChatList() }
    chatListEl.appendChild(li)
  })
}
function renderChat() {
  if(currentChatId === null) {
    messagesEl.innerHTML = ''
    chatTitle.textContent = 'New Chat'
    return
  }
  chatTitle.textContent = chats[currentChatId].title || 'Untitled Chat'
  messagesEl.innerHTML = ''
  chats[currentChatId].messages.forEach(m => {
    const div = document.createElement('div')
    div.className = 'message ' + (m.user ? 'user' : 'ai')
    div.textContent = m.text
    messagesEl.appendChild(div)
  })
  messagesEl.scrollTop = messagesEl.scrollHeight
}
async function sendMessage() {
  const text = messageInput.value.trim()
  if(!text) return
  if(currentChatId === null) {
    chats.push({title:text.slice(0,20),messages:[]})
    currentChatId = chats.length - 1
  }
  chats[currentChatId].messages.push({user:true,text})
  renderChat()
  saveChats()
  messageInput.value = ''
  const ai = aiSelect.value
  const res = await fetch('/api/chat', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message:text, ai, apis})
  })
  const data = await res.json()
  if(data.success) chats[currentChatId].messages.push({user:false,text:data.reply})
  else chats[currentChatId].messages.push({user:false,text:'AI error'})
  renderChat()
  saveChats()
}
sendBtn.onclick = sendMessage
messageInput.onkeydown = e => { if(e.key==='Enter') sendMessage() }
newChatBtn.onclick = () => {
  currentChatId = null
  chatTitle.textContent = 'New Chat'
  messagesEl.innerHTML = ''
  messageInput.value = ''
  renderChatList()
}
logoutBtn.onclick = () => {
  localStorage.removeItem('prysmisaiUser')
  window.location.href = 'index.html'
}
saveSettingsBtn.onclick = () => {
  saveAPIs()
  alert('Settings saved')
}
renderChatList()
renderChat()
