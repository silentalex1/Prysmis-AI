const chatArea=document.getElementById('chatArea')
const input=document.getElementById('input')
const sendBtn=document.getElementById('sendBtn')
const modelSelect=document.getElementById('modelSelect')
const connectBtn=document.getElementById('connectBtn')
const presets=document.getElementById('presets')
const projectsList=document.getElementById('projectsList')
const addGameBtn=document.getElementById('addGameBtn')
const modal=document.getElementById('addGameModal')
const newChatBtn=document.getElementById('newChatBtn')
const chatHistory=document.getElementById('chatHistory')

let currentChat = [];

function addMessage(content,isUser){
  const msg=document.createElement('div')
  msg.className=isUser?'user-msg':'ai-msg'
  msg.textContent=content
  chatArea.appendChild(msg)
  chatArea.scrollTop=chatArea.scrollHeight
  if(isUser) currentChat.push(content)
}

newChatBtn.onclick=()=>{
    if(currentChat.length > 0){
        const item = document.createElement('div')
        item.className = 'history-item'
        item.textContent = currentChat[0].substring(0, 30) + '...'
        chatHistory.prepend(item)
    }
    chatArea.innerHTML = ''
    presets.style.display = 'flex'
    currentChat = []
}

sendBtn.onclick=async()=>{
  if(!input.value.trim())return
  const text=input.value.trim()
  addMessage(text,true)
  input.value=''
  presets.style.display='none'
  try{
    const res=await fetch(`/v1/chat/completions?model=${encodeURIComponent(modelSelect.value.toLowerCase().replace(/\s+/g,'-'))}`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        messages:[{role:'user',content:text}],
        temperature:0.7,
        max_tokens:2048
      })
    })
    const data=await res.json()
    const reply=data.choices?.[0]?.message?.content||'No response'
    addMessage(reply,false)
  }catch(e){
    addMessage('Error: '+e.message,false)
  }
}

input.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey){
    e.preventDefault()
    sendBtn.click()
  }
})

function usePreset(i){
  const texts=[
    "Create me a map that is ",
    "Make me a character that animates ",
    "Make me an advanced loading startup screen that does "
  ]
  input.value=texts[i]
  input.focus()
}

function toggleExplorer(){
  document.getElementById('explorer').classList.toggle('open')
}

connectBtn.onclick=()=>{
  alert('Plugin connection coming soon.')
}

function showTab(tab){
  document.querySelectorAll('.tab-link').forEach(t=>t.classList.remove('active'))
  document.querySelectorAll('.viewport').forEach(c=>c.style.display='none')
  event.target.classList.add('active')
  document.getElementById(tab+'Tab').style.display='flex'
  if(tab==='projects')loadProjects()
}

async function loadProjects(){
  const res=await fetch('/projects')
  const projects=await res.json()
  projectsList.innerHTML=''
  projects.forEach(p=>{
    const card=document.createElement('div')
    card.className='project-card'
    card.innerHTML=`<h3>${p.title}</h3><p>${p.about}</p><a href="${p.link}" target="_blank">Play on Roblox</a>`
    projectsList.appendChild(card)
  })
}

addGameBtn.onclick=()=>modal.style.display='flex'
function closeModal(){modal.style.display='none'}

postGameBtn.onclick=async()=>{
  const title=document.getElementById('gameTitle').value.trim()
  const about=document.getElementById('gameAbout').value.trim()
  const link=document.getElementById('gameLink').value.trim()
  if(!title||!about||!link)return alert('Fill all fields')
  const res=await fetch('/project',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({token:localStorage.getItem('token'),title,about,link})
  })
  if(res.ok){
    modal.style.display='none'
    loadProjects()
  }
}

loadProjects()
