import React, { useState } from "react";
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
            {/* Nova reunião */}
            <button
              onClick={handleCreateRoom}
              disabled={!userName.trim()}
              onPointerDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
              onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
              onPointerLeave={e => e.currentTarget.style.transform = 'scale(1)'}
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
    </div>
  );
}
