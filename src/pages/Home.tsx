import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, Plus, ArrowRight, Lock, User, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import DailyVerses from "../components/DailyVerses";
import ThemeToggle from "../components/ThemeToggle";
import { useTheme } from "../context/ThemeContext";

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
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const userId = getUserId();
  const menuRef = useRef<HTMLDivElement>(null);

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
      const res = await fetch('/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName }),
      });
      const data = await res.json();
      const link = `${window.location.origin}/room/${data.code}`;
      await navigator.clipboard.writeText(link);
      showToast('🔗 Link copiado para a área de transferência!');
    } catch (err) {
      console.error(err);
      showToast('Erro ao gerar link.');
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
      style={{ background: isDark ? "#000" : "#fff", color: "var(--text-primary)" }}
    >
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Background glow - sutil */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full opacity-20"
          style={{
            background: "radial-gradient(ellipse, #2563EB 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
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
            <h1 className="text-4xl font-black tracking-tighter" style={{ color: isDark ? "#fff" : "#1a1a1a" }}>
              DevocionalMeet
            </h1>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">
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
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 ml-1">
              Seu nome
            </label>
            <input
              type="text"
              placeholder="Como você quer aparecer"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full rounded-xl px-4 py-4 text-base border-2 transition-all outline-none"
              style={{
                background: isDark ? "#121212" : "#fff",
                borderColor: isDark ? "#2A2A2A" : "#E5E7EB",
                color: isDark ? "#fff" : "#1a1a1a",
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#2563EB'}
              onBlur={(e) => e.currentTarget.style.borderColor = isDark ? "#2A2A2A" : "#E5E7EB"}
            />
          </div>

          {/* Novos Botões Estilo Google Meet */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>

            {/* Wrapper relativo para o menu de dropdown */}
            <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
              {/* Nova reunião */}
              <button
                onClick={() => { if (userName.trim()) setIsMenuOpen(!isMenuOpen) }}
                disabled={!userName.trim()}
                onPointerDown={e => { if (userName.trim()) e.currentTarget.style.transform = 'scale(0.96)' }}
                onPointerUp={e => { if (userName.trim()) e.currentTarget.style.transform = 'scale(1)' }}
                onPointerLeave={e => { if (userName.trim()) e.currentTarget.style.transform = 'scale(1)' }}
                onMouseEnter={e => { if (userName.trim()) e.currentTarget.style.background = '#1D4ED8' }}
                onMouseLeave={e => { if (userName.trim()) e.currentTarget.style.background = '#2563EB' }}
                style={{
                  background: '#2563EB',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '14px 32px',
                  fontSize: '0.97rem',
                  fontWeight: '600',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  cursor: userName.trim() ? 'pointer' : 'not-allowed',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s ease, transform 0.12s ease',
                  opacity: userName.trim() ? 1 : 0.6,
                }}
              >
                Nova reunião
              </button>

              {/* Menu dropdown */}
              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      zIndex: 999,
                      minWidth: '280px',
                      background: '#ffffff',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08)',
                    }}
                  >
                    <MenuItem
                      label={"Gerar um link da reunião\npara compartilhar"}
                      icon={<LinkIcon />}
                      onClick={handleGenerateLink}
                      border
                    />
                    <MenuItem
                      label="Iniciar uma reunião agora"
                      icon={<VideoIcon />}
                      onClick={handleStartNow}
                      border
                    />
                    <MenuItem
                      label={"Agendar no\nGoogle Agenda"}
                      icon={<CalendarIcon />}
                      onClick={handleSchedule}
                      border={false}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Participar com código */}
            <button
              onClick={handleJoinWithCode}
              disabled={!userName.trim()}
              onPointerDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
              onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
              onPointerLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              onMouseEnter={e => {
                if (userName.trim()) {
                  e.currentTarget.style.borderColor = '#9CA3AF';
                  e.currentTarget.style.background = '#F9FAFB';
                }
              }}
              onMouseLeave={e => {
                if (userName.trim()) {
                  e.currentTarget.style.borderColor = '#D1D5DB';
                  e.currentTarget.style.background = '#ffffff';
                }
              }}
              style={{
                background: '#ffffff',
                color: '#1a1a1a',
                border: '1.5px solid #D1D5DB',
                borderRadius: '999px',
                padding: '14px 32px',
                fontSize: '0.97rem',
                fontWeight: '500',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                cursor: userName.trim() ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
                transition: 'border-color 0.15s ease, background 0.15s ease, transform 0.12s ease',
                opacity: userName.trim() ? 1 : 0.6,
              }}
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
                background: '#ffffff',
                borderRadius: '16px',
                padding: '28px 24px',
                width: '100%',
                maxWidth: '380px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
              }}
            >
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px' }}>
                Participar com um código
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: '20px' }}>
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
                  border: '1.5px solid #D1D5DB',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '1rem',
                  fontFamily: 'system-ui',
                  color: '#1a1a1a',
                  background: '#fff',
                  outline: 'none',
                  marginBottom: '16px',
                  letterSpacing: '0.05em'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#2563EB'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#D1D5DB'}
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

function MenuItem({ label, icon, onClick, border }: { label: string; icon: React.ReactNode; onClick: () => void; border: boolean }) {
  const [hovered, setHovered] = useState(false);
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
        borderBottom: border ? '1px solid #F0F0F0' : 'none',
        cursor: 'pointer',
        background: hovered ? '#F5F5F5' : '#ffffff',
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
        {label}
      </span>
      <div style={{ marginLeft: '16px', flexShrink: 0 }}>
        {icon}
      </div>
    </div>
  );
}

function LinkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
