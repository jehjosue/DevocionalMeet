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
  const nomeSalvo = (() => {
    if (searchParams.get("roomId")) return ""; // convite = sempre vazio
    return localStorage.getItem("dmeet_name") || "";
  })();

  const [userName, setUserName] = useState<string>(nomeSalvo);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [inputCode, setInputCode] = useState("");

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

  // Opção 1 — Gerar link sem entrar na sala
  const handleGenerateLink = async () => {
    setShowMenu(false);

    const name = userName.trim();
    if (!name) {
      showToast('⚠️ Digite seu nome antes de gerar o link');
      return;
    }

    let userId = localStorage.getItem('dmeet_userId');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('dmeet_userId', userId);
    }

    // URL ABSOLUTA do back-end na VPS — front no Vercel, back em api.devocionalmeet.shop
    const API = (import.meta.env.VITE_SOCKET_URL || 'https://api.devocionalmeet.shop').replace(/\/$/, '');
    const endpoint = `${API}/rooms/create`;
    console.log('[DM] Gerando link...', { endpoint, userId, name });
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
    }
  };

  // Opção 2 — Iniciar reunião agora (entrar direto)
  const handleStartNow = async () => {
    setShowMenu(false);

    const name = userName.trim();
    if (!name) {
      showToast('⚠️ Digite seu nome antes de iniciar');
      return;
    }

    let userId = localStorage.getItem('dmeet_userId');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('dmeet_userId', userId);
    }

    // URL ABSOLUTA do back-end na VPS — front no Vercel, back em api.devocionalmeet.shop
    const API = (import.meta.env.VITE_SOCKET_URL || 'https://api.devocionalmeet.shop').replace(/\/$/, '');
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

      window.location.href = `/room/${data.code}?host=true`;

    } catch (err: any) {
      console.error('[DM] Fetch error:', err.name, err.message);
      if (err.name === 'TypeError' && err.message === 'Load failed') {
        showToast('❌ Safari bloqueou a conexão — verifique CORS e HTTPS no servidor');
      } else if (err.message?.includes('Failed to fetch')) {
        showToast('❌ Servidor offline. Verifique se o backend está rodando.');
      } else {
        showToast('❌ Erro: ' + (err.message || 'desconhecido'));
      }
    }
  };


  const handleJoinWithCode = () => {
    if (!userName.trim()) return;
    setShowCodeModal(true);
  };

  const handleJoinRoom = (code: string) => {
    const clean = code.trim().toLowerCase();
    if (!clean) return;
    localStorage.setItem('dmeet_name', userName);
    localStorage.setItem('dmeet_role', 'guest');

    // Extrai o código caso o usuário cole a URL inteira
    let finalCode = clean;
    if (finalCode.includes("/room/")) {
      finalCode = finalCode.split("/room/")[1].split("?")[0];
    } else if (finalCode.includes("/")) {
      finalCode = finalCode.split("/").pop() || finalCode;
    }
    finalCode = finalCode.split("?")[0];

    window.location.href = `/room/${finalCode}`;
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center py-6 px-6 font-sans relative"
      style={{
        background: isDark ? "#0A0A0F" : "linear-gradient(160deg, #EEF2FF 0%, #F8FAFF 100%)",
        color: isDark ? "#E9EDEF" : "#1e293b",
        transition: 'all 0.3s ease'
      }}
    >
      {/* Botão de Toggle de Tema */}
      <button
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: isDark ? '#1F2C34' : '#fff',
          border: isDark ? '1.5px solid #2F3C44' : '1.5px solid #E2E8F0',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          zIndex: 100,
          boxShadow: isDark ? 'none' : '0 4px 12px rgba(37,99,235,0.08)'
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

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {isDark ? (
          <div
            className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full opacity-20"
            style={{
              background: "radial-gradient(ellipse, #2563EB 0%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
        ) : (
          <div
            className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full opacity-10"
            style={{
              background: "radial-gradient(ellipse, #3B82F6 0%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-[480px] w-full space-y-6 relative z-10"
      >
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="p-3 rounded-2xl border"
              style={{
                background: isDark ? "rgba(37,99,235,0.1)" : "rgba(37,99,235,0.07)",
                borderColor: isDark ? "rgba(37,99,235,0.3)" : "rgba(37,99,235,0.2)",
              }}
            >
              <BookOpen className="w-8 h-8" style={{ color: "#2563EB" }} />
            </motion.div>
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter" style={{ color: isDark ? "#fff" : "#0F172A" }}>
              DevocionalMeet
            </h1>
            <p className="text-sm font-medium tracking-widest uppercase" style={{ color: isDark ? "#8896AA" : "#64748B" }}>
              Comunhão &amp; Fé
            </p>
          </div>
        </div>

        {/* Container Nome e Botões */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest ml-1" style={{ color: isDark ? "rgba(255,255,255,0.5)" : "#64748B" }}>
              Seu nome
            </label>
            <input
              type="text"
              placeholder="Como você quer aparecer"
              value={userName}
              onChange={(e) => {
                setUserName(e.target.value);
                salvarNome(e.target.value);
              }}
              className="w-full rounded-xl px-4 py-4 text-base border-2 transition-all outline-none"
              style={{
                background: isDark ? "#1C1C2E" : "#fff",
                borderColor: isDark ? "#2A2A3E" : "#E2E8F0",
                color: isDark ? "#fff" : "#101828",
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#2563EB'}
              onBlur={(e) => e.currentTarget.style.borderColor = isDark ? "#2A2A3E" : "#E2E8F0"}
            />
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
          }}>
            <button
              ref={btnRef}
              data-menu-btn="true"
              onClick={handleOpenMenu}
              style={{
                flex: 1,
                background: '#2563EB',
                color: '#ffffff',
                border: 'none',
                borderRadius: '999px',
                padding: '15px 0',
                fontSize: '0.97rem',
                fontWeight: '700',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1D4ED8'}
              onMouseLeave={e => e.currentTarget.style.background = '#2563EB'}
            >
              Nova reunião
            </button>

            <button
              onClick={() => setShowCodeModal(true)}
              style={{
                flex: 1,
                background: '#ffffff',
                color: '#1a1a1a',
                border: '1.5px solid #D1D5DB',
                borderRadius: '999px',
                padding: '15px 0',
                fontSize: '0.97rem',
                fontWeight: '500',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#9CA3AF'
                e.currentTarget.style.background = '#F9FAFB'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#D1D5DB'
                e.currentTarget.style.background = '#ffffff'
              }}
            >
              Participar com código
            </button>
          </div>
        </div>

        {/* Versículos POR ÚLTIMO */}
        <DailyVerses />

        {/* DROPDOWN VIA PORTAL */}
        {showMenu && createPortal(
          <div
            data-menu="true"
            style={{
              position: 'fixed',
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
              width: `${menuPos.width}px`,
              zIndex: 99999,
              background: '#ffffff',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)',
              border: '1px solid #F0F0F0',
              animation: 'menuAppear 0.18s ease',
            }}
          >

            {/* ── OPÇÃO 1 ── Gerar link */}
            <div
              onClick={handleGenerateLink}
              onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
              onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 20px',
                borderBottom: '1px solid #F0F0F0',
                cursor: 'pointer',
                background: '#ffffff',
                transition: 'background 0.12s ease',
              }}
            >
              <span style={{
                color: '#1a1a1a',
                fontSize: '0.95rem',
                fontWeight: '400',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: '1.45',
                flex: 1,
                whiteSpace: 'pre-line',
                textAlign: 'left'
              }}>
                {'Gerar um link da reunião\npara compartilhar'}
              </span>
              <svg width="22" height="22" viewBox="0 0 24 24"
                fill="none" stroke="#1a1a1a"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ marginLeft: '16px', flexShrink: 0 }}
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>

            {/* ── OPÇÃO 2 ── Iniciar agora */}
            <div
              onClick={handleStartNow}
              onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
              onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 20px',
                cursor: 'pointer',
                background: '#ffffff',
                transition: 'background 0.12s ease',
                borderRadius: '0 0 16px 16px',
              }}
            >
              <span style={{
                color: '#1a1a1a',
                fontSize: '0.95rem',
                fontWeight: '400',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: '1.45',
                flex: 1,
                textAlign: 'left'
              }}>
                Iniciar uma reunião agora
              </span>
              <svg width="22" height="22" viewBox="0 0 24 24"
                fill="none" stroke="#1a1a1a"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ marginLeft: '16px', flexShrink: 0 }}
              >
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>

          </div>,
          document.body
        )}
      </motion.div>

      {/* Modal: Participar com código */}
      <AnimatePresence>
        {showCodeModal && (
          <div
            onClick={() => setShowCodeModal(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 100,
              backdropFilter: 'blur(4px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: isDark ? '#1C1C2E' : '#ffffff',
                borderRadius: '16px',
                padding: '28px 24px',
                width: '100%',
                maxWidth: '380px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
                border: isDark ? '1px solid #2A2A3E' : 'none'
              }}
            >
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: isDark ? '#fff' : '#101828', marginBottom: '6px' }}>
                Participar com um código
              </h2>
              <p style={{ fontSize: '0.85rem', color: isDark ? '#8896AA' : '#64748B', marginBottom: '20px' }}>
                Digite o código da reunião
              </p>

              <input
                autoFocus
                type="text"
                placeholder="abc-defg-hij"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && inputCode.trim()) handleJoinRoom(inputCode) }}
                style={{
                  width: '100%',
                  border: '1.5px solid',
                  borderColor: isDark ? '#2A2A3E' : '#D1D5DB',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '1rem',
                  fontFamily: 'system-ui',
                  color: isDark ? '#fff' : '#101828',
                  background: isDark ? '#1C1C2E' : '#fff',
                  outline: 'none',
                  marginBottom: '16px',
                  letterSpacing: '0.05em'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#2563EB'}
                onBlur={(e) => e.currentTarget.style.borderColor = isDark ? '#2A2A3E' : '#D1D5DB'}
              />

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowCodeModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#6B7280',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Cancelar
                </button>
                <button
                  disabled={!inputCode.trim()}
                  onClick={() => handleJoinRoom(inputCode)}
                  style={{
                    background: '#2563EB',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '999px',
                    padding: '10px 24px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: inputCode.trim() ? 'pointer' : 'not-allowed',
                    opacity: inputCode.trim() ? 1 : 0.5,
                    transition: 'all 0.2s'
                  }}
                >
                  Participar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

