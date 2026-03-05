import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import io, { Socket } from "socket.io-client";
import { SOCKET_URL, AGORA_APP_ID } from "../config";
import WaitingScreen from "../components/WaitingScreen";
import Activities from "../components/Activities";

// ─── Types ────────────────────────────────────────────────────────────────────
interface RemoteUser {
  uid: string | number;
  name: string;
  videoTrack?: any;
  audioTrack?: any;
}
interface ChatMsg {
  id: string;
  sender: string;
  text: string;
  time: string;
  color?: string;
}
interface FloatEmoji {
  id: string;
  emoji: string;
  x: number;
}
interface TileEmoji {
  uid: string | number;
  emoji: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const REACTION_EMOJIS = ["❤️", "👍", "🎉", "👏", "😂", "😮", "😢", "🤔"];
const PARTICIPANT_COLORS = [
  "#25D366", "#128C7E", "#075E54", "#34B7F1", "#0093E9",
  "#a855f7", "#f59e0b", "#ec4899", "#14b8a6", "#6366f1",
];
function getColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PARTICIPANT_COLORS[Math.abs(h) % PARTICIPANT_COLORS.length];
}
function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Agora DOM size fix ───────────────────────────────────────────────────────
function fixAgoraSize(el: HTMLElement) {
  const wrap = el.querySelector<HTMLElement>("div");
  if (wrap) wrap.style.cssText = "width:100%!important;height:100%!important;position:absolute!important;top:0!important;left:0!important;transform:none!important;";
  const vid = el.querySelector<HTMLVideoElement>("video");
  if (vid) vid.style.cssText = "width:100%!important;height:100%!important;object-fit:cover!important;position:absolute!important;top:0!important;left:0!important;transform:none!important;";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Floating emoji that rises and fades out */
function FloatingReaction({ emoji, x, onDone }: { emoji: string; x: number; onDone: () => void; key?: any }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position: "fixed", left: x, bottom: 100, fontSize: "2.2rem",
      animation: "waFloatUp 2.8s ease-out forwards",
      pointerEvents: "none", zIndex: 9999,
    }}>
      {emoji}
    </div>
  );
}

/** Participant tile — WhatsApp style */
function ParticipantTile({
  uid, name, isSpeaking, isMuted, isHandRaised, tileEmoji, isLocal,
  videoTrack, localVideoRef,
}: {
  uid: string | number; name: string; isSpeaking: boolean; isMuted: boolean;
  isHandRaised: boolean; tileEmoji?: string; isLocal?: boolean;
  videoTrack?: any; localVideoRef?: React.RefObject<HTMLDivElement | null>;
  key?: any;
}) {
  const color = getColor(name);
  const inits = initials(name);
  const hasVideo = isLocal ? true : !!videoTrack;

  return (
    <div style={{
      position: "relative",
      background: hasVideo ? "#1c1c1c" : "#111111",
      borderRadius: 12,
      overflow: "hidden",
      border: isSpeaking ? "2.5px solid #25D366" : "2.5px solid transparent",
      transition: "border-color 0.3s",
      aspectRatio: "1 / 1",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {/* Video layer */}
      {isLocal ? (
        <div
          ref={localVideoRef}
          style={{ position: "absolute", inset: 0, transform: "scaleX(-1)" }}
        />
      ) : videoTrack ? (
        <RemoteVideoEl videoTrack={videoTrack} />
      ) : (
        /* Avatar */
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.4rem", fontWeight: 700, color: "#fff",
        }}>{inits}</div>
      )}

      {/* Speaking pulse ring */}
      {isSpeaking && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 10,
          border: "2px solid #25D366",
          animation: "waPulse 1.5s ease-in-out infinite",
          pointerEvents: "none",
        }} />
      )}

      {/* Hand raised badge */}
      {isHandRaised && (
        <div style={{
          position: "absolute", top: 6, right: 6,
          background: "#FFD700", borderRadius: "50%",
          width: 24, height: 24, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: "0.85rem",
        }}>✋</div>
      )}

      {/* Tile emoji reaction */}
      {tileEmoji && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: "2rem",
          animation: "waTileEmoji 0.3s ease both",
          pointerEvents: "none",
        }}>{tileEmoji}</div>
      )}

      {/* Bottom strip */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "18px 8px 6px",
        background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
        display: "flex", alignItems: "center", gap: 5,
      }}>
        {isMuted && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
            <line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
        <span style={{
          color: "#E9EDEF", fontSize: "0.7rem", fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          textShadow: "0 1px 3px rgba(0,0,0,0.9)",
        }}>{isLocal ? `${name} (Você)` : name}</span>
      </div>
    </div>
  );
}

