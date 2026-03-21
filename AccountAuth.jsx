import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const AccountAuth = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-lg bg-[#0f0f1a] border border-white/5 p-12 rounded-3xl shadow-2xl backdrop-blur-xl"
      >
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            PrysmisAI
          </h2>
          <p className="mt-3 text-gray-400">Create your builder account</p>
        </div>

        <div className="space-y-6">
          <input
            type="text"
            placeholder="Username"
            className="w-full bg-[#1a1a2e] border border-white/10 p-5 rounded-2xl text-white placeholder-gray-500 focus:border-blue-500/50 outline-none transition-all"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full bg-[#1a1a2e] border border-white/10 p-5 rounded-2xl text-white placeholder-gray-500 focus:border-blue-500/50 outline-none transition-all"
          />
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/dashboard/project')}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-5 rounded-2xl font-bold text-lg shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 transition-all"
          >
            Create Account
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default AccountAuth;
