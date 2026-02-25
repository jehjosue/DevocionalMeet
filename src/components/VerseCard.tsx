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
    navigator.clipboard.writeText(`"${verse.text}" — ${verse.ref}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative rounded-xl overflow-hidden group"
      style={{
        background: theme === "dark" ? "var(--bg-card)" : "var(--bg-card)",
        border: "1px solid var(--border-card)",
        boxShadow: "var(--glow-card)",
      }}
    >
      {/* Top accent bar com degradê azul */}
      <div
        className="h-[3px] w-full"
        style={{
          background: "linear-gradient(90deg, #0b3d91 0%, #1e3a8a 50%, #2563eb 100%)",
        }}
      />

      <div className="p-4 space-y-2">
        {/* Quote icon decorativo */}
        <div className="absolute top-5 right-4 opacity-[0.06] group-hover:opacity-[0.1] transition-opacity duration-300">
          <Quote
            className="w-7 h-7 rotate-180"
            style={{ color: "#2563eb" }}
          />
        </div>

        {/* Texto do versículo */}
        <p
          className="text-base font-serif italic leading-relaxed pr-6 transition-colors duration-200"
          style={{ color: "var(--text-primary)" }}
        >
          "{verse.text}"
        </p>

        {/* Referência + Copiar */}
        <div className="flex items-center justify-between pt-1">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.2em] transition-colors duration-200"
            style={{ color: "var(--verse-ref)" }}
          >
            {verse.ref}
          </span>

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg transition-all duration-200 active:scale-90"
            style={
              copied
                ? {
                  background: "linear-gradient(135deg, #0b3d91, #2563eb)",
                  color: "#fff",
                }
                : {
                  background: "var(--bg-input)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-input)",
                }
            }
            title="Copiar Versículo"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
