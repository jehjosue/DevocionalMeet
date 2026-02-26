import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Copy, LogOut, Shield, Mic, MicOff, Video, VideoOff, Users, Share2, MessageSquare, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import io, { Socket } from "socket.io-client";

// Configurações ICE (Google STUN)
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

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

  const userName = searchParams.get("nome") || localStorage.getItem("dmeet_name_" + localStorage.getItem("dmeet_userId")) || "Participante";
  const role = searchParams.get("role") || "audience";
  const isHost = role === "host";

  const [activeTab, setActiveTab] = useState<"people" | "chat">("people");
  const [messages, setMessages] = useState<{ id: string, sender: string, text: string, time: string }[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});

  // Para UI: rastrear participantes remotos e seus MediaStreams
  const [remoteStreams, setRemoteStreams] = useState<{ id: string, stream: MediaStream }[]>([]);

  useEffect(() => {
    if (!roomName) return;

    // Conectar ao Socket.io
    const socket = io(); // Conecta à origem atual (porta do servidor Node)
    socketRef.current = socket;

    // Timeout p/ fallback caso o getUserMedia demore ou falhe
    const failTimeout = setTimeout(() => {
      if (!joined && !connectionError) {
        setConnectionError("Demora na conexão. Verifique permissões de câmera/microfone.");
      }
    }, 15000);

    const initWebRTC = async () => {
      try {
        // 1. CAPTURE O STREAM LOCAL ANTES (Bug 2 Fix)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        localStreamRef.current = stream;

        // 2. EXIBA O STREAM LOCAL
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setJoined(true);
        clearTimeout(failTimeout);

        // Avisa o servidor que entramos na sala
        socket.emit("join-room", roomName, socket.id);

        // Quando um novo usuário entra, NÓS (que já estávamos) criamos a oferta para ele
        socket.on("user-joined", async (userId: string) => {
          if (userId === socket.id) return;
          const peer = createPeer(userId, socket, stream);
          peersRef.current[userId] = peer;

          try {
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            socket.emit("offer", { target: userId, caller: socket.id, sdp: offer });
          } catch (e) {
            console.error("Erro ao criar offer:", e);
          }
        });

        // Quando recebemos uma oferta de alguém (nós somos os novos)
        socket.on("offer", async (payload: { target: string, caller: string, sdp: RTCSessionDescriptionInit }) => {
          if (payload.target !== socket.id) return;

          const peer = createPeer(payload.caller, socket, stream);
          peersRef.current[payload.caller] = peer;

          try {
            await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit("answer", { target: payload.caller, caller: socket.id, sdp: answer });
          } catch (e) {
            console.error("Erro ao responder offer:", e);
          }
        });

        // Quando recebemos uma resposta à nossa oferta
        socket.on("answer", async (payload: { target: string, caller: string, sdp: RTCSessionDescriptionInit }) => {
          if (payload.target !== socket.id) return;
          const peer = peersRef.current[payload.caller];
          if (peer) {
            try {
              await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            } catch (e) {
              console.error("Erro ao setar remote desc (answer)", e);
            }
          }
        });

        // Quando recebemos candidatos de rede
        socket.on("ice-candidate", async (payload: { target?: string, sender: string, candidate: RTCIceCandidateInit }) => {
          // Ignora se fomos nós que enviamos
          if (payload.sender === socket.id) return;
          const peer = peersRef.current[payload.sender];
          if (peer && payload.candidate) {
            try {
              await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
              console.error("Erro ao adicionar ICE Candidate", e);
            }
          }
        });

        // Chat
        socket.on("chat_message", (payload) => {
          setMessages(prev => [...prev, payload]);
        });

        // Controle de desconexão
        socket.on("user-disconnected", (userId: string) => {
          if (peersRef.current[userId]) {
            peersRef.current[userId].close();
            delete peersRef.current[userId];
          }
          setRemoteStreams(prev => prev.filter(streamObj => streamObj.id !== userId));
        });

      } catch (err: any) {
        console.error("Erro WebRTC:", err);
        clearTimeout(failTimeout);
        setConnectionError("Permissão de câmera/microfone negada ou dispositivo não encontrado.");
      }
    };

    initWebRTC();

    return () => {
      clearTimeout(failTimeout);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      Object.keys(peersRef.current).forEach(peerId => {
        peersRef.current[peerId].close();
      });
      if (socket) {
        socket.disconnect();
      }
    };
  }, [roomName]);

  // Função auxiliar para criar a conexão P2P (Bug 2 Fix)
  const createPeer = (peerId: string, socket: Socket, stream: MediaStream) => {
    // 3. CRIE O PEER CONNECTION
    const peer = new RTCPeerConnection(ICE_SERVERS);

    // 4. ADICIONE AS TRACKS LOCAIS (Correção fundamental do Áudio/Vídeo Mudo)
    stream.getTracks().forEach(track => {
      peer.addTrack(track, stream);
    });

    // 5. OUVIR AS TRACKS REMOTAS
    peer.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStreams(prev => {
          // Evita duplicar se a thread rodar duas vezes
          if (prev.some(s => s.id === peerId)) return prev;
          return [...prev, { id: peerId, stream: event.streams[0] }];
        });
      }
    };

    // 6. ENVIAR CANDIDATOS
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          target: peerId,
          sender: socket.id,
          candidate: event.candidate
        });
      }
    };

    return peer;
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micOn;
        setMicOn(!micOn);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoOn;
        setVideoOn(!videoOn);
      }
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current) return;

    const msg = {
      id: Math.random().toString(),
      sender: userName,
      text: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    socketRef.current.emit("chat_message", msg);
    setNewMessage("");
  };

  const copyLink = () => {
    // Geração limpa sem o nome na URL
    const cleanUrl = window.location.origin + '/room/' + roomName;
    navigator.clipboard.writeText(cleanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    // Aplicação da classe mobile 'sala-container' (Bug 3 Fix)
    <div className="sala-container">
      {/* ── TOP INFO ── */}
      <div className="absolute top-0 left-0 p-4 z-10 w-full flex justify-between items-start pointer-events-none">
        <div className="flex items-center gap-3 font-medium text-sm bg-black/40 px-4 py-2 rounded-xl backdrop-blur-md pointer-events-auto">
          <span className="text-white">{roomName}</span>
          <span className="opacity-30 text-white">|</span>
          <span className="text-white opacity-80">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* ── MAIN CONTENT (Videos Area) ── */}
      <main className="videos-area">
        {!joined && !connectionError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10 gap-4 bg-[var(--bg-page)]">
            <div className="w-10 h-10 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin" />
            <p>Conectando dispositivos e acessando a sala...</p>
          </div>
        )}

        {connectionError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-50 bg-black/80 backdrop-blur-sm p-4 text-center">
            <Shield size={48} className="text-red-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Falha na Conexão</h3>
            <p className="text-white/70 mb-6">{connectionError}</p>
            <button onClick={() => navigate("/")} className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-semibold transition-all">
              Voltar para o Início
            </button>
          </div>
        )}

        {/* Local Video */}
        <div className="video-tile">
          <video ref={localVideoRef} autoPlay playsInline muted />
          <div className="tile-label">{userName} (Você) {isHost ? "👑" : ""} {!micOn && "🔇"}</div>
        </div>

        {/* Remote Videos */}
        {remoteStreams.map((remote) => (
          <div key={remote.id} className="video-tile">
            <RemoteVideo stream={remote.stream} />
            <div className="tile-label">Participante</div>
          </div>
        ))}
      </main>

      {/* ── BOTTOM CONTROLS (Mobile fix) ── */}
      <div className="controles-bar">
        <button
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${!micOn ? 'bg-red-500 hover:bg-red-600' : 'bg-[#3c4043] hover:bg-[#4a4e51]'} text-white`}
          onClick={toggleMic}
        >
          {micOn ? <Mic size={24} /> : <MicOff size={24} />}
        </button>

        <button
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${!videoOn ? 'bg-red-500 hover:bg-red-600' : 'bg-[#3c4043] hover:bg-[#4a4e51]'} text-white`}
          onClick={toggleVideo}
        >
          {videoOn ? <Video size={24} /> : <VideoOff size={24} />}
        </button>

        <button className="w-16 h-12 rounded-3xl flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-colors" onClick={() => navigate("/")}>
          <LogOut size={22} />
        </button>

        <button className="h-10 px-4 rounded-3xl flex items-center justify-center bg-transparent hover:bg-white/10 text-white transition-colors gap-2" onClick={() => setShowSidebar(true)}>
          <Users size={20} />
          <span className="bg-blue-300 text-blue-900 text-[10px] font-bold px-2 py-0.5 rounded-full">{remoteStreams.length + 1}</span>
        </button>
      </div>

      {/* ── SIDEBAR DRAWER (Overlay) ── */}
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
                <button onClick={() => setShowSidebar(false)} className="text-gray-500 p-2"><X size={20} /></button>
              </div>

              <div className="flex border-b border-gray-200">
                <button
                  className={`flex-1 p-3 font-medium transition-colors ${activeTab === 'people' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                  onClick={() => setActiveTab("people")}
                >
                  Pessoas
                </button>
                <button
                  className={`flex-1 p-3 font-medium transition-colors ${activeTab === 'chat' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                  onClick={() => setActiveTab("chat")}
                >
                  Chat
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                {activeTab === "people" ? (
                  <>
                    <h3 className="text-xs font-bold text-gray-500 tracking-wider mb-3">GERENCIAR REUNIÃO</h3>
                    <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl mb-6 hover:bg-gray-50 transition-colors" onClick={copyLink}>
                      <span className="text-blue-600 font-medium">{copied ? "Link Copiado!" : "Copiar link de participação"}</span>
                      <Copy size={18} className="text-blue-600" />
                    </button>

                    <h3 className="text-xs font-bold text-gray-500 tracking-wider mb-3">PARTICIPANTES ({remoteStreams.length + 1})</h3>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">{userName[0]?.toUpperCase() || "?"}</div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{userName} (Você) {isHost && "👑"}</p>
                        </div>
                        <div className="text-gray-500">
                          {micOn ? <Mic size={16} /> : <MicOff size={16} className="text-red-500" />}
                        </div>
                      </div>

                      {remoteStreams.map((remote) => (
                        <div key={remote.id} className="flex items-center gap-3 opacity-90">
                          <div className="w-10 h-10 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center font-bold">P</div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">Participante</p>
                          </div>
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
                          <div key={msg.id} className={`flex flex-col ${msg.sender === userName ? 'items-end' : 'items-start'}`}>
                            <div className="flex gap-2 items-baseline text-xs text-gray-500 mb-1">
                              <span className="font-semibold">{msg.sender === userName ? "Você" : msg.sender}</span>
                              <span className="text-[10px]">{msg.time}</span>
                            </div>
                            <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${msg.sender === userName ? 'bg-blue-100 text-blue-900 rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                              {msg.text}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <form className="p-3 border-t border-gray-200 flex gap-2 bg-white" onSubmit={sendMessage}>
                      <input
                        type="text"
                        placeholder="Envie uma mensagem..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 bg-gray-100 border border-transparent focus:border-blue-500 px-4 py-2 rounded-full text-sm outline-none transition-colors"
                      />
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
    </div>
  );
}

// Subcomponente para renderizar vídeos remotos com ref dinâmico
function RemoteVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return <video ref={videoRef} autoPlay playsInline />;
}
