import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { motion } from "motion/react";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={toggleTheme}
      className="p-2.5 rounded-xl border backdrop-blur-md transition-all shadow-lg"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-card)",
        color: "var(--text-primary)",
      }}
      aria-label="Alternar Tema"
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5" style={{ color: "#93c5fd" }} />
      ) : (
        <Moon className="w-5 h-5" style={{ color: "#2563eb" }} />
      )}
    </motion.button>
  );
}
