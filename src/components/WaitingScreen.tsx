import React, { useState } from 'react';
import { Copy, Check, Camera, Mic, MicOff, VideoOff, PhoneOff } from 'lucide-react';

export default function WaitingScreen({ room, onEndCall, isMuted, isCameraOff, onToggleMic, onToggleCam, userName }: any) {
    const [copied, setCopied] = useState(false);

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
            handleCopy();
        }
    };

    return (
        <div style={{
            position: 'absolute', inset: 0,
            background: '#000',
            display: 'flex', flexDirection: 'column',
            zIndex: 100,
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            <div style={{ flex: 1, padding: '0 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 500, margin: '0 auto' }}>
                <h1 style={{
                    color: '#fff',
                    fontSize: '32px',
                    fontWeight: '800',
                    marginBottom: '16px',
                    letterSpacing: '-0.02em'
                }}>
                    Só você está aqui
                </h1>

                <p style={{
                    color: '#E0E0E0',
                    fontSize: '18px',
                    lineHeight: '1.4',
                    marginBottom: '32px'
                }}>
                    Compartilhe este link da reunião com quem você quer que participe.
                </p>

                <div style={{
                    background: '#1F2937',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '24px',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <span style={{
                        color: '#9CA3AF',
                        fontSize: '16px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                    }}>
                        {`${window.location.host}/room/${room.code}`}
                    </span>
                    <button onClick={handleCopy} style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        marginLeft: '12px',
                        color: copied ? '#22C55E' : '#9CA3AF',
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        {copied ? <Check size={20} /> : <Copy size={20} />}
                    </button>
                </div>

                <button onClick={handleShare} style={{
                    background: '#22C55E',
                    border: 'none',
                    borderRadius: '99px',
                    padding: '16px 32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: '#000',
                    fontSize: '18px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    width: 'fit-content',
                    transition: 'all 0.2s ease',
                }}
                    onMouseOver={(e: any) => e.currentTarget.style.backgroundColor = '#16a34a'}
                    onMouseOut={(e: any) => e.currentTarget.style.backgroundColor = '#22C55E'}
                >
                    🚀 Enviar convite
                </button>
            </div>

            {/* Control bar */}
            <div style={{
                margin: '0 auto 40px',
                background: '#1F2937',
                borderRadius: '99px',
                padding: '12px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '20px',
                border: '1px solid rgba(255,255,255,0.05)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
            }}>
                <button onClick={onToggleCam} style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: isCameraOff ? '#EF4444' : 'rgba(255,255,255,0.08)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s'
                }}>
                    {isCameraOff ? <VideoOff size={24} /> : <Camera size={24} />}
                </button>
                <button onClick={onToggleMic} style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: isMuted ? '#EF4444' : 'rgba(255,255,255,0.08)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s'
                }}>
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                <button onClick={onEndCall} style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: '#EF4444',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s'
                }}>
                    <PhoneOff size={24} />
                </button>
            </div>
        </div>
    );
}
