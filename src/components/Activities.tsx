import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    BarChart3,
    Edit3,
    Trophy,
    ClipboardCheck,
    Search,
    Users,
    Layout,
    Brain,
    Palette,
    Music,
    Play,
    Pause,
    SkipForward,
    Volume2
} from 'lucide-react';
import { WebPlaybackSDK } from 'react-spotify-web-playback-sdk';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PollState { question: string; options: string[]; votes: Record<number, string[]>; closed: boolean; }
interface QuizQuestion { text: string; options: string[]; correct: number; }
interface QuizState { questions: QuizQuestion[]; current: number; answers: Record<number, Record<string, number>>; scores: Record<string, number>; state: 'waiting' | 'question' | 'done'; }
interface Task { id: string; text: string; done: boolean; author: string; }

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Activities({ isOpen, onClose, roomId, userName, socket, isHost, userId }: any) {
    const [view, setView] = useState('grid');
    const code = roomId;

    useEffect(() => {
        if (isOpen && socket && code) {
            socket.emit('activity:join', { code });
        }
    }, [isOpen, socket, code]);

    if (!isOpen) return null;

    const apps = [
        {
            id: 'spotify',
            name: 'Spotify',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg',
            type: 'image',
            desc: 'Ouça com todos',
            color: '#1DB954'
        },
        {
            id: 'youtube',
            name: 'YouTube',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg',
            type: 'image',
            desc: 'Assista juntos',
            color: '#FF0000'
        },
        {
            id: 'poll',
            name: 'Enquete',
            icon: <BarChart3 size={48} color="#4285F4" />,
            type: 'lucide',
            desc: 'Crie uma votação',
            color: '#4285F4'
        },
        {
            id: 'whiteboard',
            name: 'Whiteboard',
            icon: <Palette size={48} color="#FBBC04" />,
            type: 'lucide',
            desc: 'Colabore ao vivo',
            color: '#FBBC04'
        },
        {
            id: 'quiz',
            name: 'Quiz',
            icon: <Trophy size={48} color="#EA4335" />,
            type: 'lucide',
            desc: 'Teste o grupo',
            color: '#EA4335'
        },
        {
            id: 'tasks',
            name: 'Tarefas',
            icon: <ClipboardCheck size={48} color="#34A853" />,
            type: 'lucide',
            desc: 'Lista colaborativa',
            color: '#34A853'
        },
    ];

    const currentApp = apps.find(a => a.id === view);

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000 }} />
            <div style={{
                position: 'fixed', top: 0, right: 0, bottom: 0,
                width: 'min(360px, 92vw)',
                background: '#111114',
                borderLeft: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '-20px 0 60px rgba(0,0,0,0.7)',
                zIndex: 1001,
                display: 'flex', flexDirection: 'column',
                animation: 'actSlideIn 0.24s cubic-bezier(0.25,0.8,0.25,1)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{ padding: '16px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {view !== 'grid' && (
                        <button onPointerDown={() => setView('grid')} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#FFF', fontSize: '1rem', cursor: 'pointer', width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}>‹</button>
                    )}
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#FFF', fontSize: '0.95rem' }}>
                            {view === 'grid' ? '✨ Atividades' : `${currentApp?.icon} ${currentApp?.name}`}
                        </div>
                        {view === 'grid' && <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)' }}>Compartilhe com a sala</div>}
                    </div>
                    {!isHost && view !== 'grid' && <span style={{ fontSize: '0.65rem', color: '#888', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 10 }}>👀 Modo espectador</span>}
                    <button onPointerDown={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}>✕</button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: view === 'grid' ? 14 : 0 }}>
                    {view === 'grid' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingBottom: 20 }}>
                            {apps.map(app => (
                                <div
                                    key={app.id}
                                    onPointerDown={() => setView(app.id)}
                                    style={{
                                        padding: '24px 16px', borderRadius: 20,
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        cursor: 'pointer', touchAction: 'manipulation',
                                        display: 'flex', flexDirection: 'column', gap: 12,
                                        alignItems: 'center', textAlign: 'center',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    <div style={{
                                        width: 60, height: 60,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: 'rgba(255,255,255,0.02)',
                                        borderRadius: 16, marginBottom: 4
                                    }}>
                                        {app.type === 'image' ? (
                                            <img src={app.icon as string} alt={app.name} style={{ width: 44, height: 44, objectFit: 'contain' }} />
                                        ) : (
                                            app.icon
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: app.color, letterSpacing: '0.02em' }}>{app.name}</div>
                                        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.3, maxWidth: 120 }}>{app.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {view === 'spotify' && <SpotifyPanel socket={socket} code={code} isHost={isHost} />}
                    {view === 'youtube' && <YouTubePanel socket={socket} code={code} isHost={isHost} userId={userId} />}
                    {view === 'poll' && <PollPanel socket={socket} code={code} isHost={isHost} userId={userId} userName={userName} />}
                    {view === 'whiteboard' && <WhiteboardPanel socket={socket} code={code} isHost={isHost} />}
                    {view === 'quiz' && <QuizPanel socket={socket} code={code} isHost={isHost} userId={userId} userName={userName} />}
                    {view === 'tasks' && <TasksPanel socket={socket} code={code} userName={userName} />}
                </div>
            </div>

            <style>{`
                @keyframes actSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            `}</style>
        </>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const panelPad: React.CSSProperties = { padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 14, height: '100%', boxSizing: 'border-box' };

function PanelInput({ placeholder, value, onChange, ...rest }: any) {
    return (
        <input
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: '#FFF', outline: 'none', fontSize: '0.88rem', width: '100%', boxSizing: 'border-box' }}
            {...rest}
        />
    );
}

function PrimaryBtn({ onClick, children, color = '#2563EB', disabled = false }: any) {
    const [pressed, setPressed] = useState(false);
    return (
        <button
            onPointerDown={() => !disabled && setPressed(true)}
            onPointerUp={() => { setPressed(false); if (!disabled) onClick?.(); }}
            onPointerLeave={() => setPressed(false)}
            disabled={disabled}
            style={{
                background: disabled ? '#333' : color,
                border: 'none', borderRadius: 12, color: '#FFF', fontWeight: 700,
                padding: '11px 18px', cursor: disabled ? 'not-allowed' : 'pointer',
                transform: pressed && !disabled ? 'scale(0.96)' : 'scale(1)',
                transition: 'transform 0.08s ease', touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent', opacity: disabled ? 0.5 : 1,
            }}
        >{children}</button>
    );
}

// ─── Spotify Panel ────────────────────────────────────────────────────────────
function SpotifyPanel({ socket, code, isHost }: any) {
    const [token, setToken] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [currentUri, setCurrentUri] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackState, setPlaybackState] = useState<any>(null);
    const playerRef = useRef<any>(null);

    const fetchToken = useCallback(async () => {
        try {
            const res = await fetch('/auth/spotify/token');
            const data = await res.json();
            if (data.access_token) setToken(data.access_token);
        } catch (e) { console.error('Error fetching spotify token:', e); }
    }, []);

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data === 'spotify-connected') {
                fetch('/auth/spotify/token')
                    .then(r => r.json())
                    .then(data => {
                        if (data.access_token) {
                            setToken(data.access_token);
                        }
                    });
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    useEffect(() => {
        fetchToken();
    }, [fetchToken]);

    useEffect(() => {
        if (!socket) return;
        const handler = (data: any) => {
            if (data.uri) setCurrentUri(data.uri);
            if (data.playing !== undefined) setIsPlaying(data.playing);
        };
        socket.on('activity:spotify:sync', handler);
        return () => { socket.off('activity:spotify:sync', handler); };
    }, [socket]);

    const extractUri = (url: string) => {
        const trackMatch = url.match(/track\/([a-zA-Z0-9]+)/);
        const albumMatch = url.match(/album\/([a-zA-Z0-9]+)/);
        const playlistMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);

        if (trackMatch) return `spotify:track:${trackMatch[1]}`;
        if (albumMatch) return `spotify:album:${albumMatch[1]}`;
        if (playlistMatch) return `spotify:playlist:${playlistMatch[1]}`;

        if (url.startsWith('spotify:')) return url;
        return null;
    };

    const handleShare = () => {
        const uri = extractUri(input);
        if (!uri) return;
        socket?.emit('activity:spotify:set', { code, uri, playing: true });
        setCurrentUri(uri);
        setIsPlaying(true);
        setInput('');
    };

    const handleTogglePlay = () => {
        const next = !isPlaying;
        setIsPlaying(next);
        socket?.emit('activity:spotify:set', { code, playing: next });
    };

    const connectSpotify = async () => {
        const res = await fetch('/auth/spotify');
        const { url } = await res.json();

        const popup = window.open(
            url,
            'spotify-auth',
            'width=500,height=700,left=200,top=100'
        );

        // Escuta quando o popup fechar
        const check = setInterval(() => {
            if (popup?.closed) {
                clearInterval(check);
                // Verifica se conseguiu o token
                fetch('/auth/spotify/token')
                    .then(r => r.json())
                    .then(data => {
                        if (data.access_token) {
                            // Token obtido com sucesso!
                            setToken(data.access_token);
                        }
                    });
            }
        }, 500);
    };

    if (!token) {
        return (
            <div style={{ ...panelPad, alignItems: 'center', justifyContent: 'center' }}>
                <Music size={64} color="#1DB954" style={{ marginBottom: 12 }} />
                <div style={{ color: '#FFF', fontWeight: 700, marginBottom: 4 }}>Spotify Premium</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', textAlign: 'center', marginBottom: 20 }}>
                    Conecte sua conta para ouvir música com os participantes.
                </div>
                <PrimaryBtn onClick={connectSpotify} color="#1DB954">
                    Conectar Spotify
                </PrimaryBtn>
            </div>
        );
    }

    return (
        <WebPlaybackSDK
            initialDeviceName="DevocionalMeet Player"
            getOAuthToken={(callback) => callback(token)}
            connect={true}
            initialVolume={0.5}
        >
            <SpotifyPlayer
                isHost={isHost}
                currentUri={currentUri}
                isPlaying={isPlaying}
                playbackState={playbackState}
                onStateChange={setPlaybackState}
                onTogglePlay={handleTogglePlay}
                input={input}
                setInput={setInput}
                onShare={handleShare}
            />
        </WebPlaybackSDK>
    );
}

