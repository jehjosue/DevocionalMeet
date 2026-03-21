import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, Plus, ArrowRight, Lock, User, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import DailyVerses from "../components/DailyVerses";
import { useTheme } from "../context/ThemeContext";
import { createPortal } from "react-dom";

function getUserId() {
  let userId = localStorage.getItem("dmeet_userId");
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("dmeet_userId", userId);
  }
  return userId;
}


function salvarNome(nome: string) {
  localStorage.setItem("dmeet_name", nome);
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);


  // Se veio de convite, começa com nome vazio. Se não, carrega nome salvo.
  const nomeSalvo = localStorage.getItem("dmeet_name") || "";

  const [userName, setUserName] = useState<string>(nomeSalvo);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Detecção automática de link de convite
  useEffect(() => {
    const roomId = searchParams.get("roomId");
    if (roomId && userName.trim()) {
      // Já tem nome salvo, entra direto
      handleJoinRoom(roomId);
    }
  }, []);

  const handleOpenMenu = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    }
    setShowMenu(p => !p);
  };

  function showToast(message: string, duration = 4000) {
    const existing = document.getElementById('dmeet-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'dmeet-toast';
    toast.innerText = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15,15,15,0.92);
      color: white;
      padding: 13px 24px;
      border-radius: 999px;
      font-size: 0.88rem;
      font-family: system-ui;
      z-index: 99999;
      white-space: nowrap;
      max-width: 88vw;
      overflow: hidden;
      text-overflow: ellipsis;
      backdrop-filter: blur(16px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      pointer-events: none;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // Fechar ao clicar fora
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-menu]') && !t.closest('[data-menu-btn]')) {
        setShowMenu(false);
      }
    };
    const timer = setTimeout(() =>
      document.addEventListener('mousedown', handler), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [showMenu]);

  const handleGenerateLink = async () => {
    setShowMenu(false);

    const name = userName.trim();
    if (!name) {
      showToast('⚠️ Digite seu nome antes de gerar o link');
      return;
    }
    
    setIsLoading(true);

    let userId = localStorage.getItem('dmeet_userId');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('dmeet_userId', userId);
    }

    // URL ABSOLUTA do back-end na VPS — front no Vercel, back em api.devocionalmeet.shop
    const API = 'https://api.devocionalmeet.shop';
    const endpoint = `${API}/rooms/create?v=${Date.now()}`;
    console.warn('[DM-DEBUG-v1.0.3] Chamando API...', {
      url: endpoint,
      time: new Date().toISOString()
    });
    showToast('⏳ Conectando ao servidor...');

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ userId, userName: name }),
      });

      console.log('[DM] Status:', res.status);

      // Detectar se vercel.json retornou HTML em vez de JSON
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        console.error('[DM] Servidor retornou HTML — problema no vercel.json');
        showToast('❌ Erro de configuração do servidor (vercel.json)');
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        console.error('[DM] Erro servidor:', text);
        showToast(`❌ Erro ${res.status}: ${text}`);
        return;
      }

      const data = await res.json();
      console.log('[DM] Sucesso:', data);

      if (!data.link) {
        showToast('❌ Servidor não retornou o link.');
        return;
      }

      localStorage.setItem('dmeet_name', name);
      localStorage.setItem('dmeet_lastLink', data.link);

      try {
        await navigator.clipboard.writeText(data.link);
      } catch {
        // Safari bloqueia clipboard sem interação explícita
        console.warn('[DM] Clipboard bloqueado pelo Safari');
      }

      showToast('✅ Link copiado: ' + data.link.replace('https://', ''));

    } catch (err: any) {
      console.error('[DM] Fetch error:', err.name, err.message);
      if (err.name === 'TypeError' && err.message === 'Load failed') {
        showToast('❌ Safari bloqueou a conexão — verifique CORS e HTTPS no servidor');
      } else if (err.message?.includes('Failed to fetch')) {
        showToast('❌ Servidor inacessível — verifique se o backend está online');
      } else {
        showToast('❌ Erro: ' + (err.message || 'desconhecido'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const enterFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(err => console.warn(err));
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          (document.documentElement as any).webkitRequestFullscreen();
        } else if ((document.documentElement as any).msRequestFullscreen) {
          (document.documentElement as any).msRequestFullscreen();
        }
      }
    } catch (e) {
      console.warn("Fullscreen API failed", e);
    }
  };

  const handleStartNow = async () => {
    setShowMenu(false);
    enterFullscreen();

    const name = userName.trim();
    if (!name) {
      showToast('⚠️ Digite seu nome antes de iniciar');
      return;
    }
    
    setIsLoading(true);

    let userId = localStorage.getItem('dmeet_userId');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('dmeet_userId', userId);
    }

    // URL ABSOLUTA do back-end na VPS — front no Vercel, back em api.devocionalmeet.shop
    const API = 'https://api.devocionalmeet.shop';
    const endpoint = `${API}/rooms/create`;
    console.log('[DM] Iniciando reunião...', { endpoint, userId, name });
    showToast('⏳ Criando sala...');

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ userId, userName: name }),
      });

      console.log('[DM] Status:', res.status);

      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        console.error('[DM] Servidor retornou HTML — problema no vercel.json');
        showToast('❌ Erro de configuração do servidor (vercel.json)');
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        console.error('[DM] Erro:', text);
        showToast(`❌ Erro ao criar sala: ${res.status}`);
        return;
      }

      const data = await res.json();
      console.log('[DM] Sala criada:', data);

      if (!data.code) {
        showToast('❌ Servidor não retornou o código da sala.');
        return;
      }

      localStorage.setItem('dmeet_name', name);
      localStorage.setItem('dmeet_role', 'leader');
      localStorage.setItem('dmeet_roomCode', data.code);

      navigate(`/room/${data.code}?host=true`);

    } catch (err: any) {
      console.error('[DM] Fetch error:', err.name, err.message);
      if (err.name === 'TypeError' && err.message === 'Load failed') {
        showToast('❌ Safari bloqueou a conexão — verifique CORS e HTTPS no servidor');
      } else if (err.message?.includes('Failed to fetch')) {
        showToast('❌ Servidor offline. Verifique se o backend está rodando.');
      } else {
        showToast('❌ Erro: ' + (err.message || 'desconhecido'));
      }
    } finally {
      setIsLoading(false);
    }
  };


  const handleJoinWithCode = () => {
    if (!userName.trim()) return;
    setShowCodeModal(true);
  };

  const handleJoinRoom = (code: string) => {
    const clean = code.trim().toLowerCase();
    if (!clean || !userName.trim()) return;
    
    // Salva nome e role
    localStorage.setItem('dmeet_name', userName.trim());
    localStorage.setItem('dmeet_role', 'guest');
    
    // Extrai código se vier URL completa
    let finalCode = clean;
    if (finalCode.includes("/room/")) {
      finalCode = finalCode.split("/room/")[1].split("?")[0];
    }
    finalCode = finalCode.split("?")[0];
    
    enterFullscreen();
    navigate(`/room/${finalCode}`);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center py-6 px-6 font-sans relative overflow-hidden"
      style={{
        background: isDark ? "#09090E" : "#F4F7FB",
        color: isDark ? "#E9EDEF" : "#1e293b",
        transition: "background 0.5s ease",
      }}
    >
      {/* BACKGROUND MESH BLOBS MODERNO */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {isDark ? (
          <>
            <motion.div
              animate={{
                x: [0, 50, -50, 0],
                y: [0, -50, 50, 0],
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full opacity-20 blur-[100px]"
              style={{ background: "radial-gradient(circle, rgba(37,99,235,0.8) 0%, transparent 70%)" }}
            />
            <motion.div
              animate={{
                x: [0, -40, 40, 0],
                y: [0, 40, -40, 0],
              }}
              transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              className="absolute top-[40%] -right-[20%] w-[60vw] h-[60vw] rounded-full opacity-10 blur-[90px]"
              style={{ background: "radial-gradient(circle, rgba(139,92,246,0.6) 0%, transparent 70%)" }}
            />
          </>
        ) : (
          <>
            <motion.div
              animate={{
                x: [0, 30, -30, 0],
                y: [0, -30, 30, 0],
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full opacity-30 blur-[100px]"
              style={{ background: "radial-gradient(circle, rgba(59,130,246,0.7) 0%, transparent 70%)" }}
            />
            <motion.div
              animate={{
                x: [0, -40, 40, 0],
                y: [0, 40, -40, 0],
              }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute top-[20%] -right-[20%] w-[80vw] h-[80vw] rounded-full opacity-20 blur-[120px]"
              style={{ background: "radial-gradient(circle, rgba(96,165,250,0.5) 0%, transparent 70%)" }}
            />
          </>
        )}
      </div>

      {/* Botão de Toggle de Tema (Glass) */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 w-11 h-11 rounded-2xl flex items-center justify-center z-50 transition-all hover:scale-105 active:scale-95"
        style={{
          background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.7)",
          backdropFilter: "blur(12px)",
          border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.8)",
          boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,0,0,0.05)",
        }}
      >
        {isDark ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>

      {/* CONTEÚDO PRINCIPAL (Glass Card) */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[440px] relative z-10 flex flex-col gap-6"
      >
        {/* LOGO E TEXTOS */}
        <div className="text-center space-y-4 mb-4">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="w-16 h-16 mx-auto rounded-3xl flex items-center justify-center"
            style={{
              background: isDark ? "linear-gradient(135deg, rgba(37,99,235,0.2), rgba(37,99,235,0.05))" : "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(255,255,255,0.8))",
              border: isDark ? "1px solid rgba(37,99,235,0.3)" : "1px solid rgba(255,255,255,0.9)",
              boxShadow: isDark ? "0 8px 32px rgba(37,99,235,0.15)" : "0 8px 32px rgba(37,99,235,0.08)",
              backdropFilter: "blur(10px)",
            }}
          >
            <BookOpen strokeWidth={2.5} className="w-8 h-8 text-blue-600 dark:text-blue-400 drop-shadow-md" />
          </motion.div>
          <div className="space-y-1.5">
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text" style={{ backgroundImage: isDark ? "linear-gradient(90deg, #93C5FD, #3B82F6)" : "linear-gradient(90deg, #1E3A8A, #2563EB)" }}>
              DevocionalMeet
            </h1>
            <p className="text-[0.8rem] font-bold tracking-[0.2em] uppercase" style={{ color: isDark ? "#8896AA" : "#64748B" }}>
              Comunhão &amp; Fé
            </p>
          </div>
        </div>

        {/* CONTAINER DO FORMULÁRIO (GLASSMORPHISM) */}
        <div
          className="p-6 md:p-8 rounded-[32px] w-full"
          style={{
            background: isDark ? "rgba(20, 20, 30, 0.4)" : "rgba(255, 255, 255, 0.6)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.8)",
            boxShadow: isDark ? "0 24px 48px rgba(0,0,0,0.4)" : "0 24px 48px rgba(0,0,0,0.05)",
          }}
        >
          <div className="space-y-6">
            {/* INPUT DE NOME */}
            <div className="space-y-2 relative">
              <label className="text-xs font-bold uppercase tracking-widest ml-1" style={{ color: isDark ? "rgba(255,255,255,0.5)" : "#64748B" }}>
                Seu nome
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Como você quer aparecer"
                  value={userName}
                  onChange={(e) => {
                    setUserName(e.target.value);
                    salvarNome(e.target.value);
                  }}
                  className="w-full rounded-2xl pl-11 pr-4 py-4 text-[1.05rem] transition-all outline-none font-medium"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && userName.trim()) {
                      const rId = searchParams.get("roomId");
                      if (rId) handleJoinRoom(rId);
                    }
                  }}
                  style={{
                    background: isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.8)",
                    border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(37,99,235,0.15)",
                    color: isDark ? "#fff" : "#101828",
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3B82F6';
                    e.currentTarget.style.boxShadow = isDark ? '0 0 0 3px rgba(59,130,246,0.2)' : '0 0 0 4px rgba(59,130,246,0.15)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(37,99,235,0.15)";
                    e.currentTarget.style.boxShadow = "inset 0 2px 4px rgba(0,0,0,0.02)";
                  }}
                />
              </div>
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="flex flex-col sm:flex-row gap-3">
              {searchParams.get("roomId") ? (
                <button
                  onClick={() => handleJoinRoom(searchParams.get("roomId")!)}
                  disabled={!userName.trim()}
                  className="group relative w-full rounded-2xl py-4 flex justify-center items-center overflow-hidden transition-all active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                    color: "#fff",
                    opacity: userName.trim() ? 1 : 0.6,
                    cursor: userName.trim() ? "pointer" : "not-allowed",
                    boxShadow: "0 8px 24px rgba(37,99,235,0.3)",
                  }}
                >
                  <span className="relative z-10 text-[1rem] font-bold tracking-wide flex items-center gap-2">
                    {isLoading ? (
                      <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                    ) : (
                      <>
                        Entrar na Reunião
                        <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </span>
                </button>
              ) : (
                <button
                  ref={btnRef}
                  data-menu-btn="true"
                  onClick={handleOpenMenu}
                  className="group relative flex-1 rounded-2xl py-4 flex justify-center items-center overflow-hidden transition-transform active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%)",
                    color: "#fff",
                    boxShadow: isDark ? "0 8px 24px rgba(37,99,235,0.3)" : "0 8px 24px rgba(37,99,235,0.25)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                  <span className="relative z-10 text-[1rem] font-bold flex items-center gap-2">
                    {isLoading ? (
                      <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                    ) : (
                      <>
                        <Plus size={20} /> Nova reunião
                      </>
                    )}
                  </span>
                </button>
              )}

              <button
                onClick={() => setShowCodeModal(true)}
                className="flex-1 rounded-2xl py-4 flex justify-center items-center transition-all active:scale-[0.98]"
                style={{
                  background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.9)",
                  border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(37,99,235,0.15)",
                  color: isDark ? "#E2E8F0" : "#1E293B",
                  fontSize: "1rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.1)" : "#fff";
                  e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.2)" : "rgba(37,99,235,0.3)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.9)";
                  e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(37,99,235,0.15)";
                }}
              >
                Tentar código
              </button>
            </div>
          </div>
        </div>

        {/* VERSÍCULOS DO DIA */}
        <div className="mt-4">
          <DailyVerses />
        </div>

        {/* DROPDOWN VIA PORTAL */}
        <AnimatePresence>
          {showMenu && (
            <div data-menu="true">
              {createPortal(
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{
                    position: 'absolute',
                    top: `${menuPos.top}px`,
                    left: `${menuPos.left}px`,
                    width: `${menuPos.width}px`,
                    zIndex: 99999,
                    background: isDark ? "rgba(30, 30, 42, 0.85)" : "rgba(255, 255, 255, 0.9)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    borderRadius: '20px',
                    overflow: 'hidden',
                    boxShadow: isDark ? "0 12px 40px rgba(0,0,0,0.5)" : "0 12px 40px rgba(0,0,0,0.15)",
                    border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(37,99,235,0.15)",
                  }}
                >
                  <div
                    onClick={handleGenerateLink}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(37,99,235,0.04)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '20px', cursor: 'pointer', transition: 'all 0.15s ease',
                      borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.04)'
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="text-[0.95rem] font-bold" style={{ color: isDark ? '#fff' : '#0F172A' }}>
                        Gerar um link
                      </span>
                      <span className="text-xs" style={{ color: isDark ? '#9CA3AF' : '#64748B' }}>
                        Para compartilhar com o grupo
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/40">
                      <span className="text-blue-600 dark:text-blue-400 font-bold">#</span>
                    </div>
                  </div>

                  <div
                    onClick={handleStartNow}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(37,99,235,0.04)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '20px', cursor: 'pointer', transition: 'all 0.15s ease'
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="text-[0.95rem] font-bold" style={{ color: isDark ? '#fff' : '#0F172A' }}>
                        Iniciar agora
                      </span>
                      <span className="text-xs" style={{ color: isDark ? '#9CA3AF' : '#64748B' }}>
                        Entrar direto na sala de líder
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/40">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                    </div>
                  </div>
                </motion.div>,
                document.body
              )}
            </div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Modal: Participar com código */}
      <AnimatePresence>
        {showCodeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCodeModal(false)}
            className="fixed inset-0 flex items-center justify-center z-[100] px-4"
            style={{
              background: isDark ? "rgba(0,0,0,0.6)" : "rgba(15,23,42,0.4)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-[400px] rounded-[32px] p-8 shadow-2xl relative overflow-hidden"
              style={{
                background: isDark ? "rgba(30, 30, 42, 0.95)" : "rgba(255, 255, 255, 0.98)",
                border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,1)",
              }}
            >
              {/* Decoration */}
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Lock size={120} />
              </div>

              <div className="relative z-10 text-center space-y-2 mb-8">
                <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mb-4">
                  <Lock size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-black" style={{ color: isDark ? '#fff' : '#0F172A' }}>
                  Acesso Restrito
                </h2>
                <p className="text-sm font-medium" style={{ color: isDark ? '#9CA3AF' : '#64748B' }}>
                  Insira o código fornecido pelo líder
                </p>
              </div>

              <div className="space-y-6 relative z-10">
                <input
                  autoFocus
                  type="text"
                  placeholder="abc-defg-hij"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && inputCode.trim()) handleJoinRoom(inputCode) }}
                  className="w-full rounded-2xl px-6 py-4 text-center tracking-widest text-lg outline-none transition-all font-mono font-bold"
                  style={{
                    background: isDark ? "rgba(0,0,0,0.3)" : "#F8FAFC",
                    border: isDark ? "2px solid rgba(255,255,255,0.05)" : "2px solid #E2E8F0",
                    color: isDark ? "#fff" : "#0F172A",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3B82F6';
                    e.currentTarget.style.boxShadow = isDark ? '0 0 0 4px rgba(59,130,246,0.1)' : '0 0 0 4px rgba(59,130,246,0.15)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.05)" : "#E2E8F0";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCodeModal(false)}
                    className="flex-1 rounded-xl py-3.5 font-bold transition-colors"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9",
                      color: isDark ? "#E2E8F0" : "#475569",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.1)" : "#E2E8F0"}
                    onMouseLeave={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9"}
                  >
                    Voltar
                  </button>
                  <button
                    disabled={!inputCode.trim()}
                    onClick={() => handleJoinRoom(inputCode)}
                    className="flex-1 rounded-xl py-3.5 font-bold shadow-lg transition-transform active:scale-[0.97]"
                    style={{
                      background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                      color: "#fff",
                      opacity: inputCode.trim() ? 1 : 0.5,
                      cursor: inputCode.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    Participar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

