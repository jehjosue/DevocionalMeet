import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, ArrowRight, Lock, User, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import DailyVerses from "../components/DailyVerses";
import ThemeToggle from "../components/ThemeToggle";
import { useTheme } from "../context/ThemeContext";

export default function Home() {
  const { theme } = useTheme();
  const [userName, setUserName] = useState(localStorage.getItem("devocional_user_name") || "");
  const [roomUrl, setRoomUrl] = useState("");
  const [isLeader, setIsLeader] = useState(false);
  const [roomPassword, setRoomPassword] = useState("");
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const generateRoomName = () => {
    const now = new Date();
    const datePart = now.toISOString().split("T")[0].replace(/-/g, "");
    const timePart =
      now.getHours().toString().padStart(2, "0") +
      now.getMinutes().toString().padStart(2, "0");
    return `devocional-${datePart}-${timePart}-${Math.floor(Math.random() * 1000)}`;
  };

  const saveUser = (name: string) => {
    setUserName(name);
    localStorage.setItem("devocional_user_name", name);
  };

  const createRoom = () => {
    const name = generateRoomName();
    const params = new URLSearchParams();
    if (isLeader && roomPassword) params.set("pwd", roomPassword);
    const query = params.toString() ? `?${params.toString()}` : "";
    navigate(`/pre/${name}${query}`);
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomUrl) {
      const name = roomUrl.includes("/") ? roomUrl.split("/").pop() : roomUrl;
      if (name) navigate(`/pre/${name}`);
    }
  };

  // ── 3 passos ──
  const steps = [
    { n: "1", label: "Digite seu nome" },
    { n: "2", label: "Clique em Entrar" },
    { n: "3", label: "Permita câmera/mic se pedir" },
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
          <div className="space-y-1.5">
            <label
              className="text-[9px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 ml-1"
              style={{ color: "var(--text-muted)" }}
            >
              <User className="w-3 h-3" /> Seu nome
            </label>
            <input
              type="text"
              placeholder="Como você quer aparecer na reunião"
              value={userName}
              onChange={(e) => saveUser(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm input-field"
            />
          </div>

          {/* Toggle líder/moderador */}
          <div
            className="rounded-xl overflow-hidden"
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

          {/* Botões */}
          <div className="space-y-2">
            <button
              onClick={createRoom}
              className="btn-primary w-full py-4 px-6 rounded-xl flex items-center justify-center gap-3 text-sm"
            >
              <Plus className="w-4 h-4" />
              {isLeader ? "Criar Sala de Devocional" : "Entrar no Devocional"}
            </button>

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

            <form onSubmit={joinRoom} className="flex gap-2">
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
          </div>
        </div>
      </motion.div>
    </div>
  );
}
