import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video, Plus, ArrowRight, Lock, Unlock, User } from "lucide-react";
import { motion } from "motion/react";
import DailyVerses from "../components/DailyVerses";
import ThemeToggle from "../components/ThemeToggle";
import { useTheme } from "../context/ThemeContext";

export default function Home() {
  const { theme } = useTheme();
  const [userName, setUserName] = useState(localStorage.getItem("jitsi_user_name") || "");
  const [roomUrl, setRoomUrl] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const navigate = useNavigate();

  const generateRoomName = () => {
    const now = new Date();
    const datePart = now.toISOString().split('T')[0].replace(/-/g, '');
    const timePart = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
    return `devocional-${datePart}-${timePart}-${Math.floor(Math.random() * 1000)}`;
  };

  const saveUser = (name: string) => {
    setUserName(name);
    localStorage.setItem("jitsi_user_name", name);
  };

  const createRoom = () => {
    const name = generateRoomName();
    navigate(`/room/${name}${usePassword ? '?pwd=true' : ''}`);
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomUrl) {
      // Extrair o nome da sala da URL ou usar o texto direto
      const name = roomUrl.includes("/") ? roomUrl.split("/").pop() : roomUrl;
      if (name) navigate(`/room/${name}`);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center py-6 px-6 font-sans relative transition-colors duration-300 ${theme === 'dark' ? 'text-white/90' : 'text-slate-900'}`}>
      {/* Theme Toggle Button */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-[-10%] left-[-10%] w-[60%] h-[60%] blur-[120px] rounded-full transition-colors duration-500 ${theme === 'dark' ? 'bg-brand-blue-royal/20' : 'bg-indigo-200/30'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] blur-[120px] rounded-full transition-colors duration-500 ${theme === 'dark' ? 'bg-brand-blue-deep/20' : 'bg-blue-100/30'}`} />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[480px] w-full space-y-6 relative z-10"
      >
        {/* Header Section */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <motion.div 
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className={`p-3 rounded-2xl border shadow-2xl transition-all duration-300 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}
            >
              <Video className={`w-8 h-8 ${theme === 'dark' ? 'text-emerald-400' : 'text-indigo-600'}`} />
            </motion.div>
          </div>
          <div className="space-y-1">
            <h1 className={`text-4xl font-black tracking-tighter drop-shadow-2xl transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              DevocionalMeet
            </h1>
            <div className={`inline-flex items-center px-3 py-1 rounded-full border text-[9px] font-bold uppercase tracking-[0.3em] transition-all duration-300 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white/60' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
              <span className={`w-1 h-1 rounded-full mr-2 animate-pulse ${theme === 'dark' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
              Comunhão & Fé
            </div>
          </div>
        </div>

        {/* Daily Verses Section */}
        <DailyVerses />

        {/* Meeting Controls Card */}
        <div className={`p-6 rounded-2xl shadow-2xl space-y-4 transition-all duration-300 ${theme === 'dark' ? 'glass-card-dark' : 'glass-card-light'}`}>
          {/* Nome do Usuário */}
          <div className="space-y-1.5">
            <label className={`text-[9px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 ml-1 transition-colors duration-300 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>
              <User className="w-3 h-3" /> Identificação
            </label>
            <input
              type="text"
              placeholder="Seu nome para a reunião"
              value={userName}
              onChange={(e) => saveUser(e.target.value)}
              className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-all text-sm ${theme === 'dark' ? 'bg-black/20 border-white/10 focus:ring-emerald-500/50 placeholder:text-white/20 text-white' : 'bg-white border-slate-200 focus:ring-indigo-500/50 placeholder:text-slate-300 text-slate-900'}`}
            />
          </div>

          {/* Opções de Segurança */}
          <div className={`p-3 rounded-xl border transition-all duration-300 ${theme === 'dark' ? 'bg-black/20 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg transition-colors duration-300 ${usePassword ? (theme === 'dark' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-100 text-indigo-600') : (theme === 'dark' ? 'bg-white/5 text-white/40' : 'bg-slate-200 text-slate-400')}`}>
                  {usePassword ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${theme === 'dark' ? 'text-white/60' : 'text-slate-500'}`}>Senha na sala</span>
              </div>
              <button 
                onClick={() => setUsePassword(!usePassword)}
                className={`w-10 h-5 rounded-full transition-all relative ${usePassword ? (theme === 'dark' ? 'bg-emerald-600' : 'bg-indigo-600') : (theme === 'dark' ? 'bg-white/10' : 'bg-slate-300')}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${usePassword ? 'left-5.5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={createRoom}
              className={`w-full text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all shadow-xl active:scale-[0.98] ${theme === 'dark' ? 'bg-brand-accent hover:bg-emerald-500 shadow-emerald-900/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20'}`}
            >
              <Plus className="w-5 h-5" />
              Nova Reunião
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className={`w-full border-t transition-colors duration-300 ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}></div>
              </div>
              <div className="relative flex justify-center text-[9px] uppercase tracking-widest">
                <span className={`px-2 font-black transition-colors duration-300 ${theme === 'dark' ? 'bg-black text-white/30' : 'bg-white text-slate-300'}`}>Ou entre com link</span>
              </div>
            </div>

            <form onSubmit={joinRoom} className="flex gap-2">
              <input
                type="text"
                placeholder="Link ou código"
                value={roomUrl}
                onChange={(e) => setRoomUrl(e.target.value)}
                className={`flex-1 border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-all text-sm ${theme === 'dark' ? 'bg-black/20 border-white/10 focus:ring-emerald-500/50 placeholder:text-white/20 text-white' : 'bg-white border-slate-200 focus:ring-indigo-500/50 placeholder:text-slate-300 text-slate-900'}`}
              />
              <button
                type="submit"
                className={`p-3 rounded-xl transition-all active:scale-[0.95] border ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10 text-emerald-400' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-indigo-600'}`}
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center space-y-3 pb-4">
          <div className="flex justify-center gap-6 opacity-20">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}><Video className="w-3 h-3" /></div>
              <span className="text-[7px] font-bold uppercase">Vídeo HD</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}><Lock className="w-3 h-3" /></div>
              <span className="text-[7px] font-bold uppercase">Seguro</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}><Plus className="w-3 h-3" /></div>
              <span className="text-[7px] font-bold uppercase">Grátis</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
