import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { getDailyVerses } from "../utils/dailyVerses";
import VerseCard from "./VerseCard";
import { useTheme } from "../context/ThemeContext";

export default function DailyVerses() {
  const { theme } = useTheme();
  const dailyVerses = useMemo(() => getDailyVerses(), []);
  const [currentIndex, setCurrentIndex] = useState(0);

  const next = () => setCurrentIndex((prev) => (prev + 1) % dailyVerses.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + dailyVerses.length) % dailyVerses.length);

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-lg border transition-all duration-300 ${theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-indigo-500/10 border-indigo-500/20'}`}>
            <BookOpen className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-emerald-400' : 'text-indigo-600'}`} />
          </div>
          <h2 className={`text-[10px] font-bold uppercase tracking-[0.3em] transition-colors duration-300 ${theme === 'dark' ? 'text-white/60' : 'text-slate-500'}`}>
            Versículos do Dia
          </h2>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-black uppercase transition-colors duration-300 ${theme === 'dark' ? 'text-white/20' : 'text-slate-300'}`}>
            {currentIndex + 1} / {dailyVerses.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={prev}
              className={`p-1 rounded-lg border transition-all duration-300 ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white/40 border-white/10' : 'bg-slate-100 hover:bg-slate-200 text-slate-400 border-slate-200'}`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={next}
              className={`p-1 rounded-lg border transition-all duration-300 ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white/40 border-white/10' : 'bg-slate-100 hover:bg-slate-200 text-slate-400 border-slate-200'}`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <VerseCard verse={dailyVerses[currentIndex]} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Miniaturas/Indicadores */}
      <div className="flex justify-center gap-1 overflow-x-auto py-1 no-scrollbar">
        {dailyVerses.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`h-0.5 rounded-full transition-all duration-300 ${
              i === currentIndex 
                ? (theme === 'dark' ? "w-4 bg-emerald-500" : "w-4 bg-indigo-600") 
                : (theme === 'dark' ? "w-1 bg-white/10 hover:bg-white/20" : "w-1 bg-slate-200 hover:bg-slate-300")
            }`}
          />
        ))}
      </div>
    </div>
  );
}
