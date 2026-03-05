import React, { useState, useEffect } from 'react';

export default function Activities({ isOpen, onClose, spotifyActive, roomId, userName }: any) {
    const [view, setView] = useState('grid'); // 'grid' | 'spotify'
    const [toast, setToast] = useState<string | null>(null);

    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(t);
        }
    }, [toast]);

    if (!isOpen) return null;

    const apps = [
        { id: 'spotify', name: 'Spotify', icon: '🎵', desc: 'Ouça com todos', color: '#1DB954', bg: '#0a2e14' },
        { id: 'youtube', name: 'YouTube', icon: '▶️', desc: 'Assista juntos', color: '#FF0000', bg: '#2e0a0a' },
        { id: 'poll', name: 'Enquete', icon: '📊', desc: 'Crie uma votação', color: '#4285F4', bg: '#0a1a3a' },
        { id: 'whiteboard', name: 'Whiteboard', icon: '🖊️', desc: 'Colabore ao vivo', color: '#FBBC04', bg: '#2e260a' },
        { id: 'quiz', name: 'Quiz', icon: '🎯', desc: 'Teste o grupo', color: '#EA4335', bg: '#2e0e0a' },
        { id: 'tasks', name: 'Tarefas', icon: '✅', desc: 'Lista colaborativa', color: '#34A853', bg: '#0a2e14' },
    ];

    return (
        <>
            {/* Backdrop */}
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000 }} />

            {/* Panel */}
            <div style={{
                position: 'fixed', top: 0, right: 0, bottom: 0,
                width: 'min(340px, 88vw)',
                background: '#1A1A1A',
                borderLeft: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '-20px 0 60px rgba(0,0,0,0.6)',
                zIndex: 1001,
                display: 'flex', flexDirection: 'column',
                animation: 'waSlideInRight 0.28s ease',
            }}>
                {/* Header */}
                <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    {view !== 'grid' && (
                        <button onClick={() => setView('grid')} style={{ background: 'none', border: 'none', color: '#FFF', fontSize: '1.2rem', cursor: 'pointer' }}>‹</button>
                    )}
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{view === 'grid' ? 'Atividades' : view.toUpperCase()}</div>
                        {view === 'grid' && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>Compartilhe com a sala</div>}
                    </div>
                    <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#FFF', cursor: 'pointer' }}>✕</button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                    {view === 'grid' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {apps.map(app => (
                                <div
                                    key={app.id}
                                    onClick={() => app.id === 'spotify' ? setView('spotify') : setToast(`${app.name} — em breve no Antgravity!`)}
                                    style={{
                                        padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.04)',
                                        border: '1.5px solid rgba(255,255,255,0.07)',
                                        cursor: 'pointer', transition: 'background 0.2s',
                                        display: 'flex', flexDirection: 'column', gap: 4,
                                    }}
                                >
                                    <span style={{ fontSize: '1.4rem' }}>{app.icon}</span>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: app.color }}>{app.name}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.2 }}>{app.desc}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <SpotifyPanel roomId={roomId} userName={userName} />
                    )}
                </div>

                {/* Footer */}
                {view === 'grid' && (
                    <div style={{ padding: 16 }}>
                        <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', textAlign: 'center' }}>
                            🔜 Mais apps em breve
                        </div>
                    </div>
                )}

                {/* Toast */}
                {toast && (
                    <div style={{
                        position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)',
                        background: 'rgba(30,30,30,0.96)', backdropFilter: 'blur(12px)',
                        padding: '10px 20px', borderRadius: 24, fontSize: '0.8rem', color: '#FFF',
                        border: '1px solid rgba(255,255,255,0.1)', zIndex: 1100, animation: 'waFadeUp 0.3s ease',
                    }}>
                        {toast}
                    </div>
                )}
            </div>

            <style>{`
        @keyframes waSlideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes waFadeUp { from { transform: translate(-50%, 8px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
        </>
    );
}

function SpotifyPanel({ roomId, userName }: any) {
    const [tab, setTab] = useState('playing'); // 'playing' | 'search' | 'queue'

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
            {/* Mini Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1DB954' }}>
                <div style={{ width: 8, height: 8, background: '#1DB954', borderRadius: '50%' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Spotify ● 1 ouvindo agora</span>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Tocando', 'Buscar', 'Fila'].map((t, i) => {
                    const id = ['playing', 'search', 'queue'][i];
                    const isActive = tab === id;
                    return (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            style={{
                                flex: 1, padding: '10px 0', background: 'none', border: 'none',
                                color: isActive ? '#1DB954' : 'rgba(255,255,255,0.45)',
                                borderBottom: isActive ? '2px solid #1DB954' : '2px solid transparent',
                                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                            }}
                        >{t}</button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1 }}>
                {tab === 'playing' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ aspectRatio: '1/1', borderRadius: 10, background: '#333', boxShadow: '0 16px 40px rgba(0,0,0,0.6)' }} />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Nenhuma música tocando</div>
                            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem' }}>Inicie uma música na aba Buscar</div>
                        </div>

                        {/* Simple Progress (Mock) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, position: 'relative' }}>
                                <div style={{ width: '0%', height: '100%', background: '#1DB954', borderRadius: 2 }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                                <span>0:00</span><span>3:45</span>
                            </div>
                        </div>

                        {/* Controls (Mock) */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                            <span style={{ fontSize: '1.2rem', cursor: 'pointer' }}>⏮</span>
                            <div style={{ width: 52, height: 52, background: '#1DB954', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', color: '#000', cursor: 'pointer' }}>▶</div>
                            <span style={{ fontSize: '1.2rem', cursor: 'pointer' }}>⏭</span>
                        </div>
                    </div>
                )}

                {tab === 'search' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input placeholder="Buscar música..." style={{ flex: 1, background: '#282828', border: 'none', borderRadius: 20, padding: '10px 16px', color: '#FFF', outline: 'none' }} />
                            <button style={{ background: '#1DB954', border: 'none', borderRadius: 20, padding: '0 16px', fontWeight: 700, cursor: 'pointer' }}>Ir</button>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1 }}>Sugeridas para a sala</div>
                        {/* TrackRows would go here */}
                    </div>
                )}
            </div>

            {/* Sync Footer */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, background: '#1DB954', borderRadius: '50%' }} />
                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)' }}>Sincronizado via Socket.io</div>
            </div>
        </div>
    );
}