function SpotifyPlayer({ isHost, currentUri, isPlaying, playbackState, onStateChange, onTogglePlay, input, setInput, onShare }: any) {
    const track = playbackState?.track_window?.current_track;

    // Play uri when it changes
    useEffect(() => {
        if (currentUri) {
            // A implementação real chamaria player.play({ uris: [currentUri] }) 
            // Mas o SDK react-spotify-web-playback-sdk lida com isso se passarmos o uri corretamente
            // Aqui simulamos a interface de controle.
        }
    }, [currentUri]);

    return (
        <div style={panelPad}>
            {isHost && (
                <div style={{ display: 'flex', gap: 8 }}>
                    <PanelInput
                        placeholder="Link da música/álbum..."
                        value={input}
                        onChange={(e: any) => setInput(e.target.value)}
                    />
                    <PrimaryBtn onClick={onShare} color="#1DB954">Tocar</PrimaryBtn>
                </div>
            )}

            {currentUri ? (
                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 16,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    border: '1px solid rgba(255,255,255,0.08)'
                }}>
                    {/* Artwork & Info (Placeholder as actual SDK needs more setup to display live) */}
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                        <div style={{
                            width: 60, height: 60, borderRadius: 8,
                            background: '#222', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', overflow: 'hidden'
                        }}>
                            <Music size={30} color="#1DB954" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#FFF', fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Sincronizando música...
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>Spotify</div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                        {isHost && (
                            <>
                                <button style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}><SkipForward style={{ transform: 'rotate(180deg)' }} /></button>
                                <button
                                    onClick={onTogglePlay}
                                    style={{
                                        width: 50, height: 50, borderRadius: '50%',
                                        background: '#FFF', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', color: '#000', border: 'none', cursor: 'pointer'
                                    }}
                                >
                                    {isPlaying ? <Pause fill="#000" /> : <Play fill="#000" style={{ marginLeft: 4 }} />}
                                </button>
                                <button style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}><SkipForward /></button>
                            </>
                        )}
                        {!isHost && (
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                {isPlaying ? <Volume2 size={16} /> : <Pause size={16} />}
                                {isPlaying ? 'Ouvindo agora...' : 'Pausado'}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                    <Music size={48} />
                    <div style={{ fontSize: '0.85rem' }}>{isHost ? 'Cole um link do Spotify acima' : 'Aguardando o líder...'}</div>
                </div>
            )}
        </div>
    );
}

