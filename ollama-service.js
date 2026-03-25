const { spawn } = require('child_process');
const path = require('path');

const ollamaPath = 'ollama';

function startOllama() {
  const proc = spawn(ollamaPath, ['serve'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  
  proc.unref();
  
  console.log('Ollama service started on port 11434');
  console.log('Process PID:', proc.pid);
}

startOllama();

setInterval(() => {
  console.log('Ollama service heartbeat - running...');
}, 60000);
