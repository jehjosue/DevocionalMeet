import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Copy, LogOut, Mic, MicOff, Video, VideoOff, Users, MessageSquare, X, Heart } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import io, { Socket } from "socket.io-client";
import { SOCKET_URL, AGORA_APP_ID } from "../config";

interface RemoteUser {
  uid: string | number;
  name: string;
  videoTrack?: any;
  audioTrack?: any;
}

// Força o Agora a preencher 100% do container pai
function fixAgoraSize(el: HTMLElement) {
  // Corrige a div wrapper injetada pelo Agora
  const agoraWrapper = el.querySelector<HTMLElement>("div");
  if (agoraWrapper) {
    agoraWrapper.style.cssText =
      "width:100%!important;height:100%!important;position:absolute!important;top:0!important;left:0!important;transform:none!important;";
  }
  // Corrige o elemento <video>
  const video = el.querySelector<HTMLVideoElement>("video");
  if (video) {
    video.style.cssText =
      "width:100%!important;height:100%!important;object-fit:cover!important;position:absolute!important;top:0!important;left:0!important;transform:none!important;";
  }
}

export default function Room() {
  const { roomName } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [messages, setMessages] = useState<{ id: string; sender: string; text: string; time: string }[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"people" | "chat">("people");
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const userName =
    searchParams.get("nome") ||
    localStorage.getItem("dmeet_name_" + localStorage.getItem("dmeet_userId")) ||
    "Participante";
  const role = searchParams.get("role") || "audience";
  const isHost = role === "host";

  const DEVOCIONAL_EMOJIS = ["✝️", "🙏", "✨", "🕊️", "📖"];
  const [activeEmojis, setActiveEmojis] = useState<{ id: string; emoji: string; left: number }[]>([]);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const uidNameMap = useRef<Map<string | number, string>>(new Map());

  const [maoLevantada, setMaoLevantada] = useState(false);
  const [maosRemotas, setMaosRemotas] = useState<{ id: string | number; timestamp: number }[]>([]);
  const [activeSpeakers, setActiveSpeakers] = useState<Set<string | number>>(new Set());
  const [speakerHistory, setSpeakerHistory] = useState<(string | number)[]>([]);
  const localUidRef = useRef<string | number | null>(null);

  const totalParticipantes = remoteUsers.length + 1;

  useEffect(() => {
    if (!roomName) return;
    if (!searchParams.get("nome")) {
      navigate(`/?roomId=${roomName}`);
      return;
    }

    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("chat_message", (payload) => {
      setMessages((prev) => [...prev, payload]);
    });

    socket.on("reaction", (emoji: string) => {
      adicionarEmoji(emoji);
    });

    socket.on("raise_hand", (data: { uid: string | number; isRaised: boolean; timestamp: number }) => {
      setMaosRemotas((prev) => {
        if (data.isRaised) {
          if (!prev.find((m) => String(m.id) === String(data.uid))) {
            return [...prev, { id: data.uid, timestamp: data.timestamp }];
          }
          return prev;
        } else {
          return prev.filter((m) => String(m.id) !== String(data.uid));
        }
      });
    });

    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    clientRef.current = client;

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      const name = uidNameMap.current.get(user.uid) || "Participante";

      if (mediaType === "video") {
        setRemoteUsers((prev) => {
          const exists = prev.find((u) => String(u.uid) === String(user.uid));
          if (exists) return prev.map((u) => String(u.uid) === String(user.uid) ? { ...u, videoTrack: user.videoTrack } : u);
          return [...prev, { uid: user.uid, name, videoTrack: user.videoTrack }];
        });
      }

      if (mediaType === "audio") {
        user.audioTrack?.play();
        setRemoteUsers((prev) => {
          const exists = prev.find((u) => String(u.uid) === String(user.uid));
          if (exists) return prev.map((u) => String(u.uid) === String(user.uid) ? { ...u, audioTrack: user.audioTrack } : u);
          return [...prev, { uid: user.uid, name, audioTrack: user.audioTrack }];
        });
      }
    });

    client.on("user-unpublished", (user, mediaType) => {
      if (mediaType === "video") {
        setRemoteUsers((prev) => prev.map((u) => String(u.uid) === String(user.uid) ? { ...u, videoTrack: undefined } : u));
      }
    });

    client.on("user-left", (user) => {
      setRemoteUsers((prev) => prev.filter((u) => String(u.uid) !== String(user.uid)));
      uidNameMap.current.delete(user.uid);
      setSpeakerHistory((prev) => prev.filter((id) => String(id) !== String(user.uid)));
      setMaosRemotas((prev) => prev.filter((m) => String(m.id) !== String(user.uid)));
    });

    socket.on("user-name", (uid: string | number, name: string) => {
      uidNameMap.current.set(uid, name);
      setRemoteUsers((prev) => prev.map((u) => String(u.uid) === String(uid) ? { ...u, name } : u));
    });

    const init = async () => {
      const failTimeout = setTimeout(() => {
        setConnectionError("Demora na conexão. Verifique permissões de câmera/microfone.");
      }, 15000);

      try {
        client.enableAudioVolumeIndicator();
        client.on("volume-indicator", (volumes) => {
          const speakingUids = new Set<string | number>();
          volumes.forEach((v) => {
            if (v.level > 5) speakingUids.add(v.uid === 0 ? "local" : String(v.uid));
          });
          setActiveSpeakers(speakingUids);
          if (speakingUids.size > 0) {
            setSpeakerHistory((prev) => {
              const newHist = [...prev];
              speakingUids.forEach((suid) => {
                const idx = newHist.findIndex(id => String(id) === String(suid));
                if (idx !== -1) newHist.splice(idx, 1);
                newHist.unshift(suid);
              });
              return newHist.slice(0, 20);
            });
          }
        });

        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks().catch(async () => {
          // Fallback se ambos falharem, tentar apenas um por vez pode ser complexo aqui,
          // então mostramos erro se a permissão básica for negada.
          throw new Error("PERMISSION_DENIED");
        });

        localAudioTrackRef.current = audioTrack;
        localVideoTrackRef.current = videoTrack;

        const uid = Math.floor(Math.random() * 100000);
        localUidRef.current = uid;

        await client.join(AGORA_APP_ID, roomName!, null, uid);
        await client.publish([audioTrack, videoTrack]);

        socket.emit("join-room", roomName, String(uid), userName);
        socket.emit("announce-name", roomName, uid, userName);

        clearTimeout(failTimeout);
        setJoined(true);
      } catch (err: any) {
        clearTimeout(failTimeout);
        const msg = err?.message || String(err);
        if (msg.includes("PERMISSION_DENIED") || msg.includes("getUserMedia") || msg.includes("NotFound")) {
          setConnectionError("Permissão de câmera/microfone negada ou dispositivo não encontrado.");
        } else {
          setConnectionError(`Erro: ${msg}`);
        }
      }
    };

    init();

    return () => {
      const cleanup = async () => {
        localVideoTrackRef.current?.stop();
        localVideoTrackRef.current?.close();
        localAudioTrackRef.current?.stop();
        localAudioTrackRef.current?.close();
        if (clientRef.current) {
          await clientRef.current.leave().catch(console.error);
        }
        socketRef.current?.disconnect();
      };
      cleanup();
    };
  }, [roomName]);

  const toggleMic = () => {
    localAudioTrackRef.current?.setEnabled(!micOn);
    setMicOn(!micOn);
  };

  const toggleVideo = () => {
    localVideoTrackRef.current?.setEnabled(!videoOn);
    setVideoOn(!videoOn);
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current) return;
    const msg = {
      id: Math.random().toString(),
      sender: userName,
      text: newMessage,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    socketRef.current.emit("chat_message", msg);
    setNewMessage("");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomName}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const adicionarEmoji = useCallback((emoji: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    const left = 10 + Math.random() * 80;
    setActiveEmojis((prev) => [...prev, { id, emoji, left }]);
    setTimeout(() => setActiveEmojis((prev) => prev.filter((e) => e.id !== id)), 4000);
  }, []);

  const enviarReacaoAleatoria = () => {
    const emoji = DEVOCIONAL_EMOJIS[Math.floor(Math.random() * DEVOCIONAL_EMOJIS.length)];
    adicionarEmoji(emoji);
    socketRef.current?.emit("reaction", emoji);
  };

  const toggleMao = () => {
    const newState = !maoLevantada;
    setMaoLevantada(newState);
    if (socketRef.current && localUidRef.current) {
      socketRef.current.emit("raise_hand", { uid: localUidRef.current, isRaised: newState, timestamp: Date.now() });
    }
  };

  // Ordenação
  const remoteCandidates = [...remoteUsers.map((u) => u.uid)];
  remoteCandidates.sort((a, b) => {
    const aHand = maosRemotas.find((m) => String(m.id) === String(a));
    const bHand = maosRemotas.find((m) => String(m.id) === String(b));
    if (aHand && !bHand) return -1;
    if (!aHand && bHand) return 1;
    if (aHand && bHand) return bHand.timestamp - aHand.timestamp;

    const aSpeakIdx = speakerHistory.findIndex(id => String(id) === String(a));
    const bSpeakIdx = speakerHistory.findIndex(id => String(id) === String(b));
    if (aSpeakIdx !== -1 && bSpeakIdx === -1) return -1;
    if (aSpeakIdx === -1 && bSpeakIdx !== -1) return 1;
    if (aSpeakIdx !== -1 && bSpeakIdx !== -1) return aSpeakIdx - bSpeakIdx;
    return 0;
  });

  const allUids = ["local", ...remoteCandidates];
  const gridCountClass = totalParticipantes > 6 ? "count-many" : `count-${totalParticipantes}`;

  // Ref callback: faz play + fix no mount do elemento
  const videoRefCallback = useCallback((el: HTMLDivElement | null, uid: string | number) => {
    if (!el) return;
    const isLocal = uid === "local";
    const track = isLocal
      ? localVideoTrackRef.current
      : remoteUsers.find((u) => String(u.uid) === String(uid))?.videoTrack;

    if (track && !el.querySelector("video")) {
      try {
        track.play(el);
        // Espera o Agora injetar o DOM e então corrige
        setTimeout(() => {
          fixAgoraSize(el);
          // Observa mudanças de tamanho e re-aplica o fix
          const observer = new ResizeObserver(() => fixAgoraSize(el));
          observer.observe(el);
        }, 100);
      } catch (e) { console.error("play error", e); }
    }
  }, [remoteUsers]);

  const renderVideoCard = (uid: string | number) => {
    const isLocal = uid === "local";
    const remoteU = isLocal ? null : remoteUsers.find((u) => String(u.uid) === String(uid));
    if (!isLocal && !remoteU) return null;

    const _name = isLocal ? `${userName} (Você)${isHost ? " 👑" : ""}` : (remoteU?.name || "Participante");
    const _micOff = isLocal ? !micOn : false;
    const hand = isLocal ? maoLevantada : maosRemotas.some((m) => String(m.id) === String(uid));
    const isSpeaking = activeSpeakers.has(isLocal ? "local" : String(uid));

    let cardClass = "video-item";
    if (isSpeaking) cardClass += " falando";
    if (isHost && isLocal) cardClass += " moderador";

    return (
      <div key={String(uid)} className={cardClass}>
        {/* Wrapper absoluto que o Agora vai preencher */}
        <div
          id={isLocal ? "vwrap-local" : `vwrap-${uid}`}
          ref={(el) => { if (el) videoRefCallback(el, uid); }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "hidden",
            // Espelha só o local
            transform: isLocal ? "scaleX(-1)" : "none",
          }}
        />
        <div className="tile-label">{_name}{_micOff ? " 🔇" : ""}</div>
        {hand && <div className="icone-mao">🙋</div>}
      </div>
    );
  };

  return (
    <div className="sala-container" style={{ background: "#202124" }}>
      {/* Contador */}
      <div className="contador-participantes fixed top-4 left-4 z-50 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md flex items-center gap-1.5">
        👥 {totalParticipantes} participante{totalParticipantes > 1 ? "s" : ""}
      </div>

      {/* Grid de vídeos */}
      <main className={`video-grid ${gridCountClass}`}>
        {allUids.map((uid) => renderVideoCard(uid))}
      </main>

      {/* Emojis Flutuantes */}
      {activeEmojis.map((item) => (
        <div
          key={item.id}
          className="emoji-flutuante text-3xl md:text-4xl filter drop-shadow-md"
          style={{ left: `${item.left}%`, bottom: "100px" }}
        >
          {item.emoji}
        </div>
      ))}

      {/* OVERFLOW MENU mobile */}
      <AnimatePresence>
        {showMoreMenu && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-[90px] right-4 bg-[#2c2f33] rounded-2xl p-3 flex gap-3 shadow-2xl z-[150] border border-white/10"
          >
            <button className="flex flex-col items-center gap-1 text-white p-2 rounded-xl hover:bg-white/10 transition"
              onClick={() => { enviarReacaoAleatoria(); setShowMoreMenu(false); }}>
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-xl">❤️</div>
              <span className="text-[10px]">Reagir</span>
            </button>
            <button className={`flex flex-col items-center gap-1 text-white p-2 rounded-xl hover:bg-white/10 transition ${maoLevantada ? "text-yellow-400" : ""}`}
              onClick={() => { toggleMao(); setShowMoreMenu(false); }}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${maoLevantada ? "bg-yellow-500/20" : "bg-white/5"}`}>🙋</div>
              <span className="text-[10px]">Mão</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-white p-2 rounded-xl hover:bg-white/10 transition"
              onClick={() => { copyLink(); setShowMoreMenu(false); }}>
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-xl">
                <Copy size={20} />
              </div>
              <span className="text-[10px]">Link</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controles */}
      <div className={`controles-container ${totalParticipantes === 1 ? "controles-overlay" : ""}`}>
        <button className={`btn-controle ${!micOn ? "btn-desligar" : ""}`} onClick={toggleMic}>
          {micOn ? <Mic size={24} /> : <MicOff size={24} />}
        </button>
        <button className={`btn-controle ${!videoOn ? "btn-desligar" : ""}`} onClick={toggleVideo}>
          {videoOn ? <Video size={24} /> : <VideoOff size={24} />}
        </button>

        <div className="hidden md:flex gap-3">
          <button className="btn-controle" onClick={copyLink}>
            {copied ? <span className="text-sm font-bold">✓</span> : <Copy size={22} />}
          </button>
          <button className="btn-controle" onClick={enviarReacaoAleatoria}>
            <Heart size={24} className="text-pink-400" />
          </button>
          <button className={`btn-controle btn-mao ${maoLevantada ? "ativo" : ""}`} onClick={toggleMao}>
            🙋
          </button>
        </div>

        <button className="btn-controle btn-desligar w-[64px] rounded-[50px] mx-1 md:w-[72px]" onClick={() => navigate("/")}>
          <LogOut size={22} />
        </button>

        <button className="btn-controle w-auto px-4 rounded-[50px] gap-2" onClick={() => setShowSidebar(true)}>
          <Users size={22} />
          <span className="bg-blue-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{totalParticipantes}</span>
        </button>

        <button className={`btn-controle md:hidden ${showMoreMenu ? "bg-white/20" : ""}`} onClick={() => setShowMoreMenu(!showMoreMenu)}>
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-white rounded-full" />
            <span className="w-1.5 h-1.5 bg-white rounded-full" />
            <span className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
        </button>
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[100]" onClick={() => setShowSidebar(false)} />
            <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 w-full max-w-sm h-full bg-white text-gray-900 z-[101] flex flex-col">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="font-semibold text-lg">Detalhes da reunião</h2>
                <button onClick={() => setShowSidebar(false)} className="text-gray-500 p-2"><X size={20} /></button>
              </div>
              <div className="flex border-b border-gray-200">
                {(["people", "chat"] as const).map((tab) => (
                  <button key={tab}
                    className={`flex-1 p-3 font-medium transition-colors ${activeTab === tab ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
                    onClick={() => setActiveTab(tab)}>
                    {tab === "people" ? "Pessoas" : "Chat"}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                {activeTab === "people" ? (
                  <>
                    <h3 className="text-xs font-bold text-gray-500 tracking-wider mb-3">LINK DA REUNIÃO</h3>
                    <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl mb-4 hover:bg-gray-50 transition-colors" onClick={copyLink}>
                      <span className="text-blue-600 font-medium text-sm">{copied ? "✓ Link Copiado!" : "Copiar link de convite"}</span>
                      <Copy size={16} className="text-blue-600 flex-shrink-0" />
                    </button>
                    <h3 className="text-xs font-bold text-gray-500 tracking-wider mb-3">PARTICIPANTES ({totalParticipantes})</h3>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                          {userName[0]?.toUpperCase() || "?"}
                        </div>
                        <p className="font-medium text-sm flex-1">{userName} (Você) {isHost && "👑"}</p>
                        {micOn ? <Mic size={16} className="text-gray-400" /> : <MicOff size={16} className="text-red-500" />}
                      </div>
                      {remoteUsers.map((remote) => (
                        <div key={remote.uid} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-sm">
                            {remote.name?.[0]?.toUpperCase() || "P"}
                          </div>
                          <p className="font-medium text-sm flex-1">{remote.name || "Participante"}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col -m-4">
                    <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
                      {messages.length === 0 ? (
                        <div className="m-auto text-center text-gray-400">
                          <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nenhuma mensagem ainda.</p>
                        </div>
                      ) : (
                        messages.map((msg) => (
                          <div key={msg.id} className={`flex flex-col ${msg.sender === userName ? "items-end" : "items-start"}`}>
                            <div className="flex gap-2 items-baseline text-xs text-gray-500 mb-1">
                              <span className="font-semibold">{msg.sender === userName ? "Você" : msg.sender}</span>
                              <span className="text-[10px]">{msg.time}</span>
                            </div>
                            <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${msg.sender === userName ? "bg-blue-100 text-blue-900 rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>
                              {msg.text}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <form className="p-3 border-t border-gray-200 flex gap-2 bg-white" onSubmit={sendMessage}>
                      <input type="text" placeholder="Envie uma mensagem..." value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 bg-gray-100 border border-transparent focus:border-blue-500 px-4 py-2 rounded-full text-sm outline-none" />
                      <button type="submit" disabled={!newMessage.trim()} className="text-blue-600 font-semibold px-2 disabled:opacity-50">
                        Enviar
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {connectionError && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#2c2f33] p-6 rounded-2xl max-w-sm w-full text-center border border-white/10 shadow-2xl">
            <Shield className="mx-auto mb-4 text-red-500" size={48} />
            <h2 className="text-xl font-bold text-white mb-2">Erro de Conexão</h2>
            <p className="text-gray-400 mb-6 text-sm">{connectionError}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
