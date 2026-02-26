import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Copy, LogOut, Shield, Mic, MicOff, Video, VideoOff, Users, MessageSquare, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import io, { Socket } from "socket.io-client";
import { SOCKET_URL } from "../config";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

interface RemoteStream {
  id: string;
  stream: MediaStream;
  name: string;
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

  const userName =
    searchParams.get("nome") ||
    localStorage.getItem("dmeet_name_" + localStorage.getItem("dmeet_userId")) ||
    "Participante";
  const role = searchParams.get("role") || "audience";
  const isHost = role === "host";

  const [activeTab, setActiveTab] = useState<"people" | "chat">("people");
  const [messages, setMessages] = useState<{ id: string; sender: string; text: string; time: string }[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [remoteNames, setRemoteNames] = useState<Record<string, string>>({});

  const localVideoRef = useRef<HTMLVideoElement>(null);
  // USA REF para o stream local — evita closure stale
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerConnections = useRef(new Map<string, RTCPeerConnection>());

  // Paginação
  const VIDEOS_POR_PAGINA = 9;
  const [paginaAtual, setPaginaAtual] = useState(0);
  const totalParticipantes = remoteStreams.length + 1;
  const gridCount = totalParticipantes <= 9 ? String(totalParticipantes) : "many";
  const totalPaginas = Math.ceil(totalParticipantes / VIDEOS_POR_PAGINA);
  const inicioVisivel = paginaAtual * VIDEOS_POR_PAGINA;
  const fimVisivel = inicioVisivel + VIDEOS_POR_PAGINA;
  const isVisivel = (index: number) => index >= inicioVisivel && index < fimVisivel;

  useEffect(() => {
    if (paginaAtual >= totalPaginas && totalPaginas > 0) setPaginaAtual(totalPaginas - 1);
  }, [totalPaginas, paginaAtual]);

  // createPeer usa SEMPRE localStreamRef.current — nunca fica stale
  const createPeer = useCallback(
    (peerId: string, socket: Socket, peerName?: string) => {
      // Fecha conexão anterior se existir
      const existing = peerConnections.current.get(peerId);
      if (existing) {
        existing.close();
        peerConnections.current.delete(peerId);
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Adiciona tracks locais — SEMPRE via ref, nunca via closure
      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      }

      // Recebe tracks remotas
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (!remoteStream) return;

        setRemoteStreams((prev) => {
          const exists = prev.find((s) => s.id === peerId);
          if (exists) {
            // Atualiza stream se já existe
            return prev.map((s) => (s.id === peerId ? { ...s, stream: remoteStream } : s));
          }
          return [...prev, { id: peerId, stream: remoteStream, name: peerName || "Participante" }];
        });

        // Atribui direto ao elemento DOM
        requestAnimationFrame(() => {
          const el = document.getElementById("video-" + peerId) as HTMLVideoElement | null;
          if (el) el.srcObject = remoteStream;
        });
      };

      // Envia ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            target: peerId,
            sender: socket.id,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setRemoteStreams((prev) => prev.filter((s) => s.id !== peerId));
          peerConnections.current.delete(peerId);
        }
      };

      peerConnections.current.set(peerId, pc);
      return pc;
    },
    [] // sem deps — usa só refs
  );

  useEffect(() => {
    if (!roomName) return;

    if (!searchParams.get("nome")) {
      navigate(`/?roomId=${roomName}`);
      return;
    }

    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    const failTimeout = setTimeout(() => {
      setConnectionError("Demora na conexão. Verifique permissões de câmera/microfone.");
    }, 15000);

    const initWebRTC = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // Salva no REF imediatamente
        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setJoined(true);
        clearTimeout(failTimeout);

        // Entra na sala passando o nome junto
        socket.emit("join-room", roomName, socket.id, userName);

        // ── QUEM JÁ ESTAVA NA SALA recebe "user-joined" e cria offer ──
        socket.on("user-joined", async (userId: string, joinedName: string) => {
          if (userId === socket.id) return;

          const pc = createPeer(userId, socket, joinedName);

          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", {
              target: userId,
              caller: socket.id,
              callerName: userName,
              sdp: offer,
            });
          } catch (e) {
            console.error("Erro ao criar offer:", e);
          }
        });

        // ── QUEM ACABOU DE ENTRAR recebe "offer" e responde com answer ──
        socket.on(
          "offer",
          async (payload: {
            target: string;
            caller: string;
            callerName: string;
            sdp: RTCSessionDescriptionInit;
          }) => {
            if (payload.target !== socket.id) return;

            const pc = createPeer(payload.caller, socket, payload.callerName);

            try {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              socket.emit("answer", {
                target: payload.caller,
                caller: socket.id,
                callerName: userName,
                sdp: answer,
              });
            } catch (e) {
              console.error("Erro ao responder offer:", e);
            }
          }
        );

        // ── QUEM CRIOU O OFFER recebe o answer ──
        socket.on(
          "answer",
          async (payload: {
            target: string;
            caller: string;
            callerName: string;
            sdp: RTCSessionDescriptionInit;
          }) => {
            if (payload.target !== socket.id) return;
            const pc = peerConnections.current.get(payload.caller);
            if (pc && pc.signalingState !== "stable") {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              } catch (e) {
                console.error("Erro ao setar answer:", e);
              }
            }
          }
        );

        // ── ICE CANDIDATES ──
        socket.on(
          "ice-candidate",
          async (payload: { sender: string; candidate: RTCIceCandidateInit }) => {
            if (payload.sender === socket.id) return;
            const pc = peerConnections.current.get(payload.sender);
            if (pc && payload.candidate) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
              } catch (e) {
                // ignora erros de ICE candidate fora de ordem
              }
            }
          }
        );

        // ── CHAT ──
        socket.on("chat_message", (payload) => {
          setMessages((prev) => [...prev, payload]);
        });

        // ── DESCONEXÃO ──
        socket.on("user-disconnected", (userId: string) => {
          const pc = peerConnections.current.get(userId);
          if (pc) {
            pc.close();
            peerConnections.current.delete(userId);
          }
          setRemoteStreams((prev) => prev.filter((s) => s.id !== userId));
        });
      } catch (err) {
        console.error("Erro WebRTC:", err);
        clearTimeout(failTimeout);
        setConnectionError("Permissão de câmera/microfone negada ou dispositivo não encontrado.");
      }
    };

    initWebRTC();

    return () => {
      clearTimeout(failTimeout);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      socket.disconnect();
    };
  }, [roomName]);

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !micOn;
      setMicOn(!micOn);
    }
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !videoOn;
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
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
          />
          <div className="tile-label">
            {userName} (Você) {isHost ? "👑" : ""} {!micOn && "🔇"}
          </div>
        </div>

        {/* Vídeos remotos */}
        {remoteStreams.map((remote, index) => (
          <div
            key={remote.id}
            className="video-tile"
            style={{ display: isVisivel(index + 1) ? "block" : "none" }}
          >
            <video
              id={`video-${remote.id}`}
              autoPlay
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              ref={(el) => {
                if (el && remote.stream && el.srcObject !== remote.stream) {
                  el.srcObject = remote.stream;
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

        {/* Botão de copiar link — visível para TODOS (não só host) */}
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

                      {remoteStreams.map((remote) => (
                        <div key={remote.id} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-sm">
                            {(remote.name && remote.name.length > 0) ? remote.name[0].toUpperCase() : "P"}
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