/** Mounts a remote video track into a div */
function RemoteVideoEl({ videoTrack }: { videoTrack: any }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !videoTrack) return;
    if (!ref.current.querySelector("video")) {
      try {
        videoTrack.play(ref.current);
        setTimeout(() => { if (ref.current) fixAgoraSize(ref.current); }, 100);
        const obs = new ResizeObserver(() => { if (ref.current) fixAgoraSize(ref.current); });
        obs.observe(ref.current);
        return () => obs.disconnect();
      } catch (e) { console.error(e); }
    }
  }, [videoTrack]);
  return <div ref={ref} style={{ position: "absolute", inset: 0 }} />;
}

/** Chat message bubble */
function ChatBubble({ msg, isOwn }: { msg: ChatMsg; isOwn: boolean; key?: any }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start", marginBottom: 4 }}>
      {!isOwn && (
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: msg.color || "#25D366", marginLeft: 12, marginBottom: 2 }}>
          {msg.sender}
        </span>
      )}
      <div style={{
        maxWidth: "75%", padding: "7px 12px",
        background: isOwn ? "#005C4B" : "#1F2C34",
        borderRadius: isOwn ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
        position: "relative",
      }}>
        <p style={{ color: "#E9EDEF", fontSize: "0.88rem", lineHeight: 1.45, margin: 0 }}>{msg.text}</p>
        <span style={{ color: "#8696A0", fontSize: "0.6rem", float: "right", marginLeft: 8, marginTop: 2 }}>{msg.time}</span>
      </div>
    </div>
  );
}

// ─── Icon SVGs (WhatsApp/Meet style) ─────────────────────────────────────────
function IconCamera({ off }: { off: boolean }) {
  if (off) return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
      <path d="M23 7l-7 5 7 5V7z" strokeOpacity="0.5" />
    </svg>
  );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function IconMic({ muted }: { muted: boolean }) {
  if (muted) return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconEmoji() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3.5" />
      <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3.5" />
    </svg>
  );
}

function IconDots() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function IconEndCall() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.26 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.17 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.15 8.91a16 16 0 0 0 3.53 4.4z" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

const IcFlip = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E9EDEF" strokeWidth="2" strokeLinecap="round">
    <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" />
    <path d="M9 3l-3 3 3 3" strokeWidth="1.5" /><path d="M6 6h10a4 4 0 0 1 4 4" strokeWidth="1.5" />
  </svg>
);

const IcSpeaker = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E9EDEF" strokeWidth="2" strokeLinecap="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const IcGrid = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);