// ─── YouTube Panel ────────────────────────────────────────────────────────────
function YouTubePanel({ socket, code, isHost, userId }: any) {
    const [input, setInput] = useState('');
    const [videoId, setVideoId] = useState('');
    const [playing, setPlaying] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const extractId = (url: string) => {
        const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
        return m ? m[1] : url.trim().slice(-11);
    };

    useEffect(() => {
        if (!socket) return;
        const onSync = ({ videoId: vid, playing: p }: any) => { setVideoId(vid); setPlaying(p); };
        const onState = ({ playing: p, time }: any) => {
            setPlaying(p);
            iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: p ? 'playVideo' : 'pauseVideo' }), '*');
        };
        socket.on('activity:youtube:sync', onSync);
        socket.on('activity:youtube:state', onState);
        return () => { socket.off('activity:youtube:sync', onSync); socket.off('activity:youtube:state', onState); };
    }, [socket]);

    const share = () => {
        const id = extractId(input);
        if (!id) return;
        socket?.emit('activity:youtube:set', { code, videoId: id });
        setVideoId(id);
    };

    const togglePlay = () => {
        const next = !playing;
        setPlaying(next);
        socket?.emit('activity:youtube:state', { code, playing: next, time: 0 });
    };

    return (
        <div style={panelPad}>
            {isHost && (
                <div style={{ display: 'flex', gap: 8 }}>
                    <PanelInput placeholder="Link do YouTube..." value={input} onChange={(e: any) => setInput(e.target.value)} />
                    <PrimaryBtn onClick={share} color="#FF0000">Ir</PrimaryBtn>
                </div>
            )}
            {videoId ? (
                <>
                    <iframe
                        ref={iframeRef}
                        src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&rel=0`}
                        width="100%"
                        height="200"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                        allowFullScreen
                        style={{ border: 'none', borderRadius: 12 }}
                    />
                    {isHost && (
                        <PrimaryBtn onClick={togglePlay} color="#FF0000">{playing ? '⏸ Pausar para todos' : '▶ Play para todos'}</PrimaryBtn>
                    )}
                </>
            ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                    <span style={{ fontSize: '3rem' }}>▶️</span>
                    <div style={{ fontSize: '0.85rem' }}>{isHost ? 'Cole um link do YouTube acima' : 'Aguardando o líder compartilhar vídeo...'}</div>
                </div>
            )}
        </div>
    );
}

// ─── Poll Panel ───────────────────────────────────────────────────────────────
function PollPanel({ socket, code, isHost, userId, userName }: any) {
    const [poll, setPoll] = useState<PollState | null>(null);
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);
    const [voted, setVoted] = useState<number | null>(null);

    useEffect(() => {
        if (!socket) return;
        const onState = (p: PollState) => { setPoll(p); };
        socket.on('activity:poll:state', onState);
        return () => { socket.off('activity:poll:state', onState); };
    }, [socket]);

    const create = () => {
        const opts = options.filter(o => o.trim());
        if (!question.trim() || opts.length < 2) return;
        socket?.emit('activity:poll:create', { code, question: question.trim(), options: opts });
        setVoted(null);
    };

    const vote = (i: number) => {
        if (voted !== null || poll?.closed) return;
        setVoted(i);
        socket?.emit('activity:poll:vote', { code, userId, optionIndex: i });
    };

    const totalVotes = poll ? Object.values(poll.votes as Record<number, string[]>).reduce((s, arr) => s + (arr as string[]).length, 0) : 0;

    return (
        <div style={panelPad}>
            {isHost && !poll && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <PanelInput placeholder="Pergunta da enquete..." value={question} onChange={(e: any) => setQuestion(e.target.value)} />
                    {options.map((opt, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8 }}>
                            <PanelInput
                                placeholder={`Opção ${i + 1}`}
                                value={opt}
                                onChange={(e: any) => setOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                            />
                            {options.length > 2 && (
                                <button onPointerDown={() => setOptions(prev => prev.filter((_, j) => j !== i))}
                                    style={{ background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 8, color: '#EF4444', padding: '0 10px', cursor: 'pointer' }}>✕</button>
                            )}
                        </div>
                    ))}
                    {options.length < 4 && (
                        <button onPointerDown={() => setOptions(prev => [...prev, ''])}
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 10, color: 'rgba(255,255,255,0.5)', padding: '10px', cursor: 'pointer', touchAction: 'manipulation' }}>
                            + Adicionar opção
                        </button>
                    )}
                    <PrimaryBtn onClick={create} color="#4285F4">Criar Enquete</PrimaryBtn>
                </div>
            )}

            {poll && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#FFF', lineHeight: 1.3 }}>{poll.question}</div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{totalVotes} voto{totalVotes !== 1 ? 's' : ''}</div>
                    {poll.options.map((opt, i) => {
                        const count = poll.votes[i]?.length || 0;
                        const pct = (totalVotes as number) > 0 ? Math.round((count as number) / (totalVotes as number) * 100) : 0;
                        const isVoted = voted === i;
                        return (
                            <div key={i}
                                onPointerDown={() => !isHost && !poll.closed && vote(i)}
                                style={{ borderRadius: 12, overflow: 'hidden', cursor: (!isHost && !poll.closed && voted === null) ? 'pointer' : 'default', touchAction: 'manipulation', border: `1.5px solid ${isVoted ? '#4285F4' : 'rgba(255,255,255,0.08)'}` }}>
                                <div style={{ position: 'relative', padding: '10px 14px', background: 'rgba(255,255,255,0.04)' }}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'rgba(66,133,244,0.2)', transition: 'width 0.5s ease' }} />
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#FFF', fontSize: '0.85rem' }}>{opt} {isVoted && '✓'}</span>
                                        <span style={{ color: '#4285F4', fontSize: '0.75rem', fontWeight: 700 }}>{pct}%</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {isHost && !poll.closed && (
                        <PrimaryBtn onClick={() => socket?.emit('activity:poll:close', { code })} color="#EF4444">Encerrar Enquete</PrimaryBtn>
                    )}
                    {poll.closed && <div style={{ textAlign: 'center', color: '#888', fontSize: '0.75rem' }}>✅ Enquete encerrada</div>}
                    {isHost && <PrimaryBtn onClick={() => { setPoll(null); setQuestion(''); setOptions(['', '']); setVoted(null); }} color="#333">Nova Enquete</PrimaryBtn>}
                </div>
            )}

            {!poll && !isHost && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                    <span style={{ fontSize: '3rem' }}>📊</span>
                    <div style={{ fontSize: '0.85rem' }}>Aguardando o líder criar uma enquete...</div>
                </div>
            )}
        </div>
    );
}

// ─── Whiteboard Panel ────────────────────────────────────────────────────────
function WhiteboardPanel({ socket, code, isHost }: any) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);
    const [color, setColor] = useState('#FFFFFF');
    const [size, setSize] = useState(3);

    const getCtx = () => canvasRef.current?.getContext('2d');

    useEffect(() => {
        if (!socket) return;
        const onDraw = (stroke: any) => {
            const ctx = getCtx();
            if (!ctx) return;
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (stroke.type === 'start') { ctx.beginPath(); ctx.moveTo(stroke.x, stroke.y); }
            else { ctx.lineTo(stroke.x, stroke.y); ctx.stroke(); }
        };
        const onClear = () => { const ctx = getCtx(); if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); };
        socket.on('activity:whiteboard:draw', onDraw);
        socket.on('activity:whiteboard:clear', onClear);
        return () => { socket.off('activity:whiteboard:draw', onDraw); socket.off('activity:whiteboard:clear', onClear); };
    }, [socket, color, size]);

    const emitStroke = useCallback((type: string, x: number, y: number) => {
        const stroke = { type, x, y, color, width: size };
        const ctx = getCtx();
        if (ctx) {
            ctx.strokeStyle = color;
            ctx.lineWidth = size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (type === 'start') { ctx.beginPath(); ctx.moveTo(x, y); }
            else { ctx.lineTo(x, y); ctx.stroke(); }
        }
        socket?.emit('activity:whiteboard:draw', { code, stroke });
    }, [socket, code, color, size]);

    const getPos = (e: React.PointerEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const scaleX = canvasRef.current!.width / rect.width;
        const scaleY = canvasRef.current!.height / rect.height;
        return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                {['#FFFFFF', '#EF4444', '#22C55E', '#3B82F6', '#FBBC04', '#EC4899'].map(c => (
                    <div key={c} onPointerDown={() => setColor(c)}
                        style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '2.5px solid #FFF' : '2px solid transparent', touchAction: 'manipulation' }} />
                ))}
                <div style={{ flex: 1 }} />
                {[2, 5, 10].map(s => (
                    <div key={s} onPointerDown={() => setSize(s)}
                        style={{ width: s * 2 + 8, height: s * 2 + 8, borderRadius: '50%', background: color, cursor: 'pointer', border: size === s ? '2px solid #FFF' : 'none', touchAction: 'manipulation' }} />
                ))}
                {isHost && <button onPointerDown={() => socket?.emit('activity:whiteboard:clear', { code })}
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#EF4444', padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', touchAction: 'manipulation' }}>Limpar</button>}
            </div>

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                width={680}
                height={900}
                style={{ flex: 1, width: '100%', cursor: 'crosshair', touchAction: 'none', display: 'block' }}
                onPointerDown={e => { drawing.current = true; const p = getPos(e); lastPos.current = p; emitStroke('start', p.x, p.y); (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
                onPointerMove={e => { if (!drawing.current) return; const p = getPos(e); emitStroke('move', p.x, p.y); lastPos.current = p; }}
                onPointerUp={() => { drawing.current = false; }}
                onPointerLeave={() => { drawing.current = false; }}
            />
        </div>
    );
}

// ─── Quiz Panel ───────────────────────────────────────────────────────────────
function QuizPanel({ socket, code, isHost, userId, userName }: any) {
    const [quiz, setQuiz] = useState<QuizState | null>(null);
    const [questions, setQuestions] = useState<QuizQuestion[]>([{ text: '', options: ['', '', '', ''], correct: 0 }]);
    const [answered, setAnswered] = useState<Record<number, number>>({});
    const [timer, setTimer] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!socket) return;
        const onState = (q: QuizState) => { setQuiz(q); };
        socket.on('activity:quiz:state', onState);
        return () => { socket.off('activity:quiz:state', onState); };
    }, [socket]);

    useEffect(() => {
        if (quiz?.state === 'question') {
            setTimer(20);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => setTimer(t => { if (t <= 1) { clearInterval(timerRef.current!); return 0; } return t - 1; }), 1000);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [quiz?.current, quiz?.state]);

    const create = () => {
        const valid = questions.filter(q => q.text.trim() && q.options.filter(o => o.trim()).length >= 2);
        if (!valid.length) return;
        socket?.emit('activity:quiz:create', { code, questions: valid });
    };

    const answer = (optionIndex: number) => {
        if (quiz === null) return;
        const qi = quiz.current;
        if (answered[qi] !== undefined || timer === 0) return;
        setAnswered(prev => ({ ...prev, [qi]: optionIndex }));
        socket?.emit('activity:quiz:answer', { code, userId, userName, questionIndex: qi, optionIndex });
    };

    const sortedScores = quiz ? Object.entries(quiz.scores as Record<string, number>).sort(([, a], [, b]) => (b as number) - (a as number)) : [];

    if (!quiz) {
        if (!isHost) return (
            <div style={{ ...panelPad, alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '3rem' }}>🎯</span>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>Aguardando o líder criar um Quiz...</div>
            </div>
        );
        return (
            <div style={panelPad}>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>PERGUNTAS DO QUIZ</div>
                {questions.map((q, qi) => (
                    <div key={qi} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <PanelInput placeholder={`Pergunta ${qi + 1}`} value={q.text} onChange={(e: any) => setQuestions(prev => prev.map((qq, i) => i === qi ? { ...qq, text: e.target.value } : qq))} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            {q.options.map((opt, oi) => (
                                <div key={oi} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                    <div onPointerDown={() => setQuestions(prev => prev.map((qq, i) => i === qi ? { ...qq, correct: oi } : qq))}
                                        style={{ width: 14, height: 14, borderRadius: '50%', background: q.correct === oi ? '#22C55E' : 'rgba(255,255,255,0.1)', cursor: 'pointer', flexShrink: 0, border: '2px solid rgba(255,255,255,0.2)', touchAction: 'manipulation' }} />
                                    <PanelInput placeholder={`Op. ${oi + 1}`} value={opt} onChange={(e: any) => setQuestions(prev => prev.map((qq, i) => i === qi ? { ...qq, options: qq.options.map((o, j) => j === oi ? e.target.value : o) } : qq))} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                <button onPointerDown={() => setQuestions(prev => [...prev, { text: '', options: ['', '', '', ''], correct: 0 }])}
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 10, color: 'rgba(255,255,255,0.5)', padding: '10px', cursor: 'pointer', touchAction: 'manipulation' }}>
                    + Adicionar Pergunta
                </button>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>💡 Clique no círculo verde para marcar a resposta correta</div>
                <PrimaryBtn onClick={create} color="#EA4335">Criar Quiz</PrimaryBtn>
            </div>
        );
    }

    if (quiz.state === 'waiting') return (
        <div style={{ ...panelPad, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <span style={{ fontSize: '3rem' }}>🎯</span>
            <div style={{ color: '#FFF', fontWeight: 700 }}>Quiz pronto! {quiz.questions.length} pergunta(s)</div>
            {isHost && <PrimaryBtn onClick={() => socket?.emit('activity:quiz:start', { code })} color="#EA4335">▶ Iniciar Quiz</PrimaryBtn>}
            {!isHost && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>Aguardando o líder iniciar...</div>}
        </div>
    );

    if (quiz.state === 'question') {
        const q = quiz.questions[quiz.current];
        const myAnswer = answered[quiz.current];
        const totalAnswers = Object.keys(quiz.answers[quiz.current] || {}).length;
        return (
            <div style={panelPad}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>Pergunta {quiz.current + 1}/{quiz.questions.length}</span>
                    <div style={{ background: timer > 10 ? '#22C55E' : '#EF4444', padding: '4px 12px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 700, color: '#FFF' }}>{timer}s</div>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                    <div style={{ height: '100%', background: timer > 10 ? '#22C55E' : '#EF4444', borderRadius: 2, width: `${timer / 20 * 100}%`, transition: 'width 1s linear, background 0.3s' }} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#FFF', lineHeight: 1.3 }}>{q.text}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {q.options.map((opt, i) => (
                        <div key={i} onPointerDown={() => !isHost && answer(i)}
                            style={{
                                borderRadius: 12, padding: '12px 16px', cursor: isHost ? 'default' : 'pointer',
                                background: myAnswer === i ? 'rgba(234,67,53,0.2)' : 'rgba(255,255,255,0.04)',
                                border: `1.5px solid ${myAnswer === i ? '#EA4335' : 'rgba(255,255,255,0.08)'}`,
                                color: '#FFF', fontSize: '0.88rem', touchAction: 'manipulation',
                            }}>
                            {opt} {myAnswer === i && '✓'}
                        </div>
                    ))}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{totalAnswers} respondeu(ram)</div>
                {isHost && <PrimaryBtn onClick={() => socket?.emit('activity:quiz:next', { code })} color="#EA4335">Próxima →</PrimaryBtn>}
            </div>
        );
    }

    return (
        <div style={panelPad}>
            <div style={{ textAlign: 'center', fontSize: '2rem' }}>🏆</div>
            <div style={{ fontWeight: 700, color: '#FFF', textAlign: 'center' }}>Placar Final</div>
            {sortedScores.map(([uid, score], i) => (
                <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: 12 }}>
                    <span style={{ fontSize: '1.1rem' }}>{['🥇', '🥈', '🥉'][i] || `${i + 1}.`}</span>
                    <div style={{ flex: 1, color: '#FFF', fontSize: '0.88rem' }}>{uid === userId ? userName : uid}</div>
                    <div style={{ fontWeight: 700, color: '#22C55E' }}>{score} pts</div>
                </div>
            ))}
            {isHost && <PrimaryBtn onClick={() => { setQuiz(null); setAnswered({}); setQuestions([{ text: '', options: ['', '', '', ''], correct: 0 }]); }} color="#333">Novo Quiz</PrimaryBtn>}
        </div>
    );
}

// ─── Tasks Panel ──────────────────────────────────────────────────────────────
function TasksPanel({ socket, code, userName }: any) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [input, setInput] = useState('');

    useEffect(() => {
        if (!socket) return;
        const onState = (t: Task[]) => setTasks(t);
        socket.on('activity:tasks:state', onState);
        socket.emit('activity:tasks:sync', { code });
        return () => { socket.off('activity:tasks:state', onState); };
    }, [socket, code]);

    const push = (newTasks: Task[]) => {
        setTasks(newTasks);
        socket?.emit('activity:tasks:update', { code, tasks: newTasks });
    };

    const add = () => {
        if (!input.trim()) return;
        push([...tasks, { id: `${Date.now()}-${Math.random()}`, text: input.trim(), done: false, author: userName }]);
        setInput('');
    };

    const toggle = (id: string) => push(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
    const remove = (id: string) => push(tasks.filter(t => t.id !== id));

    return (
        <div style={panelPad}>
            <div style={{ display: 'flex', gap: 8 }}>
                <PanelInput
                    placeholder="Nova tarefa..."
                    value={input}
                    onChange={(e: any) => setInput(e.target.value)}
                    onKeyDown={(e: any) => e.key === 'Enter' && add()}
                />
                <PrimaryBtn onClick={add} color="#34A853">Adicionar</PrimaryBtn>
            </div>

            {tasks.length === 0 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'rgba(255,255,255,0.35)' }}>
                    <span style={{ fontSize: '3rem' }}>✅</span>
                    <div style={{ fontSize: '0.85rem' }}>Nenhuma tarefa ainda</div>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tasks.map(task => (
                    <div key={task.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 14px',
                        border: task.done ? '1px solid rgba(52,168,83,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <div onPointerDown={() => toggle(task.id)} style={{
                            width: 20, height: 20, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', touchAction: 'manipulation',
                            background: task.done ? '#34A853' : 'transparent', border: `2px solid ${task.done ? '#34A853' : 'rgba(255,255,255,0.2)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '0.7rem',
                        }}>{task.done ? '✓' : ''}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: task.done ? 'rgba(255,255,255,0.35)' : '#FFF', fontSize: '0.88rem', textDecoration: task.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.text}</div>
                            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' }}>{task.author}</div>
                        </div>
                        <button onPointerDown={() => remove(task.id)} style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.5)', cursor: 'pointer', fontSize: '0.9rem', padding: '0 4px', touchAction: 'manipulation', flexShrink: 0 }}>✕</button>
                    </div>
                ))}
            </div>

            {tasks.length > 0 && (
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                    {tasks.filter(t => t.done).length}/{tasks.length} concluídas
                </div>
            )}
        </div>
    );
}
