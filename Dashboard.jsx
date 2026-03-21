import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Dashboard = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'PrysmisAI online. Claude Opus 4.6 / Gemini 3.2 / GPT-5.2 ready. What do you want to build today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState('Claude Opus 4.6');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`/v1/chat/completions?model=${encodeURIComponent(model.toLowerCase().replace(/\s+/g, '-'))}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          temperature: 0.7,
          max_tokens: 2048
        })
      });

      const data = await res.json();

      if (data.choices && data.choices[0]?.message?.content) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.choices[0].message.content }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + (data.error?.message || 'No response') }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Connection error: ${err.message}` }]);
    }

    setIsLoading(false);
  };

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col">
     
      <nav className="h-16 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl" />
          <span className="text-xl font-bold tracking-tight">PrysmisAI Builder</span>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            className="bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-2 text-sm outline-none cursor-pointer hover:border-blue-500/50 transition-all"
          >
            <option>Claude Opus 4.6</option>
            <option>Gemini 3.2</option>
            <option>ChatGPT 5.2</option>
          </select>
          <button className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-medium hover:brightness-110 transition-all">
            Connect Roblox Plugin
          </button>
        </div>
      </nav>

    
      <div className="flex flex-1 overflow-hidden">
       
        <aside className="w-80 bg-[#0a0a0f] border-r border-white/5 p-6 overflow-y-auto">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">Project Explorer</h3>
          <div className="space-y-2 text-sm">
            <div className="p-3 bg-white/5 rounded-xl hover:bg-white/10 cursor-pointer">Workspace</div>
            <div className="p-3 bg-white/5 rounded-xl hover:bg-white/10 cursor-pointer pl-8">Starter Scripts</div>
            <div className="p-3 bg-white/5 rounded-xl hover:bg-white/10 cursor-pointer">ReplicatedStorage</div>
            <div className="p-3 bg-white/5 rounded-xl hover:bg-white/10 cursor-pointer pl-8">Remote Events</div>
          </div>
        </aside>

      
        <main className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-5 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-blue-600/80 backdrop-blur-sm'
                      : 'bg-[#1a1a2e] border border-white/5'
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#1a1a2e] p-5 rounded-2xl animate-pulse">Thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

        
          <div className="p-6 border-t border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
            <div className="relative max-w-4xl mx-auto">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                placeholder="Ask Claude Opus 4.6, Gemini 3.2, or GPT-5.2 to build something..."
                className="w-full bg-[#111] border border-white/10 rounded-2xl p-6 pr-24 text-white placeholder-gray-500 resize-none outline-none focus:border-blue-500/50 transition-all min-h-[80px]"
                rows={2}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="absolute right-4 bottom-4 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
