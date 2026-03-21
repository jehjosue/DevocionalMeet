import React, { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const WORDS = [
  "Fé", "Amor", "Graça", "Paz", "Alegria", "Jesus", "Vida", "Luz",
  "Esperança", "Não temas", "Ele vive", "Salvação", "Deus", "Emanuel", "Espírito"
];

export default function WhispersOfFaith() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const whispers = useMemo(() => {
    return WORDS.map((word, i) => {
      // Posição inicial espalhada por toda a tela (usando limits marginais para não ficar no canto exato)
      const top = Math.random() * 80 + 10; // 10% a 90%
      const left = Math.random() * 80 + 10; // 10% a 90%
      
      const duration = Math.random() * 8 + 6; // 6s a 14s aparecendo
      const delay = Math.random() * 30; // delay bem longo pra não aparecer tudo junto
      
      const sizes = ['text-2xl', 'text-4xl', 'text-5xl', 'text-[3rem]', 'text-6xl'];
      const opacities = [0.2, 0.3, 0.4, 0.5];
      
      const sizeIndex = Math.floor(Math.random() * sizes.length);
      const size = sizes[sizeIndex];
      const targetOpacity = opacities[Math.floor(Math.random() * opacities.length)];

      // Sentido do movimento sutil (pra cima ou pra baixo)
      const moveDistance = Math.random() > 0.5 ? -30 : 30;

      return { word, top, left, duration, delay, size, targetOpacity, moveDistance, id: i };
    });
  }, []);

  if (!isClient) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      <AnimatePresence>
        {whispers.map((w) => (
          <motion.div
            key={w.id}
            initial={{ opacity: 0, scale: 0.9, y: 0 }}
            animate={{
              opacity: [0, w.targetOpacity, 0], // Aparece sutilmente e some
              scale: [0.9, 1.05, 1], // Fica levemente maior ao aparecer
              y: [0, w.moveDistance * 0.5, w.moveDistance] // Flutua lentamente verticalmente
            }}
            transition={{
              duration: w.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: w.delay,
              repeatDelay: Math.random() * 10 + 2
            }}
            className={`absolute font-black tracking-[0.2em] uppercase mix-blend-overlay ${w.size}`}
            style={{
              top: `${w.top}%`,
              left: `${w.left}%`,
              color: 'rgba(255,255,255,0.9)',
              willChange: "transform, opacity",
            }}
          >
            {w.word}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
