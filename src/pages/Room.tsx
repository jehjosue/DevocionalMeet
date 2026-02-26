import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Copy, LogOut, Shield, CheckCircle2, Mic, MicOff, Video, VideoOff, Users, Info, Settings, Share2, MessageSquare } from "lucide-react";

declare const AgoraRTC: any;

export default function Room() {
  const { roomName } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [copied, setCopied] = useState(false);
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [participantsCount, setParticipantsCount] = useState(1);

  const clientRef = useRef<any>(null);
  const localTracksRef = useRef<any[]>([]);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const userName = searchParams.get("nome") || localStorage.getItem("devocional_user_name") || "Participante";
  const appId = (import.meta as any).env.VITE_AGORA_APP_ID;

  useEffect(() => {
    const initAgora = async () => {
      if (!appId || !roomName) return;

      try {
        clientRef.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        await clientRef.current.join(appId, roomName, null, null);

        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        localTracksRef.current = [audioTrack, videoTrack];

        // Renderizar vídeo local
        const localPlayer = document.createElement("div");
        localPlayer.className = "participant-card local";
        localPlayer.id = "local-player";

        const label = document.createElement("div");
        label.className = "participant-label";
        label.innerText = `${userName} (Você)`;
        localPlayer.appendChild(label);

        videoContainerRef.current?.append(localPlayer);
        videoTrack.play(localPlayer);

        await clientRef.current.publish(localTracksRef.current);
        setJoined(true);

        // Usuário Entrou
        clientRef.current.on("user-published", async (user: any, mediaType: string) => {
          await clientRef.current.subscribe(user, mediaType);
          if (mediaType === "video") {
            const remotePlayer = document.createElement("div");
            remotePlayer.className = "participant-card";
            remotePlayer.id = user.uid.toString();

            const rLabel = document.createElement("div");
            rLabel.className = "participant-label";
            rLabel.innerText = "Participante";
            remotePlayer.appendChild(rLabel);

            videoContainerRef.current?.append(remotePlayer);
            user.videoTrack.play(remotePlayer);
            setParticipantsCount(prev => prev + 1);
          }
          if (mediaType === "audio") {
            user.audioTrack.play();
          }
        });

        // Usuário Saiu
        clientRef.current.on("user-unpublished", (user: any) => {
          const remotePlayer = document.getElementById(user.uid.toString());
          remotePlayer?.remove();
          setParticipantsCount(prev => Math.max(1, prev - 1));
        });

      } catch (err) {
        console.error("Agora Error:", err);
      }
    };

    initAgora();

    return () => {
      localTracksRef.current.forEach(t => {
        t.stop();
        t.close();
      });
      clientRef.current?.leave();
      if (videoContainerRef.current) videoContainerRef.current.innerHTML = "";
    };
  }, [roomName, appId, userName]);

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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + "/join");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="room-container">
      {/* ── SIDEBAR (Inspirada no Jitsi mas Premium) ── */}
      <aside className={`sidebar ${showSidebar ? "open" : "closed"}`}>
        <div className="sidebar-header">
          <div className="logo-wrap">
            <Shield className="logo-icon" />
            <span>DevocionalMeet</span>
          </div>
        </div>

        <div className="sidebar-content">
          <div className="room-info-card">
            <p className="label">REUNIÃO</p>
            <h3>{roomName?.replace(/-/g, " ")}</h3>
            <div className="status-badge">
              <div className="pulse-dot" />
              AO VIVO
            </div>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-item active">
              <Users size={18} />
              <span>Participantes ({participantsCount})</span>
            </div>
            <div className="nav-item" onClick={handleCopyLink}>
              <Share2 size={18} />
              <span>{copied ? "Link Copiado!" : "Convidar pessoas"}</span>
            </div>
            <div className="nav-item">
              <MessageSquare size={18} />
              <span>Chat</span>
            </div>
          </nav>

          <div className="warning-box">
            <Info size={16} />
            <p>Se estiver apenas assistindo, mantenha o microfone desligado por respeito à comunhão.</p>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="avatar">{userName[0]?.toUpperCase()}</div>
            <div className="user-text">
              <p className="u-name">{userName}</p>
              <p className="u-status">Conectado</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <main className="main-viewport">
        {/* Top Header */}
        <header className="room-header">
          <button className="sidebar-toggle" onClick={() => setShowSidebar(!showSidebar)}>
            <div className="toggle-line" />
            <div className="toggle-line" />
            <div className="toggle-line" />
          </button>

          <div className="header-room-title">
            <span>{roomName}</span>
          </div>

          <div className="header-actions">
            <button className="exit-btn" onClick={() => navigate("/")}>
              <LogOut size={18} />
              Sair
            </button>
          </div>
        </header>

        {/* Video Grid */}
        <div
          ref={videoContainerRef}
          className={`video-grid count-${participantsCount}`}
        >
          {/* O carregamento aparece aqui se não estiver pronto */}
          {!joined && (
            <div className="room-loader">
              <div className="spinner" />
              <p>Preparando comunhão...</p>
            </div>
          )}
        </div>

        {/* Floating Controls */}
        <div className="control-bar">
          <div className="controls-island">
            <button
              className={`control-btn ${!micOn ? "disabled" : ""}`}
              onClick={toggleMic}
              title={micOn ? "Mudar áudio" : "Ativar áudio"}
            >
              {micOn ? <Mic size={22} /> : <MicOff size={22} />}
            </button>

            <button
              className={`control-btn ${!videoOn ? "disabled" : ""}`}
              onClick={toggleVideo}
              title={videoOn ? "Desligar câmera" : "Ativar câmera"}
            >
              {videoOn ? <Video size={22} /> : <VideoOff size={22} />}
            </button>

            <button className="control-btn settings">
              <Settings size={22} />
            </button>

            <div className="control-sep" />

            <button className="control-btn hangup" onClick={() => navigate("/")}>
              <LogOut size={22} />
            </button>
          </div>
        </div>
      </main>

      <style>{`
        :root {
          --bg-dark: #05060a;
          --bg-surface: #0d0e14;
          --sidebar-bg: #090a10;
          --accent: #2563eb;
          --accent-glow: rgba(37,99,235,0.4);
          --text: #f0f4ff;
          --text-muted: rgba(240,244,255,0.4);
          --glass-border: rgba(255,255,255,0.06);
          --radius: 20px;
        }

        .room-container {
          height: 100vh;
          width: 100vw;
          background: var(--bg-dark);
          color: var(--text);
          display: flex;
          overflow: hidden;
          font-family: 'Outfit', sans-serif;
        }

        /* ── SIDEBAR ── */
        .sidebar {
          width: 320px;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--glass-border);
          display: flex;
          flex-direction: column;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sidebar.closed { width: 0; opacity: 0; pointer-events: none; }

        .sidebar-header { padding: 2rem 1.5rem; }
        .logo-wrap { display: flex; align-items: center; gap: 0.75rem; font-weight: 800; font-size: 1.25rem; }
        .logo-icon { color: var(--accent); }

        .sidebar-content { flex: 1; padding: 0 1.5rem; display: flex; flex-direction: column; gap: 2rem; }
        
        .room-info-card {
          background: rgba(255,255,255,0.03);
          padding: 1.5rem;
          border-radius: 18px;
          border: 1px solid var(--glass-border);
        }
        .room-info-card .label { font-size: 0.65rem; color: var(--text-muted); letter-spacing: 0.2em; margin-bottom: 0.5rem; }
        .room-info-card h3 { font-size: 1.1rem; margin-bottom: 0.75rem; color: var(--text); }
        .status-badge { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.7rem; font-weight: 700; color: var(--accent); }
        .pulse-dot { width: 8px; height: 8px; background: var(--accent); border-radius: 50%; box-shadow: 0 0 10px var(--accent); animation: pulse 2s infinite; }

        .sidebar-nav { display: flex; flex-direction: column; gap: 0.5rem; }
        .nav-item { 
          display: flex; align-items: center; gap: 1rem; padding: 1rem; 
          border-radius: 12px; transition: all 0.2s; cursor: pointer; color: var(--text-muted); font-size: 0.9rem;
        }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: var(--text); }
        .nav-item.active { background: rgba(37,99,235,0.1); color: var(--accent); font-weight: 600; }

        .warning-box {
          background: rgba(14,165,233,0.05);
          padding: 1rem;
          border-radius: 12px;
          border-left: 3px solid var(--accent);
          display: flex; gap: 0.75rem; font-size: 0.75rem; line-height: 1.5; color: rgba(240,244,255,0.6);
        }

        .sidebar-footer { padding: 2rem 1.5rem; border-top: 1px solid var(--glass-border); }
        .user-profile { display: flex; align-items: center; gap: 1rem; }
        .avatar { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #1d4ed8, #2563eb); display: flex; align-items: center; justify-content: center; font-weight: 800; }
        .user-text .u-name { font-size: 0.9rem; font-weight: 600; }
        .user-text .u-status { font-size: 0.7rem; color: var(--text-muted); }

        /* ── MAIN AREA ── */
        .main-viewport { flex: 1; display: flex; flex-direction: column; position: relative; }

        .room-header { 
          padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; 
          background: rgba(5,6,10,0.5); backdrop-filter: blur(10px);
        }
        .sidebar-toggle { width: 32px; height: 32px; background: none; border: none; cursor: pointer; display: flex; flex-direction: column; gap: 6px; justify-content: center; }
        .toggle-line { width: 24px; height: 2px; background: var(--text); border-radius: 2px; transition: 0.3s; }

        .header-room-title { font-weight: 300; font-size: 0.9rem; letter-spacing: 0.05em; opacity: 0.6; }

        .exit-btn {
          background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.2); 
          padding: 0.6rem 1.25rem; border-radius: 10px; font-size: 0.8rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; transition: 0.2s;
        }
        .exit-btn:hover { background: #ef4444; color: #fff; }

        /* VIDEO GRID */
        .video-grid { flex: 1; padding: 1.5rem; display: grid; gap: 1rem; align-content: center; justify-content: center; overflow-y: auto; }
        .video-grid.count-1 { grid-template-columns: minmax(300px, 900px); grid-template-rows: auto; }
        .video-grid.count-2 { grid-template-columns: 1fr 1fr; }
        .video-grid.count-3, .video-grid.count-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }

        .participant-card { 
          width: 100%; aspect-ratio: 16/9; background: #000; border-radius: var(--radius); overflow: hidden; position: relative; 
          border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        }
        .participant-card.local { border-color: var(--accent-glow); outline: 2px solid var(--accent-glow); }
        .participant-label { 
          position: absolute; bottom: 1rem; left: 1rem; padding: 0.4rem 0.8rem; border-radius: 8px; 
          background: rgba(0,0,0,0.5); backdrop-filter: blur(10px); color: #fff; font-size: 0.75rem; font-weight: 600; z-index: 5;
        }
        video { object-fit: cover !important; }

        .room-loader { display: flex; flex-direction: column; align-items: center; gap: 1rem; opacity: 0.5; }
        .spinner { width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--accent); border-radius: 50%; animation: pulse 1s linear infinite; }

        /* CONTROLS */
        .control-bar { position: absolute; bottom: 2rem; left: 0; right: 0; display: flex; justify-content: center; pointer-events: none; }
        .controls-island { 
          pointer-events: auto; display: flex; gap: 1rem; padding: 0.75rem 2rem; 
          background: rgba(9,10,16,0.5); backdrop-filter: blur(25px); border-radius: 24px; border: 1px solid var(--glass-border); box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }

        .control-btn {
          width: 52px; height: 52px; border-radius: 50%; border: none; background: rgba(255,255,255,0.05); color: var(--text);
          display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
        }
        .control-btn:hover { background: rgba(255,255,255,0.15); transform: translateY(-3px); }
        .control-btn.disabled { background: #ef4444; color: #fff; }
        .control-btn.hangup { background: #ef4444; color: #fff; }
        .control-btn.hangup:hover { transform: scale(1.1); box-shadow: 0 0 25px rgba(239,68,68,0.5); }

        .control-sep { width: 1px; height: 32px; background: var(--glass-border); align-self: center; margin: 0 0.5rem; }

        @keyframes pulse { 0% { opacity: 0.4; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1); } 100% { opacity: 0.4; transform: scale(0.95); } }
      `}</style>
    </div>
  );
}
