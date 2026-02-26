import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Copy, LogOut, Shield, Mic, MicOff, Video, VideoOff, Users, Share2, MessageSquare, Menu, X, Settings } from "lucide-react";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "motion/react";

declare const AgoraRTC: any;

export default function Room() {
  const { roomName } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [participantsCount, setParticipantsCount] = useState(1);
  const [copied, setCopied] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const clientRef = useRef<any>(null);
  const localTracksRef = useRef<any[]>([]);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const userName = searchParams.get("nome") || localStorage.getItem("devocional_user_name") || "Participante";
  const role = searchParams.get("role") || "audience";
  const isHost = role === "host";
  const appId = (import.meta as any).env.VITE_AGORA_APP_ID;

  const [activeTab, setActiveTab] = useState<"people" | "chat">("people");
  const [messages, setMessages] = useState<{ id: string, sender: string, text: string, time: string }[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenTrackRef = useRef<any>(null);

  useEffect(() => {
    const initAgora = async () => {
      if (!appId || !roomName) return;

      try {
        if (typeof AgoraRTC === "undefined") {
          setTimeout(initAgora, 1000);
          return;
        }

        // Usa o modo "live" (Broadcast) com a role correta
        clientRef.current = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        await clientRef.current.setClientRole(role as "host" | "audience");

        try {
          await clientRef.current.join(appId, roomName, null, null);
        } catch (joinErr: any) {
          console.error("Agora Join Error:", joinErr);
          if (joinErr?.code === "CAN_NOT_GET_GATEWAY_SERVER" || joinErr?.message?.toLowerCase().includes("token") || joinErr?.code === "ERR_DYNAMIC_KEY_TIMEOUT" || joinErr?.code === "ERR_INVALID_TOKEN") {
            setConnectionError("Erro de Autenticação: O seu projeto no Agora Console está configurado como 'Seguro' (Secure Mode). Isso exige um Servidor de Tokens. Para funcionar sem servidor (como agora), crie um novo projeto no Agora selecionando 'Testing Mode' (apenas App ID).");
          } else {
            setConnectionError("Falha ao entrar na sala. Verifique sua conexão e se o App ID está correto.");
          }
          return; // Para a execução se falhar
        }

        // Só host cria e publica as faixas locais
        if (isHost) {
          const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks().catch(err => {
            console.warn("Câmera/Mic recusados, você não conseguirá transmitir vídeo/áudio.");
            return [null, null];
          });

          if (audioTrack || videoTrack) {
            localTracksRef.current = [audioTrack, videoTrack];

            if (videoTrack) {
              const localPlayer = document.createElement("div");
              localPlayer.className = "participant-card local";
              localPlayer.id = "local-player";
              const label = document.createElement("div");
              label.className = "participant-label";
              label.innerText = `${userName} (Você)`;
              localPlayer.appendChild(label);
              videoContainerRef.current?.append(localPlayer);
              videoTrack.play(localPlayer);
            }

            await clientRef.current.publish(localTracksRef.current.filter(t => t !== null));
          }
        }

        setJoined(true);

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
        if (t) { t.stop(); t.close(); }
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

  useEffect(() => {
    if (!roomName) return;

    // Conecta no canal específico da sala para o chat
    const channel = supabase.channel(`room_${roomName}`);

    channel
      .on('broadcast', { event: 'chat_message' }, (payload) => {
        setMessages((prev) => [...prev, payload.payload]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomName]);

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: "1080p_1",
          optimizationMode: "detail"
        });

        screenTrackRef.current = screenTrack;

        // Substitui a faixa de vídeo atual pela da tela
        if (localTracksRef.current[1]) {
          await clientRef.current.replaceTrack(localTracksRef.current[1], screenTrack);
        } else {
          // Se ele não tinha vídeo antes
          await clientRef.current.publish(screenTrack);
        }

        // Toca a tela localmente
        const localPlayer = document.getElementById("local-player");
        if (localPlayer) {
          screenTrack.play(localPlayer);
        }

        setIsScreenSharing(true);

        // Se o usuário parar o compartilhamento pelo botão nativo do navegador
        screenTrack.on("track-ended", async () => {
          stopScreenShare();
        });

      } catch (err) {
        console.error("Erro ao compartilhar tela:", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = async () => {
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current.close();

      // Restaura a câmera normal
      if (localTracksRef.current[1]) {
        await clientRef.current.replaceTrack(screenTrackRef.current, localTracksRef.current[1]);
        const localPlayer = document.getElementById("local-player");
        if (localPlayer) {
          localTracksRef.current[1].play(localPlayer);
        }
      } else {
        await clientRef.current.unpublish(screenTrackRef.current);
      }

      screenTrackRef.current = null;
      setIsScreenSharing(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const msg = {
      id: Math.random().toString(),
      sender: userName,
      text: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, msg]);
    setNewMessage("");

    // Dispara via Supabase para todos na sala
    if (roomName) {
      await supabase.channel(`room_${roomName}`).send({
        type: 'broadcast',
        event: 'chat_message',
        payload: msg
      });
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="meet-container">
      {/* ── TOP INFO (Google Meet style) ── */}
      <div className="meet-top-bar">
        <div className="meet-room-info">
          <span className="room-code">{roomName}</span>
          <span className="divider">|</span>
          <span className="room-time">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* ── MAIN CONTENT (Grid) ── */}
      <main className="meet-main">
        <div
          ref={videoContainerRef}
          className={`meet-grid count-${participantsCount}`}
        />

        {!joined && !connectionError && (
          <div className="meet-loader">
            <div className="loader-spinner" />
            <p>Conectando à reunião...</p>
          </div>
        )}

        {connectionError && (
          <div className="meet-error">
            <Shield size={48} style={{ color: "#ef4444", marginBottom: "1rem" }} />
            <h3>Falha na Conexão</h3>
            <p>{connectionError}</p>
            <button onClick={() => navigate("/")} className="error-back-btn">
              Voltar para o Início
            </button>
          </div>
        )}
      </main>

      {/* ── BOTTOM CONTROLS (Google Meet style) ── */}
      <div className="meet-bottom-bar">
        {/* Left Side: Clock/Info hide on mobile or move to center */}
        <div className="controls-left desktop-only">
          <div className="meet-logo">
            <Shield size={20} className="text-blue-500" />
            <span>DevocionalMeet</span>
          </div>
        </div>

        {/* Center: Main Controls */}
        <div className="controls-center">
          {isHost ? (
            <>
              <button
                className={`meet-btn ${!micOn ? 'danger' : ''}`}
                onClick={toggleMic}
              >
                {micOn ? <Mic size={24} /> : <MicOff size={24} />}
              </button>

              <button
                className={`meet-btn ${!videoOn ? 'danger' : ''}`}
                onClick={toggleVideo}
              >
                {videoOn ? <Video size={24} /> : <VideoOff size={24} />}
              </button>

              <button
                className={`meet-btn ${isScreenSharing ? 'active-share' : ''}`}
                onClick={toggleScreenShare}
                title="Compartilhar Tela"
              >
                <Share2 size={24} />
              </button>
            </>
          ) : (
            <div className="audience-badge">Modo de Exibição (Ouvinte)</div>
          )}

          <button className="meet-btn exit" onClick={() => navigate("/")}>
            <LogOut size={24} />
          </button>
        </div>

        {/* Right Side: Sidebar Toggles */}
        <div className="controls-right">
          <button className="meet-btn secondary" onClick={() => setShowSidebar(true)}>
            <Users size={20} />
            <span className="badge">{participantsCount}</span>
          </button>
          <button className="meet-btn secondary" onClick={copyLink}>
            <Share2 size={20} />
          </button>
        </div>
      </div>

      {/* ── SIDEBAR DRAWER (Overlay) ── */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="meet-overlay"
              onClick={() => setShowSidebar(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="meet-sidebar"
            >
              <div className="sidebar-header">
                <h2>Detalhes da reunião</h2>
                <button onClick={() => setShowSidebar(false)}><X /></button>
              </div>

              <div className="sidebar-tabs">
                <button
                  className={`tab ${activeTab === 'people' ? 'active' : ''}`}
                  onClick={() => setActiveTab("people")}
                >
                  Pessoas
                </button>
                <button
                  className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setActiveTab("chat")}
                >
                  Chat
                </button>
              </div>

              <div className="sidebar-content">
                {activeTab === "people" ? (
                  <>
                    <div className="section-label">GERENCIAR REUNIÃO</div>
                    <button className="sidebar-action-btn" onClick={copyLink}>
                      <Copy size={18} />
                      {copied ? "Link Copiado!" : "Copiar informações de participação"}
                    </button>

                    <div className="section-label">PARTICIPANTES</div>
                    <div className="participant-list">
                      <div className="participant-item">
                        <div className="p-avatar">{userName[0]?.toUpperCase() || "?"}</div>
                        <div className="p-name">{userName} (Você) {isHost ? "👑" : "👀"}</div>
                        <div className="p-icons">
                          {isHost ? (micOn ? <Mic size={14} /> : <MicOff size={14} className="text-red-500" />) : <span className="text-xs">Ouvinte</span>}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="chat-container">
                    <div className="chat-messages">
                      {messages.length === 0 ? (
                        <div className="empty-chat">
                          <MessageSquare size={32} style={{ opacity: 0.2, margin: "0 auto 10px" }} />
                          <p>Nenhuma mensagem ainda.<br />Seja o primeiro a dizer olá!</p>
                        </div>
                      ) : (
                        messages.map((msg) => (
                          <div key={msg.id} className={`chat-msg ${msg.sender === userName ? 'mine' : ''}`}>
                            <div className="msg-header">
                              <strong>{msg.sender === userName ? "Você" : msg.sender}</strong>
                              <span>{msg.time}</span>
                            </div>
                            <div className="msg-bubble">{msg.text}</div>
                          </div>
                        ))
                      )}
                    </div>
                    <form className="chat-input-area" onSubmit={sendMessage}>
                      <input
                        type="text"
                        placeholder="Envie uma mensagem..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                      />
                      <button type="submit" disabled={!newMessage.trim()}>Enviar</button>
                    </form>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <style>{`
        .meet-container {
            height: 100vh; width: 100vw;
            background: #202124;
            color: white;
            display: flex; flex-direction: column;
            overflow: hidden;
            font-family: 'Inter', sans-serif;
            position: relative;
        }

        /* TOP BAR */
        .meet-top-bar {
            position: absolute; top: 0; left: 0; padding: 1rem 1.5rem;
            z-index: 10;
        }
        .meet-room-info {
            display: flex; align-items: center; gap: 0.75rem;
            font-weight: 500; font-size: 0.9rem;
            background: rgba(0,0,0,0.3); padding: 0.5rem 1rem; border-radius: 8px;
        }
        .divider { opacity: 0.3; }

        /* MAIN */
        .meet-main { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .meet-grid {
            width: 100%; height: 100%;
            display: grid; gap: 0.75rem;
            justify-content: center; align-content: center;
        }
        .meet-grid.count-1 { grid-template-columns: minmax(200px, 90%); max-height: 80vh; }
        .meet-grid.count-2 { grid-template-columns: 1fr 1fr; }
        @media (max-width: 600px) {
            .meet-grid.count-2 { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
        }

        .participant-card {
            width: 100%; aspect-ratio: 16/9; background: #3c4043; border-radius: 12px; overflow: hidden;
            position: relative; border: 1px solid rgba(255,255,255,0.05);
            transition: all 0.3s;
        }
        @media (max-width: 600px) {
            .participant-card { aspect-ratio: 1/1.2; }
        }
        .participant-label {
            position: absolute; bottom: 0.75rem; left: 0.75rem;
            background: rgba(0,0,0,0.5); padding: 0.25rem 0.75rem; border-radius: 4px;
            font-size: 0.75rem; font-weight: 500; z-index: 2;
        }
        video { object-fit: cover !important; }

        /* LOADER & ERROR */
        .meet-loader, .meet-error { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; text-align: center; padding: 2rem; max-width: 500px; margin: 0 auto; z-index: 10; position: absolute; inset: 0; }
        .meet-error { background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); border-radius: 24px; border: 1px solid rgba(239,68,68,0.3); position: relative; height: fit-content; margin-top: auto; margin-bottom: auto; }
        .meet-error p { color: rgba(255,255,255,0.7); line-height: 1.5; font-size: 0.9rem; }
        .error-back-btn { background: #2563eb; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 12px; cursor: pointer; font-weight: 600; margin-top: 1rem; transition: 0.2s; }
        .error-back-btn:hover { background: #1d4ed8; transform: translateY(-2px); box-shadow: 0 10px 20px rgba(37,99,235,0.4); }
        .loader-spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #8ab4f8; border-radius: 50%; animation: spin 1s linear infinite; }

        /* BOTTOM BAR */
        .meet-bottom-bar {
            height: 80px; padding: 0 1.5rem;
            display: flex; align-items: center; justify-content: space-between;
            background: #202124; z-index: 20;
        }
        .controls-center { display: flex; gap: 0.75rem; align-items: center; }
        .meet-btn {
            width: 48px; height: 48px; border-radius: 50%; border: none;
            background: #3c4043; color: white; display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: 0.2s;
        }
        .meet-btn:hover { background: #4a4e51; }
        .meet-btn.danger { background: #ea4335; }
        .meet-btn.danger:hover { background: #d93025; }
        .meet-btn.active-share { background: #8ab4f8; color: #202124; }
        .meet-btn.exit { background: #ea4335; border-radius: 24px; width: 64px; }
        .meet-btn.secondary { width: auto; border-radius: 24px; padding: 0 1rem; gap: 0.5rem; background: transparent; }
        .meet-btn.secondary:hover { background: rgba(255,255,255,0.05); }
        .badge { background: #8ab4f8; color: #202124; font-size: 0.65rem; font-weight: 800; padding: 2px 6px; border-radius: 10px; }

        /* SIDEBAR DRAWER */
        .meet-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; }
        .meet-sidebar {
            position: fixed; top: 0; right: 0; width: 360px; height: 100%;
            background: white; color: #202124; z-index: 101;
            display: flex; flex-direction: column;
        }
        @media (max-width: 400px) { .meet-sidebar { width: 100%; } }

        .sidebar-header { padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e8eaed; }
        .sidebar-header h2 { font-size: 1.1rem; font-weight: 500; }
        .sidebar-header button { background: none; border: none; cursor: pointer; color: #5f6368; }

        .sidebar-tabs { display: flex; border-bottom: 1px solid #e8eaed; }
        .tab { flex: 1; padding: 1rem; border: none; background: none; font-weight: 500; color: #5f6368; cursor: pointer; }
        .tab.active { color: #1a73e8; border-bottom: 2px solid #1a73e8; }

        .sidebar-content { padding: 1.5rem; flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
        .section-label { font-size: 0.7rem; font-weight: 600; color: #5f6368; letter-spacing: 0.05em; margin: 1.5rem 0 0.75rem; }
        .sidebar-action-btn {
            width: 100%; padding: 0.75rem 1rem; border: 1px solid #dadce0; border-radius: 8px;
            display: flex; align-items: center; gap: 1rem; color: #1a73e8; font-weight: 500;
            background: white; cursor: pointer; text-align: left;
        }

        .participant-item { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
        .p-avatar { width: 32px; height: 32px; border-radius: 50%; background: #1a73e8; color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.8rem; }
        .p-name { flex: 1; font-size: 0.9rem; }
        .p-icons { color: #5f6368; }

        /* CHAT STYLE */
        .chat-container { flex: 1; display: flex; flex-direction: column; height: 100%; margin: -1.5rem; }
        .chat-messages { flex: 1; padding: 1.5rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; }
        .empty-chat { margin: auto; text-align: center; color: #9aa0a6; font-size: 0.85rem; }
        .chat-msg { display: flex; flex-direction: column; }
        .chat-msg.mine { align-items: flex-end; }
        .msg-header { display: flex; gap: 0.5rem; font-size: 0.75rem; color: #5f6368; margin-bottom: 0.25rem; align-items: baseline; }
        .msg-bubble { background: #f1f3f4; padding: 0.6rem 1rem; border-radius: 0 16px 16px 16px; font-size: 0.9rem; color: #202124; max-width: 85%; word-break: break-word; }
        .chat-msg.mine .msg-bubble { background: #e8f0fe; border-radius: 16px 0 16px 16px; }
        .chat-input-area { padding: 1rem; border-top: 1px solid #e8eaed; display: flex; gap: 0.5rem; background: white; }
        .chat-input-area input { flex: 1; padding: 0.75rem 1rem; border-radius: 24px; border: 1px solid #dadce0; outline: none; transition: 0.2s; }
        .chat-input-area input:focus { border-color: #1a73e8; }
        .chat-input-area button { background: none; border: none; color: #1a73e8; font-weight: 600; cursor: pointer; padding: 0 0.5rem; }
        .chat-input-area button:disabled { color: #dadce0; cursor: not-allowed; }

        .desktop-only { display: flex; }
        @media (max-width: 800px) { .desktop-only { display: none; } }
        
        .audience-badge { background: rgba(255,255,255,0.1); color: white; padding: 0.5rem 1rem; border-radius: 24px; font-size: 0.8rem; font-weight: 500; }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
