import React, { useState } from "react";
import { motion } from "motion/react";
import { Copy, Check, Quote } from "lucide-react";
import { Verse } from "../data/verses";
import { useTheme } from "../context/ThemeContext";

interface VerseCardProps {
  verse: Verse;
}

export default function VerseCard({ verse }: VerseCardProps) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`"${verse.text}" - ${verse.ref}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`relative border rounded-xl p-4 shadow-xl group transition-all duration-300 ${theme === 'dark' ? 'bg-brand-gradient-dark border-white/10 hover:border-emerald-500/30' : 'bg-brand-gradient-light border-slate-200 hover:border-indigo-500/30'}`}
    >
      <div className="absolute top-3 right-3 opacity-5 group-hover:opacity-10 transition-opacity">
        <Quote className={`w-6 h-6 rotate-180 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`} />
      </div>

      <div className="space-y-2">
        <p className={`text-base font-serif italic leading-relaxed pr-4 transition-colors duration-300 ${theme === 'dark' ? 'text-white/90' : 'text-slate-800'}`}>
          "{verse.text}"
        </p>
        
        <div className="flex items-center justify-between pt-1">
          <span className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-colors duration-300 ${theme === 'dark' ? 'text-emerald-400' : 'text-indigo-600'}`}>
            {verse.ref}
          </span>
          
          <button
            onClick={handleCopy}
            className={`p-1.5 rounded-lg transition-all active:scale-90 ${
              copied 
                ? (theme === 'dark' ? "bg-emerald-500 text-white" : "bg-indigo-600 text-white")
                : (theme === 'dark' ? "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/10" : "bg-black/5 text-slate-400 hover:bg-black/10 hover:text-slate-600 border border-black/5")
            }`}
            title="Copiar Versículo"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
