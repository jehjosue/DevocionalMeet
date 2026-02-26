import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Copy, LogOut, Shield, Mic, MicOff, Video, VideoOff, Users, MessageSquare, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
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

  const userName =
    searchParams.get("nome") ||
    localStorage.getItem("dmeet_name_" + localStorage.getItem("dmeet_userId")) ||
    "Participante";
  const role = searchParams.get("role") || "audience";
  const isHost = role === "host";

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoElRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  // Map uid -> name
  const uidNameMap = useRef<Map<string | number, string>>(new Map());

  // Paginação
  const VIDEOS_POR_PAGINA = 9;
  const [paginaAtual, setPaginaAtual] = useState(0);
  const totalParticipantes = remoteUsers.length + 1;
  const gridCount = totalParticipantes <= 9 ? String(totalParticipantes) : "many";
  const totalPaginas = Math.ceil(totalParticipantes / VIDEOS_POR_PAGINA);
  const inicioVisivel = paginaAtual * VIDEOS_POR_PAGINA;
  const fimVisivel = inicioVisivel + VIDEOS_POR_PAGINA;
  const isVisivel = (index: number) => index >= inicioVisivel && index < fimVisivel;

  useEffect(() => {
    if (paginaAtual >= totalPaginas && totalPaginas > 0) setPaginaAtual(totalPaginas - 1);
  }, [totalPaginas, paginaAtual]);

  useEffect(() => {
    if (!roomName) return;
    if (!searchParams.get("nome")) {
      navigate(`/?roomId=${roomName}`);
      return;
    }

    // Socket.io apenas para chat e nomes
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("chat_message", (payload) => {
      setMessages((prev) => [...prev, payload]);
    });

    // Agora RTC
    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    clientRef.current = client;

    // Quando um usuário remoto publica mídia
    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);

      const name = uidNameMap.current.get(user.uid) || "Participante";

      if (mediaType === "video") {
        setRemoteUsers((prev) => {
          const exists = prev.find((u) => u.uid === user.uid);
          if (exists) {
            return prev.map((u) =>
              u.uid === user.uid ? { ...u, videoTrack: user.videoTrack } : u
            );
          }
          return [...prev, { uid: user.uid, name, videoTrack: user.videoTrack }];
        });

        requestAnimationFrame(() => {
          const el = document.getElementById(`video-remote-${user.uid}`);
          if (el && user.videoTrack) {
            user.videoTrack.play(el);
          }
        });
      }

      if (mediaType === "audio") {
        user.audioTrack?.play();
        setRemoteUsers((prev) => {
          const exists = prev.find((u) => u.uid === user.uid);
          if (exists) {
            return prev.map((u) =>
              u.uid === user.uid ? { ...u, audioTrack: user.audioTrack } : u
            );
          }
          return [...prev, { uid: user.uid, name, audioTrack: user.audioTrack }];
        });
      }
    });

    client.on("user-unpublished", (user, mediaType) => {
      if (mediaType === "video") {
        setRemoteUsers((prev) =>
          prev.map((u) => (u.uid === user.uid ? { ...u, videoTrack: undefined } : u))
        );
      }
    });

    client.on("user-left", (user) => {
      setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      uidNameMap.current.delete(user.uid);
    });

    // Recebe nomes via socket
    socket.on("user-name", (uid: string | number, name: string) => {
      uidNameMap.current.set(uid, name);
      setRemoteUsers((prev) =>
        prev.map((u) => (String(u.uid) === String(uid) ? { ...u, name } : u))
      );
    });

    const init = async () => {
      try {
        const failTimeout = setTimeout(() => {
          setConnectionError("Demora na conexão. Verifique permissões de câmera/microfone.");
        }, 15000);

        // Cria tracks locais
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        localAudioTrackRef.current = audioTrack;
        localVideoTrackRef.current = videoTrack;

        // Mostra vídeo local
        if (localVideoElRef.current) {
          videoTrack.play(localVideoElRef.current);
        }

        // Gera UID numérico único
        const uid = Math.floor(Math.random() * 100000);

        // Entra no canal Agora
        await client.join(AGORA_APP_ID, roomName!, null, uid);

        // Publica tracks
        await client.publish([audioTrack, videoTrack]);

        // Anuncia nome via socket
        socket.emit("join-room", roomName, String(uid), userName);
        socket.emit("announce-name", roomName, uid, userName);

        clearTimeout(failTimeout);
        setJoined(true);
      } catch (err) {
        console.error("Erro Agora:", err);
        setConnectionError("Permissão de câmera/microfone negada ou dispositivo não encontrado.");
      }
    };

    init();

    return () => {
      localVideoTrackRef.current?.stop();
      localVideoTrackRef.current?.close();
      localAudioTrackRef.current?.stop();
      localAudioTrackRef.current?.close();
      client.leave();
      socket.disconnect();
    };
  }, [roomName]);

  // Reproduz vídeo remoto quando o elemento é montado
  const playRemoteVideo = useCallback((uid: string | number, videoTrack: any) => {
    const el = document.getElementById(`video-remote-${uid}`);
    if (el && videoTrack) {
      videoTrack.play(el);
    }
  }, []);

  const toggleMic = () => {
    const track = localAudioTrackRef.current;
    if (track) {
      track.setEnabled(!micOn);
      setMicOn(!micOn);
    }
  };

  const toggleVideo = () => {
    const track = localVideoTrackRef.current;
    if (track) {
      track.setEnabled(!videoOn);
      setVideoOn(!videoOn);
    }
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
    const cleanUrl = `${window.location.origin}/room/${roomName}`;
    navigator.clipboard.writeText(cleanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="sala-container">
      {/* Contador */}
      <div className="contador-participantes">
        👥 {totalParticipantes} participante{totalParticipantes > 1 ? "s" : ""}
      </div>

      {/* Paginação */}
      {totalParticipantes > VIDEOS_POR_PAGINA && (
        <div className="paginacao-bar">
          <button onClick={() => setPaginaAtual((p) => Math.max(0, p - 1))}>‹</button>
          <span className="pag-info">
            Página {paginaAtual + 1} de {totalPaginas}
          </span>
          <button onClick={() => setPaginaAtual((p) => Math.min(totalPaginas - 1, p + 1))}>›</button>
        </div>
      )}

      {/* Info topo */}
      <div className="absolute top-0 right-0 p-3 z-10 pointer-events-none">
        <div className="flex items-center gap-2 text-xs bg-black/50 px-3 py-1.5 rounded-xl backdrop-blur-md pointer-events-auto text-white">
          <span className="opacity-70 truncate max-w-[120px]">{roomName}</span>
          <span className="opacity-30">|</span>
          <span className="opacity-80">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Loading */}
      {!joined && !connectionError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10 gap-4 bg-black">
          <div className="w-10 h-10 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm opacity-70">Conectando câmera e microfone...</p>
        </div>
      )}

      {/* Erro */}
      {connectionError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-50 bg-black/90 p-6 text-center">
          <Shield size={48} className="text-red-500 mb-4" />
          <h3 className="text-xl font-bold mb-2">Falha na Conexão</h3>
          <p className="text-white/70 mb-6 text-sm">{connectionError}</p>
          <button
            onClick={() => navigate("/")}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-semibold"
          >
            Voltar para o Início
          </button>
        </div>
      )}

      {/* Grid de vídeos */}
      <main className="videos-grid" data-count={gridCount}>
        {/* Vídeo local */}
        <div className="video-tile" style={{ display: isVisivel(0) ? "block" : "none" }}>
          <div
            ref={localVideoElRef}
            style={{ width: "100%", height: "100%", transform: "scaleX(-1)" }}
          />
          <div className="tile-label">
            {userName} (Você) {isHost ? "👑" : ""} {!micOn && "🔇"}
          </div>
        </div>

        {/* Vídeos remotos */}
        {remoteUsers.map((remote, index) => (
          <div
            key={remote.uid}
            className="video-tile"
            style={{ display: isVisivel(index + 1) ? "block" : "none" }}
          >
            <div
              id={`video-remote-${remote.uid}`}
              style={{ width: "100%", height: "100%" }}
              ref={(el) => {
                if (el && remote.videoTrack) {
                  remote.videoTrack.play(el);
                }
              }}
            />
            <div className="tile-label">{remote.name || "Participante"}</div>
          </div>
        ))}
      </main>

      {/* Controles */}
      <div className="controles-bar">
        <button
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors text-white ${!micOn ? "bg-red-500" : "bg-[#3c4043] hover:bg-[#4a4e51]"
            }`}
          onClick={toggleMic}
        >
          {micOn ? <Mic size={22} /> : <MicOff size={22} />}
        </button>

        <button
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors text-white ${!videoOn ? "bg-red-500" : "bg-[#3c4043] hover:bg-[#4a4e51]"
            }`}
          onClick={toggleVideo}
        >
          {videoOn ? <Video size={22} /> : <VideoOff size={22} />}
        </button>

        <button
          className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          onClick={copyLink}
          title="Copiar link de convite"
        >
          {copied ? <span className="text-xs font-bold">✓</span> : <Copy size={20} />}
        </button>

        <button
          className="w-16 h-12 rounded-3xl flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-colors"
          onClick={() => navigate("/")}
        >
          <LogOut size={22} />
        </button>

        <button
          className="h-10 px-3 rounded-3xl flex items-center justify-center bg-transparent hover:bg-white/10 text-white transition-colors gap-2"
          onClick={() => setShowSidebar(true)}
        >
          <Users size={20} />
          <span className="bg-blue-400 text-blue-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {totalParticipantes}
          </span>
        </button>
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[100]"
              onClick={() => setShowSidebar(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 w-full max-w-sm h-full bg-white text-gray-900 z-[101] flex flex-col"
            >
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="font-semibold text-lg">Detalhes da reunião</h2>
                <button onClick={() => setShowSidebar(false)} className="text-gray-500 p-2">
                  <X size={20} />
                </button>
              </div>

              <div className="flex border-b border-gray-200">
                {(["people", "chat"] as const).map((tab) => (
                  <button
                    key={tab}
                    className={`flex-1 p-3 font-medium transition-colors ${activeTab === tab
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-500"
                      }`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === "people" ? "Pessoas" : "Chat"}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                {activeTab === "people" ? (
                  <>
                    <h3 className="text-xs font-bold text-gray-500 tracking-wider mb-3">
                      LINK DA REUNIÃO
                    </h3>
                    <button
                      className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl mb-4 hover:bg-gray-50 transition-colors"
                      onClick={copyLink}
                    >
                      <span className="text-blue-600 font-medium text-sm">
                        {copied ? "✓ Link Copiado!" : "Copiar link de convite"}
                      </span>
                      <Copy size={16} className="text-blue-600 flex-shrink-0" />
                    </button>

                    <h3 className="text-xs font-bold text-gray-500 tracking-wider mb-3">
                      PARTICIPANTES ({totalParticipantes})
                    </h3>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                          {userName[0]?.toUpperCase() || "?"}
                        </div>
                        <p className="font-medium text-sm flex-1">
                          {userName} (Você) {isHost && "👑"}
                        </p>
                        {micOn ? (
                          <Mic size={16} className="text-gray-400" />
                        ) : (
                          <MicOff size={16} className="text-red-500" />
                        )}
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
                          <div
                            key={msg.id}
                            className={`flex flex-col ${msg.sender === userName ? "items-end" : "items-start"
                              }`}
                          >
                            <div className="flex gap-2 items-baseline text-xs text-gray-500 mb-1">
                              <span className="font-semibold">
                                {msg.sender === userName ? "Você" : msg.sender}
                              </span>
                              <span className="text-[10px]">{msg.time}</span>
                            </div>
                            <div
                              className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${msg.sender === userName
                                  ? "bg-blue-100 text-blue-900 rounded-tr-sm"
                                  : "bg-gray-100 text-gray-800 rounded-tl-sm"
                                }`}
                            >
                              {msg.text}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <form
                      className="p-3 border-t border-gray-200 flex gap-2 bg-white"
                      onSubmit={sendMessage}
                    >
                      <input
                        type="text"
                        placeholder="Envie uma mensagem..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 bg-gray-100 border border-transparent focus:border-blue-500 px-4 py-2 rounded-full text-sm outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="text-blue-600 font-semibold px-2 disabled:opacity-50"
                      >
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
    </div>
  );
}
