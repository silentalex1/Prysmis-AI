import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const [stats, setStats] = useState({ users: 0, active: 0, projects: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setStats(prev => ({
        users: prev.users + Math.floor(Math.random() * 3) + 1,
        active: Math.floor(Math.random() * 15) + 10,
        projects: prev.projects + Math.floor(Math.random() * 5) + 2
      }));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050505] to-[#0a0a15] text-white">
      <section className="h-screen flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.12),transparent_50%)]" />
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="text-center z-10 px-6"
        >
          <h1 className="text-7xl md:text-9xl font-black tracking-tighter bg-gradient-to-br from-white via-blue-300 to-purple-400 bg-clip-text text-transparent">
            PrysmisAI
          </h1>
          <p className="mt-6 text-xl md:text-2xl text-gray-300 font-light tracking-wide">
            AI-Powered Roblox Game Builder • Claude Opus 4.6 • Gemini 3.2 • GPT-5.2
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/accountauth')}
            className="mt-10 px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full font-bold text-lg shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all"
          >
            Start Building Now
          </motion.button>
        </motion.div>
      </section>

      <section className="py-32 px-6 bg-black/40">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h3 className="text-6xl font-bold text-blue-400">{stats.users}+</h3>
            <p className="mt-4 text-gray-400 uppercase text-sm tracking-widest">Builders</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h3 className="text-6xl font-bold text-white">{stats.active}</h3>
            <p className="mt-4 text-gray-400 uppercase text-sm tracking-widest">Active Now</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h3 className="text-6xl font-bold text-purple-400">{stats.projects}+</h3>
            <p className="mt-4 text-gray-400 uppercase text-sm tracking-widest">Games Built</p>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;
