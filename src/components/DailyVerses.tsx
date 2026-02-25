import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { Verse } from "../data/verses";
import VerseCard from "./VerseCard";
import { useTheme } from "../context/ThemeContext";
import { supabaseService } from "../services/supabaseService";

export default function DailyVerses() {
  const { theme } = useTheme();
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    async function fetchVerses() {
      const daily = await supabaseService.getDailyVerses();
      setVerses(daily);
      setLoading(false);
    }
    fetchVerses();
  }, []);

  const next = () => setCurrentIndex((p) => (p + 1) % verses.length);
  const prev = () => setCurrentIndex((p) => (p - 1 + verses.length) % verses.length);

  /* ── LOADING SKELETON ── */
  if (loading) {
    return (
      <div className="w-full space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div
            className="p-1 rounded-lg border"
            style={{ background: "rgba(37,99,235,0.1)", borderColor: "rgba(37,99,235,0.2)" }}
          >
            <BookOpen className="w-3.5 h-3.5" style={{ color: "#60a5fa" }} />
          </div>
          <h2
            className="text-[10px] font-bold uppercase tracking-[0.3em]"
            style={{ color: "var(--text-secondary)" }}
          >
            Versículos do Dia
          </h2>
        </div>
        <div
          className="w-full h-24 rounded-xl border animate-pulse"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
        />
      </div>
    );
  }

  if (verses.length === 0) return null;

  /* ── BOTÃO NAV VISUAL ── */
  const NavBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className="p-1 rounded-lg border transition-all duration-200 hover:border-opacity-60"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-card)",
        color: "var(--text-secondary)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(37,99,235,0.5)";
        (e.currentTarget as HTMLButtonElement).style.color = "#60a5fa";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-card)";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
      }}
    >
      {children}
    </button>
  );

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div
            className="p-1 rounded-lg border"
            style={{
              background: "rgba(37,99,235,0.1)",
              borderColor: "rgba(37,99,235,0.2)",
            }}
          >
            <BookOpen className="w-3.5 h-3.5" style={{ color: "#60a5fa" }} />
          </div>
          <h2
            className="text-[10px] font-bold uppercase tracking-[0.3em]"
            style={{ color: "var(--text-secondary)" }}
          >
            Versículos do Dia
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-black uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            {currentIndex + 1} / {verses.length}
          </span>
          <div className="flex gap-1">
            <NavBtn onClick={prev}><ChevronLeft className="w-3.5 h-3.5" /></NavBtn>
            <NavBtn onClick={next}><ChevronRight className="w-3.5 h-3.5" /></NavBtn>
          </div>
        </div>
      </div>

      {/* Card animado */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <VerseCard verse={verses[currentIndex]} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Indicadores */}
      <div className="flex justify-center gap-1 overflow-x-auto py-1">
        {verses.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className="h-0.5 rounded-full transition-all duration-300"
            style={{
              width: i === currentIndex ? "16px" : "4px",
              background:
                i === currentIndex
                  ? "#2563eb"
                  : "rgba(37,99,235,0.2)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
