import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, Plus, ArrowRight, Lock, User, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import DailyVerses from "../components/DailyVerses";
import ThemeToggle from "../components/ThemeToggle";
import { useTheme } from "../context/ThemeContext";

function getUserId() {
  let userId = localStorage.getItem('dmeet_userId');
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem('dmeet_userId', userId);
  }
  return userId;
}

function getLiderId(): string {
  let liderId = localStorage.getItem('dmeet_liderId');
  if (!liderId) {
    liderId = 'lider_' + Date.now() + '_' + crypto.randomUUID().slice(0, 8);
    localStorage.setItem('dmeet_liderId', liderId);
  }
  return liderId;
}

function carregarMeuNome() {
  const userId = localStorage.getItem('dmeet_userId');
  if (!userId) return '';
  return localStorage.getItem('dmeet_name_' + userId) || '';
}

function salvarNome(nome: string) {
  const userId = getUserId();
  localStorage.setItem('dmeet_name_' + userId, nome);
}

export default function Home() {
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();

  const roomIdDaUrl = searchParams.get("roomId") || (
    window.location.pathname.startsWith('/room/')
      ? window.location.pathname.split('/room/')[1]
      : ''
  );

  const [userName, setUserName] = useState<string>(carregarMeuNome());
  const [roomUrl, setRoomUrl] = useState(roomIdDaUrl);
  const [isLeader, setIsLeader] = useState(false);
  const [roomPassword, setRoomPassword] = useState("");
  const navigate = useNavigate();
  const isDark = theme === "dark";

  // Se entrou com link de convite, forçamos o nome vazio para preenchimento.
  React.useEffect(() => {
    if (roomIdDaUrl) {
      setUserName("");
      setRoomUrl(window.location.origin + '/room/' + roomIdDaUrl);
    }
  }, [roomIdDaUrl]);

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

  const saveUser = (name: string) => {
    setUserName(name);
    salvarNome(name);
  };

  const createRoom = () => {
    if (!userName.trim()) return; // Required
    saveUser(userName);
    const params = new URLSearchParams();
    params.set("nome", userName); // Attach explicitly

    // Se for líder, cria sala única.
    if (isLeader) {
      const liderId = getLiderId();
      const novoRoomId = gerarRoomIdLider(liderId);

      localStorage.setItem('dmeet_salaAtiva_' + liderId, novoRoomId);
      localStorage.setItem('dmeet_nome_' + liderId, userName);

      params.set("role", "host");
      if (roomPassword) params.set("pwd", roomPassword);

      const query = params.toString() ? `?${params.toString()}` : "";
      navigate(`/room/${novoRoomId}${query}`);
      return;
    }

    // Se NÃO for líder, entra mas NÃO cria (se chamou create sem URL preenchida).
    // Na real a UI deve impedir isso pelo novo layout, mas garantimos em lógica.
    navigate("/");
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return; // Required
    saveUser(userName);

    if (roomUrl) {
      let roomId = roomUrl.trim();
      if (roomId.includes("/room/")) {
        roomId = roomId.split("/room/")[1].split("?")[0];
      } else if (roomId.includes("/")) {
        roomId = roomId.split("/").pop() || roomId;
      }
      roomId = roomId.split("?")[0]; // remove query params se houver

      if (roomId) navigate(`/room/${roomId}?nome=${encodeURIComponent(userName)}&role=audience`);
    }
  };

  // ── 2 passos ──
  const steps = [
    { n: "1", label: "Digite seu nome" },
    { n: "2", label: "Permita câmera/mic" },
  ];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center py-6 px-6 font-sans relative"
      style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}
    >
      {/* Theme Toggle */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full"
          style={{
            background: isDark
              ? "radial-gradient(ellipse, rgba(11,61,145,0.18) 0%, transparent 70%)"
              : "radial-gradient(ellipse, rgba(37,99,235,0.07) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full"
          style={{
            background: isDark
              ? "radial-gradient(ellipse, rgba(30,58,138,0.15) 0%, transparent 70%)"
              : "radial-gradient(ellipse, rgba(37,99,235,0.05) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-[480px] w-full space-y-5 relative z-10"
      >
        {/* ── HEADER ── */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="p-3 rounded-2xl border"
              style={{
                background: isDark ? "rgba(37,99,235,0.1)" : "rgba(37,99,235,0.07)",
                borderColor: isDark ? "rgba(37,99,235,0.3)" : "rgba(37,99,235,0.2)",
                boxShadow: "0 0 30px rgba(37,99,235,0.15)",
              }}
            >
              <BookOpen className="w-8 h-8" style={{ color: "#60a5fa" }} />
            </motion.div>
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter" style={{ color: "var(--text-primary)" }}>
              DevocionalMeet
            </h1>
            <div
              className="inline-flex items-center px-3 py-1 rounded-full border text-[9px] font-bold uppercase tracking-[0.3em]"
              style={{
                background: isDark ? "rgba(37,99,235,0.08)" : "rgba(37,99,235,0.06)",
                borderColor: isDark ? "rgba(37,99,235,0.2)" : "rgba(37,99,235,0.15)",
                color: "var(--text-secondary)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full mr-2 animate-pulse" style={{ background: "#2563eb" }} />
              Comunhão &amp; Fé
            </div>
          </div>
        </div>

        {/* ── 3 PASSOS ── */}
        <div
          className="flex items-center justify-center gap-0 rounded-xl px-4 py-3"
          style={{
            background: isDark ? "rgba(37,99,235,0.06)" : "rgba(37,99,235,0.05)",
            border: "1px solid var(--border-card)",
          }}
        >
          {steps.map((step, i) => (
            <React.Fragment key={step.n}>
              <div className="flex flex-col items-center gap-1 px-3 text-center">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                  style={{ background: "linear-gradient(135deg, #0b3d91, #2563eb)" }}
                >
                  {step.n}
                </div>
                <span className="text-[9px] font-semibold leading-tight" style={{ color: "var(--text-secondary)" }}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="w-6 h-[1px] flex-shrink-0" style={{ background: "var(--border-card)" }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── VERSÍCULOS ── */}
        <DailyVerses />

        {/* ── CARD PRINCIPAL ── */}
        <div
          className="p-6 rounded-2xl space-y-4"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            boxShadow: "var(--glow-card)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Nome */}
          {!roomIdDaUrl && (
            <div className="text-center font-bold text-lg mb-2 text-white">
              Bem-vindo Líder / Participante!
            </div>
          )}

          {roomIdDaUrl && (
            <div className="text-center font-semibold text-[13px] bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl text-blue-300 mb-2">
              Você foi convidado para um devocional
            </div>
          )}

          <div className="space-y-1.5">
            <label
              className="text-[9px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 ml-1"
              style={{ color: "var(--text-muted)" }}
            >
              <User className="w-3 h-3" /> Seu nome
            </label>
            <input
              type="text"
              required
              disabled={false} // sempre editável
              placeholder="Como você quer aparecer na reunião"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm input-field"
            />
          </div>

          {/* Toggle líder/moderador (Só visível se NÃO veio por link convite) */}
          {!roomIdDaUrl && (
            <div
              className="rounded-xl overflow-hidden toggle-lider-container"
              style={{ border: "1px solid var(--border-card)" }}
            >
              <button
                type="button"
                onClick={() => setIsLeader(!isLeader)}
                className="w-full flex items-center justify-between px-4 py-3 transition-colors duration-200"
                style={{ background: isDark ? "rgba(0,0,0,0.2)" : "rgba(37,99,235,0.04)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="p-1.5 rounded-lg transition-colors duration-200"
                    style={{
                      background: isLeader ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.04)",
                      color: isLeader ? "#60a5fa" : "var(--text-muted)",
                    }}
                  >
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-bold" style={{ color: "var(--text-primary)" }}>
                      Sou líder / moderador
                    </p>
                    <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                      Ativa opções avançadas de sala
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Switch */}
                  <div
                    className="w-9 h-5 rounded-full relative transition-all duration-200"
                    style={{
                      background: isLeader
                        ? "linear-gradient(135deg, #0b3d91, #2563eb)"
                        : isDark ? "rgba(255,255,255,0.10)" : "#d1d5db",
                      boxShadow: isLeader ? "0 0 12px rgba(37,99,235,0.4)" : "none",
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200"
                      style={{ left: isLeader ? "17px" : "2px" }}
                    />
                  </div>
                  <ChevronDown
                    className="w-4 h-4 transition-transform duration-200"
                    style={{
                      color: "var(--text-muted)",
                      transform: isLeader ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                </div>
              </button>

              {/* Senha da sala (só visível se líder) */}
              <AnimatePresence>
                {isLeader && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div
                      className="px-4 pb-4 pt-1 space-y-1.5"
                      style={{ borderTop: "1px solid var(--border-card)" }}
                    >
                      <label
                        className="text-[9px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 ml-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Lock className="w-3 h-3" /> Senha da sala (opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Deixe em branco para sala aberta"
                        value={roomPassword}
                        onChange={(e) => setRoomPassword(e.target.value)}
                        className="w-full rounded-xl px-4 py-3 text-sm input-field"
                      />
                      <p className="text-[9px] ml-1" style={{ color: "var(--text-muted)" }}>
                        A senha será aplicada automaticamente ao criar a sala.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Botões */}
          <div className="space-y-2">
            {!roomIdDaUrl ? (
              // CASO A: HOME ORGÂNICA
              isLeader ? (
                <button
                  onClick={createRoom}
                  className="btn-primary w-full py-4 px-6 rounded-xl flex items-center justify-center gap-3 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Criar Sala de Devocional
                </button>
              ) : null
            ) : (
              // CASO B: VEIO DO CONVITE
              <button
                onClick={joinRoom}
                className="btn-primary w-full py-4 px-6 rounded-xl flex items-center justify-center gap-3 text-sm"
              >
                <ArrowRight className="w-4 h-4" />
                Entrar no Devocional
              </button>
            )}

            {!roomIdDaUrl && !isLeader && (
              <>
                {/* Divider */}
                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t" style={{ borderColor: "var(--border-card)" }} />
                  </div>
                  <div className="relative flex justify-center text-[9px] uppercase tracking-widest">
                    <span className="px-2 font-black" style={{ background: "var(--bg-page)", color: "var(--text-muted)" }}>
                      Ou entre com link
                    </span>
                  </div>
                </div>

                <form onSubmit={joinRoom} className="flex gap-2 campo-link-convite">
                  <input
                    type="text"
                    placeholder="Link ou código da sala"
                    value={roomUrl}
                    onChange={(e) => setRoomUrl(e.target.value)}
                    className="flex-1 rounded-xl px-4 py-3 text-sm input-field"
                  />
                  <button
                    type="submit"
                    className="p-3 rounded-xl transition-all duration-200 active:scale-95 border"
                    style={{ background: "var(--bg-card)", borderColor: "var(--border-input)", color: "#60a5fa" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#2563eb";
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(37,99,235,0.12)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-input)";
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card)";
                    }}
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
