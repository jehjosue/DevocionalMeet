import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, ArrowRight, User, Shield, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import DailyVerses from "../components/DailyVerses";
import ThemeToggle from "../components/ThemeToggle";

export default function Home() {
  const [roomUrl, setRoomUrl] = useState("");
  const navigate = useNavigate();

  const generateRoomName = () => {
    const now = new Date();
    const datePart = now.toISOString().split("T")[0].replace(/-/g, "");
    return `devocional-${datePart}-${Math.floor(Math.random() * 1000)}`;
  };

  const createRoom = () => {
    const name = generateRoomName();
    navigate(`/pre/${name}`);
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomUrl) {
      const name = roomUrl.includes("/") ? roomUrl.split("/").pop() : roomUrl;
      if (name) navigate(`/pre/${name}`);
    }
  };

  return (
    <div className="home-container">
      <div className="home-bg-blobs">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
      </div>

      <nav className="home-nav">
        <div className="logo-area">
          <Shield size={28} className="text-blue-500" />
          <span className="logo-text">DevocionalMeet</span>
        </div>
        <ThemeToggle />
      </nav>

      <main className="home-hero">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="hero-card"
        >
          <div className="badge-premium">
            <Sparkles size={12} />
            <span>Versão Premium 2.0</span>
          </div>

          <header className="hero-header">
            <h1>Momentos de <span className="text-gradient">Comunhão</span> e Fé</h1>
            <p>A plataforma definitiva para suas reuniões de devocional, agora mais rápida, segura e com design profissional.</p>
          </header>

          <DailyVerses />

          <div className="hero-actions">
            <div className="action-main">
              <button className="btn-create" onClick={createRoom}>
                <Plus size={20} />
                Iniciar Nova Reunião
              </button>
            </div>

            <div className="divider">
              <span className="line" />
              <span className="text">OU</span>
              <span className="line" />
            </div>

            <form className="join-input-group" onSubmit={joinRoom}>
              <div className="input-wrap">
                <User size={18} className="icon" />
                <input
                  type="text"
                  placeholder="Código ou link da sala"
                  value={roomUrl}
                  onChange={(e) => setRoomUrl(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-join">
                <ArrowRight size={20} />
              </button>
            </form>
          </div>
        </motion.div>

        <section className="features-grid">
          <div className="feat-item">
            <div className="feat-icon"><Shield size={20} /></div>
            <h3>Privacidade Total</h3>
            <p>Sua comunicação é direta e segura.</p>
          </div>
          <div className="feat-item">
            <div className="feat-icon"><BookOpen size={20} /></div>
            <h3>Foco na Palavra</h3>
            <p>Interface limpa para não distrair do que importa.</p>
          </div>
        </section>
      </main>

      <style>{`
        .home-container {
          min-height: 100vh;
          background: #05060a;
          color: #f0f4ff;
          position: relative;
          overflow: hidden;
          font-family: 'Outfit', sans-serif;
          display: flex; flex-direction: column;
        }

        .home-bg-blobs .blob {
          position: absolute; width: 600px; height: 600px; border-radius: 50%; opacity: 0.15; filter: blur(80px);
        }
        .blob-1 { top: -200px; left: -200px; background: #2563eb; }
        .blob-2 { bottom: -200px; right: -200px; background: #1e3a8a; }

        .home-nav {
          display: flex; justify-content: space-between; align-items: center; padding: 2rem 10%; z-index: 20;
        }
        .logo-area { display: flex; align-items: center; gap: 0.75rem; }
        .logo-text { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; }

        .home-hero { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; z-index: 10; gap: 4rem; }
        
        .hero-card {
          max-width: 600px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2rem;
        }

        .badge-premium {
          display: flex; align-items: center; gap: 0.5rem; background: rgba(37,99,235,0.1); padding: 0.5rem 1rem;
          border-radius: 99px; border: 1px solid rgba(37,99,235,0.2); color: #60a5fa; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
        }

        .hero-header h1 { font-size: 3.5rem; font-weight: 900; line-height: 1.1; letter-spacing: -0.05em; }
        .text-gradient { background: linear-gradient(to right, #60a5fa, #2563eb); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .hero-header p { font-size: 1.15rem; color: rgba(240,244,255,0.5); line-height: 1.6; max-width: 500px; margin: 1.5rem auto 0; }

        .hero-actions { width: 100%; display: flex; flex-direction: column; gap: 1.5rem; }

        .btn-create {
          width: 100%; padding: 1.25rem; border-radius: 20px; border: none; background: #2563eb; color: white;
          font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; gap: 1rem;
          cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 10px 40px rgba(37,99,235,0.3);
        }
        .btn-create:hover { transform: translateY(-5px); box-shadow: 0 20px 60px rgba(37,99,235,0.5); }

        .divider { display: flex; align-items: center; gap: 1rem; color: rgba(240,244,255,0.2); font-size: 0.75rem; font-weight: 800; }
        .divider .line { flex: 1; height: 1px; background: rgba(255,255,255,0.05); }

        .join-input-group { display: flex; gap: 0.75rem; width: 100%; }
        .input-wrap { flex: 1; position: relative; }
        .input-wrap .icon { position: absolute; left: 1.25rem; top: 50%; transform: translateY(-50%); color: rgba(240,244,255,0.3); }
        .input-wrap input {
          width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 1rem 1rem 1rem 3.5rem;
          border-radius: 18px; color: white; font-size: 1rem; transition: 0.2s;
        }
        .input-wrap input:focus { border-color: #2563eb; background: rgba(37,99,235,0.05); outline: none; }

        .btn-join {
          padding: 1rem; border-radius: 18px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05);
          color: white; cursor: pointer; transition: 0.2s;
        }
        .btn-join:hover { background: #2563eb; border-color: #2563eb; }

        .features-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; max-width: 800px; width: 100%; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4rem; }
        .feat-item { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.75rem; }
        .feat-icon { width: 44px; height: 44px; border-radius: 14px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: #2563eb; }
        .feat-item h3 { font-size: 1rem; font-weight: 700; }
        .feat-item p { font-size: 0.85rem; color: rgba(240,244,255,0.4); }

        @media (max-width: 600px) {
          .hero-header h1 { font-size: 2.5rem; }
          .features-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