const IcSplit = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <rect x="3" y="3" width="18" height="9" /><rect x="3" y="14" width="18" height="7" />
  </svg>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Room({ initialRoom, initialParticipants, userId, userName, socket }: any) {
  const { roomName } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // ── Agora state ──
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [activeSpeakers, setActiveSpeakers] = useState<Set<string | number>>(new Set());
  const [speakerHistory, setSpeakerHistory] = useState<(string | number)[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // ── Socket / hand / chat state ──
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [maoLevantada, setMaoLevantada] = useState(false);
  const [maosRemotas, setMaosRemotas] = useState<{ id: string | number; timestamp: number }[]>([]);

  // ── UI state ──
  const [layoutGrid, setLayoutGrid] = useState(true);
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [floatEmojis, setFloatEmojis] = useState<FloatEmoji[]>([]);
  const [tileEmojis, setTileEmojis] = useState<TileEmoji[]>([]);
  const [clockStr, setClockStr] = useState("");
  const [copied, setCopied] = useState(false);
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const [activeActivity, setActiveActivity] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>(initialParticipants || []);

  // ── Refs ──
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const uidNameMap = useRef<Map<string | number, string>>(new Map());
  const localUidRef = useRef<string | number | null>(null);
  const localVideoDivRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const floatIdRef = useRef(0);

  const userRole = localStorage.getItem('userRole');
  const isHost = initialRoom?.hostId === userId || userRole === 'leader' || searchParams.get("host") === "true";
  const totalParticipants = participants.length > 0 ? participants.length : 1;

  // ── Clock ──
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClockStr(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    };
    tick();
    const iv = setInterval(tick, 10000);
    return () => clearInterval(iv);
  }, []);

  // ── Manual reactions ──
  const sendReaction = useCallback((emoji: string) => {
    const id = String(++floatIdRef.current);
    const x = 60 + Math.random() * (window.innerWidth - 120);
    setFloatEmojis(prev => [...prev, { id, emoji, x }]);

    // Mostra o emoji no próprio tile (local)
    setTileEmojis(prev => [...prev, { uid: "local", emoji }]);
    setTimeout(() => setTileEmojis(prev => prev.filter(e => e.uid !== "local" || e.emoji !== emoji)), 1200);

    // Envia via socket para outros verem
    socketRef.current?.emit("reaction", emoji);

    setShowReactions(false);
  }, []);

  // Handler para reações recebidas via socket
  useEffect(() => {
    if (!socketRef.current) return;
    const socket = socketRef.current;

    const onReaction = (data: string | { emoji: string; uid: string | number }) => {
      // Verifica se o dado é apenas a string (emoji) ou objeto com uid
      const emoji = typeof data === "string" ? data : data.emoji;
      const uid = typeof data === "object" ? data.uid : null;

      if (uid) {
        setTileEmojis(prev => [...prev, { uid, emoji }]);
        setTimeout(() => setTileEmojis(prev => prev.filter(e => e.uid !== uid || e.emoji !== emoji)), 1200);
      } else {
        // Fallback: mostra uma reação flutuante aleatória se não tiver UID
        const floatId = String(++floatIdRef.current);
        const x = 40 + Math.random() * (window.innerWidth - 80);
        setFloatEmojis(prev => [...prev, { id: floatId, emoji, x }]);
      }
    };

    socket.on("reaction", onReaction);
    return () => { socket.off("reaction", onReaction); };
  }, [remoteUsers]);

  // ── Agora + Socket init ──
  useEffect(() => {
    if (!roomName) return;
    if (!searchParams.get("nome")) { navigate(`/?roomId=${roomName}`); return; }

    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("chat_message", (payload: ChatMsg) => setMessages(prev => [...prev, payload]));
    socket.on("raise_hand", (data: { uid: string | number; isRaised: boolean; timestamp: number }) => {
      setMaosRemotas(prev => {
        if (data.isRaised) {
          if (!prev.find(m => String(m.id) === String(data.uid))) return [...prev, { id: data.uid, timestamp: data.timestamp }];
          return prev;
        }
        return prev.filter(m => String(m.id) !== String(data.uid));
      });
    });

    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    clientRef.current = client;

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      const name = uidNameMap.current.get(user.uid) || "Participante";
      if (mediaType === "video") {
        setRemoteUsers(prev => {
          const exists = prev.find(u => String(u.uid) === String(user.uid));
          if (exists) return prev.map(u => String(u.uid) === String(user.uid) ? { ...u, videoTrack: user.videoTrack } : u);
          return [...prev, { uid: user.uid, name, videoTrack: user.videoTrack }];
        });
      }
      if (mediaType === "audio") {
        user.audioTrack?.play();
        setRemoteUsers(prev => {
          const exists = prev.find(u => String(u.uid) === String(user.uid));
          if (exists) return prev.map(u => String(u.uid) === String(user.uid) ? { ...u, audioTrack: user.audioTrack } : u);
          return [...prev, { uid: user.uid, name, audioTrack: user.audioTrack }];
        });
      }
    });

    client.on("user-unpublished", (user, mediaType) => {
      if (mediaType === "video") setRemoteUsers(prev => prev.map(u => String(u.uid) === String(user.uid) ? { ...u, videoTrack: undefined } : u));
    });

    client.on("user-left", (user) => {
      setRemoteUsers(prev => prev.filter(u => String(u.uid) !== String(user.uid)));
      uidNameMap.current.delete(user.uid);
      setSpeakerHistory(prev => prev.filter(id => String(id) !== String(user.uid)));
      setMaosRemotas(prev => prev.filter(m => String(m.id) !== String(user.uid)));
    });

    socket.on("user-name", (uid: string | number, name: string) => {
      uidNameMap.current.set(uid, name);
      setRemoteUsers(prev => prev.map(u => String(u.uid) === String(uid) ? { ...u, name } : u));
    });

    const init = async () => {
      const failTO = setTimeout(() => setConnectionError("Demora na conexão. Verifique permissões de câmera/microfone."), 15000);
      try {
        client.enableAudioVolumeIndicator();
        client.on("volume-indicator", (volumes) => {
          const speaking = new Set<string | number>();
          volumes.forEach(v => { if (v.level > 5) speaking.add(v.uid === 0 ? "local" : String(v.uid)); });
          setActiveSpeakers(speaking);
          if (speaking.size > 0) {
            setSpeakerHistory(prev => {
              const h = [...prev];
              speaking.forEach(sid => {
                const idx = h.findIndex(id => String(id) === String(sid));
                if (idx !== -1) h.splice(idx, 1);
                h.unshift(sid);
              });
              return h.slice(0, 20);
            });
          }
        });

        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks().catch(() => {
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
        clearTimeout(failTO);

        // Play local video
        if (localVideoDivRef.current && !localVideoDivRef.current.querySelector("video")) {
          videoTrack.play(localVideoDivRef.current);
          setTimeout(() => { if (localVideoDivRef.current) fixAgoraSize(localVideoDivRef.current); }, 100);
          const obs = new ResizeObserver(() => { if (localVideoDivRef.current) fixAgoraSize(localVideoDivRef.current); });
          obs.observe(localVideoDivRef.current);
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes("PERMISSION_DENIED") || msg.includes("getUserMedia") || msg.includes("NotFound")) {
          setConnectionError("Permissão de câmera/microfone negada.");
        } else {
          setConnectionError(`Erro: ${msg}`);
        }
      }
    };
    init();

    return () => {
      localVideoTrackRef.current?.stop(); localVideoTrackRef.current?.close();
      localAudioTrackRef.current?.stop(); localAudioTrackRef.current?.close();
      clientRef.current?.leave().catch(console.error);
      socketRef.current?.disconnect();
    };
  }, [roomName]);

  // Chat auto-scroll
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── Actions ──
  const toggleMic = () => { localAudioTrackRef.current?.setEnabled(!micOn); setMicOn(p => !p); };
  const toggleVideo = () => { localVideoTrackRef.current?.setEnabled(!videoOn); setVideoOn(p => !p); };

  const removeFloat = useCallback((id: string) => setFloatEmojis(prev => prev.filter(r => r.id !== id)), []);

  const toggleHand = () => {
    const next = !maoLevantada;
    setMaoLevantada(next);
    if (socketRef.current && localUidRef.current) {
      socketRef.current.emit("raise_hand", { uid: localUidRef.current, isRaised: next, timestamp: Date.now() });
    }
    setShowMenu(false);
  };

  const sendMessage = () => {
    if (!chatInput.trim() || !socketRef.current) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const msg: ChatMsg = { id: Math.random().toString(), sender: userName, text: chatInput.trim(), time, color: "#25D366" };
    socketRef.current.emit("chat_message", msg);
    setMessages(prev => [...prev, msg]);
    setChatInput("");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomName}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const leaveCall = () => {
    localStorage.removeItem("dmeet_role");
    localStorage.removeItem("dmeet_name");
    navigate("/");
  };

  // ── Tile ordering ──
  const sortedRemote = [...remoteUsers].sort((a, b) => {
    const aHand = maosRemotas.find(m => String(m.id) === String(a.uid));
    const bHand = maosRemotas.find(m => String(m.id) === String(b.uid));
    if (aHand && !bHand) return -1; if (!aHand && bHand) return 1;
    if (aHand && bHand) return bHand.timestamp - aHand.timestamp;
    const aIdx = speakerHistory.findIndex(id => String(id) === String(a.uid));
    const bIdx = speakerHistory.findIndex(id => String(id) === String(b.uid));
    if (aIdx !== -1 && bIdx === -1) return -1; if (aIdx === -1 && bIdx !== -1) return 1;
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    return 0;
  });

  const MAX_TILES = 7;
  const visibleRemote = sortedRemote.slice(0, MAX_TILES);
  const extraCount = totalParticipants - 1 - visibleRemote.length; // extra beyond visible

  // ── Stacked avatars for nav bar (up to 3 remote + local) ──
  const avatarList = [userName, ...sortedRemote.slice(0, 2).map(u => u.name)];
  const groupName = sortedRemote.length > 0
    ? `${sortedRemote[0].name.split(" ")[0]} + ${totalParticipants - 1}`
    : userName;

  const handRaisedNames = [
    ...(maoLevantada ? [userName] : []),
    ...maosRemotas.map(m => {
      const u = remoteUsers.find(r => String(r.uid) === String(m.id));
      return u?.name || "Participante";
    }),
  ];

  // Condição para exibir tela de espera (Google Meet style)
  const isAlone = participants.length <= 1;

  if (isAlone) {
    return (
      <div style={{ width: '100vw', height: '100vh', animation: 'waFadeIn 0.35s ease-out' }}>
        <WaitingScreen
          meetLink={`${window.location.origin}/room/${roomName}`}
          onEndCall={leaveCall}
          isMuted={!micOn}
          isCameraOff={!videoOn}
          onToggleMic={toggleMic}
          onToggleCam={toggleVideo}
        />
      </div>
    );
  }

  return (
    <>
      {/* ── Global styles ── */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #000; overflow: hidden; }
        html, body, #root { height: 100%; }

        @keyframes waFloatUp {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          70%  { opacity: 1; }
          100% { transform: translateY(-260px) scale(1.4); opacity: 0; }
        }
        @keyframes waPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
        @keyframes waTileEmoji {
          0%   { transform: translate(-50%,-50%) scale(0); }
          60%  { transform: translate(-50%,-50%) scale(1.3); }
          100% { transform: translate(-50%,-50%) scale(1); }
        }
        @keyframes waSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes waFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes waFadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
      `}</style>

      {/* ── Root wrapper ── */}
      <div style={{
        width: "100vw", height: "100vh",
        background: "#000000",
        display: "flex", flexDirection: "column",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        overflow: "hidden", position: "relative",
        color: "#E9EDEF",
      }}>

        {/* ── Floating reactions ── */}
        {floatEmojis.map(r => (
          <FloatingReaction key={r.id} emoji={r.emoji} x={r.x} onDone={() => removeFloat(r.id)} />
        ))}

        {/* ── Barra de status ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 18px 4px",
          background: "rgba(0,0,0,0.6)",
          zIndex: 20,
        }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#E9EDEF" }}>{clockStr}</span>
          {/* Ícones removidos a pedido do usuário */}
        </div>

        {/* ── Nav bar ── */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "6px 12px 8px",
          background: "rgba(0,0,0,0.6)",
          gap: 10, zIndex: 20,
        }}>
          {/* Back button */}
          <button onClick={leaveCall} style={{
            background: "none", border: "none", color: "#E9EDEF",
            fontSize: "1.5rem", lineHeight: 1, cursor: "pointer", padding: "0 4px",
          }}>‹</button>

          {/* Stacked avatars */}
          <div style={{ display: "flex", position: "relative", width: 40, flexShrink: 0 }}>
            {avatarList.slice(0, 3).map((n, i) => (
              <div key={i} style={{
                width: 28, height: 28, borderRadius: "50%",
                background: getColor(n),
                border: "2px solid #000",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.62rem", fontWeight: 700, color: "#fff",
                position: "absolute", left: i * 10,
                zIndex: 3 - i,
              }}>{initials(n)}</div>
            ))}
          </div>

          {/* Group name */}
          <div style={{ flex: 1, marginLeft: 28 }}>
            <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#E9EDEF" }}>{groupName}</div>
            <div style={{ fontSize: "0.65rem", color: "#8696A0" }}>
              {totalParticipants} participante{totalParticipants !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Hand raised badge */}
          {handRaisedNames.length > 0 && (
            <div style={{
              background: "rgba(255,215,0,0.18)", border: "1px solid #FFD700",
              borderRadius: 20, padding: "3px 9px",
              display: "flex", alignItems: "center", gap: 4,
              animation: "waPulse 2s ease-in-out infinite",
            }}>
              <span style={{ fontSize: "0.75rem" }}>✋</span>
              <span style={{ fontSize: "0.65rem", color: "#FFD700", fontWeight: 600 }}>
                {handRaisedNames[0].split(" ")[0]}{handRaisedNames.length > 1 ? ` +${handRaisedNames.length - 1}` : ""}
              </span>
            </div>
          )}

          {/* Flip icon */}
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <IcFlip />
          </button>
          {/* Speaker */}
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <IcSpeaker />
          </button>
        </div>

        {/* ── Layout toggle ── */}
        <div style={{
          display: "flex", justifyContent: "flex-end",
          padding: "6px 14px 4px",
          background: "rgba(0,0,0,0.4)",
          gap: 8, zIndex: 20,
        }}>
          {[{ val: true, Ic: IcGrid }, { val: false, Ic: IcSplit }].map(({ val, Ic }) => (
            <button
              key={String(val)}
              onClick={() => setLayoutGrid(val)}
              style={{
                width: 36, height: 28, borderRadius: 8,
                background: layoutGrid === val ? "#FF7A00" : "rgba(255,255,255,0.12)",
                border: "none", cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
                color: layoutGrid === val ? "#fff" : "#8696A0",
                transition: "background 0.2s",
              }}
            ><Ic /></button>
          ))}
        </div>

        {/* ── Video grid ── */}
        <div style={{
          flex: 1,
          padding: "8px 8px 0",
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: layoutGrid ? "1fr 1fr" : "1fr",
          gap: 6,
          alignContent: "start",
        }}>
          {/* Local tile */}
          <ParticipantTile
            uid="local"
            name={`${userName}${isHost ? " 👑" : ""}`}
            isSpeaking={activeSpeakers.has("local")}
            isMuted={!micOn}
            isHandRaised={maoLevantada}
            tileEmoji={tileEmojis.find(e => e.uid === "local")?.emoji}
            isLocal
            localVideoRef={localVideoDivRef}
          />

          {/* Remote tiles */}
          {visibleRemote.map(u => (
            <ParticipantTile
              key={String(u.uid)}
              uid={u.uid}
              name={u.name}
              isSpeaking={activeSpeakers.has(String(u.uid))}
              isMuted={false}
              isHandRaised={maosRemotas.some(m => String(m.id) === String(u.uid))}
              tileEmoji={tileEmojis.find(e => String(e.uid) === String(u.uid))?.emoji}
              videoTrack={u.videoTrack}
            />
          ))}

          {/* "+X more" tile */}
          {extraCount > 0 && (
            <div style={{
              aspectRatio: "1/1", borderRadius: 12,
              background: "#111111",
              border: "2px solid transparent",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <div style={{
                fontSize: "1.8rem", fontWeight: 700, color: "#E9EDEF",
                fontVariantNumeric: "tabular-nums",
              }}>+{extraCount}</div>
              <div style={{ fontSize: "0.65rem", color: "#8696A0", textAlign: "center" }}>
                mais participantes
              </div>
              {/* last visible remote name + mic */}
              {sortedRemote[MAX_TILES] && (
                <div style={{ fontSize: "0.62rem", color: "#8696A0", display: "flex", alignItems: "center", gap: 3 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8696A0" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                  {sortedRemote[MAX_TILES].name.split(" ")[0]}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Reaction emoji strip ── */}
        {showReactions && (
          <div style={{
            position: "absolute",
            bottom: 106, left: "50%",
            transform: "translateX(-50%)",
            background: "#1F2C34",
            borderRadius: 30,
            padding: "10px 14px",
            display: "flex", gap: 8,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            animation: "waFadeInUp 0.2s ease",
            zIndex: 200,
          }}>
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                style={{
                  background: "none", border: "none", fontSize: "1.6rem",
                  cursor: "pointer", borderRadius: 12, padding: "4px 3px",
                  transition: "transform 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.4)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              >{emoji}</button>
            ))}
          </div>
        )}

        {/* ── Control bar (WhatsApp/Meet style) ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 8, padding: "10px 12px",
          background: "#2C2C2E",
          borderRadius: "28px",
          zIndex: 20,
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
        }}>
          {/* Câmera */}
          <Btn
            active={!videoOn}
            activeBg="#FFCDD2"
            activeColor="#C62828"
            onClick={toggleVideo}
            title={videoOn ? "Desligar câmera" : "Ligar câmera"}
          >
            <IconCamera off={!videoOn} />
          </Btn>

          {/* Microfone */}
          <Btn
            active={!micOn}
            activeBg="#FFCDD2"
            activeColor="#C62828"
            onClick={toggleMic}
            title={micOn ? "Mutar" : "Ativar mic"}
          >
            <IconMic muted={!micOn} />
          </Btn>

          {/* Emoji */}
          <Btn
            active={showReactions}
            activeBg="#BBDEFB"
            activeColor="#1565C0"
            onClick={() => { setShowReactions(p => !p); setShowMenu(false); }}
            title="Reações"
          >
            <IconEmoji />
          </Btn>

          {/* Menu / Atividades */}
          <Btn
            active={showMenu || activitiesOpen}
            activeBg="#4A4A4C"
            activeColor="#fff"
            onClick={() => { setShowMenu(p => !p); setActivitiesOpen(false); }}
            title="Mais opções"
          >
            <IconDots />
          </Btn>

          {/* Separador */}
          <div style={{
            width: "1.5px", height: "38px",
            background: "rgba(255,255,255,0.13)",
            borderRadius: "1px", margin: "0 2px", flexShrink: 0,
          }} />

          {/* Atividades (✨) - Adicionado conforme o design unificado */}
          <Btn
            active={activitiesOpen}
            activeBg="rgba(255,255,255,0.2)"
            onClick={() => { setActivitiesOpen(p => !p); setShowMenu(false); }}
            title="Atividades"
          >
            <span style={{ fontSize: "1.4rem" }}>✨</span>
          </Btn>

          {/* Encerrar */}
          <button
            onClick={leaveCall}
            style={{
              width: "78px", height: "62px", borderRadius: "20px",
              background: "#D32F2F", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 18px rgba(211,47,47,0.5)",
              transition: "transform 0.12s ease", flexShrink: 0,
            }}
            onMouseDown={e => e.currentTarget.style.transform = "scale(0.91)"}
            onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <IconEndCall />
          </button>
        </div>

        {/* ── Bottom sheet overlay ── */}
        {showMenu && (
          <>
            <div
              onClick={() => setShowMenu(false)}
              style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
                zIndex: 300, animation: "waFadeIn 0.2s ease",
              }}
            />
            <div style={{
              position: "fixed", bottom: 0, left: 0, right: 0,
              background: "#1F2C34",
              borderRadius: "16px 16px 0 0",
              zIndex: 301,
              animation: "waSlideUp 0.28s ease",
              paddingBottom: 28,
            }}>
              {/* Drag handle */}
              <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px" }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.25)" }} />
              </div>

              <div style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Hand raise */}
                <button onClick={toggleHand} style={{
                  width: "100%", padding: "16px 0",
                  background: "#2A3942",
                  border: "none", borderRadius: 12,
                  cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  transition: "background 0.2s",
                }}>
                  <span style={{ fontSize: "2rem" }}>✋</span>
                  <span style={{
                    fontSize: "0.85rem", fontWeight: 600,
                    color: maoLevantada ? "#FFD700" : "#E9EDEF",
                  }}>{maoLevantada ? "Baixar a mão" : "Levantar a mão"}</span>
                </button>

                {/* Row: Share / CC / Mute */}
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { icon: "📺", label: "Compartilhar tela" },
                    { icon: "CC", label: "Legendas", isText: true },
                    { icon: micOn ? "🔊" : "🔇", label: micOn ? "Mutar todos" : "Desmutar" },
                  ].map(item => (
                    <MenuIconBtn key={item.label} icon={item.icon} label={item.label} isText={item.isText} />
                  ))}
                </div>

                {/* Em movimento */}
                <button style={{
                  width: "100%", padding: "14px",
                  background: "#2A3942", border: "none", borderRadius: 12,
                  color: "#E9EDEF", fontSize: "0.88rem", fontWeight: 600,
                  cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: "1.2rem" }}>🚗</span> Em movimento
                </button>

                {/* Messages / Add participants */}
                <div style={{ display: "flex", gap: 8 }}>
                  <MenuWideBtn
                    icon="💬" label="Mensagens na chamada"
                    onClick={() => { setShowChat(true); setShowMenu(false); }}
                    badge={messages.length > 0 ? messages.length : undefined}
                  />
                  <MenuWideBtn
                    icon="👥" label="Adicionar participantes"
                    onClick={copyLink}
                  />
                </div>

                {/* Settings / Tools / Report */}
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { icon: "⚙️", label: "Configurações" },
                    { icon: "🔧", label: "Ferramentas" },
                    { icon: "🚩", label: "Denunciar abuso" },
                  ].map(item => (
                    <MenuIconBtn key={item.label} icon={item.icon} label={item.label} />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Chat fullscreen ── */}
        {showChat && (
          <div style={{
            position: "fixed", inset: 0,
            background: "#0B141A",
            zIndex: 400,
            display: "flex", flexDirection: "column",
            animation: "waSlideUp 0.25s ease",
          }}>
            {/* Chat header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "48px 16px 14px",
              background: "#1F2C34",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              <button onClick={() => setShowChat(false)} style={{
                background: "none", border: "none", color: "#E9EDEF",
                fontSize: "1.5rem", cursor: "pointer", lineHeight: 1, padding: "0 4px",
              }}>‹</button>
              <div>
                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#E9EDEF" }}>Mensagens na chamada</div>
                <div style={{ fontSize: "0.7rem", color: "#8696A0" }}>{totalParticipants} participantes</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
              {messages.length === 0 ? (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", height: "100%", gap: 8,
                }}>
                  <span style={{ fontSize: "2.5rem" }}>💬</span>
                  <p style={{ color: "#8696A0", fontSize: "0.85rem" }}>Nenhuma mensagem ainda</p>
                </div>
              ) : (
                messages.map(m => (
                  <ChatBubble key={m.id} msg={m} isOwn={m.sender === userName} />
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px 28px",
              background: "#1F2C34",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Mensagem..."
                style={{
                  flex: 1, background: "#2A3942",
                  border: "none", borderRadius: 24,
                  padding: "10px 16px",
                  color: "#E9EDEF", fontSize: "0.92rem",
                  outline: "none",
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!chatInput.trim()}
                style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: chatInput.trim() ? "#00A884" : "rgba(255,255,255,0.12)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Activities Panel ── */}
        <Activities
          isOpen={activitiesOpen}
          onClose={() => setActivitiesOpen(false)}
          roomId={initialRoom?.code}
          userName={userName}
        />
      </div>
    </>
  );
}

// ─── Helper button components ─────────────────────────────────────────────────

function Btn({ active, defaultBg = "#3A3A3C", activeBg, activeColor, defaultColor = "#fff", onClick, children, title }: any) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      title={title}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => { setPressed(false); onClick?.(); }}
      onPointerLeave={() => setPressed(false)}
      style={{
        width: "62px",
        height: "62px",
        borderRadius: "20px",
        background: active ? activeBg : defaultBg,
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: active ? activeColor : defaultColor,
        transform: pressed ? "scale(0.91)" : "scale(1)",
        transition: "transform 0.12s ease, background 0.15s ease, color 0.15s ease",
        WebkitTapHighlightColor: "transparent",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function MenuIconBtn({ icon, label, isText }: { icon: string; label: string; isText?: boolean; key?: any }) {
  return (
    <button style={{
      flex: 1, padding: "12px 4px",
      background: "#2A3942", border: "none", borderRadius: 12,
      cursor: "pointer", display: "flex", flexDirection: "column",
      alignItems: "center", gap: 6,
    }}>
      {isText
        ? <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "#E9EDEF" }}>{icon}</span>
        : <span style={{ fontSize: "1.4rem" }}>{icon}</span>
      }
      <span style={{ fontSize: "0.62rem", color: "#8696A0", textAlign: "center", lineHeight: 1.3 }}>{label}</span>
    </button>
  );
}

function MenuWideBtn({ icon, label, onClick, badge }: {
  icon: string; label: string; onClick?: () => void; badge?: number;
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "14px 10px",
      background: "#2A3942", border: "none", borderRadius: 12,
      cursor: "pointer", display: "flex", flexDirection: "column",
      alignItems: "center", gap: 6, position: "relative",
    }}>
      <span style={{ fontSize: "1.5rem" }}>{icon}</span>
      <span style={{ fontSize: "0.68rem", color: "#E9EDEF", textAlign: "center", lineHeight: 1.3 }}>{label}</span>
      {badge && badge > 0 ? (
        <div style={{
          position: "absolute", top: 8, right: 8,
          background: "#25D366", borderRadius: "50%",
          width: 18, height: 18,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.58rem", fontWeight: 700, color: "#fff",
        }}>{badge}</div>
      ) : null}
    </button>
  );
}
