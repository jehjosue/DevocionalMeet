import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Cloud } from 'lucide-react';

const WORDS = ["Fé", "Amor", "Graça", "Paz", "Alegria", "Jesus", "Vida", "Luz"];

export default function FloatingClouds() {
  // Gerar valores aleatórios apenas na montagem inicial para evitar re-renders
  const clouds = useMemo(() => {
    return WORDS.map((word, i) => {
      const startY = Math.random() * 50 + 5; // 5% a 55% da altura da tela (parte de cima)
      const duration = Math.random() * 20 + 25; // 25s a 45s de travessia
      const delay = Math.random() * 20; // inicio espalhado
      const scale = Math.random() * 0.5 + 0.8; // 0.8 a 1.3 de tamanho

      return { word, startY, duration, delay, scale, id: i };
    });
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
      {/* Nuvens e Palavras */}
      {clouds.map((c) => (
        <motion.div
          key={c.id}
          initial={{ x: "110vw", y: `${c.startY}vh`, scale: c.scale }}
          animate={{
            x: "-30vw",
            y: [`${c.startY}vh`, `${c.startY - 3}vh`, `${c.startY}vh`],
          }}
          transition={{
            x: { duration: c.duration, repeat: Infinity, ease: "linear", delay: c.delay },
            y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: c.delay },
          }}
          className="absolute flex flex-col items-center justify-center opacity-70"
        >
          {/* Nuvem SVG via Lucide */}
          <Cloud 
            size={140} 
            strokeWidth={1}
            className="text-white/60 drop-shadow-xl fill-white/20 dark:text-white/20 dark:fill-white/5" 
          />
          {/* Palavra flutuando dentro da Nuvem */}
          <span className="absolute mt-2 text-xl font-black tracking-widest uppercase text-blue-900/70 dark:text-blue-200/60 drop-shadow-md">
            {c.word}
          </span>
        </motion.div>
      ))}

      {/* Bonequinho Pulando com a mão para cima (Sutil) */}
      <motion.div
        animate={{
          y: [0, -80, 0], // Altura do pulo
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
          repeatDelay: 2, // Pula a cada 2 segundos
        }}
        className="absolute bottom-10 left-[15%] md:left-[25%] text-blue-600/90 dark:text-blue-400/90 drop-shadow-2xl"
      >
        <svg
          width="90"
          height="110"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Cabeça */}
          <circle cx="12" cy="6" r="4" />
          {/* Corpo */}
          <path d="M12 10v6" />
          {/* Braços esticados para cima (como se tentasse pegar) */}
          <path d="M12 12c-2-4-4-6-5-7" /> 
          <path d="M12 12c2-4 4-6 5-7" />
          {/* Pernas dobradas do pulo */}
          <path d="M12 16l-3 6" />
          <path d="M12 16l3 6" />
        </svg>
      </motion.div>
    </div>
  );
}
