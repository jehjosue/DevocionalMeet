import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import io, { Socket } from "socket.io-client";
import { motion, AnimatePresence } from "motion/react";
import { SOCKET_URL, AGORA_APP_ID } from "../config";
import WaitingScreen from "../components/WaitingScreen";
import Activities from "../components/Activities";
import VideoGrid from "../components/VideoGrid";
import { useBackgroundBlur } from '../hooks/useBackgroundBlur';
import { toast, Toaster } from 'react-hot-toast';
import { MicOff } from 'lucide-react';

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

// ParticipantTile and VideoGrid were moved to separate component files.

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
  const { code: roomName } = useParams();
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
  const [showParticipants, setShowParticipants] = useState(false);
  const [allMuted, setAllMuted] = useState(false);
  const [mutedParticipants, setMutedParticipants] = useState<string[]>([]);
  const [allVideoDisabled, setAllVideoDisabled] = useState(false);
  const [videoDisabledParticipants, setVideoDisabledParticipants] = useState<string[]>([]);
  const [showModeratorPanel, setShowModeratorPanel] = useState(false);
  const [showPWABanner, setShowPWABanner] = useState(false);
  const [socketObj, setSocketObj] = useState<Socket | null>(null);
  const [bgBlur, setBgBlur] = useState(false);

  // ── Refs ──
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const uidNameMap = useRef<Map<string | number, string>>(new Map());
  const localUidRef = useRef<string | number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const floatIdRef = useRef(0);
  const localVideoContainerRef = useRef<HTMLDivElement>(null);
  const originalVideoTrackRef = useRef<any>(null);

  const { isBlurEnabled, toggleBlur, blurredStream, isLoading: isBlurLoading } = useBackgroundBlur();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const userRole = localStorage.getItem('userRole');
  const isHost = initialRoom?.hostId === userId || userRole === 'leader' || searchParams.get("host") === "true";


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
    
    // Mostra localmente
    setFloatEmojis(prev => [...prev, { id, emoji, x }]);
    setTileEmojis(prev => [...prev, { uid: "local", emoji }]);
    setTimeout(() => {
      setTileEmojis(prev => prev.filter(e => !(e.uid === "local" && e.emoji === emoji)));
    }, 1200);

    // Envia para o servidor com uid do Agora
    socketRef.current?.emit("reaction", {
      emoji,
      uid: localUidRef.current || "local",
    });

    setShowReactions(false);
  }, []);

  // Handler para reações recebidas via socket
  useEffect(() => {
    if (!socketRef.current) return;
    const socket = socketRef.current;

    const onReaction = (data: any) => {
      const emoji = typeof data === "string" ? data : data.emoji;
      const uid = typeof data === "object" ? data.uid : null;

      // Mostra flutuando na tela
      const floatId = String(++floatIdRef.current);
      const x = 40 + Math.random() * (window.innerWidth - 80);
      setFloatEmojis(prev => [...prev, { id: floatId, emoji, x }]);

      // Mostra no tile do participante
      if (uid) {
        setTileEmojis(prev => [...prev, { uid, emoji }]);
        setTimeout(() => {
          setTileEmojis(prev => prev.filter(e => !(String(e.uid) === String(uid) && e.emoji === emoji)));
        }, 1200);
      }
    };

    socket.on("reaction", onReaction);
    return () => { socket.off("reaction", onReaction); };
  }, [socketRef.current]);

  // ── Agora + Socket init ──
  useEffect(() => {
    if (!userName) { navigate(`/?roomId=${roomName}`); return; }

    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    setSocketObj(socket);

    // PWA Banner Logic
    const hasSeenBanner = localStorage.getItem('dmeet_pwa_banner');
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (isIOS && !isStandalone && !hasSeenBanner) {
      setShowPWABanner(true);
    }

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

    client.on("user-joined", (user) => {
      const name = uidNameMap.current.get(user.uid) || "Participante";
      setRemoteUsers(prev => {
        const exists = prev.find(u => String(u.uid) === String(user.uid));
        if (exists) return prev;
        return [...prev, { uid: user.uid, name }];
      });
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

    // ── Room presence and host controls ──
    socket.on('room:participantJoined', ({ participant }: any) => {
      setParticipants(prev => {
        const exists = prev.find(p => p.userId === participant.userId);
        if (exists) return prev;
        return [...prev, participant];
      });
    });

    socket.on('room:participantLeft', ({ userId: leftId }: any) => {
      setParticipants(prev => prev.filter(p => p.userId !== leftId));
    });

    socket.on('room:synced', ({ participants: synced }: any) => {
      setParticipants(synced);
    });

    socket.on("user-name", (agoraUid: string | number, name: string) => {
      uidNameMap.current.set(agoraUid, name);
      setRemoteUsers(prev => prev.map(u => 
        String(u.uid) === String(agoraUid) ? { ...u, name } : u
      ));
    });

    socket.on('mute-all', () => {
      if (micOn) {
        localAudioTrackRef.current?.setEnabled(false);
        setMicOn(false);
        toast.error("O administrador mutou todos os participantes", {
          duration: 4000,
          position: 'top-center',
          style: { background: '#333', color: '#fff', borderRadius: '10px' }
        });
      }
    });

    socket.on('room:mutedByHost', ({ muted, all, userId: targetId }: any) => {
      if (all) {
        setAllMuted(muted);
        if (muted) {
          localAudioTrackRef.current?.setEnabled(false);
          setMicOn(false);
        } else {
          localAudioTrackRef.current?.setEnabled(true);
          setMicOn(true);
        }
      } else if (targetId === userId) {
        if (muted) {
          localAudioTrackRef.current?.setEnabled(false);
          setMicOn(false);
        } else {
          localAudioTrackRef.current?.setEnabled(true);
          setMicOn(true);
        }
        setMutedParticipants(prev =>
          muted ? (prev.includes(userId) ? prev : [...prev, userId]) : prev.filter(id => id !== userId)
        );
      } else {
        setMutedParticipants(prev =>
          muted ? (prev.includes(targetId) ? prev : [...prev, targetId]) : prev.filter(id => id !== targetId)
        );
      }
    });

    socket.on('room:videoDisabledByHost', ({ disabled, all, userId: targetId }) => {
      if (all) {
        setAllVideoDisabled(disabled);
        if (disabled) {
          localVideoTrackRef.current?.setEnabled(false);
        } else {
          localVideoTrackRef.current?.setEnabled(true);
          // Reativa e reaplica o vídeo no container após reativar
          setTimeout(() => {
            if (localVideoContainerRef.current && localVideoTrackRef.current) {
              const existing = localVideoContainerRef.current.querySelector('video');
              if (!existing) {
                localVideoTrackRef.current.play(localVideoContainerRef.current);
              }
            }
          }, 300);
        }
        setVideoOn(!disabled);
      } else if (targetId === userId) {
        if (disabled) {
          localVideoTrackRef.current?.setEnabled(false);
        } else {
          localVideoTrackRef.current?.setEnabled(true);
          setTimeout(() => {
            if (localVideoContainerRef.current && localVideoTrackRef.current) {
              const existing = localVideoContainerRef.current.querySelector('video');
              if (!existing) {
                localVideoTrackRef.current.play(localVideoContainerRef.current);
              }
            }
          }, 300);
        }
        setVideoOn(!disabled);
      }
    });

    // Announce self to room

    const init = async () => {
      // Fullscreen request
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => { });
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        (document.documentElement as any).webkitRequestFullscreen();
      }

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
        originalVideoTrackRef.current = videoTrack.getMediaStreamTrack();

        const uid = Math.floor(Math.random() * 100000);
        localUidRef.current = uid;

        await client.join(AGORA_APP_ID, roomName!, null, uid);
        await client.publish([audioTrack, videoTrack]);

        // Anuncia nome para todos já conectados
        socket.emit("announce-name", roomName, uid, userName);

        // Solicita nomes de quem já está na sala
        socket.emit("room:join", { code: roomName, userId, userName });
        clearTimeout(failTO);

        // Play local video
        if (localVideoContainerRef.current && !localVideoContainerRef.current.querySelector("video")) {
          videoTrack.play(localVideoContainerRef.current);
          setTimeout(() => { if (localVideoContainerRef.current) fixAgoraSize(localVideoContainerRef.current); }, 100);
          const obs = new ResizeObserver(() => { if (localVideoContainerRef.current) fixAgoraSize(localVideoContainerRef.current); });
          obs.observe(localVideoContainerRef.current);
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
  }, [roomName, userId, userName]);

  useEffect(() => {
    const remoteParticipants = participants.filter(p => p.userId !== userId);
    if (remoteParticipants.length === 0) return;

    setRemoteUsers(prev => {
      const updated = [...prev];
      remoteParticipants.forEach(p => {
        const exists = updated.find(u =>
          String(u.uid) === String(p.userId) || u.name === p.userName
        );
        if (!exists) {
          updated.push({ uid: p.userId, name: p.userName });
        }
      });
      return updated;
    });
  }, [participants]);

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
    navigate("/");
  };

  const toggleBlurAI = async () => {
    if (!localVideoTrackRef.current) return;
    
    // Pega o stream nativo da track do Agora para o MediaPipe
    const mediaStreamTrack = localVideoTrackRef.current.getMediaStreamTrack();
    const stream = new MediaStream([mediaStreamTrack]);
    
    await toggleBlur(stream);
  };

  // Efeito para trocar a track do Agora quando o blur fornecer um novo stream
  useEffect(() => {
    if (isBlurEnabled && blurredStream && localVideoTrackRef.current) {
        const newTrack = blurredStream.getVideoTracks()[0];
        localVideoTrackRef.current.replaceTrack(newTrack).catch(e => console.warn("Erro ao trocar track por blur:", e));
    } else if (!isBlurEnabled && originalVideoTrackRef.current && localVideoTrackRef.current) {
        localVideoTrackRef.current.replaceTrack(originalVideoTrackRef.current).catch(e => console.warn("Erro ao restaurar track original:", e));
    }
  }, [isBlurEnabled, blurredStream]);

  const handleMuteAllUnified = () => {
    socketRef.current?.emit('mute-all', { roomId: roomName });
  };

  const handleMuteAll = () => {
    const next = !allMuted;
    setAllMuted(next);
    socketRef.current?.emit('host:muteAll', { 
      code: roomName, 
      muted: next 
    });
  };

  const handleMuteOne = (targetUserId: string) => {
    const isMuted = mutedParticipants.includes(targetUserId);
    const next = !isMuted;
    setMutedParticipants(prev => 
      next ? [...prev, targetUserId] : prev.filter(id => id !== targetUserId)
    );
    socketRef.current?.emit('host:muteOne', { 
      code: roomName, 
      userId: targetUserId, 
      muted: next 
    });
  };

  const handleDisableVideoAll = () => {
    const next = !allVideoDisabled;
    setAllVideoDisabled(next);
    socketRef.current?.emit('host:disableVideoAll', { 
      code: roomName, 
      disabled: next 
    });
  };

  const handleDisableVideoOne = (targetUserId: string) => {
    const isDisabled = videoDisabledParticipants.includes(targetUserId);
    const next = !isDisabled;
    setVideoDisabledParticipants(prev =>
      next ? [...prev, targetUserId] : prev.filter(id => id !== targetUserId)
    );
    socketRef.current?.emit('host:disableVideoOne', { 
      code: roomName, 
      userId: targetUserId, 
      disabled: next 
    });
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

  const visibleRemote = sortedRemote;
  const extraCount = 0;

  // PiP manual management for Agora Video element
  useEffect(() => {
    const handleVisibilityChange = async () => {
      const vid = localVideoContainerRef.current?.querySelector('video');
      if (document.hidden && vid && document.pictureInPictureEnabled && vid.readyState >= 2) {
        try { if (vid !== document.pictureInPictureElement) await vid.requestPictureInPicture(); } catch (e) { console.warn('PiP:', e); }
      } else if (!document.hidden && document.pictureInPictureElement) {
        try { await document.exitPictureInPicture(); } catch (e) { }
      }
    };
    const handleBlur = async () => {
      const vid = localVideoContainerRef.current?.querySelector('video');
      if (vid && document.pictureInPictureEnabled && vid.readyState >= 2) {
        try { if (vid !== document.pictureInPictureElement) await vid.requestPictureInPicture(); } catch (e) { console.warn('PiP:', e); }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // ── Stacked avatars for nav bar (up to 3 remote + local) ──
  const avatarList = [userName, ...sortedRemote.slice(0, 2).map(u => u.name)];
  const groupName = sortedRemote.length > 0
    ? (sortedRemote.length === 1 ? sortedRemote[0].name : `${sortedRemote[0].name.split(" ")[0]} + ${sortedRemote.length - 1}`)
    : userName;

  const handRaisedNames = [
    ...(maoLevantada ? [userName] : []),
    ...maosRemotas.map(m => {
      const u = remoteUsers.find(r => String(r.uid) === String(m.id));
      return u?.name || "Participante";
    }),
  ];



  const remoteUsersMap = remoteUsers.reduce((acc: any, u: any) => {
    acc[String(u.uid)] = u;
    return acc;
  }, {});

  const localId = String(localUidRef.current || "local");

  const allParticipantsForGrid = [
    { userId: localId, userName },
    ...remoteUsers.map(u => ({ userId: String(u.uid), userName: u.name })),
  ];

  // Condição para exibir tela de espera (Google Meet style)
  const isAlone = remoteUsers.length === 0 &&
    participants.filter(p => p.userId !== userId).length === 0;

  if (isAlone) {
    return (
      <div style={{ width: '100vw', height: '100vh' }}>
        <WaitingScreen
          meetLink={`${window.location.origin}/room/${roomName}`}
          onEndCall={leaveCall}
          isMuted={!micOn}
          isCameraOff={!videoOn}
          onToggleMic={toggleMic}
          onToggleCam={toggleVideo}
          localVideoTrack={localVideoTrackRef.current}
        />
      </div>
    );
  }

  const enterFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(err => console.warn(err));
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          (document.documentElement as any).webkitRequestFullscreen();
        } else if ((document.documentElement as any).msRequestFullscreen) {
          (document.documentElement as any).msRequestFullscreen();
        }
      }
    } catch (e) {
      console.warn("Fullscreen API failed", e);
    }
  };

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
      <div
        style={{
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

          {/* Group name / Leader info */}
          <div
            onClick={() => isHost && setShowModeratorPanel(p => !p)}
            style={{ flex: 1, marginLeft: 28, cursor: isHost ? 'pointer' : 'default' }}
          >
            <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#E9EDEF", display: 'flex', alignItems: 'center', gap: 6 }}>
              {groupName} {isHost && <span style={{ fontSize: '0.7rem', color: '#FF7A00' }}>▼</span>}
            </div>
            <div style={{ fontSize: "0.65rem", color: "#8696A0" }}>
              {remoteUsers.length} participante{remoteUsers.length !== 1 ? "s" : ""}
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
        <div style={{ flex: 1, padding: '8px', overflow: 'hidden' }}>
          <VideoGrid
            userId={localId}
            participants={allParticipantsForGrid}
            remoteUsers={remoteUsersMap}
            localVideoTrack={localVideoTrackRef.current}
            localVideoRef={localVideoContainerRef}
            bgBlur={bgBlur}
          />
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

        {/* ── Controles ── */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 12, padding: "16px 24px",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
          background: "rgba(28,28,30,0.95)",
          backdropFilter: "blur(20px)",
          borderRadius: "24px 24px 0 0",
          zIndex: 100,
        }}>
          <button onClick={toggleVideo} style={{ width:56, height:56, borderRadius:16, background: videoOn ? "#3A3A3C" : "#ea4335", color:"#fff", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <IconCamera off={!videoOn} />
          </button>
          <button onClick={toggleMic} style={{ width:56, height:56, borderRadius:16, background: micOn ? "#3A3A3C" : "#ea4335", color:"#fff", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <IconMic muted={!micOn} />
          </button>
          
          <button onClick={() => { setShowReactions(p => !p); setShowMenu(false); }} style={{ width:56, height:56, borderRadius:16, background: showReactions ? "#BBDEFB" : "#3A3A3C", color: showReactions ? "#1565C0" : "#fff", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <IconEmoji />
          </button>
          
          <button
            onPointerDown={() => { setShowParticipants(p => !p); setShowMenu(false); setActivitiesOpen(false); }}
            style={{
              width: 56, height: 56, borderRadius: 16, background: showParticipants ? '#BBDEFB' : '#3A3A3C', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', 
              position: 'relative', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', userSelect: 'none', outline: 'none',
              color: showParticipants ? '#1565C0' : '#ffffff'
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <div style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 999, background: '#2563EB', color: '#fff', fontSize: '0.65rem', fontWeight: 700, fontFamily: 'system-ui', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid #2C2C2E' }}>
              {remoteUsers.length}
            </div>
          </button>

          <button onClick={() => { setShowMenu(p => !p); setActivitiesOpen(false); setShowParticipants(false); }} style={{ width:56, height:56, borderRadius:16, background: showMenu || activitiesOpen ? "#4A4A4C" : "#3A3A3C", color:"#fff", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <IconDots />
          </button>

          <button onClick={() => { setActivitiesOpen(p => !p); setShowMenu(false); }} style={{ width:56, height:56, borderRadius:16, background: activitiesOpen ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)", color:"#fff", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
             <span style={{ fontSize: "1.4rem" }}>✨</span>
          </button>

          <div style={{ width:1, height:38, background:"rgba(255,255,255,0.12)", margin:"0 4px" }} />
          <button onClick={leaveCall} style={{ width:76, height:56, borderRadius:999, background:"#D32F2F", color:"#fff", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 18px rgba(211,47,47,0.5)" }}>
            <IconEndCall />
          </button>
        </div>

          {/* PAINEL DE PARTICIPANTES */}
          <AnimatePresence>
            {showParticipants && (
              <>
                {/* Overlay para fechar ao clicar fora */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowParticipants(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    zIndex: 199,
                  }}
                />

                <motion.div
                  initial={{ translateY: '100%' }}
                  animate={{ translateY: 0 }}
                  exit={{ translateY: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '75vh',
                    background: '#1C1C1E',
                    borderRadius: '24px 24px 0 0',
                    zIndex: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 -12px 48px rgba(0,0,0,0.6)',
                    overflow: 'hidden'
                  }}
                >
                  {/* Handle de arrastar */}
                  <div style={{
                    width: '40px',
                    height: '4px',
                    background: 'rgba(255,255,255,0.2)',
                    borderRadius: '999px',
                    margin: '12px auto 6px',
                    flexShrink: 0,
                  }} />

                  {/* Header do painel */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    flexShrink: 0,
                  }}>
                    <div>
                      <span style={{
                        color: '#fff',
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        fontFamily: 'system-ui',
                      }}>
                        Participantes
                      </span>
                      <span style={{
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: '0.85rem',
                        fontFamily: 'system-ui',
                        marginLeft: '10px',
                      }}>
                        {remoteUsers.length}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowParticipants(false)}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        color: '#fff',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    >✕</button>
                  </div>

                  <div style={{ padding: '0 20px 20px' }}>
                    {isHost && (
                      <button
                        onClick={handleMuteAllUnified}
                        style={{
                          width: '100%',
                          padding: '12px',
                          background: '#ea4335',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '12px',
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          marginTop: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        <IconMic muted={true} /> Mutar todos
                      </button>
                    )}
                  </div>

                  {/* BOTÃO "MUTAR TODOS" — APENAS PARA O HOST */}
                  {isHost && (
                    <div style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid rgba(255,255,255,0.07)',
                      flexShrink: 0,
                    }}>
                      <button
                        onClick={handleMuteAll}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                          padding: '14px 20px',
                          background: allMuted
                            ? 'rgba(239, 68, 68, 0.12)'
                            : 'rgba(37, 99, 235, 0.12)',
                          border: allMuted
                            ? '1.5px solid rgba(239, 68, 68, 0.4)'
                            : '1.5px solid rgba(37, 99, 235, 0.4)',
                          borderRadius: '16px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(0.99)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24"
                          fill="none"
                          stroke={allMuted ? '#EF4444' : '#60A5FA'}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        >
                          {allMuted ? (
                            <>
                              <line x1="1" y1="1" x2="23" y2="23" />
                              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                              <line x1="12" y1="19" x2="12" y2="23" />
                            </>
                          ) : (
                            <>
                              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                              <line x1="12" y1="19" x2="12" y2="23" />
                            </>
                          )}
                        </svg>

                        <span style={{
                          color: allMuted ? '#EF4444' : '#60A5FA',
                          fontSize: '0.95rem',
                          fontWeight: '700',
                          fontFamily: 'system-ui',
                        }}>
                          {allMuted ? 'Desmutar todos' : 'Mutar todos'}
                        </span>
                      </button>

                      {/* Botão Desligar Câmeras Todas */}
                      <button
                        onClick={handleDisableVideoAll}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                          padding: '14px 20px',
                          background: allVideoDisabled ? 'rgba(239, 68, 68, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                          border: allVideoDisabled ? '1.5px solid rgba(239, 68, 68, 0.4)' : '1.5px solid rgba(37, 99, 235, 0.4)',
                          borderRadius: '16px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          marginTop: '8px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(0.99)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={allVideoDisabled ? '#EF4444' : '#60A5FA'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          {allVideoDisabled ? (
                            <>
                              <line x1="1" y1="1" x2="23" y2="23" />
                              <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
                              <path d="M23 7l-7 5 7 5V7z" />
                            </>
                          ) : (
                            <>
                              <path d="M23 7l-7 5 7 5V7z" />
                              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </>
                          )}
                        </svg>

                        <span style={{
                          color: allVideoDisabled ? '#EF4444' : '#60A5FA',
                          fontSize: '0.95rem',
                          fontWeight: '700',
                          fontFamily: 'system-ui',
                        }}>
                          {allVideoDisabled ? 'Reativar Câmeras' : 'Desligar Câmeras'}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* LISTA DE PARTICIPANTES */}
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '8px 0',
                  }}>
                    {participants.map((p) => (
                      <ParticipantRow
                        key={p.userId}
                        participant={p}
                        isLocal={p.userId === userId}
                        isHost={p.userId === initialRoom?.hostId}
                        isMutedByHost={mutedParticipants.includes(p.userId)}
                        isCameraOff={videoDisabledParticipants.includes(p.userId)}
                        canMute={isHost && p.userId !== userId}
                        onMuteOne={() => handleMuteOne(p.userId)}
                        canDisableVideo={isHost && p.userId !== userId}
                        onDisableVideoOne={() => handleDisableVideoOne(p.userId)}
                      />
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

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
              maxHeight: '90vh',
              overflowY: 'auto'
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

                {/* Device settings (Moved from Top Bar) */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{
                    flex: 1, padding: "12px 4px",
                    background: "#2A3942", border: "none", borderRadius: 12,
                    cursor: "pointer", display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 6,
                  }}>
                    <span style={{ fontSize: "1.4rem", color: "#E9EDEF", display: "flex", alignItems: "center", justifyContent: "center", height: "30px" }}><IcFlip /></span>
                    <span style={{ fontSize: "0.62rem", color: "#8696A0", textAlign: "center", lineHeight: 1.3 }}>Virar Câmera</span>
                  </button>
                  <button style={{
                    flex: 1, padding: "12px 4px",
                    background: "#2A3942", border: "none", borderRadius: 12,
                    cursor: "pointer", display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 6,
                  }}>
                    <span style={{ fontSize: "1.4rem", color: "#E9EDEF", display: "flex", alignItems: "center", justifyContent: "center", height: "30px" }}><IcSpeaker /></span>
                    <span style={{ fontSize: "0.62rem", color: "#8696A0", textAlign: "center", lineHeight: 1.3 }}>Saída de Áudio</span>
                  </button>
                </div>

                {/* Background Blur */}
                  <button onClick={() => { toggleBlurAI(); setShowMenu(false); }} style={{
                    width: '100%',
                    background: isBlurEnabled ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.08)',
                    border: isBlurEnabled ? '1px solid #2563eb' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 14,
                    padding: '14px 18px',
                    color: '#fff',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    textAlign: 'left',
                    opacity: isBlurLoading ? 0.7 : 1,
                  }}>
                    <span style={{ fontSize: '1.3rem' }}>{isBlurLoading ? '⏳' : '🌫️'}</span>
                    {isBlurEnabled ? 'Remover desfoque' : (isBlurLoading ? 'Carregando IA...' : 'Desfocar fundo')}
                  </button>
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
                <div style={{ fontSize: "0.7rem", color: "#8696A0" }}>{remoteUsers.length} participante{remoteUsers.length !== 1 ? "s" : ""}</div>
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
          roomId={roomName}
          userName={userName}
          socket={socketObj}
          isHost={isHost}
          userId={userId}
        />

        {/* ── PWA Banner ── */}
        <AnimatePresence>
          {showPWABanner && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              style={{
                position: 'fixed', bottom: 100, left: 20, right: 20,
                background: '#2563EB', color: '#fff', padding: '16px',
                borderRadius: '16px', zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                display: 'flex', flexDirection: 'column', gap: 10
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>✨ Melhor experiência</span>
                <button onClick={() => { setShowPWABanner(false); localStorage.setItem('dmeet_pwa_banner', 'true'); }} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem' }}>✕</button>
              </div>
              <p style={{ fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>
                Para tela cheia: toque em <span style={{ fontSize: '1.1rem' }}>📤</span> e depois em <b>"Adicionar à Tela de Início"</b>.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Moderator Quick Panel ── */}
        <AnimatePresence>
          {showModeratorPanel && (
            <>
              <div onClick={() => setShowModeratorPanel(false)} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                style={{
                  position: 'fixed', top: 80, right: 20,
                  background: '#1F2C34', borderRadius: '16px', padding: '12px',
                  zIndex: 901, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  width: '240px', display: 'flex', flexDirection: 'column', gap: 8
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8696A0', padding: '4px 8px' }}>PAINEL DO LÍDER</div>
                <button onClick={handleMuteAll} style={{
                  width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)',
                  border: '1.5px solid rgba(239,68,68,0.3)', color: '#EF4444', fontWeight: 600, fontSize: '0.85rem',
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer'
                }}>
                  <IconMic muted={true} /> Mutar todos
                </button>
                <button onClick={handleDisableVideoAll} style={{
                  width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)',
                  border: '1.5px solid rgba(239,68,68,0.3)', color: '#EF4444', fontWeight: 600, fontSize: '0.85rem',
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer'
                }}>
                  <IconCamera off={true} /> Desligar câmeras
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      <Toaster />
    </>
  );
}

function ParticipantRow({
  participant, isLocal, isHost, isMutedByHost, isCameraOff, canMute, onMuteOne, canDisableVideo, onDisableVideoOne
}: any) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 20px',
        gap: '12px',
        background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {/* Avatar circular com inicial */}
      <div style={{
        width: '38px',
        height: '38px',
        borderRadius: '50%',
        background: participant.color || '#2563EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: '0.9rem',
        fontWeight: '700',
        fontFamily: 'system-ui',
        flexShrink: 0,
        position: 'relative',
      }}>
        {participant.userName?.[0]?.toUpperCase() || '?'}

        {/* Coroa para o host */}
        {isHost && (
          <div style={{
            position: 'absolute',
            top: '-6px',
            right: '-4px',
            fontSize: '0.7rem',
          }}>👑</div>
        )}
      </div>

      {/* Nome */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: '#fff',
          fontSize: '0.88rem',
          fontWeight: '500',
          fontFamily: 'system-ui',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {participant.userName}
          {isLocal && (
            <span style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.75rem',
              marginLeft: '6px',
            }}>(você)</span>
          )}
        </div>
        {isHost && (
          <div style={{
            color: '#60A5FA',
            fontSize: '0.7rem',
            fontFamily: 'system-ui',
          }}>Líder</div>
        )}
        {isMutedByHost && (
          <div style={{
            color: '#EF4444',
            fontSize: '0.7rem',
            fontFamily: 'system-ui',
          }}>Silenciado pelo líder</div>
        )}
      </div>

      {/* Ícone mic status + botões individuais host */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Indicador Cam */}
        {(isCameraOff || !participant.videoOn) && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
            <path d="M23 7l-7 5 7 5V7z" />
          </svg>
        )}
        {/* Indicador mic */}
        <svg width="16" height="16" viewBox="0 0 24 24"
          fill="none"
          stroke={isMutedByHost || participant.isMuted
            ? '#EF4444' : 'rgba(255,255,255,0.35)'}
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          {isMutedByHost || participant.isMuted ? (
            <>
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </>
          ) : (
            <>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </>
          )}
        </svg>

        {/* Botões individuais — só aparece no hover E só para o host */}
        {canMute && hovered && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              title="Mutar/Desmutar"
              onClick={onMuteOne}
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px',
                padding: '4px 8px',
                color: '#EF4444',
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
            </button>
            {canDisableVideo && (
              <button
                title="Desligar Câmera"
                onClick={onDisableVideoOne}
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '8px',
                  padding: '4px 8px',
                  color: '#EF4444',
                  cursor: 'pointer',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
                  <path d="M23 7l-7 5 7 5V7z" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
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
      onPointerCancel={() => setPressed(false)}
      style={{
        width: "62px",
        height: "62px",
        borderRadius: "20px",
        background: active
          ? activeBg
          : pressed ? "#525254" : defaultBg,
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: active ? activeColor : defaultColor,
        transform: pressed ? "scale(0.88)" : "scale(1)",
        transition: "transform 0.08s ease, background 0.1s ease, color 0.1s ease",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
        userSelect: "none",
        flexShrink: 0,
        outline: "none",
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
