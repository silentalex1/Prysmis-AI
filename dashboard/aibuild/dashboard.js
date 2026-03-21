const chatArea=document.getElementById('chatArea')
const input=document.getElementById('input')
const sendBtn=document.getElementById('sendBtn')
const modelSelect=document.getElementById('modelSelect')
const connectBtn=document.getElementById('connectBtn')
const presets=document.getElementById('presets')
const intro=document.querySelector('.intro')

function addMessage(content,isUser){
  const msg=document.createElement('div')
  msg.className=isUser?'user-msg':'ai-msg'
  msg.textContent=content
  chatArea.appendChild(msg)
  chatArea.scrollTop=chatArea.scrollHeight
}

addMessage('PrysmisAI online. Ready to build.',false)

sendBtn.onclick=async()=>{
  if(!input.value.trim()||isProcessing)return
  const text=input.value.trim()
  addMessage(text,true)
  input.value=''
  presets.style.display='none'
  intro.style.display='none'
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
