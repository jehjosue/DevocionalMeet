import React, { useState } from 'react';

export default function WaitingScreen({ room, onEndCall, isMuted, isCameraOff, onToggleMic, onToggleCam, userName }: any) {
    const [copied, setCopied] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);

    const handleCopy = async () => {
        const link = room.link || `${window.location.origin}/room/${room.code}`;
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        const link = room.link || `${window.location.origin}/room/${room.code}`;
        if (navigator.share) {
            await navigator.share({
                title: 'Entrar na reunião DevocionalMeet',
                text: 'Você foi convidado para uma reunião no DevocionalMeet',
                url: link,
            });
        } else {
            setShareOpen(true);
        }
    };

    return (
        <div style={{
            position: 'absolute', inset: 0,
            background: '#000',
            display: 'flex', flexDirection: 'column',
            zIndex: 100,
        }}>
            <div style={{ flex: 1, padding: '0 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, marginBottom: 10 }}>
                    Só você está aqui
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: 20 }}>
                    Compartilhe este link da reunião com quem você quer que participe.
                </p>

                <div style={{
                    background: '#2A3942', borderRadius: 14,
                    padding: '15px 16px', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 20,
                }}>
                    <span style={{ color: '#fff', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {(room.link || "").replace('https://', '').replace('http://', '')}
                    </span>
                    <button onClick={handleCopy} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 10, color: copied ? '#25D366' : 'rgba(255,255,255,0.6)' }}>
                        {copied ? '✓' : '📋'}
                    </button>
                </div>

                <button onClick={handleShare} style={{
                    background: '#25D366',
                    border: 'none', borderRadius: 999,
                    padding: '14px 28px',
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    color: '#000', fontSize: '0.95rem', fontWeight: 700,
                    cursor: 'pointer', width: 'fit-content',
                }}>
                    🚀 Enviar convite
                </button>
            </div>

            {/* Control bar */}
            <div style={{
                margin: '0 12px 24px',
                background: 'rgba(30,30,30,0.95)',
                borderRadius: 999, padding: '10px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
            }}>
                <button onClick={onToggleCam} style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: isCameraOff ? '#EF4444' : 'rgba(255,255,255,0.12)',
                    border: 'none', cursor: 'pointer', fontSize: '1.2rem',
                }}>📷</button>
                <button onClick={onToggleMic} style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: isMuted ? '#EF4444' : 'rgba(255,255,255,0.12)',
                    border: 'none', cursor: 'pointer', fontSize: '1.2rem',
                }}>🎤</button>
                <button onClick={onEndCall} style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: '#EF4444', border: 'none', cursor: 'pointer', fontSize: '1.2rem',
                }}>📵</button>
            </div>
        </div>
    );
}
