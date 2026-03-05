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

function getLiderId(): string {
  let liderId = localStorage.getItem("dmeet_liderId");
  if (!liderId) {
    liderId = "lider_" + Date.now() + "_" + crypto.randomUUID().slice(0, 8);
    localStorage.setItem("dmeet_liderId", liderId);
  }
  return liderId;
}

function salvarNome(nome: string) {
  localStorage.setItem("dmeet_name", nome);
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const userId = getUserId();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  // roomId vem sempre via ?roomId= (colocado pelo RoomGuard do App.tsx)
  const roomIdDaUrl = searchParams.get("roomId") || "";

  // Se veio de convite, começa com nome vazio. Se não, carrega nome salvo.
  const nomeSalvo = (() => {
    if (searchParams.get("roomId")) return ""; // convite = sempre vazio
    return localStorage.getItem("dmeet_name") || "";
  })();

  const [userName, setUserName] = useState<string>(nomeSalvo);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toast, setToast] = useState('');

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const gerarRoomIdLider = (liderId: string) => {
    const agora = new Date();
    const data = agora.toISOString().slice(0, 10).replace(/-/g, "");
    const hora =
      agora.getHours().toString().padStart(2, "0") +
      agora.getMinutes().toString().padStart(2, "0");
    const rand = Math.floor(Math.random() * 900 + 100);
    const sufixoLider = liderId.slice(-6);
    return `devocional-${data}-${hora}-${rand}-${sufixoLider}`;
  };

  const handleGenerateLink = async () => {
    if (!userName.trim()) return;
    setIsMenuOpen(false);
    try {
      showToast('⌛ Gerando link...');

      const apiUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
      const res = await fetch(`${apiUrl}/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao criar sala');
      }

      const data = await res.json();
      const link = `${window.location.origin}/room/${data.code}`;
      await navigator.clipboard.writeText(link);
      showToast('🔗 Link copiado!');
    } catch (err) {
      console.error("Erro ao gerar link:", err);
      showToast('❌ Erro ao gerar link. Tente novamente.');
    }
  };

  const handleStartNow = async () => {
    if (!userName.trim()) return;
    setIsMenuOpen(false);

    localStorage.setItem('dmeet_name', userName);
    localStorage.setItem('dmeet_role', 'leader');

    try {
      const res = await fetch('/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('dmeet_roomCode', data.code);
      window.location.href = `/room/${data.code}?host=true`;
    } catch (err) {
      console.error("Erro ao criar sala:", err);
      const liderId = getLiderId();
      window.location.href = `/room/${gerarRoomIdLider(liderId)}?nome=${userName}&role=host&host=true`;
    }
  };

  const handleSchedule = async () => {
    if (!userName.trim()) return;
    setIsMenuOpen(false);
    try {
      const res = await fetch('/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName }),
      });
      const data = await res.json();
      const link = `${window.location.origin}/room/${data.code}`;
      const title = encodeURIComponent('DevocionalMeet - Reunião');
      const details = encodeURIComponent(`Participe pelo link: ${link}`);
      window.open(
        `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}`,
        '_blank'
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRoom = async () => {
    if (!userName.trim()) return;

    // Salvar nome e papel ANTES de redirecionar
    localStorage.setItem('dmeet_name', userName);
    localStorage.setItem('dmeet_role', 'leader');

    try {
      const res = await fetch('/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('dmeet_roomCode', data.code);
      window.location.href = `/room/${data.code}?host=true`;
    } catch (err) {
      console.error("Erro ao criar sala:", err);
      // Fallback para sala legada se necessário
      const liderId = getLiderId();
      window.location.href = `/room/${gerarRoomIdLider(liderId)}?nome=${userName}&role=host&host=true`;
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

        {/* Versículos */}
        <DailyVerses />

        {/* Seção Principal */}
        <div className="space-y-6">
          {/* Campo Nome */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest ml-1" style={{ color: isDark ? "rgba(255,255,255,0.5)" : "#64748B" }}>
              Seu nome
            </label>
            <input
              type="text"
              placeholder="Como você quer aparecer"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
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

          {/* Container de Botões Lado a Lado */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            position: 'relative'
          }}>

            {/* BOTÃO NOVA REUNIÃO */}
            <div style={{ flex: 1, position: 'relative' }}>
              <button
                ref={menuBtnRef}
                onClick={(e) => {
                  if (!userName.trim()) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMenuPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
                  setIsMenuOpen(!isMenuOpen);
                }}
                disabled={!userName.trim()}
                style={{
                  width: '100%',
                  background: '#2563EB',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '15px 0',
                  fontSize: '0.97rem',
                  fontWeight: '700',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  cursor: userName.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s ease',
                  opacity: userName.trim() ? 1 : 0.6,
                }}
                onMouseEnter={e => { if (userName.trim()) e.currentTarget.style.background = '#1D4ED8' }}
                onMouseLeave={e => { if (userName.trim()) e.currentTarget.style.background = '#2563EB' }}
                onPointerDown={e => { if (userName.trim()) e.currentTarget.style.transform = 'scale(0.96)' }}
                onPointerUp={e => { if (userName.trim()) e.currentTarget.style.transform = 'scale(1)' }}
              >
                Nova reunião
              </button>

              {/* Portal para o Dropdown */}
              {isMenuOpen && createPortal(
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'fixed',
                    top: menuPos.top,
                    left: menuPos.left,
                    width: menuPos.width,
                    minWidth: '280px',
                    zIndex: 9999,
                    background: isDark ? '#1C1C2E' : '#ffffff',
                    borderRadius: '16px',
                    boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.12)',
                    border: isDark ? '1px solid #2A2A3E' : '1px solid #E2E8F0',
                    overflow: 'hidden'
                  }}
                >
                  <MenuItem
                    label={"Gerar um link da reunião\npara compartilhar"}
                    icon={<LinkIcon color={isDark ? "#fff" : "#101828"} />}
                    onClick={handleGenerateLink}
                    isDark={isDark}
                    border
                  />
                  <MenuItem
                    label="Iniciar uma reunião agora"
                    icon={<VideoIcon color={isDark ? "#fff" : "#101828"} />}
                    onClick={handleStartNow}
                    isDark={isDark}
                    border
                  />
                  <MenuItem
                    label={"Agendar no\nGoogle Agenda"}
                    icon={<CalendarIcon color={isDark ? "#fff" : "#101828"} />}
                    onClick={handleSchedule}
                    isDark={isDark}
                    border={false}
                  />
                </motion.div>,
                document.body
              )}
            </div>

            {/* BOTÃO PARTICIPAR COM CÓDIGO */}
            <button
              onClick={handleJoinWithCode}
              disabled={!userName.trim()}
              style={{
                flex: 1,
                background: isDark ? '#1C1C2E' : '#ffffff',
                color: isDark ? '#ffffff' : '#101828',
                border: isDark ? '1.5px solid #2A2A3E' : '1.5px solid #E2E8F0',
                borderRadius: '999px',
                padding: '15px 0',
                fontSize: '0.97rem',
                fontWeight: '600',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                cursor: userName.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
                opacity: userName.trim() ? 1 : 0.6,
              }}
              onMouseEnter={e => {
                if (userName.trim()) {
                  e.currentTarget.style.borderColor = isDark ? '#3A3A4E' : '#D1D5DB';
                  e.currentTarget.style.background = isDark ? '#23233A' : '#F9FAFB';
                }
              }}
              onMouseLeave={e => {
                if (userName.trim()) {
                  e.currentTarget.style.borderColor = isDark ? '#2A2A3E' : '#E2E8F0';
                  e.currentTarget.style.background = isDark ? '#1C1C2E' : '#ffffff';
                }
              }}
              onPointerDown={e => { if (userName.trim()) e.currentTarget.style.transform = 'scale(0.96)' }}
              onPointerUp={e => { if (userName.trim()) e.currentTarget.style.transform = 'scale(1)' }}
            >
              Participar com código
            </button>
          </div>
        </div>
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

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            style={{
              position: 'fixed',
              bottom: '32px',
              left: '50%',
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(12px)',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: '999px',
              fontSize: '0.88rem',
              fontFamily: 'system-ui',
              zIndex: 9999,
              whiteSpace: 'nowrap',
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ label, icon, onClick, border, isDark }: { label: string; icon: React.ReactNode; onClick: () => void; border: boolean; isDark: boolean }) {
  const [hovered, setHovered] = useState(false);
  const textColor = isDark ? '#E9EDEF' : '#101828';
  const borderColor = isDark ? '#2A2A3E' : '#F0F0F0';
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : '#F5F5F5';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 20px',
        borderBottom: border ? `1px solid ${borderColor}` : 'none',
        cursor: 'pointer',
        background: hovered ? hoverBg : 'transparent',
        transition: 'background 0.12s ease',
      }}
    >
      <span style={{
        color: textColor,
        fontSize: '0.95rem',
        fontWeight: '400',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        lineHeight: '1.45',
        flex: 1,
        whiteSpace: 'pre-line',
        textAlign: 'left'
      }}>
        {label}
      </span>
      <div style={{ marginLeft: '16px', flexShrink: 0 }}>
        {icon}
      </div>
    </div>
  );
}

function LinkIcon({ color }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={color || "#1a1a1a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function VideoIcon({ color }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={color || "#1a1a1a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function CalendarIcon({ color }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={color || "#1a1a1a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
