import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Mic, MicOff, Video, VideoOff, Play, Shield, Settings, User } from "lucide-react";
import AgoraRTC from "agora-rtc-sdk-ng";

export default function LobbyPage() {
    const { roomName } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Identifica se é Líder ou Espectador
    const role = searchParams.get("role") || "audience";
    const isHost = role === "host";

    const [userName, setUserName] = useState(localStorage.getItem("devocional_user_name") || "");
    const [micOn, setMicOn] = useState(true); // Mic ligado por padrão para todos
    const [videoOn, setVideoOn] = useState(true); // Câmera ligada por padrão para todos
    const [streamReady, setStreamReady] = useState(false); // Sempre aguarda carregamento
    const [error, setError] = useState<string | null>(null);

    const localVideoRef = useRef<HTMLDivElement>(null);
    const localTracksRef = useRef<any[]>([]);

    useEffect(() => {
        const startPreview = async () => {
            // Todos os participantes vêm o preview da câmera
            try {
                const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
                localTracksRef.current = [audioTrack, videoTrack];

                if (localVideoRef.current) {
                    videoTrack.play(localVideoRef.current);
                }
                setStreamReady(true);
            } catch (err: any) {
                console.error("Preview error:", err);
                setError("Câmera/Microfone não detectados ou permissão negada.");
                setMicOn(false);
                setVideoOn(false);
                setStreamReady(true); // Permite avançar mesmo sem mídia
            }
        };

        startPreview();

        return () => {
            localTracksRef.current.forEach(t => {
                t.stop();
                t.close();
            });
        };
    }, []);

    const handleJoin = () => {
        if (!userName.trim()) return;
        localStorage.setItem("devocional_user_name", userName);
        navigate(`/room/${roomName}?nome=${encodeURIComponent(userName)}&role=${role}`);
    };

    const toggleMic = async () => {
        if (localTracksRef.current[0]) {
            await localTracksRef.current[0].setEnabled(!micOn);
            setMicOn(!micOn);
        }
    };

    const toggleVideo = async () => {
        if (localTracksRef.current[1]) {
            await localTracksRef.current[1].setEnabled(!videoOn);
            setVideoOn(!videoOn);
        }
    };

    return (
        <div className="lobby-container">
            <div className="lobby-glow" />

            <main className="lobby-content">
                {/* Lado Esquerdo: Preview */}
                <section className="preview-section">
                    <div className="preview-window">
                        <div ref={localVideoRef} className="video-surface" />

                        {/* Preview da câmera para todos */}
                        {!videoOn && (
                            <div className="video-off-overlay">
                                <div className="avatar-big">{userName[0]?.toUpperCase() || "?"}</div>
                                <p>Câmera Desligada</p>
                            </div>
                        )}

                        {error && (
                            <div className="error-overlay">
                                <p>{error}</p>
                            </div>
                        )}

                        {!streamReady && !error && (
                            <div className="loading-overlay">
                                <div className="spinner" />
                            </div>
                        )}

                        <div className="preview-controls">
                            <button
                                className={`round-btn ${!micOn ? "off" : ""}`}
                                onClick={toggleMic}
                            >
                                {micOn ? <Mic size={20} /> : <MicOff size={20} />}
                            </button>
                            <button
                                className={`round-btn ${!videoOn ? "off" : ""}`}
                                onClick={toggleVideo}
                            >
                                {videoOn ? <Video size={20} /> : <VideoOff size={20} />}
                            </button>
                            <button className="round-btn settings">
                                <Settings size={20} />
                            </button>
                        </div>
                    </div>
                </section>

                {/* Lado Direito: Ações */}
                <section className="join-section">
                    <header className="join-header">
                        <Shield className="logo" />
                        <h1>Quase lá...</h1>
                        <p>Confirme seus dados para entrar na reunião.</p>
                    </header>

                    <div className="join-card">
                        <div className="input-group">
                            <label><User size={14} /> Como você quer ser chamado?</label>
                            <input
                                type="text"
                                placeholder="Ex: João Silva"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                            />
                        </div>

                        <div className="room-summary">
                            <div className="summary-item">
                                <span>REUNIÃO</span>
                                <strong>{roomName}</strong>
                            </div>
                            <div className="summary-item">
                                <span>STATUS</span>
                                <strong className="status-on">Ativa agora</strong>
                            </div>
                        </div>

                        <button
                            className="enter-btn"
                            onClick={handleJoin}
                            disabled={!userName.trim() || !streamReady}
                        >
                            <Play fill="currentColor" size={16} />
                            {!userName.trim() ? "Digite seu nome" : !streamReady ? "Aguardando Câmera..." : "Entrar na reunião"}
                        </button>
                    </div>

                    <p className="footer-note">
                        Ao entrar, você concorda em manter um ambiente de comunhão e respeito.
                    </p>
                </section>
            </main>

            <style>{`
        .lobby-container {
          min-height: 100vh;
          background: #05060a;
          color: #f0f4ff;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          font-family: 'Outfit', sans-serif;
          position: relative;
          overflow: hidden;
        }

        .lobby-glow {
          position: absolute;
          top: -10%; left: -10%; width: 40%; height: 40%;
          background: radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%);
          filter: blur(80px);
        }

        .lobby-content {
          max-width: 1100px;
          width: 100%;
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 4rem;
          z-index: 10;
        }

        @media (max-width: 900px) {
          .lobby-content { grid-template-columns: 1fr; gap: 2rem; }
          .lobby-container { padding: 1rem; }
        }

        /* PREVIEW */
        .preview-window {
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
          background: #000;
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.05);
          box-shadow: 0 30px 60px rgba(0,0,0,0.6);
        }
        .video-surface { width: 100%; height: 100%; }
        video { object-fit: cover !important; }

        .video-off-overlay, .loading-overlay {
          position: absolute; inset: 0; background: #0d0e14;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;
        }
        .avatar-big { width: 80px; height: 80px; border-radius: 20px; background: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 800; }

        .preview-controls {
          position: absolute; bottom: 1.5rem; left: 0; right: 0;
          display: flex; justify-content: center; gap: 1rem;
        }

        .round-btn {
          width: 48px; height: 48px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.4); color: white; display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(10px); cursor: pointer; transition: 0.2s;
        }
        .round-btn:hover { background: rgba(255,255,255,0.1); transform: translateY(-2px); }
        .round-btn.off { background: #ef4444; border-color: #ef4444; }

        /* JOIN SECTION */
        .join-header h1 { font-size: 2.5rem; font-weight: 800; margin: 1rem 0 0.5rem; }
        .join-header p { color: rgba(240,244,255,0.4); margin-bottom: 2rem; }
        .logo { color: #2563eb; width: 40px; height: 40px; }

        .join-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          padding: 2rem;
          border-radius: 24px;
          display: flex; flex-direction: column; gap: 1.5rem;
        }

        .input-group label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 700; color: rgba(240,244,255,0.5); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; }
        .input-group input {
          width: 100%; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1);
          padding: 1rem 1.25rem; border-radius: 14px; color: white; transition: 0.2s;
        }
        .input-group input:focus { outline: none; border-color: #2563eb; background: rgba(37,99,235,0.05); }

        .room-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .summary-item { background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 14px; border: 1px solid rgba(255,255,255,0.05); }
        .summary-item span { display: block; font-size: 0.6rem; color: rgba(240,244,255,0.3); font-weight: 800; margin-bottom: 0.25rem; }
        .summary-item strong { font-size: 0.85rem; font-weight: 700; }
        .status-on { color: #10b981; }

        .enter-btn {
          margin-top: 1rem;
          background: #2563eb; color: white; border: none; padding: 1.25rem; border-radius: 16px;
          font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.75rem;
          cursor: pointer; transition: 0.2s; box-shadow: 0 10px 30px rgba(37,99,235,0.3);
        }
        .enter-btn:hover:not(:disabled) { transform: translateY(-4px); box-shadow: 0 15px 40px rgba(37,99,235,0.5); }
        .enter-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .footer-note { font-size: 0.7rem; color: rgba(240,244,255,0.3); line-height: 1.5; margin-top: 2rem; max-width: 300px; }

        .spinner { width: 30px; height: 30px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite; }
        
        .error-overlay {
          position: absolute; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 2rem; text-align: center; gap: 1rem; color: #f87171; z-index: 20;
        }
        .error-overlay button {
          background: #2563eb; color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 12px; cursor: pointer;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
}
