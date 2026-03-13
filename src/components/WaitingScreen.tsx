import React, { useState, useEffect, useRef } from 'react';

interface WaitingScreenProps {
    meetLink: string;
    onEndCall: () => void;
    isMuted: boolean;
    isCameraOff: boolean;
    onToggleMic: () => void;
    onToggleCam: () => void;
    localVideoTrack: any;
}

export default function WaitingScreen({
    meetLink, onEndCall, isMuted, isCameraOff, onToggleMic, onToggleCam, localVideoTrack
}: WaitingScreenProps) {
    const [copied, setCopied] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const tryPlay = (attempts = 0) => {
            if (!localVideoTrack) {
                if (attempts < 15) setTimeout(() => tryPlay(attempts + 1), 400);
                return;
            }
            const container = videoContainerRef.current;
            if (!container) return;
            if (container.querySelector('video')) return;
            try {
                localVideoTrack.play(container);
                setTimeout(() => {
                    const vid = container.querySelector('video');
                    if (vid) {
                        vid.style.cssText =
                            'width:100%!important;height:100%!important;' +
                            'object-fit:cover!important;position:absolute!important;' +
                            'top:0!important;left:0!important;' +
                            'transform:scaleX(-1)!important;';
                    }
                }, 150);
            } catch (e) {
                console.warn('Erro ao reproduzir vídeo:', e);
            }
        };
        tryPlay();
    }, [localVideoTrack]);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(meetLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        const shareData = {
            title: 'DevocionalMeet - Reunião',
            text: 'Você foi convidado para um devocional! Clique para participar.',
            url: meetLink,
        };
        if (navigator.share) {
            try { await navigator.share(shareData); }
            catch (e) { /* usuário cancelou */ }
        } else {
            setShowShareModal(true);
        }
    };

    return (
        <div style={{
            position: 'relative',
            width: '100vw',
            height: '100vh',
            background: '#000',
            overflow: 'hidden',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            {/* 1. STATUS BAR (topo) */}
            <div style={{
                height: '44px',
                background: '#000',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 16px',
                position: 'absolute',
                top: 0, left: 0, right: 0,
                zIndex: 10
            }}>
                {/* Esquerda: Chevron */}
                <div style={{ cursor: 'pointer' }} onClick={onEndCall}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </div>

                {/* Centro: Badge pill */}
                <div style={{
                    background: 'rgba(255,255,255,0.18)',
                    borderRadius: '999px',
                    padding: '7px 16px',
                    color: '#fff',
                    fontSize: '0.88rem',
                    fontWeight: 500
                }}>
                    Só você está aqui
                </div>

                {/* Direita: Camera flip & Bluetooth */}
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
                        <path d="M17 2l2 2-2 2M7 2L5 4l2 2" />
                    </svg>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
                    </svg>
                </div>
            </div>

            {/* 2. ÁREA PRINCIPAL (meio da tela) */}
            <div style={{
                position: 'absolute',
                top: '38%',
                left: 0, right: 0,
                padding: '0 28px',
                zIndex: 5
            }}>
                <h1 style={{
                    color: '#ffffff',
                    fontSize: '1.3rem',
                    fontWeight: 700,
                    marginBottom: '10px'
                }}>
                    Só você está aqui
                </h1>
                <p style={{
                    color: 'rgba(255,255,255,0.88)',
                    fontSize: '0.95rem',
                    fontWeight: 400,
                    lineHeight: '1.55',
                    marginBottom: '22px',
                    maxWidth: '340px'
                }}>
                    Compartilhe este link da reunião com quem você quer que participe.
                </p>

                {/* Campo do link */}
                <div style={{
                    background: '#2C2C2E',
                    borderRadius: '14px',
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '20px'
                }}>
                    <span style={{
                        color: '#ffffff',
                        fontSize: '0.92rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                    }}>
                        {meetLink.replace('https://', '').replace('http://', '')}
                    </span>
                    <button onClick={handleCopy} style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        marginLeft: '12px',
                        color: copied ? '#34C759' : 'rgba(255,255,255,0.65)',
                        transition: 'color 0.2s',
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        {copied ? (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        ) : (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Botão Enviar convite */}
                <button
                    onClick={handleShare}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: '#3B82F6',
                        borderRadius: '999px',
                        padding: '13px 26px',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#ffffff',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
                        transition: 'all 0.15s ease'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                    onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.03)';
                        e.currentTarget.style.boxShadow = '0 6px 24px rgba(59,130,246,0.5)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,130,246,0.35)';
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                        <polyline points="16 6 12 2 8 6" />
                        <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    Enviar convite
                </button>
            </div>

            {/* 3. PREVIEW DO PRÓPRIO VÍDEO (canto inferior direito) */}
            <div style={{
                position: 'absolute',
                bottom: '100px',
                right: '12px',
                width: '128px',
                borderRadius: '18px',
                overflow: 'hidden',
                background: '#1C1C1E',
                boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
                zIndex: 10
            }}>
                <div style={{
                    width: '100%',
                    aspectRatio: '3/4',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'block'
                }}>
                    <div ref={videoContainerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
                </div>
                {/* Sobreposição inferior */}
                <div style={{
                    position: 'absolute',
                    bottom: 0, width: '100%',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)',
                    padding: '22px 8px 7px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    zIndex: 2
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" opacity="0.9">
                        <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" />
                    </svg>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white" opacity="0.9">
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                    </svg>
                </div>
            </div>

            {/* 4. BARRA DE CONTROLES (bottom) */}
            <div style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                padding: '10px 16px 32px',
                background: 'rgba(28,28,30,0.92)',
                backdropFilter: 'blur(20px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 15
            }}>
                <button onClick={onToggleCam} style={{
                    width: '60px', height: '60px', borderRadius: '18px',
                    background: isCameraOff ? '#FFCDD2' : '#3A3A3C',
                    color: isCameraOff ? '#C62828' : '#fff',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'transform 0.12s ease'
                }} onPointerDown={(e) => e.currentTarget.style.transform = 'scale(0.91)'} onPointerUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {isCameraOff ? <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34M23 7l-7 5 7 5V7z M1 1l22 22" /> :
                            <><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></>}
                    </svg>
                </button>

                <button onClick={onToggleMic} style={{
                    width: '60px', height: '60px', borderRadius: '18px',
                    background: isMuted ? '#FFCDD2' : '#3A3A3C',
                    color: isMuted ? '#C62828' : '#fff',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'transform 0.12s ease'
                }} onPointerDown={(e) => e.currentTarget.style.transform = 'scale(0.91)'} onPointerUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {isMuted ? <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z M19 10v1a7 7 0 0 1-14 0v-1 M12 19v3 M8 22h8 M1 1l22 22" /> :
                            <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="22" x2="16" y2="22" /></>}
                    </svg>
                </button>

                <button style={{
                    width: '60px', height: '60px', borderRadius: '18px',
                    background: '#3A3A3C', color: '#fff',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
                    </svg>
                </button>

                <button style={{
                    width: '60px', height: '60px', borderRadius: '18px',
                    background: '#3A3A3C', color: '#fff',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                    </svg>
                </button>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '1.5px', height: '38px', background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
                    <button onClick={onEndCall} style={{
                        width: '76px', height: '60px', borderRadius: '18px',
                        background: '#D32F2F', color: '#fff',
                        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 18px rgba(211,47,47,0.5)',
                        transition: 'transform 0.12s ease'
                    }} onPointerDown={(e) => e.currentTarget.style.transform = 'scale(0.91)'} onPointerUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67 19.42 19.42 0 0 1-2.67-3.33A19.79 19.79 0 0 1 3.07 4.82 2 2 0 0 1 5 2.64h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.99 10.55a16 16 0 0 0 2.6 3.41z" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* 7. MODAL DE COMPARTILHAMENTO (fallback) */}
            {showShareModal && (
                <div
                    onClick={() => setShowShareModal(false)}
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(0,0,0,0.72)',
                        display: 'flex', alignItems: 'center', justifyContents: 'center',
                        zIndex: 200
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#1C1C1E',
                            borderRadius: '22px',
                            padding: '24px 20px',
                            width: 'min(320px, 90vw)',
                            margin: 'auto'
                        }}
                    >
                        <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: 700, marginBottom: '20px' }}>Compartilhar reunião</h3>
                        <div style={{
                            background: '#2C2C2E', borderRadius: '12px', padding: '12px',
                            display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px'
                        }}>
                            <span style={{ color: '#fff', fontSize: '0.85rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{meetLink}</span>
                            <button onClick={handleCopy} style={{ background: 'none', border: 'none', color: copied ? '#34C759' : '#fff' }}>
                                {copied ? '✓' : '📋'}
                            </button>
                        </div>
                        <div style={{ display: 'grid', gap: '10px' }}>
                            <a
                                href={`https://wa.me/?text=${encodeURIComponent('Entre na reunião: ' + meetLink)}`}
                                target="_blank" rel="noreferrer"
                                style={{ background: '#25D366', color: '#000', padding: '12px', borderRadius: '12px', textAlign: 'center', textDecoration: 'none', fontWeight: 600 }}
                            >
                                WhatsApp
                            </a>
                            <a
                                href={`https://t.me/share/url?url=${encodeURIComponent(meetLink)}`}
                                target="_blank" rel="noreferrer"
                                style={{ background: '#229ED9', color: '#fff', padding: '12px', borderRadius: '12px', textAlign: 'center', textDecoration: 'none', fontWeight: 600 }}
                            >
                                Telegram
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
